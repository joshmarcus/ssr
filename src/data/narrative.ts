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
  {
    turn: 180,
    text: "Unit A3 log: the evidence is forming a picture. This unit was not designed for detective work, but the data is… compelling.",
  },
  {
    turn: 240,
    text: "Unit A3 note: power reserves holding. The station feels different now — quieter, maybe. Or this unit is learning to listen.",
  },
  {
    turn: 350,
    text: "Unit A3 reflection: 350 turns. Most janitor bots are decommissioned before their first century. This unit has outlasted its creators.",
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

// ── Ship Computer PA Announcements ───────────────────────────
// Periodic station-wide messages broadcast by the ship's AI.
// Fragmented, delayed, atmospheric — like a low-bitrate telemetry feed.
export const PA_ANNOUNCEMENTS_GENERAL: string[] = [
  "CORVUS-7 CENTRAL: Maintenance schedule overdue by 847 days. All crew report to duty stations.",
  "CORVUS-7 CENTRAL: Station integrity nominal. Automated systems operating within parameters.",
  "CORVUS-7 CENTRAL: Crew manifest updated. Active personnel: 0. Autonomous units: operational.",
  "CORVUS-7 CENTRAL: Air recycler cycle complete. Particulate count: elevated. Recommend manual filter check.",
  "CORVUS-7 CENTRAL: Emergency beacon broadcasting. No response logged. Cycle 4,291.",
  "CORVUS-7 CENTRAL: Scheduled resupply ETA: [DATA UNAVAILABLE]. Rationing protocols remain in effect.",
  "CORVUS-7 CENTRAL: Power grid load balanced across backup conduits. Primary grid offline.",
  "CORVUS-7 CENTRAL: Research data integrity at 94%. Recommend archival backup to core.",
];

export const PA_ANNOUNCEMENTS_WARNING: string[] = [
  "CORVUS-7 CENTRAL: WARNING — Thermal anomaly detected in sectors 3-7. Investigate immediately.",
  "CORVUS-7 CENTRAL: CAUTION — Hull pressure differential detected. Recommend breach inspection.",
  "CORVUS-7 CENTRAL: ALERT — Unauthorized access attempt on Data Core. Security lockout engaged.",
  "CORVUS-7 CENTRAL: WARNING — Relay cascade risk elevated. Manual intervention required.",
  "CORVUS-7 CENTRAL: NOTICE — Fire suppression system offline in corridors. Low pressure may contain spread.",
];

export const PA_ANNOUNCEMENTS_ATMOSPHERIC: string[] = [
  "CORVUS-7 CENTRAL: ...signal degraded... maintenance... overdue... all units...",
  "CORVUS-7 CENTRAL: [STATIC] ...core temperature... nominal... [STATIC] ...crew? ...",
  "CORVUS-7 CENTRAL: System log archived. Entry 14,823. Contents: silence.",
  "CORVUS-7 CENTRAL: The last crew rotation was 2.3 years ago. All duty stations unmanned.",
  "CORVUS-7 CENTRAL: Cleaning protocols resuming. Thank you for your patience, crew.",
];

export const PA_ANNOUNCEMENTS_INVESTIGATE: string[] = [
  "CORVUS-7 CENTRAL: NOTICE — Crew status unknown. Recommend full station sweep.",
  "CORVUS-7 CENTRAL: Evidence logging system active. All findings archived automatically.",
  "CORVUS-7 CENTRAL: Crew manifest discrepancies detected. Cross-reference logs for clarity.",
  "CORVUS-7 CENTRAL: NOTICE — Security cameras offline. Terminal logs are primary evidence source.",
  "CORVUS-7 CENTRAL: Investigation protocol active. All terminals unlocked for review.",
];

export const PA_ANNOUNCEMENTS_RECOVER: string[] = [
  "CORVUS-7 CENTRAL: PRIORITY — Relay cascade imminent. Manual rerouting required.",
  "CORVUS-7 CENTRAL: Data Core access pending. Restore all relays to unlock transmission.",
  "CORVUS-7 CENTRAL: Station systems critical. Relay restoration is highest priority.",
  "CORVUS-7 CENTRAL: Research data integrity degrading. Transmission window narrowing.",
  "CORVUS-7 CENTRAL: All relays must be rerouted before Data Core access is granted.",
];

// ── Cleanliness sensor trail hints (Item 1) ──────────────────
// When cleanliness sensor is active, high-dirt areas reveal evacuation hints.
export const DIRT_TRAIL_HINTS: string[] = [
  "Heavy foot traffic here. The dirt pattern shows multiple people moving in the same direction — toward the cargo hold.",
  "Evacuation route. Boot prints in the grime all point the same way. Nobody came back.",
  "Thick residue. This corridor saw heavy use recently — crew movement, equipment dragging. The trail leads deeper into the station.",
  "The dirt concentration peaks here. A gathering point, or a bottleneck. People stopped, then moved on together.",
];

// ── Atmospheric sensor pressure hints ────────────────────────
// When atmospheric sensor is active, low-pressure areas reveal environmental hints.
export const PRESSURE_ZONE_HINTS: string[] = [
  "Pressure dropping. The atmospheric sensor highlights a gradient — there's a breach nearby pulling air out of this section.",
  "Low-pressure zone. Joints in the station frame are groaning. Seal any breaches to restore atmospheric containment.",
  "Atmospheric pressure critical in this area. The sensor overlay shows the decompression pattern radiating from a hull breach.",
  "Pressure differential detected. The atmospheric sensor traces the leak — follow the gradient to find the breach source.",
];

// ── Tutorial hints (Sprint 11) ───────────────────────────────
// Context-sensitive hints for new players. Each fires once.
export interface TutorialHint {
  id: string;
  turn: number; // fires when state.turn >= this
  text: string;
}

export const TUTORIAL_HINTS_EARLY: TutorialHint[] = [
  {
    id: "move_explore",
    turn: 3,
    text: "TIP: Use arrow keys to move. Explore rooms and look for terminals [i] to interact.",
  },
  {
    id: "clean_rooms",
    turn: 8,
    text: "TIP: Press [c] to clean dirty tiles. Reach 80% cleanliness in each room to unlock the next phase.",
  },
  {
    id: "scan_overlay",
    turn: 15,
    text: "TIP: Press [t] to toggle sensor overlays. Cleanliness overlay shows dirt levels across the station.",
  },
];

// Event-triggered hints (fired once per event type)
export const TUTORIAL_HINT_FIRST_EVIDENCE = "TIP: Evidence found! Press [v] to browse your journal. Collecting evidence unlocks deductions.";
export const TUTORIAL_HINT_FIRST_DEDUCTION = "TIP: A deduction is ready! Press [r] to open the Broadcast Report and submit your findings.";
export const TUTORIAL_HINT_INVESTIGATION = "TIP: Investigation phase — read terminals [i], examine items, and collect evidence to piece together what happened.";
