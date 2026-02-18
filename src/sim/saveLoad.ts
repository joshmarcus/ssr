/**
 * Save/Load system — serialize GameState to/from localStorage.
 * Handles Map and Set conversion for JSON compatibility.
 */

import type { GameState, Entity, EntityId } from "../shared/types.js";

const SAVE_KEY = "ssr_save_v1";

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

/** Load game state from localStorage. Returns null if no save exists. */
export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data: SerializedGameState = JSON.parse(raw);
    if (data._version !== 1) return null;
    return deserialize(data);
  } catch {
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
