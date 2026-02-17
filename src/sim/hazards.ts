import type { GameState, Tile } from "../shared/types.js";
import { TileType, EntityType, AttachmentSlot, SensorType } from "../shared/types.js";
import {
  HEAT_SPREAD_RATE, SMOKE_SPREAD_RATE, HEAT_DECAY_RATE, HEAT_SOURCE_RATE, HEAT_SOURCE_CAP,
  HEAT_DAMAGE_PER_TURN, HEAT_PAIN_THRESHOLD, COOL_RECOVERY_RATE, HEAT_SPREAD_MIN,
  PRESSURE_BREACH_DRAIN, PRESSURE_SPREAD_RATE, PRESSURE_DAMAGE_THRESHOLD, PRESSURE_DAMAGE_PER_TURN,
  PRESSURE_BULKHEAD_THRESHOLD, DETERIORATION_INTERVAL, DETERIORATION_HEAT_BOOST, DETERIORATION_SMOKE_SPAWN,
  RADIATION_SPREAD_RATE, RADIATION_SPREAD_RANGE, RADIATION_DAMAGE_THRESHOLD, RADIATION_DAMAGE_PER_TURN,
  RADIATION_DAMAGE_NO_SENSOR, RADIATION_SOURCE_RATE, RADIATION_SOURCE_CAP, RADIATION_DECAY_RATE,
  SHIELD_GENERATOR_RADIUS, STRESS_COLLAPSE_THRESHOLD, STRESS_COLLAPSE_TURNS, STRESS_SPREAD_RATE,
  GLYPHS,
} from "../shared/constants.js";

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
 * Tick radiation: sources emit, radiation spreads (through walls), decays slowly.
 * Shield generators with activated=true zero radiation within their radius.
 */
export function tickRadiation(state: GameState): GameState {
  const oldTiles = state.tiles;
  const newTiles = cloneTiles(oldTiles);

  // Collect radiation source positions
  const radiationSources: { x: number; y: number }[] = [];
  for (const [, entity] of state.entities) {
    if (entity.type === EntityType.RadiationSource) {
      radiationSources.push({ x: entity.pos.x, y: entity.pos.y });
    }
  }

  // Inject radiation at source tiles
  for (const src of radiationSources) {
    if (src.y >= 0 && src.y < state.height && src.x >= 0 && src.x < state.width) {
      newTiles[src.y][src.x].radiation = Math.min(
        RADIATION_SOURCE_CAP,
        newTiles[src.y][src.x].radiation + RADIATION_SOURCE_RATE,
      );
    }
  }

  // Spread radiation: CRITICAL — radiation penetrates walls (unlike heat)
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const tile = oldTiles[y][x];
      if (tile.radiation <= 0) continue;

      for (let dy = -RADIATION_SPREAD_RANGE; dy <= RADIATION_SPREAD_RANGE; dy++) {
        for (let dx = -RADIATION_SPREAD_RANGE; dx <= RADIATION_SPREAD_RANGE; dx++) {
          if (dx === 0 && dy === 0) continue;
          const dist = Math.abs(dx) + Math.abs(dy);
          if (dist > RADIATION_SPREAD_RANGE) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
          // Radiation penetrates walls — no walkable check
          const spreadAmount = Math.max(1, Math.floor(RADIATION_SPREAD_RATE * (tile.radiation / 100) / dist));
          newTiles[ny][nx].radiation = Math.min(100, newTiles[ny][nx].radiation + spreadAmount);
        }
      }
    }
  }

  // Natural radiation decay (very slow)
  const sourceSet = new Set(radiationSources.map(s => `${s.x},${s.y}`));
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (sourceSet.has(`${x},${y}`)) continue; // sources don't decay
      if (newTiles[y][x].radiation > 0) {
        newTiles[y][x].radiation = Math.max(0, newTiles[y][x].radiation - RADIATION_DECAY_RATE);
      }
    }
  }

  // Shield generators: zero radiation within radius when activated
  for (const [, entity] of state.entities) {
    if (entity.type === EntityType.ShieldGenerator && entity.props["activated"] === true) {
      const sx = entity.pos.x;
      const sy = entity.pos.y;
      for (let dy = -SHIELD_GENERATOR_RADIUS; dy <= SHIELD_GENERATOR_RADIUS; dy++) {
        for (let dx = -SHIELD_GENERATOR_RADIUS; dx <= SHIELD_GENERATOR_RADIUS; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > SHIELD_GENERATOR_RADIUS) continue;
          const nx = sx + dx;
          const ny = sy + dy;
          if (nx >= 0 && nx < state.width && ny >= 0 && ny < state.height) {
            newTiles[ny][nx].radiation = 0;
          }
        }
      }
    }
  }

  return { ...state, tiles: newTiles };
}

/**
 * Tick structural stress: spreads to adjacent walkable tiles, collapses tiles
 * that exceed threshold for too many turns. ReinforcementPanel prevents collapse.
 */
export function tickStructuralStress(state: GameState): GameState {
  const oldTiles = state.tiles;
  const newTiles = cloneTiles(oldTiles);
  const newEntities = new Map(state.entities);

  // Collect reinforced positions (tile + adjacent tiles)
  const reinforcedPositions = new Set<string>();
  for (const [, entity] of state.entities) {
    if (entity.type === EntityType.ReinforcementPanel && entity.props["installed"] === true) {
      const ex = entity.pos.x;
      const ey = entity.pos.y;
      reinforcedPositions.add(`${ex},${ey}`);
      for (const d of ADJACENT_DELTAS) {
        reinforcedPositions.add(`${ex + d.x},${ey + d.y}`);
      }
    }
  }

  // Spread stress to adjacent walkable tiles
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const tile = oldTiles[y][x];
      if (tile.stress <= 0) continue;

      for (const d of ADJACENT_DELTAS) {
        const nx = x + d.x;
        const ny = y + d.y;
        if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
        if (!oldTiles[ny][nx].walkable) continue;
        newTiles[ny][nx].stress = Math.min(100, newTiles[ny][nx].stress + STRESS_SPREAD_RATE);
      }
    }
  }

  // Check collapse conditions
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      if (reinforcedPositions.has(`${x},${y}`)) {
        // Reinforced tiles cannot collapse — reset stressTurns
        newTiles[y][x].stressTurns = 0;
        continue;
      }

      if (newTiles[y][x].stress >= STRESS_COLLAPSE_THRESHOLD) {
        newTiles[y][x].stressTurns++;

        if (newTiles[y][x].stressTurns >= STRESS_COLLAPSE_TURNS) {
          // Tile collapses — drop rubble (blocks movement, cleanable)
          newTiles[y][x].walkable = false;
          newTiles[y][x].stress = 0;
          newTiles[y][x].stressTurns = 0;
          // Place rubble entity (if not already present and not player's tile)
          const px = state.player.entity.pos.x;
          const py = state.player.entity.pos.y;
          if (!(x === px && y === py)) {
            const rubbleId = `rubble_${x}_${y}`;
            if (!newEntities.has(rubbleId)) {
              newEntities.set(rubbleId, {
                id: rubbleId,
                type: EntityType.Rubble,
                pos: { x, y },
                props: {},
              });
            }
          }
        }
      } else {
        // Below threshold — reset counter
        newTiles[y][x].stressTurns = 0;
      }
    }
  }

  return { ...state, tiles: newTiles, entities: newEntities };
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
        const spreadAmount = Math.ceil(HEAT_SPREAD_RATE * (tile.heat / 100));
        for (const d of ADJACENT_DELTAS) {
          const nx = x + d.x;
          const ny = y + d.y;
          if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
          const neighbor = oldTiles[ny][nx];
          if (!neighbor.walkable) continue;
          newTiles[ny][nx].heat = Math.min(100, newTiles[ny][nx].heat + spreadAmount);
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

  // Natural heat/smoke decay: non-source tiles slowly lose heat.
  // Decay (1) < spread (3) means zones expand over time.
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

  // ── Emergency bulkhead auto-seal ───────────────────────────
  // When pressure drops critically low, adjacent doors auto-lock
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

  let result: GameState = { ...state, tiles: newTiles };

  // Tick radiation system
  result = tickRadiation(result);

  // Structural stress: drops rubble (cleanable) instead of walls
  result = tickStructuralStress(result);

  return result;
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
    "WARNING: Station integrity declining. Hull stress increasing.",
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
 * Apply gradual heat and pressure damage to the player.
 * Damage scales with intensity — standing in high heat is quickly fatal.
 */
export function applyHazardDamage(inputState: GameState): GameState {
  let state = inputState;
  const { x, y } = state.player.entity.pos;
  const tile = state.tiles[y][x];

  if (!state.player.alive) return state;

  // Sensor-based damage reduction
  const equippedSensor = state.player.attachments[AttachmentSlot.Sensor];
  const hasThermal = equippedSensor?.sensorType === SensorType.Thermal;
  const hasAtmospheric = equippedSensor?.sensorType === SensorType.Atmospheric;
  const hasRadiation = equippedSensor?.sensorType === SensorType.Radiation;

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

  // Radiation damage: doubled without radiation sensor
  if (tile.radiation >= RADIATION_DAMAGE_THRESHOLD) {
    const radDamage = hasRadiation ? RADIATION_DAMAGE_PER_TURN : RADIATION_DAMAGE_NO_SENSOR;
    const radHp = Math.max(0, state.player.hp - radDamage);
    const radLogs = [...state.logs];
    if (state.turn % 2 === 0 || radHp <= 0) {
      const radMsgs = [
        "Radiation exposure detected. Shielding inadequate.",
        "WARNING: Ionizing radiation exceeds safety limits.",
        "Geiger counter spiking. Circuit boards degrading.",
        "Radiation damage accumulating. Seek shielded area.",
      ];
      radLogs.push({
        id: `log_radiation_warn_${state.turn}`,
        timestamp: state.turn,
        source: "system",
        text: `${radMsgs[state.turn % radMsgs.length]} (-${radDamage} HP, ${radHp}/${state.player.maxHp})`,
        read: false,
      });
    }
    state = {
      ...state,
      player: {
        ...state.player,
        hp: radHp,
        alive: radHp > 0,
      },
      logs: radLogs,
    };
    if (radHp <= 0) return state;
  }

  // Recovery: slow heal on cool tiles only
  if (tile.heat < HEAT_PAIN_THRESHOLD && tile.pressure >= PRESSURE_DAMAGE_THRESHOLD && tile.radiation < RADIATION_DAMAGE_THRESHOLD && state.player.hp < state.player.maxHp) {
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
