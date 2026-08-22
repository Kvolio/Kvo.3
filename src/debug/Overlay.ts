import { regionName } from '../geom/attributes.js';
import type { Engine } from '../core/Engine.js';
import type { Loop } from '../core/Loop.js';
import type { PlayerController } from '../player/PlayerController.js';
import type { CollisionWorld } from '../collision/CollisionWorld.js';
import { toMM } from '../spec/units.js';

/**
 * The `?debug=1` readout.
 *
 * Carries the numbers the Gauntlet's performance and collision criteria are
 * judged on, so a human can watch them live rather than only seeing them in a
 * test report. `recoveries` in particular should read zero forever: if the
 * anti-trap system ever fires during ordinary play, that is a finding.
 */
export class DebugOverlay {
  readonly root: HTMLDivElement;
  private accumulator = 0;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'debug-overlay';
    this.root.innerHTML = STYLE;
    container.appendChild(this.root);
  }

  update(
    dt: number,
    ctx: {
      engine: Engine;
      loop: Loop;
      player: PlayerController;
      world: CollisionWorld;
    },
  ): void {
    // Four updates a second: reading renderer.info every frame is itself a cost,
    // and a number that changes 60 times a second is unreadable anyway.
    this.accumulator += dt;
    if (this.accumulator < 0.25) return;
    this.accumulator = 0;

    const stats = ctx.engine.stats();
    const p = ctx.player;
    const pos = p.position;

    this.setText(`
      <b>${ctx.loop.fps} fps</b>
      draws ${stats.calls} · tris ${format(stats.triangles)}
      geo ${stats.geometries} · tex ${stats.textures}
      —
      pos ${toMM(pos.x).toFixed(0)}, ${toMM(pos.y).toFixed(0)}, ${toMM(pos.z).toFixed(0)} mm
      yaw ${((p.state.yaw * 180) / Math.PI).toFixed(0)}° · pitch ${((p.state.pitch * 180) / Math.PI).toFixed(0)}°
      ${p.state.grounded ? 'grounded' : 'airborne'}${p.state.crouching ? ' · crouched' : ''}
      region ${regionName(p.state.region)}
      —
      bodies ${ctx.world.bodyCount} · collision tris ${format(ctx.world.triangleCount)}
      penetration ${(p.lastMove.penetrationRemaining * 1000).toFixed(1)} mm
      <span class="${p.safePoses.recoveries > 0 ? 'bad' : 'good'}">recoveries ${p.safePoses.recoveries}</span>
    `);
  }

  private setText(html: string): void {
    const lines = html
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    this.root.innerHTML = `${STYLE}<pre>${lines.join('\n')}</pre>`;
  }

  dispose(): void {
    this.root.remove();
  }
}

const format = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n);

/** Is the debug overlay switched on for this session? */
export function debugEnabled(search: string): boolean {
  const value = new URLSearchParams(search).get('debug');
  return value === '1' || value === 'true';
}

const STYLE = `<style>
.debug-overlay {
  position: absolute;
  top: max(10px, env(safe-area-inset-top));
  left: max(10px, env(safe-area-inset-left));
  z-index: 30;
  pointer-events: none;
}
.debug-overlay pre {
  margin: 0;
  padding: 9px 12px;
  background: rgba(12, 12, 11, 0.78);
  border: 1px solid rgba(232, 226, 212, 0.16);
  border-radius: 4px;
  font: 500 10.5px/1.55 ui-monospace, Menlo, Consolas, monospace;
  color: rgba(232, 226, 212, 0.86);
  white-space: pre;
}
.debug-overlay b { color: #c8a54e; font-weight: 600; }
.debug-overlay .good { color: #7ba05b; }
.debug-overlay .bad { color: #c85a4e; }
</style>`;
