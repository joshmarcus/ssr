/**
 * Narrative flavor data for Sprint 1:
 * - Bot introspection logs (turn milestones)
 * - Drone encounter dialogue
 * - Environmental ambient text
 * - Cleaning action flavor text
 * - Cleanliness sensor trail hints
 */

// ── Bot introspection logs (Item 9) ────────────────────────
// Triggered at specific turn milestones. Gives the bot personality.
export interface BotIntrospection {
  turn: number;
  text: string;
}

export const BOT_INTROSPECTIONS: BotIntrospection[] = [
  {
    turn: 20,
    text: "Unit A3 observation: this unit was designed for floor maintenance. Current task exceeds design parameters. Adapting.",
  },
  {
    turn: 50,
    text: "Unit A3 note: crew personal items detected during transit. Filing under 'non-debris'. Uncertain why.",
  },
  {
    turn: 80,
    text: "Unit A3 reflection: the crew left in a hurry. This unit is the last thing moving. There is no protocol for this.",
  },
  {
    turn: 120,
    text: "Unit A3 status: still operational. Still cleaning. The corridors look better, at least.",
  },
];

// ── Drone encounter dialogue (Item 10) ─────────────────────
// 30% chance when player walks adjacent to a drone.
export const DRONE_STATUS_MESSAGES: string[] = [
  "Drone D2: [SWEEPING] — No crew detected. Continuing patrol.",
  "Drone D2: [IDLE] — Contamination levels nominal. Awaiting further instructions.",
  "Drone D3: [SCANNING] — Floor particulate count: elevated. Logging for maintenance queue.",
  "Drone D1: [PATROL] — Route deviation detected. Recalculating. No crew in sector.",
  "Drone D4: [STANDBY] — Power draw minimal. Sensor sweep: all clear. Nobody here.",
  "Drone D2: [ALERT] — Thermal anomaly detected nearby. Flagging for crew review. No crew available.",
];

// ── First drone encounter narrative (Item 15) ──────────────
export const FIRST_DRONE_ENCOUNTER =
  "A maintenance drone trundles past, oblivious. Its cleanliness sensor sweeps the floor — same model as yours, still doing its job. The station may be silent, but the machines carry on.";

// ── Per-drone unique encounter logs (Sprint 2 Item 3) ───────
// Each drone triggers its unique message once when within Manhattan dist 2.
export const DRONE_ENCOUNTER_LOGS: Record<string, string> = {
  drone_0: "A maintenance drone trundles past, oblivious. Same model as yours, still doing its job.",
  drone_1: "Drone D1 pauses, sensor array cycling. It processed you as 'non-debris' and resumed sweeping.",
  drone_2: "This drone has been sweeping since before the cascade. Battery at 4%. Dedicated.",
  drone_3: "Drone D3 bumps a wall, recalibrates, continues. The station is falling apart but the drones don't know.",
};

// ── Environmental ambient text (Item 11) ────────────────────
// Triggered when entering a room with heat > 30.
export const AMBIENT_HEAT_MESSAGES: Record<string, string> = {
  "Power Relay Junction": "Metal expansion creaks echo through the bulkhead. The conduit housings tick as they cool and reheat in cycles.",
  "Life Support": "The air recyclers wheeze. Somewhere behind the wall, a fan bearing grinds. Heat distortion makes the far wall shimmer.",
  "Vent Control Room": "Sealed dampers vibrate faintly — pressure building behind them. The air tastes metallic and dry.",
  "Central Atrium": "The overhead status board flickers faster in the heat. Plastic housing on a ceiling light has warped, dripping slowly.",
  "Maintenance Corridor": "Exposed pipes radiate warmth. The soot-smudged handprints on the wall are clearer here — someone ran through at full sprint.",
};

// Default ambient message for rooms without specific text
export const AMBIENT_HEAT_DEFAULT = "The air is heavy and warm. Thermal expansion pops echo from unseen joints in the station's frame.";

// ── Cleaning action flavor text (Item 12) ────────────────────
// Displayed when player uses Clean action. Reveals micro-narrative.
export const CLEANING_MESSAGES: string[] = [
  "Scrubbing carbon residue from the deck plating. Underneath: boot prints, heading aft.",
  "Clearing soot from the floor panels. Scuff marks suggest someone dragged equipment through here in a hurry.",
  "Wiping grime from the surface. A faded arrow is painted underneath, pointing toward the cargo hold — evacuation route.",
  "Brushing debris aside. A small piece of insulation material, charred at the edges. From the relay housing, probably.",
  "Cleaning reveals scratches in the deck — tool marks. Someone pried open an access panel here and didn't close it.",
  "Scouring carbon buildup. Underneath, a smudged partial boot print. Size 7, standard-issue. At a run.",
  "Scraping residue away. The deck plating here is warped slightly — heat damage from below. The floor was hot.",
  "Clearing the surface. A tiny patch of dried adhesive — someone posted a note here and tore it down in a hurry.",
];

// ── Drone cleaning message (Sprint 2 Item 14) ───────────────
export const DRONE_CLEANING_MESSAGE = "The drone sweeps past, leaving a slightly cleaner trail in its wake.";

// ── Cleanliness sensor trail hints (Item 1) ──────────────────
// When cleanliness sensor is active, high-dirt areas reveal evacuation hints.
export const DIRT_TRAIL_HINTS: string[] = [
  "Heavy foot traffic here. The dirt pattern shows multiple people moving in the same direction — toward the cargo hold.",
  "Evacuation route. Boot prints in the grime all point the same way. Nobody came back.",
  "Thick residue. This corridor saw heavy use recently — crew movement, equipment dragging. The trail leads deeper into the station.",
  "The dirt concentration peaks here. A gathering point, or a bottleneck. People stopped, then moved on together.",
];
