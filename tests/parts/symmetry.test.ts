import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { buildAssembly, buildLowerHull } from '../../src/parts/hull/index.js';
import { measureThicknessAlong } from '../../src/geom/analysis.js';
import { S, mm } from '../../src/spec/units.js';
import { LOWER_HALF_WIDTH } from '../../src/spec/index.js';

const built = buildAssembly(buildLowerHull);
const { geometry, materials } = built.context.render.toGeometry();

/**
 * Which material owns each vertex, so weld beads can be excluded.
 *
 * The armour must be symmetric. The BEADS must not be: a bead's radius is
 * modulated along its length to give the stacked-dimes cadence a hand-laid weld
 * has, so a seam running across the vehicle is irregular from one side to the
 * other by design. Excluding them is what lets this test stay strict about the
 * thing that matters.
 */
const ownerOf = ((): string[] => {
  const index = geometry.getIndex()!;
  const owner = new Array<string>(geometry.getAttribute('position').count).fill('?');
  for (const group of geometry.groups) {
    const name = materials[group.materialIndex ?? 0] ?? '?';
    for (let i = group.start; i < group.start + group.count; i++) {
      owner[index.getX(i)] = name;
    }
  }
  return owner;
})();

/**
 * The Tiger's hull is symmetric about its centreline. The running gear is not —
 * the swing arms lead on one side and trail on the other — but the armour is,
 * and any asymmetry in it is a modelling error rather than a feature.
 *
 * This matters more than it sounds. Plates on the two sides are placed by
 * rotating the same frame through plus or minus ninety degrees, and that maps a
 * plate's local axis to opposite world directions on the two sides. Author one
 * profile and use it for both, and one side comes out reversed end for end —
 * with its nose slope at the tail. It is invisible from any angle that shows
 * only one side, and a bounding box cannot see it either.
 */
describe('hull symmetry', () => {
  it('mirrors every vertex about the centreline', () => {
    const pos = geometry.getAttribute('position');
    // A one-millimetre spatial hash, searched across neighbouring cells, so a
    // vertex that mirrors to within a tenth of a millimetre is found regardless
    // of which side of a cell boundary floating point put it on. Comparing
    // quantised keys directly is simpler and reports spurious failures at every
    // plate corner that lands exactly on one.
    // Half a millimetre. Tight enough that a reversed plate — which is wrong by
    // metres — cannot hide, and loose enough not to chase the sub-0.01 mm noise
    // that vertex merging introduces: the quantised hash it uses can collapse
    // two near-coincident vertices on one side and not the other.
    const CELL = 0.002;
    const TOLERANCE = 0.0005;

    const cells = new Map<string, number[]>();
    const cellKey = (x: number, y: number, z: number): string =>
      `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;

    for (let i = 0; i < pos.count; i++) {
      const key = cellKey(pos.getX(i), pos.getY(i), pos.getZ(i));
      const bucket = cells.get(key);
      if (bucket) bucket.push(i);
      else cells.set(key, [i]);
    }

    const hasVertexNear = (x: number, y: number, z: number): boolean => {
      const cx = Math.floor(x / CELL);
      const cy = Math.floor(y / CELL);
      const cz = Math.floor(z / CELL);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const bucket = cells.get(`${cx + dx},${cy + dy},${cz + dz}`);
            if (!bucket) continue;
            for (const i of bucket) {
              if (
                Math.abs(pos.getX(i) - x) < TOLERANCE &&
                Math.abs(pos.getY(i) - y) < TOLERANCE &&
                Math.abs(pos.getZ(i) - z) < TOLERANCE
              ) {
                return true;
              }
            }
          }
        }
      }
      return false;
    };

    const missing: string[] = [];
    for (let i = 0; i < pos.count && missing.length < 5; i++) {
      const x = pos.getX(i);
      // Vertices on the centreline are their own mirror.
      if (Math.abs(x) < TOLERANCE) continue;
      if (ownerOf[i] === 'weldBead') continue;
      if (!hasVertexNear(-x, pos.getY(i), pos.getZ(i))) {
        missing.push(`(${x.toFixed(4)}, ${pos.getY(i).toFixed(4)}, ${pos.getZ(i).toFixed(4)})`);
      }
    }

    expect(missing, `vertices with no mirror: ${missing.join(' ')}`).toEqual([]);
  });

  it('puts the nose slope at the front on both sides', () => {
    // Directly under the sloped nose there is no side plate, because the plate
    // follows the slope up. Directly under the tail there is. Fire a ray up at
    // each end on each side; the pattern must match left and right.
    const probe = (x: number, z: number): boolean =>
      measureThicknessAlong(
        geometry,
        new Vector3(S(mm(x)), S(mm(420)), S(mm(z))),
        new Vector3(0, 1, 0),
        S(mm(1200)),
      ) !== null;

    const nearNoseZ = 3050;
    const nearTailZ = -3050;
    const x = LOWER_HALF_WIDTH - 20;

    expect(probe(-x, nearNoseZ), 'port, near the nose').toBe(probe(x, nearNoseZ));
    expect(probe(-x, nearTailZ), 'port, near the tail').toBe(probe(x, nearTailZ));
  });
});

describe('weld beads are deliberately not symmetric', () => {
  it('varies a cross-vehicle bead along its length', () => {
    // The counterpart to the test above, so the exclusion there is a stated
    // property rather than a convenient omission. The belly-to-nose seam runs
    // straight across the vehicle; if its bead were mirror-symmetric about the
    // centreline, the ripple would not be doing its job.
    const pos = geometry.getAttribute('position');
    let beadVertices = 0;
    let asymmetric = 0;

    const CELL = 0.002;
    const TOL = 0.0005;
    const cells = new Map<string, number[]>();
    for (let i = 0; i < pos.count; i++) {
      if (ownerOf[i] !== 'weldBead') continue;
      const key = `${Math.floor(pos.getX(i) / CELL)},${Math.floor(pos.getY(i) / CELL)},${Math.floor(pos.getZ(i) / CELL)}`;
      const bucket = cells.get(key);
      if (bucket) bucket.push(i);
      else cells.set(key, [i]);
    }

    for (let i = 0; i < pos.count; i++) {
      if (ownerOf[i] !== 'weldBead') continue;
      const x = pos.getX(i);
      if (Math.abs(x) < TOL) continue;
      beadVertices++;
      const cx = Math.floor(-x / CELL);
      const cy = Math.floor(pos.getY(i) / CELL);
      const cz = Math.floor(pos.getZ(i) / CELL);
      let found = false;
      for (let dx = -1; dx <= 1 && !found; dx++) {
        for (let dy = -1; dy <= 1 && !found; dy++) {
          for (let dz = -1; dz <= 1 && !found; dz++) {
            for (const j of cells.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
              if (
                Math.abs(pos.getX(j) + x) < TOL &&
                Math.abs(pos.getY(j) - pos.getY(i)) < TOL &&
                Math.abs(pos.getZ(j) - pos.getZ(i)) < TOL
              ) {
                found = true;
                break;
              }
            }
          }
        }
      }
      if (!found) asymmetric++;
    }

    expect(beadVertices).toBeGreaterThan(0);
    expect(asymmetric).toBeGreaterThan(0);
  });
});
