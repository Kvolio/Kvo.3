import {
  BUTTON_KEYS,
  clampMove,
  updateButton,
  type DeviceKind,
  type InputProvider,
  type InputState,
} from './types.js';

/** One frame of recorded input. Only what differs from neutral needs recording. */
export interface ReplayFrame {
  readonly move?: { x: number; y: number };
  readonly look?: { dx: number; dy: number };
  readonly run?: boolean;
  readonly crouch?: boolean;
  readonly buttons?: Partial<Record<(typeof BUTTON_KEYS)[number], boolean>>;
}

/**
 * Plays a recorded input sequence at a fixed timestep.
 *
 * Built first, not last. This is what makes the end-to-end walkthrough test
 * deterministic — driving the player through the real controller, the real
 * collision resolver and the real mantle system, rather than teleporting a
 * camera along a scripted path and asserting nothing.
 */
export class ReplayInputProvider implements InputProvider {
  readonly id: DeviceKind = 'replay';
  private frames: ReplayFrame[];
  private cursor = 0;
  private looping: boolean;

  constructor(frames: ReplayFrame[] = [], opts?: { loop?: boolean }) {
    this.frames = frames;
    this.looping = opts?.loop ?? false;
  }

  get isActive(): boolean {
    return this.cursor < this.frames.length || this.looping;
  }

  get finished(): boolean {
    return !this.looping && this.cursor >= this.frames.length;
  }

  get frameIndex(): number {
    return this.cursor;
  }

  get frameCount(): number {
    return this.frames.length;
  }

  load(frames: ReplayFrame[]): void {
    this.frames = frames;
    this.cursor = 0;
  }

  rewind(): void {
    this.cursor = 0;
  }

  attach(): void {
    // Nothing to listen to.
  }

  detach(): void {
    // Nothing to release.
  }

  sample(dt: number, out: InputState): void {
    const frame = this.frames[this.cursor];
    if (frame === undefined) {
      if (this.looping && this.frames.length > 0) this.cursor = 0;
      return;
    }
    this.cursor++;

    if (frame.move) {
      out.move.x += frame.move.x;
      out.move.y += frame.move.y;
      clampMove(out.move);
    }
    if (frame.look) {
      out.look.dx += frame.look.dx;
      out.look.dy += frame.look.dy;
    }
    if (frame.run) out.run = true;
    if (frame.crouch) out.crouch = true;

    for (const key of BUTTON_KEYS) {
      const held = frame.buttons?.[key] ?? false;
      if (held) updateButton(out[key], true, dt);
    }

    out.lastDevice = 'replay';
  }
}

/** Convenience builders, so a walkthrough script reads as instructions. */
export const replay = {
  hold(frames: number, frame: ReplayFrame): ReplayFrame[] {
    return Array.from({ length: frames }, () => frame);
  },
  idle(frames: number): ReplayFrame[] {
    return Array.from({ length: frames }, () => ({}));
  },
  forward(frames: number, run = false): ReplayFrame[] {
    return Array.from({ length: frames }, () => ({ move: { x: 0, y: 1 }, run }));
  },
  turn(frames: number, radiansPerFrame: number): ReplayFrame[] {
    return Array.from({ length: frames }, () => ({ look: { dx: radiansPerFrame, dy: 0 } }));
  },
  tap(button: (typeof BUTTON_KEYS)[number]): ReplayFrame[] {
    // A press must be followed by a release frame or the edge never fires.
    return [{ buttons: { [button]: true } }, {}];
  },
};
