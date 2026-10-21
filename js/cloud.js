/* Accounts and saving with Supabase: e-mail sign-in link (or 6-digit code),
   display name, and the app state stored per user. The app keeps working
   offline and without an account; changes are pushed when possible. */
(function () {
  'use strict';

  var U = window.UI;
  var S = window.Sync;
  var App = window.App;
  var $ = U.$, el = U.el, toast = U.toast;
  var state = App.state;
  var cfg = window.CLOUD_CONFIG || {};
  var SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js';

  var client = null, user = null, profile = null;
  var status = 'off'; // off | out | syncing | saved | pending | offline | error
  var pushTimer = null;

  var configured = !!(cfg.url && cfg.key && /^https:\/\//.test(cfg.url));
  var btn = $('#account-btn');
  if (!configured) { btn.hidden = true; window.Cloud = { changed: function () {} }; return; }
  btn.hidden = false;

  function loadSdk() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = SDK;
      s.onload = function () { window.supabase ? resolve(window.supabase) : reject(new Error('Supabase fehlt')); };
      s.onerror = function () { reject(new Error('Die Anmeldung ist gerade nicht erreichbar.')); };
      document.head.appendChild(s);
    });
  }

  function redirectUrl() { return location.origin + location.pathname; }

  function errorText(e) {
    var m = (e && (e.message || e.error_description)) || '';
    if (/rate limit|too many|security purposes/i.test(m)) return 'Zu viele Versuche. Bitte warte ein paar Minuten und versuch es dann noch einmal.';
    if (/invalid.*(token|otp)|expired/i.test(m)) return 'Der Code ist falsch oder abgelaufen. Fordere einen neuen an.';
    if (/email/i.test(m) && /invalid/i.test(m)) return 'Diese E-Mail-Adresse sieht nicht gültig aus.';
    if (/fetch|network|failed to fetch/i.test(m)) return 'Keine Verbindung. Prüfe dein Internet.';
    return m || 'Das hat nicht geklappt. Versuch es noch einmal.';
  }

  // ---------- status in the header ----------
  var LABEL = { out: 'Anmelden', syncing: 'Speichert …', saved: 'Gespeichert', pending: 'Nicht gespeichert', offline: 'Offline', error: 'Fehler beim Speichern' };
  function setStatus(s) {
    status = s;
    btn.innerHTML = '';
    btn.dataset.status = s;
    if (!user) {
      btn.appendChild(U.icon('user'));
      btn.appendChild(el('span', { class: 'acc-label', text: 'Anmelden' }));
      btn.setAttribute('aria-label', 'Anmelden');
      return;
    }
    var name = profile && profile.display_name || user.email;
    btn.appendChild(el('span', { class: 'avatar', text: name.charAt(0).toUpperCase() }));
    btn.appendChild(el('span', { class: 'sync-dot', 'aria-hidden': 'true' }));
    btn.setAttribute('aria-label', 'Konto von ' + name + ' – ' + (LABEL[s] || ''));
    var open = $('#account-sheet');
    if (!open.hidden) renderSheet();
  }

  // ---------- data ----------
  function pull() {
    return client.from('user_data').select('data, updated_at').eq('user_id', user.id).maybeSingle()
      .then(function (r) { if (r.error) throw r.error; return r.data; });
  }
  function push() {
    var sentAt = Date.now();
    var payload = { user_id: user.id, data: S.forCloud(state), updated_at: new Date(sentAt).toISOString() };
    setStatus('syncing');
    return client.from('user_data').upsert(payload).then(function (r) {
      if (r.error) throw r.error;
      state.meta = state.meta || {};
      state.meta.userId = user.id;
      state.meta.syncedAt = sentAt;
      // Edits made while this was on its way are still unsaved: send them next.
      var dirty = (state.meta.updatedAt || 0) > sentAt;
      if (!dirty) state.meta.updatedAt = sentAt;
      U.save(state);
      if (dirty) changed(); else setStatus('saved');
    }).catch(function (e) {
      setStatus(navigator.onLine === false ? 'offline' : 'error');
      throw e;
    });
  }
  /** Replaces the app state with the account's data and reloads the views. */
  function adopt(data, remoteTime) {
    var keep = { view: state.view };
    Object.keys(state).forEach(function (k) { delete state[k]; });
    Object.assign(state, data, keep);
    state.meta = { userId: user.id, syncedAt: remoteTime, updatedAt: remoteTime };
    U.save(state);
    location.reload();
  }

  function sync() {
    if (!user) return Promise.resolve();
    setStatus('syncing');
    return pull().then(function (row) {
      var action = S.decide(state, row, user.id);
      var remoteTime = row ? Date.parse(row.updated_at) || Date.now() : 0;
      if (action === 'push') return push();
      if (action === 'pull') { adopt(row.data, remoteTime); return; }
      if (action === 'merge') {
        var merged = S.merge(state, row.data);
        Object.keys(merged).forEach(function (k) { state[k] = merged[k]; });
        return push().then(function () { location.reload(); });
      }
      setStatus('saved');
    }).catch(function (e) {
      if (status === 'syncing') setStatus(navigator.onLine === false ? 'offline' : 'error');
      console.warn('Sync', e);
    });
  }

  /** Called by App.save(): push a little later so quick edits go out together. */
  function changed() {
    if (!user) return;
    setStatus('pending');
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () { push().catch(function () {}); }, 1500);
  }
  window.addEventListener('online', function () { if (user) sync(); });
  document.addEventListener('visibilitychange', function () {
    // Leaving the app: send pending changes right away. Coming back: fetch what other devices saved.
    if (!user) return;
    if (document.visibilityState === 'hidden' && status === 'pending') { clearTimeout(pushTimer); push().catch(function () {}); }
    if (document.visibilityState === 'visible' && status !== 'pending') sync();
  });

  // ---------- profile (display name) ----------
  function loadProfile() {
    return client.from('profiles').select('display_name').eq('id', user.id).maybeSingle().then(function (r) {
      if (r.error) throw r.error;
      profile = r.data;
      return profile;
    });
  }
  function saveName(name) {
    return client.from('profiles').upsert({ id: user.id, display_name: name, updated_at: new Date().toISOString() }).then(function (r) {
      if (r.error) throw r.error;
      profile = { display_name: name };
    });
  }

  // ---------- account sheet ----------
  var flow = { step: 'email', email: '', busy: false, error: '' };
  function openSheet() {
    var sheet = $('#account-sheet');
    if (!user && flow.step !== 'sent') flow.step = 'email';
    sheet.hidden = false;
    renderSheet();
    document.addEventListener('keydown', escSheet);
  }
  function closeSheet() {
    $('#account-sheet').hidden = true;
    document.removeEventListener('keydown', escSheet);
  }
  function escSheet(ev) { if (ev.key === 'Escape' && (!user || profile)) closeSheet(); }

  function field(id, label, attrs) {
    var input = el('input', Object.assign({ id: id }, attrs || {}));
    return { input: input, el: el('label', { class: 'field', for: id }, [el('span', { class: 'label', text: label }), input]) };
  }
  function renderSheet() {
    var sheet = $('#account-sheet');
    sheet.innerHTML = '';
    var panel = el('div', { class: 'sheet-panel', role: 'document' });
    var mustName = user && !profile;
    sheet.appendChild(el('div', { class: 'sheet-backdrop', onclick: function () { if (!mustName) closeSheet(); } }));
    sheet.appendChild(panel);
    panel.appendChild(el('div', { class: 'route-grab', 'aria-hidden': 'true' }));
    var err = flow.error ? el('p', { class: 'error', role: 'alert', text: flow.error }) : null;

    if (!user && flow.step === 'email') {
      var f = field('acc-email', 'E-Mail-Adresse', { type: 'email', autocomplete: 'email', inputmode: 'email', required: true, placeholder: 'du@beispiel.de', value: flow.email });
      var form = el('form', { class: 'sheet-form' }, [
        el('p', { class: 'eyebrow', text: 'Konto' }),
        el('h2', { id: 'acc-title', text: 'Anmelden oder Konto anlegen' }),
        el('p', { class: 'muted', text: 'Mit Konto sind deine Bohnen, Shots, Rezepte und Bewertungen sicher gespeichert – auch auf dem Handy und am Rechner. Du bekommst eine E-Mail mit einem Link, ein Passwort brauchst du nicht.' }),
        f.el, err,
        el('button', { class: 'btn accent', type: 'submit', disabled: flow.busy || null }, [flow.busy ? 'Sende …' : 'Anmelde-Link schicken']),
        el('button', { class: 'btn ghost', type: 'button', onclick: closeSheet }, ['Erst mal ohne Konto'])
      ]);
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        flow.email = f.input.value.trim();
        flow.busy = true; flow.error = '';
        renderSheet();
        client.auth.signInWithOtp({ email: flow.email, options: { emailRedirectTo: redirectUrl(), shouldCreateUser: true } }).then(function (r) {
          flow.busy = false;
          if (r.error) { flow.error = errorText(r.error); renderSheet(); return; }
          flow.step = 'sent';
          renderSheet();
        }, function (e) { flow.busy = false; flow.error = errorText(e); renderSheet(); });
      });
      panel.appendChild(form);
      setTimeout(function () { f.input.focus(); }, 50);
      return;
    }

    if (!user && flow.step === 'sent') {
      var code = field('acc-code', 'Oder den 6-stelligen Code aus der Mail eingeben', { inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: 8, pattern: '[0-9]*', placeholder: '123456' });
      var codeForm = el('form', { class: 'sheet-form' }, [
        el('p', { class: 'eyebrow', text: 'Fast geschafft' }),
        el('h2', { id: 'acc-title', text: 'Schau in dein Postfach' }),
        el('p', {}, ['Wir haben eine Mail an ', el('strong', { text: flow.email }), ' geschickt. Tippe auf den Link darin – damit ist deine Adresse bestätigt und du bist angemeldet.']),
        el('p', { class: 'muted', text: 'Öffne den Link am besten auf diesem Gerät und in diesem Browser. Nichts angekommen? Schau auch im Spam-Ordner nach.' }),
        code.el, err,
        el('button', { class: 'btn accent', type: 'submit', disabled: flow.busy || null }, [flow.busy ? 'Prüfe …' : 'Code bestätigen']),
        el('div', { class: 'row-actions' }, [
          el('button', { class: 'btn small ghost', type: 'button', onclick: function () { flow.step = 'email'; flow.error = ''; renderSheet(); } }, ['Andere Adresse']),
          el('button', { class: 'btn small ghost', type: 'button', onclick: closeSheet }, ['Schließen'])
        ])
      ]);
      codeForm.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var token = code.input.value.replace(/\D/g, '');
        if (token.length < 6) { flow.error = 'Bitte gib den ganzen Code ein.'; renderSheet(); return; }
        flow.busy = true; flow.error = '';
        renderSheet();
        client.auth.verifyOtp({ email: flow.email, token: token, type: 'email' }).then(function (r) {
          flow.busy = false;
          if (r.error) { flow.error = errorText(r.error); renderSheet(); }
          // success arrives through onAuthStateChange
        }, function (e) { flow.busy = false; flow.error = errorText(e); renderSheet(); });
      });
      panel.appendChild(codeForm);
      return;
    }

    if (mustName || flow.step === 'name') {
      var n = field('acc-name', 'Dein Name in der App', { maxlength: 40, autocomplete: 'nickname', required: true, placeholder: 'z. B. Paul', value: profile && profile.display_name || '' });
      var nameForm = el('form', { class: 'sheet-form' }, [
        el('p', { class: 'eyebrow', text: profile ? 'Name ändern' : 'Willkommen!' }),
        el('h2', { id: 'acc-title', text: 'Wie möchtest du heißen?' }),
        el('p', { class: 'muted', text: 'So begrüßt dich die App. Du kannst den Namen jederzeit ändern.' }),
        n.el, err,
        el('button', { class: 'btn accent', type: 'submit', disabled: flow.busy || null }, [flow.busy ? 'Speichere …' : (profile ? 'Speichern' : 'Konto fertig einrichten')])
      ]);
      nameForm.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var name = n.input.value.trim().replace(/\s+/g, ' ');
        if (!name) { flow.error = 'Gib einen Namen ein.'; renderSheet(); return; }
        flow.busy = true; flow.error = '';
        renderSheet();
        var first = !profile;
        saveName(name).then(function () {
          flow.busy = false; flow.step = 'account';
          setStatus(status);
          U.tick('major');
          toast(first ? 'Willkommen, ' + name + '! Deine Daten werden ab jetzt gespeichert.' : 'Name geändert.');
          if (first) closeSheet(); else renderSheet();
        }, function (e) { flow.busy = false; flow.error = errorText(e); renderSheet(); });
      });
      panel.appendChild(nameForm);
      setTimeout(function () { n.input.focus(); }, 50);
      return;
    }

    // signed in
    var when = state.meta && state.meta.syncedAt ? new Date(state.meta.syncedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '–';
    panel.appendChild(el('div', { class: 'sheet-form' }, [
      el('div', { class: 'acc-head' }, [
        el('span', { class: 'avatar big', text: profile.display_name.charAt(0).toUpperCase() }),
        el('div', {}, [el('h2', { id: 'acc-title', text: 'Hallo, ' + profile.display_name }), el('p', { class: 'muted', text: user.email })])
      ]),
      el('div', { class: 'acc-sync acc-' + status }, [
        el('span', { class: 'sync-dot', 'aria-hidden': 'true' }),
        el('div', {}, [el('strong', { text: LABEL[status] || 'Gespeichert' }), el('span', { class: 'muted', text: 'Zuletzt gesichert: ' + when })])
      ]),
      el('p', { class: 'muted', text: 'Bohnen, Shots, Bewertungen, eigene Rezepte und dein Brüh-Tagebuch werden in deinem Konto gespeichert. Melde dich auf einem anderen Gerät mit derselben Adresse an, dann ist alles dort.' }),
      el('div', { class: 'row-actions' }, [
        el('button', { class: 'btn small accent', type: 'button', onclick: function () { sync(); } }, ['Jetzt synchronisieren']),
        el('button', { class: 'btn small ghost', type: 'button', onclick: function () { flow.step = 'name'; flow.error = ''; renderSheet(); } }, ['Namen ändern']),
        el('button', { class: 'btn small ghost', type: 'button', onclick: signOut }, ['Abmelden'])
      ])
    ]));
  }

  function signOut() {
    var finish = function () {
      client.auth.signOut().finally(function () {
        // Data stays on this device; the next sign-in compares it with the account again.
        state.meta = { updatedAt: Date.now() };
        U.save(state);
        user = null; profile = null;
        closeSheet();
        setStatus('out');
        toast('Abgemeldet. Deine Daten bleiben in deinem Konto gespeichert.');
      });
    };
    if (status === 'pending') { clearTimeout(pushTimer); push().then(finish, finish); } else finish();
  }

  // ---------- start ----------
  btn.addEventListener('click', openSheet);
  setStatus('out');

  function signedIn(u) {
    user = u;
    flow = { step: 'account', email: u.email, busy: false, error: '' };
    loadProfile().catch(function () { return null; }).then(function () {
      setStatus('syncing');
      if (!profile) { openSheet(); }
      else if (!$('#account-sheet').hidden) renderSheet();
      return sync();
    });
  }

  loadSdk().then(function (sb) {
    client = sb.createClient(cfg.url, cfg.key, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    client.auth.onAuthStateChange(function (event, session) {
      if (event === 'SIGNED_IN' && session && (!user || user.id !== session.user.id)) {
        // Clean the ?code=… from the link out of the address bar.
        if (/[?&]code=/.test(location.search)) history.replaceState(null, '', location.pathname + location.hash);
        signedIn(session.user);
      }
      if (event === 'SIGNED_OUT') { user = null; profile = null; setStatus('out'); }
    });
    return client.auth.getSession().then(function (r) {
      var session = r.data && r.data.session;
      if (session && !user) signedIn(session.user);
      if (!session && !state.welcomeSeen && !/[?&]code=/.test(location.search)) {
        // First visit: invite to create an account (once).
        state.welcomeSeen = true;
        U.save(state);
        openSheet();
      }
      var err = new URLSearchParams(location.hash.slice(1)).get('error_description') || new URLSearchParams(location.search).get('error_description');
      if (err) { flow.error = errorText({ message: err }); openSheet(); history.replaceState(null, '', location.pathname); }
    });
  }).catch(function (e) {
    btn.hidden = true;
    console.warn('Konto nicht verfügbar:', e.message);
  });

  window.Cloud = { changed: changed, sync: sync, open: openSheet };
})();
