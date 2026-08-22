/**
 * Fixed-timestep loop.
 *
 * Simulation runs at a fixed rate and rendering at whatever the display can
 * manage. This is not tidiness: the collision resolver, the suspension solver
 * and the track phase accumulator all have to be deterministic for the tests to
 * assert anything about them, and a variable timestep makes every one of those
 * results depend on the frame rate of the machine that produced it.
 */

export interface LoopCallbacks {
  /** Called at a fixed rate, possibly several times per frame. */
  readonly fixedUpdate: (dt: number) => void;
  /** Called once per frame with the real elapsed time. */
  readonly render: (dt: number, alpha: number) => void;
}

export class Loop {
  private readonly step: number;
  private readonly maxSubsteps: number;
  private accumulator = 0;
  private lastTime = 0;
  private running = false;
  private frameHandle = 0;

  private frameCount = 0;
  private fpsWindowSeconds = 0;
  private fpsWindowFrames = 0;
  private fpsValue = 0;

  constructor(
    private readonly callbacks: LoopCallbacks,
    opts: { hz?: number; maxSubsteps?: number } = {},
  ) {
    this.step = 1 / (opts.hz ?? 60);
    // Cap the catch-up: after a tab has been backgrounded for a minute, running
    // 3600 substeps to "catch up" would freeze the page far longer than the
    // stall it is compensating for.
    this.maxSubsteps = opts.maxSubsteps ?? 5;
  }

  get fps(): number {
    return this.fpsValue;
  }

  get frames(): number {
    return this.frameCount;
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = now();
    this.accumulator = 0;
    this.frameHandle = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.frameHandle) cancelAnimationFrame(this.frameHandle);
    this.frameHandle = 0;
  }

  /** Advance by an exact number of fixed steps. Used by headless tests. */
  advance(steps: number): void {
    for (let i = 0; i < steps; i++) this.callbacks.fixedUpdate(this.step);
    this.callbacks.render(this.step * steps, 0);
  }

  private readonly tick = (): void => {
    if (!this.running) return;
    this.frameHandle = requestAnimationFrame(this.tick);

    const time = now();
    let frameTime = (time - this.lastTime) / 1000;
    this.lastTime = time;
    if (!Number.isFinite(frameTime) || frameTime < 0) frameTime = this.step;
    // Clamp so a long stall does not teleport anything through a wall.
    frameTime = Math.min(frameTime, this.step * this.maxSubsteps);

    this.accumulator += frameTime;
    let substeps = 0;
    while (this.accumulator >= this.step && substeps < this.maxSubsteps) {
      this.callbacks.fixedUpdate(this.step);
      this.accumulator -= this.step;
      substeps++;
    }

    this.frameCount++;
    this.fpsWindowSeconds += frameTime;
    this.fpsWindowFrames++;
    if (this.fpsWindowSeconds >= 0.5) {
      this.fpsValue = Math.round(this.fpsWindowFrames / this.fpsWindowSeconds);
      this.fpsWindowSeconds = 0;
      this.fpsWindowFrames = 0;
    }

    this.callbacks.render(frameTime, this.accumulator / this.step);
  };
}

const now = (): number =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();
