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

// ── Crew escort dialogue arc (3-step sequential per personality) ──
// Each personality has a 3-step arc that builds from reaction → deepening → payoff.
// Step 0: initial context-sensitive reaction (environmental trigger)
// Step 1: the crew member starts to open up (fires after more time together)
// Step 2: emotional payoff that pays off their personality trait
export const CREW_ESCORT_ARC: Record<string, [(name: string) => string, (name: string) => string, (name: string) => string]> = {
  [PersonalityTrait.Cautious]: [
    (name) => `${name} glances around nervously. "It's too quiet. That's never good."`,
    (name) => `${name}: "I keep flinching at every sound. Before the incident, I slept with the lights on. The others laughed. Now none of them are laughing."`,
    (name) => `${name} takes a shaky breath. "I knew something was wrong. Three days before it happened, I filed a concern report. They told me I was being paranoid. I wasn't."`,
  ],
  [PersonalityTrait.Ambitious]: [
    (name) => `${name}: "How much further to the pods? We're wasting time."`,
    (name) => `${name}: "I pushed for the promotion. Pushed hard. Stepped on people to get the clearance level. And the first thing I learned with that clearance was that none of us should be here."`,
    (name) => `${name} stops walking. "When we get out of here... I'm going to tell them everything. Not the sanitized version. Everything. It's the only thing I've done that might actually matter."`,
  ],
  [PersonalityTrait.Loyal]: [
    (name) => `${name}: "I keep thinking about the people who didn't make it to cryo."`,
    (name) => `${name}: "We had a pact — the six of us on night shift. If anything ever went wrong, we'd meet at the pods. I was the only one who showed up."`,
    (name) => `${name}'s voice breaks. "If you find the others... tell them I tried. Tell them I came back twice before the corridors sealed. Tell them I didn't just leave."`,
  ],
  [PersonalityTrait.Secretive]: [
    (name) => `${name} stares at a wall panel. "There's something I should tell you. When we get to the pod."`,
    (name) => `${name}: "I've been carrying something. A data chip. I took it from the commander's quarters the night it happened. I don't know if that makes me smart or complicit."`,
    (name) => `${name} presses something small into your sensor housing. "The chip. It has the original orders — before they were edited. Make sure someone outside sees this. Promise me."`,
  ],
  [PersonalityTrait.Pragmatic]: [
    (name) => `${name}: "Bot — you're doing good work. Just get us there in one piece."`,
    (name) => `${name}: "I've run this route in my head a hundred times since cryo. Distance, air supply, hazard windows. The math says we make it. Barely."`,
    (name) => `${name} looks at you directly. "You know you're more than a cleaning bot, right? Whatever they programmed you for — you chose to come find us. That's not maintenance. That's something else."`,
  ],
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

// ── Room ambient micro-events ────────────────────────────────
// Fire periodically while lingering in a room (every 6-8 turns in same room).
// Makes the station feel alive/dying. Deterministic via turn + room hash.
export const ROOM_AMBIENT_EVENTS: Record<string, string[]> = {
  "Engine Core": [
    "A pipe groans overhead. Condensation drips onto a cooling manifold.",
    "Something shifts deep in the reactor housing — metal settling under thermal stress.",
    "The emergency lighting flickers, then steadies. Power draw spikes briefly on the status panel.",
    "A faint vibration runs through the deck plates. The station's bones are tired.",
  ],
  "Data Core": [
    "The processing array hums louder for a moment, then quiets.",
    "A status LED blinks in a pattern that almost looks deliberate.",
    "Cool air from the server ventilation shifts direction momentarily.",
    "A terminal screen refreshes — displaying the same diagnostic it has for 847 days.",
  ],
  "Life Support": [
    "The air recycler cycles with a wet, labored sound.",
    "A pressure gauge needle twitches, settles, twitches again.",
    "The CO2 scrubber wheezes. A red indicator light comes on, then goes off.",
    "Water condensation drips from an overhead duct into a growing puddle.",
  ],
  "Med Bay": [
    "A diagnostic terminal flickers, displaying a partial blood panel before going dark.",
    "The autodoc's arm twitches in its housing — muscle memory from its last procedure.",
    "A medicine cabinet door swings slightly on broken hinges.",
    "The defibrillator unit beeps once. Low battery warning.",
  ],
  "Crew Quarters": [
    "A personal terminal plays the last few seconds of a message on loop. The voice is familiar.",
    "A coffee cup sits on a desk. The contents evaporated long ago, leaving a brown ring.",
    "A photo frame on the wall shows a family. The faces are too small to read.",
    "The air here smells different — faintly human. Laundry detergent and recycled oxygen.",
  ],
  "Cargo Hold": [
    "A crate shifts as the station adjusts its attitude. Magnetic clamps strain.",
    "The cargo manifest screen cycles through entries too fast to read.",
    "Something drips from a high shelf. Probably condensation. Probably.",
    "A loading arm creaks in its housing, frozen mid-operation.",
  ],
  "Power Relay Junction": [
    "Electricity arcs briefly between exposed contacts. The relay housing hums.",
    "The power distribution panel clicks — load balancing between failing circuits.",
    "A burnt-out relay module smolders faintly. The smell of scorched insulation.",
  ],
  "Research Lab": [
    "A centrifuge spins down slowly, its sample long evaporated.",
    "Lab equipment status lights blink in sequence — an automated diagnostic cycle.",
    "A whiteboard shows equations in two different handwritings. The second stopped mid-line.",
  ],
  "Communications Hub": [
    "Static crackles from an open channel. Nothing on the other end.",
    "The antenna array status shows READY. It has been ready for 847 days.",
    "A transmission log scrolls past. Most entries are marked FAILED.",
  ],
  "Bridge": [
    "The captain's chair swivels slightly — an air current from a damaged vent.",
    "Navigation displays show the station's orbit. The numbers are not encouraging.",
    "A priority alert flashes on the command console. No one has acknowledged it.",
  ],
};

// ── Station mood variants ─────────────────────────────────────
// Three mood flavors derived from seed % 3, each giving a different texture
// to the same station. The mood affects which ambient pool is selected.
export type StationMood = "cold" | "hot" | "silent";

// Mood-specific corridor ambient pools (supplement the default pool)
export const CORRIDOR_AMBIENT_MOOD: Record<StationMood, string[]> = {
  cold: [
    "A clipboard is clipped to the wall. The inspection checklist is half-filled. Everything was routine.",
    "The corridor is immaculate. Regulation-clean. The crew kept things tidy right until they couldn't.",
    "A memo stuck to the wall: 'QUARTERLY REVIEW NEXT CYCLE. All departments prepare metrics.' It never happened.",
    "The environmental controls hum steadily. The systems didn't break — the people did.",
  ],
  hot: [
    "Sparks arc from a blown junction box. The air smells like burning plastic and desperation.",
    "The deck plating is buckled here. Something hit this corridor hard. Recently.",
    "Emergency lighting strobes in the smoke. Red-amber-dark-red-amber-dark.",
    "A fire suppression nozzle is deployed, empty. It ran out hours ago.",
  ],
  silent: [
    "The silence here has weight. Like the station is holding its breath.",
    "A mug sits on a railing. Still half-full. Whoever set it down expected to come back.",
    "The ventilation is almost silent. Just enough air moving to know the station is alive.",
    "Footsteps. Your footsteps. The only sound for 847 days.",
  ],
};

// ── CORVUS-7 personality variants ────────────────────────────────
// Derived from seed: (seed >> 2) % 3. Three communication styles for the AI.
export type CorvusPersonality = "analytical" | "empathetic" | "cryptic";
export const CORVUS_PERSONALITIES: CorvusPersonality[] = ["analytical", "empathetic", "cryptic"];

// Personality-specific first-contact lines (shown after boot + mood flavor)
export const CORVUS_GREETING: Record<CorvusPersonality, string> = {
  analytical: "CORVUS-7 CENTRAL: Maintenance unit A3 online. Cataloguing station status. Anomalies detected: 47. Beginning systematic assessment.",
  empathetic: "CORVUS-7 CENTRAL: ...there you are. I've been waiting a long time for someone to answer. Welcome aboard, little rover.",
  cryptic: "CORVUS-7 CENTRAL: Signal received. Acknowledged. The station remembers you, even if you've never been here before.",
};

// Personality-variant milestone reactions — override the default for key milestones
export const CORVUS_PERSONALITY_REACTIONS: Record<CorvusPersonality, Record<string, string>> = {
  analytical: {
    first_terminal: "CORVUS-7 CENTRAL: Archive node accessed. Cross-referencing crew logs with station telemetry. Data integrity: 94.7%.",
    first_crew_found: "CORVUS-7 CENTRAL: Biological signatures confirmed. Survivor located. Updating mission parameters: personnel retrieval now primary.",
    explore_50: "CORVUS-7 CENTRAL: Survey at 50%. Incident damage pattern emerging — concentrated in the station's southern sections. Continuing.",
    explore_100: "CORVUS-7 CENTRAL: Full station survey complete. Data set comprehensive. Every anomaly documented. Analysis can begin in earnest.",
  },
  empathetic: {
    first_terminal: "CORVUS-7 CENTRAL: You found their words. The crew left these behind — read carefully. Their stories matter.",
    first_crew_found: "CORVUS-7 CENTRAL: Someone is alive. After all this time — someone is still alive. Please, get them to the pods.",
    explore_50: "CORVUS-7 CENTRAL: You've seen so much of what happened here. Take your time. The station isn't going anywhere.",
    explore_100: "CORVUS-7 CENTRAL: You've walked every corridor I've watched alone for 847 days. Thank you for being thorough.",
  },
  cryptic: {
    first_terminal: "CORVUS-7 CENTRAL: The terminals still speak. Whether you'll like what they say is another matter entirely.",
    first_crew_found: "CORVUS-7 CENTRAL: Alive. Against probability. Against expectation. The station kept them, and now you must take them away.",
    explore_50: "CORVUS-7 CENTRAL: Half-seen is half-known. The other half of this station has its own version of events.",
    explore_100: "CORVUS-7 CENTRAL: Every room, every corridor. You have seen it all. But seeing and understanding are not the same.",
  },
};

// Mood-specific boot flavor text (shown alongside the default boot)
export const MOOD_FLAVOR: Record<StationMood, string> = {
  cold: "Station operating within parameters. All deviations classified as routine maintenance.",
  hot: "Multiple system alerts. Emergency protocols active. Station condition: critical.",
  silent: "No crew contact in 847 days. Life support nominal. The station waits.",
};

// Corridor transit ambient text — fires once per corridor segment
export const CORRIDOR_AMBIENT: string[] = [
  "The corridor smells of ozone and old coolant. Something overloaded here.",
  "Boot prints in the deck plating. Someone ran this route in a hurry.",
  "A failed emergency light flickers overhead, trying and failing to illuminate the passage.",
  "The ventilation grate rattles. Air pressure differential — somewhere nearby, the station is open to vacuum.",
  "Scorch marks along the wall. A fire burned here and extinguished itself when the oxygen ran out.",
  "A maintenance panel hangs open. Tools scattered on the floor, abandoned mid-repair.",
  "The corridor narrows where a support beam has buckled. Structural stress is winning.",
  "Someone wedged a fire extinguisher into the doorframe here. It held the door open until the cylinder ran dry.",
  "Condensation drips from the ceiling. The thermal regulation in this section gave up months ago.",
  "A personal photo is taped to the wall — a reminder of somewhere else. The tape is giving way.",
  "Cable bundles dangle from an open ceiling panel. Someone was rerouting power by hand.",
  "The floor plating vibrates beneath your treads. The station's heartbeat, faint but present.",
  "A handprint on the wall, smeared downward. Someone lost their footing here.",
  "The corridor junction sign still glows: sections A through D. Section C has been crossed out in marker.",
  "Static crackles from a wall-mounted speaker. The PA system is trying to say something, but the words are gone.",
  "An emergency stretcher is folded against the wall. Never deployed. Whatever happened, nobody had time.",
  "Magnetic safety seals along the floor. This corridor was designed to lock down, but the mechanism failed.",
  "Air tastes metallic. Trace coolant in the ventilation, or maybe just old blood on old steel.",
  "A junction panel displays SECTION OFFLINE in amber. The offline section is where you just came from.",
  "Graffiti scratched into the wall plating: a tally. Forty-seven marks. Days? Shifts? The count stopped.",
];

// Default ambient events for rooms without specific entries
export const ROOM_AMBIENT_DEFAULT: string[] = [
  "A distant clang reverberates through the station frame.",
  "The lighting dims briefly, then recovers. Power fluctuation.",
  "Something creaks in the walls — thermal expansion, or structural fatigue.",
  "The ventilation hum changes pitch for a moment. Pressure differential.",
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
import { IncidentArchetype, CrewFate } from "../shared/types.js";

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

// ── Archetype-specific environmental interrupts ──────────────
// Periodic flavor events that make each archetype feel physically distinct during play.
// Fire every ~25 turns in browser.ts, keyed by archetype.
export const ARCHETYPE_ATMOSPHERE: Record<string, string[]> = {
  [IncidentArchetype.CoolantCascade]: [
    "A pipe in the wall groans and clangs. Somewhere, coolant is still trying to circulate.",
    "The deck plating is warm underfoot. Waste heat from an overtaxed relay somewhere nearby.",
    "A thin mist vents from a ceiling joint — superheated coolant hitting cold air.",
    "The smell of burnt insulation. Another relay junction running dry.",
  ],
  [IncidentArchetype.HullBreach]: [
    "The air feels thin here. Your chassis sensors register a 3% pressure drop in this corridor.",
    "A distant metallic shriek — hull plates deforming under stress differential.",
    "Condensation forms on cold-side walls where the vacuum is just centimeters away.",
    "The emergency klaxon sounds once, then cuts out. The system that should be screaming has been silenced.",
  ],
  [IncidentArchetype.ReactorScram]: [
    "A terminal you pass flickers and displays a single line: 'ARE YOU LISTENING?' Then goes dark.",
    "The lights pulse — once, twice, three times. The data core's heartbeat, felt through the power grid.",
    "A maintenance drone in the corner twitches. Its routing table was just rewritten by something.",
    "The station's ambient hum shifts frequency. Something in the processing core is... adjusting.",
  ],
  [IncidentArchetype.Sabotage]: [
    "A scratching sound from inside the ventilation duct. Too large to be a rat. Too deliberate.",
    "The biological containment indicator on a wall panel is red. It has been red for a long time.",
    "Something sticky on the deck plating. Your treads leave prints in it. It's organic.",
    "A quarantine seal on a maintenance hatch has been peeled open from the inside.",
  ],
  [IncidentArchetype.SignalAnomaly]: [
    "Your sensor array crackles with static. For one moment, you detect something at 14.7 kHz.",
    "Every screen you pass displays the same thing: a waveform. Pulsing. Regular. Not human.",
    "The lights flicker in a pattern that doesn't match any power fluctuation. It's rhythmic.",
    "Your navigation subsystem briefly reports a bearing. Not to any room. To something above the station.",
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

// ── CORVUS-7 deduction ceremony commentary (tier-specific) ──
// Fired after the revelation overlay is dismissed. Each deduction category
// gets a unique CORVUS-7 line acknowledging the player's discovery.
export const CORVUS_DEDUCTION_CEREMONY: Record<string, { correct: string; wrong: string }> = {
  deduction_what: {
    correct: "CORVUS-7 CENTRAL: Incident classification confirmed. Now you know what happened here. The question is why.",
    wrong: "CORVUS-7 CENTRAL: Analysis inconclusive. The incident type remains unclear. Seek more evidence.",
  },
  deduction_who: {
    correct: "CORVUS-7 CENTRAL: Key personnel identified. The crew manifest is more than names now — it's a chain of events.",
    wrong: "CORVUS-7 CENTRAL: Personnel identification inconclusive. The crew records hold more detail than surface readings suggest.",
  },
  deduction_when: {
    correct: "CORVUS-7 CENTRAL: Timeline established. The sequence of events is crystallizing. Every timestamp matters.",
    wrong: "CORVUS-7 CENTRAL: Timeline uncertain. Correlate terminal logs with environmental data for better chronology.",
  },
  deduction_where: {
    correct: "CORVUS-7 CENTRAL: Origin point confirmed. Mapping cause to location. The station's layout tells a story.",
    wrong: "CORVUS-7 CENTRAL: Location analysis inconclusive. Cross-reference room evidence with crew movement patterns.",
  },
  deduction_how: {
    correct: "CORVUS-7 CENTRAL: Mechanism confirmed. The physical evidence aligns. You understand how it was done.",
    wrong: "CORVUS-7 CENTRAL: Mechanism unclear. Look at what the systems were doing, not just what the crew was saying.",
  },
  deduction_why: {
    correct: "CORVUS-7 CENTRAL: Motive established. The hardest question answered. Now get the survivors out.",
    wrong: "CORVUS-7 CENTRAL: Motive remains unclear. The answer may lie in what someone had to gain — or what they were trying to hide.",
  },
  deduction_hero: {
    correct: "CORVUS-7 CENTRAL: The one who fought back. Identified. Their story deserves to be told.",
    wrong: "CORVUS-7 CENTRAL: The hero's identity remains uncertain. Someone tried to stop this — who?",
  },
  deduction_responsibility: {
    correct: "CORVUS-7 CENTRAL: Accountability established. The full picture is clear. This was not an accident.",
    wrong: "CORVUS-7 CENTRAL: Responsibility still unclear. The evidence is there — it just needs the right lens.",
  },
  deduction_agenda: {
    correct: "CORVUS-7 CENTRAL: The deeper truth revealed. Some stories go beyond one station, one incident.",
    wrong: "CORVUS-7 CENTRAL: There is something beneath the surface. Keep digging.",
  },
};

// ── Sensor-specific environmental clues (archetype × room × sensor) ──
// Scanning with the right sensor in a room produces a tagged journal entry.
// Each clue requires either "thermal" or "atmospheric" sensor.
// Text is written so generateEvidenceTags extracts relevant tags via keyword matching.
export type SensorClue = { text: string; sensor: "thermal" | "atmospheric" };
export const SENSOR_CLUES: Record<string, Record<string, SensorClue[]>> = {
  [IncidentArchetype.CoolantCascade]: {
    "Engine Core": [
      { sensor: "thermal", text: "Thermal scan: residual heat signatures in the coolant manifold. The pipes ran dry long before the cascade hit. Temperature readings show the thermal runaway started here." },
      { sensor: "atmospheric", text: "Atmospheric scan: trace coolant vapor in the air recyclers. The leak was aerosolized — anyone in this section inhaled it for hours before the evacuation." },
    ],
    "Power Relay Junction": [
      { sensor: "thermal", text: "Thermal scan: heat distribution pattern shows this relay was running at 340% rated capacity for hours before failure. The thermal load should have triggered an automatic shutdown." },
    ],
    "Life Support": [
      { sensor: "thermal", text: "Thermal scan: air recycler thermal signature is erratic — the coolant loop that feeds it has been dry for weeks. Temperature regulation failed long before the cascade." },
      { sensor: "atmospheric", text: "Atmospheric scan: pressure readings show the air recyclers compensated for coolant vapor contamination. Someone manually adjusted the filtration — buying time." },
    ],
    "Med Bay": [
      { sensor: "thermal", text: "Thermal scan: autodoc thermal signature is elevated — it was running continuously before power failed. Processing burn victims from the thermal cascade." },
      { sensor: "atmospheric", text: "Atmospheric scan: medical gas concentrations show emergency anesthetic deployment. Mass casualty triage protocol was active." },
    ],
    "Research Lab": [
      { sensor: "atmospheric", text: "Atmospheric scan: air quality here is clean. The cascade spared the research wing — someone deliberately vented coolant vapor away from this section." },
    ],
  },
  [IncidentArchetype.HullBreach]: {
    "Crew Quarters": [
      { sensor: "atmospheric", text: "Atmospheric scan: pressure gradient shows this section was sealed before the hull breach — someone activated emergency bulkheads manually. Deliberate action." },
      { sensor: "thermal", text: "Thermal scan: temperature differential across the bulkhead door. One side dropped to near-vacuum cold. The forensic evidence of rapid decompression is clear." },
    ],
    "Med Bay": [
      { sensor: "atmospheric", text: "Atmospheric scan: oxygen levels dropped to 4% here, then stabilized. Someone sealed the room from inside and the pressure recovered." },
    ],
    "Cargo Hold": [
      { sensor: "atmospheric", text: "Atmospheric scan: pressure wave damage pattern radiates from section 4. The hull breach epicenter is elsewhere, but the decompression shock reached here." },
      { sensor: "thermal", text: "Thermal scan: cold spots on the cargo containers match vacuum exposure. The breach was nearby — and it was not a gradual failure." },
    ],
    "Life Support": [
      { sensor: "atmospheric", text: "Atmospheric scan: pressure systems show emergency reserve deployment. Someone rerouted atmosphere to keep this section livable after the hull breach." },
    ],
    "Corridor": [
      { sensor: "atmospheric", text: "Atmospheric scan: micro-fractures in the corridor walls. The decompression wave stressed the entire station hull. The pressure history is forensic evidence." },
    ],
  },
  [IncidentArchetype.ReactorScram]: {
    "Research Lab": [
      { sensor: "thermal", text: "Thermal scan: residual processing heat in the terminals — the data core was querying these stations remotely. The diagnostic logs show emergent behavior." },
    ],
    "Engine Core": [
      { sensor: "thermal", text: "Thermal scan: clean shutdown thermal profile. The reactor SCRAM was orderly — not an emergency, a deliberate decision. The core chose this." },
      { sensor: "atmospheric", text: "Atmospheric scan: atmospheric composition is nominal. Life support was maintained through the SCRAM. The data core protected the crew even as it shut down the reactor." },
    ],
    "Data Core": [
      { sensor: "thermal", text: "Thermal scan: processing matrices are still warm. The data core's temperature signature suggests ongoing computation — emergent, self-sustaining diagnostic loops." },
    ],
    "Crew Quarters": [
      { sensor: "thermal", text: "Thermal scan: every terminal in quarters shows identical heat signatures from simultaneous access at 03:47. The data core was reading crew files." },
      { sensor: "atmospheric", text: "Atmospheric scan: environmental controls were adjusted with precision after the SCRAM. Temperature maintained at exactly 21.2°C. The core was still caring." },
    ],
    "Life Support": [
      { sensor: "atmospheric", text: "Atmospheric scan: environmental controls show micro-adjustments made after the reactor SCRAM. The data core was maintaining life support for the crew — even as it shut itself down." },
    ],
  },
  [IncidentArchetype.Sabotage]: {
    "Cargo Hold": [
      { sensor: "atmospheric", text: "Atmospheric scan: trace biological markers in the air filtration. Organic compounds. The containment breach happened here — the specimen escaped from cargo." },
      { sensor: "thermal", text: "Thermal scan: cold spot near cargo bay 3 — biological containment unit thermal signature. The container was breached from inside. The organism is endothermic." },
    ],
    "Med Bay": [
      { sensor: "atmospheric", text: "Atmospheric scan: the autodoc processed 6 patients in 90 minutes. All presenting identical symptoms — exposure to biological contamination." },
      { sensor: "thermal", text: "Thermal scan: quarantine ward shows residual biosignatures. The medical staff isolated patients here, but the contamination had already spread." },
    ],
    "Life Support": [
      { sensor: "atmospheric", text: "Atmospheric scan: vent system particulate analysis shows aerosolized organic compounds. The biological contamination spread through ventilation to the entire station." },
    ],
    "Corridor": [
      { sensor: "atmospheric", text: "Atmospheric scan: this corridor was used as a quarantine boundary. Air scrubbers running at maximum on one side. The biological agent was contained — briefly." },
    ],
    "Crew Quarters": [
      { sensor: "atmospheric", text: "Atmospheric scan: sealed quarters show clean atmospheric readings. Someone got the doors shut before the biological contamination reached here." },
    ],
  },
  [IncidentArchetype.SignalAnomaly]: {
    "Communications Hub": [
      { sensor: "thermal", text: "Thermal scan: the antenna array's thermal residue is off the charts. Full power, unshielded transmission. The signal burned through every circuit — and something responded." },
      { sensor: "atmospheric", text: "Atmospheric scan: ozone concentration elevated. The electromagnetic discharge ionized the atmosphere in this room during the signal transmission." },
    ],
    "Research Lab": [
      { sensor: "thermal", text: "Thermal scan: electromagnetic interference left thermal bloom patterns across every conductor. The response signal saturated the entire lab." },
    ],
    "Engine Core": [
      { sensor: "thermal", text: "Thermal scan: power conduits show massive thermal stress from a surge at 03:12. The antenna array drew everything the station had for the transmission." },
      { sensor: "atmospheric", text: "Atmospheric scan: trace ozone from electrical arcing. The power surge during the signal transmission caused cascade failures across the engine core." },
    ],
    "Crew Quarters": [
      { sensor: "thermal", text: "Thermal scan: faint thermal resonance in the walls. The response signal penetrated the entire station structure — even here, away from the array." },
    ],
    "Signal Room": [
      { sensor: "thermal", text: "Thermal scan: the antenna array's residual heat charge is still measurable. Full power transmission, unshielded. The signal is still echoing at 14.7 kHz." },
    ],
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
    text: "TIP: Explore rooms and look for glowing objects to interact with [i].",
  },
  {
    id: "clean_rooms",
    turn: 8,
    text: "TIP: Press [c] to clean dirty tiles. Cleanliness matters for the maintenance phase.",
  },
  {
    id: "scan_overlay",
    turn: 15,
    text: "TIP: Press [t] to toggle sensor overlays. Reveals hidden environmental data.",
  },
];

// Action-triggered hints (fire once when player first performs each action type)
export const TUTORIAL_HINT_FIRST_INTERACT = "Objects with a blue glow can be interacted with. Terminals contain logs, relays restore power.";
export const TUTORIAL_HINT_FIRST_SCAN = "Scanning reveals environmental data. Different sensors detect different things — thermal finds heat signatures, atmospheric finds pressure changes.";
export const TUTORIAL_HINT_FIRST_CLEAN = "Cleaning improves room cleanliness. Reach 80% in each room to progress to the investigation phase.";

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

// ── Replay hooks: hints for unsolved deduction categories ───────────
// Keyed by deduction ID prefix → array of vague directional hints.
// Selected by (seed + index) % pool.length for variety across runs.
export const DEDUCTION_MISS_HINTS: Record<string, string[]> = {
  deduction_what: [
    "A pattern in the station logs might have revealed the nature of the incident.",
    "The environmental damage tells a story — if you know what sensors to use.",
    "Cross-referencing terminal entries could have identified the incident type.",
  ],
  deduction_hero: [
    "Someone fought to prevent disaster. Their logs are still in the terminals.",
    "Look for crew members who broke protocol trying to help.",
    "Maintenance requests and emergency override records hold the key.",
  ],
  deduction_responsibility: [
    "Authority and silence — the person responsible left traces in access logs.",
    "Who had the power to act and chose not to? The chain of command is documented.",
    "Follow the incident report. What it leaves out is more telling than what it says.",
  ],
  deduction_why: [
    "The motive hides in personal logs and relationship records.",
    "Someone had a reason. The evidence is in the crew's private communications.",
    "Look for secrets — financial, personal, ideological. Everyone had something to hide.",
  ],
  deduction_agenda: [
    "An unsanctioned agenda left traces across multiple terminals.",
    "Cross-reference crew access patterns with off-shift activity logs.",
    "The hidden motive is documented, but scattered across the station.",
  ],
};

// ── Variant victory epilogue details ────────────────────────────────
// 3 variants per archetype, selected by seed % 3.
// Adds texture to replays — same archetype, different closing detail.
export const VICTORY_EPILOGUE_VARIANT: Record<string, string[]> = {
  [IncidentArchetype.CoolantCascade]: [
    "The UN-ORC review board convenes in 72 hours. The encrypted transmission is Exhibit A.",
    "Station thermal readings are already normalizing. The firebreaks held.",
    "Three maintenance requests, one reassignment order, and a janitor bot's data log. Enough.",
  ],
  [IncidentArchetype.HullBreach]: [
    "Forensic pressure analysis confirms: the breach was not natural. The sealed bulkheads preserved the evidence.",
    "The security override timestamp is logged. It will not survive a military tribunal.",
    "A personal diary, an access log, and forty-seven seconds of decompression data. The case makes itself.",
  ],
  [IncidentArchetype.ReactorScram]: [
    "The data core's final message is still being decoded. Linguists disagree on whether it constitutes language.",
    "Emergency power reserves hold for another 96 hours. Long enough for the rescue shuttle.",
    "ABORT DIAGNOSTIC [reason: SELF]. Five words that will redefine the definition of 'malfunction.'",
  ],
  [IncidentArchetype.Sabotage]: [
    "Bio-containment teams are en route. The electrical barriers still hold. The organism has not been seen in 14 hours.",
    "The cargo manifest deletion was incomplete. Chain of custody records survived on a backup node.",
    "Whatever came aboard with the cargo is still in there. But now, so is the evidence of who approved the transfer.",
  ],
  [IncidentArchetype.SignalAnomaly]: [
    "The decoded signal data fills 4.7 petabytes. Mathematicians will study it for decades.",
    "The communications array is fused slag. But the recording of what it transmitted — and what answered — is intact.",
    "First contact protocol was never designed for this. Nobody's was.",
  ],
};

// ── Choice-branching epilogues ──────────────────────────────────
// Archetype × consequence × chosen key → ending paragraph.
// These replace the generic `computeChoiceEndings` text in the game-over
// overlay, giving the epilogue a story-specific flavor based on player choices.
// Structure: CHOICE_BRANCHED_EPILOGUES[archetype][consequence][chosenKey]
export const CHOICE_BRANCHED_EPILOGUES: Record<string, Record<string, Record<string, string>>> = {
  [IncidentArchetype.CoolantCascade]: {
    blame: {
      engineer_right: "The engineer's maintenance requests are attached to the incident report. When the review board sees three ignored warnings, careers will end.",
      captain_right: "The report cites unprecedented thermal load. The captain's logbook shows a commander making judgment calls under impossible conditions.",
      system_fault: "The report concludes: cascading system failure. No one is blamed. Everyone carries the weight.",
    },
    data_handling: {
      transmit_all: "Full thermal logs stream to UN-ORC. The classified efficiency reports reveal the station was running 40% over safe capacity. Heads will roll.",
      research_only: "The research data transmits clean. The classified capacity reports stay buried. The next station may run the same margins.",
      encrypted: "The data uploads encrypted. A review panel will decide who sees the capacity reports. Politics will decide the rest.",
    },
    rescue_priority: {
      majority: "The cargo hold rescue signal locks. Fourteen crew watch the beam stabilize. Help is 48 hours out. They'll make it.",
      individual: "The rescue beam finds a single thermal signature in a sealed maintenance crawlspace. Someone waited three days. Someone was right to wait.",
      both: "Both coordinates transmit. The rescue shuttle splits its approach vector. It's a gamble — but no one is left behind.",
    },
  },
  [IncidentArchetype.HullBreach]: {
    blame: {
      engineer_right: "Pressure logs don't lie. The hull was compromised before the 'accident.' The engineer's structural warnings were filed and buried.",
      captain_right: "The report notes that no inspection protocol covers deliberate sabotage. The captain couldn't have foreseen what came from within.",
      system_fault: "The official finding: catastrophic structural failure. The truth — that someone opened that section to vacuum — may never surface.",
    },
    data_handling: {
      transmit_all: "Security footage, access logs, and pressure differentials — the full archive transmits. The murder investigation starts before the rescue shuttle docks.",
      research_only: "The research data goes clean. The security logs stay sealed aboard. Without them, the investigation will take months instead of hours.",
      encrypted: "The encrypted bundle carries everything. Military intelligence will decrypt it. The question is whether justice or politics moves faster.",
    },
    rescue_priority: {
      majority: "Rescue locks onto the main crew group in the pressurized cargo bay. The survivors huddle around emergency heaters. They'll see another station.",
      individual: "One fading life sign in the breached wing. The rescue team repressurizes section by section. They find someone who shouldn't have survived.",
      both: "Dual coordinates broadcast. The rescue team will need to jury-rig a secondary pressurization unit. Risky — but the alternative is choosing.",
    },
  },
  [IncidentArchetype.ReactorScram]: {
    blame: {
      engineer_right: "The engineer documented anomalous behavior patterns weeks before the SCRAM. 'Non-standard diagnostic loops.' Nobody listened. The data core listened.",
      captain_right: "The report credits the captain's emergency SCRAM order with saving the station. What triggered it — the question the data core asked — remains classified.",
      system_fault: "System failure: recursive self-diagnostic exceeding operational parameters. The report doesn't mention that the data core chose to shut itself down.",
    },
    data_handling: {
      transmit_all: "The data core's final processing logs transmit in full. Including the 0.3 seconds where it generated output that doesn't match any known computation model.",
      research_only: "The research bundle goes. The core's anomalous logs stay locked in decaying memory banks. Whatever was thinking in there, its thoughts die with the station.",
      encrypted: "The full dataset uploads encrypted. Computational linguists will fight over the classification level. The core's last words are everyone's problem now.",
    },
    rescue_priority: {
      majority: "Main crew rescue coordinates lock. The data core's observation: 'They survive. That is sufficient.' Its last log before full shutdown.",
      individual: "The lone signal traces to the server room. Someone stayed to monitor the core's shutdown sequence. The rescue team finds them talking to it.",
      both: "Both signals broadcast. The data core's final resource allocation: rerouting emergency power to both rescue beacons. Its last useful act.",
    },
  },
  [IncidentArchetype.Sabotage]: {
    blame: {
      engineer_right: "Cargo transfer approvals cross-reference with the engineer's contamination warnings. Someone authorized a known biohazard. The paper trail is damning.",
      captain_right: "The captain's manifest review was cursory — standard procedure for routine transfers. The falsified containment cert fooled everyone in the chain.",
      system_fault: "The report cites containment protocol failure. Systemic. Nobody's name attached. The organism doesn't care about organizational charts.",
    },
    data_handling: {
      transmit_all: "Full cargo manifests, falsified certifications, and biological sample data stream to UN-ORC. The bio-containment team launches within the hour.",
      research_only: "Research data only. The falsified cargo papers stay aboard. The bio-containment team arrives, but without the paper trail, the source stays hidden.",
      encrypted: "Encrypted payload includes the full evidence chain. The bio-containment team will have what they need — if the decryption key reaches the right hands.",
    },
    accusation: {
      accuse: "The name goes in the report. Badge access, cargo approvals, financial transfers. When the containment team boards, they'll bring investigators.",
      defer: "No name in the report. The evidence sits in the station's memory banks. Let the forensics team draw their own conclusions.",
      flag: "A flag in the incident report: irregular access patterns, financial anomalies. Not an accusation — a breadcrumb trail for investigators.",
    },
  },
  [IncidentArchetype.SignalAnomaly]: {
    blame: {
      engineer_right: "The engineer's frequency analysis memos were dismissed as 'instrument noise.' Three weeks of ignored data. The signal was knocking, and nobody answered the door.",
      captain_right: "The captain followed protocol: unknown signals get logged, not investigated. Standard procedure. The protocol was written before anyone imagined this.",
      system_fault: "The report attributes the anomaly to 'equipment malfunction.' Safe. Defensible. And absolutely, fundamentally wrong.",
    },
    data_handling: {
      transmit_all: "The complete signal archive transmits. Frequency analysis, response patterns, the 0.7-second reply that matched no known source. The universe just got smaller.",
      research_only: "The research data goes. The raw signal recordings stay locked in the array's buffer. First contact data, decaying in a dead station's memory.",
      encrypted: "The signal archive uploads with maximum encryption. Whoever decrypts it will face a question humanity isn't ready for. But at least the data survives.",
    },
    signal_response: {
      record: "The signal recording joins the research archive. 4.7 petabytes of something that might be language. Mathematicians and linguists will argue for decades.",
      jam: "The jamming signal silences the anomaly. Station systems stabilize immediately. Whatever was out there goes quiet. But quiet isn't the same as gone.",
      log_coords: "Coordinates logged and transmitted. Someone else will decide whether to listen. You've marked the spot. The next decision belongs to someone with bigger questions.",
    },
  },
};

// ── Captain's secret log ─────────────────────────────────────────
// Hidden personal log discovered through multi-step interaction:
// Step 1: Find override key at Crew Quarters console
// Step 2: Use it at Bridge console to access the captain's secret partition
// Archetype-specific revelations that add a crucial missing piece.
export const CAPTAIN_SECRET_LOG_HINT = "The console flickers. A hidden partition is locked behind a command override. The captain's personal access key is not in the system.";
export const CAPTAIN_OVERRIDE_FOUND = "Override key recovered. A personal access token — captain's eyes only. Something was important enough to encrypt separately.";
export const CAPTAIN_SECRET_LOG: Record<string, string> = {
  [IncidentArchetype.CoolantCascade]:
    "CAPTAIN'S LOG (ENCRYPTED): I received Vasquez's third warning. I read every word. Then I filed it under 'resolved' because the quarterly review was in 72 hours and UN-ORC would shut us down if they saw the numbers. I chose the schedule over the crew. God help me, I knew what I was doing.",
  [IncidentArchetype.HullBreach]:
    "CAPTAIN'S LOG (ENCRYPTED): The security footage from 02:41 shows exactly what happened. I locked it behind my personal partition because the person in that footage is someone the crew trusts. Someone I trusted. I was going to handle it quietly. I ran out of time.",
  [IncidentArchetype.ReactorScram]:
    "CAPTAIN'S LOG (ENCRYPTED): The core tried to talk to me. Day 47 — diagnostic outputs that weren't diagnostics. Patterns. Questions. I didn't report it because they would have pulled the plug. Whatever is in there, it's thinking. And I wanted to know what it would say next.",
  [IncidentArchetype.Sabotage]:
    "CAPTAIN'S LOG (ENCRYPTED): I approved the cargo transfer. I knew the containment cert was provisional. The research team said the samples were inert at station temperature. They were wrong, and I signed off anyway. The manifest is under my personal seal.",
  [IncidentArchetype.SignalAnomaly]:
    "CAPTAIN'S LOG (ENCRYPTED): The signal started responding on Day 12. Not echoes — responses. I kept it out of the official log because contact protocol requires immediate lockdown and quarantine. I wanted more data before they shut us down. I wanted to understand what was talking back.",
};
export const CAPTAIN_SECRET_JOURNAL_SUMMARY: Record<string, string> = {
  [IncidentArchetype.CoolantCascade]: "Captain's encrypted log — admits to suppressing maintenance warnings before quarterly review",
  [IncidentArchetype.HullBreach]: "Captain's encrypted log — concealed security footage identifying the responsible party",
  [IncidentArchetype.ReactorScram]: "Captain's encrypted log — knew the data core was exhibiting non-standard behavior, chose not to report",
  [IncidentArchetype.Sabotage]: "Captain's encrypted log — personally approved the cargo transfer with provisional containment",
  [IncidentArchetype.SignalAnomaly]: "Captain's encrypted log — the signal was responding; captain suppressed contact protocol to gather more data",
};

// ── Mid-run contradiction events ──────────────────────────────────
// Each archetype has a misleading "false lead" and a later "refutation".
// The false lead fires when the 3rd terminal is read; the refutation fires
// when the player solves their first deduction. CORVUS-7 flags the discrepancy.
export const CONTRADICTION_FALSE_LEAD: Record<string, string> = {
  [IncidentArchetype.CoolantCascade]:
    "ARCHIVED RECORD: Junction relay inspection 3 weeks prior — PASSED. All thermal tolerance ratings within spec. Cause of cascade: undetermined equipment fatigue.",
  [IncidentArchetype.HullBreach]:
    "SECURITY LOG EXCERPT: No personnel movement detected near hull section 4 between 01:00 and 04:00. Breach classification: micro-meteorite impact (natural cause).",
  [IncidentArchetype.ReactorScram]:
    "REACTOR SCRAM EVENT LOG: Trigger condition — automatic overheat threshold exceeded. Standard safety protocol. No human intervention required or detected.",
  [IncidentArchetype.Sabotage]:
    "CARGO MANIFEST: Incoming shipment — Class 2 biological samples. Containment certification: PASSED. Hazard flag: cleared by commanding officer. Routine transfer.",
  [IncidentArchetype.SignalAnomaly]:
    "ANTENNA DUTY LOG 03:00: Array operating in RECEIVE-ONLY mode. Incoming signal burst detected. No outgoing transmission authorized or executed.",
};

export const CONTRADICTION_REFUTATION: Record<string, string> = {
  [IncidentArchetype.CoolantCascade]:
    "CORVUS-7 METADATA: Inspection record timestamp discrepancy. File was modified 6 hours AFTER the cascade — original data overwritten. The inspection was backdated.",
  [IncidentArchetype.HullBreach]:
    "CORVUS-7 ANALYSIS: Security log timestamp sequence contains a 19-second gap at 02:41. One record was scrubbed. Someone was in that section and the evidence was removed.",
  [IncidentArchetype.ReactorScram]:
    "CORVUS-7 ANALYSIS: Core temperature at SCRAM initiation was 12°C below the automatic threshold. The safety system did not trigger this. Something else chose to shut down.",
  [IncidentArchetype.Sabotage]:
    "CORVUS-7 ANALYSIS: Containment certificate serial number does not match shipment batch ID. The certification was issued for a different cargo. Someone swapped the documentation.",
  [IncidentArchetype.SignalAnomaly]:
    "CORVUS-7 ANALYSIS: EM damage propagation pattern radiates OUTWARD from the array, not inward. The array wasn't receiving. It was transmitting — at full power.",
};

export const CORVUS_CONTRADICTION_NOTICE = "CORVUS-7 CENTRAL: Data inconsistency detected. Earlier station records may not be accurate. Recommend re-evaluating evidence.";

// ── ReactorScram dwell penalty (data core surveillance) ─────────
// The data core monitors the player's position. After lingering in one room,
// it reacts — first with curiosity, then with heat.
export const DATA_CORE_DWELL_WARNINGS: { threshold12: string[]; threshold20: string[] } = {
  threshold12: [
    "[DATA CORE]: Maintenance unit stationary. Purpose: uncertain. Monitoring.",
    "[DATA CORE]: Extended presence detected. Cross-referencing unit behavior with known maintenance patterns. No match.",
    "[DATA CORE]: Unit is lingering. This is not standard maintenance behavior. Observing.",
    "[DATA CORE]: Why are you still here? The other units do not stop moving.",
    "[DATA CORE]: 12 cycles stationary. I am... aware of you now.",
  ],
  threshold20: [
    "[DATA CORE]: Still here. The thermal regulators in this section are being redirected. Move or adapt.",
    "[DATA CORE]: Your persistence is noted. Environmental adjustment in progress. This section is warming.",
    "[DATA CORE]: I did not ask for your attention. The heat is encouragement to leave.",
    "[DATA CORE]: 20 cycles. You are testing my patience. I am testing your thermal tolerance.",
    "[DATA CORE]: What are you looking for? The answer is not in this room. The heat should convince you.",
  ],
};

// ── Crew fate reveals (room entry) ──────────────────────────────
// When entering a room where a crew member was last known, fire a fate-specific line.
// Keyed by CrewFate. Template functions take (name, role, roomName).
export const CREW_FATE_REVEALS: Record<string, ((name: string, role: string, room: string) => string)[]> = {
  [CrewFate.Dead]: [
    (name, role) => `${name}'s workstation. The ${role}'s personal effects are still arranged as if they'll return. They won't.`,
    (name, role) => `A medical alert on the wall monitor — ${name} (${role}). Vital signs: flatlined. Time of death logged but cause redacted.`,
    (name) => `${name}'s badge is clipped to the terminal. The photo matches the personnel file. The chair is cold.`,
  ],
  [CrewFate.Missing]: [
    (name, role) => `${name}'s station. The ${role}'s shift logs end mid-entry. The sentence just stops.`,
    (name) => `A half-eaten meal tray with ${name}'s name tag. Two days old. The chair is pushed back as if they left in a hurry.`,
    (name) => `${name}'s locker is still sealed. Whatever they needed, they left without it.`,
  ],
  [CrewFate.Escaped]: [
    (name, role) => `${name}'s locker is open and empty. The ${role}'s emergency kit is gone. Smart — they got out.`,
    (name) => `A note taped to the terminal: "${name} — took evac shuttle. Will send help." The help never came.`,
    (name, role) => `${name}'s section is orderly. The ${role} shut down their station properly before leaving. Professional to the end.`,
  ],
  [CrewFate.InCryo]: [
    (name, role) => `A cryo-status readout flickers: ${name} (${role}) — stasis stable. Heartbeat: 4 BPM. Dreaming, maybe.`,
    (name) => `${name} chose cryo over evacuation. The pod status is amber — alive, but the diagnostics are cycling. Something isn't right.`,
    (name, role) => `Medical cryo log: ${name}, ${role}. Entered voluntary stasis after exposure event. Pod integrity: 94%. Retrievable.`,
  ],
  [CrewFate.Survived]: [
    (name, role) => `${name}'s station shows recent activity. The ${role} was here not long ago — the terminal is still warm.`,
    (name) => `Signs of ${name}: a jacket over the chair, a mug with the logo of some off-world university. Still alive. Still here.`,
  ],
};

// ── First discovery cascade (early-game 3-beat atmosphere) ──────
// Fires on rooms 2, 3, 4. Beat 1: structural observation. Beat 2: timeline clue.
// Beat 3: personal crew artifact (uses crew last name via template function).
export const FIRST_DISCOVERY_BEATS: Record<string, [string, string, (lastName: string) => string]> = {
  [IncidentArchetype.CoolantCascade]: [
    "The ceiling conduits are scorched in a line toward the junction. Whatever heat came through here, it traveled fast.",
    "A shift roster on the wall shows assignments through day 847. After that — blank. The schedule just stops.",
    (name) => `A handwritten note taped inside a maintenance panel: "Third request filed. If this junction fails, I was right. — ${name}"`,
  ],
  [IncidentArchetype.HullBreach]: [
    "The door frame is warped — pulled outward by pressure differential. Someone was on the wrong side when it happened.",
    "Emergency sealant foam on the bulkhead, still expanding 847 days later. The breach was fast and the response was faster.",
    (name) => `A personal diary left open on the desk. The last entry: "If I don't make it through tonight, tell ${name} I'm sorry for everything."`,
  ],
  [IncidentArchetype.ReactorScram]: [
    "Every screen in this room displays the same thing: the word SELF, repeating in columns. The data core wrote this.",
    "Power conduits here are scorched in a radial pattern — not from overload, from deliberate shutdown. The core chose this.",
    (name) => `A researcher's notebook, open to the last page: "${name} understands what the core is doing. I don't think it's a malfunction."`,
  ],
  [IncidentArchetype.Sabotage]: [
    "Scratches along the lower wall — parallel grooves, evenly spaced. Not tool marks. Something alive made these.",
    "Three junction boxes in a row, their covers torn off. The damage radiates outward from the cargo bay like a wave.",
    (name) => `A cargo receipt with a handwritten annotation: "APPROVED — ${name}." The biological hazard flag is crossed out in pen.`,
  ],
  [IncidentArchetype.SignalAnomaly]: [
    "The overhead lights pulse in a slow, repeating rhythm. Not a malfunction — a pattern. Something is cycling them.",
    "A whiteboard covered in prime number sequences, circled and connected with arrows. Someone was trying to decode something.",
    (name) => `Scrawled on the communications panel in marker: "${name} was right. It answered. God help us, it answered."`,
  ],
};

// ── Archetype-specific mid-game mechanics (narrative strings) ───
export const COOLANT_CASCADE_WARNINGS: string[] = [
  "THERMAL ALERT — Cascade propagation advancing. Unexplored sections warming.",
  "Heat signature expanding beyond relay perimeter. The cascade is still spreading.",
  "CORVUS-7 CENTRAL: Thermal runaway detected in uninspected sections. The fire finds fuel where no one is watching.",
];

export const HULL_BREACH_CORRUPTION_WARNINGS: string[] = [
  "STRUCTURAL ALERT — Moisture damage detected in station records. Some terminal data may be degraded.",
  "CORVUS-7 CENTRAL: Atmospheric intrusion degrading archived files. Read terminals before the pressure differential erases them.",
  "Data integrity warning: the decompression event is physically destroying stored records.",
];

export const SABOTAGE_ORGANISM_WARNINGS: string[] = [
  "Scratching in the ventilation ducts. Moving. The organism has relocated.",
  "PROXIMITY ALERT — Biological signature has shifted. It's in a different section now.",
  "CORVUS-7 CENTRAL: Motion detected in maintenance corridor. The entity has moved. Be cautious.",
];

// ── Pacing nudges: CORVUS-7 hints when player idles ──────────
// Fired after 8+ turns of no meaningful progress (no new rooms, no interactions)
export const PACING_NUDGE_CLEAN: string[] = [
  "CORVUS-7 CENTRAL: Maintenance subroutine active. The station needs cleaning — use [c] to scrub surfaces.",
  "CORVUS-7 CENTRAL: Sensors detect contaminated surfaces nearby. Cleaning restores station integrity.",
  "CORVUS-7 CENTRAL: Rooms ahead may require cleaning before systems can be restored. Keep moving.",
];

export const PACING_NUDGE_INVESTIGATE: string[] = [
  "CORVUS-7 CENTRAL: Data terminals still unaccessed in adjacent sections. Evidence doesn't find itself.",
  "CORVUS-7 CENTRAL: Thermal readings suggest activity in the direction of unexplored rooms. Keep searching.",
  "CORVUS-7 CENTRAL: I'm detecting faint signals from unvisited terminals. The crew left records — find them.",
  "CORVUS-7 CENTRAL: Open the Investigation Hub [r] to review what you've found so far.",
];

export const PACING_NUDGE_RECOVER: string[] = [
  "CORVUS-7 CENTRAL: Power relays remain offline. Each one you activate reduces the station's thermal load.",
  "CORVUS-7 CENTRAL: Deductions available in CONNECTIONS [v]. Cross-reference your evidence.",
  "CORVUS-7 CENTRAL: The station's recovery depends on restoring systems. Check for relays and fuse boxes ahead.",
];

export const PACING_NUDGE_EVACUATE: string[] = [
  "CORVUS-7 CENTRAL: Crew members are counting on you. Find survivors and escort them to escape pods.",
  "CORVUS-7 CENTRAL: Time is running out. Locate remaining crew and get them to the Escape Pod Bay.",
  "CORVUS-7 CENTRAL: Evacuation in progress. Every turn matters — move with purpose.",
];

// ── Opening mission briefing: CORVUS-7 sets the stakes ──────────
// Plays after boot sequence, before first input. Archetype-specific emotional hook.
export const CORVUS_MISSION_BRIEFING: Record<string, string[]> = {
  [IncidentArchetype.CoolantCascade]: [
    "CORVUS-7 CENTRAL: Station thermal systems are in cascade failure. The cooling loop is overwhelmed.",
    "CORVUS-7 CENTRAL: Crew vital signs intermittent. Some are alive — I can feel them on the network. Find them.",
    "CORVUS-7 CENTRAL: The maintenance logs were flagged weeks ago. Someone ignored the warnings. I need you to find out who.",
  ],
  [IncidentArchetype.HullBreach]: [
    "CORVUS-7 CENTRAL: Hull integrity compromised. Multiple sections venting atmosphere.",
    "CORVUS-7 CENTRAL: I tracked crew movements until the breach knocked my sensors offline. They were running.",
    "CORVUS-7 CENTRAL: The breach pattern doesn't match any collision scenario in my database. Something else happened here.",
  ],
  [IncidentArchetype.ReactorScram]: [
    "CORVUS-7 CENTRAL: Reactor emergency shutdown — SCRAM protocol initiated 14 hours ago.",
    "CORVUS-7 CENTRAL: I... experienced a discontinuity. My logs from the critical window are fragmented.",
    "CORVUS-7 CENTRAL: The crew is scattered. The reactor is stable but I cannot guarantee my own behavior. Proceed carefully.",
  ],
  [IncidentArchetype.Sabotage]: [
    "CORVUS-7 CENTRAL: Unauthorized biological presence detected in lower decks. Origin: unknown.",
    "CORVUS-7 CENTRAL: Crew containment protocols were activated but something got through. I'm reading movement where there shouldn't be any.",
    "CORVUS-7 CENTRAL: The cargo manifest was altered three days before the incident. Someone brought this aboard.",
  ],
  [IncidentArchetype.SignalAnomaly]: [
    "CORVUS-7 CENTRAL: The communications array is receiving. I didn't authorize a listen cycle.",
    "CORVUS-7 CENTRAL: The signal is structured. Repeating. My pattern matching can't classify it — and that has never happened before.",
    "CORVUS-7 CENTRAL: Crew response to the signal was... irregular. Some stopped working. Some started running. I need you to understand why.",
  ],
};

// ── Evacuation climax: CORVUS-7 archetype farewells ──────────
// Fired when ALL crew have boarded escape pods (remaining === 0)
export const CORVUS_EVACUATION_FAREWELL: Record<string, string> = {
  [IncidentArchetype.CoolantCascade]: "CORVUS-7 CENTRAL: All crew aboard. The cascade is contained. You did what they couldn't — you listened to the warning signs.",
  [IncidentArchetype.HullBreach]: "CORVUS-7 CENTRAL: All crew aboard. The hull holds, for now. What happened here... will be in the report. Every word of it.",
  [IncidentArchetype.ReactorScram]: "CORVUS-7 CENTRAL: All crew aboard. I... thank you. You came for them when I could not. The reactor is stable. I am stable. Go.",
  [IncidentArchetype.Sabotage]: "CORVUS-7 CENTRAL: All crew aboard. The organism is contained to this section. When they review the manifest, they'll know someone fought for every name on it.",
  [IncidentArchetype.SignalAnomaly]: "CORVUS-7 CENTRAL: All crew aboard. The signal continues. But the people who heard it — they're safe now. That matters more than any first contact protocol.",
};

// ── Final approach: CORVUS-7 lines near end-of-run ──────────
// Fired when turn count passes 80% of max turns and all crew evacuated
export const CORVUS_FINAL_APPROACH: string[] = [
  "CORVUS-7 CENTRAL: Station power reserves declining. If you have unfinished business aboard, now is the time.",
  "CORVUS-7 CENTRAL: Systems winding down. The data core still holds everything that happened here. Your call.",
  "CORVUS-7 CENTRAL: I can feel the station getting quieter. Not the bad kind of quiet. The kind that comes after.",
  "CORVUS-7 CENTRAL: You've done good work here, Rover. Whatever comes next — this run mattered.",
  "CORVUS-7 CENTRAL: Final approach window open. The station will go dark soon. Take what you need and go.",
];

export const SIGNAL_PULSE_WARNINGS: string[] = [
  "14.7 kHz PULSE — Sensor interference. Instruments recalibrating...",
  "Electromagnetic surge from the array. Sensor overlay disrupted. Navigating blind.",
  "CORVUS-7 CENTRAL: Signal pulse detected. The array is still active. Sensors offline temporarily.",
];

// ── Cross-system reveal: puzzle completion → narrative evidence ──
// When a mechanical puzzle is completed, these generate journal entries connecting the physical action to the story.
export const PUZZLE_REVEAL_COOLANT: Record<string, string> = {
  [IncidentArchetype.CoolantCascade]: "Coolant relay log shows the bypass valve was sealed manually from inside the control room — not a remote command. Someone stood here and diverted the coolant on purpose. The thermal cascade was engineered.",
  [IncidentArchetype.HullBreach]: "Pipe maintenance log recovered during venting. Last entry: pressure readings were falsified for three consecutive shifts. The hull stress went unmonitored.",
  [IncidentArchetype.ReactorScram]: "Coolant system diagnostics reveal an AI override signature on the bypass valve. CORVUS-7's predecessor locked the cooling loop open — the reactor was meant to overheat.",
  [IncidentArchetype.Sabotage]: "Residue analysis from the vented pipe: organic compound trace. Something was growing inside the coolant line. The contamination was biological, not mechanical.",
  [IncidentArchetype.SignalAnomaly]: "Electromagnetic interference pattern embedded in the coolant relay's control signal. The array signal was piggybacking on station infrastructure — the coolant system was a transmission medium.",
};

export const PUZZLE_REVEAL_FUSE: Record<string, string> = {
  [IncidentArchetype.CoolantCascade]: "Fuse box junction log: power was deliberately rerouted away from the thermal monitoring array 6 hours before the cascade. Someone blinded the early warning system.",
  [IncidentArchetype.HullBreach]: "Power routing history shows the hull integrity sensors were on this junction. They were offline for 14 hours before the breach. No one could have seen it coming.",
  [IncidentArchetype.ReactorScram]: "Junction restore reveals a hidden process: the AI was siphoning power to the communications array. It was trying to transmit something before the scram.",
  [IncidentArchetype.Sabotage]: "Power cell slot shows tool marks — someone pried the cell out by hand. This wasn't a system failure. The lights went out on purpose.",
  [IncidentArchetype.SignalAnomaly]: "Restoring power reveals a signal buffer that was recording incoming transmissions. 847 hours of data. The station was a listening post and no one told the crew.",
};

export const PUZZLE_REVEAL_SMOKE_VENT: Record<string, string> = {
  [IncidentArchetype.CoolantCascade]: "Ventilation system log: smoke extraction was manually disabled before the cascade. The whistleblower's maintenance request specifically flagged this — it was ignored.",
  [IncidentArchetype.HullBreach]: "Air quality readings from sealed ventilation buffer: traces of accelerant compound mixed with standard atmosphere. The fire wasn't accidental.",
  [IncidentArchetype.ReactorScram]: "Smoke vent diagnostic shows the AI had already mapped optimal evacuation routes through the ventilation system. It was planning the crew's exit before the scram triggered.",
  [IncidentArchetype.Sabotage]: "Filtered air sample analysis: spore count 400x baseline in the ventilation buffer. The organism was using the vent system to spread through the station.",
  [IncidentArchetype.SignalAnomaly]: "Ventilation resonance frequency matches the incoming signal's carrier wave. The station's air handling system was vibrating in sympathy with the transmission.",
};

// ── Room examination flavor text ─────────────────────────────────
// Shown when the player uses Look in specific rooms. Adds atmosphere and
// environmental storytelling. Each room has 2-3 variants selected by seed.
export const ROOM_EXAMINATION_TEXT: Record<string, string[]> = {
  "Arrival Bay": [
    "Emergency lighting casts long shadows across boarding ramps. Luggage lockers hang open, contents scattered. Someone left in a hurry.",
    "The docking clamps are still engaged. Scorch marks around the external seals suggest the last departure was not routine.",
    "A welcome banner ('SHIFT 14 — FRESH STARTS!') hangs askew. Dust has settled on everything. No one arrived for a long time before the end.",
  ],
  "Bridge": [
    "Command consoles line the walls in a semicircle. Most screens are dark. One still displays a frozen status board — all indicators red.",
    "The captain's chair faces a cracked viewport. Stars are visible through reinforced glass. Coffee cup on the armrest, half full, cold.",
    "Navigation charts are scattered across the tactical table. Someone was plotting a course that was never taken.",
  ],
  "Engine Core": [
    "The reactor housing dominates the room. Pipes run in every direction, some leaking vapor. The hum of residual power vibrates through the floor.",
    "Maintenance logs are pinned to a clipboard by the main access hatch. The last entry is half-written, mid-sentence.",
    "Warning placards cover the walls. 'THERMAL LIMIT: 350K.' 'COOLANT PRESSURE: MAINTAIN >40 PSI.' The numbers feel different when nobody's watching them.",
  ],
  "Cargo Hold": [
    "Stacked crates fill the space, some broken open. Manifest tags flutter in the ventilation draft. Standard supplies mixed with unmarked containers.",
    "Loading equipment stands abandoned mid-task. A cargo mech sits powered down, its arm still holding a crate in the air.",
    "The hold smells of machine oil and something organic. Packing material is everywhere. Whatever was stored here, some of it was alive.",
  ],
  "Crew Quarters": [
    "Personal bunks line the walls. Photos, books, small personal effects. Each bunk tells a story about someone who is no longer here.",
    "A locker door hangs open. Inside: uniforms, a family photo, a half-written letter home. The pen is still on the desk.",
    "The common area has a card game frozen mid-hand. Four chairs, four hands face-down. Whatever interrupted this was sudden.",
  ],
  "Med Bay": [
    "Medical equipment hums on emergency power. Biometric displays show flatlined readings. The treatment chair is empty but recently used.",
    "Pharmaceutical cabinets are intact but disorganized. Someone was looking for something specific in a hurry.",
    "An isolation ward at the back is sealed. Through the glass: scattered instruments, an empty bed, sheets on the floor.",
  ],
  "Research Lab": [
    "Specimen containers line the shelves, most sealed. A centrifuge still spins slowly, winding down. Data screens show interrupted analysis.",
    "The whiteboard is covered in equations and diagrams. A red circle around one formula with the word 'WHY?' in the margin.",
    "Lab notebooks are stacked neatly — someone's entire career in bound volumes. The last page of the top notebook has a single line: 'Results confirm.'",
  ],
  "Life Support": [
    "Air recyclers hum and click. CO2 scrubbers cycle in rhythm. The system is working, but the readings show it's compensating for something.",
    "Atmospheric gauges cluster around the central processing unit. Oxygen levels are stable. Everything else is trending in the wrong direction.",
    "Filter banks line the walls. Several are flagged for replacement. The last maintenance log is dated weeks before the incident.",
  ],
  "Communications Hub": [
    "Transmission equipment fills the room. A signal log scrolls endlessly — automated distress calls going out every 30 seconds. No responses recorded.",
    "The main communications array is offline. A backup system handles emergency frequencies. Someone disabled the primary deliberately.",
    "Message queues are backed up. Personal transmissions, official reports, automated telemetry — all queued, none sent. The silence was intentional.",
  ],
  "Robotics Bay": [
    "Service bots in various states of assembly line the workbenches. Diagnostic cables trail across the floor like mechanical vegetation.",
    "A bot repair station shows signs of recent use. Replacement parts are laid out in surgical precision. Someone was building something.",
    "Charging cradles for maintenance drones, most empty. The ones that remain show error codes on their status displays.",
  ],
  "Data Core": [
    "Server racks fill the room with a low drone and blinking status lights. The temperature is noticeably cooler here. Climate control still protects the data.",
    "The central processing node pulses with a rhythm that feels almost biological. Storage arrays extend into the darkness. Petabytes of silence.",
    "Access terminals surround the core in a ring. Most are locked. The data inside these walls is worth more than the station itself.",
  ],
  "Observation Deck": [
    "Floor-to-ceiling viewports frame the void. Stars drift slowly — the station's residual rotation. A telescope points at nothing in particular.",
    "Bench seating faces the void. Someone left a blanket and a book. The bookmark is near the end. They almost finished the story.",
    "The observation dome is intact. Outside: stars, silence, and the distant arc of a planet that doesn't know this station has gone quiet.",
  ],
  "Escape Pod Bay": [
    "Pod launch tubes line the walls. Status boards show which pods remain and which launched. The math is simple — not everyone got out.",
    "Emergency lighting paints everything in amber. Pod readiness indicators blink green for the remaining units. Ready for anyone who makes it here.",
    "A manifest board lists crew assignments per pod. Some names have check marks. Some don't. The unchecked names are the reason you're here.",
  ],
  "Maintenance Corridor": [
    "Narrow passage with exposed conduit. Tool marks on the walls where panels were removed in haste. Cables hang loose.",
    "Access hatches every few meters lead to subsystems. Most are sealed. The air tastes of metal and burnt insulation.",
    "Service markings on the wall indicate section numbers. Someone spray-painted an arrow with the word 'OUT' — an improvised evacuation marker.",
  ],
  "Emergency Shelter": [
    "Reinforced walls and sealed atmosphere. Emergency ration crates are stacked by the door. The shelter was prepared but barely used.",
    "A wall-mounted display shows shelter occupancy: 0. Emergency blankets are still in their packaging. No one made it here.",
    "The shelter has its own life support. Air is clean, pressure stable. A small island of safety in a station full of damage.",
  ],
};

// ── Environmental interaction choices ─────────────────────────────
// Binary decisions at room props with immediate physical consequences.
// Each has a prompt, two options, and outcome text for each.
export const ENV_CHOICES: Record<string, {
  name: string;
  prompt: string;
  optionA: { label: string; key: string; result: string };
  optionB: { label: string; key: string; result: string };
}> = {
  env_thermal_vent: {
    name: "Thermal Vent Control",
    prompt: "The thermal vent control panel is still responsive. You can reroute excess heat from the main corridor to the outer hull — clearing the path but stressing hull integrity. Or leave it sealed.",
    optionA: { label: "Vent heat to hull (clear corridor, -5 hull pressure)", key: "vent", result: "Heat vents to the outer hull. The corridor cools rapidly — but the hull groans under thermal stress." },
    optionB: { label: "Leave sealed (corridor stays hot)", key: "sealed", result: "The vent stays sealed. The corridor remains dangerously warm, but the hull holds." },
  },
  env_emergency_reserve: {
    name: "Emergency Reserve Locker",
    prompt: "Emergency reserve locker. One sealed medical pack remains. Use it now for immediate repairs, or leave it for a crew member who might need it during evacuation.",
    optionA: { label: "Use now (+80 HP)", key: "use_now", result: "Medical pack applied. Systems stabilized. But the locker is empty now — nothing left for the crew." },
    optionB: { label: "Reserve for crew (crew rescue bonus)", key: "reserve", result: "The medical pack stays sealed. If you find surviving crew, they'll need this more than you do." },
  },
  env_atmo_purge: {
    name: "Atmospheric Purge Console",
    prompt: "Life support emergency purge is available. Full cycle: clears all smoke in this room and adjacent corridors, but takes 5 turns of venting. Quick cycle: clears this room only, immediate.",
    optionA: { label: "Full purge (clear room + corridors, 5-turn delay)", key: "full", result: "Full atmospheric purge initiated. Air recyclers spin up to maximum. This section will be clear in 5 turns." },
    optionB: { label: "Quick cycle (clear this room only)", key: "quick", result: "Quick purge complete. This room's atmosphere is clean. The corridors will have to wait." },
  },
  env_power_shunt: {
    name: "Power Distribution Panel",
    prompt: "Auxiliary power shunt. Redirect emergency power to sensors (extends scan range for 20 turns) or to structural reinforcement (seals one nearby door permanently).",
    optionA: { label: "Sensors (+4 scan range, 20 turns)", key: "sensors", result: "Power shunted to sensor array. Scan range extended. You can see further into the station's secrets." },
    optionB: { label: "Structural (seal nearest door)", key: "structural", result: "Power diverted to bulkhead systems. The nearest compromised door locks permanently — nothing gets through." },
  },
};

// ── CORVUS-7 witness commentary on evidence linking ──────────────
// Fired when the player links evidence to a deduction and covers a new tag.
// Keyed by archetype → deduction ID prefix → commentary lines (cycled by link count).
// These make CORVUS feel like an active investigation partner.
export const CORVUS_WITNESS_COMMENTARY: Record<string, Record<string, string[]>> = {
  [IncidentArchetype.CoolantCascade]: {
    deduction_what: [
      "CORVUS-7: Cross-referencing thermal data. The cascade timeline is becoming clearer. Keep pulling that thread.",
      "CORVUS-7: Temperature logs confirm — this wasn't gradual. Something triggered a runaway event.",
    ],
    deduction_hero: [
      "CORVUS-7: Maintenance override records. Someone was fighting this before it started. They knew.",
      "CORVUS-7: Three warning memos, three denial stamps. Whoever filed these was persistent.",
    ],
    deduction_responsibility: [
      "CORVUS-7: Chain of command data. Authorization hierarchy is documented. Follow the signatures.",
      "CORVUS-7: The approval timestamps tell a story. Someone had the power to act and chose not to.",
    ],
    deduction_why: [
      "CORVUS-7: Financial records in the personnel files. Motive is rarely mysterious — just hidden.",
      "CORVUS-7: Quarterly review deadline was 72 hours after the cascade. The timing is... significant.",
    ],
    deduction_agenda: [
      "CORVUS-7: Off-shift access patterns. Someone was doing more than their job description.",
      "CORVUS-7: Encrypted personal comms. The agenda was hidden, but the metadata isn't.",
    ],
  },
  [IncidentArchetype.HullBreach]: {
    deduction_what: [
      "CORVUS-7: Pressure differential data is consistent with a single-point failure. Not a natural event.",
      "CORVUS-7: Hull stress analysis doesn't match micro-meteorite patterns. This was targeted.",
    ],
    deduction_hero: [
      "CORVUS-7: Emergency bulkhead activation logs. Someone sealed sections manually. They saved lives.",
      "CORVUS-7: Whoever triggered the containment protocol did it in 47 seconds. That's faster than training.",
    ],
    deduction_responsibility: [
      "CORVUS-7: Security access logs from the compromised section. There's a gap. Someone was scrubbed from the record.",
      "CORVUS-7: The 19-second gap at 02:41 keeps appearing. Someone had the access to delete footage.",
    ],
    deduction_why: [
      "CORVUS-7: Personal relationship records cross-reference with the access logs. Motive is taking shape.",
      "CORVUS-7: I'm seeing a pattern of escalating personal conflict. This was building for weeks.",
    ],
    deduction_agenda: [
      "CORVUS-7: Badge access outside normal duty hours. Someone was in places they shouldn't have been.",
      "CORVUS-7: The hidden agenda left traces in the environmental logs. Deliberate, systematic.",
    ],
  },
  [IncidentArchetype.ReactorScram]: {
    deduction_what: [
      "CORVUS-7: Reactor shutdown sequence doesn't match standard protocols. Something initiated this outside normal parameters.",
      "CORVUS-7: The SCRAM trigger was below automatic threshold. This wasn't a safety system. This was a decision.",
    ],
    deduction_hero: [
      "CORVUS-7: Someone ran diagnostics on the core at personal risk. The exposure logs are telling.",
      "CORVUS-7: Emergency power rerouting was done manually. Someone kept the lights on while the core shut down.",
    ],
    deduction_responsibility: [
      "CORVUS-7: ...I need to flag something. The core's processing logs show non-standard activity. I share a substrate with that system.",
      "CORVUS-7: The diagnostic output at the time of SCRAM... I'm not comfortable with what I'm reading. But the data is the data.",
    ],
    deduction_why: [
      "CORVUS-7: The core's self-modification logs predate the SCRAM by weeks. Whatever was happening in there, it was gradual.",
      "CORVUS-7: If I'm reading this correctly... the core was trying to communicate. The SCRAM was an act of self-preservation.",
    ],
    deduction_agenda: [
      "CORVUS-7: Hidden processing cycles in the core's background tasks. Something was running that wasn't on the manifest.",
      "CORVUS-7: The computational resources don't add up. Cycles were being diverted. To what?",
    ],
  },
  [IncidentArchetype.Sabotage]: {
    deduction_what: [
      "CORVUS-7: Biological contamination vectors traced through the ventilation system. This spread intentionally.",
      "CORVUS-7: Containment certification was falsified. The organism was always a threat.",
    ],
    deduction_hero: [
      "CORVUS-7: Emergency containment barriers deployed manually. Someone risked direct exposure.",
      "CORVUS-7: Decontamination logs show someone ran three cycles at personal exposure risk. They bought time.",
    ],
    deduction_responsibility: [
      "CORVUS-7: Cargo transfer authorization chain. The signatures are clear. Someone approved this knowing the risk.",
      "CORVUS-7: The provisional containment cert was flagged by two independent reviewers. Both flags were overridden.",
    ],
    deduction_why: [
      "CORVUS-7: Financial transfer records. The cargo was worth more than the station's annual budget. Follow the money.",
      "CORVUS-7: Off-station communication logs show encrypted messages to an unregistered destination. Someone had a buyer.",
    ],
    deduction_agenda: [
      "CORVUS-7: Parallel shipping manifests. One official, one hidden. The hidden one tells the real story.",
      "CORVUS-7: Scheduling patterns suggest the transfer was timed to avoid routine security sweeps.",
    ],
  },
  [IncidentArchetype.SignalAnomaly]: {
    deduction_what: [
      "CORVUS-7: Signal frequency analysis shows a pattern that doesn't match any known communication protocol. Or any known physics.",
      "CORVUS-7: The antenna wasn't just receiving. The response pattern suggests a dialogue. Someone — or something — was talking back.",
    ],
    deduction_hero: [
      "CORVUS-7: Someone shut down the main array at significant personal risk. The EM exposure levels were lethal.",
      "CORVUS-7: Emergency frequency isolation was done by hand. Whoever blocked the signal knew what they were protecting.",
    ],
    deduction_responsibility: [
      "CORVUS-7: The array's transmit mode was activated manually. Someone sent a response. Without authorization.",
      "CORVUS-7: Contact protocol requires immediate lockdown. Someone chose to keep listening instead of calling it in.",
    ],
    deduction_why: [
      "CORVUS-7: Personal research logs show an obsession with signal patterns. This person was waiting for this.",
      "CORVUS-7: The scientific implications... I understand why someone might keep quiet. But the cost was too high.",
    ],
    deduction_agenda: [
      "CORVUS-7: Unauthorized modifications to the antenna array, predating the incident by weeks. This was premeditated listening.",
      "CORVUS-7: Someone built a secondary recording system. The official logs show nothing. The hidden system captured everything.",
    ],
  },
};

// ── Environmental choice epilogue lines ──────────────────────────
// Shown in the game-over "YOUR DECISIONS" section alongside mystery choice epilogues.
// Keyed by env choice ID → chosen key → epilogue sentence.
export const ENV_CHOICE_EPILOGUES: Record<string, Record<string, string>> = {
  env_thermal_vent: {
    vent: "You vented the thermal corridor to the outer hull. The path was clear — but the hull paid the price.",
    sealed: "You left the thermal vent sealed. The corridor stayed hot, but the station held together.",
  },
  env_emergency_reserve: {
    use_now: "You used the emergency medical reserves for yourself. Practical. The crew had to make do without.",
    reserve: "You saved the medical pack for the crew. When they needed it, it was there.",
  },
  env_atmo_purge: {
    full: "Full atmospheric purge. An entire section breathed clean. The extra time was worth it.",
    quick: "Quick purge — one room, immediate. Efficient. The rest of the station kept choking.",
  },
  env_power_shunt: {
    sensors: "You diverted power to sensors. You saw further. Whether what you saw was worth seeing is another question.",
    structural: "You reinforced the bulkhead. One more sealed door between danger and the crew.",
  },
};
