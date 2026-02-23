import type { Action } from "../shared/types.js";
import { ActionType, Direction } from "../shared/types.js";

/**
 * Keyboard input handler for browser play.
 * Maps key events to Action objects.
 *
 * When cameraRelativeMode is true (chase cam), arrow keys and WASD use
 * tank-style controls: up/down = move forward/backward in facing direction,
 * left/right = turn the bot (change facing, no movement, no turn consumed).
 * Vi keys (hjkl) and numpad always use absolute compass directions.
 */

type ActionCallback = (action: Action) => void;
type ScanCallback = () => void;
type TurnCallback = (direction: "left" | "right") => void;

// Direction ring for camera-relative mapping (CW from North)
const DIRS_RING: Direction[] = [
  Direction.North, Direction.NorthEast, Direction.East, Direction.SouthEast,
  Direction.South, Direction.SouthWest, Direction.West, Direction.NorthWest,
];

// ── Gamepad button → key mapping (standard layout: Xbox / Steam Deck) ──
// See https://w3c.github.io/gamepad/#remapping
const GAMEPAD_BUTTON_MAP: Record<number, string> = {
  0: "Enter",       // A — Interact / Confirm
  1: "Escape",      // B — Back / Cancel
  2: "c",           // X — Clean
  3: "t",           // Y — Scan
  4: "r",           // LB — Hub / Journal
  5: "Tab",         // RB — Auto-explore
  8: "F1",          // Select/Back — Help
  9: "Escape",      // Start — Pause menu
  12: "ArrowUp",    // D-pad Up
  13: "ArrowDown",  // D-pad Down
  14: "ArrowLeft",  // D-pad Left
  15: "ArrowRight", // D-pad Right
};

const STICK_DEADZONE = 0.4;
const GAMEPAD_REPEAT_DELAY = 300;  // ms before first repeat
const GAMEPAD_REPEAT_RATE = 150;   // ms between repeats

export class InputHandler {
  private callback: ActionCallback;
  private scanCallback: ScanCallback;
  private boundHandler: (e: KeyboardEvent) => void;

  /** When true, arrow keys and WASD use camera-relative directions */
  cameraRelativeMode: boolean = false;
  /** Current player facing angle in radians (set by display3d) */
  facingAngle: number = 0;
  /** Callback for turning the bot without moving (camera-relative mode) */
  turnCallback: TurnCallback | null = null;

  // Gamepad state tracking
  private _gamepadPollId: number = 0;
  private _prevButtons: boolean[] = [];
  private _prevStickDir: string = "";
  private _stickHoldStart: number = 0;
  private _stickLastRepeat: number = 0;
  /** Whether a gamepad has been detected this session */
  gamepadConnected: boolean = false;

  constructor(callback: ActionCallback, scanCallback: ScanCallback) {
    this.callback = callback;
    this.scanCallback = scanCallback;
    this.boundHandler = this.handleKeyDown.bind(this);
    window.addEventListener("keydown", this.boundHandler);
    this.startGamepadPolling();
  }

  destroy(): void {
    window.removeEventListener("keydown", this.boundHandler);
    if (this._gamepadPollId) cancelAnimationFrame(this._gamepadPollId);
  }

  // ── Gamepad polling ──────────────────────────────────────────
  private startGamepadPolling(): void {
    const poll = () => {
      this._gamepadPollId = requestAnimationFrame(poll);
      const gamepads = navigator.getGamepads?.();
      if (!gamepads) return;
      for (const gp of gamepads) {
        if (!gp || !gp.connected) continue;
        if (!this.gamepadConnected) this.gamepadConnected = true;
        this.processGamepad(gp);
        break; // Only use the first connected gamepad
      }
    };
    this._gamepadPollId = requestAnimationFrame(poll);
  }

  private processGamepad(gp: Gamepad): void {
    const now = performance.now();

    // ── Button presses (fire on rising edge) ──
    for (let i = 0; i < gp.buttons.length; i++) {
      const pressed = gp.buttons[i].pressed;
      const wasPressed = this._prevButtons[i] ?? false;
      if (pressed && !wasPressed) {
        const key = GAMEPAD_BUTTON_MAP[i];
        if (key) this.dispatchKey(key);
      }
      this._prevButtons[i] = pressed;
    }

    // ── Left stick → directional input (with repeat) ──
    const lx = gp.axes[0] ?? 0;
    const ly = gp.axes[1] ?? 0;
    let stickDir = "";
    if (Math.abs(lx) > STICK_DEADZONE || Math.abs(ly) > STICK_DEADZONE) {
      // Determine primary direction from stick angle
      const angle = Math.atan2(ly, lx); // -π to π, right=0, down=π/2
      if (angle >= -Math.PI / 4 && angle < Math.PI / 4) stickDir = "ArrowRight";
      else if (angle >= Math.PI / 4 && angle < 3 * Math.PI / 4) stickDir = "ArrowDown";
      else if (angle >= -3 * Math.PI / 4 && angle < -Math.PI / 4) stickDir = "ArrowUp";
      else stickDir = "ArrowLeft";
    }

    if (stickDir) {
      if (stickDir !== this._prevStickDir) {
        // New direction — fire immediately
        this.dispatchKey(stickDir);
        this._stickHoldStart = now;
        this._stickLastRepeat = now;
      } else if (now - this._stickHoldStart > GAMEPAD_REPEAT_DELAY &&
                 now - this._stickLastRepeat > GAMEPAD_REPEAT_RATE) {
        // Held direction — auto-repeat
        this.dispatchKey(stickDir);
        this._stickLastRepeat = now;
      }
    }
    this._prevStickDir = stickDir;
  }

  /** Dispatch a synthetic keyboard event so all existing handlers work. */
  private dispatchKey(key: string): void {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  }

  /**
   * Convert a relative direction (forward/backward) to an absolute
   * Direction based on the current player facing angle.
   */
  private resolveRelativeDirection(relDir: "forward" | "backward"): Direction {
    // Normalize facing angle to (-π, π]
    let angle = this.facingAngle;
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle <= -Math.PI) angle += Math.PI * 2;
    // Quantize to nearest octant (0=N, 1=NE, 2=E, ... 7=NW)
    // facingAngle: π=N, 3π/4=NE, π/2=E, π/4=SE, 0=S, -π/4=SW, -π/2=W, -3π/4=NW
    let octant = Math.round((Math.PI - angle) / (Math.PI / 4));
    if (octant < 0) octant += 8;
    octant = octant % 8;
    const offsets = { forward: 0, backward: 4 };
    return DIRS_RING[(octant + offsets[relDir]) % 8];
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Handle turns separately (no game action consumed)
    if (this.cameraRelativeMode && this.turnCallback) {
      switch (e.key) {
        case "ArrowLeft": case "a": case "A":
          e.preventDefault();
          this.turnCallback("left");
          return;
        case "ArrowRight": case "d": case "D":
          e.preventDefault();
          this.turnCallback("right");
          return;
      }
    }

    const action = this.mapKeyToAction(e.key);
    if (action) {
      e.preventDefault();
      if (action.type === ActionType.Scan) {
        // Scan toggles thermal overlay and also sends the action
        this.scanCallback();
      }
      this.callback(action);
    }
  }

  private mapKeyToAction(key: string): Action | null {
    // Camera-relative forward/backward (arrow up/down + W/S) when chase cam active
    if (this.cameraRelativeMode) {
      switch (key) {
        case "ArrowUp": case "w": case "W":
          return { type: ActionType.Move, direction: this.resolveRelativeDirection("forward") };
        case "ArrowDown": case "s": case "S":
          return { type: ActionType.Move, direction: this.resolveRelativeDirection("backward") };
        // Left/right handled in handleKeyDown as turns (no action)
      }
    }

    switch (key) {
      // Cardinal: Arrow keys + WASD + vi keys (hjkl) + numpad
      case "ArrowUp":
      case "w":
      case "W":
      case "k":
      case "8":
        return { type: ActionType.Move, direction: Direction.North };
      case "ArrowDown":
      case "s":
      case "S":
      case "j":
      case "2":
        return { type: ActionType.Move, direction: Direction.South };
      case "ArrowLeft":
      case "a":
      case "A":
      case "h":
      case "4":
        return { type: ActionType.Move, direction: Direction.West };
      case "ArrowRight":
      case "d":
      case "D":
      case "l":
      case "6":
        return { type: ActionType.Move, direction: Direction.East };
      // Diagonal: roguelike yubn + numpad
      case "y":
      case "Y":
      case "7":
        return { type: ActionType.Move, direction: Direction.NorthWest };
      case "u":
      case "U":
      case "9":
        return { type: ActionType.Move, direction: Direction.NorthEast };
      case "b":
      case "B":
      case "1":
        return { type: ActionType.Move, direction: Direction.SouthWest };
      case "n":
      case "N":
      case "3":
        return { type: ActionType.Move, direction: Direction.SouthEast };
      // Interact
      case "e":
      case "E":
      case "i":
      case "I":
      case "Enter":
        return { type: ActionType.Interact };
      // Scan (sensor cycle)
      case "t":
      case "T":
      case "q":
      case "Q":
        return { type: ActionType.Scan };
      // Clean
      case "c":
      case "C":
        return { type: ActionType.Clean };
      // Look
      case "x":
      case "X":
        return { type: ActionType.Look };
      // Wait
      case ".":
      case "5":
        return { type: ActionType.Wait };
      // Space: reserved for subtitle dismiss (no game action)
      // Journal / notes
      case ";":
        return { type: ActionType.Journal };
      // Auto-explore
      case "Tab":
        return { type: ActionType.AutoExplore };
      default:
        return null;
    }
  }
}
