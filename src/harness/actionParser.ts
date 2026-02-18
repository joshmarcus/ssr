import type { Action, GameState, Entity } from "../shared/types.js";
import { ActionType, Direction, EntityType } from "../shared/types.js";
import { isValidAction } from "../sim/actions.js";
import type { HarnessAction } from "./types.js";

// ── Direction mapping ────────────────────────────────────────

const DIR_MAP: Record<string, Direction> = {
  N: Direction.North,
  S: Direction.South,
  E: Direction.East,
  W: Direction.West,
  NE: Direction.NorthEast,
  NW: Direction.NorthWest,
  SE: Direction.SouthEast,
  SW: Direction.SouthWest,
};

const DIR_DELTAS: Record<string, { x: number; y: number }> = {
  N:  { x: 0, y: -1 },
  S:  { x: 0, y: 1 },
  E:  { x: 1, y: 0 },
  W:  { x: -1, y: 0 },
  NE: { x: 1, y: -1 },
  NW: { x: -1, y: -1 },
  SE: { x: 1, y: 1 },
  SW: { x: -1, y: 1 },
};

const DIR_LABELS: Record<string, string> = {
  N: "North",
  S: "South",
  E: "East",
  W: "West",
  NE: "NorthEast",
  NW: "NorthWest",
  SE: "SouthEast",
  SW: "SouthWest",
};

// ── Action parsing ───────────────────────────────────────────

/**
 * Parse a JSON string from the agent into an Action or an error.
 *
 * Expected input format:
 *   {"action": "MOVE", "params": {"dir": "N"}}
 *   {"action": "INTERACT", "params": {"target": "relay_01"}}
 *   {"action": "SCAN"}
 *   {"action": "CLEAN"}
 *   {"action": "WAIT"}
 *   {"action": "LOOK"}
 */
export function parseAction(input: string): Action | { error: string } {
  let parsed: HarnessAction;

  // Step 1: parse JSON
  try {
    parsed = JSON.parse(input.trim()) as HarnessAction;
  } catch {
    return { error: `Invalid JSON: ${input.trim()}` };
  }

  if (!parsed.action || typeof parsed.action !== "string") {
    return { error: `Missing or invalid "action" field` };
  }

  const actionStr = parsed.action.toUpperCase();

  // Step 2: map to ActionType
  switch (actionStr) {
    case "MOVE": {
      const dirStr = parsed.params?.dir;
      if (typeof dirStr !== "string") {
        return { error: `MOVE requires params.dir (one of N, S, E, W, NE, NW, SE, SW)` };
      }
      const direction = DIR_MAP[dirStr.toUpperCase()];
      if (!direction) {
        return { error: `Unknown direction "${dirStr}". Use N, S, E, W, NE, NW, SE, SW.` };
      }
      return { type: ActionType.Move, direction };
    }

    case "INTERACT": {
      const targetId = parsed.params?.target;
      if (typeof targetId !== "string") {
        return { error: `INTERACT requires params.target (entity ID string)` };
      }
      return { type: ActionType.Interact, targetId };
    }

    case "SCAN":
      return { type: ActionType.Scan };

    case "CLEAN":
      return { type: ActionType.Clean };

    case "WAIT":
      return { type: ActionType.Wait };

    case "LOOK":
      return { type: ActionType.Look };

    default:
      return { error: `Unknown action "${parsed.action}". Valid: MOVE, INTERACT, SCAN, CLEAN, WAIT, LOOK.` };
  }
}

// ── Valid action enumeration ─────────────────────────────────

/**
 * Non-interactable entity types (not shown as INTERACT targets).
 */
const NON_INTERACTABLE: Set<EntityType> = new Set([
  EntityType.PlayerBot,
  EntityType.Drone,
  EntityType.PatrolDrone,
  EntityType.RepairBot,
]);

/**
 * Entities that are exhausted and no longer offer meaningful interactions.
 */
function isExhausted(entity: Entity, state: GameState): boolean {
  switch (entity.type) {
    case EntityType.Breach:
      return entity.props["sealed"] === true;
    case EntityType.MedKit:
      return entity.props["used"] === true;
    case EntityType.Relay:
      return entity.props["activated"] === true || entity.props["locked"] === true;
    case EntityType.ClosedDoor:
      return entity.props["closed"] === false;
    case EntityType.CrewItem:
      return entity.props["examined"] === true || entity.props["hidden"] === true;
    case EntityType.LogTerminal:
      return state.logs.some(l => l.id === `log_terminal_${entity.id}`);
    case EntityType.PressureValve:
      return entity.props["turned"] === true;
    case EntityType.FuseBox:
      return entity.props["powered"] === true;
    case EntityType.PowerCell:
      return entity.props["collected"] === true;
    case EntityType.EvidenceTrace:
      return entity.props["discovered"] === true;
    default:
      return false;
  }
}

/**
 * Get entities adjacent to (or at) the player position that can be interacted with.
 */
function getAdjacentInteractables(state: GameState): Entity[] {
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;
  const result: Entity[] = [];
  const deltas = [
    { x: 0, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
  ];

  for (const d of deltas) {
    const tx = px + d.x;
    const ty = py + d.y;
    if (tx < 0 || tx >= state.width || ty < 0 || ty >= state.height) continue;
    for (const [, entity] of state.entities) {
      if (entity.pos.x === tx && entity.pos.y === ty
          && !NON_INTERACTABLE.has(entity.type)
          && !isExhausted(entity, state)) {
        result.push(entity);
      }
    }
  }
  return result;
}

/**
 * Enumerate all valid actions for the current state.
 * Used to provide the agent with its option set each turn.
 */
export function getValidActionsForState(state: GameState): HarnessAction[] {
  const actions: HarnessAction[] = [];

  if (state.gameOver) return actions;

  // Stun check: if player is stunned, only WAIT is valid
  if (state.player.stunTurns > 0) {
    actions.push({ action: "WAIT", params: {} });
    return actions;
  }

  // 1. Movement — check all 8 directions
  for (const [shortDir, direction] of Object.entries(DIR_MAP)) {
    const moveAction: Action = { type: ActionType.Move, direction };
    if (isValidAction(state, moveAction)) {
      actions.push({
        action: "MOVE",
        params: { dir: shortDir },
      });
    }
  }

  // 2. Interact — adjacent interactable entities
  const interactables = getAdjacentInteractables(state);
  for (const entity of interactables) {
    actions.push({
      action: "INTERACT",
      params: { target: entity.id },
    });
  }

  // 3. Always-available actions
  actions.push({ action: "SCAN" });
  actions.push({ action: "CLEAN" });
  actions.push({ action: "WAIT" });
  actions.push({ action: "LOOK" });

  return actions;
}

/**
 * Format a HarnessAction as a human-readable description string.
 */
export function describeAction(ha: HarnessAction): string {
  switch (ha.action) {
    case "MOVE":
      return `Move ${DIR_LABELS[ha.params?.dir as string] ?? ha.params?.dir}`;
    case "INTERACT":
      return `Interact with ${ha.params?.target}`;
    case "SCAN":
      return "Scan surroundings";
    case "CLEAN":
      return "Clean current tile";
    case "WAIT":
      return "Wait one turn";
    case "LOOK":
      return "Look around (refresh vision)";
    default:
      return ha.action;
  }
}
