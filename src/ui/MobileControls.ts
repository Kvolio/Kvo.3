import { Action } from '../input/types.js';
import type { TouchInputProvider } from '../input/TouchInputProvider.js';

/**
 * The on-screen controls.
 *
 * This owns how the controls look and where they sit; `TouchInputProvider` owns
 * what they do. That split is what lets every device event in the project stay
 * inside src/input while the layout stays a presentation concern.
 *
 * Designed for a phone rather than shrunk from the desktop scheme: buttons sit
 * in the bottom corners where thumbs already are, the movement stick has no
 * fixed position to aim for, and nothing is placed over the middle of the
 * screen, which is the part someone inspecting a vehicle is actually looking at.
 */

const BUTTON_LAYOUT: { action: Action; label: string; hint: string }[] = [
  { action: Action.Interact, label: 'USE', hint: 'Open or operate' },
  { action: Action.AltInteract, label: 'ENTER', hint: 'Enter or exit' },
  { action: Action.Jump, label: 'CLIMB', hint: 'Climb up' },
  { action: Action.Crouch, label: 'DUCK', hint: 'Crouch (toggle)' },
];

const UTILITY_LAYOUT: { action: Action; label: string }[] = [
  { action: Action.TeleportMenu, label: 'GO TO' },
  { action: Action.ToggleCamera, label: 'VIEW' },
  { action: Action.ToggleXray, label: 'X-RAY' },
];

export class MobileControls {
  readonly root: HTMLDivElement;
  private readonly stickRing: HTMLDivElement;
  private readonly stickThumb: HTMLDivElement;
  private readonly elements: HTMLElement[] = [];
  /** Toggle buttons stay lit while engaged, so the state is never invisible. */
  private readonly toggleButtons = new Map<HTMLElement, Action>();

  constructor(
    private readonly container: HTMLElement,
    private readonly touch: TouchInputProvider,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'mobile-controls';
    this.root.innerHTML = STYLE;

    this.stickRing = el('div', 'stick-ring');
    this.stickThumb = el('div', 'stick-thumb');
    this.stickRing.appendChild(this.stickThumb);
    this.root.appendChild(this.stickRing);

    const actionCluster = el('div', 'cluster cluster-actions');
    for (const { action, label, hint } of BUTTON_LAYOUT) {
      const button = el('button', 'touch-button');
      button.textContent = label;
      button.setAttribute('aria-label', hint);
      // Buttons must never take focus, or the next keystroke goes to them
      // instead of to the game.
      button.tabIndex = -1;
      this.touch.bindButton(button, action);
      this.elements.push(button);
      if (action === Action.Crouch) this.toggleButtons.set(button, action);
      actionCluster.appendChild(button);
    }
    this.root.appendChild(actionCluster);

    const utilityCluster = el('div', 'cluster cluster-utility');
    for (const { action, label } of UTILITY_LAYOUT) {
      const button = el('button', 'touch-button touch-button-small');
      button.textContent = label;
      button.tabIndex = -1;
      this.touch.bindButton(button, action);
      this.elements.push(button);
      utilityCluster.appendChild(button);
    }
    this.root.appendChild(utilityCluster);

    container.appendChild(this.root);
  }

  /** Draw the stick where the thumb actually is. Called once per frame. */
  update(): void {
    for (const [element, action] of this.toggleButtons) {
      element.classList.toggle('engaged', this.touch.isToggled(action));
    }

    const stick = this.touch.stickState;
    if (!stick.active) {
      this.stickRing.style.opacity = '0';
      return;
    }
    this.stickRing.style.opacity = '1';
    this.stickRing.style.transform = `translate(${stick.originX}px, ${stick.originY}px)`;
    const clamp = 62;
    const magnitude = Math.hypot(stick.dx, stick.dy) || 1;
    const scale = Math.min(1, clamp / magnitude);
    this.stickThumb.style.transform = `translate(${stick.dx * scale}px, ${stick.dy * scale}px)`;
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? 'block' : 'none';
  }

  dispose(): void {
    for (const element of this.elements) this.touch.unbindButton(element);
    this.root.remove();
    void this.container;
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

const STYLE = `<style>
.mobile-controls {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 20;
}
.mobile-controls .stick-ring {
  position: absolute;
  top: 0; left: 0;
  width: 124px; height: 124px;
  margin: -62px 0 0 -62px;
  border: 1px solid rgba(232, 226, 212, 0.28);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.12s ease;
  will-change: transform, opacity;
}
.mobile-controls .stick-thumb {
  position: absolute;
  top: 50%; left: 50%;
  width: 52px; height: 52px;
  margin: -26px 0 0 -26px;
  border-radius: 50%;
  background: rgba(232, 226, 212, 0.22);
  border: 1px solid rgba(232, 226, 212, 0.4);
  will-change: transform;
}
.mobile-controls .cluster {
  position: absolute;
  display: flex;
  pointer-events: auto;
}
.mobile-controls .cluster-actions {
  right: max(16px, env(safe-area-inset-right));
  bottom: max(20px, env(safe-area-inset-bottom));
  flex-wrap: wrap;
  gap: 10px;
  width: 176px;
  justify-content: flex-end;
}
.mobile-controls .cluster-utility {
  right: max(16px, env(safe-area-inset-right));
  top: max(16px, env(safe-area-inset-top));
  flex-direction: column;
  gap: 8px;
}
.mobile-controls .touch-button {
  min-width: 78px;
  height: 56px;
  border-radius: 8px;
  border: 1px solid rgba(232, 226, 212, 0.3);
  background: rgba(18, 17, 15, 0.62);
  color: #e8e2d4;
  font: 600 11px/1 ui-monospace, Menlo, Consolas, monospace;
  letter-spacing: 0.1em;
  backdrop-filter: blur(3px);
  touch-action: none;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.mobile-controls .touch-button:active,
.mobile-controls .touch-button.engaged {
  background: rgba(200, 165, 78, 0.32);
  border-color: rgba(200, 165, 78, 0.7);
}
.mobile-controls .touch-button-small {
  min-width: 64px;
  height: 38px;
  font-size: 10px;
}
@media (orientation: portrait) {
  /* Landscape is the intended posture for inspection, but portrait must remain
     usable rather than broken. */
  .mobile-controls .cluster-actions { width: 96px; }
}
</style>`;
