import { describe, it, expect, beforeEach } from "vitest";
import * as ROT from "rot-js";
import { generateCrew } from "../src/sim/crewGen.js";
import { generateTimeline } from "../src/sim/timeline.js";
import {
  generateDeductions, getUnlockedDeductions, solveDeduction,
  validateEvidenceLink, linkEvidence, generateEvidenceTags,
} from "../src/sim/deduction.js";
// Note: validateEvidenceLink and linkEvidence still exist for internal/procgen use
import { IncidentArchetype, DeductionCategory } from "../src/shared/types.js";
import type { JournalEntry } from "../src/shared/types.js";

const ROOM_NAMES = [
  "Arrival Bay", "Engineering Storage", "Power Relay Junction",
  "Central Atrium", "Robotics Bay", "Life Support",
  "Communications Hub", "Crew Quarters", "Research Lab", "Med Bay",
];

/** Helper: create a fake journal entry with given tags. */
function fakeJournal(id: string, tags: string[]): JournalEntry {
  return {
    id,
    turnDiscovered: 1,
    category: "log",
    summary: "test entry",
    detail: "test detail",
    crewMentioned: [],
    roomFound: "Test Room",
    tags,
  };
}

describe("deduction system", () => {
  beforeEach(() => {
    ROT.RNG.setSeed(184201);
  });

  it("generates 5-6 deductions per run", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const deductions = generateDeductions(crew, timeline, ROOM_NAMES);

    expect(deductions.length).toBeGreaterThanOrEqual(5);
    expect(deductions.length).toBeLessThanOrEqual(6);
  });

  it("covers all three categories: WHAT, WHY, WHO", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const deductions = generateDeductions(crew, timeline, ROOM_NAMES);

    const categories = new Set(deductions.map(d => d.category));
    expect(categories.has(DeductionCategory.What)).toBe(true);
    expect(categories.has(DeductionCategory.Why)).toBe(true);
    expect(categories.has(DeductionCategory.Who)).toBe(true);
  });

  it("each deduction has exactly one correct answer", () => {
    for (const archetype of Object.values(IncidentArchetype)) {
      ROT.RNG.setSeed(42);
      const crew = generateCrew(10, 42, ROOM_NAMES);
      const timeline = generateTimeline(crew, archetype, ROOM_NAMES);
      const deductions = generateDeductions(crew, timeline, ROOM_NAMES);

      for (const d of deductions) {
        const correctOptions = d.options.filter(o => o.correct);
        expect(correctOptions.length).toBe(1);
        expect(d.options.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("deductions form a chain via unlockAfter", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const deductions = generateDeductions(crew, timeline, ROOM_NAMES);

    // First deduction has no prerequisite
    expect(deductions[0].unlockAfter).toBeUndefined();

    // Subsequent deductions chain to previous
    for (let i = 1; i < deductions.length; i++) {
      expect(deductions[i].unlockAfter).toBe(deductions[i - 1].id);
    }
  });

  it("deductions have requiredTags instead of evidenceRequired", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const deductions = generateDeductions(crew, timeline, ROOM_NAMES);

    for (const d of deductions) {
      expect(d.requiredTags).toBeDefined();
      expect(d.requiredTags.length).toBeGreaterThan(0);
      expect(d.linkedEvidence).toEqual([]);
    }
  });

  it("getUnlockedDeductions respects chain and evidence count", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const deductions = generateDeductions(crew, timeline, ROOM_NAMES);

    // First deduction needs evidenceThreshold=2, so 0 entries = locked
    const emptyJournal: JournalEntry[] = [];
    const atEmpty = getUnlockedDeductions(deductions, emptyJournal);
    expect(atEmpty.length).toBe(0);

    // With 1 journal entry — still not enough (threshold is 2)
    const journal1 = [fakeJournal("j1", ["coolant"])];
    const atOne = getUnlockedDeductions(deductions, journal1);
    expect(atOne.length).toBe(0);

    // With 2 entries — first deduction unlocks (threshold=2)
    const journal2 = [fakeJournal("j1", ["coolant"]), fakeJournal("j2", ["thermal"])];
    const atTwo = getUnlockedDeductions(deductions, journal2);
    expect(atTwo.length).toBe(1);
    expect(atTwo[0].id).toBe(deductions[0].id);

    // Second deduction is locked because first isn't solved yet (even with enough evidence)
    const journal5 = Array.from({ length: 5 }, (_, i) => fakeJournal(`j${i}`, ["coolant"]));
    const atFive = getUnlockedDeductions(deductions, journal5);
    expect(atFive.length).toBe(1); // still only first (chain prerequisite)
  });

  it("getUnlockedDeductions unlocks next after solving predecessor", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    let deductions = generateDeductions(crew, timeline, ROOM_NAMES);

    // Enough evidence to unlock all tiers (12+ entries)
    const journal = Array.from({ length: 12 }, (_, i) => fakeJournal(`j${i}`, ["coolant"]));

    // Before solving: only first is unlocked (chain prerequisite)
    expect(getUnlockedDeductions(deductions, journal).length).toBe(1);

    // Solve first deduction
    deductions = deductions.map((d, i) =>
      i === 0 ? { ...d, solved: true, answeredCorrectly: true } : d
    );
    // Now second should be unlocked
    const afterFirst = getUnlockedDeductions(deductions, journal);
    expect(afterFirst.length).toBe(1);
    expect(afterFirst[0].id).toBe(deductions[1].id);
  });

  it("validateEvidenceLink checks tag coverage", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const deductions = generateDeductions(crew, timeline, ROOM_NAMES);
    const d = deductions[0]; // needs archetype tag (e.g. "coolant")

    // With no evidence — all tags missing
    const { valid: v1, missingTags: m1 } = validateEvidenceLink(d, [], []);
    expect(v1).toBe(false);
    expect(m1.length).toBe(d.requiredTags.length);

    // With matching evidence
    const journal = [fakeJournal("j1", d.requiredTags)];
    const { valid: v2, coveredTags } = validateEvidenceLink(d, ["j1"], journal);
    expect(v2).toBe(true);
    expect(coveredTags).toEqual(d.requiredTags);
  });

  it("solveDeduction works without evidence linking", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const deductions = generateDeductions(crew, timeline, ROOM_NAMES);
    const d = deductions[0];

    const correctOpt = d.options.find(o => o.correct)!;

    // Correct answer — no evidence linking needed
    const { deduction: solved, correct } = solveDeduction(d, correctOpt.key, []);
    expect(correct).toBe(true);
    expect(solved.solved).toBe(true);
    expect(solved.answeredCorrectly).toBe(true);

    // Wrong answer — increments wrongAttempts, NOT immediately solved
    const wrongOpt = d.options.find(o => !o.correct)!;
    const { deduction: wrong, correct: isCorrect, penalty } = solveDeduction(d, wrongOpt.key, []);
    expect(isCorrect).toBe(false);
    expect(wrong.wrongAttempts).toBe(1);
    expect(wrong.solved).toBe(false); // not locked out yet (1 of 2 attempts)
    expect(penalty).toBeDefined();
    expect(penalty!.hp).toBe(3);
    expect(penalty!.turns).toBe(10);
  });

  it("solveDeduction locks out after max wrong attempts", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const deductions = generateDeductions(crew, timeline, ROOM_NAMES);
    const d = { ...deductions[0], wrongAttempts: 1, maxAttempts: 2 };

    const wrongOpt = d.options.find(o => !o.correct)!;
    const { deduction: locked, correct } = solveDeduction(d, wrongOpt.key, []);
    expect(correct).toBe(false);
    expect(locked.wrongAttempts).toBe(2);
    expect(locked.solved).toBe(true); // locked out
    expect(locked.answeredCorrectly).toBe(false);
  });

  it("generateEvidenceTags produces system tags from content", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const tags = generateEvidenceTags(
      "log",
      "The coolant system failed catastrophically in the reactor room",
      "Engine Core",
      [],
      crew,
      IncidentArchetype.CoolantCascade,
    );
    expect(tags).toContain("coolant");
    expect(tags).toContain("engine_core");
  });

  it("generateEvidenceTags produces crew tags from mentions", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const crewMember = crew[0];
    const tags = generateEvidenceTags(
      "log",
      `${crewMember.firstName} ${crewMember.lastName} filed a maintenance report`,
      "Bridge",
      [crewMember.id],
      crew,
    );
    expect(tags).toContain(crewMember.role.toLowerCase());
    expect(tags).toContain(crewMember.lastName.toLowerCase());
    expect(tags).toContain("bridge");
    expect(tags).toContain("timeline_early"); // "maintenance" keyword
  });

  it("each deduction has a reward type", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const deductions = generateDeductions(crew, timeline, ROOM_NAMES);

    const validRewards = ["clearance", "room_reveal", "drone_disable", "sensor_hint"];
    for (const d of deductions) {
      expect(validRewards).toContain(d.rewardType);
      expect(d.rewardDescription).toBeTruthy();
    }
  });

  it("sabotage archetype generates hidden agenda deduction", () => {
    ROT.RNG.setSeed(184201);
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.Sabotage, ROOM_NAMES);
    const deductions = generateDeductions(crew, timeline, ROOM_NAMES);

    expect(deductions.length).toBe(6);
    const agenda = deductions.find(d => d.id === "deduction_agenda");
    expect(agenda).toBeDefined();
  });

  it("generates valid deductions for all archetypes", () => {
    for (const archetype of Object.values(IncidentArchetype)) {
      ROT.RNG.setSeed(100);
      const crew = generateCrew(10, 100, ROOM_NAMES);
      const timeline = generateTimeline(crew, archetype, ROOM_NAMES);
      const deductions = generateDeductions(crew, timeline, ROOM_NAMES);

      expect(deductions.length).toBeGreaterThanOrEqual(5);
      for (const d of deductions) {
        expect(d.id).toBeTruthy();
        expect(d.question).toBeTruthy();
        expect(d.options.length).toBeGreaterThanOrEqual(3);
        expect(d.requiredTags.length).toBeGreaterThan(0);
      }
    }
  });
});
