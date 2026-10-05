import { CFG } from './config.js';
import { clamp, approach, dist, rand, TAU } from './util.js';

export class Player {
  constructor(world) {
    this.world = world;
    this.x = CFG.world.w / 2;
    this.y = CFG.world.h / 2;
    this.vx = 0;
    this.vy = 0;
    this.heading = 0;
    this.level = 0;
    this.biomass = 0;
    this.mp = 1; // one free mutation at birth
    this.talents = new Set();
    this.dead = false;

    this.dashT = 0; // remaining dash time
    this.dashCd = 0;
    this.cystT = 0;
    this.cystCd = 0;
    this.anchored = false;
    this.anchorT = 0; // time spent anchoring up (anchoring takes a moment)
    this.poison = 0; // poison seconds on player (hunters have toxin, so do some threats)
    this.heldT = 0; // engulfed by amoeba/macrophage
    this.holder = null;
    this.bloodlustT = 0;
    this.markedT = 0; // antibodies marked you
    this.hitFlash = 0;
    this.bloomT = 0;
    this.scentT = 0;
    this.scent = []; // [{x,y,t}]
    this.parasites = []; // attached parasite entities
    this.drones = [];
    this.decoy = null; // phantom decoy {x,y,t}
    this.hiveT = 0;
    this.stillT = 0;
    this.lastDamageSource = null;

    this.stats = { kills: 0, eaten: 0, nutrients: 0, divisions: 0, damageTaken: 0, dodges: 0 };
    this.recompute();
    this.hp = this.maxHp;
    this.energy = this.maxEnergy;
  }

  has(id) { return this.talents.has(id); }
  get radius() { return CFG.player.baseRadius + this.level * CFG.player.radiusPerLevel; }
  get r() { return this.radius; }
  get eatRatio() { return this.has('engulf') ? 1.3 : CFG.player.eatRatio; }
  get canDash() { return (this.has('cilia') || this.has('streamline')) && !this.has('reef'); }
  get speedFrac() { return Math.hypot(this.vx, this.vy) / this.maxSpeed; }
  get stealthed() { return this.has('camo') && this.speedFrac < 0.4 && !this.anchored; }
  get invulnerable() { return this.cystT > 0; }
  get maxDrones() {
    if (!this.has('mitosis')) return 0;
    let n = 1;
    if (this.has('signal')) n += 1;
    if (this.has('swarm')) n += 2;
    if (this.has('hive')) n = 8;
    return n;
  }

  recompute() {
    const P = CFG.player;
    let maxHp = P.maxHp, maxEnergy = P.maxEnergy, speed = P.baseSpeed, dmgTaken = 1, metab = 1;
    if (this.has('membrane')) maxHp += 40;
    if (this.has('juggernaut')) maxHp += 100;
    if (this.has('phantom')) maxHp *= 0.7;
    if (this.has('hive')) maxHp *= 0.75;
    if (this.has('vacuole')) maxEnergy += 50;
    if (this.has('flagellum')) speed *= 1.3;
    if (this.has('shell')) speed *= 0.85;
    if (this.has('juggernaut')) speed *= 0.75;
    if (this.has('shell')) dmgTaken *= 0.7;
    if (this.has('bloodlust')) metab *= 1.25;
    if (this.has('apex')) metab *= 1.4;
    const prevMaxHp = this.maxHp;
    this.maxHp = Math.round(maxHp);
    this.maxEnergy = maxEnergy;
    this.maxSpeed = speed;
    this.dmgTaken = dmgTaken;
    this.metab = metab;
    if (prevMaxHp && this.hp !== undefined) this.hp = clamp(this.hp + (this.maxHp - prevMaxHp), 1, this.maxHp);
    if (this.energy !== undefined) this.energy = Math.min(this.energy, this.maxEnergy);
  }

  learn(id) {
    this.talents.add(id);
    this.recompute();
  }

  // ---------- actions ----------
  dash() {
    if (!this.canDash || this.dashCd > 0 || this.cystT > 0 || this.energy < CFG.player.dashCost) return false;
    if (this.anchored) this.anchored = false;
    this.energy -= CFG.player.dashCost;
    this.dashT = CFG.player.dashTime;
    this.dashCd = CFG.player.dashCd * (this.has('streamline') ? 0.6 : 1);
    // shake off parasites
    for (const p of this.parasites) p.detach(true);
    this.parasites = [];
    // escape holds
    if (this.holder) { this.holder.release?.(this); this.holder = null; this.heldT = 0; }
    if (this.has('phantom')) this.decoy = { x: this.x, y: this.y, t: 3, r: this.r };
    this.world.audio.play('dash');
    return true;
  }

  toggleAnchor() {
    if (!this.has('anchor')) return false;
    if (this.cystT > 0) return false;
    this.anchored = !this.anchored;
    this.anchorT = this.has('thickwall') ? 1 : 0;
    this.world.audio.play(this.anchored ? 'anchor' : 'unanchor');
    return true;
  }

  cyst() {
    if (!this.has('cyst') || this.cystCd > 0 || this.energy < CFG.player.cystCost) return false;
    this.energy -= CFG.player.cystCost;
    this.cystT = CFG.player.cystTime;
    this.cystCd = CFG.player.cystCd;
    for (const p of this.parasites) p.detach(true);
    this.parasites = [];
    if (this.holder) { this.holder.release?.(this); this.holder = null; this.heldT = 0; }
    this.poison = 0;
    this.world.audio.play('cyst');
    return true;
  }

  // ---------- damage / food ----------
  damage(amount, source, opts = {}) {
    if (this.dead || amount <= 0) return 0;
    if (this.cystT > 0) return 0;
    if (opts.kind === 'acid' && this.has('juggernaut')) return 0;
    if (opts.kind === 'poison' && this.has('juggernaut')) return 0;
    let a = amount * this.dmgTaken;
    if (this.anchored && this.anchorT >= 1) a *= 0.6;
    if (a >= this.hp && this.has('sacrifice') && this.drones.length > 0) {
      const d = this.drones.pop();
      d.dead = true;
      this.world.burst(d.x, d.y, '#c87cff', 18);
      this.world.toast('A drone gave itself for you');
      const ang = source ? Math.atan2(this.y - source.y, this.x - source.x) : rand(TAU);
      this.vx = Math.cos(ang) * 700; this.vy = Math.sin(ang) * 700;
      this.world.audio.play('sacrifice');
      return 0;
    }
    this.hp -= a;
    this.stats.damageTaken += a;
    this.hitFlash = 0.25;
    this.lastDamageSource = source?.label || opts.kind || 'the soup';
    if (!opts.silent) this.world.audio.play('hurt');
    if (!opts.silent) this.world.shake(Math.min(10, a * 0.4));
    if (this.has('juggernaut') && source && source.vx !== undefined && opts.kind !== 'poison') {
      const ang = Math.atan2(source.y - this.y, source.x - this.x);
      source.vx += Math.cos(ang) * 500; source.vy += Math.sin(ang) * 500;
      source.stunT = Math.max(source.stunT || 0, 0.6);
    }
    if (this.hp <= 0) this.die();
    return a;
  }

  die() {
    if (this.dead) return;
    if (this.has('hive') && this.drones.length > 0) {
      const d = this.drones.shift();
      this.x = d.x; this.y = d.y; d.dead = true;
      this.hp = this.maxHp * 0.5;
      this.energy = Math.max(this.energy, 40);
      this.cystT = 1.0; // moment of grace
      this.world.toast('Your mind jumps into a drone');
      this.world.burst(this.x, this.y, '#c87cff', 30);
      this.world.audio.play('evolve');
      return;
    }
    this.dead = true;
    this.hp = 0;
  }

  eatNutrient(n) {
    const mult = this.has('vacuole') ? 1.25 : 1;
    this.biomass += n.biomass * mult;
    this.energy = Math.min(this.maxEnergy, this.energy + n.energy);
    this.stats.nutrients++;
    this.world.audio.play(n.rich ? 'eatRich' : 'eat');
  }

  eatCell(c) {
    this.biomass += c.foodBiomass;
    this.energy = Math.min(this.maxEnergy, this.energy + c.foodEnergy);
    this.stats.eaten++;
    if (this.has('bloodlust')) { this.hp = Math.min(this.maxHp, this.hp + 25); this.bloodlustT = 2.5; }
    this.world.burst(c.x, c.y, c.color, 20);
    this.world.audio.play('eatCell');
  }

  // ---------- update ----------
  update(dt, input) {
    const P = CFG.player;
    const W = this.world;
    if (this.dead) return;

    // timers
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.cystCd = Math.max(0, this.cystCd - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.bloodlustT = Math.max(0, this.bloodlustT - dt);
    this.markedT = Math.max(0, this.markedT - dt);
    if (this.decoy && (this.decoy.t -= dt) <= 0) this.decoy = null;
    if (this.cystT > 0) this.cystT -= dt;
    if (this.anchored) this.anchorT = Math.min(1, this.anchorT + dt * 1.5);

    // movement
    let desiredX = 0, desiredY = 0;
    const immobile = this.cystT > 0 || this.anchored || this.heldT > 0;
    if (!immobile) {
      const dir = input.moveDir(this);
      desiredX = dir.x; desiredY = dir.y;
    }
    let speed = this.maxSpeed;
    if (this.bloodlustT > 0) speed *= 1.6;
    speed *= 1 - 0.12 * this.parasites.length;
    if (this.poison > 0) speed *= 0.9;
    if (this.dashT > 0) {
      this.dashT -= dt;
      const ang = this.heading;
      this.vx = Math.cos(ang) * P.dashSpeed; this.vy = Math.sin(ang) * P.dashSpeed;
    } else {
      this.vx = approach(this.vx, desiredX * speed, P.accel, dt);
      this.vy = approach(this.vy, desiredY * speed, P.accel, dt);
      if (desiredX || desiredY) this.heading = Math.atan2(desiredY, desiredX);
    }
    if (this.heldT > 0) {
      this.heldT -= dt;
      if (this.holder) { this.x = approach(this.x, this.holder.x, 6, dt); this.y = approach(this.y, this.holder.y, 6, dt); }
      this.vx = 0; this.vy = 0;
      if (this.heldT <= 0) this.holder = null;
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    // soft walls
    const m = this.r;
    if (this.x < m) { this.x = m; this.vx = Math.abs(this.vx) * 0.5; }
    if (this.y < m) { this.y = m; this.vy = Math.abs(this.vy) * 0.5; }
    if (this.x > CFG.world.w - m) { this.x = CFG.world.w - m; this.vx = -Math.abs(this.vx) * 0.5; }
    if (this.y > CFG.world.h - m) { this.y = CFG.world.h - m; this.vy = -Math.abs(this.vy) * 0.5; }

    // metabolism
    const sf = this.speedFrac;
    let drain = P.idleMetabolism * this.metab;
    if (!this.has('streamline')) drain += P.moveMetabolism * sf * sf * this.metab;
    if (this.anchored && this.anchorT >= 1) drain *= 0.3;
    if (this.cystT > 0) drain *= 0.5;
    this.energy -= drain * dt;
    // parasites
    for (const p of this.parasites) this.energy -= 5 * dt;
    // light
    const light = W.lightAt(this.x, this.y);
    if (light > 0 && this.has('chloroplast')) {
      this.energy += 5 * dt;
      if (this.anchored && this.anchorT >= 1) this.biomass += 0.9 * dt * (this.has('reef') ? 1.6 : 1);
    }
    if (this.has('reef') && this.anchored) this.energy += 1 * dt;
    if (this.has('symbiosis')) this.energy += 1.5 * this.drones.length * dt;
    this.energy = clamp(this.energy, 0, this.maxEnergy);
    if (this.energy <= 0) this.damage(P.starveDamage * dt, null, { kind: 'starvation', silent: true });
    // regen
    if (this.energy > this.maxEnergy * 0.6) this.hp = Math.min(this.maxHp, this.hp + P.hpRegenCostless * dt);
    if (this.has('regen') && this.energy > this.maxEnergy * 0.5) this.hp = Math.min(this.maxHp, this.hp + 3 * dt);
    // poison
    if (this.poison > 0) { this.poison -= dt; this.damage(4 * dt, null, { kind: 'poison', silent: true }); }

    // bloom
    if (this.has('bloom')) {
      this.bloomT += dt * (this.has('reef') && this.anchored ? 2 : 1);
      if (this.bloomT >= 6) {
        this.bloomT = 0;
        W.spawnBloom(this.x, this.y, this.r + 30, 6);
        this.world.audio.play('bloom');
      }
    }

    // scent trail
    this.scentT += dt;
    if (this.scentT >= P.scentInterval) {
      this.scentT = 0;
      if (!this.stealthed && this.cystT <= 0) this.scent.push({ x: this.x, y: this.y, t: P.scentLife });
    }
    for (let i = this.scent.length - 1; i >= 0; i--) if ((this.scent[i].t -= dt) <= 0) this.scent.splice(i, 1);
    if (sf < 0.15) this.stillT += dt; else this.stillT = 0;

    // hive replication
    if (this.has('hive')) {
      this.hiveT += dt;
      if (this.hiveT >= 25 && this.drones.length < this.maxDrones) { this.hiveT = 0; this.spawnDrone(); }
    }

    // division
    const need = CFG.levels.biomassNeed(this.level);
    if (this.biomass >= need) this.divide(need);
  }

  divide(need) {
    this.biomass -= need;
    this.level++;
    this.mp++;
    this.stats.divisions++;
    this.hp = Math.min(this.maxHp, this.hp + 20);
    if (CFG.levels.eraStartLevels.includes(this.level)) this.mp++;
    if (this.has('mitosis') && this.drones.length < this.maxDrones) this.spawnDrone();
    this.world.onDivide();
  }

  spawnDrone() {
    const d = new Drone(this);
    this.drones.push(d);
    this.world.burst(d.x, d.y, '#c87cff', 12);
  }
}

/** Colony drone: follows the player, eats nutrients, may fight. */
export class Drone {
  constructor(owner) {
    this.owner = owner;
    this.world = owner.world;
    const a = rand(TAU);
    this.x = owner.x + Math.cos(a) * 40;
    this.y = owner.y + Math.sin(a) * 40;
    this.vx = 0; this.vy = 0;
    this.orbit = a;
    this.maxHp = 30 + owner.level * 2;
    this.hp = this.maxHp;
    this.dead = false;
    this.label = 'drone';
    this.color = '#c87cff';
    this.isDrone = true;
  }
  get r() { return 6 + this.owner.level * 0.7; }
  damage(a) {
    this.hp -= a;
    if (this.hp <= 0) { this.dead = true; this.world.burst(this.x, this.y, this.color, 14); }
  }
  update(dt) {
    const o = this.owner, W = this.world;
    if (o.has('symbiosis')) this.hp = Math.min(this.maxHp, this.hp + 2 * dt);
    this.orbit += dt * 0.9;
    let tx, ty, speed = o.maxSpeed * 1.15;
    const nut = W.nearestNutrient(this.x, this.y, 170);
    const threat = o.has('swarm') ? W.nearestThreat(o.x, o.y, 160, (t) => t.hp !== undefined && !t.boss) : null;
    if (threat) { tx = threat.x; ty = threat.y; }
    else if (nut) { tx = nut.x; ty = nut.y; }
    else {
      const od = o.r + 26;
      tx = o.x + Math.cos(this.orbit) * od; ty = o.y + Math.sin(this.orbit) * od;
    }
    const d = Math.hypot(tx - this.x, ty - this.y);
    if (d > 2) {
      const f = Math.min(1, d / 40);
      this.vx = approach(this.vx, ((tx - this.x) / d) * speed * f, 8, dt);
      this.vy = approach(this.vy, ((ty - this.y) / d) * speed * f, 8, dt);
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    if (nut && dist(this, nut) < this.r + nut.r) {
      W.removeNutrient(nut);
      o.biomass += nut.biomass * 0.7;
      o.energy = Math.min(o.maxEnergy, o.energy + nut.energy * 0.5);
      W.audio.play('eat', 0.4);
    }
    if (threat && dist(this, threat) < this.r + threat.r) {
      threat.damage?.(9 * dt, this);
    }
  }
}
