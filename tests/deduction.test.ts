import { describe, it, expect, beforeEach } from "vitest";
import * as ROT from "rot-js";
import { generateCrew } from "../src/sim/crewGen.js";
import { generateTimeline } from "../src/sim/timeline.js";
import { generateDeductions, getUnlockedDeductions, solveDeduction } from "../src/sim/deduction.js";
import { IncidentArchetype, DeductionCategory } from "../src/shared/types.js";

const ROOM_NAMES = [
  "Arrival Bay", "Engineering Storage", "Power Relay Junction",
  "Central Atrium", "Robotics Bay", "Life Support",
  "Communications Hub", "Crew Quarters", "Research Lab", "Med Bay",
];

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

  it("deductions have increasing evidence requirements", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const deductions = generateDeductions(crew, timeline, ROOM_NAMES);

    // First deduction should require least evidence
    const firstReq = deductions[0].evidenceRequired;
    expect(firstReq).toBeLessThanOrEqual(3);

    // Last deduction should require more
    const lastReq = deductions[deductions.length - 1].evidenceRequired;
    expect(lastReq).toBeGreaterThan(firstReq);
  });

  it("getUnlockedDeductions respects evidence requirements", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const deductions = generateDeductions(crew, timeline, ROOM_NAMES);

    const atZero = getUnlockedDeductions(deductions, 0);
    expect(atZero.length).toBe(0);

    const atTwo = getUnlockedDeductions(deductions, 2);
    expect(atTwo.length).toBeGreaterThanOrEqual(1);

    const atTen = getUnlockedDeductions(deductions, 10);
    expect(atTen.length).toBeGreaterThan(atTwo.length);
  });

  it("solveDeduction marks as correct/incorrect", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const deductions = generateDeductions(crew, timeline, ROOM_NAMES);
    const d = deductions[0];

    // Find correct answer
    const correctOpt = d.options.find(o => o.correct)!;
    const { deduction: solved, correct } = solveDeduction(d, correctOpt.key);
    expect(correct).toBe(true);
    expect(solved.solved).toBe(true);
    expect(solved.answeredCorrectly).toBe(true);

    // Wrong answer
    const wrongOpt = d.options.find(o => !o.correct)!;
    const { deduction: wrong, correct: isCorrect } = solveDeduction(d, wrongOpt.key);
    expect(isCorrect).toBe(false);
    expect(wrong.solved).toBe(true);
    expect(wrong.answeredCorrectly).toBe(false);
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
      }
    }
  });
});
