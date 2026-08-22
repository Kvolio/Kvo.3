/**
 * Quality tiers.
 *
 * The brief requires this to run on both desktop and mobile without making the
 * mobile build an afterthought. That means one scene graph and one set of
 * builders, with a tier that decides render resolution, shadow budget, LOD bias
 * and which material features are worth their shader permutations.
 */

export type QualityTierName = 'low' | 'mid' | 'high';

export interface QualitySettings {
  readonly name: QualityTierName;
  /** Upper bound on devicePixelRatio. */
  readonly maxPixelRatio: number;
  /** Shadow map resolution, or 0 for no shadows. */
  readonly shadowMapSize: number;
  /** Added to every part's detail level, so 1 means "one step coarser". */
  readonly lodBias: 0 | 1 | 2;
  readonly noiseAtlasSize: number;
  /**
   * Whether transmission, clearcoat and sheen are honoured. Each compiles an
   * extra shader permutation and costs real time on a phone GPU.
   */
  readonly physicalExtras: boolean;
  readonly antialias: boolean;
  /** Ground-contact rays per suspension station. */
  readonly suspensionRays: 3 | 9;
  readonly targetFps: number;
}

export const QUALITY_TIERS: Record<QualityTierName, QualitySettings> = {
  low: {
    name: 'low',
    maxPixelRatio: 0.85,
    shadowMapSize: 0,
    lodBias: 1,
    noiseAtlasSize: 256,
    physicalExtras: false,
    antialias: false,
    suspensionRays: 3,
    targetFps: 30,
  },
  mid: {
    name: 'mid',
    maxPixelRatio: 1.0,
    shadowMapSize: 1024,
    lodBias: 0,
    noiseAtlasSize: 512,
    physicalExtras: true,
    antialias: false,
    suspensionRays: 3,
    targetFps: 60,
  },
  high: {
    name: 'high',
    maxPixelRatio: 1.5,
    shadowMapSize: 2048,
    lodBias: 0,
    noiseAtlasSize: 512,
    physicalExtras: true,
    antialias: true,
    suspensionRays: 9,
    targetFps: 60,
  },
};

export interface DetectionInputs {
  readonly hardwareConcurrency: number;
  readonly devicePixelRatio: number;
  readonly maxTouchPoints: number;
  readonly rendererString?: string;
  readonly userAgent?: string;
  /** Explicit override, from `?quality=` on the URL. */
  readonly override?: QualityTierName;
}

const MOBILE_GPU_HINTS = ['adreno', 'mali', 'powervr', 'apple gpu', 'tegra'];
const SOFTWARE_HINTS = ['swiftshader', 'llvmpipe', 'software'];

/**
 * Pick a tier from what the browser will admit to.
 *
 * Deliberately conservative: a phone misdetected as desktop drops frames for
 * the whole session, whereas a desktop misdetected as mobile is corrected
 * within seconds by the performance governor once it sees the headroom.
 */
export function detectQualityTier(inputs: DetectionInputs): QualitySettings {
  if (inputs.override) return QUALITY_TIERS[inputs.override];

  const renderer = (inputs.rendererString ?? '').toLowerCase();
  const ua = (inputs.userAgent ?? '').toLowerCase();

  // Headless WebGL through SwiftShader is what the visual test suite runs on.
  // It is slow, but it must be deterministic, so it gets a fixed tier rather
  // than whatever the heuristics below would make of it.
  if (SOFTWARE_HINTS.some((h) => renderer.includes(h))) return QUALITY_TIERS.mid;

  const looksMobile =
    MOBILE_GPU_HINTS.some((h) => renderer.includes(h)) ||
    /android|iphone|ipad|ipod|mobile/.test(ua) ||
    (inputs.maxTouchPoints > 0 && inputs.hardwareConcurrency <= 8);

  if (looksMobile) return QUALITY_TIERS.low;
  if (inputs.hardwareConcurrency >= 8 && inputs.devicePixelRatio <= 2) return QUALITY_TIERS.high;
  return QUALITY_TIERS.mid;
}

/** Read a tier override from a query string, if it names a real one. */
export function overrideFromSearch(search: string): QualityTierName | undefined {
  const value = new URLSearchParams(search).get('quality');
  if (value === 'low' || value === 'mid' || value === 'high') return value;
  return undefined;
}
