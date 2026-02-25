/**
 * Save/Load system — serialize GameState to/from localStorage.
 * Handles Map and Set conversion for JSON compatibility.
 */

import type { GameState, Entity, EntityId } from "../shared/types.js";
import { EntityType } from "../shared/types.js";

const SAVE_KEY = "ssr_save_v8";

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
  // Must have tiles as 2D array
  if (!Array.isArray(gs.tiles)) return false;
  // Must have rooms array
  if (!Array.isArray(gs.rooms)) return false;
  return true;
}

/** Ensure mystery state fields are initialized after deserialization.
 *  Fields added in later versions may be missing from older saves. */
function ensureMysteryDefaults(state: GameState): GameState {
  if (!state.mystery) return state;
  const m = state.mystery;
  // Ensure arrays exist
  if (!m.roomScenes) (m as any).roomScenes = [];
  if (!m.dossiers) (m as any).dossiers = [];
  if (!m.connections) (m as any).connections = [];
  if (!m.insights) (m as any).insights = [];
  if (!m.threads) (m as any).threads = [];
  if (!m.choices) (m as any).choices = [];
  if (!m.contradictionPairs) (m as any).contradictionPairs = [];
  if (!m.pendingContradictions) (m as any).pendingContradictions = [];
  // Ensure Sets
  if (!(m.discoveredEvidence instanceof Set)) {
    (m as any).discoveredEvidence = new Set(Array.isArray(m.discoveredEvidence) ? m.discoveredEvidence : []);
  }
  // Ensure milestones Set
  if (!(state.milestones instanceof Set)) {
    (state as any).milestones = new Set(Array.isArray(state.milestones) ? state.milestones : []);
  }
  // Ensure reward card fields exist (added in card selection update)
  if (!state.collectedRewards) (state as any).collectedRewards = [];
  if (!state.player.passiveBuffs) (state.player as any).passiveBuffs = {};
  return state;
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
    return ensureMysteryDefaults(state);
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

// ── Achievement System ──────────────────────────────────────────

const ACHIEVEMENTS_KEY = "ssr_achievements";

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string; // single emoji/symbol character
  unlockedAt?: number; // epoch ms when unlocked
}

/** All available achievements in display order. */
const ACHIEVEMENT_DEFS: Omit<Achievement, "unlockedAt">[] = [
  { id: "first_victory", name: "First Contact", description: "Complete your first investigation", icon: "*" },
  { id: "perfect_deductions", name: "Master Detective", description: "Solve all deductions correctly in a single run", icon: "!" },
  { id: "s_rank", name: "S-Rank Investigator", description: "Achieve an S performance rating", icon: "S" },
  { id: "speed_run", name: "Rapid Response", description: "Complete a run in under 100 turns", icon: ">" },
  { id: "all_crew_saved", name: "No One Left Behind", description: "Evacuate all living crew in a single run", icon: "+" },
  { id: "hard_victory", name: "Hard Boiled", description: "Win on Hard difficulty", icon: "#" },
  { id: "all_archetypes", name: "Case Library", description: "Play all 6 incident archetypes", icon: "6" },
  { id: "ten_runs", name: "Veteran Operative", description: "Complete 10 investigations", icon: "X" },
];

/** Get all achievements with unlock status from localStorage. */
export function getAchievements(): Achievement[] {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    const unlocked: Record<string, number> = raw ? JSON.parse(raw) : {};
    return ACHIEVEMENT_DEFS.map(def => ({
      ...def,
      unlockedAt: unlocked[def.id] ?? undefined,
    }));
  } catch {
    return ACHIEVEMENT_DEFS.map(def => ({ ...def }));
  }
}

/** Check and unlock achievements based on run history. Returns newly unlocked achievement IDs. */
export function checkAchievements(): string[] {
  const history = getRunHistory();
  const achievements = getAchievements();
  const unlocked: Record<string, number> = {};
  for (const a of achievements) {
    if (a.unlockedAt) unlocked[a.id] = a.unlockedAt;
  }

  const newlyUnlocked: string[] = [];
  const now = Date.now();

  // first_victory: any victory
  if (!unlocked["first_victory"] && history.some(r => r.victory)) {
    unlocked["first_victory"] = now;
    newlyUnlocked.push("first_victory");
  }

  // perfect_deductions: all correct in a single run
  if (!unlocked["perfect_deductions"] && history.some(r => r.victory && r.deductionsCorrect === r.deductionsTotal && r.deductionsTotal > 0)) {
    unlocked["perfect_deductions"] = now;
    newlyUnlocked.push("perfect_deductions");
  }

  // s_rank: S rating
  if (!unlocked["s_rank"] && history.some(r => r.rating === "S")) {
    unlocked["s_rank"] = now;
    newlyUnlocked.push("s_rank");
  }

  // speed_run: under 100 turns
  if (!unlocked["speed_run"] && history.some(r => r.victory && r.turns < 100)) {
    unlocked["speed_run"] = now;
    newlyUnlocked.push("speed_run");
  }

  // all_crew_saved: crewEvacuated > 0 and victory (means all living crew saved)
  if (!unlocked["all_crew_saved"] && history.some(r => r.victory && r.crewEvacuated > 0)) {
    unlocked["all_crew_saved"] = now;
    newlyUnlocked.push("all_crew_saved");
  }

  // hard_victory: win on hard
  if (!unlocked["hard_victory"] && history.some(r => r.victory && r.difficulty === "hard")) {
    unlocked["hard_victory"] = now;
    newlyUnlocked.push("hard_victory");
  }

  // all_archetypes: 6 unique archetypes seen
  if (!unlocked["all_archetypes"]) {
    const seen = new Set(history.map(r => r.archetype));
    if (seen.size >= 6) {
      unlocked["all_archetypes"] = now;
      newlyUnlocked.push("all_archetypes");
    }
  }

  // ten_runs: 10+ completed runs
  if (!unlocked["ten_runs"] && history.length >= 10) {
    unlocked["ten_runs"] = now;
    newlyUnlocked.push("ten_runs");
  }

  // Persist
  try {
    localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(unlocked));
  } catch { /* ignore */ }

  return newlyUnlocked;
}
