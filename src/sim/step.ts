import type { Action, GameState, Entity, LogEntry, Attachment } from "../shared/types.js";
import { ActionType, EntityType, TileType, AttachmentSlot, SensorType } from "../shared/types.js";
import { GLYPHS } from "../shared/constants.js";
import { isValidAction, getDirectionDelta } from "./actions.js";
import { tickHazards, applyHazardDamage } from "./hazards.js";
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
      return entity.props["accessed"] === true;
    case EntityType.CrewItem:
      return entity.props["examined"] === true || entity.props["hidden"] === true;
    case EntityType.LogTerminal:
      return state.logs.some(l => l.id === `log_terminal_${entity.id}`);
    default:
      return false;
  }
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
      // Pick up sensor and equip it
      const sensorType = (target.props["sensorType"] as SensorType) || SensorType.Thermal;
      const currentSensor = state.player.attachments[AttachmentSlot.Sensor];

      // Sensor choice: if player already has a non-cleanliness sensor, warn before replacing
      if (currentSensor && currentSensor.sensorType !== SensorType.Cleanliness &&
          currentSensor.sensorType !== sensorType &&
          target.props["confirmReplace"] !== true) {
        // First interact: show warning
        const newEntities = new Map(state.entities);
        newEntities.set(targetId, {
          ...target,
          props: { ...target.props, confirmReplace: true },
        });
        next.entities = newEntities;
        next.logs = [
          ...state.logs,
          {
            id: `log_sensor_warn_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: `WARNING: Equipping ${sensorType} sensor will replace your ${currentSensor.sensorType} sensor. Press [i] again to confirm.`,
            read: false,
          },
        ];
        break;
      }

      const attachment: Attachment = {
        slot: AttachmentSlot.Sensor,
        name: `${sensorType} sensor`,
        sensorType,
      };
      next.player = {
        ...state.player,
        attachments: { ...state.player.attachments, [AttachmentSlot.Sensor]: attachment },
      };
      // Remove the pickup entity
      const newEntities = new Map(state.entities);
      newEntities.delete(targetId);
      next.entities = newEntities;

      // Sensor-specific log messages
      const sensorLogMessages: Record<string, string> = {
        [SensorType.Thermal]: "Thermal sensor module installed. Vasquez left this here — factory sealed, never used. Scan mode now available.",
        [SensorType.Atmospheric]: "Atmospheric sensor module installed. Pressure differentials now visible. Breaches glow red on the overlay.",
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
        const sensor = state.player.attachments[AttachmentSlot.Sensor];
        if (!sensor || sensor.sensorType !== SensorType.Thermal) {
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
      // Transmit: win condition
      next.victory = true;
      next.gameOver = true;
      next.logs = [
        ...state.logs,
        {
          id: `log_transmit`,
          timestamp: next.turn,
          source: "data_core",
          text: "Uplink locked. Nine months of research streaming through the low-band relay. The crew's work survives.",
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
        const sensor = state.player.attachments[AttachmentSlot.Sensor];
        if (!sensor || sensor.sensorType !== SensorType.Atmospheric) {
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
      // Open a closed shortcut door
      if (target.props["closed"] === true) {
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
      } else {
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
      }
      break;
    }

    case EntityType.SecurityTerminal: {
      if (target.props["accessed"] === true) {
        next.logs = [
          ...state.logs,
          {
            id: `log_secterm_reuse_${targetId}_${next.turn}`,
            timestamp: next.turn,
            source: "system",
            text: "Security terminal already accessed. Camera feeds still active on station map.",
            read: false,
          },
        ];
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
  const sensor = state.player.attachments[AttachmentSlot.Sensor];
  if (!sensor || sensor.sensorType !== SensorType.Thermal) {
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
 * Pure function: apply one action to produce the next game state.
 * Returns a new state (immutable style for replay determinism).
 */
export function step(state: GameState, action: Action): GameState {
  if (!isValidAction(state, action)) return state;

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
        // Skip the normal hazard tick at the end since we already ticked twice
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
        const newTiles = state.tiles.map((row) => row.map((t) => ({ ...t })));

        // If smoke > 0, fully clear it (Item 2: cleaning fully clears smoke)
        if (newTiles[py][px].smoke > 0) {
          newTiles[py][px].smoke = 0;
        }

        // Reduce dirt on player's tile
        newTiles[py][px].dirt = Math.max(0, newTiles[py][px].dirt - 25);

        // Item 2: Cleaning near a relay reduces heat by 10 on adjacent tiles
        const adjacentDeltas = [
          { x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: 0 },
        ];
        let nearRelay = false;
        for (const [, entity] of state.entities) {
          if (entity.type === EntityType.Relay) {
            const dist = Math.abs(entity.pos.x - px) + Math.abs(entity.pos.y - py);
            if (dist <= 2) {
              nearRelay = true;
              break;
            }
          }
        }
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
        next.entities = newEntities;

        // Item 5: Contextual cleaning log messages
        const cleanLogs: LogEntry[] = [];
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

        if (cleanLogs.length > 0) {
          next.logs = [...(next.logs || state.logs), ...cleanLogs];
        }
      }
      break;
    case ActionType.Look:
      next = handleLook(next);
      break;
    default:
      break;
  }

  // Drone movement: drones wander each turn
  next = moveDrones(next);

  // Repair bot movement: seek and cool hot tiles
  next = moveRepairBots(next);

  // Hazard tick: heat/smoke spread each turn
  next = tickHazards(next);

  // Apply hazard damage to player
  next = applyHazardDamage(next);

  // Check win/loss conditions
  next = checkWinCondition(next);
  next = checkLossCondition(next);

  // Update fog-of-war vision
  next = updateVision(next);

  return next;
}
