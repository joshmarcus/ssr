import type { GameState, Entity } from "../shared/types.js";
import {
  ActionType, Direction, EntityType, TileType,
  ObjectivePhase,
} from "../shared/types.js";
import {
  HEAT_PAIN_THRESHOLD,
  PRESSURE_DAMAGE_THRESHOLD,
  RADIATION_DAMAGE_THRESHOLD,
  STRESS_COLLAPSE_THRESHOLD,
  STATION_INTEGRITY_CRITICAL,
} from "../shared/constants.js";
import { isValidAction } from "../sim/actions.js";
import { getObjective, getRoomExits, getDiscoveries } from "../shared/ui.js";

import type {
  HarnessObservation,
  PoiEntry,
  ValidAction,
} from "./types.js";

// ── Constants ────────────────────────────────────────────────

/** Half-width of the map window (total = 2*HALF + 1 = 21). */
const MAP_HALF = 10;
const MAP_SIZE = MAP_HALF * 2 + 1;

/** Direction labels used in the text format. */
const DIR_LABELS: Record<Direction, string> = {
  [Direction.North]: "N",
  [Direction.South]: "S",
  [Direction.East]: "E",
  [Direction.West]: "W",
  [Direction.NorthEast]: "NE",
  [Direction.NorthWest]: "NW",
  [Direction.SouthEast]: "SE",
  [Direction.SouthWest]: "SW",
};

/** Map EntityType to a single-character code for the ASCII map. */
const ENTITY_CHAR: Record<string, string> = {
  [EntityType.Relay]: "R",
  [EntityType.SensorPickup]: "S",
  [EntityType.DataCore]: "D",
  [EntityType.ServiceBot]: "B",
  [EntityType.LogTerminal]: "L",
  [EntityType.CrewItem]: "I",
  [EntityType.Drone]: "d",
  [EntityType.MedKit]: "+",
  [EntityType.RepairBot]: "r",
  [EntityType.Breach]: "O",
  [EntityType.ClosedDoor]: "C",
  [EntityType.SecurityTerminal]: "T",
  [EntityType.PatrolDrone]: "P",
  [EntityType.PressureValve]: "V",
  [EntityType.FuseBox]: "F",
  [EntityType.PowerCell]: "p",
  [EntityType.EvidenceTrace]: "e",
  [EntityType.RadiationSource]: "!",
  [EntityType.ShieldGenerator]: "G",
  [EntityType.ReinforcementPanel]: "N",
  [EntityType.SignalBooster]: "A",
  [EntityType.HiddenDevice]: "?",
  [EntityType.EscapePod]: "E",
  [EntityType.CrewNPC]: "H",
  [EntityType.RepairCradle]: "M",
  [EntityType.Rubble]: "X",
};

/** Human-readable name for entity types. */
const ENTITY_NAME: Record<string, string> = {
  [EntityType.Relay]: "Relay",
  [EntityType.SensorPickup]: "SensorPickup",
  [EntityType.DataCore]: "DataCore",
  [EntityType.ServiceBot]: "ServiceBot",
  [EntityType.LogTerminal]: "LogTerminal",
  [EntityType.CrewItem]: "CrewItem",
  [EntityType.Drone]: "Drone",
  [EntityType.MedKit]: "MedKit",
  [EntityType.RepairBot]: "RepairBot",
  [EntityType.Breach]: "Breach",
  [EntityType.ClosedDoor]: "ClosedDoor",
  [EntityType.SecurityTerminal]: "SecurityTerminal",
  [EntityType.PatrolDrone]: "PatrolDrone",
  [EntityType.PressureValve]: "PressureValve",
  [EntityType.FuseBox]: "FuseBox",
  [EntityType.PowerCell]: "PowerCell",
  [EntityType.EvidenceTrace]: "EvidenceTrace",
  [EntityType.RadiationSource]: "RadiationSource",
  [EntityType.ShieldGenerator]: "ShieldGenerator",
  [EntityType.ReinforcementPanel]: "ReinforcementPanel",
  [EntityType.SignalBooster]: "SignalBooster",
  [EntityType.HiddenDevice]: "HiddenDevice",
  [EntityType.EscapePod]: "EscapePod",
  [EntityType.CrewNPC]: "CrewNPC",
  [EntityType.RepairCradle]: "RepairCradle",
  [EntityType.Rubble]: "Rubble",
};

// ── Helpers ──────────────────────────────────────────────────

function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/**
 * Find which room a position is in, or return "Corridor".
 */
function roomNameAt(state: GameState, x: number, y: number): string {
  for (const room of state.rooms) {
    if (x >= room.x && x < room.x + room.width &&
        y >= room.y && y < room.y + room.height) {
      return room.name;
    }
  }
  return "Corridor";
}

/**
 * Determine whether an entity is adjacent (4-directional or co-located) to the player.
 */
function isAdjacent(px: number, py: number, ex: number, ey: number): boolean {
  return manhattan(px, py, ex, ey) <= 1;
}

/**
 * Check if an entity is exhausted (no meaningful interaction left).
 * Mirrors the logic in step.ts isEntityExhausted.
 */
function isEntityExhausted(entity: Entity, state: GameState): boolean {
  switch (entity.type) {
    case EntityType.Breach:
      return entity.props["sealed"] === true;
    case EntityType.MedKit:
      return entity.props["used"] === true;
    case EntityType.Relay:
      return entity.props["activated"] === true || entity.props["locked"] === true;
    case EntityType.ClosedDoor:
      return entity.props["closed"] === false;
    case EntityType.SecurityTerminal:
      return false;
    case EntityType.CrewItem:
      return entity.props["examined"] === true || entity.props["hidden"] === true;
    case EntityType.LogTerminal:
      return state.logs.some(l => l.id === `log_terminal_${entity.id}`);
    case EntityType.PatrolDrone:
    case EntityType.Drone:
    case EntityType.RepairBot:
      return true;
    case EntityType.PressureValve:
      return entity.props["turned"] === true;
    case EntityType.FuseBox:
      return entity.props["powered"] === true;
    case EntityType.PowerCell:
      return entity.props["collected"] === true;
    case EntityType.EvidenceTrace:
      return entity.props["discovered"] === true;
    case EntityType.RadiationSource:
      return true;
    case EntityType.ShieldGenerator:
      return entity.props["activated"] === true;
    case EntityType.ReinforcementPanel:
      return entity.props["installed"] === true;
    case EntityType.SignalBooster:
      return entity.props["activated"] === true;
    case EntityType.HiddenDevice:
      return entity.props["discovered"] === true;
    case EntityType.CrewNPC:
      return entity.props["evacuated"] === true || entity.props["dead"] === true;
    case EntityType.EscapePod:
      return ((entity.props["boarded"] as number) || 0) >=
             ((entity.props["capacity"] as number) || 3);
    case EntityType.RepairCradle:
      return false;
    case EntityType.Rubble:
      return true;
    default:
      return false;
  }
}

/**
 * Extract key attributes from an entity for the POI entry.
 */
function extractAttrs(entity: Entity): Record<string, unknown> {
  const attrs: Record<string, unknown> = {};
  const p = entity.props;

  switch (entity.type) {
    case EntityType.Relay:
      if (p["overheating"] !== undefined) attrs["overheating"] = p["overheating"];
      if (p["activated"] !== undefined) attrs["activated"] = p["activated"];
      if (p["locked"] !== undefined) attrs["locked"] = p["locked"];
      break;
    case EntityType.ClosedDoor:
      if (p["closed"] !== undefined) attrs["closed"] = p["closed"];
      if (p["locked"] !== undefined) attrs["locked"] = p["locked"];
      if (p["keyType"] !== undefined) attrs["keyType"] = p["keyType"];
      break;
    case EntityType.Breach:
      if (p["sealed"] !== undefined) attrs["sealed"] = p["sealed"];
      break;
    case EntityType.MedKit:
      if (p["used"] !== undefined) attrs["used"] = p["used"];
      break;
    case EntityType.SensorPickup:
      if (p["sensorType"] !== undefined) attrs["sensorType"] = p["sensorType"];
      if (p["collected"] !== undefined) attrs["collected"] = p["collected"];
      break;
    case EntityType.DataCore:
      if (p["transmitted"] !== undefined) attrs["transmitted"] = p["transmitted"];
      break;
    case EntityType.LogTerminal:
      if (p["title"] !== undefined) attrs["title"] = p["title"];
      break;
    case EntityType.PressureValve:
      if (p["turned"] !== undefined) attrs["turned"] = p["turned"];
      break;
    case EntityType.FuseBox:
      if (p["powered"] !== undefined) attrs["powered"] = p["powered"];
      break;
    case EntityType.PowerCell:
      if (p["collected"] !== undefined) attrs["collected"] = p["collected"];
      break;
    case EntityType.ShieldGenerator:
      if (p["activated"] !== undefined) attrs["activated"] = p["activated"];
      break;
    case EntityType.ReinforcementPanel:
      if (p["installed"] !== undefined) attrs["installed"] = p["installed"];
      break;
    case EntityType.SignalBooster:
      if (p["activated"] !== undefined) attrs["activated"] = p["activated"];
      break;
    case EntityType.EvidenceTrace:
      if (p["discovered"] !== undefined) attrs["discovered"] = p["discovered"];
      break;
    case EntityType.HiddenDevice:
      if (p["discovered"] !== undefined) attrs["discovered"] = p["discovered"];
      break;
    case EntityType.SecurityTerminal:
      if (p["accessed"] !== undefined) attrs["accessed"] = p["accessed"];
      break;
    case EntityType.CrewNPC:
      if (p["name"] !== undefined) attrs["name"] = p["name"];
      if (p["evacuated"] !== undefined) attrs["evacuated"] = p["evacuated"];
      if (p["dead"] !== undefined) attrs["dead"] = p["dead"];
      break;
    case EntityType.EscapePod:
      if (p["boarded"] !== undefined) attrs["boarded"] = p["boarded"];
      if (p["capacity"] !== undefined) attrs["capacity"] = p["capacity"];
      if (p["powered"] !== undefined) attrs["powered"] = p["powered"];
      break;
    case EntityType.ServiceBot:
      if (p["active"] !== undefined) attrs["active"] = p["active"];
      break;
    case EntityType.PatrolDrone:
      if (p["hostile"] !== undefined) attrs["hostile"] = p["hostile"];
      break;
    case EntityType.RepairCradle:
      if (p["uses"] !== undefined) attrs["uses"] = p["uses"];
      break;
    default:
      break;
  }
  return attrs;
}

// ── Tile char for ASCII map ─────────────────────────────────

function tileChar(state: GameState, x: number, y: number): string {
  const tile = state.tiles[y][x];

  // Hazard overlays first (heat and smoke are important)
  if (tile.heat >= HEAT_PAIN_THRESHOLD) return "~";
  if (tile.smoke >= 30) return "%";
  if (tile.radiation >= 30) return "*";

  switch (tile.type) {
    case TileType.Wall:
      return "#";
    case TileType.Door:
      return "+";
    case TileType.LockedDoor:
      return "+";
    case TileType.Floor:
    case TileType.Corridor:
      return ".";
    default:
      return " ";
  }
}

// ── Build observation ───────────────────────────────────────

/**
 * Build a structured observation from the current game state.
 *
 * @param state   The current GameState.
 * @param visibility  "full" reveals all tiles/entities;
 *                    "player" respects fog-of-war (tile.visible).
 */
export function buildObservation(
  state: GameState,
  visibility: "full" | "player",
): HarnessObservation {
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;

  // ── Player info ──
  const hp = state.player.hp;
  const maxHp = state.player.maxHp;
  const currentRoom = roomNameAt(state, px, py);
  const roomObj = state.rooms.find(r =>
    px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height
  ) ?? null;
  const roomExits = roomObj ? getRoomExits(state, roomObj) : [];

  // ── Sensors ──
  const sensors = state.player.sensors ?? [];
  const sensorNames: string[] = sensors.map(s => s as string);
  const activeSensor: string | null = sensors.length > 0 ? sensors[sensors.length - 1] : null;

  // ── Objective ──
  const objectivePhase = state.mystery?.objectivePhase ?? ObjectivePhase.Clean;
  const objective = getObjective(state);
  const disc = getDiscoveries(state);

  // ── Map window (21x21 centered on player) ──
  const mapLines: string[] = [];
  // Build entity position lookup for fast overlay
  const entityAt = new Map<string, Entity>();
  for (const [, entity] of state.entities) {
    if (entity.id === "player") continue;
    const key = `${entity.pos.x},${entity.pos.y}`;
    // Only store entity if visible or full visibility
    if (visibility === "full" || isTileVisible(state, entity.pos.x, entity.pos.y)) {
      entityAt.set(key, entity);
    }
  }

  for (let dy = -MAP_HALF; dy <= MAP_HALF; dy++) {
    let row = "";
    for (let dx = -MAP_HALF; dx <= MAP_HALF; dx++) {
      const wx = px + dx;
      const wy = py + dy;

      // Player position
      if (dx === 0 && dy === 0) {
        row += "@";
        continue;
      }

      // Out of bounds
      if (wx < 0 || wx >= state.width || wy < 0 || wy >= state.height) {
        row += " ";
        continue;
      }

      // Visibility check
      const tile = state.tiles[wy][wx];
      if (visibility === "player" && !tile.visible && !tile.explored) {
        row += " ";
        continue;
      }

      // Fog (explored but not currently visible) — show terrain only, dimmed
      if (visibility === "player" && !tile.visible && tile.explored) {
        row += tileChar(state, wx, wy);
        continue;
      }

      // Entity overlay
      const entKey = `${wx},${wy}`;
      const ent = entityAt.get(entKey);
      if (ent) {
        row += ENTITY_CHAR[ent.type] ?? "?";
        continue;
      }

      row += tileChar(state, wx, wy);
    }
    mapLines.push(row);
  }
  const mapText = mapLines.join("\n");

  // ── POI list ──
  const poi: PoiEntry[] = [];
  for (const [, entity] of state.entities) {
    if (entity.id === "player") continue;

    // Visibility filter
    if (visibility === "player" && !isTileVisible(state, entity.pos.x, entity.pos.y)) {
      continue;
    }

    const dist = manhattan(px, py, entity.pos.x, entity.pos.y);
    const adjacent = isAdjacent(px, py, entity.pos.x, entity.pos.y);
    const exhausted = isEntityExhausted(entity, state);
    const interactable = adjacent && !exhausted;

    const displayName = (entity.props["name"] as string) ??
                        (entity.props["title"] as string) ??
                        ENTITY_NAME[entity.type] ?? entity.type;

    poi.push({
      id: entity.id,
      type: ENTITY_NAME[entity.type] ?? entity.type,
      name: displayName,
      pos: { x: entity.pos.x, y: entity.pos.y },
      distance: dist,
      interactable,
      attrs: extractAttrs(entity),
    });
  }

  // Sort POI by distance (closest first)
  poi.sort((a, b) => a.distance - b.distance);

  // ── Valid actions ──
  const validActions: ValidAction[] = [];

  // MOVE in all 8 directions
  const allDirections: Direction[] = [
    Direction.North, Direction.South, Direction.East, Direction.West,
    Direction.NorthEast, Direction.NorthWest, Direction.SouthEast, Direction.SouthWest,
  ];
  for (const dir of allDirections) {
    const moveAction = { type: ActionType.Move, direction: dir };
    if (isValidAction(state, moveAction)) {
      validActions.push({
        type: "MOVE",
        params: { dir: DIR_LABELS[dir] },
        description: `Move ${DIR_LABELS[dir]}`,
      });
    }
  }

  // INTERACT with adjacent non-exhausted entities
  for (const entry of poi) {
    if (entry.interactable) {
      validActions.push({
        type: "INTERACT",
        params: { target: entry.id },
        description: `Interact with ${entry.type} "${entry.name}" (${entry.id})`,
      });
    }
  }

  // SCAN, CLEAN, WAIT are always available
  validActions.push({
    type: "SCAN",
    description: "Scan surroundings with active sensor",
  });
  validActions.push({
    type: "CLEAN",
    description: "Clean current tile",
  });
  validActions.push({
    type: "WAIT",
    description: "Wait one turn",
  });

  // ── Recent logs (last 5) ──
  const recentLogs = state.logs
    .slice(-5)
    .map(l => `[T${l.timestamp}] ${l.text}`);

  // ── Alerts ──
  const alerts: string[] = [];
  const playerTile = state.tiles[py][px];

  if (playerTile.heat >= HEAT_PAIN_THRESHOLD) {
    alerts.push(`High heat on current tile (${playerTile.heat})`);
  }
  // Check adjacent tiles for heat warnings
  for (const [dx, dy] of [[0, -1], [0, 1], [1, 0], [-1, 0]]) {
    const ax = px + dx;
    const ay = py + dy;
    if (ax >= 0 && ax < state.width && ay >= 0 && ay < state.height) {
      if (state.tiles[ay][ax].heat >= HEAT_PAIN_THRESHOLD) {
        alerts.push(`High heat detected nearby (${state.tiles[ay][ax].heat})`);
        break; // one alert is enough
      }
    }
  }

  if (playerTile.pressure < PRESSURE_DAMAGE_THRESHOLD) {
    alerts.push(`Low pressure on current tile (${playerTile.pressure})`);
  }

  if (playerTile.radiation >= RADIATION_DAMAGE_THRESHOLD) {
    alerts.push(`High radiation on current tile (${playerTile.radiation})`);
  }

  if (playerTile.stress >= STRESS_COLLAPSE_THRESHOLD) {
    alerts.push(`Structural stress critical (${playerTile.stress}) — collapse imminent`);
  }

  if (hp <= maxHp * 0.25) {
    alerts.push(`Low HP: ${hp}/${maxHp}`);
  }

  if (state.stationIntegrity <= STATION_INTEGRITY_CRITICAL) {
    alerts.push(`Station integrity critical: ${state.stationIntegrity}%`);
  }

  if (state.player.stunTurns > 0) {
    alerts.push(`Stunned for ${state.player.stunTurns} more turn(s)`);
  }

  return {
    turn: state.turn,
    seed: state.seed,
    gameOver: state.gameOver,
    victory: state.victory,
    hp,
    maxHp,
    pos: { x: px, y: py },
    currentRoom,
    roomExits,
    sensors: sensorNames,
    activeSensor,
    stationIntegrity: state.stationIntegrity,
    objectivePhase,
    objectiveText: objective.text,
    objectiveDetail: objective.detail,
    stunTurns: state.player.stunTurns ?? 0,
    discoveries: `${disc.discovered}/${disc.total}`,
    mapText,
    poi,
    validActions,
    recentLogs,
    alerts,
  };
}

// ── Render observation to text ──────────────────────────────

/**
 * Render a HarnessObservation to a human/LLM-readable text block.
 */
export function renderObservationAsText(obs: HarnessObservation): string {
  const lines: string[] = [];

  // Header
  lines.push(`=== TURN ${obs.turn} | SEED ${obs.seed} | ${obs.currentRoom} ===`);
  lines.push(
    `HP: ${obs.hp}/${obs.maxHp} | Integrity: ${obs.stationIntegrity}% | Phase: ${obs.objectivePhase}`,
  );
  const sensorStr = obs.activeSensor ?? "None";
  lines.push(`Sensor: ${sensorStr} | Pos: (${obs.pos.x}, ${obs.pos.y})`);

  if (obs.gameOver) {
    lines.push(obs.victory ? ">>> VICTORY <<<" : ">>> GAME OVER <<<");
  }

  // Alerts
  if (obs.alerts.length > 0) {
    lines.push("");
    lines.push("ALERTS:");
    for (const alert of obs.alerts) {
      lines.push(`  ! ${alert}`);
    }
  }

  // Map
  lines.push("");
  lines.push(`MAP (${MAP_SIZE}x${MAP_SIZE}, @ = you):`);
  lines.push(obs.mapText);

  // POI
  if (obs.poi.length > 0) {
    lines.push("");
    lines.push("ENTITIES NEARBY:");
    for (const p of obs.poi) {
      const interactTag = p.interactable ? " [INTERACT]" : "";
      const attrsStr = Object.keys(p.attrs).length > 0
        ? ` {${Object.entries(p.attrs).map(([k, v]) => `${k}:${String(v)}`).join(", ")}}`
        : "";
      lines.push(
        `  ${p.id.padEnd(16)} ${p.type.padEnd(22)} (${p.pos.x},${p.pos.y}) dist=${p.distance}${interactTag}${attrsStr}`,
      );
    }
  }

  // Valid actions
  lines.push("");
  lines.push("VALID ACTIONS:");
  const moveActions = obs.validActions.filter(a => a.type === "MOVE");
  if (moveActions.length > 0) {
    const dirs = moveActions.map(a => `MOVE ${(a.params as Record<string, unknown>)["dir"]}`);
    lines.push(`  ${dirs.join(" | ")}`);
  }
  const interactActions = obs.validActions.filter(a => a.type === "INTERACT");
  if (interactActions.length > 0) {
    const targets = interactActions.map(
      a => `INTERACT ${(a.params as Record<string, unknown>)["target"]}`,
    );
    lines.push(`  ${targets.join(" | ")}`);
  }
  const otherActions = obs.validActions.filter(
    a => a.type !== "MOVE" && a.type !== "INTERACT",
  );
  if (otherActions.length > 0) {
    lines.push(`  ${otherActions.map(a => a.type).join(" | ")}`);
  }

  // Recent logs
  if (obs.recentLogs.length > 0) {
    lines.push("");
    lines.push("RECENT LOGS:");
    for (const log of obs.recentLogs) {
      lines.push(`  ${log}`);
    }
  }

  return lines.join("\n");
}

// ── Internal helpers ────────────────────────────────────────

/**
 * Check if a tile is currently visible to the player.
 */
function isTileVisible(state: GameState, x: number, y: number): boolean {
  if (x < 0 || x >= state.width || y < 0 || y >= state.height) return false;
  return state.tiles[y][x].visible;
}
