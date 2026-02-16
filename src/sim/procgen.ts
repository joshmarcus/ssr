import * as ROT from "rot-js";
import type { GameState, Entity } from "../shared/types.js";
import { TileType, EntityType, SensorType } from "../shared/types.js";
import { DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, GLYPHS, PRESSURE_NORMAL } from "../shared/constants.js";
import { createEmptyState } from "./state.js";
import { updateVision } from "./vision.js";
import AUTHORED_LOGS from "../data/logs.json" with { type: "json" };
import { CREW_ITEMS } from "../data/crewItems.js";

/**
 * Room name assignments — enough for a large station.
 */
const ROOM_NAMES = [
  "Arrival Bay",
  "Engineering Storage",
  "Power Relay Junction",
  "Central Atrium",
  "Robotics Bay",
  "Life Support",
  "Vent Control Room",
  "Cargo Hold",
  "Charging Bay",
  "Communications Hub",
  "Crew Quarters",
  "Research Lab",
  "Med Bay",
  "Observation Deck",
  "Maintenance Corridor",
  "Data Core",
  "Signal Room",
  "Server Annex",
  "Auxiliary Power",
  "Emergency Shelter",
];

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
        explored: false,
        visible: false,
      };
    }
  });

  // Extract rooms
  const rooms = map.getRooms();
  rooms.forEach((room, i) => {
    state.rooms.push({
      id: `room_${i}`,
      name: ROOM_NAMES[i] || `Section ${i}`,
      x: room.getLeft(),
      y: room.getTop(),
      width: room.getRight() - room.getLeft() + 1,
      height: room.getBottom() - room.getTop() + 1,
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

  placeEntities(state, rooms);
  generateDirtTrails(state, rooms);

  // Place 1-2 security terminals in mid-station rooms
  placeSecurityTerminals(state, rooms);

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
  const relayDefs = [
    { id: "relay_p01", roomIdx: relay1Idx, heat: 10, smoke: 5 },
    { id: "relay_p03", roomIdx: relay2Idx, heat: 15, smoke: 8 },
    { id: "relay_p04", roomIdx: relay3Idx, heat: 8, smoke: 3 },
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
  const breachRooms = breachRoomCandidates.slice(0, 2);
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

  logRoomIndices.forEach((ri, i) => {
    const room = rooms[ri];
    const pos = getRoomPos(room, 1, 0);
    const log = logSelections[i] || AUTHORED_LOGS[i % AUTHORED_LOGS.length];
    state.entities.set(`log_terminal_${i}`, {
      id: `log_terminal_${i}`,
      type: EntityType.LogTerminal,
      pos,
      props: {
        text: log ? `${log.title}\n${log.text}` : "Terminal offline.",
        source: log?.source || "unknown",
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

    state.entities.set(`security_terminal_${i}`, {
      id: `security_terminal_${i}`,
      type: EntityType.SecurityTerminal,
      pos,
      props: { accessed: false, revealRooms },
    });
  });
}
