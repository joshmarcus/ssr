import type { GameState } from "../shared/types.js";
import { EntityType } from "../shared/types.js";

/**
 * Check win condition: player has transmitted data from the data core.
 * Win is flagged via state.victory, set during the interact action with the data core.
 */
export function checkWinCondition(state: GameState): GameState {
  // Victory is set during interact with data core (TRANSMIT action).
  // This function validates it remains consistent.
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
