// ── Harness types for AI playtesting ────────────────────────

/**
 * Structured observation of game state, designed for LLM consumption.
 * Rendered from GameState via buildObservation().
 */
export interface HarnessObservation {
  turn: number;
  seed: number;
  gameOver: boolean;
  victory: boolean;
  hp: number;
  maxHp: number;
  pos: { x: number; y: number };
  currentRoom: string;
  roomExits: string[];        // compass directions of exits from current room
  sensors: string[];          // equipped sensor names
  activeSensor: string | null;
  objectivePhase: string;     // Clean, Investigate, Recover, Evacuate
  objectiveText: string;      // human-readable objective description
  objectiveDetail: string;    // detailed instructions for current objective
  stunTurns: number;          // turns remaining stunned (0 = not stunned)
  discoveries: string;        // "discovered/total" progress string
  mapText: string;            // ASCII map centered on player
  poi: PoiEntry[];            // visible entities with IDs and attributes
  validActions: ValidAction[];
  recentLogs: string[];       // last 10 log messages
  alerts: string[];           // urgent warnings

  // Deduction support
  journalEntries: { id: string; category: string; summary: string; tags: string[] }[];
  deductions: {
    id: string;
    category: string;
    question: string;
    options: { key: string; label: string }[];
    solved: boolean;
    answeredCorrectly?: boolean;
    requiredTags: string[];
    missingTags: string[];
  }[];
  deductionProgress: { total: number; answered: number; correct: number };
  transmissionReady: boolean;
}

/**
 * A point of interest — a visible entity near the player.
 */
export interface PoiEntry {
  id: string;
  type: string;
  name: string;
  pos: { x: number; y: number };
  distance: number;           // manhattan distance from player
  interactable: boolean;      // adjacent and not exhausted
  attrs: Record<string, unknown>;
}

/**
 * A single valid action the agent can take this turn.
 */
export interface ValidAction {
  type: string;               // MOVE, INTERACT, SCAN, CLEAN, WAIT
  params?: Record<string, unknown>;  // e.g., { dir: "N" } or { target: "relay_01" }
  description: string;        // human-readable description
}

/**
 * An action submitted by the agent / LLM.
 */
export interface HarnessAction {
  action: string;             // MOVE, INTERACT, SCAN, CLEAN, WAIT
  params?: Record<string, unknown>;
}
