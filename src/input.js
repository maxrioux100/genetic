// Mouse-follow (default) or WASD. Space / left click = burst, E = anchor, Q = cyst, T = tree.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false, inside: false };
    this.mode = 'mouse'; // 'mouse' | 'keys'
    this.pressed = []; // one-shot key presses consumed by main
    this.camera = null; // set by main for screen->world
    this.onKey = null; // set by main: called synchronously on every press so UI keys never depend on the frame loop
    const keyName = (e) => {
      let k = (e.key || '').toLowerCase();
      if (k === 'esc') k = 'escape';
      // fallback to the physical key when the layout reports something odd (dead keys, IME, 'unidentified')
      if (k.length !== 1 && k !== 'escape' && !k.startsWith('arrow') && e.code) {
        if (e.code.startsWith('Key')) k = e.code.slice(3).toLowerCase();
        else if (e.code === 'Space') k = ' ';
        else if (e.code === 'Escape') k = 'escape';
      }
      return k;
    };
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = keyName(e);
      this.keys.add(k);
      this.pressed.push(k);
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) this.mode = 'keys';
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
      this.onKey?.();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(keyName(e)));
    canvas.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.inside = true;
      if (Math.hypot(e.movementX, e.movementY) > 2) this.mode = 'mouse';
    });
    canvas.addEventListener('mouseleave', () => (this.mouse.inside = false));
    canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { this.mouse.down = true; this.pressed.push('click'); } if (e.button === 2) this.pressed.push('rclick'); });
    window.addEventListener('mouseup', () => (this.mouse.down = false));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    // touch: drag to steer, tap = burst
    canvas.addEventListener('touchstart', (e) => { const t = e.touches[0]; this.mouse.x = t.clientX; this.mouse.y = t.clientY; this.mouse.inside = true; this.mode = 'mouse'; this.touchT = performance.now(); e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchmove', (e) => { const t = e.touches[0]; this.mouse.x = t.clientX; this.mouse.y = t.clientY; e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchend', () => { if (performance.now() - this.touchT < 180) this.pressed.push('click'); });
  }
  consume() { const p = this.pressed; this.pressed = []; return p; }
  /** Desired movement direction (unit vector or zero) for the player. */
  moveDir(player) {
    if (this.mode === 'keys') {
      let x = 0, y = 0;
      if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
      if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
      if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
      if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
      const l = Math.hypot(x, y) || 1;
      return { x: x / l, y: y / l };
    }
    if (!this.mouse.inside || !this.camera) return { x: 0, y: 0 };
    const w = this.camera.toWorld(this.mouse.x, this.mouse.y);
    const dx = w.x - player.x, dy = w.y - player.y;
    const d = Math.hypot(dx, dy);
    const dead = player.r + 6;
    if (d < dead) return { x: 0, y: 0 };
    // speed scales with distance to cursor so slow (stealth) movement is possible
    const f = Math.min(1, (d - dead) / 140);
    return { x: (dx / d) * f, y: (dy / d) * f };
  }
}
