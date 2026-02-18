import * as ROT from "rot-js";
import type { GameState } from "../shared/types.js";
import { SensorType, TileType, EntityType } from "../shared/types.js";
import {
  VISION_RADIUS_BASE,
  VISION_RADIUS_THERMAL,
  VISION_RADIUS_ATMOSPHERIC,
  HEAT_VISIBLE_THRESHOLD,
  PRESSURE_VISIBLE_THRESHOLD,
} from "../shared/constants.js";

/**
 * Find the room index the player is currently in, or -1 if in a corridor.
 */
function getPlayerRoomIndex(state: GameState): number {
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;
  for (let i = 0; i < state.rooms.length; i++) {
    const r = state.rooms[i];
    if (px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height) {
      return i;
    }
  }
  return -1;
}

/**
 * Get positions of entities that block line of sight (closed doors, sealed airlocks).
 */
function getBlockingEntityPositions(state: GameState): Set<string> {
  const blocking = new Set<string>();
  for (const [, entity] of state.entities) {
    if (entity.type === EntityType.ClosedDoor && entity.props["open"] !== true) {
      blocking.add(`${entity.pos.x},${entity.pos.y}`);
    }
    if (entity.type === EntityType.Airlock && entity.props["open"] !== true) {
      blocking.add(`${entity.pos.x},${entity.pos.y}`);
    }
  }
  return blocking;
}

/**
 * Create a callback for ROT.FOV that returns true if light passes through (x, y).
 * Walls and locked doors always block. Closed door/airlock entities block.
 * Floor, corridor, and open doors are transparent.
 */
function makeLightPassesCallback(
  state: GameState,
  blocking: Set<string>,
): (x: number, y: number) => boolean {
  const w = state.width;
  const h = state.height;
  return (x: number, y: number): boolean => {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    const tile = state.tiles[y][x];
    // Walls always block light
    if (tile.type === TileType.Wall) return false;
    // Locked doors block light
    if (tile.type === TileType.LockedDoor) return false;
    // Check entity-based blocking (closed doors, sealed airlocks)
    if (blocking.has(`${x},${y}`)) return false;
    return true;
  };
}

/**
 * Recalculate vision for the current turn.
 *
 * Rules:
 * 1. All tiles set visible: false
 * 2. If player is in a room, reveal entire room + door tiles
 * 3. FOV vision: PreciseShadowcasting within VISION_RADIUS_BASE (walls/doors block)
 * 4. Thermal radar: tiles with heat >= threshold within VISION_RADIUS_THERMAL (through walls)
 * 5. Atmospheric radar: tiles with pressure < threshold within VISION_RADIUS_ATMOSPHERIC (through walls)
 * 6. Any tile set visible also becomes explored (permanent)
 *
 * Deterministic, no RNG.
 */
export function updateVision(state: GameState): GameState {
  const tiles = state.tiles.map(row => row.map(t => ({ ...t, visible: false })));
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;
  const w = state.width;
  const h = state.height;

  // Helper: mark a tile visible + explored
  function reveal(x: number, y: number): void {
    if (x >= 0 && x < w && y >= 0 && y < h) {
      tiles[y][x].visible = true;
      tiles[y][x].explored = true;
    }
  }

  // 1. Room reveal: if player is in a room, reveal entire room bounds
  const roomIdx = getPlayerRoomIndex({ ...state, tiles });
  if (roomIdx >= 0) {
    const room = state.rooms[roomIdx];
    for (let ry = room.y; ry < room.y + room.height; ry++) {
      for (let rx = room.x; rx < room.x + room.width; rx++) {
        reveal(rx, ry);
      }
    }
    // Also reveal tiles immediately around the room (walls + doors)
    for (let ry = room.y - 1; ry <= room.y + room.height; ry++) {
      for (let rx = room.x - 1; rx <= room.x + room.width; rx++) {
        reveal(rx, ry);
      }
    }
  }

  // 2. FOV-based corridor/general vision: PreciseShadowcasting with wall/door blocking
  const blocking = getBlockingEntityPositions(state);
  const lightPasses = makeLightPassesCallback(state, blocking);
  const fov = new ROT.FOV.PreciseShadowcasting(lightPasses, { topology: 8 });
  fov.compute(px, py, VISION_RADIUS_BASE, (x: number, y: number, _r: number, _vis: number) => {
    reveal(x, y);
  });

  // 3. Sensor-based extended vision (through walls) — all collected sensors apply
  const sensors = state.player.sensors ?? [];

  // Thermal radar: reveal tiles with significant heat within extended radius
  if (sensors.includes(SensorType.Thermal)) {
    for (let dy = -VISION_RADIUS_THERMAL; dy <= VISION_RADIUS_THERMAL; dy++) {
      for (let dx = -VISION_RADIUS_THERMAL; dx <= VISION_RADIUS_THERMAL; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > VISION_RADIUS_THERMAL) continue;
        const tx = px + dx;
        const ty = py + dy;
        if (tx >= 0 && tx < w && ty >= 0 && ty < h) {
          if (state.tiles[ty][tx].heat >= HEAT_VISIBLE_THRESHOLD) {
            reveal(tx, ty);
          }
        }
      }
    }
  }

  // Atmospheric radar: reveal tiles with low pressure within extended radius
  if (sensors.includes(SensorType.Atmospheric)) {
    for (let dy = -VISION_RADIUS_ATMOSPHERIC; dy <= VISION_RADIUS_ATMOSPHERIC; dy++) {
      for (let dx = -VISION_RADIUS_ATMOSPHERIC; dx <= VISION_RADIUS_ATMOSPHERIC; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > VISION_RADIUS_ATMOSPHERIC) continue;
        const tx = px + dx;
        const ty = py + dy;
        if (tx >= 0 && tx < w && ty >= 0 && ty < h) {
          if (state.tiles[ty][tx].pressure < PRESSURE_VISIBLE_THRESHOLD) {
            reveal(tx, ty);
          }
        }
      }
    }
  }

  return { ...state, tiles };
}
