/* Tasting view: taste wheel overview ("Mein Geschmack"), rating flow with
   aroma wheel and tick dials, optional bag scan, and the list of rated coffees. */
(function () {
  'use strict';

  var T = window.TastingData;
  var B = window.BrewData;
  var U = window.UI;
  var App = window.App;
  var $ = U.$, el = U.el, svg = U.svg, fmt = U.fmt, toast = U.toast;
  var state = App.state;
  state.ratings = state.ratings || [];
  // Fill the tasting view with the marked examples once, so the taste wheel,
  // favourite profile and list show something on first visit. Removing them
  // sets the flag for good; the button can still load them again.
  if (!state.examplesSeeded) {
    state.examplesSeeded = true;
    if (!state.ratings.some(function (r) { return r.example; })) state.ratings = state.ratings.concat(T.exampleRatings());
    App.save();
  }

  var SEG = 360 / T.AROMA_FAMILIES.length;
  var DARK_TEXT = '#1a120c';

  function round(n) { return Math.round(n * 100) / 100; }
  function polar(r, a) { var rad = a * Math.PI / 180; return [round(r * Math.sin(rad)), round(-r * Math.cos(rad))]; }
  function sector(r0, r1, a0, a1) {
    var p0 = polar(r1, a0), p1 = polar(r1, a1), p2 = polar(r0, a1), p3 = polar(r0, a0);
    var large = a1 - a0 > 180 ? 1 : 0;
    return 'M' + p0[0] + ' ' + p0[1] + 'A' + r1 + ' ' + r1 + ' 0 ' + large + ' 1 ' + p1[0] + ' ' + p1[1] +
      'L' + p2[0] + ' ' + p2[1] + 'A' + r0 + ' ' + r0 + ' 0 ' + large + ' 0 ' + p3[0] + ' ' + p3[1] + 'Z';
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // =====================================================================
  // Overview: the taste wheel. Each family's bar grows with how much you
  // liked the coffees that showed it (average rating, 0–10).
  // =====================================================================
  var focusFamily = null;
  var INNER = 46, OUTER = 150;

  function renderOverview(animate) {
    var p = T.profile(state.ratings);
    var root = $('#flavor-wheel');
    root.innerHTML = '';
    var bars = [];
    T.AROMA_FAMILIES.forEach(function (f, i) {
      var fam = p.families[i];
      var a0 = i * SEG + 1, a1 = (i + 1) * SEG - 1, mid = (a0 + a1) / 2;
      var focused = focusFamily === f.id;
      var g = svg('g', { class: 'fw-seg' + (focused ? ' focused' : ''), role: 'button', tabindex: '0',
        'aria-label': f.name + (fam.n ? ', Durchschnitt ' + fmt(fam.avg) + ' aus ' + fam.n : ', noch nicht probiert') });
      g.appendChild(svg('path', { d: sector(INNER, OUTER, a0, a1), class: 'fw-track' }));
      var target = fam.n ? INNER + (OUTER - INNER) * Math.max(0.08, fam.avg / 10) : INNER + 6;
      var bar = svg('path', { d: sector(INNER, animate ? INNER + 1 : target, a0, a1), fill: f.color,
        'fill-opacity': fam.n ? (focused ? 1 : 0.85) : 0.25, class: 'fw-bar' });
      g.appendChild(bar);
      bars.push({ el: bar, a0: a0, a1: a1, to: target });
      var lp = polar(OUTER + 12, mid);
      var flip = mid > 90 && mid < 270;
      var label = svg('text', { x: lp[0], y: lp[1], class: 'fw-label', 'text-anchor': 'middle', 'dominant-baseline': 'central',
        transform: 'rotate(' + (flip ? mid + 180 : mid) + ' ' + lp[0] + ' ' + lp[1] + ')' });
      label.textContent = f.name;
      g.appendChild(label);
      if (fam.n) {
        var vp = polar(Math.max(target - 13, INNER + 12), mid);
        var val = svg('text', { x: vp[0], y: vp[1], class: 'fw-val', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
        val.textContent = fmt(fam.avg);
        g.appendChild(val);
      }
      var choose = function () { focusFamily = focusFamily === f.id ? null : f.id; U.tick('minor'); renderOverview(false); };
      g.addEventListener('click', choose);
      g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); choose(); } });
      root.appendChild(g);
    });
    root.appendChild(svg('circle', { r: INNER - 6, class: 'fw-hub' }));
    var c1 = svg('text', { y: -6, class: 'fw-hub-big', 'text-anchor': 'middle' });
    var c2 = svg('text', { y: 14, class: 'fw-hub-small', 'text-anchor': 'middle' });
    c1.textContent = p.count ? fmt(p.average) : '–';
    c2.textContent = p.count ? 'Ø aus ' + p.count : 'keine Daten';
    root.appendChild(c1);
    root.appendChild(c2);

    if (animate) {
      var start = performance.now();
      var step = function (now) {
        var k = Math.min(1, (now - start) / 700);
        var e = 1 - Math.pow(1 - k, 3);
        bars.forEach(function (b, i) {
          var kk = Math.max(0, Math.min(1, e * 1.25 - i * 0.025));
          b.el.setAttribute('d', sector(INNER, INNER + (b.to - INNER) * kk + 0.5, b.a0, b.a1));
        });
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    // Text under the wheel
    var sum = $('#taste-summary');
    sum.innerHTML = '';
    if (!p.count) {
      sum.appendChild(el('p', { class: 'fw-summary', text: 'Bewerte deinen ersten Kaffee – dann wächst hier dein Geschmacksrad.' }));
    } else if (focusFamily) {
      var fam = p.families.filter(function (x) { return x.id === focusFamily; })[0];
      sum.appendChild(el('p', { class: 'fw-summary' }, [
        el('b', { text: fam.name + ': ' }),
        fam.n ? 'Ø ' + fmt(fam.avg) + ' aus ' + fam.n + ' Kaffee' + (fam.n > 1 ? 's' : '') + (fam.top.length ? ' · am liebsten ' + fam.top.join(', ') : '') : 'noch nicht probiert.'
      ]));
    } else {
      sum.appendChild(el('p', { class: 'fw-summary', text: T.summary(p) }));
    }
    if (p.favoriteAromas.length) {
      var row = el('div', { class: 'aroma-pills' });
      p.favoriteAromas.forEach(function (a) {
        row.appendChild(el('span', { class: 'aroma-pill' }, [el('i', { style: 'background:' + T.AROMA_FAMILY[a].color }), a]));
      });
      sum.appendChild(row);
    }
    renderSide(p);
  }

  function renderSide(p) {
    var box = $('#taste-side');
    box.innerHTML = '';
    box.appendChild(el('h2', { text: 'Dein Lieblingsprofil' }));
    var dims = T.STRUCTURE.filter(function (s) { return p.structure[s.id]; });
    if (dims.length < 3) {
      box.appendChild(el('p', { class: 'muted', text: 'Sobald du ein paar Kaffees mit Säure, Süße und Körper bewertet hast, siehst du hier, welches Profil dir am besten schmeckt.' }));
    } else {
      box.appendChild(radar(T.STRUCTURE.map(function (s) { return { label: s.label, value: p.structure[s.id] ? p.structure[s.id].value : 0 }; })));
      var ul = el('ul', { class: 'struct-list' });
      dims.forEach(function (s) {
        var v = p.structure[s.id].value;
        ul.appendChild(el('li', {}, [el('span', { text: s.label }), el('span', { class: 'mono', text: fmt(v) }), el('span', { class: 'muted', text: T.describeStructure(s.id, v) })]));
      });
      box.appendChild(ul);
    }
    [['Herkunft', p.origins], ['Aufbereitung', p.processes], ['Röstereien', p.roasters], ['Zubereitung', p.methods]].forEach(function (pair) {
      if (!pair[1].length) return;
      var list = el('ol', { class: 'rank-list' });
      pair[1].slice(0, 4).forEach(function (r) {
        list.appendChild(el('li', {}, [
          el('span', { class: 'rank-name', text: r.name }),
          el('span', { class: 'rank-bar' }, [el('i', { style: 'width:' + Math.max(4, r.avg * 10) + '%' })]),
          el('span', { class: 'mono', text: fmt(r.avg) })
        ]));
      });
      box.appendChild(el('div', { class: 'rank-block' }, [el('h3', { text: pair[0] }), list]));
    });
  }

  function radar(axes) {
    var n = axes.length, R = 100, C = 0;
    var pt = function (v, i, r) { var a = i / n * Math.PI * 2 - Math.PI / 2; var rr = (v / 10) * (r || R); return [round(C + rr * Math.cos(a)), round(C + rr * Math.sin(a))]; };
    var shape = function (vals) { return vals.map(function (v, i) { return (i ? 'L' : 'M') + pt(v, i).join(' '); }).join('') + 'Z'; };
    var root = svg('svg', { viewBox: '-150 -130 300 260', class: 'radar', role: 'img', 'aria-label': 'Lieblingsprofil: ' + axes.map(function (a) { return a.label + ' ' + fmt(a.value); }).join(', ') });
    [2, 4, 6, 8, 10].forEach(function (r) { root.appendChild(svg('path', { d: shape(axes.map(function () { return r; })), class: 'rd-ring' })); });
    axes.forEach(function (a, i) {
      var e = pt(10, i), l = pt(10, i, R + 22);
      root.appendChild(svg('line', { x1: 0, y1: 0, x2: e[0], y2: e[1], class: 'rd-axis' }));
      var t = svg('text', { x: l[0], y: l[1], class: 'rd-label', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      t.textContent = a.label;
      root.appendChild(t);
    });
    root.appendChild(svg('path', { d: shape(axes.map(function (a) { return a.value; })), class: 'rd-shape' }));
    axes.forEach(function (a, i) { var p = pt(a.value, i); root.appendChild(svg('circle', { cx: p[0], cy: p[1], r: 4.5, class: 'rd-dot' })); });
    return root;
  }

  // =====================================================================
  // Rating flow
  // =====================================================================
  var STEPS = ['Kaffee', 'Aromen', 'Struktur', 'Urteil'];
  var draft = null, stepIndex = 0;

  function emptyDraft() {
    return { id: null, roaster: '', name: '', origin: '', region: '', variety: '', process: '', roast: '', method: 'Espresso',
      roasterNotes: '', aromas: [], structure: {}, rating: null, notes: '' };
  }

  function openFlow(existing) {
    draft = existing ? JSON.parse(JSON.stringify(existing)) : emptyDraft();
    draft.structure = draft.structure || {};
    stepIndex = 0;
    $('#rate-flow').hidden = false;
    renderFlow();
    $('#rate-flow').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function closeFlow() { $('#rate-flow').hidden = true; draft = null; }

  function renderFlow() {
    var box = $('#rate-flow');
    box.innerHTML = '';
    var head = el('div', { class: 'flow-head' }, [
      el('div', {}, [
        el('p', { class: 'eyebrow', text: 'Schritt ' + (stepIndex + 1) + ' von ' + STEPS.length }),
        el('h2', { text: draft.id ? 'Bewertung bearbeiten' : STEPS[stepIndex] === 'Kaffee' ? 'Welcher Kaffee?' : STEPS[stepIndex] })
      ]),
      el('button', { class: 'icon-btn light', type: 'button', 'aria-label': 'Abbrechen', onclick: closeFlow }, [U.icon('close')])
    ]);
    var progress = el('div', { class: 'flow-progress' });
    STEPS.forEach(function (s, i) {
      progress.appendChild(el('button', { type: 'button', class: i < stepIndex ? 'done' : i === stepIndex ? 'now' : '',
        onclick: function () { stepIndex = i; renderFlow(); } }, [el('i'), el('span', { text: s })]));
    });
    box.appendChild(head);
    box.appendChild(progress);
    var body = el('div', { class: 'flow-body' });
    box.appendChild(body);
    [stepCoffee, stepAromas, stepStructure, stepVerdict][stepIndex](body);

    var nav = el('div', { class: 'flow-nav' }, [
      stepIndex ? el('button', { class: 'btn ghost', type: 'button', onclick: function () { stepIndex--; renderFlow(); } }, ['Zurück']) : el('span'),
      stepIndex < STEPS.length - 1
        ? el('button', { class: 'btn accent', type: 'button', onclick: function () { stepIndex++; U.tick('minor'); renderFlow(); } }, ['Weiter', U.icon('arrow')])
        : el('button', { class: 'btn accent', type: 'button', onclick: saveDraft }, ['Bewertung speichern'])
    ]);
    box.appendChild(nav);
  }

  function field(label, key, placeholder) {
    var input = el('input', { value: draft[key] || '', placeholder: placeholder || '', id: 'rf-' + key });
    input.addEventListener('input', function () { draft[key] = input.value; });
    return el('label', { class: 'field', for: 'rf-' + key }, [el('span', { class: 'label', text: label }), input]);
  }
  function choiceRow(label, key, options) {
    var row = el('div', { class: 'choice-row', role: 'radiogroup', 'aria-label': label });
    options.forEach(function (o) {
      row.appendChild(el('button', { type: 'button', class: 'choice', role: 'radio', 'aria-checked': String(draft[key] === o),
        onclick: function () {
          draft[key] = draft[key] === o ? '' : o;
          U.tick('minor');
          Array.prototype.forEach.call(row.children, function (b) { b.setAttribute('aria-checked', String(b.textContent === draft[key])); });
        } }, [o]));
    });
    return el('div', { class: 'field' }, [el('span', { class: 'label', text: label }), row]);
  }

  // ---------- step 1: coffee + scan ----------
  var scanner = { fn: null, accept: 'image/*', checked: false };

  function stepCoffee(body) {
    var scanBox = el('div', { class: 'scan-card', id: 'scan-card' });
    body.appendChild(scanBox);
    renderScan(scanBox);
    body.appendChild(el('div', { class: 'form-grid' }, [
      el('div', { class: 'span2' }, [field('Rösterei', 'roaster', 'z. B. Kaffeerösterei Müller')]),
      el('div', { class: 'span2' }, [field('Kaffee', 'name', 'z. B. Ethiopia Guji')]),
      el('div', { class: 'span2' }, [field('Herkunft (Land)', 'origin', 'z. B. Äthiopien')]),
      el('div', { class: 'span2' }, [field('Region / Farm', 'region', 'z. B. Guji, Hambela')]),
      el('div', { class: 'span4' }, [field('Varietät', 'variety', 'z. B. Heirloom, Bourbon, Gesha')])
    ]));
    body.appendChild(choiceRow('Aufbereitung', 'process', T.PROCESSES));
    body.appendChild(choiceRow('Röstgrad', 'roast', T.ROASTS));
    body.appendChild(choiceRow('Zubereitung', 'method', ['Espresso'].concat(B.METHODS.map(function (m) { return m.name; }))));
    if (draft.roasterNotes) body.appendChild(el('p', { class: 'muted', text: 'Laut Tüte: ' + draft.roasterNotes }));
  }

  function renderScan(box) {
    box.innerHTML = '';
    if (!scanner.fn) {
      box.appendChild(el('div', { class: 'scan-row' }, [
        el('span', { class: 'scan-ico' }, [U.icon('scan')]),
        el('div', {}, [
          el('strong', { text: 'Tüte scannen' }),
          el('p', { class: 'muted', text: scanner.checked
            ? 'Der Scan ist hier nicht verfügbar. Trag die Angaben einfach selbst ein.'
            : 'Wird geprüft …' })
        ])
      ]));
      return;
    }
    var input = el('input', { type: 'file', accept: scanner.accept, capture: 'environment', id: 'scan-file', hidden: true });
    input.addEventListener('change', function () { if (input.files[0]) runScan(input.files[0], box); });
    box.appendChild(el('div', { class: 'scan-row' }, [
      el('span', { class: 'scan-ico' }, [U.icon('scan')]),
      el('div', {}, [
        el('strong', { text: 'Tüte scannen' }),
        el('p', { class: 'muted', text: 'Foto vom Etikett: Rösterei, Herkunft, Aufbereitung und Geschmacksnoten werden ausgefüllt.' })
      ]),
      el('label', { class: 'btn accent small', for: 'scan-file' }, ['Foto wählen']),
      input
    ]));
  }

  function runScan(file, box) {
    box.innerHTML = '';
    box.appendChild(el('div', { class: 'scan-row' }, [el('span', { class: 'spinner' }), el('p', { text: 'Lese das Etikett …' })]));
    var prompt = 'Du siehst ein Foto einer Kaffeeverpackung oder eines Kaffee-Etiketts. Lies nur ab, was dort steht oder sich sicher daraus ergibt; ' +
      'erfinde nichts, Unbekanntes ist null. Antworte nur mit JSON in genau dieser Form: ' +
      '{"is_coffee": true, "roaster": string|null, "name": string|null, "origin": string|null (Land auf Deutsch), "region": string|null, ' +
      '"variety": string|null, "process": string|null (z. B. Gewaschen, Natural, Honey, Anaerob), "roast": "hell"|"mittel"|"dunkel"|null, ' +
      '"tasting_notes": [string] (Geschmacksnoten auf Deutsch, einzelne Wörter wie "Himbeere", "Schokolade")}';
    scanner.fn.json(prompt, { images: [file], modelTier: 'default' }).then(function (raw) {
      var r = T.parseScan(raw);
      if (!r.isCoffee) { toast('Das sieht nicht nach einer Kaffeetüte aus.'); renderScan(box); return; }
      ['roaster', 'name', 'origin', 'region', 'variety', 'process', 'roast'].forEach(function (k) { if (r[k]) draft[k] = r[k]; });
      if (r.notes) draft.roasterNotes = r.notes;
      r.aromas.forEach(function (a) { if (draft.aromas.indexOf(a) < 0) draft.aromas.push(a); });
      U.tick('major');
      toast('Etikett gelesen' + (r.aromas.length ? ' – ' + r.aromas.length + ' Aromen vorgemerkt' : '') + '.');
      renderFlow();
    }).catch(function (e) {
      var msg = {
        not_granted: 'Der Scan braucht deine Erlaubnis. Du kannst die Angaben auch selbst eintragen.',
        image_rejected: 'Das Foto konnte nicht gelesen werden. Versuch ein schärferes Bild als JPEG oder PNG.',
        rate_limited: 'Gerade zu viele Anfragen. Versuch es in einer Minute noch einmal.',
        invalid_json: 'Das Etikett war nicht eindeutig lesbar. Versuch ein anderes Foto.'
      }[e && e.code] || 'Der Scan hat nicht geklappt. Trag die Angaben einfach selbst ein.';
      if (e && (e.code === 'images_unavailable' || e.code === 'sampling_disabled')) scanner.fn = null;
      toast(msg);
      renderScan(box);
    });
  }

  function initScanner() {
    var claude = window.claude;
    if (!claude || typeof claude.use !== 'function') { scanner.checked = true; refreshScanCard(); return; }
    claude.use('sample').then(function (s) {
      if (!s) return null;
      return s.limits().then(function (l) {
        if (l && l.images) { scanner.fn = s; scanner.accept = l.images.mediaTypes.join(','); }
      }, function () {});
    }).catch(function () {}).then(function () { scanner.checked = true; refreshScanCard(); });
  }
  function refreshScanCard() { var b = $('#scan-card'); if (b) renderScan(b); }

  // ---------- step 2: aroma wheel ----------
  var wheelFocus = 0;
  function stepAromas(body) {
    var picked = {};
    draft.aromas.forEach(function (a) { picked[a] = true; });
    var fam = T.AROMA_FAMILIES[wheelFocus];
    var IN = 58, OUT = 140, DOTS = 152;
    var root = svg('svg', { viewBox: '-170 -170 340 340', class: 'aroma-wheel', role: 'group', 'aria-label': 'Aromarad' });
    T.AROMA_FAMILIES.forEach(function (f, i) {
      var a0 = i * SEG + 0.8, a1 = (i + 1) * SEG - 0.8, mid = (a0 + a1) / 2;
      var focused = i === wheelFocus;
      var off = polar(focused ? 7 : 0, mid);
      var count = f.aromas.filter(function (a) { return picked[a]; }).length;
      var g = svg('g', { class: 'aw-seg', role: 'button', tabindex: '0', 'aria-pressed': String(focused),
        'aria-label': f.name + (count ? ', ' + count + ' gewählt' : ''), transform: 'translate(' + off[0] + ' ' + off[1] + ')' });
      g.appendChild(svg('path', { d: sector(IN, OUT, a0, a1), class: 'aw-base' }));
      g.appendChild(svg('path', { d: sector(IN, OUT, a0, a1), fill: f.color, 'fill-opacity': focused ? 1 : count ? 0.45 : 0.16 }));
      var lp = polar((IN + OUT) / 2, mid);
      var flip = mid > 180;
      var t = svg('text', { x: lp[0], y: lp[1], 'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'aw-label' + (focused ? ' focused' : ''),
        transform: 'rotate(' + (flip ? mid + 90 : mid - 90) + ' ' + lp[0] + ' ' + lp[1] + ')' });
      t.textContent = f.name;
      g.appendChild(t);
      f.aromas.forEach(function (a, slot) {
        var ang = a0 + (slot + 1) * (a1 - a0) / (f.aromas.length + 1);
        var d = polar(DOTS, ang);
        g.appendChild(svg('circle', { cx: d[0], cy: d[1], r: picked[a] ? 4.5 : 2.5, fill: picked[a] ? f.color : 'var(--line)' }));
      });
      var go = function () { wheelFocus = i; U.tick('minor'); renderFlowBodyOnly(); };
      g.addEventListener('click', go);
      g.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } });
      root.appendChild(g);
    });
    root.appendChild(svg('circle', { r: IN - 6, class: 'aw-hub' }));
    var h1 = svg('text', { y: -4, 'text-anchor': 'middle', class: 'aw-hub-name' });
    h1.textContent = fam.name;
    var h2 = svg('text', { y: 16, 'text-anchor': 'middle', class: 'aw-hub-sub' });
    h2.textContent = draft.aromas.length ? draft.aromas.length + ' Aromen gewählt' : 'Familie antippen';
    root.appendChild(h1);
    root.appendChild(h2);
    body.appendChild(root);

    var grid = el('div', { class: 'aroma-grid' });
    fam.aromas.forEach(function (a) {
      var on = !!picked[a];
      grid.appendChild(el('button', { type: 'button', class: 'aroma-btn', 'aria-pressed': String(on),
        style: on ? 'background:' + fam.color + ';color:' + DARK_TEXT + ';border-color:transparent' : null,
        onclick: function () {
          var i = draft.aromas.indexOf(a);
          if (i >= 0) draft.aromas.splice(i, 1); else draft.aromas.push(a);
          U.tick(i >= 0 ? 'minor' : 'medium');
          renderFlowBodyOnly();
        } }, [el('i', { style: 'background:' + (on ? DARK_TEXT : fam.color) + ';opacity:' + (on ? 0.7 : 1) }), a]));
    });
    body.appendChild(grid);

    if (draft.aromas.length) {
      var chosen = el('div', { class: 'aroma-pills', 'aria-label': 'Gewählte Aromen' });
      draft.aromas.forEach(function (a) {
        chosen.appendChild(el('button', { type: 'button', class: 'aroma-pill', 'aria-label': a + ' entfernen',
          onclick: function () { draft.aromas.splice(draft.aromas.indexOf(a), 1); renderFlowBodyOnly(); } },
          [el('i', { style: 'background:' + T.AROMA_FAMILY[a].color }), a, el('span', { class: 'muted', text: '×' })]));
      });
      body.appendChild(chosen);
    }
  }
  function renderFlowBodyOnly() {
    var body = $('#rate-flow .flow-body');
    body.innerHTML = '';
    stepAromas(body);
  }

  // ---------- step 3: structure dials ----------
  var activeStruct = 'acidity';
  function stepStructure(body) {
    body.appendChild(el('p', { class: 'muted', text: 'Wische über das Rad. Nicht berührte Werte zählen nicht.' }));
    var tabs = el('div', { class: 'dial-tabs five', role: 'tablist', 'aria-label': 'Struktur' });
    var slot = el('div');
    function renderTabs() {
      tabs.innerHTML = '';
      T.STRUCTURE.forEach(function (s) {
        var v = draft.structure[s.id];
        tabs.appendChild(el('button', { type: 'button', class: 'dial-tab', role: 'tab', 'aria-selected': String(activeStruct === s.id), 'data-key': s.id,
          onclick: function () { activeStruct = s.id; U.tick('minor'); renderTabs(); mount(); } },
          [el('span', { text: s.label }), el('strong', { text: typeof v === 'number' ? fmt(v) : '–' })]));
      });
    }
    function mount() {
      var s = T.STRUCTURE.filter(function (x) { return x.id === activeStruct; })[0];
      var dial = window.TickDial({
        label: s.label, value: draft.structure[s.id], fallback: 5, min: 0, max: 10, step: 0.1, majorEvery: 1, mediumEvery: 0.5,
        describe: function (v, touched) { return touched ? T.describeStructure(s.id, v) : 'Wischen zum Einschätzen'; },
        onChange: function (v) {
          draft.structure[s.id] = Math.round(v * 10) / 10;
          var t = tabs.querySelector('[data-key="' + s.id + '"] strong');
          if (t) t.textContent = fmt(draft.structure[s.id]);
        }
      });
      slot.innerHTML = '';
      slot.appendChild(dial.el);
    }
    renderTabs();
    mount();
    body.appendChild(tabs);
    body.appendChild(slot);
  }

  // ---------- step 4: verdict ----------
  function stepVerdict(body) {
    var dial = window.TickDial({
      label: 'Wie gut schmeckt er dir?', value: draft.rating, fallback: 7, min: 0, max: 10, step: 0.5, majorEvery: 1,
      describe: function (v, touched) { return touched ? T.describeRating(v) : 'Wischen zum Bewerten'; },
      onChange: function (v) { draft.rating = v; }
    });
    body.appendChild(dial.el);
    var notes = el('textarea', { id: 'rf-notes', rows: 3, maxlength: 400, placeholder: 'Was ist dir aufgefallen? Mit Milch? Würdest du ihn wieder kaufen?' });
    notes.value = draft.notes || '';
    notes.addEventListener('input', function () { draft.notes = notes.value; });
    body.appendChild(el('label', { class: 'field', for: 'rf-notes' }, [el('span', { class: 'label', text: 'Notizen' }), notes]));
    body.appendChild(el('p', { class: 'muted', text: [draft.roaster, draft.name].filter(Boolean).join(' · ') + (draft.aromas.length ? ' · ' + draft.aromas.join(', ') : '') }));
  }

  function saveDraft() {
    if (typeof draft.rating !== 'number') { toast('Wische noch über das Bewertungsrad.'); return; }
    if (!draft.name && !draft.roaster) { stepIndex = 0; renderFlow(); toast('Gib dem Kaffee einen Namen oder eine Rösterei.'); return; }
    var isNew = !draft.id;
    if (isNew) { draft.id = uid(); draft.at = new Date().toISOString(); state.ratings.push(draft); }
    else {
      for (var i = 0; i < state.ratings.length; i++) if (state.ratings[i].id === draft.id) state.ratings[i] = draft;
    }
    App.save();
    U.tick('major');
    toast(isNew ? 'Bewertung gespeichert – dein Geschmacksrad ist gewachsen.' : 'Bewertung aktualisiert.');
    closeFlow();
    renderOverview(true);
    renderList();
    $('#flavor-wheel').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // =====================================================================
  // List of rated coffees
  // =====================================================================
  function hasExamples() { return state.ratings.some(function (r) { return r.example; }); }

  function renderList() {
    var box = $('#coffee-list');
    box.innerHTML = '';
    $('#examples-btn').textContent = hasExamples() ? 'Beispiele entfernen' : 'Beispielkaffees laden';
    if (!state.ratings.length) {
      box.appendChild(el('div', { class: 'empty-state' }, [
        el('p', { text: 'Noch keine Kaffees bewertet. Bewerte deinen ersten Kaffee oder lade fünf Beispielkaffees, um alles auszuprobieren.' })
      ]));
      return;
    }
    state.ratings.slice().sort(function (a, b) { return b.rating - a.rating; }).forEach(function (r, i) {
      var dots = el('div', { class: 'aroma-dots' });
      (r.aromas || []).slice(0, 8).forEach(function (a) { dots.appendChild(el('i', { title: a, style: 'background:' + T.AROMA_FAMILY[a].color })); });
      box.appendChild(el('article', { class: 'coffee-card', style: 'animation-delay:' + Math.min(i, 10) * 40 + 'ms' }, [
        el('div', { class: 'score', style: '--p:' + r.rating * 10 }, [el('span', { class: 'mono', text: fmt(r.rating) })]),
        el('div', { class: 'coffee-main' }, [
          el('h3', {}, [r.name || r.roaster, r.example ? el('span', { class: 'tag example-tag', text: 'Beispiel' }) : null]),
          el('div', { class: 'meta', text: [r.name ? r.roaster : '', r.origin, r.process, r.method].filter(Boolean).join(' · ') }),
          dots,
          r.notes ? el('p', { class: 'muted', text: r.notes }) : null,
          el('div', { class: 'row-actions' }, [
            el('button', { class: 'btn small ghost', type: 'button', onclick: function () { openFlow(r); } }, ['Bearbeiten']),
            el('button', { class: 'btn small ghost', type: 'button', onclick: function (ev) { removeRating(r.id, ev.currentTarget); } }, ['Löschen'])
          ])
        ])
      ]));
    });
  }
  function removeRating(id, btn) {
    if (btn.dataset.armed !== '1') {
      btn.dataset.armed = '1';
      btn.textContent = 'Wirklich löschen?';
      setTimeout(function () { if (btn.isConnected) { btn.dataset.armed = ''; btn.textContent = 'Löschen'; } }, 4000);
      return;
    }
    state.ratings = state.ratings.filter(function (r) { return r.id !== id; });
    App.state.ratings = state.ratings;
    App.save();
    renderOverview(false);
    renderList();
  }

  $('#rate-new').addEventListener('click', function () { openFlow(null); });

  // Load or remove the example ratings (only entries marked example: true).
  $('#examples-btn').addEventListener('click', function () {
    if (hasExamples()) {
      state.ratings = state.ratings.filter(function (r) { return !r.example; });
      toast('Beispiele entfernt. Deine eigenen Bewertungen bleiben.');
    } else {
      state.ratings = state.ratings.concat(T.exampleRatings());
      toast('5 Beispielkaffees geladen.');
    }
    App.state.ratings = state.ratings;
    App.save();
    U.tick('medium');
    focusFamily = null;
    renderOverview(true);
    renderList();
    $('#flavor-wheel').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  App.onView('taste', function () { renderOverview(true); renderList(); });
  initScanner();
})();
