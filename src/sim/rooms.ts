/**
 * Room utility functions — shared by actions.ts, step.ts, and others.
 */
import type { GameState, Room, Position } from "../shared/types.js";

/**
 * Find the room containing a given position. Returns null if in a corridor.
 */
export function getRoomAt(state: GameState, pos: Position): Room | null {
  for (const room of state.rooms) {
    if (
      pos.x >= room.x && pos.x < room.x + room.width &&
      pos.y >= room.y && pos.y < room.y + room.height
    ) {
      return room;
    }
  }
  return null;
}

/**
 * Find the room containing a given position, with its index.
 */
export function getRoomWithIndex(state: GameState, pos: Position): { room: Room; index: number } | null {
  for (let i = 0; i < state.rooms.length; i++) {
    const room = state.rooms[i];
    if (
      pos.x >= room.x && pos.x < room.x + room.width &&
      pos.y >= room.y && pos.y < room.y + room.height
    ) {
      return { room, index: i };
    }
  }
  return null;
}

/**
 * Compute average cleanliness percentage for a room by name.
 * Cleanliness = 100 - avgDirt. Returns 100 if room not found.
 */
export function getRoomCleanliness(state: GameState, roomName: string): number {
  const room = state.rooms.find(r => r.name === roomName);
  if (!room) return 100;

  let totalDirt = 0;
  let tileCount = 0;
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      if (x >= 0 && x < state.width && y >= 0 && y < state.height) {
        const tile = state.tiles[y][x];
        if (tile.walkable) {
          totalDirt += tile.dirt;
          tileCount++;
        }
      }
    }
  }
  if (tileCount === 0) return 100;
  const avgDirt = totalDirt / tileCount;
  return Math.round(100 - avgDirt);
}

/**
 * Compute average cleanliness percentage for a room by index.
 */
export function getRoomCleanlinessByIndex(state: GameState, roomIndex: number): number {
  if (roomIndex < 0 || roomIndex >= state.rooms.length) return 100;
  return getRoomCleanliness(state, state.rooms[roomIndex].name);
}
