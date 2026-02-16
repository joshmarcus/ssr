/**
 * Golden Seed 184201 — Hand-authored room layout for the 25x17 grid.
 *
 * Station: CORVUS-7 Deep Orbital Research Platform
 *
 * The 10 rooms are arranged to fit the canonical ASCII map from
 * golden_seed_run_184201.md. Coordinates use (0,0) = top-left,
 * x right, y down.
 *
 * Connectivity is encoded as an adjacency list of room IDs.
 * Doors sit on the shared wall/corridor tiles between rooms.
 */

import type { Room, Position } from "../shared/types.js";

// ── Room definitions ────────────────────────────────────────

export interface GoldenRoom extends Room {
  /** Short flavour description shown on first entry. */
  description: string;
  /** IDs of rooms this room connects to (through doors or corridors). */
  connections: string[];
  /** Notable entity IDs placed in this room. */
  entities: string[];
}

/**
 * Map of the 25x17 grid (reproduced for reference):
 *
 *   0123456789012345678901234
 * 0 #########################
 * 1 #.......#.....#.........#
 * 2 #..@....#.....#....+TT..#   @ = player start
 * 3 #.......#.....#.........#
 * 4 ####.####..P..####.######
 * 5 #.....#...........#.....#
 * 6 #..I..#...........#..P..#
 * 7 #.....#######.#####.....#
 * 8 #.............#.........#
 * 9 #.....#######.#.#######.#
 *10 #.....#.....#.#.#.....#.#
 *11 #..C..#..B..#...#..P..#.#
 *12 #.....#.....#####.....#.#
 *13 #.....#########.........#
 *14 #.......................#
 *15 #..............P........#
 *16 #########################
 */

export const GOLDEN_ROOMS: GoldenRoom[] = [
  // ── Upper-left: Arrival Bay (player start) ──────────────
  {
    id: "room_0",
    name: "Arrival Bay",
    x: 1,
    y: 1,
    width: 7,
    height: 3,
    description:
      "A small airlock vestibule. Scuff marks lead inward. The emergency terminal link established here.",
    connections: ["room_1", "room_3"],
    entities: ["A3"],
  },

  // ── Upper-centre: Central Corridor / Atrium ─────────────
  {
    id: "room_1",
    name: "Central Atrium",
    x: 9,
    y: 1,
    width: 5,
    height: 6,
    description:
      "The main throughway of the station. A status board flickers overhead; most readouts are dead.",
    connections: ["room_0", "room_2", "room_3", "room_4"],
    entities: ["P_STATUS"],
  },

  // ── Upper-right: Data Core (objective room, locked) ─────
  {
    id: "room_2",
    name: "Data Core",
    x: 15,
    y: 1,
    width: 9,
    height: 3,
    description:
      "Rows of sealed archive racks hum faintly. The core bundle terminal awaits transmission.",
    connections: ["room_1"],
    entities: ["D17", "T01", "T02"],
  },

  // ── Left mid-upper: Engineering Storage ─────────────────
  {
    id: "room_3",
    name: "Engineering Storage",
    x: 1,
    y: 5,
    width: 5,
    height: 3,
    description:
      "Maintenance crates and replacement parts line the walls. A thermal module glints on a shelf.",
    connections: ["room_0", "room_4", "room_5"],
    entities: ["I09"],
  },

  // ── Centre open area: Power Relay Junction ──────────────
  {
    id: "room_4",
    name: "Power Relay Junction",
    x: 7,
    y: 5,
    width: 11,
    height: 3,
    description:
      "A tangle of conduit runs and relay housings. One panel radiates visible heat distortion.",
    connections: ["room_1", "room_3", "room_6", "room_7"],
    entities: [],
  },

  // ── Right mid: Thermal Control / Life Support ───────────
  {
    id: "room_5",
    name: "Life Support",
    x: 19,
    y: 5,
    width: 5,
    height: 8,
    description:
      "Climate regulation equipment lines every surface. An overheating relay panel blinks red warnings.",
    connections: ["room_4", "room_7"],
    entities: ["P03"],
  },

  // ── Left lower: Charging Bay ────────────────────────────
  {
    id: "room_6",
    name: "Charging Bay",
    x: 1,
    y: 9,
    width: 5,
    height: 5,
    description:
      "A row of bot cradles. One still has a green charge indicator. Coolant puddles on the floor.",
    connections: ["room_3", "room_4", "room_9"],
    entities: ["C01"],
  },

  // ── Centre lower: Robotics Bay ──────────────────────────
  {
    id: "room_7",
    name: "Robotics Bay",
    x: 7,
    y: 9,
    width: 5,
    height: 4,
    description:
      "Disassembled chassis and spare limbs. A dormant service bot stands upright in its dock.",
    connections: ["room_4", "room_8"],
    entities: ["B07"],
  },

  // ── Right lower: Vent Control Room ──────────────────────
  {
    id: "room_8",
    name: "Vent Control Room",
    x: 15,
    y: 9,
    width: 5,
    height: 4,
    description:
      "Manual overrides for the station ventilation network. A panel reads VENT STATUS: SEALED.",
    connections: ["room_7", "room_5", "room_9"],
    entities: ["P04"],
  },

  // ── Bottom: Cargo Hold / Lower Corridor ─────────────────
  {
    id: "room_9",
    name: "Cargo Hold",
    x: 1,
    y: 13,
    width: 23,
    height: 3,
    description:
      "A long, low-ceilinged hold. Shipping containers are shoved aside; scorch marks trail east.",
    connections: ["room_6", "room_8"],
    entities: ["P_CARGO"],
  },
];

// ── Connectivity helper ─────────────────────────────────────

export interface RoomConnection {
  from: string;
  to: string;
  doorPos: Position;
  locked: boolean;
  powered: boolean;
}

/**
 * Doors and connections for the golden seed layout.
 * Only the Data Core door (D17) starts locked and unpowered.
 */
export const GOLDEN_CONNECTIONS: RoomConnection[] = [
  { from: "room_0", to: "room_1", doorPos: { x: 8, y: 2 }, locked: false, powered: true },
  { from: "room_1", to: "room_2", doorPos: { x: 14, y: 2 }, locked: true, powered: false }, // D17
  { from: "room_0", to: "room_3", doorPos: { x: 4, y: 4 }, locked: false, powered: true },
  { from: "room_1", to: "room_4", doorPos: { x: 11, y: 4 }, locked: false, powered: true },
  { from: "room_3", to: "room_4", doorPos: { x: 6, y: 6 }, locked: false, powered: true },
  { from: "room_4", to: "room_5", doorPos: { x: 18, y: 6 }, locked: false, powered: true },
  { from: "room_4", to: "room_7", doorPos: { x: 12, y: 8 }, locked: false, powered: true },
  { from: "room_3", to: "room_6", doorPos: { x: 3, y: 8 }, locked: false, powered: true },
  { from: "room_7", to: "room_8", doorPos: { x: 14, y: 10 }, locked: false, powered: true },
  { from: "room_5", to: "room_8", doorPos: { x: 20, y: 9 }, locked: false, powered: true },
  { from: "room_6", to: "room_9", doorPos: { x: 3, y: 13 }, locked: false, powered: true },
  { from: "room_8", to: "room_9", doorPos: { x: 20, y: 13 }, locked: false, powered: true },
];
