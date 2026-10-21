/* Brewing guide view: method picker, recipes, scaling and the guided brew timer. */
(function () {
  'use strict';

  var B = window.BrewData;
  var U = window.UI;
  var App = window.App;
  var $ = U.$, el = U.el, fmt = U.fmt, toast = U.toast;
  var state = App.state;

  var current = null; // scaled recipe shown in the detail panel
  state.brew.custom = state.brew.custom || [];
  state.brew.log = state.brew.log || [];

  function allRecipes(method) {
    return B.recipesFor(method).concat(state.brew.custom.filter(function (r) { return r.method === method; }));
  }
  function findRecipe(id) {
    return B.recipeById(id) || state.brew.custom.filter(function (r) { return r.id === id; })[0] || null;
  }

  function renderMethods() {
    var rail = $('#method-rail');
    rail.innerHTML = '';
    B.METHODS.forEach(function (m) {
      rail.appendChild(el('button', {
        class: 'method-card', type: 'button', role: 'tab', 'aria-selected': String(state.brew.method === m.id),
        onclick: function () {
          state.brew.method = m.id;
          state.brew.recipe = null;
          App.save();
          renderMethods(); renderRecipes(); renderDetail();
        }
      }, [U.icon(m.icon), el('strong', { text: m.name }), el('span', { text: m.tagline })]));
    });
  }

  function renderRecipes() {
    var grid = $('#recipe-grid');
    grid.innerHTML = '';
    allRecipes(state.brew.method).forEach(function (r, i) {
      grid.appendChild(el('button', {
        class: 'recipe-card', type: 'button', style: 'animation-delay:' + (i * 50) + 'ms',
        'aria-pressed': String(state.brew.recipe === r.id),
        onclick: function () {
          state.brew.recipe = r.id;
          state.brew.water = null;
          App.save();
          renderRecipes(); renderDetail(true);
        }
      }, [
        el('h3', { text: r.name }),
        el('div', { class: 'by', text: r.author }),
        el('div', { class: 'stat-row' }, [
          el('span', { class: 'stat', text: fmt(r.dose) + ' g' }),
          el('span', { class: 'stat', text: fmt(r.water) + ' g Wasser' }),
          el('span', { class: 'stat', text: '1:' + fmt(B.ratioOf(r), 1) }),
          el('span', { class: 'stat', text: r.temp + ' °C' }),
          el('span', { class: 'stat', text: B.formatTime(B.totalTime(r)) })
        ]),
        el('div', { class: 'stat-row' }, [
          el('span', { class: 'tag' + (r.custom ? ' own' : ''), text: r.level }),
          r.position ? el('span', { class: 'tag', text: r.position }) : null
        ])
      ]));
    });
    grid.appendChild(el('button', { class: 'recipe-card add-card', type: 'button', onclick: function () { openEditor(null); } }, [
      el('span', { class: 'add-plus', text: '+' }), el('h3', { text: 'Eigenes Rezept' }),
      el('div', { class: 'by', text: 'Mit eigenen Schritten – der Timer führt dich genauso durch.' })
    ]));
  }

  function param(k, v, extra, id) {
    return el('div', { class: 'param' }, [el('div', { class: 'k', text: k }), el('div', { class: 'v', id: id || null, text: v }), extra || null]);
  }

  // Updates only the amounts so the slider keeps working while dragged.
  function refreshAmounts(base) {
    current = B.scaleRecipe(base, state.brew.water || base.water);
    $('#p-dose').textContent = fmt(current.dose) + ' g';
    $('#p-water').textContent = fmt(current.water) + ' g';
    current.steps.forEach(function (st, i) { var n = $('#step-d-' + i); if (n) n.textContent = st.detail; });
  }

  function renderDetail(scroll) {
    var box = $('#recipe-detail');
    var base = state.brew.recipe && findRecipe(state.brew.recipe);
    if (!base || base.method !== state.brew.method) { box.hidden = true; current = null; return; }
    var water = state.brew.water || base.water;
    current = B.scaleRecipe(base, water);
    box.hidden = false;
    box.innerHTML = '';

    var level = B.grindLevel(base.grind);
    var bar = el('div', { class: 'grind-bar', 'aria-hidden': 'true' });
    B.GRIND_SCALE.forEach(function (_, i) { bar.appendChild(el('i', { class: i <= level ? 'on' : '' })); });

    var minW = Math.max(30, Math.round(base.water * 0.5 / 10) * 10);
    var maxW = Math.round(base.water * 2.5 / 10) * 10;
    var wStep = base.water >= 500 ? 10 : 5;
    var waterDial = window.TickDial({
      label: 'Wassermenge', unit: 'g', value: water, min: minW, max: maxW, step: wStep,
      majorEvery: wStep * 10, mediumEvery: wStep * 5, compact: true,
      describe: function (v) { return fmt(B.scaleRecipe(base, v).dose) + ' g Kaffee'; },
      onChange: function (v) {
        state.brew.water = v;
        App.save();
        refreshAmounts(base);
      }
    });

    var left = el('div', { class: 'instrument' }, [
      el('h2', { text: base.name }),
      el('p', { class: 'by', text: base.author + (base.position ? ' · ' + base.position : '') }),
      el('div', { class: 'param-grid' }, [
        param('Kaffee', fmt(current.dose) + ' g', null, 'p-dose'),
        param('Wasser', fmt(current.water) + ' g', null, 'p-water'),
        param('Verhältnis', '1:' + fmt(B.ratioOf(current), 1)),
        param('Temperatur', base.temp + ' °C'),
        param('Mahlgrad', base.grind, bar),
        param('Dauer', B.formatTime(B.totalTime(base)))
      ]),
      el('div', { class: 'scaler' }, [waterDial.el]),
      el('p', { class: 'recipe-notes', text: base.notes }),
      el('button', { class: 'btn accent', type: 'button', style: 'width:100%', onclick: openBrewMode }, [U.icon('play'), 'Geführt brühen']),
      el('div', { class: 'recipe-actions' }, base.custom ? [
        el('button', { class: 'btn small ghost on-dark', type: 'button', onclick: function () { openEditor(base); } }, ['Bearbeiten']),
        el('button', { class: 'btn small ghost on-dark', type: 'button', onclick: function () { shareRecipe(base); } }, [U.icon('share'), 'Teilen']),
        el('button', { class: 'btn small ghost on-dark', type: 'button', onclick: function (ev) { deleteRecipe(base.id, ev.currentTarget); } }, ['Löschen'])
      ] : [
        el('button', { class: 'btn small ghost on-dark', type: 'button', onclick: function () { openEditor(base, true); } }, ['Als eigenes Rezept anpassen'])
      ]),
      base.source ? el('a', { class: 'source-link', href: base.source.url, target: '_blank', rel: 'noopener' }, ['Quelle: ' + base.source.label, U.icon('external')]) : null
    ]);

    var tl = el('ol', { class: 'timeline' });
    current.steps.forEach(function (s, i) {
      tl.appendChild(el('li', { style: 'animation-delay:' + (i * 40) + 'ms' }, [
        el('span', { class: 't', text: B.formatTime(s.at) }),
        el('div', {}, [el('strong', { text: s.title }), el('p', { id: 'step-d-' + i, text: s.detail })])
      ]));
    });
    var right = el('div', { class: 'panel' }, [el('h2', { text: 'Schritt für Schritt', style: 'margin-bottom:10px' }), tl]);

    box.appendChild(left);
    box.appendChild(right);
    if (scroll) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- own recipes: editor, share, import ----------
  var editing = null; // id of the custom recipe being edited, or null for a new one

  /** recipe: null (blank), a built-in (fork=true) or a custom recipe to edit. */
  function openEditor(recipe, fork) {
    var box = $('#recipe-editor');
    editing = recipe && recipe.custom && !fork ? recipe.id : null;
    var src = recipe || { name: '', method: state.brew.method, dose: 15, water: 250, temp: 94, grind: 'mittel', notes: '',
      steps: [{ at: 0, title: 'Bloom', detail: '[[40]] Wasser aufgießen' }, { at: 45, title: 'Aufgießen', detail: 'Auf [[250]] gesamt aufgießen' }, { at: 180, title: 'Fertig', detail: '' }] };
    var f = {};
    function input(key, attrs) {
      f[key] = el('input', Object.assign({ id: 're-' + key, value: src[key] == null ? '' : src[key] }, attrs || {}));
      return f[key];
    }
    function selectOf(key, options) {
      f[key] = el('select', { id: 're-' + key }, options.map(function (o) { return el('option', { value: o[0] }, [o[1]]); }));
      f[key].value = src[key];
      return f[key];
    }
    box.innerHTML = '';
    box.appendChild(el('div', { class: 'flow-head' }, [
      el('div', {}, [el('p', { class: 'eyebrow', text: editing ? 'Bearbeiten' : fork ? 'Vorlage: ' + recipe.name : 'Neu' }), el('h2', { text: 'Eigenes Rezept' })]),
      el('button', { class: 'icon-btn light', type: 'button', 'aria-label': 'Schließen', onclick: closeEditor }, [U.icon('close')])
    ]));
    box.appendChild(el('div', { class: 'form-grid' }, [
      el('label', { class: 'field span2', for: 're-name' }, [el('span', { class: 'label', text: 'Name' }), input('name', { maxlength: 60, placeholder: 'z. B. Mein Sonntags-V60', value: fork ? recipe.name + ' (meine Version)' : src.name })]),
      el('label', { class: 'field span2', for: 're-method' }, [el('span', { class: 'label', text: 'Methode' }), selectOf('method', B.METHODS.map(function (m) { return [m.id, m.name]; }))]),
      el('label', { class: 'field', for: 're-dose' }, [el('span', { class: 'label', text: 'Kaffee (g)' }), input('dose', { type: 'number', step: '0.1', min: 1 })]),
      el('label', { class: 'field', for: 're-water' }, [el('span', { class: 'label', text: 'Wasser (g)' }), input('water', { type: 'number', step: '1', min: 1 })]),
      el('label', { class: 'field', for: 're-temp' }, [el('span', { class: 'label', text: 'Temperatur (°C)' }), input('temp', { type: 'number', step: '1' })]),
      el('label', { class: 'field', for: 're-grind' }, [el('span', { class: 'label', text: 'Mahlgrad' }), selectOf('grind', B.GRIND_SCALE.map(function (g) { return [g, g]; }))]),
      el('label', { class: 'field span4', for: 're-notes' }, [el('span', { class: 'label', text: 'Notizen' }), input('notes', { maxlength: 400, placeholder: 'Wofür ist das Rezept gut? Welche Bohne?' })])
    ]));
    var list = el('ol', { class: 'step-editor' });
    function addRow(st) {
      var t = el('input', { class: 'se-time', value: st ? B.formatTime(st.at) : '', placeholder: '0:30', 'aria-label': 'Zeit (m:ss)', inputmode: 'numeric' });
      var title = el('input', { class: 'se-title', value: st ? st.title : '', placeholder: 'z. B. Aufgießen', maxlength: 60, 'aria-label': 'Schritt' });
      var detail = el('input', { class: 'se-detail', value: st ? B.toEditable(st.detail) : '', placeholder: 'z. B. Auf 250 g gesamt aufgießen', maxlength: 300, 'aria-label': 'Beschreibung' });
      var li = el('li', {}, [t, title, detail, el('button', { class: 'icon-btn light small', type: 'button', 'aria-label': 'Schritt entfernen', onclick: function () { li.remove(); } }, [U.icon('close')])]);
      list.appendChild(li);
    }
    src.steps.forEach(addRow);
    box.appendChild(el('div', { class: 'field' }, [
      el('span', { class: 'label', text: 'Schritte · Zeit ab Start, Mengen in g werden beim Skalieren mitgerechnet' }),
      list,
      el('button', { class: 'btn small ghost', type: 'button', style: 'align-self:flex-start', onclick: function () { addRow(null); } }, ['+ Schritt'])
    ]));
    var err = el('p', { class: 'error', hidden: true });
    box.appendChild(err);
    box.appendChild(el('div', { class: 'row-actions' }, [
      el('button', { class: 'btn accent', type: 'button', onclick: function () {
        try {
          var steps = Array.prototype.map.call(list.children, function (li) {
            var ins = li.querySelectorAll('input');
            return { at: ins[0].value || '0', title: ins[1].value, detail: B.fromEditable(ins[2].value) };
          });
          var r = B.normalizeCustom({ id: editing, name: f.name.value, method: f.method.value, dose: f.dose.value, water: f.water.value,
            temp: f.temp.value, grind: f.grind.value, notes: f.notes.value, steps: steps });
          saveCustom(r);
          closeEditor();
          U.tick('major');
          toast('Rezept gespeichert.');
        } catch (e) { err.textContent = e.message; err.hidden = false; }
      } }, ['Rezept speichern']),
      el('button', { class: 'btn ghost', type: 'button', onclick: closeEditor }, ['Abbrechen'])
    ]));
    box.hidden = false;
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function closeEditor() { $('#recipe-editor').hidden = true; editing = null; }

  function saveCustom(r) {
    var idx = -1;
    state.brew.custom.forEach(function (x, i) { if (x.id === r.id) idx = i; });
    if (idx >= 0 && editing === r.id) state.brew.custom[idx] = r;
    else {
      var base = r.id, n = 1;
      while (findRecipe(r.id)) r.id = base + '-' + (++n);
      state.brew.custom.push(r);
    }
    state.brew.method = r.method;
    state.brew.recipe = r.id;
    state.brew.water = null;
    App.save();
    renderMethods(); renderRecipes(); renderDetail(true);
  }
  function deleteRecipe(id, btn) {
    if (btn.dataset.armed !== '1') {
      btn.dataset.armed = '1';
      btn.textContent = 'Wirklich löschen?';
      setTimeout(function () { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = 'Löschen'; } }, 4000);
      return;
    }
    state.brew.custom = state.brew.custom.filter(function (r) { return r.id !== id; });
    state.brew.recipe = null;
    App.save();
    renderRecipes(); renderDetail();
    toast('Rezept gelöscht.');
  }
  function shareRecipe(r) {
    var payload = { name: r.name, method: r.method, dose: r.dose, water: r.water, temp: r.temp, grind: r.grind, notes: r.notes, steps: r.steps };
    var url = location.origin + location.pathname + '#recipe=' + U.b64encode(payload);
    var done = function () { toast('Rezept-Link kopiert.'); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { showShareFallback(url); });
    else showShareFallback(url);
  }
  function showShareFallback(url) {
    $('#recipe-import').hidden = false;
    $('#recipe-import-text').value = url;
    $('#recipe-import-text').select();
    toast('Link markiert – zum Teilen kopieren.');
  }
  function importRecipe(text) {
    text = text.trim();
    var m = text.match(/#recipe=([A-Za-z0-9_-]+)/);
    var obj = m ? U.b64decode(m[1]) : JSON.parse(text);
    obj.id = null;
    editing = null;
    saveCustom(B.normalizeCustom(obj));
    toast('„' + obj.name + '“ importiert.');
  }
  $('#recipe-new').addEventListener('click', function () { openEditor(null); });
  $('#recipe-import-btn').addEventListener('click', function () {
    $('#recipe-import').hidden = false; $('#recipe-import-error').hidden = true; $('#recipe-import-text').focus();
  });
  $('#recipe-import-cancel').addEventListener('click', function () { $('#recipe-import').hidden = true; });
  $('#recipe-import-go').addEventListener('click', function () {
    try {
      importRecipe($('#recipe-import-text').value);
      $('#recipe-import-text').value = '';
      $('#recipe-import').hidden = true;
    } catch (e) {
      $('#recipe-import-error').textContent = 'Import fehlgeschlagen: ' + (e instanceof SyntaxError ? 'Das ist kein gültiger Rezept-Link oder -Text.' : e.message);
      $('#recipe-import-error').hidden = false;
    }
  });
  // A shared recipe link opens the import card so the user confirms in the page.
  function handleRecipeHash() {
    var m = location.hash.match(/^#recipe=([A-Za-z0-9_-]+)/);
    if (!m) return;
    App.showView('brew');
    $('#recipe-import').hidden = false;
    $('#recipe-import-text').value = location.origin + location.pathname + m[0];
    try { history.replaceState(null, '', location.pathname + '#brew'); } catch (e) { /* sandboxed */ }
  }
  document.addEventListener('DOMContentLoaded', handleRecipeHash);
  window.addEventListener('hashchange', handleRecipeHash);

  // ---------- guided brew mode ----------
  var bm = { t: 0, running: false, last: 0, raf: null, step: -1, wake: null };
  var CIRC = 2 * Math.PI * 45, CIRC2 = 2 * Math.PI * 38;

  function openBrewMode() {
    if (!current) return;
    var o = $('#brew-mode');
    o.innerHTML = '';
    var ring = el('div', { class: 'ring', html:
      '<svg viewBox="0 0 100 100"><circle class="track" cx="50" cy="50" r="45"/><circle class="prog" id="bm-prog" cx="50" cy="50" r="45" stroke-dasharray="' + CIRC + '" stroke-dashoffset="' + CIRC + '"/>' +
      '<circle class="total" id="bm-total" cx="50" cy="50" r="38" stroke-dasharray="' + CIRC2 + '" stroke-dashoffset="' + CIRC2 + '"/></svg>' +
      '<div class="ring-center"><div class="clock" id="bm-clock">0:00</div><div class="sub" id="bm-sub"></div></div>' });
    var dots = el('div', { class: 'bm-dots', id: 'bm-dots' });
    current.steps.forEach(function (s, i) {
      dots.appendChild(el('button', { type: 'button', 'aria-label': 'Zu Schritt ' + (i + 1) + ': ' + s.title, onclick: function () { jump(i); } }));
    });
    o.appendChild(el('div', { class: 'bm-top' }, [
      el('div', {}, [el('h2', { id: 'bm-title', text: current.name }), el('p', { text: fmt(current.dose) + ' g Kaffee · ' + fmt(current.water) + ' g Wasser · ' + current.temp + ' °C' })]),
      el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Schließen', onclick: closeBrewMode }, [U.icon('close')])
    ]));
    o.appendChild(el('div', { class: 'bm-body' }, [
      ring,
      el('div', { class: 'bm-step', id: 'bm-step' }),
      el('div', { class: 'bm-next', id: 'bm-next' }),
      el('div', { class: 'bm-controls' }, [
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Zurücksetzen', onclick: function () { jump(0); pause(); } }, [U.icon('reset')]),
        el('button', { class: 'bm-play', type: 'button', id: 'bm-play', 'aria-label': 'Start', onclick: toggle }),
        el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Nächster Schritt', onclick: function () { jump(Math.min(bm.step + 1, current.steps.length - 1)); } }, [U.icon('arrow')])
      ]),
      dots
    ]));
    o.hidden = false;
    document.body.style.overflow = 'hidden';
    bm.t = 0; bm.step = -1; bm.running = false;
    render();
    document.addEventListener('keydown', onKey);
  }

  function onKey(ev) {
    if (ev.key === 'Escape') closeBrewMode();
    if (ev.key === ' ' && ev.target === document.body) { ev.preventDefault(); toggle(); }
  }

  function closeBrewMode() {
    pause();
    $('#brew-mode').hidden = true;
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
  }

  function toggle() { if (bm.running) pause(); else play(); }
  function play() {
    if (bm.t >= B.totalTime(current)) bm.t = 0;
    bm.running = true;
    bm.last = performance.now();
    U.beep(660);
    try {
      if (navigator.wakeLock) navigator.wakeLock.request('screen').then(function (w) { bm.wake = w; }, function () {});
    } catch (e) { /* not allowed */ }
    loop();
    render();
  }
  function pause() {
    bm.running = false;
    if (bm.raf) cancelAnimationFrame(bm.raf);
    bm.raf = null;
    if (bm.wake) { bm.wake.release().catch(function () {}); bm.wake = null; }
    if (current && !$('#brew-mode').hidden) render();
  }
  function jump(i) {
    bm.t = current.steps[i].at;
    bm.last = performance.now();
    render();
  }
  function loop() {
    if (!bm.running) return;
    var now = performance.now();
    bm.t += (now - bm.last) / 1000;
    bm.last = now;
    var total = B.totalTime(current);
    if (bm.t >= total) { bm.t = total; render(); finish(); return; }
    render();
    bm.raf = requestAnimationFrame(loop);
  }
  function finish() {
    bm.running = false;
    U.beep(990); setTimeout(function () { U.beep(1320); }, 180);
    U.vibrate([30, 80, 30]);
    if (bm.wake) { bm.wake.release().catch(function () {}); bm.wake = null; }
    render();
    showSaveBrew();
  }

  // ---------- brew log ("Meine Brühungen") ----------
  function showSaveBrew() {
    var body = $('#brew-mode .bm-body');
    if (!body || $('#bm-save')) return;
    var stars = 0;
    var row = el('div', { class: 'rate-row big', role: 'radiogroup', 'aria-label': 'Wie hat er geschmeckt?' });
    function paint() {
      Array.prototype.forEach.call(row.children, function (b, i) {
        b.classList.toggle('on', i < stars);
        b.setAttribute('aria-checked', String(i + 1 === stars));
      });
    }
    for (var i = 1; i <= 5; i++) {
      (function (n) {
        row.appendChild(el('button', { type: 'button', class: 'rate-star', role: 'radio', 'aria-label': n + ' Sterne',
          onclick: function () { stars = n; U.tick('minor'); paint(); } }, ['★']));
      })(i);
    }
    var note = el('input', { id: 'bm-note', maxlength: 200, placeholder: 'Notiz, z. B. Bohne oder was du ändern willst' });
    var box = el('div', { class: 'bm-save', id: 'bm-save' }, [
      el('strong', { text: 'Wie hat er geschmeckt?' }),
      row,
      note,
      el('div', { class: 'row-actions' }, [
        el('button', { class: 'btn accent', type: 'button', onclick: function () {
          state.brew.log.push({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: new Date().toISOString(),
            recipeId: current.id, name: current.name, method: current.method,
            dose: current.dose, water: current.water, stars: stars || null, note: note.value.trim()
          });
          App.save();
          U.tick('major');
          toast('Im Brüh-Tagebuch gespeichert.');
          closeBrewMode();
          renderLog();
        } }, ['Im Tagebuch speichern']),
        el('button', { class: 'btn ghost on-dark', type: 'button', onclick: closeBrewMode }, ['Nicht speichern'])
      ])
    ]);
    body.appendChild(box);
  }

  function renderLog() {
    var box = $('#brew-log');
    var list = state.brew.log.slice().reverse();
    box.hidden = !list.length;
    var ol = $('#brew-log-list');
    ol.innerHTML = '';
    list.slice(0, 30).forEach(function (b) {
      var m = B.methodById(b.method);
      ol.appendChild(el('li', { class: 'log-item' }, [
        el('span', { class: 'log-ico' }, [U.icon(m ? m.icon : 'brew')]),
        el('div', { class: 'log-main' }, [
          el('strong', { text: b.name }),
          el('span', { class: 'muted', text: new Date(b.at).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }) +
            ' · ' + fmt(b.dose) + ' g → ' + fmt(b.water) + ' g' }),
          b.note ? el('span', { class: 'log-note', text: b.note }) : null
        ]),
        el('span', { class: 'log-stars', 'aria-label': b.stars ? b.stars + ' von 5 Sternen' : 'nicht bewertet', text: b.stars ? '★★★★★'.slice(0, b.stars) : '' }),
        el('button', { class: 'icon-btn light small', type: 'button', 'aria-label': 'Eintrag löschen', onclick: function (ev) {
          var btn = ev.currentTarget;
          if (btn.dataset.armed !== '1') { btn.dataset.armed = '1'; btn.classList.add('armed'); toast('Nochmal tippen zum Löschen.'); return; }
          state.brew.log = state.brew.log.filter(function (x) { return x.id !== b.id; });
          App.save();
          renderLog();
        } }, [U.icon('close')])
      ]));
    });
  }

  function render() {
    var steps = current.steps;
    var total = B.totalTime(current);
    var idx = B.stepIndexAt(current, bm.t);
    var s = steps[idx];
    var next = steps[idx + 1];
    var span = next ? next.at - s.at : 1;
    var into = next ? Math.min(1, (bm.t - s.at) / span) : 1;
    var done = bm.t >= total;

    $('#bm-prog').setAttribute('stroke-dashoffset', CIRC * (1 - into));
    $('#bm-total').setAttribute('stroke-dashoffset', CIRC2 * (1 - (total ? bm.t / total : 1)));
    $('#bm-clock').textContent = B.formatTime(Math.floor(bm.t));
    $('#bm-sub').textContent = done ? 'Fertig' : next ? 'noch ' + B.formatTime(Math.max(0, Math.ceil(next.at - bm.t))) + ' in diesem Schritt' : '';

    if (idx !== bm.step) {
      if (bm.step !== -1 && bm.running) { U.beep(880); U.vibrate(25); }
      bm.step = idx;
      var box = $('#bm-step');
      box.className = 'bm-step';
      void box.offsetWidth;
      box.className = 'bm-step enter';
      box.innerHTML = '';
      box.appendChild(el('div', { class: 'kicker', text: 'Schritt ' + (idx + 1) + ' von ' + steps.length }));
      box.appendChild(el('h3', { text: s.title }));
      box.appendChild(el('p', { text: s.detail }));
      $('#bm-next').innerHTML = '';
      if (next) $('#bm-next').appendChild(el('span', {}, ['Als Nächstes bei ' + B.formatTime(next.at) + ': ', el('b', { text: next.title })]));
    }
    if (done && !bm.running) {
      $('#bm-next').textContent = 'Fertig – guten Genuss!';
    }
    Array.prototype.forEach.call($('#bm-dots').children, function (d, i) {
      d.className = i < idx ? 'done' : i === idx ? 'now' : '';
    });
    var play = $('#bm-play');
    play.innerHTML = '';
    play.appendChild(U.icon(bm.running ? 'pause' : 'play'));
    play.setAttribute('aria-label', bm.running ? 'Pause' : 'Start');
  }

  App.onView('brew', function () { renderMethods(); renderRecipes(); renderDetail(); renderLog(); });
})();
