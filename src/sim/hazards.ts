import type { GameState, Tile } from "../shared/types.js";
import { TileType, EntityType, SensorType } from "../shared/types.js";
import {
  HEAT_SPREAD_RATE, SMOKE_SPREAD_RATE, HEAT_DECAY_RATE, HEAT_SOURCE_RATE, HEAT_SOURCE_CAP,
  HEAT_DAMAGE_PER_TURN, HEAT_PAIN_THRESHOLD, COOL_RECOVERY_RATE, HEAT_SPREAD_MIN,
  PRESSURE_BREACH_DRAIN, PRESSURE_SPREAD_RATE, PRESSURE_DAMAGE_THRESHOLD, PRESSURE_DAMAGE_PER_TURN,
  PRESSURE_BULKHEAD_THRESHOLD, AIRLOCK_PRESSURE_DRAIN, DETERIORATION_INTERVAL, DETERIORATION_HEAT_BOOST, DETERIORATION_SMOKE_SPAWN,
  PA_INTERVAL, GLYPHS,
} from "../shared/constants.js";
import {
  PA_ANNOUNCEMENTS_GENERAL, PA_ANNOUNCEMENTS_WARNING, PA_ANNOUNCEMENTS_ATMOSPHERIC,
  PA_ANNOUNCEMENTS_INVESTIGATE, PA_ANNOUNCEMENTS_RECOVER,
} from "../data/narrative.js";

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
 * Heat zones now EXPAND over time: spread rate (3) > decay rate (1).
 * Sources inject aggressively (5/turn, cap 95) creating lethal zones.
 */
export function tickHazards(state: GameState): GameState {
  const oldTiles = state.tiles;
  const newTiles = cloneTiles(oldTiles);

  // Collect positions of overheating relay entities (persistent heat sources).
  const heatSources = new Set<string>();
  for (const [, entity] of state.entities) {
    if (entity.type === EntityType.Relay && entity.props["overheating"] === true) {
      heatSources.add(`${entity.pos.x},${entity.pos.y}`);
    }
  }

  // Re-inject heat at persistent sources — these are dangerous and grow over time
  for (const key of heatSources) {
    const [sx, sy] = key.split(",").map(Number);
    if (sy >= 0 && sy < state.height && sx >= 0 && sx < state.width) {
      newTiles[sy][sx].heat = Math.min(HEAT_SOURCE_CAP, newTiles[sy][sx].heat + HEAT_SOURCE_RATE);
      newTiles[sy][sx].smoke = Math.min(60, newTiles[sy][sx].smoke + SMOKE_SPREAD_RATE);
    }
  }

  // Accumulate spread from current heat/smoke sources
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const tile = oldTiles[y][x];

      if (tile.heat >= HEAT_SPREAD_MIN) {
        // Heat spread is proportional to how hot the source tile is
        // Low pressure suppresses spread (fire needs oxygen)
        const pressureMod = tile.pressure < 30 ? 0 : tile.pressure < 60 ? 0.5 : 1;
        const spreadAmount = Math.ceil(HEAT_SPREAD_RATE * (tile.heat / 100) * pressureMod);
        if (spreadAmount > 0) {
          for (const d of ADJACENT_DELTAS) {
            const nx = x + d.x;
            const ny = y + d.y;
            if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
            const neighbor = oldTiles[ny][nx];
            if (!neighbor.walkable) continue;
            newTiles[ny][nx].heat = Math.min(100, newTiles[ny][nx].heat + spreadAmount);
          }
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

  // Natural heat/smoke decay. Low pressure accelerates decay (fire needs oxygen).
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (heatSources.has(`${x},${y}`)) continue; // sources don't decay
      const pressure = newTiles[y][x].pressure;
      // Low pressure suppresses fire: vacuum tiles lose heat 3x faster
      const pressureFactor = pressure < 30 ? 3 : pressure < 60 ? 2 : 1;
      if (newTiles[y][x].heat > 0) {
        newTiles[y][x].heat = Math.max(0, newTiles[y][x].heat - HEAT_DECAY_RATE * pressureFactor);
      }
      if (newTiles[y][x].smoke > 0) {
        newTiles[y][x].smoke = Math.max(0, newTiles[y][x].smoke - HEAT_DECAY_RATE * pressureFactor);
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

  // Airlock drain: open airlocks act as pressure sinks
  for (const [, entity] of state.entities) {
    if (entity.type === EntityType.Airlock && entity.props["open"] === true) {
      const ax = entity.pos.x;
      const ay = entity.pos.y;
      if (ay >= 0 && ay < state.height && ax >= 0 && ax < state.width) {
        newTiles[ay][ax].pressure = 0; // airlock tile is always at 0 pressure while open
      }
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
            const transfer = Math.min(PRESSURE_SPREAD_RATE, Math.floor((neighbor.pressure - tile.pressure) / 3));
            if (transfer > 0) {
              newTiles[ny][nx].pressure = Math.max(0, newTiles[ny][nx].pressure - transfer);
              newTiles[y][x].pressure = Math.min(100, newTiles[y][x].pressure + Math.max(0, transfer - 1));
            }
          }
        }
      }
    }
  }

  // Pressure recovery: tiles far from breaches slowly recover
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (!newTiles[y][x].walkable) continue;
      if (breachSources.has(`${x},${y}`)) continue;
      if (newTiles[y][x].pressure < 100 && newTiles[y][x].pressure > 0) {
        let nearBreach = false;
        for (const key of breachSources) {
          const [bx, by] = key.split(",").map(Number);
          if (Math.abs(bx - x) + Math.abs(by - y) <= 4) {
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

  // ── Emergency bulkhead auto-seal / reopen ────────────────────
  // When pressure drops critically low, adjacent doors auto-lock.
  // When pressure recovers above threshold, auto-sealed doors reopen.
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (newTiles[y][x].pressure > 0 && newTiles[y][x].pressure < PRESSURE_BULKHEAD_THRESHOLD) {
        for (const d of ADJACENT_DELTAS) {
          const nx = x + d.x;
          const ny = y + d.y;
          if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
          if (newTiles[ny][nx].type === TileType.Door) {
            newTiles[ny][nx].type = TileType.LockedDoor;
            newTiles[ny][nx].walkable = false;
          }
        }
      }
    }
  }
  // Reopen auto-sealed bulkheads when ALL adjacent tiles have safe pressure.
  // Auto-sealed doors are bare LockedDoor tiles with no entity on them.
  // Procgen-placed locked doors always have an entity (Relay, ClosedDoor, etc.).
  const entityPositions = new Set<string>();
  for (const [, entity] of state.entities) {
    entityPositions.add(`${entity.pos.x},${entity.pos.y}`);
  }
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (newTiles[y][x].type !== TileType.LockedDoor) continue;
      if (entityPositions.has(`${x},${y}`)) continue; // entity-based door, don't auto-reopen
      // Check if ALL adjacent walkable tiles have safe pressure
      let allSafe = true;
      for (const d of ADJACENT_DELTAS) {
        const nx = x + d.x;
        const ny = y + d.y;
        if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
        if (newTiles[ny][nx].walkable && newTiles[ny][nx].pressure < PRESSURE_BULKHEAD_THRESHOLD) {
          allSafe = false;
          break;
        }
      }
      if (allSafe) {
        newTiles[y][x].type = TileType.Door;
        newTiles[y][x].walkable = true;
      }
    }
  }

  return { ...state, tiles: newTiles };
}

/**
 * Station deterioration: every DETERIORATION_INTERVAL turns, the station gets worse.
 * Heat sources get hotter, smoke spawns in corridors, breaches widen.
 */
export function tickDeterioration(state: GameState): GameState {
  if (state.turn === 0 || state.turn % DETERIORATION_INTERVAL !== 0) return state;

  const newTiles = cloneTiles(state.tiles);
  const newLogs = [...state.logs];

  // Boost heat at all source tiles (escalation — heat zones grow faster over time)
  for (const [, entity] of state.entities) {
    if (entity.type === EntityType.Relay && entity.props["overheating"] === true) {
      const { x, y } = entity.pos;
      if (y >= 0 && y < state.height && x >= 0 && x < state.width) {
        newTiles[y][x].heat = Math.min(100, newTiles[y][x].heat + DETERIORATION_HEAT_BOOST);
        // Also boost adjacent tiles to make zones grow
        for (const d of ADJACENT_DELTAS) {
          const nx = x + d.x;
          const ny = y + d.y;
          if (nx >= 0 && nx < state.width && ny >= 0 && ny < state.height && newTiles[ny][nx].walkable) {
            newTiles[ny][nx].heat = Math.min(100, newTiles[ny][nx].heat + Math.ceil(DETERIORATION_HEAT_BOOST / 2));
          }
        }
      }
    }
  }

  // Spawn smoke in random corridor tiles near hot zones
  const rng = ((state.turn * 7919 + state.seed) >>> 0) % 2147483647;
  let smokeCount = 0;
  for (let y = 0; y < state.height && smokeCount < 3; y++) {
    for (let x = 0; x < state.width && smokeCount < 3; x++) {
      if (newTiles[y][x].walkable && newTiles[y][x].heat > 10 && newTiles[y][x].smoke < 20) {
        const hash = ((x * 31 + y * 17 + rng) >>> 0) % 10;
        if (hash < 2) {
          newTiles[y][x].smoke = Math.min(100, newTiles[y][x].smoke + DETERIORATION_SMOKE_SPAWN);
          smokeCount++;
        }
      }
    }
  }

  // Warning message
  const deteriorationMsgs = [
    "Station systems degrading. Thermal containment failing.",
    "Emergency: Heat signatures expanding. Environmental controls offline.",
    "WARNING: Station conditions declining. Environmental systems degrading.",
    "Automated alert: Ambient temperature rising across multiple sectors.",
    "Cascade failure detected. Heat management systems non-responsive.",
  ];
  const msgIdx = Math.floor(state.turn / DETERIORATION_INTERVAL) % deteriorationMsgs.length;
  newLogs.push({
    id: `log_deterioration_${state.turn}`,
    timestamp: state.turn,
    source: "system",
    text: deteriorationMsgs[msgIdx],
    read: false,
  });

  return { ...state, tiles: newTiles, logs: newLogs };
}

/**
 * Ship computer PA announcements: periodic atmospheric messages.
 * Fires every PA_INTERVAL turns, offset from deterioration so they don't overlap.
 */
export function tickPA(state: GameState): GameState {
  // Offset by half the PA_INTERVAL so it doesn't coincide with deterioration ticks
  const offset = Math.floor(PA_INTERVAL / 2);
  if (state.turn < offset || (state.turn - offset) % PA_INTERVAL !== 0) return state;

  // Don't announce during the opening cleaning phase (first 30 turns)
  if (state.turn < 30) return state;

  const newLogs = [...state.logs];

  // Pick pool based on game phase and station conditions
  const phase = state.mystery?.objectivePhase;
  const hasHotZone = state.tiles.some(row => row.some(t => t.heat > 40));
  const hasLowPressure = state.tiles.some(row => row.some(t => t.pressure < 50));

  let pool: string[];
  const turnHash = (state.turn * 37) % 100;

  if ((hasHotZone || hasLowPressure) && turnHash < 40) {
    pool = PA_ANNOUNCEMENTS_WARNING;
  } else if (phase === "investigate" && turnHash < 60) {
    pool = PA_ANNOUNCEMENTS_INVESTIGATE;
  } else if (phase === "recover" && turnHash < 60) {
    pool = PA_ANNOUNCEMENTS_RECOVER;
  } else if (turnHash < 25) {
    pool = PA_ANNOUNCEMENTS_ATMOSPHERIC;
  } else {
    pool = PA_ANNOUNCEMENTS_GENERAL;
  }

  const msgIdx = (state.turn * 7 + 3) % pool.length;
  newLogs.push({
    id: `log_pa_${state.turn}`,
    timestamp: state.turn,
    source: "system",
    text: pool[msgIdx],
    read: false,
  });

  return { ...state, logs: newLogs };
}

/**
 * Apply gradual heat and pressure damage to the player.
 * Damage scales with intensity — standing in high heat is quickly fatal.
 */
export function applyHazardDamage(inputState: GameState): GameState {
  let state = inputState;
  const { x, y } = state.player.entity.pos;
  const tile = state.tiles[y][x];

  if (!state.player.alive) return state;

  // Sensor-based damage reduction — all collected sensors apply simultaneously
  const sensors = state.player.sensors ?? [];
  const hasThermal = sensors.includes(SensorType.Thermal);
  const hasAtmospheric = sensors.includes(SensorType.Atmospheric);

  // Pressure damage: low-pressure tiles damage the bot
  // Atmospheric sensor halves pressure damage (better seals awareness)
  if (tile.pressure < PRESSURE_DAMAGE_THRESHOLD && tile.pressure >= 0) {
    const pressureDamage = hasAtmospheric ? Math.ceil(PRESSURE_DAMAGE_PER_TURN / 2) : PRESSURE_DAMAGE_PER_TURN;
    const pressureHp = Math.max(0, state.player.hp - pressureDamage);
    const pressureLogs = [...state.logs];
    if (state.turn % 2 === 0) {
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

  // Heat damage: scales aggressively with intensity
  // Thermal sensor reduces heat damage by 40% (better heat routing knowledge)
  if (tile.heat >= HEAT_PAIN_THRESHOLD) {
    const intensity = Math.min(1, (tile.heat - HEAT_PAIN_THRESHOLD) / 60);
    const baseDamage = Math.ceil(HEAT_DAMAGE_PER_TURN * (0.5 + intensity * 1.5));
    const damage = hasThermal ? Math.ceil(baseDamage * 0.6) : baseDamage;
    const newHp = Math.max(0, state.player.hp - damage);

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
    } else if (state.turn % 2 === 0) {
      newLogs.push({
        id: `log_heat_notice_${state.turn}`,
        timestamp: state.turn,
        source: "system",
        text: `Heat exposure: -${damage} HP (${newHp}/${state.player.maxHp}). The air shimmers with thermal distortion.`,
        read: false,
      });
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

  // Recovery: slow heal on cool tiles only
  if (tile.heat < HEAT_PAIN_THRESHOLD && tile.pressure >= PRESSURE_DAMAGE_THRESHOLD && state.player.hp < state.player.maxHp) {
    const healedHp = Math.min(state.player.maxHp, state.player.hp + COOL_RECOVERY_RATE);
    return {
      ...state,
      player: {
        ...state.player,
        hp: healedHp,
      },
    };
  }

  return state;
}
