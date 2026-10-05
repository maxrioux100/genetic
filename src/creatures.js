// The living food chain. Every creature eats what is smaller and runs from what is bigger.
// Predator archetypes are unlocked by the player's level, each with a readable tell.
import { CFG } from './config.js';
import { rand, dist, angleTo, turnToward, approach, clamp, TAU, pick } from './util.js';

let nextId = 1;

export const TIER_NAMES = [
  'Speck',
  'Mote',
  'Microbe',
  'Amoeba',
  'Ciliate',
  'Hunter',
  'Brute',
  'Devourer',
  'Leviathan',
  'Titan',
  'Colossus',
  'Old One',
];
export function tierOf(r) {
  return clamp(Math.floor(Math.log(r / 6) / Math.log(1.45)), 0, TIER_NAMES.length - 1);
}

/** Predator archetypes, in the order they are introduced. `level` is the player level that unlocks them. */
export const ARCHETYPES = [
  { id: 'chaser', level: 0, name: 'Gulper', tell: 'It chases. It turns slowly. Cut across its path.' },
  { id: 'lurker', level: 2, name: 'Lurker', tell: 'It hides, half-invisible, and lunges when you get close. Watch for the faint outline.' },
  { id: 'pack', level: 4, name: 'Pack Hunter', tell: 'Three at once. They circle and take turns. Kill the one that commits.' },
  { id: 'lancer', level: 7, name: 'Lancer', tell: 'It stops, aims, and spears across the screen. Sidestep when the line appears.' },
  { id: 'leviathan', level: 10, name: 'Leviathan', tell: 'Slow, vast, and it pulls the water toward its mouth. Dash out of the pull.' },
  { id: 'queen', level: 13, name: 'Brood Queen', tell: 'It births hunters that swarm you. Kill the queen or outrun the swarm.' },
  { id: 'oldone', level: 16, name: 'The Old One', tell: 'Everything the others do, at once. Survive until you outgrow the sea.' },
];

export class Creature {
  constructor(world, x, y, r, kind, archetype = 'grazer', opts = {}) {
    this.id = nextId++;
    this.world = world;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.heading = rand(TAU);
    this.r = r;
    this.spawnR = r; // creatures may grow by eating, but only so far
    this.kind = kind; // prey | rival | predator | minion
    this.arch = archetype;
    this.maxHp = this.hpFor(r);
    this.hp = this.maxHp;
    this.dead = false;
    this.age = 0;
    this.wobble = rand(TAU);
    this.stunT = 0;
    this.slowT = 0;
    this.poison = []; // [{dps,t}]
    this.hitFlash = 0;
    this.state = 'idle';
    this.stateT = 0;
    this.lungeDir = 0;
    this.pack = opts.pack || null;
    this.orbit = rand(TAU);
    this.spawnT = 3;
    this.chaseT = 0; // chasers tire: they hunt in bursts
    this.tired = 0;
    this.lastHitBy = null;
    this.hue =
      kind === 'prey'
        ? rand(150, 230)
        : kind === 'rival'
          ? rand(30, 60)
          : archetype === 'lurker'
            ? 275
            : archetype === 'leviathan'
              ? 220
              : archetype === 'oldone'
                ? 350
                : rand(340, 370) % 360;
    this.sat = kind === 'predator' ? 85 : 70;
    this.eyes = kind === 'predator' ? (archetype === 'leviathan' || archetype === 'oldone' ? 5 : 2) : kind === 'rival' ? 2 : 1;
    this.boss = archetype === 'oldone';
    this.label = `${archetype === 'grazer' ? '' : ARCHETYPES.find((a) => a.id === archetype)?.name + ' '}${TIER_NAMES[tierOf(r)]}`.trim();
  }
  hpFor(r) {
    return Math.round(r * r * 0.35 * (this.arch === 'oldone' ? 3 : this.arch === 'leviathan' ? 1.6 : 1));
  }
  get color() {
    return `hsl(${this.hue} ${this.sat}% 62%)`;
  }
  get speed() {
    const base = this.kind === 'prey' ? 165 : this.kind === 'rival' ? 200 : 250;
    let s = base - this.r * (this.kind === 'predator' ? 1.5 : 1.1);
    if (this.arch === 'leviathan') s = 95;
    if (this.arch === 'oldone') s = 120;
    if (this.arch === 'pack') s += 40;
    if (this.slowT > 0) s *= 0.4;
    return Math.max(50, s);
  }
  get bite() {
    return 8 + this.r * 1.0 * (this.arch === 'oldone' ? 1.6 : 1);
  }
  get xp() {
    return this.r * this.r * 0.2 * (this.boss ? 4 : 1);
  }
  get poisoned() {
    return this.poison.length > 0;
  }

  // ---------- damage ----------
  damage(a, source, kind = 'hit') {
    if (this.dead || a <= 0) return 0;
    this.hp -= a;
    this.hitFlash = 0.12;
    this.lastHitBy = source;
    if (source === this.world.player || source?.ally) this.world.noteDamage(this, a, kind);
    if (this.hp <= 0) this.world.kill(this, source, kind);
    return a;
  }
  addPoison(dps, t) {
    if (this.poison.length < 6) this.poison.push({ dps, t });
    else this.poison[0].t = Math.max(this.poison[0].t, t);
  }
  stun(t) {
    this.stunT = Math.max(this.stunT, t);
    this.state = 'idle';
  }
  grow(by) {
    const cap = Math.min(this.spawnR * 1.5, this.world.player.r * 2.6);
    if (this.r >= cap) return;
    this.r = Math.min(cap, this.r + by, this.r * 1.08 + by * 0.2);
    const m = this.hpFor(this.r);
    this.hp = Math.min(m, this.hp + by * 10);
    this.maxHp = m;
  }
  shrink(dt) {
    this.r = Math.max(4, this.r * (1 - 0.06 * dt));
    this.maxHp = this.hpFor(this.r);
    this.hp = Math.min(this.hp, this.maxHp);
  }

  // ---------- perception ----------
  canEat(o) {
    return o.r < this.r * 0.85;
  }
  fears(o) {
    return o.r > this.r * 1.2;
  }

  update(dt) {
    const W = this.world;
    const p = W.player;
    this.age += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    if (this.poison.length) {
      let dps = 0;
      for (const q of this.poison) {
        q.t -= dt;
        dps += q.dps;
      }
      this.poison = this.poison.filter((q) => q.t > 0);
      this.damage(dps * dt, p, 'poison');
      if (p.has('venom4')) this.shrink(dt);
      if (this.dead) return;
    }
    if (this.stunT > 0) {
      this.stunT -= dt;
      this.vx *= 0.9;
      this.vy *= 0.9;
      this.move(dt);
      return;
    }
    const sense = 320 + this.r * 4;
    // what to fear, what to hunt
    let threat = null,
      threatD = this.kind === 'prey' ? 170 + this.r * 3 : sense * 0.8;
    let prey = null,
      preyD = sense;
    for (const o of W.hostilesFor(this)) {
      const d = dist(this, o) - o.r;
      if (this.fears(o) && d < threatD) {
        threat = o;
        threatD = d;
      } else if (this.canEat(o) && d < preyD && !(o.stealth && d > 60)) {
        prey = o;
        preyD = d;
      }
    }
    if (this.kind === 'minion') {
      threat = null;
      prey = W.playerTarget(this) || prey;
    }
    const pursue = this.kind === 'predator' || this.kind === 'minion' ? W.playerTarget(this, sense * 1.4) : null;
    if (pursue && (!prey || this.kind !== 'prey')) prey = pursue;

    switch (this.arch) {
      case 'lurker':
        return this.updateLurker(dt, threat, prey);
      case 'pack':
        return this.updatePack(dt, threat, prey);
      case 'lancer':
        return this.updateLancer(dt, threat, prey);
      case 'leviathan':
        return this.updateLeviathan(dt, prey);
      case 'queen':
        return this.updateQueen(dt, threat, prey);
      case 'oldone':
        return this.updateOldOne(dt, prey);
    }
    // grazer / chaser
    if (this.tired > 0) {
      this.tired -= dt;
      this.graze(dt);
    } else if (threat && this.kind !== 'minion') this.flee(threat, dt);
    else if (prey) {
      this.steer(prey.x, prey.y, this.speed, this.kind === 'predator' ? 2.2 : 4, dt);
      if (this.kind === 'predator' && (this.chaseT += dt) > 7) {
        this.chaseT = 0;
        this.tired = 3.5;
      }
    } else {
      this.chaseT = Math.max(0, this.chaseT - dt);
      this.graze(dt);
    }
    this.move(dt);
  }

  // ---------- archetypes ----------
  updateLurker(dt, threat, prey) {
    const p = this.world.player;
    if (this.state === 'idle') {
      this.vx = approach(this.vx, 0, 4, dt);
      this.vy = approach(this.vy, 0, 4, dt);
      this.heading += Math.sin(this.age) * 0.2 * dt;
      if (threat) {
        this.state = 'flee';
        this.stateT = 2;
      } else if (prey && dist(this, prey) < 230 + this.r) {
        this.state = 'tele';
        this.stateT = p.has('sense') ? 0.6 : 0.42;
        this.lungeDir = angleTo(this, prey);
      }
    } else if (this.state === 'tele') {
      this.stateT -= dt;
      if (prey) this.lungeDir = angleTo(this, prey);
      if (this.stateT <= 0) {
        this.state = 'lunge';
        this.stateT = 0.45;
        this.world.audio.play('lunge', 0.7);
      }
    } else if (this.state === 'lunge') {
      this.stateT -= dt;
      this.vx = Math.cos(this.lungeDir) * 520;
      this.vy = Math.sin(this.lungeDir) * 520;
      if (this.stateT <= 0) {
        this.state = 'cool';
        this.stateT = 2.5;
      }
    } else if (this.state === 'cool' || this.state === 'flee') {
      this.stateT -= dt;
      if (this.state === 'flee' && threat) this.flee(threat, dt);
      else if (prey && this.state === 'cool') this.steer(prey.x, prey.y, this.speed * 0.6, 2, dt);
      else this.graze(dt);
      if (this.stateT <= 0) this.state = 'idle';
    }
    this.move(dt);
  }
  updatePack(dt, threat, prey) {
    if (threat && threat.r > this.r * 1.6) {
      this.flee(threat, dt);
      this.move(dt);
      return;
    }
    if (!prey) {
      this.graze(dt);
      this.move(dt);
      return;
    }
    const d = dist(this, prey);
    if (this.state === 'tele') {
      this.stateT -= dt;
      this.vx = approach(this.vx, 0, 6, dt);
      this.vy = approach(this.vy, 0, 6, dt);
      this.lungeDir = angleTo(this, prey);
      if (this.stateT <= 0) {
        this.state = 'lunge';
        this.stateT = 0.4;
        this.world.audio.play('lunge', 0.5);
      }
    } else if (this.state === 'lunge') {
      this.stateT -= dt;
      this.vx = Math.cos(this.lungeDir) * 470;
      this.vy = Math.sin(this.lungeDir) * 470;
      if (this.stateT <= 0) this.state = 'idle';
    } else {
      this.orbit += dt * 1.4;
      const od = prey.r + this.r + 110;
      const ox = prey.x + Math.cos(this.orbit) * od,
        oy = prey.y + Math.sin(this.orbit) * od;
      this.steer(ox, oy, d > 500 ? this.speed * 1.3 : this.speed, 5, dt);
      if (this.pack) {
        this.pack.t -= dt / Math.max(1, this.pack.members.filter((m) => !m.dead).length);
        if (this.pack.t <= 0 && d < od + 120) {
          this.pack.t = 1.6;
          this.state = 'tele';
          this.stateT = 0.4;
        }
      }
    }
    this.move(dt);
  }
  updateLancer(dt, threat, prey) {
    if (this.state === 'tele') {
      this.stateT -= dt;
      this.vx = approach(this.vx, 0, 6, dt);
      this.vy = approach(this.vy, 0, 6, dt);
      if (prey && this.stateT > 0.25) this.lungeDir = angleTo(this, prey);
      if (this.stateT <= 0) {
        this.state = 'lunge';
        this.stateT = 0.6;
        this.world.audio.play('lunge');
      }
    } else if (this.state === 'lunge') {
      this.stateT -= dt;
      this.vx = Math.cos(this.lungeDir) * 760;
      this.vy = Math.sin(this.lungeDir) * 760;
      if (this.stateT <= 0) {
        this.state = 'cool';
        this.stateT = 1.8;
      }
    } else {
      if (this.state === 'cool' && (this.stateT -= dt) <= 0) this.state = 'idle';
      if (threat) this.flee(threat, dt);
      else if (prey) {
        const d = dist(this, prey);
        if (d > 520) this.steer(prey.x, prey.y, this.speed, 3, dt);
        else if (this.state === 'idle' && d < 480) {
          this.state = 'tele';
          this.stateT = 0.8;
          this.lungeDir = angleTo(this, prey);
        } else this.steer(prey.x, prey.y, this.speed * 0.5, 3, dt);
      } else this.graze(dt);
    }
    this.move(dt);
  }
  updateLeviathan(dt, prey) {
    if (prey) {
      this.steer(prey.x, prey.y, this.speed, 1.2, dt);
      // suction
      const pullR = this.r * 4.5;
      for (const o of this.world.pullTargets()) {
        const d = dist(this, o);
        if (d < pullR && d > this.r * 0.5 && !(o.dashT > 0)) {
          const a = angleTo(o, this);
          const f = (1 - d / pullR) * 240;
          o.vx += Math.cos(a) * f * dt * 4;
          o.vy += Math.sin(a) * f * dt * 4;
        }
      }
    } else this.graze(dt);
    this.move(dt);
  }
  updateQueen(dt, threat, prey) {
    this.spawnT -= dt;
    if (prey && this.spawnT <= 0 && this.world.minionsOf(this) < 5) {
      this.spawnT = 2.5;
      const a = rand(TAU);
      const m = new Creature(this.world, this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r, this.r * 0.3, 'minion', 'chaser');
      m.hue = this.hue;
      m.queen = this;
      m.life = 14;
      this.world.creatures.push(m);
      this.world.fx.burst(m.x, m.y, this.color, 8, 120, 0.4);
    }
    if (threat) this.flee(threat, dt);
    else if (prey) {
      const d = dist(this, prey);
      if (d > 420) this.steer(prey.x, prey.y, this.speed * 0.8, 2, dt);
      else this.flee(prey, dt, 0.5);
    } else this.graze(dt);
    this.move(dt);
  }
  updateOldOne(dt, prey) {
    this.spawnT -= dt;
    if (prey) {
      if (this.state === 'tele') {
        this.stateT -= dt;
        this.vx = approach(this.vx, 0, 4, dt);
        this.vy = approach(this.vy, 0, 4, dt);
        if (this.stateT > 0.3) this.lungeDir = angleTo(this, prey);
        if (this.stateT <= 0) {
          this.state = 'lunge';
          this.stateT = 0.7;
          this.world.audio.play('lunge');
          this.world.fx.shake(8);
        }
      } else if (this.state === 'lunge') {
        this.stateT -= dt;
        this.vx = Math.cos(this.lungeDir) * 620;
        this.vy = Math.sin(this.lungeDir) * 620;
        if (this.stateT <= 0) {
          this.state = 'cool';
          this.stateT = 3;
        }
      } else {
        if (this.state === 'cool' && (this.stateT -= dt) <= 0) this.state = 'idle';
        this.steer(prey.x, prey.y, this.speed, 1.5, dt);
        if (this.state === 'idle' && dist(this, prey) < 600) {
          this.state = 'tele';
          this.stateT = 1.1;
        }
        const pullR = this.r * 4;
        for (const o of this.world.pullTargets()) {
          const d = dist(this, o);
          if (d < pullR && !(o.dashT > 0)) {
            const a = angleTo(o, this);
            o.vx += Math.cos(a) * 160 * dt * 4;
            o.vy += Math.sin(a) * 160 * dt * 4;
          }
        }
      }
      if (this.spawnT <= 0 && this.world.minionsOf(this) < 4) {
        this.spawnT = 4;
        const a = rand(TAU);
        const m = new Creature(this.world, this.x + Math.cos(a) * this.r, this.y + Math.sin(a) * this.r, this.r * 0.25, 'minion', 'chaser');
        m.hue = this.hue;
        m.queen = this;
        m.life = 12;
        this.world.creatures.push(m);
      }
    } else this.graze(dt);
    this.move(dt);
  }

  // ---------- movement ----------
  steer(tx, ty, speed, turnRate, dt) {
    const want = Math.atan2(ty - this.y, tx - this.x);
    this.heading = turnToward(this.heading, want, turnRate * dt);
    this.vx = approach(this.vx, Math.cos(this.heading) * speed, 6, dt);
    this.vy = approach(this.vy, Math.sin(this.heading) * speed, 6, dt);
  }
  flee(o, dt, mul = 1) {
    const a = angleTo(o, this);
    this.heading = turnToward(this.heading, a, 7 * dt);
    this.vx = approach(this.vx, Math.cos(this.heading) * this.speed * mul, 8, dt);
    this.vy = approach(this.vy, Math.sin(this.heading) * this.speed * mul, 8, dt);
  }
  graze(dt) {
    const W = CFG.world;
    const sp = this.world.nearestSpeck(this.x, this.y, 220);
    if (sp && this.kind !== 'predator') {
      this.steer(sp.x, sp.y, this.speed * 0.6, 3, dt);
      return;
    }
    this.heading += (Math.sin(this.age * 0.7 + this.wobble) * 0.8 + rand(-0.4, 0.4)) * dt;
    if (this.x < 150) this.heading = turnToward(this.heading, 0, 3 * dt);
    if (this.x > W.w - 150) this.heading = turnToward(this.heading, Math.PI, 3 * dt);
    if (this.y < 150) this.heading = turnToward(this.heading, Math.PI / 2, 3 * dt);
    if (this.y > W.h - 150) this.heading = turnToward(this.heading, -Math.PI / 2, 3 * dt);
    const s = this.speed * 0.45;
    this.vx = approach(this.vx, Math.cos(this.heading) * s, 3, dt);
    this.vy = approach(this.vy, Math.sin(this.heading) * s, 3, dt);
  }
  move(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const W = CFG.world;
    if (this.x < this.r) {
      this.x = this.r;
      this.vx = Math.abs(this.vx);
    }
    if (this.y < this.r) {
      this.y = this.r;
      this.vy = Math.abs(this.vy);
    }
    if (this.x > W.w - this.r) {
      this.x = W.w - this.r;
      this.vx = -Math.abs(this.vx);
    }
    if (this.y > W.h - this.r) {
      this.y = W.h - this.r;
      this.vy = -Math.abs(this.vy);
    }
    if (this.life !== undefined && (this.life -= dt) <= 0) {
      this.dead = true;
      this.world.fx.burst(this.x, this.y, this.color, 6, 80, 0.3);
    }
  }
}

export function pickArchetype(level, rnd = Math.random) {
  const unlocked = ARCHETYPES.filter((a) => a.level <= level && a.id !== 'oldone');
  // newest archetypes are more common so the new threat is felt
  const weights = unlocked.map((a, i) => 1 + i * 0.6);
  const total = weights.reduce((s, w) => s + w, 0);
  let r = rnd() * total;
  for (let i = 0; i < unlocked.length; i++) {
    r -= weights[i];
    if (r <= 0) return unlocked[i].id;
  }
  return pick(unlocked).id;
}
