import { describe, it, expect } from "vitest";
import { generate } from "../src/sim/procgen.js";
import { step } from "../src/sim/step.js";
import { GOLDEN_SEED, DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT } from "../src/shared/constants.js";
import { ActionType, Direction, TileType, AttachmentSlot, SensorType, EntityType } from "../src/shared/types.js";
import type { Action, GameState, Attachment } from "../src/shared/types.js";

const move = (d: Direction): Action => ({ type: ActionType.Move, direction: d });
const interact = (id?: string): Action => ({ type: ActionType.Interact, targetId: id });
const wait = (): Action => ({ type: ActionType.Wait });

const thermalSensor: Attachment = {
  slot: AttachmentSlot.Sensor,
  name: "thermal sensor",
  sensorType: SensorType.Thermal,
};

function equipThermal(state: GameState): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      attachments: { ...state.player.attachments, [AttachmentSlot.Sensor]: thermalSensor },
    },
  };
}

function applyActions(state: GameState, actions: Action[]): GameState {
  for (const action of actions) {
    state = step(state, action);
  }
  return state;
}

describe("Golden seed walkthrough (expanded station)", () => {
  const initialState = generate(GOLDEN_SEED);

  it("produces correct map dimensions", () => {
    expect(initialState.width).toBe(DEFAULT_MAP_WIDTH);
    expect(initialState.height).toBe(DEFAULT_MAP_HEIGHT);
  });

  it("produces at least 10 rooms", () => {
    expect(initialState.rooms.length).toBeGreaterThanOrEqual(10);
  });

  it("places all MVP entities including 3 relays", () => {
    expect(initialState.entities.has("sensor_thermal")).toBe(true);
    expect(initialState.entities.has("relay_p01")).toBe(true);
    expect(initialState.entities.has("relay_p03")).toBe(true);
    expect(initialState.entities.has("relay_p04")).toBe(true);
    expect(initialState.entities.has("data_core")).toBe(true);
    expect(initialState.entities.has("service_bot")).toBe(true);
    expect(initialState.entities.has("log_terminal_0")).toBe(true);

    let hasLockedDoor = false;
    for (let y = 0; y < initialState.height; y++) {
      for (let x = 0; x < initialState.width; x++) {
        if (initialState.tiles[y][x].type === TileType.LockedDoor) hasLockedDoor = true;
      }
    }
    expect(hasLockedDoor).toBe(true);
  });

  it("has heat on relay tiles at start", () => {
    for (const relayId of ["relay_p01", "relay_p03", "relay_p04"]) {
      const relay = initialState.entities.get(relayId)!;
      expect(initialState.tiles[relay.pos.y][relay.pos.x].heat).toBeGreaterThan(0);
    }
  });

  it("locked door is not walkable", () => {
    let found = false;
    for (let y = 0; y < initialState.height; y++) {
      for (let x = 0; x < initialState.width; x++) {
        if (initialState.tiles[y][x].type === TileType.LockedDoor) {
          expect(initialState.tiles[y][x].walkable).toBe(false);
          found = true;
        }
      }
    }
    expect(found).toBe(true);
  });

  it("sensor pickup grants thermal sensor on interact", () => {
    const sensor = initialState.entities.get("sensor_thermal")!;
    let state = { ...initialState };
    state.player = {
      ...state.player,
      entity: { ...state.player.entity, pos: { ...sensor.pos } },
    };
    state = step(state, interact("sensor_thermal"));
    expect(state.player.attachments[AttachmentSlot.Sensor]?.sensorType).toBe(SensorType.Thermal);
    expect(state.entities.has("sensor_thermal")).toBe(false);
  });

  it("single relay activation does NOT unlock doors", () => {
    const relay = initialState.entities.get("relay_p01")!;
    let state = equipThermal({ ...initialState });
    state.player = {
      ...state.player,
      entity: { ...state.player.entity, pos: { ...relay.pos } },
    };
    state = step(state, interact("relay_p01"));

    // Door should still be locked
    let hasLockedDoor = false;
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        if (state.tiles[y][x].type === TileType.LockedDoor) hasLockedDoor = true;
      }
    }
    expect(hasLockedDoor).toBe(true);
  });

  it("all 3 relays activated unlocks doors", () => {
    let state = equipThermal({ ...initialState });

    for (const relayId of ["relay_p01", "relay_p03", "relay_p04"]) {
      const relay = state.entities.get(relayId)!;
      state.player = {
        ...state.player,
        entity: { ...state.player.entity, pos: { ...relay.pos } },
      };
      state = step(state, interact(relayId));
    }

    // No locked doors should remain
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        expect(state.tiles[y][x].type).not.toBe(TileType.LockedDoor);
      }
    }
  });

  it("data core interaction triggers victory", () => {
    let state = equipThermal({ ...initialState });

    // Activate all relays
    for (const relayId of ["relay_p01", "relay_p03", "relay_p04"]) {
      const relay = state.entities.get(relayId)!;
      state.player = {
        ...state.player,
        entity: { ...state.player.entity, pos: { ...relay.pos } },
      };
      state = step(state, interact(relayId));
    }

    // Transmit at data core
    const dataCore = state.entities.get("data_core")!;
    state.player = {
      ...state.player,
      entity: { ...state.player.entity, pos: { ...dataCore.pos } },
    };
    state = step(state, interact("data_core"));

    expect(state.victory).toBe(true);
    expect(state.gameOver).toBe(true);
  });

  it("heat accumulates on relay tiles over time", () => {
    const relay = initialState.entities.get("relay_p03")!;
    const rx = relay.pos.x;
    const ry = relay.pos.y;
    const initialHeat = initialState.tiles[ry][rx].heat;

    const waits = Array.from({ length: 10 }, () => wait());
    let state = applyActions(initialState, waits);

    // Relay tile (persistent heat source) should have more heat than it started with
    expect(state.tiles[ry][rx].heat).toBeGreaterThan(initialHeat);
  });

  it("log terminals contain authored content", () => {
    const logTerminal = initialState.entities.get("log_terminal_0")!;
    const text = logTerminal.props["text"] as string;
    expect(text.length).toBeGreaterThan(10);
  });
});
