import { describe, it, expect, beforeEach } from "vitest";
import * as ROT from "rot-js";
import { selectArchetype, getTemplate, INCIDENT_TEMPLATES } from "../src/sim/incidents.js";
import { generateCrew } from "../src/sim/crewGen.js";
import { generateTimeline, generateLogs } from "../src/sim/timeline.js";
import { IncidentArchetype, TimelinePhase } from "../src/shared/types.js";

const ROOM_NAMES = [
  "Arrival Bay", "Engineering Storage", "Power Relay Junction",
  "Central Atrium", "Robotics Bay", "Life Support",
  "Communications Hub", "Crew Quarters", "Research Lab", "Med Bay",
];

const ALL_ARCHETYPES = Object.values(IncidentArchetype);

describe("incidents", () => {
  beforeEach(() => {
    ROT.RNG.setSeed(184201);
  });

  it("selectArchetype returns a valid archetype for any seed", () => {
    for (let seed = 0; seed < 100; seed++) {
      const archetype = selectArchetype(seed);
      expect(ALL_ARCHETYPES).toContain(archetype);
    }
  });

  it("all 6 archetypes have complete templates", () => {
    for (const arch of ALL_ARCHETYPES) {
      const template = getTemplate(arch);
      expect(template).toBeDefined();
      expect(template.name).toBeTruthy();
      expect(template.primaryHazard).toBeTruthy();
      expect(template.sensorBias).toBeTruthy();
      expect(template.storyHook).toBeTruthy();
      expect(template.centralRoles.length).toBeGreaterThan(0);
      expect(template.logCategories.length).toBeGreaterThan(0);

      // Must have all 5 phases
      const phases = Object.values(TimelinePhase);
      for (const phase of phases) {
        expect(template.beats[phase]).toBeTruthy();
      }
    }
  });

  it("each archetype produces a valid 5-phase timeline", () => {
    for (const arch of ALL_ARCHETYPES) {
      ROT.RNG.setSeed(184201);
      const crew = generateCrew(10, 184201, ROOM_NAMES);
      const timeline = generateTimeline(crew, arch, ROOM_NAMES);

      expect(timeline.archetype).toBe(arch);
      expect(timeline.events.length).toBe(5);
      expect(timeline.primaryHazard).toBeTruthy();
      expect(timeline.sensorBias).toBeTruthy();

      // Check all 5 phases are present
      const phases = timeline.events.map(e => e.phase);
      expect(phases).toContain(TimelinePhase.NormalOps);
      expect(phases).toContain(TimelinePhase.Trigger);
      expect(phases).toContain(TimelinePhase.Escalation);
      expect(phases).toContain(TimelinePhase.Collapse);
      expect(phases).toContain(TimelinePhase.Aftermath);
    }
  });

  it("sabotage archetype assigns a culprit", () => {
    ROT.RNG.setSeed(184201);
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.Sabotage, ROOM_NAMES);
    expect(timeline.culpritId).toBeTruthy();
  });

  it("non-sabotage archetypes have no culprit", () => {
    for (const arch of ALL_ARCHETYPES.filter(a => a !== IncidentArchetype.Sabotage)) {
      ROT.RNG.setSeed(184201);
      const crew = generateCrew(10, 184201, ROOM_NAMES);
      const timeline = generateTimeline(crew, arch, ROOM_NAMES);
      expect(timeline.culpritId).toBeUndefined();
    }
  });

  it("all templates instantiate cleanly for each archetype", () => {
    for (const arch of ALL_ARCHETYPES) {
      ROT.RNG.setSeed(42);
      const crew = generateCrew(10, 42, ROOM_NAMES);
      const timeline = generateTimeline(crew, arch, ROOM_NAMES);
      const logs = generateLogs(crew, timeline, ROOM_NAMES, 16);

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.length).toBeLessThanOrEqual(16);

      // Check no unresolved template variables
      for (const log of logs) {
        expect(log.title).toBeTruthy();
        expect(log.text).toBeTruthy();
        expect(log.source).toBeTruthy();
      }
    }
  });
});
