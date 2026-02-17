/**
 * Name pools for procedural crew generation.
 * Diverse international names for a UN deep-space research station.
 */

export const FIRST_NAMES: string[] = [
  "Aisha", "Aleksei", "Amara", "Beatriz", "Callum",
  "Chen", "Dario", "Elena", "Fatima", "Gabriel",
  "Hana", "Idris", "Javier", "Keiko", "Liam",
  "Maren", "Naomi", "Oleg", "Priya", "Rashid",
  "Sana", "Tariq", "Uma", "Viktor", "Wei",
  "Xena", "Yuki", "Zara", "Andrei", "Brigid",
  "Cyrus", "Dina", "Emil", "Freya", "Hector",
  "Ines", "Jin", "Kira", "Leo", "Milo",
];

export const LAST_NAMES: string[] = [
  "Vasquez", "Okafor", "Tanaka", "Chen", "Reeves",
  "Kowalski", "Nakamura", "Santos", "Petrov", "Ibrahim",
  "Larsson", "Moreau", "Kimura", "Delgado", "Novak",
  "Fischer", "Gupta", "Park", "Volkov", "Moreira",
  "Hassan", "Lindqvist", "Saito", "Ferreira", "Kozlov",
  "Berger", "Rao", "Cho", "Silva", "Werner",
  "Ndiaye", "Tamura", "Cruz", "Brennan", "Hayashi",
  "Ortiz", "Pham", "Roche", "Sato", "Torres",
];

/**
 * Badge prefixes by crew role.
 */
export const ROLE_BADGE_PREFIX: Record<string, string> = {
  captain: "CMD",
  engineer: "ENG",
  medic: "MED",
  security: "SEC",
  scientist: "SCI",
  robotics: "ROB",
  life_support: "LSP",
  comms: "COM",
};
