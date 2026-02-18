import { describe, it, expect } from "vitest";
import { step } from "../src/sim/step.js";
import { createEmptyState } from "../src/sim/state.js";
import { ActionType, EntityType, TileType, AttachmentSlot, SensorType } from "../src/shared/types.js";
import { GLYPHS } from "../src/shared/constants.js";
import type { Entity } from "../src/shared/types.js";

function makeTestState() {
  const state = createEmptyState(1, 10, 10);
  // Make a small floor area
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 10; x++) {
      state.tiles[y][x] = {
        type: TileType.Floor,
        glyph: ".",
        walkable: true,
        heat: 0,
        smoke: 0,
        dirt: 0,
        pressure: 100,
        explored: true,
        visible: true,
      };
    }
  }
  state.player.entity.pos = { x: 5, y: 5 };
  state.rooms.push({
    id: "room_0",
    name: "Test Room",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
  });
  return state;
}

describe("Interact action", () => {
  it("picks up sensor and equips thermal", () => {
    const state = makeTestState();
    const sensor: Entity = {
      id: "sensor_t",
      type: EntityType.SensorPickup,
      pos: { x: 5, y: 5 }, // same tile as player
      props: { sensorType: SensorType.Thermal },
    };
    state.entities.set(sensor.id, sensor);

    const next = step(state, { type: ActionType.Interact, targetId: "sensor_t" });

    expect(next.player.sensors).toContain(SensorType.Thermal);
    expect(next.entities.has("sensor_t")).toBe(false); // removed after pickup
    expect(next.logs.length).toBeGreaterThan(0);
  });

  it("interacts with adjacent entity", () => {
    const state = makeTestState();
    const sensor: Entity = {
      id: "sensor_t",
      type: EntityType.SensorPickup,
      pos: { x: 6, y: 5 }, // one tile east of player
      props: { sensorType: SensorType.Thermal },
    };
    state.entities.set(sensor.id, sensor);

    const next = step(state, { type: ActionType.Interact, targetId: "sensor_t" });

    expect(next.player.sensors).toContain(SensorType.Thermal);
  });

  it("does not interact with distant entity", () => {
    const state = makeTestState();
    const sensor: Entity = {
      id: "sensor_t",
      type: EntityType.SensorPickup,
      pos: { x: 8, y: 8 }, // far from player
      props: { sensorType: SensorType.Thermal },
    };
    state.entities.set(sensor.id, sensor);

    const next = step(state, { type: ActionType.Interact, targetId: "sensor_t" });

    // Player still has starting cleanliness sensor (distant thermal sensor not picked up)
    expect(next.player.sensors).not.toContain(SensorType.Thermal);
    expect(next.entities.has("sensor_t")).toBe(true); // still there
  });

  it("activates relay and powers locked door", () => {
    const state = makeTestState();
    // Equip thermal sensor (required to interact with overheating relays)
    state.player.sensors = [...state.player.sensors, SensorType.Thermal];
    state.player.attachments[AttachmentSlot.Sensor] = {
      slot: AttachmentSlot.Sensor,
      name: "thermal sensor",
      sensorType: SensorType.Thermal,
    };
    // Place relay adjacent to player
    const relay: Entity = {
      id: "relay_1",
      type: EntityType.Relay,
      pos: { x: 5, y: 4 },
      props: { overheating: true, activated: false, powered: false },
    };
    state.entities.set(relay.id, relay);

    // Place locked door entity
    const lockedDoor: Entity = {
      id: "locked_door_1",
      type: EntityType.Relay,
      pos: { x: 3, y: 3 },
      props: { powered: false, locked: true },
    };
    state.entities.set(lockedDoor.id, lockedDoor);

    // Place locked door tile
    state.tiles[3][3] = {
      type: TileType.LockedDoor,
      glyph: GLYPHS.lockedDoor,
      walkable: false,
      heat: 0,
      smoke: 0,
      dirt: 0,
      pressure: 100,
      explored: true,
      visible: true,
    };

    const next = step(state, { type: ActionType.Interact, targetId: "relay_1" });

    const updatedRelay = next.entities.get("relay_1")!;
    expect(updatedRelay.props["overheating"]).toBe(false);
    expect(updatedRelay.props["activated"]).toBe(true);

    // Locked door should now be powered
    const updatedDoor = next.entities.get("locked_door_1")!;
    expect(updatedDoor.props["powered"]).toBe(true);

    // Tile should be unlocked (Door, not LockedDoor)
    expect(next.tiles[3][3].type).toBe(TileType.Door);
    expect(next.tiles[3][3].walkable).toBe(true);
  });

  it("transmits data core for victory", () => {
    const state = makeTestState();
    const dataCore: Entity = {
      id: "data_core",
      type: EntityType.DataCore,
      pos: { x: 5, y: 5 },
      props: { transmitted: false },
    };
    state.entities.set(dataCore.id, dataCore);

    const next = step(state, { type: ActionType.Interact, targetId: "data_core" });

    expect(next.victory).toBe(true);
    expect(next.gameOver).toBe(true);
  });

  it("reads log terminal and adds entry", () => {
    const state = makeTestState();
    const terminal: Entity = {
      id: "log_term_1",
      type: EntityType.LogTerminal,
      pos: { x: 5, y: 5 },
      props: { text: "Test log entry", source: "test" },
    };
    state.entities.set(terminal.id, terminal);

    const next = step(state, { type: ActionType.Interact, targetId: "log_term_1" });

    expect(next.logs.some((l) => l.text === "Test log entry")).toBe(true);
  });

  it("activates service bot", () => {
    const state = makeTestState();
    const bot: Entity = {
      id: "svc_bot",
      type: EntityType.ServiceBot,
      pos: { x: 5, y: 5 },
      props: { active: false },
    };
    state.entities.set(bot.id, bot);

    const next = step(state, { type: ActionType.Interact, targetId: "svc_bot" });

    const updated = next.entities.get("svc_bot")!;
    expect(updated.props["active"]).toBe(true);
  });
});
