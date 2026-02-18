import { describe, it, expect, beforeEach } from "vitest";
import * as ROT from "rot-js";
import { generateCrew } from "../src/sim/crewGen.js";
import { generateTimeline } from "../src/sim/timeline.js";
import { generateDeductions } from "../src/sim/deduction.js";
import { generateWhatWeKnow, formatRelationship, formatCrewMemberDetail, getDeductionsForEntry } from "../src/sim/whatWeKnow.js";
import { IncidentArchetype, ObjectivePhase } from "../src/shared/types.js";
import type { MysteryState, JournalEntry, CrewMember, Relationship, Deduction } from "../src/shared/types.js";

const ROOM_NAMES = [
  "Arrival Bay", "Engineering Storage", "Power Relay Junction",
  "Central Atrium", "Robotics Bay", "Life Support",
  "Communications Hub", "Crew Quarters", "Research Lab", "Med Bay",
];

function fakeJournal(id: string, tags: string[], crewMentioned: string[] = []): JournalEntry {
  return {
    id,
    turnDiscovered: 1,
    category: "log",
    summary: `Entry ${id}`,
    detail: `Detail for ${id}`,
    crewMentioned,
    roomFound: "Test Room",
    tags,
  };
}

function makeMystery(seed: number, archetype: IncidentArchetype, journal: JournalEntry[] = []): MysteryState {
  ROT.RNG.setSeed(seed);
  const crew = generateCrew(10, seed, ROOM_NAMES);
  const timeline = generateTimeline(crew, archetype, ROOM_NAMES);
  const deductions = generateDeductions(crew, timeline, ROOM_NAMES);
  return {
    crew,
    timeline,
    generatedLogs: [],
    discoveredEvidence: new Set(),
    choices: [],
    journal,
    deductions,
    threads: [],
    objectivePhase: ObjectivePhase.Investigate,
    roomsCleanedCount: 0,
    investigationTrigger: 3,
    evidenceThreshold: 6,
    cleaningDirective: false,
    roomCleanlinessGoal: 80,
  };
}

describe("generateWhatWeKnow", () => {
  beforeEach(() => {
    ROT.RNG.setSeed(184201);
  });

  it("returns 'none' confidence with empty journal", () => {
    const mystery = makeMystery(184201, IncidentArchetype.CoolantCascade);
    const wwk = generateWhatWeKnow(mystery);
    expect(wwk.confidence).toBe("none");
    expect(wwk.paragraphs.length).toBeGreaterThan(0);
    expect(wwk.paragraphs[0]).toContain("No evidence");
  });

  it("returns 'low' confidence with some evidence", () => {
    const journal = [
      fakeJournal("j1", ["coolant", "thermal"]),
      fakeJournal("j2", ["timeline_trigger"]),
      fakeJournal("j3", ["reactor"]),
    ];
    const mystery = makeMystery(184201, IncidentArchetype.CoolantCascade, journal);
    const wwk = generateWhatWeKnow(mystery);
    expect(wwk.confidence).toBe("low");
    expect(wwk.paragraphs.length).toBeGreaterThanOrEqual(2);
  });

  it("includes system tags in incident paragraph", () => {
    const journal = [
      fakeJournal("j1", ["coolant", "thermal"]),
    ];
    const mystery = makeMystery(184201, IncidentArchetype.CoolantCascade, journal);
    const wwk = generateWhatWeKnow(mystery);
    // Should mention the system tags
    const allText = wwk.paragraphs.join(" ");
    expect(allText).toContain("coolant");
  });

  it("includes timeline phases when present", () => {
    const journal = [
      fakeJournal("j1", ["coolant", "timeline_early"]),
      fakeJournal("j2", ["thermal", "timeline_trigger"]),
      fakeJournal("j3", ["reactor", "timeline_response"]),
    ];
    const mystery = makeMystery(184201, IncidentArchetype.CoolantCascade, journal);
    const wwk = generateWhatWeKnow(mystery);
    const allText = wwk.paragraphs.join(" ");
    expect(allText).toContain("warning signs");
    expect(allText).toContain("triggering event");
    expect(allText).toContain("crew's response");
  });

  it("includes crew mentions when entries reference crew", () => {
    const mystery = makeMystery(184201, IncidentArchetype.CoolantCascade);
    const crewId = mystery.crew[0].id;
    mystery.journal = [
      fakeJournal("j1", ["coolant"], [crewId]),
      fakeJournal("j2", ["thermal"]),
      fakeJournal("j3", ["reactor"]),
    ];
    const wwk = generateWhatWeKnow(mystery);
    const allText = wwk.paragraphs.join(" ");
    expect(allText).toContain(mystery.crew[0].lastName);
  });

  it("notes unanswered questions when deductions are unsolved", () => {
    const journal = [
      fakeJournal("j1", ["coolant"]),
    ];
    const mystery = makeMystery(184201, IncidentArchetype.CoolantCascade, journal);
    const wwk = generateWhatWeKnow(mystery);
    const allText = wwk.paragraphs.join(" ");
    expect(allText).toContain("unsolved");
  });

  it("returns 'complete' confidence when all deductions are solved correctly", () => {
    const journal = [fakeJournal("j1", ["coolant"])];
    const mystery = makeMystery(184201, IncidentArchetype.CoolantCascade, journal);
    // Mark all deductions as solved correctly
    for (const d of mystery.deductions) {
      d.solved = true;
      d.answeredCorrectly = true;
    }
    const wwk = generateWhatWeKnow(mystery);
    expect(wwk.confidence).toBe("complete");
  });
});

describe("formatRelationship", () => {
  it("formats ally relationship", () => {
    const crew: CrewMember[] = [
      { id: "c1", firstName: "Alex", lastName: "Chen", role: "engineer" as any, badgeId: "E01", personality: "cautious" as any, relationships: [{ targetId: "c2", type: "ally" }], fate: "survived" as any, lastKnownRoom: "R1" },
      { id: "c2", firstName: "Sam", lastName: "Park", role: "medic" as any, badgeId: "M01", personality: "loyal" as any, relationships: [], fate: "survived" as any, lastKnownRoom: "R2" },
    ];
    const result = formatRelationship(crew[0], crew[0].relationships[0], crew);
    expect(result).toContain("Allies");
    expect(result).toContain("Sam Park");
    expect(result).toContain("Medic");
  });

  it("formats rival relationship", () => {
    const crew: CrewMember[] = [
      { id: "c1", firstName: "Alex", lastName: "Chen", role: "engineer" as any, badgeId: "E01", personality: "cautious" as any, relationships: [{ targetId: "c2", type: "rival" }], fate: "survived" as any, lastKnownRoom: "R1" },
      { id: "c2", firstName: "Sam", lastName: "Park", role: "scientist" as any, badgeId: "S01", personality: "ambitious" as any, relationships: [], fate: "survived" as any, lastKnownRoom: "R2" },
    ];
    const result = formatRelationship(crew[0], crew[0].relationships[0], crew);
    expect(result).toContain("Rivals");
  });

  it("returns empty string for missing target", () => {
    const crew: CrewMember[] = [
      { id: "c1", firstName: "Alex", lastName: "Chen", role: "engineer" as any, badgeId: "E01", personality: "cautious" as any, relationships: [{ targetId: "c999", type: "ally" }], fate: "survived" as any, lastKnownRoom: "R1" },
    ];
    const result = formatRelationship(crew[0], crew[0].relationships[0], crew);
    expect(result).toBe("");
  });
});

describe("formatCrewMemberDetail", () => {
  it("includes name, role, personality, fate, and relationships", () => {
    const crew: CrewMember[] = [
      { id: "c1", firstName: "Alex", lastName: "Chen", role: "engineer" as any, badgeId: "E01", personality: "cautious" as any, relationships: [{ targetId: "c2", type: "ally" }], fate: "survived" as any, lastKnownRoom: "R1" },
      { id: "c2", firstName: "Sam", lastName: "Park", role: "medic" as any, badgeId: "M01", personality: "loyal" as any, relationships: [], fate: "missing" as any, lastKnownRoom: "R2" },
    ];
    const result = formatCrewMemberDetail(crew[0], crew);
    expect(result).toContain("Alex Chen");
    expect(result).toContain("Engineer");
    expect(result).toContain("cautious");
    expect(result).toContain("survived");
    expect(result).toContain("Allies");
    expect(result).toContain("Sam Park");
  });
});

describe("getDeductionsForEntry", () => {
  it("returns deductions that share tags with the entry", () => {
    const journal = [
      fakeJournal("j1", ["coolant", "thermal"]),
      fakeJournal("j2", ["reactor"]),
    ];
    const deductions: Deduction[] = [
      { id: "d1", category: "what" as any, question: "What?", options: [], requiredTags: ["coolant"], linkedEvidence: [], solved: false, rewardType: "room_reveal", rewardDescription: "" },
      { id: "d2", category: "why" as any, question: "Why?", options: [], requiredTags: ["reactor", "engineer"], linkedEvidence: [], solved: false, rewardType: "clearance", rewardDescription: "" },
    ];

    const result = getDeductionsForEntry("j1", journal, deductions);
    expect(result.length).toBe(1);
    expect(result[0].deductionId).toBe("d1");
    expect(result[0].contributingTags).toEqual(["coolant"]);
  });

  it("shows missing tags across full journal", () => {
    const journal = [
      fakeJournal("j1", ["reactor"]),
    ];
    const deductions: Deduction[] = [
      { id: "d2", category: "why" as any, question: "Why?", options: [], requiredTags: ["reactor", "engineer"], linkedEvidence: [], solved: false, rewardType: "clearance", rewardDescription: "" },
    ];

    const result = getDeductionsForEntry("j1", journal, deductions);
    expect(result.length).toBe(1);
    expect(result[0].missingTags).toEqual(["engineer"]);
  });

  it("returns empty for entries with no matching tags", () => {
    const journal = [
      fakeJournal("j1", ["unrelated_tag"]),
    ];
    const deductions: Deduction[] = [
      { id: "d1", category: "what" as any, question: "What?", options: [], requiredTags: ["coolant"], linkedEvidence: [], solved: false, rewardType: "room_reveal", rewardDescription: "" },
    ];

    const result = getDeductionsForEntry("j1", journal, deductions);
    expect(result.length).toBe(0);
  });

  it("returns empty for non-existent entry", () => {
    const journal = [fakeJournal("j1", ["coolant"])];
    const deductions: Deduction[] = [
      { id: "d1", category: "what" as any, question: "What?", options: [], requiredTags: ["coolant"], linkedEvidence: [], solved: false, rewardType: "room_reveal", rewardDescription: "" },
    ];
    const result = getDeductionsForEntry("nonexistent", journal, deductions);
    expect(result.length).toBe(0);
  });
});

describe("deduction hintText", () => {
  beforeEach(() => {
    ROT.RNG.setSeed(42);
  });

  it("all deductions have hintText for CoolantCascade", () => {
    const mystery = makeMystery(42, IncidentArchetype.CoolantCascade);
    for (const d of mystery.deductions) {
      expect(d.hintText).toBeDefined();
      expect(typeof d.hintText).toBe("string");
      expect(d.hintText!.length).toBeGreaterThan(0);
    }
  });

  it("all deductions have hintText for HullBreach", () => {
    ROT.RNG.setSeed(123);
    const mystery = makeMystery(123, IncidentArchetype.HullBreach);
    for (const d of mystery.deductions) {
      expect(d.hintText).toBeDefined();
      expect(d.hintText!.length).toBeGreaterThan(0);
    }
  });

  it("all deductions have hintText for SignalAnomaly", () => {
    ROT.RNG.setSeed(456);
    const mystery = makeMystery(456, IncidentArchetype.SignalAnomaly);
    for (const d of mystery.deductions) {
      expect(d.hintText).toBeDefined();
      expect(d.hintText!.length).toBeGreaterThan(0);
    }
  });
});
