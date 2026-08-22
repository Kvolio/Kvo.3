import { Euler, Vector3, type PerspectiveCamera } from 'three';
import type { PlayerController } from './PlayerController.js';

/**
 * Puts the camera where the player's eyes are.
 *
 * Kept apart from `PlayerController` so that the controller stays testable in
 * Node with no camera at all, and so that the mantle system, the teleport
 * positions and the orbit inspector can each take the camera over without
 * fighting the player for it.
 *
 * The head bob is deliberately small. It is here because walking around a
 * stationary object with a perfectly rigid camera reads as floating, but any
 * more than a couple of centimetres becomes nauseating in first person.
 */

export interface CameraRigOptions {
  readonly bobAmplitude?: number;
  readonly bobFrequency?: number;
  /** Seconds for the eye height to follow a crouch. */
  readonly crouchSmoothing?: number;
}

export class CameraRig {
  private bobPhase = 0;
  private smoothedEyeY = 0;
  private initialised = false;

  private readonly bobAmplitude: number;
  private readonly bobFrequency: number;
  private readonly crouchSmoothing: number;

  constructor(opts: CameraRigOptions = {}) {
    this.bobAmplitude = opts.bobAmplitude ?? 0.018;
    this.bobFrequency = opts.bobFrequency ?? 1.9;
    this.crouchSmoothing = opts.crouchSmoothing ?? 0.12;
  }

  update(camera: PerspectiveCamera, player: PlayerController, dt: number): void {
    const eye = player.eyePosition;

    if (!this.initialised) {
      this.smoothedEyeY = eye.y;
      this.initialised = true;
    } else {
      // Exponential smoothing, framerate independent.
      const alpha = 1 - Math.exp(-dt / Math.max(this.crouchSmoothing, 1e-4));
      this.smoothedEyeY += (eye.y - this.smoothedEyeY) * alpha;
    }

    const speed = Math.hypot(player.state.velocity.x, player.state.velocity.z);
    if (player.state.grounded && speed > 0.2) {
      this.bobPhase += dt * speed * this.bobFrequency * Math.PI;
    } else {
      // Settle back to neutral rather than freezing mid-step.
      this.bobPhase += dt * 4;
      this.bobPhase = this.bobPhase % (Math.PI * 2);
    }

    const bobScale = player.state.grounded ? Math.min(1, speed / 2) : 0;
    const bob = Math.sin(this.bobPhase) * this.bobAmplitude * bobScale;
    const sway = Math.cos(this.bobPhase * 0.5) * this.bobAmplitude * 0.4 * bobScale;

    _euler.set(player.state.pitch, player.state.yaw, 0, 'YXZ');
    _right.set(1, 0, 0).applyEuler(_euler);

    camera.position.set(eye.x, this.smoothedEyeY + bob, eye.z);
    camera.position.addScaledVector(_right, sway);
    camera.quaternion.setFromEuler(_euler);
  }

  /** Snap without smoothing, for teleports and the deterministic screenshot poses. */
  snap(camera: PerspectiveCamera, player: PlayerController): void {
    this.initialised = false;
    this.bobPhase = 0;
    const eye = player.eyePosition;
    this.smoothedEyeY = eye.y;
    _euler.set(player.state.pitch, player.state.yaw, 0, 'YXZ');
    camera.position.copy(eye);
    camera.quaternion.setFromEuler(_euler);
    this.initialised = true;
  }

  /** Look directly at a point, deriving yaw and pitch. Used by the inspection poses. */
  static aimAt(player: PlayerController, target: Vector3): void {
    const eye = player.eyePosition.clone();
    const dir = new Vector3().subVectors(target, eye);
    player.state.yaw = Math.atan2(-dir.x, -dir.z);
    player.state.pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
  }
}

const _euler = new Euler();
const _right = new Vector3();
