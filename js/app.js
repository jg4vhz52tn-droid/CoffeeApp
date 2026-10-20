/* Espresso Kompass – UI layer. All dial-in logic lives in engine.js. */
(function () {
  'use strict';

  var E = window.DialEngine;
  var STORE_KEY = 'espresso-kompass-v1';
  var SVG_NS = 'http://www.w3.org/2000/svg';

  var EXAMPLE_PROFILES = [
    { id: 'beispiel-klassisch', name: 'Beispiel: Klassischer Espresso', roaster: 'Vorlage', roast: 'mittel',
      notes: 'Schokolade, Nuss, runde Süße.', recipe: { dose: 18, yield: 36, timeMin: 25, timeMax: 30, temp: 93 } },
    { id: 'beispiel-hell', name: 'Beispiel: Helle Röstung', roaster: 'Vorlage', roast: 'hell',
      notes: 'Fruchtig, klar, saftig. Braucht feines Mahlgut und mehr Bezug.', recipe: { dose: 18, yield: 45, timeMin: 27, timeMax: 33, temp: 94 } },
    { id: 'beispiel-dunkel', name: 'Beispiel: Italienische Röstung', roaster: 'Vorlage', roast: 'dunkel',
      notes: 'Kräftig, kakaoig, wenig Säure. Kurz und etwas kühler.', recipe: { dose: 18, yield: 32, timeMin: 22, timeMax: 27, temp: 90 } }
  ];

  // ---------- state ----------
  var state = load() || {
    profiles: EXAMPLE_PROFILES.map(function (p) { return E.parseProfile(p); }),
    shots: [],
    settings: { grindStep: 1, direction: 'lower', keep: 'dose' },
    current: { beanId: 'beispiel-klassisch', dose: 18, yield: 36, time: '', grind: '' }
  };
  var taste = { x: null, y: null, descriptors: [], manual: false };
  var lastResult = null;

  function load() {
    try { var raw = localStorage.getItem(STORE_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* private mode: keep in memory */ }
  }

  // ---------- helpers ----------
  function $(sel) { return document.querySelector(sel); }
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function svg(tag, attrs) {
    var n = document.createElementNS(SVG_NS, tag);
    for (var k in attrs || {}) n.setAttribute(k, attrs[k]);
    return n;
  }
  function fmt(n, digits) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '–';
    return Number(n).toLocaleString('de-DE', { maximumFractionDigits: digits == null ? 1 : digits });
  }
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function profileById(id) {
    for (var i = 0; i < state.profiles.length; i++) if (state.profiles[i].id === id) return state.profiles[i];
    return null;
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ---------- tabs ----------
  document.querySelectorAll('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () { showTab(b.dataset.tab); });
  });
  function showTab(name) {
    document.querySelectorAll('.tabs button').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.dataset.tab === name));
    });
    document.querySelectorAll('.tab-panel').forEach(function (p) { p.hidden = p.id !== 'tab-' + name; });
    if (name === 'beans') renderBeans();
    if (name === 'history') renderHistory();
    if (name === 'dial') renderBeanSelect();
  }

  // ---------- compass map ----------
  function drawMap(root, opts) {
    while (root.firstChild) root.removeChild(root.firstChild);
    root.appendChild(svg('rect', { x: -1.2, y: -1.2, width: 2.4, height: 2.4, rx: 0.12, class: 'map-bg' }));
    root.appendChild(svg('circle', { cx: 0, cy: 0, r: E.GREEN_RADIUS, class: 'map-green' }));
    root.appendChild(svg('line', { x1: -1.05, y1: 0, x2: 1.05, y2: 0, class: 'map-axis' }));
    root.appendChild(svg('line', { x1: 0, y1: -1.05, x2: 0, y2: 1.05, class: 'map-axis' }));
    root.appendChild(svg('circle', { cx: 0, cy: 0, r: E.SWEET_SPOT_RADIUS, class: 'map-sweet' }));

    if (opts.words) {
      E.DESCRIPTORS.forEach(function (d) {
        var t = svg('text', { x: d.x, y: -d.y + 0.02, class: 'map-word' });
        t.textContent = d.de;
        root.appendChild(t);
      });
    }

    [['Stark', 0, -1.1], ['Schwach', 0, 1.15], ['Sauer', -1.08, 0.03], ['Bitter', 1.08, 0.03]].forEach(function (l) {
      var t = svg('text', { x: l[1], y: l[2], class: 'map-label' });
      if (l[0] === 'Sauer' || l[0] === 'Bitter') t.setAttribute('transform', 'rotate(' + (l[0] === 'Sauer' ? -90 : 90) + ' ' + l[1] + ' ' + l[2] + ')');
      t.textContent = l[0];
      root.appendChild(t);
    });

    var trail = opts.trail || [];
    if (trail.length > 1) {
      root.appendChild(svg('polyline', {
        points: trail.map(function (p) { return p.x + ',' + (-p.y); }).join(' '),
        class: 'map-trail'
      }));
    }
    trail.forEach(function (p, i) {
      if (opts.pos && i === trail.length - 1 && !opts.trailIncludesPos) return;
      root.appendChild(svg('circle', { cx: p.x, cy: -p.y, r: 0.028, class: 'map-dot' }));
    });

    if (opts.pos) {
      var p = opts.pos;
      if (opts.arrow && E.zoneOf(p) !== 'sweetspot') {
        var len = Math.sqrt(p.x * p.x + p.y * p.y);
        var reach = Math.min(len - 0.08, 0.45);
        if (reach > 0.05) {
          var ux = -p.x / len, uy = -p.y / len;
          var ex = p.x + ux * reach, ey = p.y + uy * reach;
          root.appendChild(svg('line', { x1: p.x, y1: -p.y, x2: ex, y2: -ey, class: 'map-arrow' }));
          var hx = ex + ux * 0.06, hy = ey + uy * 0.06;
          var px = -uy * 0.045, py = ux * 0.045;
          root.appendChild(svg('polygon', {
            points: hx + ',' + (-hy) + ' ' + (ex + px) + ',' + (-(ey + py)) + ' ' + (ex - px) + ',' + (-(ey - py)),
            class: 'map-arrowhead'
          }));
        }
      }
      root.appendChild(svg('circle', { cx: p.x, cy: -p.y, r: 0.055, class: 'map-marker' }));
    }
  }

  var mapEl = $('#map');
  mapEl.addEventListener('pointerdown', function (ev) {
    var pt = mapEl.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    var loc = pt.matrixTransform(mapEl.getScreenCTM().inverse());
    taste.x = Math.max(-1, Math.min(1, loc.x));
    taste.y = Math.max(-1, Math.min(1, -loc.y));
    taste.manual = true;
    update();
  });

  // ---------- chips ----------
  var GROUPS = [
    { key: 'under', title: 'Sauer / unterextrahiert' },
    { key: 'over', title: 'Bitter / überextrahiert' },
    { key: 'weak', title: 'Zu schwach' },
    { key: 'strong', title: 'Zu stark' },
    { key: 'good', title: 'Im grünen Bereich' }
  ];
  function groupOf(d) {
    if (d.inner) return 'good';
    if (Math.abs(d.x) >= Math.abs(d.y)) return d.x < 0 ? 'under' : 'over';
    return d.y < 0 ? 'weak' : 'strong';
  }
  function renderChips() {
    var box = $('#chips');
    box.innerHTML = '';
    GROUPS.forEach(function (g) {
      var wrap = el('div', { class: 'wrap' });
      E.DESCRIPTORS.filter(function (d) { return groupOf(d) === g.key; }).forEach(function (d) {
        wrap.appendChild(el('button', {
          class: 'chip', type: 'button', title: d.en,
          'aria-pressed': String(taste.descriptors.indexOf(d.id) >= 0),
          onclick: function () { toggleDescriptor(d.id); }
        }, [d.de]));
      });
      box.appendChild(el('div', { class: 'chip-group ' + g.key }, [el('h3', { text: g.title }), wrap]));
    });
    if (taste.descriptors.length || taste.x !== null) {
      box.appendChild(el('button', { class: 'link-btn', type: 'button', onclick: resetTaste }, ['Auswahl zurücksetzen']));
    }
  }
  function toggleDescriptor(id) {
    var i = taste.descriptors.indexOf(id);
    if (i >= 0) taste.descriptors.splice(i, 1); else taste.descriptors.push(id);
    var pos = E.positionFromDescriptors(taste.descriptors);
    taste.manual = false;
    taste.x = pos ? pos.x : null;
    taste.y = pos ? pos.y : null;
    update();
  }
  function resetTaste() {
    taste = { x: null, y: null, descriptors: [], manual: false };
    update();
  }

  // ---------- recipe inputs ----------
  var inputs = { dose: $('#in-dose'), yield: $('#in-yield'), time: $('#in-time'), grind: $('#in-grind') };
  function fillInputs() {
    Object.keys(inputs).forEach(function (k) { inputs[k].value = state.current[k] == null ? '' : state.current[k]; });
    $('#set-step').value = state.settings.grindStep;
    $('#set-direction').value = state.settings.direction;
    document.querySelectorAll('input[name="keep"]').forEach(function (r) { r.checked = r.value === state.settings.keep; });
  }
  Object.keys(inputs).forEach(function (k) {
    inputs[k].addEventListener('input', function () {
      state.current[k] = inputs[k].value === '' ? '' : Number(inputs[k].value);
      save(); update();
    });
  });
  $('#set-step').addEventListener('input', function () { state.settings.grindStep = Number(this.value) || 1; save(); update(); });
  $('#set-direction').addEventListener('change', function () { state.settings.direction = this.value; save(); update(); });
  document.querySelectorAll('input[name="keep"]').forEach(function (r) {
    r.addEventListener('change', function () { state.settings.keep = r.value; save(); update(); });
  });

  function recipe() {
    return {
      dose: state.current.dose, yield: state.current.yield, time: state.current.time, grind: state.current.grind,
      grindStep: state.settings.grindStep, finerIsLower: state.settings.direction === 'lower', keep: state.settings.keep
    };
  }

  // ---------- bean selection ----------
  function renderBeanSelect() {
    var sel = $('#bean-select');
    sel.innerHTML = '';
    sel.appendChild(el('option', { value: '' }, ['Ohne Profil (Standard 1:2, 25–32 s)']));
    state.profiles.forEach(function (p) {
      sel.appendChild(el('option', { value: p.id }, [p.name + (p.roaster && p.roaster !== 'Vorlage' ? ' – ' + p.roaster : '')]));
    });
    sel.value = profileById(state.current.beanId) ? state.current.beanId : '';
    renderTarget();
  }
  $('#bean-select').addEventListener('change', function () {
    state.current.beanId = this.value;
    var p = profileById(this.value);
    var last = lastShotFor(this.value);
    if (last && last.next) {
      state.current.dose = last.next.dose; state.current.yield = last.next.yield;
      state.current.grind = last.next.grind == null ? '' : last.next.grind;
    } else if (p) {
      state.current.dose = p.dose; state.current.yield = p.yield;
      if (p.grind != null) state.current.grind = p.grind;
    }
    state.current.time = '';
    save(); fillInputs(); resetTaste(); renderTarget();
  });
  function renderTarget() {
    var p = profileById(state.current.beanId);
    var box = $('#bean-target');
    box.hidden = !p;
    if (!p) return;
    box.innerHTML = '';
    [['Ziel', fmt(p.dose) + ' g → ' + fmt(p.yield) + ' g'], ['Zeit', p.timeMin + '–' + p.timeMax + ' s'],
     p.temp ? ['Temp.', fmt(p.temp) + ' °C'] : null, ['Röstung', p.roast], p.grind != null ? ['Dein Mahlgrad', fmt(p.grind, 2)] : null]
      .forEach(function (kv) { if (kv) box.appendChild(el('span', {}, [kv[0] + ' ', el('b', { text: kv[1] })])); });
    if (p.notes) box.appendChild(el('span', {}, [p.notes]));
  }
  function lastShotFor(beanId) {
    for (var i = state.shots.length - 1; i >= 0; i--) if ((state.shots[i].beanId || '') === (beanId || '')) return state.shots[i];
    return null;
  }

  // ---------- main update ----------
  function update() {
    var c = state.current;
    var ratio = c.dose && c.yield ? c.yield / c.dose : null;
    $('#ratio-out').textContent = ratio ? '1:' + fmt(ratio, 2) : '–';

    var profile = profileById(c.beanId);
    var issues = E.checkAgainstProfile(c, profile);
    var pre = $('#precheck');
    pre.hidden = !issues.length;
    pre.innerHTML = '';
    issues.forEach(function (t) { pre.appendChild(el('li', { text: t })); });

    renderChips();

    var hasTaste = taste.x !== null;
    var trail = state.shots.filter(function (s) { return (s.beanId || '') === (c.beanId || ''); }).slice(-6)
      .map(function (s) { return { x: s.x, y: s.y }; });
    if (hasTaste) trail.push({ x: taste.x, y: taste.y });
    drawMap(mapEl, { pos: hasTaste ? { x: taste.x, y: taste.y } : null, trail: trail, arrow: true, words: true });

    renderResult(hasTaste ? E.recommend(recipe(), { x: taste.x, y: taste.y, descriptors: taste.descriptors }, profile) : null);
  }

  function renderResult(r) {
    lastResult = r;
    var body = $('#result-body');
    body.innerHTML = '';
    if (!r) {
      body.appendChild(el('p', { class: 'hint', text: 'Sobald du den Geschmack angibst, bekommst du hier deine Empfehlung.' }));
      return;
    }
    var zoneText = { sweetspot: 'Im Zentrum – perfekt', green: 'Im grünen Bereich – Feinschliff', off: 'Außerhalb – korrigieren' }[r.zone];
    body.appendChild(el('span', { class: 'zone-badge zone-' + r.zone, text: zoneText }));

    var ul = el('ul', { class: 'actions' });
    r.actions.forEach(function (a) {
      ul.appendChild(el('li', { class: a.kind }, [el('strong', { text: a.title }), el('p', { text: a.detail })]));
    });
    if (!r.actions.length) {
      ul.appendChild(el('li', {}, [el('strong', { text: 'Fast da' }), el('p', { text: 'Nur minimale Abweichung – wiederhole den Shot einmal unverändert, um sicherzugehen.' })]));
    }
    body.appendChild(ul);

    var c = state.current, n = r.next;
    var rows = [
      ['Mahlgrad', c.grind === '' ? '–' : fmt(c.grind, 2),
        n.grind == null ? (n.grindSteps ? (n.grindSteps > 0 ? Math.abs(n.grindSteps) + ' feiner' : Math.abs(n.grindSteps) + ' gröber') : '=') : fmt(n.grind, 2),
        n.grindSteps !== 0],
      ['Dosis', fmt(c.dose) + ' g', fmt(n.dose) + ' g', Number(c.dose) !== n.dose],
      ['Bezug', fmt(c.yield) + ' g', fmt(n.yield) + ' g', Number(c.yield) !== n.yield],
      ['Verhältnis', c.dose && c.yield ? '1:' + fmt(c.yield / c.dose, 2) : '–', '1:' + fmt(n.ratio, 2), c.dose && Math.abs(c.yield / c.dose - n.ratio) > 0.02],
      ['Zeit', c.time ? fmt(c.time, 0) + ' s' : '–', n.targetTime ? '≈ ' + n.targetTime + ' s' : n.timeMin + '–' + n.timeMax + ' s', false]
    ];
    var table = el('table', { class: 'next-recipe' }, [
      el('thead', {}, [el('tr', {}, [el('th', { text: '' }), el('th', { text: 'Jetzt' }), el('th', { text: 'Nächster Shot' })])]),
      el('tbody', {}, rows.map(function (row) {
        return el('tr', {}, [el('th', { text: row[0] }), el('td', { text: row[1] }), el('td', { class: row[3] ? 'changed' : '', text: row[2] })]);
      }))
    ]);
    body.appendChild(table);

    if (r.notes.length) {
      var notes = el('ul', { class: 'notes' });
      r.notes.forEach(function (t) { notes.appendChild(el('li', { text: t })); });
      body.appendChild(notes);
    }

    var actions = el('div', { class: 'row-actions' });
    if (r.zone === 'sweetspot') {
      actions.appendChild(el('button', { class: 'btn', type: 'button', onclick: saveAsTarget }, ['Als Rezept für diese Bohne speichern']));
    } else {
      actions.appendChild(el('button', { class: 'btn', type: 'button', onclick: logAndApply }, ['Shot speichern & Rezept übernehmen']));
    }
    actions.appendChild(el('button', { class: 'btn ghost', type: 'button', onclick: logOnly }, ['Nur speichern']));
    body.appendChild(actions);
  }

  function logShot() {
    var c = state.current, r = lastResult;
    state.shots.push({
      id: uid(), at: new Date().toISOString(), beanId: c.beanId || '',
      dose: c.dose, yield: c.yield, time: c.time, grind: c.grind,
      x: r.position.x, y: r.position.y, zone: r.zone, descriptors: taste.descriptors.slice(),
      next: r.next
    });
  }
  function logOnly() { logShot(); save(); toast('Shot gespeichert.'); update(); }
  function logAndApply() {
    logShot();
    var n = lastResult.next;
    state.current.dose = n.dose; state.current.yield = n.yield; state.current.time = '';
    if (n.grind != null) state.current.grind = n.grind;
    save(); fillInputs(); resetTaste();
    toast('Gespeichert. Zieh jetzt den nächsten Shot mit dem neuen Rezept.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function saveAsTarget() {
    logShot();
    var c = state.current;
    var p = profileById(c.beanId);
    if (!p) {
      p = E.parseProfile({ name: 'Meine Bohne ' + new Date().toLocaleDateString('de-DE'), recipe: {} });
      p.id = 'eigen-' + uid();
      state.profiles.push(p);
      state.current.beanId = p.id;
    }
    p.dose = Number(c.dose); p.yield = Number(c.yield);
    if (c.time) { p.timeMin = Math.max(15, Number(c.time) - 2); p.timeMax = Number(c.time) + 2; }
    if (c.grind !== '') p.grind = Number(c.grind);
    save(); renderBeanSelect(); resetTaste();
    toast('Rezept gespeichert – „' + p.name + '“.');
  }

  // ---------- beans tab ----------
  var editingId = null;
  function renderBeans() {
    var list = $('#bean-list');
    list.innerHTML = '';
    if (!state.profiles.length) list.appendChild(el('p', { class: 'hint', text: 'Noch keine Profile.' }));
    state.profiles.forEach(function (p) {
      var shots = state.shots.filter(function (s) { return s.beanId === p.id; }).length;
      list.appendChild(el('article', { class: 'bean-item' }, [
        el('header', {}, [el('strong', { text: p.name }), el('span', { class: 'tag', text: p.roast })]),
        el('div', { class: 'meta', text: [p.roaster, fmt(p.dose) + ' g → ' + fmt(p.yield) + ' g', p.timeMin + '–' + p.timeMax + ' s',
          p.temp ? fmt(p.temp) + ' °C' : '', shots ? shots + ' Shots' : ''].filter(Boolean).join(' · ') }),
        p.notes ? el('div', { class: 'meta', text: p.notes }) : null,
        el('div', { class: 'row-actions' }, [
          el('button', { class: 'btn small', type: 'button', onclick: function () { useBean(p.id); } }, ['Einstellen']),
          el('button', { class: 'btn small ghost', type: 'button', onclick: function () { editBean(p.id); } }, ['Bearbeiten']),
          el('button', { class: 'btn small ghost', type: 'button', onclick: function () { shareBean(p); } }, ['Link teilen']),
          el('button', { class: 'btn small ghost', type: 'button', onclick: function () { deleteBean(p.id); } }, ['Löschen'])
        ])
      ]));
    });
  }
  function useBean(id) {
    showTab('dial');
    var sel = $('#bean-select');
    sel.value = id;
    sel.dispatchEvent(new Event('change'));
  }
  function editBean(id) {
    editingId = id;
    var p = id ? profileById(id) : { name: '', roaster: '', dose: 18, yield: 36, timeMin: 25, timeMax: 30, temp: 93, roast: 'mittel', notes: '' };
    var f = $('#bean-form');
    ['name', 'roaster', 'dose', 'yield', 'timeMin', 'timeMax', 'temp', 'roast', 'notes'].forEach(function (k) {
      f.elements[k].value = p[k] == null ? '' : p[k];
    });
    $('#bean-form-title').textContent = id ? 'Profil bearbeiten' : 'Neues Profil';
    $('#bean-form-card').hidden = false;
    $('#bean-import-card').hidden = true;
    f.elements.name.focus();
  }
  function deleteBean(id) {
    var p = profileById(id);
    if (!confirm('Profil „' + p.name + '“ und seinen Verlauf löschen?')) return;
    state.profiles = state.profiles.filter(function (x) { return x.id !== id; });
    state.shots = state.shots.filter(function (s) { return s.beanId !== id; });
    if (state.current.beanId === id) state.current.beanId = '';
    save(); renderBeans();
  }
  $('#bean-new').addEventListener('click', function () { editBean(null); });
  $('#bean-cancel').addEventListener('click', function () { $('#bean-form-card').hidden = true; });
  $('#bean-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = ev.target, data = {};
    ['name', 'roaster', 'roast', 'notes'].forEach(function (k) { data[k] = f.elements[k].value; });
    data.recipe = {};
    ['dose', 'yield', 'timeMin', 'timeMax', 'temp'].forEach(function (k) { data.recipe[k] = f.elements[k].value; });
    try {
      var p = E.parseProfile(data);
      var old = editingId ? profileById(editingId) : null;
      if (old) { p.id = old.id; p.grind = old.grind; state.profiles[state.profiles.indexOf(old)] = p; }
      else { p.id = uniqueId(p.id); state.profiles.push(p); }
      save(); $('#bean-form-card').hidden = true; renderBeans(); toast('Profil gespeichert.');
    } catch (e) { toast(e.message); }
  });
  function uniqueId(id) {
    var base = id || 'bohne', n = 1;
    while (profileById(id)) id = base + '-' + (++n);
    return id;
  }

  // ---------- share & import ----------
  function encodeProfile(p) {
    var payload = { name: p.name, roaster: p.roaster, roast: p.roast, notes: p.notes,
      recipe: { dose: p.dose, yield: p.yield, timeMin: p.timeMin, timeMax: p.timeMax, temp: p.temp } };
    var bytes = new TextEncoder().encode(JSON.stringify(payload));
    var bin = '';
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeProfile(str) {
    var b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return E.parseProfile(new TextDecoder().decode(bytes));
  }
  function shareBean(p) {
    var url = location.origin + location.pathname + '#bean=' + encodeProfile(p);
    if (navigator.share) {
      navigator.share({ title: p.name, text: 'Espresso-Rezept für ' + p.name, url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () { toast('Link kopiert.'); }, function () { prompt('Link kopieren:', url); });
    } else {
      prompt('Link kopieren:', url);
    }
  }
  function importProfile(p) {
    p.id = uniqueId(p.id);
    state.profiles.push(p);
    save();
    toast('„' + p.name + '“ importiert.');
    return p;
  }
  function parseImportText(text) {
    text = text.trim();
    var m = text.match(/#bean=([A-Za-z0-9_-]+)/);
    if (m) return decodeProfile(m[1]);
    return E.parseProfile(text);
  }
  $('#bean-import-btn').addEventListener('click', function () {
    $('#bean-import-card').hidden = false; $('#bean-form-card').hidden = true; $('#import-error').hidden = true;
  });
  $('#import-cancel').addEventListener('click', function () { $('#bean-import-card').hidden = true; });
  $('#import-go').addEventListener('click', function () {
    try {
      importProfile(parseImportText($('#import-text').value));
      $('#import-text').value = ''; $('#bean-import-card').hidden = true; renderBeans();
    } catch (e) {
      $('#import-error').textContent = 'Import fehlgeschlagen: ' + e.message; $('#import-error').hidden = false;
    }
  });
  $('#import-file').addEventListener('change', function () {
    var file = this.files[0];
    if (!file) return;
    file.text().then(function (t) { $('#import-text').value = t; });
  });
  function handleHash() {
    var m = location.hash.match(/^#bean=([A-Za-z0-9_-]+)/);
    if (!m) return;
    history.replaceState(null, '', location.pathname + location.search);
    try {
      var p = decodeProfile(m[1]);
      if (confirm('Bohnen-Profil „' + p.name + '“ (' + p.dose + ' g → ' + p.yield + ' g, ' + p.timeMin + '–' + p.timeMax + ' s) importieren?')) {
        var added = importProfile(p);
        useBean(added.id);
      }
    } catch (e) { toast('Profil-Link ungültig: ' + e.message); }
  }

  // ---------- history tab ----------
  function renderHistory() {
    var sel = $('#history-bean');
    var prev = sel.value || state.current.beanId || '';
    sel.innerHTML = '';
    sel.appendChild(el('option', { value: '' }, ['Ohne Profil']));
    state.profiles.forEach(function (p) { sel.appendChild(el('option', { value: p.id }, [p.name])); });
    sel.value = prev;
    if (sel.value !== prev) sel.value = '';
    var shots = state.shots.filter(function (s) { return (s.beanId || '') === sel.value; });
    drawMap($('#history-map'), {
      trail: shots.map(function (s) { return { x: s.x, y: s.y }; }),
      pos: shots.length ? { x: shots[shots.length - 1].x, y: shots[shots.length - 1].y } : null,
      trailIncludesPos: false
    });
    var list = $('#history-list');
    list.innerHTML = '';
    if (!shots.length) { list.appendChild(el('p', { class: 'hint', text: 'Noch keine Shots für diese Bohne.' })); return; }
    shots.forEach(function (s) {
      var words = s.descriptors.map(function (id) { var d = E.findDescriptor(id); return d ? d.de : id; }).join(', ');
      list.appendChild(el('li', {}, [
        el('div', { text: fmt(s.dose) + ' g → ' + fmt(s.yield) + ' g' + (s.time ? ' in ' + s.time + ' s' : '') + (s.grind !== '' && s.grind != null ? ' · Mahlgrad ' + fmt(s.grind, 2) : '') }),
        el('div', { class: 'meta', text: new Date(s.at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) +
          ' · ' + ({ sweetspot: 'perfekt', green: 'gut', off: 'korrigieren' }[s.zone]) + (words ? ' · ' + words : '') })
      ]));
    });
  }
  $('#history-bean').addEventListener('change', renderHistory);

  // ---------- boot ----------
  fillInputs();
  renderBeanSelect();
  update();
  handleHash();
  window.addEventListener('hashchange', handleHash);
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
