/* Café finder view: place search or geolocation, radar plot and result list. */
(function () {
  'use strict';

  var C = window.Cafes;
  var U = window.UI;
  var App = window.App;
  var $ = U.$, el = U.el, svg = U.svg;
  var state = App.state;

  var RADII = [1000, 2000, 5000];
  var results = null; // { origin, places }
  var activeId = null;

  function renderRadiusChips() {
    var row = $('#radius-chips');
    row.innerHTML = '';
    RADII.forEach(function (r) {
      row.appendChild(el('button', {
        class: 'r-chip', type: 'button', role: 'radio', 'aria-checked': String(state.cafes.radius === r),
        onclick: function () {
          state.cafes.radius = r; App.save(); renderRadiusChips();
          if (results) search(results.origin);
        }
      }, [r / 1000 + ' km']));
    });
  }

  function status(kind, message, where) {
    var box = $('#cafe-status');
    box.innerHTML = '';
    if (!kind) return;
    if (kind === 'loading') {
      box.appendChild(el('div', { class: 'status-card' }, [el('span', { class: 'spinner' }), el('p', { text: message })]));
      return;
    }
    var links = C.searchLinks(where);
    box.appendChild(el('div', { class: 'status-card' }, [
      el('div', {}, [
        el('p', { text: message }),
        el('div', { class: 'link-row' }, [
          el('a', { class: 'btn small ghost', href: links.google, target: '_blank', rel: 'noopener' }, ['Google Maps', U.icon('external')]),
          el('a', { class: 'btn small ghost', href: links.osm, target: '_blank', rel: 'noopener' }, ['OpenStreetMap', U.icon('external')]),
          el('a', { class: 'btn small ghost', href: links.europeanCoffeeTrip, target: '_blank', rel: 'noopener' }, ['European Coffee Trip', U.icon('external')])
        ])
      ])
    ]));
  }

  function search(origin) {
    status('loading', 'Suche Cafés rund um ' + origin.label + ' …');
    $('#cafe-layout').hidden = true;
    return C.findCafes(origin, state.cafes.radius).then(function (places) {
      results = { origin: origin, places: places };
      activeId = null;
      status(null);
      render();
    });
  }

  function fail(err, where) {
    var msg = err && err.message ? err.message : 'Die Suche hat nicht geklappt.';
    if (err instanceof TypeError) msg = 'Die Café-Daten konnten nicht geladen werden (keine Verbindung zu OpenStreetMap).';
    status('error', msg + ' Du kannst direkt auf einer Karte suchen:', where);
  }

  $('#cafe-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var q = $('#cafe-query').value.trim();
    if (!q) { $('#cafe-query').focus(); return; }
    state.cafes.query = q; App.save();
    status('loading', 'Suche „' + q + '“ …');
    C.geocode(q).then(search).catch(function (e) { fail(e, q); });
  });

  $('#cafe-locate').addEventListener('click', function () {
    status('loading', 'Bestimme deinen Standort …');
    C.locate().then(search).catch(function (e) { fail(e, ''); });
  });

  $('#cafe-specialty').addEventListener('change', function () {
    state.cafes.specialty = this.checked; App.save();
    if (results) render();
  });

  function visiblePlaces() {
    if (!results) return [];
    var list = results.places;
    if (state.cafes.specialty) {
      var spec = list.filter(function (p) { return p.specialty; });
      if (spec.length) return spec;
    }
    return list;
  }

  function render() {
    var places = visiblePlaces();
    var layout = $('#cafe-layout');
    if (!results.places.length) {
      layout.hidden = true;
      status('error', 'Im Umkreis von ' + state.cafes.radius / 1000 + ' km wurden keine Cafés gefunden. Vergrößere den Umkreis oder suche auf einer Karte:', results.origin.label);
      return;
    }
    if (state.cafes.specialty && !results.places.some(function (p) { return p.specialty; })) {
      status('error', 'Keine eindeutigen Specialty-Cafés gefunden – hier sind alle Cafés im Umkreis. Weitere Tipps:', results.origin.label);
    }
    layout.hidden = false;
    renderRadar(places);
    renderList(places);
  }

  function renderRadar(places) {
    var root = $('#radar');
    root.innerHTML = '';
    var R = state.cafes.radius;
    root.appendChild(svg('defs', {}, [
      svg('linearGradient', { id: 'sweepGrad', x1: '0', y1: '0', x2: '1', y2: '0' }, [
        svg('stop', { offset: '0', 'stop-color': 'var(--zone)', 'stop-opacity': '0' }),
        svg('stop', { offset: '1', 'stop-color': 'var(--zone)', 'stop-opacity': '.28' })
      ])
    ]));
    root.appendChild(svg('path', { d: 'M0 0 L0 -1 A1 1 0 0 1 0.6 -0.8 Z', class: 'r-sweep' }));
    [1 / 3, 2 / 3, 1].forEach(function (f) {
      root.appendChild(svg('circle', { cx: 0, cy: 0, r: f, class: 'r-ring' }));
      var t = svg('text', { x: 0.02, y: -f + 0.06, class: 'r-label' });
      t.textContent = C.formatDistance(R * f);
      root.appendChild(t);
    });
    var n = svg('text', { x: 0, y: -1.06, class: 'r-n' });
    n.textContent = 'N';
    root.appendChild(n);
    root.appendChild(svg('circle', { cx: 0, cy: 0, r: 0.035, class: 'r-me' }));

    places.forEach(function (p) {
      var d = Math.min(1, p.distance / R);
      var a = p.bearing * Math.PI / 180;
      var dot = svg('circle', {
        cx: Math.sin(a) * d, cy: -Math.cos(a) * d, r: p.specialty ? 0.04 : 0.028,
        class: 'r-dot ' + (p.specialty ? 'spec' : 'norm') + (activeId === p.id ? ' active' : ''),
        'data-id': p.id, tabindex: '0', role: 'button', 'aria-label': p.name
      });
      dot.appendChild(svg('title', {}, []));
      dot.firstChild.textContent = p.name + ' · ' + C.formatDistance(p.distance);
      dot.addEventListener('click', function () { setActive(p.id, true); });
      dot.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') setActive(p.id, true); });
      root.appendChild(dot);
    });
    var specCount = places.filter(function (p) { return p.specialty; }).length;
    $('#radar-caption').textContent = places.length + ' Orte rund um ' + results.origin.label + (specCount ? ' · ' + specCount + ' Specialty (orange)' : '');
  }

  function renderList(places) {
    var ol = $('#cafe-list');
    ol.innerHTML = '';
    places.slice(0, 40).forEach(function (p, i) {
      var badges = [];
      if (p.roaster) badges.push(el('span', { class: 'badge roast', text: 'Rösterei' }));
      if (p.specialty) badges.push(el('span', { class: 'badge spec', text: 'Specialty' }));
      if (p.chain) badges.push(el('span', { class: 'badge', text: 'Kette' }));
      var li = el('li', {
        class: 'cafe' + (p.specialty ? ' spec' : '') + (activeId === p.id ? ' active' : ''), 'data-id': p.id,
        style: 'animation-delay:' + Math.min(i, 12) * 35 + 'ms',
        onclick: function (ev) { if (ev.target.closest('a')) return; setActive(p.id, false); }
      }, [
        el('span', { class: 'rank', text: String(i + 1) }),
        el('div', {}, [
          el('h3', { text: p.name }),
          el('div', { class: 'meta', text: [C.formatDistance(p.distance), p.address].filter(Boolean).join(' · ') }),
          badges.length ? el('div', { class: 'badges' }, badges) : null,
          p.hours ? el('div', { class: 'meta', text: 'Öffnungszeiten: ' + p.hours }) : null,
          el('div', { class: 'links' }, [
            el('a', { class: 'btn small ghost', href: C.mapsLink(p), target: '_blank', rel: 'noopener' }, ['Route', U.icon('external')]),
            p.website ? el('a', { class: 'btn small ghost', href: p.website, target: '_blank', rel: 'noopener' }, ['Website', U.icon('external')]) : null,
            el('a', { class: 'btn small ghost', href: C.osmLink(p), target: '_blank', rel: 'noopener' }, ['OSM'])
          ])
        ])
      ]);
      ol.appendChild(li);
    });
  }

  function setActive(id, scrollList) {
    activeId = id;
    Array.prototype.forEach.call(document.querySelectorAll('.r-dot'), function (d) { d.classList.toggle('active', d.getAttribute('data-id') === id); });
    Array.prototype.forEach.call(document.querySelectorAll('.cafe'), function (c) { c.classList.toggle('active', c.getAttribute('data-id') === id); });
    if (scrollList) {
      var li = document.querySelector('.cafe[data-id="' + id + '"]');
      if (li) li.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  App.onView('cafes', function () {
    renderRadiusChips();
    $('#cafe-specialty').checked = state.cafes.specialty !== false;
    if (!$('#cafe-query').value) $('#cafe-query').value = state.cafes.query || '';
  });
})();
