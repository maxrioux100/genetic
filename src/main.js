import { World } from './world.js';
import { Camera, Renderer } from './render.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { drawCards } from './perks.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new Renderer(this.canvas);
    this.cam = new Camera(this.canvas);
    this.input = new Input(this.canvas);
    this.input.camera = this.cam;
    this.input.onKey = () => this.handleKeys();
    this.audio = new Audio();
    this.ui = new UI(this);
    this.state = 'menu';
    this.world = null;
    this.cards = [];
    this.last = performance.now();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('blur', () => {
      if (this.state === 'play') this.setState('pause');
    });
    requestAnimationFrame((t) => this.frame(t));
    this.ui.show('menu');
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  start() {
    this.audio.ensure();
    this.world = new World(this.audio);
    this.cam.x = this.world.player.x;
    this.cam.y = this.world.player.y;
    this.cam.zoom = 1.15;
    this.setState('play');
  }

  setState(s) {
    this.state = s;
    this.ui.show(s === 'play' ? 'none' : s);
  }

  openLevelUp() {
    const p = this.world.player;
    this.cards = drawCards(p.perks, p.perkCounts, 3);
    if (!this.cards.length) {
      this.world.pendingLevelUp = false;
      return;
    }
    this.ui.showCards(this.cards, p.level);
    this.setState('levelup');
  }

  choose(i) {
    const c = this.cards[i];
    if (!c || this.state !== 'levelup') return;
    const p = this.world.player;
    p.takePerk(c.id);
    this.world.pendingLevelUp = false;
    this.world.toast(`${c.name}`, 2.5, 'perk');
    this.world.fx.ring(p.x, p.y, '#ffffff', p.r, 200, 0.4, 4);
    this.audio.play('buy');
    this.setState('play');
  }

  handleKeys() {
    const keys = this.input.consume();
    for (const k of keys) {
      if (this.state === 'play') {
        const p = this.world.player;
        if (k === ' ' || k === 'rclick') {
          if (!p.dash()) this.audio.play('nope', 0.3);
        } else if (k === 'click') {
          const w = this.cam.toWorld(this.input.mouse.x, this.input.mouse.y);
          p.useAbility(w.x, w.y);
        } else if (k === 'p' || k === 'escape') this.setState('pause');
        else if (k === 'm') this.audio.muted = !this.audio.muted;
      } else if (this.state === 'levelup') {
        if (k === '1' || k === '2' || k === '3') this.choose(Number(k) - 1);
      } else if (this.state === 'pause') {
        if (k === 'p' || k === 'escape' || k === ' ') this.setState('play');
      } else if (this.state === 'menu' || this.state === 'end') {
        if (k === ' ' || k === 'enter') this.start();
      }
    }
  }

  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.handleKeys();
    if (!this.world) return;
    const w = this.world;
    if (this.state === 'play') {
      w.update(dt, this.input);
      if (w.player.dead) {
        this.audio.play('death');
        this.setState('end');
        this.ui.showEnd(w, false);
      } else if (w.won) {
        this.audio.play('win');
        this.setState('end');
        this.ui.showEnd(w, true);
      } else if (w.pendingLevelUp) this.openLevelUp();
    }
    this.cam.follow(w.player, dt);
    this.renderer.draw(w, this.cam, this.state === 'play' ? dt : 0);
    if (this.state !== 'menu' && this.state !== 'end') this.ui.updateHud(w);
  }
}

window.game = new Game();
