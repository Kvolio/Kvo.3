/**
 * The specification: the single source of truth for every dimension in this
 * reconstruction.
 *
 * Two parallel trees are exported. `SPEC` carries the numbers, in millimetres.
 * `SPEC_META` mirrors its shape exactly and carries a tolerance, a source and a
 * confidence level for every one of them — `MetaOf<T>` makes that mapping total,
 * so a new dimension will not compile until its provenance is supplied.
 *
 * Part builders import `SPEC`. Tests and the DimensionOverlay import both, which
 * is what lets the Gauntlet assert "is this number right?" and "do we actually
 * know this number?" as two separate questions.
 */

import { OVERALL, OVERALL_META } from './overall.js';
import { ARMOUR, ARMOUR_META } from './armour.js';
import { HULL, HULL_META } from './hull.js';
import {
  TRACK,
  TRACK_META,
  SPROCKET,
  SPROCKET_META,
  IDLER,
  IDLER_META,
  ROAD_WHEEL,
  ROAD_WHEEL_META,
  SUSPENSION,
  SUSPENSION_META,
} from './runningGear.js';
import { GUN, GUN_META, TRAVERSE, TRAVERSE_META } from './armament.js';
import { TURRET, TURRET_META } from './turret.js';
import {
  ENGINE,
  ENGINE_META,
  COOLING,
  COOLING_META,
  FUEL,
  FUEL_META,
  TRANSMISSION,
  TRANSMISSION_META,
  STEERING,
  STEERING_META,
  FINAL_DRIVE,
  FINAL_DRIVE_META,
  FEIFEL,
  FEIFEL_META,
  PERFORMANCE,
  PERFORMANCE_META,
} from './powertrain.js';

export const SPEC = {
  overall: OVERALL,
  armour: ARMOUR,
  hull: HULL,
  track: TRACK,
  sprocket: SPROCKET,
  idler: IDLER,
  roadWheel: ROAD_WHEEL,
  suspension: SUSPENSION,
  gun: GUN,
  traverse: TRAVERSE,
  turret: TURRET,
  engine: ENGINE,
  cooling: COOLING,
  fuel: FUEL,
  transmission: TRANSMISSION,
  steering: STEERING,
  finalDrive: FINAL_DRIVE,
  feifel: FEIFEL,
  performance: PERFORMANCE,
} as const;

export const SPEC_META = {
  overall: OVERALL_META,
  armour: ARMOUR_META,
  hull: HULL_META,
  track: TRACK_META,
  sprocket: SPROCKET_META,
  idler: IDLER_META,
  roadWheel: ROAD_WHEEL_META,
  suspension: SUSPENSION_META,
  gun: GUN_META,
  traverse: TRAVERSE_META,
  turret: TURRET_META,
  engine: ENGINE_META,
  cooling: COOLING_META,
  fuel: FUEL_META,
  transmission: TRANSMISSION_META,
  steering: STEERING_META,
  finalDrive: FINAL_DRIVE_META,
  feifel: FEIFEL_META,
  performance: PERFORMANCE_META,
} as const;

export type Spec = typeof SPEC;

export * from './units.js';
export * from './meta.js';
export * from './overall.js';
export * from './armour.js';
export * from './hull.js';
export * from './runningGear.js';
export * from './armament.js';
export * from './turret.js';
export * from './powertrain.js';
export * from './variants.js';
export * from './viewpoints.js';
