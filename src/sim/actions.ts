import type { Action, GameState, Direction, Position } from "../shared/types.js";
import { ActionType, EntityType, TileType } from "../shared/types.js";
import { getRoomCleanliness, getRoomAt } from "./rooms.js";

const DIRECTION_DELTAS: Record<Direction, Position> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
  northeast: { x: 1, y: -1 },
  northwest: { x: -1, y: -1 },
  southeast: { x: 1, y: 1 },
  southwest: { x: -1, y: 1 },
};

export function isValidAction(state: GameState, action: Action): boolean {
  if (state.gameOver) return false;

  if (action.type === ActionType.Move && action.direction) {
    const delta = DIRECTION_DELTAS[action.direction];
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;
    const nx = px + delta.x;
    const ny = py + delta.y;
    if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) return false;
    if (!state.tiles[ny][nx].walkable) {
      // Allow bumping into unlocked closed doors (auto-open)
      // Also allow bumping through auto-sealed bulkheads (LockedDoor tiles with no entity)
      if (!hasUnlockedDoorAt(state, nx, ny) && !isAutoSealedBulkhead(state, nx, ny)) return false;
    }
    // Diagonal: prevent corner-cutting through walls
    if (delta.x !== 0 && delta.y !== 0) {
      if (!state.tiles[py][nx].walkable || !state.tiles[ny][px].walkable) return false;
    }

    // Cleaning directive: can't leave a dirty room until clean enough (expires at turn 75)
    if (state.mystery?.cleaningDirective && state.turn < 75) {
      const currentRoom = getRoomAt(state, { x: px, y: py });
      if (currentRoom) {
        const destRoom = getRoomAt(state, { x: nx, y: ny });
        // Only block if moving OUT of the current room (into corridor or different room)
        if (!destRoom || destRoom.id !== currentRoom.id) {
          const cleanliness = getRoomCleanliness(state, currentRoom.name);
          const goal = state.mystery.roomCleanlinessGoal;
          if (cleanliness < goal) {
            return false;
          }
        }
      }
    }

    return true;
  }

  return true;
}

/**
 * Check if there's an unlocked closed door at the given position.
 * Used for auto-open-on-bump: player can walk into a closed door
 * that isn't locked to automatically open it.
 */
export function hasUnlockedDoorAt(state: GameState, x: number, y: number): boolean {
  for (const [, entity] of state.entities) {
    if (
      entity.type === EntityType.ClosedDoor &&
      entity.pos.x === x &&
      entity.pos.y === y &&
      entity.props["closed"] === true &&
      entity.props["locked"] !== true
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a tile is an auto-sealed bulkhead (LockedDoor with no entity).
 * These were regular door tiles sealed by pressure loss and can be forced open.
 */
export function isAutoSealedBulkhead(state: GameState, x: number, y: number): boolean {
  if (state.tiles[y][x].type !== TileType.LockedDoor) return false;
  // If any entity occupies this tile, it's a procgen-placed locked door
  for (const [, entity] of state.entities) {
    if (entity.pos.x === x && entity.pos.y === y) return false;
  }
  return true;
}

export function getDirectionDelta(dir: Direction): Position {
  return DIRECTION_DELTAS[dir];
}
