// Visual effects: particles, chunks, rings, lightning bolts, floating numbers, flashes and shake.
import { rand, TAU } from './util.js';

export class FX {
  constructor() {
    this.particles = [];
    this.bolts = [];
    this.rings = [];
    this.texts = [];
    this.flash = 0;
    this.flashColor = '#ffffff';
    this.shakeA = 0;
    this.shakeT = 0;
    this.hitStop = 0;
  }

  shake(a, t = 0.25) {
    this.shakeA = Math.max(this.shakeA, a);
    this.shakeT = Math.max(this.shakeT, t);
  }
  flashScreen(a, color = '#ffffff') {
    this.flash = Math.max(this.flash, a);
    this.flashColor = color;
  }
  stop(t) {
    this.hitStop = Math.max(this.hitStop, t);
  }

  /** Spark burst. */
  burst(x, y, color, n = 16, speed = 180, life = 0.6, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU),
        s = rand(speed * 0.3, speed);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        t: rand(life * 0.5, life),
        max: life,
        color,
        r: rand(size * 0.5, size),
        drag: 0.92,
      });
    }
  }
  /** Meaty chunks that fly out and slow down. */
  chunks(x, y, color, n = 10, r = 6) {
    for (let i = 0; i < n; i++) {
      const a = rand(TAU),
        s = rand(120, 420);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        t: rand(0.6, 1.1),
        max: 1.1,
        color,
        r: rand(r * 0.4, r),
        drag: 0.9,
        chunk: true,
        rot: rand(TAU),
        spin: rand(-8, 8),
      });
    }
  }
  ring(x, y, color, r0 = 10, r1 = 200, t = 0.5, w = 4) {
    this.rings.push({ x, y, color, r0, r1, t, max: t, w });
  }
  bolt(points, color = '#bff3ff', w = 3, t = 0.18) {
    this.bolts.push({ points, color, w, t, max: t });
  }
  /** Jagged lightning between two points. */
  lightning(x0, y0, x1, y1, color, w = 3, t = 0.18) {
    const pts = [{ x: x0, y: y0 }];
    const d = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(3, Math.floor(d / 22));
    const nx = -(y1 - y0) / (d || 1),
      ny = (x1 - x0) / (d || 1);
    for (let i = 1; i < n; i++) {
      const f = i / n;
      const off = rand(-1, 1) * Math.min(28, d * 0.18) * Math.sin(f * Math.PI);
      pts.push({ x: x0 + (x1 - x0) * f + nx * off, y: y0 + (y1 - y0) * f + ny * off });
    }
    pts.push({ x: x1, y: y1 });
    this.bolt(pts, color, w, t);
  }
  text(x, y, str, color = '#ffffff', size = 16, t = 0.9) {
    this.texts.push({ x, y, str, color, size, t, max: t, vy: -60 });
  }

  update(dt) {
    for (const q of this.particles) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vx *= q.drag;
      q.vy *= q.drag;
      q.t -= dt;
      if (q.chunk) q.rot += q.spin * dt;
    }
    this.particles = this.particles.filter((q) => q.t > 0);
    for (const b of this.bolts) b.t -= dt;
    this.bolts = this.bolts.filter((b) => b.t > 0);
    for (const r of this.rings) r.t -= dt;
    this.rings = this.rings.filter((r) => r.t > 0);
    for (const x of this.texts) {
      x.t -= dt;
      x.y += x.vy * dt;
      x.vy *= 0.94;
    }
    this.texts = this.texts.filter((x) => x.t > 0);
    this.flash = Math.max(0, this.flash - dt * 3);
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      if (this.shakeT <= 0) this.shakeA = 0;
    }
    this.hitStop = Math.max(0, this.hitStop - dt);
  }

  /** World-space pass (called inside the camera transform). */
  drawWorld(ctx) {
    for (const r of this.rings) {
      const f = 1 - r.t / r.max;
      ctx.globalAlpha = (1 - f) * 0.9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.w * (1 - f) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * f, 0, TAU);
      ctx.stroke();
    }
    for (const b of this.bolts) {
      const a = b.t / b.max;
      ctx.globalAlpha = a;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.w * 3;
      ctx.globalAlpha = a * 0.25;
      this.path(ctx, b.points);
      ctx.lineWidth = b.w;
      ctx.globalAlpha = a;
      this.path(ctx, b.points);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = b.w * 0.4;
      this.path(ctx, b.points);
    }
    for (const q of this.particles) {
      ctx.globalAlpha = Math.min(1, (q.t / q.max) * 1.5);
      ctx.fillStyle = q.color;
      if (q.chunk) {
        ctx.save();
        ctx.translate(q.x, q.y);
        ctx.rotate(q.rot);
        ctx.beginPath();
        ctx.moveTo(q.r, 0);
        ctx.lineTo(0, q.r * 0.7);
        ctx.lineTo(-q.r * 0.8, 0);
        ctx.lineTo(0, -q.r * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r * Math.min(1, (q.t / q.max) * 2), 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    for (const x of this.texts) {
      const a = Math.min(1, x.t / x.max + 0.2);
      ctx.globalAlpha = a;
      ctx.font = `bold ${x.size}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(x.str, x.x, x.y);
      ctx.fillStyle = x.color;
      ctx.fillText(x.str, x.x, x.y);
    }
    ctx.globalAlpha = 1;
  }
  path(ctx, pts) {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  }
  /** Screen-space pass. */
  drawScreen(ctx, w, h) {
    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(0.8, this.flash);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }
}
