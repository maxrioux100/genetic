import { CFG } from './config.js';
import { TAU, clamp, lerp, angleTo } from './util.js';

export class Camera {
  constructor(canvas) { this.canvas = canvas; this.x = 0; this.y = 0; this.zoom = 1; this.sx = 0; this.sy = 0; }
  follow(p, dt) {
    const want = clamp(1.15 - p.level * 0.022, 0.78, 1.15);
    this.zoom += (want - this.zoom) * (1 - Math.exp(-2 * dt));
    this.x += (p.x - this.x) * (1 - Math.exp(-6 * dt));
    this.y += (p.y - this.y) * (1 - Math.exp(-6 * dt));
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
    const ctx = this.ctx, c = this.canvas;
    this.t += dt;
    const p = world.player;
    ctx.save();
    // background
    ctx.fillStyle = '#05080f';
    ctx.fillRect(0, 0, c.width, c.height);

    const shx = world.shakeA ? (Math.random() - 0.5) * world.shakeA : 0;
    const shy = world.shakeA ? (Math.random() - 0.5) * world.shakeA : 0;
    ctx.translate(c.width / 2 + shx, c.height / 2 + shy);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    const vw = c.width / cam.zoom, vh = c.height / cam.zoom;
    const vx0 = cam.x - vw / 2 - 100, vy0 = cam.y - vh / 2 - 100, vx1 = cam.x + vw / 2 + 100, vy1 = cam.y + vh / 2 + 100;
    const vis = (o, r = 0) => o.x + r > vx0 && o.x - r < vx1 && o.y + r > vy0 && o.y - r < vy1;

    // soup texture: faint drifting blobs
    for (let i = 0; i < 60; i++) {
      const x = ((i * 977) % CFG.world.w), y = ((i * 613) % CFG.world.h);
      const rr = 60 + (i % 5) * 30;
      if (!vis({ x, y }, rr)) continue;
      const bx = x + Math.sin(this.t * 0.2 + i) * 30, by = y + Math.cos(this.t * 0.17 + i) * 30;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, rr);
      g.addColorStop(0, i % 2 ? 'rgba(43,108,255,0.10)' : 'rgba(25,183,166,0.08)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(bx, by, rr, 0, TAU); ctx.fill();
    }
    // plankton specks
    ctx.fillStyle = 'rgba(180,200,255,0.18)';
    for (let i = 0; i < 300; i++) {
      const x = ((i * 1543) % CFG.world.w), y = ((i * 877) % CFG.world.h);
      if (!vis({ x, y })) continue;
      ctx.fillRect(x + Math.sin(this.t * 0.5 + i) * 6, y + Math.cos(this.t * 0.4 + i) * 6, 1.5, 1.5);
    }

    // world bounds
    ctx.strokeStyle = 'rgba(120,160,255,0.25)'; ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, CFG.world.w, CFG.world.h);

    // lights
    for (const L of world.lights) {
      if (!vis(L, L.r)) continue;
      const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
      g.addColorStop(0, 'rgba(255,240,170,0.28)'); g.addColorStop(0.7, 'rgba(255,230,140,0.10)'); g.addColorStop(1, 'rgba(255,230,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(L.x, L.y, L.r, 0, TAU); ctx.fill();
    }
    if (p.has('reef') && p.anchored) {
      const r = p.r + 170;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      g.addColorStop(0, 'rgba(120,255,170,0.25)'); g.addColorStop(1, 'rgba(120,255,170,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.fill();
    }

    // scent trail (only visible with sense, or when antibodies exist, as a fairness cue)
    if (world.eraIdx >= 3 && p.scent.length) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 3;
      ctx.beginPath();
      p.scent.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y)));
      ctx.stroke();
    }

    // nutrients
    for (const n of world.nutrients) {
      if (!vis(n, 8)) continue;
      const pulse = 0.8 + Math.sin(this.t * 3 + n.ph) * 0.2;
      ctx.fillStyle = n.rich ? '#ffd27a' : '#9df3ff';
      ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r * pulse, 0, TAU); ctx.fill();
      if (n.rich) { ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 2.4 * pulse, 0, TAU); ctx.fill(); }
    }
    ctx.globalAlpha = 1;

    // decoy
    if (p.decoy) {
      ctx.globalAlpha = 0.35 + Math.sin(this.t * 10) * 0.1;
      ctx.strokeStyle = '#ffe15a'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.arc(p.decoy.x, p.decoy.y, p.decoy.r, 0, TAU); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    }

    // threats
    for (const t of world.threats) if (vis(t, t.r + 30)) this.drawThreat(ctx, t, p);

    // drones
    for (const d of p.drones) this.drawDrone(ctx, d);

    // player
    if (!p.dead) this.drawPlayer(ctx, p);

    // particles
    for (const q of world.particles) {
      ctx.globalAlpha = Math.min(1, q.t * 2);
      ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;

    // spawn warnings (world-space rings)
    for (const w of world.spawnWarnings) {
      const a = w.t / 2.2;
      ctx.strokeStyle = `rgba(255,90,90,${a})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(w.x, w.y, 40 + (1 - a) * 80, 0, TAU); ctx.stroke();
    }
    ctx.restore();

    // off-screen indicators (screen space)
    this.drawIndicators(ctx, world, cam);
  }

  membrane(ctx, x, y, r, wob, segs = 24, amp = 0.06, speed = 3) {
    ctx.beginPath();
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * TAU;
      const rr = r * (1 + Math.sin(a * 3 + this.t * speed + wob) * amp + Math.sin(a * 5 - this.t * speed * 0.7 + wob) * amp * 0.5);
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  drawPlayer(ctx, p) {
    const r = p.r;
    const col = p.hitFlash > 0 ? '#ffffff' : p.poison > 0 ? '#b6ff6a' : '#79e6ff';
    ctx.save();
    ctx.translate(p.x, p.y);
    // flagellum
    if (p.has('flagellum')) {
      ctx.strokeStyle = 'rgba(255,225,90,0.9)'; ctx.lineWidth = 2;
      const back = p.heading + Math.PI;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const d = r + i * 4;
        const sway = Math.sin(this.t * 14 - i * 0.7) * i * 1.3 * (0.3 + p.speedFrac);
        ctx.lineTo(Math.cos(back) * d + Math.cos(back + Math.PI / 2) * sway, Math.sin(back) * d + Math.sin(back + Math.PI / 2) * sway);
      }
      ctx.stroke();
    }
    // spikes
    if (p.has('spikes')) {
      ctx.fillStyle = '#5aa8ff';
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + this.t * 0.3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a - 0.12) * r, Math.sin(a - 0.12) * r);
        ctx.lineTo(Math.cos(a) * (r + 8), Math.sin(a) * (r + 8));
        ctx.lineTo(Math.cos(a + 0.12) * r, Math.sin(a + 0.12) * r);
        ctx.fill();
      }
    }
    // cilia
    if (p.has('cilia') || p.has('streamline')) {
      ctx.strokeStyle = 'rgba(255,120,120,0.6)'; ctx.lineWidth = 1.5;
      const n = 18;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const w = Math.sin(this.t * 10 + i) * 0.3;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        ctx.lineTo(Math.cos(a + w) * (r + 5), Math.sin(a + w) * (r + 5)); ctx.stroke();
      }
    }
    // body
    const stealth = p.stealthed;
    ctx.globalAlpha = stealth ? 0.45 : 1;
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = col;
    ctx.globalAlpha *= 0.28;
    this.membrane(ctx, 0, 0, r, 0, 28, p.anchored ? 0.02 : 0.06);
    ctx.fill();
    ctx.globalAlpha = stealth ? 0.6 : 1;
    ctx.fillStyle = g; this.membrane(ctx, 0, 0, r, 0, 28, p.anchored ? 0.02 : 0.06); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = p.has('shell') || p.has('juggernaut') ? 5 : p.has('membrane') ? 3 : 2;
    if (p.has('juggernaut')) ctx.strokeStyle = '#8ec5ff';
    this.membrane(ctx, 0, 0, r, 0, 28, p.anchored ? 0.02 : 0.06); ctx.stroke();
    // cell wall ring when anchored
    if (p.anchored) {
      ctx.strokeStyle = `rgba(93,255,138,${0.3 + p.anchorT * 0.5})`; ctx.lineWidth = 3; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      // roots
      ctx.strokeStyle = 'rgba(93,255,138,0.6)'; ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.5; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a) * (r + 14 * p.anchorT), Math.sin(a) * (r + 14 * p.anchorT)); ctx.stroke(); }
    }
    // chloroplasts
    if (p.has('chloroplast')) {
      ctx.fillStyle = '#5dff8a';
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + this.t * 0.5; const d = r * 0.55; ctx.beginPath(); ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, r * 0.16, r * 0.1, a, 0, TAU); ctx.fill(); }
    }
    // vacuole
    if (p.has('vacuole')) { ctx.fillStyle = 'rgba(160,220,255,0.35)'; ctx.beginPath(); ctx.arc(r * 0.25, r * 0.2, r * 0.3, 0, TAU); ctx.fill(); }
    // nucleus
    ctx.fillStyle = p.has('hive') ? '#c87cff' : p.has('apex') ? '#ff5a5a' : '#2f6fd6';
    ctx.beginPath(); ctx.arc(-r * 0.15, -r * 0.1, r * 0.3, 0, TAU); ctx.fill();
    // jaws
    if (p.has('jaws')) {
      ctx.strokeStyle = '#ff5a5a'; ctx.lineWidth = 3;
      const open = 0.35 + Math.sin(this.t * 6) * 0.2;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.9, p.heading - open, p.heading + open); ctx.stroke();
      ctx.fillStyle = '#ff5a5a';
      for (let i = -2; i <= 2; i++) { const a = p.heading + i * open * 0.45; ctx.beginPath(); ctx.moveTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9); ctx.lineTo(Math.cos(a) * r * 0.65, Math.sin(a) * r * 0.65); ctx.lineTo(Math.cos(a + 0.1) * r * 0.9, Math.sin(a + 0.1) * r * 0.9); ctx.fill(); }
    }
    // toxin glow
    if (p.has('toxin')) { ctx.strokeStyle = 'rgba(182,255,106,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, TAU); ctx.stroke(); }
    // cyst shell
    if (p.cystT > 0) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(0, 0, r + 4, 0, TAU); ctx.stroke(); }
    // dash streak
    if (p.dashT > 0) { ctx.globalAlpha = 0.5; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-Math.cos(p.heading) * r * 3, -Math.sin(p.heading) * r * 3); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // marked
    if (p.markedT > 0) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([3, 5]); ctx.beginPath(); ctx.arc(0, 0, r + 12, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    ctx.restore();
    // parasites attached
    for (const q of p.parasites) { ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill(); }
  }

  drawDrone(ctx, d) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(200,124,255,0.3)'; ctx.strokeStyle = '#c87cff'; ctx.lineWidth = 2;
    this.membrane(ctx, d.x, d.y, d.r, d.x * 0.01, 14, 0.08, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c87cff'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 0.3, 0, TAU); ctx.fill();
    ctx.restore();
  }

  drawThreat(ctx, t, p) {
    ctx.save();
    const flash = t.hitFlash > 0;
    const col = flash ? '#ffffff' : t.color;
    switch (t.kind) {
      case 'acid': {
        ctx.globalAlpha = 0.35 + Math.sin(this.t * 2 + t.wobble) * 0.08;
        ctx.fillStyle = col; this.membrane(ctx, t.x, t.y, t.r, t.wobble, 20, 0.15, 1.5); ctx.fill();
        ctx.globalAlpha = 0.7; ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
        break;
      }
      case 'phage': {
        ctx.fillStyle = col; ctx.translate(t.x, t.y); ctx.rotate(t.heading);
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, 4); ctx.lineTo(-3, 0); ctx.lineTo(-5, -4); ctx.closePath(); ctx.fill();
        break;
      }
      case 'grazer': {
        ctx.fillStyle = 'rgba(127,224,255,0.25)'; ctx.strokeStyle = col; ctx.lineWidth = 2;
        this.membrane(ctx, t.x, t.y, t.r, t.wobble, 18, 0.07); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(t.x, t.y, t.r * 0.3, 0, TAU); ctx.fill();
        this.hpBar(ctx, t);
        break;
      }
      case 'amoeba': {
        const tele = t.state === 'tele';
        const grow = tele ? 1 + (1 - t.stateT / 0.9) * 0.18 : t.state === 'lunge' ? 0.85 : 1;
        ctx.fillStyle = tele ? 'rgba(255,120,80,0.35)' : 'rgba(183,255,106,0.18)';
        ctx.strokeStyle = tele ? '#ff7a50' : col; ctx.lineWidth = tele ? 4 : 2.5;
        this.membrane(ctx, t.x, t.y, t.r * grow, t.wobble, 26, 0.12, 1.2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = tele ? '#ff7a50' : col; ctx.beginPath(); ctx.arc(t.x, t.y, t.r * 0.25, 0, TAU); ctx.fill();
        if (tele) { // lunge line
          ctx.strokeStyle = 'rgba(255,120,80,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
          ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + Math.cos(t.lungeDir) * 260, t.y + Math.sin(t.lungeDir) * 260); ctx.stroke(); ctx.setLineDash([]);
        }
        this.hpBar(ctx, t);
        break;
      }
      case 'parasite': {
        ctx.fillStyle = col; ctx.translate(t.x, t.y); ctx.rotate(t.heading);
        ctx.beginPath(); ctx.ellipse(0, 0, 7, 4, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(-5, i * 3); ctx.lineTo(-11 + Math.sin(this.t * 20 + i) * 2, i * 4); ctx.stroke(); }
        break;
      }
      case 'hunter': {
        const tele = t.state === 'tele';
        ctx.fillStyle = tele ? 'rgba(255,200,80,0.4)' : 'rgba(255,90,90,0.25)'; ctx.strokeStyle = tele ? '#ffc850' : col; ctx.lineWidth = tele ? 3.5 : 2;
        this.membrane(ctx, t.x, t.y, t.r, t.wobble, 16, 0.08, 5); ctx.fill(); ctx.stroke();
        // teeth
        ctx.fillStyle = tele ? '#ffc850' : col;
        const h = t.state === 'lunge' || tele ? t.lungeDir : t.heading;
        for (let i = -1; i <= 1; i++) { const a = h + i * 0.35; ctx.beginPath(); ctx.moveTo(t.x + Math.cos(a) * t.r * 0.5, t.y + Math.sin(a) * t.r * 0.5); ctx.lineTo(t.x + Math.cos(a) * (t.r + 3), t.y + Math.sin(a) * (t.r + 3)); ctx.lineTo(t.x + Math.cos(a + 0.2) * t.r * 0.6, t.y + Math.sin(a + 0.2) * t.r * 0.6); ctx.fill(); }
        if (tele) { ctx.strokeStyle = 'rgba(255,200,80,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + Math.cos(t.lungeDir) * 200, t.y + Math.sin(t.lungeDir) * 200); ctx.stroke(); ctx.setLineDash([]); }
        this.hpBar(ctx, t);
        break;
      }
      case 'antibody': {
        ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.translate(t.x, t.y); ctx.rotate(t.heading);
        ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(2, 0); ctx.lineTo(7, -5); ctx.moveTo(2, 0); ctx.lineTo(7, 5); ctx.stroke();
        break;
      }
      case 'macrophage': {
        ctx.fillStyle = 'rgba(217,179,255,0.15)'; ctx.strokeStyle = col; ctx.lineWidth = 4;
        this.membrane(ctx, t.x, t.y, t.r, t.wobble, 36, 0.1, 0.8); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(217,179,255,0.5)';
        for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + this.t * 0.4; ctx.beginPath(); ctx.arc(t.x + Math.cos(a) * t.r * 0.4, t.y + Math.sin(a) * t.r * 0.4, t.r * 0.18, 0, TAU); ctx.fill(); }
        this.hpBar(ctx, t);
        break;
      }
      case 'leviathan': {
        const tele = t.state === 'tele';
        ctx.fillStyle = tele ? 'rgba(255,80,80,0.35)' : 'rgba(255,77,122,0.15)'; ctx.strokeStyle = tele ? '#ffffff' : col; ctx.lineWidth = tele ? 7 : 5;
        this.membrane(ctx, t.x, t.y, t.r * (tele ? 1.1 : 1), t.wobble, 40, 0.09, 1.5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col;
        for (let i = 0; i < 7; i++) { const a = (i / 7) * TAU + this.t * 0.6; ctx.beginPath(); ctx.arc(t.x + Math.cos(a) * t.r * 0.5, t.y + Math.sin(a) * t.r * 0.5, t.r * 0.12, 0, TAU); ctx.fill(); }
        // eye looks at player
        const a = angleTo(t, p);
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(t.x + Math.cos(a) * t.r * 0.2, t.y + Math.sin(a) * t.r * 0.2, t.r * 0.16, 0, TAU); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(t.x + Math.cos(a) * t.r * 0.26, t.y + Math.sin(a) * t.r * 0.26, t.r * 0.07, 0, TAU); ctx.fill();
        if (tele) { ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(t.x + Math.cos(t.lungeDir) * 450, t.y + Math.sin(t.lungeDir) * 450); ctx.stroke(); ctx.setLineDash([]); }
        this.hpBar(ctx, t, true);
        break;
      }
    }
    ctx.restore();
  }

  hpBar(ctx, t, always = false) {
    if (t.hp === undefined || (!always && t.hp >= t.maxHp)) return;
    const w = t.r * 2;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(t.x - w / 2, t.y - t.r - 10, w, 4);
    ctx.fillStyle = t.poison > 0 ? '#b6ff6a' : '#ff5a5a'; ctx.fillRect(t.x - w / 2, t.y - t.r - 10, w * Math.max(0, t.hp / t.maxHp), 4);
    ctx.globalAlpha = 1;
  }

  drawIndicators(ctx, world, cam) {
    const c = this.canvas;
    const p = world.player;
    const range = p.has('sense') ? 1500 : 900;
    const margin = 26;
    const draw = (x, y, color, label) => {
      const s = cam.toScreen(x, y);
      if (s.x > 0 && s.x < c.width && s.y > 0 && s.y < c.height) return;
      const dx = s.x - c.width / 2, dy = s.y - c.height / 2;
      const a = Math.atan2(dy, dx);
      const k = Math.min((c.width / 2 - margin) / Math.abs(Math.cos(a) || 1e-6), (c.height / 2 - margin) / Math.abs(Math.sin(a) || 1e-6));
      const ex = c.width / 2 + Math.cos(a) * k, ey = c.height / 2 + Math.sin(a) * k;
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(a);
      ctx.fillStyle = color; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, 6); ctx.lineTo(-6, -6); ctx.closePath(); ctx.fill();
      ctx.restore();
      if (label) { ctx.fillStyle = color; ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(label, ex, ey + (ey < c.height / 2 ? 20 : -12)); }
    };
    const seen = {};
    for (const t of world.threats) {
      if (t.kind === 'acid' || t.kind === 'parasite' && t.attached) continue;
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d > range) continue;
      if (t.kind === 'phage' || t.kind === 'antibody') { if (seen[t.kind]) continue; seen[t.kind] = true; }
      draw(t.x, t.y, t.color, t.boss || t.kind === 'macrophage' ? t.label : '');
    }
    for (const w of world.spawnWarnings) draw(w.x, w.y, '#ff5a5a', w.label);
    // nearest light when you have chloroplast
    if (p.has('chloroplast') && world.lights.length) {
      let best = null, bd = 1e9;
      for (const L of world.lights) { const d = Math.hypot(L.x - p.x, L.y - p.y); if (d < bd) { bd = d; best = L; } }
      if (best && bd > best.r) draw(best.x, best.y, '#ffe9a0', 'light');
    }
  }
}
