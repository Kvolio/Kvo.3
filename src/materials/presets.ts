import { Color } from 'three';

/**
 * The material table.
 *
 * Colours are the historically appropriate ones: RAL 7028 Dunkelgelb over RAL
 * 8012 Rotbraun primer for the exterior of a late-February-1943 vehicle, and
 * Elfenbein ivory over the same primer inside. The February 1943 order is what
 * puts this vehicle in Dunkelgelb rather than Dunkelgrau; RAL 7021 is kept
 * available for the January preset.
 *
 * The wear parameters are what separate an exterior surface from an interior
 * one. Outside gets sun, dust, rain streaking and rust in the crevices; inside
 * gets oil, foot polish on the floor, burnished grab handles and no dust at all.
 */

export interface MaterialPreset {
  readonly id: string;
  /** Base colour. For bare-metal presets this is the metal itself. */
  readonly paint: Color;
  readonly primer: Color;
  readonly bareMetal: Color;
  readonly rustColour: Color;
  readonly dirtColour: Color;

  /** Millimetres over which paint chipping fades in from an edge. */
  readonly chipWidth: number;
  readonly chipAmount: number;
  /** Extra chipping on surfaces flagged as handled. */
  readonly wearChip: number;
  /** How much handled surfaces burnish and smooth. */
  readonly polish: number;
  readonly dirt: number;
  readonly dust: number;
  readonly rust: number;
  readonly streak: number;

  readonly baseRoughness: number;
  readonly roughVariation: number;
  readonly baseMetalness: number;
  /** Metalness revealed where paint has chipped down to steel. */
  readonly chipMetalness: number;

  /** Triplanar frequencies, in cycles per scene unit (metre). */
  readonly noiseScaleBroad: number;
  readonly noiseScaleFine: number;

  /** Optional physical extras. Each compiles a shader permutation, so mobile drops them. */
  readonly clearcoat?: number;
  readonly sheen?: number;
  readonly transmission?: number;
  readonly opacity?: number;
  readonly ior?: number;
}

const c = (hex: number): Color => new Color(hex);

/** RAL 7028 Dunkelgelb, as ordered on 18 February 1943. */
const DUNKELGELB = c(0x9a8a5e);
/** RAL 7021 Dunkelgrau, the standard finish before that order. */
const DUNKELGRAU = c(0x4a4d4a);
/** RAL 8012 Rotbraun primer, which is what shows through a chip first. */
const ROTBRAUN = c(0x6b3a2c);
/** German interior practice: Elfenbein ivory above the sponson line. */
const ELFENBEIN = c(0xd8cfb4);

const BARE_STEEL = c(0x8c8f93);
const RUST = c(0x6e4326);
const DUST = c(0x8f8264);
const OIL_GRIME = c(0x2b2823);

const BASE: Omit<MaterialPreset, 'id'> = {
  paint: DUNKELGELB,
  primer: ROTBRAUN,
  bareMetal: BARE_STEEL,
  rustColour: RUST,
  dirtColour: DUST,
  chipWidth: 14,
  chipAmount: 0.55,
  wearChip: 0.3,
  polish: 0.1,
  dirt: 0.5,
  dust: 0.25,
  rust: 0.3,
  streak: 0.15,
  baseRoughness: 0.68,
  roughVariation: 0.16,
  baseMetalness: 0.15,
  chipMetalness: 0.7,
  noiseScaleBroad: 0.6,
  noiseScaleFine: 7.0,
};

export const MATERIAL_PRESETS = {
  // ---------------------------------------------------------------------------
  // Exterior
  // ---------------------------------------------------------------------------
  armourPaintedExterior: {
    ...BASE,
    id: 'armourPaintedExterior',
  },

  armourPaintedGrey: {
    ...BASE,
    id: 'armourPaintedGrey',
    paint: DUNKELGRAU,
  },

  /** Rolled plate edges and cut faces: paint takes badly, so they rust first. */
  machinedSteel: {
    ...BASE,
    // Warmed very slightly off neutral. At 0x7d7f82 the blue channel led, and
    // with metalness this high the material mirrors whatever is around it — a
    // blue sky outside, and a blue sky through the hatches inside. Every
    // machined part read as blue plastic. Steel is not blue.
    id: 'machinedSteel',
    paint: c(0x83817d),
    chipAmount: 0.15,
    dust: 0.1,
    rust: 0.45,
    baseRoughness: 0.42,
    roughVariation: 0.2,
    baseMetalness: 0.85,
    chipMetalness: 0.1,
  },

  /** Sand-cast surfaces — mantlet, cupola, final drive housings. */
  castSteelBare: {
    ...BASE,
    id: 'castSteelBare',
    paint: c(0x74767a),
    chipAmount: 0.2,
    rust: 0.5,
    baseRoughness: 0.78,
    roughVariation: 0.24,
    baseMetalness: 0.8,
    chipMetalness: 0.1,
    // Coarser, so the Worley pitting reads as casting texture rather than noise.
    noiseScaleBroad: 1.4,
    noiseScaleFine: 16.0,
  },

  /** Weld beads: hotter, rougher, and never painted as evenly as the plate. */
  weldBead: {
    ...BASE,
    id: 'weldBead',
    paint: c(0x8e8258),
    chipWidth: 6,
    chipAmount: 0.7,
    rust: 0.4,
    baseRoughness: 0.72,
    roughVariation: 0.22,
    baseMetalness: 0.5,
    chipMetalness: 0.5,
    noiseScaleFine: 22.0,
  },

  /** Solid rubber road wheel tyres. */
  wheelRubber: {
    ...BASE,
    id: 'wheelRubber',
    paint: c(0x232427),
    primer: c(0x232427),
    bareMetal: c(0x2c2d30),
    chipAmount: 0.0,
    wearChip: 0.0,
    polish: 0.05,
    dirt: 0.55,
    dust: 0.4,
    rust: 0.0,
    streak: 0.0,
    baseRoughness: 0.92,
    roughVariation: 0.08,
    baseMetalness: 0.0,
    chipMetalness: 0.0,
  },

  /** Track links: contact faces polish, flanks rust, everything is filthy. */
  trackSteelWorn: {
    ...BASE,
    id: 'trackSteelWorn',
    paint: c(0x5c5751),
    bareMetal: c(0xa8a49c),
    chipAmount: 0.3,
    wearChip: 0.85,
    polish: 0.45,
    dirt: 0.7,
    dust: 0.5,
    rust: 0.55,
    baseRoughness: 0.6,
    roughVariation: 0.25,
    baseMetalness: 0.75,
    chipMetalness: 0.25,
  },

  /** Exhaust stacks and muffler shields, cooked and sooted. */
  exhaustSteel: {
    ...BASE,
    id: 'exhaustSteel',
    paint: c(0x3a332c),
    primer: c(0x2a241f),
    rustColour: c(0x7a4423),
    chipAmount: 0.4,
    rust: 0.75,
    dust: 0.15,
    baseRoughness: 0.85,
    roughVariation: 0.2,
    baseMetalness: 0.55,
  },

  // ---------------------------------------------------------------------------
  // Interior — a genuinely different wear profile, not the same one turned down
  // ---------------------------------------------------------------------------
  interiorIvoryPaint: {
    ...BASE,
    id: 'interiorIvoryPaint',
    paint: ELFENBEIN,
    dirtColour: OIL_GRIME,
    chipWidth: 10,
    chipAmount: 0.4,
    wearChip: 0.55,
    polish: 0.2,
    dirt: 0.45,
    // No weather inside: no dust settling, no rain streaks, and rust only where
    // condensation collects.
    dust: 0.0,
    rust: 0.08,
    streak: 0.0,
    baseRoughness: 0.6,
    roughVariation: 0.12,
    noiseScaleBroad: 1.1,
    noiseScaleFine: 12.0,
  },

  /** Fighting compartment floor: oil-darkened, boot-polished. */
  oiledFloorSteel: {
    ...BASE,
    id: 'oiledFloorSteel',
    paint: c(0x3b3730),
    primer: c(0x2e2a25),
    dirtColour: OIL_GRIME,
    chipAmount: 0.5,
    wearChip: 0.9,
    polish: 0.5,
    dirt: 0.6,
    dust: 0.0,
    rust: 0.05,
    streak: 0.0,
    baseRoughness: 0.45,
    roughVariation: 0.2,
    baseMetalness: 0.6,
    chipMetalness: 0.35,
  },

  /** Levers, handwheels, pedals — bare steel kept bright by use. */
  handledSteel: {
    ...BASE,
    id: 'handledSteel',
    paint: c(0x6f7276),
    chipAmount: 0.35,
    wearChip: 0.95,
    polish: 0.6,
    dirt: 0.3,
    dust: 0.0,
    rust: 0.05,
    streak: 0.0,
    baseRoughness: 0.3,
    roughVariation: 0.16,
    baseMetalness: 0.9,
    chipMetalness: 0.1,
  },

  bakelite: {
    ...BASE,
    id: 'bakelite',
    paint: c(0x2a221c),
    primer: c(0x2a221c),
    chipAmount: 0.1,
    dust: 0.0,
    rust: 0.0,
    streak: 0.0,
    polish: 0.3,
    baseRoughness: 0.35,
    roughVariation: 0.08,
    baseMetalness: 0.0,
    chipMetalness: 0.0,
    clearcoat: 0.35,
  },

  leather: {
    ...BASE,
    id: 'leather',
    paint: c(0x4a3a2c),
    primer: c(0x3a2c21),
    chipAmount: 0.15,
    wearChip: 0.4,
    polish: 0.35,
    dirt: 0.35,
    dust: 0.0,
    rust: 0.0,
    streak: 0.0,
    baseRoughness: 0.72,
    roughVariation: 0.15,
    baseMetalness: 0.0,
    chipMetalness: 0.0,
    sheen: 0.4,
  },

  canvas: {
    ...BASE,
    id: 'canvas',
    paint: c(0x6d6450),
    primer: c(0x5c5442),
    chipAmount: 0.0,
    dust: 0.2,
    rust: 0.0,
    baseRoughness: 0.95,
    roughVariation: 0.1,
    baseMetalness: 0.0,
    chipMetalness: 0.0,
    sheen: 0.5,
  },

  wood: {
    ...BASE,
    id: 'wood',
    paint: c(0x7a6244),
    primer: c(0x5f4c34),
    chipAmount: 0.2,
    polish: 0.2,
    dust: 0.15,
    rust: 0.0,
    baseRoughness: 0.8,
    roughVariation: 0.15,
    baseMetalness: 0.0,
    chipMetalness: 0.0,
  },

  brass: {
    ...BASE,
    id: 'brass',
    paint: c(0xb08d4a),
    bareMetal: c(0xc9a961),
    chipAmount: 0.1,
    polish: 0.4,
    dust: 0.0,
    rust: 0.0,
    streak: 0.0,
    baseRoughness: 0.3,
    roughVariation: 0.14,
    baseMetalness: 1.0,
    chipMetalness: 0.0,
  },

  copperWire: {
    ...BASE,
    id: 'copperWire',
    paint: c(0x1c1a18),
    primer: c(0x1c1a18),
    chipAmount: 0.0,
    dust: 0.0,
    rust: 0.0,
    baseRoughness: 0.55,
    roughVariation: 0.08,
    baseMetalness: 0.0,
    chipMetalness: 0.0,
  },

  /** Vision blocks and periscope glass. */
  glassOptic: {
    ...BASE,
    id: 'glassOptic',
    paint: c(0x203038),
    primer: c(0x203038),
    chipAmount: 0.0,
    dust: 0.05,
    rust: 0.0,
    streak: 0.05,
    baseRoughness: 0.06,
    roughVariation: 0.03,
    baseMetalness: 0.0,
    chipMetalness: 0.0,
    transmission: 0.8,
    opacity: 1.0,
    ior: 1.52,
  },

  /** Fallback, so an unregistered id is visible rather than silently default-grey. */
  default: {
    ...BASE,
    id: 'default',
    paint: c(0xb0407a),
    chipAmount: 0.0,
    baseRoughness: 0.5,
  },
};

export function presetFor(id: string): MaterialPreset {
  // Still takes a plain string, because ids also arrive from the URL and from
  // the debug overlay, where they genuinely are untrusted.
  return (
    (MATERIAL_PRESETS as Record<string, MaterialPreset>)[id] ?? MATERIAL_PRESETS.default
  );
}

export const PRESET_IDS: readonly string[] = Object.keys(MATERIAL_PRESETS);

/**
 * The name of a material in the table above.
 *
 * This was `string`, and a misspelling therefore fell through to the magenta
 * fallback and rendered as a bright pink track guard that nothing failed on.
 * Deriving the type from the table makes a wrong name a compile error, which is
 * the same bargain the spec's provenance types make: if the compiler can hold
 * the invariant, it should.
 */
export type MaterialId = keyof typeof MATERIAL_PRESETS;
