import * as ROT from "rot-js";
import type { GameState, Entity, MysteryState, MysteryChoice } from "../shared/types.js";
import { TileType, EntityType, SensorType, ObjectivePhase, IncidentArchetype, CrewFate, DoorKeyType } from "../shared/types.js";
import { DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, GLYPHS, PRESSURE_NORMAL } from "../shared/constants.js";
import { createEmptyState } from "./state.js";
import { updateVision } from "./vision.js";
import AUTHORED_LOGS from "../data/logs.json" with { type: "json" };
import { CREW_ITEMS } from "../data/crewItems.js";
import { generateCrew, findByRole } from "./crewGen.js";
import { selectArchetype } from "./incidents.js";
import { generateTimeline, generateLogs } from "./timeline.js";
import { CrewRole } from "../shared/types.js";
import { generateMysteryChoices } from "./mysteryChoices.js";
import { generateDeductions } from "./deduction.js";
import { LANDMARK_CONSOLES } from "../data/consoleText.js";

/**
 * Room name assignments — enough for a large station.
 */
const ROOM_NAMES = [
  "Arrival Bay",
  "Bridge",
  "Engine Core",
  "Cargo Hold",
  "Crew Quarters",
  "Med Bay",
  "Research Lab",
  "Life Support",
  "Power Relay Junction",
  "Engineering Storage",
  "Communications Hub",
  "Robotics Bay",
  "Data Core",
  "Observation Deck",
  "Escape Pod Bay",
  "Auxiliary Power",
  "Signal Room",
  "Server Annex",
  "Maintenance Corridor",
  "Emergency Shelter",
  "Armory",
];

/**
 * Zone assignments for station rooms.
 */
const ROOM_ZONES: Record<string, string> = {
  "Bridge": "Command",
  "Communications Hub": "Command",
  "Signal Room": "Command",
  "Engine Core": "Engineering",
  "Power Relay Junction": "Engineering",
  "Auxiliary Power": "Engineering",
  "Engineering Storage": "Engineering",
  "Crew Quarters": "Habitation",
  "Cargo Hold": "Habitation",
  "Med Bay": "Habitation",
  "Emergency Shelter": "Habitation",
  "Research Lab": "Research",
  "Data Core": "Research",
  "Robotics Bay": "Research",
  "Server Annex": "Research",
  "Life Support": "Infrastructure",
  "Arrival Bay": "Infrastructure",
  "Observation Deck": "Infrastructure",
  "Escape Pod Bay": "Infrastructure",
  "Maintenance Corridor": "Infrastructure",
  "Armory": "Infrastructure",
};

type DiggerRoom = {
  getLeft(): number;
  getRight(): number;
  getTop(): number;
  getBottom(): number;
  getDoors(cb: (x: number, y: number) => void): void;
};

/**
 * Generate a station map from a seed.
 */
export function generate(seed: number): GameState {
  const state = createEmptyState(seed, DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT);

  // Seed ROT.js global RNG for deterministic map generation
  ROT.RNG.setSeed(seed);

  const map = new ROT.Map.Digger(state.width, state.height, {
    dugPercentage: 0.45,
    roomWidth: [3, 7],
    roomHeight: [3, 6],
  });

  map.create((x, y, wall) => {
    if (!wall) {
      state.tiles[y][x] = {
        type: TileType.Floor,
        glyph: GLYPHS.floor,
        walkable: true,
        heat: 0,
        smoke: 0,
        dirt: 0,
        pressure: 100,
        radiation: 0,
        stress: 0,
        stressTurns: 0,
        explored: false,
        visible: false,
      };
    }
  });

  // Extract rooms
  const rooms = map.getRooms();
  rooms.forEach((room, i) => {
    const roomName = ROOM_NAMES[i] || `Section ${i}`;
    state.rooms.push({
      id: `room_${i}`,
      name: roomName,
      x: room.getLeft(),
      y: room.getTop(),
      width: room.getRight() - room.getLeft() + 1,
      height: room.getBottom() - room.getTop() + 1,
      zone: ROOM_ZONES[roomName],
    });

    room.getDoors((x, y) => {
      state.tiles[y][x] = {
        type: TileType.Door,
        glyph: GLYPHS.door,
        walkable: true,
        heat: 0,
        smoke: 0,
        dirt: 0,
        pressure: 100,
        radiation: 0,
        stress: 0,
        stressTurns: 0,
        explored: false,
        visible: false,
      };
    });
  });

  // Place player in first room center
  if (rooms.length > 0) {
    const firstRoom = rooms[0];
    const cx = Math.floor((firstRoom.getLeft() + firstRoom.getRight()) / 2);
    const cy = Math.floor((firstRoom.getTop() + firstRoom.getBottom()) / 2);
    state.player.entity.pos = { x: cx, y: cy };
  }

  // ── Mystery engine: generate crew, incident, timeline ────────
  const roomNames = state.rooms.map(r => r.name);
  const crewSize = 8 + Math.floor(ROT.RNG.getUniform() * 5); // 8-12 crew
  const crew = generateCrew(crewSize, seed, roomNames);
  const archetype = selectArchetype(seed);
  const timeline = generateTimeline(crew, archetype, roomNames);
  const generatedLogCount = Math.min(16, 5 + Math.floor(ROT.RNG.getUniform() * 12));
  const generatedLogData = generateLogs(crew, timeline, roomNames, generatedLogCount);
  const choices = generateMysteryChoices(crew, timeline, roomNames);
  const deductions = generateDeductions(crew, timeline, roomNames);

  // Evidence threshold: need to find ~40% of available logs to unlock recovery phase
  const evidenceThreshold = Math.max(3, Math.floor(generatedLogCount * 0.4));

  state.mystery = {
    crew,
    timeline,
    generatedLogs: generatedLogData.map((l, i) => ({ terminalId: `log_terminal_${i}`, ...l })),
    discoveredEvidence: new Set<string>(),
    choices,
    journal: [],
    deductions,
    objectivePhase: ObjectivePhase.Clean,
    roomsCleanedCount: 0,
    investigationTrigger: 1, // clean 1 room before yellow alert triggers investigation
    evidenceThreshold,
    cleaningDirective: true,
    roomCleanlinessGoal: 80,
    directiveViolationTurns: 0,
  };

  placeEntities(state, rooms);
  placeEvidenceTraces(state, rooms);
  generateDirtTrails(state, rooms);

  // Place 1-2 security terminals in mid-station rooms
  placeSecurityTerminals(state, rooms);

  // Place Sprint 3 entities: radiation sources, shield generators, etc.
  placeSprintThreeEntities(state, rooms);

  // Place Sprint 3 sensor pickups
  placeSprintThreeSensors(state, rooms);

  // Place crew NPCs and escape pods for evacuation mechanic
  placeCrewAndPods(state, rooms);

  // Place keyed doors (clearance + environmental)
  placeClearanceDoors(state, rooms);
  placeEnvironmentalDoors(state, rooms);

  // Place landmark consoles in themed rooms
  placeLandmarkConsoles(state, rooms);

  // Reveal starting room via vision system
  return updateVision(state);
}

/**
 * Generate dirt trails that reveal crew movement patterns via the cleanliness sensor.
 * - Rooms with crew activity (log terminals, service bot) get dirt 20-40
 * - Corridors between rooms get dirt 10-20 (foot traffic)
 * - The path from relay rooms toward Cargo Hold gets heavy dirt 50-70 (evac route)
 */
function generateDirtTrails(state: GameState, rooms: DiggerRoom[]): void {
  // ── Rooms with crew activity: dirt on nearby tiles ──────────────
  for (const [, entity] of state.entities) {
    if (entity.type === EntityType.LogTerminal || entity.type === EntityType.ServiceBot) {
      const ex = entity.pos.x;
      const ey = entity.pos.y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = ex + dx;
          const ny = ey + dy;
          if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
          if (!state.tiles[ny][nx].walkable) continue;
          const dirtAmount = 20 + Math.floor(ROT.RNG.getUniform() * 21); // 20-40
          state.tiles[ny][nx].dirt = Math.min(100, Math.max(state.tiles[ny][nx].dirt, dirtAmount));
        }
      }
    }
  }

  // ── Corridor tiles get light foot traffic dirt ──────────────────
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const tile = state.tiles[y][x];
      if (tile.walkable && tile.dirt === 0) {
        let inRoom = false;
        for (const room of rooms) {
          if (x >= room.getLeft() && x <= room.getRight() &&
              y >= room.getTop() && y <= room.getBottom()) {
            inRoom = true;
            break;
          }
        }
        if (!inRoom) {
          const dirtAmount = 10 + Math.floor(ROT.RNG.getUniform() * 11); // 10-20
          state.tiles[y][x].dirt = dirtAmount;
        }
      }
    }
  }

  // ── Heavy dirt on evacuation route (relay rooms toward Cargo Hold) ──
  const cargoHoldIdx = state.rooms.findIndex(r => r.name === "Cargo Hold");
  if (cargoHoldIdx >= 0 && rooms.length > cargoHoldIdx) {
    const cargoCenter = getRoomCenter(rooms[cargoHoldIdx]);
    const evacRoomIndices = new Set<number>();
    evacRoomIndices.add(cargoHoldIdx);
    // Find rooms containing relays
    for (const [, entity] of state.entities) {
      if (entity.type === EntityType.Relay && entity.id.startsWith("relay_p")) {
        for (let ri = 0; ri < rooms.length; ri++) {
          const room = rooms[ri];
          if (entity.pos.x >= room.getLeft() && entity.pos.x <= room.getRight() &&
              entity.pos.y >= room.getTop() && entity.pos.y <= room.getBottom()) {
            evacRoomIndices.add(ri);
          }
        }
      }
    }
    // Heavy dirt in evac-route rooms
    for (const ri of evacRoomIndices) {
      const room = rooms[ri];
      for (let y = room.getTop(); y <= room.getBottom(); y++) {
        for (let x = room.getLeft(); x <= room.getRight(); x++) {
          if (x < 0 || x >= state.width || y < 0 || y >= state.height) continue;
          if (!state.tiles[y][x].walkable) continue;
          const dirtAmount = 50 + Math.floor(ROT.RNG.getUniform() * 21); // 50-70
          state.tiles[y][x].dirt = Math.min(100, Math.max(state.tiles[y][x].dirt, dirtAmount));
        }
      }
    }
    // Mark corridor tiles along evacuation paths with heavy dirt
    for (const [, entity] of state.entities) {
      if (entity.type === EntityType.Relay && entity.id.startsWith("relay_p")) {
        const cx = entity.pos.x;
        const cy = entity.pos.y;
        const tx = cargoCenter.x;
        const ty = cargoCenter.y;
        const steps = Math.max(Math.abs(tx - cx), Math.abs(ty - cy));
        for (let s = 0; s <= steps; s++) {
          const t = steps === 0 ? 0 : s / steps;
          const px = Math.round(cx + t * (tx - cx));
          const py = Math.round(cy + t * (ty - cy));
          if (px >= 0 && px < state.width && py >= 0 && py < state.height) {
            if (state.tiles[py][px].walkable) {
              const dirtAmount = 50 + Math.floor(ROT.RNG.getUniform() * 21); // 50-70
              state.tiles[py][px].dirt = Math.min(100, Math.max(state.tiles[py][px].dirt, dirtAmount));
            }
          }
        }
      }
    }
  }
}

function getRoomCenter(room: DiggerRoom): { x: number; y: number } {
  return {
    x: Math.floor((room.getLeft() + room.getRight()) / 2),
    y: Math.floor((room.getTop() + room.getBottom()) / 2),
  };
}

function getRoomPos(room: DiggerRoom, offsetX: number, offsetY: number): { x: number; y: number } {
  const center = getRoomCenter(room);
  return {
    x: Math.min(Math.max(center.x + offsetX, room.getLeft()), room.getRight()),
    y: Math.min(Math.max(center.y + offsetY, room.getTop()), room.getBottom()),
  };
}

/**
 * Distribute indices evenly across the room list,
 * excluding reserved room indices.
 */
function spreadIndices(count: number, totalRooms: number, exclude: Set<number>): number[] {
  const available = [];
  for (let i = 0; i < totalRooms; i++) {
    if (!exclude.has(i)) available.push(i);
  }
  if (available.length <= count) return available;
  const result: number[] = [];
  const step = available.length / count;
  for (let i = 0; i < count; i++) {
    result.push(available[Math.floor(i * step)]);
  }
  return result;
}

/**
 * Place all entities across the station.
 *
 * Layout:
 * - Room 0: Player start
 * - Room 1: Sensor pickup (thermal module)
 * - Early-mid: Relay P01 (overheating)
 * - Mid: Relay P03 (overheating) — the main danger relay from the story
 * - Late-mid: Relay P04 (vent relay, overheating)
 * - Middle: Service bot (recovery)
 * - Last room: Data core (objective, behind locked door)
 * - 8 log terminals spread throughout
 */
function placeEntities(state: GameState, rooms: DiggerRoom[]): void {
  if (rooms.length < 5) return;

  const n = rooms.length;

  // ── Key room indices ──────────────────────────────────────────
  const sensorIdx = 1;
  const relay1Idx = Math.max(2, Math.floor(n * 0.2));            // ~20% through
  const relay2Idx = Math.max(relay1Idx + 1, Math.floor(n * 0.5)); // ~50% through
  const relay3Idx = Math.max(relay2Idx + 1, Math.floor(n * 0.75)); // ~75% through
  const serviceBotIdx = Math.min(Math.floor(n * 0.4), relay2Idx - 1);
  const dataCoreIdx = n - 1;

  // ── Sensor pickup in room 1 ───────────────────────────────────
  const sensorPos = getRoomCenter(rooms[sensorIdx]);
  state.entities.set("sensor_thermal", {
    id: "sensor_thermal",
    type: EntityType.SensorPickup,
    pos: sensorPos,
    props: { sensorType: SensorType.Thermal },
  });

  // ── Three overheating relays ──────────────────────────────────
  // Seed-varied initial heat levels — each run feels different
  const heatRng = ((state.seed * 1103515245 + 12345) >>> 0) % 20;
  const relayDefs = [
    { id: "relay_p01", roomIdx: relay1Idx, heat: 8 + heatRng % 10, smoke: 3 + heatRng % 5 },
    { id: "relay_p03", roomIdx: relay2Idx, heat: 12 + (heatRng + 7) % 12, smoke: 5 + (heatRng + 3) % 6 },
    { id: "relay_p04", roomIdx: relay3Idx, heat: 6 + (heatRng + 13) % 8, smoke: 2 + (heatRng + 5) % 4 },
  ];

  for (const def of relayDefs) {
    const pos = getRoomCenter(rooms[def.roomIdx]);
    state.entities.set(def.id, {
      id: def.id,
      type: EntityType.Relay,
      pos,
      props: { overheating: true, activated: false, powered: false },
    });
    // Seed heat on relay tile and adjacent corridor tiles (Item 4: creates heat vs. detour decision)
    if (pos.y >= 0 && pos.y < state.height && pos.x >= 0 && pos.x < state.width) {
      state.tiles[pos.y][pos.x].heat = def.heat;
      state.tiles[pos.y][pos.x].smoke = def.smoke;
      // Seed lighter heat on adjacent walkable tiles to create a heat zone
      const adjDeltas = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: 0 }];
      for (const d of adjDeltas) {
        const ax = pos.x + d.x;
        const ay = pos.y + d.y;
        if (ax >= 0 && ax < state.width && ay >= 0 && ay < state.height && state.tiles[ay][ax].walkable) {
          state.tiles[ay][ax].heat = Math.max(state.tiles[ay][ax].heat, Math.floor(def.heat * 0.6));
          state.tiles[ay][ax].smoke = Math.max(state.tiles[ay][ax].smoke, Math.floor(def.smoke * 0.5));
        }
      }
    }
  }

  // ── Data core in last room ────────────────────────────────────
  const dataCorePos = getRoomCenter(rooms[dataCoreIdx]);
  state.entities.set("data_core", {
    id: "data_core",
    type: EntityType.DataCore,
    pos: dataCorePos,
    props: { transmitted: false },
  });

  // ── Locked door(s) at data core room entrance ─────────────────
  const dcRoom = rooms[dataCoreIdx];
  let lockedDoorPlaced = false;
  for (let x = dcRoom.getLeft() - 1; x <= dcRoom.getRight() + 1 && !lockedDoorPlaced; x++) {
    for (let y = dcRoom.getTop() - 1; y <= dcRoom.getBottom() + 1 && !lockedDoorPlaced; y++) {
      if (x < 0 || x >= state.width || y < 0 || y >= state.height) continue;
      if (state.tiles[y][x].type === TileType.Door) {
        state.tiles[y][x] = {
          type: TileType.LockedDoor,
          glyph: GLYPHS.lockedDoor,
          walkable: false,
          heat: 0,
          smoke: 0,
          dirt: 0,
          pressure: PRESSURE_NORMAL,
          radiation: 0,
          stress: 0,
          stressTurns: 0,
          explored: false,
          visible: false,
        };
        state.entities.set("locked_door_main", {
          id: "locked_door_main",
          type: EntityType.Relay,
          pos: { x, y },
          props: { powered: false, locked: true },
        });
        lockedDoorPlaced = true;
      }
    }
  }
  if (!lockedDoorPlaced) {
    const ldPos = getRoomPos(dcRoom, -1, 0);
    state.tiles[ldPos.y][ldPos.x] = {
      type: TileType.LockedDoor,
      glyph: GLYPHS.lockedDoor,
      walkable: false,
      heat: 0,
      smoke: 0,
      dirt: 0,
      pressure: PRESSURE_NORMAL,
      radiation: 0,
      stress: 0,
      stressTurns: 0,
      explored: false,
      visible: false,
    };
  }

  // ── Service bot in mid-station ────────────────────────────────
  const serviceBotPos = getRoomCenter(rooms[serviceBotIdx]);
  state.entities.set("service_bot", {
    id: "service_bot",
    type: EntityType.ServiceBot,
    pos: serviceBotPos,
    props: { active: false },
  });

  // ── 16 log terminals spread across the station ────────────────
  const reservedRooms = new Set([0, sensorIdx, relay1Idx, relay2Idx, relay3Idx, dataCoreIdx]);
  const logRoomIndices = spreadIndices(16, n, reservedRooms);

  // Story logs: main timeline + mystery logs (Item 6) interspersed
  const logSelections = [
    AUTHORED_LOGS[0],   // Morning diagnostic — everything nominal
    AUTHORED_LOGS[20],  // MYSTERY: Data Core accessed at 02:17 — who?
    AUTHORED_LOGS[1],   // Vasquez's warning about coolant loop B
    AUTHORED_LOGS[22],  // MYSTERY: Maintenance request #47, 3 months pending
    AUTHORED_LOGS[2],   // Commander Okafor's log — dismisses Vasquez
    AUTHORED_LOGS[4],   // Tanaka — personal, hopeful, eve of transmission
    AUTHORED_LOGS[21],  // MYSTERY: Classified signal analysis — Tanaka can't access
    AUTHORED_LOGS[5],   // Chen smells something burnt near P03
    AUTHORED_LOGS[25],  // MYSTERY: Chen — strange atmospheric readings
    AUTHORED_LOGS[7],   // Vasquez — Okafor pulled rank, documenting why
    AUTHORED_LOGS[10],  // Critical overheat at P03
    AUTHORED_LOGS[12],  // Okafor — "She was right"
    AUTHORED_LOGS[13],  // Priya's emergency note — service bot clue
    AUTHORED_LOGS[16],  // Chen — crew huddled in cargo hold
    AUTHORED_LOGS[17],  // Vasquez's final note — the key procedure clue
    AUTHORED_LOGS[18],  // Vasquez — made it back, burns, data can be saved
  ];

  // ── Med kit in Med Bay (Item 5: one-time use, 50 HP) ────────
  const medBayIdx = state.rooms.findIndex(r => r.name === "Med Bay");
  if (medBayIdx >= 0 && medBayIdx < n) {
    const medBayRoom = rooms[medBayIdx];
    const medKitPos = getRoomPos(medBayRoom, 1, -1);
    state.entities.set("med_kit_1", {
      id: "med_kit_1",
      type: EntityType.MedKit,
      pos: medKitPos,
      props: { used: false },
    });
  }

  // ── Repair cradle in Engine Core room ──────────────────
  const botMaintIdx = state.rooms.findIndex(r => r.name === "Engine Core");
  if (botMaintIdx >= 0 && botMaintIdx < n) {
    const botMaintRoom = rooms[botMaintIdx];
    const cradlePos = getRoomCenter(botMaintRoom);
    state.entities.set("repair_cradle_0", {
      id: "repair_cradle_0",
      type: EntityType.RepairCradle,
      pos: cradlePos,
      props: { cooldown: 0 },
    });
  }

  // ── Crew personal items spread across the station ──────────
  for (const item of CREW_ITEMS) {
    // Find the room matching the hint, or fall back to a random available room
    let targetRoomIdx = state.rooms.findIndex(r => r.name === item.roomHint);
    if (targetRoomIdx < 0 || targetRoomIdx >= n) {
      const available = [];
      for (let i = 1; i < n; i++) {
        if (!reservedRooms.has(i)) available.push(i);
      }
      targetRoomIdx = available.length > 0 ? available[Math.floor(ROT.RNG.getUniform() * available.length)] : 1;
    }
    const room = rooms[targetRoomIdx];
    const pos = getRoomPos(room, -1, 1);
    state.entities.set(item.id, {
      id: item.id,
      type: EntityType.CrewItem,
      pos,
      props: {
        text: item.description,
        name: item.name,
        examined: false,
        hidden: item.hidden === true,
        memoryEcho: item.memoryEcho || null,
      },
    });
    // Hidden items get extra dirt on their tile so they're buried
    if (item.hidden && pos.y >= 0 && pos.y < state.height && pos.x >= 0 && pos.x < state.width) {
      state.tiles[pos.y][pos.x].dirt = Math.max(state.tiles[pos.y][pos.x].dirt, 70);
    }
  }

  // ── Repair bots (2, near Engineering Storage and Life Support) ──
  const repairBotRoomNames = ["Engineering Storage", "Life Support"];
  repairBotRoomNames.forEach((roomName, i) => {
    let targetIdx = state.rooms.findIndex(r => r.name === roomName);
    if (targetIdx < 0 || targetIdx >= n) {
      // Fallback: place in a mid-station room
      targetIdx = Math.min(Math.floor(n * 0.3) + i, n - 2);
    }
    const room = rooms[targetIdx];
    const pos = getRoomPos(room, i === 0 ? 1 : -1, i === 0 ? -1 : 1);
    state.entities.set(`repair_bot_${i}`, {
      id: `repair_bot_${i}`,
      type: EntityType.RepairBot,
      pos,
      props: { followPlayer: false, followTurnsLeft: 0, coolantReserve: 73 + i * 5 },
    });
  });

  // ── Roaming maintenance drones ──────────────────────────────
  const droneCount = Math.min(4, Math.floor(n / 3));
  const droneRoomIndices = spreadIndices(droneCount, n, new Set([0, dataCoreIdx]));
  droneRoomIndices.forEach((ri, i) => {
    const room = rooms[ri];
    const pos = getRoomPos(room, i % 2 === 0 ? -1 : 1, i % 2 === 0 ? 1 : -1);
    state.entities.set(`drone_${i}`, {
      id: `drone_${i}`,
      type: EntityType.Drone,
      pos,
      props: { patrolRoom: ri },
    });
  });

  // ── Atmospheric sensor pickup in Communications Hub ─────────
  const commsHubIdx = state.rooms.findIndex(r => r.name === "Communications Hub");
  if (commsHubIdx >= 0 && commsHubIdx < n) {
    const commsRoom = rooms[commsHubIdx];
    const atmosPos = getRoomPos(commsRoom, -1, -1);
    state.entities.set("sensor_atmospheric", {
      id: "sensor_atmospheric",
      type: EntityType.SensorPickup,
      pos: atmosPos,
      props: { sensorType: SensorType.Atmospheric },
    });
  }

  // ── Breach entities (2, placed in rooms between relays) ────
  const breachRoomCandidates: number[] = [];
  for (let ri = relay1Idx + 1; ri < relay3Idx; ri++) {
    if (!reservedRooms.has(ri) && ri !== relay2Idx) {
      breachRoomCandidates.push(ri);
    }
  }
  // Seed-varied breach count (1-3 breaches)
  const breachCountRng = ((state.seed * 39916801) >>> 0) % 100;
  const breachCount = breachCountRng < 25 ? 1 : breachCountRng < 75 ? 2 : 3;
  const breachRooms = breachRoomCandidates.slice(0, breachCount);
  breachRooms.forEach((ri, i) => {
    const room = rooms[ri];
    const pos = getRoomPos(room, i === 0 ? 1 : -1, 0);
    state.entities.set(`breach_${i}`, {
      id: `breach_${i}`,
      type: EntityType.Breach,
      pos,
      props: { sealed: false },
    });
    // Reduce pressure on the breach tile and adjacent tiles
    if (pos.y >= 0 && pos.y < state.height && pos.x >= 0 && pos.x < state.width) {
      state.tiles[pos.y][pos.x].pressure = 20;
      const adjDeltas = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: 0 }];
      for (const d of adjDeltas) {
        const ax = pos.x + d.x;
        const ay = pos.y + d.y;
        if (ax >= 0 && ax < state.width && ay >= 0 && ay < state.height && state.tiles[ay][ax].walkable) {
          state.tiles[ay][ax].pressure = Math.min(state.tiles[ay][ax].pressure, 50);
        }
      }
    }
  });

  // ── Heat corridor tiles (Item 6: routing decisions) ────────
  // Add heat to 2-3 corridor tiles between key rooms
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const tile = state.tiles[y][x];
      if (tile.type === TileType.Corridor || (tile.walkable && tile.type === TileType.Floor)) {
        // Check if this is a corridor tile (not in any room)
        let inRoom = false;
        for (const room of rooms) {
          if (x >= room.getLeft() && x <= room.getRight() &&
              y >= room.getTop() && y <= room.getBottom()) {
            inRoom = true;
            break;
          }
        }
        if (!inRoom && tile.walkable) {
          // Deterministic selection: pick corridor tiles near relay rooms
          for (const def of relayDefs) {
            const relayRoom = rooms[def.roomIdx];
            const relayCenter = getRoomCenter(relayRoom);
            const dist = Math.abs(x - relayCenter.x) + Math.abs(y - relayCenter.y);
            if (dist >= 2 && dist <= 4) {
              const hash = (x * 31 + y * 17 + state.seed) % 5;
              if (hash === 0) {
                state.tiles[y][x].heat = 50;
                state.tiles[y][x].smoke = 3;
              }
            }
          }
        }
      }
    }
  }

  // ── Closed shortcut doors (Item 7: routing decisions) ──────
  // Place 2 closed doors as shortcuts between rooms that would otherwise require going through heat
  const closedDoorCandidates: { x: number; y: number }[] = [];
  for (let y = 1; y < state.height - 1; y++) {
    for (let x = 1; x < state.width - 1; x++) {
      if (state.tiles[y][x].type === TileType.Wall) {
        // Check if wall separates two walkable areas (potential shortcut)
        const hor = (state.tiles[y][x - 1].walkable && state.tiles[y][x + 1].walkable &&
                    !state.tiles[y - 1][x].walkable && !state.tiles[y + 1][x].walkable);
        const ver = (state.tiles[y - 1][x].walkable && state.tiles[y + 1][x].walkable &&
                    !state.tiles[y][x - 1].walkable && !state.tiles[y][x + 1].walkable);
        if (hor || ver) {
          closedDoorCandidates.push({ x, y });
        }
      }
    }
  }
  // Pick up to 2, spread apart
  const placedClosedDoors: { x: number; y: number }[] = [];
  for (const cand of closedDoorCandidates) {
    if (placedClosedDoors.length >= 2) break;
    const tooClose = placedClosedDoors.some(d =>
      Math.abs(d.x - cand.x) + Math.abs(d.y - cand.y) < 8
    );
    if (tooClose) continue;
    const hash = (cand.x * 13 + cand.y * 7 + state.seed) % 3;
    if (hash === 0) {
      state.tiles[cand.y][cand.x] = {
        type: TileType.Door,
        glyph: GLYPHS.closedDoor,
        walkable: false,
        heat: 0,
        smoke: 0,
        dirt: 0,
        pressure: 100,
        radiation: 0,
        stress: 0,
        stressTurns: 0,
        explored: false,
        visible: false,
      };
      state.entities.set(`closed_door_${placedClosedDoors.length}`, {
        id: `closed_door_${placedClosedDoors.length}`,
        type: EntityType.ClosedDoor,
        pos: { x: cand.x, y: cand.y },
        props: { closed: true },
      });
      placedClosedDoors.push(cand);
    }
  }

  // ── Puzzle variation: seed determines which optional puzzles appear ──
  // Use the seed to pick 1-2 optional puzzle types per run
  const puzzleRng = ((state.seed * 2654435761) >>> 0) % 100;

  // Puzzle A: Pressure valve puzzle (appears ~60% of runs)
  if (puzzleRng < 60) {
    placePressureValvePuzzle(state, rooms, n, reservedRooms);
  }

  // Puzzle B: Power cell / fuse box puzzle (appears ~60% of runs, different threshold)
  if (puzzleRng >= 30) {
    placePowerCellPuzzle(state, rooms, n, reservedRooms);
  }

  // ── Hostile patrol drones (1-3, seed-varied placement) ──────
  const droneCountRng = ((state.seed * 48271) >>> 0) % 100;
  const patrolDroneCount = droneCountRng < 30 ? 1 : droneCountRng < 80 ? 2 : 3;
  const patrolDroneExclude = new Set([0, 1, sensorIdx, dataCoreIdx]);
  // Vary starting rooms based on seed
  const droneStartOffset = ((state.seed * 16807) >>> 0) % Math.max(1, n - 4);
  const patrolDroneRoomIndices: number[] = [];
  for (let di = 0; di < patrolDroneCount; di++) {
    const ri = Math.min(n - 1, Math.max(2, droneStartOffset + di * Math.floor(n / (patrolDroneCount + 1))));
    if (!patrolDroneExclude.has(ri) && !patrolDroneRoomIndices.includes(ri)) {
      patrolDroneRoomIndices.push(ri);
    }
  }
  patrolDroneRoomIndices.forEach((ri, i) => {
    const room = rooms[ri];
    const pos = getRoomPos(room, i === 0 ? -1 : 1, i === 0 ? 1 : -1);
    state.entities.set(`patrol_drone_${i}`, {
      id: `patrol_drone_${i}`,
      type: EntityType.PatrolDrone,
      pos,
      props: { hostile: false },
    });
  });

  logRoomIndices.forEach((ri, i) => {
    const room = rooms[ri];
    const pos = getRoomPos(room, 1, 0);

    // Use mystery-generated logs if available, fall back to authored logs
    const mysteryLog = state.mystery?.generatedLogs[i];
    let logText: string;
    let logSource: string;

    if (mysteryLog) {
      logText = `${mysteryLog.title}\n${mysteryLog.text}`;
      logSource = mysteryLog.source;
    } else {
      const log = logSelections[i] || AUTHORED_LOGS[i % AUTHORED_LOGS.length];
      logText = log ? `${log.title}\n${log.text}` : "Terminal offline.";
      logSource = log?.source || "unknown";
    }

    state.entities.set(`log_terminal_${i}`, {
      id: `log_terminal_${i}`,
      type: EntityType.LogTerminal,
      pos,
      props: {
        text: logText,
        source: logSource,
      },
    });
  });
}

/**
 * Place 1-2 security terminals in mid-station rooms.
 * Each terminal reveals 2-3 distant rooms when interacted with.
 */
function placeSecurityTerminals(state: GameState, rooms: DiggerRoom[]): void {
  const n = rooms.length;
  if (n < 6) return;

  // Place terminals in rooms at ~30% and ~60% through the station
  const terminalRoomIndices = [
    Math.max(2, Math.floor(n * 0.3)),
    Math.max(4, Math.floor(n * 0.6)),
  ];

  terminalRoomIndices.forEach((ri, i) => {
    if (ri >= n) return;
    const room = rooms[ri];
    const pos = getRoomPos(room, i === 0 ? -1 : 1, i === 0 ? 1 : -1);

    // Each terminal reveals 2-3 rooms ahead of the player's likely position
    const revealStart = Math.min(ri + 2, n - 1);
    const revealRooms: number[] = [];
    for (let j = revealStart; j < Math.min(revealStart + 3, n); j++) {
      revealRooms.push(j);
    }

    // Find door tiles adjacent to controlled rooms for electronic door control
    const controlledDoorPositions: { x: number; y: number }[] = [];
    for (const roomIdx of revealRooms) {
      if (roomIdx < 0 || roomIdx >= n) continue;
      const ctrlRoom = rooms[roomIdx];
      ctrlRoom.getDoors((dx: number, dy: number) => {
        if (!controlledDoorPositions.some(p => p.x === dx && p.y === dy)) {
          controlledDoorPositions.push({ x: dx, y: dy });
        }
      });
    }

    state.entities.set(`security_terminal_${i}`, {
      id: `security_terminal_${i}`,
      type: EntityType.SecurityTerminal,
      pos,
      props: {
        accessed: false,
        revealRooms,
        controlledDoors: controlledDoorPositions,
        doorsLocked: false,
      },
    });
  });
}

/**
 * Place evidence traces in rooms based on the incident timeline.
 * Evidence traces are physical marks (scorch marks, footprints, anomalies)
 * that provide clues about what happened. Some require specific sensors to see.
 */
function placeEvidenceTraces(state: GameState, rooms: DiggerRoom[]): void {
  if (!state.mystery) return;
  const n = rooms.length;
  if (n < 5) return;

  const timeline = state.mystery.timeline;
  const crew = state.mystery.crew;

  // Place 3-5 evidence traces in rooms corresponding to timeline events
  const traceCount = Math.min(5, timeline.events.length);

  for (let i = 0; i < traceCount; i++) {
    const event = timeline.events[i];
    // Find a room matching the event location, or use a random mid-station room
    let roomIdx = state.rooms.findIndex(r => r.name === event.location);
    if (roomIdx < 0 || roomIdx >= n) {
      roomIdx = Math.min(n - 1, Math.max(1, 2 + Math.floor(ROT.RNG.getUniform() * (n - 3))));
    }

    const room = rooms[roomIdx];
    const offsetX = Math.floor(ROT.RNG.getUniform() * 3) - 1;
    const offsetY = Math.floor(ROT.RNG.getUniform() * 3) - 1;
    const pos = getRoomPos(room, offsetX, offsetY);

    // Trace type depends on the incident's primary hazard
    let traceDesc: string;
    let sensorRequired: string | null = null;

    switch (timeline.primaryHazard) {
      case "heat":
        traceDesc = "Scorch marks on the floor. The burn pattern suggests a heat source was here — or passed through quickly.";
        sensorRequired = SensorType.Thermal;
        break;
      case "pressure":
        traceDesc = "Micro-fractures in the wall plating. Pressure differential left a visible stress pattern. Someone was here when it happened.";
        sensorRequired = SensorType.Atmospheric;
        break;
      case "radiation":
        traceDesc = "Faint discoloration on the surface. Radiation exposure, brief but intense. Someone walked through here recently.";
        sensorRequired = null; // visible to cleanliness sensor
        break;
      case "atmospheric":
        traceDesc = "Chemical residue on the floor panels. Something contaminated this area. Footprints lead away toward the corridor.";
        sensorRequired = SensorType.Atmospheric;
        break;
      default:
        traceDesc = "Unusual marks on the surface. Something happened here that left a physical trace. Worth noting.";
        sensorRequired = null;
    }

    // Add crew context to the trace
    const actor = crew.find(c => c.id === event.actorId);
    if (actor && i > 0) { // don't spoil the first event
      traceDesc += ` A badge reader nearby shows ${actor.badgeId} was the last access.`;
    }

    state.entities.set(`evidence_trace_${i}`, {
      id: `evidence_trace_${i}`,
      type: EntityType.EvidenceTrace,
      pos,
      props: {
        text: traceDesc,
        phase: event.phase,
        sensorRequired,
        discovered: false,
        crewMemberId: actor?.id || null,
      },
    });
  }
}

/**
 * Place 2-3 pressure valves in rooms near breaches.
 * Turning all valves in a group restores pressure in the area.
 */
function placePressureValvePuzzle(
  state: GameState,
  rooms: DiggerRoom[],
  n: number,
  reservedRooms: Set<number>,
): void {
  if (n < 8) return;

  // Find rooms with low pressure (near breaches)
  const lowPressureRooms: number[] = [];
  for (let ri = 0; ri < n; ri++) {
    if (reservedRooms.has(ri)) continue;
    const room = rooms[ri];
    const cx = Math.floor((room.getLeft() + room.getRight()) / 2);
    const cy = Math.floor((room.getTop() + room.getBottom()) / 2);
    if (cx >= 0 && cx < state.width && cy >= 0 && cy < state.height) {
      if (state.tiles[cy][cx].pressure < 80) {
        lowPressureRooms.push(ri);
      }
    }
  }

  // If no low-pressure rooms, pick rooms adjacent to breach rooms
  if (lowPressureRooms.length < 2) {
    for (let ri = Math.floor(n * 0.3); ri < Math.floor(n * 0.7); ri++) {
      if (!reservedRooms.has(ri) && !lowPressureRooms.includes(ri)) {
        lowPressureRooms.push(ri);
        if (lowPressureRooms.length >= 3) break;
      }
    }
  }

  const valveRooms = lowPressureRooms.slice(0, 3);
  const groupId = "valve_group_a";

  valveRooms.forEach((ri, i) => {
    const room = rooms[ri];
    const pos = getRoomPos(room, i % 2 === 0 ? 1 : -1, i % 2 === 0 ? -1 : 1);
    state.entities.set(`pressure_valve_${i}`, {
      id: `pressure_valve_${i}`,
      type: EntityType.PressureValve,
      pos,
      props: { turned: false, group: groupId },
    });
    // Reduce pressure around the valve to make the puzzle visible
    if (pos.y >= 0 && pos.y < state.height && pos.x >= 0 && pos.x < state.width) {
      state.tiles[pos.y][pos.x].pressure = Math.min(state.tiles[pos.y][pos.x].pressure, 50);
    }
  });
}

/**
 * Place 2 power cells and 2 fuse boxes.
 * Collecting cells and inserting them into fuse boxes powers up systems.
 */
function placePowerCellPuzzle(
  state: GameState,
  rooms: DiggerRoom[],
  n: number,
  reservedRooms: Set<number>,
): void {
  if (n < 8) return;

  const groupId = "fuse_group_a";

  // Place fuse boxes in mid-to-late rooms (near heat sources)
  const fuseRoomCandidates: number[] = [];
  for (let ri = Math.floor(n * 0.4); ri < Math.floor(n * 0.8); ri++) {
    if (!reservedRooms.has(ri)) fuseRoomCandidates.push(ri);
  }

  const fuseRooms = fuseRoomCandidates.slice(0, 2);
  fuseRooms.forEach((ri, i) => {
    const room = rooms[ri];
    const pos = getRoomPos(room, i === 0 ? -1 : 1, 0);
    state.entities.set(`fuse_box_${i}`, {
      id: `fuse_box_${i}`,
      type: EntityType.FuseBox,
      pos,
      props: { powered: false, group: groupId },
    });
    // Add heat around fuse boxes to indicate broken systems
    if (pos.y >= 0 && pos.y < state.height && pos.x >= 0 && pos.x < state.width) {
      state.tiles[pos.y][pos.x].heat = Math.max(state.tiles[pos.y][pos.x].heat, 25);
    }
  });

  // Place power cells in early-to-mid rooms (player finds them before fuse boxes)
  const cellRoomCandidates: number[] = [];
  for (let ri = 1; ri < Math.floor(n * 0.5); ri++) {
    if (!reservedRooms.has(ri) && !fuseRooms.includes(ri)) cellRoomCandidates.push(ri);
  }

  const cellRooms = cellRoomCandidates.slice(0, 2);
  cellRooms.forEach((ri, i) => {
    const room = rooms[ri];
    const pos = getRoomPos(room, i === 0 ? 1 : -1, i === 0 ? 1 : -1);
    state.entities.set(`power_cell_${i}`, {
      id: `power_cell_${i}`,
      type: EntityType.PowerCell,
      pos,
      props: { collected: false },
    });
  });
}

/**
 * Place Sprint 3 entities: RadiationSource, ShieldGenerator, ReinforcementPanel,
 * SignalBooster, HiddenDevice.
 */
function placeSprintThreeEntities(state: GameState, rooms: DiggerRoom[]): void {
  const n = rooms.length;
  if (n < 5) return;

  const archetype = state.mystery?.timeline.archetype;
  const isReactorScram = archetype === IncidentArchetype.ReactorScram;

  // ── Radiation sources and shield generators ───────────────────
  // ReactorScram: 1-2 RadiationSource in mid-station, 1-2 ShieldGenerator nearby
  // Other archetypes: 1 RadiationSource, 1 ShieldGenerator (lighter presence)
  const radSourceCount = isReactorScram ? Math.min(2, Math.max(1, Math.floor(n / 5))) : 1;
  const shieldGenCount = radSourceCount; // match source count

  const midStart = Math.floor(n * 0.3);
  const midEnd = Math.floor(n * 0.7);

  for (let i = 0; i < radSourceCount; i++) {
    const ri = Math.min(n - 2, midStart + Math.floor((midEnd - midStart) * (i + 1) / (radSourceCount + 1)));
    const room = rooms[ri];
    const pos = getRoomCenter(room);
    state.entities.set(`radiation_source_${i}`, {
      id: `radiation_source_${i}`,
      type: EntityType.RadiationSource,
      pos,
      props: {},
    });
    // Seed initial radiation on the tile
    if (pos.y >= 0 && pos.y < state.height && pos.x >= 0 && pos.x < state.width) {
      state.tiles[pos.y][pos.x].radiation = 30;
    }
  }

  for (let i = 0; i < shieldGenCount; i++) {
    // Place shield generator 1-2 rooms after the corresponding radiation source
    const ri = Math.min(n - 2, midStart + Math.floor((midEnd - midStart) * (i + 1) / (shieldGenCount + 1)) + 1);
    const room = rooms[ri];
    const pos = getRoomPos(room, 1, -1);
    state.entities.set(`shield_generator_${i}`, {
      id: `shield_generator_${i}`,
      type: EntityType.ShieldGenerator,
      pos,
      props: { activated: false },
    });
  }

  // ── Reinforcement panel: 1 in a room with stress potential ──────
  // Pick a room in mid-station; seed initial stress on tiles
  const reinforceIdx = Math.min(n - 2, Math.floor(n * 0.5));
  const reinforceRoom = rooms[reinforceIdx];
  const reinforcePos = getRoomPos(reinforceRoom, -1, 0);
  state.entities.set("reinforcement_panel_0", {
    id: "reinforcement_panel_0",
    type: EntityType.ReinforcementPanel,
    pos: reinforcePos,
    props: { installed: false },
  });
  // Seed some structural stress nearby
  if (reinforcePos.y >= 0 && reinforcePos.y < state.height &&
      reinforcePos.x >= 0 && reinforcePos.x < state.width) {
    state.tiles[reinforcePos.y][reinforcePos.x].stress = 40;
    const adjDeltas = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: 0 }];
    for (const d of adjDeltas) {
      const ax = reinforcePos.x + d.x;
      const ay = reinforcePos.y + d.y;
      if (ax >= 0 && ax < state.width && ay >= 0 && ay < state.height && state.tiles[ay][ax].walkable) {
        state.tiles[ay][ax].stress = Math.max(state.tiles[ay][ax].stress, 25);
      }
    }
  }

  // ── Signal boosters: 1-2 in mid-to-late rooms ──────────────────
  const signalBoosterCount = Math.min(2, Math.max(1, Math.floor(n / 6)));
  for (let i = 0; i < signalBoosterCount; i++) {
    const ri = Math.min(n - 2, Math.floor(n * 0.6) + i * Math.floor(n * 0.15));
    const room = rooms[ri];
    const pos = getRoomPos(room, i === 0 ? 1 : -1, i === 0 ? 1 : -1);
    state.entities.set(`signal_booster_${i}`, {
      id: `signal_booster_${i}`,
      type: EntityType.SignalBooster,
      pos,
      props: { activated: false },
    });
  }

  // ── Hidden devices: 1-2 (only visible with EM sensor) ──────────
  const hiddenDeviceCount = Math.min(2, Math.max(1, Math.floor(n / 7)));
  for (let i = 0; i < hiddenDeviceCount; i++) {
    // Place in later rooms for mystery relevance
    const ri = Math.min(n - 2, Math.floor(n * 0.65) + i * Math.floor(n * 0.12));
    const room = rooms[ri];
    const pos = getRoomPos(room, i === 0 ? -1 : 1, i === 0 ? -1 : 1);
    state.entities.set(`hidden_device_${i}`, {
      id: `hidden_device_${i}`,
      type: EntityType.HiddenDevice,
      pos,
      props: { discovered: false, evidenceText: `Hidden device ${i}: encrypted data fragment recovered. Signal analysis required.` },
    });
  }
}

/**
 * Place Sprint 3 sensor pickups: Radiation, Structural, EM/Signal.
 */
function placeSprintThreeSensors(state: GameState, rooms: DiggerRoom[]): void {
  const n = rooms.length;
  if (n < 5) return;

  const archetype = state.mystery?.timeline.archetype;
  const isReactorScram = archetype === IncidentArchetype.ReactorScram;

  // ── Radiation sensor ──────────────────────────────────────────
  // ReactorScram: place before first radiation zone
  // Otherwise: mid-station room
  let radSensorIdx: number;
  if (isReactorScram) {
    // Place before the first radiation source (which is at ~30-40% through)
    radSensorIdx = Math.max(1, Math.floor(n * 0.25));
  } else {
    radSensorIdx = Math.max(1, Math.floor(n * 0.35));
  }
  radSensorIdx = Math.min(radSensorIdx, n - 2);
  const radSensorRoom = rooms[radSensorIdx];
  const radSensorPos = getRoomPos(radSensorRoom, 1, 0);
  state.entities.set("sensor_radiation", {
    id: "sensor_radiation",
    type: EntityType.SensorPickup,
    pos: radSensorPos,
    props: { sensorType: SensorType.Radiation },
  });

  // ── Structural sensor ─────────────────────────────────────────
  // Near Engineering Storage
  let structSensorIdx = state.rooms.findIndex(r => r.name === "Engineering Storage");
  if (structSensorIdx < 0 || structSensorIdx >= n) {
    structSensorIdx = Math.max(1, Math.floor(n * 0.2));
  }
  // Place in adjacent room if possible, otherwise same room different position
  const structActualIdx = Math.min(n - 2, structSensorIdx + 1);
  const structSensorRoom = rooms[structActualIdx];
  const structSensorPos = getRoomPos(structSensorRoom, -1, 1);
  state.entities.set("sensor_structural", {
    id: "sensor_structural",
    type: EntityType.SensorPickup,
    pos: structSensorPos,
    props: { sensorType: SensorType.Structural },
  });

  // ── EM/Signal sensor ──────────────────────────────────────────
  // In Data Core vicinity or late-game room
  let emSensorIdx = state.rooms.findIndex(r => r.name === "Data Core");
  if (emSensorIdx < 0 || emSensorIdx >= n) {
    emSensorIdx = n - 2; // fallback to near-last room
  }
  // Place 1-2 rooms before Data Core
  const emActualIdx = Math.max(1, emSensorIdx - 2);
  const emSensorRoom = rooms[emActualIdx];
  const emSensorPos = getRoomPos(emSensorRoom, 1, -1);
  state.entities.set("sensor_em_signal", {
    id: "sensor_em_signal",
    type: EntityType.SensorPickup,
    pos: emSensorPos,
    props: { sensorType: SensorType.EMSignal },
  });
}

/**
 * Place crew NPCs and escape pods for the evacuation mechanic.
 *
 * All surviving crew are concentrated in the Cargo Hold behind an
 * environmental protocol lock. The lock requires:
 * 1. All hull breaches sealed
 * 2. Station integrity > 50%
 * 3. At least 2 power relays activated
 *
 * Escape Pod Bay: a single dedicated room with organized pods.
 */
function placeCrewAndPods(state: GameState, rooms: DiggerRoom[]): void {
  if (!state.mystery) return;
  const n = rooms.length;
  if (n < 5) return;

  const crew = state.mystery.crew;

  // ── Escape Pod Bay ────────────────────────────────────────────────
  let podBayIdx = state.rooms.findIndex(r => r.name === "Escape Pod Bay");
  if (podBayIdx < 0) {
    podBayIdx = n - 1;
    state.rooms[podBayIdx] = { ...state.rooms[podBayIdx], name: "Escape Pod Bay" };
  }

  const podBayRoom = rooms[podBayIdx];
  const bayLeft = podBayRoom.getLeft();
  const bayRight = podBayRoom.getRight();
  const bayTop = podBayRoom.getTop();
  const bayBottom = podBayRoom.getBottom();
  const bayW = bayRight - bayLeft + 1;
  const bayH = bayBottom - bayTop + 1;

  const podPositions: { x: number; y: number }[] = [];
  for (let row = 0; row < bayH && podPositions.length < 12; row++) {
    for (let col = 0; col < bayW && podPositions.length < 12; col++) {
      const x = bayLeft + col;
      const y = bayTop + row;
      const midCol = Math.floor(bayW / 2);
      if (col === midCol && bayW >= 3) continue;
      if (state.tiles[y][x].type === TileType.Door) continue;
      podPositions.push({ x, y });
    }
  }

  for (let i = 0; i < podPositions.length; i++) {
    state.entities.set(`escape_pod_${i}`, {
      id: `escape_pod_${i}`,
      type: EntityType.EscapePod,
      pos: podPositions[i],
      props: { powered: false, capacity: 1, boarded: 0 },
    });
  }

  // ── Cargo Hold: place ALL surviving crew here ──────────────────────
  let cargoHoldIdx = state.rooms.findIndex(r => r.name === "Cargo Hold");
  if (cargoHoldIdx < 0) {
    // Rename a mid-late room to serve as the Cargo Hold
    cargoHoldIdx = Math.max(3, Math.floor(n * 0.6));
    if (cargoHoldIdx === podBayIdx) cargoHoldIdx = Math.max(1, podBayIdx - 1);
    state.rooms[cargoHoldIdx] = { ...state.rooms[cargoHoldIdx], name: "Cargo Hold" };
  }

  const cargoRoom = rooms[cargoHoldIdx];
  const survivors = crew.filter(c => c.fate === CrewFate.Survived || c.fate === CrewFate.InCryo);
  const npcCandidates = survivors.slice(0, 5);
  if (npcCandidates.length < 3) {
    const missing = crew.filter(c => c.fate === CrewFate.Missing);
    for (const m of missing) {
      if (npcCandidates.length >= 3) break;
      npcCandidates.push(m);
    }
  }

  // Place all crew NPCs inside the Cargo Hold
  let npcCount = 0;
  for (const member of npcCandidates) {
    const offsetX = (npcCount % 3) - 1; // -1, 0, 1
    const offsetY = Math.floor(npcCount / 3) === 0 ? -1 : 1;
    const pos = getRoomPos(cargoRoom, offsetX, offsetY);
    const isUnconscious = member.fate === CrewFate.InCryo;

    state.entities.set(`crew_npc_${member.id}`, {
      id: `crew_npc_${member.id}`,
      type: EntityType.CrewNPC,
      pos,
      props: {
        crewId: member.id,
        found: false,
        following: false,
        evacuated: false,
        dead: false,
        sealed: false, // no longer individually sealed — the room door is locked instead
        hp: 50,
        unconscious: isUnconscious,
        firstName: member.firstName,
        lastName: member.lastName,
        personality: member.personality,
      },
    });
    npcCount++;
  }

  // ── Environmental protocol lock on Cargo Hold entrance ──────────
  // Find a door tile at the Cargo Hold boundary
  let envLockPlaced = false;
  for (let x = cargoRoom.getLeft() - 1; x <= cargoRoom.getRight() + 1 && !envLockPlaced; x++) {
    for (let y = cargoRoom.getTop() - 1; y <= cargoRoom.getBottom() + 1 && !envLockPlaced; y++) {
      if (x < 0 || x >= state.width || y < 0 || y >= state.height) continue;
      if (state.tiles[y][x].type !== TileType.Door) continue;

      // Don't overwrite doors that already have entities
      let hasEntity = false;
      for (const [, entity] of state.entities) {
        if (entity.pos.x === x && entity.pos.y === y) {
          hasEntity = true;
          break;
        }
      }
      if (hasEntity) continue;

      // Convert to a closed environmental-lock door
      state.tiles[y][x] = {
        ...state.tiles[y][x],
        type: TileType.Door,
        glyph: GLYPHS.closedDoor,
        walkable: false,
      };

      state.entities.set("cargo_hold_env_lock", {
        id: "cargo_hold_env_lock",
        type: EntityType.ClosedDoor,
        pos: { x, y },
        props: {
          closed: true,
          environmentalLock: true,
          locked: true,
        },
      });
      envLockPlaced = true;
    }
  }
}

/**
 * Place 1-2 clearance-locked doors in mid-to-late station rooms.
 * These doors require the player to solve a deduction with rewardType="clearance"
 * to obtain clearance level >= the door's clearanceLevel.
 */
function placeClearanceDoors(state: GameState, rooms: DiggerRoom[]): void {
  const n = rooms.length;
  if (n < 6) return;

  // Find rooms between 40-70% through the station
  const candidateStart = Math.floor(n * 0.4);
  const candidateEnd = Math.floor(n * 0.7);

  // Look for door tiles at room boundaries that we can convert to clearance doors
  let placed = 0;
  for (let ri = candidateStart; ri <= candidateEnd && placed < 2; ri++) {
    const room = rooms[ri];
    // Scan the room perimeter for existing door tiles
    for (let x = room.getLeft() - 1; x <= room.getRight() + 1 && placed < 2; x++) {
      for (let y = room.getTop() - 1; y <= room.getBottom() + 1 && placed < 2; y++) {
        if (x < 0 || x >= state.width || y < 0 || y >= state.height) continue;
        if (state.tiles[y][x].type !== TileType.Door) continue;

        // Don't convert the only entrance to a room — check if room has multiple doors
        let doorCount = 0;
        for (let dx = room.getLeft() - 1; dx <= room.getRight() + 1; dx++) {
          for (let dy = room.getTop() - 1; dy <= room.getBottom() + 1; dy++) {
            if (dx < 0 || dx >= state.width || dy < 0 || dy >= state.height) continue;
            if (state.tiles[dy][dx].type === TileType.Door || state.tiles[dy][dx].type === TileType.LockedDoor) {
              doorCount++;
            }
          }
        }
        if (doorCount < 2) continue;

        // Don't overwrite doors that already have entities on them
        let hasEntity = false;
        for (const [, entity] of state.entities) {
          if (entity.pos.x === x && entity.pos.y === y) {
            hasEntity = true;
            break;
          }
        }
        if (hasEntity) continue;

        // Deterministic selection based on position + seed
        const hash = (x * 17 + y * 31 + state.seed * 7) % 5;
        if (hash !== 0) continue;

        // Convert to a clearance-locked door
        state.tiles[y][x] = {
          type: TileType.Door,
          glyph: GLYPHS.closedDoor,
          walkable: false,
          heat: 0,
          smoke: 0,
          dirt: 0,
          pressure: PRESSURE_NORMAL,
          radiation: 0,
          stress: 0,
          stressTurns: 0,
          explored: false,
          visible: false,
        };

        state.entities.set(`clearance_door_${placed}`, {
          id: `clearance_door_${placed}`,
          type: EntityType.ClosedDoor,
          pos: { x, y },
          props: {
            closed: true,
            keyType: DoorKeyType.Clearance,
            clearanceLevel: 1,
            locked: true,
          },
        });
        placed++;
      }
    }
  }
}

/**
 * Place landmark console entities in rooms that have definitions in LANDMARK_CONSOLES.
 */
function placeLandmarkConsoles(state: GameState, rooms: DiggerRoom[]): void {
  const n = rooms.length;
  for (let ri = 0; ri < n; ri++) {
    const roomName = state.rooms[ri]?.name;
    if (!roomName) continue;
    const consoleDefs = LANDMARK_CONSOLES[roomName];
    if (!consoleDefs || consoleDefs.length === 0) continue;

    const room = rooms[ri];
    for (let ci = 0; ci < consoleDefs.length; ci++) {
      const def = consoleDefs[ci];
      // Spread consoles across the room with deterministic offsets
      const offsetX = ci === 0 ? -1 : ci === 1 ? 1 : 0;
      const offsetY = ci === 0 ? 0 : ci === 1 ? 0 : -1;
      const pos = getRoomPos(room, offsetX, offsetY);

      // Don't place on top of existing entities
      let occupied = false;
      for (const [, entity] of state.entities) {
        if (entity.pos.x === pos.x && entity.pos.y === pos.y) {
          occupied = true;
          break;
        }
      }
      if (occupied) continue;

      state.entities.set(def.id, {
        id: def.id,
        type: EntityType.Console,
        pos,
        props: {
          name: def.name,
          text: def.text,
          read: false,
          journalSummary: def.journal?.summary || null,
          journalDetail: def.journal?.detail || null,
          journalCategory: def.journal?.category || null,
        },
      });
    }
  }
}

/**
 * Place 1 environmental door — a door blocked by a hazard.
 * The tile behind it has high heat or low pressure.
 * Clear the hazard and the door becomes passable.
 */
function placeEnvironmentalDoors(state: GameState, rooms: DiggerRoom[]): void {
  const n = rooms.length;
  if (n < 6) return;

  // Look for rooms with active hazards (high heat or low pressure)
  const candidateStart = Math.floor(n * 0.3);
  const candidateEnd = Math.floor(n * 0.7);

  for (let ri = candidateStart; ri <= candidateEnd; ri++) {
    const room = rooms[ri];
    // Check if this room has heat or pressure issues
    const center = getRoomCenter(room);
    if (center.y < 0 || center.y >= state.height || center.x < 0 || center.x >= state.width) continue;
    const centerTile = state.tiles[center.y][center.x];

    let hazardType: "heat" | "pressure" | null = null;
    if (centerTile.heat > 30) {
      hazardType = "heat";
    } else if (centerTile.pressure < 60) {
      hazardType = "pressure";
    }
    if (!hazardType) continue;

    // Find a door tile at this room's boundary
    for (let x = room.getLeft() - 1; x <= room.getRight() + 1; x++) {
      for (let y = room.getTop() - 1; y <= room.getBottom() + 1; y++) {
        if (x < 0 || x >= state.width || y < 0 || y >= state.height) continue;
        if (state.tiles[y][x].type !== TileType.Door) continue;

        // Don't overwrite doors that already have entities on them
        let hasEntity = false;
        for (const [, entity] of state.entities) {
          if (entity.pos.x === x && entity.pos.y === y) {
            hasEntity = true;
            break;
          }
        }
        if (hasEntity) continue;

        // Deterministic selection
        const hash = (x * 13 + y * 23 + state.seed * 11) % 7;
        if (hash !== 0) continue;

        // Seed the hazard on the door tile
        if (hazardType === "heat") {
          state.tiles[y][x].heat = Math.max(state.tiles[y][x].heat, 65);
        } else {
          state.tiles[y][x].pressure = Math.min(state.tiles[y][x].pressure, 35);
        }

        // Convert to an environmental-locked door
        state.tiles[y][x] = {
          ...state.tiles[y][x],
          type: TileType.Door,
          glyph: GLYPHS.closedDoor,
          walkable: false,
        };

        state.entities.set(`env_door_0`, {
          id: `env_door_0`,
          type: EntityType.ClosedDoor,
          pos: { x, y },
          props: {
            closed: true,
            keyType: DoorKeyType.Environmental,
            hazardType,
            locked: true,
          },
        });

        return; // Only place 1 environmental door
      }
    }
  }
}
