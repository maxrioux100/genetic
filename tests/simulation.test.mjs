import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate, BUILDS } from './helpers.mjs';
import { ERAS } from '../src/world.js';
import { CFG } from '../src/config.js';

test('biomass requirement grows with level and eras start at increasing levels', () => {
  for (let l = 1; l < CFG.levels.winLevel; l++) assert.ok(CFG.levels.biomassNeed(l) > CFG.levels.biomassNeed(l - 1));
  for (let i = 1; i < ERAS.length; i++) assert.ok(ERAS[i].level > ERAS[i - 1].level);
  assert.deepEqual(
    ERAS.map((e) => e.level),
    CFG.levels.eraStartLevels,
  );
});

for (const [name, build] of Object.entries(BUILDS)) {
  test(`${name} build survives a forced tour of every era without invariant violations`, () => {
    const { world, player, violations, seen } = simulate({ build, seconds: 400, forceLevelEvery: 8, seed: 7 });
    assert.deepEqual(violations, []);
    assert.ok(player.talents.size >= 6, `bought ${player.talents.size} talents`);
    assert.ok(world.eraIdx >= 2 || player.dead || world.won, `reached era ${world.eraIdx}`);
    for (const kind of ['acid', 'phage']) assert.ok(seen.has(kind), `${kind} never spawned`);
  });
}

test('a long forced run reaches the final era and the win condition', () => {
  // Armor is the sturdiest bot build; it must be able to witness the Leviathan.
  const { world, seen, violations } = simulate({ build: BUILDS.armor, seconds: 600, forceLevelEvery: 6, seed: 3 });
  assert.deepEqual(violations, []);
  assert.ok(world.eraIdx === ERAS.length - 1 || world.won, `only reached era ${world.eraIdx}`);
  for (const kind of ['grazer', 'amoeba', 'parasite', 'hunter', 'antibody', 'macrophage'])
    assert.ok(seen.has(kind), `${kind} never spawned`);
});

test('the first mutation point is free and division grants points', () => {
  const { player } = simulate({ seconds: 1, seed: 1 });
  assert.equal(player.mp, 1);
  const need = CFG.levels.biomassNeed(0);
  player.biomass = need;
  player.divide(need);
  assert.equal(player.level, 1);
  assert.equal(player.mp, 2);
});

test('runs are deterministic for a given seed', () => {
  const a = simulate({ build: BUILDS.nimble, seconds: 30, seed: 11 });
  const b = simulate({ build: BUILDS.nimble, seconds: 30, seed: 11 });
  assert.equal(a.player.x, b.player.x);
  assert.equal(a.player.biomass, b.player.biomass);
  assert.equal(a.world.threats.length, b.world.threats.length);
});
