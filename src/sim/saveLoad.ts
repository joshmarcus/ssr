/**
 * Save/Load system — serialize GameState to/from localStorage.
 * Handles Map and Set conversion for JSON compatibility.
 */

import type { GameState, Entity, EntityId } from "../shared/types.js";
import { EntityType } from "../shared/types.js";

const SAVE_KEY = "ssr_save_v7";

interface SerializedGameState {
  _version: 1;
  state: unknown; // JSON-safe representation of GameState
}

/** Convert GameState to a JSON-safe object */
function serialize(state: GameState): SerializedGameState {
  // Deep clone and convert Map/Set
  const raw = JSON.parse(JSON.stringify(state, (key, value) => {
    if (value instanceof Map) {
      return { __type: "Map", entries: Array.from(value.entries()) };
    }
    if (value instanceof Set) {
      return { __type: "Set", values: Array.from(value) };
    }
    return value;
  }));
  return { _version: 1, state: raw };
}

/** Convert JSON-safe object back to GameState */
function deserialize(data: SerializedGameState): GameState {
  const raw = JSON.parse(JSON.stringify(data.state), (_key, value) => {
    if (value && typeof value === "object" && value.__type === "Map") {
      return new Map(value.entries);
    }
    if (value && typeof value === "object" && value.__type === "Set") {
      return new Set(value.values);
    }
    return value;
  });
  return raw as GameState;
}

/** Save game state to localStorage */
export function saveGame(state: GameState): boolean {
  try {
    const data = serialize(state);
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Validate that a deserialized state has the critical structure needed to run. */
function isValidGameState(s: unknown): s is GameState {
  if (!s || typeof s !== "object") return false;
  const gs = s as Record<string, unknown>;
  // Must have core fields
  if (typeof gs.seed !== "number") return false;
  if (typeof gs.turn !== "number") return false;
  if (typeof gs.width !== "number" || typeof gs.height !== "number") return false;
  if (!gs.player || typeof gs.player !== "object") return false;
  // Player must have entity with pos
  const player = gs.player as Record<string, unknown>;
  if (!player.entity || typeof player.entity !== "object") return false;
  const pe = player.entity as Record<string, unknown>;
  if (!pe.pos || typeof pe.pos !== "object") return false;
  // Must have entities Map
  if (!(gs.entities instanceof Map)) return false;
  // Must have tiles Map
  if (!(gs.tiles instanceof Map)) return false;
  // Must have rooms array
  if (!Array.isArray(gs.rooms)) return false;
  return true;
}

/** Load game state from localStorage. Returns null if no save exists or save is corrupt.
 *  Automatically deletes corrupt saves to prevent repeated load failures. */
export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data: SerializedGameState = JSON.parse(raw);
    if (data._version !== 1) {
      localStorage.removeItem(SAVE_KEY);
      return null;
    }
    const state = deserialize(data);
    if (!isValidGameState(state)) {
      console.warn("[saveLoad] Corrupt save detected — missing critical fields. Deleting.");
      localStorage.removeItem(SAVE_KEY);
      return null;
    }
    return state;
  } catch (err) {
    console.warn("[saveLoad] Failed to load save:", err);
    // Delete corrupt save so next load doesn't hit same error
    try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
    return null;
  }
}

/** Check if a save exists */
export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

/** Delete the save */
export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

// ── Run History ──────────────────────────────────────────────

const HISTORY_KEY = "ssr_run_history";
const MAX_HISTORY = 10;

export interface RunRecord {
  seed: number;
  archetype: string;
  difficulty: string;
  victory: boolean;
  turns: number;
  deductionsCorrect: number;
  deductionsTotal: number;
  crewEvacuated: number;
  rating: string;
  timestamp: number; // epoch ms
}

/** Record a completed run in localStorage. */
export function recordRun(state: GameState, rating: string): void {
  try {
    const history = getRunHistory();
    const evac = state.mystery?.evacuation;
    const deds = state.mystery?.deductions ?? [];
    const record: RunRecord = {
      seed: state.seed,
      archetype: state.mystery?.timeline.archetype ?? "unknown",
      difficulty: state.difficulty ?? "normal",
      victory: state.victory,
      turns: state.turn,
      deductionsCorrect: deds.filter(d => d.answeredCorrectly).length,
      deductionsTotal: deds.length,
      crewEvacuated: evac?.crewEvacuated.length ?? 0,
      rating,
      timestamp: Date.now(),
    };
    history.unshift(record);
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch { /* ignore storage errors */ }
}

/** Get run history from localStorage. */
export function getRunHistory(): RunRecord[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RunRecord[];
  } catch {
    return [];
  }
}
