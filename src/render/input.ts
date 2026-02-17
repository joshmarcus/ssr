import type { Action } from "../shared/types.js";
import { ActionType, Direction } from "../shared/types.js";

/**
 * Keyboard input handler for browser play.
 * Maps key events to Action objects.
 *
 * Arrow keys -> Move in corresponding direction
 * 'i'        -> Interact
 * 's'        -> Scan (toggle thermal overlay)
 * '.'        -> Wait
 */

type ActionCallback = (action: Action) => void;
type ScanCallback = () => void;

export class InputHandler {
  private callback: ActionCallback;
  private scanCallback: ScanCallback;
  private boundHandler: (e: KeyboardEvent) => void;

  constructor(callback: ActionCallback, scanCallback: ScanCallback) {
    this.callback = callback;
    this.scanCallback = scanCallback;
    this.boundHandler = this.handleKeyDown.bind(this);
    window.addEventListener("keydown", this.boundHandler);
  }

  destroy(): void {
    window.removeEventListener("keydown", this.boundHandler);
  }

  private handleKeyDown(e: KeyboardEvent): void {
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
    switch (key) {
      // Arrow keys + WASD for movement
      case "ArrowUp":
      case "w":
      case "W":
        return { type: ActionType.Move, direction: Direction.North };
      case "ArrowDown":
      case "s":
      case "S":
        return { type: ActionType.Move, direction: Direction.South };
      case "ArrowLeft":
      case "a":
      case "A":
        return { type: ActionType.Move, direction: Direction.West };
      case "ArrowRight":
      case "d":
      case "D":
        return { type: ActionType.Move, direction: Direction.East };
      // Interact
      case "e":
      case "E":
      case "i":
      case "I":
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
      case "l":
      case "L":
        return { type: ActionType.Look };
      // Wait
      case ".":
      case " ":
        return { type: ActionType.Wait };
      // Journal (evidence review)
      case "j":
      case "J":
        return { type: ActionType.Journal };
      default:
        return null;
    }
  }
}
