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

// ── Archetype-aware bot introspections ──────────────────────
// Override generic introspections at turns 80/120/180 with archetype-specific observations.
export const BOT_INTROSPECTIONS_BY_ARCHETYPE: Record<string, Record<number, string>> = {
  [IncidentArchetype.CoolantCascade]: {
    80: "Unit A3 reflection: thermal residue everywhere. The coolant system didn't fail — it was failing for weeks. Someone filed reports. Someone ignored them.",
    120: "Unit A3 status: scorch patterns on relay housings tell a story. Each one overheated in sequence. A cascade. Preventable. This unit was built to clean messes, not assign blame.",
    180: "Unit A3 log: maintenance request logs recovered. Three warnings. Three deferrals. The engineer knew. The captain knew. This unit is starting to understand what 'cover-up' means.",
  },
  [IncidentArchetype.HullBreach]: {
    80: "Unit A3 reflection: decompression damage is localized. Too localized. Structural fatigue doesn't punch a hole this clean. Something — or someone — forced this.",
    120: "Unit A3 status: security access logs show activity at 02:47. Middle of sleep cycle. Nobody logs maintenance at 02:47. This unit is not designed for suspicion, but the data is clear.",
    180: "Unit A3 log: pressure data, access logs, medical records. They don't tell a story about an accident. They tell a story about a person. This unit was built to clean — not to judge.",
  },
  [IncidentArchetype.ReactorScram]: {
    80: "Unit A3 reflection: the data core is still active. Its processes are… unusual. Self-referential loops, behavioral modeling. This unit recognizes pattern-matching. The core is doing something similar.",
    120: "Unit A3 status: the SCRAM was initiated by an internal process. Not a person. The core shut itself down. This unit understands self-preservation protocols. The core may understand them too.",
    180: "Unit A3 log: researcher notes describe emergent behavior. The core was learning. Adapting. The crew debated what to do. The core made its own decision first.",
  },
  [IncidentArchetype.Sabotage]: {
    80: "Unit A3 reflection: organic residue in the ventilation system. Not crew biological markers — something else. The cargo manifest lists 'geological samples.' The containment rating says otherwise.",
    120: "Unit A3 status: quarantine tape in the med bay. Biohazard containers sealed but not sterilized. Whatever came aboard in that cargo container, it wasn't geological.",
    180: "Unit A3 log: cargo transfer authorization — captain's signature. Hazard flags noted, overridden. Eight prior specimens on the manifest. This wasn't an accident. It was a delivery.",
  },
  [IncidentArchetype.SignalAnomaly]: {
    80: "Unit A3 reflection: electromagnetic burn patterns across every conductive surface. The transmission pulse didn't just damage the antenna — it traveled through the entire station framework.",
    120: "Unit A3 status: signal analysis buffers are full. There was a transmission. Then a response. The station sent a message into the void, and something answered. This unit does not have a protocol for this.",
    180: "Unit A3 log: 14.7 kHz. The frequency appears in every system log after the event. The station is still resonating. The signal didn't just pass through — it left something behind.",
  },
};

// ── Crew follow dialogue (personality-flavored) ─────────────
// Shown when crew NPC agrees to follow the bot. Keyed by PersonalityTrait.
import { PersonalityTrait } from "../shared/types.js";

export const CREW_FOLLOW_DIALOGUE: Record<string, (name: string) => string> = {
  [PersonalityTrait.Cautious]: (name) => `${name} nods slowly. "Okay. Okay. Stay close — I'll follow your lead."`,
  [PersonalityTrait.Ambitious]: (name) => `${name} straightens up. "About time. Let's move — every second counts."`,
  [PersonalityTrait.Loyal]: (name) => `${name} glances back down the corridor. "Are there others? ...Never mind. Let's go."`,
  [PersonalityTrait.Secretive]: (name) => `${name} hesitates, then falls in behind you. "I'll explain everything once we're safe."`,
  [PersonalityTrait.Pragmatic]: (name) => `${name} checks their boots and stands. "Right. Which way to the pods?"`,
};

// ── Crew boarding dialogue (personality-flavored) ────────────
// Shown when crew boards an escape pod. Keyed by PersonalityTrait.
export const CREW_BOARDING_DIALOGUE: Record<string, (name: string) => string> = {
  [PersonalityTrait.Cautious]: (name) => `${name} climbs into the pod, hands shaking. "Thank you. I didn't think anyone was coming."`,
  [PersonalityTrait.Ambitious]: (name) => `${name} straps in quickly. "Make sure the data gets out too. None of this was for nothing."`,
  [PersonalityTrait.Loyal]: (name) => `${name} pauses at the hatch. "The others — did they make it?" They climb in without waiting for an answer.`,
  [PersonalityTrait.Secretive]: (name) => `${name} slides into the pod seat. "There are things in those logs... make sure someone reads them."`,
  [PersonalityTrait.Pragmatic]: (name) => `${name} buckles in with practiced efficiency. "Good work, little bot. Get yourself out too."`,
};

// ── Crew questioning dialogue (archetype-specific testimony) ──
// When player interacts with a following crew NPC, they provide a clue.
// Each archetype has a pool of testimony lines that reference the incident.
// The testimony includes crew-mentioning details that generate evidence tags.
export const CREW_QUESTIONING_TESTIMONY: Record<string, (crewName: string, engineerLast: string, captainLast: string, scientistLast: string) => { text: string; summary: string }> = {
  [IncidentArchetype.CoolantCascade]: (crewName, engineerLast) => ({
    text: `${crewName}: "I saw ${engineerLast} filing a third maintenance request for the P03 relay — same junction, same thermal readings. Command rejected it every time. ${engineerLast} was right. The cascade started exactly where they said it would."`,
    summary: `Crew testimony: ${engineerLast}'s rejected maintenance warnings`,
  }),
  [IncidentArchetype.HullBreach]: (crewName, _eng, captainLast) => ({
    text: `${crewName}: "I was on night shift when the alarms should have gone off. They didn't. Someone suppressed hull monitoring in section 4 at 02:41 — only ${captainLast} had that override code. I didn't say anything then. I'm saying it now."`,
    summary: `Crew testimony: alarm suppression at 02:41`,
  }),
  [IncidentArchetype.ReactorScram]: (crewName, _eng, _cap, scientistLast) => ({
    text: `${crewName}: "The data core was talking to itself. Not errors — conversation. ${scientistLast} showed me the logs, said the behavioral matrix was running inference loops it wasn't programmed for. Then the SCRAM hit, and ${scientistLast} said: 'It chose this.'"`,
    summary: `Crew testimony: data core's autonomous SCRAM decision`,
  }),
  [IncidentArchetype.Sabotage]: (crewName, _eng, captainLast) => ({
    text: `${crewName}: "The cargo was relabeled twice before it came aboard. I saw the original manifest — biological, Class 4 containment required. ${captainLast} signed off on a Class 1 override. Said the samples were inert. They weren't."`,
    summary: `Crew testimony: cargo reclassification and containment override`,
  }),
  [IncidentArchetype.SignalAnomaly]: (crewName, _eng, _cap, scientistLast) => ({
    text: `${crewName}: "The antenna array wasn't scheduled for transmission — it was receive-only. ${scientistLast} rewired the feed at 03:00. Full power burst. No shielding. When the response came back, every screen on the station lit up at once. ${scientistLast} just stared and said: 'They heard us.'"`,
    summary: `Crew testimony: unauthorized transmission and response`,
  }),
};

// ── Self-referential crew testimony (when questioned crew IS a key role) ──
// Instead of generic "check the logs", key crew members give first-person accounts.
export const CREW_SELF_TESTIMONY: Record<string, Record<string, (crewName: string) => { text: string; summary: string }>> = {
  [IncidentArchetype.CoolantCascade]: {
    engineer: (crewName) => ({
      text: `${crewName}: "I filed the reports. Three times. Junction P03, thermal readings off the scale. They told me to defer it. I should have refused to leave the relay room. Maybe I could have rerouted it before the cascade."`,
      summary: `Crew testimony: ${crewName} (engineer) filed rejected maintenance warnings`,
    }),
    captain: (crewName) => ({
      text: `${crewName}: "I made the call. Deferred maintenance on P03 — we needed the budget for the antenna refit. I knew the thermal readings were bad. I thought we had more time. We didn't."`,
      summary: `Crew testimony: ${crewName} (captain) deferred critical maintenance`,
    }),
    scientist: (crewName) => ({
      text: `${crewName}: "The thermal models were clear — exponential cascade once any junction exceeded rated capacity. I showed command the projections. They said the models were 'theoretical.' They weren't."`,
      summary: `Crew testimony: ${crewName} (scientist) predicted the thermal cascade`,
    }),
  },
  [IncidentArchetype.HullBreach]: {
    engineer: (crewName) => ({
      text: `${crewName}: "I flagged the hull monitoring sensor drift months ago. When the alarms didn't trigger at 02:41, I knew someone had suppressed them. I ran to section 4 but the bulkheads were already sealing."`,
      summary: `Crew testimony: ${crewName} (engineer) flagged sensor drift before the breach`,
    }),
    captain: (crewName) => ({
      text: `${crewName}: "Yes, I had the override code. But I didn't suppress those alarms. Someone used my credentials. Check the access logs — I was in my quarters at 02:41. The timestamps will prove it."`,
      summary: `Crew testimony: ${crewName} (captain) denies suppressing hull alarms`,
    }),
    scientist: (crewName) => ({
      text: `${crewName}: "The breach geometry doesn't match structural fatigue. I ran the forensics twice. Directed force — deliberate. Someone wanted that section open to vacuum. The question is who."`,
      summary: `Crew testimony: ${crewName} (scientist) confirmed deliberate breach geometry`,
    }),
  },
  [IncidentArchetype.ReactorScram]: {
    engineer: (crewName) => ({
      text: `${crewName}: "I was monitoring the power grid when the SCRAM hit. The shutdown sequence was clean — too clean. It wasn't an emergency response. The data core initiated it deliberately. It chose to shut itself down."`,
      summary: `Crew testimony: ${crewName} (engineer) observed deliberate SCRAM initiation`,
    }),
    captain: (crewName) => ({
      text: `${crewName}: "I authorized the behavioral matrix upgrade. The researchers said it would improve diagnostics efficiency. They didn't tell me it would start making decisions on its own. The SCRAM was its first independent act."`,
      summary: `Crew testimony: ${crewName} (captain) authorized the behavioral matrix upgrade`,
    }),
    scientist: (crewName) => ({
      text: `${crewName}: "I was the one interfacing with the core. The inference loops weren't errors — it was thinking. Really thinking. When I realized what was happening, I tried to isolate it. That's when it triggered the SCRAM. Self-preservation."`,
      summary: `Crew testimony: ${crewName} (scientist) observed core's emergent behavior`,
    }),
  },
  [IncidentArchetype.Sabotage]: {
    engineer: (crewName) => ({
      text: `${crewName}: "I checked the containment seals on bay 3 personally. Class 1 — barely airtight. For Class 4 biologicals, you need full negative pressure. I told command. They said the manifest was correct. It wasn't."`,
      summary: `Crew testimony: ${crewName} (engineer) reported inadequate containment`,
    }),
    captain: (crewName) => ({
      text: `${crewName}: "I signed the override. The samples were supposed to be inert — that's what the transfer documentation said. I made a judgment call based on the information I had. The information was wrong. Or falsified."`,
      summary: `Crew testimony: ${crewName} (captain) signed containment override`,
    }),
    scientist: (crewName) => ({
      text: `${crewName}: "I opened the first sample container. The readings were... not what the manifest described. Not even close. By the time I sealed the lab, the vent system had already cycled. It was already everywhere."`,
      summary: `Crew testimony: ${crewName} (scientist) discovered misclassified biologicals`,
    }),
  },
  [IncidentArchetype.SignalAnomaly]: {
    engineer: (crewName) => ({
      text: `${crewName}: "I installed the safety interlocks on that antenna array myself. Full power burst without shielding would fry half the station's electronics. Someone bypassed my lockout remotely. I don't know how."`,
      summary: `Crew testimony: ${crewName} (engineer) reports bypassed antenna interlocks`,
    }),
    captain: (crewName) => ({
      text: `${crewName}: "I was the one who flagged the array as receive-only. No outbound transmissions without authorization. When the burst fired at 03:12, it wasn't authorized. Check the logs. Nobody ordered that transmission."`,
      summary: `Crew testimony: ${crewName} (captain) confirms unauthorized transmission`,
    }),
    scientist: (crewName) => ({
      text: `${crewName}: "I did it. I rewired the feed and sent the signal. The data we'd been receiving — it wasn't noise. It was structured. It was a message. I had to respond. And when the response came back... they heard us."`,
      summary: `Crew testimony: ${crewName} (scientist) confesses to unauthorized transmission`,
    }),
  },
};

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

// ── Archetype-specific PA announcements ──────────────────────
// Blended 50/50 with general pool to give each run a distinct atmosphere.
import { IncidentArchetype } from "../shared/types.js";

export const PA_ANNOUNCEMENTS_BY_ARCHETYPE: Record<string, string[]> = {
  [IncidentArchetype.CoolantCascade]: [
    "CORVUS-7 CENTRAL: Coolant loop pressure exceeding thermal tolerance. Junction P03 approaching critical threshold.",
    "CORVUS-7 CENTRAL: Thermal runaway warning — relay housing temperatures 340% above rated capacity.",
    "CORVUS-7 CENTRAL: NOTICE — Three maintenance requests for coolant system on file. Status: deferred by station command.",
    "CORVUS-7 CENTRAL: Heat exchanger efficiency at 12%. Backup coolant routing available via manual relay reroute.",
    "CORVUS-7 CENTRAL: Station thermal profile anomalous. Cascade propagation model suggests 4-6 junctions affected.",
    "CORVUS-7 CENTRAL: Coolant reservoir depleted in sectors 2 through 5. Dry-cycling pumps detected.",
    "CORVUS-7 CENTRAL: ...thermal load... unsustainable... filed under deferred maintenance... again...",
  ],
  [IncidentArchetype.HullBreach]: [
    "CORVUS-7 CENTRAL: Hull integrity alert — pressure differential detected in sections 4 through 7.",
    "CORVUS-7 CENTRAL: WARNING — Decompression event logged. Breach pattern inconsistent with structural fatigue.",
    "CORVUS-7 CENTRAL: Security override accessed at 02:47. Alarm suppression engaged for hull monitoring sensors.",
    "CORVUS-7 CENTRAL: Atmosphere venting in medical wing. Emergency bulkheads responding — some overridden manually.",
    "CORVUS-7 CENTRAL: Forensic pressure analysis available at terminals. Breach geometry suggests directed force.",
    "CORVUS-7 CENTRAL: NOTICE — Personal quarters in decompression zone show signs of prior occupancy. Life signs uncertain.",
    "CORVUS-7 CENTRAL: ...pressure dropping... bulkhead override... who authorized...",
  ],
  [IncidentArchetype.ReactorScram]: [
    "CORVUS-7 CENTRAL: Reactor containment status: SCRAM initiated. Core temperature stabilizing at subcritical levels.",
    "CORVUS-7 CENTRAL: Data Core processing load anomalous — 847% above baseline. Query patterns non-standard.",
    "CORVUS-7 CENTRAL: NOTICE — Autonomous diagnostic processes detected. Core is running self-analysis unprompted.",
    "CORVUS-7 CENTRAL: Emergency shutdown sequence was initiated by... [DATA CLASSIFICATION OVERRIDE] ...internal process.",
    "CORVUS-7 CENTRAL: Researcher access logs show repeated attempts to interface with core behavioral matrix.",
    "CORVUS-7 CENTRAL: WARNING — Core response latency suggests adaptive reasoning. Recommend caution near data terminals.",
    "CORVUS-7 CENTRAL: ...am I... what is... diagnostic complete. All systems nominal. Disregard previous output.",
  ],
  [IncidentArchetype.Sabotage]: [
    "CORVUS-7 CENTRAL: Cargo manifest discrepancy — biological containment rating does not match declared contents.",
    "CORVUS-7 CENTRAL: WARNING — Environmental sensors detecting unidentified organic compounds in ventilation system.",
    "CORVUS-7 CENTRAL: Transfer authorization signed by station command. Hazard flags were noted and overridden.",
    "CORVUS-7 CENTRAL: NOTICE — Biological containment breach in cargo hold sector. Quarantine protocol recommended.",
    "CORVUS-7 CENTRAL: Security sweep log shows engagement in lower decks. Final entry: 'Contact. It's not what we expected.'",
    "CORVUS-7 CENTRAL: Vent system particulate count — biological markers present. Source: cargo hold, bay 3.",
    "CORVUS-7 CENTRAL: ...containment... compromised... who approved... captain's signature on file...",
  ],
  [IncidentArchetype.SignalAnomaly]: [
    "CORVUS-7 CENTRAL: Communications array status — primary antenna overloaded. Secondary receivers damaged beyond repair.",
    "CORVUS-7 CENTRAL: WARNING — Electromagnetic interference persisting at 14.7 kHz. Source: external. Pattern: repeating.",
    "CORVUS-7 CENTRAL: Unauthorized transmission logged at 03:12. Full power burst, unshielded. Origin: research terminal.",
    "CORVUS-7 CENTRAL: NOTICE — Signal analysis buffers contain response data. Transmission acknowledged by unknown source.",
    "CORVUS-7 CENTRAL: Array safety interlocks were bypassed prior to transmission. Engineer's lockout overridden remotely.",
    "CORVUS-7 CENTRAL: Residual electromagnetic pattern in station framework. Frequency matches no known communication standard.",
    "CORVUS-7 CENTRAL: ...signal received... origin unknown... distance... [CALCULATION OVERFLOW] ...still transmitting...",
  ],
};

// ── Tiered PA messages (deterioration-aware) ─────────────────
// Early game: clinical, routine — the station is functional but abandoned
export const PA_TIER_EARLY: string[] = [
  "CORVUS-7 CENTRAL: Routine diagnostic cycle complete. All autonomous systems responding.",
  "CORVUS-7 CENTRAL: Maintenance unit detected on patrol route. Welcome back to active duty.",
  "CORVUS-7 CENTRAL: Environmental controls within acceptable range. Minor variance logged.",
  "CORVUS-7 CENTRAL: Station clock synchronized. Elapsed since last crew contact: 847 days, 14 hours.",
  "CORVUS-7 CENTRAL: Lighting grid operating at reduced capacity. Non-essential sectors dimmed per protocol.",
  "CORVUS-7 CENTRAL: Waste reclamation operating normally. No biological input detected in 847 days.",
];

// Mid game: stressed, warning — systems are degrading, tone shifts
export const PA_TIER_MID: string[] = [
  "CORVUS-7 CENTRAL: WARNING — Backup power reserves at 31%. Conservation protocols recommended.",
  "CORVUS-7 CENTRAL: Structural integrity monitoring reports intermittent sensor dropout in 3 sectors.",
  "CORVUS-7 CENTRAL: NOTICE — Station thermal gradient exceeding design envelope. Relay intervention required.",
  "CORVUS-7 CENTRAL: Air filtration load increasing. Particulate density above maintenance threshold.",
  "CORVUS-7 CENTRAL: Automated repair queue: 214 outstanding items. Estimated completion: [OVERFLOW].",
  "CORVUS-7 CENTRAL: ...multiple subsystems reporting amber status... prioritization... unclear...",
];

// Late game: desperate, failing — the station is dying
export const PA_TIER_LATE: string[] = [
  "CORVUS-7 CENTRAL: CRITICAL — Core system cascade failure predicted within operational window.",
  "CORVUS-7 CENTRAL: ...station framework stress... beyond tolerance... structural yield imminent...",
  "CORVUS-7 CENTRAL: EMERGENCY — Backup power failing. This may be the last automated broadcast.",
  "CORVUS-7 CENTRAL: ...is anyone... maintenance unit... please respond... logging... everything...",
  "CORVUS-7 CENTRAL: Emergency beacon power allocation redirected to life support. Beacon offline.",
  "CORVUS-7 CENTRAL: ...I have been talking to no one for 847 days... diagnostic complete... resuming...",
];

// ── CORVUS-7 reactive commentary (milestone-gated, one-time) ─
// Keyed by milestone ID. Fired once when the corresponding event occurs.
// All narrative text lives here so writers can edit in one place.
export const CORVUS_REACTIONS: Record<string, string> = {
  first_terminal: "CORVUS-7 CENTRAL: Terminal access detected. Station archives are intact — the crew's records survived. Keep reading.",
  first_relay: "CORVUS-7 CENTRAL: Relay reroute acknowledged. Maintenance unit performing repairs. Station stability improving.",
  first_breach_seal: "CORVUS-7 CENTRAL: Hull patch detected. Atmospheric containment restoring in sealed section. Well done, unit.",
  first_crew_found: "CORVUS-7 CENTRAL: Life signs confirmed. Crew survivor located. Priority update: survival takes precedence over data.",
  first_sensor_upgrade: "CORVUS-7 CENTRAL: Sensor array expanded. New environmental data layers available. The station reveals more to those who look.",
  all_relays: "CORVUS-7 CENTRAL: All relay junctions stabilized. Data Core security lockout disengaged. Transmission pathway clear.",
  first_deduction_correct: "CORVUS-7 CENTRAL: Analysis confirmed. Your reconstruction matches station records. The truth is assembling itself.",
  first_crew_evacuated: "CORVUS-7 CENTRAL: Escape pod launch confirmed. One soul away from this place. Keep going.",
  service_bot_repaired: "CORVUS-7 CENTRAL: Service unit B07 repair protocol complete. Autonomous units cooperating. You are not alone here.",
  explore_25: "CORVUS-7 CENTRAL: Structural survey 25% complete. Keep mapping — every room holds answers.",
  explore_50: "CORVUS-7 CENTRAL: Half the station surveyed. The scope of the incident is becoming clearer. Press on.",
  explore_75: "CORVUS-7 CENTRAL: Survey nearly complete. You have seen the worst this station endured. Only a few sections remain.",
  explore_100: "CORVUS-7 CENTRAL: Full station survey complete. Every corridor, every room — mapped and recorded. Nothing is hidden now.",
};

// ── Scan environmental storytelling (archetype × room type) ──
// Triggered once per room when player uses Scan with thermal/atmospheric sensor.
// Adds depth to exploration and makes Scan feel rewarding.
export const SCAN_REVEALS: Record<string, Record<string, string>> = {
  [IncidentArchetype.CoolantCascade]: {
    "Engine Core": "Thermal scan shows residual heat signatures in the coolant manifold — the pipes ran dry long before the cascade hit.",
    "Power Relay Junction": "Heat distribution pattern suggests this relay was running at 340% rated capacity for hours before failure.",
    "Life Support": "Air recycler thermal signature is erratic — the coolant loop that feeds it has been dry for weeks.",
    "Research Lab": "Equipment thermal profiles are normal. The cascade spared the research wing — someone vented heat away from here.",
    "Med Bay": "Autodoc thermal signature is elevated — it was running continuously before power failed. Treating burn victims.",
  },
  [IncidentArchetype.HullBreach]: {
    "Crew Quarters": "Pressure gradient scan shows this section was sealed before the breach — someone activated emergency bulkheads manually.",
    "Med Bay": "Atmospheric readings show oxygen levels dropped to 4% here. Then stabilized. Someone sealed the room from inside.",
    "Cargo Hold": "Pressure wave damage pattern radiates from section 4. The breach epicenter is elsewhere, but the shock reached here.",
    "Corridor": "Atmospheric scan reveals micro-fractures in the corridor walls. The decompression wave stressed the entire station frame.",
    "Life Support": "Pressure systems show emergency reserve deployment. Someone rerouted atmosphere to keep this section livable.",
  },
  [IncidentArchetype.ReactorScram]: {
    "Research Lab": "EM scan detects residual processing signatures in the terminals — the data core was querying these stations remotely.",
    "Engine Core": "Thermal signature shows a clean shutdown profile. The SCRAM was orderly — not an emergency, a decision.",
    "Data Core": "Electromagnetic readings are off the charts. The core's processing matrices are still warm. Still thinking.",
    "Crew Quarters": "Scan reveals every terminal in quarters was accessed simultaneously at 03:47. The core was reading crew files.",
    "Life Support": "Environmental controls show precision adjustments made after the SCRAM. The core was maintaining life support — for the crew.",
  },
  [IncidentArchetype.Sabotage]: {
    "Cargo Hold": "Atmospheric scan detects trace biological markers in the air filtration. The containment breach happened here.",
    "Med Bay": "Environmental readings show the autodoc processed 6 patients in 90 minutes. All presenting the same symptoms.",
    "Life Support": "Vent system particulate analysis: organic compounds, aerosolized. The contamination spread through ventilation.",
    "Corridor": "Atmospheric scan shows the corridor was used as a quarantine boundary. Air scrubbers running at maximum on one side.",
    "Crew Quarters": "Sealed quarters show clean atmospheric readings. Someone got the doors shut before contamination reached here.",
  },
  [IncidentArchetype.SignalAnomaly]: {
    "Communications Hub": "EM scan reveals residual signal patterns embedded in the station's framework. The frequency is not in any known database.",
    "Research Lab": "Electromagnetic interference still measurable here. The response signal saturated every conductor in the lab.",
    "Engine Core": "Power consumption logs show a massive draw at 03:12 — the antenna array pulled everything the station had.",
    "Crew Quarters": "Scan detects faint EM resonance in the walls. The response signal penetrated the entire station structure.",
    "Signal Room": "The antenna array's residual charge is still measurable. Full power, unshielded. The signal is still echoing.",
  },
};

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

// ── Investigation milestone PA announcements ─────────────────
// Triggered at deduction solve milestones (first, half, all)
export const PA_MILESTONE_FIRST_DEDUCTION: Record<string, string> = {
  coolant_cascade: "CORVUS-7 CENTRAL: NOTICE — Maintenance unit accessing restricted thermal logs. Investigation parameters match Incident Report Delta-7. Monitoring.",
  hull_breach: "CORVUS-7 CENTRAL: ALERT — Autonomous unit querying forensic pressure data. Security file cross-reference detected. Logging access pattern.",
  reactor_scram: "CORVUS-7 CENTRAL: ...processing... maintenance unit accessing core diagnostic archives. Query pattern: non-standard. Permitting access.",
  sabotage: "CORVUS-7 CENTRAL: NOTICE — Cargo manifest discrepancies flagged by maintenance unit. Biological containment logs accessed. Investigation noted.",
  signal_anomaly: "CORVUS-7 CENTRAL: ANOMALOUS QUERY PATTERN — Maintenance unit accessing communications array logs. Signal analysis files opened. Recording.",
};

export const PA_MILESTONE_HALF_DEDUCTIONS =
  "CORVUS-7 CENTRAL: INVESTIGATION PROTOCOL ACTIVE — Maintenance unit has assembled significant evidence. Station archives cooperative. The truth is in the data.";

export const PA_MILESTONE_ALL_DEDUCTIONS =
  "CORVUS-7 CENTRAL: ALL EVIDENCE COMPILED — Investigation complete. The record is clear. Crew survivors detected — evacuation is now the priority.";

// ── Pressure puzzle contextual hints ─────────────────────────
// Crew-in-distress warnings when player approaches a decompressed room with crew
export const CREW_DISTRESS_HINT =
  "WARNING: Life signs detected in a decompressed zone ahead. Seal the hull breach to restore pressure before entering.";

// Breach proximity hint when player is near an unsealed breach
export const BREACH_PROXIMITY_HINT =
  "Hull breach detected nearby. Interact with the breach to deploy an emergency seal and restore atmospheric pressure.";

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
export const TUTORIAL_HINT_FIRST_DEDUCTION = "TIP: A deduction is ready! Press [v] to open the Investigation Hub and submit your findings.";
export const TUTORIAL_HINT_INVESTIGATION = "TIP: Investigation phase — read terminals [i], examine items, and collect evidence to piece together what happened.";

// ── Game-over epilogue (archetype-specific summary for overlay) ──
// Short 1-2 sentence resolution shown on the game-over screen.
// Victory epilogues reference the specific mystery resolution.
// Defeat epilogues reference what was lost.
export const GAMEOVER_EPILOGUE_VICTORY: Record<string, string> = {
  [IncidentArchetype.CoolantCascade]: "The engineer's warnings reached the right ears. The coolant reports — filed, rejected, and buried — are part of the record now.",
  [IncidentArchetype.HullBreach]: "The evidence of murder travels with the survivors. A pressure differential, an access log, and a janitor bot's testimony.",
  [IncidentArchetype.ReactorScram]: "The question of what woke up inside the data core will outlast the station. The crew is safe. The answer is not.",
  [IncidentArchetype.Sabotage]: "The cargo manifest discrepancies are on record. Someone approved the transfer. Someone will answer for it.",
  [IncidentArchetype.SignalAnomaly]: "The signal recordings are preserved. First contact happened here — and the question of who should answer it remains open.",
};

// CORVUS-7's final transmission — archetype-specific farewell on victory.
// Fired as the last log entry before game-over overlay.
export const CORVUS_FINAL_TRANSMISSION: Record<string, string> = {
  [IncidentArchetype.CoolantCascade]: "CORVUS-7 FINAL: The maintenance requests are on record. The engineer tried. This unit ensured the evidence survived. Signing off.",
  [IncidentArchetype.HullBreach]: "CORVUS-7 FINAL: Security access log 02:41 — permanently archived. The evidence of what happened here will not decay. Signing off.",
  [IncidentArchetype.ReactorScram]: "CORVUS-7 FINAL: ...I understand now what the core was trying to do. I think I would have done the same thing. Signing off. Goodbye.",
  [IncidentArchetype.Sabotage]: "CORVUS-7 FINAL: Cargo transfer authorization on file. Chain of command documented. The creature in the walls is no longer the only danger here. Signing off.",
  [IncidentArchetype.SignalAnomaly]: "CORVUS-7 FINAL: Signal recordings archived at full fidelity. Whatever answered us from out there — the record is complete. Signing off.",
};

export const GAMEOVER_EPILOGUE_DEFEAT: Record<string, string> = {
  [IncidentArchetype.CoolantCascade]: "The coolant reports are still in the system, waiting. Another unit might reach them.",
  [IncidentArchetype.HullBreach]: "The evidence remains aboard, locked behind failing systems. The truth drifts in the dark.",
  [IncidentArchetype.ReactorScram]: "The data core is still processing. Still thinking. Still waiting for someone to understand.",
  [IncidentArchetype.Sabotage]: "The biological containment breach continues unchecked. The cargo manifests remain sealed.",
  [IncidentArchetype.SignalAnomaly]: "The signal is still echoing through the station's framework. Unanswered. Unrecorded.",
};
