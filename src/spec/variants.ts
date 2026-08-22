/**
 * Production variant switching.
 *
 * The brief requires that components which changed during production stay
 * swappable rather than being permanently baked together. Every part builder
 * takes a `VariantConfig` and returns `null` when the active variant excludes
 * it, so moving between production blocks is a data change.
 *
 * The canonical target is `AusfH_Feb1943`. The later presets exist so that
 * `tests/variants/variants.test.ts` can keep them from rotting while attention
 * is on the Ausf. H.
 */

export type CupolaType = 'drum' | 'cast';
export type RoadWheelType = 'rubber-tyred-24' | 'steel-rimmed-16';
export type EngineType = 'HL210P45' | 'HL230P45';
export type AirCleanerType = 'feifel-round' | 'feifel-oval' | 'none';
export type SightType = 'TZF9b-binocular' | 'TZF9c-monocular';
export type TrackType = 'combat-725-smooth' | 'combat-725-chevron' | 'transport-520';
export type LoaderHatchType = 'long-hinge' | 'short-hinge';
export type MuzzleBrakeType = 'heavy-double-baffle' | 'light-insert';
export type PaintScheme = 'dunkelgrau-7021' | 'dunkelgelb-7028';
export type HeadlightConfig = 'dual-bosch' | 'single-bosch';

export interface VariantConfig {
  /** Human-readable production block, for reports and the debug overlay. */
  readonly label: string;
  /** Approximate month this configuration represents. */
  readonly productionDate: string;
  readonly designation: string;

  readonly cupola: CupolaType;
  readonly roadWheels: RoadWheelType;
  readonly engine: EngineType;
  readonly airCleaner: AirCleanerType;
  readonly sight: SightType;
  readonly track: TrackType;
  readonly loaderHatch: LoaderHatchType;
  readonly muzzleBrake: MuzzleBrakeType;
  readonly headlights: HeadlightConfig;
  readonly paint: PaintScheme;

  readonly smokeDischargers: boolean;
  readonly sMineDischargers: boolean;
  readonly zimmerit: boolean;
  readonly loaderPeriscope: boolean;
  readonly turretRingGuard: boolean;
  readonly escapeHatch: boolean;
  readonly turretStowageBin: boolean;
  readonly wadingEquipment: boolean;
  /** Turret roof thickness in mm. 25 on the Ausf. H, 40 from March 1944. */
  readonly turretRoofThickness: 25 | 40;
}

/**
 * The canonical target: Henschel, late February 1943, Fgst. ~250050-250100.
 * Every entry here is justified in docs/CONFIGURATION.md against a dated
 * production change.
 */
export const AusfH_Feb1943: VariantConfig = {
  label: 'Ausf. H, Henschel, late February 1943',
  productionDate: '1943-02',
  designation: 'Pz.Kpfw. VI Ausf. H1 (Sd.Kfz. 182)',

  cupola: 'drum',
  roadWheels: 'rubber-tyred-24',
  engine: 'HL210P45',
  airCleaner: 'feifel-round',
  sight: 'TZF9b-binocular',
  track: 'combat-725-smooth',
  loaderHatch: 'long-hinge',
  muzzleBrake: 'heavy-double-baffle',
  headlights: 'dual-bosch',
  paint: 'dunkelgelb-7028',

  smokeDischargers: true,
  sMineDischargers: true,
  zimmerit: false,
  loaderPeriscope: false,
  turretRingGuard: false,
  escapeHatch: true,
  turretStowageBin: true,
  wadingEquipment: true,
  turretRoofThickness: 25,
};

/** Before the 18 February 1943 paint order — otherwise identical. */
export const AusfH_Jan1943: VariantConfig = {
  ...AusfH_Feb1943,
  label: 'Ausf. H, Henschel, January 1943',
  productionDate: '1943-01',
  paint: 'dunkelgrau-7021',
};

/** Post-July-1943 turret, for regression coverage of the variant system. */
export const AusfE_Aug1943: VariantConfig = {
  ...AusfH_Feb1943,
  label: 'Ausf. E, August 1943',
  productionDate: '1943-08',
  designation: 'Pz.Kpfw. Tiger Ausf. E (Sd.Kfz. 181)',
  cupola: 'cast',
  engine: 'HL230P45',
  airCleaner: 'feifel-oval',
  headlights: 'single-bosch',
  smokeDischargers: false,
  loaderPeriscope: true,
  zimmerit: true,
};

/** Late production, for regression coverage. */
export const AusfE_Apr1944: VariantConfig = {
  ...AusfE_Aug1943,
  label: 'Ausf. E, April 1944',
  productionDate: '1944-04',
  roadWheels: 'steel-rimmed-16',
  airCleaner: 'none',
  sight: 'TZF9c-monocular',
  track: 'combat-725-chevron',
  loaderHatch: 'short-hinge',
  muzzleBrake: 'light-insert',
  sMineDischargers: false,
  turretRingGuard: true,
  wadingEquipment: false,
  turretRoofThickness: 40,
};

export const PRESETS = {
  AusfH_Feb1943,
  AusfH_Jan1943,
  AusfE_Aug1943,
  AusfE_Apr1944,
} as const;

export type PresetName = keyof typeof PRESETS;

/** The configuration this reconstruction is built to unless overridden. */
export const DEFAULT_VARIANT: PresetName = 'AusfH_Feb1943';

/**
 * Stable hash of a variant, used as part of the geometry cache key so a switch
 * only rebuilds the parts whose inputs actually changed.
 */
export function variantHash(v: VariantConfig): string {
  const keys = Object.keys(v).sort() as (keyof VariantConfig)[];
  let h = 0x811c9dc5;
  for (const k of keys) {
    const s = `${k}=${String(v[k])};`;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Road wheels per side implied by the variant. */
export function wheelsPerSide(v: VariantConfig): number {
  return v.roadWheels === 'rubber-tyred-24' ? 24 : 16;
}

/** Wheels carried on each swing arm. */
export function wheelsPerStation(v: VariantConfig): number {
  return v.roadWheels === 'rubber-tyred-24' ? 3 : 2;
}

/**
 * Apertures cut in the mantlet for the gunner's sight. Two for the TZF 9b
 * binocular, one for the TZF 9c monocular — the single most reliable visual
 * discriminator between an Ausf. H and a 1944 vehicle.
 */
export function mantletSightApertures(v: VariantConfig): 1 | 2 {
  return v.sight === 'TZF9b-binocular' ? 2 : 1;
}
