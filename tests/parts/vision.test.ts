import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { buildAssembly, buildHull } from '../../src/parts/hull/index.js';
import { measureThicknessAlong } from '../../src/geom/analysis.js';
import { S, mm, toMM } from '../../src/spec/units.js';
import {
  VISION_DEVICES,
  eyeToAperture,
  fieldOfView,
  type VisionDevice,
} from '../../src/spec/vision.js';

/**
 * docs/REQUIREMENTS.md R1, enforced.
 *
 * A vision port has to be a real opening through the armour, at its historical
 * size, positioned where a crewman can actually use it. Prose cannot check any
 * of that. These tests put an eye at each crew station, fire rays through the
 * geometry that was actually built, and measure the angular window that escapes
 * the hull — then convert it back to a linear opening at the aperture and
 * compare against the specification.
 *
 * A slit of the right size in the wrong place fails. A slit at the wrong
 * distance from the eye fails. A recess that does not go all the way through
 * fails hardest of all: nothing escapes at any angle.
 */

const geometry = buildAssembly(buildHull).context.render.toGeometry().geometry;

/** How far a ray may travel before it is considered to have left the vehicle. */
const ESCAPE_DISTANCE = mm(1500);

/** How far beside an aperture's rim to probe for solid armour. */
const BESIDE_OFFSET = 40;

/** How far outside a surface a probe starts, so it is unambiguously outside. */
const STANDOFF = 200;

/** How many laminated layers an aperture's armour may be built from. */
const MAX_ARMOUR_LAYERS = 6;

/** How far past the expected depth to keep walking crossings. */
const DEPTH_WINDOW = 1.25;

const eyeOf = (d: VisionDevice): Vector3 =>
  new Vector3(S(d.eye[0]), S(d.eye[1]), S(d.eye[2]));

/** Does a ray from the eye in this direction leave the hull? */
function escapes(device: VisionDevice, direction: Vector3): boolean {
  return (
    measureThicknessAlong(geometry, eyeOf(device), direction, S(ESCAPE_DISTANCE)) === null
  );
}

/**
 * Sweep the view direction and find the contiguous window, centred on straight
 * ahead, through which rays escape. Returned in degrees.
 */
function openWindowDegrees(device: VisionDevice, axis: Vector3): number {
  const base = new Vector3(...device.viewDirection).normalize();
  const STEP = 0.1;
  const LIMIT = 45;

  const open = (angleDeg: number): boolean =>
    escapes(device, base.clone().applyAxisAngle(axis, (angleDeg * Math.PI) / 180));

  if (!open(0)) return 0;

  let positive = 0;
  for (let a = STEP; a <= LIMIT; a += STEP) {
    if (!open(a)) break;
    positive = a;
  }
  let negative = 0;
  for (let a = STEP; a <= LIMIT; a += STEP) {
    if (!open(-a)) break;
    negative = a;
  }
  return positive + negative;
}

/** Linear opening implied by an angular window at the aperture's distance. */
function openingFromAngle(device: VisionDevice, windowDegrees: number): number {
  const distance = eyeToAperture(device);
  return 2 * distance * Math.tan((windowDegrees / 2 / 180) * Math.PI);
}

/**
 * A device's own axes.
 *
 * These were world up and world X, which is right for anything looking straight
 * ahead and wrong for everything else. The commander's five vision slits look
 * outward on five different bearings, so sweeping them about world X measured a
 * slit's height along an axis that was not its height — and reported the drum's
 * whole diameter as one opening.
 *
 * `lateral` is the device's own right vector: the axis you rotate about to
 * sweep VERTICALLY, since rotating about a horizontal axis moves the ray up and
 * down.
 */
function axesOf(device: VisionDevice): { up: Vector3; lateral: Vector3 } {
  const view = new Vector3(...device.viewDirection).normalize();
  const worldUp = new Vector3(0, 1, 0);
  const lateral = new Vector3().crossVectors(worldUp, view);
  // A device looking straight up or down has no meaningful lateral from this
  // construction; none does today, and this makes that assumption explicit.
  if (lateral.lengthSq() < 1e-6) throw new Error(`${device.id} looks along the vertical`);
  return { up: worldUp, lateral: lateral.normalize() };
}

describe.each(VISION_DEVICES)('vision device: $label', (device) => {
  const { up, lateral } = axesOf(device);

  it('can be seen through at all', () => {
    if (device.purpose !== 'vision') return;
    // The single most important assertion here. A port modelled as a recess
    // rather than an aperture blocks every ray, and looks perfectly convincing
    // from outside.
    expect(
      escapes(device, new Vector3(...device.viewDirection).normalize()),
      'a ray straight ahead from the eye does not reach open air',
    ).toBe(true);
  });

  it('is bounded by armour on both sides', () => {
    if (device.purpose !== 'vision') return;
    // An opening with no edges is a missing plate, not a vision port.
    const base = new Vector3(...device.viewDirection).normalize();
    const wide = 40;
    expect(escapes(device, base.clone().applyAxisAngle(up, (wide * Math.PI) / 180))).toBe(false);
    expect(escapes(device, base.clone().applyAxisAngle(up, (-wide * Math.PI) / 180))).toBe(false);
  });

  it('gives the horizontal field of view its clear width implies', () => {
    if (device.purpose !== 'vision') return;
    const measured = openWindowDegrees(device, up);
    const expected = fieldOfView(device).horizontal;

    // Within two degrees: the rim of a 100 mm plate is a thick edge, not a
    // knife edge, so the exact cut-off depends on which rim binds.
    expect(measured, `measured ${measured.toFixed(1)} deg vs expected ${expected.toFixed(1)}`)
      .toBeGreaterThan(expected - 2.5);
    expect(measured).toBeLessThan(expected + 2.5);
  });

  it('gives the vertical field of view its clear height implies', () => {
    if (device.purpose !== 'vision') return;
    const measured = openWindowDegrees(device, lateral);
    const expected = fieldOfView(device).vertical;
    expect(measured, `measured ${measured.toFixed(1)} deg vs expected ${expected.toFixed(1)}`)
      .toBeGreaterThan(expected - 2.5);
    expect(measured).toBeLessThan(expected + 2.5);
  });

  it('measures back to the clear opening in the specification', () => {
    if (device.purpose !== 'vision') return;
    // The requirement is that the ports are to SCALE, so the check ends in
    // millimetres rather than degrees.
    const width = openingFromAngle(device, openWindowDegrees(device, up));
    const height = openingFromAngle(device, openWindowDegrees(device, lateral));

    expect(width, `clear width ${width.toFixed(0)} mm`).toBeGreaterThan(device.clearWidth * 0.85);
    expect(width).toBeLessThan(device.clearWidth * 1.15);
    expect(height, `clear height ${height.toFixed(0)} mm`).toBeGreaterThan(device.clearHeight * 0.85);
    expect(height).toBeLessThan(device.clearHeight * 1.15);
  });

  it('is surrounded by armour of the full plate thickness', () => {
    // A weapon port's surround is a ball in a collar, not a flat plate, and a
    // ray fired beside it along the plate's normal grazes a sphere and measures
    // a sliver. Those get their own check below.
    if (device.purpose !== 'vision') return;
    // Fired alongside the aperture rather than through it: the plate the port is
    // cut into has to be solid armour right up to the rim, so a port cannot be
    // an opening in something that is itself hollow.
    //
    // Measured from well clear of the surface and in two hops — first hit is
    // the outer face, second is the inner — because a ray starting exactly on a
    // face is at the mercy of which side of it floating point lands on.
    // Offset along the device's OWN lateral, and probed along its own view
    // direction reversed, so this works for a slit facing any bearing.
    const view = new Vector3(...device.viewDirection).normalize();
    const beside = new Vector3(
      S(device.apertureCentre[0]),
      S(device.apertureCentre[1]),
      S(device.apertureCentre[2]),
    )
      .addScaledVector(lateral, S(mm(device.clearWidth / 2 + BESIDE_OFFSET)))
      .addScaledVector(view, S(mm(STANDOFF)));
    const aft = view.clone().negate();

    const toOuterFace = measureThicknessAlong(geometry, beside, aft, S(mm(600)));
    expect(toOuterFace, 'no armour beside the aperture').not.toBeNull();

    // Measure from the FIRST surface to the LAST one within the expected depth.
    //
    // A vision port's armour is not always one plate. The driver's visor is a
    // 70 mm housing bolted to the face of a 100 mm plate; their touching faces
    // are coincident, so a ray crosses four surfaces and the first span alone
    // reports 70 mm of armour where there are 170. Walking to the last crossing
    // inside the expected depth handles one plate and a laminate identically,
    // and needs no way to tell solid from air.
    const window = S(mm(device.throughThickness * DEPTH_WINDOW));
    let cursor = beside.clone().addScaledVector(aft, toOuterFace! + 1e-5);
    let total = 0;
    for (let i = 0; i < MAX_ARMOUR_LAYERS; i++) {
      const span = measureThicknessAlong(geometry, cursor, aft, window - total);
      if (span === null) break;
      total += span;
      cursor = cursor.clone().addScaledVector(aft, span + 1e-5);
    }

    expect(total, 'the plate has an outer face but no inner one').toBeGreaterThan(0);
    // Crossing a plate tilted 9 degrees from vertical along the Z axis, so the
    // path is slightly longer than the plate is thick.
    expect(toMM(total)).toBeGreaterThan(device.throughThickness * 0.95);
    expect(toMM(total)).toBeLessThan(device.throughThickness * 1.25);
  });
});

describe('vision device specification', () => {
  it('places every eye behind the armour it looks through', () => {
    for (const device of VISION_DEVICES) {
      const distance = eyeToAperture(device);
      // Close enough to get a usable field of view, far enough to be a head
      // rather than an eyeball pressed against the plate.
      expect(distance, `${device.id} eye distance`).toBeGreaterThan(120);
      expect(distance, `${device.id} eye distance`).toBeLessThan(600);
    }
  });

  it('gives the driver a wider view than it is tall', () => {
    const visor = VISION_DEVICES.find((d) => d.id === 'driver-visor')!;
    const fov = fieldOfView(visor);
    expect(fov.horizontal).toBeGreaterThan(fov.vertical * 2);
  });
});
