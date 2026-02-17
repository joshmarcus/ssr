import type { GameState } from "../shared/types.js";
import { AttachmentSlot, SensorType, EntityType } from "../shared/types.js";
import {
  VISION_RADIUS_BASE,
  VISION_RADIUS_THERMAL,
  VISION_RADIUS_ATMOSPHERIC,
  VISION_RADIUS_RADIATION,
  VISION_RADIUS_STRUCTURAL,
  VISION_RADIUS_EM,
  HEAT_VISIBLE_THRESHOLD,
  PRESSURE_VISIBLE_THRESHOLD,
  RADIATION_DAMAGE_THRESHOLD,
  STRESS_COLLAPSE_THRESHOLD,
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
 * Recalculate vision for the current turn.
 *
 * Rules:
 * 1. All tiles set visible: false
 * 2. If player is in a room, reveal entire room + door tiles
 * 3. Corridor vision: Manhattan distance <= VISION_RADIUS_BASE from player
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

  // 2. Corridor vision: always reveal tiles within base radius (Manhattan distance)
  for (let dy = -VISION_RADIUS_BASE; dy <= VISION_RADIUS_BASE; dy++) {
    for (let dx = -VISION_RADIUS_BASE; dx <= VISION_RADIUS_BASE; dx++) {
      if (Math.abs(dx) + Math.abs(dy) <= VISION_RADIUS_BASE) {
        reveal(px + dx, py + dy);
      }
    }
  }

  // 3. Sensor-based extended vision (through walls)
  const sensor = state.player.attachments[AttachmentSlot.Sensor];

  // Thermal radar: reveal tiles with significant heat within extended radius
  if (sensor?.sensorType === SensorType.Thermal) {
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
  if (sensor?.sensorType === SensorType.Atmospheric) {
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

  // Radiation sensor: reveal tiles with radiation and RadiationSource/ShieldGenerator entities
  if (sensor?.sensorType === SensorType.Radiation) {
    for (let dy = -VISION_RADIUS_RADIATION; dy <= VISION_RADIUS_RADIATION; dy++) {
      for (let dx = -VISION_RADIUS_RADIATION; dx <= VISION_RADIUS_RADIATION; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > VISION_RADIUS_RADIATION) continue;
        const tx = px + dx;
        const ty = py + dy;
        if (tx >= 0 && tx < w && ty >= 0 && ty < h) {
          // Reveal tiles with significant radiation (penetrates walls)
          if (state.tiles[ty][tx].radiation > 0) {
            reveal(tx, ty);
          }
        }
      }
    }
    // Reveal RadiationSource and ShieldGenerator entities within radius
    for (const [, entity] of state.entities) {
      if (entity.type === EntityType.RadiationSource || entity.type === EntityType.ShieldGenerator) {
        const dist = Math.abs(entity.pos.x - px) + Math.abs(entity.pos.y - py);
        if (dist <= VISION_RADIUS_RADIATION) {
          reveal(entity.pos.x, entity.pos.y);
        }
      }
    }
  }

  // Structural sensor: reveal tiles with stress and ReinforcementPanel entities
  if (sensor?.sensorType === SensorType.Structural) {
    for (let dy = -VISION_RADIUS_STRUCTURAL; dy <= VISION_RADIUS_STRUCTURAL; dy++) {
      for (let dx = -VISION_RADIUS_STRUCTURAL; dx <= VISION_RADIUS_STRUCTURAL; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > VISION_RADIUS_STRUCTURAL) continue;
        const tx = px + dx;
        const ty = py + dy;
        if (tx >= 0 && tx < w && ty >= 0 && ty < h) {
          if (state.tiles[ty][tx].stress > 0) {
            reveal(tx, ty);
          }
        }
      }
    }
    // Reveal ReinforcementPanel entities within radius
    for (const [, entity] of state.entities) {
      if (entity.type === EntityType.ReinforcementPanel) {
        const dist = Math.abs(entity.pos.x - px) + Math.abs(entity.pos.y - py);
        if (dist <= VISION_RADIUS_STRUCTURAL) {
          reveal(entity.pos.x, entity.pos.y);
        }
      }
    }
  }

  // EM/Signal sensor: reveal HiddenDevice and SignalBooster entities
  if (sensor?.sensorType === SensorType.EMSignal) {
    for (const [, entity] of state.entities) {
      if (entity.type === EntityType.HiddenDevice || entity.type === EntityType.SignalBooster) {
        const dist = Math.abs(entity.pos.x - px) + Math.abs(entity.pos.y - py);
        if (dist <= VISION_RADIUS_EM) {
          reveal(entity.pos.x, entity.pos.y);
        }
      }
    }
  }

  return { ...state, tiles };
}
