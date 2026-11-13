// Keyboard, mouse (with optional pointer lock), touch and gamepad, flattened
// into a handful of actions so the rest of the game never asks which device.
const ACTIONS = {
  jump: ['Space'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  sneak: ['KeyC', 'KeyQ'],
  interact: ['KeyE'],
  meow: ['KeyM', 'KeyF'],
  journal: ['KeyJ', 'Tab'],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter', 'NumpadEnter'],
  loaf: ['KeyL'],
};
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressedNow = new Set();
    this.virtual = new Set();
    this.lookX = 0; this.lookY = 0; this.zoom = 0;
    this.locked = false;
    this.wantLock = true;
    this.dragging = false;
    this.mouseJump = false; this.mouseSneak = false;
    this.touch = { stickId: null, sx: 0, sy: 0, x: 0, y: 0, lookId: null, lx: 0, ly: 0 };
    this.isTouch = false;
    this.pad = { x: 0, y: 0, buttons: [] };
    this.lastInputAt = 0;
    this.onAnyInput = null;
    this.onLockChange = null;

    const down = (code) => {
      if (!this.keys.has(code)) this.pressedNow.add(code);
      this.keys.add(code);
      this.lastInputAt = performance.now();
      if (this.onAnyInput) this.onAnyInput();
    };
    addEventListener('keydown', (e) => {
      if (e.metaKey || e.altKey) return;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!e.repeat) down(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouseJump = this.mouseSneak = this.dragging = false; });

    canvas.addEventListener('mousedown', (e) => {
      this.lastInputAt = performance.now();
      if (this.onAnyInput) this.onAnyInput();
      if (!this.locked && this.wantLock && e.button === 0) this.requestLock();
      if (this.locked) {
        if (e.button === 0) { this.mouseJump = true; this.pressedNow.add('MouseJump'); }
        if (e.button === 2) this.mouseSneak = true;
      } else this.dragging = true;
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseJump = false;
      if (e.button === 2) this.mouseSneak = false;
      this.dragging = false;
    });
    addEventListener('mousemove', (e) => {
      if (this.locked || this.dragging) {
        this.lookX += e.movementX || 0; this.lookY += e.movementY || 0;
        this.lastLookAt = performance.now();
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.zoom += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) this.mouseJump = this.mouseSneak = false;
      if (this.onLockChange) this.onLockChange(this.locked, was);
    });
    document.addEventListener('pointerlockerror', () => { this.locked = false; });

    // Touch: left half is a floating stick, right half drags the camera.
    const opts = { passive: false };
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.isTouch = true;
      if (this.onAnyInput) this.onAnyInput();
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.45 && this.touch.stickId === null) {
          Object.assign(this.touch, { stickId: t.identifier, sx: t.clientX, sy: t.clientY, x: 0, y: 0 });
        } else if (this.touch.lookId === null) {
          Object.assign(this.touch, { lookId: t.identifier, lx: t.clientX, ly: t.clientY });
        }
      }
    }, opts);
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.stickId) {
          const dx = (t.clientX - this.touch.sx) / 60, dy = (t.clientY - this.touch.sy) / 60;
          const l = Math.hypot(dx, dy) || 1, k = Math.min(1, l) / l;
          this.touch.x = dx * k; this.touch.y = dy * k;
        } else if (t.identifier === this.touch.lookId) {
          this.lookX += (t.clientX - this.touch.lx) * 1.6; this.lookY += (t.clientY - this.touch.ly) * 1.6;
          this.touch.lx = t.clientX; this.touch.ly = t.clientY;
          this.lastLookAt = performance.now();
        }
      }
    }, opts);
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touch.stickId) { this.touch.stickId = null; this.touch.x = this.touch.y = 0; }
        if (t.identifier === this.touch.lookId) this.touch.lookId = null;
      }
    };
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchcancel', end);
    this.lastLookAt = -1e9;
  }

  requestLock() {
    if (!this.wantLock) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch { /* not available here; drag-to-look still works */ }
  }
  releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  /** Called by on-screen buttons. */
  setVirtual(action, on) {
    if (on) { if (!this.virtual.has(action)) this.pressedNow.add(`v:${action}`); this.virtual.add(action); } else this.virtual.delete(action);
  }

  held(action) {
    if (this.virtual.has(action)) return true;
    if (action === 'jump' && (this.mouseJump || this.pad.buttons[0])) return true;
    if (action === 'sneakHold' ) return this.mouseSneak;
    if (action === 'sprint' && (this.pad.buttons[7] || this.pad.buttons[5])) return true;
    const codes = ACTIONS[action];
    return codes ? codes.some((c) => this.keys.has(c)) : false;
  }
  pressed(action) {
    if (this.pressedNow.has(`v:${action}`)) return true;
    if (action === 'jump' && this.pressedNow.has('MouseJump')) return true;
    if (this.pressedNow.has(`pad:${action}`)) return true;
    const codes = ACTIONS[action];
    return codes ? codes.some((c) => this.pressedNow.has(c)) : false;
  }
  /** Mark an action as handled so nothing later in the same frame reacts to it too. */
  consume(action) {
    for (const c of ACTIONS[action] || []) this.pressedNow.delete(c);
    this.pressedNow.delete(`v:${action}`); this.pressedNow.delete(`pad:${action}`);
    if (action === 'jump') this.pressedNow.delete('MouseJump');
  }

  /** Movement intent, x right / y forward, length <= 1. */
  move() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyD')) x += 1;
    if (k.has('KeyA')) x -= 1;
    x += this.touch.x + this.pad.x; y += -this.touch.y + this.pad.y;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }
  /** Keyboard camera turn from the arrow keys (left/right only; up/down walk). */
  turn() {
    return (this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('ArrowLeft') ? 1 : 0);
  }
  get movingKeys() { return MOVE_KEYS.some((c) => this.keys.has(c)); }

  pollGamepad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find((p) => p && p.connected);
    if (!gp) { this.pad.x = this.pad.y = 0; this.pad.buttons.length = 0; return; }
    const dz = (v) => (Math.abs(v) < 0.16 ? 0 : v);
    this.pad.x = dz(gp.axes[0] || 0); this.pad.y = -dz(gp.axes[1] || 0);
    const rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
    if (rx || ry) { this.lookX += rx * 900 * dt; this.lookY += ry * 600 * dt; this.lastLookAt = performance.now(); }
    const map = { 0: 'jump', 1: 'sneak', 2: 'interact', 3: 'meow', 8: 'journal', 9: 'pause' };
    gp.buttons.forEach((b, i) => {
      const was = this.pad.buttons[i];
      this.pad.buttons[i] = b.pressed;
      if (b.pressed && !was) {
        if (map[i]) this.pressedNow.add(`pad:${map[i]}`);
        if (i === 0) this.pressedNow.add('pad:confirm');
        if (this.onAnyInput) this.onAnyInput();
      }
    });
  }

  /** Call at the very end of each frame. */
  endFrame() {
    this.pressedNow.clear();
    this.lookX = 0; this.lookY = 0; this.zoom = 0;
  }
}
