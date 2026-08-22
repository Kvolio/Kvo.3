import { Bindings, keyLabel } from './Bindings.js';
import {
  Action,
  createInputState,
  resetInputState,
  type DeviceKind,
  type InputProvider,
  type InputState,
} from './types.js';

/**
 * Merges every attached provider into one pooled `InputState` per frame.
 *
 * Providers are additive rather than exclusive, so a tablet with a keyboard,
 * or a desktop with a gamepad, works without a mode switch. `lastDevice`
 * tracks whichever most recently contributed, and exists only so interaction
 * prompts can say "[E]" or show a touch glyph — it never gates behaviour.
 */
export class InputManager {
  readonly state: InputState = createInputState();
  readonly bindings: Bindings;

  private readonly providers: InputProvider[] = [];
  private target: HTMLElement | null = null;

  constructor(bindings?: Bindings) {
    this.bindings = bindings ?? Bindings.load();
  }

  register(provider: InputProvider): this {
    this.providers.push(provider);
    if (this.target) provider.attach(this.target);
    return this;
  }

  attach(target: HTMLElement): void {
    this.target = target;
    for (const p of this.providers) p.attach(target);
  }

  detach(): void {
    for (const p of this.providers) p.detach();
    this.target = null;
  }

  get registered(): readonly InputProvider[] {
    return this.providers;
  }

  update(dt: number): InputState {
    const previousDevice = this.state.lastDevice;
    resetInputState(this.state);
    this.state.lastDevice = previousDevice;
    for (const provider of this.providers) {
      provider.sample(dt, this.state);
    }
    return this.state;
  }

  /**
   * The glyph to show for an action, given whatever the player last touched.
   * Prompts compose as `Open commander's hatch [E]`, one code path for both
   * platforms.
   */
  glyphFor(action: Action, device: DeviceKind = this.state.lastDevice): string {
    if (device === 'touch') return TOUCH_GLYPHS[action] ?? 'tap';
    if (device === 'gamepad') return GAMEPAD_GLYPHS[action] ?? 'button';
    const codes = this.bindings.get(action);
    return codes.length > 0 ? keyLabel(codes[0]!) : '-';
  }
}

const TOUCH_GLYPHS: Partial<Record<Action, string>> = {
  [Action.Interact]: 'USE',
  [Action.AltInteract]: 'ENTER',
  [Action.Jump]: 'CLIMB',
  [Action.Crouch]: 'CROUCH',
  [Action.ToggleXray]: 'X-RAY',
  [Action.ToggleCamera]: 'VIEW',
  [Action.TeleportMenu]: 'GO TO',
};

const GAMEPAD_GLYPHS: Partial<Record<Action, string>> = {
  [Action.Interact]: 'A',
  [Action.AltInteract]: 'X',
  [Action.Jump]: 'B',
  [Action.Crouch]: 'LS',
  [Action.ToggleCamera]: 'Y',
  [Action.TeleportMenu]: 'Select',
};
