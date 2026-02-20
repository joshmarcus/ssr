import type { GameState, Tile } from "../shared/types.js";
import { TileType, EntityType, SensorType, Difficulty } from "../shared/types.js";
import {
  HEAT_SPREAD_RATE, SMOKE_SPREAD_RATE, HEAT_DECAY_RATE, HEAT_SOURCE_RATE, HEAT_SOURCE_CAP,
  HEAT_DAMAGE_PER_TURN, HEAT_PAIN_THRESHOLD, COOL_RECOVERY_RATE, HEAT_SPREAD_MIN,
  PRESSURE_BREACH_DRAIN, PRESSURE_SPREAD_RATE, PRESSURE_DAMAGE_THRESHOLD, PRESSURE_DAMAGE_PER_TURN,
  PRESSURE_BULKHEAD_THRESHOLD, AIRLOCK_PRESSURE_DRAIN, DETERIORATION_INTERVAL, DETERIORATION_HEAT_BOOST, DETERIORATION_SMOKE_SPAWN,
  PA_INTERVAL, GLYPHS, DIFFICULTY_SETTINGS,
  SMOKE_DAMAGE_THRESHOLD, SMOKE_DAMAGE_PER_TURN,
} from "../shared/constants.js";

/** Get damage multiplier for the current difficulty. */
export function getDamageMultiplier(state: GameState): number {
  return DIFFICULTY_SETTINGS[state.difficulty ?? Difficulty.Normal].damageMultiplier;
}
import {
  PA_ANNOUNCEMENTS_GENERAL, PA_ANNOUNCEMENTS_WARNING, PA_ANNOUNCEMENTS_ATMOSPHERIC,
  PA_ANNOUNCEMENTS_INVESTIGATE, PA_ANNOUNCEMENTS_RECOVER,
  PA_ANNOUNCEMENTS_BY_ARCHETYPE,
  PA_TIER_EARLY, PA_TIER_MID, PA_TIER_LATE,
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

  // Re-zero airlock tiles after bulkhead logic (open airlocks are always 0)
  for (const [, entity] of state.entities) {
    if (entity.type === EntityType.Airlock && entity.props["open"] === true) {
      const ax = entity.pos.x;
      const ay = entity.pos.y;
      if (ay >= 0 && ay < state.height && ax >= 0 && ax < state.width) {
        newTiles[ay][ax].pressure = 0;
      }
    }
  }

  return { ...state, tiles: newTiles };
}

// ── Escalation milestones ────────────────────────────────────
const ESCALATION_TIER_1 = 200; // secondary failure
const ESCALATION_TIER_2 = 300; // cascade failure
const ESCALATION_TIER_3 = 400; // critical failure

function getEscalationTier(turn: number): number {
  if (turn >= ESCALATION_TIER_3) return 3;
  if (turn >= ESCALATION_TIER_2) return 2;
  if (turn >= ESCALATION_TIER_1) return 1;
  return 0;
}

/**
 * Station deterioration: every DETERIORATION_INTERVAL turns, the station gets worse.
 * Heat sources get hotter, smoke spawns in corridors, breaches widen.
 * Escalation tiers at T200, T300, T400 create dramatic mid/late-game tension.
 */
export function tickDeterioration(state: GameState): GameState {
  const interval = state.deteriorationInterval ?? DETERIORATION_INTERVAL;
  let next = state;

  // ── One-time escalation milestone events ──────────────────
  next = checkEscalationMilestones(next);

  if (state.turn === 0 || state.turn % interval !== 0) return next;

  const newTiles = cloneTiles(next.tiles);
  const newLogs = [...next.logs];
  const tier = getEscalationTier(next.turn);

  // Heat boost scales with escalation tier
  const heatBoost = DETERIORATION_HEAT_BOOST + tier;
  const adjacentBoost = Math.ceil(heatBoost / 2);

  // Boost heat at all source tiles (escalation — heat zones grow faster over time)
  for (const [, entity] of next.entities) {
    if (entity.type === EntityType.Relay && entity.props["overheating"] === true) {
      const { x, y } = entity.pos;
      if (y >= 0 && y < next.height && x >= 0 && x < next.width) {
        newTiles[y][x].heat = Math.min(100, newTiles[y][x].heat + heatBoost);
        for (const d of ADJACENT_DELTAS) {
          const nx = x + d.x;
          const ny = y + d.y;
          if (nx >= 0 && nx < next.width && ny >= 0 && ny < next.height && newTiles[ny][nx].walkable) {
            newTiles[ny][nx].heat = Math.min(100, newTiles[ny][nx].heat + adjacentBoost);
          }
        }
      }
    }
  }

  // Spawn smoke — more aggressively at higher tiers
  const rng = ((next.turn * 7919 + next.seed) >>> 0) % 2147483647;
  const maxSmoke = 3 + tier;
  let smokeCount = 0;
  for (let y = 0; y < next.height && smokeCount < maxSmoke; y++) {
    for (let x = 0; x < next.width && smokeCount < maxSmoke; x++) {
      if (newTiles[y][x].walkable && newTiles[y][x].heat > 10 && newTiles[y][x].smoke < 20) {
        const hash = ((x * 31 + y * 17 + rng) >>> 0) % 10;
        if (hash < 2 + tier) {
          newTiles[y][x].smoke = Math.min(100, newTiles[y][x].smoke + DETERIORATION_SMOKE_SPAWN);
          smokeCount++;
        }
      }
    }
  }

  // Warning message — tier-appropriate
  const deteriorationMsgs = tier >= 2 ? [
    "CRITICAL: Station structural integrity compromised. Multiple system failures.",
    "EMERGENCY: Cascade failure across all sectors. Evacuate immediately.",
    "WARNING: Station is breaking apart. Environmental containment lost.",
  ] : [
    "Station systems degrading. Thermal containment failing.",
    "Emergency: Heat signatures expanding. Environmental controls offline.",
    "WARNING: Station conditions declining. Environmental systems degrading.",
    "Automated alert: Ambient temperature rising across multiple sectors.",
    "Cascade failure detected. Heat management systems non-responsive.",
  ];
  const msgIdx = Math.floor(next.turn / interval) % deteriorationMsgs.length;
  newLogs.push({
    id: `log_deterioration_${next.turn}`,
    timestamp: next.turn,
    source: "system",
    text: deteriorationMsgs[msgIdx],
    read: false,
  });

  return { ...next, tiles: newTiles, logs: newLogs };
}

/**
 * Check and fire one-time escalation milestone events.
 * Each milestone fires exactly once on the exact turn.
 */
function checkEscalationMilestones(state: GameState): GameState {
  if (state.turn !== ESCALATION_TIER_1 &&
      state.turn !== ESCALATION_TIER_2 &&
      state.turn !== ESCALATION_TIER_3) {
    return state;
  }

  const newLogs = [...state.logs];

  if (state.turn === ESCALATION_TIER_1) {
    // Tier 1: Warning — heat zones expand, dramatic PA
    newLogs.push({
      id: `log_escalation_tier1`,
      timestamp: state.turn,
      source: "system",
      text: "⚠ SECONDARY FAILURE DETECTED — Thermal containment backup has failed. Heat zones expanding. Recommend immediate hazard avoidance.",
      read: false,
    });
    return { ...state, logs: newLogs };
  }

  if (state.turn === ESCALATION_TIER_2) {
    // Tier 2: New breach spawns in a random unexplored room
    const newEntities = new Map(state.entities);
    const newTiles = cloneTiles(state.tiles);

    // Find a room that doesn't already have a breach and isn't the start room
    let breachSpawned = false;
    const rng = ((state.turn * 1337 + state.seed) >>> 0);
    for (let i = 0; i < state.rooms.length && !breachSpawned; i++) {
      const ri = (rng + i) % state.rooms.length;
      const room = state.rooms[ri];
      if (room.name === "Arrival Bay" || room.name === "Escape Pod Bay") continue;

      // Check for existing breaches in this room
      let hasBreach = false;
      for (const [, entity] of newEntities) {
        if (entity.type === EntityType.Breach &&
            entity.pos.x >= room.x && entity.pos.x < room.x + room.width &&
            entity.pos.y >= room.y && entity.pos.y < room.y + room.height) {
          hasBreach = true;
          break;
        }
      }
      if (hasBreach) continue;

      // Find a walkable tile in the room
      const cx = Math.floor(room.x + room.width / 2);
      const cy = Math.floor(room.y + room.height / 2);
      if (cy >= 0 && cy < state.height && cx >= 0 && cx < state.width && newTiles[cy][cx].walkable) {
        newEntities.set(`cascade_breach_${state.turn}`, {
          id: `cascade_breach_${state.turn}`,
          type: EntityType.Breach,
          pos: { x: cx, y: cy },
          props: { sealed: false },
        });
        newTiles[cy][cx].pressure = 20;
        breachSpawned = true;
      }
    }

    newLogs.push({
      id: `log_escalation_tier2`,
      timestamp: state.turn,
      source: "system",
      text: "⚠ CASCADE FAILURE — New hull breach detected. Pressure dropping in additional sectors. Station structural integrity declining rapidly.",
      read: false,
    });

    return { ...state, entities: newEntities, tiles: newTiles, logs: newLogs };
  }

  if (state.turn === ESCALATION_TIER_3) {
    // Tier 3: Final escalation warning — all hazards at maximum
    newLogs.push({
      id: `log_escalation_tier3`,
      timestamp: state.turn,
      source: "system",
      text: "⚠ CRITICAL FAILURE — Station is breaking apart. All environmental systems offline. Complete evacuation required. Time is running out.",
      read: false,
    });
    return { ...state, logs: newLogs };
  }

  return state;
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

  // Tiered messages based on turn count — blend with existing pools
  // ~30% chance to use a tier-specific message instead of phase/condition pool
  const tierPool = state.turn < 150 ? PA_TIER_EARLY : state.turn < 300 ? PA_TIER_MID : PA_TIER_LATE;
  const useTier = (state.turn * 41) % 100 < 30;

  if (useTier) {
    pool = tierPool;
  } else if ((hasHotZone || hasLowPressure) && turnHash < 40) {
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

  // 50/50 blend with archetype-specific pool when available
  const archetype = state.mystery?.timeline.archetype;
  const archetypePool = archetype ? PA_ANNOUNCEMENTS_BY_ARCHETYPE[archetype] : undefined;
  const useArchetype = archetypePool && archetypePool.length > 0 && (state.turn * 13) % 2 === 0;

  const finalPool = useArchetype ? archetypePool! : pool;
  // Use different hash for archetype pool to avoid index collisions
  const msgIdx = useArchetype
    ? (state.turn * 11 + 5) % finalPool.length
    : (state.turn * 7 + 3) % finalPool.length;
  newLogs.push({
    id: `log_pa_${state.turn}`,
    timestamp: state.turn,
    source: "system",
    text: finalPool[msgIdx],
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
  const dmgMul = getDamageMultiplier(state);
  if (tile.pressure < PRESSURE_DAMAGE_THRESHOLD && tile.pressure >= 0) {
    const pressureDamage = Math.ceil((hasAtmospheric ? Math.ceil(PRESSURE_DAMAGE_PER_TURN / 2) : PRESSURE_DAMAGE_PER_TURN) * dmgMul);
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
    const baseDamage = Math.ceil(HEAT_DAMAGE_PER_TURN * (0.5 + intensity * 1.5) * dmgMul);
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

  // Smoke damage: dense smoke causes minor toxic fume damage
  if (tile.smoke >= SMOKE_DAMAGE_THRESHOLD && tile.heat < HEAT_PAIN_THRESHOLD) {
    const smokeDmg = Math.ceil(SMOKE_DAMAGE_PER_TURN * dmgMul);
    const smokeHp = Math.max(0, state.player.hp - smokeDmg);
    const smokeLogs = [...state.logs];
    if (state.turn % 3 === 0) {
      smokeLogs.push({
        id: `log_smoke_dmg_${state.turn}`,
        timestamp: state.turn,
        source: "system",
        text: `Toxic fumes detected. Ventilation filters degrading. (-${smokeDmg} HP)`,
        read: false,
      });
    }
    state = {
      ...state,
      player: { ...state.player, hp: smokeHp, alive: smokeHp > 0 },
      logs: smokeLogs,
    };
    if (smokeHp <= 0) return state;
  }

  // Recovery: slow heal on cool tiles only
  if (tile.heat < HEAT_PAIN_THRESHOLD && tile.smoke < SMOKE_DAMAGE_THRESHOLD && tile.pressure >= PRESSURE_DAMAGE_THRESHOLD && state.player.hp < state.player.maxHp) {
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
