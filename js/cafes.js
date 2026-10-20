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

  function buildQuery(lat, lon, radius) {
    var around = '(around:' + Math.round(radius) + ',' + lat.toFixed(5) + ',' + lon.toFixed(5) + ')';
    return '[out:json][timeout:25];(' +
      'nwr["amenity"="cafe"]' + around + ';' +
      'nwr["shop"="coffee"]' + around + ';' +
      'nwr["craft"="coffee_roaster"]' + around + ';' +
      ');out center tags 200;';
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
    searchLinks: searchLinks, geocode: geocode, findCafes: findCafes, locate: locate
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Cafes = api;
})(this);
