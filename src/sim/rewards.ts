/**
 * Reward card system — Hades-style 3-card power/buff selection.
 *
 * After key milestones (relay fix, room clean, deduction solved), the player
 * is offered 3 randomized reward cards. Each card grants a passive buff
 * that shapes the run's build.
 */

import * as ROT from "rot-js";
import type { GameState, RewardCard, RewardSelection } from "../shared/types.js";
import { RewardCardRarity } from "../shared/types.js";

// ── Card pool ────────────────────────────────────────────────

export const REWARD_CARD_POOL: RewardCard[] = [
  // ── Common (green) ──
  {
    id: "thermal_plating",
    title: "Thermal Plating",
    description: "Heat damage reduced by 30%.",
    rarity: RewardCardRarity.Common,
    mechanicId: "thermal_plating",
    modifierValue: 0.3,
  },
  {
    id: "air_filters",
    title: "Air Filters",
    description: "Smoke damage reduced by 30%.",
    rarity: RewardCardRarity.Common,
    mechanicId: "air_filters",
    modifierValue: 0.3,
  },
  {
    id: "reinforced_chassis",
    title: "Reinforced Chassis",
    description: "+200 max HP.",
    rarity: RewardCardRarity.Common,
    mechanicId: "reinforced_chassis",
    modifierValue: 200,
  },
  {
    id: "efficient_brushes",
    title: "Efficient Brushes",
    description: "Cleaning clears a wider area.",
    rarity: RewardCardRarity.Common,
    mechanicId: "efficient_brushes",
    modifierValue: 2, // expanded radius
  },
  {
    id: "quick_scan",
    title: "Quick Scan",
    description: "Scan action also cleans current tile.",
    rarity: RewardCardRarity.Common,
    mechanicId: "quick_scan",
    modifierValue: 1,
  },
  // ── Rare (blue) ──
  {
    id: "pressure_suit",
    title: "Pressure Suit",
    description: "No damage from low-pressure zones.",
    rarity: RewardCardRarity.Rare,
    mechanicId: "pressure_suit",
    modifierValue: 1,
  },
  {
    id: "heat_sink",
    title: "Heat Sink",
    description: "Standing on hot tiles slowly cools them.",
    rarity: RewardCardRarity.Rare,
    mechanicId: "heat_sink",
    modifierValue: 5, // heat reduction per turn
  },
  {
    id: "signal_boost",
    title: "Signal Boost",
    description: "Antenna detection range increased by 50%.",
    rarity: RewardCardRarity.Rare,
    mechanicId: "signal_boost",
    modifierValue: 1.5,
  },
  {
    id: "scavenger",
    title: "Scavenger",
    description: "Cleaning dirty tiles can reveal hidden evidence.",
    rarity: RewardCardRarity.Rare,
    mechanicId: "scavenger",
    modifierValue: 20, // % chance per clean
  },
  {
    id: "emergency_repair",
    title: "Emergency Repair",
    description: "Auto-heal 100 HP when dropping below 20%.",
    rarity: RewardCardRarity.Rare,
    mechanicId: "emergency_repair",
    modifierValue: 100,
  },
  // ── Epic (gold) ──
  {
    id: "overclock",
    title: "Overclock",
    description: "Cleaning and scanning no longer cost a turn.",
    rarity: RewardCardRarity.Epic,
    mechanicId: "overclock",
    modifierValue: 1,
  },
  {
    id: "holographic_map",
    title: "Holographic Map",
    description: "All room outlines revealed on minimap.",
    rarity: RewardCardRarity.Epic,
    mechanicId: "holographic_map",
    modifierValue: 1,
  },
  {
    id: "crew_resonance",
    title: "Crew Resonance",
    description: "Ghost echoes trigger automatically on room entry.",
    rarity: RewardCardRarity.Epic,
    mechanicId: "crew_resonance",
    modifierValue: 1,
  },
  {
    id: "deep_clean",
    title: "Deep Clean",
    description: "Cleaning also removes heat and smoke.",
    rarity: RewardCardRarity.Epic,
    mechanicId: "deep_clean",
    modifierValue: 1,
  },
  {
    id: "investigation_protocol",
    title: "Investigation Protocol",
    description: "Scene processing reveals one free hint.",
    rarity: RewardCardRarity.Epic,
    mechanicId: "investigation_protocol",
    modifierValue: 1,
  },
];

// Rarity weights for selection
const RARITY_WEIGHTS: Record<RewardCardRarity, number> = {
  [RewardCardRarity.Common]: 60,
  [RewardCardRarity.Rare]: 30,
  [RewardCardRarity.Epic]: 10,
};

/**
 * Generate 3 reward cards for the player to choose from.
 * Uses ROT.RNG (must be seeded) for determinism.
 * Excludes already-collected mechanics.
 */
export function generateRewardCards(state: GameState, source: string): RewardSelection {
  const collected = new Set(state.collectedRewards);
  const available = REWARD_CARD_POOL.filter(c => !collected.has(c.mechanicId));

  // If fewer than 3 cards available, offer what's left
  if (available.length <= 3) {
    return { turn: state.turn, cards: available.slice(), source };
  }

  // Build weighted pool
  const weightedPool: { card: RewardCard; weight: number }[] = available.map(card => ({
    card,
    weight: RARITY_WEIGHTS[card.rarity],
  }));

  const chosen: RewardCard[] = [];
  const usedIds = new Set<string>();

  while (chosen.length < 3 && weightedPool.length > 0) {
    const totalWeight = weightedPool.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = ROT.RNG.getUniform() * totalWeight;

    for (let i = 0; i < weightedPool.length; i++) {
      roll -= weightedPool[i].weight;
      if (roll <= 0) {
        const picked = weightedPool[i].card;
        if (!usedIds.has(picked.id)) {
          chosen.push(picked);
          usedIds.add(picked.id);
          weightedPool.splice(i, 1);
        }
        break;
      }
    }
  }

  return { turn: state.turn, cards: chosen, source };
}

/**
 * Apply a reward card's mechanic to the game state.
 * Returns the updated state with the buff active.
 */
export function applyRewardCard(state: GameState, card: RewardCard): GameState {
  const newBuffs = { ...state.player.passiveBuffs, [card.mechanicId]: card.modifierValue ?? 1 };
  let newPlayer = { ...state.player, passiveBuffs: newBuffs };

  // Immediate effects
  switch (card.mechanicId) {
    case "reinforced_chassis":
      newPlayer = {
        ...newPlayer,
        maxHp: newPlayer.maxHp + (card.modifierValue ?? 200),
        hp: newPlayer.hp + (card.modifierValue ?? 200),
      };
      break;
    case "holographic_map": {
      // Reveal all room tile outlines (mark border tiles as explored)
      const newTiles = state.tiles.map(row => row.map(t => ({ ...t })));
      for (const room of state.rooms) {
        for (let dy = room.y; dy < room.y + room.height; dy++) {
          for (let dx = room.x; dx < room.x + room.width; dx++) {
            if (dy >= 0 && dy < state.height && dx >= 0 && dx < state.width) {
              // Only reveal the border tiles (room outline)
              if (dy === room.y || dy === room.y + room.height - 1 ||
                  dx === room.x || dx === room.x + room.width - 1) {
                newTiles[dy][dx].explored = true;
              }
            }
          }
        }
      }
      return {
        ...state,
        player: newPlayer,
        tiles: newTiles,
        collectedRewards: [...state.collectedRewards, card.mechanicId],
        pendingReward: undefined,
      };
    }
  }

  return {
    ...state,
    player: newPlayer,
    collectedRewards: [...state.collectedRewards, card.mechanicId],
    pendingReward: undefined,
  };
}

/**
 * Check if the player has a specific passive buff active.
 */
export function hasBuff(state: GameState, mechanicId: string): boolean {
  return mechanicId in state.player.passiveBuffs;
}

/**
 * Get the numeric value of a passive buff (0 if not present).
 */
export function getBuffValue(state: GameState, mechanicId: string): number {
  return state.player.passiveBuffs[mechanicId] ?? 0;
}
