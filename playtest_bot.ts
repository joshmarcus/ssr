/**
 * Heuristic exploration bot — plays the game locally without API calls.
 * Uses BFS to explore systematically, interacts with everything, and tries to win.
 */
import { generate } from "./src/sim/procgen.js";
import { step } from "./src/sim/step.js";
import { isValidAction, hasUnlockedDoorAt, isAutoSealedBulkhead } from "./src/sim/actions.js";
import { getUnlockedDeductions, generateEvidenceTags } from "./src/sim/deduction.js";
import { getRoomCleanliness, getRoomAt } from "./src/sim/rooms.js";
import { isEntityExhausted } from "./src/shared/ui.js";
import type { GameState, Action, Position, Entity, Direction } from "./src/shared/types.js";
import { ActionType, EntityType, ObjectivePhase, Difficulty } from "./src/shared/types.js";

const SEED = parseInt(process.argv[2] || "42", 10);
const diffArg = process.argv[3] || "normal";
const DIFFICULTY: Difficulty = diffArg === "easy" ? Difficulty.Easy
  : diffArg === "hard" ? Difficulty.Hard
  : Difficulty.Normal;

const DIRS: Array<{ dir: Direction; dx: number; dy: number }> = [
  { dir: "north" as Direction, dx: 0, dy: -1 },
  { dir: "south" as Direction, dx: 0, dy: 1 },
  { dir: "east" as Direction, dx: 1, dy: 0 },
  { dir: "west" as Direction, dx: -1, dy: 0 },
  { dir: "northeast" as Direction, dx: 1, dy: -1 },
  { dir: "northwest" as Direction, dx: -1, dy: -1 },
  { dir: "southeast" as Direction, dx: 1, dy: 1 },
  { dir: "southwest" as Direction, dx: -1, dy: 1 },
];

function manhattan(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** BFS pathfinding to nearest unexplored walkable tile or target position */
function bfsToTarget(
  state: GameState,
  from: Position,
  isTarget: (x: number, y: number) => boolean,
  allowDangerous: boolean = false,
): Direction | null {
  const bfsVisited = new Set<string>();
  const queue: Array<{ x: number; y: number; firstDir: Direction | null }> = [];

  bfsVisited.add(`${from.x},${from.y}`);

  for (const d of DIRS) {
    const nx = from.x + d.dx;
    const ny = from.y + d.dy;
    const moveAction: Action = { type: ActionType.Move, direction: d.dir };
    if (isValidAction(state, moveAction)) {
      // Avoid going back to the position we just came from (anti-oscillation)
      if (lastPos && nx === lastPos.x && ny === lastPos.y) continue;
      if (isTarget(nx, ny)) return d.dir;
      bfsVisited.add(`${nx},${ny}`);
      queue.push({ x: nx, y: ny, firstDir: d.dir });
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const d of DIRS) {
      const nx = current.x + d.dx;
      const ny = current.y + d.dy;
      const key = `${nx},${ny}`;
      if (bfsVisited.has(key)) continue;
      if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
      const tile = state.tiles[ny][nx];
      // Treat doors as passable (player auto-opens on bump)
      if (!tile.walkable && !hasUnlockedDoorAt(state, nx, ny) && !isAutoSealedBulkhead(state, nx, ny)) continue;
      // Skip very dangerous tiles (unless allowDangerous)
      if (!allowDangerous && (tile.heat > 60 || tile.pressure < 30)) continue;
      bfsVisited.add(key);
      if (isTarget(nx, ny)) return current.firstDir!;
      queue.push({ x: nx, y: ny, firstDir: current.firstDir });
    }
  }

  return null;
}

/** Get adjacent interactable entities */
function getAdjacentInteractables(state: GameState): Entity[] {
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;
  const result: Entity[] = [];
  for (const [, entity] of state.entities) {
    if (entity.id === "player") continue;
    const dist = manhattan({ x: px, y: py }, entity.pos);
    if (dist > 1) continue;
    // Skip exhausted entities (except doors/airlocks which toggle)
    if (entity.type !== EntityType.Airlock &&
        entity.type !== EntityType.ClosedDoor &&
        isEntityExhausted(entity)) continue;
    // Extra check for log terminals: skip if already read
    if (entity.type === EntityType.LogTerminal &&
        state.logs.some(l => l.id === `log_terminal_${entity.id}`)) continue;
    result.push(entity);
  }
  return result;
}

/** Priority score for interacting with an entity (higher = more important) */
function interactPriority(entity: Entity, state: GameState): number {
  const evacuating = state.mystery?.objectivePhase === ObjectivePhase.Evacuate;

  switch (entity.type) {
    case EntityType.DataCore: {
      // Only interact if all deductions answered
      const deds = state.mystery?.deductions ?? [];
      return deds.length > 0 && deds.every(d => d.solved) ? 1000 : -1;
    }
    case EntityType.SensorPickup: return 100;
    case EntityType.ToolPickup: return 95; // pry bar — grab early for clearance door bypass
    case EntityType.MedKit: return state.player.hp < 800 ? 90 : -1;
    case EntityType.RepairCradle: return state.player.hp < 900 ? 85 : -1;
    case EntityType.Relay: return 80;
    case EntityType.LogTerminal: return 70;
    case EntityType.EvidenceTrace: return 65;
    case EntityType.CrewItem: return 60;
    case EntityType.Console: return 55;
    case EntityType.SecurityTerminal: return 50;
    case EntityType.PowerCell: return 45;
    case EntityType.FuseBox: return 40;
    case EntityType.PressureValve: return 35;
    case EntityType.Breach: return 30;
    case EntityType.CrewNPC: {
      if (entity.props["evacuated"] === true || entity.props["dead"] === true) return -1;
      if (entity.props["following"] === true) {
        // Question following crew for testimony (one-time clue)
        if (entity.props["crewQuestioned"] !== true) return 45;
        return 5; // already questioned, low priority
      }
      // Only discover crew (first interaction) if not yet found
      if (entity.props["found"] !== true) return 25; // discover crew
      // Already found — only recruit (second interaction) when all deductions are done
      // This prevents crew getting lost during long exploration traversals
      const allDedsSolved = (state.mystery?.deductions ?? []).every(d => d.solved);
      return allDedsSolved ? 200 : -1; // recruit only when ready to escort
    }
    case EntityType.EscapePod: {
      if (!evacuating) return -1; // don't interact before evacuation
      // During evacuation: only board when we have following crew
      const hasFollowers = hasFollowingCrew(state);
      if (!hasFollowers) return -1; // no point — pod says "no crew following"
      if (entity.props["powered"] !== true) return 30;
      return 180; // rush to powered pod with crew
    }
    case EntityType.ServiceBot: return 15;
    case EntityType.ClosedDoor: {
      // Open closed doors, don't close open ones
      return entity.props["closed"] === true && entity.props["locked"] !== true ? 10 : -1;
    }
    case EntityType.Airlock: return -1; // don't open airlocks randomly
    default: return 0;
  }
}

/** Check if any crew NPCs are currently following the player */
function hasFollowingCrew(state: GameState): boolean {
  for (const [, entity] of state.entities) {
    if (entity.type === EntityType.CrewNPC &&
        entity.props["following"] === true &&
        entity.props["evacuated"] !== true &&
        entity.props["dead"] !== true) {
      return true;
    }
  }
  return false;
}

/** Find the nearest powered escape pod entity ID */
function findNearestPoweredPod(state: GameState): string | null {
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;
  let best: { id: string; dist: number } | null = null;
  for (const [id, entity] of state.entities) {
    if (entity.type !== EntityType.EscapePod) continue;
    if (entity.props["powered"] !== true) continue;
    const boarded = (entity.props["boarded"] as number) || 0;
    const capacity = (entity.props["capacity"] as number) || 3;
    if (boarded >= capacity) continue;
    const dist = manhattan({ x: px, y: py }, entity.pos);
    if (!best || dist < best.dist) best = { id, dist };
  }
  return best?.id ?? null;
}

/** Find the nearest escape pod (powered or not) */
function findNearestPod(state: GameState): string | null {
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;
  let best: { id: string; dist: number } | null = null;
  for (const [id, entity] of state.entities) {
    if (entity.type !== EntityType.EscapePod) continue;
    const boarded = (entity.props["boarded"] as number) || 0;
    const capacity = (entity.props["capacity"] as number) || 3;
    if (boarded >= capacity) continue;
    const dist = manhattan({ x: px, y: py }, entity.pos);
    if (!best || dist < best.dist) best = { id, dist };
  }
  return best?.id ?? null;
}

// Track entities we've tried interacting with and they didn't change
const interactAttempts = new Map<string, number>();
// Committed navigation target — persist until reached or unreachable
let navTarget: string | null = null;
// Track previous position for anti-oscillation in BFS
let lastPos: Position | null = null;
// Track rooms where we've already scanned for hidden evidence
const scannedRooms = new Set<string>();

function chooseAction(state: GameState, visited: Set<string>): Action {
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;

  // Mark current position as visited
  visited.add(`${px},${py}`);
  const currentPos = { x: px, y: py };

  // Phase 1: If cleaning directive active, clean
  if (state.mystery?.cleaningDirective && state.turn < 75) {
    const room = getRoomAt(state, { x: px, y: py });
    if (room) {
      const cleanliness = getRoomCleanliness(state, room.name);
      const goal = state.mystery.roomCleanlinessGoal ?? 80;
      if (cleanliness < goal) {
        // If current tile is dirty, clean it
        if (state.tiles[py][px].dirt > 0) {
          return { type: ActionType.Clean };
        }
        // Otherwise move to a dirty tile in this room
        for (let dy = 0; dy < room.height; dy++) {
          for (let dx = 0; dx < room.width; dx++) {
            const tx = room.x + dx;
            const ty = room.y + dy;
            if (ty >= 0 && ty < state.height && tx >= 0 && tx < state.width) {
              if (state.tiles[ty][tx].dirt > 0 && state.tiles[ty][tx].walkable) {
                const dir = bfsToTarget(state, { x: px, y: py }, (x, y) => x === tx && y === ty);
                if (dir) return { type: ActionType.Move, direction: dir };
              }
            }
          }
        }
        // No dirty tiles reachable, just clean current
        return { type: ActionType.Clean };
      }
    }
  }

  // Phase 2: Submit unlocked deductions
  if (state.mystery) {
    const unlocked = getUnlockedDeductions(state.mystery.deductions, state.mystery.journal);
    if (unlocked.length > 0) {
      const ded = unlocked[0];
      // Pick the correct answer if we can figure it out, otherwise the first option
      const correctOpt = ded.options.find(o => o.correct) ?? ded.options[0];
      return {
        type: ActionType.SubmitDeduction,
        deductionId: ded.id,
        answerKey: correctOpt.key,
      };
    }
  }

  // Phase 2b: Submit available mystery choices (pick first option)
  if (state.mystery) {
    const choiceThresholds = [3, 6, 10];
    const jCount = state.mystery.journal.length;
    for (let ci = 0; ci < state.mystery.choices.length && ci < choiceThresholds.length; ci++) {
      const choice = state.mystery.choices[ci];
      if (choice.chosen) continue;
      if (jCount < choiceThresholds[ci]) continue;
      // Pick the first option
      return {
        type: ActionType.SubmitChoice,
        choiceId: choice.id,
        answerKey: choice.options[0].key,
      };
    }
  }

  // Phase 2b2: Pressure puzzle — seal breaches blocking access to crew in decompressed rooms
  {
    // Find unsealed breaches that are blocking access to crew NPCs
    for (const [, entity] of state.entities) {
      if (entity.type !== EntityType.Breach) continue;
      if (entity.props["sealed"] === true) continue;
      if (entity.props["scanHidden"] === true) continue;

      // Check if there's a crew NPC in the same decompressed room
      const breachRoom = state.rooms.find(r =>
        entity.pos.x >= r.x && entity.pos.x < r.x + r.width &&
        entity.pos.y >= r.y && entity.pos.y < r.y + r.height,
      );
      if (!breachRoom) continue;

      // Is the room decompressed? (pressure < 30 on breach tile)
      const breachTile = state.tiles[entity.pos.y]?.[entity.pos.x];
      if (!breachTile || breachTile.pressure >= 30) continue;

      // Is there a living crew NPC in this room?
      let hasCrewInRoom = false;
      for (const [, crew] of state.entities) {
        if (crew.type !== EntityType.CrewNPC) continue;
        if (crew.props["evacuated"] === true || crew.props["dead"] === true) continue;
        if (crew.pos.x >= breachRoom.x && crew.pos.x < breachRoom.x + breachRoom.width &&
            crew.pos.y >= breachRoom.y && crew.pos.y < breachRoom.y + breachRoom.height) {
          hasCrewInRoom = true;
          break;
        }
      }
      if (!hasCrewInRoom) continue;

      // Found a breach blocking crew — seal it!
      if (manhattan({ x: px, y: py }, entity.pos) <= 1) {
        return { type: ActionType.Interact, targetId: entity.id };
      }
      // Path to breach using allowDangerous (breach is on low-pressure tile)
      const dir = bfsToTarget(state, { x: px, y: py }, (x, y) =>
        manhattan({ x, y }, entity.pos) <= 1
      ) ?? bfsToTarget(state, { x: px, y: py }, (x, y) =>
        manhattan({ x, y }, entity.pos) <= 1, true);
      if (dir) return { type: ActionType.Move, direction: dir };
    }
  }

  // Phase 2b3: Heat puzzle — activate cooling relays to rescue crew in overheated rooms
  {
    for (const [, entity] of state.entities) {
      if (entity.type !== EntityType.Relay) continue;
      if (entity.props["locked"] !== true) continue; // already activated
      if (entity.props["coolsRoom"] !== true) continue; // not a cooling relay

      // Find the room this relay is in
      const relayRoom = state.rooms.find(r =>
        entity.pos.x >= r.x && entity.pos.x < r.x + r.width &&
        entity.pos.y >= r.y && entity.pos.y < r.y + r.height,
      );

      // Check if there's crew in a nearby hot room that needs cooling
      let hasCrewInHotRoom = false;
      for (const [, crew] of state.entities) {
        if (crew.type !== EntityType.CrewNPC) continue;
        if (crew.props["evacuated"] === true || crew.props["dead"] === true) continue;
        if (crew.props["rescueRequirement"] !== "cool_room") continue;
        // Check if crew's room is still hot
        const crewTile = state.tiles[crew.pos.y]?.[crew.pos.x];
        if (crewTile && crewTile.heat >= 40) {
          hasCrewInHotRoom = true;
          break;
        }
      }
      if (!hasCrewInHotRoom) continue;

      // Activate the cooling relay
      if (manhattan({ x: px, y: py }, entity.pos) <= 1) {
        return { type: ActionType.Interact, targetId: entity.id };
      }
      const dir = bfsToTarget(state, { x: px, y: py }, (x, y) =>
        manhattan({ x, y }, entity.pos) <= 1
      ) ?? bfsToTarget(state, { x: px, y: py }, (x, y) =>
        manhattan({ x, y }, entity.pos) <= 1, true);
      if (dir) return { type: ActionType.Move, direction: dir };
    }
  }

  // Phase 2c: Endgame — evacuate crew (primary) or data core fallback
  {
    const deds = state.mystery?.deductions ?? [];
    const allDeductionsDone = deds.length > 0 && deds.every(d => d.solved);
    if (allDeductionsDone) {
      // Count living crew — split into found vs unfound
      let foundLivingRemaining = 0; // found but not evacuated/dead (blocks data core)
      const unfoundCrew: Entity[] = [];
      const foundNotFollowing: Entity[] = [];
      for (const [, entity] of state.entities) {
        if (entity.type === EntityType.CrewNPC &&
            entity.props["evacuated"] !== true &&
            entity.props["dead"] !== true) {
          if (entity.props["found"] !== true) {
            unfoundCrew.push(entity);
          } else if (entity.props["following"] !== true) {
            foundNotFollowing.push(entity);
            foundLivingRemaining++;
          } else {
            foundLivingRemaining++; // following
          }
        }
      }

      // Under time pressure, use data core fallback if all found crew are evacuated
      const timePressure = state.turn > 400 && foundLivingRemaining === 0;
      if ((foundLivingRemaining > 0 || unfoundCrew.length > 0) && !timePressure) {
        // PRIMARY WIN PATH: evacuate all living crew

        if (hasFollowingCrew(state)) {
          // Before heading to pod, recruit nearby found-not-following crew (batch pickup)
          if (foundNotFollowing.length > 0) {
            const nearbyCrew = foundNotFollowing.filter(c =>
              manhattan({ x: px, y: py }, c.pos) <= 10
            ).sort((a, b) =>
              manhattan({ x: px, y: py }, a.pos) - manhattan({ x: px, y: py }, b.pos)
            );
            if (nearbyCrew.length > 0) {
              const target = nearbyCrew[0];
              if (manhattan({ x: px, y: py }, target.pos) <= 1) {
                return { type: ActionType.Interact, targetId: target.id };
              }
              const dir = bfsToTarget(state, { x: px, y: py }, (x, y) =>
                manhattan({ x, y }, target.pos) <= 1
              ) ?? bfsToTarget(state, { x: px, y: py }, (x, y) =>
                manhattan({ x, y }, target.pos) <= 1, true);
              if (dir) return { type: ActionType.Move, direction: dir };
            }
          }

          // Question following crew for testimony before heading to pods
          for (const [, entity] of state.entities) {
            if (entity.type === EntityType.CrewNPC &&
                entity.props["following"] === true &&
                entity.props["crewQuestioned"] !== true &&
                manhattan({ x: px, y: py }, entity.pos) <= 1) {
              return { type: ActionType.Interact, targetId: entity.id };
            }
          }

          // Have crew following — find a powered pod with room
          const poweredPodId = findNearestPoweredPod(state);
          if (poweredPodId) {
            const podEntity = state.entities.get(poweredPodId)!;
            if (manhattan({ x: px, y: py }, podEntity.pos) <= 1) {
              return { type: ActionType.Interact, targetId: poweredPodId };
            }
            const dir = bfsToTarget(state, { x: px, y: py }, (x, y) =>
              manhattan({ x, y }, podEntity.pos) <= 1
            ) ?? bfsToTarget(state, { x: px, y: py }, (x, y) =>
              manhattan({ x, y }, podEntity.pos) <= 1, true);
            if (dir) return { type: ActionType.Move, direction: dir };
          }

          // No powered pod — need to power one. Find a power cell if we don't have one.
          const hasPowerCell = state.player.entity.props["powerCell"] === true;
          if (!hasPowerCell) {
            // Look for an uncollected power cell
            for (const [, entity] of state.entities) {
              if (entity.type === EntityType.PowerCell && entity.props["collected"] !== true) {
                if (manhattan({ x: px, y: py }, entity.pos) <= 1) {
                  return { type: ActionType.Interact, targetId: entity.id };
                }
                const dir = bfsToTarget(state, { x: px, y: py }, (x, y) =>
                  manhattan({ x, y }, entity.pos) <= 1
                ) ?? bfsToTarget(state, { x: px, y: py }, (x, y) =>
                  manhattan({ x, y }, entity.pos) <= 1, true);
                if (dir) return { type: ActionType.Move, direction: dir };
              }
            }
            // No power cells available — try activating a relay near an unpowered pod
            for (const [, relay] of state.entities) {
              if (relay.type !== EntityType.Relay) continue;
              if (relay.props["activated"] === true) continue;
              if (manhattan({ x: px, y: py }, relay.pos) <= 1) {
                return { type: ActionType.Interact, targetId: relay.id };
              }
              const dir = bfsToTarget(state, { x: px, y: py }, (x, y) =>
                manhattan({ x, y }, relay.pos) <= 1
              ) ?? bfsToTarget(state, { x: px, y: py }, (x, y) =>
                manhattan({ x, y }, relay.pos) <= 1, true);
              if (dir) return { type: ActionType.Move, direction: dir };
            }
          }

          // Have power cell (or last resort) — go to nearest unpowered pod to power it
          const unpoweredPodId = findNearestPod(state);
          if (unpoweredPodId) {
            const podAttemptCount = interactAttempts.get(unpoweredPodId) ?? 0;
            if (podAttemptCount < 3) { // don't get stuck on one pod
              const podEntity = state.entities.get(unpoweredPodId)!;
              if (manhattan({ x: px, y: py }, podEntity.pos) <= 1) {
                interactAttempts.set(unpoweredPodId, podAttemptCount + 1);
                return { type: ActionType.Interact, targetId: unpoweredPodId };
              }
              const dir = bfsToTarget(state, { x: px, y: py }, (x, y) =>
                manhattan({ x, y }, podEntity.pos) <= 1
              ) ?? bfsToTarget(state, { x: px, y: py }, (x, y) =>
                manhattan({ x, y }, podEntity.pos) <= 1, true);
              if (dir) return { type: ActionType.Move, direction: dir };
            }
          }
        } else if (foundNotFollowing.length > 0) {
          // Found crew not yet following — go recruit nearest
          const sorted = foundNotFollowing.sort((a, b) =>
            manhattan({ x: px, y: py }, a.pos) - manhattan({ x: px, y: py }, b.pos)
          );
          const target = sorted[0];
          if (manhattan({ x: px, y: py }, target.pos) <= 1) {
            return { type: ActionType.Interact, targetId: target.id };
          }
          const dir = bfsToTarget(state, { x: px, y: py }, (x, y) =>
            manhattan({ x, y }, target.pos) <= 1
          ) ?? bfsToTarget(state, { x: px, y: py }, (x, y) =>
            manhattan({ x, y }, target.pos) <= 1, true);
          if (dir) return { type: ActionType.Move, direction: dir };
        } else if (unfoundCrew.length > 0) {
          // Crew exist but haven't been discovered — go find nearest
          const sorted = unfoundCrew.sort((a, b) =>
            manhattan({ x: px, y: py }, a.pos) - manhattan({ x: px, y: py }, b.pos)
          );
          const target = sorted[0];
          if (manhattan({ x: px, y: py }, target.pos) <= 1) {
            return { type: ActionType.Interact, targetId: target.id };
          }
          const dir = bfsToTarget(state, { x: px, y: py }, (x, y) =>
            manhattan({ x, y }, target.pos) <= 1
          ) ?? bfsToTarget(state, { x: px, y: py }, (x, y) =>
            manhattan({ x, y }, target.pos) <= 1, true);
          if (dir) return { type: ActionType.Move, direction: dir };
        }
      } else {
        // FALLBACK: No living crew — data core transmit (bittersweet victory)
        for (const [, entity] of state.entities) {
          if (entity.type === EntityType.DataCore) {
            if (manhattan({ x: px, y: py }, entity.pos) <= 1) {
              return { type: ActionType.Interact, targetId: entity.id };
            }
            const dir = bfsToTarget(state, { x: px, y: py }, (x, y) =>
              manhattan({ x, y }, entity.pos) <= 1
            ) ?? bfsToTarget(state, { x: px, y: py }, (x, y) =>
              manhattan({ x, y }, entity.pos) <= 1, true);
            if (dir) return { type: ActionType.Move, direction: dir };
          }
        }
      }
    }
  }

  // Phase 2d: Scan in rooms to reveal hidden evidence
  // Only scan once per room, and only if player has sensors beyond base cleanliness
  if (state.player.sensors && state.player.sensors.length > 1) {
    const room = getRoomAt(state, { x: px, y: py });
    if (room && !scannedRooms.has(room.id)) {
      // Check if there might be hidden evidence in this room
      let hasHidden = false;
      for (const [, entity] of state.entities) {
        if (entity.type === EntityType.EvidenceTrace &&
            entity.props["scanHidden"] === true &&
            entity.pos.x >= room.x && entity.pos.x < room.x + room.width &&
            entity.pos.y >= room.y && entity.pos.y < room.y + room.height) {
          hasHidden = true;
          break;
        }
      }
      if (hasHidden) {
        scannedRooms.add(room.id);
        return { type: ActionType.Scan };
      }
      // Even if no hidden evidence, scan rooms we haven't scanned yet (may discover things)
      scannedRooms.add(room.id);
    }
  }

  // Phase 3: Interact with adjacent entities (prioritized)
  const interactables = getAdjacentInteractables(state);
  const prioritized = interactables
    .map(e => ({ entity: e, priority: interactPriority(e, state) }))
    .filter(p => p.priority > 0)
    .filter(p => {
      const attempts = interactAttempts.get(p.entity.id) ?? 0;
      // Sealed crew need 3 interactions: discover → unseal → recruit
      if (p.entity.type === EntityType.CrewNPC && p.entity.props["following"] !== true &&
          p.entity.props["evacuated"] !== true && p.entity.props["dead"] !== true) {
        return attempts < 4;
      }
      return attempts < 2; // skip after 2 failed attempts for other entities
    })
    .sort((a, b) => b.priority - a.priority);

  if (prioritized.length > 0) {
    const target = prioritized[0].entity;
    interactAttempts.set(target.id, (interactAttempts.get(target.id) ?? 0) + 1);
    return { type: ActionType.Interact, targetId: target.id };
  }

  // Phase 3c: Tag-aware evidence hunt — prioritize evidence that covers missing deduction tags
  {
    const deds = state.mystery?.deductions ?? [];
    const unsolvedDeds = deds.filter(d => !d.solved);
    if (unsolvedDeds.length > 0) {
      // Compute missing tags: what do unsolved deductions need that the journal doesn't have?
      const journalTags = new Set<string>();
      for (const entry of state.mystery?.journal ?? []) {
        for (const tag of entry.tags) journalTags.add(tag);
      }
      const missingTags = new Set<string>();
      for (const d of unsolvedDeds) {
        for (const tag of d.requiredTags) {
          if (!journalTags.has(tag)) missingTags.add(tag);
        }
      }

      // Score each evidence entity by how likely it covers missing tags
      const evidenceTargets: Array<{ entity: Entity; dist: number; tagScore: number }> = [];
      const crew = state.mystery?.crew ?? [];
      const archetype = state.mystery?.timeline.archetype;

      for (const [, entity] of state.entities) {
        if (entity.id === "player") continue;
        const isEvidence =
          entity.type === EntityType.LogTerminal ||
          entity.type === EntityType.EvidenceTrace ||
          entity.type === EntityType.CrewItem ||
          entity.type === EntityType.Console ||
          entity.type === EntityType.SecurityTerminal;
        if (!isEvidence) continue;

        // Skip already-read/exhausted
        if (entity.type === EntityType.LogTerminal) {
          if (state.logs.some(l => l.id === `log_terminal_${entity.id}`)) continue;
        } else if (isEntityExhausted(entity)) continue;
        if ((interactAttempts.get(entity.id) ?? 0) >= 2) continue;

        const dist = manhattan({ x: px, y: py }, entity.pos);

        // Predict tags this evidence would produce
        let tagScore = 0;
        const text = (entity.props["text"] as string)
          || (entity.props["journalDetail"] as string)
          || "";
        if (text && missingTags.size > 0) {
          const crewMentioned: string[] = [];
          for (const member of crew) {
            if (text.includes(member.lastName) || text.includes(member.firstName)) {
              crewMentioned.push(member.id);
            }
          }
          let category: "log" | "trace" | "item" = "log";
          if (entity.type === EntityType.EvidenceTrace) category = "trace";
          if (entity.type === EntityType.CrewItem) category = "item";

          const room = state.rooms.find(r =>
            entity.pos.x >= r.x && entity.pos.x < r.x + r.width &&
            entity.pos.y >= r.y && entity.pos.y < r.y + r.height,
          );
          const roomName = room?.name || "Corridor";

          const predictedTags = generateEvidenceTags(category, text, roomName, crewMentioned, crew, archetype);

          // Include forceTags
          const forced = entity.props["forceTags"] as string[] | undefined;
          if (forced) predictedTags.push(...forced);

          // Count how many missing tags this evidence covers
          for (const t of predictedTags) {
            if (missingTags.has(t)) tagScore++;
          }
        }

        // Bonus: entities with forceTags are guaranteed high-value
        if (entity.props["forceTags"]) tagScore += 2;

        evidenceTargets.push({ entity, dist, tagScore });
      }

      // Sort: tag-covering evidence first, then by distance
      evidenceTargets.sort((a, b) => {
        if (b.tagScore !== a.tagScore) return b.tagScore - a.tagScore;
        return a.dist - b.dist;
      });

      if (evidenceTargets.length > 0) {
        const target = evidenceTargets[0].entity;
        navTarget = target.id;
        const dir = bfsToTarget(state, { x: px, y: py }, (x, y) =>
          manhattan({ x, y }, target.pos) <= 1
        ) ?? bfsToTarget(state, { x: px, y: py }, (x, y) =>
          manhattan({ x, y }, target.pos) <= 1, true);
        if (dir) return { type: ActionType.Move, direction: dir };
      }
    }
  }

  // Phase 4: Committed navigation — pick a target and stick with it
  // Check if current navTarget is still valid
  if (navTarget) {
    const targetEntity = state.entities.get(navTarget);
    if (!targetEntity || isEntityExhausted(targetEntity) || (interactAttempts.get(navTarget) ?? 0) >= 2) {
      navTarget = null; // target gone or exhausted
    } else if (manhattan({ x: px, y: py }, targetEntity.pos) <= 1) {
      navTarget = null; // we're adjacent, will interact in phase 3 next turn
    }
  }

  // If no target, pick the best one
  if (!navTarget) {
    const candidates: Array<{ entity: Entity; priority: number; dist: number }> = [];
    for (const [, entity] of state.entities) {
      if (entity.id === "player") continue;
      const attempts = interactAttempts.get(entity.id) ?? 0;
      const crewLimit = entity.type === EntityType.CrewNPC &&
        entity.props["following"] !== true &&
        entity.props["evacuated"] !== true &&
        entity.props["dead"] !== true ? 4 : 2;
      if (attempts >= crewLimit) continue;
      const pri = interactPriority(entity, state);
      if (pri <= 0) continue;
      if (entity.type === EntityType.LogTerminal &&
          state.logs.some(l => l.id === `log_terminal_${entity.id}`)) continue;
      if (isEntityExhausted(entity)) continue;
      candidates.push({ entity, priority: pri, dist: manhattan({ x: px, y: py }, entity.pos) });
    }
    // Sort by priority desc, then distance asc
    candidates.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.dist - b.dist;
    });
    if (candidates.length > 0) navTarget = candidates[0].entity.id;
  }

  // Navigate toward committed target
  if (navTarget) {
    const targetEntity = state.entities.get(navTarget);
    if (targetEntity) {
      // Try safe path first, then dangerous
      const dir = bfsToTarget(state, { x: px, y: py }, (x, y) =>
        manhattan({ x, y }, targetEntity.pos) <= 1
      ) ?? bfsToTarget(state, { x: px, y: py }, (x, y) =>
        manhattan({ x, y }, targetEntity.pos) <= 1, true);
      if (dir) return { type: ActionType.Move, direction: dir };
      // Can't reach target — abandon it
      navTarget = null;
    }
  }

  // Phase 5: Explore unexplored tiles
  const exploreDir = bfsToTarget(state, { x: px, y: py }, (x, y) => {
    return !visited.has(`${x},${y}`) && state.tiles[y][x].walkable;
  }) ?? bfsToTarget(state, { x: px, y: py }, (x, y) => {
    return !visited.has(`${x},${y}`) && state.tiles[y][x].walkable;
  }, true);
  if (exploreDir) return { type: ActionType.Move, direction: exploreDir };

  // Phase 6: Random valid move as last resort
  const shuffled = [...DIRS].sort(() => Math.random() - 0.5);
  for (const d of shuffled) {
    const moveAction: Action = { type: ActionType.Move, direction: d.dir };
    if (isValidAction(state, moveAction)) return moveAction;
  }

  return { type: ActionType.Wait };
}

// Wrapper that validates the chosen action before returning
function chooseValidAction(state: GameState, visited: Set<string>): Action {
  const action = chooseAction(state, visited);
  // Double-check move validity
  if (action.type === ActionType.Move && !isValidAction(state, action)) {
    return { type: ActionType.Wait };
  }
  return action;
}

// ── Main ──────────────────────────────────────────────────

let state = generate(SEED, DIFFICULTY);
const visited = new Set<string>();

console.log(`=== SSR Heuristic Bot — Seed ${SEED} (${DIFFICULTY}) ===`);
console.log(`Map: ${state.width}x${state.height}, ${state.rooms.length} rooms`);
console.log(`Entities: ${state.entities.size}`);
console.log(`Starting at (${state.player.entity.pos.x}, ${state.player.entity.pos.y})`);
console.log("");

const roomsVisited = new Set<string>();
let lastRoom = "";
let issueLog: string[] = [];

for (let turn = 0; turn < state.maxTurns; turn++) {
  if (state.gameOver) break;

  const action = chooseValidAction(state, visited);
  const prevHp = state.player.hp;
  const prevRoom = getRoomAt(state, state.player.entity.pos)?.name ?? "Corridor";

  const prevPos = { x: state.player.entity.pos.x, y: state.player.entity.pos.y };
  state = step(state, action);
  lastPos = prevPos;

  const currentRoom = getRoomAt(state, state.player.entity.pos)?.name ?? "Corridor";
  if (currentRoom !== lastRoom) {
    const roomObj = getRoomAt(state, state.player.entity.pos);
    if (roomObj) roomsVisited.add(roomObj.id);
    lastRoom = currentRoom;
  }

  // Log interesting events
  const hpDelta = state.player.hp - prevHp;
  const actionStr = action.type === ActionType.Move ? `MOVE ${action.direction}` :
    action.type === ActionType.Interact ? `INTERACT ${action.targetId}` :
    action.type === ActionType.SubmitDeduction ? `SUBMIT_DEDUCTION ${action.deductionId}=${action.answerKey}` :
    action.type === ActionType.SubmitChoice ? `SUBMIT_CHOICE ${action.choiceId}=${action.answerKey}` :
    action.type.toUpperCase();

  const pos = `(${state.player.entity.pos.x},${state.player.entity.pos.y})`;

  if (hpDelta < 0 ||
    (action.type !== ActionType.Move && action.type !== ActionType.Wait && action.type !== ActionType.Clean) ||
    state.turn % 50 === 0) {
    console.log(`T${state.turn}: ${currentRoom} ${pos} | HP ${state.player.hp}/${state.player.maxHp}${hpDelta < 0 ? ` (${hpDelta})` : ""} | ${actionStr}`);
  }

  // Check for new logs about important events
  const newLogs = state.logs.slice(-3);
  for (const log of newLogs) {
    if (log.timestamp === state.turn && (
      log.text.includes("VICTORY") ||
      log.text.includes("picked up") ||
      log.text.includes("rerouted") ||
      log.text.includes("transmit") ||
      log.text.includes("deduction") ||
      log.text.includes("evidence") ||
      log.text.includes("Deduction") ||
      log.text.includes("Crew found") ||
      log.text.includes("following") ||
      log.id.startsWith("log_crew_testimony") ||
      log.text.includes("unsealed") ||
      log.text.includes("boarded") ||
      log.text.includes("EVACUATION") ||
      log.text.includes("evacuation") ||
      log.text.includes("Decision recorded") ||
      log.text.includes("CORVUS-7")
    )) {
      console.log(`  >> ${log.text}`);
    }
  }

  // Track issues
  if (state.turn > 100 && roomsVisited.size < 5) {
    issueLog.push(`Issue: Only ${roomsVisited.size} rooms visited by turn ${state.turn}`);
  }
}

// Summary
console.log("");
console.log("=== GAME RESULT ===");
console.log(`Result: ${state.victory ? "VICTORY" : "DEFEAT"}`);
console.log(`Turns: ${state.turn}`);
console.log(`HP: ${state.player.hp}/${state.player.maxHp}`);
console.log(`Rooms visited: ${roomsVisited.size}/${state.rooms.length}`);
console.log(`Evidence: ${state.mystery?.discoveredEvidence.size ?? 0}`);
console.log(`Journal entries: ${state.mystery?.journal.length ?? 0}`);

const deds = state.mystery?.deductions ?? [];
const answered = deds.filter(d => d.solved).length;
const correct = deds.filter(d => d.answeredCorrectly).length;
console.log(`Deductions: ${answered}/${deds.length} answered, ${correct} correct`);

// List unvisited interactable entities
const uninteracted: string[] = [];
for (const [id, entity] of state.entities) {
  if (entity.id === "player") continue;
  if (!isEntityExhausted(entity) && interactPriority(entity, state) > 0) {
    uninteracted.push(`  ${id} (${entity.type}) at (${entity.pos.x},${entity.pos.y})`);
  }
}
if (uninteracted.length > 0) {
  console.log(`\nUninteracted entities (${uninteracted.length}):`);
  for (const u of uninteracted.slice(0, 20)) console.log(u);
}

// Show mystery choice status
const choices = state.mystery?.choices ?? [];
const choicesMade = choices.filter(c => c.chosen).length;
if (choices.length > 0) {
  console.log(`Mystery choices: ${choicesMade}/${choices.length} decided`);
  for (const c of choices) {
    if (c.chosen) {
      const opt = c.options.find(o => o.key === c.chosen);
      console.log(`  ${c.id}: ${opt?.label ?? c.chosen}`);
    } else {
      console.log(`  ${c.id}: UNDECIDED`);
    }
  }
}

// Show deduction status
if (deds.length > 0) {
  console.log("\nDeduction status:");
  for (const d of deds) {
    const status = d.solved
      ? (d.answeredCorrectly ? "CORRECT" : "WRONG")
      : "UNANSWERED";
    const tags = d.requiredTags.join(", ");
    console.log(`  ${d.id}: ${status} — needs: [${tags}]`);
  }
}

// Show evacuation status
const evac = state.mystery?.evacuation;
if (evac && evac.active) {
  console.log(`\nEvacuation status:`);
  console.log(`  Crew found: ${evac.crewFound.length}`);
  console.log(`  Crew evacuated: ${evac.crewEvacuated.length}`);
  console.log(`  Crew dead: ${evac.crewDead.length}`);
  console.log(`  Pods powered: ${evac.podsPowered.length}`);
}

if (issueLog.length > 0) {
  console.log("\nIssues detected:");
  for (const issue of [...new Set(issueLog)]) console.log(`  ${issue}`);
}

process.exit(state.victory ? 0 : 1);
