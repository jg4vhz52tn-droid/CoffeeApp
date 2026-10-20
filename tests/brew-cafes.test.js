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
