import type { GameState, Tile } from "../shared/types.js";
import { EntityType } from "../shared/types.js";
import { HEAT_SPREAD_RATE, SMOKE_SPREAD_RATE, HEAT_DECAY_RATE, HEAT_SOURCE_RATE, HEAT_DAMAGE_THRESHOLD, HEAT_DAMAGE_PER_TURN, HEAT_PAIN_THRESHOLD, COOL_RECOVERY_RATE, HEAT_SPREAD_MIN, PRESSURE_BREACH_DRAIN, PRESSURE_SPREAD_RATE, PRESSURE_DAMAGE_THRESHOLD, PRESSURE_DAMAGE_PER_TURN } from "../shared/constants.js";

/**
 * Adjacent deltas (4-directional: N, S, E, W)
 */
const ADJACENT_DELTAS = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
];

/**
 * Deep-clone the tile grid so we can mutate without affecting original state.
 */
function cloneTiles(tiles: Tile[][]): Tile[][] {
  return tiles.map((row) => row.map((t) => ({ ...t })));
}

/**
 * Spread heat and smoke across the map for one turn.
 *
 * Rules:
 * - Any floor tile with heat > 0 spreads HEAT_SPREAD_RATE to adjacent floor tiles (capped at 100).
 * - Any floor tile with smoke > 0 spreads SMOKE_SPREAD_RATE to adjacent floor tiles (capped at 100).
 * - Walls and locked doors block spread.
 */
export function tickHazards(state: GameState): GameState {
  const oldTiles = state.tiles;
  const newTiles = cloneTiles(oldTiles);

  // Collect positions of overheating relay entities (persistent heat sources).
  // These tiles get re-injected with heat each turn.
  const heatSources = new Set<string>();
  for (const [, entity] of state.entities) {
    if (entity.type === EntityType.Relay && entity.props["overheating"] === true) {
      heatSources.add(`${entity.pos.x},${entity.pos.y}`);
    }
  }

  // Re-inject heat at persistent sources (overheating relays emit heat each turn)
  // Capped at 70 so relay tiles are dangerous but not instantly lethal
  for (const key of heatSources) {
    const [sx, sy] = key.split(",").map(Number);
    if (sy >= 0 && sy < state.height && sx >= 0 && sx < state.width) {
      newTiles[sy][sx].heat = Math.min(70, newTiles[sy][sx].heat + HEAT_SOURCE_RATE);
      newTiles[sy][sx].smoke = Math.min(50, newTiles[sy][sx].smoke + SMOKE_SPREAD_RATE);
    }
  }

  // Accumulate spread from current heat/smoke sources
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const tile = oldTiles[y][x];

      if (tile.heat >= HEAT_SPREAD_MIN) {
        for (const d of ADJACENT_DELTAS) {
          const nx = x + d.x;
          const ny = y + d.y;
          if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
          const neighbor = oldTiles[ny][nx];
          if (!neighbor.walkable) continue;
          // Spread: add HEAT_SPREAD_RATE, cap at 100
          newTiles[ny][nx].heat = Math.min(100, newTiles[ny][nx].heat + HEAT_SPREAD_RATE);
        }
      }

      if (tile.smoke > 0) {
        for (const d of ADJACENT_DELTAS) {
          const nx = x + d.x;
          const ny = y + d.y;
          if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
          const neighbor = oldTiles[ny][nx];
          if (!neighbor.walkable) continue;
          const spread = Math.min(SMOKE_SPREAD_RATE, tile.smoke);
          newTiles[ny][nx].smoke = Math.min(100, newTiles[ny][nx].smoke + spread);
        }
      }
    }
  }

  // Natural heat/smoke decay: non-source tiles lose 1 heat/smoke per turn.
  // This prevents runaway cascading and creates a stable gradient from the source.
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (heatSources.has(`${x},${y}`)) continue; // sources don't decay
      if (newTiles[y][x].heat > 0) {
        newTiles[y][x].heat = Math.max(0, newTiles[y][x].heat - HEAT_DECAY_RATE);
      }
      if (newTiles[y][x].smoke > 0) {
        newTiles[y][x].smoke = Math.max(0, newTiles[y][x].smoke - HEAT_DECAY_RATE);
      }
    }
  }

  // ── Pressure drain from unsealed breaches ──────────────────
  const breachSources = new Set<string>();
  for (const [, entity] of state.entities) {
    if (entity.type === EntityType.Breach && entity.props["sealed"] !== true) {
      breachSources.add(`${entity.pos.x},${entity.pos.y}`);
    }
  }

  // Drain pressure at breach tiles
  for (const key of breachSources) {
    const [bx, by] = key.split(",").map(Number);
    if (by >= 0 && by < state.height && bx >= 0 && bx < state.width) {
      newTiles[by][bx].pressure = Math.max(0, newTiles[by][bx].pressure - PRESSURE_BREACH_DRAIN);
    }
  }

  // Pressure spreads (equalizes): low-pressure tiles pull from neighbors
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const tile = oldTiles[y][x];
      if (!tile.walkable) continue;
      if (tile.pressure < 100) {
        for (const d of ADJACENT_DELTAS) {
          const nx = x + d.x;
          const ny = y + d.y;
          if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
          const neighbor = oldTiles[ny][nx];
          if (!neighbor.walkable) continue;
          if (neighbor.pressure > tile.pressure) {
            // Pull pressure toward low-pressure area
            const transfer = Math.min(PRESSURE_SPREAD_RATE, Math.floor((neighbor.pressure - tile.pressure) / 4));
            if (transfer > 0) {
              newTiles[ny][nx].pressure = Math.max(0, newTiles[ny][nx].pressure - transfer);
              newTiles[y][x].pressure = Math.min(100, newTiles[y][x].pressure + Math.max(0, transfer - 1));
            }
          }
        }
      }
    }
  }

  // Pressure recovery: tiles far from breaches slowly recover toward 100
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (!newTiles[y][x].walkable) continue;
      if (breachSources.has(`${x},${y}`)) continue;
      if (newTiles[y][x].pressure < 100 && newTiles[y][x].pressure > 0) {
        // Slow recovery if not near a breach
        let nearBreach = false;
        for (const key of breachSources) {
          const [bx, by] = key.split(",").map(Number);
          if (Math.abs(bx - x) + Math.abs(by - y) <= 3) {
            nearBreach = true;
            break;
          }
        }
        if (!nearBreach) {
          newTiles[y][x].pressure = Math.min(100, newTiles[y][x].pressure + 1);
        }
      }
    }
  }

  return { ...state, tiles: newTiles };
}

/**
 * Apply gradual heat damage to the player based on the tile they're standing on.
 * Tiles above HEAT_PAIN_THRESHOLD deal HEAT_DAMAGE_PER_TURN HP per turn.
 * When HP reaches 0, the bot is destroyed.
 */
export function applyHazardDamage(inputState: GameState): GameState {
  let state = inputState;
  const { x, y } = state.player.entity.pos;
  const tile = state.tiles[y][x];

  if (!state.player.alive) return state;

  // Recovery: heal COOL_RECOVERY_RATE HP/turn when standing on a tile below pain threshold
  if (tile.heat < HEAT_PAIN_THRESHOLD && state.player.hp < state.player.maxHp) {
    const healedHp = Math.min(state.player.maxHp, state.player.hp + COOL_RECOVERY_RATE);
    return {
      ...state,
      player: {
        ...state.player,
        hp: healedHp,
      },
    };
  }

  // Pressure damage: low-pressure tiles damage the bot
  if (tile.pressure < PRESSURE_DAMAGE_THRESHOLD && tile.pressure >= 0) {
    const pressureDamage = PRESSURE_DAMAGE_PER_TURN;
    const pressureHp = Math.max(0, state.player.hp - pressureDamage);
    const pressureLogs = [...state.logs];
    if (state.turn % 3 === 0) {
      const pressureMsgs = [
        "Low pressure warning. Hull seals straining.",
        "Atmospheric pressure critical. Actuator joints losing lubrication.",
        "Vacuum exposure detected. Chassis integrity declining.",
        "Pressure differential exceeds rated tolerance.",
      ];
      pressureLogs.push({
        id: `log_pressure_warn_${state.turn}`,
        timestamp: state.turn,
        source: "system",
        text: `${pressureMsgs[state.turn % pressureMsgs.length]} (-${pressureDamage} HP, ${pressureHp}/${state.player.maxHp})`,
        read: false,
      });
    }
    state = {
      ...state,
      player: {
        ...state.player,
        hp: pressureHp,
        alive: pressureHp > 0,
      },
      logs: pressureLogs,
    };
    if (pressureHp <= 0) return state;
  }

  // No damage if heat is below pain threshold
  if (tile.heat < HEAT_PAIN_THRESHOLD) return state;

  // Scale damage based on how far above the threshold we are
  const intensity = Math.min(1, (tile.heat - HEAT_PAIN_THRESHOLD) / 60);
  const damage = Math.ceil(HEAT_DAMAGE_PER_TURN * (0.5 + intensity));
  const newHp = Math.max(0, state.player.hp - damage);

  // Generate warning messages based on HP level
  const newLogs = [...state.logs];
  const hpPercent = newHp / state.player.maxHp;

  if (newHp <= 0) {
    newLogs.push({
      id: `log_heat_death_${state.turn}`,
      timestamp: state.turn,
      source: "system",
      text: "CRITICAL: Thermal overload. Bot chassis compromised. Systems failing.",
      read: false,
    });
  } else if (hpPercent <= 0.25) {
    newLogs.push({
      id: `log_heat_critical_${state.turn}`,
      timestamp: state.turn,
      source: "system",
      text: `WARNING: Hull integrity critical (${newHp}/${state.player.maxHp} HP). Evacuate hot zone immediately!`,
      read: false,
    });
  } else if (hpPercent <= 0.5) {
    newLogs.push({
      id: `log_heat_warn_${state.turn}`,
      timestamp: state.turn,
      source: "system",
      text: `CAUTION: Heat damage detected (${newHp}/${state.player.maxHp} HP). Move away from heat source.`,
      read: false,
    });
  } else if (tile.heat >= HEAT_PAIN_THRESHOLD) {
    // First warning — only show occasionally to avoid spam
    if (state.turn % 3 === 0) {
      newLogs.push({
        id: `log_heat_notice_${state.turn}`,
        timestamp: state.turn,
        source: "system",
        text: `Heat exposure: -${damage} HP (${newHp}/${state.player.maxHp}). The air shimmers with thermal distortion.`,
        read: false,
      });
    }
  }

  return {
    ...state,
    player: {
      ...state.player,
      hp: newHp,
      alive: newHp > 0,
    },
    logs: newLogs,
  };
}
