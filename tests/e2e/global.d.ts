export {};

/**
 * The in-page test harness.
 *
 * Typed loosely on purpose: it is a diagnostic surface that grows as subsystems
 * arrive, and pinning it precisely would mean editing this file for every new
 * probe. The few members the browser suite leans on hardest are named, so a
 * rename in `main.ts` breaks the tests at compile time rather than at midnight.
 */
declare global {
  interface TigerArticulation {
    readonly isOpen: boolean;
    readonly isMoving: boolean;
    readonly openFraction: number;
    readonly mesh: {
      updateMatrixWorld(force?: boolean): void;
      matrixWorld: { elements: number[] };
    };
    toggle(): void;
    setOpen(open: boolean): void;
    settle(): void;
  }

  interface TigerHarness {
    ready?: boolean;
    /** Everything else the harness exposes, unnamed until a test needs it. */
    [key: string]: unknown;
    step(steps: number): void;
    interactionPrompt(): string | null;
    internals: {
      articulations: TigerArticulation[];
      player: {
        teleport(position: unknown, yaw?: number): void;
        state: { pitch: number; yaw: number };
      };
      THREE: { Vector3: new (x: number, y: number, z: number) => unknown };
      [key: string]: unknown;
    };
  }

  interface Window {
    __TIGER__?: TigerHarness;
  }
}
