import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate, BUILDS } from './helpers.mjs';
import { ARCHETYPES } from '../src/creatures.js';
import { CFG } from '../src/config.js';

test('xp requirement grows with level and archetypes unlock in order', () => {
  for (let l = 1; l < CFG.levels.winLevel; l++) assert.ok(CFG.levels.xpNeed(l) > CFG.levels.xpNeed(l - 1));
  for (let i = 1; i < ARCHETYPES.length; i++) assert.ok(ARCHETYPES[i].level > ARCHETYPES[i - 1].level);
  assert.ok(
    ARCHETYPES.every((a) => a.tell.length > 20),
    'every predator needs a readable tell',
  );
});

for (const [name, build] of Object.entries(BUILDS)) {
  test(`${name} build survives a forced tour of the whole game without invariant violations`, () => {
    const { world, player, violations, seen } = simulate({ build, seconds: 420, forceLevelEvery: 7, seed: 7 });
    assert.deepEqual(violations, []);
    assert.ok(player.perks.size >= 5, `took ${player.perks.size} perks`);
    assert.ok(player.level >= 10 || player.dead || world.won, `reached level ${player.level}`);
    assert.ok(seen.has('grazer') && seen.has('chaser'), 'basic creatures never spawned');
  });
}

test('a long forced run meets every predator archetype including the Old One', () => {
  const { seen, violations, world, player } = simulate({ build: BUILDS.serpent, seconds: 600, forceLevelEvery: 10, seed: 3 });
  assert.deepEqual(violations, []);
  for (const a of ARCHETYPES)
    assert.ok(seen.has(a.id), `${a.name} never spawned (reached level ${player.level}, dead=${player.dead}, won=${world.won})`);
});

test('the ecosystem keeps prey, rivals and predators around the player', () => {
  const { world, player } = simulate({ seconds: 20, seed: 5, useAbility: false });
  const kinds = { prey: 0, rival: 0, predator: 0 };
  for (const c of world.creatures) if (kinds[c.kind] !== undefined) kinds[c.kind]++;
  assert.ok(kinds.prey > 5, `prey ${kinds.prey}`);
  assert.ok(kinds.rival > 0, `rivals ${kinds.rival}`);
  assert.ok(kinds.predator > 0, `predators ${kinds.predator}`);
  assert.ok(player.stats.eaten > 0 || player.xp > 0, 'the bot should have eaten something');
});

test('level up pauses for a choice and the choice grants the perk', () => {
  const { world, player } = simulate({ seconds: 1, seed: 1 });
  player.xp = CFG.levels.xpNeed(0);
  world.update(1 / 60, { moveDir: () => ({ x: 0, y: 0 }) });
  assert.equal(player.level, 1);
  assert.equal(world.pendingLevelUp, true);
  player.takePerk('volt1');
  assert.equal(player.tier('volt'), 1);
});

test('runs are deterministic for a given seed', () => {
  const a = simulate({ build: BUILDS.volt, seconds: 30, seed: 11 });
  const b = simulate({ build: BUILDS.volt, seconds: 30, seed: 11 });
  assert.equal(a.player.x, b.player.x);
  assert.equal(a.player.xp, b.player.xp);
  assert.equal(a.world.creatures.length, b.world.creatures.length);
});
