/**
 * The shared input contract.
 *
 * The brief requires that hatches, climbing, entering, inspection and position
 * switching behave identically on desktop and mobile, with only the input
 * method differing. That is a structural requirement, not a discipline one, so
 * it is expressed structurally: every device produces the same `InputState`,
 * and `PlayerController` and `InteractionSystem` never learn which one did.
 *
 * An ESLint rule bans KeyboardEvent, TouchEvent, PointerEvent and
 * addEventListener anywhere outside src/input/, which is what actually keeps
 * the two paths from diverging.
 */

export enum Action {
  MoveForward,
  MoveBack,
  StrafeLeft,
  StrafeRight,
  Run,
  Crouch,
  Jump,
  Interact,
  AltInteract,
  ToggleXray,
  ToggleCamera,
  TeleportMenu,
  Menu,
}

export const ALL_ACTIONS: readonly Action[] = [
  Action.MoveForward,
  Action.MoveBack,
  Action.StrafeLeft,
  Action.StrafeRight,
  Action.Run,
  Action.Crouch,
  Action.Jump,
  Action.Interact,
  Action.AltInteract,
  Action.ToggleXray,
  Action.ToggleCamera,
  Action.TeleportMenu,
  Action.Menu,
];

export const ACTION_LABELS: Record<Action, string> = {
  [Action.MoveForward]: 'Move forward',
  [Action.MoveBack]: 'Move back',
  [Action.StrafeLeft]: 'Strafe left',
  [Action.StrafeRight]: 'Strafe right',
  [Action.Run]: 'Run',
  [Action.Crouch]: 'Crouch',
  [Action.Jump]: 'Jump / climb',
  [Action.Interact]: 'Interact',
  [Action.AltInteract]: 'Enter / exit',
  [Action.ToggleXray]: 'X-ray view',
  [Action.ToggleCamera]: 'Switch camera',
  [Action.TeleportMenu]: 'Inspection positions',
  [Action.Menu]: 'Menu',
};

/** Edge-detected button. `pressed` and `released` are true for one frame only. */
export interface ButtonState {
  down: boolean;
  pressed: boolean;
  released: boolean;
  /** Seconds held. Zero while up. */
  heldFor: number;
}

export interface InputState {
  /** Strafe and forward, each in [-1, 1], with the magnitude clamped to 1. */
  move: { x: number; y: number };
  /** Look delta for this frame, in RADIANS. Sensitivity is already applied. */
  look: { dx: number; dy: number };
  run: boolean;
  crouch: boolean;

  jump: ButtonState;
  interact: ButtonState;
  altInteract: ButtonState;
  toggleXray: ButtonState;
  toggleCamera: ButtonState;
  teleportMenu: ButtonState;
  menu: ButtonState;

  /** Normalised device coordinates of the pointer, for tap-to-inspect picking. */
  pointer: { x: number; y: number; active: boolean };

  /** Which provider most recently contributed, for prompt glyphs. */
  lastDevice: DeviceKind;
}

export type DeviceKind = 'pc' | 'touch' | 'gamepad' | 'replay';

export const BUTTON_KEYS = [
  'jump',
  'interact',
  'altInteract',
  'toggleXray',
  'toggleCamera',
  'teleportMenu',
  'menu',
] as const;

export type ButtonKey = (typeof BUTTON_KEYS)[number];

/** Which `InputState` button each action drives. */
export const ACTION_BUTTON: Partial<Record<Action, ButtonKey>> = {
  [Action.Jump]: 'jump',
  [Action.Interact]: 'interact',
  [Action.AltInteract]: 'altInteract',
  [Action.ToggleXray]: 'toggleXray',
  [Action.ToggleCamera]: 'toggleCamera',
  [Action.TeleportMenu]: 'teleportMenu',
  [Action.Menu]: 'menu',
};

export function createButtonState(): ButtonState {
  return { down: false, pressed: false, released: false, heldFor: 0 };
}

export function createInputState(): InputState {
  return {
    move: { x: 0, y: 0 },
    look: { dx: 0, dy: 0 },
    run: false,
    crouch: false,
    jump: createButtonState(),
    interact: createButtonState(),
    altInteract: createButtonState(),
    toggleXray: createButtonState(),
    toggleCamera: createButtonState(),
    teleportMenu: createButtonState(),
    menu: createButtonState(),
    pointer: { x: 0, y: 0, active: false },
    lastDevice: 'pc',
  };
}

/** Reset a state in place. Providers write into a pooled struct; nothing allocates per frame. */
export function resetInputState(state: InputState): void {
  state.move.x = 0;
  state.move.y = 0;
  state.look.dx = 0;
  state.look.dy = 0;
  state.run = false;
  state.crouch = false;
  state.pointer.active = false;
  for (const key of BUTTON_KEYS) {
    const b = state[key];
    b.down = false;
    b.pressed = false;
    b.released = false;
  }
}

/**
 * Advance a button from a raw held flag, deriving the one-frame edges.
 * Doing this centrally means every provider gets identical edge semantics —
 * a tap on a touch button and a tap on a key behave the same downstream.
 */
export function updateButton(button: ButtonState, isDown: boolean, dt: number): void {
  const was = button.down;
  button.down = isDown;
  button.pressed = isDown && !was;
  button.released = !isDown && was;
  button.heldFor = isDown ? button.heldFor + dt : 0;
}

/** Clamp a movement vector to the unit disc, so diagonals are not faster. */
export function clampMove(move: { x: number; y: number }): void {
  const lengthSq = move.x * move.x + move.y * move.y;
  if (lengthSq > 1) {
    const inv = 1 / Math.sqrt(lengthSq);
    move.x *= inv;
    move.y *= inv;
  }
}

export interface InputProvider {
  readonly id: DeviceKind;
  /** True when this provider contributed since the last device switch. */
  readonly isActive: boolean;
  attach(target: HTMLElement): void;
  detach(): void;
  /** Write this frame's contribution into the pooled state. */
  sample(dt: number, out: InputState): void;
}
