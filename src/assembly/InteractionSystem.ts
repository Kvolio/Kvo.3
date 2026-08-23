import type { Vector3 } from 'three';
import type { InputState } from '../input/types.js';

/**
 * What the player can operate, and which one they are looking at.
 *
 * The whole point of the input abstraction is that this file never learns
 * whether a hatch was opened by a key, a thumb or a gamepad button: it reads
 * `InputState.interact` and nothing else. A tap on a mobile action button and
 * the E key arrive here identically, so the two paths cannot drift apart in
 * behaviour — which they always do when each device gets its own handler.
 */

export interface Interactable {
  readonly id: string;
  /** Where the prompt hangs and what distance is measured to, in scene units. */
  position(): Vector3;
  /** Shown in the prompt: "Open the driver's hatch". */
  label(): string;
  /** How close the player must be, in scene units. */
  readonly reach: number;
  activate(): void;
}

export interface InteractionFocus {
  readonly interactable: Interactable;
  readonly distance: number;
}

export class InteractionSystem {
  private readonly items: Interactable[] = [];
  private current: InteractionFocus | null = null;

  add(item: Interactable): void {
    this.items.push(item);
  }

  get focus(): InteractionFocus | null {
    return this.current;
  }

  /**
   * Pick what the player is offered.
   *
   * Nearest within reach wins, but facing is weighted in: standing between two
   * hatches and looking at one should offer that one, not whichever happens to
   * be a few centimetres closer. The weight is gentle, so looking away from
   * something you are standing on top of still offers it.
   */
  update(eye: Vector3, forward: Vector3, input: InputState): void {
    let best: InteractionFocus | null = null;
    let bestScore = Infinity;

    for (const item of this.items) {
      const to = item.position().sub(eye);
      const distance = to.length();
      if (distance > item.reach) continue;

      const facing = distance > 1e-4 ? to.divideScalar(distance).dot(forward) : 1;
      const score = distance * (1.6 - 0.6 * Math.max(0, facing));
      if (score < bestScore) {
        bestScore = score;
        best = { interactable: item, distance };
      }
    }

    this.current = best;

    if (best !== null && input.interact.pressed) {
      best.interactable.activate();
    }
  }
}
