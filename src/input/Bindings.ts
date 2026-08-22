import { ACTION_LABELS, ALL_ACTIONS, Action } from './types.js';

/**
 * Remappable key bindings.
 *
 * The brief asks that controls not be hard-coded in a way that prevents
 * remapping later, so bindings are pure data from the outset: the PC provider
 * resolves `KeyboardEvent.code` through this table and knows nothing about
 * which key means what.
 *
 * Codes are physical key positions, not characters, so WASD stays where the
 * fingers are on an AZERTY or Dvorak layout.
 */

export const DEFAULT_BINDINGS: Record<Action, string[]> = {
  [Action.MoveForward]: ['KeyW', 'ArrowUp'],
  [Action.MoveBack]: ['KeyS', 'ArrowDown'],
  [Action.StrafeLeft]: ['KeyA', 'ArrowLeft'],
  [Action.StrafeRight]: ['KeyD', 'ArrowRight'],
  [Action.Run]: ['ShiftLeft', 'ShiftRight'],
  [Action.Crouch]: ['ControlLeft', 'ControlRight'],
  [Action.Jump]: ['Space'],
  [Action.Interact]: ['KeyE'],
  [Action.AltInteract]: ['KeyF'],
  [Action.ToggleXray]: ['KeyX'],
  [Action.ToggleCamera]: ['KeyC'],
  [Action.TeleportMenu]: ['Tab'],
  [Action.Menu]: ['Escape'],
};

const STORAGE_KEY = 'tiger.bindings.v1';

/** Human-readable label for a key code, for the bindings UI and prompt glyphs. */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Arrow')) return `${code.slice(5)} arrow`;
  const named: Record<string, string> = {
    Space: 'Space',
    ShiftLeft: 'Shift',
    ShiftRight: 'Shift',
    ControlLeft: 'Ctrl',
    ControlRight: 'Ctrl',
    Escape: 'Esc',
    Tab: 'Tab',
  };
  return named[code] ?? code;
}

export class Bindings {
  private map: Record<Action, string[]>;

  constructor(initial?: Partial<Record<Action, string[]>>) {
    this.map = structuredClone(DEFAULT_BINDINGS);
    if (initial) {
      for (const action of ALL_ACTIONS) {
        const codes = initial[action];
        if (codes && codes.length > 0) this.map[action] = [...codes];
      }
    }
  }

  get(action: Action): readonly string[] {
    return this.map[action];
  }

  /** Which action, if any, a key code currently triggers. */
  actionFor(code: string): Action | undefined {
    for (const action of ALL_ACTIONS) {
      if (this.map[action].includes(code)) return action;
    }
    return undefined;
  }

  /** Actions already using a code. Checked before a rebind so clashes surface. */
  conflicts(code: string, exclude?: Action): Action[] {
    return ALL_ACTIONS.filter(
      (a) => a !== exclude && this.map[a].includes(code),
    );
  }

  set(action: Action, codes: string[]): void {
    if (codes.length === 0) throw new Error(`bindings: ${ACTION_LABELS[action]} needs at least one key`);
    this.map[action] = [...codes];
  }

  reset(): void {
    this.map = structuredClone(DEFAULT_BINDINGS);
  }

  toJSON(): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const action of ALL_ACTIONS) out[String(action)] = [...this.map[action]];
    return out;
  }

  static fromJSON(json: Record<string, string[]>): Bindings {
    const partial: Partial<Record<Action, string[]>> = {};
    for (const action of ALL_ACTIONS) {
      const codes = json[String(action)];
      if (Array.isArray(codes) && codes.every((c) => typeof c === 'string')) {
        partial[action] = codes;
      }
    }
    return new Bindings(partial);
  }

  /** Persist. Storage is unavailable in private windows and in Node, so failures are ignored. */
  save(storage?: Pick<Storage, 'getItem' | 'setItem'>): void {
    const store = storage ?? safeStorage();
    if (!store) return;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(this.toJSON()));
    } catch {
      // A remap that cannot be persisted should still apply for this session.
    }
  }

  static load(storage?: Pick<Storage, 'getItem' | 'setItem'>): Bindings {
    const store = storage ?? safeStorage();
    if (!store) return new Bindings();
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (!raw) return new Bindings();
      return Bindings.fromJSON(JSON.parse(raw) as Record<string, string[]>);
    } catch {
      return new Bindings();
    }
  }
}

function safeStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}
