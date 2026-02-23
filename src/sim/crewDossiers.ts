/**
 * Crew Dossier System — "Station Autopsy" identity puzzle.
 *
 * Each crew member has a dossier that the player builds through investigation.
 * Dossiers track confirmed identity (name, role, badge), theories (fate,
 * involvement), and personal details (want/habit/contradiction from themed
 * triplet pools).
 *
 * See MYSTERY_GAMEPLAY.md Part 2 (Pillar 2).
 */
import * as ROT from "rot-js";
import type { CrewMember, CrewDossier, CrewInvolvement } from "../shared/types.js";
import { CrewRole, CrewFate, SceneActivity } from "../shared/types.js";

// ── Themed Triplet Pools ────────────────────────────────────────
// Each pool is a coherent character sketch: want + habit + contradiction.
// 6 themes x 5+ variations = 30+ unique profiles.

export interface CharacterTriplet {
  theme: string;
  want: string;
  habit: string;
  contradiction: string;
}

export const THEMED_TRIPLETS: CharacterTriplet[] = [
  // Homesick Professional
  {
    theme: "Homesick Professional",
    want: "counting down to rotation end — 6 weeks until Earth",
    habit: "kept a family photo taped inside their locker",
    contradiction: "volunteered for the overtime shifts that kept them here longer",
  },
  {
    theme: "Homesick Professional",
    want: "saving enough for a house back in Meridian",
    habit: "sent a message home every single shift, even when comms were rationed",
    contradiction: "turned down the early transfer that would have got them home a month sooner",
  },
  {
    theme: "Homesick Professional",
    want: "making it through one more tour without incident",
    habit: "kept jasmine tea in their locker — the smell of home",
    contradiction: "filed three safety complaints nobody listened to, then stopped filing",
  },
  {
    theme: "Homesick Professional",
    want: "being the first in their family to work offworld and come back whole",
    habit: "counted down meals, not days — 'only 127 dinners left'",
    contradiction: "the care packages they sent home cost more than their savings",
  },
  {
    theme: "Homesick Professional",
    want: "getting back to the daughter who draws pictures of the station",
    habit: "kept a child's drawing taped to the inside of every helmet",
    contradiction: "chose this posting because it paid for her school — time or money, never both",
  },

  // Obsessive Expert
  {
    theme: "Obsessive Expert",
    want: "publishing the dataset that would make their career",
    habit: "annotated every manual, every report, every note",
    contradiction: "ignored their own safety protocols when the data was at stake",
  },
  {
    theme: "Obsessive Expert",
    want: "proving the anomaly in sector 7 was real and not instrument noise",
    habit: "triple-checked every reading, even at 3 AM",
    contradiction: "falsified one calibration to keep the project funded",
  },
  {
    theme: "Obsessive Expert",
    want: "being remembered as the one who got it right when everyone else was wrong",
    habit: "kept backup copies of everything on two separate drives",
    contradiction: "deleted the one file that would have proved them wrong",
  },
  {
    theme: "Obsessive Expert",
    want: "understanding why the readings didn't match the models",
    habit: "filled seventeen notebooks — numbered, dated, cross-referenced",
    contradiction: "never shared the findings that would have warned the crew",
  },
  {
    theme: "Obsessive Expert",
    want: "finishing the experiment before the station was decommissioned",
    habit: "skipped meals to stay in the lab — their mug was always cold",
    contradiction: "the breakthrough happened two days before the incident and they told no one",
  },

  // Quiet Loyalist
  {
    theme: "Quiet Loyalist",
    want: "keeping the crew alive, no recognition needed",
    habit: "covered for colleagues at every shift change",
    contradiction: "never filed the report that would have saved everyone",
  },
  {
    theme: "Quiet Loyalist",
    want: "being the person everyone could count on",
    habit: "always first to arrive, last to complain",
    contradiction: "kept a transfer request in their desk drawer for six months, unsigned",
  },
  {
    theme: "Quiet Loyalist",
    want: "maintaining the routine that kept everyone sane",
    habit: "memorized everyone's schedule and allergies",
    contradiction: "saw the warning sign and chose silence over confrontation",
  },
  {
    theme: "Quiet Loyalist",
    want: "making it to retirement without losing anyone",
    habit: "checked every seal, every hatch, every light — twice",
    contradiction: "the one time they needed to speak up, they froze",
  },
  {
    theme: "Quiet Loyalist",
    want: "earning the trust they already had",
    habit: "left notes for the next shift — 'pressure gauge sticking, tap twice'",
    contradiction: "trusted the wrong person with the one thing that mattered",
  },

  // Ambitious Outsider
  {
    theme: "Ambitious Outsider",
    want: "proving they deserved the assignment over the candidate who had connections",
    habit: "arrived first, left last, ate alone",
    contradiction: "privately asked for a transfer two weeks before the incident",
  },
  {
    theme: "Ambitious Outsider",
    want: "making their mark before the tour ended",
    habit: "kept a running list of everything they'd accomplished — and everything others hadn't",
    contradiction: "the recommendation they needed came from the person they resented most",
  },
  {
    theme: "Ambitious Outsider",
    want: "getting the senior posting on the next rotation",
    habit: "studied other crew's techniques in their off-hours",
    contradiction: "sabotaged a colleague's proposal to make their own look better",
  },
  {
    theme: "Ambitious Outsider",
    want: "being taken seriously for once",
    habit: "over-documented everything to prove competence",
    contradiction: "the promotion they wanted would have taken them away from the work they loved",
  },
  {
    theme: "Ambitious Outsider",
    want: "outperforming the legacy hire who got the same rank for free",
    habit: "ran diagnostics nobody asked for, filed reports nobody read",
    contradiction: "turned down the credit they'd worked for because it came with responsibility",
  },

  // Reluctant Authority
  {
    theme: "Reluctant Authority",
    want: "getting through command rotation without anyone getting hurt",
    habit: "delegated everything they could, kept a flask in the desk",
    contradiction: "the one time they made a decisive call, it was the wrong one",
  },
  {
    theme: "Reluctant Authority",
    want: "surviving the posting without making enemies",
    habit: "held meetings to avoid making decisions",
    contradiction: "knew about the problem for weeks and chose to wait for orders",
  },
  {
    theme: "Reluctant Authority",
    want: "passing the responsibility to someone more qualified",
    habit: "re-read the regulations every night, looking for cover",
    contradiction: "when the crisis hit, they were the only one who acted — and it wasn't enough",
  },
  {
    theme: "Reluctant Authority",
    want: "being remembered as fair, even if not competent",
    habit: "asked everyone's opinion before forming their own",
    contradiction: "overruled the one person whose warning turned out to be right",
  },
  {
    theme: "Reluctant Authority",
    want: "retiring quietly after this tour",
    habit: "wrote detailed handover notes for a successor who never came",
    contradiction: "the retirement paperwork was already filed when the incident began",
  },

  // Careful Paranoid
  {
    theme: "Careful Paranoid",
    want: "documenting everything, just in case",
    habit: "backed up every log to a personal drive every night",
    contradiction: "the one thing they didn't record was the conversation that mattered most",
  },
  {
    theme: "Careful Paranoid",
    want: "catching the discrepancy before it became a disaster",
    habit: "cross-referenced supply manifests against actual inventory — every week",
    contradiction: "trusted the automated systems they claimed were unreliable",
  },
  {
    theme: "Careful Paranoid",
    want: "proving that the safety margins were too thin",
    habit: "kept a go-bag packed in their quarters at all times",
    contradiction: "when the alarm went off, they ran toward the problem instead of away",
  },
  {
    theme: "Careful Paranoid",
    want: "finding the leak before it found them",
    habit: "checked the corridor cameras at random intervals, logged anomalies",
    contradiction: "missed the obvious threat because they were focused on the imaginary one",
  },
  {
    theme: "Careful Paranoid",
    want: "making sure someone would know the truth, even if they didn't survive",
    habit: "hid copies of critical documents in three separate locations",
    contradiction: "encrypted the final report so thoroughly that no one could read it",
  },
];

// ── Dossier initialization ──────────────────────────────────────

/**
 * Assign a themed triplet to each crew member.
 * Uses ROT.RNG for deterministic selection without replacement.
 */
export function assignTriplets(crew: CrewMember[]): Map<string, CharacterTriplet> {
  const pool = [...THEMED_TRIPLETS];
  const assignments = new Map<string, CharacterTriplet>();

  for (const member of crew) {
    if (pool.length === 0) break;
    const idx = Math.floor(ROT.RNG.getUniform() * pool.length);
    assignments.set(member.id, pool[idx]);
    pool.splice(idx, 1);
  }

  return assignments;
}

/**
 * Create initial dossiers for all crew members.
 * Dossiers start empty — the player fills them through investigation.
 * Personal details (want/habit/contradiction) are pre-assigned from triplets
 * but NOT revealed to the player until they discover related evidence.
 */
export function createDossiers(
  crew: CrewMember[],
  triplets: Map<string, CharacterTriplet>,
): CrewDossier[] {
  return crew.map((member) => {
    const triplet = triplets.get(member.id);
    return {
      crewId: member.id,
      confirmed: {},
      theories: {},
      personalDetails: {
        want: triplet?.want,
        habit: triplet?.habit,
        contradiction: triplet?.contradiction,
      },
      linkedEvidence: [],
      roomsSeen: [],
    };
  });
}

// ── Dossier updates from gameplay ───────────────────────────────

/**
 * Update a dossier when a badge is discovered (confirms name, role, badgeId).
 */
export function confirmIdentity(
  dossier: CrewDossier,
  crew: CrewMember,
): CrewDossier {
  return {
    ...dossier,
    confirmed: {
      name: `${crew.firstName} ${crew.lastName}`,
      role: crew.role,
      badgeId: crew.badgeId,
    },
  };
}

/**
 * Update dossier theories from scene processing results.
 * When the player answers WHO in a room, the system proposes theories.
 */
export function updateTheoriesFromScene(
  dossier: CrewDossier,
  roomName: string,
  activity: SceneActivity,
): CrewDossier {
  const involvement = activityToInvolvement(activity);

  return {
    ...dossier,
    theories: {
      ...dossier.theories,
      lastKnownRoom: roomName,
      involvement,
    },
    roomsSeen: dossier.roomsSeen.includes(roomName)
      ? dossier.roomsSeen
      : [...dossier.roomsSeen, roomName],
  };
}

/**
 * Link a journal entry to a dossier.
 */
export function linkEvidence(
  dossier: CrewDossier,
  journalEntryId: string,
): CrewDossier {
  if (dossier.linkedEvidence.includes(journalEntryId)) return dossier;
  return {
    ...dossier,
    linkedEvidence: [...dossier.linkedEvidence, journalEntryId],
  };
}

/**
 * Confirm a crew member's fate in their dossier.
 */
export function confirmFate(
  dossier: CrewDossier,
  fate: CrewFate,
): CrewDossier {
  return {
    ...dossier,
    theories: {
      ...dossier.theories,
      fate,
    },
  };
}

// ── Helpers ─────────────────────────────────────────────────────

function activityToInvolvement(activity: SceneActivity): CrewInvolvement {
  switch (activity) {
    case SceneActivity.Sabotage:
      return "instigator";
    case SceneActivity.EmergencyResponse:
    case SceneActivity.EquipmentRepair:
    case SceneActivity.MedicalTreatment:
      return "responder";
    case SceneActivity.Fleeing:
    case SceneActivity.Hiding:
    case SceneActivity.Barricading:
      return "victim";
    case SceneActivity.Investigation:
    case SceneActivity.Confrontation:
      return "instigator";
    default:
      return "bystander";
  }
}

/**
 * Get the identification progress for a dossier.
 * Returns a 0-1 value representing how much is known.
 */
export function getDossierProgress(dossier: CrewDossier): number {
  let score = 0;
  let total = 5; // name, role, badge, fate, involvement

  if (dossier.confirmed.name) score++;
  if (dossier.confirmed.role) score++;
  if (dossier.confirmed.badgeId) score++;
  if (dossier.theories.fate) score++;
  if (dossier.theories.involvement && dossier.theories.involvement !== "unknown") score++;

  return score / total;
}

/**
 * Get the count of crew members with fully confirmed identity.
 */
export function getIdentifiedCrewCount(dossiers: CrewDossier[]): number {
  return dossiers.filter((d) =>
    d.confirmed.name && d.confirmed.role && d.confirmed.badgeId
  ).length;
}
