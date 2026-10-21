const test = require('node:test');
const assert = require('node:assert');
const E = require('../js/engine.js');

const base = { dose: 18, yield: 36, time: 28, grind: 10, grindStep: 1, finerIsLower: true, keep: 'dose' };

test('sour + watery shot: grind finer and use more coffee', () => {
  const pos = E.positionFromDescriptors(['sour', 'watery']);
  const r = E.recommend(base, { ...pos, descriptors: ['sour', 'watery'] });
  assert.strictEqual(r.zone, 'off');
  assert.ok(r.next.grind < 10, 'finer means lower number');
  assert.ok(r.next.yield < 36, 'shorter ratio');
  assert.strictEqual(r.actions[0].kind, 'grind');
});

test('bitter + intense shot: grind coarser and longer ratio', () => {
  const r = E.recommend(base, { x: 0.8, y: 0.5, descriptors: ['bitter', 'intense'] });
  assert.ok(r.next.grind > 10);
  assert.ok(r.next.yield > 36);
});

test('respects grinders where a higher number is finer', () => {
  const r = E.recommend({ ...base, finerIsLower: false }, { x: -0.8, y: 0, descriptors: [] });
  assert.ok(r.next.grind > 10);
});

test('keep yield adjusts dose instead', () => {
  const r = E.recommend({ ...base, keep: 'yield' }, { x: 0, y: -0.8, descriptors: [] });
  assert.strictEqual(r.next.yield, 36);
  assert.ok(r.next.dose > 18);
});

test('centre of the compass changes nothing', () => {
  const r = E.recommend(base, { x: 0.05, y: -0.05, descriptors: ['balanced'] });
  assert.strictEqual(r.zone, 'sweetspot');
  assert.strictEqual(r.next.grind, 10);
  assert.strictEqual(r.next.yield, 36);
  assert.strictEqual(r.actions[0].kind, 'done');
});

test('sour and bitter together flags channeling first', () => {
  const ids = ['sour', 'bitter'];
  const pos = E.positionFromDescriptors(ids);
  const r = E.recommend(base, { ...pos, descriptors: ids });
  assert.ok(r.channeling);
  assert.strictEqual(r.actions[0].kind, 'prep');
});

test('profile check flags a too fast shot', () => {
  const p = E.parseProfile({ name: 'Test', recipe: { dose: 18, yield: 40, timeMin: 26, timeMax: 30 } });
  const issues = E.checkAgainstProfile({ dose: 18, yield: 40, time: 19 }, p);
  assert.strictEqual(issues.length, 1);
  assert.match(issues[0], /feiner/);
});

test('parseProfile rejects nonsense', () => {
  assert.throws(() => E.parseProfile({}));
  assert.throws(() => E.parseProfile({ name: 'x', recipe: { dose: 80 } }));
});

test('suggestRecipe adapts to roast, basket and milk', () => {
  const light = E.suggestRecipe({ roast: 'hell', basket: 'double' });
  assert.deepStrictEqual([light.dose, light.yield, light.temp], [18, 43, 94]);
  const dark = E.suggestRecipe({ roast: 'dunkel', basket: 'double', milk: true });
  assert.deepStrictEqual([dark.dose, dark.yield, dark.temp, dark.timeMax], [18, 29, 90, 28]);
  const single = E.suggestRecipe({ roast: 'mittel', basket: 'single' });
  assert.deepStrictEqual([single.dose, single.yield], [9, 18]);
  assert.ok(E.suggestRecipe({}).why.length >= 2);
  // a suggestion must always be a valid profile
  assert.doesNotThrow(() => E.parseProfile({ name: 'x', recipe: E.suggestRecipe({ roast: 'hell', basket: 'triple', milk: true }) }));
});
