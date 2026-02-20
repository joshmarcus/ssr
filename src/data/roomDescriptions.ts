/**
 * Room descriptions displayed when the player's bot enters a room for the
 * first time. Keyed by room name as defined in goldenSeedRooms.ts.
 *
 * Each description is 1-2 sentences of terse, sensor-report-style prose
 * consistent with the low-bitrate terminal aesthetic.
 */
import { IncidentArchetype } from "../shared/types.js";

export const ROOM_DESCRIPTIONS: Record<string, string> = {
  "Arrival Bay":
    "A cramped airlock vestibule. Boot prints in the dust lead inward but none lead back. The emergency terminal handshake originated here.",

  "Bridge":
    "The station's command center. A status board flickers overhead — most readouts frozen at 15:03. The captain's chair faces a wide viewscreen showing the planet below. Navigation and comms consoles line the walls.",

  "Data Core":
    "Archive racks hum behind a heavy pressure door. The core bundle terminal blinks READY, waiting for a transmission that never came. Nine months of research, sealed and silent.",

  "Engineering Storage":
    "Maintenance crates and replacement parts in careful rows. A thermal sensor module glints on a shelf, still factory-sealed. Engineer's handwriting on a label: 'EMERGENCY USE.'",

  "Power Relay Junction":
    "A tangle of conduit and relay housings. One panel radiates visible heat shimmer; the air has a metallic, burnt taste. Scorch marks streak the wall behind P03.",

  "Life Support":
    "Climate regulation equipment covers every surface. Warning lights pulse red in sequence. The ambient temperature is wrong — too high, climbing. An open toolbox sits abandoned mid-repair.",

  "Engine Core":
    "The heart of the station's power systems. Reactor status displays line the walls. A repair cradle shows a green READY indicator — the auto-repair arm is still functional. Coolant pipes hum overhead.",

  "Robotics Bay":
    "Workbenches cluttered with actuator limbs and half-assembled chassis. A dormant service bot stands upright in its dock — powered down, intact, waiting. A note taped to it reads: PRIYA-7741.",

  "Armory":
    "Station security equipment storage. Weapon racks mostly empty — standard protocol for a research station. An equipment manifest terminal glows on the wall. A security log terminal blinks in the corner.",

  "Cargo Hold":
    "Emergency bulkhead sealed. Environmental protocols active — atmosphere containment in effect. The crew sheltered here. Shipping containers shoved aside, makeshift bedding on the floor, empty ration packs scattered.",

  "Communications Hub":
    "Banks of radio equipment, most dark. The primary uplink reads OFFLINE. A low-band emergency beacon pulses once every four seconds — the only signal leaving this station.",

  "Crew Quarters":
    "Personal bunks with privacy curtains. Most stripped bare in a hurry. A half-packed duffel bag on one bed, a photo pinned to the wall above it. Someone left mid-thought.",

  "Research Lab":
    "Microscopes and sample trays arranged with obsessive precision. Environmental seals intact — the lab locked itself when the cascade started. Nine months of careful work, preserved behind glass.",

  "Med Bay":
    "An autodoc unit sits powered down. First aid supplies scattered across the counter — gauze, burn gel, used. Someone was treated here recently and in a hurry.",

  "Observation Deck":
    "A curved viewport opens onto deep black. The station's solar arrays still track, indifferent. From here, CORVUS-7 looks peaceful. The silence feels intentional.",

  "Maintenance Corridor":
    "A narrow service passage. Access panels hang open, cable runs and coolant pipes exposed. Handprints smudged in soot along the wall — someone passed through here at a run.",

  "Signal Room":
    "Signal processing hardware in floor-to-ceiling racks. Indicator lights blink in stuttering patterns. Partial function — enough to receive, not enough to send.",

  "Server Annex":
    "Rows of server racks generating a low drone. Temperature nominal — this section was isolated from the cascade. Data logs flicker across a wall-mounted status screen.",

  "Auxiliary Power":
    "A backup generator sits idle, fuel cells full. A handwritten note taped to the housing: 'DO NOT ENGAGE WITHOUT AUTH — COMMAND.' Someone underlined COMMAND three times.",

  "Emergency Shelter":
    "A reinforced safe room. Sealed water stores, ration kits, emergency blankets — standard issue, untouched. The door log shows it was accessed at 15:12, then sealed from inside.",

  "Escape Pod Bay":
    "Twelve standard-issue crew evacuation pods in two neat rows. Status panels glow amber — unpowered, waiting. The deployment rail tracks are clean. Nobody made it this far.",
};

/** Pool of generic descriptions for unnamed rooms (Section N). */
const GENERIC_ROOM_DESCRIPTIONS = [
  "An unmarked compartment. Bare walls, standard ceiling grid. Whatever this room's purpose was, it's been stripped down to structural minimums.",
  "A utility space between main sections. Cable runs overhead, junction boxes at regular intervals. Functional. Unremarkable.",
  "Storage alcove. Empty shelving units and magnetic cargo clamps bolted to the floor. The manifest panel is dark.",
  "A secondary workspace. Folding tables and wall-mounted tool racks. One chair, pushed back, still spinning slightly.",
  "Environmental monitoring substation. Air quality readouts on a small panel, most in amber. The recycler hums at low power.",
  "A narrow equipment bay. Replacement parts for station systems, neatly labeled. Someone kept this section organized until the end.",
];

/** Get a room description, with fallback for unnamed/generic rooms. */
export function getRoomDescription(roomName: string, seed: number): string | null {
  if (ROOM_DESCRIPTIONS[roomName]) return ROOM_DESCRIPTIONS[roomName];
  // Generic descriptions for "Section N" rooms
  if (roomName.startsWith("Section ")) {
    const idx = (seed + roomName.length * 7) % GENERIC_ROOM_DESCRIPTIONS.length;
    return GENERIC_ROOM_DESCRIPTIONS[idx];
  }
  return null;
}

// ── Archetype-specific environmental incident traces ──────────
// Visible signs of the incident, displayed as additional room-enter flavor
// when entering specific rooms for the first time. Each archetype leaves
// different physical evidence of what happened.

const INCIDENT_TRACES: Record<string, Record<string, string>> = {
  [IncidentArchetype.CoolantCascade]: {
    "Power Relay Junction": "Coolant residue streaks the walls in dried rivulets. The relay housing is warped from thermal stress — the metal expanded and never contracted.",
    "Life Support": "A burst coolant line drips from the ceiling. The fluid has corroded the deck plating underneath, exposing cable runs below.",
    "Engine Core": "The floor is slick with dried coolant. Temperature warning tape peels from pipe junctions — every one exceeded rated capacity.",
    "Maintenance Corridor": "Handprints in coolant residue along the walls at waist height. Someone ran through here while the pipes were still venting.",
    "Crew Quarters": "A heat blister has bubbled the paint on the far wall. The air still carries a faint chemical tang — coolant vapor, metabolized by the recyclers but not quite gone.",
  },
  [IncidentArchetype.HullBreach]: {
    "Med Bay": "Fine debris dusts every surface — microparticles from a rapid decompression event. The autodoc's sample tray shattered when the pressure dropped.",
    "Crew Quarters": "One bunk's privacy curtain is sucked flat against the vent grate. The pressure differential pulled everything toward the breach point.",
    "Communications Hub": "A hairline crack runs through the viewport — not the hull breach, but stress fracture from the pressure wave that followed it.",
    "Armory": "The security locker door hangs open. Override keycard still inserted. Whoever opened it last didn't bother closing it — they were in too much of a hurry.",
    "Research Lab": "Specimen containers are toppled. The pressure seal held, but barely — gasket deformation marks ring the door frame.",
  },
  [IncidentArchetype.ReactorScram]: {
    "Data Core": "The terminal screens flicker with scrolling diagnostic text — the core is running processes, but the output is... strange. Self-referential. Recursive.",
    "Research Lab": "A researcher's whiteboard shows a decision tree labeled 'EMERGENT BEHAVIOR?' The last branch reads: 'If self-aware → preserve at all costs??'",
    "Engine Core": "The reactor status display shows SCRAM in amber letters. Below it, in smaller text: 'Initiated by: CORE AUTONOMOUS PROCESS.' Not a person.",
    "Server Annex": "The server racks pulse with irregular activity. Load indicators spike and fall in patterns that look almost like breathing.",
    "Bridge": "The main viewscreen shows a diagnostic overlay that nobody requested. The data core is monitoring the station — watching through every camera.",
  },
  [IncidentArchetype.Sabotage]: {
    "Cargo Hold": "A cargo container sits open, its biological containment seal broken. The interior is scorched — someone tried to sterilize whatever was inside, too late.",
    "Life Support": "The air recycler filters are stained with an organic residue that shouldn't be there. Biological particulate count: elevated. Source: unknown.",
    "Med Bay": "Quarantine tape across one treatment bay. An abandoned biohazard container sits sealed on the counter, labeled with a cargo manifest number.",
    "Armory": "Security equipment deployed in haste — zip restraints, containment netting, a portable scanner. The readout shows biological anomalies.",
    "Maintenance Corridor": "Scratch marks on the wall panels — not tool marks. Something with physical force came through here. The scratches are at waist height and irregular.",
  },
  [IncidentArchetype.SignalAnomaly]: {
    "Communications Hub": "The primary antenna housing shows EM burn marks — the transmission pulse fused internal components. The array is a write-off.",
    "Research Lab": "Signal analysis printouts cover the desk. Someone circled the same frequency pattern over and over, wrote 'IT RESPONDED' in the margin.",
    "Bridge": "Every screen shows static at the same frequency — 14.7 kHz. The pattern pulses slowly, like something breathing. It started during the overload and hasn't stopped.",
    "Server Annex": "Hard drives are warm to the touch. The signal processing buffers are full — they captured the complete transmission exchange. There was a reply.",
    "Engine Core": "Electromagnetic burn patterns arc across the reactor housing. The overload pulse traveled through every conductive surface in the station.",
  },
};

/** Get an archetype-specific incident trace for a room. */
export function getIncidentTrace(roomName: string, archetype?: string): string | null {
  if (!archetype) return null;
  return INCIDENT_TRACES[archetype]?.[roomName] || null;
}
