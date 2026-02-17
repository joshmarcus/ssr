/**
 * Crew personal items scattered across the station.
 *
 * Each item is a small environmental-narrative object that tells the player
 * something about the person who left it behind. Found via interact;
 * description displays in the log panel.
 */

export interface CrewItemDef {
  id: string;
  name: string;
  description: string;
  crewMember: string;
  roomHint: string;
  hidden?: boolean; // only visible when dirt is cleaned or cleanliness sensor is active
  memoryEcho?: string; // optional ghost flashback when examined
}

export const CREW_ITEMS: CrewItemDef[] = [
  {
    id: "crew_item_vasquez_toolkit",
    name: "Well-Worn Toolkit",
    description:
      "Every tool labeled in neat handwriting. The voltage tester has teeth marks on the handle — a nervous habit, or long shifts alone in the relay junction.",
    crewMember: "Vasquez",
    roomHint: "Power Relay Junction",
    memoryEcho: "The terminal flickers. For a moment you see hands — steady, practiced — selecting a wrench by feel in the dark. The image fades. Just carbon scoring on the wall.",
  },
  {
    id: "crew_item_okafor_badge",
    name: "Commander's Badge",
    description:
      "Station commander's badge, lanyard snapped clean. The photo shows a younger face than the worry lines in Okafor's final log suggest. Someone drew a small star on the back in pen.",
    crewMember: "Okafor",
    roomHint: "Central Atrium",
  },
  {
    id: "crew_item_tanaka_notes",
    name: "Research Notebook",
    description:
      "Dense signal analysis in precise handwriting. The last page just says 'TOMORROW' circled three times, then nothing. A child's crayon drawing of a space station is taped to the cover.",
    crewMember: "Tanaka",
    roomHint: "Research Lab",
    memoryEcho: "A flicker of light across the terminal — someone hunched over this desk, pen moving fast, pausing to look at a child's drawing. The figure reaches out to touch it, then dissolves into static.",
  },
  {
    id: "crew_item_chen_mug",
    name: "Jasmine Tea Mug",
    description:
      "Thermal mug, 'CHEN' in block letters. Still warm — the heating element runs off station power. Jasmine residue inside. She was the last one to sit down for a quiet moment.",
    crewMember: "Chen",
    roomHint: "Life Support",
    memoryEcho: "For a moment, the terminal flickers — a ghost image of someone sitting here, steam rising from the cup, reading a maintenance report. Then nothing.",
  },
  {
    id: "crew_item_priya_notebook",
    name: "Annotated Service Manual",
    description:
      "Robotics manual, margins dense with Priya's corrections. A sticky note on the last page: 'They never read the manual. I always do.' Badge code written underneath.",
    crewMember: "Priya",
    roomHint: "Robotics Bay",
  },
  {
    id: "crew_item_family_photo",
    name: "Creased Photograph",
    description:
      "Two adults and a child at a beach on Earth. The edges are soft from handling. No names on the back — whoever carried this didn't need a reminder.",
    crewMember: "Unknown",
    roomHint: "Crew Quarters",
  },
  {
    id: "crew_item_ration_pack",
    name: "Abandoned Ration Pack",
    description:
      "Half-eaten, fork still stuck in it. Turkey and rice variant. The timestamp on the wrapper: 14:58, fifteen minutes before everything went wrong.",
    crewMember: "Unknown",
    roomHint: "Cargo Hold",
  },
  {
    id: "crew_item_sorry_note",
    name: "Handwritten Note",
    description:
      "Scrap of paper, handwriting shaky: 'I should have listened. She told me three times. If anyone finds this — the data can still be saved.' Unsigned, but the command stationary is Okafor's.",
    crewMember: "Okafor",
    roomHint: "Emergency Shelter",
    memoryEcho: "The terminal shivers. A figure at a desk, head in hands. The pen shakes. They start writing, stop, crumple the paper, start again. The image breaks apart like interference.",
  },
  // ── Hidden crew items (only visible when dirt < 60 or cleanliness sensor active) ──
  {
    id: "crew_item_hidden_keycard",
    name: "Smudged Keycard",
    description:
      "An access keycard half-buried in grime. The name is scratched off, but the clearance level reads LEVEL-4 — higher than any crew member listed on the station manifest. Who else was aboard?",
    crewMember: "Unknown",
    roomHint: "Maintenance Corridor",
    hidden: true,
    memoryEcho: "A brief flash — a figure in an unmarked jumpsuit, moving quickly through the corridor. No badge visible. They pause, drop something, keep going. Gone.",
  },
  {
    id: "crew_item_hidden_recording",
    name: "Damaged Voice Recorder",
    description:
      "A personal recorder crushed underfoot. The playback is corrupted, but one fragment loops: '...not what we were told it was. The signal — it's not random. It's structured. Someone needs to know...' The voice sounds like Tanaka's.",
    crewMember: "Tanaka",
    roomHint: "Research Lab",
    hidden: true,
  },
  {
    id: "crew_item_hidden_schematic",
    name: "Hand-Drawn Schematic",
    description:
      "A folded paper jammed under a floor panel. It shows an alternate coolant routing that bypasses junction V-4 entirely. Vasquez's handwriting in the margin: 'Plan B. If Okafor won't listen.' The route is marked with today's date.",
    crewMember: "Vasquez",
    roomHint: "Engineering Storage",
    hidden: true,
  },
  {
    id: "crew_item_hidden_medkit_note",
    name: "Note Inside Med Kit",
    description:
      "A scrap tucked under the burn gel packets. Different handwriting — smaller, careful: 'V — applied dermal patches to both forearms. Second-degree. She wouldn't stay still. Said the data mattered more than her arms. — C'",
    crewMember: "Chen",
    roomHint: "Med Bay",
    hidden: true,
    memoryEcho: "The terminal strobes. Two figures: one sitting, gritting teeth. The other wrapping bandages with quick, gentle motions. A mug of tea between them, untouched. Then darkness.",
  },
  // ── Sprint 2 hidden crew items ──────────────────────────────
  {
    id: "crew_item_hidden_envelope",
    name: "Sealed Envelope",
    description:
      "Addressed to 'Dr. Tanaka, Personal.' Never opened. The seal is still intact.",
    crewMember: "Tanaka",
    roomHint: "Observation Deck",
    hidden: true,
  },
  {
    id: "crew_item_hidden_dog_tags",
    name: "Dog Tags",
    description:
      "Standard issue, bent. Name: CPL. REEVES. Not on the station manifest.",
    crewMember: "Unknown",
    roomHint: "Maintenance Corridor",
    hidden: true,
    memoryEcho: "A flicker — heavy boots in the corridor. A face you don't recognize. They pause at the junction, check both directions, then vanish into static.",
  },
  {
    id: "crew_item_hidden_usb",
    name: "USB Drive",
    description:
      "Unlabeled. The access light blinks once when you pick it up, then goes dark.",
    crewMember: "Unknown",
    roomHint: "Signal Room",
    hidden: true,
  },
  {
    id: "crew_item_hidden_schedule",
    name: "Shift Schedule",
    description:
      "Week of March 14. Every shift has Vasquez's name. She was covering for three people.",
    crewMember: "Vasquez",
    roomHint: "Bot Maintenance",
    hidden: true,
  },
];
