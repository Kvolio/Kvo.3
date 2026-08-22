import type { Bindings } from './Bindings.js';
import {
  ACTION_BUTTON,
  Action,
  clampMove,
  updateButton,
  type DeviceKind,
  type InputProvider,
  type InputState,
} from './types.js';

export interface PcInputOptions {
  /** Radians of yaw per pixel of mouse movement. */
  readonly lookSensitivity?: number;
  /** Request pointer lock on click. Disabled for the replay-driven tests. */
  readonly usePointerLock?: boolean;
}

/**
 * Keyboard and mouse.
 *
 * Keys are resolved through `Bindings` rather than compared to literals, so
 * remapping is a data change and nothing here needs to know that W means
 * forward. Look is delivered in radians, already scaled, so the touch provider
 * can hand the controller identical units from a completely different gesture.
 */
export class PcInputProvider implements InputProvider {
  readonly id: DeviceKind = 'pc';

  private readonly held = new Set<string>();
  private readonly bindings: Bindings;
  private readonly sensitivity: number;
  private readonly usePointerLock: boolean;

  private target: HTMLElement | null = null;
  private pendingLookX = 0;
  private pendingLookY = 0;
  private pointerX = 0;
  private pointerY = 0;
  private pointerActive = false;
  private contributed = false;

  constructor(bindings: Bindings, opts: PcInputOptions = {}) {
    this.bindings = bindings;
    this.sensitivity = opts.lookSensitivity ?? 0.0022;
    this.usePointerLock = opts.usePointerLock ?? true;
  }

  get isActive(): boolean {
    return this.contributed;
  }

  get pointerLocked(): boolean {
    return typeof document !== 'undefined' && document.pointerLockElement === this.target;
  }

  attach(target: HTMLElement): void {
    this.target = target;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    target.addEventListener('mousemove', this.onMouseMove);
    target.addEventListener('mousedown', this.onMouseDown);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.target?.removeEventListener('mousemove', this.onMouseMove);
    this.target?.removeEventListener('mousedown', this.onMouseDown);
    this.target = null;
    this.held.clear();
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    // Only claim keys that are actually bound, so browser shortcuts survive.
    if (this.bindings.actionFor(e.code) !== undefined) {
      this.held.add(e.code);
      this.contributed = true;
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code);
  };

  /** Losing focus mid-stride would otherwise leave the player walking forever. */
  private readonly onBlur = (): void => {
    this.held.clear();
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    if (this.usePointerLock && !this.pointerLocked) {
      // Still track the cursor for hover picking when not captured.
      this.updatePointer(e);
      return;
    }
    this.pendingLookX += e.movementX * this.sensitivity;
    this.pendingLookY += e.movementY * this.sensitivity;
    this.contributed = true;
    this.updatePointer(e);
  };

  private readonly onMouseDown = (e: MouseEvent): void => {
    this.contributed = true;
    this.updatePointer(e);
    if (this.usePointerLock && !this.pointerLocked) {
      void this.target?.requestPointerLock?.();
    }
  };

  private updatePointer(e: MouseEvent): void {
    const rect = this.target?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    this.pointerX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    this.pointerActive = true;
  }

  private isDown(action: Action): boolean {
    for (const code of this.bindings.get(action)) {
      if (this.held.has(code)) return true;
    }
    return false;
  }

  sample(dt: number, out: InputState): void {
    let contributedThisFrame = false;

    if (this.isDown(Action.MoveForward)) out.move.y += 1;
    if (this.isDown(Action.MoveBack)) out.move.y -= 1;
    if (this.isDown(Action.StrafeRight)) out.move.x += 1;
    if (this.isDown(Action.StrafeLeft)) out.move.x -= 1;
    if (out.move.x !== 0 || out.move.y !== 0) contributedThisFrame = true;
    clampMove(out.move);

    if (this.isDown(Action.Run)) out.run = true;
    if (this.isDown(Action.Crouch)) out.crouch = true;

    for (const [action, key] of Object.entries(ACTION_BUTTON)) {
      const a = Number(action) as Action;
      if (key === undefined) continue;
      const down = this.isDown(a);
      if (down) {
        updateButton(out[key], true, dt);
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

    if (this.pointerActive) {
      out.pointer.x = this.pointerX;
      out.pointer.y = this.pointerY;
      out.pointer.active = true;
    }

    if (contributedThisFrame) out.lastDevice = 'pc';
  }
}
