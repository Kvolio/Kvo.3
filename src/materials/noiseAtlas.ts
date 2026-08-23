import { DataTexture, RGBAFormat, RepeatWrapping, UnsignedByteType, LinearMipmapLinearFilter, LinearFilter } from 'three';
import { fbm2Tiled, noise2Tiled, worley2Tiled } from '../geom/noise.js';

/**
 * The one texture this project ships — and it is generated, not loaded.
 *
 * The naive way to get procedural surface detail is to evaluate fBm per pixel
 * in the fragment shader. That is expensive on a phone and pointless: the noise
 * is static. So it is baked once at startup into a single RGBA atlas whose four
 * channels are uncorrelated fields, then sampled triplanar in world space.
 *
 * Triplanar sampling matters for more than convenience here. Procedural
 * geometry has no meaningful UV unwrap, and any CSG operation destroys what UVs
 * there were, so projecting from world space is the only approach that stays
 * correct across the whole vehicle.
 *
 *   R  fBm            broad roughness breakup, dust settling
 *   G  gradient noise high frequency; micro roughness and chip edges
 *   B  Worley         cellular pitting, for cast steel and rust blooms
 *   A  streak         anisotropic; rain streaking and directional scuffing
 */

export interface NoiseAtlasOptions {
  readonly size?: number;
  readonly seed?: number;
}

/** Build the atlas. Deterministic for a given size and seed. */
export function createNoiseAtlas(opts: NoiseAtlasOptions = {}): DataTexture {
  const { size = 512, seed = 20430218 } = opts;
  const data = new Uint8Array(size * size * 4);

  // Every channel uses a tileable generator whose lattice wraps at its cell
  // count. Without that the atlas is discontinuous at its edges, and since it is
  // sampled triplanar and repeats every few centimetres, the discontinuity shows
  // up on the model as a regular grid of seams across every flat surface.
  const FBM_CELLS = 8;
  const GRAD_CELLS = 64;
  const WORLEY_CELLS = 24;
  const STREAK_CELLS = 96;
  // Very low frequency along the streak direction, so the field is directional.
  const STREAK_PERIOD = 3;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const i = (y * size + x) * 4;

      const broad = fbm2Tiled(u * FBM_CELLS, v * FBM_CELLS, FBM_CELLS, 5, seed);
      const micro = noise2Tiled(u * GRAD_CELLS, v * GRAD_CELLS, GRAD_CELLS, seed + 811);
      const cell = worley2Tiled(u * WORLEY_CELLS, v * WORLEY_CELLS, WORLEY_CELLS, seed + 2237);

      // Streaks: high frequency across, very low frequency along, so the field
      // is directional rather than isotropic.
      const streak = noise2Tiled(
        u * STREAK_CELLS,
        v * STREAK_PERIOD,
        STREAK_CELLS,
        seed + 5051,
        STREAK_PERIOD,
      );

      data[i] = Math.round(broad * 255);
      data[i + 1] = Math.round(micro * 255);
      data[i + 2] = Math.round(cell * 255);
      data[i + 3] = Math.round(streak * 255);
    }
  }

  const texture = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  texture.name = 'tiger-noise-atlas';
  return texture;
}

/** Bytes occupied by an atlas of the given size, before mipmaps. */
export function atlasByteSize(size: number): number {
  return size * size * 4;
}
