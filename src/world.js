import { CFG } from './config.js';
import { rand, clamp, TAU, pick } from './util.js';
import { Player } from './player.js';
import { Acid, Phage, Grazer, Amoeba, Parasite, Hunter, Antibody, Macrophage, Leviathan } from './threats.js';

export const ERAS = [
  {
    name: 'Primordial Soup',
    level: 0,
    flavor: 'Eat. Divide. Something is already hunting.',
    spawns: { acid: 3, phageWave: { every: 10, n: 3 } },
    nutrients: 150,
    lightR: 230,
    lights: 3,
  },
  {
    name: 'Competition',
    level: 3,
    flavor: 'The soup is crowded. Grazers want your food, amoebas want you.',
    spawns: { acid: 3, phageWave: { every: 9, n: 4 }, grazer: 7, amoeba: 2 },
    nutrients: 130,
    lightR: 200,
    lights: 3,
  },
  {
    name: 'Arms Race',
    level: 6,
    flavor: 'Parasites latch. Packs circle. The light is shrinking.',
    spawns: { acid: 4, phageWave: { every: 8, n: 5 }, grazer: 7, amoeba: 3, parasite: 4, pack: 1 },
    nutrients: 110,
    lightR: 170,
    lights: 3,
  },
  {
    name: 'Immune Response',
    level: 9,
    flavor: 'Something vast has noticed you. Antibodies follow your scent.',
    spawns: {
      acid: 4,
      phageWave: { every: 8, n: 5 },
      grazer: 6,
      amoeba: 3,
      parasite: 5,
      pack: 2,
      antibodyWave: { every: 16, n: 4 },
      macrophage: 1,
    },
    nutrients: 100,
    lightR: 150,
    lights: 2,
  },
  {
    name: 'Cambrian Dawn',
    level: 12,
    flavor: 'The Leviathan rises. Divide three more times and you become more than a cell.',
    spawns: {
      acid: 5,
      phageWave: { every: 8, n: 6 },
      grazer: 6,
      amoeba: 3,
      parasite: 6,
      pack: 2,
      antibodyWave: { every: 14, n: 5 },
      macrophage: 1,
      leviathan: 1,
    },
    nutrients: 95,
    lightR: 140,
    lights: 2,
  },
];

/** The director watches how you play and makes the world push back on that specific habit. */
class Director {
  constructor(world) {
    this.world = world;
    this.t = CFG.director.interval * 0.6;
    this.kills = 0;
    this.stillTime = 0;
    this.fastTime = 0;
    this.lightTime = 0;
    this.playTime = 0;
    this.preyArmor = 1;
    this.acidSeek = 0;
    this.phagePredict = false;
    this.lightMul = 1;
    this.adaptations = [];
  }
  note(what) {
    if (what === 'kill') this.kills++;
  }
  update(dt) {
    const p = this.world.player;
    this.playTime += dt;
    if (p.speedFrac < 0.15) this.stillTime += dt;
    if (p.speedFrac > 0.8) this.fastTime += dt;
    if (this.world.lightAt(p.x, p.y) > 0) this.lightTime += dt;
    this.t -= dt;
    if (this.t > 0) return;
    this.t = CFG.director.interval;
    const window = CFG.director.interval;
    const choices = [];
    if (this.kills >= 6 && this.preyArmor < 2.2)
      choices.push([
        'The prey grows thicker skin',
        () => {
          this.preyArmor *= 1.3;
        },
      ]);
    if (this.stillTime > window * 0.45 && this.acidSeek < 40)
      choices.push([
        'Acid learns to seek the still',
        () => {
          this.acidSeek += 20;
        },
      ]);
    if (this.fastTime > window * 0.5 && !this.phagePredict)
      choices.push([
        'Phages learn to lead their target',
        () => {
          this.phagePredict = true;
        },
      ]);
    if (this.lightTime > window * 0.55 && this.lightMul > 0.6)
      choices.push([
        'The light grows dim',
        () => {
          this.lightMul *= 0.8;
        },
      ]);
    if (p.drones.length >= 3 && this.world.packSize < 5)
      choices.push([
        'Hunters come in bigger packs',
        () => {
          this.world.packSize = Math.min(5, this.world.packSize + 1);
        },
      ]);
    this.kills = 0;
    this.stillTime = 0;
    this.fastTime = 0;
    this.lightTime = 0;
    if (!choices.length) return;
    const [msg, fn] = pick(choices);
    fn();
    this.adaptations.push(msg);
    this.world.toast(`The world adapts: ${msg}`, 4, 'adapt');
    this.world.audio.play('adapt');
  }
}

export class World {
  constructor(audio) {
    this.audio = audio;
    this.player = new Player(this);
    this.nutrients = [];
    this.threats = [];
    this.lights = [];
    this.particles = [];
    this.toasts = [];
    this.time = 0;
    this.eraIdx = 0;
    this.eraBannerT = 0;
    this.shakeT = 0;
    this.shakeA = 0;
    this.packSize = 3;
    this.waveT = {};
    this.won = false;
    this.director = new Director(this);
    this.pendingEraTalent = false;
    this.spawnWarnings = [];
    this.initLights();
    for (let i = 0; i < this.era.nutrients; i++) this.spawnNutrient(true);
    for (let i = 0; i < 2; i++) this.spawnThreat('acid', true);
    this.eraBannerT = 4;
  }

  get era() {
    return ERAS[this.eraIdx];
  }

  // ---------- helpers ----------
  toast(msg, t = 2.5, kind = '') {
    this.toasts.push({ msg, t, kind, max: t });
  }
  shake(a) {
    this.shakeA = Math.max(this.shakeA, a);
    this.shakeT = 0.25;
  }
  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU),
        s = rand(30, 160);
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: rand(0.3, 0.8), color, r: rand(1.5, 3.5) });
    }
  }

  initLights() {
    this.lights = [];
    for (let i = 0; i < this.era.lights; i++) {
      this.lights.push({
        x: rand(300, CFG.world.w - 300),
        y: rand(300, CFG.world.h - 300),
        r: this.era.lightR,
        a: rand(TAU),
        s: rand(18, 30),
      });
    }
  }
  lightAt(x, y) {
    let best = 0;
    for (const L of this.lights) {
      const d = Math.hypot(x - L.x, y - L.y);
      if (d < L.r) best = Math.max(best, 1 - d / L.r);
    }
    const p = this.player;
    if (p.has('reef') && p.anchored && Math.hypot(x - p.x, y - p.y) < p.r + 170) best = Math.max(best, 0.8);
    return best;
  }
  nearestNutrient(x, y, range) {
    let best = null,
      bd = range;
    for (const n of this.nutrients) {
      if (n.dead) continue;
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }
  nearestThreat(x, y, range, filter) {
    let best = null,
      bd = range;
    for (const t of this.threats) {
      if (t.dead || (filter && !filter(t))) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d < bd) {
        bd = d;
        best = t;
      }
    }
    return best;
  }
  removeNutrient(n) {
    n.dead = true;
  }

  // ---------- spawning ----------
  spawnNutrient(anywhere = false) {
    const N = CFG.nutrient;
    let x, y;
    if (!anywhere && this.lights.length && Math.random() < 0.45) {
      const L = pick(this.lights);
      const a = rand(TAU),
        d = rand(L.r * 1.3);
      x = clamp(L.x + Math.cos(a) * d, 20, CFG.world.w - 20);
      y = clamp(L.y + Math.sin(a) * d, 20, CFG.world.h - 20);
    } else {
      x = rand(20, CFG.world.w - 20);
      y = rand(20, CFG.world.h - 20);
    }
    const rich = Math.random() < N.richChance;
    this.nutrients.push({
      x,
      y,
      r: rich ? 6 : 3.5,
      rich,
      biomass: rich ? N.richBiomass : N.biomass,
      energy: rich ? N.richEnergy : N.energy,
      ph: rand(TAU),
      dead: false,
    });
  }
  spawnNutrientCluster(x, y, spread, n, rich = false) {
    const N = CFG.nutrient;
    for (let i = 0; i < n; i++) {
      const a = rand(TAU),
        d = rand(spread);
      this.nutrients.push({
        x: clamp(x + Math.cos(a) * d, 10, CFG.world.w - 10),
        y: clamp(y + Math.sin(a) * d, 10, CFG.world.h - 10),
        r: rich ? 5 : 3.5,
        rich,
        biomass: rich ? 2.5 : N.biomass,
        energy: rich ? 14 : N.energy,
        ph: rand(TAU),
        dead: false,
      });
    }
  }
  spawnBloom(x, y, spread, n) {
    this.spawnNutrientCluster(x, y, spread, n, false);
    this.burst(x, y, '#5dff8a', 10);
  }

  spawnPos(anywhere = false) {
    const p = this.player;
    for (let i = 0; i < 12; i++) {
      const a = rand(TAU),
        d = anywhere ? rand(200, 1400) : rand(760, 1000);
      const x = p.x + Math.cos(a) * d,
        y = p.y + Math.sin(a) * d;
      if (x > 30 && y > 30 && x < CFG.world.w - 30 && y < CFG.world.h - 30) return { x, y };
    }
    return { x: rand(100, CFG.world.w - 100), y: rand(100, CFG.world.h - 100) };
  }
  spawnThreat(kind, anywhere = false) {
    const { x, y } = this.spawnPos(anywhere);
    let e;
    switch (kind) {
      case 'acid':
        e = new Acid(this, x, y);
        break;
      case 'grazer':
        e = new Grazer(this, x, y);
        break;
      case 'amoeba':
        e = new Amoeba(this, x, y);
        break;
      case 'parasite':
        e = new Parasite(this, x, y);
        break;
      case 'macrophage':
        e = new Macrophage(this, x, y);
        this.toast('The macrophage is coming. Lead it into your enemies.', 5, 'warn');
        break;
      case 'leviathan':
        e = new Leviathan(this, x, y);
        this.toast('THE LEVIATHAN RISES', 5, 'warn');
        this.audio.play('boss');
        break;
      case 'pack': {
        const pack = { t: 2.5, members: [] };
        for (let i = 0; i < this.packSize; i++) {
          const h = new Hunter(this, x + rand(-40, 40), y + rand(-40, 40), pack);
          pack.members.push(h);
          this.threats.push(h);
        }
        this.warn(x, y, 'Pack hunters');
        return;
      }
    }
    if (e) this.threats.push(e);
  }
  warn(x, y, label) {
    this.spawnWarnings.push({ x, y, label, t: 2.2 });
    if (label) this.audio.play('warn');
  }
  spawnWave(kind, n) {
    const { x, y } = this.spawnPos();
    for (let i = 0; i < n; i++) {
      const a = rand(TAU),
        d = rand(0, 70);
      const e =
        kind === 'phage'
          ? new Phage(this, x + Math.cos(a) * d, y + Math.sin(a) * d)
          : new Antibody(this, x + Math.cos(a) * d, y + Math.sin(a) * d);
      this.threats.push(e);
    }
    this.warn(x, y, kind === 'phage' ? 'Phages' : 'Antibodies');
  }
  countKind(kind) {
    let c = 0;
    for (const t of this.threats) if (!t.dead && t.kind === kind) c++;
    return c;
  }

  manageSpawns(dt) {
    const S = this.era.spawns;
    const p = this.player;
    const apexMul = p.has('apex') ? 1.5 : 1;
    const want = (k) => Math.ceil((S[k] || 0) * (k === 'pack' ? apexMul : 1));
    for (const k of ['acid', 'grazer', 'amoeba', 'parasite', 'macrophage', 'leviathan']) {
      if (S[k] && this.countKind(k) < want(k)) {
        this.waveT[k] = (this.waveT[k] || 0) - dt;
        if (this.waveT[k] <= 0) {
          this.waveT[k] = k === 'parasite' ? 3 : 5;
          this.spawnThreat(k);
        }
      }
    }
    if (S.pack && this.countKind('hunter') < this.packSize * want('pack')) {
      this.waveT.pack = (this.waveT.pack || 0) - dt;
      if (this.waveT.pack <= 0) {
        this.waveT.pack = 14;
        this.spawnThreat('pack');
      }
    }
    if (S.phageWave) {
      this.waveT.phage = (this.waveT.phage ?? 5) - dt;
      if (this.waveT.phage <= 0) {
        this.waveT.phage = S.phageWave.every;
        this.spawnWave('phage', S.phageWave.n);
      }
    }
    if (S.antibodyWave) {
      this.waveT.anti = (this.waveT.anti ?? 8) - dt;
      if (this.waveT.anti <= 0) {
        this.waveT.anti = S.antibodyWave.every;
        this.spawnWave('antibody', S.antibodyWave.n);
      }
    }
    // nutrient economy: respawn slower in later eras, scarcity near the player is real
    const alive = this.nutrients.length;
    if (alive < this.era.nutrients) {
      this.nutT = (this.nutT || 0) - dt;
      if (this.nutT <= 0) {
        this.nutT = 0.12;
        this.spawnNutrient();
      }
    }
  }

  // ---------- events ----------
  onDivide() {
    const p = this.player;
    this.burst(p.x, p.y, '#ffffff', 30);
    this.shake(4);
    this.audio.play('divide');
    const next = ERAS.findIndex((e, i) => i > this.eraIdx && p.level >= e.level);
    if (next > 0) {
      this.eraIdx = next;
      this.eraBannerT = 5;
      this.initLights();
      this.audio.play('era');
      this.toast(this.era.flavor, 6, 'era');
    } else {
      this.toast('Division! +1 mutation point (press T)', 3);
    }
    if (p.level >= CFG.levels.winLevel) this.won = true;
  }

  // ---------- update ----------
  update(dt, input) {
    this.time += dt;
    const p = this.player;
    p.update(dt, input);
    for (const d of p.drones) d.update(dt);
    p.drones = p.drones.filter((d) => !d.dead);

    // lights drift
    for (const L of this.lights) {
      L.a += rand(-0.6, 0.6) * dt;
      L.x += Math.cos(L.a) * L.s * dt;
      L.y += Math.sin(L.a) * L.s * dt;
      if (L.x < 200 || L.x > CFG.world.w - 200) L.a = Math.PI - L.a;
      if (L.y < 200 || L.y > CFG.world.h - 200) L.a = -L.a;
      L.x = clamp(L.x, 200, CFG.world.w - 200);
      L.y = clamp(L.y, 200, CFG.world.h - 200);
      L.r = this.era.lightR * this.director.lightMul;
    }

    // nutrients
    const pr = p.r;
    const pull = p.has('sense') ? 90 : 0;
    for (const n of this.nutrients) {
      if (n.dead) continue;
      const dx = n.x - p.x,
        dy = n.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < pr + n.r) {
        n.dead = true;
        p.eatNutrient(n);
        this.burst(n.x, n.y, n.rich ? '#ffd27a' : '#9df3ff', n.rich ? 8 : 3);
      } else if (pull && d < pr + pull) {
        n.x -= (dx / d) * 120 * dt;
        n.y -= (dy / d) * 120 * dt;
      }
    }
    this.nutrients = this.nutrients.filter((n) => !n.dead);

    // threats
    for (const t of this.threats) if (!t.dead) t.update(dt);
    this.threats = this.threats.filter((t) => !t.dead);
    p.parasites = p.parasites.filter((q) => !q.dead && q.attached);

    // spawns & director
    this.manageSpawns(dt);
    this.director.update(dt);

    // fx
    for (const q of this.particles) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= 0.9;
      q.vy *= 0.9;
      q.t -= dt;
    }
    this.particles = this.particles.filter((q) => q.t > 0);
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    for (const w of this.spawnWarnings) w.t -= dt;
    this.spawnWarnings = this.spawnWarnings.filter((w) => w.t > 0);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      if (this.shakeT <= 0) this.shakeA = 0;
    }
    this.eraBannerT = Math.max(0, this.eraBannerT - dt);
  }
}
