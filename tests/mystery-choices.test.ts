import { describe, it, expect, beforeEach } from "vitest";
import * as ROT from "rot-js";
import { generateCrew } from "../src/sim/crewGen.js";
import { generateTimeline } from "../src/sim/timeline.js";
import { generateMysteryChoices, computeChoiceEndings } from "../src/sim/mysteryChoices.js";
import { IncidentArchetype, CrewRole } from "../src/shared/types.js";

const ROOM_NAMES = [
  "Arrival Bay", "Engineering Storage", "Power Relay Junction",
  "Central Atrium", "Robotics Bay", "Life Support",
  "Communications Hub", "Crew Quarters", "Research Lab", "Med Bay",
];

describe("mystery choices", () => {
  beforeEach(() => {
    ROT.RNG.setSeed(42);
  });

  it("generates exactly 3 choices", () => {
    const crew = generateCrew(10, 42, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const choices = generateMysteryChoices(crew, timeline, ROOM_NAMES);
    expect(choices.length).toBe(3);
  });

  it("always includes blame and data handling choices", () => {
    for (const archetype of Object.values(IncidentArchetype)) {
      ROT.RNG.setSeed(42);
      const crew = generateCrew(10, 42, ROOM_NAMES);
      const timeline = generateTimeline(crew, archetype, ROOM_NAMES);
      const choices = generateMysteryChoices(crew, timeline, ROOM_NAMES);

      const blame = choices.find(c => c.id === "choice_blame");
      expect(blame).toBeDefined();
      expect(blame!.options.length).toBe(3);

      const data = choices.find(c => c.id === "choice_data");
      expect(data).toBeDefined();
      expect(data!.options.length).toBe(3);
    }
  });

  it("sabotage archetype generates saboteur accusation choice", () => {
    ROT.RNG.setSeed(42);
    const crew = generateCrew(10, 42, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.Sabotage, ROOM_NAMES);
    const choices = generateMysteryChoices(crew, timeline, ROOM_NAMES);

    const saboteur = choices.find(c => c.id === "choice_saboteur");
    expect(saboteur).toBeDefined();
    expect(saboteur!.consequence).toBe("accusation");
  });

  it("signal anomaly archetype generates signal response choice", () => {
    ROT.RNG.setSeed(42);
    const crew = generateCrew(10, 42, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.SignalAnomaly, ROOM_NAMES);
    const choices = generateMysteryChoices(crew, timeline, ROOM_NAMES);

    const signal = choices.find(c => c.id === "choice_signal");
    expect(signal).toBeDefined();
    expect(signal!.consequence).toBe("signal_response");
  });

  it("non-sabotage/signal archetypes generate rescue priority choice", () => {
    for (const archetype of [IncidentArchetype.CoolantCascade, IncidentArchetype.HullBreach, IncidentArchetype.ReactorScram, IncidentArchetype.Mutiny]) {
      ROT.RNG.setSeed(42);
      const crew = generateCrew(10, 42, ROOM_NAMES);
      const timeline = generateTimeline(crew, archetype, ROOM_NAMES);
      const choices = generateMysteryChoices(crew, timeline, ROOM_NAMES);

      const priority = choices.find(c => c.id === "choice_priority");
      expect(priority).toBeDefined();
      expect(priority!.consequence).toBe("rescue_priority");
    }
  });

  it("computeChoiceEndings returns empty for unchosen choices", () => {
    ROT.RNG.setSeed(42);
    const crew = generateCrew(10, 42, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const choices = generateMysteryChoices(crew, timeline, ROOM_NAMES);

    const endings = computeChoiceEndings(choices);
    expect(endings.length).toBe(0);
  });

  it("computeChoiceEndings generates text for each chosen option", () => {
    ROT.RNG.setSeed(42);
    const crew = generateCrew(10, 42, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const choices = generateMysteryChoices(crew, timeline, ROOM_NAMES);

    // Choose one option per choice
    choices[0].chosen = choices[0].options[0].key; // blame
    choices[1].chosen = choices[1].options[1].key; // data handling
    choices[2].chosen = choices[2].options[2].key; // third choice

    const endings = computeChoiceEndings(choices);
    expect(endings.length).toBe(3);
    // Each ending should be a non-empty string
    for (const line of endings) {
      expect(line.length).toBeGreaterThan(0);
    }
  });

  it("each blame option produces different ending text", () => {
    ROT.RNG.setSeed(42);
    const crew = generateCrew(10, 42, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);

    const endingsMap = new Set<string>();
    for (const optKey of ["engineer_right", "captain_right", "system_fault"]) {
      const choices = generateMysteryChoices(crew, timeline, ROOM_NAMES);
      choices[0].chosen = optKey;
      const endings = computeChoiceEndings(choices);
      expect(endings.length).toBe(1);
      endingsMap.add(endings[0]);
    }
    // All 3 endings should be different
    expect(endingsMap.size).toBe(3);
  });

  it("each data handling option produces different ending text", () => {
    ROT.RNG.setSeed(42);
    const crew = generateCrew(10, 42, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);

    const endingsMap = new Set<string>();
    for (const optKey of ["transmit_all", "research_only", "encrypted"]) {
      const choices = generateMysteryChoices(crew, timeline, ROOM_NAMES);
      choices[1].chosen = optKey;
      const endings = computeChoiceEndings(choices);
      expect(endings.length).toBe(1);
      endingsMap.add(endings[0]);
    }
    expect(endingsMap.size).toBe(3);
  });

  it("choices reference crew members by name", () => {
    ROT.RNG.setSeed(42);
    const crew = generateCrew(10, 42, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const choices = generateMysteryChoices(crew, timeline, ROOM_NAMES);

    const blame = choices.find(c => c.id === "choice_blame")!;
    const captain = crew.find(c => c.role === CrewRole.Captain);
    const engineer = crew.find(c => c.role === CrewRole.Engineer);

    // Blame choice should reference the captain and engineer
    if (captain) expect(blame.prompt).toContain(captain.lastName);
    if (engineer) expect(blame.prompt).toContain(engineer.lastName);
  });
});
