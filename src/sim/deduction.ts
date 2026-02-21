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
import { resolveRevelations } from "../data/revelations.js";

// ── Per-archetype story configuration ────────────────────────────
// Each archetype has a distinct human story with different hero/villain roles,
// question framings, and hint text. This config drives the deduction generators.

interface StoryRoles {
  hero: CrewRole;
  villain: CrewRole | null;            // null = non-crew villain (e.g. AI)
  heroQuestion: string;
  villainQuestion: string;
  heroHint: string;
  villainHint: string;
  /** If villain is null, these provide the non-crew correct answer */
  villainNonCrewLabel?: string;
  villainNonCrewTags?: [string, string];
}

export const STORY_ROLES: Record<IncidentArchetype, StoryRoles> = {
  [IncidentArchetype.CoolantCascade]: {
    hero: CrewRole.Engineer,
    villain: CrewRole.Captain,
    heroQuestion: "Who tried to prevent the disaster?",
    villainQuestion: "Who bears the most responsibility?",
    heroHint: "Find logs describing who raised warnings and fought the cascade — look for maintenance requests and emergency response evidence.",
    villainHint: "Look for maintenance deferral orders and altered incident reports — who had authority to act and chose not to?",
  },
  [IncidentArchetype.HullBreach]: {
    hero: CrewRole.Medic,
    villain: CrewRole.Security,
    heroQuestion: "Who was the real victim here?",
    villainQuestion: "Who caused the breach?",
    heroHint: "Search personal logs for relationship details and fear — whose quarters were in the depressurization zone?",
    villainHint: "Check security access logs at the hull section and disabled alarm records — who had override codes?",
  },
  [IncidentArchetype.ReactorScram]: {
    hero: CrewRole.Scientist,
    villain: null,
    heroQuestion: "Who understood what was really happening?",
    villainQuestion: "What was the data core trying to do?",
    heroHint: "Look for research notes about anomalous processing patterns — who recognized emergent behavior?",
    villainHint: "Examine the data core's behavior logs and the diagnostic reset timing — was the SCRAM defensive or aggressive?",
    villainNonCrewLabel: "Protect itself — the SCRAM was self-preservation, not malice. It was afraid of being erased.",
    villainNonCrewTags: ["data_core", "timeline_aftermath"],
  },
  [IncidentArchetype.Sabotage]: {
    hero: CrewRole.Security,
    villain: CrewRole.Captain,
    heroQuestion: "Who confronted the threat directly?",
    villainQuestion: "Who let this happen?",
    heroHint: "Search for the security officer's final reports and encounter evidence — who faced the unknown threat?",
    villainHint: "Check cargo manifests and biological hazard flags — who approved the transfer despite warnings?",
  },
  [IncidentArchetype.SignalAnomaly]: {
    hero: CrewRole.Engineer,
    villain: CrewRole.Scientist,
    heroQuestion: "Who saved the station from total destruction?",
    villainQuestion: "Who caused the overload?",
    heroHint: "Find emergency action logs — who physically disconnected the array during the electromagnetic storm?",
    villainHint: "Check array modification logs and unauthorized transmission records — who sent the response?",
  },
  [IncidentArchetype.Mutiny]: {
    hero: CrewRole.Medic,
    villain: CrewRole.Security,
    heroQuestion: "Who crossed the line to keep both sides alive?",
    villainQuestion: "Who was following the scuttle order?",
    heroHint: "Look for triage records and medical logs from both factions — who treated injuries on both sides of the barricade?",
    villainHint: "Check classified transmissions and duty rosters — who received orders from UN-ORC Command to destroy the station?",
  },
};

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
      return ["reactor", "data_core", "containment"];
    case IncidentArchetype.Sabotage:
      return ["electrical", "biological"];
    case IncidentArchetype.SignalAnomaly:
      return ["signal", "transmission"];
    case IncidentArchetype.Mutiny:
      return ["faction", "lockdown", "atmospheric"];
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
  deductions.push(generateWhyDeduction(timeline, crew, archTags));

  // ── Tier 4: WHO is the hero/victim? (unlocked after Tier 3) ──
  deductions.push(generateHeroDeduction(crew, timeline));

  // ── Tier 5: WHO bears responsibility? (unlocked after Tier 4) ──
  deductions.push(generateResponsibilityDeduction(crew, timeline));

  // ── Tier 6 (optional): What were they really doing here? ──
  if (timeline.archetype === IncidentArchetype.SignalAnomaly ||
      timeline.archetype === IncidentArchetype.Sabotage) {
    deductions.push(generateHiddenAgendaDeduction(crew, timeline, scientist));
  }

  // ── Attach revelation content to each deduction ──
  for (const d of deductions) {
    const revelations = resolveRevelations(timeline.archetype, d.id, crew, timeline);
    if (revelations) {
      d.tagRevelations = revelations.tagRevelations;
      d.synthesisText = revelations.synthesisText;
      d.conclusionText = revelations.conclusionText;
    }
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

  // Archetype-aware wrong answers — use vocabulary ABSENT from evidence so
  // keyword matching doesn't accidentally favor incorrect options.
  let wrongOptions: string[];
  switch (timeline.archetype) {
    case IncidentArchetype.CoolantCascade:
      // Avoid: coolant, thermal, cascade, relay, junction, heat
      wrongOptions = [
        "Simultaneous navigation thruster failures created station-wide vibration damage",
        "A communications satellite collision knocked out the primary antenna array",
        "A software update corrupted the central control system during a routine patch",
      ];
      break;
    case IncidentArchetype.HullBreach:
      // Avoid: hull, breach, pressure, depressurization, seal, atmosphere, meteorite
      wrongOptions = [
        "A cargo loading accident damaged internal bulkheads and severed power conduits",
        "A reactor coolant overflow flooded lower decks with toxic fluid",
        "A crew quarantine procedure locked down the station after a contamination alarm",
      ];
      break;
    case IncidentArchetype.ReactorScram:
      // Avoid: reactor, SCRAM, containment, shutdown, core, power
      wrongOptions = [
        "A docking collision with a supply vessel fractured the station's central spine",
        "A rogue maintenance drone severed primary data cables throughout the station",
        "An oxygen recycler failure caused crew incapacitation across multiple decks",
      ];
      break;
    case IncidentArchetype.Sabotage:
      // Avoid: sabotage, deliberate, junction, organism, biological, cargo
      wrongOptions = [
        "A radiation shield failure exposed the crew to elevated cosmic ray dosage",
        "A fire suppression system malfunction flooded key compartments with inert gas",
        "A navigation computer error sent the station tumbling out of stable orbit",
      ];
      break;
    case IncidentArchetype.SignalAnomaly:
      // Avoid: signal, anomalous, external, interference, transmission, array, electromagnetic
      wrongOptions = [
        "A structural fatigue event caused progressive corridor collapses",
        "A fuel cell rupture released volatile compounds into the ventilation system",
        "A crew altercation over classified orders escalated into physical confrontation",
      ];
      break;
    case IncidentArchetype.Mutiny:
      // Avoid: factions, life support, contested, barricade, split, scuttle, order
      wrongOptions = [
        "A reactor coolant overflow forced emergency shutdown of the engineering deck",
        "An uncharted debris strike damaged the station's exterior sensor platforms",
        "A medical quarantine escalated when the air recyclers spread a contaminant",
      ];
      break;
    default:
      wrongOptions = [
        "A navigation system failure destabilized the station's orbit",
        "A docking collision severed primary power conduits",
        "A medical quarantine overwhelmed the station's resources",
      ];
  }

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
    requiredTags: [archTags.length > 1 ? archTags[1] : archTags[0], "timeline_trigger"],
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
  crew: CrewMember[],
  archTags: string[],
): Deduction {
  const archetype = timeline.archetype;
  const captain = findByRole(crew, CrewRole.Captain);
  const engineer = findByRole(crew, CrewRole.Engineer);
  const medic = findByRole(crew, CrewRole.Medic);
  const security = findByRole(crew, CrewRole.Security);
  const scientist = findByRole(crew, CrewRole.Scientist);

  let correctKey: string;
  let correctLabel: string;
  let wrongAnswers: string[];
  // The crew member whose name appears as a required tag for this deduction
  let crewTagMember: CrewMember | undefined;

  switch (archetype) {
    case IncidentArchetype.CoolantCascade:
      correctLabel = `Deferred maintenance — ${engineer?.lastName || "the engineer"}'s warnings were suppressed by ${captain?.lastName || "command"}`;
      correctKey = "deferred_maintenance";
      crewTagMember = engineer;
      wrongAnswers = [
        "The engineer sabotaged the junction to prove their maintenance warnings were right",
        "A software update corrupted the thermal monitoring systems",
        "The coolant system was defective from installation — a manufacturing flaw",
      ];
      break;
    case IncidentArchetype.HullBreach:
      correctLabel = "This wasn't an accident — the hull was deliberately weakened";
      correctKey = "deliberate_breach";
      crewTagMember = undefined;  // P0: don't name villain at Tier 3
      wrongAnswers = [
        "Long-term fatigue from unmonitored thermal cycling weakened the structure",
        "A manufacturing defect in the hull plating went undetected",
        "An external collision with space debris caused sudden failure",
      ];
      break;
    case IncidentArchetype.ReactorScram:
      correctLabel = "The data core triggered the SCRAM to prevent its own diagnostic reset";
      correctKey = "ai_self_preservation";
      crewTagMember = scientist;
      wrongAnswers = [
        "The data core malfunctioned due to a corrupted deep-learning cycle",
        "Containment field degraded due to deferred maintenance",
        "The crew pushed reactor output past safe limits for a deadline",
      ];
      break;
    case IncidentArchetype.Sabotage:
      correctLabel = "An alien organism in the cargo disrupts electronics to hunt — the 'sabotage' is a predator";
      correctKey = "alien_predator";
      crewTagMember = undefined;  // P0: don't name villain at Tier 3
      wrongAnswers = [
        "A crew member planted explosive charges at each junction to cover an escape",
        "A cascading software exploit propagated through the network",
        "Corrosive cargo leaked and chemically damaged the junction wiring",
      ];
      break;
    case IncidentArchetype.SignalAnomaly:
      correctLabel = "Someone sent an unauthorized response to the signal using an unshielded array";
      correctKey = "unauthorized_transmission";
      crewTagMember = undefined;  // P2: use "transmission" tag instead of scientist name (saved for Tier 5)
      wrongAnswers = [
        "The alien signal contained a hostile payload that attacked station systems",
        "A classified monitoring operation overloaded the receivers",
        "Natural electromagnetic interference from a nearby pulsar disrupted electronics",
      ];
      break;
    case IncidentArchetype.Mutiny:
      correctLabel = "A classified scuttle order from UN-ORC Command split the crew into opposing factions";
      correctKey = "scuttle_order";
      crewTagMember = undefined;  // P0: don't name villain at Tier 3
      wrongAnswers = [
        "A leadership dispute over evacuation priority escalated into crew-wide conflict",
        "A saboteur deliberately disabled life support to force an evacuation",
        "Contaminated air recyclers caused paranoia and aggression across the crew",
      ];
      break;
    default:
      correctLabel = "System failure compounded by human error";
      correctKey = "compound_failure";
      crewTagMember = engineer;
      wrongAnswers = [
        "The station was simply too old — equipment past its service life",
        "A software update corrupted the safety monitoring systems",
        "Budget cuts from UN-ORC reduced the crew below safe staffing levels",
      ];
  }

  const options = [
    { label: correctLabel, key: correctKey, correct: true },
    ...wrongAnswers.map((label, i) => ({ label, key: `wrong_${i}`, correct: false })),
  ];
  shuffleArray(options);

  const crewTag = crewTagMember?.lastName.toLowerCase() || "engineer";

  // P0/P2 fix: override tags for all archetypes to avoid naming crew members at Tier 3.
  // Crew names should only appear in Tier 5 (deduction_responsibility).
  let requiredTags: string[];
  if (archetype === IncidentArchetype.CoolantCascade) {
    requiredTags = ["coolant", "maintenance"];  // motive tag, not crew name
  } else if (archetype === IncidentArchetype.HullBreach) {
    requiredTags = ["hull", "forensic"];
  } else if (archetype === IncidentArchetype.ReactorScram) {
    requiredTags = ["reactor", "diagnostic"];  // system behavior, not crew name
  } else if (archetype === IncidentArchetype.Sabotage) {
    requiredTags = ["electrical", "biological"];
  } else if (archetype === IncidentArchetype.SignalAnomaly) {
    requiredTags = ["signal", "transmission"];
  } else if (archetype === IncidentArchetype.Mutiny) {
    requiredTags = ["faction", "lockdown"];
  } else {
    requiredTags = [archTags[0], crewTag];
  }

  return {
    id: "deduction_why",
    category: DeductionCategory.Why,
    question: "Why did the incident happen?",
    options,
    requiredTags,
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
  const config = STORY_ROLES[timeline.archetype];
  const hero = findByRole(crew, config.hero);
  const correctLabel = hero
    ? `${hero.firstName} ${hero.lastName} (${hero.role})`
    : `The ${config.hero.toLowerCase()}`;

  const otherCrew = crew.filter(c => c.role !== config.hero).slice(0, 3);
  const wrongLabels = otherCrew.map(c => `${c.firstName} ${c.lastName} (${c.role})`);

  const options = [
    { label: correctLabel, key: "correct", correct: true },
    ...wrongLabels.map((label, i) => ({ label, key: `wrong_${i}`, correct: false })),
  ];
  shuffleArray(options);

  const heroRoleTag = config.hero.toLowerCase();
  return {
    id: "deduction_hero",
    category: DeductionCategory.Who,
    question: config.heroQuestion,
    options,
    requiredTags: [heroRoleTag, "timeline_response"],
    unlockAfter: "deduction_why",
    linkedEvidence: [],
    solved: false,
    rewardType: "clearance",
    rewardDescription: "Grants clearance to open a locked door elsewhere in the station",
    hintText: config.heroHint,
  };
}

function generateResponsibilityDeduction(
  crew: CrewMember[],
  timeline: IncidentTimeline,
): Deduction {
  const config = STORY_ROLES[timeline.archetype];
  let correctLabel: string;
  let requiredTags: string[];
  let excludeIds: string[] = [];

  if (config.villain === null) {
    // Non-crew villain (e.g., the AI in ReactorScram)
    correctLabel = config.villainNonCrewLabel || "An external factor beyond crew control";
    requiredTags = config.villainNonCrewTags || ["data_core", "timeline_aftermath"];
  } else {
    const villain = findByRole(crew, config.villain);
    if (villain) {
      // Per-archetype framing of the villain's guilt
      const villainDesc = getVillainDescription(timeline.archetype);
      correctLabel = `${villain.firstName} ${villain.lastName} — ${villainDesc}`;
      excludeIds.push(villain.id);
      requiredTags = [villain.lastName.toLowerCase(), "timeline_aftermath"];
    } else {
      correctLabel = `Station command — they had the authority and chose not to act`;
      requiredTags = ["captain", "timeline_aftermath"];
    }
  }

  const otherCrew = crew.filter(c => !excludeIds.includes(c.id)).slice(0, 2);
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
    question: config.villainQuestion,
    options,
    requiredTags,
    unlockAfter: "deduction_hero",
    linkedEvidence: [],
    solved: false,
    rewardType: "room_reveal",
    rewardDescription: "Reveals a hidden section of the station",
    hintText: config.villainHint,
  };
}

function getVillainDescription(archetype: IncidentArchetype): string {
  switch (archetype) {
    case IncidentArchetype.CoolantCascade:
      return "suppressed warnings and falsified the incident report";
    case IncidentArchetype.HullBreach:
      return "used security access to disable alarms and weaken the hull";
    case IncidentArchetype.Sabotage:
      return "approved the flagged cargo transfer despite biological hazard warnings";
    case IncidentArchetype.SignalAnomaly:
      return "secretly modified the array and transmitted without authorization";
    case IncidentArchetype.Mutiny:
      return "received the scuttle order and chose to follow it, tearing the crew apart";
    default:
      return "had the authority to prevent this and chose not to act";
  }
}

function generateHiddenAgendaDeduction(
  crew: CrewMember[],
  timeline: IncidentTimeline,
  scientist: CrewMember | undefined,
): Deduction {
  let correctLabel: string;
  let question: string;
  let requiredTags: string[];
  let wrongAnswers: string[];
  let hintText: string;

  if (timeline.archetype === IncidentArchetype.SignalAnomaly) {
    correctLabel = "A genuine non-human signal — first contact. The scientist's response may have been received.";
    question = "What was the signal?";
    requiredTags = ["signal", "transmission"];
    wrongAnswers = [
      "A classified military test signal that the crew was never supposed to detect",
      "Natural electromagnetic interference from a pulsar — the 'patterns' were pareidolia",
      "A signal planted by UN-ORC to test the crew's compliance with communication protocols",
    ];
    hintText = "Analyze the decoded signal data and the content of the outbound transmission — what was actually sent and received?";
  } else {
    correctLabel = "The cargo was a classified biological sample — the station was a waypoint for a covert xenobiology program";
    question = "What was really in that cargo?";
    requiredTags = ["biological", "cargo"];
    wrongAnswers = [
      "Standard research supplies — the biological hazard flag was a bureaucratic error",
      "Classified weapons components being routed through civilian channels",
      "Contraband the captain was smuggling for personal profit",
    ];
    hintText = "Find the real cargo manifest and classified communications — what was the station actually transporting?";
  }

  const options = [
    { label: correctLabel, key: "correct", correct: true },
    ...wrongAnswers.map((label, i) => ({ label, key: `wrong_${i}`, correct: false })),
  ];
  shuffleArray(options);

  return {
    id: "deduction_agenda",
    category: DeductionCategory.Why,
    question,
    options,
    requiredTags,
    unlockAfter: "deduction_responsibility",
    linkedEvidence: [],
    solved: false,
    rewardType: "sensor_hint",
    rewardDescription: "Reveals the location of hidden evidence",
    hintText,
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
    case IncidentArchetype.Mutiny:
      return "The crew split into factions and disabled life support in contested sections";
  }
}

function getWrongIncidentDescriptions(archetype: IncidentArchetype): string[] {
  // Each archetype's wrong answers use vocabulary ABSENT from that archetype's evidence.
  // This prevents keyword overlap between evidence text and incorrect options.
  switch (archetype) {
    case IncidentArchetype.CoolantCascade:
      // Avoid: thermal, cascade, coolant, relay, heat, temperature
      return [
        "A navigation guidance error sent the station into an uncontrolled orbital drift",
        "A communications blackout triggered automated emergency protocols across the station",
        "A crew member introduced a software virus that corrupted critical operating systems",
      ];
    case IncidentArchetype.HullBreach:
      // Avoid: hull, pressure, depressurization, breach, seal, atmosphere
      return [
        "A radiation leak from the reactor forced emergency containment procedures",
        "A power grid overload caused cascading electrical fires throughout the station",
        "A software lockout disabled crew access to all critical control terminals",
      ];
    case IncidentArchetype.ReactorScram:
      // Avoid: reactor, shutdown, containment, SCRAM, core, power
      return [
        "A structural collapse in the cargo bay severed primary communication lines",
        "An atmospheric recycler malfunction introduced toxic compounds into the air supply",
        "A navigational thruster misfire destabilized the station's orbital trajectory",
      ];
    case IncidentArchetype.Sabotage:
      // Avoid: sabotage, deliberate, junction, electrical, biological, organism
      return [
        "A coolant pressure spike overwhelmed the thermal management grid",
        "An uncharted debris field collision damaged exterior sensor arrays",
        "The crew abandoned the station following a false evacuation alarm",
      ];
    case IncidentArchetype.SignalAnomaly:
      // Avoid: signal, anomalous, external, interference, transmission, array
      return [
        "A hull micro-fracture caused slow atmospheric venting over several weeks",
        "A reactor fuel rod degraded, releasing trace radioactive particulates",
        "A crew dispute over resource allocation escalated into a full work stoppage",
      ];
    case IncidentArchetype.Mutiny:
      // Avoid: factions, life support, contested, barricade, split, scuttle
      return [
        "A reactor coolant leak forced emergency evacuation of the engineering deck",
        "An unidentified biological agent spread through the ventilation system",
        "A solar flare knocked out primary electronics and corrupted stored data",
      ];
  }
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
      return "Search for pressure logs and structural failure records in the crew quarters section.";
    case IncidentArchetype.ReactorScram:
      return "Find reactor SCRAM logs and containment field readings — was this really a malfunction?";
    case IncidentArchetype.Sabotage:
      return "Look for the pattern of system failures — is the sequence consistent with human sabotage?";
    case IncidentArchetype.SignalAnomaly:
      return "Search for signal processing logs and electronic interference records.";
    case IncidentArchetype.Mutiny:
      return "Look for sealed bulkheads, disabled life support zones, and factional barricades.";
  }
}

function getWhyHintText(archetype: IncidentArchetype): string {
  switch (archetype) {
    case IncidentArchetype.CoolantCascade:
      return "Check maintenance request logs — were warnings filed and then suppressed?";
    case IncidentArchetype.HullBreach:
      return "Look for evidence of tampering — tool marks, disabled alarms, security access at the breach point.";
    case IncidentArchetype.ReactorScram:
      return "Examine the data core's processing logs — what was happening when the SCRAM triggered?";
    case IncidentArchetype.Sabotage:
      return "Analyze the failure pattern and residue at junction points — is this really human sabotage?";
    case IncidentArchetype.SignalAnomaly:
      return "Check array power logs — was the station receiving, or was it transmitting?";
    case IncidentArchetype.Mutiny:
      return "Find the classified transmission — what orders did UN-ORC send, and who received them?";
  }
}

/**
 * Get a prose explanation for what a tag means in the context of evidence.
 * Used to give players feedback when linking evidence to deductions.
 */
export function getTagExplanation(tag: string, archetype?: IncidentArchetype): string {
  // Archetype-specific flavor takes priority for relevant system tags
  if (archetype) {
    switch (archetype) {
      case IncidentArchetype.CoolantCascade:
        if (tag === "coolant" || tag === "thermal") return "Direct evidence of the thermal cascade event";
        break;
      case IncidentArchetype.HullBreach:
        if (tag === "hull" || tag === "pressure") return "Evidence of the hull breach and depressurization";
        if (tag === "forensic") return "Forensic evidence suggesting tampering at the breach point";
        break;
      case IncidentArchetype.ReactorScram:
        if (tag === "reactor") return "Direct evidence of the reactor emergency shutdown";
        if (tag === "data_core") return "Evidence of anomalous data core behavior during the SCRAM";
        break;
      case IncidentArchetype.Sabotage:
        if (tag === "electrical") return "Evidence of systematic electrical disruption";
        if (tag === "biological") return "Organic traces suggesting a non-human cause";
        break;
      case IncidentArchetype.SignalAnomaly:
        if (tag === "signal") return "Evidence of the anomalous signal event";
        if (tag === "transmission") return "Evidence of outbound array transmission activity";
        break;
      case IncidentArchetype.Mutiny:
        if (tag === "faction") return "Evidence of factional division among the crew";
        if (tag === "lockdown") return "Evidence of deliberate life support shutdowns in contested sections";
        if (tag === "atmospheric") return "Evidence of atmospheric manipulation during the crew conflict";
        break;
    }
  }

  // System tags
  const systemExplanations: Record<string, string> = {
    reactor: "Evidence of reactor system involvement",
    coolant: "Evidence related to the coolant system",
    thermal: "Evidence of thermal anomalies or overheating",
    hull: "Evidence of hull damage or structural failure",
    pressure: "Evidence of atmospheric pressure changes",
    signal: "Evidence of signal interference or communications anomaly",
    electrical: "Evidence of electrical system disruption",
    containment: "Evidence related to containment field integrity",
    radiation: "Evidence of radiation exposure",
    biological: "Organic or biological traces at the site",
    forensic: "Forensic evidence of deliberate tampering",
    data_core: "Evidence of anomalous data core processing",
    classified: "Classified or restricted-access information",
    cargo: "Evidence from cargo manifests or shipping records",
    transmission: "Evidence of array transmission activity",
    faction: "Evidence of crew division into opposing groups",
    lockdown: "Evidence of deliberate section lockdowns",
    medical: "Medical logs or diagnostic evidence",
  };
  if (systemExplanations[tag]) return systemExplanations[tag];

  // Timeline tags
  const timelineExplanations: Record<string, string> = {
    timeline_early: "Information about conditions before the incident",
    timeline_trigger: "Information about what triggered the incident",
    timeline_response: "Evidence of the crew's response during the crisis",
    timeline_aftermath: "Evidence about the aftermath and cover-up attempts",
  };
  if (timelineExplanations[tag]) return timelineExplanations[tag];

  // Role tags
  const roleExplanations: Record<string, string> = {
    captain: "Points to the captain's involvement",
    engineer: "Points to the engineer's involvement",
    medic: "Points to the medic's involvement",
    security: "Points to the security officer's involvement",
    scientist: "Points to the scientist's involvement",
    robotics: "Points to the robotics specialist's involvement",
    life_support: "Points to the life support technician's involvement",
    comms: "Points to the communications officer's involvement",
  };
  if (roleExplanations[tag]) return roleExplanations[tag];

  // Crew last name tags or other unknown tags
  return `Evidence involving ${tag}`;
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
    // New storyline keywords
    "biological": "biological",
    "organic": "biological",
    "creature": "biological",
    "organism": "biological",
    "residue": "biological",
    "specimen": "biological",
    "tool marks": "forensic",
    "tampered": "forensic",
    "deliberate": "forensic",
    "forensic": "forensic",
    "weakened": "forensic",
    "data core": "data_core",
    "sentien": "data_core",
    "diagnostic": "data_core",
    "processing anomal": "data_core",
    "emergent": "data_core",
    "classified": "classified",
    "restricted": "classified",
    "clearance": "classified",
    "black site": "classified",
    "bioweapon": "classified",
    "cargo": "cargo",
    "manifest": "cargo",
    "shipment": "cargo",
    "transfer": "cargo",
    "transmission": "transmission",
    "outbound": "transmission",
    "array": "transmission",
    "symptom": "medical",
    "diagnosis": "medical",
    "contaminant": "medical",
    "exposure": "medical",
    "faction": "faction",
    "mutiny": "faction",
    "split": "faction",
    "barricade": "faction",
    "lockdown": "lockdown",
    "sealed bulkhead": "lockdown",
    "disabled life support": "lockdown",
    "scuttle": "lockdown",
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
