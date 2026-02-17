import { describe, it, expect } from "vitest";
import { step } from "../src/sim/step.js";
import { createEmptyState } from "../src/sim/state.js";
import { ActionType, Direction, TileType, AttachmentSlot, SensorType } from "../src/shared/types.js";
import type { Attachment } from "../src/shared/types.js";

function makeFloorState(width = 10, height = 10) {
  const state = createEmptyState(1, width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
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
  return state;
}

describe("Edge cases", () => {
  describe("Movement at map boundaries", () => {
    it("rejects move north at top edge (y=0)", () => {
      const state = makeFloorState();
      state.player.entity.pos = { x: 5, y: 0 };

      const next = step(state, { type: ActionType.Move, direction: Direction.North });

      // Action is invalid, state unchanged
      expect(next.turn).toBe(state.turn);
      expect(next.player.entity.pos).toEqual({ x: 5, y: 0 });
    });

    it("rejects move south at bottom edge", () => {
      const state = makeFloorState();
      state.player.entity.pos = { x: 5, y: 9 };

      const next = step(state, { type: ActionType.Move, direction: Direction.South });

      expect(next.turn).toBe(state.turn);
      expect(next.player.entity.pos).toEqual({ x: 5, y: 9 });
    });

    it("rejects move west at left edge (x=0)", () => {
      const state = makeFloorState();
      state.player.entity.pos = { x: 0, y: 5 };

      const next = step(state, { type: ActionType.Move, direction: Direction.West });

      expect(next.turn).toBe(state.turn);
      expect(next.player.entity.pos).toEqual({ x: 0, y: 5 });
    });

    it("rejects move east at right edge", () => {
      const state = makeFloorState();
      state.player.entity.pos = { x: 9, y: 5 };

      const next = step(state, { type: ActionType.Move, direction: Direction.East });

      expect(next.turn).toBe(state.turn);
      expect(next.player.entity.pos).toEqual({ x: 9, y: 5 });
    });

    it("rejects move into a wall tile", () => {
      const state = makeFloorState();
      state.player.entity.pos = { x: 5, y: 5 };
      // Place a wall to the east
      state.tiles[5][6] = {
        type: TileType.Wall,
        glyph: "#",
        walkable: false,
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

      const next = step(state, { type: ActionType.Move, direction: Direction.East });

      expect(next.turn).toBe(state.turn);
      expect(next.player.entity.pos).toEqual({ x: 5, y: 5 });
    });

    it("allows valid movement on floor tile", () => {
      const state = makeFloorState();
      state.player.entity.pos = { x: 5, y: 5 };

      const next = step(state, { type: ActionType.Move, direction: Direction.East });

      expect(next.turn).toBe(state.turn + 1);
      expect(next.player.entity.pos).toEqual({ x: 6, y: 5 });
    });
  });

  describe("Interacting with nothing nearby", () => {
    it("interact with no targetId does nothing", () => {
      const state = makeFloorState();
      state.player.entity.pos = { x: 5, y: 5 };

      const next = step(state, { type: ActionType.Interact });

      // Turn still increments (action is "valid" but does nothing)
      expect(next.turn).toBe(state.turn + 1);
    });

    it("interact with nonexistent entity ID does nothing", () => {
      const state = makeFloorState();
      state.player.entity.pos = { x: 5, y: 5 };

      const next = step(state, { type: ActionType.Interact, targetId: "does_not_exist" });

      expect(next.turn).toBe(state.turn + 1);
      expect(next.logs.length).toBe(0);
    });
  });

  describe("Scanning without thermal sensor", () => {
    it("scan with no sensor equipped produces no scan log", () => {
      const state = makeFloorState();
      state.player.entity.pos = { x: 5, y: 5 };

      const next = step(state, { type: ActionType.Scan });

      // No thermal sensor means no scan log
      expect(next.logs.some((l) => l.source === "sensor")).toBe(false);
    });

    it("scan with cleanliness sensor (wrong type) produces no scan log", () => {
      const state = makeFloorState();
      state.player.entity.pos = { x: 5, y: 5 };
      // Default state already has cleanliness sensor in sensors array

      const next = step(state, { type: ActionType.Scan });

      expect(next.logs.some((l) => l.source === "sensor")).toBe(false);
    });

    it("scan with thermal sensor equipped produces scan log", () => {
      const state = makeFloorState();
      state.player.entity.pos = { x: 5, y: 5 };
      state.player.sensors = [...(state.player.sensors ?? []), SensorType.Thermal];
      const sensor: Attachment = {
        slot: AttachmentSlot.Sensor,
        name: "thermal sensor",
        sensorType: SensorType.Thermal,
      };
      state.player.attachments = { [AttachmentSlot.Sensor]: sensor };

      const next = step(state, { type: ActionType.Scan });

      expect(next.logs.some((l) => l.source === "sensor")).toBe(true);
    });
  });
});
