import { describe, expect, it } from 'vitest';
import { BoxGeometry, Matrix4, PlaneGeometry, Vector3 } from 'three';
import { CollisionFlags, CollisionWorld } from '../../src/collision/CollisionWorld.js';
import { Capsule } from '../../src/collision/Capsule.js';
import {
  DEFAULT_MOVE_CONFIG,
  isPositionClear,
  resolveCapsule,
  snapToGround,
} from '../../src/collision/CapsuleResolver.js';
import { PlayerController } from '../../src/player/PlayerController.js';
import { buildPlate } from '../../src/prims/plate.js';
import { circle, rect } from '../../src/geom/poly2.js';
import { mm } from '../../src/spec/units.js';
import { createInputState } from '../../src/input/types.js';

/** A ground plane, large enough that nothing walks off the edge by accident. */
function groundWorld(size = 40): CollisionWorld {
  const world = new CollisionWorld();
  const plane = new PlaneGeometry(size, size);
  plane.rotateX(-Math.PI / 2);
  world.addStatic(plane, { id: 'ground', flags: CollisionFlags.Walkable });
  return world;
}

function addBox(
  world: CollisionWorld,
  id: string,
  size: [number, number, number],
  position: [number, number, number],
): void {
  const box = new BoxGeometry(...size);
  box.translate(...position);
  world.addStatic(box, { id, flags: CollisionFlags.Walkable });
}

const neutralInput = () => createInputState();

describe('collision world', () => {
  it('reports contacts for a capsule straddling a surface and none for a clear one', () => {
    const world = groundWorld();
    addBox(world, 'wall', [1, 3, 6], [2, 1.5, 0]);

    // Overlapping the wall's near face at x = 1.5.
    const straddling = new Capsule().setFromFoot(new Vector3(1.35, 0.5, 0), 1.75, 0.3);
    const clear = new Capsule().setFromFoot(new Vector3(-5, 0.5, 0), 1.75, 0.3);

    const contacts: Parameters<typeof world.query>[1] = [];
    expect(world.query(straddling, contacts).length).toBeGreaterThan(0);
    expect(world.query(clear, contacts).length).toBe(0);
  });

  it('finds nothing for a capsule buried deeper than its own radius', () => {
    // A real property of surface-based collision, asserted so it is a known
    // limitation rather than a surprise: nothing is within reach when the whole
    // capsule is inside a solid. The resolver's substepping prevents ever
    // arriving there, and SafePose recovery covers the case where something
    // else puts the player inside geometry anyway.
    const world = groundWorld();
    addBox(world, 'thick', [4, 4, 4], [2, 2, 0]);
    const buried = new Capsule().setFromFoot(new Vector3(2, 1, 0), 1.0, 0.2);

    const contacts: Parameters<typeof world.query>[1] = [];
    expect(world.query(buried, contacts).length).toBe(0);
  });

  it('refuses non-indexed geometry rather than silently colliding with nothing', () => {
    const world = new CollisionWorld();
    const plane = new PlaneGeometry(1, 1).toNonIndexed();
    expect(() => world.addStatic(plane, { id: 'bad' })).toThrow(/indexed/);
  });
});

describe('the player cannot walk through armour', () => {
  it('is stopped by a wall no matter how hard it is pushed', () => {
    const world = groundWorld();
    addBox(world, 'wall', [0.1, 3, 8], [2, 1.5, 0]);

    const capsule = new Capsule().setFromFoot(new Vector3(0, 0, 0), 1.75, 0.3);
    for (let i = 0; i < 200; i++) {
      resolveCapsule(world, capsule, new Vector3(0.08, 0, 0));
    }
    // Stopped in front of the near face of a 100 mm wall at x = 2.
    expect(capsule.start.x).toBeLessThan(2 - 0.05 + 1e-3);
  });

  it('does not tunnel through thin plate at speed', () => {
    // A 25 mm roof plate is thinner than one frame of movement at a run, which
    // is exactly the case that makes naive resolvers leak.
    const world = new CollisionWorld();
    addBox(world, 'plate', [0.025, 4, 8], [2, 2, 0]);

    const capsule = new Capsule().setFromFoot(new Vector3(0, 0.5, 0), 1.75, 0.3);
    // 3.4 m/s at 30 fps is 113 mm per frame, over four times the plate thickness.
    for (let i = 0; i < 60; i++) {
      resolveCapsule(world, capsule, new Vector3(0.113, 0, 0));
    }
    expect(capsule.start.x).toBeLessThan(2);
  });

  it('stops the player leaving the world', () => {
    const world = groundWorld(20);
    // Inverted shell, as the anti-trap backstop uses.
    const shell = new BoxGeometry(20, 20, 20);
    const flipped = shell.clone();
    flipped.scale(-1, 1, 1);
    flipped.translate(0, 10, 0);
    world.addStatic(flipped, { id: 'bounds', flags: CollisionFlags.WorldBounds });

    const capsule = new Capsule().setFromFoot(new Vector3(0, 0.5, 0), 1.75, 0.3);
    for (let i = 0; i < 400; i++) resolveCapsule(world, capsule, new Vector3(0.2, 0, 0));
    expect(Math.abs(capsule.start.x)).toBeLessThan(11);
  });
});

describe('ground behaviour', () => {
  it('does not fall through the floor over a long run', () => {
    const world = groundWorld();
    const player = new PlayerController();
    player.teleport(new Vector3(0, 2, 0));

    const input = neutralInput();
    for (let i = 0; i < 600; i++) player.update(input, 1 / 60, world);

    expect(player.position.y).toBeGreaterThan(-0.05);
    expect(player.position.y).toBeLessThan(0.05);
    expect(player.state.grounded).toBe(true);
    // The last-resort recovery should never have been needed.
    expect(player.safePoses.recoveries).toBe(0);
  });

  it('snaps down onto a surface within reach', () => {
    const world = groundWorld();
    const capsule = new Capsule().setFromFoot(new Vector3(0, 0.2, 0), 1.75, 0.3);
    const snap = snapToGround(world, capsule);
    expect(snap.grounded).toBe(true);
    expect(capsule.start.y).toBeCloseTo(0.3, 3);
  });

  it('refuses to stand on a slope steeper than the walk limit', () => {
    // The Tiger's nose plate sits 24 degrees from vertical, so 66 from
    // horizontal: comfortably past the 50-degree limit. The player should slide
    // off it and be forced to route via the fenders, which is what happened.
    const world = new CollisionWorld();
    const ramp = new PlaneGeometry(10, 10);
    ramp.rotateX(-Math.PI / 2);
    ramp.rotateZ((66 * Math.PI) / 180);
    world.addStatic(ramp, { id: 'glacis', flags: CollisionFlags.Walkable });

    const capsule = new Capsule().setFromFoot(new Vector3(0, 1, 0), 1.75, 0.3);
    const snap = snapToGround(world, capsule, DEFAULT_MOVE_CONFIG);
    expect(snap.grounded).toBe(false);
  });

  it('walks off a ledge and lands rather than floating', () => {
    const world = new CollisionWorld();
    const low = new PlaneGeometry(40, 40);
    low.rotateX(-Math.PI / 2);
    world.addStatic(low, { id: 'ground', flags: CollisionFlags.Walkable });
    addBox(world, 'ledge', [4, 1, 4], [0, 0.5, 0]);

    const player = new PlayerController();
    player.teleport(new Vector3(0, 1.05, 0));

    const input = neutralInput();
    input.move.y = 1;
    player.state.yaw = 0;
    for (let i = 0; i < 240; i++) player.update(input, 1 / 60, world);

    // Walked off the 1 m ledge and is now standing on the ground below.
    expect(player.position.y).toBeLessThan(0.1);
    expect(player.state.grounded).toBe(true);
    expect(player.safePoses.recoveries).toBe(0);
  });
});

describe('an open hatch is a hole you can pass through', () => {
  // The mechanism the whole interior depends on. The aperture is a hole polygon
  // in the roof plate, so the plate's collision geometry already has the hole;
  // the lid is a separate dynamic body that plugs it. Nothing rebuilds a BVH
  // when the hatch moves.
  const buildRoofWithAperture = () => {
    const world = new CollisionWorld();
    const roof = buildPlate({
      outline: rect(4000, 4000),
      holes: [circle(560, 32)],
      thickness: mm(25),
    });
    const roofGeometry = roof.builder.toGeometry().geometry;
    // Plate local z is its thickness axis; lay it flat as a roof at y = 2 m.
    const lay = new Matrix4().makeRotationX(-Math.PI / 2);
    lay.setPosition(0, 2, 0);
    world.addStatic(roofGeometry, { id: 'roof', matrixWorld: lay, flags: CollisionFlags.Walkable });

    const lid = buildPlate({ outline: circle(600, 32), thickness: mm(60) });
    const lidHandle = world.addDynamic(lid.builder.toGeometry().geometry, {
      id: 'hatch-lid',
      matrixWorld: lay.clone(),
      flags: CollisionFlags.Closure,
    });
    return { world, lidHandle, closed: lay };
  };

  it('blocks the aperture while the lid is shut', () => {
    const { world } = buildRoofWithAperture();
    const inAperture = new Capsule().setFromFoot(new Vector3(0, 1.7, 0), 1.75, 0.3);
    const contacts: Parameters<typeof world.query>[1] = [];
    expect(world.query(inAperture, contacts).length).toBeGreaterThan(0);
  });

  it('opens the way through when the lid swings clear, with no BVH rebuild', () => {
    const { world, lidHandle, closed } = buildRoofWithAperture();
    const versionBefore = world.version;

    // Swing the lid aside, exactly as a hinge would.
    const open = closed.clone();
    open.multiply(new Matrix4().makeTranslation(1.5, 0, 0));
    lidHandle.setMatrix(open);

    const inAperture = new Capsule().setFromFoot(new Vector3(0, 1.7, 0), 1.75, 0.3);
    const contacts: Parameters<typeof world.query>[1] = [];
    expect(world.query(inAperture, contacts).length).toBe(0);
    // The world noticed the move; nothing was rebuilt.
    expect(world.version).toBeGreaterThan(versionBefore);
  });

  it('still blocks the plate itself, a metre away from the aperture', () => {
    const { world, lidHandle, closed } = buildRoofWithAperture();
    lidHandle.setMatrix(closed.clone().multiply(new Matrix4().makeTranslation(1.5, 0, 0)));

    const throughPlate = new Capsule().setFromFoot(new Vector3(1.4, 1.7, 0), 1.75, 0.3);
    const contacts: Parameters<typeof world.query>[1] = [];
    expect(world.query(throughPlate, contacts).length).toBeGreaterThan(0);
  });
});

describe('crouching', () => {
  it('refuses to stand up under an overhang', () => {
    const world = groundWorld();
    // A sponson roof 1.3 m up: enough headroom crouched, not enough standing.
    addBox(world, 'sponson', [4, 0.1, 4], [0, 1.35, 0]);

    const player = new PlayerController();
    player.teleport(new Vector3(0, 0, 0));

    const input = neutralInput();
    input.crouch = true;
    for (let i = 0; i < 30; i++) player.update(input, 1 / 60, world);
    expect(player.state.crouching).toBe(true);

    input.crouch = false;
    for (let i = 0; i < 30; i++) player.update(input, 1 / 60, world);
    // Still crouched, because standing would push the player through the roof.
    expect(player.state.crouching).toBe(true);
    expect(player.safePoses.recoveries).toBe(0);
  });

  it('stands back up once clear', () => {
    const world = groundWorld();
    const player = new PlayerController();
    player.teleport(new Vector3(0, 0, 0));

    const input = neutralInput();
    input.crouch = true;
    for (let i = 0; i < 10; i++) player.update(input, 1 / 60, world);
    input.crouch = false;
    for (let i = 0; i < 10; i++) player.update(input, 1 / 60, world);
    expect(player.state.crouching).toBe(false);
  });

  it('reports whether a standing capsule would fit', () => {
    const world = groundWorld();
    addBox(world, 'roof', [4, 0.1, 4], [0, 1.35, 0]);
    const standing = new Capsule().setFromFoot(new Vector3(0, 0, 0), 1.75, 0.3);
    const crouched = new Capsule().setFromFoot(new Vector3(0, 0, 0), 1.15, 0.3);
    expect(isPositionClear(world, standing)).toBe(false);
    expect(isPositionClear(world, crouched)).toBe(true);
  });
});

describe('look controls', () => {
  it('clamps pitch so the view cannot invert', () => {
    const world = groundWorld();
    const player = new PlayerController();
    const input = neutralInput();
    input.look.dy = -0.5;
    for (let i = 0; i < 60; i++) player.update(input, 1 / 60, world);
    expect(player.state.pitch).toBeLessThanOrEqual(player.config.maxPitch);

    input.look.dy = 0.5;
    for (let i = 0; i < 120; i++) player.update(input, 1 / 60, world);
    expect(player.state.pitch).toBeGreaterThanOrEqual(-player.config.maxPitch);
  });

  it('keeps yaw bounded over a long session', () => {
    const world = groundWorld();
    const player = new PlayerController();
    const input = neutralInput();
    input.look.dx = 0.3;
    for (let i = 0; i < 1000; i++) player.update(input, 1 / 60, world);
    expect(Math.abs(player.state.yaw)).toBeLessThanOrEqual(Math.PI + 1e-6);
  });
});
