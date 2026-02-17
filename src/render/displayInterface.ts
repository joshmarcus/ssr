import type { GameState } from "../shared/types.js";
import { SensorType } from "../shared/types.js";
import type { LogType, DisplayLogEntry } from "./display.js";

// Re-export for convenience
export { SensorType };
export type { LogType, DisplayLogEntry };

/**
 * Shared interface for 2D (ROT.js) and 3D (Three.js) renderers.
 * Both BrowserDisplay and BrowserDisplay3D implement this.
 */
export interface IGameDisplay {
  render(state: GameState): void;
  renderUI(state: GameState, panel: HTMLElement, visitedRoomIds?: Set<string>): void;
  updateRoomFlash(state: GameState): void;
  addLog(msg: string, type?: LogType): void;
  toggleSensor(type: SensorType): void;
  triggerTrail(): void;
  readonly isThermalActive: boolean;
  readonly isCleanlinessActive: boolean;
  readonly activeSensorMode: SensorType | null;
  getLogHistory(): DisplayLogEntry[];
  triggerScreenFlash(type: "damage" | "milestone" | "stun"): void;
  showGameOverOverlay(state: GameState): void;
  destroy(): void;
}
