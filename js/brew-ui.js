/* Brewing guide view: method picker, recipes, scaling and the guided brew timer. */
(function () {
  'use strict';

  var B = window.BrewData;
  var U = window.UI;
  var App = window.App;
  var $ = U.$, el = U.el, fmt = U.fmt;
  var state = App.state;

  var current = null; // scaled recipe shown in the detail panel

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
    B.recipesFor(state.brew.method).forEach(function (r, i) {
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
          el('span', { class: 'tag', text: r.level }),
          r.position ? el('span', { class: 'tag', text: r.position }) : null
        ])
      ]));
    });
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
    var base = state.brew.recipe && B.recipeById(state.brew.recipe);
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
    play.appendChild(U.icon(bm.running ? 'pause' : (done ? 'reset' : 'play')));
    play.setAttribute('aria-label', bm.running ? 'Pause' : 'Start');
  }

  App.onView('brew', function () { renderMethods(); renderRecipes(); renderDetail(); });
})();
