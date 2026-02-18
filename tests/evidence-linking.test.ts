import { describe, it, expect, beforeEach } from "vitest";
import * as ROT from "rot-js";
import { getTagExplanation, validateEvidenceLink, generateDeductions } from "../src/sim/deduction.js";
import { generateCrew } from "../src/sim/crewGen.js";
import { generateTimeline } from "../src/sim/timeline.js";
import { IncidentArchetype, DeductionCategory, CrewRole } from "../src/shared/types.js";
import type { Deduction, JournalEntry } from "../src/shared/types.js";
import { resolveRevelationTemplate, resolveRevelations } from "../src/data/revelations.js";

describe("getTagExplanation", () => {
  it("returns meaningful text for system tags", () => {
    expect(getTagExplanation("reactor")).toContain("reactor");
    expect(getTagExplanation("coolant")).toContain("coolant");
    expect(getTagExplanation("hull")).toContain("hull");
    expect(getTagExplanation("signal")).toContain("signal");
    expect(getTagExplanation("containment")).toContain("containment");
    expect(getTagExplanation("pressure")).toContain("pressure");
  });

  it("returns meaningful text for timeline tags", () => {
    expect(getTagExplanation("timeline_early")).toContain("before");
    expect(getTagExplanation("timeline_trigger")).toContain("trigger");
    expect(getTagExplanation("timeline_response")).toContain("response");
    expect(getTagExplanation("timeline_aftermath")).toContain("aftermath");
  });

  it("returns meaningful text for role tags", () => {
    expect(getTagExplanation("captain")).toContain("captain");
    expect(getTagExplanation("engineer")).toContain("engineer");
    expect(getTagExplanation("medic")).toContain("medic");
    expect(getTagExplanation("scientist")).toContain("scientist");
  });

  it("returns fallback for unknown tags (crew names)", () => {
    const result = getTagExplanation("kowalski");
    expect(result).toContain("kowalski");
  });

  it("varies explanation by archetype for system tags", () => {
    const cascadeExpl = getTagExplanation("coolant", IncidentArchetype.CoolantCascade);
    const genericExpl = getTagExplanation("coolant");
    // Archetype-specific should mention cascade/thermal, generic just mentions coolant
    expect(cascadeExpl).toContain("thermal cascade");
    expect(genericExpl).not.toContain("thermal cascade");
  });

  it("provides archetype-specific flavor for hull breach", () => {
    const expl = getTagExplanation("hull", IncidentArchetype.HullBreach);
    expect(expl).toContain("hull breach");
  });

  it("provides archetype-specific flavor for sabotage", () => {
    const expl = getTagExplanation("electrical", IncidentArchetype.Sabotage);
    expect(expl).toContain("electrical");
  });
});

describe("validateEvidenceLink — tag coverage feedback", () => {
  const makeDeduction = (requiredTags: string[]): Deduction => ({
    id: "test_ded",
    category: DeductionCategory.What,
    question: "What happened?",
    options: [
      { label: "Option A", key: "a", correct: true },
      { label: "Option B", key: "b", correct: false },
    ],
    requiredTags,
    linkedEvidence: [],
    solved: false,
    rewardType: "room_reveal",
    rewardDescription: "Test reward",
  });

  const makeEntry = (id: string, tags: string[]): JournalEntry => ({
    id,
    category: "log",
    summary: `Evidence ${id}`,
    detail: `Detail for ${id}`,
    tags,
    crewMentioned: [],
    turnDiscovered: 1,
    roomFound: "Test Room",
  });

  it("reports all tags covered when evidence matches", () => {
    const ded = makeDeduction(["reactor", "timeline_trigger"]);
    const journal = [
      makeEntry("e1", ["reactor", "thermal"]),
      makeEntry("e2", ["timeline_trigger", "alarm"]),
    ];
    const result = validateEvidenceLink(ded, ["e1", "e2"], journal);
    expect(result.valid).toBe(true);
    expect(result.coveredTags).toEqual(["reactor", "timeline_trigger"]);
    expect(result.missingTags).toEqual([]);
  });

  it("reports missing tags when evidence is incomplete", () => {
    const ded = makeDeduction(["reactor", "timeline_trigger", "engineer"]);
    const journal = [
      makeEntry("e1", ["reactor"]),
    ];
    const result = validateEvidenceLink(ded, ["e1"], journal);
    expect(result.valid).toBe(false);
    expect(result.coveredTags).toEqual(["reactor"]);
    expect(result.missingTags).toEqual(["timeline_trigger", "engineer"]);
  });

  it("reports all missing when no evidence linked", () => {
    const ded = makeDeduction(["reactor", "timeline_trigger"]);
    const journal = [makeEntry("e1", ["reactor"])];
    const result = validateEvidenceLink(ded, [], journal);
    expect(result.valid).toBe(false);
    expect(result.coveredTags).toEqual([]);
    expect(result.missingTags).toEqual(["reactor", "timeline_trigger"]);
  });

  it("single entry can cover multiple required tags", () => {
    const ded = makeDeduction(["reactor", "timeline_trigger"]);
    const journal = [
      makeEntry("e1", ["reactor", "timeline_trigger", "extra"]),
    ];
    const result = validateEvidenceLink(ded, ["e1"], journal);
    expect(result.valid).toBe(true);
    expect(result.coveredTags).toEqual(["reactor", "timeline_trigger"]);
  });
});

// ── Revelation system tests ──────────────────────────────────────

const ROOM_NAMES = [
  "Arrival Bay", "Engineering Storage", "Power Relay Junction",
  "Central Atrium", "Robotics Bay", "Life Support",
  "Communications Hub", "Crew Quarters", "Research Lab", "Med Bay",
];

describe("revelation generation", () => {
  beforeEach(() => {
    ROT.RNG.setSeed(184201);
  });

  it("generates tagRevelations for CoolantCascade deductions", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const deductions = generateDeductions(crew, timeline, ROOM_NAMES);

    // deduction_what should have revelations
    const whatDed = deductions.find(d => d.id === "deduction_what");
    expect(whatDed).toBeDefined();
    expect(whatDed!.tagRevelations).toBeDefined();
    expect(whatDed!.tagRevelations!.length).toBeGreaterThan(0);
    expect(whatDed!.synthesisText).toBeDefined();
    expect(whatDed!.synthesisText!.length).toBeGreaterThan(0);
    expect(whatDed!.conclusionText).toBeDefined();
    expect(whatDed!.conclusionText!.length).toBeGreaterThan(0);
  });

  it("generates revelations for all 5 archetypes", () => {
    const archetypes = [
      IncidentArchetype.CoolantCascade,
      IncidentArchetype.HullBreach,
      IncidentArchetype.ReactorScram,
      IncidentArchetype.Sabotage,
      IncidentArchetype.SignalAnomaly,
    ];

    for (const archetype of archetypes) {
      ROT.RNG.setSeed(184201);
      const crew = generateCrew(10, 184201, ROOM_NAMES);
      const timeline = generateTimeline(crew, archetype, ROOM_NAMES);
      const deductions = generateDeductions(crew, timeline, ROOM_NAMES);

      // At least deduction_what should have revelations for every archetype
      const whatDed = deductions.find(d => d.id === "deduction_what");
      expect(whatDed?.tagRevelations, `${archetype} deduction_what should have tagRevelations`).toBeDefined();
      expect(whatDed?.synthesisText, `${archetype} deduction_what should have synthesisText`).toBeDefined();
    }
  });

  it("tagRevelations length matches requiredTags length", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const deductions = generateDeductions(crew, timeline, ROOM_NAMES);

    for (const d of deductions) {
      if (d.tagRevelations) {
        expect(d.tagRevelations.length, `${d.id} tagRevelations count should match requiredTags count`).toBe(d.requiredTags.length);
      }
    }
  });

  it("resolves template placeholders (no raw {engineer} in final text)", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const deductions = generateDeductions(crew, timeline, ROOM_NAMES);

    for (const d of deductions) {
      if (d.tagRevelations) {
        for (const rev of d.tagRevelations) {
          expect(rev.text).not.toMatch(/\{engineer\}/);
          expect(rev.text).not.toMatch(/\{captain\}/);
          expect(rev.text).not.toMatch(/\{engineer_last\}/);
          expect(rev.text).not.toMatch(/\{captain_last\}/);
        }
      }
      if (d.synthesisText) {
        expect(d.synthesisText).not.toMatch(/\{engineer\}/);
        expect(d.synthesisText).not.toMatch(/\{captain\}/);
      }
      if (d.conclusionText) {
        expect(d.conclusionText).not.toMatch(/\{engineer\}/);
        expect(d.conclusionText).not.toMatch(/\{captain\}/);
      }
    }
  });

  it("tag revelations have tag-specific sentences", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const deductions = generateDeductions(crew, timeline, ROOM_NAMES);

    const whyDed = deductions.find(d => d.id === "deduction_why");
    expect(whyDed?.tagRevelations).toBeDefined();
    if (whyDed?.tagRevelations) {
      // Each revelation should have a unique tag
      const tags = whyDed.tagRevelations.map(r => r.tag);
      expect(new Set(tags).size).toBe(tags.length);
      // Each should have a non-empty text
      for (const rev of whyDed.tagRevelations) {
        expect(rev.text.length).toBeGreaterThan(20);
      }
    }
  });
});

describe("resolveRevelationTemplate", () => {
  it("replaces crew name placeholders", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const engineer = crew.find(c => c.role === CrewRole.Engineer);

    const result = resolveRevelationTemplate(
      "{engineer} filed a report. {engineer_last} warned command.",
      crew,
      timeline,
    );

    expect(result).not.toContain("{engineer}");
    expect(result).not.toContain("{engineer_last}");
    if (engineer) {
      expect(result).toContain(engineer.firstName);
      expect(result).toContain(engineer.lastName);
    }
  });

  it("provides fallback when crew role missing", () => {
    // Use a minimal fake timeline — generateTimeline requires crew, so we mock it
    const fakeTimeline = {
      archetype: IncidentArchetype.CoolantCascade,
      events: [],
      primaryHazard: "thermal",
      sensorBias: "thermal" as const,
    };
    const result = resolveRevelationTemplate("{engineer} filed a report.", [], fakeTimeline as any);
    expect(result).toContain("the engineer");
    expect(result).not.toContain("{engineer}");
  });
});

describe("resolveRevelations", () => {
  beforeEach(() => {
    ROT.RNG.setSeed(184201);
  });

  it("returns resolved revelations for valid archetype/deduction", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);

    const result = resolveRevelations(IncidentArchetype.CoolantCascade, "deduction_what", crew, timeline);
    expect(result).toBeDefined();
    expect(result!.tagRevelations.length).toBeGreaterThan(0);
    expect(result!.synthesisText.length).toBeGreaterThan(0);
    expect(result!.conclusionText.length).toBeGreaterThan(0);
  });

  it("returns undefined for non-existent deduction", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);

    const result = resolveRevelations(IncidentArchetype.CoolantCascade, "deduction_nonexistent", crew, timeline);
    expect(result).toBeUndefined();
  });

  it("resolves crew-name tags in tagRevelations", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const engineer = crew.find(c => c.role === CrewRole.Engineer);

    const result = resolveRevelations(IncidentArchetype.CoolantCascade, "deduction_why", crew, timeline);
    expect(result).toBeDefined();
    // The "why" deduction has a tag that was "{engineer_last}" — should be resolved to actual name
    if (engineer && result) {
      const engineerTag = result.tagRevelations.find(tr => tr.tag === engineer.lastName.toLowerCase());
      expect(engineerTag, "should resolve {engineer_last} tag to actual last name").toBeDefined();
    }
  });
});
