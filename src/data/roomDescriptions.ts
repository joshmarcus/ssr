/**
 * Room descriptions displayed when the player's bot enters a room for the
 * first time. Keyed by room name as defined in goldenSeedRooms.ts.
 *
 * Each description is 1-2 sentences of terse, sensor-report-style prose
 * consistent with the low-bitrate terminal aesthetic.
 */

export const ROOM_DESCRIPTIONS: Record<string, string> = {
  "Arrival Bay":
    "A cramped airlock vestibule. Boot prints in the dust lead inward but none lead back. The emergency terminal handshake originated here.",

  "Central Atrium":
    "The station's main crossroads. A status board flickers overhead — most readouts frozen at 15:03. Someone knocked over a coffee mug; the stain has long since dried.",

  "Data Core":
    "Archive racks hum behind a heavy pressure door. The core bundle terminal blinks READY, waiting for a transmission that never came. Nine months of research, sealed and silent.",

  "Engineering Storage":
    "Maintenance crates and replacement parts in careful rows. A thermal sensor module glints on a shelf, still factory-sealed. Vasquez's handwriting on a label: 'EMERGENCY USE.'",

  "Power Relay Junction":
    "A tangle of conduit and relay housings. One panel radiates visible heat shimmer; the air has a metallic, burnt taste. Scorch marks streak the wall behind P03.",

  "Life Support":
    "Climate regulation equipment covers every surface. Warning lights pulse red in sequence. The ambient temperature is wrong — too high, climbing. An open toolbox sits abandoned mid-repair.",

  "Bot Maintenance":
    "A repair bay for station bots. Diagnostic cradles line the wall. One shows a green READY indicator — the auto-repair arm is still functional. Step into the cradle to initiate repairs.",

  "Robotics Bay":
    "Workbenches cluttered with actuator limbs and half-assembled chassis. A dormant service bot stands upright in its dock — powered down, intact, waiting. A note taped to it reads: PRIYA-7741.",

  "Vent Control Room":
    "Manual overrides for the station ventilation network line the far wall. Every panel reads SEALED. The air is stale and warm — nothing has moved through these ducts since the cascade.",

  "Cargo Hold":
    "A long, low-ceilinged hold. Shipping containers shoved aside to clear floor space — makeshift bedding, empty ration packs, a first aid kit with the seal broken. The crew sheltered here.",

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
    "A backup generator sits idle, fuel cells full. A handwritten note taped to the housing: 'DO NOT ENGAGE WITHOUT AUTH — OKAFOR.' Someone underlined OKAFOR three times.",

  "Emergency Shelter":
    "A reinforced safe room. Sealed water stores, ration kits, emergency blankets — standard issue, untouched. The door log shows it was accessed at 15:12, then sealed from inside.",

  "Escape Pod Bay":
    "Twelve standard-issue crew evacuation pods in two neat rows. Status panels glow amber — unpowered, waiting. The deployment rail tracks are clean. Nobody made it this far.",
};
