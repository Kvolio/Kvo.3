import {
  ACTION_BUTTON,
  Action,
  clampMove,
  updateButton,
  type ButtonKey,
  type DeviceKind,
  type InputProvider,
  type InputState,
} from './types.js';

export interface TouchInputOptions {
  /** Radians of yaw per pixel of drag. Matched to the mouse by default. */
  readonly lookSensitivity?: number;
  /** Fraction of the screen width given over to the movement stick. */
  readonly stickZoneWidth?: number;
  /** Drag distance, in pixels, at which the stick reads full deflection. */
  readonly stickRadius?: number;
  /** Movement below this fraction of the radius is ignored. */
  readonly deadzone?: number;
}

interface StickTouch {
  pointerId: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
}

/**
 * Touch input, designed for a phone rather than shrunk from the desktop scheme.
 *
 * The left third of the screen is a virtual stick whose origin appears wherever
 * the thumb lands, so there is nothing to aim for; the rest is a look region.
 * Both feed the same `InputState` in the same units as the mouse and keyboard,
 * which is what makes climbing, entering and hatch interaction behave
 * identically without a single platform branch downstream.
 *
 * On-screen buttons are styled by the UI layer but their listeners live here,
 * so every device event in the project stays inside src/input/.
 */
export class TouchInputProvider implements InputProvider {
  readonly id: DeviceKind = 'touch';

  private readonly sensitivity: number;
  private readonly stickZoneWidth: number;
  private readonly stickRadius: number;
  private readonly deadzone: number;

  private target: HTMLElement | null = null;
  private stick: StickTouch | null = null;
  private lookPointerId: number | null = null;
  private lastLookX = 0;
  private lastLookY = 0;
  private pendingLookX = 0;
  private pendingLookY = 0;
  private tapPointer: { x: number; y: number } | null = null;
  private contributed = false;

  private readonly buttonsDown = new Map<ButtonKey, boolean>();
  private readonly boundElements = new Map<HTMLElement, ButtonKey>();

  constructor(opts: TouchInputOptions = {}) {
    this.sensitivity = opts.lookSensitivity ?? 0.0028;
    this.stickZoneWidth = opts.stickZoneWidth ?? 0.36;
    this.stickRadius = opts.stickRadius ?? 62;
    this.deadzone = opts.deadzone ?? 0.12;
  }

  get isActive(): boolean {
    return this.contributed;
  }

  /** Live stick deflection, so the UI can draw the thumb ring where the thumb is. */
  get stickState(): { active: boolean; originX: number; originY: number; dx: number; dy: number } {
    if (!this.stick) return { active: false, originX: 0, originY: 0, dx: 0, dy: 0 };
    return {
      active: true,
      originX: this.stick.originX,
      originY: this.stick.originY,
      dx: this.stick.x - this.stick.originX,
      dy: this.stick.y - this.stick.originY,
    };
  }

  attach(target: HTMLElement): void {
    this.target = target;
    target.addEventListener('pointerdown', this.onPointerDown);
    target.addEventListener('pointermove', this.onPointerMove);
    target.addEventListener('pointerup', this.onPointerUp);
    target.addEventListener('pointercancel', this.onPointerUp);
  }

  detach(): void {
    const t = this.target;
    if (t) {
      t.removeEventListener('pointerdown', this.onPointerDown);
      t.removeEventListener('pointermove', this.onPointerMove);
      t.removeEventListener('pointerup', this.onPointerUp);
      t.removeEventListener('pointercancel', this.onPointerUp);
    }
    for (const el of this.boundElements.keys()) this.unbindButton(el);
    this.target = null;
    this.stick = null;
    this.lookPointerId = null;
  }

  /**
   * Wire an on-screen control to an action. The UI owns the element's
   * appearance and placement; this owns its behaviour.
   */
  bindButton(element: HTMLElement, action: Action): void {
    const key = ACTION_BUTTON[action];
    if (!key) throw new Error(`touch: ${Action[action]} has no button to bind`);
    this.boundElements.set(element, key);
    element.addEventListener('pointerdown', this.onButtonDown);
    element.addEventListener('pointerup', this.onButtonUp);
    element.addEventListener('pointercancel', this.onButtonUp);
    element.addEventListener('pointerleave', this.onButtonUp);
  }

  unbindButton(element: HTMLElement): void {
    element.removeEventListener('pointerdown', this.onButtonDown);
    element.removeEventListener('pointerup', this.onButtonUp);
    element.removeEventListener('pointercancel', this.onButtonUp);
    element.removeEventListener('pointerleave', this.onButtonUp);
    this.boundElements.delete(element);
  }

  private readonly onButtonDown = (e: PointerEvent): void => {
    const key = this.boundElements.get(e.currentTarget as HTMLElement);
    if (!key) return;
    e.preventDefault();
    e.stopPropagation();
    this.buttonsDown.set(key, true);
    this.contributed = true;
  };

  private readonly onButtonUp = (e: PointerEvent): void => {
    const key = this.boundElements.get(e.currentTarget as HTMLElement);
    if (!key) return;
    e.preventDefault();
    this.buttonsDown.set(key, false);
  };

  private readonly onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') return;
    const rect = this.target?.getBoundingClientRect();
    if (!rect) return;
    const localX = e.clientX - rect.left;

    if (localX < rect.width * this.stickZoneWidth && this.stick === null) {
      // Dynamic origin: the stick materialises under the thumb rather than the
      // thumb having to find the stick.
      this.stick = {
        pointerId: e.pointerId,
        originX: localX,
        originY: e.clientY - rect.top,
        x: localX,
        y: e.clientY - rect.top,
      };
    } else if (this.lookPointerId === null) {
      this.lookPointerId = e.pointerId;
      this.lastLookX = e.clientX;
      this.lastLookY = e.clientY;
      this.tapPointer = {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -(((e.clientY - rect.top) / rect.height) * 2 - 1),
      };
    }
    this.contributed = true;
  };

  private readonly onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') return;
    const rect = this.target?.getBoundingClientRect();
    if (!rect) return;

    if (this.stick && e.pointerId === this.stick.pointerId) {
      this.stick.x = e.clientX - rect.left;
      this.stick.y = e.clientY - rect.top;
      return;
    }
    if (e.pointerId === this.lookPointerId) {
      this.pendingLookX += (e.clientX - this.lastLookX) * this.sensitivity;
      this.pendingLookY += (e.clientY - this.lastLookY) * this.sensitivity;
      this.lastLookX = e.clientX;
      this.lastLookY = e.clientY;
    }
  };

  private readonly onPointerUp = (e: PointerEvent): void => {
    if (this.stick && e.pointerId === this.stick.pointerId) this.stick = null;
    if (e.pointerId === this.lookPointerId) this.lookPointerId = null;
  };

  sample(dt: number, out: InputState): void {
    let contributedThisFrame = false;

    if (this.stick) {
      const dx = (this.stick.x - this.stick.originX) / this.stickRadius;
      const dy = (this.stick.y - this.stick.originY) / this.stickRadius;
      const magnitude = Math.hypot(dx, dy);
      if (magnitude > this.deadzone) {
        // Rescale past the deadzone so the stick still reaches full travel.
        const scaled = Math.min(1, (magnitude - this.deadzone) / (1 - this.deadzone));
        const norm = scaled / magnitude;
        out.move.x += dx * norm;
        // Screen Y grows downward; forward is up.
        out.move.y += -dy * norm;
        clampMove(out.move);
        // Past three quarters of travel the player is running, so there is no
        // separate run button competing for a thumb.
        if (scaled > 0.75) out.run = true;
        contributedThisFrame = true;
      }
    }

    if (this.pendingLookX !== 0 || this.pendingLookY !== 0) {
      out.look.dx += this.pendingLookX;
      out.look.dy += this.pendingLookY;
      this.pendingLookX = 0;
      this.pendingLookY = 0;
      contributedThisFrame = true;
    }

    for (const [key, down] of this.buttonsDown) {
      if (down) {
        updateButton(out[key], true, dt);
        contributedThisFrame = true;
      }
    }

    if (this.tapPointer) {
      out.pointer.x = this.tapPointer.x;
      out.pointer.y = this.tapPointer.y;
      out.pointer.active = true;
      this.tapPointer = null;
    }

    if (contributedThisFrame) out.lastDevice = 'touch';
  }
}
