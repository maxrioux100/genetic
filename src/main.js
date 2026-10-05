import { World } from './world.js';
import { Camera, Renderer } from './render.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { canBuy, TALENT_BY_ID } from './talents.js';

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
    this.endT = 0;
    this.setState('play');
    // first mutation is free: open the tree right away so the player picks a way of life
    setTimeout(() => {
      if (this.state === 'play') {
        this.world.toast('Choose your first mutation', 4);
        this.setState('tree');
      }
    }, 1500);
  }

  setState(s) {
    this.state = s;
    this.ui.show(s === 'play' ? 'none' : s);
  }

  /** Called by the tree's close button and backdrop. */
  closeTree() {
    if (this.state === 'tree') this.setState('play');
  }

  buy(id) {
    const p = this.world.player;
    if (!canBuy(id, p.talents, p.mp)) {
      this.audio.play('nope');
      return;
    }
    p.mp -= TALENT_BY_ID[id].cost;
    p.learn(id);
    this.audio.play('buy');
    this.world.toast(`Mutation: ${TALENT_BY_ID[id].name}`, 2.5);
    this.ui.refreshTree();
  }

  handleKeys() {
    const keys = this.input.consume();
    for (const k of keys) {
      if (this.state === 'play') {
        if (k === ' ' || k === 'click') {
          if (!this.world.player.dash()) this.audio.play('nope', 0.3);
        } else if (k === 'e' || k === 'rclick') this.world.player.toggleAnchor();
        else if (k === 'q') this.world.player.cyst();
        else if (k === 't') this.setState('tree');
        else if (k === 'p' || k === 'escape') this.setState('pause');
        else if (k === 'm') this.audio.muted = !this.audio.muted;
      } else if (this.state === 'tree') {
        if (k === 't' || k === 'escape') this.setState('play');
      } else if (this.state === 'pause') {
        if (k === 'p' || k === 'escape') this.setState('play');
      } else if (this.state === 'menu' || this.state === 'end') {
        if (k === ' ' || k === 'enter') this.start();
      }
    }
  }

  frame(now) {
    requestAnimationFrame((t) => this.frame(t));
    let dt = Math.min(0.05, (now - this.last) / 1000);
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
      }
    }
    this.cam.follow(w.player, dt);
    this.renderer.draw(w, this.cam, this.state === 'play' ? dt : 0);
    if (this.state === 'play' || this.state === 'tree' || this.state === 'pause') this.ui.updateHud(w);
  }
}

window.game = new Game();
