// Shared helpers for headless simulation tests. No DOM, no canvas, no audio.
import { World } from '../src/world.js';
import { drawCards } from '../src/perks.js';
import { CFG } from '../src/config.js';

/** Deterministic Math.random (mulberry32) so failures are reproducible. */
export function seedRandom(seed) {
  const original = Math.random;
  let a = seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return () => {
    Math.random = original;
  };
}

export const silentAudio = { play() {}, muted: true };

/** A simple bot: flee anything that can eat it, otherwise chase the nearest thing it can eat, else specks. */
export function botInput(world) {
  return {
    moveDir(p) {
      const danger = world.nearestCreature(p.x, p.y, 260, (c) => c.r > p.r * CFG.player.dangerRatio);
      const food = world.nearestCreature(p.x, p.y, 500, (c) => c.r < p.r * CFG.player.eatRatio);
      const speck = world.nearestSpeck(p.x, p.y, 600);
      let dx = 0,
        dy = 0;
      const t = danger ? null : food || speck;
      if (danger) {
        dx = p.x - danger.x;
        dy = p.y - danger.y;
      } else if (t) {
        dx = t.x - p.x;
        dy = t.y - p.y;
      }
      const l = Math.hypot(dx, dy) || 1;
      return { x: dx / l, y: dy / l };
    },
  };
}

/** Perk preference per build: the form ids to push, in order. */
export const BUILDS = {
  serpent: ['serpent', 'tough'],
  volt: ['volt', 'bite'],
  brood: ['brood', 'quick'],
  venom: ['venom', 'regen'],
  mixed: ['volt', 'serpent'],
};

function chooseCard(cards, prefs) {
  for (const pref of prefs) {
    const c = cards.find((k) => k.form === pref || k.id === pref);
    if (c) return c;
  }
  return cards[0];
}

/**
 * Simulate a run. Returns the world plus a list of invariant violations.
 * `forceLevelEvery` grants a full level's worth of xp every N seconds so late game is reached quickly.
 */
export function simulate({ build = [], seconds = 60, forceLevelEvery = 0, dt = 1 / 60, seed = 1, useAbility = true } = {}) {
  const restore = seedRandom(seed);
  try {
    const world = new World(silentAudio);
    const p = world.player;
    const input = botInput(world);
    const violations = [];
    const seen = new Set();
    let dashT = 0,
      abilityT = 0,
      nextForce = forceLevelEvery;
    const frames = Math.floor(seconds / dt);
    for (let i = 0; i < frames; i++) {
      if (world.pendingLevelUp) {
        const cards = drawCards(p.perks, p.perkCounts, 3);
        if (cards.length) p.takePerk(chooseCard(cards, build).id);
        world.pendingLevelUp = false;
      }
      if (forceLevelEvery && world.time >= nextForce) {
        nextForce += forceLevelEvery;
        p.xp += CFG.levels.xpNeed(p.level);
      }
      if ((dashT -= dt) <= 0) {
        p.dash();
        dashT = 2;
      }
      if (useAbility && (abilityT -= dt) <= 0) {
        const c = world.nearestCreature(p.x, p.y, 400);
        if (c) p.useAbility(c.x, c.y);
        abilityT = 1.5;
      }
      world.update(dt, input);
      for (const c of world.creatures) seen.add(c.arch);
      for (const k of ['x', 'y', 'hp', 'xp']) if (!Number.isFinite(p[k])) violations.push(`player.${k} is ${p[k]} at t=${world.time}`);
      if (p.hp > p.maxHp + 1e-6) violations.push(`hp ${p.hp} above max ${p.maxHp}`);
      for (const c of world.creatures) {
        if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || !Number.isFinite(c.r))
          violations.push(`${c.arch} ${c.kind} has a non-finite field`);
        if (c.r > p.r * 6) violations.push(`${c.arch} grew to ${c.r} vs player ${p.r}`);
      }
      if (violations.length > 5 || p.dead || world.won) break;
    }
    return { world, player: p, violations, seen };
  } finally {
    restore();
  }
}
