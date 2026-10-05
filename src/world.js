import { CFG } from './config.js';
import { rand, dist, clamp, TAU, angleTo } from './util.js';
import { Player } from './player.js';
import { Creature, ARCHETYPES, pickArchetype } from './creatures.js';
import { FX } from './fx.js';

export class World {
  constructor(audio) {
    this.audio = audio;
    this.fx = new FX();
    this.player = new Player(this);
    this.creatures = [];
    this.specks = [];
    this.acid = []; // venom trail [{x,y,r,t,max}]
    this.clouds = []; // poison clouds
    this.projectiles = [];
    this.toasts = [];
    this.time = 0;
    this.won = false;
    this.pendingLevelUp = false;
    this.introduced = new Set(['chaser']);
    this.banner = null; // {title, sub, t, max}
    this.spawnT = 0;
    this.boss = null;
    for (let i = 0; i < CFG.ecosystem.specks; i++) this.spawnSpeck(true);
    for (let i = 0; i < CFG.ecosystem.creatures; i++) this.spawnCreature(true);
    this.showBanner('THE SEA', 'Eat what is smaller. Flee what is bigger. Grow.', 4);
  }

  // ---------- messages ----------
  toast(msg, t = 2.5, kind = '') {
    this.toasts.push({ msg, t, kind, max: t });
  }
  showBanner(title, sub, t = 3.5) {
    this.banner = { title, sub, t, max: t };
  }

  // ---------- queries ----------
  nearestSpeck(x, y, range) {
    let best = null,
      bd = range;
    for (const s of this.specks) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }
  nearestCreature(x, y, range, filter) {
    let best = null,
      bd = range;
    for (const c of this.creatures) {
      if (c.dead || (filter && !filter(c))) continue;
      const d = Math.hypot(c.x - x, c.y - y) - c.r;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best;
  }
  /** Everything a creature may fear or hunt: other creatures, the player, spawnlings. */
  hostilesFor(c) {
    const out = [];
    for (const o of this.creatures) if (o !== c && !o.dead && !(c.queen && o.queen === c.queen)) out.push(o);
    const p = this.player;
    if (!p.dead) {
      out.push(p);
      for (const s of p.spawnlings) out.push(s);
    }
    return out;
  }
  /** The player-side target a predator should chase, if any (nearest of head and spawnlings). */
  playerTarget(c, range = Infinity) {
    const p = this.player;
    if (p.dead) return null;
    let best = null,
      bd = range;
    const consider = (o) => {
      const d = dist(c, o) - o.r;
      if (d < bd && c.canEat(o)) {
        bd = d;
        best = o;
      }
    };
    consider(p);
    if (p.has('brood2')) for (const s of p.spawnlings) consider(s);
    return best;
  }
  pullTargets() {
    const p = this.player;
    return p.dead ? [] : [p, ...p.spawnlings];
  }
  minionsOf(q) {
    let n = 0;
    for (const c of this.creatures) if (!c.dead && c.queen === q) n++;
    return n;
  }

  // ---------- spawning ----------
  spawnSpeck(anywhere = false) {
    const p = this.player;
    let x, y;
    if (anywhere) {
      x = rand(20, CFG.world.w - 20);
      y = rand(20, CFG.world.h - 20);
    } else {
      const a = rand(TAU),
        d = rand(300, 1600);
      x = clamp(p.x + Math.cos(a) * d, 20, CFG.world.w - 20);
      y = clamp(p.y + Math.sin(a) * d, 20, CFG.world.h - 20);
    }
    this.specks.push({ x, y, r: 3, ph: rand(TAU) });
  }
  spawnPos(anywhere = false) {
    const p = this.player;
    const E = CFG.ecosystem;
    for (let i = 0; i < 10; i++) {
      const a = rand(TAU),
        d = anywhere ? rand(300, 1800) : rand(E.spawnMin, E.spawnMax);
      const x = p.x + Math.cos(a) * d,
        y = p.y + Math.sin(a) * d;
      if (x > 60 && y > 60 && x < CFG.world.w - 60 && y < CFG.world.h - 60) return { x, y };
    }
    return { x: rand(100, CFG.world.w - 100), y: rand(100, CFG.world.h - 100) };
  }
  spawnCreature(anywhere = false) {
    const p = this.player;
    const E = CFG.ecosystem;
    let r = Math.random();
    let cls = E.mix[0];
    for (const m of E.mix) {
      r -= m.weight;
      cls = m;
      if (r <= 0) break;
    }
    // the first seconds are gentler
    if (cls.kind === 'predator' && p.level === 0 && this.time < 25 && Math.random() < 0.6) cls = E.mix[0];
    if (cls.kind === 'predator') {
      const near = this.creatures.filter((c) => !c.dead && c.kind === 'predator' && dist(c, p) < 1100).length;
      if (near >= 2 + Math.floor(p.level / 4)) cls = E.mix[1];
    }
    const size = p.r * rand(cls.min, cls.max);
    const pos = this.spawnPos(anywhere);
    if (cls.kind === 'predator') {
      this.spawnPredator(pickArchetype(p.level), size, pos);
      return;
    }
    this.creatures.push(new Creature(this, pos.x, pos.y, size, cls.kind, 'grazer'));
  }
  spawnPredator(arch, size, pos = this.spawnPos()) {
    if (arch === 'pack') {
      const pack = { t: 2, members: [] };
      for (let i = 0; i < 3; i++) {
        const c = new Creature(this, pos.x + rand(-50, 50), pos.y + rand(-50, 50), size * 0.62, 'predator', 'pack', { pack });
        pack.members.push(c);
        this.creatures.push(c);
      }
      this.introduce('pack');
      return;
    }
    const mul = arch === 'leviathan' ? 1.6 : arch === 'queen' ? 1.1 : 1;
    this.creatures.push(new Creature(this, pos.x, pos.y, size * mul, 'predator', arch));
    this.introduce(arch);
  }
  introduce(arch) {
    if (this.introduced.has(arch)) return;
    this.introduced.add(arch);
    const a = ARCHETYPES.find((x) => x.id === arch);
    this.showBanner(`NEW PREDATOR: ${a.name.toUpperCase()}`, a.tell, 5);
    this.audio.play('warn');
  }
  spawnBoss() {
    const p = this.player;
    const pos = this.spawnPos();
    const c = new Creature(this, pos.x, pos.y, p.r * 2.6, 'predator', 'oldone');
    this.creatures.push(c);
    this.boss = c;
    this.introduce('oldone');
    this.audio.play('boss');
  }

  manage(dt) {
    const E = CFG.ecosystem;
    const p = this.player;
    for (const c of this.creatures) if (!c.boss && dist(c, p) > E.despawnDist) c.dead = true;
    this.creatures = this.creatures.filter((c) => !c.dead);
    this.spawnT -= dt;
    if (this.creatures.length < E.creatures && this.spawnT <= 0) {
      this.spawnT = 0.25;
      this.spawnCreature();
    }
    this.specks = this.specks.filter((s) => dist(s, p) < E.despawnDist);
    while (this.specks.length < E.specks) this.spawnSpeck();
    if (p.level >= 16 && !this.boss && !this.bossDead) this.spawnBoss();
  }

  // ---------- events ----------
  noteDamage(c, a, kind) {
    if (kind === 'poison' || kind === 'body' || kind === 'acid' || kind === 'cloud' || a < 8) return;
    const color = kind === 'zap' ? '#bff3ff' : kind === 'whip' ? '#4dffb0' : kind === 'explode' ? '#e07bff' : '#ffffff';
    this.fx.text(c.x + rand(-8, 8), c.y - c.r, Math.round(a), color, 13 + Math.min(10, a / 10), 0.6);
  }
  noteHurt(a, source, kind) {
    const p = this.player;
    this.fx.shake(Math.min(14, a * 0.5));
    if (a >= 6 || kind !== 'bite') {
      this.fx.text(p.x + rand(-10, 10), p.y - p.r - 6, `-${Math.round(a)}`, '#ff5a5a', 16, 0.7);
      this.audio.play('hurt');
      this.fx.burst(p.x, p.y, '#ff5a5a', 6, 140, 0.3, 2.5);
    }
  }
  kill(c, source, kind) {
    if (c.dead) return;
    c.dead = true;
    const p = this.player;
    if (c.boss) {
      this.boss = null;
      this.bossDead = true;
    }
    const byPlayer = source === p || source?.ally;
    this.fx.chunks(c.x, c.y, c.color, Math.min(24, 6 + c.r * 0.4), Math.max(3, c.r * 0.3));
    this.fx.burst(c.x, c.y, '#ffffff', 8, 200, 0.3, 2);
    if (c.r > p.r * 0.8) {
      this.fx.ring(c.x, c.y, c.color, c.r, c.r * 3, 0.5, 6);
      this.fx.shake(Math.min(12, c.r * 0.2));
    }
    if (byPlayer) {
      p.stats.kills++;
      p.stats.eaten++;
      p.stats.biggestEaten = Math.max(p.stats.biggestEaten, c.r);
      p.gainXp(c.xp, c.x, c.y);
      p.hp = Math.min(p.maxHp, p.hp + c.r * 0.5);
      this.audio.play(c.r > p.r * 0.7 ? 'eatBig' : 'eatCell');
      if (c.boss) {
        this.showBanner('THE OLD ONE IS DEAD', 'Nothing in this sea can stop you now.', 5);
        this.fx.flashScreen(0.7, '#ffffff');
        this.audio.play('win');
      }
    } else if (source && source.grow) {
      source.grow(c.r * 0.25);
    }
    if (c.poisoned && p.has('venom5')) this.clouds.push({ x: c.x, y: c.y, r: 60 + c.r, t: 3, max: 3 });
    if (kind === 'poison' && c.r > 10) this.fx.burst(c.x, c.y, '#c6ff4a', 10, 160, 0.5);
  }
  onLevelUp() {
    const p = this.player;
    this.pendingLevelUp = true;
    this.fx.ring(p.x, p.y, '#ffffff', p.r, 420, 0.7, 8);
    this.fx.ring(p.x, p.y, '#ffd27a', p.r, 260, 0.5, 5);
    this.fx.burst(p.x, p.y, '#ffd27a', 30, 260, 0.8, 3);
    this.fx.flashScreen(0.4, '#ffffff');
    this.fx.shake(6);
    this.audio.play('levelup');
    // a newly unlocked predator shows up at once, so the banner and the threat arrive together
    for (const a of ARCHETYPES)
      if (a.level === p.level && a.id !== 'oldone' && !this.introduced.has(a.id)) this.spawnPredator(a.id, p.r * rand(1.4, 1.8));
    if (p.level >= CFG.levels.winLevel) this.won = true;
  }

  // ---------- update ----------
  update(dt, input) {
    const p = this.player;
    this.time += dt;
    if (this.fx.hitStop > 0) dt *= 0.15;
    p.update(dt, input);
    for (const c of this.creatures) if (!c.dead) c.update(dt);
    this.resolveContacts(dt);
    this.updateHazards(dt);
    this.manage(dt);
    this.fx.update(dt);
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
  }

  resolveContacts(dt) {
    const p = this.player;
    const P = CFG.player;
    const cs = this.creatures;
    // player vs specks
    if (!p.dead) {
      for (let i = this.specks.length - 1; i >= 0; i--) {
        const s = this.specks[i];
        const d = Math.hypot(s.x - p.x, s.y - p.y);
        if (d < p.r + s.r) {
          this.specks.splice(i, 1);
          p.gainXp(2);
          this.fx.burst(s.x, s.y, '#9df3ff', 2, 60, 0.25, 2);
          this.audio.play('eat', 0.5);
        } else if (d < p.r + 70) {
          s.x -= ((s.x - p.x) / d) * 160 * dt;
          s.y -= ((s.y - p.y) / d) * 160 * dt;
        }
      }
    }
    // creature vs creature: bigger bites smaller
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i];
      if (a.dead) continue;
      for (let j = i + 1; j < cs.length; j++) {
        const b = cs[j];
        if (b.dead) continue;
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const rr = a.r + b.r;
        if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
        const d = Math.hypot(dx, dy);
        if (d >= rr) continue;
        if (a.queen && a.queen === b.queen) continue;
        const [big, small] = a.r >= b.r ? [a, b] : [b, a];
        if (big.r > small.r * 1.2 && big.kind !== 'minion') {
          if (small.r < big.r * 0.45) this.kill(small, big, 'eaten');
          else small.damage(big.bite * 0.6 * dt, big, 'bite');
          if (p.has('venom5') && (big.poisoned || small.poisoned)) {
            if (!big.poisoned) big.addPoison(8, 3);
            if (!small.poisoned) small.addPoison(8, 3);
          }
        } else {
          const f = ((rr - d) / (d || 1)) * 0.25;
          a.x -= dx * f;
          a.y -= dy * f;
          b.x += dx * f;
          b.y += dy * f;
        }
      }
      // grazing
      if (a.kind !== 'predator' && a.r < 60) {
        for (let k = this.specks.length - 1; k >= 0; k--) {
          const s = this.specks[k];
          if (Math.abs(s.x - a.x) < a.r && Math.abs(s.y - a.y) < a.r && Math.hypot(s.x - a.x, s.y - a.y) < a.r) {
            this.specks.splice(k, 1);
            a.grow(0.08);
          }
        }
      }
    }
    if (p.dead) return;
    // player vs creatures
    for (const c of cs) {
      if (c.dead) continue;
      const d = dist(c, p);
      if (d >= c.r + p.r) {
        for (const s of p.spawnlings) if (c.r > s.r * 1.2 && dist(c, s) < c.r + s.r) s.damage(c.bite * 0.7 * dt, c);
        continue;
      }
      const stunnedEdible = c.stunT > 0 && p.has('volt4') && c.r < p.r * 1.3;
      const wrapped = p.wrapped(c);
      if (c.r < p.r * p.swallowRatio) {
        this.kill(c, p, 'swallow');
        this.fx.stop(0.04);
        continue;
      }
      if (c.r < p.r * P.eatRatio || stunnedEdible || wrapped) {
        c.damage(p.bite * dt * (wrapped ? 1.5 : 1), p, 'bite');
        p.biting = 0;
        const a = angleTo(p, c);
        c.vx += Math.cos(a) * 300 * dt;
        c.vy += Math.sin(a) * 300 * dt;
      } else if (c.r > p.r * P.dangerRatio) {
        if (c.stunT <= 0) {
          p.damage(c.bite * dt, c, 'bite');
          const a = angleTo(p, c);
          p.vx += Math.cos(a) * 400 * dt;
          p.vy += Math.sin(a) * 400 * dt;
        }
      } else {
        // rival: both bite, weaker
        c.damage(p.bite * 0.5 * dt, p, 'bite');
        if (c.stunT <= 0) p.damage(c.bite * 0.4 * dt, c, 'bite');
        const a = angleTo(c, p);
        p.vx += Math.cos(a) * 600 * dt;
        p.vy += Math.sin(a) * 600 * dt;
      }
    }
  }

  updateHazards(dt) {
    const p = this.player;
    for (const a of this.acid) a.t -= dt;
    this.acid = this.acid.filter((a) => a.t > 0);
    for (const c of this.clouds) c.t -= dt;
    this.clouds = this.clouds.filter((c) => c.t > 0);
    for (const q of this.projectiles) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.t -= dt;
      let hit = q.t <= 0;
      for (const c of this.creatures) if (!c.dead && dist(q, c) < q.r + c.r) hit = true;
      if (hit) {
        q.dead = true;
        this.clouds.push({ x: q.x, y: q.y, r: 80 + p.r * 1.2, t: 4, max: 4 });
        this.fx.burst(q.x, q.y, '#c6ff4a', 16, 200, 0.5);
        this.fx.ring(q.x, q.y, '#c6ff4a', 10, 80 + p.r * 1.2, 0.35, 4);
        this.audio.play('poison');
      }
    }
    this.projectiles = this.projectiles.filter((q) => !q.dead);
    if (!this.acid.length && !this.clouds.length) return;
    for (const c of this.creatures) {
      if (c.dead) continue;
      for (const a of this.acid) {
        if (Math.abs(a.x - c.x) < a.r + c.r && Math.abs(a.y - c.y) < a.r + c.r && dist(a, c) < a.r + c.r) {
          c.damage(10 * dt, p, 'acid');
          if (!c.poisoned) c.addPoison(6, 3);
          break;
        }
      }
      for (const k of this.clouds) {
        if (dist(k, c) < k.r + c.r) {
          c.damage(14 * dt, p, 'cloud');
          if (c.poison.length < 2) c.addPoison(8, 3);
        }
      }
    }
  }
}
