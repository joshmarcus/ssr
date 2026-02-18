import { describe, it, expect } from "vitest";
import { getTagExplanation, validateEvidenceLink } from "../src/sim/deduction.js";
import { IncidentArchetype, DeductionCategory } from "../src/shared/types.js";
import type { Deduction, JournalEntry } from "../src/shared/types.js";

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
    expect(expl).toContain("deliberate");
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
