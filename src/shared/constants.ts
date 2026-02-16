// ── Map defaults ─────────────────────────────────────────────
export const DEFAULT_MAP_WIDTH = 70;
export const DEFAULT_MAP_HEIGHT = 35;

// ── Golden seed ──────────────────────────────────────────────
export const GOLDEN_SEED = 184201;

// ── Hazards ──────────────────────────────────────────────────
export const HEAT_SPREAD_RATE = 1; // heat units per turn to adjacent tiles (reduced — exploration game, not survival)
export const SMOKE_SPREAD_RATE = 1;
export const HEAT_DECAY_RATE = 2; // heat lost per turn on non-source tiles (higher than spread = stable gradient)
export const HEAT_SOURCE_RATE = 2; // heat injected per turn at relay sources
export const HEAT_SPREAD_MIN = 20; // tiles only spread heat if they have at least this much
export const HEAT_DAMAGE_THRESHOLD = 200; // effectively disabled — use HP instead
export const PLAYER_MAX_HP = 200;
export const HEAT_DAMAGE_PER_TURN = 2; // HP lost per turn on tiles with heat >= HEAT_PAIN_THRESHOLD
export const HEAT_PAIN_THRESHOLD = 60; // heat level at which the player starts taking damage
export const COOL_RECOVERY_RATE = 3; // HP recovered per turn on cool tiles
export const HOT_ZONE_SLOW_THRESHOLD = 80; // heat level that costs extra movement

// ── Vision / fog-of-war ─────────────────────────────────────
export const VISION_RADIUS_BASE = 6;
export const VISION_RADIUS_THERMAL = 12;
export const VISION_RADIUS_ATMOSPHERIC = 10;
export const HEAT_VISIBLE_THRESHOLD = 30;
export const PRESSURE_VISIBLE_THRESHOLD = 60;

// ── Pressure / breach ───────────────────────────────────────
export const PRESSURE_NORMAL = 100;
export const PRESSURE_BREACH_DRAIN = 5; // pressure lost per turn on breach tile
export const PRESSURE_SPREAD_RATE = 2; // pressure leaks to adjacent tiles per turn
export const PRESSURE_DAMAGE_THRESHOLD = 30; // below this, bot takes damage
export const PRESSURE_DAMAGE_PER_TURN = 1; // HP lost per turn in low-pressure zone

// ── PA system ───────────────────────────────────────────────
export const PA_INTERVAL = 15; // turns between PA announcements

// ── Glyphs ───────────────────────────────────────────────────
export const GLYPHS = {
  player: "☉",    // your bot — a circled dot
  floor: "·",     // middle dot — subtle floor
  wall: "█",      // full block — solid wall
  door: "▯",      // open rectangle — doorway
  lockedDoor: "▮", // filled rectangle — sealed door
  corridor: "·",
  relay: "⚡",     // lightning — power relay
  sensorPickup: "◈", // diamond with dot — sensor upgrade
  dataCore: "◆",  // filled diamond — the objective
  serviceBot: "♦", // diamond — dormant bot
  logTerminal: "▣", // filled square — data terminal
  crewItem: "✦",  // four-pointed star — crew belonging
  heat: "≈",      // wavy lines — heat shimmer
  smoke: "░",     // light shade — smoke/haze
  drone: "○",     // circle — roaming drone
  medKit: "✚",    // cross — med kit
  repairBot: "◎",  // circled ring — repair bot
  breach: "⊘",    // circle with slash — hull breach
  closedDoor: "▯", // same as door but non-walkable
  securityTerminal: "◫", // security camera terminal
} as const;
