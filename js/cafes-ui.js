/* Café finder view: search by place or location, map with pins, a swipe deck
   (right = go there, left = next), route choice, saved cafés and the full list. */
(function () {
  'use strict';

  var C = window.Cafes;
  var U = window.UI;
  var App = window.App;
  var $ = U.$, el = U.el, svg = U.svg, fmt = U.fmt, toast = U.toast;
  var state = App.state;
  state.cafes.liked = state.cafes.liked || [];
  if (state.cafes.open === undefined) state.cafes.open = true;

  var RADII = [1000, 2000, 5000, 10000];
  var LEAFLET = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/';
  var results = null;   // { origin, places, source }
  var deck = [];        // places in the swipe deck
  var deckIndex = 0;

  // ---------- search form ----------
  function renderRadiusChips() {
    var row = $('#radius-chips');
    row.innerHTML = '';
    RADII.forEach(function (r) {
      row.appendChild(el('button', {
        class: 'r-chip', type: 'button', role: 'radio', 'aria-checked': String(state.cafes.radius === r),
        onclick: function () { state.cafes.radius = r; App.save(); U.tick('minor'); renderRadiusChips(); }
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
    box.appendChild(el('div', { class: 'status-card' + (kind === 'note' ? ' note' : '') }, [
      el('div', {}, [
        el('p', { text: message }),
        kind === 'note' ? null : el('div', { class: 'link-row' }, [
          el('a', { class: 'btn small ghost', href: links.google, target: '_blank', rel: 'noopener' }, ['Google Maps', U.icon('external')]),
          el('a', { class: 'btn small ghost', href: links.europeanCoffeeTrip, target: '_blank', rel: 'noopener' }, ['European Coffee Trip', U.icon('external')]),
          el('a', { class: 'btn small ghost', href: links.osm, target: '_blank', rel: 'noopener' }, ['OpenStreetMap', U.icon('external')])
        ])
      ])
    ]));
  }

  function search(origin) {
    var key = state.cafes.googleKey;
    status('loading', 'Suche Cafés im Umkreis von ' + state.cafes.radius / 1000 + ' km um ' + origin.label + ' …');
    $('#cafe-results').hidden = true;
    var run = key
      ? C.findCafesGoogle(origin, state.cafes.radius, key).then(function (p) { return { places: p, source: 'google' }; }, function (e) {
          return C.findCafes(origin, state.cafes.radius).then(function (p) {
            return { places: p, source: 'osm', note: e.message + ' Ich zeige dir solange die Daten von OpenStreetMap.' };
          });
        })
      : C.findCafes(origin, state.cafes.radius).then(function (p) { return { places: p, source: 'osm' }; });
    return run.then(function (r) {
      results = { origin: origin, places: r.places, source: r.source };
      status(r.note ? 'note' : null, r.note || '');
      show();
    });
  }

  function fail(err, where) {
    var msg = err && err.message ? err.message : 'Die Suche hat nicht geklappt.';
    if (err instanceof TypeError) msg = 'Die Café-Daten konnten nicht geladen werden (keine Verbindung).';
    status('error', msg + ' Du kannst direkt auf einer Karte oder bei European Coffee Trip suchen:', where);
  }

  $('#cafe-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var q = $('#cafe-query').value.trim();
    if (!q) { $('#cafe-query').focus(); toast('Gib eine Stadt ein oder nutze „Mein Standort“.'); return; }
    state.cafes.query = q; App.save();
    status('loading', 'Suche „' + q + '“ …');
    C.geocode(q).then(search).catch(function (e) { fail(e, q); });
  });
  $('#cafe-locate').addEventListener('click', function () {
    status('loading', 'Bestimme deinen Standort …');
    C.locate().then(search).catch(function (e) { fail(e, ''); });
  });
  $('#cafe-specialty').addEventListener('change', function () { state.cafes.specialty = this.checked; App.save(); if (results) show(); });
  $('#cafe-open').addEventListener('change', function () { state.cafes.open = this.checked; App.save(); if (results) show(); });
  $('#google-key-save').addEventListener('click', function () {
    state.cafes.googleKey = $('#google-key').value.trim();
    App.save();
    toast(state.cafes.googleKey ? 'Schlüssel gespeichert. Die nächste Suche nutzt Google.' : 'Schlüssel entfernt. Gesucht wird mit OpenStreetMap.');
    if (results) search(results.origin).catch(function (e) { fail(e, results.origin.label); });
  });

  // ---------- filtering ----------
  function openInfo(p) {
    if (p.source === 'google') return p.open == null ? null : { open: p.open };
    return C.openState(p.hours);
  }
  function visiblePlaces() {
    var list = results.places.map(function (p) { p.openInfo = openInfo(p); return p; });
    if (state.cafes.open) list = list.filter(function (p) { return !p.openInfo || p.openInfo.open; });
    if (state.cafes.specialty) {
      var spec = list.filter(function (p) { return p.specialty; });
      if (spec.length) list = spec;
    }
    return list.slice().sort(function (a, b) {
      if (a.specialty !== b.specialty) return a.specialty ? -1 : 1;
      var ao = a.openInfo ? 0 : 1, bo = b.openInfo ? 0 : 1; // known hours first
      if (ao !== bo) return ao - bo;
      if (a.rating != null && b.rating != null && Math.abs(a.rating - b.rating) >= 0.2) return b.rating - a.rating;
      return a.distance - b.distance;
    });
  }

  function show() {
    var places = visiblePlaces();
    if (!places.length) {
      $('#cafe-results').hidden = true;
      var why = !results.places.length ? 'Im Umkreis von ' + state.cafes.radius / 1000 + ' km wurden keine Cafés gefunden.'
        : 'Gerade hat keins der gefundenen Cafés geöffnet.';
      status('error', why + ' Vergrößere den Umkreis, schalte „Nur geöffnet“ aus oder suche hier:', results.origin.label);
      return;
    }
    $('#cafe-results').hidden = false;
    deck = places.slice(0, 25);
    deckIndex = 0;
    renderDeck();
    renderMap(places);
    renderLiked();
    renderMoreLinks();
    renderList(places);
    $('#cafe-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function openText(p) {
    var o = p.openInfo;
    if (!o) return { text: 'Öffnungszeiten unbekannt', cls: 'unknown' };
    if (o.open) return { text: o.until ? 'Geöffnet · bis ' + o.until : 'Geöffnet', cls: 'open' };
    return { text: o.opens ? 'Geschlossen · öffnet ' + o.opens : 'Geschlossen', cls: 'closed' };
  }
  function stars(p) {
    if (p.rating == null) return null;
    return el('span', { class: 'stars', 'aria-label': fmt(p.rating) + ' von 5 Sternen' }, [
      el('b', { text: '★ ' + fmt(p.rating) }), p.ratingCount ? el('span', { text: ' (' + p.ratingCount + ')' }) : null
    ]);
  }
  function badges(p) {
    var b = [];
    if (p.roaster) b.push(el('span', { class: 'badge roast', text: 'Rösterei' }));
    if (p.specialty) b.push(el('span', { class: 'badge spec', text: 'Specialty' }));
    if (p.chain) b.push(el('span', { class: 'badge', text: 'Kette' }));
    return b;
  }
  function hue(name) {
    var h = 0;
    for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return h;
  }

  // ---------- swipe deck ----------
  function cardFor(p, depth) {
    var cover = p.photo
      ? el('img', { class: 'sc-photo', src: p.photo, alt: 'Foto von ' + p.name, loading: 'lazy', draggable: 'false' })
      : el('div', { class: 'sc-art', style: '--h:' + hue(p.name), 'aria-hidden': 'true' }, [
          el('span', { class: 'sc-initial', text: p.name.trim().charAt(0).toUpperCase() }), U.icon('espresso', 'sc-cup')
        ]);
    var o = openText(p);
    var card = el('article', { class: 'swipe-card', style: '--depth:' + depth, 'aria-label': p.name }, [
      el('div', { class: 'sc-cover' }, [
        cover,
        el('span', { class: 'stamp like', text: 'HIN!' }),
        el('span', { class: 'stamp nope', text: 'WEITER' }),
        el('div', { class: 'sc-badges' }, badges(p))
      ]),
      el('div', { class: 'sc-body' }, [
        el('h3', { text: p.name }),
        el('div', { class: 'sc-meta' }, [
          stars(p),
          el('span', { text: C.formatDistance(p.distance) + ' · ≈ ' + Math.max(1, Math.round(p.distance / 80)) + ' min zu Fuß' })
        ]),
        el('div', { class: 'sc-open ' + o.cls, text: o.text }),
        p.address ? el('div', { class: 'sc-addr', text: p.address }) : null
      ])
    ]);
    return card;
  }

  function renderDeck() {
    var box = $('#deck');
    box.innerHTML = '';
    var left = deck.length - deckIndex;
    $('#deck-count').textContent = left > 0 ? (deckIndex + 1) + ' von ' + deck.length : '';
    $('#deck-like').disabled = $('#deck-nope').disabled = left <= 0;
    if (left <= 0) {
      box.appendChild(el('div', { class: 'deck-end' }, [
        el('p', { class: 'fw-summary', text: 'Das waren alle ' + deck.length + ' Cafés.' }),
        el('div', { class: 'row-actions' }, [
          el('button', { class: 'btn small accent', type: 'button', onclick: function () { deckIndex = 0; renderDeck(); } }, ['Nochmal von vorn']),
          state.cafes.radius < 10000 ? el('button', { class: 'btn small ghost', type: 'button', onclick: function () {
            state.cafes.radius = RADII[Math.min(RADII.length - 1, RADII.indexOf(state.cafes.radius) + 1)];
            App.save(); renderRadiusChips();
            search(results.origin).catch(function (e) { fail(e, results.origin.label); });
          } }, ['Umkreis vergrößern']) : null
        ])
      ]));
      return;
    }
    // Draw the next cards underneath first, the top card last.
    for (var d = Math.min(2, left - 1); d >= 0; d--) {
      var card = cardFor(deck[deckIndex + d], d);
      if (d === 0) makeDraggable(card);
      box.appendChild(card);
    }
  }

  function makeDraggable(card) {
    var start = null, dx = 0, dy = 0, crossed = false;
    card.classList.add('top');
    card.tabIndex = 0;
    card.addEventListener('pointerdown', function (ev) {
      if (ev.button !== undefined && ev.button !== 0) return;
      start = { x: ev.clientX, y: ev.clientY };
      card.setPointerCapture(ev.pointerId);
      card.classList.add('dragging');
    });
    card.addEventListener('pointermove', function (ev) {
      if (!start) return;
      dx = ev.clientX - start.x; dy = ev.clientY - start.y;
      card.style.transform = 'translate(' + dx + 'px,' + dy * 0.25 + 'px) rotate(' + dx / 18 + 'deg)';
      card.style.setProperty('--like', Math.max(0, Math.min(1, dx / 110)));
      card.style.setProperty('--nope', Math.max(0, Math.min(1, -dx / 110)));
      var over = Math.abs(dx) > 110;
      if (over !== crossed) { crossed = over; U.tick(over ? 'medium' : 'minor'); }
    });
    function end() {
      if (!start) return;
      start = null;
      card.classList.remove('dragging');
      if (dx > 110) decide(true, card);
      else if (dx < -110) decide(false, card);
      else { card.style.transform = ''; card.style.setProperty('--like', 0); card.style.setProperty('--nope', 0); }
      dx = dy = 0; crossed = false;
    }
    card.addEventListener('pointerup', function () { U.releaseTick('medium'); end(); });
    card.addEventListener('pointercancel', end);
    card.addEventListener('keydown', function (ev) {
      if (ev.key === 'ArrowRight') decide(true, card);
      if (ev.key === 'ArrowLeft') decide(false, card);
    });
  }

  function decide(like, card) {
    card = card || $('#deck .swipe-card.top');
    if (!card || deckIndex >= deck.length) return;
    var place = deck[deckIndex];
    card.classList.add(like ? 'fly-right' : 'fly-left');
    card.style.setProperty(like ? '--like' : '--nope', 1);
    U.tick(like ? 'major' : 'minor');
    deckIndex++;
    setTimeout(function () {
      renderDeck();
      var next = $('#deck .swipe-card.top');
      if (next) next.focus({ preventScroll: true });
    }, 280);
    if (like) {
      remember(place);
      openRoute(place);
    }
  }
  $('#deck-like').addEventListener('click', function () { decide(true); });
  $('#deck-nope').addEventListener('click', function () { decide(false); });

  // ---------- route choice ----------
  var ROUTE_ICON = {
    walking: '<path d="M13 4a1.5 1.5 0 1 0 0-.01"/><path d="M10 21l2-6 3 3v3M9 12l2-4 4 2 2 3M11 8l-2 5"/>',
    bicycling: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9l3 7M14 5h2"/>',
    transit: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 21l2-4M16 21l-2-4"/><circle cx="9" cy="14" r=".6"/><circle cx="15" cy="14" r=".6"/>',
    driving: '<path d="M4 15l2-6h12l2 6v4H4z"/><path d="M4 15h16"/><circle cx="8" cy="17" r="1"/><circle cx="16" cy="17" r="1"/>'
  };
  function routeIcon(mode) {
    var wrap = document.createElement('span');
    wrap.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + ROUTE_ICON[mode] + '</svg>';
    return wrap.firstChild;
  }
  function openRoute(place) {
    var sheet = $('#route-sheet');
    sheet.innerHTML = '';
    var links = C.routeLinks(place);
    var panel = el('div', { class: 'route-panel' }, [
      el('div', { class: 'route-grab', 'aria-hidden': 'true' }),
      el('p', { class: 'eyebrow', text: 'Gemerkt' }),
      el('h2', { id: 'route-title', text: 'Wie willst du zu ' + place.name + '?' }),
      el('p', { class: 'muted', text: C.formatDistance(place.distance) + (place.address ? ' · ' + place.address : '') }),
      el('div', { class: 'route-grid' }, links.map(function (l) {
        return el('a', { class: 'route-opt', href: l.google, target: '_blank', rel: 'noopener', onclick: closeRoute }, [
          routeIcon(l.mode), el('strong', { text: l.label }), l.eta ? el('span', { text: l.eta }) : null
        ]);
      })),
      el('p', { class: 'muted route-apple' }, ['Lieber Apple Karten? ',
        el('a', { href: links[0].apple, target: '_blank', rel: 'noopener', text: 'Zu Fuß' }), ' · ',
        el('a', { href: links[3].apple, target: '_blank', rel: 'noopener', text: 'Auto' }), ' · ',
        el('a', { href: links[2].apple, target: '_blank', rel: 'noopener', text: 'ÖPNV' })]),
      el('button', { class: 'btn ghost', type: 'button', style: 'width:100%', onclick: closeRoute }, ['Später – weiter wischen'])
    ]);
    sheet.appendChild(el('div', { class: 'route-backdrop', onclick: closeRoute }));
    sheet.appendChild(panel);
    sheet.hidden = false;
    document.addEventListener('keydown', escRoute);
    var first = sheet.querySelector('.route-opt');
    if (first) first.focus({ preventScroll: true });
  }
  function closeRoute() {
    $('#route-sheet').hidden = true;
    document.removeEventListener('keydown', escRoute);
  }
  function escRoute(ev) { if (ev.key === 'Escape') closeRoute(); }

  // ---------- saved cafés ----------
  function remember(p) {
    state.cafes.liked = state.cafes.liked.filter(function (x) { return x.id !== p.id; });
    state.cafes.liked.unshift({ id: p.id, name: p.name, lat: p.lat, lon: p.lon, placeId: p.placeId || '', address: p.address,
      distance: p.distance, photo: p.photo || '', rating: p.rating, specialty: p.specialty });
    state.cafes.liked = state.cafes.liked.slice(0, 30);
    App.save();
    renderLiked();
  }
  function renderLiked() {
    var row = $('#liked-row');
    row.innerHTML = '';
    $('#liked-block').hidden = !state.cafes.liked.length;
    state.cafes.liked.forEach(function (p) {
      row.appendChild(el('div', { class: 'liked-card' }, [
        p.photo ? el('img', { src: p.photo, alt: '', loading: 'lazy' }) : el('div', { class: 'sc-art small', style: '--h:' + hue(p.name) }, [el('span', { class: 'sc-initial', text: p.name.charAt(0).toUpperCase() })]),
        el('div', { class: 'liked-body' }, [
          el('strong', { text: p.name }),
          el('span', { class: 'muted', text: p.rating != null ? '★ ' + fmt(p.rating) : (p.specialty ? 'Specialty' : '') }),
          el('div', { class: 'liked-actions' }, [
            el('button', { class: 'btn small accent', type: 'button', onclick: function () { openRoute(p); } }, ['Route']),
            el('button', { class: 'icon-btn light small', type: 'button', 'aria-label': p.name + ' entfernen', onclick: function () {
              state.cafes.liked = state.cafes.liked.filter(function (x) { return x.id !== p.id; });
              App.save(); renderLiked();
            } }, [U.icon('close')])
          ])
        ])
      ]));
    });
  }

  function renderMoreLinks() {
    var box = $('#more-links');
    var where = results.origin.label === 'Dein Standort' ? '' : results.origin.label.split(',')[0];
    var links = C.searchLinks(where);
    box.innerHTML = '';
    box.appendChild(el('p', { class: 'muted' }, ['Mehr Tipps' + (where ? ' für ' + where : '') + ': ',
      el('a', { href: links.europeanCoffeeTrip, target: '_blank', rel: 'noopener', text: 'European Coffee Trip' }), ' · ',
      el('a', { href: links.google, target: '_blank', rel: 'noopener', text: 'Google Maps' }),
      results.source === 'osm' ? ' · Daten: © OpenStreetMap-Mitwirkende' : ' · Fotos & Bewertungen: Google']));
  }

  // ---------- map (Leaflet, loaded on first use) ----------
  var leafletPromise = null, map = null, layer = null, markers = {};
  function loadLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise(function (resolve, reject) {
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = LEAFLET + 'leaflet.min.css';
      document.head.appendChild(css);
      var js = document.createElement('script');
      js.src = LEAFLET + 'leaflet.min.js';
      js.onload = function () { window.L ? resolve(window.L) : reject(new Error('Leaflet fehlt')); };
      js.onerror = function () { reject(new Error('Karte nicht verfügbar')); };
      document.head.appendChild(js);
      setTimeout(function () { reject(new Error('Karte lädt nicht')); }, 8000);
    });
    leafletPromise.catch(function () { leafletPromise = null; });
    return leafletPromise;
  }

  function renderMap(places) {
    var spec = places.filter(function (p) { return p.specialty; }).length;
    $('#map-caption').textContent = places.length + ' Cafés rund um ' + results.origin.label.split(',')[0] + (spec ? ' · ' + spec + ' Specialty' : '');
    loadLeaflet().then(function (L) {
      $('#cafe-map').hidden = false;
      $('#radar').hidden = true;
      if (!map) {
        map = L.map('cafe-map', { scrollWheelZoom: false });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);
        layer = L.layerGroup().addTo(map);
      }
      layer.clearLayers();
      markers = {};
      var o = results.origin;
      L.circleMarker([o.lat, o.lon], { radius: 7, color: '#fff', weight: 2, fillColor: '#2f9e6a', fillOpacity: 1 }).addTo(layer);
      L.circle([o.lat, o.lon], { radius: state.cafes.radius, color: '#2f9e6a', weight: 1, fillOpacity: 0.04 }).addTo(layer);
      var bounds = [[o.lat, o.lon]];
      places.slice(0, 60).forEach(function (p, i) {
        var icon = L.divIcon({ className: 'pin-wrap', html: '<span class="pin' + (p.specialty ? ' spec' : '') + '"><b>' + (i + 1) + '</b></span>', iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] });
        var popup = el('div', { class: 'pin-pop' }, [
          el('strong', { text: p.name }),
          el('span', { text: C.formatDistance(p.distance) + ' · ' + openText(p).text }),
          el('button', { class: 'btn small accent', type: 'button', onclick: function () { remember(p); openRoute(p); } }, ['Hin!'])
        ]);
        markers[p.id] = L.marker([p.lat, p.lon], { icon: icon, title: p.name }).bindPopup(popup).addTo(layer);
        bounds.push([p.lat, p.lon]);
      });
      map.invalidateSize();
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    }).catch(function () {
      // No map tiles (offline or blocked): show the radar instead.
      $('#cafe-map').hidden = true;
      $('#radar').hidden = false;
      renderRadar(places);
    });
  }

  function focusOnMap(p) {
    if (map && markers[p.id]) {
      map.setView([p.lat, p.lon], Math.max(map.getZoom(), 16));
      markers[p.id].openPopup();
      $('#map-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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
      var d = Math.min(1, p.distance / R), a = p.bearing * Math.PI / 180;
      var dot = svg('circle', { cx: Math.sin(a) * d, cy: -Math.cos(a) * d, r: p.specialty ? 0.04 : 0.028, class: 'r-dot ' + (p.specialty ? 'spec' : 'norm') });
      var title = svg('title');
      title.textContent = p.name + ' · ' + C.formatDistance(p.distance);
      dot.appendChild(title);
      root.appendChild(dot);
    });
  }

  // ---------- full list ----------
  function renderList(places) {
    var ol = $('#cafe-list');
    ol.innerHTML = '';
    places.slice(0, 60).forEach(function (p, i) {
      var o = openText(p);
      ol.appendChild(el('li', { class: 'cafe' + (p.specialty ? ' spec' : ''), 'data-id': p.id, style: 'animation-delay:' + Math.min(i, 12) * 35 + 'ms' }, [
        el('span', { class: 'rank', text: String(i + 1) }),
        el('div', {}, [
          el('h3', { text: p.name }),
          el('div', { class: 'meta' }, [stars(p), (p.rating != null ? ' · ' : '') + [C.formatDistance(p.distance), p.address].filter(Boolean).join(' · ')]),
          el('div', { class: 'badges' }, badges(p).concat([el('span', { class: 'badge open-' + o.cls, text: o.text })])),
          el('div', { class: 'links' }, [
            el('button', { class: 'btn small accent', type: 'button', onclick: function () { remember(p); openRoute(p); } }, ['Route']),
            map ? el('button', { class: 'btn small ghost', type: 'button', onclick: function () { focusOnMap(p); } }, ['Auf der Karte']) : null,
            p.website ? el('a', { class: 'btn small ghost', href: p.website, target: '_blank', rel: 'noopener' }, ['Website', U.icon('external')]) : null
          ])
        ])
      ]));
    });
  }

  App.onView('cafes', function () {
    renderRadiusChips();
    $('#cafe-specialty').checked = state.cafes.specialty !== false;
    $('#cafe-open').checked = state.cafes.open !== false;
    if (!$('#cafe-query').value) $('#cafe-query').value = state.cafes.query || '';
    $('#google-key').value = state.cafes.googleKey || '';
    if (map) setTimeout(function () { map.invalidateSize(); }, 50);
  });
})();
