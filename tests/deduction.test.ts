import { describe, it, expect, beforeEach } from "vitest";
import * as ROT from "rot-js";
import { generateCrew } from "../src/sim/crewGen.js";
import { generateTimeline } from "../src/sim/timeline.js";
import {
  generateDeductions, getUnlockedDeductions, solveDeduction,
  validateEvidenceLink, linkEvidence, generateEvidenceTags,
} from "../src/sim/deduction.js";
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

  it("getUnlockedDeductions respects chain and tags", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const deductions = generateDeductions(crew, timeline, ROOM_NAMES);

    // With no journal entries — only first deduction could be unlocked IF its tags are covered
    const emptyJournal: JournalEntry[] = [];
    const atEmpty = getUnlockedDeductions(deductions, emptyJournal);
    // First deduction needs at least one tag, so nothing unlocked with empty journal
    expect(atEmpty.length).toBe(0);

    // With a journal entry covering the first deduction's tags
    const firstTags = deductions[0].requiredTags;
    const journal = [fakeJournal("j1", firstTags)];
    const atOne = getUnlockedDeductions(deductions, journal);
    expect(atOne.length).toBe(1);
    expect(atOne[0].id).toBe(deductions[0].id);

    // Second deduction is locked because first isn't solved yet
    const secondTags = deductions[1].requiredTags;
    const bigJournal = [fakeJournal("j1", firstTags), fakeJournal("j2", secondTags)];
    const atTwo = getUnlockedDeductions(deductions, bigJournal);
    expect(atTwo.length).toBe(1); // still only first
  });

  it("getUnlockedDeductions unlocks next after solving predecessor", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    let deductions = generateDeductions(crew, timeline, ROOM_NAMES);

    // Cover all tags needed
    const allTags = deductions.flatMap(d => d.requiredTags);
    const journal = [fakeJournal("j_all", [...new Set(allTags)])];

    // Before solving: only first is unlocked
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

  it("solveDeduction requires valid evidence link", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const deductions = generateDeductions(crew, timeline, ROOM_NAMES);
    const d = deductions[0];

    const correctOpt = d.options.find(o => o.correct)!;

    // Without linked evidence — should fail
    const { correct: c1, validLink: vl1 } = solveDeduction(d, correctOpt.key, []);
    expect(vl1).toBe(false);
    expect(c1).toBe(false);

    // With linked evidence covering tags
    const journal = [fakeJournal("j1", d.requiredTags)];
    const linked = linkEvidence(d, ["j1"]);
    const { deduction: solved, correct, validLink } = solveDeduction(linked, correctOpt.key, journal);
    expect(validLink).toBe(true);
    expect(correct).toBe(true);
    expect(solved.solved).toBe(true);
    expect(solved.answeredCorrectly).toBe(true);

    // Wrong answer with valid link
    const wrongOpt = d.options.find(o => !o.correct)!;
    const { deduction: wrong, correct: isCorrect, validLink: vl3 } = solveDeduction(linked, wrongOpt.key, journal);
    expect(vl3).toBe(true);
    expect(isCorrect).toBe(false);
    expect(wrong.solved).toBe(true);
    expect(wrong.answeredCorrectly).toBe(false);
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
