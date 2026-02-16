// ── Map defaults ─────────────────────────────────────────────
export const DEFAULT_MAP_WIDTH = 25;
export const DEFAULT_MAP_HEIGHT = 17;

// ── Golden seed ──────────────────────────────────────────────
export const GOLDEN_SEED = 184201;

// ── Hazards ──────────────────────────────────────────────────
export const HEAT_SPREAD_RATE = 5; // heat units per turn to adjacent tiles
export const SMOKE_SPREAD_RATE = 3;
export const HEAT_DAMAGE_THRESHOLD = 80;

// ── Glyphs ───────────────────────────────────────────────────
export const GLYPHS = {
  player: "@",
  floor: ".",
  wall: "#",
  door: "+",
  lockedDoor: "X",
  corridor: ".",
  relay: "R",
  sensorPickup: "S",
  dataCore: "D",
  serviceBot: "B",
  logTerminal: "T",
  heat: "~",
  smoke: "░",
} as const;
