import type { Action, GameState } from "../shared/types.js";
import { ActionType } from "../shared/types.js";
import { isValidAction, getDirectionDelta } from "./actions.js";

/**
 * Pure function: apply one action to produce the next game state.
 * Returns a new state (immutable style for replay determinism).
 */
export function step(state: GameState, action: Action): GameState {
  if (!isValidAction(state, action)) return state;

  // Shallow-clone top-level (deep clone tiles only when mutating)
  const next: GameState = { ...state, turn: state.turn + 1 };

  switch (action.type) {
    case ActionType.Move: {
      if (!action.direction) break;
      const delta = getDirectionDelta(action.direction);
      const newPos = {
        x: state.player.entity.pos.x + delta.x,
        y: state.player.entity.pos.y + delta.y,
      };
      next.player = {
        ...state.player,
        entity: { ...state.player.entity, pos: newPos },
      };
      break;
    }
    case ActionType.Wait:
      break;
    // Interact, Scan, Clean — stubs for now
    default:
      break;
  }

  // TODO: hazard tick (heat/smoke spread)
  // TODO: win/loss check

  return next;
}
