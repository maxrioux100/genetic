import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERKS, PERK_BY_ID, FORMS, eligible, drawCards, formTier, lineageName } from '../src/perks.js';

test('every form has exactly tiers 1 to 5 with one ability at tier 3', () => {
  for (const f of Object.keys(FORMS)) {
    const tiers = PERKS.filter((p) => p.form === f)
      .map((p) => p.tier)
      .sort();
    assert.deepEqual(tiers, [1, 2, 3, 4, 5], `${f} tiers`);
    const abilities = PERKS.filter((p) => p.form === f && p.ability);
    assert.equal(abilities.length, 1, `${f} should have one ability`);
    assert.equal(abilities[0].tier, 3);
  }
});

test('every perk has a unique id and a real description', () => {
  const ids = new Set();
  for (const p of PERKS) {
    assert.ok(!ids.has(p.id), `duplicate ${p.id}`);
    ids.add(p.id);
    assert.ok(p.desc.length > 25, `${p.id} needs a description`);
    assert.ok(p.form ? FORMS[p.form] : p.generic, `${p.id} is neither form nor generic`);
  }
});

test('eligibility offers only the next tier, and caps forms at two', () => {
  const owned = new Set();
  let ids = eligible(owned).map((e) => e.perk.id);
  for (const f of Object.keys(FORMS)) assert.ok(ids.includes(`${f}1`));
  assert.ok(!ids.includes('serpent2'));
  owned.add('serpent1');
  ids = eligible(owned).map((e) => e.perk.id);
  assert.ok(ids.includes('serpent2') && !ids.includes('serpent1') && !ids.includes('serpent3'));
  owned.add('volt1');
  ids = eligible(owned).map((e) => e.perk.id);
  assert.ok(!ids.includes('brood1') && !ids.includes('venom1'), 'third form must not be offered');
  assert.ok(ids.includes('serpent2') && ids.includes('volt2'));
});

test('drawCards returns distinct cards and never more than the pool', () => {
  const rnd = (() => {
    let s = 1;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
  })();
  for (let i = 0; i < 50; i++) {
    const cards = drawCards(new Set(['serpent1']), {}, 3, rnd);
    assert.equal(cards.length, 3);
    assert.equal(new Set(cards.map((c) => c.id)).size, 3);
  }
  const owned = new Set(['serpent1', 'serpent2', 'serpent3', 'serpent4', 'serpent5', 'volt1', 'volt2', 'volt3', 'volt4', 'volt5', 'gulp']);
  const counts = { tough: 4, quick: 4, bite: 4, appetite: 4, regen: 4 };
  assert.equal(drawCards(owned, counts, 3, rnd).length, 0, 'nothing left to offer');
});

test('formTier and lineage names', () => {
  const owned = new Set(['volt1', 'volt2', 'serpent1']);
  assert.equal(formTier(owned, 'volt'), 2);
  assert.equal(formTier(owned, 'brood'), 0);
  assert.equal(lineageName(new Set()), 'Plain Cell');
  assert.equal(lineageName(owned), 'Lesser Volt of the Serpent');
  assert.equal(PERK_BY_ID.volt5.tier, 5);
});
