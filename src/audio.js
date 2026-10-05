// Tiny synthesized sound set. No assets, no loading, mute with M.
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.last = {};
  }
  ensure() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }
  tone({ f = 440, f2, type = 'sine', t = 0.1, g = 0.2, delay = 0 }) {
    const c = this.ctx;
    if (!c) return;
    const o = c.createOscillator(),
      gn = c.createGain();
    const t0 = c.currentTime + delay;
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + t);
    gn.gain.setValueAtTime(0.0001, t0);
    gn.gain.exponentialRampToValueAtTime(g, t0 + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
    o.connect(gn);
    gn.connect(c.destination);
    o.start(t0);
    o.stop(t0 + t + 0.02);
  }
  noise({ t = 0.15, g = 0.15, f = 800 }) {
    const c = this.ctx;
    if (!c) return;
    const buf = c.createBuffer(1, c.sampleRate * t, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource();
    s.buffer = buf;
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.value = f;
    const gn = c.createGain();
    gn.gain.value = g;
    s.connect(fl);
    fl.connect(gn);
    gn.connect(c.destination);
    s.start();
  }
  play(name, vol = 1) {
    if (this.muted || !this.ctx) return;
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < 40) return; // rate limit
    this.last[name] = now;
    const g = (v) => v * vol;
    switch (name) {
      case 'eat':
        this.tone({ f: 520 + Math.random() * 200, f2: 900, t: 0.07, g: g(0.08) });
        break;
      case 'eatRich':
        this.tone({ f: 500, f2: 1100, t: 0.14, g: g(0.14) });
        this.tone({ f: 750, f2: 1500, t: 0.14, g: g(0.1), delay: 0.05 });
        break;
      case 'eatCell':
        this.tone({ f: 300, f2: 90, type: 'square', t: 0.18, g: g(0.12) });
        this.noise({ t: 0.12, g: g(0.08), f: 500 });
        break;
      case 'hurt':
        this.tone({ f: 160, f2: 60, type: 'sawtooth', t: 0.16, g: g(0.18) });
        this.noise({ t: 0.1, g: g(0.1), f: 400 });
        break;
      case 'dash':
        this.noise({ t: 0.18, g: g(0.12), f: 1800 });
        this.tone({ f: 300, f2: 700, t: 0.12, g: g(0.05) });
        break;
      case 'divide':
        [0, 4, 7, 12].forEach((s, i) => this.tone({ f: 330 * Math.pow(2, s / 12), t: 0.25, g: g(0.12), delay: i * 0.06 }));
        break;
      case 'era':
        [0, 7, 12, 19, 24].forEach((s, i) =>
          this.tone({ f: 220 * Math.pow(2, s / 12), type: 'triangle', t: 0.5, g: g(0.14), delay: i * 0.12 }),
        );
        break;
      case 'evolve':
        [0, 3, 7, 10, 14].forEach((s, i) =>
          this.tone({ f: 262 * Math.pow(2, s / 12), type: 'triangle', t: 0.3, g: g(0.1), delay: i * 0.05 }),
        );
        break;
      case 'lunge':
        this.tone({ f: 120, f2: 40, type: 'sawtooth', t: 0.25, g: g(0.14) });
        break;
      case 'engulf':
        this.tone({ f: 200, f2: 50, type: 'square', t: 0.4, g: g(0.14) });
        break;
      case 'latch':
        this.tone({ f: 900, f2: 300, type: 'square', t: 0.15, g: g(0.08) });
        break;
      case 'bounce':
        this.tone({ f: 700, f2: 1400, t: 0.06, g: g(0.06) });
        break;
      case 'warn':
        this.tone({ f: 440, t: 0.12, type: 'square', g: g(0.05) });
        this.tone({ f: 440, t: 0.12, type: 'square', g: g(0.05), delay: 0.18 });
        break;
      case 'adapt':
        [0, -2, -5].forEach((s, i) => this.tone({ f: 330 * Math.pow(2, s / 12), type: 'triangle', t: 0.35, g: g(0.12), delay: i * 0.15 }));
        break;
      case 'cyst':
        this.tone({ f: 500, f2: 150, type: 'triangle', t: 0.3, g: g(0.12) });
        break;
      case 'anchor':
        this.tone({ f: 200, f2: 120, type: 'triangle', t: 0.25, g: g(0.1) });
        break;
      case 'unanchor':
        this.tone({ f: 120, f2: 220, type: 'triangle', t: 0.2, g: g(0.08) });
        break;
      case 'bloom':
        this.tone({ f: 600, f2: 1200, type: 'sine', t: 0.3, g: g(0.07) });
        break;
      case 'sacrifice':
        this.tone({ f: 800, f2: 200, type: 'triangle', t: 0.5, g: g(0.14) });
        break;
      case 'burst':
        this.noise({ t: 0.3, g: g(0.12), f: 900 });
        break;
      case 'boss':
        [0, -12, -24].forEach((s, i) => this.tone({ f: 110 * Math.pow(2, s / 12), type: 'sawtooth', t: 1.2, g: g(0.14), delay: i * 0.25 }));
        break;
      case 'death':
        [0, -3, -7, -12].forEach((s, i) =>
          this.tone({ f: 330 * Math.pow(2, s / 12), type: 'sawtooth', t: 0.6, g: g(0.12), delay: i * 0.2 }),
        );
        break;
      case 'win':
        [0, 4, 7, 12, 16, 19, 24].forEach((s, i) =>
          this.tone({ f: 262 * Math.pow(2, s / 12), type: 'triangle', t: 0.6, g: g(0.12), delay: i * 0.1 }),
        );
        break;
      case 'buy':
        this.tone({ f: 660, f2: 990, t: 0.12, g: g(0.1) });
        break;
      case 'nope':
        this.tone({ f: 200, f2: 150, type: 'square', t: 0.12, g: g(0.06) });
        break;
    }
  }
}
