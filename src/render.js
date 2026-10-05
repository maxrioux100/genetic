import { CFG } from './config.js';
import { TAU, clamp, angleTo, rand } from './util.js';
import { FORMS } from './perks.js';

export class Camera {
  constructor(canvas) {
    this.canvas = canvas;
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
  }
  follow(p, dt) {
    const want = clamp(1.15 - p.level * 0.036, 0.42, 1.15);
    this.zoom += (want - this.zoom) * (1 - Math.exp(-2 * dt));
    this.x += (p.x - this.x) * (1 - Math.exp(-7 * dt));
    this.y += (p.y - this.y) * (1 - Math.exp(-7 * dt));
  }
  toWorld(sx, sy) {
    const c = this.canvas;
    return { x: (sx - c.width / 2) / this.zoom + this.x, y: (sy - c.height / 2) / this.zoom + this.y };
  }
  toScreen(x, y) {
    const c = this.canvas;
    return { x: (x - this.x) * this.zoom + c.width / 2, y: (y - this.y) * this.zoom + c.height / 2 };
  }
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.t = 0;
  }

  draw(world, cam, dt) {
    const ctx = this.ctx,
      c = this.canvas;
    this.t += dt;
    const p = world.player;
    const fx = world.fx;
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, '#071224');
    g.addColorStop(1, '#03060d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);

    const shx = fx.shakeA ? (Math.random() - 0.5) * fx.shakeA : 0;
    const shy = fx.shakeA ? (Math.random() - 0.5) * fx.shakeA : 0;
    ctx.translate(c.width / 2 + shx, c.height / 2 + shy);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    const vw = c.width / cam.zoom,
      vh = c.height / cam.zoom;
    const vx0 = cam.x - vw / 2 - 150,
      vy0 = cam.y - vh / 2 - 150,
      vx1 = cam.x + vw / 2 + 150,
      vy1 = cam.y + vh / 2 + 150;
    const vis = (o, r = 0) => o.x + r > vx0 && o.x - r < vx1 && o.y + r > vy0 && o.y - r < vy1;

    this.drawBackground(ctx, vis);

    // bounds
    ctx.strokeStyle = 'rgba(120,160,255,0.3)';
    ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, CFG.world.w, CFG.world.h);

    // hazards
    for (const a of world.acid) {
      if (!vis(a, a.r)) continue;
      ctx.globalAlpha = (a.t / a.max) * 0.45;
      ctx.fillStyle = '#c6ff4a';
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r * (0.6 + 0.4 * (a.t / a.max)), 0, TAU);
      ctx.fill();
    }
    for (const k of world.clouds) {
      if (!vis(k, k.r)) continue;
      const gg = ctx.createRadialGradient(k.x, k.y, 0, k.x, k.y, k.r);
      gg.addColorStop(0, `rgba(198,255,74,${0.45 * (k.t / k.max)})`);
      gg.addColorStop(1, 'rgba(198,255,74,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(k.x, k.y, k.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // specks
    ctx.fillStyle = '#9df3ff';
    for (const s of world.specks) {
      if (!vis(s, 6)) continue;
      const pulse = 0.8 + Math.sin(this.t * 3 + s.ph) * 0.2;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * pulse, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // projectiles
    for (const q of world.projectiles) {
      ctx.fillStyle = '#c6ff4a';
      ctx.beginPath();
      ctx.arc(q.x, q.y, q.r, 0, TAU);
      ctx.fill();
    }

    // creatures (big ones first so small ones draw on top)
    const cs = world.creatures.filter((o) => vis(o, o.r + 40)).sort((a, b) => b.r - a.r);
    for (const o of cs) this.drawCreature(ctx, o, p);

    // spawnlings
    for (const s of p.spawnlings) this.drawSpawnling(ctx, s);

    // player
    if (!p.dead) this.drawPlayer(ctx, p);

    fx.drawWorld(ctx);
    ctx.restore();

    // screen space
    fx.drawScreen(ctx, c.width, c.height);
    this.drawVignette(ctx, p);
    this.drawIndicators(ctx, world, cam);
  }

  drawBackground(ctx, vis) {
    for (let i = 0; i < 70; i++) {
      const x = (i * 977) % CFG.world.w,
        y = (i * 613) % CFG.world.h;
      const rr = 80 + (i % 5) * 40;
      if (!vis({ x, y }, rr)) continue;
      const bx = x + Math.sin(this.t * 0.2 + i) * 30,
        by = y + Math.cos(this.t * 0.17 + i) * 30;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, rr);
      g.addColorStop(0, i % 2 ? 'rgba(43,108,255,0.10)' : 'rgba(25,183,166,0.08)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, rr, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(180,200,255,0.16)';
    for (let i = 0; i < 500; i++) {
      const x = (i * 1543) % CFG.world.w,
        y = (i * 877) % CFG.world.h;
      if (!vis({ x, y })) continue;
      ctx.fillRect(x + Math.sin(this.t * 0.5 + i) * 6, y + Math.cos(this.t * 0.4 + i) * 6, 2, 2);
    }
  }

  membrane(ctx, x, y, r, wob, segs = 24, amp = 0.06, speed = 3) {
    ctx.beginPath();
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * TAU;
      const rr = r * (1 + Math.sin(a * 3 + this.t * speed + wob) * amp + Math.sin(a * 5 - this.t * speed * 0.7 + wob) * amp * 0.5);
      const px = x + Math.cos(a) * rr,
        py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  eye(ctx, x, y, r, look) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#0a0f1a';
    ctx.beginPath();
    ctx.arc(x + Math.cos(look) * r * 0.4, y + Math.sin(look) * r * 0.4, r * 0.55, 0, TAU);
    ctx.fill();
  }

  teeth(ctx, x, y, r, heading, n, color, len = 0.3) {
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const a = heading + (i - (n - 1) / 2) * 0.28;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a - 0.08) * r, y + Math.sin(a - 0.08) * r);
      ctx.lineTo(x + Math.cos(a) * r * (1 - len), y + Math.sin(a) * r * (1 - len));
      ctx.lineTo(x + Math.cos(a + 0.08) * r, y + Math.sin(a + 0.08) * r);
      ctx.fill();
    }
  }

  /** Ring that says what this creature is to you: food, rival, or death. */
  relationColor(o, p) {
    if (o.r < p.r * CFG.player.eatRatio || (o.stunT > 0 && p.has('volt4') && o.r < p.r * 1.3)) return '#4dffb0';
    if (o.r > p.r * CFG.player.dangerRatio) return '#ff3b3b';
    return '#ffd24d';
  }

  drawCreature(ctx, o, p) {
    const flash = o.hitFlash > 0;
    const tele = o.state === 'tele';
    const lurking = o.arch === 'lurker' && o.state === 'idle';
    const tired = o.tired > 0;
    const col = flash ? '#ffffff' : tele ? '#ff8c42' : o.color;
    ctx.save();
    ctx.globalAlpha = lurking ? 0.22 : tired ? 0.55 : 1;
    // telegraph line
    if (tele) {
      const len = o.arch === 'lancer' ? 560 : o.arch === 'oldone' ? 500 : 260;
      ctx.strokeStyle = 'rgba(255,140,66,0.6)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(o.x, o.y);
      ctx.lineTo(o.x + Math.cos(o.lungeDir) * len, o.y + Math.sin(o.lungeDir) * len);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // suction rings
    if (o.arch === 'leviathan' || (o.arch === 'oldone' && o.state !== 'lunge')) {
      const R = o.r * (o.arch === 'leviathan' ? 4.5 : 4);
      ctx.strokeStyle = 'rgba(160,190,255,0.25)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const f = (this.t * 0.4 + i / 3) % 1;
        ctx.globalAlpha = (lurking ? 0.2 : 1) * (1 - f) * 0.6;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r + (R - o.r) * (1 - f), 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = lurking ? 0.22 : 1;
    }
    // body
    const grow = tele ? 1.12 : o.state === 'lunge' ? 0.92 : 1;
    const amp = o.kind === 'predator' ? 0.05 : 0.08;
    ctx.fillStyle = col;
    ctx.globalAlpha *= 0.3;
    this.membrane(ctx, o.x, o.y, o.r * grow, o.wobble, o.r > 40 ? 36 : 20, amp, o.kind === 'predator' ? 4 : 2.5);
    ctx.fill();
    ctx.globalAlpha = lurking ? 0.3 : 1;
    ctx.strokeStyle = o.poisoned ? '#c6ff4a' : col;
    ctx.lineWidth = o.boss ? 6 : o.kind === 'predator' ? 3.5 : 2;
    this.membrane(ctx, o.x, o.y, o.r * grow, o.wobble, o.r > 40 ? 36 : 20, amp, o.kind === 'predator' ? 4 : 2.5);
    ctx.stroke();
    // stripes for pack hunters
    if (o.arch === 'pack') {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r * 0.55, o.heading + Math.PI + i * 0.6 - 0.2, o.heading + Math.PI + i * 0.6 + 0.2);
        ctx.stroke();
      }
    }
    // eyes
    const look = o.kind === 'predator' ? angleTo(o, p) : o.heading;
    const er = Math.max(2, o.r * (o.kind === 'predator' ? 0.17 : 0.2));
    if (o.eyes === 1) this.eye(ctx, o.x + Math.cos(o.heading) * o.r * 0.35, o.y + Math.sin(o.heading) * o.r * 0.35, er, look);
    else if (o.eyes === 2) {
      for (const s of [-1, 1]) {
        const a = o.heading + s * 0.55;
        this.eye(ctx, o.x + Math.cos(a) * o.r * 0.45, o.y + Math.sin(a) * o.r * 0.45, er, look);
      }
    } else {
      for (let i = 0; i < o.eyes; i++) {
        const a = o.heading + (i - (o.eyes - 1) / 2) * 0.45;
        const rr = o.r * (0.35 + 0.15 * Math.abs(i - (o.eyes - 1) / 2));
        this.eye(ctx, o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr, er * (o.boss ? 1.2 : 0.8), look);
      }
    }
    // teeth
    if (o.kind === 'predator')
      this.teeth(ctx, o.x, o.y, o.r * grow, o.heading, o.boss ? 9 : o.r > 40 ? 7 : 5, flash ? '#fff' : 'rgba(255,255,255,0.85)', 0.25);
    else if (o.kind === 'rival') this.teeth(ctx, o.x, o.y, o.r, o.heading, 3, 'rgba(255,255,255,0.6)', 0.2);
    // stun sparks
    if (o.stunT > 0) {
      ctx.strokeStyle = '#bff3ff';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = this.t * 9 + i * 2.1;
        ctx.beginPath();
        ctx.moveTo(o.x + Math.cos(a) * o.r * 1.1, o.y + Math.sin(a) * o.r * 1.1);
        ctx.lineTo(o.x + Math.cos(a + 0.3) * (o.r * 1.1 + 8), o.y + Math.sin(a + 0.3) * (o.r * 1.1 + 8));
        ctx.stroke();
      }
    }
    // relation ring
    ctx.globalAlpha = lurking ? 0.35 : 0.75;
    ctx.strokeStyle = this.relationColor(o, p);
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r + 7, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // hp bar
    if (o.hp < o.maxHp && !lurking) {
      const w = o.r * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(o.x - w / 2, o.y - o.r - 14, w, 5);
      ctx.fillStyle = o.poisoned ? '#c6ff4a' : '#ff5a5a';
      ctx.fillRect(o.x - w / 2, o.y - o.r - 14, w * Math.max(0, o.hp / o.maxHp), 5);
    }
    ctx.restore();
  }

  drawSpawnling(ctx, s) {
    ctx.save();
    ctx.fillStyle = 'rgba(224,123,255,0.35)';
    ctx.strokeStyle = s.command ? '#ffffff' : '#e07bff';
    ctx.lineWidth = 2;
    this.membrane(ctx, s.x, s.y, s.r, s.x * 0.01, 14, 0.1, 5);
    ctx.fill();
    ctx.stroke();
    this.eye(ctx, s.x + Math.cos(s.heading) * s.r * 0.3, s.y + Math.sin(s.heading) * s.r * 0.3, Math.max(2, s.r * 0.25), s.heading);
    this.teeth(ctx, s.x, s.y, s.r, s.heading, 3, 'rgba(255,255,255,0.8)', 0.3);
    ctx.restore();
  }

  drawPlayer(ctx, p) {
    const r = p.r;
    const hurt = p.hitFlash > 0;
    const main = hurt ? '#ffffff' : p.invulnT > 0.1 ? '#e07bff' : '#79e6ff';
    const forms = ['serpent', 'volt', 'brood', 'venom'].filter((f) => p.tier(f) > 0);
    const accent = forms.length ? FORMS[forms[0]].color : main;
    ctx.save();
    // serpent body
    if (p.segments.length) {
      const segs = p.segments;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass ? (hurt ? '#ffffff' : '#4dffb0') : 'rgba(77,255,176,0.25)';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        for (const s of segs) ctx.lineTo(s.x, s.y);
        ctx.lineWidth = pass ? 2 : 1;
        ctx.stroke();
      }
      for (let i = segs.length - 1; i >= 0; i--) {
        const s = segs[i];
        const g = ctx.createRadialGradient(s.x - s.r * 0.3, s.y - s.r * 0.3, 1, s.x, s.y, s.r);
        g.addColorStop(0, hurt ? '#ffffff' : '#8fffd0');
        g.addColorStop(1, hurt ? '#dddddd' : '#1d9c68');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,40,20,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // scale mark
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 0.55, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
      if (p.whipT > 0) {
        ctx.strokeStyle = `rgba(77,255,176,${p.whipT * 2})`;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 100 + r * 3 - (0.3 - p.whipT) * 200, 0, TAU);
        ctx.stroke();
      }
    }
    ctx.translate(p.x, p.y);
    // volt aura
    if (p.tier('volt')) {
      ctx.strokeStyle = 'rgba(191,243,255,0.8)';
      ctx.lineWidth = 1.5;
      const n = 3 + p.tier('volt');
      for (let i = 0; i < n; i++) {
        if (Math.random() < 0.5) continue;
        const a = rand(TAU);
        let x = Math.cos(a) * r,
          y = Math.sin(a) * r;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x += Math.cos(a + rand(-1, 1)) * 7;
          y += Math.sin(a + rand(-1, 1)) * 7;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      if (p.tier('volt') >= 3) {
        ctx.strokeStyle = '#7ad7ff';
        ctx.lineWidth = 3;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(0, 0, r + 10, -Math.PI / 2, -Math.PI / 2 + TAU * p.charge);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    // venom drips
    if (p.tier('venom')) {
      ctx.fillStyle = '#c6ff4a';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + this.t * 0.8;
        const d = r * (0.95 + Math.sin(this.t * 4 + i) * 0.08);
        ctx.beginPath();
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.1, 0, TAU);
        ctx.fill();
      }
    }
    // body
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, 'rgba(255,255,255,0.4)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = main;
    ctx.globalAlpha = 0.35;
    this.membrane(ctx, 0, 0, r, 0, 28, 0.05);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    this.membrane(ctx, 0, 0, r, 0, 28, 0.05);
    ctx.fill();
    ctx.strokeStyle = hurt ? '#ffffff' : accent;
    ctx.lineWidth = 3 + p.count('tough');
    this.membrane(ctx, 0, 0, r, 0, 28, 0.05);
    ctx.stroke();
    // brood spots
    if (p.tier('brood')) {
      ctx.fillStyle = 'rgba(224,123,255,0.7)';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + 1;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.12 + Math.sin(this.t * 3 + i) * r * 0.03, 0, TAU);
        ctx.fill();
      }
    }
    // nucleus
    ctx.fillStyle = hurt ? '#ffffff' : accent;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(-r * 0.15, -r * 0.1, r * 0.22, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    // eyes
    for (const s of [-1, 1]) {
      const a = p.heading + s * 0.5;
      this.eye(ctx, Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, Math.max(3, r * 0.17), p.heading);
    }
    // jaws: chomp when biting
    const open = p.biting < 0.35 ? 0.5 + Math.sin(this.t * 30) * 0.25 : 0.3;
    this.teeth(ctx, 0, 0, r, p.heading, 3 + p.count('bite'), '#ffffff', open * 0.6);
    // hp ring
    const f = p.hp / p.maxHp;
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(0, 0, r + 6, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = f > 0.5 ? '#4dffb0' : f > 0.25 ? '#ffd24d' : '#ff3b3b';
    ctx.beginPath();
    ctx.arc(0, 0, r + 6, -Math.PI / 2, -Math.PI / 2 + TAU * f);
    ctx.stroke();
    if (p.dashT > 0) {
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-Math.cos(p.heading) * r * 3, -Math.sin(p.heading) * r * 3);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawVignette(ctx, p) {
    const c = this.canvas;
    const f = p.hp / p.maxHp;
    if (f > 0.35 || p.dead) return;
    const a = (0.35 - f) / 0.35;
    const pulse = 0.6 + Math.sin(this.t * 6) * 0.4;
    const g = ctx.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.3, c.width / 2, c.height / 2, c.height * 0.8);
    g.addColorStop(0, 'rgba(255,0,0,0)');
    g.addColorStop(1, `rgba(255,20,20,${0.55 * a * pulse})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
  }

  drawIndicators(ctx, world, cam) {
    const c = this.canvas;
    const p = world.player;
    const margin = 28;
    for (const o of world.creatures) {
      if (o.dead || o.r < p.r * CFG.player.dangerRatio) continue;
      const d = Math.hypot(o.x - p.x, o.y - p.y);
      if (d > 1500) continue;
      const s = cam.toScreen(o.x, o.y);
      if (s.x > 0 && s.x < c.width && s.y > 0 && s.y < c.height) continue;
      const a = Math.atan2(s.y - c.height / 2, s.x - c.width / 2);
      const k = Math.min((c.width / 2 - margin) / Math.abs(Math.cos(a) || 1e-6), (c.height / 2 - margin) / Math.abs(Math.sin(a) || 1e-6));
      const ex = c.width / 2 + Math.cos(a) * k,
        ey = c.height / 2 + Math.sin(a) * k;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(a);
      ctx.fillStyle = o.boss ? '#ff2a2a' : '#ff5a5a';
      ctx.globalAlpha = 0.9;
      const sz = o.boss ? 14 : 10;
      ctx.beginPath();
      ctx.moveTo(sz, 0);
      ctx.lineTo(-sz * 0.6, sz * 0.6);
      ctx.lineTo(-sz * 0.6, -sz * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      if (o.boss || o.arch === 'leviathan') {
        ctx.fillStyle = '#ff8080';
        ctx.font = '11px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(o.label, ex, ey + (ey < c.height / 2 ? 22 : -14));
      }
    }
  }
}
