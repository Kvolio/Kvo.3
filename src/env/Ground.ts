import { Mesh, PlaneGeometry, type BufferAttribute, type Material } from 'three';
import { fbm2 } from '../geom/noise.js';
import { Region, ensureProcAttributes } from '../geom/attributes.js';
import { S, mm, type MM } from '../spec/units.js';
import { WORLD_RADIUS } from '../spec/viewpoints.js';

/**
 * The ground the vehicle stands on.
 *
 * Deliberately not flat. The suspension solver's whole purpose is to let
 * sixteen torsion-bar stations move independently over uneven terrain, and a
 * billiard table would make that impossible to see or to test. The undulation
 * is gentle enough that the hull sits level but pronounced enough that adjacent
 * road wheels are at genuinely different heights.
 *
 * `heightAt` is the analytic form of the same field, so the suspension solver
 * can query terrain height without a raycast when it only needs an estimate.
 */

export interface GroundOptions {
  readonly radius?: MM;
  readonly segments?: number;
  /** Peak-to-trough undulation. */
  readonly relief?: MM;
  readonly seed?: number;
}

const DEFAULT_RELIEF = mm(90);
const TERRAIN_SCALE = 0.08;

export function terrainHeight(x: number, z: number, relief: number, seed: number): number {
  // Two octave sets at different scales: broad swells the hull rides over, and
  // a finer ripple that individual road wheels pick up.
  const broad = fbm2(x * TERRAIN_SCALE, z * TERRAIN_SCALE, 4, seed) - 0.5;
  const fine = fbm2(x * TERRAIN_SCALE * 5.3, z * TERRAIN_SCALE * 5.3, 3, seed + 77) - 0.5;
  return (broad * 0.75 + fine * 0.25) * relief;
}

export class Ground {
  readonly mesh: Mesh;
  private readonly relief: number;
  private readonly seed: number;

  constructor(material: Material, opts: GroundOptions = {}) {
    const radius = opts.radius ?? WORLD_RADIUS;
    const segments = opts.segments ?? 160;
    this.relief = S(opts.relief ?? DEFAULT_RELIEF);
    this.seed = opts.seed ?? 4471;

    const size = S(radius) * 2;
    const geometry = new PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const position = geometry.getAttribute('position') as BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      position.setY(i, terrainHeight(x, z, this.relief, this.seed));
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();

    // Authored outside the plate pipeline, so the custom attributes have to be
    // supplied explicitly.
    ensureProcAttributes(geometry, { region: Region.Exterior });

    this.mesh = new Mesh(geometry, material);
    this.mesh.name = 'ground';
    this.mesh.receiveShadow = true;
  }

  /** Terrain height at a world position, in scene units. */
  heightAt(x: number, z: number): number {
    return terrainHeight(x, z, this.relief, this.seed);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }
}
