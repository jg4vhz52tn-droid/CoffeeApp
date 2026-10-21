const test = require('node:test');
const assert = require('node:assert');
const B = require('../js/brew-data.js');
const C = require('../js/cafes.js');

test('every recipe has a known method, increasing step times and valid grind', () => {
  for (const r of B.RECIPES) {
    assert.ok(B.methodById(r.method), r.id + ' method');
    assert.ok(B.GRIND_SCALE.includes(r.grind), r.id + ' grind');
    for (let i = 1; i < r.steps.length; i++) assert.ok(r.steps[i].at >= r.steps[i - 1].at, r.id + ' step order');
  }
  for (const m of B.METHODS) assert.ok(B.recipesFor(m.id).length > 0, m.id + ' has recipes');
});

test('scaling doubles dose and amounts inside steps', () => {
  const r = B.recipeById('wac-2019');
  const s = B.scaleRecipe(r, 440);
  assert.strictEqual(s.dose, 60);
  assert.match(s.steps[1].detail, /200 g/);
  assert.match(s.steps[5].detail, /240 g/);
  assert.ok(!/\[\[/.test(s.steps.map(x => x.detail).join('')));
});

test('stepIndexAt and formatTime', () => {
  const r = B.recipeById('hoffmann-ultimate');
  assert.strictEqual(B.stepIndexAt(r, 0), 0);
  assert.strictEqual(r.steps[B.stepIndexAt(r, 121)].title, 'Schwenken');
  assert.strictEqual(B.formatTime(150), '2:30');
  assert.strictEqual(B.formatTime(64800), '18 h');
});

test('café classification prefers roasters and penalises chains', () => {
  assert.ok(C.classify({ name: 'Bonanza Coffee Roasters', craft: 'coffee_roaster' }).specialty);
  assert.ok(C.classify({ name: 'Kaffeebar Mitte', cuisine: 'coffee_shop' }).specialty);
  const sb = C.classify({ name: 'Starbucks', brand: 'Starbucks', cuisine: 'coffee_shop' });
  assert.ok(!sb.specialty && sb.chain);
  assert.ok(!C.classify({ name: 'Café Müller' }).specialty);
});

test('parsePlaces sorts specialty first, then distance, and dedupes', () => {
  const origin = { lat: 52.52, lon: 13.405 };
  const json = { elements: [
    { type: 'node', id: 1, lat: 52.521, lon: 13.405, tags: { name: 'Café Eck' } },
    { type: 'node', id: 2, lat: 52.53, lon: 13.405, tags: { name: 'Röstwerk', craft: 'coffee_roaster' } },
    { type: 'way', id: 3, center: { lat: 52.521, lon: 13.405 }, tags: { name: 'Café Eck' } },
    { type: 'node', id: 4, lat: 52.5, lon: 13.4, tags: {} }
  ] };
  const out = C.parsePlaces(json, origin);
  assert.deepStrictEqual(out.map(p => p.name), ['Röstwerk', 'Café Eck']);
  assert.ok(Math.abs(out[0].distance - 1112) < 20);
  assert.ok(out[0].bearing < 1 || out[0].bearing > 359);
});

test('overpass query contains radius and coordinates', () => {
  const q = C.buildQuery(48.137, 11.575, 2000);
  assert.match(q, /around:2000,48\.13700,11\.57500/);
  assert.match(q, /coffee_roaster/);
});

test('own recipe helpers: time parsing and editable amounts', () => {
  assert.strictEqual(B.parseTime('1:30'), 90);
  assert.strictEqual(B.parseTime('45'), 45);
  assert.strictEqual(B.parseTime('2.05'), 125);
  assert.ok(Number.isNaN(B.parseTime('bald')));
  const txt = B.toEditable('[[30]] Kaffee und [[12.5]] Wasser');
  assert.strictEqual(txt, '30 g Kaffee und 12,5 g Wasser');
  assert.strictEqual(B.fromEditable(txt), '[[30]] Kaffee und [[12.5]] Wasser');
  assert.strictEqual(B.fromEditable('bei 94 °C, 3 Tassen'), 'bei 94 °C, 3 Tassen');
});

test('normalizeCustom validates and sorts steps; result scales', () => {
  const r = B.normalizeCustom({ name: 'Mein V60', method: 'v60', dose: 20, water: 320, grind: 'fein',
    steps: [{ at: '1:00', title: 'Aufgießen', detail: 'Auf [[320]] gesamt' }, { at: '0:00', title: 'Bloom', detail: '[[60]] Wasser' }] });
  assert.strictEqual(r.custom, true);
  assert.deepStrictEqual(r.steps.map(s => s.at), [0, 60]);
  assert.match(B.scaleRecipe(r, 640).steps[0].detail, /120 g/);
  assert.throws(() => B.normalizeCustom({ name: '', method: 'v60', dose: 1, water: 1, steps: [{ at: 0, title: 'x' }] }), /Namen/);
  assert.throws(() => B.normalizeCustom({ name: 'x', method: 'v60', dose: 15, water: 250, steps: [{ at: 'irgendwann', title: 'x' }] }), /Zeit/);
  assert.throws(() => B.normalizeCustom({ name: 'x', method: 'teebeutel', dose: 15, water: 250, steps: [{ at: 0, title: 'x' }] }), /Brühmethode/);
});

test('opening hours: common OSM formats', () => {
  const at = (s) => new Date(s);
  const h = 'Mo-Fr 08:00-18:00; Sa 09:00-14:00; Su off';
  assert.deepStrictEqual(C.openState(h, at('2026-10-21T10:00:00')), { open: true, until: '18:00' }); // Wednesday
  assert.deepStrictEqual(C.openState(h, at('2026-10-21T07:30:00')), { open: false, opens: '08:00' });
  assert.deepStrictEqual(C.openState(h, at('2026-10-25T10:00:00')), { open: false, opens: null }); // Sunday
  assert.deepStrictEqual(C.openState('Fr-Sa 18:00-02:00', at('2026-10-24T01:00:00')), { open: true, until: '02:00' });
  assert.deepStrictEqual(C.openState('Mo,We 10:00-12:00,14:00-16:00', at('2026-10-21T15:00:00')), { open: true, until: '16:00' });
  assert.deepStrictEqual(C.openState('24/7'), { open: true, until: null });
  assert.strictEqual(C.openState('nach Vereinbarung'), null);
  assert.strictEqual(C.openState(''), null);
});

test('google places are parsed, filtered by radius and ranked', () => {
  const origin = { lat: 50.11, lon: 8.68 };
  const list = [
    { id: 'a', displayName: { text: 'Hoppenworth & Ploch' }, location: { latitude: 50.115, longitude: 8.68 }, rating: 4.7, userRatingCount: 900,
      types: ['coffee_shop', 'cafe'], photos: [{ name: 'places/a/photos/p1' }], currentOpeningHours: { openNow: true } },
    { id: 'b', displayName: { text: 'Starbucks' }, location: { latitude: 50.111, longitude: 8.68 }, rating: 4.1, userRatingCount: 2000, types: ['coffee_shop'] },
    { id: 'c', displayName: { text: 'Weit weg' }, location: { latitude: 51.0, longitude: 8.68 }, rating: 4.9, userRatingCount: 50 },
    { id: 'a', displayName: { text: 'Duplikat' }, location: { latitude: 50.115, longitude: 8.68 } }
  ];
  const out = C.parseGooglePlaces(list, origin, 'KEY', 2000);
  assert.deepStrictEqual(out.map(p => p.name), ['Hoppenworth & Ploch', 'Starbucks']);
  assert.strictEqual(out[0].specialty, true);
  assert.strictEqual(out[0].open, true);
  assert.match(out[0].photo, /places\/a\/photos\/p1\/media\?maxWidthPx=800&key=KEY/);
  assert.strictEqual(out[1].specialty, false);
});

test('route links cover four ways to travel', () => {
  const links = C.routeLinks({ lat: 50.1, lon: 8.6, distance: 800, placeId: 'xyz' });
  assert.deepStrictEqual(links.map(l => l.mode), ['walking', 'bicycling', 'transit', 'driving']);
  assert.match(links[0].google, /travelmode=walking/);
  assert.match(links[0].google, /destination_place_id=xyz/);
  assert.strictEqual(links[0].eta, '≈ 10 min');
});

test('wide radius only asks for likely specialty cafés', () => {
  assert.match(C.buildQuery(50.1, 8.6, 1000), /nwr\["amenity"="cafe"\]\(around/);
  assert.doesNotMatch(C.buildQuery(50.1, 8.6, 10000), /nwr\["amenity"="cafe"\]\(around/);
  assert.match(C.buildQuery(50.1, 8.6, 10000), /cuisine/);
});
