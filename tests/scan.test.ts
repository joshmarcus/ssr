import { describe, it, expect } from "vitest";
import { step } from "../src/sim/step.js";
import { createEmptyState } from "../src/sim/state.js";
import { ActionType, EntityType, TileType, AttachmentSlot, SensorType } from "../src/shared/types.js";
import type { Entity, Attachment } from "../src/shared/types.js";

function makeTestState() {
  const state = createEmptyState(1, 10, 10);
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
        radiation: 0,
        stress: 0,
        stressTurns: 0,
        explored: true,
        visible: true,
      };
    }
  }
  state.player.entity.pos = { x: 5, y: 5 };
  return state;
}

describe("Scan action", () => {
  it("does nothing without thermal sensor", () => {
    const state = makeTestState();
    const relay: Entity = {
      id: "relay_1",
      type: EntityType.Relay,
      pos: { x: 3, y: 3 },
      props: { overheating: true },
    };
    state.entities.set(relay.id, relay);

    const next = step(state, { type: ActionType.Scan });

    // Without thermal sensor, relay should not be marked as scanned
    const updatedRelay = next.entities.get("relay_1")!;
    expect(updatedRelay.props["scannedHotspot"]).toBeUndefined();
  });

  it("reveals hotspot with thermal sensor equipped", () => {
    const state = makeTestState();
    // Equip thermal sensor
    const thermalSensor: Attachment = {
      slot: AttachmentSlot.Sensor,
      name: "thermal sensor",
      sensorType: SensorType.Thermal,
    };
    state.player.attachments = { [AttachmentSlot.Sensor]: thermalSensor };

    const relay: Entity = {
      id: "relay_1",
      type: EntityType.Relay,
      pos: { x: 3, y: 3 },
      props: { overheating: true },
    };
    state.entities.set(relay.id, relay);

    const next = step(state, { type: ActionType.Scan });

    const updatedRelay = next.entities.get("relay_1")!;
    expect(updatedRelay.props["scannedHotspot"]).toBe(true);
    expect(next.logs.some((l) => l.source === "sensor")).toBe(true);
  });

  it("does not mark non-overheating relays", () => {
    const state = makeTestState();
    const thermalSensor: Attachment = {
      slot: AttachmentSlot.Sensor,
      name: "thermal sensor",
      sensorType: SensorType.Thermal,
    };
    state.player.attachments = { [AttachmentSlot.Sensor]: thermalSensor };

    const relay: Entity = {
      id: "relay_1",
      type: EntityType.Relay,
      pos: { x: 3, y: 3 },
      props: { overheating: false },
    };
    state.entities.set(relay.id, relay);

    const next = step(state, { type: ActionType.Scan });

    const updatedRelay = next.entities.get("relay_1")!;
    expect(updatedRelay.props["scannedHotspot"]).toBeUndefined();
  });
});
