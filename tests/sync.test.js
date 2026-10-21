const test = require('node:test');
const assert = require('node:assert');
const S = require('../js/sync.js');

const remoteRow = (data, at) => ({ data, updated_at: new Date(at).toISOString() });

test('device-only fields stay on the device', () => {
  const c = S.forCloud({ view: 'brew', meta: { updatedAt: 1 }, shots: [{ id: 'a' }] });
  assert.deepStrictEqual(Object.keys(c), ['shots']);
});

test('own data ignores defaults and examples', () => {
  assert.strictEqual(S.hasOwnData({ profiles: [{ id: 'beispiel-klassisch' }], ratings: [{ id: 'x', example: true }] }), false);
  assert.strictEqual(S.hasOwnData({ shots: [{ id: 's1' }] }), true);
  assert.strictEqual(S.hasOwnData({ brew: { log: [{ id: 'b1' }] } }), true);
});

test('decide: empty account gets this browser\'s data', () => {
  assert.strictEqual(S.decide({ meta: {} }, null, 'u1'), 'push');
  assert.strictEqual(S.decide({ meta: {} }, remoteRow({}, 0), 'u1'), 'push');
});

test('decide: first sign-in on a fresh browser pulls, with own data merges', () => {
  const remote = remoteRow({ shots: [{ id: 'r' }] }, 5000);
  assert.strictEqual(S.decide({ meta: {} }, remote, 'u1'), 'pull');
  assert.strictEqual(S.decide({ meta: {}, shots: [{ id: 'l' }] }, remote, 'u1'), 'merge');
  // signed in before as somebody else
  assert.strictEqual(S.decide({ meta: { userId: 'u2' }, shots: [{ id: 'l' }] }, remote, 'u1'), 'merge');
});

test('decide: later syncs follow whichever side changed', () => {
  const synced = { userId: 'u1', syncedAt: 10000, updatedAt: 10000 };
  assert.strictEqual(S.decide({ meta: synced }, remoteRow({ a: 1 }, 10000), 'u1'), 'none');
  assert.strictEqual(S.decide({ meta: { ...synced, updatedAt: 20000 } }, remoteRow({ a: 1 }, 10000), 'u1'), 'push');
  assert.strictEqual(S.decide({ meta: synced }, remoteRow({ a: 1 }, 30000), 'u1'), 'pull');
  assert.strictEqual(S.decide({ meta: { ...synced, updatedAt: 20000 } }, remoteRow({ a: 1 }, 30000), 'u1'), 'merge');
});

test('merge keeps records from both sides, remote wins on the same id', () => {
  const local = { view: 'x', meta: { a: 1 }, shots: [{ id: 's1', at: '2026-01-02', v: 'local' }, { id: 's2', at: '2026-01-03' }],
    brew: { custom: [{ id: 'c1' }], method: 'v60' }, settings: { grindStep: 0.5 } };
  const remote = { shots: [{ id: 's1', at: '2026-01-02', v: 'remote' }, { id: 's0', at: '2026-01-01' }],
    brew: { method: 'aeropress' } };
  const m = S.merge(local, remote);
  assert.deepStrictEqual(m.shots.map(s => s.id), ['s0', 's1', 's2']);
  assert.strictEqual(m.shots[1].v, 'remote');
  assert.deepStrictEqual(m.brew.custom, [{ id: 'c1' }]);
  assert.strictEqual(m.brew.method, 'aeropress');
  assert.deepStrictEqual(m.settings, { grindStep: 0.5 });
  assert.strictEqual(m.view, undefined);
  assert.strictEqual(m.meta, undefined);
});
