export class Input {
  private keys = new Set<string>();
  private jumpQueued = false;
  private interactQueued = false;
  private emoteQueued: number | null = null;
  private camDX = 0;
  private camDY = 0;
  private zoom = 0;
  private dragId: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private stick = { x: 0, y: 0, active: false };
  locked = false;
  readonly touch = matchMedia('(pointer: coarse)').matches;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      this.keys.add(e.code);
      if (e.repeat) return;
      if (e.code === 'Space') {
        this.jumpQueued = true;
        e.preventDefault();
      }
      if (e.code === 'KeyE' || e.code === 'Enter') this.interactQueued = true;
      const m = /^Digit(\d)$/.exec(e.code);
      if (m) this.emoteQueued = (Number(m[1]) + 9) % 10;
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('pointerdown', (e) => {
      if (this.dragId !== null) return;
      this.dragId = e.pointerId;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.dragId) return;
      this.camDX += e.clientX - this.lastX;
      this.camDY += e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId === this.dragId) this.dragId = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', (e) => {
      this.zoom += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
  }

  bindJoystick(base: HTMLElement, knob: HTMLElement) {
    let id: number | null = null;
    let cx = 0, cy = 0;
    const max = 44;
    const move = (e: PointerEvent) => {
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > max) {
        dx = (dx / len) * max;
        dy = (dy / len) * max;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.stick.x = dx / max;
      this.stick.y = -dy / max;
    };
    base.addEventListener('pointerdown', (e) => {
      id = e.pointerId;
      const r = base.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      this.stick.active = true;
      base.setPointerCapture(e.pointerId);
      move(e);
      e.preventDefault();
    });
    base.addEventListener('pointermove', (e) => e.pointerId === id && move(e));
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      this.stick = { x: 0, y: 0, active: false };
      knob.style.transform = '';
    };
    base.addEventListener('pointerup', up);
    base.addEventListener('pointercancel', up);
  }

  queueJump() {
    this.jumpQueued = true;
  }

  queueInteract() {
    this.interactQueued = true;
  }

  axis() {
    if (this.locked) return { x: 0, y: 0, mag: 0, run: false };
    let x = 0, y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.stick.active) {
      x = this.stick.x;
      y = this.stick.y;
    }
    const mag = Math.min(1, Math.hypot(x, y));
    const run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || (this.stick.active && mag > 0.92);
    return { x, y, mag, run };
  }

  consumeJump() {
    const j = this.jumpQueued && !this.locked;
    this.jumpQueued = false;
    return j;
  }

  consumeInteract() {
    const v = this.interactQueued;
    this.interactQueued = false;
    return v;
  }

  peekInteract() {
    return this.interactQueued;
  }

  consumeEmote() {
    const v = this.emoteQueued;
    this.emoteQueued = null;
    return this.locked ? null : v;
  }

  consumeCamera() {
    const d = { dx: this.camDX, dy: this.camDY, zoom: this.zoom };
    this.camDX = 0;
    this.camDY = 0;
    this.zoom = 0;
    return d;
  }

  get dragging() {
    return this.dragId !== null;
  }
}
