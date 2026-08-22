import {
  BoxGeometry,
  BufferAttribute,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
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
import { Region, ensureProcAttributes, registerAttributeFactory } from './geom/attributes.js';
import { SPEC } from './spec/index.js';
import { AusfH_Feb1943 } from './spec/variants.js';
import { S } from './spec/units.js';

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
// Stage 0 dimensional envelope.
//
// The Ausf. H's sourced overall dimensions, drawn as a wireframe at the correct
// ride height. It is a measuring stick, not a model.
// ---------------------------------------------------------------------------
const envelope = new BoxGeometry(
  S(SPEC.overall.widthOverCombatTracks),
  S(SPEC.overall.heightToCupola),
  S(SPEC.overall.length),
);
envelope.translate(0, S(SPEC.overall.heightToCupola) / 2, 0);

const envelopeLines = new LineSegments(
  new EdgesGeometry(envelope),
  new LineBasicMaterial({ color: 0xc8a54e, transparent: true, opacity: 0.5 }),
);
envelopeLines.name = 'stage0-envelope';
engine.scene.add(envelopeLines);

// The hull box itself is solid, so collision, climbing and the walk-around are
// exercised end to end from the first build.
const hullBlock = new BoxGeometry(
  S(SPEC.overall.widthOverCombatTracks),
  S(SPEC.overall.heightToHullRoof) - S(SPEC.overall.groundClearance),
  S(SPEC.overall.length),
);
hullBlock.translate(
  0,
  S(SPEC.overall.groundClearance) +
    (S(SPEC.overall.heightToHullRoof) - S(SPEC.overall.groundClearance)) / 2,
  0,
);
ensureProcAttributes(hullBlock, { region: Region.Exterior });
const hullMesh = new Mesh(hullBlock, materials.get('armourPaintedExterior'));
hullMesh.name = 'stage0-hull-envelope';
hullMesh.castShadow = environment.shadowsEnabled;
hullMesh.receiveShadow = environment.shadowsEnabled;
engine.scene.add(hullMesh);
world.addStatic(hullBlock, {
  id: 'stage0-hull-envelope',
  flags: CollisionFlags.Walkable | CollisionFlags.MantleTarget,
});

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
mobile.setVisible((navigator.maxTouchPoints ?? 0) > 0);

const overlay = debugEnabled(search) ? new DebugOverlay(container) : null;

progress('ready', 1);

const loop = new Loop({
  fixedUpdate: (dt) => {
    const state = input.update(dt);
    player.update(state, dt, world);
  },
  render: (dt) => {
    rig.update(engine.camera, player, dt);
    const moving = Math.hypot(player.state.velocity.x, player.state.velocity.z) > 0.3;
    hud.update(dt, moving);
    mobile.update();
    engine.render();
    overlay?.update(dt, { engine, loop, player, world });
  },
});

loop.start();
boot?.classList.add('done');
setTimeout(() => boot?.remove(), 500);

hud.setPrompt(`${AusfH_Feb1943.label} — dimensional envelope, Stage 0`);
setTimeout(() => hud.setPrompt(null), 5000);

// Exposed for the Playwright harness: deterministic poses, quality overrides
// and renderer statistics, so the visual suite drives the real application
// rather than a test-only copy of it.
declare global {
  interface Window {
    __TIGER__?: Record<string, unknown>;
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
  frames: () => loop.frames,
  // Live handles for the Playwright harness and for diagnosing render faults.
  // Kept deliberately small: poses, statistics and the objects a visual test
  // legitimately needs to inspect.
  internals: { engine, materials, environment, ground, world, player, input, touch, loop },
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
