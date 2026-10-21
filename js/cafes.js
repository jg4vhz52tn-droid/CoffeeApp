/*
 * Café finder: OpenStreetMap data via Nominatim (place search) and
 * Overpass (cafés around a point). Pure helpers are exported for tests.
 */
(function (root) {
  'use strict';

  var OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
  var NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

  var CHAINS = /starbucks|tchibo|mccaf|coffee fellows|balzac|costa coffee|dunkin|einstein kaffee|segafredo|caffè nero|caffe nero|tim hortons|black sheep|back-factory|backwerk|kamps|ditsch|subway|mcdonald/i;
  var BAKERY = /bäckerei|baeckerei|backhaus|konditorei|bakery/i;
  var SPECIALTY_NAME = /specialty|speciality|rösterei|roesterei|röster|roaster|roastery|rösthaus|kaffeebar|espresso ?bar|brew ?bar|third wave|coffee lab|kaffeelabor|filterkaffee|slow coffee/i;

  function toRad(d) { return d * Math.PI / 180; }

  /** Great-circle distance in metres. */
  function distance(a, b) {
    var R = 6371000;
    var dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  /** Bearing in degrees (0 = north, clockwise). */
  function bearing(a, b) {
    var y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
    var x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
      Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  /**
   * Up to 3 km every café is fetched. Beyond that a big city has thousands,
   * so only the likely specialty places come back (roasters, coffee shops,
   * telling names).
   */
  function buildQuery(lat, lon, radius) {
    var around = '(around:' + Math.round(radius) + ',' + lat.toFixed(5) + ',' + lon.toFixed(5) + ')';
    var cafes = radius <= 3000
      ? 'nwr["amenity"="cafe"]' + around + ';'
      : 'nwr["amenity"="cafe"]["cuisine"~"coffee"]' + around + ';' +
        'nwr["amenity"="cafe"]["name"~"' + SPECIALTY_NAME.source.replace(/\\/g, '') + '",i]' + around + ';';
    return '[out:json][timeout:25];(' + cafes +
      'nwr["shop"="coffee"]' + around + ';' +
      'nwr["craft"="coffee_roaster"]' + around + ';' +
      ');out center tags 300;';
  }

  // ---------- opening hours (OpenStreetMap "opening_hours") ----------
  var DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  function dayIndex(d) { return DAYS.indexOf(d); }
  function minutes(hhmm) { var m = hhmm.match(/^(\d{1,2}):(\d{2})$/); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; }

  /** Parses the common forms, e.g. "Mo-Fr 08:00-18:00; Sa 09:00-14:00; Su off". Returns rules or null. */
  function parseHours(str) {
    if (!str || typeof str !== 'string') return null;
    str = str.trim();
    if (str === '24/7') return [{ days: [0, 1, 2, 3, 4, 5, 6], spans: [[0, 1440]] }];
    var rules = [];
    var parts = str.split(';');
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i].trim();
      if (!part) continue;
      if (/^(PH|SH)\b/.test(part)) continue; // holidays: ignored
      var m = part.match(/^((?:[A-Z][a-z](?:-[A-Z][a-z])?)(?:,(?:[A-Z][a-z](?:-[A-Z][a-z])?))*)?(?:,PH)?\s*(.*)$/);
      if (!m) return null;
      var days = [];
      if (m[1]) {
        var ok = m[1].split(',').every(function (seg) {
          var r = seg.split('-'), a = dayIndex(r[0]), b = r[1] ? dayIndex(r[1]) : a;
          if (a < 0 || b < 0) return false;
          for (var d = a; ; d = (d + 1) % 7) { days.push(d); if (d === b) break; }
          return true;
        });
        if (!ok) return null;
      } else days = [0, 1, 2, 3, 4, 5, 6];
      var times = m[2].trim();
      if (/^(off|closed)$/i.test(times)) { rules.push({ days: days, spans: [] }); continue; }
      var spans = [];
      var okT = times.split(',').every(function (t) {
        var r = t.trim().match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\+?$/);
        if (!r) return false;
        var a = minutes(r[1]), b = minutes(r[2]);
        if (isNaN(a) || isNaN(b)) return false;
        spans.push([a, b <= a ? b + 1440 : b]);
        return true;
      });
      if (!okT || !spans.length) return null;
      rules.push({ days: days, spans: spans });
    }
    return rules.length ? rules : null;
  }

  function spansFor(rules, day) {
    var spans = null;
    rules.forEach(function (r) { if (r.days.indexOf(day) >= 0) spans = r.spans; }); // later rules win
    return spans || [];
  }

  /**
   * { open: true, until: '18:00' } (until null = open around the clock) | { open: false, opens: '09:00' } | null (unknown).
   * date defaults to now; uses local time.
   */
  function openState(str, date) {
    var rules = parseHours(str);
    if (!rules) return null;
    date = date || new Date();
    var day = (date.getDay() + 6) % 7; // Monday = 0
    var now = date.getHours() * 60 + date.getMinutes();
    var fmt = function (m) { m = m % 1440; var h = Math.floor(m / 60), mm = m % 60; return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm; };
    var today = spansFor(rules, day), yesterday = spansFor(rules, (day + 6) % 7);
    for (var i = 0; i < yesterday.length; i++) {
      if (yesterday[i][1] > 1440 && now < yesterday[i][1] - 1440) return { open: true, until: fmt(yesterday[i][1]) };
    }
    for (var j = 0; j < today.length; j++) {
      if (now >= today[j][0] && now < today[j][1]) {
        return today[j][0] === 0 && today[j][1] >= 1440 ? { open: true, until: null } : { open: true, until: fmt(today[j][1]) };
      }
    }
    var later = today.filter(function (sp) { return sp[0] > now; }).sort(function (a, b) { return a[0] - b[0]; })[0];
    return { open: false, opens: later ? fmt(later[0]) : null };
  }

  /**
   * Scores how likely a place is a specialty coffee spot.
   * Returns { score, specialty, chain, reasons[] }.
   */
  function classify(tags) {
    tags = tags || {};
    var name = tags.name || '';
    var score = 0, reasons = [];
    var chain = !!(tags.brand || tags['brand:wikidata']) || CHAINS.test(name);
    if (chain) { score -= 3; reasons.push('Kette'); }
    if (BAKERY.test(name) || tags.shop === 'bakery') { score -= 2; reasons.push('Bäckerei'); }
    if (tags.craft === 'coffee_roaster') { score += 3; reasons.push('Rösterei'); }
    if (tags.shop === 'coffee') { score += 2; reasons.push('Kaffeeladen'); }
    if (SPECIALTY_NAME.test(name)) { score += 2; reasons.push('Name'); }
    if (/coffee_shop/.test(tags.cuisine || '')) { score += 1; reasons.push('Coffee-Shop'); }
    if (tags['diet:vegan'] === 'yes' || tags['diet:vegan'] === 'only') score += 0.5;
    if (/specialty|speciality/i.test((tags.description || '') + ' ' + (tags.coffee || '') + ' ' + (tags['coffee:speciality'] || ''))) {
      score += 3; reasons.push('Specialty');
    }
    return { score: score, specialty: score >= 2, chain: chain, reasons: reasons };
  }

  /** Turns an Overpass response into sorted place objects. */
  function parsePlaces(json, origin) {
    var seen = {};
    var out = [];
    (json && json.elements || []).forEach(function (e) {
      var lat = e.lat != null ? e.lat : e.center && e.center.lat;
      var lon = e.lon != null ? e.lon : e.center && e.center.lon;
      var t = e.tags || {};
      if (lat == null || !t.name) return;
      var key = t.name.toLowerCase() + '|' + lat.toFixed(3) + '|' + lon.toFixed(3);
      if (seen[key]) return;
      seen[key] = true;
      var c = classify(t);
      var p = { lat: lat, lon: lon };
      var addr = [t['addr:street'] && (t['addr:street'] + (t['addr:housenumber'] ? ' ' + t['addr:housenumber'] : '')), t['addr:city']]
        .filter(Boolean).join(', ');
      out.push({
        id: e.type + '/' + e.id,
        name: t.name,
        lat: lat, lon: lon,
        address: addr,
        hours: t.opening_hours || '',
        photo: '', rating: null, ratingCount: 0, source: 'osm',
        website: t.website || t['contact:website'] || '',
        roaster: t.craft === 'coffee_roaster',
        score: c.score, specialty: c.specialty, chain: c.chain, reasons: c.reasons,
        distance: origin ? distance(origin, p) : 0,
        bearing: origin ? bearing(origin, p) : 0
      });
    });
    out.sort(function (a, b) {
      if (a.specialty !== b.specialty) return a.specialty ? -1 : 1;
      return a.distance - b.distance;
    });
    return out;
  }

  function formatDistance(m) {
    return m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1).replace('.', ',') + ' km';
  }

  function mapsLink(place) {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place.name + ' ' + place.lat + ',' + place.lon);
  }
  function osmLink(place) {
    return 'https://www.openstreetmap.org/' + place.id;
  }
  function searchLinks(where) {
    var q = encodeURIComponent('specialty coffee ' + (where || ''));
    return {
      google: 'https://www.google.com/maps/search/' + q,
      osm: 'https://www.openstreetmap.org/search?query=' + encodeURIComponent('cafe ' + (where || '')),
      europeanCoffeeTrip: 'https://europeancoffeetrip.com/?s=' + encodeURIComponent(where || '')
    };
  }

  // ---------- Google Places (optional, needs the user's API key) ----------
  var PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
  var PLACES_FIELDS = ['places.id', 'places.displayName', 'places.location', 'places.rating', 'places.userRatingCount',
    'places.photos', 'places.currentOpeningHours.openNow', 'places.formattedAddress', 'places.googleMapsUri',
    'places.websiteUri', 'places.primaryType', 'places.types'].join(',');

  function googlePhotoUrl(name, key) {
    return 'https://places.googleapis.com/v1/' + name + '/media?maxWidthPx=800&key=' + encodeURIComponent(key);
  }

  /** Turns Places API (New) results into the same place objects as parsePlaces. */
  function parseGooglePlaces(list, origin, key, radius) {
    var seen = {};
    var out = [];
    (list || []).forEach(function (g) {
      if (!g || !g.location || seen[g.id]) return;
      seen[g.id] = true;
      var name = g.displayName && g.displayName.text || '';
      var p = { lat: g.location.latitude, lon: g.location.longitude };
      var d = origin ? distance(origin, p) : 0;
      if (radius && d > radius * 1.15) return;
      var tags = { name: name };
      if ((g.types || []).indexOf('coffee_shop') >= 0) tags.cuisine = 'coffee_shop';
      var c = classify(tags);
      var rating = typeof g.rating === 'number' ? g.rating : null;
      // A well-rated coffee shop found by a "specialty coffee" search counts as specialty.
      var specialty = c.specialty || (!c.chain && rating != null && rating >= 4.5 && (g.userRatingCount || 0) >= 30);
      out.push({
        id: 'google/' + g.id, name: name, lat: p.lat, lon: p.lon,
        address: g.formattedAddress || '', hours: '',
        open: g.currentOpeningHours && typeof g.currentOpeningHours.openNow === 'boolean' ? g.currentOpeningHours.openNow : null,
        website: g.websiteUri || '', mapsUri: g.googleMapsUri || '', placeId: g.id,
        photo: g.photos && g.photos[0] && key ? googlePhotoUrl(g.photos[0].name, key) : '',
        rating: rating, ratingCount: g.userRatingCount || 0, source: 'google',
        roaster: /roast|röst/i.test(name), score: c.score, specialty: specialty, chain: c.chain, reasons: c.reasons,
        distance: d, bearing: origin ? bearing(origin, p) : 0
      });
    });
    out.sort(function (a, b) {
      if (a.specialty !== b.specialty) return a.specialty ? -1 : 1;
      return a.distance - b.distance;
    });
    return out;
  }

  function findCafesGoogle(origin, radius, key) {
    var query = function (text) {
      return fetch(PLACES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': PLACES_FIELDS },
        body: JSON.stringify({
          textQuery: text, languageCode: 'de', maxResultCount: 20,
          locationBias: { circle: { center: { latitude: origin.lat, longitude: origin.lon }, radius: Math.min(radius, 50000) } }
        })
      }).then(function (r) {
        if (!r.ok) throw new Error(r.status === 403 || r.status === 400 ? 'Der Google-Schlüssel wurde abgelehnt. Prüfe ihn und ob die „Places API (New)“ aktiviert ist.' : 'Google-Suche fehlgeschlagen (' + r.status + ').');
        return r.json();
      }).then(function (j) { return j.places || []; });
    };
    return Promise.all([query('specialty coffee'), query('Kaffeerösterei Café')]).then(function (res) {
      return parseGooglePlaces(res[0].concat(res[1]), origin, key, radius);
    });
  }

  /** Directions in Google Maps and Apple Maps for each way of getting there. */
  function routeLinks(place) {
    var dest = place.lat + ',' + place.lon;
    var g = function (mode) {
      return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(dest) +
        (place.placeId ? '&destination_place_id=' + encodeURIComponent(place.placeId) : '') + '&travelmode=' + mode;
    };
    var a = function (flag) { return 'https://maps.apple.com/?daddr=' + encodeURIComponent(dest) + '&dirflg=' + flag; };
    var walk = Math.max(1, Math.round(place.distance / 80)), bike = Math.max(1, Math.round(place.distance / 250));
    return [
      { mode: 'walking', label: 'Zu Fuß', eta: '≈ ' + walk + ' min', google: g('walking'), apple: a('w') },
      { mode: 'bicycling', label: 'Fahrrad', eta: '≈ ' + bike + ' min', google: g('bicycling'), apple: a('w') },
      { mode: 'transit', label: 'Bus & Bahn', eta: '', google: g('transit'), apple: a('r') },
      { mode: 'driving', label: 'Auto', eta: '', google: g('driving'), apple: a('d') }
    ];
  }

  // ---------- network ----------
  function geocode(q) {
    var url = NOMINATIM_URL + '?format=json&limit=1&accept-language=de&q=' + encodeURIComponent(q);
    return fetch(url, { headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error('Ortssuche fehlgeschlagen (' + r.status + ')'); return r.json(); })
      .then(function (list) {
        if (!list.length) throw new Error('Ort „' + q + '“ nicht gefunden.');
        return { lat: Number(list[0].lat), lon: Number(list[0].lon), label: list[0].display_name.split(',').slice(0, 2).join(',') };
      });
  }

  function findCafes(origin, radius) {
    return fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(buildQuery(origin.lat, origin.lon, radius))
    })
      .then(function (r) { if (!r.ok) throw new Error('Café-Suche fehlgeschlagen (' + r.status + ')'); return r.json(); })
      .then(function (json) { return parsePlaces(json, origin); });
  }

  function locate() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) return reject(new Error('Standort wird von diesem Browser nicht unterstützt.'));
      navigator.geolocation.getCurrentPosition(
        function (pos) { resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, label: 'Dein Standort' }); },
        function () { reject(new Error('Standort nicht verfügbar. Gib stattdessen eine Stadt oder Adresse ein.')); },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    });
  }

  var api = {
    distance: distance, bearing: bearing, buildQuery: buildQuery, classify: classify,
    parsePlaces: parsePlaces, formatDistance: formatDistance, mapsLink: mapsLink, osmLink: osmLink,
    searchLinks: searchLinks, geocode: geocode, findCafes: findCafes, locate: locate,
    parseHours: parseHours, openState: openState, parseGooglePlaces: parseGooglePlaces,
    findCafesGoogle: findCafesGoogle, routeLinks: routeLinks
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cafes = api;
})(this);
