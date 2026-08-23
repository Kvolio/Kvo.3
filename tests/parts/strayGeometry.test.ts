import { describe, expect, it } from 'vitest';
import { buildAssembly, buildHull } from '../../src/parts/hull/index.js';
import { GUN, HULL, TURRET, toMM } from '../../src/spec/index.js';

/**
 * Nothing may float outside the vehicle.
 *
 * The recoil guard was laid with its rotation negated, so the whole cage was
 * built FORWARD of the trunnion and hung over the barrel in open air outside
 * the turret. It rendered as a thin dark bar beside the gun, and two critics
 * reported it independently as stray geometry before anything here caught it.
 *
 * The check is crude on purpose: anything well above the vehicle's roof line
 * and well forward of the turret is either the gun or a mistake, and the gun is
 * a slender thing on the trunnion axis.
 */
describe('stray geometry', () => {
  it('leaves nothing floating above the hull forward of the turret', () => {
    const geometry = buildAssembly(buildHull).context.render.toGeometry().geometry;
    const position = geometry.attributes.position!;

    const turretFrontZ = TURRET.ring.centreZ + TURRET.shell.frontOverhang;
    // Anything forward of the turret and higher than the roof should be part of
    // the gun, which lives within a metre of the trunnion axis laterally.
    const gunHalfSpan = TURRET.mantlet.width / 2 + 50;

    const strays: string[] = [];
    for (let i = 0; i < position.count; i++) {
      const x = toMM(position.getX(i));
      const y = toMM(position.getY(i));
      const z = toMM(position.getZ(i));
      if (z < turretFrontZ + 200) continue;
      if (y < HULL.roofY + 300) continue;
      if (Math.abs(x) <= gunHalfSpan && y < GUN.elevation.trunnionY + gunHalfSpan) continue;
      strays.push(`(${x.toFixed(0)}, ${y.toFixed(0)}, ${z.toFixed(0)})`);
    }

    expect(
      strays.length,
      `geometry floating clear of the vehicle: ${strays.slice(0, 4).join(' ')}`,
    ).toBe(0);
  });
});
