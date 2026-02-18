/**
 * Deduction system — the three pillars of investigation.
 *
 * WHAT happened? (incident nature)
 * WHY did it happen? (cause/motive)
 * WHO is responsible? (crew involvement)
 *
 * Deductions form a chain: solving one unlocks the next.
 * Each deduction requires the player to LINK specific evidence
 * (journal entries whose tags cover the deduction's requiredTags)
 * before answering.
 *
 * Correct answers give tangible gameplay rewards.
 * Wrong answers cost time but don't permanently block progress.
 */
import * as ROT from "rot-js";
import type { CrewMember, IncidentTimeline, Deduction, JournalEntry } from "../shared/types.js";
import { DeductionCategory, IncidentArchetype, CrewRole, CrewSecret } from "../shared/types.js";
import { findByRole, findSecretHolder } from "./crewGen.js";

/**
 * Get the system tags associated with an incident archetype.
 */
export function getArchetypeTags(archetype: IncidentArchetype): string[] {
  switch (archetype) {
    case IncidentArchetype.CoolantCascade:
      return ["coolant", "thermal", "reactor"];
    case IncidentArchetype.HullBreach:
      return ["hull", "pressure"];
    case IncidentArchetype.ReactorScram:
      return ["reactor", "containment"];
    case IncidentArchetype.Sabotage:
      return ["electrical", "signal"];
    case IncidentArchetype.SignalAnomaly:
      return ["signal", "electrical"];
    case IncidentArchetype.ContainmentBreach:
      return ["containment", "pressure"];
  }
}

/**
 * Generate deductions from the crew and timeline.
 * Produces 5-6 deductions structured as a chain: each unlocks after the previous.
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
  const archTags = getArchetypeTags(timeline.archetype);

  // ── Tier 1: WHAT happened? (available immediately, needs 1 system tag) ──
  deductions.push(generateWhatDeduction(timeline, engineer, roomNames, archTags));

  // ── Tier 2: WHERE did it start? (unlocked after Tier 1) ──
  deductions.push(generateSequenceDeduction(timeline, crew, roomNames, archTags));

  // ── Tier 3: WHY did it happen? (unlocked after Tier 2) ──
  deductions.push(generateWhyDeduction(timeline, captain, engineer, secretHolder, archTags));

  // ── Tier 4: WHO tried to prevent it? (unlocked after Tier 3) ──
  deductions.push(generateHeroDeduction(crew, timeline));

  // ── Tier 5: WHO bears responsibility? (unlocked after Tier 4) ──
  deductions.push(generateResponsibilityDeduction(crew, timeline, captain, secretHolder));

  // ── Tier 6 (optional): What were they really doing here? ──
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
  archTags: string[],
): Deduction {
  const correctAnswer = getIncidentDescription(timeline.archetype);
  const wrongAnswers = getWrongIncidentDescriptions(timeline.archetype);

  const options = [
    { label: correctAnswer, key: "correct", correct: true },
    ...wrongAnswers.map((label, i) => ({ label, key: `wrong_${i}`, correct: false })),
  ];
  shuffleArray(options);

  return {
    id: "deduction_what",
    category: DeductionCategory.What,
    question: "Based on the evidence, what happened aboard CORVUS-7?",
    options,
    requiredTags: [archTags[0]],  // just one system tag — easy entry point
    linkedEvidence: [],
    solved: false,
    rewardType: "room_reveal",
    rewardDescription: "Reveals the location of an unexplored room on the map",
    hintText: getWhatHintText(timeline.archetype),
  };
}

function generateSequenceDeduction(
  timeline: IncidentTimeline,
  crew: CrewMember[],
  roomNames: string[],
  archTags: string[],
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
    requiredTags: [archTags[0], "timeline_trigger"],
    unlockAfter: "deduction_what",
    linkedEvidence: [],
    solved: false,
    rewardType: "sensor_hint",
    rewardDescription: "Reveals the location of the next sensor upgrade",
    hintText: "Look for emergency logs and alarm records that describe the triggering event.",
  };
}

function generateWhyDeduction(
  timeline: IncidentTimeline,
  captain: CrewMember | undefined,
  engineer: CrewMember | undefined,
  secretHolder: CrewMember | undefined,
  archTags: string[],
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

  // Need archetype tag + engineer or captain crew tag
  const crewTag = engineer?.lastName.toLowerCase() || "engineer";
  return {
    id: "deduction_why",
    category: DeductionCategory.Why,
    question: "Why did the incident happen?",
    options,
    requiredTags: [archTags[0], crewTag],
    unlockAfter: "deduction_sequence",
    linkedEvidence: [],
    solved: false,
    rewardType: "drone_disable",
    rewardDescription: "Disables a patrol drone, clearing a safe route",
    hintText: getWhyHintText(archetype),
  };
}

function generateHeroDeduction(
  crew: CrewMember[],
  timeline: IncidentTimeline,
): Deduction {
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
    requiredTags: ["engineer", "timeline_response"],
    unlockAfter: "deduction_why",
    linkedEvidence: [],
    solved: false,
    rewardType: "clearance",
    rewardDescription: "Grants clearance to open a locked door elsewhere in the station",
    hintText: "Find logs describing who took action during the crisis — look for response and rescue evidence.",
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

  const captainTag = captain?.lastName.toLowerCase() || "captain";
  return {
    id: "deduction_responsibility",
    category: DeductionCategory.Who,
    question: "Who bears the most responsibility for what happened?",
    options,
    requiredTags: [captainTag, "timeline_aftermath"],
    unlockAfter: "deduction_hero",
    linkedEvidence: [],
    solved: false,
    rewardType: "room_reveal",
    rewardDescription: "Reveals a hidden section of the station",
    hintText: "Look for aftermath logs and command decisions — who had the authority to act?",
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
    requiredTags: ["signal", "scientist"],
    unlockAfter: "deduction_responsibility",
    linkedEvidence: [],
    solved: false,
    rewardType: "sensor_hint",
    rewardDescription: "Reveals the location of hidden evidence",
    hintText: "Find classified documents and science logs — what was the station's real mission?",
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
  return wrong.slice(0, 3);
}

function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(ROT.RNG.getUniform() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/**
 * Check if a deduction is available for the player to attempt.
 * A deduction is unlocked when:
 * 1. It's not already solved
 * 2. Its prerequisite deduction (unlockAfter) is solved
 * 3. The player's journal contains entries that collectively cover the requiredTags
 */
export function getUnlockedDeductions(
  deductions: Deduction[],
  journal: JournalEntry[],
): Deduction[] {
  const solvedIds = new Set(deductions.filter(d => d.solved).map(d => d.id));
  const allTags = new Set(journal.flatMap(j => j.tags));

  return deductions.filter(d => {
    if (d.solved) return false;
    // Check chain prerequisite
    if (d.unlockAfter && !solvedIds.has(d.unlockAfter)) return false;
    // Check that journal has entries covering all required tags
    for (const tag of d.requiredTags) {
      if (!allTags.has(tag)) return false;
    }
    return true;
  });
}

/**
 * Validate that selected evidence entries cover a deduction's required tags.
 * Returns which tags are covered, which are missing, and whether the link is valid.
 */
export function validateEvidenceLink(
  deduction: Deduction,
  selectedEntryIds: string[],
  journal: JournalEntry[],
): { valid: boolean; coveredTags: string[]; missingTags: string[] } {
  const selectedEntries = journal.filter(j => selectedEntryIds.includes(j.id));
  const selectedTags = new Set(selectedEntries.flatMap(j => j.tags));

  const coveredTags: string[] = [];
  const missingTags: string[] = [];

  for (const tag of deduction.requiredTags) {
    if (selectedTags.has(tag)) {
      coveredTags.push(tag);
    } else {
      missingTags.push(tag);
    }
  }

  return {
    valid: missingTags.length === 0,
    coveredTags,
    missingTags,
  };
}

/**
 * Link evidence to a deduction (updates the deduction's linkedEvidence).
 * Returns updated deduction.
 */
export function linkEvidence(
  deduction: Deduction,
  journalEntryIds: string[],
): Deduction {
  return {
    ...deduction,
    linkedEvidence: [...journalEntryIds],
  };
}

/**
 * Attempt to solve a deduction.
 * Requires linkedEvidence to be valid (cover all requiredTags).
 * Returns the updated deduction and whether the answer was correct.
 */
export function solveDeduction(
  deduction: Deduction,
  answerKey: string,
  journal: JournalEntry[],
): { deduction: Deduction; correct: boolean; validLink: boolean } {
  // Validate evidence link first
  const { valid } = validateEvidenceLink(deduction, deduction.linkedEvidence, journal);
  if (!valid) {
    return { deduction, correct: false, validLink: false };
  }

  const chosen = deduction.options.find(o => o.key === answerKey);
  const correct = chosen?.correct || false;
  return {
    deduction: {
      ...deduction,
      solved: true,
      answeredCorrectly: correct,
    },
    correct,
    validLink: true,
  };
}

function getWhatHintText(archetype: IncidentArchetype): string {
  switch (archetype) {
    case IncidentArchetype.CoolantCascade:
      return "Look for thermal warnings and maintenance logs that describe overheating systems.";
    case IncidentArchetype.HullBreach:
      return "Search for structural inspection reports and pressure monitoring data.";
    case IncidentArchetype.ReactorScram:
      return "Find reactor containment readings and radiation monitoring logs.";
    case IncidentArchetype.Sabotage:
      return "Look for security logs showing unauthorized access and suspicious badge activity.";
    case IncidentArchetype.SignalAnomaly:
      return "Search for signal analysis reports and communications anomaly data.";
    case IncidentArchetype.ContainmentBreach:
      return "Find laboratory records and contamination readings from sealed areas.";
  }
}

function getWhyHintText(archetype: IncidentArchetype): string {
  switch (archetype) {
    case IncidentArchetype.CoolantCascade:
      return "Check maintenance request logs — were warnings ignored or deferred?";
    case IncidentArchetype.HullBreach:
      return "Look for hull inspection records — was damage accumulating over time?";
    case IncidentArchetype.ReactorScram:
      return "Find evidence of deadline pressure and containment field degradation.";
    case IncidentArchetype.Sabotage:
      return "Search for motive — who had a reason to disable station systems?";
    case IncidentArchetype.SignalAnomaly:
      return "Look for external signal data — was something unexpected interfering with electronics?";
    case IncidentArchetype.ContainmentBreach:
      return "Check experiment records — were protocols sufficient for what was being studied?";
  }
}

/**
 * Generate tags for a journal entry based on context.
 * Called when adding new journal entries to derive appropriate tags.
 */
export function generateEvidenceTags(
  category: JournalEntry["category"],
  detail: string,
  roomName: string,
  crewMentioned: string[],
  crewMembers: CrewMember[],
  archetype?: IncidentArchetype,
): string[] {
  const tags: string[] = [];

  // Location tag (room name → lowercase + underscore)
  if (roomName) {
    tags.push(roomName.toLowerCase().replace(/\s+/g, "_"));
  }

  // Crew tags — add role tags for mentioned crew
  for (const crewId of crewMentioned) {
    const member = crewMembers.find(c => c.id === crewId);
    if (member) {
      tags.push(member.role.toLowerCase());
      tags.push(member.lastName.toLowerCase());
    }
  }

  // System tags from content keywords
  const lowerDetail = detail.toLowerCase();
  const systemKeywords: Record<string, string> = {
    "coolant": "coolant",
    "thermal": "thermal",
    "temperature": "thermal",
    "heat": "thermal",
    "reactor": "reactor",
    "containment": "containment",
    "hull": "hull",
    "breach": "hull",
    "pressure": "pressure",
    "depressur": "pressure",
    "signal": "signal",
    "anomal": "signal",
    "electrical": "electrical",
    "power": "electrical",
    "radiation": "radiation",
  };
  for (const [keyword, tag] of Object.entries(systemKeywords)) {
    if (lowerDetail.includes(keyword)) {
      tags.push(tag);
    }
  }

  // Timeline tags from content keywords
  const timelineKeywords: Record<string, string> = {
    "before the incident": "timeline_early",
    "warning": "timeline_early",
    "maintenance": "timeline_early",
    "deferred": "timeline_early",
    "triggered": "timeline_trigger",
    "cascade": "timeline_trigger",
    "started": "timeline_trigger",
    "alarm": "timeline_trigger",
    "response": "timeline_response",
    "evacuate": "timeline_response",
    "rescue": "timeline_response",
    "tried to": "timeline_response",
    "aftermath": "timeline_aftermath",
    "cover": "timeline_aftermath",
    "hidden": "timeline_aftermath",
    "secret": "timeline_aftermath",
  };
  for (const [keyword, tag] of Object.entries(timelineKeywords)) {
    if (lowerDetail.includes(keyword)) {
      tags.push(tag);
    }
  }

  // Archetype-specific tags
  if (archetype) {
    const archTags = getArchetypeTags(archetype);
    // Add the primary archetype tag if it's not already present
    if (archTags.length > 0 && !tags.includes(archTags[0])) {
      // Only add if the content is related to the main system
      if (category === "log" || category === "trace") {
        tags.push(archTags[0]);
      }
    }
  }

  // Deduplicate
  return [...new Set(tags)];
}
