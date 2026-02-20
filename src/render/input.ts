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
      // Wait
      case " ":
        return { type: ActionType.Wait };
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
