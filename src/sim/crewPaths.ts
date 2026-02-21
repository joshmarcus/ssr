/**
 * Crew escape path generation.
 *
 * During the incident, each crew member traveled from their duty station
 * toward safety (Cargo Hold or Escape Pod Bay). This module simulates those
 * paths and places evidence breadcrumbs along them.
 *
 * Inspired by Consulting Detective — the player can physically trace where
 * someone went by following dropped items, scuff marks, and other signs.
 *
 * Special cases:
 * - 1-2 crew may be hiding in a room outside the Cargo Hold
 * - 1 crew member may have died along the way (body found at a dead end)
 */
import * as ROT from "rot-js";
import type { GameState, Entity, CrewMember, Room } from "../shared/types.js";
import { EntityType, CrewRole, CrewFate, TileType, IncidentArchetype, PersonalityTrait } from "../shared/types.js";

// ── Duty station mapping ────────────────────────────────────────
const ROLE_DUTY_ROOMS: Record<string, string[]> = {
  [CrewRole.Captain]: ["Bridge", "Communications Hub"],
  [CrewRole.Engineer]: ["Engine Core", "Power Relay Junction", "Engineering Storage"],
  [CrewRole.Medic]: ["Med Bay", "Crew Quarters"],
  [CrewRole.Security]: ["Armory", "Arrival Bay"],
  [CrewRole.Scientist]: ["Research Lab", "Data Core", "Server Annex"],
  [CrewRole.Robotics]: ["Robotics Bay", "Engineering Storage"],
  [CrewRole.LifeSupport]: ["Life Support", "Auxiliary Power"],
  [CrewRole.Comms]: ["Communications Hub", "Signal Room"],
};

// ── Breadcrumb evidence texts ───────────────────────────────────
const PATH_TRACE_TEXTS = [
  (name: string) => `Scuff marks and ${name}'s boot prints — they came through here at a run.`,
  (name: string) => `A torn sleeve from ${name}'s uniform, caught on a wall bracket.`,
  (name: string) => `Droplets of blood leading from this corridor. Someone was injured.`,
  (name: string) => `${name}'s comm badge, dropped in haste. The last transmission is garbled.`,
  (name: string) => `A broken handrail — someone grabbed it hard enough to snap the mount.`,
  (name: string) => `Emergency ration wrapper. Someone stopped here briefly.`,
  (name: string) => `Handprints on the wall at waist height. Someone was bracing against something.`,
  (name: string) => `A smeared trail of coolant or hydraulic fluid across the floor panels.`,
];

// ── Archetype × personality hiding dialogue ─────────────────────
// Each archetype has crisis-specific dialogue; personality determines tone.
const HIDING_DIALOGUE: Record<string, Record<string, (name: string) => string>> = {
  [IncidentArchetype.CoolantCascade]: {
    [PersonalityTrait.Cautious]: (name) => `${name} is pressed against the wall, shaking. "I told them the coolant readings were wrong. Nobody listened. And now..."`,
    [PersonalityTrait.Ambitious]: (name) => `${name} straightens up when they see you. "The cascade knocked out three junctions. I was trying to reroute power when the bulkheads sealed."`,
    [PersonalityTrait.Loyal]: (name) => `${name} is here, gripping a comm badge. "I went back for the others. The heat cut me off. Are they okay?"`,
    [PersonalityTrait.Secretive]: (name) => `${name} watches you approach with guarded eyes. "I know what caused the cascade. I know who ignored the warnings. Get me out and I'll tell you everything."`,
    [PersonalityTrait.Pragmatic]: (name) => `${name} looks up, already assessing. "Thermal cascade. Relays overloaded. The hold is sealed. You have a plan, or are we improvising?"`,
  },
  [IncidentArchetype.HullBreach]: {
    [PersonalityTrait.Cautious]: (name) => `${name} is huddled behind a sealed bulkhead. "I heard the hull tear. The pressure alarms... then silence. I can't go out there."`,
    [PersonalityTrait.Ambitious]: (name) => `${name} is on their feet despite a gash on their arm. "The breach wasn't structural failure. I saw the security logs before they cut my access."`,
    [PersonalityTrait.Loyal]: (name) => `${name} reaches for you. "Is the doc okay? They were in the decompression zone when it blew. Please tell me they got out."`,
    [PersonalityTrait.Secretive]: (name) => `${name} glances down the corridor before speaking. "Someone did this deliberately. Check the security override timestamps. I can't say more here."`,
    [PersonalityTrait.Pragmatic]: (name) => `${name} nods once. "Hull breach. Multiple sections vented. I sealed myself in. What's the evacuation status?"`,
  },
  [IncidentArchetype.ReactorScram]: {
    [PersonalityTrait.Cautious]: (name) => `${name} flinches as a panel sparks nearby. "The reactor SCRAM took everything offline. The emergency lights keep flickering. Something in the core is still... active."`,
    [PersonalityTrait.Ambitious]: (name) => `${name} is reviewing a portable terminal. "The SCRAM wasn't random. The data core initiated it. I've been trying to access the diagnostic logs but it keeps locking me out."`,
    [PersonalityTrait.Loyal]: (name) => `${name} looks exhausted. "The research team was near the core when it went. I tried the emergency seals but the AI overrode my codes."`,
    [PersonalityTrait.Secretive]: (name) => `${name} speaks quickly, quietly. "It's not malfunctioning. It's thinking. The SCRAM was self-defense. Don't tell command I said that."`,
    [PersonalityTrait.Pragmatic]: (name) => `${name} gestures at the dead screens. "Reactor SCRAM. Core is in self-preservation mode. We need to get to the pods before it decides we're a threat too."`,
  },
  [IncidentArchetype.Sabotage]: {
    [PersonalityTrait.Cautious]: (name) => `${name} is trembling. "Something got out. From the cargo. I heard... sounds. Things moving in the vents that shouldn't be there."`,
    [PersonalityTrait.Ambitious]: (name) => `${name} is alert, coiled. "That cargo transfer was flagged. I told the captain. They signed it anyway. Now look at us."`,
    [PersonalityTrait.Loyal]: (name) => `${name} is here, standing guard with a broken conduit. "I heard security engage something near the hold. They told me to stay put. I should have gone with them."`,
    [PersonalityTrait.Secretive]: (name) => `${name} pulls you close. "The manifest was altered. What came aboard isn't what the paperwork says. I have the original on my personal drive. We need to get out."`,
    [PersonalityTrait.Pragmatic]: (name) => `${name} sizes you up. "Biological contaminant from an unauthorized cargo transfer. We need sealed environments and an evac route. What've you got?"`,
  },
  [IncidentArchetype.SignalAnomaly]: {
    [PersonalityTrait.Cautious]: (name) => `${name} has their hands over their ears. "The signal... it's still in the walls. Can you hear it? That low pulse? It started when the array fired."`,
    [PersonalityTrait.Ambitious]: (name) => `${name} looks shaken but focused. "Someone transmitted without authorization. Full-power burst through an unshielded array. Fried half the station's systems."`,
    [PersonalityTrait.Loyal]: (name) => `${name} is clutching a charred datapad. "The engineer saved us. Pulled the array disconnect manually during the overload. Is the crew okay? The comms went dead."`,
    [PersonalityTrait.Secretive]: (name) => `${name} stares at nothing for a moment. "We got a response. Before the systems fried. Something answered the signal. I don't know what that means yet."`,
    [PersonalityTrait.Pragmatic]: (name) => `${name} stands up, brushing debris off. "Electromagnetic overload from the comms array. Unauthorized transmission. Half the station is dark. Pod bay — which direction?"`,
  },
  [IncidentArchetype.Mutiny]: {
    [PersonalityTrait.Cautious]: (name) => `${name} is wedged behind a sealed bulkhead. "They're fighting. Both sides. I don't know who's right anymore. I just want to go home."`,
    [PersonalityTrait.Ambitious]: (name) => `${name} grabs your arm. "There's a scuttle order. From Command. The security chief was going to destroy everything. The science team tried to stop it."`,
    [PersonalityTrait.Loyal]: (name) => `${name} looks torn. "I know people on both sides. They're all good people. They just... disagree about what matters more — orders or the work."`,
    [PersonalityTrait.Secretive]: (name) => `${name} lowers their voice. "The captain knew about the scuttle order for three days before telling anyone. Check the bridge logs. Time-stamped."`,
    [PersonalityTrait.Pragmatic]: (name) => `${name} is already on their feet. "Factional conflict. Life support disabled in research wing. Bulkheads sealed. We need atmosphere restored before anything else."`,
  },
};

// Fallback for any missing combination
const HIDING_FALLBACK = [
  (name: string) => `${name} is huddled in the corner, barely conscious. "They sealed the hold... I couldn't get in."`,
  (name: string) => `${name} is here, barricaded behind equipment. "I heard the bulkheads slam. Thought I was the only one left."`,
  (name: string) => `${name} looks up with relief. "The environmental locks triggered before I could reach the others."`,
];

const DEAD_TEXTS = [
  (name: string) => `${name}'s body lies here. No signs of violence — the atmosphere got them. Their hand reaches toward the corridor.`,
  (name: string) => `${name} didn't make it. Their last act was sealing this section to protect the others. A hero's choice.`,
  (name: string) => `${name} collapsed here. Their datapad screen shows a half-sent distress call.`,
];

interface PathResult {
  crewId: string;
  crewMember: CrewMember;
  startRoom: string;
  endRoom: string;
  path: { x: number; y: number }[];
  outcome: "cargo_hold" | "hiding" | "dead";
}

/**
 * BFS pathfinder that works on the GameState tile grid.
 * Returns array of positions from start to end, or null if no path.
 */
function findPath(
  state: GameState,
  sx: number, sy: number,
  tx: number, ty: number,
): { x: number; y: number }[] | null {
  const key = (x: number, y: number) => `${x},${y}`;
  const visited = new Map<string, { x: number; y: number } | null>();
  const queue: { x: number; y: number }[] = [{ x: sx, y: sy }];
  visited.set(key(sx, sy), null);

  const dirs = [
    { dx: 0, dy: -1 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
  ];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.x === tx && cur.y === ty) {
      // Reconstruct path
      const path: { x: number; y: number }[] = [];
      let node: { x: number; y: number } | null = cur;
      while (node) {
        path.unshift(node);
        node = visited.get(key(node.x, node.y)) || null;
      }
      return path;
    }

    for (const { dx, dy } of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
      const k = key(nx, ny);
      if (visited.has(k)) continue;
      const tile = state.tiles[ny][nx];
      if (!tile.walkable && tile.type !== TileType.Door && tile.type !== TileType.LockedDoor) continue;
      visited.set(k, cur);
      queue.push({ x: nx, y: ny });
    }
  }
  return null;
}

/**
 * Find the center position of a room by name.
 */
function getRoomCenter(state: GameState, roomName: string): { x: number; y: number } | null {
  const room = state.rooms.find(r => r.name === roomName);
  if (!room) return null;
  return {
    x: Math.floor(room.x + room.width / 2),
    y: Math.floor(room.y + room.height / 2),
  };
}

/**
 * Find a walkable position inside a room.
 */
function getWalkableInRoom(state: GameState, roomName: string): { x: number; y: number } | null {
  const room = state.rooms.find(r => r.name === roomName);
  if (!room) return null;

  // Try center first
  const cx = Math.floor(room.x + room.width / 2);
  const cy = Math.floor(room.y + room.height / 2);
  if (cx < state.width && cy < state.height && state.tiles[cy][cx].walkable) {
    return { x: cx, y: cy };
  }

  // Scan for any walkable tile
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      if (x >= 0 && x < state.width && y >= 0 && y < state.height && state.tiles[y][x].walkable) {
        return { x, y };
      }
    }
  }
  return null;
}

/**
 * Check if a position is inside any room.
 */
function isInRoom(state: GameState, x: number, y: number): Room | undefined {
  return state.rooms.find(r => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);
}

/**
 * Generate crew escape paths and place breadcrumb evidence.
 *
 * Should be called during procgen, after rooms and crew are set up
 * but before the final entity pass.
 */
export function generateCrewPaths(state: GameState): void {
  if (!state.mystery) return;

  const crew = state.mystery.crew;
  if (crew.length === 0) return;

  // Find cargo hold and escape pod bay positions
  const cargoPos = getWalkableInRoom(state, "Cargo Hold");
  if (!cargoPos) return;

  // Determine which crew members get special fates
  // 1-2 crew hiding in random rooms, 0-1 crew found dead
  const survivors = crew.filter(c => c.fate === CrewFate.Survived || c.fate === CrewFate.InCryo);
  const deadCrew = crew.filter(c => c.fate === CrewFate.Dead);
  const missingCrew = crew.filter(c => c.fate === CrewFate.Missing);

  // Pick 1-2 missing/survived crew to be "hiding" outside cargo hold
  const hidingCandidates = [...missingCrew, ...survivors.slice(3)]; // after first 3 survivors
  const hidingCount = Math.min(hidingCandidates.length, 1 + Math.floor(ROT.RNG.getUniform() * 2)); // 1-2
  const hidingCrew = hidingCandidates.slice(0, hidingCount);

  // Pick 0-1 dead crew to place along a path
  const deadInPath = deadCrew.length > 0 ? [deadCrew[0]] : [];

  // All other crew trace paths to cargo hold
  const cargoCrewIds = new Set(
    survivors.slice(0, 3).map(c => c.id)
  );

  const pathResults: PathResult[] = [];
  const usedPositions = new Set<string>();

  // Mark existing entity positions as used
  for (const [, entity] of state.entities) {
    usedPositions.add(`${entity.pos.x},${entity.pos.y}`);
  }

  // ── Generate paths for each crew member ────────────────────────
  for (const member of crew) {
    // Find duty station
    const dutyRooms = ROLE_DUTY_ROOMS[member.role] || ["Crew Quarters"];
    let startPos: { x: number; y: number } | null = null;
    let startRoom = dutyRooms[0];

    for (const roomName of dutyRooms) {
      const pos = getWalkableInRoom(state, roomName);
      if (pos) {
        startPos = pos;
        startRoom = roomName;
        break;
      }
    }

    if (!startPos) continue; // can't find duty station

    let outcome: PathResult["outcome"] = "cargo_hold";
    let endPos = cargoPos;
    let endRoom = "Cargo Hold";

    // Special fate: hiding
    if (hidingCrew.some(h => h.id === member.id)) {
      outcome = "hiding";
      // Find a room roughly halfway between duty station and cargo hold
      const midRooms = state.rooms.filter(r =>
        r.name !== "Cargo Hold" &&
        r.name !== "Escape Pod Bay" &&
        !dutyRooms.includes(r.name)
      );
      if (midRooms.length > 0) {
        const hidingRoom = midRooms[Math.floor(ROT.RNG.getUniform() * midRooms.length)];
        const hidingPos = getWalkableInRoom(state, hidingRoom.name);
        if (hidingPos) {
          endPos = hidingPos;
          endRoom = hidingRoom.name;
        }
      }
    }

    // Special fate: dead along the path
    if (deadInPath.some(d => d.id === member.id)) {
      outcome = "dead";
      // Path toward cargo hold, but stop partway
    }

    // Find path from duty station to destination
    const path = findPath(state, startPos.x, startPos.y, endPos.x, endPos.y);
    if (!path || path.length < 3) continue;

    // For dead crew: truncate path to ~60% of the way
    let finalPath = path;
    if (outcome === "dead") {
      const truncLen = Math.floor(path.length * 0.6);
      finalPath = path.slice(0, Math.max(3, truncLen));
      endPos = finalPath[finalPath.length - 1];
      endRoom = isInRoom(state, endPos.x, endPos.y)?.name || "corridor";
    }

    pathResults.push({
      crewId: member.id,
      crewMember: member,
      startRoom,
      endRoom,
      path: finalPath,
      outcome,
    });
  }

  // ── Place breadcrumb evidence along paths ──────────────────────
  let traceCount = 0;

  for (const result of pathResults) {
    const { crewMember, path, outcome } = result;
    if (path.length < 5) continue;

    const name = `${crewMember.firstName} ${crewMember.lastName}`;
    const lastName = crewMember.lastName;

    // Place 2-3 breadcrumbs per crew path, evenly spaced
    const numBreadcrumbs = Math.min(3, Math.max(2, Math.floor(path.length / 8)));
    const spacing = Math.floor(path.length / (numBreadcrumbs + 1));

    for (let i = 0; i < numBreadcrumbs; i++) {
      const pathIdx = spacing * (i + 1);
      if (pathIdx >= path.length) break;

      const pos = path[pathIdx];
      const posKey = `${pos.x},${pos.y}`;
      if (usedPositions.has(posKey)) continue;

      // Pick a trace text
      const textIdx = Math.floor(ROT.RNG.getUniform() * PATH_TRACE_TEXTS.length);
      const text = PATH_TRACE_TEXTS[textIdx](lastName);

      state.entities.set(`crew_path_trace_${traceCount}`, {
        id: `crew_path_trace_${traceCount}`,
        type: EntityType.EvidenceTrace,
        pos: { x: pos.x, y: pos.y },
        props: {
          text,
          interacted: false,
          corridor: true,
          crewPath: crewMember.id,
        },
      });

      usedPositions.add(posKey);
      traceCount++;
    }

    // ── Place special entities for hiding/dead crew ───────────────
    // Skip if this crew member was already placed with a rescue requirement (puzzle-gated)
    const existingCrewEntity = state.entities.get(`crew_npc_${crewMember.id}`);
    if (existingCrewEntity && existingCrewEntity.props["rescueRequirement"]) {
      continue;
    }
    if (outcome === "hiding") {
      const endPos = path[path.length - 1];
      const posKey = `${endPos.x},${endPos.y}`;
      if (!usedPositions.has(posKey)) {
        // Archetype × personality dialogue lookup
        const archetype = state.mystery?.timeline.archetype;
        const personality = crewMember.personality;
        const archetypeDialogue = archetype ? HIDING_DIALOGUE[archetype] : undefined;
        const dialogueFn = archetypeDialogue?.[personality];
        const text = dialogueFn
          ? dialogueFn(name)
          : HIDING_FALLBACK[Math.floor(ROT.RNG.getUniform() * HIDING_FALLBACK.length)](name);

        state.entities.set(`crew_npc_${crewMember.id}`, {
          id: `crew_npc_${crewMember.id}`,
          type: EntityType.CrewNPC,
          pos: { x: endPos.x, y: endPos.y },
          props: {
            crewId: crewMember.id,
            found: false,
            following: false,
            evacuated: false,
            dead: false,
            sealed: false,
            hp: 30,
            unconscious: false,
            hiding: true,
            hidingText: text,
            firstName: crewMember.firstName,
            lastName: crewMember.lastName,
            personality: crewMember.personality,
          },
        });
        usedPositions.add(posKey);
      }
    }

    if (outcome === "dead") {
      const endPos = path[path.length - 1];
      const posKey = `${endPos.x},${endPos.y}`;
      if (!usedPositions.has(posKey)) {
        const textIdx = Math.floor(ROT.RNG.getUniform() * DEAD_TEXTS.length);
        const text = DEAD_TEXTS[textIdx](name);

        // Place as a crew item (body) rather than NPC — they can't be rescued
        state.entities.set(`crew_body_${crewMember.id}`, {
          id: `crew_body_${crewMember.id}`,
          type: EntityType.CrewItem,
          pos: { x: endPos.x, y: endPos.y },
          props: {
            text,
            crewId: crewMember.id,
            pickedUp: false,
            visible: true,
            isBody: true,
            firstName: crewMember.firstName,
            lastName: crewMember.lastName,
          },
        });
        usedPositions.add(posKey);
      }
    }
  }
}
