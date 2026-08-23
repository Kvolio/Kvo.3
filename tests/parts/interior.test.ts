import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { buildAssembly, buildHull } from '../../src/parts/hull/index.js';
import { measureThicknessAlong } from '../../src/geom/analysis.js';
import { ARMOUR, HULL, S, TURRET, mm, toMM } from '../../src/spec/index.js';
import { ENGINE, STEERING, TRANSMISSION } from '../../src/spec/powertrain.js';
import { VISION_DEVICES } from '../../src/spec/vision.js';

/**
 * The inside of the hull.
 *
 * Two things matter here and neither is visible from outside. The compartments
 * have to be places a crewman could be — a floor at the height he stood, a
 * firewall where the engine bay starts — and the machinery has to be INSIDE the
 * armour and out of the crew's way. The steering unit stood proud of the nose
 * plate and the gearbox sat in the radio operator's lap, and both looked
 * entirely reasonable until something measured them.
 */

const geometry = buildAssembly(buildHull).context.render.toGeometry().geometry;
const FLOOR_TOP = mm(HULL.floorY + ARMOUR.hull.sideWallProudOfBelly);

describe('interior', () => {
  it('gives the crew a floor above the torsion bars', () => {
    // Sixteen bars run transversely under the fighting compartment. Taking the
    // belly plate as the floor puts the crew 200 mm too low and runs the bars
    // through their feet.
    const hit = measureThicknessAlong(
      geometry,
      new Vector3(0, S(mm(HULL.roofY - 100)), S(mm(500))),
      new Vector3(0, -1, 0),
      S(mm(2000)),
    );
    expect(hit, 'nothing under the fighting compartment').not.toBeNull();
    const floorY = HULL.roofY - 100 - toMM(hit!);
    expect(floorY).toBeGreaterThan(FLOOR_TOP + HULL.crewFloorHeight - 60);
  });

  it('separates the engine bay from the fighting compartment', () => {
    // Fired aft along the hull at crew height: it has to meet the firewall.
    const from = mm(1000);
    const hit = measureThicknessAlong(
      geometry,
      new Vector3(0, S(mm(FLOOR_TOP + HULL.crewFloorHeight + 300)), S(from)),
      new Vector3(0, 0, -1),
      S(mm(4000)),
    );
    expect(hit, 'no firewall aft of the fighting compartment').not.toBeNull();
    const z = from - toMM(hit!);
    expect(z, 'the first thing aft is not the firewall').toBeGreaterThan(
      HULL.firewallZ - 200,
    );
  });

  it('keeps the machinery inside the armour', () => {
    // Each box's forward-most face against the hull's own front at that height.
    const boxes = [
      { name: 'steering unit', z: mm(STEERING.centreZ + STEERING.unitLength / 2) },
      { name: 'gearbox', z: mm(TRANSMISSION.centreZ + TRANSMISSION.length / 2) },
    ];
    for (const box of boxes) {
      expect(box.z, `${box.name} reaches past the nose`).toBeLessThan(HULL.frontZ);
    }
    expect(
      ENGINE.centreZ - ENGINE.length / 2,
      'the engine reaches past the tail',
    ).toBeGreaterThan(HULL.rearZ);
  });

  it('keeps the machinery out of every crew sightline', () => {
    // The gearbox blocked the hull machine gun's line until it was moved onto
    // the centreline between the two forward stations. This asserts the general
    // case rather than that one instance.
    for (const device of VISION_DEVICES) {
      // A BORE has a gun in it, by definition — the hull machine gun's barrel
      // runs down its own aperture and is supposed to. Only the ports a crewman
      // looks through have to be clear.
      if (device.shape === 'bore') continue;
      const eye = new Vector3(S(device.eye[0]), S(device.eye[1]), S(device.eye[2]));
      const dir = new Vector3(...device.viewDirection).normalize();
      const blocked = measureThicknessAlong(geometry, eye, dir, S(mm(400)));
      expect(blocked, `something sits right in front of ${device.id}`).toBeNull();
    }
  });

  it('hangs the turret basket inside the ring it turns in', () => {
    const basketDiameter = TURRET.ring.clearOpeningDiameter - TURRET.basket.clearance * 2;
    expect(basketDiameter).toBeLessThan(TURRET.ring.clearOpeningDiameter);
    expect(basketDiameter).toBeGreaterThan(TURRET.ring.clearOpeningDiameter * 0.9);
  });
});
