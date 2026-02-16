// ── Coordinates ──────────────────────────────────────────────
export interface Position {
  x: number;
  y: number;
}

// ── Tiles ────────────────────────────────────────────────────
export enum TileType {
  Floor = "floor",
  Wall = "wall",
  Door = "door",
  LockedDoor = "locked_door",
  Corridor = "corridor",
}

export interface Tile {
  type: TileType;
  glyph: string;
  walkable: boolean;
  heat: number; // 0-100 thermal value
  smoke: number; // 0-100 smoke density
  dirt: number; // 0-100 cleanliness value (crew activity traces)
  pressure: number; // 0-100 atmospheric pressure (100 = normal, 0 = vacuum)
  explored: boolean; // true if tile has ever been visible
  visible: boolean; // true if tile is currently visible
}

// ── Entities ─────────────────────────────────────────────────
export type EntityId = string;

export enum EntityType {
  PlayerBot = "player_bot",
  Relay = "relay",
  SensorPickup = "sensor_pickup",
  DataCore = "data_core",
  ServiceBot = "service_bot",
  LogTerminal = "log_terminal",
  CrewItem = "crew_item",
  Drone = "drone",
  MedKit = "med_kit",
  RepairBot = "repair_bot",
  Breach = "breach",
  ClosedDoor = "closed_door",
  SecurityTerminal = "security_terminal",
}

export interface Entity {
  id: EntityId;
  type: EntityType;
  pos: Position;
  props: Record<string, unknown>;
}

// ── Attachments ──────────────────────────────────────────────
export enum AttachmentSlot {
  Tool = "tool",
  Sensor = "sensor",
  Utility = "utility",
}

export enum SensorType {
  Cleanliness = "cleanliness",
  Thermal = "thermal",
  Atmospheric = "atmospheric",
  Radiation = "radiation",
  Structural = "structural",
  EMSignal = "em_signal",
}

export interface Attachment {
  slot: AttachmentSlot;
  name: string;
  sensorType?: SensorType;
}

// ── Player bot ───────────────────────────────────────────────
export interface PlayerBot {
  entity: Entity;
  attachments: Partial<Record<AttachmentSlot, Attachment>>;
  alive: boolean;
  hp: number;
  maxHp: number;
}

// ── Actions ──────────────────────────────────────────────────
export enum ActionType {
  Move = "move",
  Interact = "interact",
  Scan = "scan",
  Clean = "clean",
  Wait = "wait",
  Look = "look",
}

export enum Direction {
  North = "north",
  South = "south",
  East = "east",
  West = "west",
}

export interface Action {
  type: ActionType;
  direction?: Direction;
  targetId?: EntityId;
}

// ── Room metadata ────────────────────────────────────────────
export interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// ── Game state ───────────────────────────────────────────────
export interface GameState {
  seed: number;
  turn: number;
  width: number;
  height: number;
  tiles: Tile[][];
  entities: Map<EntityId, Entity>;
  player: PlayerBot;
  rooms: Room[];
  logs: LogEntry[];
  gameOver: boolean;
  victory: boolean;
}

// ── Logs / evidence ──────────────────────────────────────────
export interface LogEntry {
  id: string;
  timestamp: number; // in-game turn discovered
  source: string;
  text: string;
  read: boolean;
}

// ── Observation (harness) ────────────────────────────────────
export interface Observation {
  turn: number;
  playerPos: Position;
  visibleTiles: { pos: Position; tile: Tile }[];
  nearbyEntities: Entity[];
  availableActions: ActionType[];
  gameOver: boolean;
  victory: boolean;
}
