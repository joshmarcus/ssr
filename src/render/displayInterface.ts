import type { GameState } from "../shared/types.js";
import { SensorType } from "../shared/types.js";

// ── Log entry types for color-coding ────────────────────────────
export type LogType = "system" | "narrative" | "warning" | "critical" | "milestone" | "sensor";

export interface DisplayLogEntry {
  text: string;
  type: LogType;
}

// Re-export for convenience
export { SensorType };

/**
 * Shared interface for the 3D (Three.js) renderer.
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
  flashTile(x: number, y: number, color?: string): void;
  showGameOverOverlay(state: GameState): void;
  copyRunSummary(): Promise<boolean>;
  destroy(): void;
  setHubMode?(open: boolean): void;
}
