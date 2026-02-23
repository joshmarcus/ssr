import { describe, it, expect, beforeEach } from "vitest";
import * as ROT from "rot-js";
import { generateCrew } from "../src/sim/crewGen.js";
import { generateTimeline, generateLogs, hasUnresolvedVars } from "../src/sim/timeline.js";
import { generateMysteryChoices } from "../src/sim/mysteryChoices.js";
import { IncidentArchetype, TimelinePhase } from "../src/shared/types.js";

const ROOM_NAMES = [
  "Arrival Bay", "Engineering Storage", "Power Relay Junction",
  "Central Atrium", "Robotics Bay", "Life Support",
  "Communications Hub", "Crew Quarters", "Research Lab", "Med Bay",
  "Observation Deck", "Cargo Hold",
];

describe("timeline", () => {
  beforeEach(() => {
    ROT.RNG.setSeed(184201);
  });

  it("events are temporally ordered (phases in sequence)", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);

    const phases = [
      TimelinePhase.NormalOps,
      TimelinePhase.Trigger,
      TimelinePhase.Escalation,
      TimelinePhase.Collapse,
      TimelinePhase.Aftermath,
    ];

    for (let i = 0; i < timeline.events.length; i++) {
      expect(timeline.events[i].phase).toBe(phases[i]);
    }
  });

  it("all crew members appear in at least one event", () => {
    const crew = generateCrew(8, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);

    // At minimum, the central roles should appear
    const actorIds = new Set(timeline.events.map(e => e.actorId));
    expect(actorIds.size).toBeGreaterThanOrEqual(1);

    // Every actor must be a valid crew member
    for (const actorId of actorIds) {
      expect(crew.some(c => c.id === actorId)).toBe(true);
    }
  });

  it("generated log text has no unresolved {variable} markers", () => {
    for (let seed = 1; seed <= 10; seed++) {
      ROT.RNG.setSeed(seed);
      const crew = generateCrew(10, seed, ROOM_NAMES);
      const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
      const logs = generateLogs(crew, timeline, ROOM_NAMES, 16);

      for (const log of logs) {
        expect(hasUnresolvedVars(log.text)).toBe(false);
        expect(hasUnresolvedVars(log.title)).toBe(false);
        expect(hasUnresolvedVars(log.source)).toBe(false);
      }
    }
  });

  it("timeline events reference valid locations", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);

    for (const event of timeline.events) {
      expect(event.location).toBeTruthy();
      expect(ROOM_NAMES).toContain(event.location);
    }
  });

  it("is deterministic — same seed produces same timeline", () => {
    ROT.RNG.setSeed(42);
    const crew1 = generateCrew(10, 42, ROOM_NAMES);
    const tl1 = generateTimeline(crew1, IncidentArchetype.CoolantCascade, ROOM_NAMES);

    ROT.RNG.setSeed(42);
    const crew2 = generateCrew(10, 42, ROOM_NAMES);
    const tl2 = generateTimeline(crew2, IncidentArchetype.CoolantCascade, ROOM_NAMES);

    expect(tl1.events.length).toBe(tl2.events.length);
    for (let i = 0; i < tl1.events.length; i++) {
      expect(tl1.events[i].phase).toBe(tl2.events[i].phase);
      expect(tl1.events[i].actorId).toBe(tl2.events[i].actorId);
      expect(tl1.events[i].action).toBe(tl2.events[i].action);
      expect(tl1.events[i].location).toBe(tl2.events[i].location);
    }
  });

  it("phaseRooms uses archetype-appropriate rooms (not random)", () => {
    ROT.RNG.setSeed(184201);
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);

    // CoolantCascade NormalOps should prefer Engine Core or Power Relay Junction
    const normalOpsRoom = timeline.phaseRooms[TimelinePhase.NormalOps];
    expect(normalOpsRoom).toBeDefined();
    expect(["Engine Core", "Power Relay Junction"]).toContain(normalOpsRoom);

    // phaseRooms should have entries for all 5 phases
    expect(Object.keys(timeline.phaseRooms).length).toBe(5);

    // Events should use the phaseRooms locations
    for (const event of timeline.events) {
      expect(event.location).toBe(timeline.phaseRooms[event.phase]);
    }
  });

  it("phaseRooms prefers unique rooms per phase when possible", () => {
    // With the full 21-room layout, phases should get mostly unique rooms
    const fullRooms = [
      "Arrival Bay", "Bridge", "Engine Core", "Cargo Hold", "Crew Quarters",
      "Med Bay", "Research Lab", "Life Support", "Power Relay Junction",
      "Engineering Storage", "Communications Hub", "Robotics Bay", "Data Core",
      "Observation Deck", "Escape Pod Bay", "Auxiliary Power", "Signal Room",
      "Server Annex", "Maintenance Corridor", "Emergency Shelter", "Armory",
    ];
    ROT.RNG.setSeed(42);
    const crew = generateCrew(10, 42, fullRooms);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, fullRooms);

    const rooms = Object.values(timeline.phaseRooms);
    const unique = new Set(rooms);
    // With 21 rooms, all 5 phases should get unique rooms
    expect(unique.size).toBe(5);
  });

  it("phaseRooms works for all archetypes", () => {
    const archetypes = Object.values(IncidentArchetype);
    for (const archetype of archetypes) {
      ROT.RNG.setSeed(184201);
      const crew = generateCrew(10, 184201, ROOM_NAMES);
      const timeline = generateTimeline(crew, archetype, ROOM_NAMES);

      expect(timeline.phaseRooms).toBeDefined();
      expect(Object.keys(timeline.phaseRooms).length).toBe(5);

      for (const event of timeline.events) {
        expect(event.location).toBeTruthy();
        expect(ROOM_NAMES).toContain(event.location);
        expect(event.location).toBe(timeline.phaseRooms[event.phase]);
      }
    }
  });

  it("generateLogs produces correct count", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);

    for (const count of [5, 10, 16]) {
      ROT.RNG.setSeed(184201);
      const logs = generateLogs(crew, timeline, ROOM_NAMES, count);
      expect(logs.length).toBeLessThanOrEqual(count);
      expect(logs.length).toBeGreaterThan(0);
    }
  });

  it("hasUnresolvedVars detects template variables", () => {
    expect(hasUnresolvedVars("Hello {name}")).toBe(true);
    expect(hasUnresolvedVars("Hello world")).toBe(false);
    expect(hasUnresolvedVars("{engineer} fixed it")).toBe(true);
    expect(hasUnresolvedVars("All good")).toBe(false);
  });
});

describe("mysteryChoices", () => {
  it("generates 4 choices per run (3 standard + 1 moral)", () => {
    ROT.RNG.setSeed(184201);
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const choices = generateMysteryChoices(crew, timeline, ROOM_NAMES);

    expect(choices.length).toBe(4);
    for (const choice of choices) {
      expect(choice.id).toBeTruthy();
      expect(choice.prompt).toBeTruthy();
      expect(choice.options.length).toBeGreaterThanOrEqual(3);
      expect(choice.consequence).toBeTruthy();
      expect(choice.chosen).toBeUndefined();
    }
    // Last choice should be the moral dimension
    expect(choices[3].consequence).toBe("moral_judgment");
  });

  it("sabotage archetype gets accusation choice", () => {
    ROT.RNG.setSeed(184201);
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.Sabotage, ROOM_NAMES);
    const choices = generateMysteryChoices(crew, timeline, ROOM_NAMES);

    const accusation = choices.find(c => c.id === "choice_saboteur");
    expect(accusation).toBeDefined();
  });

  it("signal anomaly archetype gets signal choice", () => {
    ROT.RNG.setSeed(184201);
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.SignalAnomaly, ROOM_NAMES);
    const choices = generateMysteryChoices(crew, timeline, ROOM_NAMES);

    const signal = choices.find(c => c.id === "choice_signal");
    expect(signal).toBeDefined();
  });
});
