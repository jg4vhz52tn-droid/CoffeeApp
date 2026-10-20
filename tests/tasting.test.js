const test = require('node:test');
const assert = require('node:assert');
const T = require('../js/tasting-data.js');

const ratings = [
  { rating: 9, aromas: ['Himbeere', 'Jasmin'], origin: 'Äthiopien', process: 'Gewaschen', structure: { acidity: 7, body: 4, sweetness: 7 } },
  { rating: 8.5, aromas: ['Brombeere', 'Honig'], origin: 'Kenia', process: 'Gewaschen', structure: { acidity: 8, body: 5, sweetness: 6 } },
  { rating: 4, aromas: ['Zartbitter', 'Rauch'], origin: 'Brasilien', process: 'Natural', structure: { acidity: 2, body: 8, sweetness: 3 } },
  { rating: 6, aromas: ['Haselnuss', 'Karamell'], origin: 'Brasilien', process: 'Natural', structure: { acidity: 3, body: 7, sweetness: 6 } }
];

test('every aroma belongs to exactly one family', () => {
  const all = T.AROMA_FAMILIES.flatMap(f => f.aromas);
  assert.strictEqual(new Set(all).size, all.length);
  for (const a of all) assert.ok(T.AROMA_FAMILY[a]);
});

test('profile ranks families by how much the coffees were liked', () => {
  const p = T.profile(ratings);
  assert.strictEqual(p.count, 4);
  assert.strictEqual(p.topFamily.id, 'beeren');
  const beeren = p.families.find(f => f.id === 'beeren');
  assert.strictEqual(beeren.n, 2);
  assert.strictEqual(beeren.avg, 8.75);
  assert.strictEqual(p.families.find(f => f.id === 'tropisch').avg, null);
  assert.deepStrictEqual(p.favoriteAromas.slice(0, 2).sort(), ['Himbeere', 'Jasmin'].sort());
  assert.ok(!p.favoriteAromas.includes('Rauch'));
});

test('sweet spot uses the better half of the coffees', () => {
  const p = T.profile(ratings);
  assert.strictEqual(p.structure.acidity.value, 7.5);
  assert.strictEqual(p.origins[0].name, 'Äthiopien');
  assert.strictEqual(p.processes[0].name, 'Gewaschen');
});

test('summary reads naturally', () => {
  const s = T.summary(T.profile(ratings));
  assert.match(s, /Noten aus „Beerig“/);
  assert.match(s, /helle Säure und einen mittleren Körper/);
  assert.strictEqual(T.summary(T.profile([])), '');
});

test('describe helpers', () => {
  assert.strictEqual(T.describeStructure('acidity', 0), 'flach');
  assert.strictEqual(T.describeStructure('acidity', 10), 'spritzig');
  assert.strictEqual(T.describeRating(9), 'Herausragend');
});

test('parseScan maps notes and process', () => {
  const r = T.parseScan({ roaster: 'Röstwerk', name: 'Guji', origin: 'Äthiopien', process: 'Washed', roast: 'hell',
    tasting_notes: ['Himbeere', 'Schwarztee', 'Zitrone', 'irgendwas'] });
  assert.strictEqual(r.process, 'Gewaschen');
  assert.deepStrictEqual(r.aromas, ['Himbeere', 'Schwarztee', 'Zitrone']);
  assert.strictEqual(r.roast, 'hell');
  assert.strictEqual(T.parseScan({ is_coffee: false }).isCoffee, false);
});
