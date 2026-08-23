import {
  BoxGeometry,
  BufferAttribute,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Vector3,
} from 'three';
import { Engine } from './core/Engine.js';
import { Loop } from './core/Loop.js';
import { detectQualityTier, overrideFromSearch } from './core/QualityTier.js';
import { Environment } from './env/Environment.js';
import { Ground } from './env/Ground.js';
import { MaterialLibrary } from './materials/MaterialLibrary.js';
import { CollisionFlags, CollisionWorld } from './collision/CollisionWorld.js';
import { PlayerController } from './player/PlayerController.js';
import { CameraRig } from './player/CameraRig.js';
import { InputManager } from './input/InputManager.js';
import { PcInputProvider } from './input/PcInputProvider.js';
import { TouchInputProvider } from './input/TouchInputProvider.js';
import { GamepadInputProvider } from './input/GamepadInputProvider.js';
import { HUD } from './ui/HUD.js';
import { MobileControls } from './ui/MobileControls.js';
import { DebugOverlay, debugEnabled } from './debug/Overlay.js';
import { registerAttributeFactory } from './geom/attributes.js';
import { buildAssembly, buildHullOnly, buildTurretAssembly } from './parts/hull/index.js';
import { mountAssembly, mountDynamicAssembly } from './assembly/mount.js';
import { Articulation } from './assembly/Articulation.js';
import { InteractionSystem } from './assembly/InteractionSystem.js';
import { buildHatchLid, type HatchId } from './parts/hull/hatches.js';
import { SPEC } from './spec/index.js';
import { AusfH_Feb1943 } from './spec/variants.js';
import { R, S, mm } from './spec/units.js';

/**
 * Entry point.
 *
 * Stage 0 of the build: the harness the vehicle will be assembled inside. The
 * player, the collision world, the input abstraction, the material system and
 * the environment are all real and final; what is standing in the middle is a
 * dimensional envelope, not a tank.
 *
 * That envelope is deliberately a wireframe rather than a crude solid. The
 * point of it is to make the Ausf. H's real dimensions legible and walkable
 * from the first commit, so that when hull plates start replacing it there is
 * something to check them against — and so nothing can be mistaken for a
 * finished model.
 */

registerAttributeFactory((data, itemSize) => new BufferAttribute(data, itemSize));

const container = document.getElementById('app');
if (!container) throw new Error('missing #app container');

const search = typeof location !== 'undefined' ? location.search : '';

const quality = detectQualityTier({
  hardwareConcurrency: navigator.hardwareConcurrency ?? 4,
  devicePixelRatio: window.devicePixelRatio ?? 1,
  maxTouchPoints: navigator.maxTouchPoints ?? 0,
  userAgent: navigator.userAgent,
  ...(overrideFromSearch(search) !== undefined ? { override: overrideFromSearch(search)! } : {}),
});

const boot = document.getElementById('boot');
const bootStatus = document.getElementById('boot-status');
const bootBar = document.querySelector<HTMLElement>('#boot-bar > i');
const progress = (label: string, fraction: number): void => {
  if (bootStatus) bootStatus.textContent = label;
  if (bootBar) bootBar.style.width = `${Math.round(fraction * 100)}%`;
};

progress('renderer', 0.1);
const engine = new Engine(container, quality);

progress('materials', 0.3);
const materials = new MaterialLibrary(quality);

progress('environment', 0.5);
const environment = new Environment(engine.scene, quality);
environment.prepare(engine.renderer);

const ground = new Ground(materials.get('default'), {});
ground.mesh.material = materials.get('armourPaintedExterior');
engine.scene.add(ground.mesh);

progress('collision', 0.7);
const world = new CollisionWorld();
world.addStatic(ground.mesh.geometry, { id: 'ground', flags: CollisionFlags.Walkable });

// ---------------------------------------------------------------------------
// The vehicle.
//
// The lower hull is real armour now: welded plate solids with genuine thickness,
// built from the sourced Jentz & Doyle arrangement. The wireframe around it is
// the overall envelope, kept as a measuring stick until the superstructure,
// turret and running gear fill it out.
// ---------------------------------------------------------------------------
progress('hull', 0.78);
const hull = buildAssembly(buildHullOnly, { variant: AusfH_Feb1943, detail: 0 });
const mountedHull = mountAssembly(engine.scene, world, materials, hull, {
  name: 'hull',
  castShadow: environment.shadowsEnabled,
  receiveShadow: environment.shadowsEnabled,
});

// ---------------------------------------------------------------------------
// Hatch lids
//
// Built and mounted separately from the hull because they move. The roof
// apertures they seat in are genuine holes cut in the roof plate's outline, so
// an open hatch is a hole the player can drop through with nothing special-cased
// to make it so.
// ---------------------------------------------------------------------------
/**
 * Seconds for a lid to travel. The mechanism screws the lid up a threaded post
 * before it swings, and no crew did that quickly.
 */
const HATCH_CYCLE_SECONDS = 2.2;
/** How close the player must stand to work a hatch, in metres. */
const HATCH_REACH = 2.4;
/** How close to stand to work the turret traverse, in metres. */
const TURRET_REACH = 3.2;

const interactions = new InteractionSystem();
const articulations: Articulation[] = [];

// ---------------------------------------------------------------------------
// Turret
//
// Mounted as its own body so that traversing is a matrix write rather than a
// rebuild, and built at zero traverse in hull coordinates so the geometry tests
// can measure it against the deck.
// ---------------------------------------------------------------------------
const turretBuild = buildAssembly(buildTurretAssembly, {
  variant: AusfH_Feb1943,
  detail: 0,
});
const mountedTurret = mountDynamicAssembly(engine.scene, world, materials, turretBuild, {
  name: 'turret',
  castShadow: environment.shadowsEnabled,
  receiveShadow: environment.shadowsEnabled,
});

const turret = new Articulation({
  id: 'turret',
  mesh: mountedTurret.mesh,
  collision: mountedTurret.collision,
  pivot: new Vector3(0, S(SPEC.turret.ring.planeY), S(SPEC.turret.ring.centreZ)),
  axis: new Vector3(0, 1, 0),
  lift: 0,
  // A full turn takes 60 seconds in low gear, which is the figure the
  // Boehringer-Sturm drive is specified at and slower than most people expect.
  swing: Math.PI * 2,
  duration: SPEC.traverse.lowGearSeconds,
});
articulations.push(turret);

interactions.add({
  id: 'turret',
  position: () =>
    new Vector3(0, S(SPEC.turret.ring.planeY), S(SPEC.turret.ring.centreZ)),
  label: () => (turret.isOpen ? 'Stop the turret' : 'Traverse the turret'),
  reach: TURRET_REACH,
  activate: () => turret.toggle(),
});

const HATCH_LABELS: Record<HatchId, string> = {
  driverHatch: "driver's hatch",
  radioHatch: "radio operator's hatch",
};

for (const id of ['driverHatch', 'radioHatch'] as const) {
  let pivot: readonly [number, number, number] = [0, 0, 0];
  const built = buildAssembly((ctx) => {
    const lid = buildHatchLid(ctx, id);
    pivot = lid.pivot;
    return lid.part;
  }, { variant: AusfH_Feb1943, detail: 0 });

  const mounted = mountDynamicAssembly(engine.scene, world, materials, built, {
    name: id,
    castShadow: environment.shadowsEnabled,
    receiveShadow: environment.shadowsEnabled,
  });

  const spec = SPEC.hull[id];
  const articulation = new Articulation({
    id,
    mesh: mounted.mesh,
    collision: mounted.collision,
    pivot: new Vector3(S(mm(pivot[0])), S(mm(pivot[1])), S(mm(pivot[2]))),
    // Swinging about +Y takes the port lid outboard and the starboard lid
    // inboard, so the sign follows the side the lid is on.
    axis: new Vector3(0, Math.sign(spec.centreX), 0),
    lift: S(spec.liftHeight),
    swing: R(spec.openAngle),
    duration: HATCH_CYCLE_SECONDS,
  });
  articulations.push(articulation);

  interactions.add({
    id,
    position: () => new Vector3(S(spec.centreX), S(SPEC.hull.roofY), S(spec.centreZ)),
    label: () => `${articulation.isOpen ? 'Close' : 'Open'} the ${HATCH_LABELS[id]}`,
    reach: HATCH_REACH,
    activate: () => articulation.toggle(),
  });
}

const envelope = new BoxGeometry(
  S(SPEC.overall.widthOverCombatTracks),
  S(SPEC.overall.heightToCupola),
  S(SPEC.overall.length),
);
envelope.translate(0, S(SPEC.overall.heightToCupola) / 2, 0);

const envelopeLines = new LineSegments(
  new EdgesGeometry(envelope),
  new LineBasicMaterial({ color: 0xc8a54e, transparent: true, opacity: 0.35 }),
);
envelopeLines.name = 'overall-envelope';
engine.scene.add(envelopeLines);

progress('controls', 0.85);
const input = new InputManager();
const touch = new TouchInputProvider();
input.register(new PcInputProvider(input.bindings));
input.register(touch);
input.register(new GamepadInputProvider());
input.attach(container);

const player = new PlayerController();
player.setWorldFloor(-2);
// Start off the port bow, at the distance the reference photographs were taken.
player.teleport(new Vector3(-6, 1.5, 6.5));
CameraRig.aimAt(player, new Vector3(0, 1.4, 0));

const rig = new CameraRig();
const hud = new HUD(container, input);
const mobile = new MobileControls(container, touch);
const mobileVisible = (navigator.maxTouchPoints ?? 0) > 0;
mobile.setVisible(mobileVisible);

const overlay = debugEnabled(search) ? new DebugOverlay(container) : null;

progress('ready', 1);

const loop = new Loop({
  fixedUpdate: (dt) => {
    const state = input.update(dt);
    player.update(state, dt, world);
    for (const articulation of articulations) articulation.update(dt);
    interactions.update(player.eyePosition, player.lookDirection, state);
  },
  render: (dt) => {
    rig.update(engine.camera, player, dt);
    const moving = Math.hypot(player.state.velocity.x, player.state.velocity.z) > 0.3;
    hud.update(dt, moving, interactions.focus?.interactable.label() ?? null);
    mobile.update();
    engine.render();
    overlay?.update(dt, { engine, loop, player, world });
  },
});

loop.start();
boot?.classList.add('done');
setTimeout(() => boot?.remove(), 500);

hud.setPrompt(
  `${AusfH_Feb1943.label} — lower hull, ${mountedHull.triangleCount.toLocaleString()} triangles`,
);
setTimeout(() => hud.setPrompt(null), 5000);

// Exposed for the Playwright harness: deterministic poses, quality overrides
// and renderer statistics, so the visual suite drives the real application
// rather than a test-only copy of it.
// `TigerHarness` is declared in tests/e2e/global.d.ts, which is the one place
// its shape lives. Re-declaring it here as well made the two merge, and the
// merged index signature swallowed every named member back into `unknown`.
declare global {
  interface Window {
    __TIGER__?: TigerHarness;
  }
}
window.__TIGER__ = {
  ready: true,
  variant: AusfH_Feb1943,
  quality: quality.name,
  stats: () => engine.stats(),
  playerPosition: () => player.position.toArray(),
  teleport: (x: number, y: number, z: number) => player.teleport(new Vector3(x, y, z)),
  lookAt: (x: number, y: number, z: number) => {
    CameraRig.aimAt(player, new Vector3(x, y, z));
    rig.snap(engine.camera, player);
  },
  setDebugMaterial: (mode: string) =>
    materials.setDebugMode(mode as Parameters<typeof materials.setDebugMode>[0]),
  recoveries: () => player.safePoses.recoveries,
  /**
   * Advance the simulation by an exact number of fixed steps.
   *
   * Headless WebGL runs through SwiftShader at roughly one to two frames a
   * second, so anything asserted after a wall-clock wait barely moves and
   * passes for the wrong reason. Stepping explicitly makes end-to-end tests
   * both deterministic and fast, and they still drive the real controller,
   * the real resolver and the real input providers.
   */
  step: (steps: number) => loop.advance(steps),
  /** Frame an orthographic elevation, for silhouette measurement. */
  orthoView: (eye: number[], target: number[], frustumHeightMM: number) => {
    engine.setOrthographicView(
      new Vector3(S(mm(eye[0]!)), S(mm(eye[1]!)), S(mm(eye[2]!))),
      new Vector3(S(mm(target[0]!)), S(mm(target[1]!)), S(mm(target[2]!))),
      S(mm(frustumHeightMM)),
    );
    engine.render();
  },
  orthoScale: () => engine.orthographicScale(),
  /**
   * Strip the scene to the vehicle alone against a flat background.
   *
   * A silhouette is only measurable if there is something to threshold against.
   * With the sky, the terrain and the reference envelope in shot, every pixel is
   * some shade of ochre and the outline has to be judged by eye — which is what
   * let a wedge-shaped front hull survive this long.
   */
  /**
   * Hide the on-screen chrome without changing the lighting. The captured
   * views are evidence, and an info bar across the driver's plate hides
   * exactly the part of the tank a critic needs to look at.
   */
  hideChrome: (on: boolean) => {
    hud.root.style.display = on ? 'none' : '';
    mobile.root.style.display = on ? 'none' : mobileVisible ? '' : 'none';
    overlay?.root.style.setProperty('display', on ? 'none' : '');
    // The dimension envelope is a measuring aid, not part of the vehicle.
    envelopeLines.visible = !on;
    engine.render();
  },
  silhouetteMode: (on: boolean) => {
    // The overlays are not part of the vehicle. The controls hint in
    // particular is a wide band of grey text across the bottom of the frame,
    // and left in shot it reads as 3.7 m of tank.
    hud.root.style.display = on ? 'none' : '';
    mobile.root.style.display = on ? 'none' : mobileVisible ? '' : 'none';
    overlay?.root.style.setProperty('display', on ? 'none' : '');
    ground.mesh.visible = !on;
    environment.sky.visible = !on;
    envelopeLines.visible = !on;
    // Unlit vehicle against a white field: the mask is simply everything that
    // is not the background.
    engine.renderer.setClearColor(on ? 0xffffff : 0x000000, 1);
    engine.scene.environmentIntensity = on ? 0 : 1.15;
    environment.sun.intensity = on ? 0 : 2.6;
    environment.fill.intensity = on ? 0 : 0.95;
    engine.render();
  },
  clearOrthoView: () => {
    engine.clearOrthographicView();
    engine.render();
  },
  frames: () => loop.frames,
  // Live handles for the Playwright harness and for diagnosing render faults.
  // Kept deliberately small: poses, statistics and the objects a visual test
  // legitimately needs to inspect.
  interactionPrompt: () => interactions.focus?.interactable.label() ?? null,
  // Looked up by id, not by index: the list grew a turret at position zero and
  // every test that said articulations[0] silently changed what it was testing.
  articulation: (id: string) => articulations.find((a) => a.id === id) ?? null,
  /** Where an interactable sits, in metres, so tests need not hard-code it. */
  interactablePosition: (id: string) => {
    const found = interactions.positionOf(id);
    return found === null ? null : found.toArray();
  },
  internals: {
    engine, materials, environment, ground, world, player, input, touch, loop, hull,
    articulations, interactions, turret, mountedTurret, THREE: { Vector3 },
  },
  hullStats: () => ({
    triangles: mountedHull.triangleCount,
    collisionTriangles: mountedHull.collisionTriangleCount,
    fastenerMeshes: mountedHull.fasteners.length,
  }),
  sceneReport: () => ({
    compiledMaterials: materials.compiledCount,
    paintUniform: materials.peekUniform('uPaint'),
    debugUniform: materials.peekUniform('uDebugMode'),
    lights: engine.scene.children
      .filter((c) => 'isLight' in c && c.isLight === true)
      .map((l) => ({ type: l.type, intensity: (l as unknown as { intensity: number }).intensity })),
    groundMaterial: (ground.mesh.material as { type: string; name: string }).type,
    envSet: engine.scene.environment !== null,
    toneExposure: engine.renderer.toneMappingExposure,
  }),
};
