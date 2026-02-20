// ── Map defaults ─────────────────────────────────────────────
export const DEFAULT_MAP_WIDTH = 70;
export const DEFAULT_MAP_HEIGHT = 35;

// ── Viewport (scrolling window) ─────────────────────────────
export const VIEWPORT_WIDTH = 40;
export const VIEWPORT_HEIGHT = 25;

// ── Golden seed ──────────────────────────────────────────────
export const GOLDEN_SEED = 184201;

// ── Hazards ──────────────────────────────────────────────────
export const HEAT_SPREAD_RATE = 2; // heat units per turn to adjacent tiles (was 3 — slowed)
export const SMOKE_SPREAD_RATE = 1; // smoke spread per turn (was 2 — slowed)
export const HEAT_DECAY_RATE = 2; // heat lost per turn on non-source tiles (matches spread = zones stabilize)
export const HEAT_SOURCE_RATE = 3; // heat injected per turn at relay sources (was 5 — slowed)
export const HEAT_SOURCE_CAP = 85; // max heat at source tiles (was 95 — capped lower)
export const HEAT_SPREAD_MIN = 20; // tiles spread heat if they have at least this much (was 15 — higher threshold)
export const HEAT_DAMAGE_THRESHOLD = 200; // legacy — unused
export const PLAYER_MAX_HP = 1000;
export const HEAT_DAMAGE_PER_TURN = 8; // base HP lost per turn on tiles with heat >= HEAT_PAIN_THRESHOLD
export const HEAT_PAIN_THRESHOLD = 40; // heat level at which the player starts taking damage
export const COOL_RECOVERY_RATE = 0; // no passive recovery — use Bot Maintenance room
export const HOT_ZONE_SLOW_THRESHOLD = 60; // heat level that costs extra movement

// ── Station deterioration ────────────────────────────────────
export const DETERIORATION_INTERVAL = 25; // turns between station deterioration events
export const DETERIORATION_HEAT_BOOST = 2; // extra heat added to source tiles each deterioration tick
export const DETERIORATION_SMOKE_SPAWN = 8; // smoke added to random corridor tiles

// ── Vision / fog-of-war ─────────────────────────────────────
export const VISION_RADIUS_BASE = 6;
export const VISION_RADIUS_THERMAL = 12;
export const VISION_RADIUS_ATMOSPHERIC = 10;
export const HEAT_VISIBLE_THRESHOLD = 30;
export const PRESSURE_VISIBLE_THRESHOLD = 60;

// ── Pressure / breach ───────────────────────────────────────
export const PRESSURE_NORMAL = 100;
export const PRESSURE_BREACH_DRAIN = 4; // pressure lost per turn on breach tile
export const PRESSURE_SPREAD_RATE = 1; // pressure leaks to adjacent tiles per turn
export const PRESSURE_DAMAGE_THRESHOLD = 40; // below this, bot takes damage
export const PRESSURE_DAMAGE_PER_TURN = 8; // HP lost per turn in low-pressure zone
export const PRESSURE_BULKHEAD_THRESHOLD = 10; // below this, adjacent doors auto-seal
export const AIRLOCK_PRESSURE_DRAIN = 8; // pressure drained per turn at open airlock tile

// ── Patrol drone ─────────────────────────────────────────────
export const PATROL_DRONE_DAMAGE = 15; // HP lost on contact with hostile patrol drone
export const PATROL_DRONE_STUN_TURNS = 0; // turns player is stunned after drone contact (0 = no stun)
export const PATROL_DRONE_SPEED = 3; // drone moves every N turns
export const PATROL_DRONE_ATTACK_COOLDOWN = 4; // turns between attacks (drone retreats after hitting)

// ── PA system ───────────────────────────────────────────────
export const PA_INTERVAL = 15; // turns between PA announcements

// ── Glyphs ───────────────────────────────────────────────────
export const GLYPHS = {
  player: "@",     // classic roguelike player
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
  crewItem: "🗃",  // card file box — crew belonging
  heat: "≈",      // wavy lines — heat shimmer
  smoke: "░",     // light shade — smoke/haze
  drone: "○",     // circle — roaming drone
  medKit: "✚",    // cross — med kit
  repairBot: "◎",  // circled ring — repair bot
  breach: "💨",    // wind — hull breach
  closedDoor: "▯", // same as door but non-walkable
  securityTerminal: "◫", // security camera terminal
  patrolDrone: "🛸", // UFO — patrol drone
  pressureValve: "◉", // filled circle — pressure valve
  fuseBox: "▦",  // grid — fuse box / junction
  powerCell: "⬡", // hexagon — power cell
  evidenceTrace: "👣", // footprints — evidence trace
  escapePod: "⬡",    // hexagon — escape pod
  crewNPC: "🙋",      // person raising hand — living crew member
  repairCradle: "⚕️",  // medical — bot repair station
  console: "▣",       // terminal — interactable console
  airlock: "⊟",       // airlock hatch
} as const;
