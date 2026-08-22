import { Action } from '../input/types.js';
import type { InputManager } from '../input/InputManager.js';

/**
 * The heads-up display: a crosshair, an interaction prompt, and a controls
 * reminder that fades once the player is moving.
 *
 * Prompts are composed as `verb [glyph]`, where the glyph comes from
 * `InputManager`. That is one code path for both platforms: the same call
 * yields "Open commander's hatch [E]" on a keyboard and the touch glyph on a
 * phone, and it follows a remap without the prompt knowing anything changed.
 */
export class HUD {
  readonly root: HTMLDivElement;
  private readonly promptEl: HTMLDivElement;
  private readonly crosshairEl: HTMLDivElement;
  private readonly toastEl: HTMLDivElement;
  private readonly hintEl: HTMLDivElement;

  private toastTimer = 0;
  private hintTimer = 8;

  constructor(container: HTMLElement, private readonly input: InputManager) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = STYLE;

    this.crosshairEl = document.createElement('div');
    this.crosshairEl.className = 'hud-crosshair';
    this.root.appendChild(this.crosshairEl);

    this.promptEl = document.createElement('div');
    this.promptEl.className = 'hud-prompt';
    this.root.appendChild(this.promptEl);

    this.toastEl = document.createElement('div');
    this.toastEl.className = 'hud-toast';
    this.root.appendChild(this.toastEl);

    this.hintEl = document.createElement('div');
    this.hintEl.className = 'hud-hint';
    this.root.appendChild(this.hintEl);

    container.appendChild(this.root);
    this.refreshHint();
  }

  /** Show or clear the interaction prompt. Pass null when nothing is in reach. */
  setPrompt(verb: string | null, action: Action = Action.Interact): void {
    if (verb === null) {
      this.promptEl.textContent = '';
      this.promptEl.classList.remove('visible');
      return;
    }
    this.promptEl.textContent = `${verb}  [${this.input.glyphFor(action)}]`;
    this.promptEl.classList.add('visible');
  }

  /**
   * A brief message. Used for refusals - "no handhold", "not enough headroom" -
   * which without feedback read as bugs rather than as the system working.
   */
  toast(message: string, seconds = 1.6): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('visible');
    this.toastTimer = seconds;
  }

  setCrosshairVisible(visible: boolean): void {
    this.crosshairEl.style.opacity = visible ? '1' : '0';
  }

  update(dt: number, moving: boolean): void {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.remove('visible');
    }
    if (this.hintTimer > 0) {
      // The hint has done its job once the player is actually walking around.
      if (moving) this.hintTimer -= dt * 3;
      else this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.hintEl.classList.remove('visible');
    }
  }

  /** Rebuild the controls reminder, after a remap or a device switch. */
  refreshHint(): void {
    const device = this.input.state.lastDevice;
    if (device === 'touch') {
      this.hintEl.textContent = 'Drag left to move · drag right to look · buttons to interact';
    } else {
      const g = (a: Action): string => this.input.glyphFor(a, 'pc');
      this.hintEl.textContent =
        `${g(Action.MoveForward)}${g(Action.StrafeLeft)}${g(Action.MoveBack)}${g(Action.StrafeRight)} move · ` +
        `mouse look · ${g(Action.Interact)} interact · ${g(Action.AltInteract)} enter · ` +
        `${g(Action.Run)} run · ${g(Action.Crouch)} crouch · ${g(Action.TeleportMenu)} positions`;
    }
    this.hintEl.classList.add('visible');
  }

  dispose(): void {
    this.root.remove();
  }
}

const STYLE = `<style>
.hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 15;
  font: 500 12px/1.4 ui-monospace, Menlo, Consolas, monospace;
  color: #e8e2d4;
  letter-spacing: 0.05em;
}
.hud-crosshair {
  position: absolute;
  top: 50%; left: 50%;
  width: 3px; height: 3px;
  margin: -1.5px 0 0 -1.5px;
  border-radius: 50%;
  background: rgba(232, 226, 212, 0.75);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
  transition: opacity 0.2s ease;
}
.hud-prompt {
  position: absolute;
  top: calc(50% + 34px); left: 50%;
  transform: translateX(-50%);
  padding: 7px 13px;
  background: rgba(18, 17, 15, 0.78);
  border: 1px solid rgba(232, 226, 212, 0.2);
  border-radius: 4px;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.14s ease;
}
.hud-prompt.visible { opacity: 1; }
.hud-toast {
  position: absolute;
  top: calc(50% + 78px); left: 50%;
  transform: translateX(-50%);
  padding: 5px 11px;
  color: #d6b25f;
  background: rgba(18, 17, 15, 0.7);
  border-radius: 4px;
  font-size: 11px;
  opacity: 0;
  transition: opacity 0.25s ease;
}
.hud-toast.visible { opacity: 1; }
.hud-hint {
  position: absolute;
  bottom: max(14px, env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  font-size: 10.5px;
  color: rgba(232, 226, 212, 0.55);
  text-align: center;
  padding: 0 16px;
  opacity: 0;
  transition: opacity 0.6s ease;
}
.hud-hint.visible { opacity: 1; }
</style>`;
