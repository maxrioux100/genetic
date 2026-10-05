import { CFG } from './config.js';
import { clamp, approach, dist, rand, TAU, angleTo } from './util.js';
import { PERK_BY_ID, formTier } from './perks.js';

export class Player {
  constructor(world) {
    this.world = world;
    this.x = CFG.world.w / 2;
    this.y = CFG.world.h / 2;
    this.vx = 0;
    this.vy = 0;
    this.heading = 0;
    this.level = 0;
    this.xp = 0;
    this.perks = new Set();
    this.perkCounts = {};
    this.dead = false;
    this.ally = true;
    this.label = 'you';

    this.dashT = 0;
    this.dashCd = 0;
    this.abilityCd = 0;
    this.charge = 0; // volt discharge charge
    this.lastHit = 99;
    this.hitFlash = 0;
    this.stunT = 0;
    this.invulnT = 0;
    this.whipT = 0;
    this.biting = 0;
    this.zapT = 0;
    this.stormT = 0;
    this.spawnT = 0;
    this.acidT = 0;
    this.legionUsed = false;

    // serpent
    this.trail = []; // head path history [{x,y}]
    this.segments = []; // [{x,y,r,idx}]

    this.spawnlings = [];
    this.stats = { eaten: 0, kills: 0, damage: 0, biggestEaten: 0 };
    this.recompute();
    this.hp = this.maxHp;
  }

  has(id) {
    return this.perks.has(id);
  }
  count(id) {
    return this.perkCounts[id] || 0;
  }
  tier(form) {
    return formTier(this.perks, form);
  }
  get r() {
    return CFG.player.baseRadius + this.level * CFG.player.radiusPerLevel;
  }
  get speedFrac() {
    return Math.hypot(this.vx, this.vy) / this.maxSpeed;
  }
  get swallowRatio() {
    return this.has('gulp') ? 0.6 : CFG.player.swallowRatio;
  }
  get ability() {
    for (const id of this.perks) if (PERK_BY_ID[id].ability) return PERK_BY_ID[id].ability;
    return null;
  }
  get segmentCount() {
    const t = this.tier('serpent');
    if (!t) return 0;
    let n = 7;
    if (t >= 2) n += 4;
    if (t >= 3) n += 4;
    if (t >= 5) n *= 2;
    return n;
  }
  get bodyDps() {
    const t = this.tier('serpent');
    if (!t) return 0;
    let d = 12 + this.level * 3;
    if (t >= 2) d *= 2;
    if (t >= 4) d *= 2;
    return d;
  }
  get maxSpawnlings() {
    const t = this.tier('brood');
    if (!t) return 0;
    return t >= 5 ? 12 : t >= 2 ? 6 : 3;
  }

  recompute() {
    const P = CFG.player;
    let hp = P.baseHp + this.level * P.hpPerLevel;
    hp *= Math.pow(1.3, this.count('tough'));
    if (this.has('serpent4')) hp += this.segmentCount * 6;
    const prev = this.maxHp;
    this.maxHp = Math.round(hp);
    if (prev && this.hp !== undefined) this.hp = clamp(this.hp + (this.maxHp - prev), 1, this.maxHp);
    this.maxSpeed = P.baseSpeed * Math.pow(1.12, this.count('quick'));
    this.bite = (P.baseBite + this.level * P.bitePerLevel) * Math.pow(1.35, this.count('bite'));
    this.xpMul = Math.pow(1.2, this.count('appetite'));
    this.regen = P.regen + 2 * this.count('regen') + (this.has('serpent4') ? 1.5 : 0);
  }

  takePerk(id) {
    this.perks.add(id);
    this.perkCounts[id] = (this.perkCounts[id] || 0) + 1;
    this.recompute();
    if (id === 'tough') this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.3);
  }

  // ---------- actions ----------
  dash() {
    if (this.dashCd > 0 || this.stunT > 0) return false;
    this.dashT = CFG.player.dashTime;
    this.dashCd = CFG.player.dashCd * Math.pow(0.8, this.count('quick'));
    this.world.fx.burst(this.x, this.y, '#ffffff', 10, 160, 0.3, 2);
    this.world.audio.play('dash');
    return true;
  }
  useAbility(tx, ty) {
    const W = this.world;
    const ab = this.ability;
    if (!ab) return this.dash();
    if (this.abilityCd > 0 || this.stunT > 0) return false;
    switch (ab) {
      case 'whip': {
        const R = 100 + this.r * 3;
        const dmg = 35 + this.level * 9;
        for (const c of W.creatures) {
          if (c.dead || dist(this, c) > R + c.r) continue;
          c.damage(dmg, this, 'whip');
          const a = angleTo(this, c);
          c.vx += Math.cos(a) * 520;
          c.vy += Math.sin(a) * 520;
          c.stun(0.5);
        }
        W.fx.ring(this.x, this.y, '#4dffb0', this.r, R, 0.35, 8);
        W.fx.shake(6);
        W.audio.play('whip');
        this.abilityCd = 2.8;
        this.whipT = 0.3;
        return true;
      }
      case 'discharge': {
        if (this.charge < 0.35) {
          W.audio.play('nope', 0.4);
          return false;
        }
        const R = (200 + this.r * 3) * (0.6 + this.charge * 0.4);
        const dmg = (45 + this.level * 10) * this.charge;
        for (const c of W.creatures) {
          if (c.dead || dist(this, c) > R + c.r) continue;
          c.damage(dmg, this, 'zap');
          c.stun(1.4 * this.charge + 0.3);
          W.fx.lightning(this.x, this.y, c.x, c.y, '#bff3ff', 4, 0.25);
        }
        W.fx.ring(this.x, this.y, '#7ad7ff', this.r, R, 0.4, 10);
        W.fx.flashScreen(0.35, '#bff3ff');
        W.fx.shake(10);
        W.audio.play('discharge');
        this.charge = 0;
        this.abilityCd = 1.2;
        return true;
      }
      case 'command': {
        if (!this.spawnlings.length) {
          W.audio.play('nope', 0.4);
          return false;
        }
        for (const s of this.spawnlings) {
          s.command = { x: tx, y: ty };
          s.commandT = 3;
        }
        W.fx.ring(tx, ty, '#e07bff', 10, 70, 0.4, 4);
        W.audio.play('command');
        this.abilityCd = 3.5;
        return true;
      }
      case 'spit': {
        const a = angleTo(this, { x: tx, y: ty });
        const range = Math.min(520, dist(this, { x: tx, y: ty }));
        W.projectiles.push({ x: this.x, y: this.y, vx: Math.cos(a) * 640, vy: Math.sin(a) * 640, t: range / 640, r: 9 + this.r * 0.2 });
        W.audio.play('spit');
        this.abilityCd = 1.6;
        return true;
      }
    }
    return false;
  }

  // ---------- damage ----------
  damage(a, source, kind = 'bite') {
    if (this.dead || a <= 0 || this.invulnT > 0) return 0;
    this.hp -= a;
    this.lastHit = 0;
    this.hitFlash = 0.2;
    this.stats.damage += a;
    this.world.noteHurt(a, source, kind);
    if (source && this.has('venom1')) source.addPoison?.(8, 4);
    if (this.hp <= 0) this.die(source);
    return a;
  }
  die(source) {
    if (this.has('brood5') && !this.legionUsed && this.spawnlings.length) {
      this.legionUsed = true;
      this.hp = this.maxHp;
      for (const s of this.spawnlings) {
        this.world.fx.lightning(s.x, s.y, this.x, this.y, '#e07bff', 3, 0.5);
        s.dead = true;
      }
      this.spawnlings = [];
      this.stunT = 0;
      this.invulnT = 2;
      this.world.fx.ring(this.x, this.y, '#e07bff', this.r, 400, 0.8, 10);
      this.world.fx.flashScreen(0.6, '#e07bff');
      this.world.toast('THE LEGION RETURNS TO YOU', 3, 'era');
      this.world.audio.play('levelup');
      return;
    }
    this.dead = true;
    this.hp = 0;
    this.killer = source?.label || 'the sea';
    this.world.fx.chunks(this.x, this.y, '#79e6ff', 24, this.r * 0.5);
    this.world.fx.ring(this.x, this.y, '#ff4d4d', this.r, 500, 0.9, 10);
    this.world.fx.flashScreen(0.8, '#ff2a2a');
    this.world.fx.shake(20, 0.6);
  }

  gainXp(amount, x, y) {
    const v = amount * this.xpMul;
    this.xp += v;
    if (x !== undefined) this.world.fx.text(x, y - 10, `+${Math.round(v)}`, '#9df3ff', 13, 0.7);
  }

  // ---------- update ----------
  update(dt, input) {
    const P = CFG.player;
    const W = this.world;
    if (this.dead) return;
    this.dashCd = Math.max(0, this.dashCd - dt);
    this.abilityCd = Math.max(0, this.abilityCd - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.whipT = Math.max(0, this.whipT - dt);
    this.invulnT = Math.max(0, this.invulnT - dt);
    this.lastHit += dt;
    this.biting += dt;
    if (this.stunT > 0) this.stunT -= dt;

    // movement
    let dx = 0,
      dy = 0;
    if (this.stunT <= 0) {
      const d = input.moveDir(this);
      dx = d.x;
      dy = d.y;
    }
    if (this.dashT > 0) {
      this.dashT -= dt;
      this.vx = Math.cos(this.heading) * P.dashSpeed;
      this.vy = Math.sin(this.heading) * P.dashSpeed;
    } else {
      this.vx = approach(this.vx, dx * this.maxSpeed, P.accel, dt);
      this.vy = approach(this.vy, dy * this.maxSpeed, P.accel, dt);
      if (dx || dy) this.heading = Math.atan2(dy, dx);
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    const m = this.r;
    if (this.x < m) {
      this.x = m;
      this.vx = Math.abs(this.vx) * 0.5;
    }
    if (this.y < m) {
      this.y = m;
      this.vy = Math.abs(this.vy) * 0.5;
    }
    if (this.x > CFG.world.w - m) {
      this.x = CFG.world.w - m;
      this.vx = -Math.abs(this.vx) * 0.5;
    }
    if (this.y > CFG.world.h - m) {
      this.y = CFG.world.h - m;
      this.vy = -Math.abs(this.vy) * 0.5;
    }

    // regen out of combat
    if (this.lastHit > 3) this.hp = Math.min(this.maxHp, this.hp + this.regen * dt);

    this.updateSerpent(dt);
    this.updateVolt(dt);
    this.updateBrood(dt);
    this.updateVenom(dt);

    // level up
    const need = CFG.levels.xpNeed(this.level);
    if (this.xp >= need) {
      this.xp -= need;
      this.level++;
      this.recompute();
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.25);
      W.onLevelUp();
    }
  }

  updateSerpent(dt) {
    const n = this.segmentCount;
    if (!n) {
      this.segments = [];
      this.trail = [];
      return;
    }
    const last = this.trail[0];
    if (!last || Math.hypot(last.x - this.x, last.y - this.y) > 3) this.trail.unshift({ x: this.x, y: this.y });
    const spacing = this.r * 0.75;
    const segs = [];
    let acc = 0,
      target = spacing,
      i = 0;
    while (segs.length < n && i < this.trail.length - 1) {
      const a = this.trail[i],
        b = this.trail[i + 1];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      while (acc + d >= target && segs.length < n) {
        const f = (target - acc) / (d || 1);
        const k = segs.length;
        segs.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, r: this.r * (0.82 - (0.52 * k) / n), idx: k });
        target += spacing;
      }
      acc += d;
      i++;
    }
    // trail too short (just grew): stack the missing segments behind the last one
    while (segs.length < n) {
      const k = segs.length;
      const prev = segs[k - 1] || this;
      const s = {
        x: prev.x - Math.cos(this.heading) * spacing,
        y: prev.y - Math.sin(this.heading) * spacing,
        r: this.r * (0.82 - (0.52 * k) / n),
        idx: k,
      };
      segs.push(s);
      this.trail.push({ x: s.x, y: s.y });
    }
    if (this.trail.length > 600) this.trail.length = 600;
    this.segments = segs;
    // body contact
    const W = this.world;
    const dps = this.bodyDps;
    const t = this.tier('serpent');
    for (const c of W.creatures) {
      if (c.dead) continue;
      for (const s of segs) {
        if (dist(s, c) < s.r + c.r) {
          c.damage(dps * dt, this, 'body');
          if (t >= 2) c.slowT = 0.3;
          if (c.hp > 0 && c.r < s.r * 1.5) {
            const a = angleTo(s, c);
            c.vx += Math.cos(a) * 600 * dt;
            c.vy += Math.sin(a) * 600 * dt;
          }
          break;
        }
      }
    }
  }
  /** Is a point enclosed by the serpent's body loop? (Great Serpent) */
  wrapped(o) {
    if (this.tier('serpent') < 5 || this.segments.length < 8) return false;
    const poly = [this, ...this.segments];
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i],
        b = poly[j];
      if (a.y > o.y !== b.y > o.y && o.x < ((b.x - a.x) * (o.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  }

  updateVolt(dt) {
    const t = this.tier('volt');
    if (!t) return;
    const W = this.world;
    if (t >= 3) this.charge = clamp(this.charge + this.speedFrac * dt * 0.45, 0, 1);
    this.zapT -= dt;
    const rate = 1.6 * (t >= 2 ? 0.7 : 1);
    if (this.zapT <= 0) {
      const range = 230 + this.r * 2.5;
      const c = W.nearestCreature(this.x, this.y, range, (o) => !o.dead);
      if (c) {
        this.zapT = rate;
        this.zap(c, t);
      } else this.zapT = 0.2;
    }
    if (t >= 5) {
      this.stormT -= dt;
      if (this.stormT <= 0) {
        this.stormT = 0.4;
        const near = W.creatures.filter((o) => !o.dead && dist(o, this) < 750);
        if (near.length) {
          const c = near[Math.floor(Math.random() * near.length)];
          c.damage((16 + this.level * 4) * 1.5, this, 'zap');
          c.stun(0.8);
          W.fx.lightning(c.x + rand(-80, 80), c.y - 500, c.x, c.y, '#e9f7ff', 3, 0.2);
          W.fx.burst(c.x, c.y, '#bff3ff', 6, 120, 0.3, 2);
          W.audio.play('zap', 0.5);
        }
      }
    }
  }
  zap(first, t) {
    const W = this.world;
    const dmg = (18 + this.level * 5) * (t >= 5 ? 1.5 : 1);
    let from = this;
    const hit = new Set();
    let target = first;
    const chain = t >= 2 ? 4 : 1;
    for (let i = 0; i < chain && target; i++) {
      target.damage(dmg * (i ? 0.7 : 1), this, 'zap');
      if (t >= 4) target.stun(1.2);
      W.fx.lightning(from.x, from.y, target.x, target.y, '#bff3ff', 3, 0.18);
      W.fx.burst(target.x, target.y, '#bff3ff', 5, 100, 0.25, 2);
      hit.add(target);
      from = target;
      target = W.nearestCreature(from.x, from.y, 210, (o) => !o.dead && !hit.has(o));
    }
    W.audio.play('zap');
  }

  updateBrood(dt) {
    const t = this.tier('brood');
    if (!t) return;
    this.spawnT -= dt;
    const every = t >= 4 ? 4 : 7;
    if (this.spawnT <= 0 && this.spawnlings.length < this.maxSpawnlings) {
      this.spawnT = every;
      const s = new Spawnling(this);
      this.spawnlings.push(s);
      this.world.fx.burst(s.x, s.y, '#e07bff', 10, 120, 0.4);
      this.world.audio.play('spawn');
    }
    for (const s of this.spawnlings) s.update(dt);
    this.spawnlings = this.spawnlings.filter((s) => !s.dead);
  }

  updateVenom(dt) {
    if (this.tier('venom') < 2) return;
    this.acidT -= dt;
    if (this.acidT <= 0 && this.speedFrac > 0.2) {
      this.acidT = 0.09;
      this.world.acid.push({
        x: this.x - Math.cos(this.heading) * this.r * 0.6,
        y: this.y - Math.sin(this.heading) * this.r * 0.6,
        r: this.r * 0.55,
        t: 3,
        max: 3,
      });
    }
  }
}

/** Brood spawnling: an allied hunter that feeds you. */
export class Spawnling {
  constructor(owner) {
    this.owner = owner;
    this.world = owner.world;
    const a = rand(TAU);
    this.x = owner.x + Math.cos(a) * owner.r * 1.5;
    this.y = owner.y + Math.sin(a) * owner.r * 1.5;
    this.vx = 0;
    this.vy = 0;
    this.heading = a;
    this.orbit = a;
    this.maxHp = 30 + owner.level * 6;
    this.hp = this.maxHp;
    this.dead = false;
    this.ally = true;
    this.label = 'spawnling';
    this.command = null;
    this.commandT = 0;
    this.target = null;
    this.retarget = 0;
  }
  get r() {
    return this.owner.r * (this.owner.has('brood4') ? 0.45 : 0.3);
  }
  get bite() {
    return (10 + this.owner.level * 3) * (this.owner.has('brood4') ? 2 : 1);
  }
  get color() {
    return '#e07bff';
  }
  damage(a) {
    this.hp -= a;
    if (this.hp <= 0 && !this.dead) {
      this.dead = true;
      this.world.fx.burst(this.x, this.y, this.color, 12, 150, 0.4);
    }
    return a;
  }
  explode() {
    const W = this.world;
    const R = 60 + this.r * 3;
    for (const c of W.creatures) if (!c.dead && dist(this, c) < R + c.r) c.damage(40 + this.owner.level * 8, this.owner, 'explode');
    W.fx.ring(this.x, this.y, '#e07bff', this.r, R, 0.35, 6);
    W.fx.burst(this.x, this.y, '#e07bff', 18, 220, 0.5);
    W.fx.shake(4);
    W.audio.play('explode', 0.7);
    this.dead = true;
  }
  update(dt) {
    const o = this.owner,
      W = this.world;
    if (o.has('brood2')) this.hp = Math.min(this.maxHp, this.hp + 3 * dt);
    this.orbit += dt;
    const speed = o.maxSpeed * 1.2;
    let tx, ty;
    if (this.command) {
      this.commandT -= dt;
      tx = this.command.x;
      ty = this.command.y;
      if (dist(this, this.command) < this.r + 8 || this.commandT <= 0) {
        this.explode();
        return;
      }
      for (const c of W.creatures)
        if (!c.dead && dist(this, c) < this.r + c.r) {
          this.explode();
          return;
        }
    } else {
      this.retarget -= dt;
      if (this.retarget <= 0 || !this.target || this.target.dead) {
        this.retarget = 0.5;
        this.target = W.nearestCreature(o.x, o.y, 330 + o.r * 2, (c) => !c.dead && c.r < this.r * 1.6);
      }
      if (this.target) {
        tx = this.target.x;
        ty = this.target.y;
      } else {
        const od = o.r + this.r + 18;
        tx = o.x + Math.cos(this.orbit) * od;
        ty = o.y + Math.sin(this.orbit) * od;
      }
    }
    const d = Math.hypot(tx - this.x, ty - this.y);
    if (d > 1) {
      const f = Math.min(1, d / 30);
      this.heading = Math.atan2(ty - this.y, tx - this.x);
      this.vx = approach(this.vx, ((tx - this.x) / d) * speed * f, 8, dt);
      this.vy = approach(this.vy, ((ty - this.y) / d) * speed * f, 8, dt);
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.target && !this.target.dead && dist(this, this.target) < this.r + this.target.r) {
      this.target.damage(this.bite * dt, this, 'bite');
    }
  }
}
