import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Bindings, DEFAULT_BINDINGS, keyLabel } from '../../src/input/Bindings.js';
import { InputManager } from '../../src/input/InputManager.js';
import { ReplayInputProvider, replay } from '../../src/input/ReplayInputProvider.js';
import {
  ALL_ACTIONS,
  Action,
  clampMove,
  createInputState,
  resetInputState,
  updateButton,
} from '../../src/input/types.js';

describe('button edges', () => {
  it('reports press and release for exactly one frame', () => {
    const b = { down: false, pressed: false, released: false, heldFor: 0 };

    updateButton(b, true, 0.016);
    expect(b.pressed).toBe(true);
    expect(b.down).toBe(true);

    updateButton(b, true, 0.016);
    expect(b.pressed).toBe(false);
    expect(b.down).toBe(true);
    expect(b.heldFor).toBeCloseTo(0.032, 5);

    updateButton(b, false, 0.016);
    expect(b.released).toBe(true);
    expect(b.down).toBe(false);
    expect(b.heldFor).toBe(0);

    updateButton(b, false, 0.016);
    expect(b.released).toBe(false);
  });
});

describe('movement clamping', () => {
  it('stops diagonal movement being faster than cardinal', () => {
    const move = { x: 1, y: 1 };
    clampMove(move);
    expect(Math.hypot(move.x, move.y)).toBeCloseTo(1, 6);
  });

  it('leaves partial deflection alone', () => {
    const move = { x: 0.3, y: 0.4 };
    clampMove(move);
    expect(move.x).toBeCloseTo(0.3, 6);
    expect(move.y).toBeCloseTo(0.4, 6);
  });
});

describe('bindings', () => {
  it('binds physical key positions, not characters', () => {
    // Codes, so WASD stays under the same fingers on AZERTY or Dvorak.
    expect(DEFAULT_BINDINGS[Action.MoveForward]).toContain('KeyW');
    expect(DEFAULT_BINDINGS[Action.Interact]).toContain('KeyE');
    expect(DEFAULT_BINDINGS[Action.AltInteract]).toContain('KeyF');
    expect(DEFAULT_BINDINGS[Action.Jump]).toContain('Space');
  });

  it('gives every action at least one key', () => {
    const b = new Bindings();
    for (const action of ALL_ACTIONS) {
      expect(b.get(action).length, Action[action]).toBeGreaterThan(0);
    }
  });

  it('resolves a code back to its action', () => {
    const b = new Bindings();
    expect(b.actionFor('KeyW')).toBe(Action.MoveForward);
    expect(b.actionFor('KeyQ')).toBeUndefined();
  });

  it('remaps and reports conflicts', () => {
    const b = new Bindings();
    expect(b.conflicts('KeyE')).toEqual([Action.Interact]);
    b.set(Action.Interact, ['KeyQ']);
    expect(b.actionFor('KeyE')).toBeUndefined();
    expect(b.actionFor('KeyQ')).toBe(Action.Interact);
    expect(b.conflicts('KeyQ', Action.Interact)).toEqual([]);
  });

  it('refuses to leave an action unbound', () => {
    const b = new Bindings();
    expect(() => b.set(Action.Interact, [])).toThrow();
  });

  it('round-trips through storage', () => {
    const store = new Map<string, string>();
    const fake = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };

    const a = new Bindings();
    a.set(Action.Interact, ['KeyQ']);
    a.set(Action.Jump, ['KeyZ']);
    a.save(fake);

    const b = Bindings.load(fake);
    expect(b.get(Action.Interact)).toEqual(['KeyQ']);
    expect(b.get(Action.Jump)).toEqual(['KeyZ']);
    expect(b.get(Action.MoveForward)).toEqual(DEFAULT_BINDINGS[Action.MoveForward]);
  });

  it('survives corrupt stored bindings rather than failing to start', () => {
    const fake = {
      getItem: () => '{ not json',
      setItem: () => undefined,
    };
    expect(Bindings.load(fake).get(Action.MoveForward)).toEqual(
      DEFAULT_BINDINGS[Action.MoveForward],
    );
  });

  it('labels keys readably for the prompt line', () => {
    expect(keyLabel('KeyE')).toBe('E');
    expect(keyLabel('Space')).toBe('Space');
    expect(keyLabel('ShiftLeft')).toBe('Shift');
    expect(keyLabel('ArrowUp')).toBe('Up arrow');
  });
});

describe('input manager', () => {
  it('merges providers into one pooled state', () => {
    const mgr = new InputManager(new Bindings());
    mgr.register(new ReplayInputProvider(replay.forward(3)));

    const first = mgr.update(0.016);
    const second = mgr.update(0.016);
    // Same object every frame: nothing allocates per frame.
    expect(first).toBe(second);
    expect(second.move.y).toBe(1);
  });

  it('clears transient state between frames', () => {
    const state = createInputState();
    state.move.x = 1;
    state.look.dx = 0.5;
    state.run = true;
    state.interact.down = true;
    resetInputState(state);
    expect(state.move.x).toBe(0);
    expect(state.look.dx).toBe(0);
    expect(state.run).toBe(false);
    expect(state.interact.down).toBe(false);
  });

  it('reports the device that last contributed', () => {
    const mgr = new InputManager(new Bindings());
    mgr.register(new ReplayInputProvider(replay.forward(2)));
    mgr.update(0.016);
    expect(mgr.state.lastDevice).toBe('replay');
  });

  it('shows a key on desktop and a legible word on touch', () => {
    // One prompt code path; only the glyph differs.
    const mgr = new InputManager(new Bindings());
    expect(mgr.glyphFor(Action.Interact, 'pc')).toBe('E');
    expect(mgr.glyphFor(Action.Interact, 'touch')).toBe('USE');
    expect(mgr.glyphFor(Action.AltInteract, 'touch')).toBe('ENTER');
  });

  it('follows a remap into the prompt glyph', () => {
    const bindings = new Bindings();
    bindings.set(Action.Interact, ['KeyQ']);
    const mgr = new InputManager(bindings);
    expect(mgr.glyphFor(Action.Interact, 'pc')).toBe('Q');
  });
});

describe('replay provider', () => {
  it('produces an identical sequence every run', () => {
    const script = [...replay.forward(5), ...replay.tap('interact'), ...replay.turn(3, 0.05)];
    const run = (): string => {
      const mgr = new InputManager(new Bindings());
      mgr.register(new ReplayInputProvider(structuredClone(script)));
      const log: string[] = [];
      for (let i = 0; i < script.length; i++) {
        const s = mgr.update(1 / 60);
        log.push(`${s.move.y.toFixed(3)},${s.look.dx.toFixed(4)},${s.interact.pressed}`);
      }
      return log.join('|');
    };
    expect(run()).toBe(run());
  });

  it('fires an interact edge exactly once per tap', () => {
    const mgr = new InputManager(new Bindings());
    mgr.register(new ReplayInputProvider([...replay.tap('interact'), ...replay.tap('interact')]));
    const edges: boolean[] = [];
    for (let i = 0; i < 4; i++) edges.push(mgr.update(1 / 60).interact.pressed);
    expect(edges).toEqual([true, false, true, false]);
  });

  it('reports when the script has run out', () => {
    const p = new ReplayInputProvider(replay.forward(2));
    const state = createInputState();
    expect(p.finished).toBe(false);
    p.sample(1 / 60, state);
    p.sample(1 / 60, state);
    expect(p.finished).toBe(true);
  });
});

describe('input architecture', () => {
  // The brief requires that PC and mobile drive the same interaction logic, and
  // that only the input method differs. Lint enforces this while editing; this
  // asserts it in the suite too, because it is the one rule whose violation
  // would be invisible until the two platforms had already diverged.
  it('keeps every device event inside src/input', () => {
    const banned = /\b(KeyboardEvent|TouchEvent|PointerEvent|MouseEvent)\b|addEventListener\(\s*['"`](key|touch|pointer|mouse|wheel)/;
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry === 'input') continue;
          walk(full);
          continue;
        }
        if (!entry.endsWith('.ts')) continue;
        const source = readFileSync(full, 'utf8');
        if (banned.test(source)) offenders.push(full);
      }
    };
    walk('src');

    expect(offenders).toEqual([]);
  });
});
