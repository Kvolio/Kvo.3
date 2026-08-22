import {
  Color,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type DataTexture,
  type Material,
  type Texture,
  type WebGLProgramParametersWithUniforms,
} from 'three';
import { createNoiseAtlas } from './noiseAtlas.js';
import { presetFor, type MaterialPreset } from './presets.js';
import {
  PROC_DETAIL_MAP_FRAGMENT,
  PROC_DETAIL_METALNESS_FRAGMENT,
  PROC_DETAIL_PARS_FRAGMENT,
  PROC_DETAIL_PARS_VERTEX,
  PROC_DETAIL_ROUGHNESS_FRAGMENT,
  PROC_DETAIL_VERTEX,
} from './shaders.js';
import { QUALITY_TIERS, type QualitySettings } from '../core/QualityTier.js';

/**
 * Resolves a material id to a real three.js material, once.
 *
 * Every part builder names its materials as strings; nothing in the model layer
 * ever constructs a Material. That keeps the geometry pure and testable in Node
 * — where there is no WebGL context at all — and means switching quality tiers
 * or debug modes is one call here rather than a walk over the scene graph.
 */

export type DebugAttributeMode = 'off' | 'edgeDist' | 'cavity' | 'wear' | 'region';

const DEBUG_MODE_VALUE: Record<DebugAttributeMode, number> = {
  off: 0,
  edgeDist: 1,
  cavity: 2,
  wear: 3,
  region: 4,
};

export class MaterialLibrary {
  private readonly cache = new Map<string, Material>();
  private readonly atlas: DataTexture;
  private readonly quality: QualitySettings;
  private debugMode: DebugAttributeMode = 'off';

  /** Every material's uniform block, so a debug toggle is a single sweep. */
  private readonly uniformBlocks: Record<string, { value: unknown }>[] = [];

  constructor(quality: QualitySettings = QUALITY_TIERS.mid, atlas?: DataTexture) {
    this.quality = quality;
    this.atlas = atlas ?? createNoiseAtlas({ size: quality.noiseAtlasSize });
  }

  get noiseAtlas(): Texture {
    return this.atlas;
  }

  get materialCount(): number {
    return this.cache.size;
  }

  /** Resolve an id, building and caching the material on first use. */
  get(id: string): Material {
    const cached = this.cache.get(id);
    if (cached) return cached;
    const material = this.build(presetFor(id));
    this.cache.set(id, material);
    return material;
  }

  /** Resolve a list of ids in order, for a geometry's material groups. */
  resolve(ids: readonly string[]): Material[] {
    return ids.map((id) => this.get(id));
  }

  /**
   * Show a raw vertex attribute instead of the shaded surface.
   * This is how a human checks that the shader is being told what the builders
   * think they wrote — chipping in the wrong place is invisible otherwise.
   */
  setDebugMode(mode: DebugAttributeMode): void {
    this.debugMode = mode;
    const value = DEBUG_MODE_VALUE[mode];
    for (const uniforms of this.uniformBlocks) {
      const u = uniforms['uDebugMode'];
      if (u) u.value = value;
    }
  }

  getDebugMode(): DebugAttributeMode {
    return this.debugMode;
  }

  dispose(): void {
    for (const m of this.cache.values()) m.dispose();
    this.cache.clear();
    this.uniformBlocks.length = 0;
    this.atlas.dispose();
  }

  private build(preset: MaterialPreset): Material {
    const extras = this.quality.physicalExtras;

    // Transmission is the single most expensive feature here, so on the low
    // tier optics fall back to a plain opaque standard material rather than
    // compiling a transmission permutation for six vision blocks.
    if (preset.transmission !== undefined && !extras) {
      const fallback = new MeshStandardMaterial({
        color: preset.paint.clone(),
        roughness: preset.baseRoughness,
        metalness: 0.1,
      });
      fallback.name = `${preset.id}:lowTier`;
      return fallback;
    }

    const material = new MeshPhysicalMaterial({
      color: new Color(0xffffff),
      roughness: preset.baseRoughness,
      metalness: preset.baseMetalness,
    });
    material.name = preset.id;

    if (extras) {
      if (preset.clearcoat !== undefined) material.clearcoat = preset.clearcoat;
      if (preset.sheen !== undefined) material.sheen = preset.sheen;
      if (preset.transmission !== undefined) {
        material.transmission = preset.transmission;
        material.thickness = 0.02;
        if (preset.ior !== undefined) material.ior = preset.ior;
      }
    }

    material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
      Object.assign(shader.uniforms, {
        uNoiseAtlas: { value: this.atlas },
        uNoiseScaleBroad: { value: preset.noiseScaleBroad },
        uNoiseScaleFine: { value: preset.noiseScaleFine },

        uPaint: { value: preset.paint.clone() },
        uPrimer: { value: preset.primer.clone() },
        uBareMetal: { value: preset.bareMetal.clone() },
        uRustColour: { value: preset.rustColour.clone() },
        uDirtColour: { value: preset.dirtColour.clone() },

        uChipWidth: { value: preset.chipWidth },
        uChipAmount: { value: preset.chipAmount },
        uWearChip: { value: preset.wearChip },
        uPolish: { value: preset.polish },
        uDirt: { value: preset.dirt },
        uDust: { value: preset.dust },
        uRust: { value: preset.rust },
        uStreak: { value: preset.streak },

        uBaseRoughness: { value: preset.baseRoughness },
        uRoughVariation: { value: preset.roughVariation },
        uBaseMetalness: { value: preset.baseMetalness },
        uChipMetalness: { value: preset.chipMetalness },

        uDebugMode: { value: DEBUG_MODE_VALUE[this.debugMode] },
      });

      this.uniformBlocks.push(shader.uniforms as Record<string, { value: unknown }>);

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${PROC_DETAIL_PARS_VERTEX}`)
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>\n${PROC_DETAIL_VERTEX}`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>\n${PROC_DETAIL_PARS_FRAGMENT}`)
        .replace('#include <map_fragment>', `#include <map_fragment>\n${PROC_DETAIL_MAP_FRAGMENT}`)
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>\n${PROC_DETAIL_ROUGHNESS_FRAGMENT}`,
        )
        .replace(
          '#include <metalnessmap_fragment>',
          `#include <metalnessmap_fragment>\n${PROC_DETAIL_METALNESS_FRAGMENT}`,
        );
    };

    // Materials that differ only in their onBeforeCompile body still share a
    // program unless their cache key differs, which would give every preset the
    // first one's uniforms.
    material.customProgramCacheKey = () => `tiger:${preset.id}:${extras ? 'x' : 'p'}`;

    return material;
  }
}
