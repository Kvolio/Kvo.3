import { deg, mm, type DEG, type MM } from './units.js';
import type { MetaOf } from './meta.js';
import { HULL } from './hull.js';
import { TURRET } from './turret.js';
import { ARMOUR } from './armour.js';

/**
 * Vision devices, and the crew eyes that use them.
 *
 * A vision port here is a real aperture cut clean through the armour at its
 * historical size, positioned so that a crewman at his station can put his eye
 * to it and see out. That is an acceptance criterion (docs/REQUIREMENTS.md R1),
 * not a nicety, so every device carries the two things needed to check it
 * mechanically: the clear opening, and where the eye actually is.
 *
 * `tests/parts/vision.test.ts` fires rays from each eye through the built
 * geometry and measures the angular window that escapes the hull, then converts
 * it back to a linear opening at the aperture plane. A slit of the right size in
 * the wrong place, or at the wrong distance from the eye, fails — which prose
 * about "modelling the vision ports" never would.
 */

export type CrewStation = 'driver' | 'radioOperator' | 'commander' | 'gunner' | 'loader';

export interface VisionDevice {
  readonly id: string;
  readonly label: string;
  readonly station: CrewStation;
  /** Seated eye position while using the device, in vehicle space. */
  readonly eye: readonly [MM, MM, MM];
  /** Centre of the clear opening, on the plate's outer face. */
  readonly apertureCentre: readonly [MM, MM, MM];
  /** Clear opening across the crewman's horizontal axis. */
  readonly clearWidth: MM;
  /** Clear opening across his vertical axis. */
  readonly clearHeight: MM;
  /** Unit vector the device looks along. */
  readonly viewDirection: readonly [number, number, number];
  /** Armour the aperture passes through. */
  readonly throughThickness: MM;
  /** Round apertures are bores; rectangular ones are slits. */
  readonly shape: 'slit' | 'bore';
}

/**
 * The driver's visor (Fahrersehklappe) and the hull machine gun's ball mount.
 *
 * Both are in the driver's front plate, and both are genuinely see-through: at
 * 100 mm the plate is the thickest the crew looks through anywhere on the
 * vehicle, which is exactly why an aperture that stops at the outer face would
 * be so obvious from inside.
 */
export const VISION_DEVICES: readonly VisionDevice[] = [
  {
    id: 'driver-visor',
    label: "Driver's visor",
    station: 'driver',
    // Roughly 200 mm behind the plate's inner face: a driver at the visor has
    // his face close to it, and the distance is what sets the field of view.
    eye: [mm(-560), mm(1420), mm(2790)],
    apertureCentre: [HULL.driverVisor.centreX, HULL.driverVisor.centreY, mm(3088)],
    clearWidth: HULL.driverVisor.width,
    clearHeight: HULL.driverVisor.height,
    viewDirection: [0, 0, 1],
    throughThickness: ARMOUR.hull.driverPlate.thickness,
    shape: 'slit',
  },
  {
    id: 'hull-mg-bore',
    label: 'Hull MG 34 ball mount',
    station: 'radioOperator',
    eye: [mm(560), mm(1420), mm(2790)],
    apertureCentre: [HULL.hullMGMount.centreX, HULL.hullMGMount.centreY, mm(3091)],
    clearWidth: HULL.hullMGMount.apertureDiameter,
    clearHeight: HULL.hullMGMount.apertureDiameter,
    viewDirection: [0, 0, 1],
    throughThickness: ARMOUR.hull.driverPlate.thickness,
    shape: 'bore',
  },
];

/**
 * Angular window a device gives its user, derived from the eye-to-aperture
 * distance and the clear opening.
 *
 * This is the number the geometry test measures independently and compares
 * against, so it must be computed from the spec rather than from the mesh.
 */
export function fieldOfView(device: VisionDevice): { horizontal: DEG; vertical: DEG } {
  const dx = device.apertureCentre[0] - device.eye[0];
  const dy = device.apertureCentre[1] - device.eye[1];
  const dz = device.apertureCentre[2] - device.eye[2];
  const distance = Math.hypot(dx, dy, dz);

  const angle = (clear: MM): DEG =>
    deg((2 * Math.atan(clear / 2 / distance) * 180) / Math.PI);

  return { horizontal: angle(device.clearWidth), vertical: angle(device.clearHeight) };
}

/** Straight-line distance from a crewman's eye to the aperture he is using. */
export function eyeToAperture(device: VisionDevice): MM {
  return mm(
    Math.hypot(
      device.apertureCentre[0] - device.eye[0],
      device.apertureCentre[1] - device.eye[1],
      device.apertureCentre[2] - device.eye[2],
    ),
  );
}

export function visionDevice(id: string): VisionDevice | undefined {
  return VISION_DEVICES.find((d) => d.id === id);
}

/**
 * Turret vision devices are declared here so the cupola's five slits carry
 * their dimensions from one place, but they are only built and tested once the
 * turret exists.
 */
export const CUPOLA_SLIT = {
  count: TURRET.cupola.visionSlits,
  clearWidth: TURRET.cupola.slitWidth,
  clearHeight: TURRET.cupola.slitHeight,
  throughThickness: TURRET.cupola.wallThickness,
} as const;

export const CUPOLA_SLIT_META: MetaOf<typeof CUPOLA_SLIT> = {
  count: { tol: 0, source: 'T1I drum cupola', confidence: 'secondary' },
  clearWidth: { tol: 10, source: 'REF-photo-1', confidence: 'estimated', note: 'Proportioned from the photograph against the cupola diameter.' },
  clearHeight: { tol: 5, source: 'REF-photo-1', confidence: 'estimated', note: 'Proportioned from the photograph against the cupola diameter.' },
  throughThickness: { tol: 10, source: 'Tank Encyclopedia summary', confidence: 'estimated', note: 'Cupola wall thickness is not separately quoted by the sources consulted.' },
};
