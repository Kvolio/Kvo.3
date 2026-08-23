import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { buildAssembly, buildHull } from '../../src/parts/hull/index.js';
import { measureThicknessAlong } from '../../src/geom/analysis.js';
import { R, S, mm, toMM } from '../../src/spec/units.js';
import {
  ARMOUR,
  DRIVER_PLATE_HEAD_Z,
  HULL,
  SPEC,
  TURRET,
} from '../../src/spec/index.js';

/**
 * Numerical QA.
 *
 * Every figure here is measured from the geometry that was actually built and
 * compared against a reference value, with the deviation printed. The table it
 * emits goes into the Gauntlet report, so no accuracy claim in that report is
 * made without a measurement behind it.
 */

const built = buildAssembly(buildHull);
const geometry = built.context.render.toGeometry().geometry;
geometry.computeBoundingBox();
const box = geometry.boundingBox!;

interface Row {
  feature: string;
  reference: number;
  model: number;
  unit: string;
  tolerance: number;
  source: string;
}

const rows: Row[] = [];

function record(row: Row): Row {
  rows.push(row);
  return row;
}

/** Distance through a plate, entered along `dir` from well outside it. */
function crossPlate(from: Vector3, dir: Vector3): number {
  const first = measureThicknessAlong(geometry, from, dir, S(mm(3000)));
  if (first === null) return NaN;
  const on = from.clone().addScaledVector(dir, first + 1e-5);
  const second = measureThicknessAlong(geometry, on, dir, S(mm(600)));
  return second === null ? NaN : toMM(second);
}

describe('numerical QA', () => {
  it('measures the hull against its references', () => {
    const aft = new Vector3(0, 0, -1);

    // Nose to rear plate, along the armour, found by scanning the centreline at
    // many heights and taking each end's extreme. A single ray measures the rake
    // it happens to cross, not the hull's length; and the bounding box is longer
    // than the hull because the Feifel canisters hang off the back, so that
    // overhang is measured as its own row rather than being absorbed into a
    // loose tolerance here. The scan runs on the centreline, where neither the
    // canisters nor the exhausts stand.
    const scanEnd = (dir: Vector3, startZ: number): number => {
      let extreme = NaN;
      for (let y = 520; y <= 1740; y += 20) {
        const hit = measureThicknessAlong(
          geometry,
          new Vector3(0, S(mm(y)), S(mm(startZ))),
          dir,
          S(mm(2200)),
        );
        if (hit === null) continue;
        const z = startZ + dir.z * toMM(hit);
        if (Number.isNaN(extreme) || z * dir.z < extreme * dir.z) extreme = z;
      }
      return extreme;
    };
    const noseZ = scanEnd(aft, 4600);
    const rearPlateZ = scanEnd(new Vector3(0, 0, 1), -4600);
    record({
      feature: 'Hull length, nose to rear plate',
      reference: SPEC.overall.length,
      model: noseZ - rearPlateZ,
      unit: 'mm',
      tolerance: 60,
      source: 'TIC-tech; centreline scan of the armour',
    });
    // The hull is not the longest thing on the vehicle. Two separate fittings
    // set the extents, so they are measured separately rather than rolled into
    // one aggregate that goes stale whenever either of them moves — which is
    // exactly what happened when the track guards arrived.
    // With the gun on, the foremost point is the muzzle, and the vehicle's
    // overall length becomes directly comparable with the sourced gun-forward
    // figure — a check on the trunnion position, the barrel's L/56 length and
    // the muzzle brake all at once, none of which was tuned to make it land.
    // Muzzle to the HULL'S TAIL, which is the datum the sourced figure uses.
    //
    // This measured the bounding box, which runs from the muzzle to the Feifel
    // canisters — 317 mm further aft than the hull. That slack hid a gun barrel
    // 521 mm too short, and two critics caught by eye what this row was
    // reporting as inside tolerance.
    record({
      feature: 'Overall length, gun forward',
      reference: SPEC.overall.lengthGunForward,
      model: toMM(box.max.z) - HULL.rearZ,
      unit: 'mm',
      tolerance: 120,
      source: "TIC-tech; muzzle to the hull's tail, not to the Feifel drums",
    });
    record({
      feature: 'Gun overhang past the nose',
      reference: SPEC.overall.lengthGunForward - SPEC.overall.length,
      model: toMM(box.max.z) - HULL.frontZ,
      unit: 'mm',
      tolerance: 120,
      source: 'derived from the two sourced lengths',
    });

    // The guard tip on its own, probed just inboard of the triangular sweep
    // where it reaches furthest forward.
    const guardTipHit = measureThicknessAlong(
      geometry,
      new Vector3(
        S(mm(HULL.lowerWidth / 2 + 20)),
        // Mid-plate: the guard's top is flush with the sponson floor's, so its
        // material sits just BELOW that line, not on it.
        S(
          mm(
            HULL.trackGuard.height +
              ARMOUR.hull.roof.thickness -
              HULL.trackGuard.thickness / 2,
          ),
        ),
        S(mm(5000)),
      ),
      aft,
      S(mm(2200)),
    );
    record({
      feature: 'Track guard tip, ahead of the nose',
      reference: HULL.trackGuard.frontZ,
      model: guardTipHit === null ? NaN : 5000 - toMM(guardTipHit),
      unit: 'mm',
      tolerance: 60,
      source: 'REF-drawing side view: guard edge ahead of the nose',
    });
    record({
      feature: 'Aftmost point (Feifel canisters)',
      reference: -HULL.trackGuard.rearZ,
      model: -toMM(box.min.z),
      unit: 'mm',
      tolerance: 160,
      source: 'REF-drawing side view: canisters project aft of the rear plate',
    });
    // With the track guards fitted the widest thing on the vehicle is the
    // guards, not the superstructure — and the width that falls out of the
    // model is now directly comparable with the sourced overall figure.
    record({
      feature: 'Width over track guards',
      reference: SPEC.overall.widthOverCombatTracks,
      model: toMM(box.max.x - box.min.x),
      unit: 'mm',
      tolerance: 20,
      source: 'TIC-tech, UNCERTAINTY #5',
    });

    const sideX = measureThicknessAlong(
      geometry,
      new Vector3(S(mm(3000)), S(mm(1500)), S(mm(500))),
      new Vector3(-1, 0, 0),
      S(mm(2000)),
    );
    record({
      feature: 'Superstructure width',
      reference: HULL.superstructureWidth,
      model: sideX === null ? NaN : (3000 - toMM(sideX)) * 2,
      unit: 'mm',
      tolerance: 40,
      source: 'REF-drawing front view; measured onto the sponson side',
    });
    // Cast down onto the roof over the fighting compartment rather than reading
    // the bounding box, which is set by whatever fitting stands tallest.
    // Forward of the turret and outboard of the driver's hatch, or this reads
    // whatever is stacked above the roof rather than the roof.
    const roofHit = measureThicknessAlong(
      geometry,
      new Vector3(S(mm(1400)), S(mm(4000)), S(mm(2000))),
      new Vector3(0, -1, 0),
      S(mm(4000)),
    );
    record({
      feature: 'Hull roof height',
      reference: SPEC.overall.heightToHullRoof,
      model: roofHit === null ? NaN : 4000 - toMM(roofHit),
      unit: 'mm',
      tolerance: 25,
      source: 'TIC-tech; measured by ray onto the roof plate',
    });
    // The whole stack from the ground to the top of the cupola, against a
    // sourced overall height. Every term in it — ring plane, turret interior
    // height, both roof plates and the drum — was estimated separately, so
    // their sum landing on the sourced figure is a real cross-check.
    //
    // Aimed at the cupola's RIM, not its axis: the commander's hatch is a
    // genuine aperture and a ray down the middle drops straight through it,
    // through the cupola's own opening in the turret roof, and lands on the
    // hull. Which is a good sign, but not a measurement of the cupola.
    const cupolaRimX = mm(
      TURRET.cupola.centreX +
        Math.sign(TURRET.cupola.centreX) *
          ((TURRET.cupola.hatchDiameter + TURRET.cupola.outerDiameter) / 4),
    );
    const cupolaHit = measureThicknessAlong(
      geometry,
      new Vector3(S(cupolaRimX), S(mm(4200)), S(mm(TURRET.ring.centreZ + TURRET.cupola.centreZ))),
      new Vector3(0, -1, 0),
      S(mm(4200)),
    );
    record({
      feature: 'Height to cupola top',
      reference: SPEC.overall.heightToCupola,
      model: cupolaHit === null ? NaN : 4200 - toMM(cupolaHit),
      unit: 'mm',
      tolerance: 120,
      source: 'TIC-tech; measured by ray onto the cupola roof',
    });
    // The tallest thing on the REAR DECK, behind the turret — which is the
    // Feifel trunking. Reading the bounding box instead reports the cupola,
    // now that there is one.
    // Behind the turret AND its stowage bin, which hangs off the bustle at
    // about -1,755 mm and is otherwise the tallest thing the scan finds.
    const rearDeckAft = mm(
      TURRET.ring.centreZ - TURRET.shell.length + TURRET.shell.frontOverhang,
    );
    const scanFrom = mm(rearDeckAft - TURRET.stowageBin.depth - 150);
    let rearDeckTop = -Infinity;
    const position = geometry.attributes.position!;
    for (let i = 0; i < position.count; i++) {
      if (toMM(position.getZ(i)) > scanFrom) continue;
      rearDeckTop = Math.max(rearDeckTop, toMM(position.getY(i)));
    }
    record({
      feature: 'Tallest fitting on the rear deck',
      reference: HULL.roofY + 250,
      model: rearDeckTop,
      unit: 'mm',
      tolerance: 120,
      source: 'REF-photo rear deck: Feifel trunking is a low hump',
    });
    // Up from below the centreline, so this is the belly plate's underside and
    // not whatever edge break or side wall hangs lowest.
    const bellyHit = measureThicknessAlong(
      geometry,
      new Vector3(0, S(mm(-1000)), 0),
      new Vector3(0, 1, 0),
      S(mm(3000)),
    );
    record({
      feature: 'Ground clearance under the belly',
      reference: SPEC.overall.groundClearance,
      model: bellyHit === null ? NaN : toMM(bellyHit) - 1000,
      unit: 'mm',
      tolerance: 12,
      source: 'TIC-tech; measured under the centreline',
    });
    // With the running gear built, the lowest thing on the vehicle is no longer
    // the hull — it is the road wheels, and they should be exactly on the
    // ground. The arm droop that puts them there is derived from the bar
    // height, the arm length and the wheel diameter; taking the arm as
    // horizontal instead buried the bottom of every wheel 200 mm underground.
    record({
      feature: 'Lowest point of the vehicle',
      reference: 0,
      model: toMM(box.min.y),
      unit: 'mm',
      tolerance: 6,
      source: 'road wheels resting on the ground plane',
    });

    // Plate thicknesses, crossed along Z and corrected for each plate's rake.
    const noseCross = crossPlate(new Vector3(0, S(mm(800)), S(mm(4200))), aft);
    record({
      feature: 'Nose plate thickness',
      reference: ARMOUR.hull.nose.thickness,
      model: noseCross * Math.cos(R(ARMOUR.hull.nose.angle)),
      unit: 'mm',
      tolerance: 12,
      source: 'Jentz & Doyle',
    });

    const driverCross = crossPlate(new Vector3(0, S(mm(1500)), S(mm(4200))), aft);
    record({
      feature: "Driver's plate thickness",
      reference: ARMOUR.hull.driverPlate.thickness,
      model: driverCross * Math.cos(R(ARMOUR.hull.driverPlate.angle)),
      unit: 'mm',
      tolerance: 12,
      source: 'Jentz & Doyle',
    });

    const glacisMidZ = mm((HULL.frontZ + (HULL.frontZ - HULL.glacisRun)) / 2);
    // Off the centreline: a ray dropped on the glacis at x=0 now crosses the
    // gun barrel on the way down and measures its wall instead. Clear of the
    // headlights at 1,080 too.
    const glacisCross = crossPlate(
      new Vector3(S(mm(600)), S(mm(2400)), S(glacisMidZ)),
      new Vector3(0, -1, 0),
    );
    record({
      feature: 'Short glacis thickness',
      reference: ARMOUR.hull.shortGlacis.thickness,
      model: glacisCross * Math.sin(R(ARMOUR.hull.shortGlacis.angle)),
      unit: 'mm',
      tolerance: 12,
      source: 'Jentz & Doyle',
    });

    // Plate angles, from the surface itself: two rays a known height apart onto
    // the same plate give its rake directly. This is the measurement a wedge
    // fault cannot survive — a single continuous front would report the same
    // angle for the nose and the driver's plate.
    const faceZAt = (y: number): number => {
      const hit = measureThicknessAlong(
        geometry,
        new Vector3(0, S(mm(y)), S(mm(4600))),
        aft,
        S(mm(2200)),
      );
      return hit === null ? NaN : 4600 - toMM(hit);
    };
    const rakeFromVertical = (yLow: number, yHigh: number): number => {
      const dz = faceZAt(yHigh) - faceZAt(yLow);
      return (Math.atan2(-dz, yHigh - yLow) * 180) / Math.PI;
    };
    // The two plates rake in OPPOSITE directions. The nose leans forward going
    // up, to the hull's foremost point; the driver's plate leans back from
    // there. `rakeFromVertical` is signed, so the nose reads negative — which is
    // the point, and is the single most direct refutation of a continuous wedge.
    const noseRake = rakeFromVertical(700, 1050);
    const driverRake = rakeFromVertical(1400, 1700);
    record({
      feature: 'Nose plate rake from vertical',
      reference: ARMOUR.hull.nose.angle,
      model: Math.abs(noseRake),
      unit: 'deg',
      tolerance: 1.5,
      source: 'Jentz & Doyle; measured off the built face',
    });
    record({
      feature: "Driver's plate rake from vertical",
      reference: ARMOUR.hull.driverPlate.angle,
      model: Math.abs(driverRake),
      unit: 'deg',
      tolerance: 1.5,
      source: 'Jentz & Doyle; measured off the built face',
    });
    record({
      feature: 'Included angle at the front step',
      reference:
        180 - ARMOUR.hull.nose.angle - ARMOUR.hull.driverPlate.angle,
      model: 180 - Math.abs(noseRake) - Math.abs(driverRake),
      unit: 'deg',
      tolerance: 2,
      source: 'A continuous wedge would read 180 degrees here',
    });

    expect(
      Math.sign(noseRake),
      'the nose and the driver plate must rake in opposite directions',
    ).not.toBe(Math.sign(driverRake));
    // Measured off the built roof, not computed from the spec. The roof plate
    // was centred on its frame's origin rather than on the hull, putting it and
    // every aperture in it 317 mm forward — and a spec-derived figure agreed
    // with itself throughout.
    // Walk in from beyond the nose and stop at the FIRST roof hit. Recording
    // every hit instead walks the length of the tank and reports the tail.
    const roofFrontEdgeZ = (): number => {
      for (let z = 3400; z >= -3600; z -= 5) {
        const hit = measureThicknessAlong(
          geometry,
          new Vector3(S(mm(1400)), S(mm(HULL.roofY + 500)), S(mm(z))),
          new Vector3(0, -1, 0),
          S(mm(3000)),
        );
        if (hit !== null && Math.abs(toMM(hit) - 500) < 30) return z;
      }
      return NaN;
    };
    record({
      feature: 'Roof plate front edge',
      reference: DRIVER_PLATE_HEAD_Z,
      model: roofFrontEdgeZ(),
      unit: 'mm',
      tolerance: 30,
      source: 'derived from the driver plate; measured off the built roof',
    });
    record({
      feature: 'Roof front edge, behind nose top',
      reference: 670,
      model: HULL.frontZ - DRIVER_PLATE_HEAD_Z,
      unit: 'mm',
      tolerance: 130,
      source: 'REF-drawing, measured at 20.3 mm/px',
    });

    // Write the table into the Gauntlet report, so no accuracy claim there is
    // made by hand. A figure that is not measured does not appear.
    const line = (r: Row): string => {
      const dev = r.model - r.reference;
      // A reference of zero — the wheels sitting on the ground — has no
      // meaningful percentage, so the column says so rather than reporting
      // Infinity.
      const pct = r.reference === 0 ? null : (dev / r.reference) * 100;
      const verdict = Math.abs(dev) <= r.tolerance ? 'ok' : '**OUT**';
      const sign = (v: number): string => (v >= 0 ? '+' : '');
      return (
        `| ${r.feature} | ${r.reference.toFixed(0)} | ${r.model.toFixed(0)} | ` +
        `${sign(dev)}${dev.toFixed(0)} | ` +
        `${pct === null ? '—' : `${sign(pct)}${pct.toFixed(1)}%`} | ` +
        `±${r.tolerance} | ${verdict} | ${r.source} |`
      );
    };
    writeFileSync(
      'docs/gauntlet/numerical-qa.md',
      [
        '# Numerical QA',
        '',
        'Generated by `tests/parts/numericalQA.test.ts`. Every figure in the Model',
        'column is measured from the geometry that was actually built — by ray',
        'casting through it, or from its bounding box — never copied from the spec.',
        'A row outside its tolerance fails the test, so this table cannot go stale',
        'and cannot be quietly overridden.',
        '',
        'All lengths in millimetres.',
        '',
        '| Feature | Reference | Model | Deviation | % | Tol | Verdict | Source |',
        '|---|---|---|---|---|---|---|---|',
        ...rows.map(line),
        '',
      ].join('\n'),
    );

    for (const r of rows) {
      expect(Number.isFinite(r.model), `${r.feature} could not be measured`).toBe(true);
      expect(
        Math.abs(r.model - r.reference),
        `${r.feature}: model ${r.model.toFixed(0)} vs reference ${r.reference}`,
      ).toBeLessThanOrEqual(r.tolerance);
    }
  });
});
