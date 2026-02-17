import type { Action, GameState, Direction, Position } from "../shared/types.js";
import { ActionType } from "../shared/types.js";

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
    if (!state.tiles[ny][nx].walkable) return false;
    // Diagonal: prevent corner-cutting through walls
    if (delta.x !== 0 && delta.y !== 0) {
      if (!state.tiles[py][nx].walkable || !state.tiles[ny][px].walkable) return false;
    }
    return true;
  }

  return true;
}

export function getDirectionDelta(dir: Direction): Position {
  return DIRECTION_DELTAS[dir];
}
