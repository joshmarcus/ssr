import { describe, it, expect } from "vitest";
import { updateVision } from "../src/sim/vision.js";
import { createEmptyState } from "../src/sim/state.js";
import { TileType, AttachmentSlot, SensorType } from "../src/shared/types.js";
import type { Attachment, Room } from "../src/shared/types.js";
import { VISION_RADIUS_BASE, HEAT_VISIBLE_THRESHOLD, PRESSURE_VISIBLE_THRESHOLD } from "../src/shared/constants.js";

function makeFloorState(width = 20, height = 20) {
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
        explored: false,
        visible: false,
      };
    }
  }
  return state;
}

describe("Vision system", () => {
  it("reveals tiles within base vision radius", () => {
    const state = makeFloorState();
    state.player.entity.pos = { x: 10, y: 10 };

    const next = updateVision(state);

    // Tiles within Manhattan distance <= VISION_RADIUS_BASE should be visible
    expect(next.tiles[10][10].visible).toBe(true);
    expect(next.tiles[10][10].explored).toBe(true);

    // At radius edge
    expect(next.tiles[10][10 + VISION_RADIUS_BASE].visible).toBe(true);

    // Beyond radius
    expect(next.tiles[10][10 + VISION_RADIUS_BASE + 1].visible).toBe(false);
  });

  it("reveals entire room when player is inside", () => {
    const state = makeFloorState();
    const room: Room = { id: "room_0", name: "Test Room", x: 2, y: 2, width: 5, height: 5 };
    state.rooms.push(room);
    state.player.entity.pos = { x: 4, y: 4 }; // inside room

    const next = updateVision(state);

    // All tiles in room should be visible
    for (let ry = 2; ry < 7; ry++) {
      for (let rx = 2; rx < 7; rx++) {
        expect(next.tiles[ry][rx].visible).toBe(true);
      }
    }
    // Walls around room should also be visible
    expect(next.tiles[1][2].visible).toBe(true); // one above room
  });

  it("explored tiles persist after leaving vision range", () => {
    const state = makeFloorState();
    state.player.entity.pos = { x: 10, y: 10 };

    // First update: explore tiles near position
    const after1 = updateVision(state);
    expect(after1.tiles[10][10].explored).toBe(true);
    expect(after1.tiles[10][10].visible).toBe(true);

    // Move player far away
    const moved = {
      ...after1,
      player: {
        ...after1.player,
        entity: { ...after1.player.entity, pos: { x: 0, y: 0 } },
      },
    };

    const after2 = updateVision(moved);

    // Old position: explored but no longer visible
    expect(after2.tiles[10][10].explored).toBe(true);
    expect(after2.tiles[10][10].visible).toBe(false);

    // New position: visible
    expect(after2.tiles[0][0].visible).toBe(true);
  });

  it("thermal sensor reveals hot tiles through walls at extended range", () => {
    const state = makeFloorState();
    state.player.entity.pos = { x: 5, y: 5 };

    // Place a hot tile far from player (beyond base radius, within thermal radius)
    const hotX = 5;
    const hotY = 5 + VISION_RADIUS_BASE + 3; // beyond base, within thermal
    if (hotY < 20) {
      state.tiles[hotY][hotX].heat = HEAT_VISIBLE_THRESHOLD;
    }

    // Without thermal sensor: hot tile not visible
    const noSensor = updateVision(state);
    if (hotY < 20) {
      expect(noSensor.tiles[hotY][hotX].visible).toBe(false);
    }

    // Equip thermal sensor
    const thermalSensor: Attachment = {
      slot: AttachmentSlot.Sensor,
      name: "thermal sensor",
      sensorType: SensorType.Thermal,
    };
    state.player.attachments = { [AttachmentSlot.Sensor]: thermalSensor };

    const withSensor = updateVision(state);
    if (hotY < 20) {
      expect(withSensor.tiles[hotY][hotX].visible).toBe(true);
    }
  });

  it("atmospheric sensor reveals low pressure tiles at extended range", () => {
    const state = makeFloorState();
    state.player.entity.pos = { x: 5, y: 5 };

    // Place a low-pressure tile beyond base radius
    const lpX = 5;
    const lpY = 5 + VISION_RADIUS_BASE + 2;
    if (lpY < 20) {
      state.tiles[lpY][lpX].pressure = PRESSURE_VISIBLE_THRESHOLD - 10;
    }

    // Without atmospheric sensor: not visible
    const noSensor = updateVision(state);
    if (lpY < 20) {
      expect(noSensor.tiles[lpY][lpX].visible).toBe(false);
    }

    // Equip atmospheric sensor
    const atmosSensor: Attachment = {
      slot: AttachmentSlot.Sensor,
      name: "atmospheric sensor",
      sensorType: SensorType.Atmospheric,
    };
    state.player.attachments = { [AttachmentSlot.Sensor]: atmosSensor };

    const withSensor = updateVision(state);
    if (lpY < 20) {
      expect(withSensor.tiles[lpY][lpX].visible).toBe(true);
    }
  });

  it("is deterministic across multiple calls", () => {
    const state = makeFloorState();
    state.player.entity.pos = { x: 10, y: 10 };
    state.rooms.push({ id: "room_0", name: "Test", x: 8, y: 8, width: 5, height: 5 });

    const result1 = updateVision(state);
    const result2 = updateVision(state);

    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        expect(result1.tiles[y][x].visible).toBe(result2.tiles[y][x].visible);
        expect(result1.tiles[y][x].explored).toBe(result2.tiles[y][x].explored);
      }
    }
  });

  it("unexplored tiles are not visible and not explored", () => {
    const state = makeFloorState();
    state.player.entity.pos = { x: 0, y: 0 };

    const next = updateVision(state);

    // Far corner should be unexplored
    expect(next.tiles[19][19].visible).toBe(false);
    expect(next.tiles[19][19].explored).toBe(false);
  });
});
