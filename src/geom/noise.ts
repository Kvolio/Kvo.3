/**
 * Deterministic value noise.
 *
 * Two jobs: modulating weld bead radius so a seam reads as stacked dimes rather
 * than a swept tube, and generating the material atlas at startup. Both must be
 * reproducible — the Playwright screenshot baselines compare renders across
 * runs, so a `Math.random()` anywhere in the build pipeline would make the
 * visual suite permanently red.
 */

/** Mulberry32. Small, fast, and identical across engines. */
export function makeRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash1 = (i: number, seed: number): number => {
  let h = Math.imul(i ^ seed, 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

const hash2 = (x: number, y: number, seed: number): number => {
  let h = Math.imul(x ^ Math.imul(y, 0x9e3779b1) ^ seed, 0x27d4eb2d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Value noise in one dimension, in [0, 1]. */
export function noise1(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  return hash1(i, seed) * (1 - smooth(f)) + hash1(i + 1, seed) * smooth(f);
}

/** Value noise in two dimensions, in [0, 1]. */
export function noise2(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/** Fractal Brownian motion over `noise2`, in [0, 1]. */
export function fbm2(x: number, y: number, octaves = 5, seed = 0, lacunarity = 2, gain = 0.5): number {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * noise2(x * frequency, y * frequency, seed + o * 101);
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return sum / norm;
}

/**
 * Worley / cellular noise, returning the distance to the nearest feature point,
 * normalised to roughly [0, 1]. This is what gives cast steel its pitted
 * character, as opposed to the smooth swell of value noise.
 */
export function worley2(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let best = Infinity;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx;
      const cy = iy + dy;
      const px = cx + hash2(cx, cy, seed);
      const py = cy + hash2(cx, cy, seed + 7919);
      const d = (px - x) ** 2 + (py - y) ** 2;
      if (d < best) best = d;
    }
  }
  return Math.min(1, Math.sqrt(best) * 1.4);
}

// -----------------------------------------------------------------------------
// Tileable variants
//
// The atlas is sampled triplanar in world space and repeats every few
// centimetres, so any discontinuity at its edges appears on the model as a
// regular grid of seams — which is exactly what a lattice noise does when its
// hash is not wrapped, because the value at u = 0 has nothing to do with the
// value at u = 1. Wrapping the lattice indices at the period makes the field
// genuinely periodic, and the seams disappear.
// -----------------------------------------------------------------------------

const wrap = (n: number, period: number): number => ((n % period) + period) % period;

/**
 * Value noise that repeats exactly every `periodX` by `periodY` units.
 *
 * The two periods are separate because an anisotropic field — the streak
 * channel scales its axes by very different amounts — needs to wrap at a
 * different distance on each. Wrapping both at the larger one leaves a seam
 * along the axis that was scaled less.
 */
export function noise2Tiled(
  x: number,
  y: number,
  periodX: number,
  seed = 0,
  periodY: number = periodX,
): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const x0 = wrap(ix, periodX);
  const y0 = wrap(iy, periodY);
  const x1 = wrap(ix + 1, periodX);
  const y1 = wrap(iy + 1, periodY);

  const a = hash2(x0, y0, seed);
  const b = hash2(x1, y0, seed);
  const c = hash2(x0, y1, seed);
  const d = hash2(x1, y1, seed);
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/**
 * fBm over `noise2Tiled`. Each octave doubles both frequency and period, so
 * every octave shares the same repeat distance and the sum stays periodic.
 */
export function fbm2Tiled(
  x: number,
  y: number,
  period: number,
  octaves = 5,
  seed = 0,
  gain = 0.5,
): number {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * noise2Tiled(x * frequency, y * frequency, period * frequency, seed + o * 101);
    norm += amplitude;
    amplitude *= gain;
    frequency *= 2;
  }
  return sum / norm;
}

/** Worley noise that repeats exactly every `period` units. */
export function worley2Tiled(x: number, y: number, period: number, seed = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let best = Infinity;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx;
      const cy = iy + dy;
      // The feature point is looked up by its wrapped index but positioned in
      // unwrapped space, so cells across the seam agree on where it is.
      const hx = wrap(cx, period);
      const hy = wrap(cy, period);
      const px = cx + hash2(hx, hy, seed);
      const py = cy + hash2(hx, hy, seed + 7919);
      const d = (px - x) ** 2 + (py - y) ** 2;
      if (d < best) best = d;
    }
  }
  return Math.min(1, Math.sqrt(best) * 1.4);
}
