import { describe, expect, it } from 'vitest';
import { linkPlacements, trackPath } from '../../src/parts/running/trackPath.js';
import { IDLER, ROAD_WHEEL, SPROCKET, TRACK } from '../../src/spec/runningGear.js';

/**
 * The track's length is fixed at 96 links of 130 mm pitch, so the suspension
 * geometry has to agree with it. That the two agree at all is a real check on
 * the sprocket and idler positions, which are separately estimated.
 */
describe('track path', () => {
  const path = trackPath('left');

  it('wraps a closed belt of about the right length', () => {
    // 96 x 130 = 12,480 mm. The hull of the pulleys comes out within a link of
    // it, which is a good sign the sprocket and idler are where they should be.
    expect(path.length).toBeGreaterThan(TRACK.totalLength - TRACK.pitch * 2);
    expect(path.length).toBeLessThan(TRACK.totalLength + TRACK.pitch * 2);
  });

  it('reports its slack rather than hiding it', () => {
    expect(Math.abs(path.slack)).toBeLessThan(TRACK.pitch * 2);
  });

  it('never cuts inside a wheel', () => {
    // The whole reason for hulling circles rather than splining by hand.
    const pulleys = [
      { z: SPROCKET.centreZ, y: SPROCKET.centreY, r: SPROCKET.outerDiameter / 2 },
      { z: IDLER.centreZ, y: IDLER.centreY, r: IDLER.outerDiameter / 2 },
    ];
    for (const p of path.points) {
      for (const c of pulleys) {
        const d = Math.hypot(p.x - c.z, p.y - c.y);
        expect(d, 'a path point is inside a pulley').toBeGreaterThan(c.r - 1);
      }
    }
  });

  it('runs the top of the track just clear of the road wheels', () => {
    // No return rollers. The upper run is a single taut span from sprocket to
    // idler, and it passes close over the wheel tops rather than resting on
    // them: the link pads clear the wheels but the guide horns, which hang down
    // between the wheel rows, close most of the gap. That is what a Tiger's
    // low, straight upper track line actually is.
    //
    // This is the measurement that caught both pulleys sitting too high. With
    // the sprocket at 800 mm the span cleared the wheels by nearly 400 mm and
    // the track visibly floated.
    const wheelTop = ROAD_WHEEL.diameter;
    const spanY = (z: number): number => {
      let best = -Infinity;
      for (let i = 0; i < path.points.length; i++) {
        const a = path.points[i]!;
        const b = path.points[(i + 1) % path.points.length]!;
        if ((a.x - z) * (b.x - z) > 0) continue;
        const t = (z - a.x) / (b.x - a.x);
        best = Math.max(best, a.y + t * (b.y - a.y));
      }
      return best;
    };

    for (const z of [-1200, 0, 1200]) {
      const clearance = spanY(z) - wheelTop;
      expect(clearance, `upper run dips into the wheels at z=${z}`).toBeGreaterThan(0);
      // The span is not level: the sprocket is taller than the idler, so the
      // run sits highest at the front and comes down onto the wheels toward the
      // tail — which is what the photographs show, daylight under the track by
      // the sprocket and contact further back. The bound admits that taper and
      // still catches the 400 mm float the old pulley heights produced.
      expect(clearance, `upper run floats above the wheels at z=${z}`).toBeLessThan(
        TRACK.guideHornHeight + TRACK.pitch,
      );
    }
  });

  it('lays exactly 96 links, evenly', () => {
    const links = linkPlacements(path);
    expect(links.length).toBe(TRACK.linksPerSide);

    for (let i = 0; i < links.length; i++) {
      const a = links[i]!.position;
      const b = links[(i + 1) % links.length]!.position;
      const gap = a.distanceTo(b);
      // Chords across a curve are shorter than the arc, so the tolerance has to
      // admit the wrap around the sprocket.
      expect(gap).toBeGreaterThan(TRACK.pitch * 0.6);
      expect(gap).toBeLessThan(TRACK.pitch * 1.4);
    }
  });
});
