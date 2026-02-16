import * as ROT from "rot-js";
import type { GameState } from "../shared/types.js";
import { TileType, EntityType } from "../shared/types.js";
import { DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, GOLDEN_SEED, GLYPHS } from "../shared/constants.js";
import { createEmptyState } from "./state.js";

/**
 * Generate a station map from a seed.
 * For seed 184201 (golden seed), produces the canonical test map.
 */
export function generate(seed: number): GameState {
  const state = createEmptyState(seed, DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT);

  // Seed ROT.js global RNG for deterministic map generation
  ROT.RNG.setSeed(seed);

  // Use ROT.js Digger for room generation
  const map = new ROT.Map.Digger(state.width, state.height, { dugPercentage: 0.4 });

  map.create((x, y, wall) => {
    if (!wall) {
      state.tiles[y][x] = {
        type: TileType.Floor,
        glyph: GLYPHS.floor,
        walkable: true,
        heat: 0,
        smoke: 0,
      };
    }
  });

  // Extract rooms
  const rooms = map.getRooms();
  rooms.forEach((room, i) => {
    state.rooms.push({
      id: `room_${i}`,
      name: `Room ${i}`,
      x: room.getLeft(),
      y: room.getTop(),
      width: room.getRight() - room.getLeft() + 1,
      height: room.getBottom() - room.getTop() + 1,
    });

    // Connect rooms with corridors (doors)
    room.getDoors((x, y) => {
      state.tiles[y][x] = {
        type: TileType.Door,
        glyph: GLYPHS.door,
        walkable: true,
        heat: 0,
        smoke: 0,
      };
    });
  });

  // Place player in first room center
  if (rooms.length > 0) {
    const firstRoom = rooms[0];
    const cx = Math.floor((firstRoom.getLeft() + firstRoom.getRight()) / 2);
    const cy = Math.floor((firstRoom.getTop() + firstRoom.getBottom()) / 2);
    state.player.entity.pos = { x: cx, y: cy };
  }

  return state;
}
