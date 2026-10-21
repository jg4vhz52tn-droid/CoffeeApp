/* Espresso Kompass – app shell, espresso dial-in view and bean profiles.
   Dial-in logic lives in engine.js; brewing and café views in brew-ui.js / cafes-ui.js. */
(function () {
  'use strict';

  var E = window.DialEngine;
  var U = window.UI;
  var $ = U.$, $$ = U.$$, el = U.el, svg = U.svg, fmt = U.fmt, toast = U.toast;

  var EXAMPLE_PROFILES = [
    { id: 'beispiel-klassisch', name: 'Beispiel: Klassischer Espresso', roaster: 'Vorlage', roast: 'mittel',
      notes: 'Schokolade, Nuss, runde Süße.', recipe: { dose: 18, yield: 36, timeMin: 25, timeMax: 30, temp: 93 } },
    { id: 'beispiel-hell', name: 'Beispiel: Helle Röstung', roaster: 'Vorlage', roast: 'hell',
      notes: 'Fruchtig, klar, saftig. Braucht feines Mahlgut und mehr Bezug.', recipe: { dose: 18, yield: 45, timeMin: 27, timeMax: 33, temp: 94 } },
    { id: 'beispiel-dunkel', name: 'Beispiel: Italienische Röstung', roaster: 'Vorlage', roast: 'dunkel',
      notes: 'Kräftig, kakaoig, wenig Säure. Kurz und etwas kühler.', recipe: { dose: 18, yield: 32, timeMin: 22, timeMax: 27, temp: 90 } }
  ];

  // ---------- state ----------
  var state = U.load() || {};
  state.profiles = state.profiles || EXAMPLE_PROFILES.map(function (p) { return E.parseProfile(p); });
  state.shots = state.shots || [];
  state.settings = state.settings || { grindStep: 1, direction: 'lower', keep: 'dose' };
  state.current = state.current || { beanId: 'beispiel-klassisch', dose: 18, yield: 36, time: '', grind: 12 };
  state.brew = state.brew || { method: 'aeropress' };
  state.cafes = state.cafes || { radius: 2000, specialty: true, query: '' };

  var taste = { x: null, y: null, descriptors: [] };
  var activeGroup = 'under';
  var lastResult = null;

  /** Saves on this device and, when signed in, in the account (cloud.js). */
  function save() {
    state.meta = state.meta || {};
    state.meta.updatedAt = Date.now();
    U.save(state);
    if (window.Cloud) window.Cloud.changed();
  }

  function profileById(id) {
    for (var i = 0; i < state.profiles.length; i++) if (state.profiles[i].id === id) return state.profiles[i];
    return null;
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ---------- navigation ----------
  var VIEWS = [
    { id: 'espresso', label: 'Espresso', icon: 'espresso' },
    { id: 'brew', label: 'Brühen', icon: 'brew' },
    { id: 'taste', label: 'Verkosten', icon: 'wheel' },
    { id: 'cafes', label: 'Cafés', icon: 'cafe', later: true }, // postponed: hidden until switched on again
    { id: 'beans', label: 'Bohnen', icon: 'beans' },
    { id: 'learn', label: 'Wissen', icon: 'learn' }
  ];
  var viewListeners = {};
  var dock = $('#dock');
  VIEWS.filter(function (v) { return !v.later; }).forEach(function (v) {
    var b = el('button', { type: 'button', 'data-view': v.id, onclick: function () { showView(v.id); } }, [U.icon(v.icon), el('span', { text: v.label })]);
    dock.appendChild(b);
  });
  $('.brand').addEventListener('click', function (ev) { ev.preventDefault(); showView('espresso'); });

  function showView(id, opts) {
    if (!VIEWS.some(function (v) { return v.id === id && !v.later; })) id = 'espresso';
    $$('#dock button').forEach(function (b) {
      if (b.dataset.view === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    $$('.view').forEach(function (v) { v.hidden = v.id !== 'view-' + id; });
    state.view = id;
    U.save(state); // switching views is not a change worth syncing
    try { if (location.hash.slice(1) !== id && !/^#(bean|recipe)=/.test(location.hash)) history.replaceState(null, '', '#' + id); } catch (e) { /* sandboxed */ }
    if (!(opts && opts.keepScroll)) window.scrollTo({ top: 0 });
    (viewListeners[id] || []).forEach(function (fn) { fn(); });
  }
  function onView(id, fn) { (viewListeners[id] = viewListeners[id] || []).push(fn); }

  // ---------- compass ----------
  function groupOf(d) {
    if (d.inner) return 'good';
    if (Math.abs(d.x) >= Math.abs(d.y)) return d.x < 0 ? 'under' : 'over';
    return d.y < 0 ? 'weak' : 'strong';
  }

  /** Draws the static compass into an SVG and returns an updater for the dynamic layer. */
  function buildCompass(root, opts) {
    opts = opts || {};
    var gid = 'zoneGrad' + (opts.small ? 'S' + Math.random().toString(36).slice(2, 6) : '');
    var defs = svg('defs', {}, [
      svg('radialGradient', { id: gid }, [
        svg('stop', { offset: '0%', 'stop-color': 'var(--zone)', 'stop-opacity': '.38' }),
        svg('stop', { offset: '100%', 'stop-color': 'var(--zone)', 'stop-opacity': '.07' })
      ])
    ]);
    root.appendChild(defs);
    if (opts.small) root.appendChild(svg('rect', { x: -1.25, y: -1.25, width: 2.5, height: 2.5, fill: 'var(--inst)' }));
    [0.25, 0.5, 1].forEach(function (r) { root.appendChild(svg('circle', { cx: 0, cy: 0, r: r, class: 'c-ring' })); });
    root.appendChild(svg('line', { x1: -1.08, y1: 0, x2: 1.08, y2: 0, class: 'c-axis' }));
    root.appendChild(svg('line', { x1: 0, y1: -1.08, x2: 0, y2: 1.08, class: 'c-axis' }));
    root.appendChild(svg('circle', { cx: 0, cy: 0, r: E.GREEN_RADIUS, fill: 'url(#' + gid + ')' }));
    root.appendChild(svg('circle', { cx: 0, cy: 0, r: E.GREEN_RADIUS, class: 'c-zone-edge' }));
    root.appendChild(svg('circle', { cx: 0, cy: 0, r: E.SWEET_SPOT_RADIUS, class: 'c-sweet' }));

    var words = {};
    if (!opts.small) {
      E.DESCRIPTORS.forEach(function (d) {
        var t = svg('text', { x: d.x, y: -d.y + 0.016, class: 'c-word' });
        t.textContent = d.de;
        root.appendChild(t);
        words[d.id] = t;
      });
      [['Stark', 0, -1.15, 0], ['Schwach', 0, 1.2, 0], ['Sauer', -1.16, 0, -90], ['Bitter', 1.16, 0, 90]].forEach(function (l) {
        var t = svg('text', { x: l[1], y: l[2], class: 'c-label', transform: l[3] ? 'rotate(' + l[3] + ' ' + l[1] + ' ' + l[2] + ')' : null });
        t.textContent = l[0];
        root.appendChild(t);
      });
    }

    var dyn = svg('g');
    root.appendChild(dyn);
    var puck = svg('g', { class: 'c-puck', style: 'opacity:0' }, [
      svg('circle', { r: 0.11, class: 'c-puck-halo' }),
      svg('circle', { r: opts.small ? 0.07 : 0.05, class: 'c-puck-core' })
    ]);
    root.appendChild(puck);

    return function update(pos, trail, selected, arrow) {
      while (dyn.firstChild) dyn.removeChild(dyn.firstChild);
      trail = trail || [];
      if (trail.length > 1) {
        dyn.appendChild(svg('polyline', { points: trail.map(function (p) { return p.x + ',' + (-p.y); }).join(' '), class: 'c-trail' }));
      }
      trail.slice(0, pos ? -1 : undefined).forEach(function (p) {
        dyn.appendChild(svg('circle', { cx: p.x, cy: -p.y, r: opts.small ? 0.04 : 0.022, class: 'c-dot' }));
      });
      Object.keys(words).forEach(function (id) { words[id].classList.toggle('on', (selected || []).indexOf(id) >= 0); });

      if (!pos) { puck.style.opacity = '0'; return; }
      puck.style.opacity = '1';
      puck.style.transform = 'translate(' + pos.x + 'px,' + (-pos.y) + 'px)';
      if (arrow && E.zoneOf(pos) !== 'sweetspot') {
        var len = Math.sqrt(pos.x * pos.x + pos.y * pos.y);
        var reach = Math.min(len - 0.1, 0.42);
        if (reach > 0.06) {
          var ux = -pos.x / len, uy = -pos.y / len;
          var sx = pos.x + ux * 0.08, sy = pos.y + uy * 0.08;
          var ex = pos.x + ux * reach, ey = pos.y + uy * reach;
          dyn.appendChild(svg('line', { x1: sx, y1: -sy, x2: ex, y2: -ey, class: 'c-arrow' }));
          var hx = ex + ux * 0.06, hy = ey + uy * 0.06, px = -uy * 0.04, py = ux * 0.04;
          dyn.appendChild(svg('polygon', {
            points: hx + ',' + (-hy) + ' ' + (ex + px) + ',' + (-(ey + py)) + ' ' + (ex - px) + ',' + (-(ey - py)),
            class: 'c-arrowhead'
          }));
        }
      }
    };
  }

  var mapEl = $('#map');
  var updateCompass = buildCompass(mapEl);
  var dragging = false, lastZone = null;

  function pointToTaste(ev) {
    var pt = mapEl.createSVGPoint();
    pt.x = ev.clientX; pt.y = ev.clientY;
    var loc = pt.matrixTransform(mapEl.getScreenCTM().inverse());
    var x = Math.max(-1, Math.min(1, loc.x)), y = Math.max(-1, Math.min(1, -loc.y));
    taste.x = x; taste.y = y;
    var z = E.zoneOf({ x: x, y: y });
    if (lastZone && z !== lastZone) U.tick('medium');
    lastZone = z;
  }
  var raf = null;
  mapEl.addEventListener('pointerdown', function (ev) {
    dragging = true;
    mapEl.classList.add('dragging');
    try { mapEl.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
    pointToTaste(ev);
    update();
  });
  mapEl.addEventListener('pointermove', function (ev) {
    if (!dragging) return;
    pointToTaste(ev);
    if (!raf) raf = requestAnimationFrame(function () { raf = null; update(); });
  });
  function endDrag() { if (!dragging) return; dragging = false; mapEl.classList.remove('dragging'); update(); }
  mapEl.addEventListener('pointerup', endDrag);
  mapEl.addEventListener('pointercancel', endDrag);

  // ---------- taste chips ----------
  var GROUPS = [
    { key: 'under', title: 'Sauer' },
    { key: 'over', title: 'Bitter' },
    { key: 'weak', title: 'Zu schwach' },
    { key: 'strong', title: 'Zu stark' },
    { key: 'good', title: 'Gut' }
  ];
  function renderChips() {
    var tabs = $('#taste-tabs');
    tabs.innerHTML = '';
    GROUPS.forEach(function (g) {
      var n = taste.descriptors.filter(function (id) { return groupOf(E.findDescriptor(id)) === g.key; }).length;
      tabs.appendChild(el('button', {
        class: 'taste-tab ' + g.key, type: 'button', role: 'tab', 'aria-selected': String(activeGroup === g.key),
        onclick: function () { activeGroup = g.key; renderChips(); }
      }, [el('span', { class: 'dot' }), g.title, n ? el('span', { class: 'count', text: n }) : null]));
    });
    var box = $('#chips');
    // Chips only animate in when the group changes, not on every value update.
    var animate = box.dataset.group !== activeGroup;
    box.dataset.group = activeGroup;
    box.innerHTML = '';
    E.DESCRIPTORS.filter(function (d) { return groupOf(d) === activeGroup; }).forEach(function (d, i) {
      box.appendChild(el('button', {
        class: 'chip' + (animate ? ' enter' : ''), type: 'button', title: d.en, style: animate ? 'animation-delay:' + (i * 18) + 'ms' : null,
        'aria-pressed': String(taste.descriptors.indexOf(d.id) >= 0),
        onclick: function () { toggleDescriptor(d.id); }
      }, [d.de]));
    });
    $('#taste-reset').hidden = !(taste.descriptors.length || taste.x !== null);
  }
  function toggleDescriptor(id) {
    var i = taste.descriptors.indexOf(id);
    if (i >= 0) taste.descriptors.splice(i, 1); else taste.descriptors.push(id);
    var pos = E.positionFromDescriptors(taste.descriptors);
    taste.x = pos ? pos.x : null;
    taste.y = pos ? pos.y : null;
    U.tick('minor');
    update();
  }
  function resetTaste() {
    taste = { x: null, y: null, descriptors: [] };
    lastZone = null;
    update();
  }
  $('#taste-reset').addEventListener('click', resetTaste);

  // ---------- recipe dials: tabs on top, one iOS-timer-like ruler below ----------
  function grindScale() {
    var st = Number(state.settings.grindStep) || 1;
    return {
      min: 0, max: Number(state.settings.grindMax) || 40, step: st,
      majorEvery: st >= 1 ? st * 5 : 1, mediumEvery: st < 0.5 ? 0.5 : null
    };
  }
  function timeWindow() {
    var p = profileById(state.current.beanId);
    return p ? [p.timeMin, p.timeMax] : [25, 32];
  }
  var DIALS = {
    dose: { label: 'Dosis', unit: 'g', min: 5, max: 30, step: 0.1, majorEvery: 1, mediumEvery: 0.5, fallback: 18,
      describe: function (v) { return v < 12 ? 'Single-Sieb' : v <= 21 ? 'Doppeltes Sieb' : 'Triple-Sieb'; } },
    yield: { label: 'Bezug', unit: 'g', min: 10, max: 90, step: 0.5, majorEvery: 5, mediumEvery: 1, fallback: 36,
      describe: function (v) {
        var r = state.current.dose ? v / state.current.dose : 2;
        return '1:' + fmt(r, 1) + ' · ' + (r < 1.5 ? 'Ristretto' : r <= 2.5 ? 'Normale' : 'Lungo');
      } },
    time: { label: 'Zeit', unit: 's', min: 0, max: 60, step: 1, majorEvery: 5, fallback: 28,
      describe: function (v, touched) {
        if (!touched) return 'Wischen oder Shot-Timer';
        var w = timeWindow();
        return v < w[0] ? 'zu schnell' : v > w[1] ? 'zu langsam' : 'im Zielfenster';
      } },
    grind: { label: 'Mahlgrad', unit: '', fallback: 12,
      describe: function (v, touched) { return touched ? 'Stufe ' + fmt(v, 2) : 'Wischen zum Einstellen'; } }
  };
  var DIAL_ORDER = ['dose', 'yield', 'time', 'grind'];
  var activeKey = 'dose', dial = null;

  function dialText(k) {
    var v = state.current[k];
    if (v === '' || v == null) return '–';
    return fmt(v, k === 'grind' ? 2 : 1) + (DIALS[k].unit ? '\u202f' + DIALS[k].unit : '');
  }
  function renderDialTabs() {
    var box = $('#dial-tabs');
    box.innerHTML = '';
    DIAL_ORDER.forEach(function (k) {
      box.appendChild(el('button', {
        class: 'dial-tab', type: 'button', role: 'tab', 'aria-selected': String(activeKey === k), 'data-key': k,
        onclick: function () { if (activeKey !== k) { activeKey = k; U.tick('minor'); renderDialTabs(); mountDial(); } }
      }, [el('span', { text: DIALS[k].label }), el('strong', { text: dialText(k) })]));
    });
  }
  function mountDial() {
    var def = DIALS[activeKey];
    var key = activeKey;
    var scale = key === 'grind' ? grindScale() : def;
    dial = window.TickDial({
      label: def.label, unit: def.unit, value: state.current[key], fallback: def.fallback,
      min: scale.min, max: scale.max, step: scale.step, majorEvery: scale.majorEvery, mediumEvery: scale.mediumEvery,
      describe: def.describe,
      onChange: function (v) {
        state.current[key] = v;
        save();
        var tab = $('.dial-tab[data-key="' + key + '"] strong');
        if (tab) tab.textContent = dialText(key);
        update();
      }
    });
    var slot = $('#dial-slot');
    slot.innerHTML = '';
    slot.appendChild(dial.el);
  }
  function flash(key) {
    var b = $('.dial-tab[data-key="' + key + '"]');
    if (!b) return;
    b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash');
  }

  function fillInputs() {
    renderDialTabs();
    if (dial) dial.set(state.current[activeKey]); else mountDial();
    $('#set-step').value = state.settings.grindStep;
    $('#set-grindmax').value = state.settings.grindMax || 40;
    $('#set-direction').value = state.settings.direction;
    $$('input[name="keep"]').forEach(function (r) { r.checked = r.value === state.settings.keep; });
  }
  $('#set-step').addEventListener('input', function () {
    state.settings.grindStep = Number(this.value) || 1; save(); update();
    if (activeKey === 'grind') mountDial();
  });
  $('#set-grindmax').addEventListener('input', function () {
    state.settings.grindMax = Math.max(1, Number(this.value) || 40); save();
    if (activeKey === 'grind') mountDial();
  });
  $('#set-direction').addEventListener('change', function () { state.settings.direction = this.value; save(); update(); });
  $$('input[name="keep"]').forEach(function (r) {
    r.addEventListener('change', function () { state.settings.keep = r.value; save(); update(); });
  });

  // ---------- shot timer ----------
  var timer = { running: false, start: 0, iv: null };
  var timerBtn = $('#timer-btn');
  function renderTimer(sec) {
    timerBtn.innerHTML = '';
    timerBtn.appendChild(U.icon(timer.running ? 'pause' : 'timer'));
    timerBtn.appendChild(el('span', { class: timer.running ? 'mono' : '', text: timer.running ? sec.toFixed(1) + ' s' : 'Shot-Timer' }));
    timerBtn.classList.toggle('running', timer.running);
  }
  timerBtn.addEventListener('click', function () {
    if (!timer.running) {
      timer.running = true;
      timer.start = performance.now();
      timer.iv = setInterval(function () { renderTimer((performance.now() - timer.start) / 1000); }, 100);
      renderTimer(0);
      U.tick('major');
    } else {
      var sec = Math.round((performance.now() - timer.start) / 1000);
      clearInterval(timer.iv);
      timer.running = false;
      state.current.time = sec;
      activeKey = 'time';
      renderDialTabs(); mountDial();
      flash('time');
      renderTimer(0);
      U.tick('major');
      save(); update();
      toast('Zeit übernommen: ' + sec + ' s');
    }
  });
  renderTimer(0);

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
      sel.appendChild(el('option', { value: p.id }, [p.name + (p.roaster && p.roaster !== 'Vorlage' ? ' · ' + p.roaster : '')]));
    });
    sel.appendChild(el('option', { value: '__new' }, ['＋ Neue Bohne anlegen …']));
    sel.value = profileById(state.current.beanId) ? state.current.beanId : '';
    renderTarget();
  }
  $('#bean-select').addEventListener('change', function () {
    if (this.value === '__new') {
      this.value = profileById(state.current.beanId) ? state.current.beanId : '';
      openQuickBean();
      return;
    }
    selectBean(this.value);
  });
  function selectBean(id) {
    state.current.beanId = id;
    var p = profileById(id);
    var last = lastShotFor(id);
    if (last && last.next) {
      state.current.dose = last.next.dose; state.current.yield = last.next.yield;
      state.current.grind = last.next.grind == null ? state.current.grind : last.next.grind;
    } else if (p) {
      state.current.dose = p.dose; state.current.yield = p.yield;
      if (p.grind != null) state.current.grind = p.grind;
    }
    state.current.time = '';
    save(); fillInputs(); renderBeanSelect(); resetTaste();
  }
  function renderTarget() {
    var p = profileById(state.current.beanId);
    var box = $('#bean-target');
    box.hidden = !p;
    if (!p) return;
    box.innerHTML = '';
    [['Ziel', fmt(p.dose) + ' → ' + fmt(p.yield) + ' g'], ['Zeit', p.timeMin + '–' + p.timeMax + ' s'],
      p.temp ? ['', fmt(p.temp) + ' °C'] : null, ['Röstung', p.roast], p.grind != null ? ['Dein Mahlgrad', fmt(p.grind, 2)] : null]
      .forEach(function (kv) { if (kv) box.appendChild(el('span', { class: 'tag' }, [kv[0] ? kv[0] + ' ' : '', el('b', { text: kv[1] })])); });
  }
  // ---------- starting recipe tip for beans you know little about ----------
  /**
   * Builds the tip box: roast, basket and milk choices with a live suggestion.
   * opts.applyLabel: show a button that hands the suggestion to onApply;
   * without it, onApply is called on every change.
   */
  function tipBox(onApply, opts) {
    opts = opts || {};
    var sel = { roast: opts.roast || 'mittel', basket: 'double', milk: false };
    var box = el('div', { class: 'tip-box' });
    function choice(label, key, options, hint) {
      var row = el('div', { class: 'choice-row', role: 'radiogroup', 'aria-label': label });
      options.forEach(function (o) {
        row.appendChild(el('button', { type: 'button', class: 'choice', role: 'radio', 'aria-checked': String(sel[key] === o[0]),
          onclick: function () { sel[key] = o[0]; U.tick('minor'); render(); } }, [o[1]]));
      });
      return el('div', { class: 'field' }, [el('span', { class: 'label', text: label }), row, hint ? el('span', { class: 'tip-hint', text: hint }) : null]);
    }
    function render() {
      var s = E.suggestRecipe(sel);
      box.innerHTML = '';
      box.appendChild(el('p', { class: 'tip-title' }, [U.icon('learn'), 'So startest du mit dieser Bohne']));
      box.appendChild(choice('Röstgrad', 'roast', [['hell', 'hell'], ['mittel', 'mittel'], ['dunkel', 'dunkel']],
        'Steht nicht auf der Tüte? Hellbraun = hell, schokobraun = mittel, fast schwarz und ölig = dunkel.'));
      box.appendChild(choice('Sieb im Siebträger', 'basket', [['single', 'Single'], ['double', 'Doppelt'], ['triple', 'Triple']],
        'Im Zweifel: Doppelt. Das ist bei fast allen Maschinen Standard.'));
      box.appendChild(choice('Wie trinkst du ihn?', 'milk', [[false, 'pur'], [true, 'mit Milch']]));
      box.appendChild(el('div', { class: 'tip-result' }, [
        tipStat('Dosis', fmt(s.dose) + ' g'), tipStat('Bezug', fmt(s.yield) + ' g', '1:' + fmt(s.yield / s.dose, 1)),
        tipStat('Zeit', s.timeMin + '–' + s.timeMax + ' s'), tipStat('Temperatur', s.temp + ' °C')
      ]));
      var why = el('ul', { class: 'tip-why' });
      s.why.forEach(function (t) { why.appendChild(el('li', { text: t })); });
      box.appendChild(why);
      if (opts.applyLabel) {
        box.appendChild(el('div', { class: 'row-actions' }, [
          el('button', { class: 'btn small accent', type: 'button', onclick: function () { onApply(s, sel); } }, [opts.applyLabel])
        ]));
      } else {
        onApply(s, sel);
      }
    }
    render();
    return box;
  }
  function tipStat(k, v, sub) {
    return el('div', { class: 'tip-stat' }, [el('span', { class: 'label', text: k }), el('strong', { text: v }), sub ? el('span', { class: 'muted', text: sub }) : null]);
  }

  // Quick "new bean" right in the espresso view.
  var quickBtn = $('#bean-quick-btn');
  function openQuickBean() {
    var panel = $('#quick-bean');
    var suggestion = null, choice = null;
    var name = el('input', { id: 'qb-name', maxlength: 80, placeholder: 'z. B. Ethiopia Guji' });
    var roaster = el('input', { id: 'qb-roaster', maxlength: 80, placeholder: 'optional' });
    panel.innerHTML = '';
    panel.appendChild(el('div', { class: 'quick-head' }, [
      el('h3', { text: 'Neue Bohne' }),
      el('button', { class: 'icon-btn light small', type: 'button', 'aria-label': 'Schließen', onclick: closeQuickBean }, [U.icon('close')])
    ]));
    panel.appendChild(el('div', { class: 'form-grid' }, [
      el('label', { class: 'field span2', for: 'qb-name' }, [el('span', { class: 'label', text: 'Name' }), name]),
      el('label', { class: 'field span2', for: 'qb-roaster' }, [el('span', { class: 'label', text: 'Rösterei' }), roaster])
    ]));
    panel.appendChild(tipBox(function (s, sel) { suggestion = s; choice = sel; }));
    panel.appendChild(el('div', { class: 'row-actions' }, [
      el('button', { class: 'btn accent', type: 'button', onclick: function () {
        var n = name.value.trim();
        if (!n) { name.focus(); toast('Gib der Bohne einen Namen.'); return; }
        var p = E.parseProfile({ name: n, roaster: roaster.value.trim(), roast: choice.roast,
          notes: choice.milk ? 'Für Milchgetränke.' : '', recipe: suggestion });
        p.id = uniqueId(p.id);
        state.profiles.push(p);
        save();
        closeQuickBean();
        selectBean(p.id);
        U.tick('major');
        toast('„' + p.name + '“ angelegt. Zieh den ersten Shot mit ' + fmt(p.dose) + ' g → ' + fmt(p.yield) + ' g.');
      } }, ['Anlegen & loslegen']),
      el('button', { class: 'btn ghost', type: 'button', onclick: closeQuickBean }, ['Abbrechen'])
    ]));
    panel.hidden = false;
    quickBtn.setAttribute('aria-expanded', 'true');
    name.focus();
  }
  function closeQuickBean() {
    $('#quick-bean').hidden = true;
    quickBtn.setAttribute('aria-expanded', 'false');
  }
  quickBtn.addEventListener('click', function () { if ($('#quick-bean').hidden) openQuickBean(); else closeQuickBean(); });

  // Tip inside the full bean form (Bohnen tab).
  $('#bf-tip-btn').addEventListener('click', function () {
    var slot = $('#bf-tip-slot');
    if (!slot.hidden) { slot.hidden = true; this.setAttribute('aria-expanded', 'false'); return; }
    slot.innerHTML = '';
    slot.appendChild(tipBox(function (s, sel) {
      $('#bf-dose').value = s.dose; $('#bf-yield').value = s.yield;
      $('#bf-tmin').value = s.timeMin; $('#bf-tmax').value = s.timeMax;
      $('#bf-temp').value = s.temp; $('#bf-roast').value = sel.roast;
      slot.hidden = true;
      $('#bf-tip-btn').setAttribute('aria-expanded', 'false');
      U.tick('medium');
      toast('Werte übernommen. Du kannst sie jederzeit anpassen.');
    }, { applyLabel: 'Werte übernehmen', roast: $('#bf-roast').value }));
    slot.hidden = false;
    this.setAttribute('aria-expanded', 'true');
  });

  function lastShotFor(beanId) {
    for (var i = state.shots.length - 1; i >= 0; i--) if ((state.shots[i].beanId || '') === (beanId || '')) return state.shots[i];
    return null;
  }

  // ---------- main update ----------
  function update() {
    var c = state.current;
    var ratio = c.dose && c.yield ? c.yield / c.dose : null;
    $('#ratio-out').textContent = ratio ? '1:' + fmt(ratio, 2) : '–';
    // Track spans 1:1 … 1:3.
    $('#ratio-marker').style.left = ratio ? Math.max(1, Math.min(99, (ratio - 1) / 2 * 100)) + '%' : '50%';

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
    updateCompass(hasTaste ? { x: taste.x, y: taste.y } : null, trail, taste.descriptors, true);

    renderResult(hasTaste ? E.recommend(recipe(), { x: taste.x, y: taste.y, descriptors: taste.descriptors }, profile) : null);
  }

  var ACTION_ICON = { grind: '±', ratio: '1:', temp: '°C', prep: '!', done: '✓' };

  function renderResult(r) {
    var prevZone = lastResult && lastResult.zone;
    lastResult = r;
    var body = $('#result-body');
    var badge = $('#zone-badge');
    body.innerHTML = '';
    badge.className = '';
    badge.textContent = '';
    if (!r) {
      body.appendChild(el('div', { class: 'empty-state', html:
        '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><circle cx="24" cy="24" r="20"/><circle cx="24" cy="24" r="8" stroke-dasharray="3 3"/><path d="M24 4v6M24 38v6M4 24h6M38 24h6"/></svg>' +
        '<p>Markiere den Geschmack deines Shots. Hier erscheinen dann die Werte für den nächsten Versuch.</p>' }));
      return;
    }
    badge.className = 'zone-badge zone-' + r.zone;
    badge.textContent = { sweetspot: 'Im Zentrum', green: 'Grüner Bereich', off: 'Korrigieren' }[r.zone];
    if (r.zone === 'sweetspot' && prevZone !== 'sweetspot') U.tick('major');

    var c = state.current, n = r.next;
    var grindVal = n.grind == null
      ? (n.grindSteps ? Math.abs(n.grindSteps) + (n.grindSteps > 0 ? ' feiner' : ' gröber') : '=')
      : fmt(n.grind, 2);
    var tiles = [
      { k: 'Mahlgrad', v: grindVal, from: c.grind === '' || c.grind == null ? null : fmt(c.grind, 2),
        delta: n.grindSteps ? (n.grindSteps > 0 ? Math.abs(n.grindSteps) + ' feiner' : Math.abs(n.grindSteps) + ' gröber') : null, changed: n.grindSteps !== 0 },
      { k: 'Dosis', v: fmt(n.dose) + ' g', from: fmt(c.dose) + ' g', delta: diff(n.dose, c.dose, 'g'), changed: Number(c.dose) !== n.dose },
      { k: 'Bezug', v: fmt(n.yield) + ' g', from: fmt(c.yield) + ' g · 1:' + fmt(n.ratio, 2), delta: diff(n.yield, c.yield, 'g'), changed: Number(c.yield) !== n.yield },
      { k: 'Zielzeit', v: n.targetTime ? '≈ ' + n.targetTime + ' s' : n.timeMin + '–' + n.timeMax + ' s', from: c.time ? 'zuletzt ' + c.time + ' s' : null, changed: false }
    ];
    var grid = el('div', { class: 'next-tiles' });
    tiles.forEach(function (t, i) {
      grid.appendChild(el('div', { class: 'next-tile' + (t.changed ? ' changed' : ''), style: 'animation-delay:' + (i * 50) + 'ms' }, [
        el('span', { class: 'label', text: t.k }),
        el('div', { class: 'val' }, [t.v, t.delta && t.k !== 'Mahlgrad' ? el('span', { class: 'delta', text: t.delta }) : null]),
        t.from ? el('div', { class: 'from', text: t.k === 'Zielzeit' ? t.from : 'vorher ' + t.from }) : null
      ]));
    });
    body.appendChild(grid);

    var ul = el('ul', { class: 'actions' });
    r.actions.forEach(function (a, i) {
      ul.appendChild(el('li', { class: a.kind, style: 'animation-delay:' + (200 + i * 70) + 'ms' }, [
        el('span', { class: 'ico', text: ACTION_ICON[a.kind] || '•' }),
        el('div', {}, [el('strong', { text: a.title }), el('p', { text: a.detail })])
      ]));
    });
    if (!r.actions.length) {
      ul.appendChild(el('li', { class: 'done' }, [el('span', { class: 'ico', text: '≈' }),
        el('div', {}, [el('strong', { text: 'Fast da' }), el('p', { text: 'Nur minimale Abweichung. Wiederhole den Shot einmal unverändert.' })])]));
    }
    body.appendChild(ul);

    if (r.notes.length) {
      var notes = el('ul', { class: 'notes' });
      r.notes.forEach(function (t) { notes.appendChild(el('li', { text: t })); });
      body.appendChild(notes);
    }

    var actions = el('div', { class: 'row-actions' });
    if (r.zone === 'sweetspot') {
      actions.appendChild(el('button', { class: 'btn accent', type: 'button', onclick: saveAsTarget }, ['Rezept für diese Bohne speichern']));
    } else {
      actions.appendChild(el('button', { class: 'btn accent', type: 'button', onclick: logAndApply }, ['Übernehmen & nächster Shot', U.icon('arrow')]));
    }
    actions.appendChild(el('button', { class: 'btn ghost', type: 'button', onclick: logOnly }, ['Nur speichern']));
    body.appendChild(actions);
  }
  function diff(a, b, unit) {
    var d = Math.round((Number(a) - Number(b)) * 10) / 10;
    if (!d) return null;
    return (d > 0 ? '+' : '−') + fmt(Math.abs(d)) + ' ' + unit;
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
    ['dose', 'yield', 'grind'].forEach(flash);
    toast('Neues Rezept übernommen. Zieh den nächsten Shot.');
    $('.area-recipe').scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    if (c.grind !== '' && c.grind != null) p.grind = Number(c.grind);
    save(); renderBeanSelect(); resetTaste();
    toast('Gespeichert in „' + p.name + '“.');
  }

  // ---------- beans view ----------
  var editingId = null;
  function renderBeans() {
    var list = $('#bean-list');
    list.innerHTML = '';
    if (!state.profiles.length) list.appendChild(el('p', { class: 'muted', text: 'Noch keine Profile. Lege eins an oder importiere einen Link.' }));
    state.profiles.forEach(function (p, i) {
      var shots = state.shots.filter(function (s) { return s.beanId === p.id; });
      var card = el('article', { class: 'panel bean', style: 'animation: rise .35s ease both; animation-delay:' + (i * 40) + 'ms' }, [
        el('header', {}, [
          el('div', {}, [el('h3', { text: p.name }), p.roaster ? el('div', { class: 'roaster', text: p.roaster }) : null]),
          el('span', { class: 'roast-dot roast-' + p.roast }, [el('i'), p.roast])
        ]),
        el('div', { class: 'stat-row' }, [
          el('span', { class: 'stat', text: fmt(p.dose) + ' → ' + fmt(p.yield) + ' g' }),
          el('span', { class: 'stat', text: p.timeMin + '–' + p.timeMax + ' s' }),
          p.temp ? el('span', { class: 'stat', text: fmt(p.temp) + ' °C' }) : null,
          p.grind != null ? el('span', { class: 'stat', text: 'Mahlgrad ' + fmt(p.grind, 2) }) : null
        ]),
        p.notes ? el('p', { class: 'muted', style: 'margin:0;font-size:.9rem', text: p.notes }) : null,
        el('div', { class: 'row-actions' }, [
          el('button', { class: 'btn small accent', type: 'button', onclick: function () { showView('espresso'); selectBean(p.id); } }, ['Einstellen']),
          el('button', { class: 'btn small ghost', type: 'button', onclick: function () { editBean(p.id); } }, ['Bearbeiten']),
          el('button', { class: 'btn small ghost', type: 'button', onclick: function () { shareBean(p); } }, [U.icon('share'), 'Teilen']),
          el('button', { class: 'btn small ghost', type: 'button', onclick: function (ev) { deleteBean(p.id, ev.currentTarget); } }, ['Löschen'])
        ])
      ]);
      if (shots.length) card.appendChild(historyBlock(shots));
      list.appendChild(card);
    });
    var loose = state.shots.filter(function (s) { return !s.beanId; });
    if (loose.length) {
      list.appendChild(el('article', { class: 'panel bean' }, [
        el('header', {}, [el('h3', { text: 'Ohne Profil' })]),
        historyBlock(loose)
      ]));
    }
  }
  function historyBlock(shots) {
    var details = el('details', { class: 'bean-history' }, [el('summary', { text: 'Verlauf · ' + shots.length + ' Shot' + (shots.length > 1 ? 's' : '') })]);
    details.addEventListener('toggle', function () {
      if (!details.open || details.dataset.ready) return;
      details.dataset.ready = '1';
      var mini = svg('svg', { viewBox: '-1.25 -1.25 2.5 2.5', role: 'img', 'aria-label': 'Verlauf auf dem Kompass' });
      details.appendChild(mini);
      var trail = shots.map(function (s) { return { x: s.x, y: s.y }; });
      buildCompass(mini, { small: true })(trail[trail.length - 1], trail, [], false);
      var ol = el('ol', { class: 'history-list' });
      shots.slice().reverse().forEach(function (s) {
        var words = s.descriptors.map(function (id) { var d = E.findDescriptor(id); return d ? d.de : id; }).join(', ');
        ol.appendChild(el('li', {}, [
          el('span', { class: 'mono', text: fmt(s.dose) + '→' + fmt(s.yield) + ' g' + (s.time ? ' · ' + s.time + ' s' : '') + (s.grind !== '' && s.grind != null ? ' · M ' + fmt(s.grind, 2) : '') }),
          el('span', { class: 'muted', text: new Date(s.at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + (words ? ' · ' + words : '') })
        ]));
      });
      details.appendChild(ol);
    });
    return details;
  }
  var BEAN_FIELDS = { name: 'bf-name', roaster: 'bf-roaster', dose: 'bf-dose', yield: 'bf-yield', timeMin: 'bf-tmin', timeMax: 'bf-tmax', temp: 'bf-temp', roast: 'bf-roast', notes: 'bf-notes' };
  function editBean(id) {
    editingId = id;
    var p = id ? profileById(id) : { name: '', roaster: '', dose: 18, yield: 36, timeMin: 25, timeMax: 30, temp: 93, roast: 'mittel', notes: '' };
    Object.keys(BEAN_FIELDS).forEach(function (k) { $('#' + BEAN_FIELDS[k]).value = p[k] == null ? '' : p[k]; });
    $('#bean-form-title').textContent = id ? 'Profil bearbeiten' : 'Neues Profil';
    $('#bf-tip-slot').hidden = true;
    $('#bf-tip-btn').setAttribute('aria-expanded', 'false');
    $('#bean-form-card').hidden = false;
    $('#bean-import-card').hidden = true;
    $('#bean-form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#bf-name').focus({ preventScroll: true });
  }
  // Two-step delete: first click arms the button, second click deletes.
  function deleteBean(id, btn) {
    if (btn.dataset.armed !== '1') {
      btn.dataset.armed = '1';
      btn.textContent = 'Wirklich löschen?';
      setTimeout(function () { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = 'Löschen'; } }, 4000);
      return;
    }
    state.profiles = state.profiles.filter(function (x) { return x.id !== id; });
    state.shots = state.shots.filter(function (s) { return s.beanId !== id; });
    if (state.current.beanId === id) state.current.beanId = '';
    save(); renderBeans(); renderBeanSelect();
    toast('Profil gelöscht.');
  }
  $('#bean-new').addEventListener('click', function () { editBean(null); });
  $('#bean-cancel').addEventListener('click', function () { $('#bean-form-card').hidden = true; });
  $('#bean-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var data = { recipe: {} };
    ['name', 'roaster', 'roast', 'notes'].forEach(function (k) { data[k] = $('#' + BEAN_FIELDS[k]).value; });
    ['dose', 'yield', 'timeMin', 'timeMax', 'temp'].forEach(function (k) { data.recipe[k] = $('#' + BEAN_FIELDS[k]).value; });
    try {
      var p = E.parseProfile(data);
      var old = editingId ? profileById(editingId) : null;
      if (old) { p.id = old.id; p.grind = old.grind; state.profiles[state.profiles.indexOf(old)] = p; }
      else { p.id = uniqueId(p.id); state.profiles.push(p); }
      save(); $('#bean-form-card').hidden = true; renderBeans(); renderBeanSelect(); toast('Profil gespeichert.');
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
    var bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return E.parseProfile(new TextDecoder().decode(bytes));
  }
  function shareBean(p) {
    var url = location.origin + location.pathname + '#bean=' + encodeProfile(p);
    $('#share-name').textContent = p.name;
    $('#share-url').value = url;
    $('#share-box').hidden = false;
    $('#share-box').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () { toast('Link kopiert.'); }, function () { $('#share-url').select(); });
    } else {
      $('#share-url').select();
    }
  }
  $('#share-close').addEventListener('click', function () { $('#share-box').hidden = true; });
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
      $('#import-text').value = ''; $('#bean-import-card').hidden = true; renderBeans(); renderBeanSelect();
    } catch (e) {
      $('#import-error').textContent = 'Import fehlgeschlagen: ' + e.message; $('#import-error').hidden = false;
    }
  });
  $('#import-file').addEventListener('change', function () {
    var file = this.files[0];
    if (file) file.text().then(function (t) { $('#import-text').value = t; });
  });
  // A shared profile link prefills the import card so the user confirms in the page.
  function handleHash() {
    var m = location.hash.match(/^#bean=([A-Za-z0-9_-]+)/);
    if (m) {
      showView('beans');
      $('#bean-import-card').hidden = false;
      $('#bean-form-card').hidden = true;
      $('#import-text').value = location.origin + location.pathname + m[0];
      $('#import-error').hidden = true;
      return true;
    }
    var v = location.hash.slice(1);
    if (VIEWS.some(function (x) { return x.id === v; })) { showView(v); return true; }
    return false;
  }

  // Guide cards in "Wissen": icons and jump buttons.
  $$('.guide-ico').forEach(function (n) { n.appendChild(U.icon(n.getAttribute('data-icon'))); });
  $$('[data-go]').forEach(function (b) { b.addEventListener('click', function () { showView(b.getAttribute('data-go')); }); });

  onView('beans', renderBeans);
  onView('espresso', function () { renderBeanSelect(); update(); });

  // Shared with brew-ui.js and cafes-ui.js.
  window.App = { state: state, save: save, showView: showView, onView: onView };

  // ---------- boot ----------
  fillInputs();
  renderBeanSelect();
  update();
  document.addEventListener('DOMContentLoaded', function () {
    if (!handleHash()) showView(state.view || 'espresso', { keepScroll: true });
  });
  window.addEventListener('hashchange', handleHash);
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
