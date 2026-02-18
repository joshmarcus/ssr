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
  PatrolDrone = "patrol_drone",
  PressureValve = "pressure_valve",
  FuseBox = "fuse_box",
  PowerCell = "power_cell",
  EvidenceTrace = "evidence_trace",
  EscapePod = "escape_pod",
  CrewNPC = "crew_npc",
  RepairCradle = "repair_cradle",
  Console = "console",
  Airlock = "airlock",
}

export interface Entity {
  id: EntityId;
  type: EntityType;
  pos: Position;
  props: Record<string, unknown>;
}

// ── Door keying ─────────────────────────────────────────────
export enum DoorKeyType {
  Power = "power",                 // existing: relay reroute opens it
  Clearance = "clearance",         // deduction reward opens it
  Physical = "physical",           // tool/interaction opens it (existing ClosedDoor)
  Environmental = "environmental", // blocked by hazard — clear the hazard to pass
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
  sensors: SensorType[]; // all collected sensors (starts with [Cleanliness])
  alive: boolean;
  hp: number;
  maxHp: number;
  stunTurns: number; // turns remaining where player cannot act
  clearanceLevel: number; // security clearance from solving deductions
}

// ── Actions ──────────────────────────────────────────────────
export enum ActionType {
  Move = "move",
  Interact = "interact",
  Scan = "scan",
  Clean = "clean",
  Wait = "wait",
  Look = "look",
  Journal = "journal",
  SubmitDeduction = "submitDeduction",
}

export enum Direction {
  North = "north",
  South = "south",
  East = "east",
  West = "west",
  NorthEast = "northeast",
  NorthWest = "northwest",
  SouthEast = "southeast",
  SouthWest = "southwest",
}

export interface Action {
  type: ActionType;
  direction?: Direction;
  targetId?: EntityId;
  deductionId?: string;
  answerKey?: string;
}

// ── Room metadata ────────────────────────────────────────────
export interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zone?: string;
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
  mystery?: MysteryState;
}

// ── Logs / evidence ──────────────────────────────────────────
export interface LogEntry {
  id: string;
  timestamp: number; // in-game turn discovered
  source: string;
  text: string;
  read: boolean;
}

// ── Mystery / Crew ──────────────────────────────────────────
export enum CrewRole {
  Captain = "captain",
  Engineer = "engineer",
  Medic = "medic",
  Security = "security",
  Scientist = "scientist",
  Robotics = "robotics",
  LifeSupport = "life_support",
  Comms = "comms",
}

export enum PersonalityTrait {
  Cautious = "cautious",
  Ambitious = "ambitious",
  Loyal = "loyal",
  Secretive = "secretive",
  Pragmatic = "pragmatic",
}

export enum CrewSecret {
  Smuggling = "smuggling",
  FalseIdentity = "false_identity",
  Sabotage = "sabotage",
  Whistleblower = "whistleblower",
}

export enum CrewFate {
  Survived = "survived",
  Missing = "missing",
  Dead = "dead",
  Escaped = "escaped",
  InCryo = "in_cryo",
}

export interface Relationship {
  targetId: string;
  type: "ally" | "rival" | "romantic" | "blackmail";
}

export interface CrewMember {
  id: string;
  firstName: string;
  lastName: string;
  role: CrewRole;
  badgeId: string;
  personality: PersonalityTrait;
  relationships: Relationship[];
  secret?: CrewSecret;
  fate: CrewFate;
  lastKnownRoom: string;
}

export enum IncidentArchetype {
  CoolantCascade = "coolant_cascade",
  HullBreach = "hull_breach",
  ReactorScram = "reactor_scram",
  Sabotage = "sabotage",
  SignalAnomaly = "signal_anomaly",
  ContainmentBreach = "containment_breach",
}

export enum TimelinePhase {
  NormalOps = "normal_ops",
  Trigger = "trigger",
  Escalation = "escalation",
  Collapse = "collapse",
  Aftermath = "aftermath",
}

export interface TimelineEvent {
  phase: TimelinePhase;
  timestamp: string;
  actorId: string;
  action: string;
  location: string;
  logText?: string;
}

export interface IncidentTimeline {
  archetype: IncidentArchetype;
  events: TimelineEvent[];
  culpritId?: string;
  primaryHazard: string;
  sensorBias: SensorType;
}

export enum DeductionCategory {
  What = "what",    // What happened?
  Why = "why",      // Why did it happen?
  Who = "who",      // Who is responsible/involved?
}

export interface Deduction {
  id: string;
  category: DeductionCategory;
  question: string;
  options: { label: string; key: string; correct: boolean }[];
  requiredTags: string[];      // tags that linked evidence must collectively cover
  unlockAfter?: string;        // deduction ID that must be solved first (chain)
  linkedEvidence: string[];    // journal entry IDs the player has linked
  solved: boolean;
  answeredCorrectly?: boolean;
  rewardType: "clearance" | "room_reveal" | "drone_disable" | "sensor_hint";
  rewardDescription: string;
  hintText?: string;           // archetype-specific hint shown in CONNECTIONS section
}

export interface MysteryChoice {
  id: string;
  prompt: string;
  options: { label: string; key: string }[];
  chosen?: string;
  turnPresented: number;
  consequence: string; // which ending aspect this affects
}

export interface JournalEntry {
  id: string;
  turnDiscovered: number;
  category: "log" | "item" | "trace" | "access" | "crew";
  summary: string;        // short one-line summary for the journal list
  detail: string;         // full text when expanded
  crewMentioned: string[]; // crew IDs referenced — for cross-referencing
  roomFound: string;
  tags: string[];         // evidence tags for clue-linking (system, crew, timeline, location)
  thread?: string;        // narrative thread name (e.g. "The Warning Signs")
}

export enum ObjectivePhase {
  Clean = "clean",           // primary directive: clean rooms
  Investigate = "investigate", // subgoal: investigate what happened
  Recover = "recover",        // investigation overrides cleaning
  Evacuate = "evacuate",      // rescue surviving crew
}

export interface EvacuationState {
  active: boolean;           // true once Recover phase + crew found
  crewFound: string[];       // crew IDs that have been discovered
  crewEvacuated: string[];   // crew IDs that reached pods
  crewDead: string[];        // crew IDs killed by hazards during evac
  podsPowered: string[];     // pod entity IDs that are powered
  evacuationStartTurn: number;
}

export interface NarrativeThread {
  name: string;           // e.g. "The Warning Signs"
  description: string;    // brief summary of this thread
  entries: string[];      // journal entry IDs belonging to this thread
}

export interface MysteryState {
  crew: CrewMember[];
  timeline: IncidentTimeline;
  generatedLogs: { terminalId: string; title: string; text: string; source: string }[];
  discoveredEvidence: Set<string>;
  choices: MysteryChoice[];
  pendingChoice?: MysteryChoice;
  journal: JournalEntry[];
  deductions: Deduction[];
  threads: NarrativeThread[];
  objectivePhase: ObjectivePhase;
  roomsCleanedCount: number; // rooms cleaned to goal threshold
  investigationTrigger: number; // rooms to clean before investigation subgoal appears
  evidenceThreshold: number; // how many journal entries to unlock recovery phase
  cleaningDirective: boolean; // true until overridden by investigation
  roomCleanlinessGoal: number; // percentage (default 80)
  directiveOverrideTurn?: number; // turn when directive was overridden
  evacuation?: EvacuationState;
}

// ── What We Know (narrative summary) ─────────────────────────
export interface WhatWeKnow {
  paragraphs: string[];
  confidence: "none" | "low" | "medium" | "high" | "complete";
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
