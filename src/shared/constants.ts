// ── Map defaults ─────────────────────────────────────────────
export const DEFAULT_MAP_WIDTH = 70;
export const DEFAULT_MAP_HEIGHT = 35;

// ── Golden seed ──────────────────────────────────────────────
export const GOLDEN_SEED = 184201;

// ── Hazards ──────────────────────────────────────────────────
export const HEAT_SPREAD_RATE = 3; // heat units per turn to adjacent tiles
export const SMOKE_SPREAD_RATE = 2;
export const HEAT_DECAY_RATE = 1; // heat lost per turn on non-source tiles (lower than spread = zones grow)
export const HEAT_SOURCE_RATE = 5; // heat injected per turn at relay sources
export const HEAT_SOURCE_CAP = 95; // max heat at source tiles
export const HEAT_SPREAD_MIN = 15; // tiles spread heat if they have at least this much
export const HEAT_DAMAGE_THRESHOLD = 200; // legacy — unused
export const PLAYER_MAX_HP = 100;
export const HEAT_DAMAGE_PER_TURN = 3; // base HP lost per turn on tiles with heat >= HEAT_PAIN_THRESHOLD
export const HEAT_PAIN_THRESHOLD = 40; // heat level at which the player starts taking damage
export const COOL_RECOVERY_RATE = 0; // no passive recovery — use Bot Maintenance room
export const HOT_ZONE_SLOW_THRESHOLD = 60; // heat level that costs extra movement

// ── Station deterioration ────────────────────────────────────
export const DETERIORATION_INTERVAL = 12; // turns between station deterioration events
export const DETERIORATION_HEAT_BOOST = 3; // extra heat added to source tiles each deterioration tick
export const DETERIORATION_SMOKE_SPAWN = 15; // smoke added to random corridor tiles

// ── Vision / fog-of-war ─────────────────────────────────────
export const VISION_RADIUS_BASE = 6;
export const VISION_RADIUS_THERMAL = 12;
export const VISION_RADIUS_ATMOSPHERIC = 10;
export const HEAT_VISIBLE_THRESHOLD = 30;
export const PRESSURE_VISIBLE_THRESHOLD = 60;

// ── Pressure / breach ───────────────────────────────────────
export const PRESSURE_NORMAL = 100;
export const PRESSURE_BREACH_DRAIN = 8; // pressure lost per turn on breach tile
export const PRESSURE_SPREAD_RATE = 3; // pressure leaks to adjacent tiles per turn
export const PRESSURE_DAMAGE_THRESHOLD = 40; // below this, bot takes damage
export const PRESSURE_DAMAGE_PER_TURN = 3; // HP lost per turn in low-pressure zone
export const PRESSURE_BULKHEAD_THRESHOLD = 25; // below this, adjacent doors auto-seal

// ── Patrol drone ─────────────────────────────────────────────
export const PATROL_DRONE_DAMAGE = 5; // HP lost on contact with hostile patrol drone
export const PATROL_DRONE_STUN_TURNS = 0; // turns player is stunned after drone contact (0 = no stun)
export const PATROL_DRONE_SPEED = 3; // drone moves every N turns
export const PATROL_DRONE_ATTACK_COOLDOWN = 4; // turns between attacks (drone retreats after hitting)

// ── Radiation ───────────────────────────────────────────────
export const RADIATION_SPREAD_RATE = 0.5; // very slow spread
export const RADIATION_SPREAD_RANGE = 2; // spread distance
export const RADIATION_DAMAGE_THRESHOLD = 70; // need high radiation to hurt
export const RADIATION_DAMAGE_PER_TURN = 2; // mild damage with sensor
export const RADIATION_DAMAGE_NO_SENSOR = 3; // slightly worse without sensor
export const RADIATION_SOURCE_RATE = 2; // slower buildup
export const RADIATION_SOURCE_CAP = 85;
export const RADIATION_DECAY_RATE = 0.5; // moderate decay away from source
export const SHIELD_GENERATOR_RADIUS = 5;

// ── Structural stress ──────────────────────────────────────
export const STRESS_COLLAPSE_THRESHOLD = 80;
export const STRESS_COLLAPSE_TURNS = 3; // turns above threshold before collapse
export const STRESS_SPREAD_RATE = 1;

// ── Vision radii for new sensors ───────────────────────────
export const VISION_RADIUS_RADIATION = 8;
export const VISION_RADIUS_STRUCTURAL = 8;
export const VISION_RADIUS_EM = 10;

// ── Station Integrity ───────────────────────────────────────
export const STATION_INTEGRITY_MAX = 100;
export const STATION_INTEGRITY_DECAY_RATE = 0.3; // per turn base decay
export const STATION_INTEGRITY_RELAY_BONUS = 10; // restored per relay rerouted
export const STATION_INTEGRITY_BREACH_PENALTY = 0.5; // extra decay per unsealed breach
export const STATION_INTEGRITY_CRITICAL = 25; // below this, hazards accelerate
export const STATION_INTEGRITY_LOSS = 0; // game over if integrity reaches 0

// ── PA system ───────────────────────────────────────────────
export const PA_INTERVAL = 15; // turns between PA announcements

// ── Glyphs ───────────────────────────────────────────────────
export const GLYPHS = {
  player: "🖲",    // trackball — your bot
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
  patrolDrone: "⊕", // circled plus — hostile patrol drone
  pressureValve: "◉", // filled circle — pressure valve
  fuseBox: "▦",  // grid — fuse box / junction
  powerCell: "⬡", // hexagon — power cell
  evidenceTrace: "※", // reference mark — evidence trace
  radiationSource: "☢", // radioactive — radiation source
  shieldGenerator: "⊛", // circled star — shield generator
  reinforcementPanel: "▧", // hatched — reinforcement panel
  signalBooster: "⊡", // squared dot — signal booster
  hiddenDevice: "◇", // diamond outline — hidden device (EM sensor only)
  escapePod: "⬡",    // hexagon — escape pod
  crewNPC: "☺",      // smiley face — living crew member
  repairCradle: "⚕",  // medical — bot repair station
} as const;
