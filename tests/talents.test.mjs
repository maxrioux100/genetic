import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TALENTS, TALENT_BY_ID, BRANCHES, canBuy, lineageName, layoutTalents } from '../src/talents.js';

test('every talent has a unique id, a known branch and valid requirements', () => {
  const ids = new Set();
  for (const t of TALENTS) {
    assert.ok(!ids.has(t.id), `duplicate id ${t.id}`);
    ids.add(t.id);
    assert.ok(BRANCHES[t.branch], `${t.id} has unknown branch ${t.branch}`);
    for (const r of t.req) assert.ok(TALENT_BY_ID[r], `${t.id} requires unknown talent ${r}`);
    assert.ok(t.cost >= 1, `${t.id} cost must be positive`);
    assert.ok(t.desc.length > 20, `${t.id} needs a real description`);
  }
});

test('keystones cost 2 and every branch has exactly one', () => {
  const perBranch = {};
  for (const t of TALENTS.filter((t) => t.keystone)) {
    assert.equal(t.cost, 2, `${t.id} keystone should cost 2`);
    perBranch[t.branch] = (perBranch[t.branch] || 0) + 1;
  }
  for (const b of Object.keys(BRANCHES)) assert.equal(perBranch[b], 1, `${b} should have one keystone`);
});

test('the tree has no cycles and every talent is reachable', () => {
  const reachable = new Set();
  let progress = true;
  while (progress) {
    progress = false;
    for (const t of TALENTS) {
      if (reachable.has(t.id)) continue;
      const ok = t.req.length === 0 || (t.anyReq ? t.req.some((r) => reachable.has(r)) : t.req.every((r) => reachable.has(r)));
      if (ok) {
        reachable.add(t.id);
        progress = true;
      }
    }
  }
  assert.equal(reachable.size, TALENTS.length);
});

test('canBuy enforces points, ownership and prerequisites', () => {
  const owned = new Set();
  assert.equal(canBuy('cilia', owned, 1), true);
  assert.equal(canBuy('cilia', owned, 0), false);
  assert.equal(canBuy('jaws', owned, 5), false, 'jaws needs cilia');
  owned.add('cilia');
  assert.equal(canBuy('cilia', owned, 5), false, 'already owned');
  assert.equal(canBuy('jaws', owned, 1), true);
  owned.add('jaws');
  owned.add('toxin');
  assert.equal(canBuy('bloodlust', owned, 1), true, 'anyReq: toxin alone is enough');
  assert.equal(canBuy('apex', owned, 2), false, 'apex needs bloodlust');
});

test('lineage name reflects the dominant branches', () => {
  assert.equal(lineageName(new Set()), 'Unremarkable Blob');
  assert.equal(lineageName(new Set(['cilia', 'jaws'])), 'Predator');
  assert.match(lineageName(new Set(['cilia', 'jaws', 'membrane'])), /Armored Predator/);
});

test('layout keeps every node inside the unit square', () => {
  for (const [id, p] of Object.entries(layoutTalents())) {
    assert.ok(p.x > 0.02 && p.x < 0.98 && p.y > 0.02 && p.y < 0.98, `${id} at ${p.x},${p.y}`);
  }
});
