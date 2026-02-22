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

  constructor(callback: ActionCallback, scanCallback: ScanCallback) {
    this.callback = callback;
    this.scanCallback = scanCallback;
    this.boundHandler = this.handleKeyDown.bind(this);
    window.addEventListener("keydown", this.boundHandler);
  }

  destroy(): void {
    window.removeEventListener("keydown", this.boundHandler);
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
