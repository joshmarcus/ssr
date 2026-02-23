import { describe, it, expect, beforeEach, vi } from "vitest";
import { generate } from "../src/sim/procgen.js";
import { step } from "../src/sim/step.js";
import { ActionType, Difficulty } from "../src/shared/types.js";
import type { GameState } from "../src/shared/types.js";

// Mock localStorage for Node.js test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// Import after localStorage is available
const { saveGame, loadGame, hasSave, deleteSave } = await import("../src/sim/saveLoad.js");

describe("save/load round-trip", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("save and load preserves core game state", () => {
    const state = generate(42, Difficulty.Normal);
    expect(saveGame(state)).toBe(true);
    expect(hasSave()).toBe(true);

    const loaded = loadGame();
    expect(loaded).not.toBeNull();
    expect(loaded!.seed).toBe(42);
    expect(loaded!.turn).toBe(state.turn);
    expect(loaded!.width).toBe(state.width);
    expect(loaded!.height).toBe(state.height);
    expect(loaded!.player.hp).toBe(state.player.hp);
    expect(loaded!.player.entity.pos.x).toBe(state.player.entity.pos.x);
    expect(loaded!.player.entity.pos.y).toBe(state.player.entity.pos.y);
  });

  it("save and load preserves entities Map", () => {
    const state = generate(184201, Difficulty.Normal);
    saveGame(state);
    const loaded = loadGame()!;

    expect(loaded.entities).toBeInstanceOf(Map);
    expect(loaded.entities.size).toBe(state.entities.size);

    // Verify player entity exists
    expect(loaded.entities.has("player")).toBe(true);
    const playerEntity = loaded.entities.get("player")!;
    expect(playerEntity.pos.x).toBe(state.player.entity.pos.x);
    expect(playerEntity.pos.y).toBe(state.player.entity.pos.y);
  });

  it("save and load preserves tiles as 2D array", () => {
    const state = generate(42, Difficulty.Normal);
    saveGame(state);
    const loaded = loadGame()!;

    expect(Array.isArray(loaded.tiles)).toBe(true);
    expect(loaded.tiles.length).toBe(state.height);
    expect(loaded.tiles[0].length).toBe(state.width);
    // Check a specific tile
    expect(loaded.tiles[0][0].type).toBe(state.tiles[0][0].type);
  });

  it("save and load preserves rooms array", () => {
    const state = generate(42, Difficulty.Normal);
    saveGame(state);
    const loaded = loadGame()!;

    expect(Array.isArray(loaded.rooms)).toBe(true);
    expect(loaded.rooms.length).toBe(state.rooms.length);
    expect(loaded.rooms[0].name).toBe(state.rooms[0].name);
  });

  it("save and load preserves mystery state", () => {
    const state = generate(777, Difficulty.Normal);
    expect(state.mystery).toBeDefined();
    saveGame(state);
    const loaded = loadGame()!;

    expect(loaded.mystery).toBeDefined();
    expect(loaded.mystery!.timeline.archetype).toBe(state.mystery!.timeline.archetype);
    expect(loaded.mystery!.crew.length).toBe(state.mystery!.crew.length);
    expect(loaded.mystery!.deductions.length).toBe(state.mystery!.deductions.length);
  });

  it("save and load preserves milestones Set", () => {
    const state = generate(42, Difficulty.Normal);
    state.milestones = new Set(["hint_first_read", "hint_deduction_ready"]);
    saveGame(state);
    const loaded = loadGame()!;

    expect(loaded.milestones).toBeInstanceOf(Set);
    expect(loaded.milestones.has("hint_first_read")).toBe(true);
    expect(loaded.milestones.has("hint_deduction_ready")).toBe(true);
  });

  it("save and load preserves discoveredEvidence Set", () => {
    const state = generate(42, Difficulty.Normal);
    if (state.mystery) {
      state.mystery.discoveredEvidence = new Set(["ev1", "ev2"]);
    }
    saveGame(state);
    const loaded = loadGame()!;

    if (loaded.mystery) {
      expect(loaded.mystery.discoveredEvidence).toBeInstanceOf(Set);
      expect(loaded.mystery.discoveredEvidence.has("ev1")).toBe(true);
      expect(loaded.mystery.discoveredEvidence.has("ev2")).toBe(true);
    }
  });

  it("load returns null when no save exists", () => {
    expect(loadGame()).toBeNull();
    expect(hasSave()).toBe(false);
  });

  it("load returns null for corrupt JSON", () => {
    localStorageMock.setItem("ssr_save_v8", "not valid json");
    expect(loadGame()).toBeNull();
    // Corrupt save should be deleted
    expect(hasSave()).toBe(false);
  });

  it("load returns null for wrong version", () => {
    localStorageMock.setItem("ssr_save_v8", JSON.stringify({ _version: 99, state: {} }));
    expect(loadGame()).toBeNull();
    expect(hasSave()).toBe(false);
  });

  it("load returns null for missing critical fields", () => {
    // Valid JSON and version but missing required fields
    localStorageMock.setItem("ssr_save_v8", JSON.stringify({
      _version: 1,
      state: { seed: 1, turn: 0 }, // missing width, height, player, entities, tiles, rooms
    }));
    expect(loadGame()).toBeNull();
  });

  it("deleteSave removes the save", () => {
    const state = generate(42, Difficulty.Normal);
    saveGame(state);
    expect(hasSave()).toBe(true);
    deleteSave();
    expect(hasSave()).toBe(false);
  });

  it("save after playing preserves advanced state", () => {
    let state = generate(42, Difficulty.Normal);
    // Play a few turns
    state = step(state, { type: ActionType.Move, direction: "south" as any });
    state = step(state, { type: ActionType.Move, direction: "east" as any });
    state = step(state, { type: ActionType.Scan });

    saveGame(state);
    const loaded = loadGame()!;

    expect(loaded.turn).toBe(3);
    expect(loaded.player.entity.pos).toEqual(state.player.entity.pos);
  });

  it("ensureMysteryDefaults fills missing arrays", () => {
    const state = generate(42, Difficulty.Normal);
    saveGame(state);
    // Tamper with the save to remove mystery fields
    const raw = localStorageMock.getItem("ssr_save_v8")!;
    const data = JSON.parse(raw);
    // Remove some mystery arrays from the serialized state
    const stateObj = data.state;
    if (stateObj.mystery) {
      delete stateObj.mystery.roomScenes;
      delete stateObj.mystery.dossiers;
      delete stateObj.mystery.connections;
    }
    localStorageMock.setItem("ssr_save_v8", JSON.stringify(data));

    const loaded = loadGame()!;
    expect(loaded.mystery).toBeDefined();
    // ensureMysteryDefaults should fill these in
    expect(Array.isArray(loaded.mystery!.roomScenes)).toBe(true);
    expect(Array.isArray(loaded.mystery!.dossiers)).toBe(true);
    expect(Array.isArray(loaded.mystery!.connections)).toBe(true);
  });
});
