import {
  Action,
  clampMove,
  updateButton,
  type ButtonKey,
  type DeviceKind,
  type InputProvider,
  type InputState,
} from './types.js';

/** Standard-mapping button indices. */
const BUTTON_INDEX: Partial<Record<ButtonKey, number>> = {
  interact: 0, // A / cross
  jump: 1, // B / circle
  altInteract: 2, // X / square
  toggleCamera: 3, // Y / triangle
  teleportMenu: 8, // Select
  menu: 9, // Start
  toggleXray: 5, // Right bumper
};

const CROUCH_BUTTON = 10; // Left stick click
const RUN_AXIS_THRESHOLD = 0.85;

/**
 * Gamepad support.
 *
 * Around forty lines of real work, and its actual value is as a proof that the
 * input abstraction has no leaks: a third device drops in with no change
 * anywhere below `InputManager`. If adding this had required touching the
 * player controller or the interaction system, the PC and mobile paths would
 * already have been coupled to their devices.
 */
export class GamepadInputProvider implements InputProvider {
  readonly id: DeviceKind = 'gamepad';

  private contributed = false;
  private readonly deadzone: number;
  private readonly lookSensitivity: number;

  constructor(opts: { deadzone?: number; lookSensitivity?: number } = {}) {
    this.deadzone = opts.deadzone ?? 0.15;
    this.lookSensitivity = opts.lookSensitivity ?? 2.4;
  }

  get isActive(): boolean {
    return this.contributed;
  }

  attach(): void {
    // The Gamepad API is polled, so there is nothing to listen for.
  }

  detach(): void {
    this.contributed = false;
  }

  private applyDeadzone(value: number): number {
    if (Math.abs(value) < this.deadzone) return 0;
    const sign = Math.sign(value);
    return sign * ((Math.abs(value) - this.deadzone) / (1 - this.deadzone));
  }

  sample(dt: number, out: InputState): void {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const pad = Array.from(navigator.getGamepads()).find((p) => p?.connected);
    if (!pad) return;

    let contributedThisFrame = false;

    const moveX = this.applyDeadzone(pad.axes[0] ?? 0);
    const moveY = this.applyDeadzone(pad.axes[1] ?? 0);
    if (moveX !== 0 || moveY !== 0) {
      out.move.x += moveX;
      // Stick Y is positive downward.
      out.move.y += -moveY;
      clampMove(out.move);
      contributedThisFrame = true;
      if (Math.hypot(moveX, moveY) > RUN_AXIS_THRESHOLD) out.run = true;
    }

    const lookX = this.applyDeadzone(pad.axes[2] ?? 0);
    const lookY = this.applyDeadzone(pad.axes[3] ?? 0);
    if (lookX !== 0 || lookY !== 0) {
      // Scale by dt: a stick is a rate, where a mouse is a displacement.
      out.look.dx += lookX * this.lookSensitivity * dt;
      out.look.dy += lookY * this.lookSensitivity * dt;
      contributedThisFrame = true;
    }

    for (const [key, index] of Object.entries(BUTTON_INDEX)) {
      if (index === undefined) continue;
      if (pad.buttons[index]?.pressed) {
        updateButton(out[key as ButtonKey], true, dt);
        contributedThisFrame = true;
      }
    }

    if (pad.buttons[CROUCH_BUTTON]?.pressed) out.crouch = true;

    if (contributedThisFrame) {
      this.contributed = true;
      out.lastDevice = 'gamepad';
    }
  }
}

/** Actions a gamepad can reach, for the controls help screen. */
export const GAMEPAD_SUPPORTED_ACTIONS: readonly Action[] = [
  Action.Interact,
  Action.AltInteract,
  Action.Jump,
  Action.Crouch,
  Action.ToggleCamera,
  Action.ToggleXray,
  Action.TeleportMenu,
  Action.Menu,
];
