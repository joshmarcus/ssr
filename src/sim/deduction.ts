/**
 * Deduction system — the three pillars of investigation.
 *
 * WHAT happened? (incident nature)
 * WHY did it happen? (cause/motive)
 * WHO is responsible? (crew involvement)
 *
 * Deductions unlock as the player gathers evidence.
 * Correct answers give tangible gameplay rewards.
 * Wrong answers cost time but don't permanently block progress.
 */
import * as ROT from "rot-js";
import type { CrewMember, IncidentTimeline, Deduction } from "../shared/types.js";
import { DeductionCategory, IncidentArchetype, CrewRole, CrewSecret } from "../shared/types.js";
import { findByRole, findSecretHolder } from "./crewGen.js";

/**
 * Generate deductions from the crew and timeline.
 * Produces 4-6 deductions structured around WHAT/WHY/WHO.
 * ROT.RNG must be seeded.
 */
export function generateDeductions(
  crew: CrewMember[],
  timeline: IncidentTimeline,
  roomNames: string[],
): Deduction[] {
  const deductions: Deduction[] = [];
  const captain = findByRole(crew, CrewRole.Captain);
  const engineer = findByRole(crew, CrewRole.Engineer);
  const medic = findByRole(crew, CrewRole.Medic);
  const security = findByRole(crew, CrewRole.Security);
  const scientist = findByRole(crew, CrewRole.Scientist);
  const secretHolder = findSecretHolder(crew);

  // ── WHAT happened? ──────────────────────────────────────────
  deductions.push(generateWhatDeduction(timeline, engineer, roomNames));

  // ── WHAT (secondary): What was the sequence of events? ──────
  deductions.push(generateSequenceDeduction(timeline, crew, roomNames));

  // ── WHY did it happen? ──────────────────────────────────────
  deductions.push(generateWhyDeduction(timeline, captain, engineer, secretHolder));

  // ── WHO: Who tried to prevent it? ───────────────────────────
  deductions.push(generateHeroDeduction(crew, timeline));

  // ── WHO: Who bears responsibility? ──────────────────────────
  deductions.push(generateResponsibilityDeduction(crew, timeline, captain, secretHolder));

  // ── WHY (secondary): What were they really doing here? ──────
  if (timeline.archetype === IncidentArchetype.SignalAnomaly ||
      timeline.archetype === IncidentArchetype.Sabotage) {
    deductions.push(generateHiddenAgendaDeduction(crew, timeline, scientist));
  }

  return deductions;
}

function generateWhatDeduction(
  timeline: IncidentTimeline,
  engineer: CrewMember | undefined,
  roomNames: string[],
): Deduction {
  const correctAnswer = getIncidentDescription(timeline.archetype);
  const wrongAnswers = getWrongIncidentDescriptions(timeline.archetype);

  const options = [
    { label: correctAnswer, key: "correct", correct: true },
    ...wrongAnswers.map((label, i) => ({ label, key: `wrong_${i}`, correct: false })),
  ];
  // Shuffle options deterministically
  shuffleArray(options);

  return {
    id: "deduction_what",
    category: DeductionCategory.What,
    question: "Based on the evidence, what happened aboard CORVUS-7?",
    options,
    evidenceRequired: 2,
    solved: false,
    rewardType: "room_reveal",
    rewardDescription: "Reveals the location of an unexplored room on the map",
  };
}

function generateSequenceDeduction(
  timeline: IncidentTimeline,
  crew: CrewMember[],
  roomNames: string[],
): Deduction {
  const triggerEvent = timeline.events.find(e => e.phase === "trigger");
  const room = triggerEvent?.location || roomNames[0] || "the station";

  const correctLabel = `It started in ${room} during the ${timeline.archetype.replace(/_/g, " ")}`;
  const wrongOptions = [
    `The Data Core overloaded and caused a chain reaction`,
    `An external impact triggered the emergency systems`,
    `The crew intentionally shut down life support`,
  ];

  const options = [
    { label: correctLabel, key: "correct", correct: true },
    ...wrongOptions.map((label, i) => ({ label, key: `wrong_${i}`, correct: false })),
  ];
  shuffleArray(options);

  return {
    id: "deduction_sequence",
    category: DeductionCategory.What,
    question: "Where and how did the incident begin?",
    options,
    evidenceRequired: 4,
    solved: false,
    rewardType: "sensor_hint",
    rewardDescription: "Reveals the location of the next sensor upgrade",
  };
}

function generateWhyDeduction(
  timeline: IncidentTimeline,
  captain: CrewMember | undefined,
  engineer: CrewMember | undefined,
  secretHolder: CrewMember | undefined,
): Deduction {
  const archetype = timeline.archetype;
  let correctKey: string;
  let correctLabel: string;

  switch (archetype) {
    case IncidentArchetype.CoolantCascade:
      correctLabel = `Maintenance was deferred — ${engineer?.lastName || "the engineer"}'s warnings were ignored by ${captain?.lastName || "command"}`;
      correctKey = "deferred_maintenance";
      break;
    case IncidentArchetype.HullBreach:
      correctLabel = "Micro-impact damage accumulated over months without proper hull inspections";
      correctKey = "accumulated_damage";
      break;
    case IncidentArchetype.ReactorScram:
      correctLabel = "Containment field degraded beyond safe limits while the crew focused on the transmission deadline";
      correctKey = "deadline_pressure";
      break;
    case IncidentArchetype.Sabotage:
      correctLabel = `Deliberate interference — someone had a reason to disable station systems`;
      correctKey = "sabotage";
      break;
    case IncidentArchetype.SignalAnomaly:
      correctLabel = "An anomalous external signal disrupted station electronics in ways nobody predicted";
      correctKey = "external_signal";
      break;
    case IncidentArchetype.ContainmentBreach:
      correctLabel = "Lab containment protocols were insufficient for the experiment being conducted";
      correctKey = "containment_failure";
      break;
    default:
      correctLabel = "System failure compounded by human error";
      correctKey = "compound_failure";
  }

  const wrongAnswers = [
    "The station was simply too old — equipment past its service life",
    "A software update corrupted the safety monitoring systems",
    "Budget cuts from UN-ORC reduced the crew below safe staffing levels",
  ];

  const options = [
    { label: correctLabel, key: correctKey, correct: true },
    ...wrongAnswers.map((label, i) => ({ label, key: `wrong_${i}`, correct: false })),
  ];
  shuffleArray(options);

  return {
    id: "deduction_why",
    category: DeductionCategory.Why,
    question: "Why did the incident happen?",
    options,
    evidenceRequired: 5,
    solved: false,
    rewardType: "drone_disable",
    rewardDescription: "Disables a patrol drone, clearing a safe route",
  };
}

function generateHeroDeduction(
  crew: CrewMember[],
  timeline: IncidentTimeline,
): Deduction {
  // The engineer is almost always the one who tried to prevent/fix it
  const engineer = findByRole(crew, CrewRole.Engineer);
  const correctLabel = engineer
    ? `${engineer.firstName} ${engineer.lastName} (${engineer.role})`
    : "The engineer";

  const otherCrew = crew.filter(c => c.role !== CrewRole.Engineer).slice(0, 3);
  const wrongLabels = otherCrew.map(c => `${c.firstName} ${c.lastName} (${c.role})`);

  const options = [
    { label: correctLabel, key: "correct", correct: true },
    ...wrongLabels.map((label, i) => ({ label, key: `wrong_${i}`, correct: false })),
  ];
  shuffleArray(options);

  return {
    id: "deduction_hero",
    category: DeductionCategory.Who,
    question: "Who tried hardest to prevent the disaster?",
    options,
    evidenceRequired: 3,
    solved: false,
    rewardType: "clearance",
    rewardDescription: "Grants clearance to open a locked door elsewhere in the station",
  };
}

function generateResponsibilityDeduction(
  crew: CrewMember[],
  timeline: IncidentTimeline,
  captain: CrewMember | undefined,
  secretHolder: CrewMember | undefined,
): Deduction {
  let correctLabel: string;

  if (timeline.archetype === IncidentArchetype.Sabotage && secretHolder) {
    correctLabel = `${secretHolder.firstName} ${secretHolder.lastName} — the evidence points to deliberate action`;
  } else if (captain) {
    correctLabel = `${captain.firstName} ${captain.lastName} — command ignored the warnings`;
  } else {
    correctLabel = "Station command — they had the authority and chose not to act";
  }

  const otherCrew = crew.filter(c =>
    c.id !== captain?.id && c.id !== secretHolder?.id
  ).slice(0, 2);

  const wrongLabels = [
    ...otherCrew.map(c => `${c.firstName} ${c.lastName} — they had access and opportunity`),
    "No single person — it was a systemic failure",
  ];

  const options = [
    { label: correctLabel, key: "correct", correct: true },
    ...wrongLabels.map((label, i) => ({ label, key: `wrong_${i}`, correct: false })),
  ];
  shuffleArray(options);

  return {
    id: "deduction_responsibility",
    category: DeductionCategory.Who,
    question: "Who bears the most responsibility for what happened?",
    options,
    evidenceRequired: 7,
    solved: false,
    rewardType: "room_reveal",
    rewardDescription: "Reveals a hidden section of the station",
  };
}

function generateHiddenAgendaDeduction(
  crew: CrewMember[],
  timeline: IncidentTimeline,
  scientist: CrewMember | undefined,
): Deduction {
  let correctLabel: string;
  if (timeline.archetype === IncidentArchetype.SignalAnomaly) {
    correctLabel = "The station was secretly monitoring an anomalous signal — classified research the crew wasn't fully briefed on";
  } else {
    correctLabel = "Someone aboard had a hidden agenda that put the mission at risk";
  }

  const options = [
    { label: correctLabel, key: "correct", correct: true },
    { label: "The research was routine — nothing was hidden", key: "wrong_0", correct: false },
    { label: "UN-ORC was planning to decommission the station and didn't tell the crew", key: "wrong_1", correct: false },
    { label: "The station was a military outpost disguised as research", key: "wrong_2", correct: false },
  ];
  shuffleArray(options);

  return {
    id: "deduction_agenda",
    category: DeductionCategory.Why,
    question: "What was really going on aboard CORVUS-7?",
    options,
    evidenceRequired: 8,
    solved: false,
    rewardType: "sensor_hint",
    rewardDescription: "Reveals the location of hidden evidence",
  };
}

// ── Helpers ─────────────────────────────────────────────────

function getIncidentDescription(archetype: IncidentArchetype): string {
  switch (archetype) {
    case IncidentArchetype.CoolantCascade:
      return "A coolant system failure caused a thermal cascade across the relay network";
    case IncidentArchetype.HullBreach:
      return "Hull integrity failed, causing depressurization in multiple sections";
    case IncidentArchetype.ReactorScram:
      return "The reactor underwent emergency shutdown after containment failure";
    case IncidentArchetype.Sabotage:
      return "Station systems were deliberately sabotaged by someone aboard";
    case IncidentArchetype.SignalAnomaly:
      return "An anomalous external signal caused widespread system interference";
    case IncidentArchetype.ContainmentBreach:
      return "Lab containment failed, releasing toxic atmosphere into the station";
  }
}

function getWrongIncidentDescriptions(archetype: IncidentArchetype): string[] {
  const all = [
    "A coolant system failure caused a thermal cascade across the relay network",
    "Hull integrity failed, causing depressurization in multiple sections",
    "The reactor underwent emergency shutdown after containment failure",
    "Station systems were deliberately sabotaged by someone aboard",
    "An anomalous external signal caused widespread system interference",
    "Lab containment failed, releasing toxic atmosphere into the station",
  ];
  const correct = getIncidentDescription(archetype);
  const wrong = all.filter(d => d !== correct);
  // Pick 3 random wrong answers
  return wrong.slice(0, 3);
}

function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(ROT.RNG.getUniform() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Check if a deduction should be unlocked based on journal count.
 */
export function getUnlockedDeductions(
  deductions: Deduction[],
  journalCount: number,
): Deduction[] {
  return deductions.filter(d => !d.solved && journalCount >= d.evidenceRequired);
}

/**
 * Attempt to solve a deduction.
 * Returns the updated deduction and whether the answer was correct.
 */
export function solveDeduction(
  deduction: Deduction,
  answerKey: string,
): { deduction: Deduction; correct: boolean } {
  const chosen = deduction.options.find(o => o.key === answerKey);
  const correct = chosen?.correct || false;
  return {
    deduction: {
      ...deduction,
      solved: true,
      answeredCorrectly: correct,
    },
    correct,
  };
}
