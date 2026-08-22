import { Euler, Vector3 } from 'three';
import { Capsule } from '../collision/Capsule.js';
import {
  DEFAULT_MOVE_CONFIG,
  resolveCapsule,
  snapToGround,
  isPositionClear,
  type MoveConfig,
  type MoveResult,
} from '../collision/CapsuleResolver.js';
import type { CollisionWorld } from '../collision/CollisionWorld.js';
import { SafePoseBuffer, detectStuck } from '../collision/SafePose.js';
import { Region } from '../geom/attributes.js';
import type { InputState } from '../input/types.js';

/**
 * The first-person player.
 *
 * Consumes an `InputState` and nothing else, so keyboard, touch, gamepad and
 * replay all drive it identically — which is what makes the walkthrough test
 * meaningful, since it exercises the same code the player does rather than a
 * scripted camera path.
 */

export interface PlayerConfig {
  readonly standingHeight: number;
  readonly crouchHeight: number;
  readonly radius: number;
  /** Eye height above the feet when standing. */
  readonly eyeHeight: number;
  readonly walkSpeed: number;
  readonly runSpeed: number;
  readonly crouchSpeed: number;
  readonly acceleration: number;
  readonly airControl: number;
  readonly gravity: number;
  readonly jumpSpeed: number;
  readonly maxPitch: number;
  readonly move: MoveConfig;
}

export const DEFAULT_PLAYER_CONFIG: PlayerConfig = {
  // A 1.75 m crewman, which is also the scale reference used when checking the
  // model against the photograph of men standing beside Tiger 211.
  standingHeight: 1.75,
  crouchHeight: 1.15,
  radius: 0.3,
  eyeHeight: 1.62,
  walkSpeed: 1.5,
  runSpeed: 3.4,
  crouchSpeed: 0.85,
  acceleration: 14,
  airControl: 0.25,
  gravity: 9.81,
  jumpSpeed: 3.6,
  maxPitch: Math.PI / 2 - 0.02,
  move: DEFAULT_MOVE_CONFIG,
};

export interface PlayerState {
  readonly position: Vector3;
  readonly velocity: Vector3;
  yaw: number;
  pitch: number;
  grounded: boolean;
  crouching: boolean;
  region: Region;
  /** True while another system, such as a mantle, owns the capsule. */
  externallyDriven: boolean;
}

export class PlayerController {
  readonly capsule: Capsule;
  readonly config: PlayerConfig;
  readonly safePoses = new SafePoseBuffer();

  readonly state: PlayerState = {
    position: new Vector3(),
    velocity: new Vector3(),
    yaw: 0,
    pitch: 0,
    grounded: false,
    crouching: false,
    region: Region.Exterior,
    externallyDriven: false,
  };

  private readonly moveResult: MoveResult = {
    grounded: false,
    groundNormal: new Vector3(0, 1, 0),
    penetrationRemaining: 0,
    touched: [],
    blocked: false,
  };

  private elapsed = 0;
  private worldFloorY = 0;

  constructor(config: Partial<PlayerConfig> = {}) {
    this.config = { ...DEFAULT_PLAYER_CONFIG, ...config };
    this.capsule = new Capsule();
    this.capsule.setFromFoot(new Vector3(), this.config.standingHeight, this.config.radius);
  }

  get lastMove(): MoveResult {
    return this.moveResult;
  }

  /** Feet position. The capsule is derived from it, not the other way round. */
  get position(): Vector3 {
    return this.state.position;
  }

  get eyePosition(): Vector3 {
    const height = this.state.crouching
      ? this.config.eyeHeight * (this.config.crouchHeight / this.config.standingHeight)
      : this.config.eyeHeight;
    return _eye.copy(this.state.position).setY(this.state.position.y + height);
  }

  /** Unit vector the player is looking along. */
  get lookDirection(): Vector3 {
    _euler.set(this.state.pitch, this.state.yaw, 0, 'YXZ');
    return _look.set(0, 0, -1).applyEuler(_euler);
  }

  setWorldFloor(y: number): void {
    this.worldFloorY = y;
  }

  teleport(position: Vector3, yaw = this.state.yaw): void {
    this.state.position.copy(position);
    this.state.velocity.set(0, 0, 0);
    this.state.yaw = yaw;
    this.syncCapsule();
    this.safePoses.reset();
  }

  private syncCapsule(): void {
    const height = this.state.crouching ? this.config.crouchHeight : this.config.standingHeight;
    this.capsule.setFromFoot(this.state.position, height, this.config.radius);
  }

  private syncFromCapsule(): void {
    this.state.position.set(
      this.capsule.start.x,
      this.capsule.start.y - this.capsule.radius,
      this.capsule.start.z,
    );
  }

  update(input: InputState, dt: number, world: CollisionWorld): void {
    this.elapsed += dt;
    if (this.state.externallyDriven) return;

    this.applyLook(input);
    this.applyCrouch(input, world);

    const speed = this.state.crouching
      ? this.config.crouchSpeed
      : input.run
        ? this.config.runSpeed
        : this.config.walkSpeed;

    // Desired horizontal velocity in world space, from the input's local frame.
    const sin = Math.sin(this.state.yaw);
    const cos = Math.cos(this.state.yaw);
    _desired.set(
      (input.move.x * cos - input.move.y * sin) * speed,
      0,
      (-input.move.x * sin - input.move.y * cos) * speed,
    );

    const control = this.state.grounded ? 1 : this.config.airControl;
    const blend = Math.min(1, this.config.acceleration * control * dt);
    this.state.velocity.x += (_desired.x - this.state.velocity.x) * blend;
    this.state.velocity.z += (_desired.z - this.state.velocity.z) * blend;

    if (input.jump.pressed && this.state.grounded) {
      this.state.velocity.y = this.config.jumpSpeed;
      this.state.grounded = false;
    }
    this.state.velocity.y -= this.config.gravity * dt;

    _delta.copy(this.state.velocity).multiplyScalar(dt);
    this.syncCapsule();
    resolveCapsule(world, this.capsule, _delta, this.config.move, this.moveResult);
    this.syncFromCapsule();

    // Ground snapping only applies while descending; jumping through it would
    // otherwise pin the player to the floor.
    if (this.state.velocity.y <= 0) {
      const snap = snapToGround(world, this.capsule, this.config.move);
      if (snap.grounded) {
        this.syncFromCapsule();
        this.state.grounded = true;
        this.state.velocity.y = 0;
      } else {
        this.state.grounded = this.moveResult.grounded;
      }
    } else {
      this.state.grounded = false;
    }

    if (this.moveResult.grounded && this.state.velocity.y < 0) this.state.velocity.y = 0;

    this.checkStuck();
  }

  private applyLook(input: InputState): void {
    this.state.yaw -= input.look.dx;
    this.state.pitch -= input.look.dy;
    const limit = this.config.maxPitch;
    if (this.state.pitch > limit) this.state.pitch = limit;
    if (this.state.pitch < -limit) this.state.pitch = -limit;
    // Keep yaw bounded so long sessions do not lose float precision.
    if (this.state.yaw > Math.PI) this.state.yaw -= Math.PI * 2;
    if (this.state.yaw < -Math.PI) this.state.yaw += Math.PI * 2;
  }

  private applyCrouch(input: InputState, world: CollisionWorld): void {
    if (input.crouch) {
      this.state.crouching = true;
      return;
    }
    if (!this.state.crouching) return;

    // Refuse to stand up under a hatch rim or a sponson: the player would be
    // pushed through the roof by the resolver, which is exactly the kind of
    // "trapped inside a component" the brief rules out.
    _probe.setFromFoot(this.state.position, this.config.standingHeight, this.config.radius);
    if (isPositionClear(world, _probe)) this.state.crouching = false;
  }

  private checkStuck(): void {
    const reason = detectStuck({
      position: this.state.position,
      penetrationRemaining: this.moveResult.penetrationRemaining,
      capsuleRadius: this.config.radius,
      worldFloorY: this.worldFloorY,
      region: this.state.region,
      unknownRegionSeconds: 0,
    });

    if (reason === null) {
      if (this.state.grounded && this.moveResult.penetrationRemaining < this.config.radius * 0.25) {
        this.safePoses.record(this.state.position, this.state.yaw, this.state.region, this.elapsed);
      }
      return;
    }

    const pose = this.safePoses.recover(this.elapsed);
    if (pose) {
      this.state.position.copy(pose.position);
      this.state.yaw = pose.yaw;
      this.state.region = pose.region;
      this.state.velocity.set(0, 0, 0);
      this.syncCapsule();
    }
    this.safePoses.noteRecovery(reason);
  }
}

const _eye = new Vector3();
const _look = new Vector3();
const _desired = new Vector3();
const _delta = new Vector3();
const _euler = new Euler();
const _probe = new Capsule();
