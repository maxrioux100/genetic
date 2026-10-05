// Threats. Each has a behavior with a readable counter-play.
// The rule: nothing here is a stat wall. Every threat telegraphs, and every talent branch
// has a way to deal with it, often more than one.
import { CFG } from './config.js';
import { rand, dist, angleTo, turnToward, approach, clamp, TAU } from './util.js';

let nextId = 1;

class Entity {
  constructor(world, x, y) {
    this.id = nextId++;
    this.world = world;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.heading = rand(TAU);
    this.dead = false;
    this.stunT = 0;
    this.poison = 0;
    this.recoilT = 0;
    this.slowT = 0;
    this.hitFlash = 0;
    this.age = 0;
    this.wobble = rand(TAU);
  }
  get player() {
    return this.world.player;
  }
  /** What this threat is actually chasing: decoy, drone or player, or null if it lost us. */
  target(range = Infinity) {
    const p = this.player;
    if (p.decoy && dist(this, p.decoy) < range) return p.decoy;
    if (p.cystT > 0) return null;
    if (p.has('signal') && p.drones.length) {
      let best = null,
        bd = range;
      for (const d of p.drones) {
        const dd = dist(this, d);
        if (dd < bd) {
          bd = dd;
          best = d;
        }
      }
      if (best && dist(this, p) > bd * 0.8) return best;
    }
    const dp = dist(this, p);
    if (dp > range) return null;
    if (p.stealthed && dp > p.r + this.r + 10) return null;
    return p;
  }
  damage(a, source) {
    if (this.hp === undefined) return;
    this.hp -= a;
    this.hitFlash = 0.15;
    if (this.hp <= 0 && !this.dead) this.kill(source);
  }
  kill(source) {
    this.dead = true;
    this.world.burst(this.x, this.y, this.color, 16);
    const p = this.player;
    const byPlayer = source === p || source?.isDrone;
    if (byPlayer) {
      p.stats.kills++;
      this.world.director.note('kill');
      // can we eat it?
      if (this.foodBiomass && (p.has('jaws') || source?.isDrone) && (p.has('apex') || this.r < p.r * p.eatRatio)) {
        p.eatCell(this);
      } else if (this.foodBiomass) {
        this.world.spawnNutrientCluster(this.x, this.y, 30, Math.min(8, Math.ceil(this.foodBiomass / 2)), true);
      }
    }
  }
  tickCommon(dt) {
    this.age += dt;
    this.stunT = Math.max(0, this.stunT - dt);
    this.recoilT = Math.max(0, this.recoilT - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.poison > 0) {
      this.poison -= dt;
      this.damage(6 * dt, this.player);
    }
    if (this.player.has('reef') && this.player.anchored && dist(this, this.player) < this.player.r + 170) this.slowT = 0.2;
  }
  move(dt, mul = 1) {
    if (this.slowT > 0) mul *= 0.5;
    this.x += this.vx * dt * mul;
    this.y += this.vy * dt * mul;
    const W = CFG.world;
    if (this.x < -100 || this.y < -100 || this.x > W.w + 100 || this.y > W.h + 100) {
      if (this.despawnOutside) this.dead = true;
      else {
        this.x = clamp(this.x, 0, W.w);
        this.y = clamp(this.y, 0, W.h);
      }
    }
  }
  steer(tx, ty, speed, turnRate, dt) {
    const want = Math.atan2(ty - this.y, tx - this.x);
    this.heading = turnToward(this.heading, want, turnRate * dt);
    this.vx = Math.cos(this.heading) * speed;
    this.vy = Math.sin(this.heading) * speed;
  }
  wander(dt, speed) {
    this.heading += (Math.sin(this.age * 0.7 + this.wobble) * 0.8 + rand(-0.4, 0.4)) * dt;
    const W = CFG.world;
    if (this.x < 100) this.heading = turnToward(this.heading, 0, 2 * dt);
    if (this.x > W.w - 100) this.heading = turnToward(this.heading, Math.PI, 2 * dt);
    if (this.y < 100) this.heading = turnToward(this.heading, Math.PI / 2, 2 * dt);
    if (this.y > W.h - 100) this.heading = turnToward(this.heading, -Math.PI / 2, 2 * dt);
    this.vx = approach(this.vx, Math.cos(this.heading) * speed, 3, dt);
    this.vy = approach(this.vy, Math.sin(this.heading) * speed, 3, dt);
  }
  overlaps(o) {
    return dist(this, o) < this.r + o.r;
  }
  /** Player passive contact effects: spikes, toxin jaws. Returns true if we were hurt. */
  touchPlayer(dt) {
    const p = this.player;
    if (p.dashT > 0 && p.has('phantom')) return false;
    let hurt = false;
    if (p.has('spikes')) {
      this.damage(14 * dt, p);
      hurt = true;
    }
    if (p.has('jaws') && this.hp !== undefined && (p.has('apex') || this.r < p.r * p.eatRatio || this.biteable)) {
      this.damage(CFG.player.jawsDps * (p.has('apex') ? 1.8 : 1) * dt, p);
      hurt = true;
      if (p.has('toxin')) this.poison = Math.max(this.poison, 3);
    }
    if (hurt && (p.has('toxin') || p.has('spikes'))) this.recoilT = Math.max(this.recoilT, 1.2);
    return hurt;
  }
  fleeFrom(o, speed, dt) {
    const a = angleTo(o, this);
    this.heading = turnToward(this.heading, a, 6 * dt);
    this.vx = Math.cos(this.heading) * speed;
    this.vy = Math.sin(this.heading) * speed;
  }
}

// ---------------------------------------------------------------- ACID
export class Acid extends Entity {
  constructor(world, x, y) {
    super(world, x, y);
    this.r = rand(26, 44);
    this.color = '#8dff4a';
    this.label = 'acid';
    this.kind = 'acid';
    this.drift = rand(TAU);
  }
  update(dt) {
    this.tickCommon(dt);
    const p = this.player;
    this.drift += rand(-1, 1) * dt;
    let sx = Math.cos(this.drift) * 18,
      sy = Math.sin(this.drift) * 18;
    // acid seeks the still (anti-camping, and a real pressure on anchored autotrophs)
    const seek = (p.stillT > 3 ? 22 : 0) + this.world.director.acidSeek;
    if (seek && dist(this, p) < 700) {
      const a = angleTo(this, p);
      sx += Math.cos(a) * seek;
      sy += Math.sin(a) * seek;
    }
    this.vx = approach(this.vx, sx, 1.5, dt);
    this.vy = approach(this.vy, sy, 1.5, dt);
    this.move(dt);
    if (this.overlaps(p)) p.damage(12 * dt, this, { kind: 'acid', silent: true });
    for (const d of p.drones) if (this.overlaps(d)) d.damage(6 * dt);
  }
}

// ---------------------------------------------------------------- PHAGE
// Fast homing darts with a limited turn rate. Sidestep late, or let them pass.
export class Phage extends Entity {
  constructor(world, x, y) {
    super(world, x, y);
    this.r = 5;
    this.color = '#ff9ad5';
    this.label = 'a phage';
    this.kind = 'phage';
    this.life = 7;
    this.homing = 3.6; // seconds of homing before they lose interest
    this.speed = 235 + world.player.level * 3;
    this.heading = angleTo(this, world.player);
    this.despawnOutside = true;
  }
  update(dt) {
    this.tickCommon(dt);
    const p = this.player;
    this.life -= dt;
    if (this.life <= 0) {
      this.dead = true;
      return;
    }
    const t = p.has('mimicry') ? p.decoy || null : this.target(900);
    if (t && this.homing > 0) {
      this.homing -= dt;
      let tx = t.x,
        ty = t.y;
      if (this.world.director.phagePredict && t === p) {
        tx += p.vx * 0.35;
        ty += p.vy * 0.35;
      }
      this.steer(tx, ty, this.speed, 2.6, dt);
    } else {
      this.vx = Math.cos(this.heading) * this.speed * 0.8;
      this.vy = Math.sin(this.heading) * this.speed * 0.8;
    }
    this.move(dt);
    if (this.overlaps(p) && !(p.dashT > 0 && p.has('phantom'))) {
      if (p.has('shell')) {
        // bounce
        this.heading += Math.PI + rand(-0.6, 0.6);
        this.homing = 0;
        this.life = Math.min(this.life, 1.2);
        p.damage(2, this, { silent: true });
        this.world.audio.play('bounce');
      } else {
        p.damage(9, this);
        this.dead = true;
        this.world.burst(this.x, this.y, this.color, 8);
      }
      if (p.has('spikes')) this.dead = true;
      return;
    }
    for (const d of p.drones)
      if (this.overlaps(d)) {
        d.damage(9);
        this.dead = true;
        return;
      }
  }
}

// ---------------------------------------------------------------- GRAZER
// Competes for food. Bullies the small, flees the big. Spikes punish it, jaws eat it.
export class Grazer extends Entity {
  constructor(world, x, y) {
    super(world, x, y);
    this.r = rand(11, 17) + world.player.level * 0.6;
    this.color = '#7fe0ff';
    this.label = 'a grazer';
    this.kind = 'grazer';
    this.maxHp = 32 * world.director.preyArmor;
    this.hp = this.maxHp;
    this.foodBiomass = 5;
    this.foodEnergy = 28;
    this.biteCd = 0;
    this.nut = null;
  }
  update(dt) {
    this.tickCommon(dt);
    const p = this.player;
    this.biteCd = Math.max(0, this.biteCd - dt);
    if (this.stunT > 0) {
      this.move(dt);
      return;
    }
    const dp = dist(this, p);
    const bigger = p.r > this.r * 1.1;
    const smaller = p.r < this.r * 0.95;
    const t = this.target(260);
    if (this.recoilT > 0 || (t === p && bigger && (p.has('jaws') || dp < 160))) {
      this.fleeFrom(p, 150, dt);
    } else if (t && smaller && this.recoilT <= 0 && !(p.anchored && p.has('thickwall'))) {
      this.steer(t.x, t.y, 165, 4, dt);
      if (this.overlaps(t) && this.biteCd <= 0) {
        this.biteCd = 1.1;
        if (t.isDrone) t.damage(10);
        else p.damage(11, this);
        this.vx *= -0.5;
        this.vy *= -0.5;
      }
    } else {
      if (!this.nut || this.nut.dead) this.nut = this.world.nearestNutrient(this.x, this.y, 330);
      if (this.nut) {
        this.steer(this.nut.x, this.nut.y, 110, 3, dt);
        if (this.overlaps(this.nut)) {
          this.world.removeNutrient(this.nut);
          this.nut = null;
        }
      } else this.wander(dt, 70);
    }
    this.move(dt);
    if (this.overlaps(p)) {
      this.touchPlayer(dt);
      if (p.anchored && p.has('thickwall')) {
        this.fleeFrom(p, 200, dt);
        this.stunT = 0.3;
      }
    }
  }
}

// ---------------------------------------------------------------- AMOEBA
// Big, slow, and it lunges after a clear telegraph. Dodge sideways late. Engulfs the small.
export class Amoeba extends Entity {
  constructor(world, x, y) {
    super(world, x, y);
    this.r = rand(30, 40) + world.player.level * 0.8;
    this.color = '#b7ff6a';
    this.label = 'an amoeba';
    this.kind = 'amoeba';
    this.maxHp = 130 * world.director.preyArmor;
    this.hp = this.maxHp;
    this.foodBiomass = 14;
    this.foodEnergy = 50;
    this.state = 'wander';
    this.stateT = 0;
    this.lungeDir = 0;
    this.held = null;
    this.biteable = true; // jaws can hurt it even if bigger (but only eat with engulf/apex)
  }
  release() {
    this.held = null;
    this.state = 'cool';
    this.stateT = 2.5;
  }
  update(dt) {
    this.tickCommon(dt);
    const p = this.player;
    const tele = p.has('sense') ? 0.95 : 0.7;
    const kin = p.has('mimicry') && !p.has('jaws');
    if (this.stunT > 0) {
      this.move(dt);
      return;
    }
    if (this.recoilT > 0 && this.state !== 'hold') {
      this.fleeFrom(p, 90, dt);
      this.move(dt);
      if (this.overlaps(p)) this.touchPlayer(dt);
      return;
    }
    const t = kin ? p.decoy || null : this.target(300);
    switch (this.state) {
      case 'wander':
        this.wander(dt, 45);
        if (t && dist(this, t) < 240 && !(t === p && p.cystT > 0)) {
          this.state = 'tele';
          this.stateT = tele;
          this.vx *= 0.3;
          this.vy *= 0.3;
        }
        break;
      case 'tele':
        this.stateT -= dt;
        this.vx = approach(this.vx, 0, 5, dt);
        this.vy = approach(this.vy, 0, 5, dt);
        if (t) this.lungeDir = angleTo(this, t);
        if (this.stateT <= 0) {
          this.state = 'lunge';
          this.stateT = 0.5;
          this.world.audio.play('lunge');
        }
        break;
      case 'lunge':
        this.stateT -= dt;
        this.vx = Math.cos(this.lungeDir) * 470;
        this.vy = Math.sin(this.lungeDir) * 470;
        if (this.stateT <= 0) {
          this.state = 'cool';
          this.stateT = 2.2;
          p.stats.dodges++;
        }
        break;
      case 'cool':
        this.stateT -= dt;
        this.vx = approach(this.vx, 0, 3, dt);
        this.vy = approach(this.vy, 0, 3, dt);
        if (this.stateT <= 0) this.state = 'wander';
        break;
      case 'hold':
        this.stateT -= dt;
        this.vx = approach(this.vx, 0, 3, dt);
        this.vy = approach(this.vy, 0, 3, dt);
        if (this.held === p) {
          p.damage(16 * dt, this, { silent: true });
          if (p.holder !== this) {
            this.release();
          }
        }
        if (this.stateT <= 0) {
          if (p.holder === this) {
            p.holder = null;
            p.heldT = 0;
          }
          this.release();
        }
        break;
    }
    this.move(dt);
    // contact
    if (this.state !== 'hold' && this.overlaps(p)) {
      const hurt = this.touchPlayer(dt);
      if (this.state === 'lunge' && !hurt && p.cystT <= 0 && !(p.dashT > 0 && p.has('phantom'))) {
        if (p.r < this.r * 0.9) {
          this.state = 'hold';
          this.stateT = 1.1;
          this.held = p;
          p.holder = this;
          p.heldT = 1.1;
          p.damage(14, this);
          this.world.audio.play('engulf');
        } else {
          p.damage(18, this);
          const a = angleTo(this, p);
          p.vx += Math.cos(a) * 400;
          p.vy += Math.sin(a) * 400;
          this.state = 'cool';
          this.stateT = 2;
        }
      }
    }
    for (const d of p.drones)
      if (this.state === 'lunge' && this.overlaps(d)) {
        d.damage(30);
        this.state = 'cool';
        this.stateT = 2;
      }
  }
}

// ---------------------------------------------------------------- PARASITE
// Latches on and drains energy. Dash shakes them off, spikes kill them, cell wall blocks them.
export class Parasite extends Entity {
  constructor(world, x, y) {
    super(world, x, y);
    this.r = 5;
    this.color = '#ff7a3d';
    this.label = 'a parasite';
    this.kind = 'parasite';
    this.maxHp = 10;
    this.hp = 10;
    this.attached = false;
    this.attachAng = 0;
    this.attachT = 0;
    this.thrownT = 0;
    this.foodBiomass = 1;
    this.foodEnergy = 12;
    this.despawnOutside = true;
  }
  detach(thrown) {
    this.attached = false;
    if (thrown) {
      this.thrownT = 2;
      const a = rand(TAU);
      this.vx = Math.cos(a) * 400;
      this.vy = Math.sin(a) * 400;
      this.stunT = 1.5;
    } else {
      this.fleeing = true;
    }
  }
  update(dt) {
    this.tickCommon(dt);
    const p = this.player;
    if (this.attached) {
      this.attachT -= dt;
      this.x = p.x + Math.cos(this.attachAng) * (p.r + 2);
      this.y = p.y + Math.sin(this.attachAng) * (p.r + 2);
      if (p.has('spikes')) {
        this.kill(p);
        return;
      }
      if (this.attachT <= 0 || p.cystT > 0 || p.dead) {
        this.detach(false);
        const i = p.parasites.indexOf(this);
        if (i >= 0) p.parasites.splice(i, 1);
      }
      return;
    }
    if (this.fleeing) {
      this.fleeFrom(p, 220, dt);
      this.move(dt);
      return;
    }
    if (this.stunT > 0) {
      this.vx *= 0.96;
      this.vy *= 0.96;
      this.move(dt);
      return;
    }
    const t = p.has('mimicry') ? p.decoy || null : this.target(800);
    if (t) this.steer(t.x, t.y, 265, 3.5, dt);
    else this.wander(dt, 90);
    this.move(dt);
    const o = t && this.overlaps(t) ? t : this.overlaps(p) ? p : null;
    if (o === p) {
      if (p.has('spikes')) {
        this.kill(p);
        return;
      }
      if (p.dashT > 0 && p.has('phantom')) return;
      if (p.cystT > 0 || (p.anchored && p.has('thickwall') && p.anchorT >= 1)) {
        this.fleeFrom(p, 250, dt);
        this.stunT = 0.5;
        return;
      }
      if (p.parasites.length < 3) {
        this.attached = true;
        this.attachT = 7;
        this.attachAng = angleTo(p, this);
        p.parasites.push(this);
        this.world.audio.play('latch');
        this.world.toast(p.canDash ? 'Parasite latched: burst to shake it off' : 'Parasite latched: it drains your energy', 2.5);
      }
    } else if (o && o.isDrone) {
      o.damage(4 * dt);
    }
  }
}

// ---------------------------------------------------------------- PACK HUNTER
// Three cells circle you and take turns lunging. Fight the one that commits.
export class Hunter extends Entity {
  constructor(world, x, y, pack) {
    super(world, x, y);
    this.r = 11 + world.player.level * 0.5;
    this.color = '#ff5a5a';
    this.label = 'a pack hunter';
    this.kind = 'hunter';
    this.maxHp = 42 * world.director.preyArmor;
    this.hp = this.maxHp;
    this.foodBiomass = 6;
    this.foodEnergy = 30;
    this.pack = pack;
    this.orbit = rand(TAU);
    this.state = 'circle';
    this.stateT = 0;
    this.lungeDir = 0;
    this.lost = 0;
  }
  update(dt) {
    this.tickCommon(dt);
    const p = this.player;
    if (this.stunT > 0) {
      this.move(dt);
      return;
    }
    if (this.recoilT > 0) {
      this.fleeFrom(p, 200, dt);
      this.move(dt);
      return;
    }
    const t = this.target(this.lost > 3 ? 320 : 1100);
    if (!t) {
      this.lost += dt;
      this.wander(dt, 80);
      this.move(dt);
      return;
    }
    this.lost = 0;
    const dp = dist(this, t);
    const speed = 180 + p.level * 2;
    if (this.state === 'circle') {
      this.orbit += dt * 1.3;
      const ox = t.x + Math.cos(this.orbit) * 150,
        oy = t.y + Math.sin(this.orbit) * 150;
      this.steer(ox, oy, dp > 400 ? speed * 1.25 : speed, 5, dt);
      // pack timer: the pack decides who lunges
      this.pack.t -= dt / this.pack.members.filter((m) => !m.dead).length;
      if (this.pack.t <= 0 && dp < 260) {
        this.pack.t = 2.0;
        this.state = 'tele';
        this.stateT = p.has('sense') ? 0.7 : 0.45;
      }
    } else if (this.state === 'tele') {
      this.stateT -= dt;
      this.vx = approach(this.vx, 0, 6, dt);
      this.vy = approach(this.vy, 0, 6, dt);
      this.lungeDir = angleTo(this, t);
      if (this.stateT <= 0) {
        this.state = 'lunge';
        this.stateT = 0.4;
        this.world.audio.play('lunge', 0.6);
      }
    } else if (this.state === 'lunge') {
      this.stateT -= dt;
      this.vx = Math.cos(this.lungeDir) * 430;
      this.vy = Math.sin(this.lungeDir) * 430;
      if (this.stateT <= 0) {
        this.state = 'circle';
        p.stats.dodges++;
      }
    }
    this.move(dt);
    if (this.overlaps(p)) {
      const hurt = this.touchPlayer(dt);
      if (this.state === 'lunge' && !(p.dashT > 0 && p.has('phantom'))) {
        p.damage(hurt ? 8 : 15, this);
        this.state = 'circle';
        const a = angleTo(p, this);
        this.vx = Math.cos(a) * 300;
        this.vy = Math.sin(a) * 300;
      }
    }
    for (const d of p.drones)
      if (this.state === 'lunge' && this.overlaps(d)) {
        d.damage(14);
        this.state = 'circle';
      }
  }
}

// ---------------------------------------------------------------- ANTIBODY
// Follows your scent trail. Go stealthy, outrun the trail, or cross it with a decoy.
export class Antibody extends Entity {
  constructor(world, x, y) {
    super(world, x, y);
    this.r = 7;
    this.color = '#ffffff';
    this.label = 'an antibody';
    this.kind = 'antibody';
    this.maxHp = 18;
    this.hp = 18;
    this.foodBiomass = 2;
    this.foodEnergy = 10;
    this.trailIdx = -1;
    this.reacq = 0;
    this.life = 40;
    this.despawnOutside = true;
  }
  update(dt) {
    this.tickCommon(dt);
    const p = this.player;
    this.life -= dt;
    if (this.life <= 0) {
      this.dead = true;
      return;
    }
    if (this.stunT > 0) {
      this.move(dt);
      return;
    }
    const direct = this.target(p.markedT > 0 ? 900 : 170);
    if (direct) {
      this.steer(direct.x, direct.y, 215, 4, dt);
    } else {
      this.reacq -= dt;
      const trail = p.scent;
      if (this.reacq <= 0 || this.trailIdx >= trail.length) {
        this.reacq = 1;
        let best = -1,
          bd = 420;
        for (let i = 0; i < trail.length; i++) {
          const d = dist(this, trail[i]);
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
        this.trailIdx = best;
      }
      const pt = trail[this.trailIdx];
      if (pt) {
        this.steer(pt.x, pt.y, 200, 5, dt);
        if (dist(this, pt) < 14) this.trailIdx++;
      } else this.wander(dt, 110);
    }
    this.move(dt);
    if (this.overlaps(p)) {
      if (p.has('spikes')) {
        this.kill(p);
        return;
      }
      if (p.dashT > 0 && p.has('phantom')) return;
      p.damage(10, this);
      p.markedT = 4;
      this.dead = true;
      this.world.burst(this.x, this.y, this.color, 8);
      this.world.toast('Marked: antibodies converge on you', 2.5);
    }
    for (const d of p.drones)
      if (this.overlaps(d)) {
        d.damage(10);
        this.dead = true;
        return;
      }
  }
}

// ---------------------------------------------------------------- MACROPHAGE
// Enormous, slow, relentless. Eats everything including other threats. Lead it where you want it.
export class Macrophage extends Entity {
  constructor(world, x, y) {
    super(world, x, y);
    this.r = 62;
    this.color = '#d9b3ff';
    this.label = 'the macrophage';
    this.kind = 'macrophage';
    this.maxHp = 700;
    this.hp = this.maxHp;
    this.foodBiomass = 40;
    this.foodEnergy = 100;
    this.biteable = true;
    this.pull = 0;
  }
  update(dt) {
    this.tickCommon(dt);
    const p = this.player;
    const t = this.target(2000);
    const speed = 58 + (p.has('juggernaut') ? 20 : 0);
    if (t) this.steer(t.x, t.y, speed, 1.2, dt);
    else this.wander(dt, 40);
    this.move(dt);
    // eats other threats
    for (const o of this.world.threats) {
      if (o !== this && !o.dead && !o.boss && this.overlaps(o) && dist(this, o) < this.r) {
        o.dead = true;
        this.world.burst(o.x, o.y, o.color, 10);
        this.hp = Math.min(this.maxHp, this.hp + 15);
      }
    }
    for (const n of this.world.nutrients) if (!n.dead && this.overlaps(n)) this.world.removeNutrient(n);
    if (this.overlaps(p)) {
      this.touchPlayer(dt);
      if (p.cystT <= 0 && !(p.dashT > 0 && p.has('phantom'))) {
        p.damage(26 * dt, this, { silent: true });
        if (!p.has('juggernaut')) {
          const a = angleTo(p, this);
          p.vx += Math.cos(a) * 260 * dt * 10;
          p.vy += Math.sin(a) * 260 * dt * 10;
        }
      }
    }
    for (const d of p.drones) if (this.overlaps(d)) d.damage(20 * dt);
  }
}

// ---------------------------------------------------------------- LEVIATHAN
// The final pressure. Telegraphed lunges, phage bursts, and it never stops hunting.
export class Leviathan extends Entity {
  constructor(world, x, y) {
    super(world, x, y);
    this.r = 85;
    this.color = '#ff4d7a';
    this.label = 'the Leviathan';
    this.kind = 'leviathan';
    this.boss = true;
    this.maxHp = 1600;
    this.hp = this.maxHp;
    this.foodBiomass = 60;
    this.foodEnergy = 150;
    this.biteable = true;
    this.state = 'hunt';
    this.stateT = 0;
    this.burstT = 5;
    this.lungeT = 6;
    this.lungeDir = 0;
  }
  update(dt) {
    this.tickCommon(dt);
    const p = this.player;
    const t = this.target(3000);
    this.burstT -= dt;
    if (this.burstT <= 0) {
      this.burstT = 6;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const ph = new Phage(this.world, this.x + Math.cos(a) * (this.r + 10), this.y + Math.sin(a) * (this.r + 10));
        ph.heading = a;
        ph.homing = 2.2;
        this.world.threats.push(ph);
      }
      this.world.audio.play('burst');
    }
    if (this.state === 'hunt') {
      if (t) this.steer(t.x, t.y, 80, 1.5, dt);
      else this.wander(dt, 40);
      this.lungeT -= dt;
      if (this.lungeT <= 0 && t && dist(this, t) < 520) {
        this.state = 'tele';
        this.stateT = p.has('sense') ? 1.3 : 1.0;
        this.lungeT = 7;
      }
    } else if (this.state === 'tele') {
      this.stateT -= dt;
      this.vx = approach(this.vx, 0, 4, dt);
      this.vy = approach(this.vy, 0, 4, dt);
      if (t) this.lungeDir = angleTo(this, t);
      if (this.stateT <= 0) {
        this.state = 'lunge';
        this.stateT = 0.7;
        this.world.audio.play('lunge');
        this.world.shake(6);
      }
    } else if (this.state === 'lunge') {
      this.stateT -= dt;
      this.vx = Math.cos(this.lungeDir) * 560;
      this.vy = Math.sin(this.lungeDir) * 560;
      if (this.stateT <= 0) {
        this.state = 'hunt';
        p.stats.dodges++;
      }
    }
    this.move(dt);
    if (this.overlaps(p)) {
      this.touchPlayer(dt);
      if (p.cystT <= 0 && !(p.dashT > 0 && p.has('phantom'))) {
        p.damage((this.state === 'lunge' ? 40 : 14) * (this.state === 'lunge' ? 1 : dt), this, { silent: this.state !== 'lunge' });
        if (this.state === 'lunge') {
          const a = angleTo(this, p);
          p.vx += Math.cos(a) * 600;
          p.vy += Math.sin(a) * 600;
          this.state = 'hunt';
        }
      }
    }
    for (const d of p.drones) if (this.overlaps(d)) d.damage(25 * dt);
  }
}

export const THREAT_CLASSES = { Acid, Phage, Grazer, Amoeba, Parasite, Hunter, Antibody, Macrophage, Leviathan };
