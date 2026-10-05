// Shared helpers for headless simulation tests. No DOM, no canvas, no audio.
import { World } from '../src/world.js';
import { TALENT_BY_ID, canBuy } from '../src/talents.js';
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

/** A simple bot: flee the nearest threat, otherwise go to the nearest nutrient. */
export function botInput(world) {
  return {
    moveDir(p) {
      const n = world.nearestNutrient(p.x, p.y, 600);
      const t = world.nearestThreat(p.x, p.y, 140, (x) => x.kind !== 'acid');
      let dx = 0,
        dy = 0;
      if (t) {
        dx = p.x - t.x;
        dy = p.y - t.y;
      } else if (n) {
        dx = n.x - p.x;
        dy = n.y - p.y;
      }
      const l = Math.hypot(dx, dy) || 1;
      return { x: dx / l, y: dy / l };
    },
  };
}

export const BUILDS = {
  hunter: ['cilia', 'jaws', 'toxin', 'engulf', 'bloodlust', 'apex', 'flagellum', 'membrane'],
  autotroph: ['chloroplast', 'vacuole', 'anchor', 'bloom', 'thickwall', 'reef', 'membrane', 'spikes'],
  armor: ['membrane', 'shell', 'spikes', 'regen', 'cyst', 'juggernaut', 'flagellum'],
  nimble: ['flagellum', 'sense', 'streamline', 'camo', 'mimicry', 'phantom', 'membrane'],
  colony: ['mitosis', 'signal', 'symbiosis', 'swarm', 'sacrifice', 'hive', 'flagellum'],
};

/**
 * Simulate a run. Returns the world plus a list of invariant violations.
 * `forceLevelEvery` adds a full division's worth of biomass every N seconds so late eras are reached quickly.
 */
export function simulate({ build = [], seconds = 60, forceLevelEvery = 0, dt = 1 / 60, seed = 1 } = {}) {
  const restore = seedRandom(seed);
  try {
    const world = new World(silentAudio);
    const p = world.player;
    const input = botInput(world);
    const violations = [];
    const seen = new Set();
    let dashT = 0,
      anchored = false,
      nextForce = forceLevelEvery;
    const frames = Math.floor(seconds / dt);
    for (let i = 0; i < frames; i++) {
      for (const id of build) {
        if (canBuy(id, p.talents, p.mp)) {
          p.mp -= TALENT_BY_ID[id].cost;
          p.learn(id);
        }
      }
      if (forceLevelEvery && world.time >= nextForce) {
        nextForce += forceLevelEvery;
        p.biomass += CFG.levels.biomassNeed(p.level);
      }
      if ((dashT -= dt) <= 0) {
        p.dash();
        dashT = 2;
      }
      if (p.has('anchor') && !anchored && world.time > 20) {
        p.toggleAnchor();
        anchored = true;
      }
      if (p.has('cyst') && p.hp < p.maxHp * 0.4) p.cyst();
      world.update(dt, input);
      for (const t of world.threats) seen.add(t.kind);
      for (const k of ['x', 'y', 'hp', 'energy', 'biomass'])
        if (!Number.isFinite(p[k])) violations.push(`player.${k} is ${p[k]} at t=${world.time}`);
      if (p.hp > p.maxHp + 1e-6) violations.push(`hp ${p.hp} above max ${p.maxHp}`);
      if (p.energy > p.maxEnergy + 1e-6) violations.push(`energy ${p.energy} above max ${p.maxEnergy}`);
      for (const t of world.threats)
        if (!Number.isFinite(t.x) || !Number.isFinite(t.y)) violations.push(`${t.kind} position is not finite`);
      if (violations.length > 5 || p.dead || world.won) break;
    }
    return { world, player: p, violations, seen };
  } finally {
    restore();
  }
}
