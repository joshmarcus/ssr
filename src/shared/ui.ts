/**
 * Shared UI helper functions used by both the browser display (render/display.ts)
 * and the AI harness (harness/claudeDriver.ts).
 *
 * All functions are pure — they take GameState and return data.
 */

import type { GameState, Entity, Room } from "./types.js";
import { EntityType, TileType } from "./types.js";

// ── Objective computation ─────────────────────────────────────

export interface Objective {
  text: string;
  detail: string;
}

export function getObjective(state: GameState): Objective {
  if (state.gameOver) {
    return state.victory
      ? { text: "MISSION COMPLETE", detail: "Transmission sent. The crew's work survives." }
      : { text: "CONNECTION LOST", detail: "Refresh to try again." };
  }

  const phase = state.mystery?.objectivePhase;
  const sensors = state.player.sensors ?? [];

  // Count relay status
  let totalRelays = 0;
  let activatedRelays = 0;
  for (const [, e] of state.entities) {
    if (e.type === EntityType.Relay && e.props["locked"] !== true) {
      totalRelays++;
      if (e.props["activated"] === true) activatedRelays++;
    }
  }
  const remainingRelays = totalRelays - activatedRelays;

  // Count sensor pickups still on the map
  const sensorPickups = Array.from(state.entities.values()).filter(e => e.type === EntityType.SensorPickup);

  // Data core status
  const dataCore = Array.from(state.entities.values()).find(e => e.type === EntityType.DataCore);
  const hasLockedDoor = state.tiles.some(row => row.some(t => t.type === TileType.LockedDoor));

  // ── Phase: Clean
  if (phase === "clean") {
    const cleaned = state.mystery?.roomsCleanedCount ?? 0;
    const trigger = state.mystery?.investigationTrigger ?? 3;
    return {
      text: `Clean the station (${cleaned}/${trigger} rooms)`,
      detail: "Clean each room to 80%. You can't leave until the room is clean. Press [c] to clean, [t] to toggle cleanliness overlay.",
    };
  }

  // ── Phase: Investigate
  if (phase === "investigate") {
    const journalCount = state.mystery?.journal.length ?? 0;
    const threshold = state.mystery?.evidenceThreshold ?? 5;

    if (sensorPickups.length > 0 && sensors.length <= 1) {
      return {
        text: `Investigate: find sensors and evidence (${journalCount}/${threshold})`,
        detail: "Explore rooms. Pick up sensor upgrades (S) and interact with terminals (T), crew items (*), and evidence traces (?) to learn what happened.",
      };
    }

    if (remainingRelays > 0) {
      return {
        text: `Investigate: reroute relays and gather evidence (${journalCount}/${threshold})`,
        detail: `Reroute overheating relays (R) with [i] — ${activatedRelays}/${totalRelays} done. Read logs and examine evidence to piece together the mystery.`,
      };
    }

    return {
      text: `Investigate: gather evidence (${journalCount}/${threshold})`,
      detail: "Interact with terminals, crew items, and evidence traces. Press [r] to broadcast a report when ready.",
    };
  }

  // ── Phase: Recover
  if (phase === "recover") {
    if (remainingRelays > 0) {
      return {
        text: `Restore station systems (${activatedRelays}/${totalRelays} relays)`,
        detail: "Reroute remaining relays to stabilize the station. Seal hull breaches. Prepare for data transmission.",
      };
    }

    if (dataCore && hasLockedDoor) {
      return {
        text: "Reach the Data Core",
        detail: "All relays rerouted. Find a way past the locked door to reach the data core.",
      };
    }

    return {
      text: "Transmit from the Data Core",
      detail: "Find the data core (D) and press [i] to transmit the research data and complete the mission.",
    };
  }

  // ── Phase: Evacuate
  if (phase === "evacuate") {
    const evac = state.mystery?.evacuation;
    const rescued = evac?.crewEvacuated?.length ?? 0;
    const total = (evac?.crewFound?.length ?? 0) + rescued + (evac?.crewDead?.length ?? 0);
    return {
      text: `Evacuate crew (${rescued}/${total} rescued)`,
      detail: "Guide surviving crew to escape pods. Interact with crew members to have them follow you, then lead them to escape pods (E).",
    };
  }

  // ── Fallback
  return {
    text: "Explore the station",
    detail: "Search rooms for equipment and clues about what happened.",
  };
}

// ── Room exits ────────────────────────────────────────────────

export function getRoomExits(state: GameState, room: Room): string[] {
  const exits: string[] = [];
  const { x, y, width, height } = room;

  // Check north edge (y - 1)
  if (y > 0) {
    for (let rx = x; rx < x + width; rx++) {
      if (state.tiles[y - 1]?.[rx]?.walkable) { exits.push("N"); break; }
    }
  }
  // Check south edge (y + height)
  if (y + height < state.height) {
    for (let rx = x; rx < x + width; rx++) {
      if (state.tiles[y + height]?.[rx]?.walkable) { exits.push("S"); break; }
    }
  }
  // Check west edge (x - 1)
  if (x > 0) {
    for (let ry = y; ry < y + height; ry++) {
      if (state.tiles[ry]?.[x - 1]?.walkable) { exits.push("W"); break; }
    }
  }
  // Check east edge (x + width)
  if (x + width < state.width) {
    for (let ry = y; ry < y + height; ry++) {
      if (state.tiles[ry]?.[x + width]?.walkable) { exits.push("E"); break; }
    }
  }

  return exits;
}

// ── Discovery counter ─────────────────────────────────────────

export function getDiscoveries(state: GameState): { discovered: number; total: number } {
  let total = 0;
  let discovered = 0;
  for (const [, entity] of state.entities) {
    if (entity.type === EntityType.CrewItem && entity.props["hidden"] !== true) {
      total++;
      if (entity.props["examined"] === true) discovered++;
    }
    if (entity.type === EntityType.LogTerminal) {
      total++;
      if (state.logs.some(l => l.id === `log_terminal_${entity.id}`)) discovered++;
    }
    if (entity.type === EntityType.CrewItem && entity.props["hidden"] === true && entity.props["revealed"] === true) {
      total++;
      if (entity.props["examined"] === true) discovered++;
    }
  }
  return { discovered, total };
}

// ── Entity display names ──────────────────────────────────────

const ENTITY_NAMES: Record<string, string> = {
  [EntityType.Relay]: "Power Relay",
  [EntityType.SensorPickup]: "Sensor Pickup",
  [EntityType.DataCore]: "Data Core",
  [EntityType.ServiceBot]: "Service Bot",
  [EntityType.LogTerminal]: "Log Terminal",
  [EntityType.CrewItem]: "Crew Item",
  [EntityType.Drone]: "Drone",
  [EntityType.MedKit]: "Med Kit",
  [EntityType.RepairBot]: "Repair Bot",
  [EntityType.Breach]: "Hull Breach",
  [EntityType.ClosedDoor]: "Closed Door",
  [EntityType.SecurityTerminal]: "Security Terminal",
  [EntityType.PatrolDrone]: "Patrol Drone",
  [EntityType.PressureValve]: "Pressure Valve",
  [EntityType.FuseBox]: "Fuse Box",
  [EntityType.PowerCell]: "Power Cell",
  [EntityType.EvidenceTrace]: "Evidence Trace",
  [EntityType.EscapePod]: "Escape Pod",
  [EntityType.CrewNPC]: "Crew NPC",
  [EntityType.RepairCradle]: "Repair Cradle",
  [EntityType.Console]: "Console",
  [EntityType.Airlock]: "Airlock",
  [EntityType.ToolPickup]: "Pry Bar",
};

export function entityDisplayName(entity: Entity): string {
  return ENTITY_NAMES[entity.type] ?? entity.type;
}

// ── Entity exhaustion check ───────────────────────────────────

export function isEntityExhausted(entity: Entity): boolean {
  switch (entity.type) {
    case EntityType.Breach:
      return entity.props["sealed"] === true;
    case EntityType.MedKit:
      return entity.props["used"] === true;
    case EntityType.Relay:
      return entity.props["activated"] === true || entity.props["locked"] === true;
    case EntityType.ClosedDoor:
      return entity.props["locked"] === true;
    case EntityType.Airlock:
      return false; // always toggleable
    case EntityType.SecurityTerminal:
      return false; // always interactable (door lock toggle after first access)
    case EntityType.Console:
      return entity.props["read"] === true;
    case EntityType.CrewItem:
      return entity.props["examined"] === true || entity.props["hidden"] === true;
    case EntityType.PressureValve:
      return entity.props["turned"] === true;
    case EntityType.FuseBox:
      return entity.props["powered"] === true;
    case EntityType.PowerCell:
      return entity.props["collected"] === true;
    case EntityType.EvidenceTrace:
      return entity.props["discovered"] === true || entity.props["scanHidden"] === true;
    case EntityType.SensorPickup:
      return entity.props["collected"] === true;
    case EntityType.ToolPickup:
      return entity.props["collected"] === true;
    case EntityType.DataCore:
      return false; // always interactable (transmit when ready)
    case EntityType.ServiceBot:
      return entity.props["activated"] === true;
    case EntityType.CrewNPC:
      return entity.props["evacuated"] === true || entity.props["dead"] === true;
    case EntityType.EscapePod:
      return (entity.props["boarded"] as number || 0) >= (entity.props["capacity"] as number || 3);
    case EntityType.RepairCradle:
      return false; // always interactable
    case EntityType.PatrolDrone:
    case EntityType.Drone:
    case EntityType.RepairBot:
      return true; // not interactable
    default:
      return false;
  }
}
