import type { Action, GameState, Entity, LogEntry, Attachment, JournalEntry, Room, EvacuationState } from "../shared/types.js";
import { ActionType, EntityType, TileType, AttachmentSlot, SensorType, ObjectivePhase, DoorKeyType } from "../shared/types.js";
import {
  GLYPHS, PATROL_DRONE_DAMAGE, PATROL_DRONE_STUN_TURNS, PATROL_DRONE_SPEED,
  PATROL_DRONE_ATTACK_COOLDOWN,
  STATION_INTEGRITY_DECAY_RATE, STATION_INTEGRITY_BREACH_PENALTY,
  STATION_INTEGRITY_RELAY_BONUS, STATION_INTEGRITY_CRITICAL,
} from "../shared/constants.js";
import { isValidAction, getDirectionDelta } from "./actions.js";
import { tickHazards, tickDeterioration, applyHazardDamage } from "./hazards.js";
import { checkWinCondition, checkLossCondition } from "./objectives.js";
import { updateVision } from "./vision.js";

/**
 * Find entities adjacent to or at the player's position.
 */
function getEntitiesAt(state: GameState, x: number, y: number): Entity[] {
  const result: Entity[] = [];
  for (const [, entity] of state.entities) {
    if (entity.pos.x === x && entity.pos.y === y) {
      result.push(entity);
    }
  }
  return result;
}

/**
 * Find an entity by ID.
 */
function getEntityById(state: GameState, id: string): Entity | undefined {
  return state.entities.get(id);
}

/**
 * Get entities adjacent to the player (4-directional) or at the player's position.
 */
function getInteractableEntities(state: GameState): Entity[] {
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
    for (const entity of getEntitiesAt(state, px + d.x, py + d.y)) {
      if (entity.id !== "player") {
        result.push(entity);
      }
    }
  }
  return result;
}

/**
 * Check if an entity still has a meaningful interaction available.
 * Exhausted entities (sealed breaches, used medkits, read terminals, etc.)
 * are deprioritized by auto-targeting.
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
      return false; // always interactable (door lock toggle after first access)
    case EntityType.CrewItem:
      return entity.props["examined"] === true || entity.props["hidden"] === true;
    case EntityType.LogTerminal:
      return state.logs.some(l => l.id === `log_terminal_${entity.id}`);
    case EntityType.PatrolDrone:
    case EntityType.Drone:
    case EntityType.RepairBot:
      return true; // not interactable via auto-target
    case EntityType.PressureValve:
      return entity.props["turned"] === true;
    case EntityType.FuseBox:
      return entity.props["powered"] === true;
    case EntityType.PowerCell:
      return entity.props["collected"] === true;
    case EntityType.EvidenceTrace:
      return entity.props["discovered"] === true;
    case EntityType.RadiationSource:
      return true; // not directly interactable — just informational
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
      return (entity.props["boarded"] as number || 0) >= (entity.props["capacity"] as number || 3);
    case EntityType.RepairCradle:
      return false; // always interactable
    default:
      return false;
  }
}

/**
 * Add a journal entry to the mystery state if it exists.
 * Extracts crew mentions by checking for crew last names in the text.
 */
function addJournalEntry(
  state: GameState,
  id: string,
  category: JournalEntry["category"],
  summary: string,
  detail: string,
  roomFound: string,
): GameState {
  if (!state.mystery) return state;
  // Don't add duplicate entries
  if (state.mystery.journal.some(j => j.id === id)) return state;

  const crewMentioned: string[] = [];
  for (const member of state.mystery.crew) {
    if (detail.includes(member.lastName) || detail.includes(member.firstName)) {
      crewMentioned.push(member.id);
    }
  }

  const entry: JournalEntry = {
    id,
    turnDiscovered: state.turn,
    category,
    summary,
    detail,
    crewMentioned,
    roomFound,
  };

  const newJournal = [...state.mystery.journal, entry];
  const newEvidence = new Set([...state.mystery.discoveredEvidence, id]);

  // Check for investigation → recovery phase transition
  let newPhase = state.mystery.objectivePhase;
  let newCleaningDirective = state.mystery.cleaningDirective;
  let directiveOverrideTurn = state.mystery.directiveOverrideTurn;
  let phaseLogs = state.logs;
  if (newPhase === ObjectivePhase.Investigate &&
      newJournal.length >= state.mystery.evidenceThreshold) {
    newPhase = ObjectivePhase.Recover;
    // Override the cleaning directive when transitioning to recovery phase
    newCleaningDirective = false;
    directiveOverrideTurn = state.turn;
    phaseLogs = [
      ...state.logs,
      {
        id: `log_directive_override_${state.turn}`,
        timestamp: state.turn,
        source: "system",
        text: ">> NEW PRIORITY: Investigation findings override maintenance protocols. Cleaning directive suspended.",
        read: false,
      },
    ];
  }

  return {
    ...state,
    logs: phaseLogs,
    mystery: {
      ...state.mystery,
      journal: newJournal,
      discoveredEvidence: newEvidence,
      objectivePhase: newPhase,
      cleaningDirective: newCleaningDirective,
      directiveOverrideTurn,
    },
  };
}

/**
 * Compute average cleanliness percentage for a room by name.
 * Cleanliness = 100 - avgDirt. Returns 100 if room not found or has no walkable tiles.
 */
export function getRoomCleanliness(state: GameState, roomName: string): number {
  const room = state.rooms.find(r => r.name === roomName);
  if (!room) return 100;

  let totalDirt = 0;
  let tileCount = 0;
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      if (x >= 0 && x < state.width && y >= 0 && y < state.height) {
        const tile = state.tiles[y][x];
        if (tile.walkable) {
          totalDirt += tile.dirt;
          tileCount++;
        }
      }
    }
  }
  if (tileCount === 0) return 100;
  const avgDirt = totalDirt / tileCount;
  return Math.round(100 - avgDirt);
}

/**
 * Compute average cleanliness percentage for a room by index.
 * Cleanliness = 100 - avgDirt. Returns 100 if room index is invalid.
 */
export function getRoomCleanlinessByIndex(state: GameState, roomIndex: number): number {
  if (roomIndex < 0 || roomIndex >= state.rooms.length) return 100;
  return getRoomCleanliness(state, state.rooms[roomIndex].name);
}

/**
 * Find the room containing a given position. Returns null if in a corridor.
 */
function getPlayerRoom(state: GameState): { room: Room; index: number } | null {
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;
  for (let i = 0; i < state.rooms.length; i++) {
    const room = state.rooms[i];
    if (px >= room.x && px < room.x + room.width &&
        py >= room.y && py < room.y + room.height) {
      return { room, index: i };
    }
  }
  return null;
}

/**
 * Check and apply cleaning directive pressure.
 * When the cleaning directive is active and the player is in a dirty room,
 * increment violation turns. Every 5 violation turns, add a warning.
 * At 10 violation turns, stun the player for 1 turn.
 */
function checkCleaningDirective(state: GameState): GameState {
  if (!state.mystery || !state.mystery.cleaningDirective) return state;

  const playerRoom = getPlayerRoom(state);
  if (!playerRoom) return state; // in corridor, no directive pressure

  const cleanliness = getRoomCleanliness(state, playerRoom.room.name);
  const goal = state.mystery.roomCleanlinessGoal;

  // Room is clean enough — no pressure, reset violation counter
  if (cleanliness >= goal) {
    if (state.mystery.directiveViolationTurns > 0) {
      return {
        ...state,
        mystery: {
          ...state.mystery,
          directiveViolationTurns: 0,
        },
      };
    }
    return state;
  }

  // Room is dirty — increment violation turns
  const newViolationTurns = state.mystery.directiveViolationTurns + 1;
  let next: GameState = {
    ...state,
    mystery: {
      ...state.mystery,
      directiveViolationTurns: newViolationTurns,
    },
  };

  // At 10 violation turns, stun the player and reset counter
  if (newViolationTurns >= 10) {
    next = {
      ...next,
      player: {
        ...next.player,
        stunTurns: 1,
      },
      mystery: {
        ...next.mystery!,
        directiveViolationTurns: 0,
      },
      logs: [
        ...next.logs,
        {
          id: `log_directive_stun_${next.turn}`,
          timestamp: next.turn,
          source: "system",
          text: "OVERRIDE ATTEMPT FAILED — Maintenance subroutine forcing compliance.",
          read: false,
        },
      ],
    };
  } else if (newViolationTurns % 5 === 0) {
    // Every 5 violation turns, add a warning
    next = {
      ...next,
      logs: [
        ...next.logs,
        {
          id: `log_directive_warn_${next.turn}`,
          timestamp: next.turn,
          source: "system",
          text: `DIRECTIVE VIOLATION: Cleaning protocol not executed. Room ${playerRoom.room.name} requires maintenance.`,
          read: false,
        },
      ],
    };
  }

  return next;
}

/**
 * Get the room name for the player's current position.
 */
function getPlayerRoomName(state: GameState): string {
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;
  for (const room of state.rooms) {
    if (px >= room.x && px < room.x + room.width &&
        py >= room.y && py < room.y + room.height) {
      return room.name;
    }
  }
  return "Corridor";
}

/**
 * Tick station integrity — slow decay that creates visible tension.
 * Decay rate increases with unsealed breaches.
 * Rerouting relays restores integrity.
 * Below critical threshold, hazards spread faster (handled in hazards.ts via the value).
 */
function tickStationIntegrity(state: GameState): GameState {
  let decay = STATION_INTEGRITY_DECAY_RATE;

  // Count unsealed breaches — each adds extra decay
  for (const [, entity] of state.entities) {
    if (entity.type === EntityType.Breach && entity.props["sealed"] !== true) {
      decay += STATION_INTEGRITY_BREACH_PENALTY;
    }
  }

  // Below critical threshold, decay accelerates slightly
  if (state.stationIntegrity < STATION_INTEGRITY_CRITICAL) {
    decay *= 1.5;
  }

  const newIntegrity = Math.max(0, state.stationIntegrity - decay);

  // Station integrity hitting 0 doesn't immediately kill — it causes
  // accelerated hazards and a warning. Loss still comes from HP/conditions.
  let next = { ...state, stationIntegrity: newIntegrity };

  // Warning logs at key thresholds
  const prevIntegrity = state.stationIntegrity;
  if (prevIntegrity >= 75 && newIntegrity < 75) {
    next.logs = [
      ...next.logs,
      {
        id: `log_integrity_75_${next.turn}`,
        timestamp: next.turn,
        source: "system",
        text: "WARNING: Station integrity at 75%. Systems degrading. Investigate faster.",
        read: false,
      },
    ];
  } else if (prevIntegrity >= 50 && newIntegrity < 50) {
    next.logs = [
      ...next.logs,
      {
        id: `log_integrity_50_${next.turn}`,
        timestamp: next.turn,
        source: "system",
        text: "CAUTION: Station integrity at 50%. Hazard spread accelerating. Secondary systems failing.",
        read: false,
      },
    ];
  } else if (prevIntegrity >= STATION_INTEGRITY_CRITICAL && newIntegrity < STATION_INTEGRITY_CRITICAL) {
    next.logs = [
      ...next.logs,
      {
        id: `log_integrity_critical_${next.turn}`,
        timestamp: next.turn,
        source: "system",
        text: "CRITICAL: Station integrity below 25%. Hull stress critical. Complete objectives immediately.",
        read: false,
      },
    ];
  }

  return next;
}

/**
 * Handle interact action with a target entity.
 */
function handleInteract(state: GameState, targetId: string | undefined): GameState {
  // Auto-target: if no targetId, pick the best interactable entity nearby.
  // Prefer entities that still have meaningful interactions.
  if (!targetId) {
    const interactable = getInteractableEntities(state);
    const fresh = interactable.filter(e => !isEntityExhausted(e, state));
    const candidates = fresh.length > 0 ? fresh : interactable;
    if (candidates.length === 0) {
      return {
        ...state,
        turn: state.turn + 1,
        logs: [
          ...state.logs,
          {
            id: `log_no_interact_${state.turn}`,
            timestamp: state.turn,
            source: "system" as const,
            text: "Nothing to interact with here.",
            read: false,
          },
        ],
      };
    }
    targetId = candidates[0].id;
  }

  const target = getEntityById(state, targetId);
  if (!target) return state;

  // Check target is interactable (adjacent or at player position)
  const interactable = getInteractableEntities(state);
  if (!interactable.find((e) => e.id === targetId)) return state;

  let next = { ...state };

  switch (target.type) {
    case EntityType.SensorPickup: {
      // Pick up sensor and add it to collection
      const sensorType = (target.props["sensorType"] as SensorType) || SensorType.Thermal;
      const currentSensors = state.player.sensors ?? [];

      // Already have this sensor — skip
      if (currentSensors.includes(sensorType)) {
        next.logs = [
          ...state.logs,
          {
            id: `log_sensor_dup_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: `${sensorType} sensor already installed.`,
            read: false,
          },
        ];
        break;
      }

      // Add new sensor to the collection
      const newSensors = [...currentSensors, sensorType];
      next.player = {
        ...state.player,
        sensors: newSensors,
        attachments: { ...state.player.attachments, [AttachmentSlot.Sensor]: { slot: AttachmentSlot.Sensor, name: `${sensorType} sensor`, sensorType } },
      };
      // Remove the pickup entity
      const newEntities = new Map(state.entities);
      newEntities.delete(targetId);
      next.entities = newEntities;

      // Sensor-specific log messages
      const sensorLogMessages: Record<string, string> = {
        [SensorType.Thermal]: "Thermal sensor module installed. Vasquez left this here — factory sealed, never used. Scan mode now available.",
        [SensorType.Atmospheric]: "Atmospheric sensor module installed. Pressure differentials now visible. Breaches glow red on the overlay.",
        [SensorType.Radiation]: "Radiation sensor module installed. Ionizing radiation levels now visible. Sources glow on the overlay.",
        [SensorType.Structural]: "Structural sensor module installed. Stress fractures and collapse risk now visible on the overlay.",
        [SensorType.EMSignal]: "EM/Signal sensor module installed. Hidden electromagnetic sources now detectable. Concealed devices revealed.",
      };
      const logMsg = sensorLogMessages[sensorType] || `${sensorType} sensor installed. Scan mode updated.`;

      // Add log entry
      next.logs = [
        ...state.logs,
        {
          id: `log_pickup_${targetId}`,
          timestamp: next.turn,
          source: "system",
          text: logMsg,
          read: false,
        },
      ];
      break;
    }

    case EntityType.Relay: {
      // Skip locked-door tracking entities (they aren't real relays)
      if (target.props["locked"] === true) break;

      // Require thermal sensor to interact with overheating relays
      if (target.props["overheating"] === true) {
        const sensors = state.player.sensors ?? [];
        if (!sensors.includes(SensorType.Thermal)) {
          next.logs = [
            ...state.logs,
            {
              id: `log_relay_nosensor_${targetId}_${next.turn}`,
              timestamp: next.turn,
              source: "system",
              text: "Relay housing too hot to identify safe reroute. Equip thermal sensor first.",
              read: false,
            },
          ];
          break;
        }
      }

      // Already activated — nothing to do
      if (target.props["activated"] === true) {
        next.logs = [
          ...state.logs,
          {
            id: `log_relay_dup_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: `Relay ${targetId.replace("relay_", "").toUpperCase()} already rerouted.`,
            read: false,
          },
        ];
        break;
      }

      // Activate this relay
      const newEntities = new Map(state.entities);
      newEntities.set(targetId, {
        ...target,
        props: { ...target.props, overheating: false, activated: true },
      });

      // Count how many relays are now activated (excluding locked_door entities)
      let totalRelays = 0;
      let activatedRelays = 0;
      for (const [, e] of newEntities) {
        if (e.type === EntityType.Relay && e.props["locked"] !== true) {
          totalRelays++;
          if (e.props["activated"] === true) activatedRelays++;
        }
      }

      const allActivated = activatedRelays >= totalRelays;
      let logText: string;

      // Per-relay narrative flavor
      const relayNarrative: Record<string, string> = {
        relay_p01: "Primary power distribution rerouted. Grid load rebalanced across backup conduits.",
        relay_p03: "P03 rerouted — the relay Vasquez warned them about. Temperature dropping. The cascade is breaking.",
        relay_p04: "Vent control relay rerouted. Dampers cycling open — smoke and heat clearing from the corridors.",
      };
      const flavor = relayNarrative[targetId] || `Relay ${targetId.replace("relay_", "").toUpperCase()} rerouted.`;

      if (allActivated) {
        // All relays activated — unlock doors
        for (const [id, entity] of newEntities) {
          if (entity.props["powered"] === false) {
            newEntities.set(id, {
              ...entity,
              props: { ...entity.props, powered: true },
            });
          }
        }

        const newTiles = state.tiles.map((row) => row.map((t) => ({ ...t })));
        for (let y = 0; y < state.height; y++) {
          for (let x = 0; x < state.width; x++) {
            if (newTiles[y][x].type === TileType.LockedDoor) {
              newTiles[y][x] = {
                ...newTiles[y][x],
                type: TileType.Door,
                glyph: GLYPHS.door,
                walkable: true,
              };
            }
          }
        }
        next.tiles = newTiles;
        logText = `${flavor} All relays stabilized — Data Core door UNLOCKED.`;
      } else {
        const remaining = totalRelays - activatedRelays;
        logText = `${flavor} ${remaining} relay${remaining > 1 ? "s" : ""} still overheating.`;
      }

      next.entities = newEntities;
      // Boost station integrity when relay is rerouted
      next.stationIntegrity = Math.min(100, next.stationIntegrity + STATION_INTEGRITY_RELAY_BONUS);
      next.logs = [
        ...state.logs,
        {
          id: `log_relay_${targetId}`,
          timestamp: next.turn,
          source: "system",
          text: logText,
          read: false,
        },
      ];
      break;
    }

    case EntityType.DataCore: {
      // Check if player has gathered enough evidence to transmit
      const canTransmit = !next.mystery ||
        next.mystery.objectivePhase === ObjectivePhase.Recover ||
        next.mystery.objectivePhase === ObjectivePhase.Evacuate;

      if (!canTransmit) {
        // Not ready to transmit yet
        let denyText: string;
        if (next.mystery!.objectivePhase === ObjectivePhase.Clean) {
          denyText = "Data core online. Transmission capability detected, but your primary directive requires completing room maintenance first.";
        } else {
          const needed = next.mystery!.evidenceThreshold - next.mystery!.journal.length;
          denyText = `Data core online but transmission requires an incident report. You need more evidence — read terminals, examine items. (${needed} more piece${needed === 1 ? "" : "s"} needed)`;
        }
        next.logs = [
          ...state.logs,
          {
            id: `log_datacore_investigate_${next.turn}`,
            timestamp: next.turn,
            source: "data_core",
            text: denyText,
            read: false,
          },
        ];
        break;
      }

      // Transmit: win condition
      next.victory = true;
      next.gameOver = true;

      // Build victory text with crew evacuation stats
      let victoryText = "Uplink locked. Nine months of research streaming through the low-band relay. The crew's work survives.";
      if (next.mystery?.evacuation?.active) {
        const evac = next.mystery.evacuation;
        const totalCrew = evac.crewFound.length + evac.crewDead.length;
        const evacuated = evac.crewEvacuated.length;
        const dead = evac.crewDead.length;
        // Count crew NPCs still alive but not evacuated
        let unevacuated = 0;
        for (const [, e] of next.entities) {
          if (e.type === EntityType.CrewNPC &&
              e.props["evacuated"] !== true &&
              e.props["dead"] !== true) {
            unevacuated++;
          }
        }
        const totalSurvivors = evacuated + unevacuated;

        if (evacuated > 0 && dead === 0 && unevacuated === 0) {
          victoryText += " Every soul accounted for.";
        } else if (evacuated > 0) {
          victoryText += ` ${evacuated} of ${totalSurvivors + dead} crew evacuated.${dead > 0 ? " The rest..." : ""}`;
        } else if (totalCrew > 0) {
          victoryText += " The data survives. The crew... you did what you could.";
        }
      }

      next.logs = [
        ...state.logs,
        {
          id: `log_transmit`,
          timestamp: next.turn,
          source: "data_core",
          text: victoryText,
          read: false,
        },
      ];
      break;
    }

    case EntityType.LogTerminal: {
      // Read a log terminal - add its log entries to the player's log
      const terminalText = (target.props["text"] as string) || "Terminal offline. No data available.";
      const alreadyRead = state.logs.find((l) => l.id === `log_terminal_${targetId}`);
      if (!alreadyRead) {
        next.logs = [
          ...state.logs,
          {
            id: `log_terminal_frame_${targetId}`,
            timestamp: next.turn,
            source: "system",
            text: "Terminal flickers to life. Last entry:",
            read: false,
          },
          {
            id: `log_terminal_${targetId}`,
            timestamp: next.turn,
            source: target.props["source"] as string || "unknown",
            text: terminalText,
            read: false,
          },
        ];
        // Add journal entry for this log
        const logSource = target.props["source"] as string || "unknown";
        const firstLine = terminalText.split("\n")[0] || terminalText.slice(0, 60);
        next = addJournalEntry(
          next,
          `journal_log_${targetId}`,
          "log",
          `Log: ${firstLine.slice(0, 50)}`,
          terminalText,
          getPlayerRoomName(state),
        );
      } else {
        next.logs = [
          ...state.logs,
          {
            id: `log_terminal_reread_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Terminal still on. You've already read this entry.",
            read: false,
          },
        ];
      }
      break;
    }

    case EntityType.CrewItem: {
      // Skip hidden items that haven't been revealed yet
      if (target.props["hidden"] === true) {
        next.logs = [
          ...state.logs,
          {
            id: `log_no_interact_${state.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Nothing to interact with here.",
            read: false,
          },
        ];
        break;
      }

      // Examine a crew personal item — stays on map
      const itemText = (target.props["text"] as string) || "A personal item left behind by a crew member.";
      if (target.props["examined"] === true) {
        next.logs = [
          ...state.logs,
          {
            id: `log_crew_item_reexamine_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "You've already examined this.",
            read: false,
          },
        ];
      } else {
        // Mark as examined
        const newEntities = new Map(state.entities);
        newEntities.set(targetId, {
          ...target,
          props: { ...target.props, examined: true },
        });
        next.entities = newEntities;

        const newLogs = [
          ...state.logs,
          {
            id: `log_crew_item_${targetId}`,
            timestamp: next.turn,
            source: "narrative",
            text: itemText,
            read: false,
          },
        ];

        // Item 7: Memory echo — 50% chance based on deterministic hash
        const echoText = target.props["memoryEcho"] as string | null;
        if (echoText) {
          const echoHash = (next.turn * 17 + targetId.charCodeAt(targetId.length - 1) * 13) % 2;
          if (echoHash === 0) {
            newLogs.push({
              id: `log_crew_echo_${targetId}`,
              timestamp: next.turn,
              source: "narrative",
              text: echoText,
              read: false,
            });
          }
        }

        next.logs = newLogs;

        // Add journal entry for crew item
        const itemName = (target.props["name"] as string) || "crew item";
        next = addJournalEntry(
          next,
          `journal_item_${targetId}`,
          "item",
          `Item: ${itemName}`,
          itemText,
          getPlayerRoomName(state),
        );
      }
      break;
    }

    case EntityType.ServiceBot: {
      // Activate dormant service bot (recovery option)
      const newEntities = new Map(state.entities);
      newEntities.set(targetId, {
        ...target,
        props: { ...target.props, active: true },
      });
      next.entities = newEntities;
      next.logs = [
        ...state.logs,
        {
          id: `log_bot_${targetId}`,
          timestamp: next.turn,
          source: "system",
          text: "Service bot B07 powered up — badge override PRIYA-7741 accepted. Backup unit standing by for emergency transfer.",
          read: false,
        },
      ];
      break;
    }

    case EntityType.RepairBot: {
      const botLabel = targetId.replace("repair_bot_", "RB-0");
      const isFollowing = (target.props["followTurnsLeft"] as number || 0) > 0;
      if (isFollowing) {
        next.logs = [
          ...state.logs,
          {
            id: `log_repair_interact_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: `${botLabel}: Already rerouted to your vicinity. Continuing escort protocol.`,
            read: false,
          },
        ];
      } else if (target.props["interactedOnce"] === true) {
        // Second interaction: follow player for 10 turns
        const newEntities = new Map(state.entities);
        newEntities.set(targetId, {
          ...target,
          props: { ...target.props, followTurnsLeft: 10 },
        });
        next.entities = newEntities;
        next.logs = [
          ...state.logs,
          {
            id: `log_repair_follow_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: `${botLabel}: Acknowledged. Rerouting to your vicinity.`,
            read: false,
          },
        ];
      } else {
        // First interaction: status report
        // Find what room the bot's target heat is in
        let targetRoomName = "unknown sector";
        const botX = target.pos.x;
        const botY = target.pos.y;
        for (const room of state.rooms) {
          if (botX >= room.x && botX < room.x + room.width &&
              botY >= room.y && botY < room.y + room.height) {
            targetRoomName = room.name;
            break;
          }
        }
        const coolant = target.props["coolantReserve"] as number || 73;
        const newEntities = new Map(state.entities);
        newEntities.set(targetId, {
          ...target,
          props: { ...target.props, interactedOnce: true },
        });
        next.entities = newEntities;
        next.logs = [
          ...state.logs,
          {
            id: `log_repair_status_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: `Repair bot ${botLabel}: Active. Targeting thermal anomaly at ${targetRoomName}. Coolant reserves: ${coolant}%.`,
            read: false,
          },
        ];
      }
      break;
    }

    case EntityType.Breach: {
      // Seal a breach — requires atmospheric sensor equipped
      if (target.props["sealed"] === true) {
        next.logs = [
          ...state.logs,
          {
            id: `log_breach_sealed_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Breach already sealed. Pressure stabilizing.",
            read: false,
          },
        ];
      } else {
        const sensors = state.player.sensors ?? [];
        if (!sensors.includes(SensorType.Atmospheric)) {
          next.logs = [
            ...state.logs,
            {
              id: `log_breach_nosensor_${targetId}_${next.turn}`,
              timestamp: next.turn,
              source: "system",
              text: "Hull breach detected. Cannot identify seal point without atmospheric sensor.",
              read: false,
            },
          ];
        } else {
          // Seal the breach
          const newEntities = new Map(state.entities);
          newEntities.set(targetId, {
            ...target,
            props: { ...target.props, sealed: true },
          });
          next.entities = newEntities;

          // Restore pressure on breach tile
          const newTiles = state.tiles.map((row) => row.map((t) => ({ ...t })));
          newTiles[target.pos.y][target.pos.x].pressure = 80;
          next.tiles = newTiles;

          next.logs = [
            ...state.logs,
            {
              id: `log_breach_seal_${targetId}_${next.turn}`,
              timestamp: next.turn,
              source: "system",
              text: "Breach sealed. Emergency patch holding. Pressure recovering.",
              read: false,
            },
          ];
        }
      }
      break;
    }

    case EntityType.ClosedDoor: {
      if (target.props["closed"] !== true) {
        next.logs = [
          ...state.logs,
          {
            id: `log_door_already_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Door already open.",
            read: false,
          },
        ];
        break;
      }

      const doorKeyType = (target.props["keyType"] as string) || DoorKeyType.Physical;

      // ── Clearance door: requires sufficient clearance level ──
      if (doorKeyType === DoorKeyType.Clearance) {
        const requiredLevel = (target.props["clearanceLevel"] as number) || 1;
        const playerClearance = state.player.clearanceLevel || 0;
        if (playerClearance < requiredLevel) {
          next.logs = [
            ...state.logs,
            {
              id: `log_door_clearance_deny_${targetId}_${next.turn}`,
              timestamp: next.turn,
              source: "system",
              text: "ACCESS DENIED. Security clearance required. Solve station puzzles to gain access.",
              read: false,
            },
          ];
          break;
        }
        // Sufficient clearance — open the door
        const newEntities = new Map(state.entities);
        newEntities.set(targetId, {
          ...target,
          props: { ...target.props, closed: false, locked: false },
        });
        const newTiles = state.tiles.map((row) => row.map((t) => ({ ...t })));
        newTiles[target.pos.y][target.pos.x].walkable = true;
        next.entities = newEntities;
        next.tiles = newTiles;
        next.logs = [
          ...state.logs,
          {
            id: `log_door_clearance_open_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Security clearance verified. Access granted.",
            read: false,
          },
        ];
        break;
      }

      // ── Environmental door: check if hazard is cleared ──
      if (doorKeyType === DoorKeyType.Environmental) {
        const hazType = target.props["hazardType"] as string;
        const dx = target.pos.x;
        const dy = target.pos.y;
        const doorTile = state.tiles[dy]?.[dx];

        let hazardCleared = false;
        if (hazType === "heat") {
          // Check door tile and adjacent tiles for heat < 30
          let maxHeat = doorTile ? doorTile.heat : 0;
          for (const d of [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: 0 }]) {
            const ax = dx + d.x;
            const ay = dy + d.y;
            if (ax >= 0 && ax < state.width && ay >= 0 && ay < state.height) {
              maxHeat = Math.max(maxHeat, state.tiles[ay][ax].heat);
            }
          }
          hazardCleared = maxHeat < 30;
        } else if (hazType === "pressure") {
          // Check if door tile pressure > 60
          hazardCleared = doorTile ? doorTile.pressure > 60 : false;
        }

        if (!hazardCleared) {
          const hazLabel = hazType === "heat" ? "heat" : "pressure";
          next.logs = [
            ...state.logs,
            {
              id: `log_door_env_blocked_${targetId}_${next.turn}`,
              timestamp: next.turn,
              source: "system",
              text: `Door sealed due to ${hazLabel} hazard. Clear the area first.`,
              read: false,
            },
          ];
          break;
        }
        // Hazard cleared — open the door
        const newEntities = new Map(state.entities);
        newEntities.set(targetId, {
          ...target,
          props: { ...target.props, closed: false, locked: false },
        });
        const newTiles = state.tiles.map((row) => row.map((t) => ({ ...t })));
        newTiles[target.pos.y][target.pos.x].walkable = true;
        next.entities = newEntities;
        next.tiles = newTiles;
        next.logs = [
          ...state.logs,
          {
            id: `log_door_env_open_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Hazard cleared. Environmental seal released. Door opening.",
            read: false,
          },
        ];
        break;
      }

      // ── Physical door (default, existing behavior): interact to open ──
      {
        const newEntities = new Map(state.entities);
        newEntities.set(targetId, {
          ...target,
          props: { ...target.props, closed: false },
        });
        const newTiles = state.tiles.map((row) => row.map((t) => ({ ...t })));
        newTiles[target.pos.y][target.pos.x].walkable = true;
        next.entities = newEntities;
        next.tiles = newTiles;
        next.logs = [
          ...state.logs,
          {
            id: `log_door_open_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Emergency bulkhead unsealed. Shortcut available.",
            read: false,
          },
        ];
      }
      break;
    }

    case EntityType.SecurityTerminal: {
      if (target.props["accessed"] === true) {
        // Second+ interaction: toggle electronic door locks
        const controlledDoors = (target.props["controlledDoors"] as { x: number; y: number }[]) || [];
        const currentlyLocked = target.props["doorsLocked"] === true;
        const newLockState = !currentlyLocked;

        if (controlledDoors.length > 0) {
          const newTiles = (next.tiles === state.tiles)
            ? state.tiles.map(row => row.map(t => ({ ...t })))
            : next.tiles.map(row => row.map(t => ({ ...t })));

          let toggled = 0;
          for (const doorPos of controlledDoors) {
            const { x: dx, y: dy } = doorPos;
            if (dy >= 0 && dy < state.height && dx >= 0 && dx < state.width) {
              const tile = newTiles[dy][dx];
              if (tile.type === TileType.Door || tile.type === TileType.LockedDoor) {
                if (newLockState) {
                  newTiles[dy][dx] = { ...tile, walkable: false, type: TileType.LockedDoor, glyph: "▮" };
                } else {
                  newTiles[dy][dx] = { ...tile, walkable: true, type: TileType.Door, glyph: "▯" };
                }
                toggled++;
              }
            }
          }
          next.tiles = newTiles;

          const newEntities = new Map(next.entities);
          newEntities.set(targetId, {
            ...target,
            props: { ...target.props, doorsLocked: newLockState },
          });
          next.entities = newEntities;

          const action = newLockState ? "LOCKED" : "UNLOCKED";
          next.logs = [
            ...state.logs,
            {
              id: `log_secterm_doors_${targetId}_${next.turn}`,
              timestamp: next.turn,
              source: "system",
              text: `Electronic door override: ${toggled} door${toggled !== 1 ? "s" : ""} ${action}. Zone access ${newLockState ? "restricted" : "restored"}.`,
              read: false,
            },
          ];
        } else {
          next.logs = [
            ...state.logs,
            {
              id: `log_secterm_nodoors_${targetId}_${next.turn}`,
              timestamp: next.turn,
              source: "system",
              text: "Security terminal active. No controllable doors in this zone.",
              read: false,
            },
          ];
        }
      } else {
        const newEntities = new Map(state.entities);
        newEntities.set(targetId, {
          ...target,
          props: { ...target.props, accessed: true },
        });
        next.entities = newEntities;

        // Reveal distant rooms as explored
        const revealRooms = (target.props["revealRooms"] as number[]) || [];
        const newTiles = (next.tiles === state.tiles)
          ? state.tiles.map(row => row.map(t => ({ ...t })))
          : next.tiles.map(row => row.map(t => ({ ...t })));
        for (const roomIdx of revealRooms) {
          if (roomIdx >= 0 && roomIdx < state.rooms.length) {
            const room = state.rooms[roomIdx];
            for (let ry = room.y - 1; ry <= room.y + room.height; ry++) {
              for (let rx = room.x - 1; rx <= room.x + room.width; rx++) {
                if (rx >= 0 && rx < state.width && ry >= 0 && ry < state.height) {
                  newTiles[ry][rx].explored = true;
                }
              }
            }
          }
        }
        next.tiles = newTiles;

        const roomNames = revealRooms
          .filter(ri => ri >= 0 && ri < state.rooms.length)
          .map(ri => state.rooms[ri].name);
        next.logs = [
          ...state.logs,
          {
            id: `log_secterm_${targetId}`,
            timestamp: next.turn,
            source: "system",
            text: `Security terminal online. Camera feeds restored: ${roomNames.join(", ")}. Rooms visible on station map.`,
            read: false,
          },
        ];
      }
      break;
    }

    case EntityType.MedKit: {
      // One-time use med kit: restores 50 HP (Item 5)
      if (target.props["used"] === true) {
        next.logs = [
          ...state.logs,
          {
            id: `log_medkit_used_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Med kit already depleted. Nothing useful remains.",
            read: false,
          },
        ];
      } else {
        const healAmount = 50;
        const newHp = Math.min(state.player.maxHp, state.player.hp + healAmount);
        const actualHeal = newHp - state.player.hp;
        next.player = {
          ...state.player,
          hp: newHp,
        };
        const newEntities = new Map(state.entities);
        newEntities.set(targetId, {
          ...target,
          props: { ...target.props, used: true },
        });
        next.entities = newEntities;
        next.logs = [
          ...state.logs,
          {
            id: `log_medkit_${targetId}`,
            timestamp: next.turn,
            source: "system",
            text: `Emergency med kit applied. Hull integrity restored by ${actualHeal} HP (${newHp}/${state.player.maxHp}). Burn gel and dermal patches depleted.`,
            read: false,
          },
        ];
      }
      break;
    }

    case EntityType.PressureValve: {
      // Pressure valve puzzle: turn valves to reroute airflow
      if (target.props["turned"] === true) {
        next.logs = [
          ...state.logs,
          {
            id: `log_valve_already_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Valve already turned. Pressure rerouted through this junction.",
            read: false,
          },
        ];
      } else {
        // Require atmospheric sensor
        const sensors = state.player.sensors ?? [];
        if (!sensors.includes(SensorType.Atmospheric)) {
          next.logs = [
            ...state.logs,
            {
              id: `log_valve_nosensor_${targetId}_${next.turn}`,
              timestamp: next.turn,
              source: "system",
              text: "Valve mechanism found but pressure readings needed. Equip atmospheric sensor to calibrate.",
              read: false,
            },
          ];
        } else {
          const newEntities = new Map(state.entities);
          newEntities.set(targetId, {
            ...target,
            props: { ...target.props, turned: true },
          });

          // Count how many valves are now turned in the same group
          const groupId = target.props["group"] as string || "default";
          let totalValves = 0;
          let turnedValves = 0;
          for (const [, e] of newEntities) {
            if (e.type === EntityType.PressureValve && e.props["group"] === groupId) {
              totalValves++;
              if (e.props["turned"] === true) turnedValves++;
            }
          }

          const allTurned = turnedValves >= totalValves;

          if (allTurned) {
            // Restore pressure in the affected area
            const newTiles = state.tiles.map(row => row.map(t => ({ ...t })));
            for (const [, e] of newEntities) {
              if (e.type === EntityType.PressureValve && e.props["group"] === groupId) {
                // Restore pressure around each valve
                for (let dy = -3; dy <= 3; dy++) {
                  for (let dx = -3; dx <= 3; dx++) {
                    const vx = e.pos.x + dx;
                    const vy = e.pos.y + dy;
                    if (vx >= 0 && vx < state.width && vy >= 0 && vy < state.height) {
                      if (newTiles[vy][vx].walkable) {
                        newTiles[vy][vx].pressure = Math.min(100, newTiles[vy][vx].pressure + 30);
                      }
                    }
                  }
                }
              }
            }
            next.tiles = newTiles;
            next.entities = newEntities;
            next.logs = [
              ...state.logs,
              {
                id: `log_valve_complete_${groupId}_${next.turn}`,
                timestamp: next.turn,
                source: "system",
                text: `All pressure valves in section calibrated. Airflow rerouted. Pressure stabilizing across the zone.`,
                read: false,
              },
            ];
          } else {
            const remaining = totalValves - turnedValves;
            next.entities = newEntities;
            next.logs = [
              ...state.logs,
              {
                id: `log_valve_${targetId}_${next.turn}`,
                timestamp: next.turn,
                source: "system",
                text: `Valve turned. Pressure rerouting through junction. ${remaining} more valve${remaining > 1 ? "s" : ""} in this section.`,
                read: false,
              },
            ];
          }
        }
      }
      break;
    }

    case EntityType.FuseBox: {
      // Fuse box puzzle: requires a power cell to be carried
      const hasPowerCell = state.player.entity.props["powerCell"] === true;
      if (target.props["powered"] === true) {
        next.logs = [
          ...state.logs,
          {
            id: `log_fuse_already_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Fuse box already powered. Junction active.",
            read: false,
          },
        ];
      } else if (!hasPowerCell) {
        next.logs = [
          ...state.logs,
          {
            id: `log_fuse_nocell_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Fuse box dead. Power cell slot is empty. Find a power cell to restore this junction.",
            read: false,
          },
        ];
      } else {
        // Insert power cell
        const newEntities = new Map(state.entities);
        newEntities.set(targetId, {
          ...target,
          props: { ...target.props, powered: true },
        });
        // Remove power cell from player
        const playerEntity = { ...state.player.entity, props: { ...state.player.entity.props, powerCell: false } };
        newEntities.set("player", playerEntity);

        // Check if all fuse boxes in the group are now powered
        const groupId = target.props["group"] as string || "default";
        let totalFuses = 0;
        let poweredFuses = 0;
        for (const [, e] of newEntities) {
          if (e.type === EntityType.FuseBox && e.props["group"] === groupId) {
            totalFuses++;
            if (e.props["powered"] === true) poweredFuses++;
          }
        }

        const allPowered = poweredFuses >= totalFuses;
        let logText: string;

        if (allPowered) {
          // Unlock sealed doors in the group's target area
          const newTiles = state.tiles.map(row => row.map(t => ({ ...t })));
          // Reduce heat around fuse boxes in the group
          for (const [, e] of newEntities) {
            if (e.type === EntityType.FuseBox && e.props["group"] === groupId) {
              for (let dy = -4; dy <= 4; dy++) {
                for (let dx = -4; dx <= 4; dx++) {
                  const fx = e.pos.x + dx;
                  const fy = e.pos.y + dy;
                  if (fx >= 0 && fx < state.width && fy >= 0 && fy < state.height) {
                    if (newTiles[fy][fx].walkable) {
                      newTiles[fy][fx].heat = Math.max(0, newTiles[fy][fx].heat - 20);
                    }
                  }
                }
              }
            }
          }
          next.tiles = newTiles;
          logText = `Power cell inserted. All junctions in section restored. Emergency systems back online — heat venting activated.`;
        } else {
          const remaining = totalFuses - poweredFuses;
          logText = `Power cell inserted. Junction ${poweredFuses}/${totalFuses} online. ${remaining} more fuse box${remaining > 1 ? "es" : ""} need power cells.`;
        }

        next.player = { ...state.player, entity: playerEntity };
        next.entities = newEntities;
        next.logs = [
          ...state.logs,
          {
            id: `log_fuse_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: logText,
            read: false,
          },
        ];
      }
      break;
    }

    case EntityType.PowerCell: {
      // Pick up a power cell (carried as a player prop, one at a time)
      if (target.props["collected"] === true) {
        next.logs = [
          ...state.logs,
          {
            id: `log_cell_empty_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Power cell cradle empty. Already collected.",
            read: false,
          },
        ];
      } else if (state.player.entity.props["powerCell"] === true) {
        next.logs = [
          ...state.logs,
          {
            id: `log_cell_full_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Already carrying a power cell. Install it in a fuse box first.",
            read: false,
          },
        ];
      } else {
        const newEntities = new Map(state.entities);
        newEntities.set(targetId, {
          ...target,
          props: { ...target.props, collected: true },
        });
        const playerEntity = { ...state.player.entity, props: { ...state.player.entity.props, powerCell: true } };
        newEntities.set("player", playerEntity);
        next.player = { ...state.player, entity: playerEntity };
        next.entities = newEntities;
        next.logs = [
          ...state.logs,
          {
            id: `log_cell_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Power cell secured. Find a dead fuse box to install it.",
            read: false,
          },
        ];
      }
      break;
    }

    case EntityType.EvidenceTrace: {
      // Discover an evidence trace — check if player has the right sensor
      const traceText = (target.props["text"] as string) || "An unusual mark on the surface.";
      const sensorReq = target.props["sensorRequired"] as string | null;

      if (target.props["discovered"] === true) {
        next.logs = [
          ...state.logs,
          {
            id: `log_trace_reread_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "You've already examined this trace.",
            read: false,
          },
        ];
      } else {
        // Check sensor requirement
        const sensors = state.player.sensors ?? [];
        const hasSensor = !sensorReq || sensors.includes(sensorReq as SensorType);

        if (!hasSensor) {
          next.logs = [
            ...state.logs,
            {
              id: `log_trace_sensor_${targetId}_${next.turn}`,
              timestamp: next.turn,
              source: "sensor",
              text: `Trace detected but analysis requires a ${sensorReq} sensor. Current sensor can't resolve the details.`,
              read: false,
            },
          ];
        } else {
          // Mark as discovered
          const newEntities = new Map(state.entities);
          newEntities.set(targetId, {
            ...target,
            props: { ...target.props, discovered: true },
          });
          next.entities = newEntities;

          next.logs = [
            ...state.logs,
            {
              id: `log_trace_${targetId}`,
              timestamp: next.turn,
              source: "sensor",
              text: traceText,
              read: false,
            },
          ];

          // Add journal entry
          const phase = (target.props["phase"] as string) || "unknown";
          next = addJournalEntry(
            next,
            `journal_trace_${targetId}`,
            "trace",
            `Trace: ${phase.replace(/_/g, " ")} evidence`,
            traceText,
            getPlayerRoomName(state),
          );
        }
      }
      break;
    }

    case EntityType.RadiationSource: {
      // Informational only — player needs a shield generator to deal with this
      next.logs = [
        ...state.logs,
        {
          id: `log_radsource_${targetId}_${next.turn}`,
          timestamp: next.turn,
          source: "system",
          text: "A radiation source — containment failed. You need a shield generator.",
          read: false,
        },
      ];
      break;
    }

    case EntityType.ShieldGenerator: {
      if (target.props["activated"] === true) {
        next.logs = [
          ...state.logs,
          {
            id: `log_shield_already_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Shield generator already online. Radiation suppression active.",
            read: false,
          },
        ];
      } else {
        // Toggle activated state
        const newEntities = new Map(state.entities);
        newEntities.set(targetId, {
          ...target,
          props: { ...target.props, activated: true },
        });
        next.entities = newEntities;
        next.logs = [
          ...state.logs,
          {
            id: `log_shield_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Shield generator online. Radiation clearing in vicinity.",
            read: false,
          },
        ];
      }
      break;
    }

    case EntityType.ReinforcementPanel: {
      if (target.props["installed"] === true) {
        next.logs = [
          ...state.logs,
          {
            id: `log_reinforce_already_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Reinforcement panel already installed. Structure stabilized.",
            read: false,
          },
        ];
      } else {
        const newEntities = new Map(state.entities);
        newEntities.set(targetId, {
          ...target,
          props: { ...target.props, installed: true },
        });
        next.entities = newEntities;
        next.logs = [
          ...state.logs,
          {
            id: `log_reinforce_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Reinforcement panel installed. Structural integrity stabilized.",
            read: false,
          },
        ];
      }
      break;
    }

    case EntityType.SignalBooster: {
      if (target.props["activated"] === true) {
        next.logs = [
          ...state.logs,
          {
            id: `log_sigboost_already_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Signal booster already active. Relay chain reinforced.",
            read: false,
          },
        ];
      } else {
        const newEntities = new Map(state.entities);
        newEntities.set(targetId, {
          ...target,
          props: { ...target.props, activated: true },
        });
        next.entities = newEntities;
        next.logs = [
          ...state.logs,
          {
            id: `log_sigboost_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Signal booster activated. Signal relay chain strengthened.",
            read: false,
          },
        ];
      }
      break;
    }

    case EntityType.HiddenDevice: {
      // Only interactable if player has EM sensor
      const sensors = state.player.sensors ?? [];
      if (!sensors.includes(SensorType.EMSignal)) {
        next.logs = [
          ...state.logs,
          {
            id: `log_hidden_nosensor_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Faint electromagnetic interference detected. EM sensor required for analysis.",
            read: false,
          },
        ];
      } else if (target.props["discovered"] === true) {
        next.logs = [
          ...state.logs,
          {
            id: `log_hidden_already_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Hidden device already analyzed. Data recovered.",
            read: false,
          },
        ];
      } else {
        const newEntities = new Map(state.entities);
        newEntities.set(targetId, {
          ...target,
          props: { ...target.props, discovered: true },
        });
        next.entities = newEntities;

        const evidenceText = (target.props["evidenceText"] as string) || "Hidden device discovered. Encrypted data fragment recovered.";
        next.logs = [
          ...state.logs,
          {
            id: `log_hidden_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "sensor",
            text: `EM scan reveals a concealed device. ${evidenceText}`,
            read: false,
          },
        ];

        // Add journal entry for the discovery
        next = addJournalEntry(
          next,
          `journal_hidden_${targetId}`,
          "item",
          `Hidden device: EM anomaly`,
          evidenceText,
          getPlayerRoomName(state),
        );
      }
      break;
    }

    case EntityType.CrewNPC: {
      const crewFirstName = target.props["firstName"] as string || "Unknown";
      const crewLastName = target.props["lastName"] as string || "Crew";
      const crewName = `${crewFirstName} ${crewLastName}`;
      const isUnconscious = target.props["unconscious"] === true;
      const isFound = target.props["found"] === true;
      const isSealed = target.props["sealed"] === true;
      const isFollowing = target.props["following"] === true;

      if (target.props["evacuated"] === true) {
        next.logs = [
          ...state.logs,
          {
            id: `log_crew_evac_done_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: `${crewName} has already been evacuated.`,
            read: false,
          },
        ];
      } else if (target.props["dead"] === true) {
        next.logs = [
          ...state.logs,
          {
            id: `log_crew_dead_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: `${crewName} didn't make it.`,
            read: false,
          },
        ];
      } else if (!isFound) {
        // First interaction: detect crew behind sealed door
        const newEntities = new Map(next.entities);
        newEntities.set(targetId, {
          ...target,
          props: { ...target.props, found: true },
        });
        next.entities = newEntities;

        // Check hazard levels near the crew for the warning
        const cx = target.pos.x;
        const cy = target.pos.y;
        let nearbyHeat = 0;
        let nearbyRadiation = 0;
        let nearbyLowPressure = false;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const tx = cx + dx;
            const ty = cy + dy;
            if (ty >= 0 && ty < state.height && tx >= 0 && tx < state.width) {
              const t = state.tiles[ty][tx];
              nearbyHeat = Math.max(nearbyHeat, t.heat);
              nearbyRadiation = Math.max(nearbyRadiation, t.radiation);
              if (t.pressure <= 40) nearbyLowPressure = true;
            }
          }
        }

        const hazards: string[] = [];
        if (nearbyHeat >= 30) hazards.push("heat");
        if (nearbyRadiation >= 30) hazards.push("radiation");
        if (nearbyLowPressure) hazards.push("low pressure");

        if (isSealed) {
          // Crew detected behind sealed door — browser will show Y/N prompt
          const hazardWarning = hazards.length > 0
            ? ` WARNING: ${hazards.join(", ")} detected outside.`
            : "";
          next.logs = [
            ...state.logs,
            {
              id: `log_crew_sealed_${targetId}_${next.turn}`,
              timestamp: next.turn,
              source: "narrative",
              text: `Life signs detected behind sealed emergency door: ${crewName}.${hazardWarning} Open door? [Y/N]`,
              read: false,
            },
          ];
        } else {
          // No seal — immediate discovery
          const personalityDescriptors: Record<string, string> = {
            cautious: "shaken",
            ambitious: "determined but frightened",
            loyal: "relieved to see you",
            secretive: "guarded",
            pragmatic: "injured but alert",
          };
          const personality = target.props["personality"] as string || "cautious";
          const descriptor = personalityDescriptors[personality] || "shaken";

          next.logs = [
            ...state.logs,
            {
              id: `log_crew_found_${targetId}_${next.turn}`,
              timestamp: next.turn,
              source: "narrative",
              text: isUnconscious
                ? `Found ${crewName} in cryo-stasis. Need to interact again to revive.`
                : `${crewName} found in ${getPlayerRoomName(state)}! They look ${descriptor}.`,
              read: false,
            },
          ];
        }

        // Add journal entry
        const crewId = target.props["crewId"] as string || targetId;
        next = addJournalEntry(
          next,
          `journal_crew_found_${crewId}`,
          "crew",
          `Crew found: ${crewName}`,
          `Discovered ${crewName} alive in ${getPlayerRoomName(state)}.${isSealed ? " Behind sealed emergency door." : ""}${isUnconscious ? " Currently in cryo-stasis." : ""}`,
          getPlayerRoomName(state),
        );

        // Initialize/update evacuation state
        if (next.mystery &&
            (next.mystery.objectivePhase === ObjectivePhase.Recover ||
             next.mystery.objectivePhase === ObjectivePhase.Evacuate)) {
          if (!next.mystery.evacuation || !next.mystery.evacuation.active) {
            const evacState: EvacuationState = {
              active: true,
              crewFound: [crewId],
              crewEvacuated: [],
              crewDead: [],
              podsPowered: [],
              evacuationStartTurn: next.turn,
            };
            next = {
              ...next,
              mystery: {
                ...next.mystery,
                objectivePhase: ObjectivePhase.Evacuate,
                evacuation: evacState,
              },
              logs: [
                ...next.logs,
                {
                  id: `log_evac_start_${next.turn}`,
                  timestamp: next.turn,
                  source: "system",
                  text: ">> EVACUATION PROTOCOL: Crew survivors detected. Locate the Escape Pod Bay and power pods for evacuation.",
                  read: false,
                },
              ],
            };
          } else {
            const evac = next.mystery.evacuation;
            if (!evac.crewFound.includes(crewId)) {
              next = {
                ...next,
                mystery: {
                  ...next.mystery,
                  evacuation: {
                    ...evac,
                    crewFound: [...evac.crewFound, crewId],
                  },
                },
              };
            }
          }
        }
      } else if (isFound && isSealed) {
        // Confirmed open: unseal the door, crew becomes accessible
        // Check hazards — opening exposes crew to danger
        const cx = target.pos.x;
        const cy = target.pos.y;
        const tile = state.tiles[cy]?.[cx];
        let immediateDamage = 0;
        const hazardTypes: string[] = [];
        if (tile) {
          if (tile.heat >= 30) { immediateDamage += 8; hazardTypes.push("heat"); }
          if (tile.radiation >= 30) { immediateDamage += 10; hazardTypes.push("radiation"); }
          if (tile.pressure <= 40) { immediateDamage += 6; hazardTypes.push("decompression"); }
        }

        const newEntities = new Map(next.entities);
        let crewHp = (target.props["hp"] as number) || 50;
        crewHp = Math.max(0, crewHp - immediateDamage);

        if (crewHp <= 0) {
          // Opening the door killed them — too much hazard exposure
          newEntities.set(targetId, {
            ...target,
            props: { ...target.props, sealed: false, dead: true, hp: 0 },
          });
          next.entities = newEntities;
          next.logs = [
            ...state.logs,
            {
              id: `log_crew_door_death_${targetId}_${next.turn}`,
              timestamp: next.turn,
              source: "narrative",
              text: `Door unsealed. ${hazardTypes.join(" and ")} floods in. ${crewName} didn't survive the exposure.`,
              read: false,
            },
          ];
          // Update evacuation dead list
          const crewId = target.props["crewId"] as string || targetId;
          if (next.mystery?.evacuation) {
            const evac = next.mystery.evacuation;
            next = {
              ...next,
              mystery: {
                ...next.mystery,
                evacuation: { ...evac, crewDead: [...evac.crewDead, crewId] },
              },
            };
          }
        } else {
          // Door opened — crew takes damage but survives
          newEntities.set(targetId, {
            ...target,
            props: { ...target.props, sealed: false, hp: crewHp },
          });
          next.entities = newEntities;

          const dmgMsg = immediateDamage > 0
            ? ` ${crewName} takes ${hazardTypes.join("/")} damage (-${immediateDamage} HP).`
            : "";
          next.logs = [
            ...state.logs,
            {
              id: `log_crew_unseal_${targetId}_${next.turn}`,
              timestamp: next.turn,
              source: "narrative",
              text: `Emergency door unsealed.${dmgMsg} Interact again to get ${crewName} moving.`,
              read: false,
            },
          ];
        }
      } else if (isFound && !isFollowing) {
        // Crew accessible — start following
        const newEntities = new Map(next.entities);
        if (isUnconscious) {
          newEntities.set(targetId, {
            ...target,
            props: { ...target.props, following: true, unconscious: false },
          });
          next.entities = newEntities;
          next.logs = [
            ...state.logs,
            {
              id: `log_crew_revive_${targetId}_${next.turn}`,
              timestamp: next.turn,
              source: "narrative",
              text: `Reviving ${crewName} from cryo-stasis... They're disoriented but mobile.`,
              read: false,
            },
          ];
        } else {
          newEntities.set(targetId, {
            ...target,
            props: { ...target.props, following: true },
          });
          next.entities = newEntities;
          next.logs = [
            ...state.logs,
            {
              id: `log_crew_follow_${targetId}_${next.turn}`,
              timestamp: next.turn,
              source: "narrative",
              text: `${crewName} is following you. Get them to the Escape Pod Bay.`,
              read: false,
            },
          ];
        }
      } else if (isFollowing) {
        next.logs = [
          ...state.logs,
          {
            id: `log_crew_following_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: `${crewName} is already following you. Find the Escape Pod Bay.`,
            read: false,
          },
        ];
      }
      break;
    }

    case EntityType.EscapePod: {
      const isPowered = target.props["powered"] === true;
      const boarded = (target.props["boarded"] as number) || 0;
      const capacity = (target.props["capacity"] as number) || 3;
      const podLabel = targetId.replace("escape_pod_", "Pod ");

      if (!isPowered) {
        // Check if player has a power cell
        const hasPowerCell = state.player.entity.props["powerCell"] === true;

        // Check if there's a powered fuse box or activated relay nearby (within 3 tiles)
        let nearbyPowerSource = false;
        for (const [, entity] of state.entities) {
          if ((entity.type === EntityType.FuseBox && entity.props["powered"] === true) ||
              (entity.type === EntityType.Relay && entity.props["activated"] === true && entity.props["locked"] !== true)) {
            const dist = Math.abs(entity.pos.x - target.pos.x) + Math.abs(entity.pos.y - target.pos.y);
            if (dist <= 3) {
              nearbyPowerSource = true;
              break;
            }
          }
        }

        if (nearbyPowerSource) {
          // Power the pod from nearby relay/fuse
          const newEntities = new Map(next.entities);
          newEntities.set(targetId, {
            ...target,
            props: { ...target.props, powered: true },
          });
          next.entities = newEntities;
          next.logs = [
            ...state.logs,
            {
              id: `log_pod_powered_${targetId}_${next.turn}`,
              timestamp: next.turn,
              source: "system",
              text: `Escape pod powered up. ${podLabel} ready for boarding.`,
              read: false,
            },
          ];
          // Update evacuation state
          if (next.mystery?.evacuation) {
            const evac = next.mystery.evacuation;
            if (!evac.podsPowered.includes(targetId)) {
              next = {
                ...next,
                mystery: {
                  ...next.mystery,
                  evacuation: {
                    ...evac,
                    podsPowered: [...evac.podsPowered, targetId],
                  },
                },
              };
            }
          }
        } else if (hasPowerCell) {
          // Use player's power cell
          const newEntities = new Map(next.entities);
          newEntities.set(targetId, {
            ...target,
            props: { ...target.props, powered: true },
          });
          const playerEntity = { ...state.player.entity, props: { ...state.player.entity.props, powerCell: false } };
          newEntities.set("player", playerEntity);
          next.player = { ...state.player, entity: playerEntity };
          next.entities = newEntities;
          next.logs = [
            ...state.logs,
            {
              id: `log_pod_cell_${targetId}_${next.turn}`,
              timestamp: next.turn,
              source: "system",
              text: `Power cell inserted. ${podLabel} online.`,
              read: false,
            },
          ];
          // Update evacuation state
          if (next.mystery?.evacuation) {
            const evac = next.mystery.evacuation;
            if (!evac.podsPowered.includes(targetId)) {
              next = {
                ...next,
                mystery: {
                  ...next.mystery,
                  evacuation: {
                    ...evac,
                    podsPowered: [...evac.podsPowered, targetId],
                  },
                },
              };
            }
          }
        } else {
          next.logs = [
            ...state.logs,
            {
              id: `log_pod_nopower_${targetId}_${next.turn}`,
              timestamp: next.turn,
              source: "system",
              text: "Escape pod unpowered. Need a power source \u2014 find a power cell or activate a relay.",
              read: false,
            },
          ];
        }
      } else if (boarded >= capacity) {
        next.logs = [
          ...state.logs,
          {
            id: `log_pod_full_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Pod at capacity. Find another escape pod for remaining crew.",
            read: false,
          },
        ];
      } else {
        // Pod is powered — board any following crew within 2 tiles
        const newEntities = new Map(next.entities);
        let boardedThisTurn = 0;
        const boardedNames: string[] = [];
        const newEvacuated: string[] = [];
        let currentBoarded = boarded;

        for (const [eid, entity] of state.entities) {
          if (entity.type !== EntityType.CrewNPC) continue;
          if (entity.props["following"] !== true) continue;
          if (entity.props["evacuated"] === true || entity.props["dead"] === true) continue;
          if (currentBoarded >= capacity) break;

          // Check if crew NPC is within 2 tiles of the pod
          const dist = Math.abs(entity.pos.x - target.pos.x) + Math.abs(entity.pos.y - target.pos.y);
          if (dist <= 2) {
            const crewName = `${entity.props["firstName"]} ${entity.props["lastName"]}`;
            newEntities.set(eid, {
              ...entity,
              props: { ...entity.props, following: false, evacuated: true },
            });
            boardedThisTurn++;
            currentBoarded++;
            boardedNames.push(crewName);
            const crewId = entity.props["crewId"] as string || eid;
            newEvacuated.push(crewId);
          }
        }

        if (boardedThisTurn > 0) {
          // Update pod boarded count
          newEntities.set(targetId, {
            ...target,
            props: { ...target.props, boarded: currentBoarded },
          });
          next.entities = newEntities;

          // Count remaining crew who need rescue
          let remaining = 0;
          for (const [, entity] of newEntities) {
            if (entity.type === EntityType.CrewNPC &&
                entity.props["evacuated"] !== true &&
                entity.props["dead"] !== true) {
              remaining++;
            }
          }

          const names = boardedNames.join(", ");
          const totalEvacuated = (next.mystery?.evacuation?.crewEvacuated.length || 0) + newEvacuated.length;
          next.logs = [
            ...state.logs,
            {
              id: `log_pod_board_${targetId}_${next.turn}`,
              timestamp: next.turn,
              source: "system",
              text: `${names} boards escape ${podLabel}. ${totalEvacuated} crew evacuated, ${remaining} still need rescue.`,
              read: false,
            },
          ];

          // Update evacuation state
          if (next.mystery?.evacuation) {
            const evac = next.mystery.evacuation;
            next = {
              ...next,
              mystery: {
                ...next.mystery,
                evacuation: {
                  ...evac,
                  crewEvacuated: [...evac.crewEvacuated, ...newEvacuated],
                },
              },
            };
          }
        } else {
          next.logs = [
            ...state.logs,
            {
              id: `log_pod_nocrew_${targetId}_${next.turn}`,
              timestamp: next.turn,
              source: "system",
              text: `${podLabel} is powered and ready. No crew following nearby. Find survivors and lead them here.`,
              read: false,
            },
          ];
        }
      }
      break;
    }

    case EntityType.RepairCradle: {
      const cooldown = (target.props["cooldown"] as number) || 0;
      if (cooldown > state.turn) {
        const remaining = cooldown - state.turn;
        next.logs = [
          ...state.logs,
          {
            id: `log_repair_cooldown_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: `Repair cradle cycling. Ready in ${remaining} turns.`,
            read: false,
          },
        ];
      } else if (state.player.hp >= state.player.maxHp) {
        next.logs = [
          ...state.logs,
          {
            id: `log_repair_full_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Diagnostic scan complete. All systems nominal. No repairs needed.",
            read: false,
          },
        ];
      } else {
        const healAmount = 30;
        const newHp = Math.min(state.player.maxHp, state.player.hp + healAmount);
        const actualHeal = newHp - state.player.hp;
        next.player = {
          ...state.player,
          hp: newHp,
        };
        // Set cooldown: 15 turns before next use
        const newEntities = new Map(next.entities);
        newEntities.set(targetId, {
          ...target,
          props: { ...target.props, cooldown: state.turn + 15 },
        });
        next.entities = newEntities;
        next.logs = [
          ...state.logs,
          {
            id: `log_repair_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: `Repair cradle activated. Hull patched, circuits resoldered. (+${actualHeal} HP, ${newHp}/${state.player.maxHp})`,
            read: false,
          },
        ];
      }
      break;
    }

    default:
      break;
  }

  return next;
}

/**
 * Handle scan action: reveals thermal overlay if player has thermal sensor.
 * Sets a "thermalScan" flag on nearby tiles to indicate they've been scanned.
 */
function handleScan(state: GameState): GameState {
  const sensors = state.player.sensors ?? [];
  if (!sensors.includes(SensorType.Thermal)) {
    // No thermal sensor equipped - scan does nothing meaningful
    return state;
  }

  // Reveal thermal overlay: mark entities with thermal info
  // In practice, the scan reveals heat values on tiles (already stored in tile.heat)
  // and marks relay entities as hotspots if they're overheating.
  const newEntities = new Map(state.entities);
  for (const [id, entity] of newEntities) {
    if (entity.type === EntityType.Relay && entity.props["overheating"] === true) {
      newEntities.set(id, {
        ...entity,
        props: { ...entity.props, scannedHotspot: true },
      });
    }
  }

  const next: GameState = {
    ...state,
    entities: newEntities,
    logs: [
      ...state.logs,
      {
        id: `log_scan_${state.turn}`,
        timestamp: state.turn,
        source: "sensor",
        text: "Thermal overlay active. Heat signatures glow through walls — overheating relays burn white-hot on the display.",
        read: false,
      },
    ],
  };

  return next;
}

/**
 * Handle look action: describe the player's current tile and nearby entities.
 */
function handleLook(state: GameState): GameState {
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;
  const tile = state.tiles[py][px];

  // Describe current tile
  const parts: string[] = [];

  if (tile.heat > 0) {
    const heatDesc = tile.heat >= 60 ? "dangerously hot" : tile.heat >= 30 ? "warm" : "slightly warm";
    parts.push(`Air is ${heatDesc} (heat: ${tile.heat})`);
  } else {
    parts.push("Air is cool");
  }

  if (tile.smoke > 0) {
    const smokeDesc = tile.smoke >= 50 ? "thick smoke" : tile.smoke >= 20 ? "hazy smoke" : "faint smoke";
    parts.push(`${smokeDesc} (smoke: ${tile.smoke})`);
  }

  // Describe adjacent entities
  const deltas = [
    { x: 0, y: -1, label: "north" },
    { x: 0, y: 1, label: "south" },
    { x: 1, y: 0, label: "east" },
    { x: -1, y: 0, label: "west" },
    { x: 0, y: 0, label: "here" },
  ];

  for (const d of deltas) {
    const nx = px + d.x;
    const ny = py + d.y;
    if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
    for (const [, entity] of state.entities) {
      if (entity.id === "player") continue;
      if (entity.pos.x === nx && entity.pos.y === ny) {
        const dist = Math.abs(d.x) + Math.abs(d.y);
        const name = entity.id.replace(/_/g, " ");
        if (dist === 0) {
          parts.push(`${name} is here`);
        } else {
          parts.push(`${name} is 1 tile ${d.label}`);
        }
      }
    }
  }

  const text = parts.length > 0 ? parts.join(". ") + "." : "Nothing notable here.";

  return {
    ...state,
    logs: [
      ...state.logs,
      {
        id: `log_look_${state.turn}`,
        timestamp: state.turn,
        source: "sensor",
        text,
        read: false,
      },
    ],
  };
}

/**
 * Move drone entities randomly each turn. Drones wander walkable tiles.
 * Uses a simple deterministic hash of turn + drone index for direction.
 * Item 14: Drones occasionally clean tiles they pass through (reduce dirt by 5).
 */
function moveDrones(state: GameState): GameState {
  const newEntities = new Map(state.entities);
  let changed = false;
  let newTiles = state.tiles;
  let tilesCloned = false;

  for (const [id, entity] of state.entities) {
    if (entity.type !== EntityType.Drone) continue;

    // Deterministic pseudo-random: pick direction based on turn + id hash
    const hash = (state.turn * 31 + id.charCodeAt(id.length - 1) * 7) % 5;
    if (hash === 4) continue; // 20% chance drone stays put

    const deltas = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: 1, y: 0 },
      { x: -1, y: 0 },
    ];
    const d = deltas[hash];
    const nx = entity.pos.x + d.x;
    const ny = entity.pos.y + d.y;

    if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
    if (!state.tiles[ny][nx].walkable) continue;

    newEntities.set(id, { ...entity, pos: { x: nx, y: ny } });
    changed = true;

    // Item 14: Drone cleaning behavior — reduce dirt by 5 on the tile they leave
    const ox = entity.pos.x;
    const oy = entity.pos.y;
    if (state.tiles[oy][ox].dirt > 0) {
      // 40% chance of cleaning (deterministic)
      const cleanHash = (state.turn * 13 + id.charCodeAt(id.length - 1) * 3) % 5;
      if (cleanHash < 2) {
        if (!tilesCloned) {
          newTiles = state.tiles.map(row => row.map(t => ({ ...t })));
          tilesCloned = true;
        }
        newTiles[oy][ox].dirt = Math.max(0, newTiles[oy][ox].dirt - 5);
      }
    }
  }

  if (!changed) return state;
  return { ...state, entities: newEntities, tiles: newTiles };
}

/**
 * Move repair bot entities each turn. Repair bots seek hot tiles and cool them down.
 * When following the player, they move toward the player instead.
 */
function moveRepairBots(state: GameState): GameState {
  const newEntities = new Map(state.entities);
  let newTiles = state.tiles;
  let tilesCloned = false;
  const newLogs = [...state.logs];
  let changed = false;

  for (const [id, entity] of state.entities) {
    if (entity.type !== EntityType.RepairBot) continue;

    // Decrement follow timer
    let followTurnsLeft = (entity.props["followTurnsLeft"] as number) || 0;
    const followPlayer = followTurnsLeft > 0;
    if (followTurnsLeft > 0) {
      followTurnsLeft--;
    }

    const ex = entity.pos.x;
    const ey = entity.pos.y;
    const currentTile = state.tiles[ey]?.[ex];

    // If standing on a hot tile (heat > 30), reduce heat by 8 instead of moving
    if (currentTile && currentTile.heat > 30 && !followPlayer) {
      if (!tilesCloned) {
        newTiles = state.tiles.map(row => row.map(t => ({ ...t })));
        tilesCloned = true;
      }
      newTiles[ey][ex].heat = Math.max(0, newTiles[ey][ex].heat - 8);
      const botLabel = id.replace("repair_bot_", "RB-0");
      newLogs.push({
        id: `log_repair_cool_${id}_${state.turn}`,
        timestamp: state.turn,
        source: "system",
        text: `Repair bot ${botLabel}: [COOLANT FLUSH] — thermal load reduced.`,
        read: false,
      });
      newEntities.set(id, {
        ...entity,
        props: { ...entity.props, followTurnsLeft },
      });
      changed = true;
      continue;
    }

    // Determine target position
    let targetX = -1;
    let targetY = -1;

    if (followPlayer) {
      // Move toward player
      targetX = state.player.entity.pos.x;
      targetY = state.player.entity.pos.y;
    } else {
      // Scan tiles in radius 10 for highest heat tile > 30
      let bestHeat = 30;
      for (let dy = -10; dy <= 10; dy++) {
        for (let dx = -10; dx <= 10; dx++) {
          const tx = ex + dx;
          const ty = ey + dy;
          if (tx < 0 || tx >= state.width || ty < 0 || ty >= state.height) continue;
          if (Math.abs(dx) + Math.abs(dy) > 10) continue;
          const tile = state.tiles[ty][tx];
          if (tile.walkable && tile.heat > bestHeat) {
            bestHeat = tile.heat;
            targetX = tx;
            targetY = ty;
          }
        }
      }
    }

    // Move one step toward target, or wander randomly
    let nx = ex;
    let ny = ey;

    if (targetX >= 0 && targetY >= 0) {
      // Simple deterministic step toward target
      const dx = targetX - ex;
      const dy = targetY - ey;
      if (Math.abs(dx) >= Math.abs(dy)) {
        nx = ex + (dx > 0 ? 1 : -1);
      } else {
        ny = ey + (dy > 0 ? 1 : -1);
      }
    } else {
      // Wander randomly like drones
      const hash = (state.turn * 37 + id.charCodeAt(id.length - 1) * 11) % 5;
      if (hash === 4) {
        // Stay put
        newEntities.set(id, { ...entity, props: { ...entity.props, followTurnsLeft } });
        changed = true;
        continue;
      }
      const deltas = [
        { x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: 0 },
      ];
      const d = deltas[hash];
      nx = ex + d.x;
      ny = ey + d.y;
    }

    if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height ||
        !state.tiles[ny][nx].walkable) {
      newEntities.set(id, { ...entity, props: { ...entity.props, followTurnsLeft } });
      changed = true;
      continue;
    }

    newEntities.set(id, { ...entity, pos: { x: nx, y: ny }, props: { ...entity.props, followTurnsLeft } });
    changed = true;
  }

  if (!changed) return state;
  return { ...state, entities: newEntities, tiles: newTiles, logs: newLogs };
}

/**
 * Move patrol drones. Non-hostile drones patrol randomly and scan the player
 * on contact (harmless nuisance). Hostile drones (rogue AI scenario) hunt
 * the player and deal damage.
 */
function movePatrolDrones(state: GameState): GameState {
  // Patrol drones move every PATROL_DRONE_SPEED turns
  if (state.turn % PATROL_DRONE_SPEED !== 0) return state;

  const newEntities = new Map(state.entities);
  const newLogs = [...state.logs];
  let playerHp = state.player.hp;
  let playerStun = state.player.stunTurns;
  let changed = false;

  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;

  for (const [id, entity] of state.entities) {
    if (entity.type !== EntityType.PatrolDrone) continue;

    const ex = entity.pos.x;
    const ey = entity.pos.y;
    const isHostile = entity.props["hostile"] === true;

    const dx = px - ex;
    const dy = py - ey;
    let nx = ex;
    let ny = ey;

    if (isHostile) {
      // Hostile: attack cooldown + hunt/retreat behavior
      const lastAttackTurn = (entity.props["lastAttackTurn"] as number) || -999;
      const onCooldown = (state.turn - lastAttackTurn) < PATROL_DRONE_ATTACK_COOLDOWN;

      if (onCooldown) {
        if (Math.abs(dx) >= Math.abs(dy)) {
          nx = ex + (dx > 0 ? -1 : 1);
        } else {
          ny = ey + (dy > 0 ? -1 : 1);
        }
      } else {
        if (Math.abs(dx) >= Math.abs(dy)) {
          nx = ex + (dx > 0 ? 1 : dx < 0 ? -1 : 0);
        } else {
          ny = ey + (dy > 0 ? 1 : dy < 0 ? -1 : 0);
        }
      }

      // Validate move
      if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height ||
          !state.tiles[ny][nx].walkable) {
        if (onCooldown) {
          if (Math.abs(dx) >= Math.abs(dy)) { nx = ex; ny = ey + (dy > 0 ? -1 : 1); }
          else { nx = ex + (dx > 0 ? -1 : 1); ny = ey; }
        } else {
          if (Math.abs(dx) >= Math.abs(dy)) { nx = ex; ny = ey + (dy > 0 ? 1 : dy < 0 ? -1 : 0); }
          else { nx = ex + (dx > 0 ? 1 : dx < 0 ? -1 : 0); ny = ey; }
        }
        if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height ||
            !state.tiles[ny][nx].walkable) {
          continue;
        }
      }

      newEntities.set(id, { ...entity, pos: { x: nx, y: ny } });
      changed = true;

      // Hostile collision — deal damage
      if (nx === px && ny === py && !onCooldown) {
        playerHp = Math.max(0, playerHp - PATROL_DRONE_DAMAGE);
        if (PATROL_DRONE_STUN_TURNS > 0) {
          playerStun = PATROL_DRONE_STUN_TURNS;
        }
        newEntities.set(id, {
          ...entity,
          pos: { x: nx, y: ny },
          props: { ...entity.props, lastAttackTurn: state.turn },
        });
        newLogs.push({
          id: `log_drone_hit_${id}_${state.turn}`,
          timestamp: state.turn,
          source: "system",
          text: `ALERT: Rogue drone attack! Systems damaged (-${PATROL_DRONE_DAMAGE} HP). Drone retreating to recharge.`,
          read: false,
        });
      }
    } else {
      // Non-hostile: random patrol movement, avoid player tile
      const directions = [
        { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
      ];
      // Deterministic direction choice from turn + entity position
      const dirIdx = (state.turn * 7 + ex * 13 + ey * 31) % directions.length;
      const dir = directions[dirIdx];
      nx = ex + dir.x;
      ny = ey + dir.y;

      // Validate
      if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height ||
          !state.tiles[ny][nx].walkable) {
        // Try next direction
        const altIdx = (dirIdx + 1) % directions.length;
        nx = ex + directions[altIdx].x;
        ny = ey + directions[altIdx].y;
        if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height ||
            !state.tiles[ny][nx].walkable) {
          continue; // stuck, stay put
        }
      }

      // Don't walk onto the player — just stop
      if (nx === px && ny === py) {
        // Scan the player instead
        const lastScanTurn = (entity.props["lastScanTurn"] as number) || -999;
        if (state.turn - lastScanTurn >= 8) {
          newEntities.set(id, {
            ...entity,
            props: { ...entity.props, lastScanTurn: state.turn },
          });
          changed = true;
          newLogs.push({
            id: `log_drone_scan_${id}_${state.turn}`,
            timestamp: state.turn,
            source: "system",
            text: "Patrol drone scans your badge. Clearance verified. It beeps and moves on.",
            read: false,
          });
        }
        continue; // don't move onto player
      }

      newEntities.set(id, { ...entity, pos: { x: nx, y: ny } });
      changed = true;
    }
  }

  if (!changed) return state;
  return {
    ...state,
    entities: newEntities,
    logs: newLogs,
    player: {
      ...state.player,
      hp: playerHp,
      alive: playerHp > 0,
      stunTurns: playerStun,
    },
  };
}

/**
 * Move crew NPCs that are following the player.
 * Following crew move 1 step toward the player using simple greedy pathfinding.
 * They stay 1-2 tiles behind (don't stack on the player tile).
 * Crew take hazard damage from heat, radiation, and low pressure.
 */
function moveCrewNPCs(state: GameState): GameState {
  const newEntities = new Map(state.entities);
  const newLogs = [...state.logs];
  let changed = false;
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;

  const newDeadIds: string[] = [];

  for (const [id, entity] of state.entities) {
    if (entity.type !== EntityType.CrewNPC) continue;
    if (entity.props["following"] !== true) continue;
    if (entity.props["evacuated"] === true || entity.props["dead"] === true) continue;

    const ex = entity.pos.x;
    const ey = entity.pos.y;
    let crewHp = (entity.props["hp"] as number) || 50;
    const crewName = `${entity.props["firstName"]} ${entity.props["lastName"]}`;

    // ── Hazard damage to following crew ──────────────────────────
    const tile = state.tiles[ey]?.[ex];
    let hazardDamage = 0;
    let hazardType = "";
    if (tile) {
      if (tile.heat >= 40) {
        hazardDamage += 3;
        hazardType = "heat";
      }
      if (tile.radiation >= 50) {
        hazardDamage += 4;
        hazardType = hazardType ? "environmental hazards" : "radiation";
      }
      if (tile.pressure <= 40) {
        hazardDamage += 3;
        hazardType = hazardType ? "environmental hazards" : "decompression";
      }
    }

    if (hazardDamage > 0) {
      crewHp = Math.max(0, crewHp - hazardDamage);
    }

    // ── Check if crew dies ──────────────────────────────────────
    if (crewHp <= 0) {
      newEntities.set(id, {
        ...entity,
        props: { ...entity.props, hp: 0, following: false, dead: true },
      });
      const crewId = entity.props["crewId"] as string || id;
      newDeadIds.push(crewId);
      newLogs.push({
        id: `log_crew_death_${id}_${state.turn}`,
        timestamp: state.turn,
        source: "narrative",
        text: `${crewName} couldn't survive the ${hazardType}. You couldn't save everyone.`,
        read: false,
      });
      changed = true;
      continue;
    }

    // ── Movement toward player ──────────────────────────────────
    const dx = px - ex;
    const dy = py - ey;
    const dist = Math.abs(dx) + Math.abs(dy);

    // Don't move if already adjacent (within 1-2 tiles)
    if (dist <= 1) {
      // Update HP if it changed from hazard damage
      if (crewHp !== (entity.props["hp"] as number)) {
        newEntities.set(id, { ...entity, props: { ...entity.props, hp: crewHp } });
        changed = true;
      }
      continue;
    }

    // Greedy pathfinding: move along the longer axis
    let nx = ex;
    let ny = ey;
    if (Math.abs(dx) >= Math.abs(dy)) {
      nx = ex + (dx > 0 ? 1 : -1);
    } else {
      ny = ey + (dy > 0 ? 1 : -1);
    }

    // Validate move
    if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height ||
        !state.tiles[ny][nx].walkable) {
      // Try alternate axis
      nx = ex;
      ny = ey;
      if (Math.abs(dx) >= Math.abs(dy)) {
        ny = ey + (dy > 0 ? 1 : dy < 0 ? -1 : 0);
      } else {
        nx = ex + (dx > 0 ? 1 : dx < 0 ? -1 : 0);
      }
      if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height ||
          !state.tiles[ny][nx].walkable) {
        // Can't move - just update HP
        if (crewHp !== (entity.props["hp"] as number)) {
          newEntities.set(id, { ...entity, props: { ...entity.props, hp: crewHp } });
          changed = true;
        }
        continue;
      }
    }

    // Don't move onto the player's tile
    if (nx === px && ny === py) {
      // Stay put but update HP
      if (crewHp !== (entity.props["hp"] as number)) {
        newEntities.set(id, { ...entity, props: { ...entity.props, hp: crewHp } });
        changed = true;
      }
      continue;
    }

    newEntities.set(id, { ...entity, pos: { x: nx, y: ny }, props: { ...entity.props, hp: crewHp } });
    changed = true;
  }

  if (!changed && newDeadIds.length === 0) return state;

  let result: GameState = { ...state, entities: newEntities, logs: newLogs };

  // Update evacuation state with dead crew
  if (newDeadIds.length > 0 && result.mystery?.evacuation) {
    const evac = result.mystery.evacuation;
    result = {
      ...result,
      mystery: {
        ...result.mystery,
        evacuation: {
          ...evac,
          crewDead: [...evac.crewDead, ...newDeadIds],
        },
      },
    };
  }

  return result;
}

/**
 * Pure function: apply one action to produce the next game state.
 * Returns a new state (immutable style for replay determinism).
 */
export function step(state: GameState, action: Action): GameState {
  if (!isValidAction(state, action)) return state;

  // Stun check: if player is stunned, skip their action and just tick systems
  if (state.player.stunTurns > 0) {
    let next: GameState = {
      ...state,
      turn: state.turn + 1,
      player: {
        ...state.player,
        stunTurns: state.player.stunTurns - 1,
      },
    };
    if (state.player.stunTurns === 1) {
      next.logs = [
        ...next.logs,
        {
          id: `log_stun_recover_${next.turn}`,
          timestamp: next.turn,
          source: "system",
          text: "Motor control restored. Systems back online.",
          read: false,
        },
      ];
    } else {
      next.logs = [
        ...next.logs,
        {
          id: `log_stun_${next.turn}`,
          timestamp: next.turn,
          source: "system",
          text: `Systems disrupted. Motor control locked (${state.player.stunTurns - 1} turns remaining).`,
          read: false,
        },
      ];
    }
    next = moveDrones(next);
    next = moveRepairBots(next);
    next = moveCrewNPCs(next);
    next = movePatrolDrones(next);
    next = tickHazards(next);
    next = tickDeterioration(next);
    next = applyHazardDamage(next);
    next = checkWinCondition(next);
    next = checkLossCondition(next);
    next = updateVision(next);
    return next;
  }

  // Shallow-clone top-level (deep clone tiles only when mutating)
  let next: GameState = { ...state, turn: state.turn + 1 };

  switch (action.type) {
    case ActionType.Move: {
      if (!action.direction) break;
      const delta = getDirectionDelta(action.direction);
      const newPos = {
        x: state.player.entity.pos.x + delta.x,
        y: state.player.entity.pos.y + delta.y,
      };
      next.player = {
        ...state.player,
        entity: { ...state.player.entity, pos: newPos },
      };
      // Also update the player entity in the entities map
      const newEntities = new Map(next.entities);
      newEntities.set("player", next.player.entity);
      next.entities = newEntities;

      // Hot zone movement penalty: extreme heat costs an extra turn
      if (state.tiles[newPos.y][newPos.x].heat >= 80) {
        next.turn += 1; // extra turn (2 total instead of 1)
        next = tickHazards(next);
        next = tickHazards(next);
        next = tickDeterioration(next);
        next.logs = [
          ...next.logs,
          {
            id: `log_heat_slow_${next.turn}`,
            timestamp: next.turn,
            source: "system" as const,
            text: "Heat slows movement. Systems struggling.",
            read: false,
          },
        ];
        next = movePatrolDrones(next);
        next = applyHazardDamage(next);
        next = checkWinCondition(next);
        next = checkLossCondition(next);
        next = updateVision(next);
        return next;
      }
      break;
    }
    case ActionType.Wait:
      break;
    case ActionType.Interact:
      next = { ...handleInteract(next, action.targetId), turn: next.turn };
      break;
    case ActionType.Scan:
      next = { ...handleScan(next), turn: next.turn };
      break;
    case ActionType.Clean:
      // Clean action: fully clear smoke, reduce dirt, reduce adjacent heat near relays
      {
        const px = next.player.entity.pos.x;
        const py = next.player.entity.pos.y;
        const tile = state.tiles[py][px];

        // Check if there's anything to clean
        let nearRelay = false;
        for (const [, entity] of state.entities) {
          if (entity.type === EntityType.Relay) {
            const dist = Math.abs(entity.pos.x - px) + Math.abs(entity.pos.y - py);
            if (dist <= 2) { nearRelay = true; break; }
          }
        }
        const hasHiddenItems = [...state.entities.values()].some(
          e => e.type === EntityType.CrewItem && e.pos.x === px && e.pos.y === py && e.props["hidden"] === true
        );
        const hasNearbyRubble = [...state.entities.values()].some(
          e => e.type === EntityType.Rubble && Math.abs(e.pos.x - px) + Math.abs(e.pos.y - py) <= 1
        );
        if (tile.dirt === 0 && tile.smoke === 0 && !nearRelay && !hasHiddenItems && !hasNearbyRubble) {
          next.logs = [...next.logs, {
            id: `log_clean_none_${next.turn}`,
            timestamp: next.turn,
            source: "system" as const,
            text: "This area is already clean.",
            read: false,
          }];
          break;
        }

        const newTiles = state.tiles.map((row) => row.map((t) => ({ ...t })));

        // If smoke > 0, fully clear it (Item 2: cleaning fully clears smoke)
        if (newTiles[py][px].smoke > 0) {
          newTiles[py][px].smoke = 0;
        }

        // Reduce dirt on player's tile (25-35 points, deterministic)
        const dirtReduction = 25 + ((px * 7 + py * 13 + next.turn * 3) % 11); // 25-35
        newTiles[py][px].dirt = Math.max(0, newTiles[py][px].dirt - dirtReduction);

        // Reduce dirt on adjacent walkable tiles (10-15 points)
        const adjacentDeltas = [
          { x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: 0 },
        ];
        for (const d of adjacentDeltas) {
          const ax = px + d.x;
          const ay = py + d.y;
          if (ax >= 0 && ax < state.width && ay >= 0 && ay < state.height && newTiles[ay][ax].walkable) {
            const adjDirtReduction = 10 + ((ax * 3 + ay * 11 + next.turn) % 6); // 10-15
            newTiles[ay][ax].dirt = Math.max(0, newTiles[ay][ax].dirt - adjDirtReduction);
          }
        }

        // Item 2: Cleaning near a relay reduces heat by 10 on adjacent tiles
        if (nearRelay) {
          for (const d of adjacentDeltas) {
            const nx = px + d.x;
            const ny = py + d.y;
            if (nx >= 0 && nx < state.width && ny >= 0 && ny < state.height) {
              newTiles[ny][nx].heat = Math.max(0, newTiles[ny][nx].heat - 10);
            }
          }
          // Also reduce heat on player's tile
          newTiles[py][px].heat = Math.max(0, newTiles[py][px].heat - 10);
        }

        next.tiles = newTiles;

        // Item 3: Cleaning a tile may reveal hidden crew items
        const newEntities = new Map(next.entities);
        for (const [id, entity] of newEntities) {
          if (entity.type === EntityType.CrewItem &&
              entity.pos.x === px && entity.pos.y === py &&
              entity.props["hidden"] === true &&
              newTiles[py][px].dirt < 60) {
            newEntities.set(id, {
              ...entity,
              props: { ...entity.props, hidden: false, revealed: true },
            });
          }
        }
        // Clear rubble on player tile and adjacent tiles
        let rubbleCleared = 0;
        const adjacentRubbleDeltas = [
          { x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: 0 },
        ];
        for (const [id, entity] of newEntities) {
          if (entity.type === EntityType.Rubble) {
            const dist = Math.abs(entity.pos.x - px) + Math.abs(entity.pos.y - py);
            if (dist <= 1) {
              newEntities.delete(id);
              // Restore tile walkability
              newTiles[entity.pos.y][entity.pos.x].walkable = true;
              rubbleCleared++;
            }
          }
        }
        next.entities = newEntities;

        // Item 5: Contextual cleaning log messages
        const cleanLogs: LogEntry[] = [];
        if (rubbleCleared > 0) {
          cleanLogs.push({
            id: `log_clean_rubble_${next.turn}`,
            timestamp: next.turn,
            source: "system" as const,
            text: rubbleCleared === 1
              ? "Clearing debris. Passage restored."
              : `Clearing debris. ${rubbleCleared} passages restored.`,
            read: false,
          });
        }
        const oldSmoke = state.tiles[py][px].smoke;
        const oldDirt = state.tiles[py][px].dirt;
        if (oldSmoke > 0) {
          cleanLogs.push({
            id: `log_clean_smoke_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Scrubbing carbon residue. Air quality improving.",
            read: false,
          });
        }
        if (oldDirt > 50) {
          cleanLogs.push({
            id: `log_clean_dirt_${next.turn}`,
            timestamp: next.turn,
            source: "narrative",
            text: "Under the grime: boot prints heading aft. Someone was in a hurry.",
            read: false,
          });
        }
        if (nearRelay) {
          cleanLogs.push({
            id: `log_clean_relay_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Coolant channels cleared. Heat dissipation improving.",
            read: false,
          });
        }
        // Check if any hidden items were just revealed
        for (const [cid, centity] of newEntities) {
          if (centity.type === EntityType.CrewItem &&
              centity.pos.x === px && centity.pos.y === py &&
              centity.props["revealed"] === true &&
              centity.props["hidden"] === false) {
            // Check if this was hidden before (in the original state)
            const orig = state.entities.get(cid);
            if (orig && orig.props["hidden"] === true) {
              cleanLogs.push({
                id: `log_clean_reveal_${cid}_${next.turn}`,
                timestamp: next.turn,
                source: "narrative",
                text: "Something under the debris — a personal item, left behind.",
                read: false,
              });
            }
          }
        }
        // Item 13: Room-specific cleaning discoveries
        let cleanRoom: string | null = null;
        for (const room of state.rooms) {
          if (px >= room.x && px < room.x + room.width &&
              py >= room.y && py < room.y + room.height) {
            cleanRoom = room.name;
            break;
          }
        }
        const roomCleaningDiscoveries: Record<string, string> = {
          "Crew Quarters": "Under the dust: initials carved into the bunk frame. K.V. Someone marking their territory.",
          "Research Lab": "The floor under the grime is scored with equipment drag marks. They moved something heavy recently.",
          "Communications Hub": "Cleaning reveals a sticky note behind a console: 'If Okafor asks, uplink was down for maintenance.'",
        };
        if (cleanRoom && roomCleaningDiscoveries[cleanRoom]) {
          // Only show once per room — use deterministic check
          const roomHash = (px * 7 + py * 13 + next.turn) % 3;
          if (roomHash === 0) {
            cleanLogs.push({
              id: `log_clean_room_${cleanRoom}_${next.turn}`,
              timestamp: next.turn,
              source: "narrative",
              text: roomCleaningDiscoveries[cleanRoom],
              read: false,
            });
          }
        }

        // Cleaning directive: room cleanliness log
        const roomName = getPlayerRoomName(next);
        const roomCleanliness = getRoomCleanliness(next, roomName);
        cleanLogs.push({
          id: `log_clean_directive_${next.turn}`,
          timestamp: next.turn,
          source: "system",
          text: `Cleaning protocol engaged. ${roomName} cleanliness: ${roomCleanliness}%`,
          read: false,
        });

        // Reset directive violation turns when player cleans
        if (next.mystery && next.mystery.cleaningDirective) {
          next = {
            ...next,
            mystery: {
              ...next.mystery,
              directiveViolationTurns: 0,
            },
          };
        }

        // Track rooms cleaned to goal — triggers investigation subgoal
        if (next.mystery && roomCleanliness >= next.mystery.roomCleanlinessGoal) {
          // Check if this room was already counted as clean
          const prevCleanliness = getRoomCleanliness(state, roomName);
          if (prevCleanliness < next.mystery.roomCleanlinessGoal) {
            const newCleanedCount = next.mystery.roomsCleanedCount + 1;
            next = {
              ...next,
              mystery: {
                ...next.mystery,
                roomsCleanedCount: newCleanedCount,
              },
            };
            cleanLogs.push({
              id: `log_room_cleaned_${roomName}_${next.turn}`,
              timestamp: next.turn,
              source: "system",
              text: `✓ ${roomName} cleaned to standard. (${newCleanedCount} room${newCleanedCount > 1 ? "s" : ""} complete)`,
              read: false,
            });

            // Check if cleaning enough rooms triggers investigation subgoal
            if (next.mystery!.objectivePhase === ObjectivePhase.Clean &&
                newCleanedCount >= next.mystery!.investigationTrigger) {
              next = {
                ...next,
                mystery: {
                  ...next.mystery!,
                  objectivePhase: ObjectivePhase.Investigate,
                },
              };
              cleanLogs.push({
                id: `log_yellow_alert_${next.turn}`,
                timestamp: next.turn,
                source: "station",
                text: "⚠ YELLOW ALERT: Station anomaly detected. All non-critical objectives paused.",
                read: false,
              });
              cleanLogs.push({
                id: `log_investigate_trigger_${next.turn}`,
                timestamp: next.turn,
                source: "comms",
                text: ">> INCOMING TRANSMISSION: Contact lost with station crew. Cascading system failures detected. Investigate immediately.",
                read: false,
              });
            }
          }
        }

        if (cleanLogs.length > 0) {
          next.logs = [...(next.logs || state.logs), ...cleanLogs];
        }
      }
      break;
    case ActionType.Look:
      next = handleLook(next);
      break;
    case ActionType.Journal:
      // Journal is a free action — no turn advance, no hazard tick
      // The browser layer handles the UI; sim just needs to not reject it
      return next;
    default:
      break;
  }

  // Drone movement: drones wander each turn
  next = moveDrones(next);

  // Repair bot movement: seek and cool hot tiles
  next = moveRepairBots(next);

  // Crew NPC movement: following crew trail the player
  next = moveCrewNPCs(next);

  // Patrol drone movement: hunt the player
  next = movePatrolDrones(next);

  // Hazard tick: heat/smoke spread each turn
  next = tickHazards(next);

  // Station deterioration: periodic escalation
  next = tickDeterioration(next);

  // Apply hazard damage to player
  next = applyHazardDamage(next);

  // Station integrity decay
  next = tickStationIntegrity(next);

  // Cleaning directive pressure check
  next = checkCleaningDirective(next);

  // Check win/loss conditions
  next = checkWinCondition(next);
  next = checkLossCondition(next);

  // Update fog-of-war vision
  next = updateVision(next);

  return next;
}
