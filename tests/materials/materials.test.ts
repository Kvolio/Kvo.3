import { describe, expect, it } from 'vitest';
import { ShaderLib } from 'three';
import { createNoiseAtlas } from '../../src/materials/noiseAtlas.js';
import { MATERIAL_PRESETS, presetFor } from '../../src/materials/presets.js';
import { MaterialLibrary } from '../../src/materials/MaterialLibrary.js';
import {
  PROC_DETAIL_PARS_FRAGMENT,
  PROC_DETAIL_PARS_VERTEX,
} from '../../src/materials/shaders.js';
import { QUALITY_TIERS, detectQualityTier, overrideFromSearch } from '../../src/core/QualityTier.js';
import { ATTR } from '../../src/geom/attributes.js';

describe('noise atlas', () => {
  it('is deterministic for a given seed', () => {
    const a = createNoiseAtlas({ size: 64, seed: 5 }).image.data as Uint8Array;
    const b = createNoiseAtlas({ size: 64, seed: 5 }).image.data as Uint8Array;
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('changes with the seed', () => {
    const a = createNoiseAtlas({ size: 64, seed: 5 }).image.data as Uint8Array;
    const b = createNoiseAtlas({ size: 64, seed: 6 }).image.data as Uint8Array;
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('fills all four channels with real variation', () => {
    // A channel that came out constant would silently disable whichever effect
    // depends on it — dust, chipping, pitting or streaking.
    const data = createNoiseAtlas({ size: 128, seed: 9 }).image.data as Uint8Array;
    for (let ch = 0; ch < 4; ch++) {
      let min = 255;
      let max = 0;
      for (let i = ch; i < data.length; i += 4) {
        const v = data[i]!;
        if (v < min) min = v;
        if (v > max) max = v;
      }
      expect(max - min, `channel ${ch} range`).toBeGreaterThan(60);
    }
  });

  it('stays small enough to be free on a phone', () => {
    const atlas = createNoiseAtlas({ size: 512 });
    const bytes = (atlas.image.data as Uint8Array).byteLength;
    expect(bytes).toBe(512 * 512 * 4);
    expect(bytes).toBeLessThan(1.1 * 1024 * 1024);
  });
});

describe('shader injection points', () => {
  // three's shader source is what these chunks splice into. A three upgrade
  // that renames an include would otherwise fail silently: the replace becomes
  // a no-op, the uniforms go unused, and every surface renders flat white.
  it('finds every include the vertex chunks target', () => {
    const vs = ShaderLib.physical.vertexShader;
    expect(vs).toContain('#include <common>');
    expect(vs).toContain('#include <begin_vertex>');
  });

  it('finds every include the fragment chunks target', () => {
    const fs = ShaderLib.physical.fragmentShader;
    expect(fs).toContain('#include <common>');
    expect(fs).toContain('#include <map_fragment>');
    expect(fs).toContain('#include <roughnessmap_fragment>');
    expect(fs).toContain('#include <metalnessmap_fragment>');
  });

  it('declares exactly the attributes MeshBuilder writes', () => {
    for (const name of Object.values(ATTR)) {
      expect(PROC_DETAIL_PARS_VERTEX).toContain(`attribute float ${name};`);
    }
  });

  it('declares a uniform for every preset knob the shader reads', () => {
    const knobs = [
      'uPaint', 'uPrimer', 'uBareMetal', 'uRustColour', 'uDirtColour',
      'uChipWidth', 'uChipAmount', 'uWearChip', 'uPolish',
      'uDirt', 'uDust', 'uRust', 'uStreak',
      'uBaseRoughness', 'uRoughVariation', 'uBaseMetalness', 'uChipMetalness',
      'uNoiseAtlas', 'uNoiseScaleBroad', 'uNoiseScaleFine', 'uDebugMode',
    ];
    for (const knob of knobs) {
      expect(PROC_DETAIL_PARS_FRAGMENT, knob).toContain(knob);
    }
  });
});

describe('material presets', () => {
  it('keeps every knob in a physically sensible range', () => {
    for (const [id, p] of Object.entries(MATERIAL_PRESETS)) {
      expect(p.baseRoughness, `${id} roughness`).toBeGreaterThan(0);
      expect(p.baseRoughness, `${id} roughness`).toBeLessThanOrEqual(1);
      expect(p.baseMetalness, `${id} metalness`).toBeGreaterThanOrEqual(0);
      expect(p.baseMetalness, `${id} metalness`).toBeLessThanOrEqual(1);
      expect(p.chipWidth, `${id} chip width`).toBeGreaterThanOrEqual(0);
      expect(p.noiseScaleBroad, `${id} broad scale`).toBeGreaterThan(0);
      expect(p.noiseScaleFine, `${id} fine scale`).toBeGreaterThan(p.noiseScaleBroad);
    }
  });

  it('gives interior surfaces a genuinely different wear profile', () => {
    // Not the exterior profile turned down: inside there is no weather at all.
    const interior = ['interiorIvoryPaint', 'oiledFloorSteel', 'handledSteel'];
    for (const id of interior) {
      const p = presetFor(id);
      expect(p.dust, `${id} dust`).toBe(0);
      expect(p.streak, `${id} rain streaking`).toBe(0);
      expect(p.rust, `${id} rust`).toBeLessThan(0.15);
      // ...but they are handled far more than any outside surface.
      expect(p.wearChip, `${id} handling wear`).toBeGreaterThan(0.5);
    }

    const exterior = presetFor('armourPaintedExterior');
    expect(exterior.dust).toBeGreaterThan(0);
    expect(exterior.streak).toBeGreaterThan(0);
    expect(exterior.rust).toBeGreaterThan(0.15);
  });

  it('paints the vehicle Dunkelgelb, per the 18 February 1943 order', () => {
    const dunkelgelb = presetFor('armourPaintedExterior').paint;
    const dunkelgrau = presetFor('armourPaintedGrey').paint;
    // Dunkelgelb is a warm ochre; Dunkelgrau is near-neutral and much darker.
    expect(dunkelgelb.r).toBeGreaterThan(dunkelgelb.b);
    expect(dunkelgelb.getHSL({ h: 0, s: 0, l: 0 }).l).toBeGreaterThan(
      dunkelgrau.getHSL({ h: 0, s: 0, l: 0 }).l,
    );
    // The primer beneath is Rotbraun, so a fresh chip reads red-brown.
    const primer = presetFor('armourPaintedExterior').primer;
    expect(primer.r).toBeGreaterThan(primer.g);
    expect(primer.g).toBeGreaterThan(primer.b);
  });

  it('makes rubber non-metallic and never rusty', () => {
    const rubber = presetFor('wheelRubber');
    expect(rubber.baseMetalness).toBe(0);
    expect(rubber.rust).toBe(0);
    expect(rubber.baseRoughness).toBeGreaterThan(0.85);
  });

  it('falls back visibly rather than silently for an unknown id', () => {
    const fallback = presetFor('no-such-material');
    expect(fallback.id).toBe('default');
    // A loud magenta, so a missing material is noticed rather than mistaken for
    // painted steel. Channel ordering is the robust check here: three converts
    // hex literals from sRGB to linear, which changes the magnitudes but not
    // which channels dominate.
    expect(fallback.paint.r).toBeGreaterThan(fallback.paint.g);
    expect(fallback.paint.b).toBeGreaterThan(fallback.paint.g);
    expect(fallback.paint.g).toBeLessThan(0.15);
  });
});

describe('material library', () => {
  it('builds each material once and reuses it', () => {
    const lib = new MaterialLibrary(QUALITY_TIERS.high);
    const a = lib.get('armourPaintedExterior');
    const b = lib.get('armourPaintedExterior');
    expect(a).toBe(b);
    expect(lib.materialCount).toBe(1);
    lib.dispose();
  });

  it('gives each preset its own program cache key', () => {
    // Without this, three shares one compiled program across every material
    // that differs only inside onBeforeCompile, and they all inherit the first
    // one's uniforms — every surface would come out Dunkelgelb.
    const lib = new MaterialLibrary(QUALITY_TIERS.high);
    const keys = new Set(
      ['armourPaintedExterior', 'wheelRubber', 'weldBead', 'interiorIvoryPaint'].map((id) => {
        const m = lib.get(id) as { customProgramCacheKey?: () => string };
        return m.customProgramCacheKey?.() ?? '';
      }),
    );
    expect(keys.size).toBe(4);
    lib.dispose();
  });

  it('resolves a geometry group list in order', () => {
    const lib = new MaterialLibrary(QUALITY_TIERS.mid);
    const mats = lib.resolve(['armourPaintedExterior', 'interiorIvoryPaint', 'machinedSteel']);
    expect(mats.map((m) => m.name)).toEqual([
      'armourPaintedExterior',
      'interiorIvoryPaint',
      'machinedSteel',
    ]);
    lib.dispose();
  });

  it('drops transmission on the low tier rather than compiling it for a phone', () => {
    const high = new MaterialLibrary(QUALITY_TIERS.high);
    const low = new MaterialLibrary(QUALITY_TIERS.low);
    expect(high.get('glassOptic').type).toBe('MeshPhysicalMaterial');
    expect(low.get('glassOptic').type).toBe('MeshStandardMaterial');
    high.dispose();
    low.dispose();
  });
});

describe('quality tier detection', () => {
  it('puts a phone on the low tier', () => {
    const tier = detectQualityTier({
      hardwareConcurrency: 8,
      devicePixelRatio: 3,
      maxTouchPoints: 5,
      rendererString: 'Adreno (TM) 730',
      userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7)',
    });
    expect(tier.name).toBe('low');
    expect(tier.shadowMapSize).toBe(0);
    expect(tier.lodBias).toBe(1);
  });

  it('puts a desktop with a discrete GPU on the high tier', () => {
    const tier = detectQualityTier({
      hardwareConcurrency: 16,
      devicePixelRatio: 1,
      maxTouchPoints: 0,
      rendererString: 'ANGLE (NVIDIA GeForce RTX 4070)',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    });
    expect(tier.name).toBe('high');
  });

  it('pins software rendering to a fixed tier for reproducible screenshots', () => {
    // The visual suite runs on SwiftShader. Letting the heuristics pick would
    // make the baselines depend on the CI machine's core count.
    const tier = detectQualityTier({
      hardwareConcurrency: 4,
      devicePixelRatio: 1,
      maxTouchPoints: 0,
      rendererString: 'Google SwiftShader',
    });
    expect(tier.name).toBe('mid');
  });

  it('honours an explicit override', () => {
    expect(overrideFromSearch('?quality=low')).toBe('low');
    expect(overrideFromSearch('?quality=nonsense')).toBeUndefined();
    expect(
      detectQualityTier({
        hardwareConcurrency: 2,
        devicePixelRatio: 4,
        maxTouchPoints: 5,
        override: 'high',
      }).name,
    ).toBe('high');
  });
});
