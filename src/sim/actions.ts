import type { Action, GameState, Direction, Position } from "../shared/types.js";
import { ActionType } from "../shared/types.js";

const DIRECTION_DELTAS: Record<Direction, Position> = {
  north: { x: 0, y: -1 },
  south: { x: 0, y: 1 },
  east: { x: 1, y: 0 },
  west: { x: -1, y: 0 },
};

export function isValidAction(state: GameState, action: Action): boolean {
  if (state.gameOver) return false;

  if (action.type === ActionType.Move && action.direction) {
    const delta = DIRECTION_DELTAS[action.direction];
    const nx = state.player.entity.pos.x + delta.x;
    const ny = state.player.entity.pos.y + delta.y;
    if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) return false;
    return state.tiles[ny][nx].walkable;
  }

  return true;
}

export function getDirectionDelta(dir: Direction): Position {
  return DIRECTION_DELTAS[dir];
}
