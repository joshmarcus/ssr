import type { GameState } from "../shared/types.js";
import { EntityType } from "../shared/types.js";
import {
  MAX_TURNS,
  TURN_WARNING_THRESHOLD,
  TURN_URGENT_THRESHOLD,
  TURN_CRITICAL_THRESHOLD,
} from "../shared/constants.js";

/**
 * Check win condition:
 * - Primary: all discovered living crew evacuated + all deductions solved
 * - Fallback: data core transmit when no living crew remain (bittersweet ending)
 * Victory is flagged via state.victory, set during escape pod boarding or data core interaction.
 */
export function checkWinCondition(state: GameState): GameState {
  if (state.victory) {
    return { ...state, gameOver: true, victory: true };
  }
  return state;
}

/**
 * Check loss condition: player bot destroyed and no recovery bot available.
 * Recovery bot = a service bot entity with props.active === true.
 *
 * If a recovery bot is available, transfer the player to that bot's position,
 * revive the player, and consume the service bot (remove it from entities).
 */
export function checkLossCondition(state: GameState): GameState {
  if (!state.player.alive) {
    // Find an active service bot for recovery
    let recoveryBot: { id: string; entity: import("../shared/types.js").Entity } | null = null;
    for (const [id, entity] of state.entities) {
      if (entity.type === EntityType.ServiceBot && entity.props["active"] === true) {
        recoveryBot = { id, entity };
        break;
      }
    }

    if (!recoveryBot) {
      return { ...state, gameOver: true, victory: false };
    }

    // Transfer player to service bot position and revive
    const newPos = { ...recoveryBot.entity.pos };
    const newPlayerEntity = { ...state.player.entity, pos: newPos };
    const newEntities = new Map(state.entities);
    newEntities.set("player", newPlayerEntity);
    // Consume the service bot (mark as used, remove from map)
    newEntities.delete(recoveryBot.id);

    return {
      ...state,
      player: {
        ...state.player,
        entity: newPlayerEntity,
        alive: true,
        hp: Math.ceil(state.player.maxHp * 0.3), // recover with 30% HP (resource scarcity)
      },
      entities: newEntities,
      logs: [
        ...state.logs,
        {
          id: `log_recovery_${state.turn}`,
          timestamp: state.turn,
          source: "system",
          text: "Rover A3 offline — critical heat damage. Transferring link to Service Bot B07. Connection re-established. The mission continues.",
          read: false,
        },
      ],
    };
  }

  return state;
}

/**
 * Check turn limit: if we've hit MAX_TURNS, the station's orbit has decayed
 * and the terminal link is lost. Also emits countdown warnings at thresholds.
 */
export function checkTurnLimit(state: GameState): GameState {
  if (state.gameOver) return state;

  const turn = state.turn;
  const logs = [...state.logs];

  // Hard limit — defeat
  if (turn >= MAX_TURNS) {
    logs.push({
      id: `log_turn_limit_${turn}`,
      timestamp: turn,
      source: "system",
      text: "CORVUS-7 orbit has decayed below recovery threshold. Terminal link severed. Signal lost.",
      read: false,
    });
    return { ...state, logs, gameOver: true, victory: false };
  }

  // Countdown warnings (only fire once per threshold)
  if (turn === TURN_CRITICAL_THRESHOLD) {
    logs.push({
      id: `log_turn_critical`,
      timestamp: turn,
      source: "system",
      text: `WARNING: IMMINENT POWER FAILURE — ${MAX_TURNS - turn} cycles remaining. Complete mission NOW.`,
      read: false,
    });
    return { ...state, logs };
  }
  if (turn === TURN_URGENT_THRESHOLD) {
    logs.push({
      id: `log_turn_urgent`,
      timestamp: turn,
      source: "system",
      text: `WARNING: POWER RESERVES CRITICAL — ${MAX_TURNS - turn} cycles remaining. Station orbit unstable.`,
      read: false,
    });
    return { ...state, logs };
  }
  if (turn === TURN_WARNING_THRESHOLD) {
    logs.push({
      id: `log_turn_warning`,
      timestamp: turn,
      source: "system",
      text: `Station power reserves declining. ${MAX_TURNS - turn} cycles until orbit decay.`,
      read: false,
    });
    return { ...state, logs };
  }

  return state;
}
