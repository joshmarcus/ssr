import { describe, it, expect, beforeEach } from "vitest";
import * as ROT from "rot-js";
import { generateCrew } from "../src/sim/crewGen.js";
import { generateTimeline } from "../src/sim/timeline.js";
import { generateRoomScenes, processScene } from "../src/sim/roomScenes.js";
import {
  IncidentArchetype,
  TimelinePhase,
  SceneActivity,
  SceneOutcome,
  SensorType,
} from "../src/shared/types.js";
import type { Room } from "../src/shared/types.js";

const ROOM_NAMES = [
  "Arrival Bay", "Bridge", "Engine Core", "Cargo Hold", "Crew Quarters",
  "Med Bay", "Research Lab", "Life Support", "Power Relay Junction",
  "Engineering Storage", "Communications Hub", "Robotics Bay", "Data Core",
  "Observation Deck", "Escape Pod Bay", "Auxiliary Power", "Signal Room",
  "Server Annex", "Maintenance Corridor", "Emergency Shelter", "Armory",
];

/** Create mock Room objects from room names. */
function makeRooms(names: string[]): Room[] {
  return names.map((name, i) => ({
    id: `room_${i}`,
    name,
    x: (i % 5) * 12,
    y: Math.floor(i / 5) * 12,
    width: 8,
    height: 8,
  }));
}

describe("roomScenes", () => {
  const rooms = makeRooms(ROOM_NAMES);

  beforeEach(() => {
    ROT.RNG.setSeed(184201);
  });

  it("generates scenes for all rooms", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const scenes = generateRoomScenes(rooms, crew, timeline, rooms[0]);

    expect(scenes.length).toBe(rooms.length);
    for (const scene of scenes) {
      expect(scene.roomId).toBeTruthy();
      expect(scene.roomName).toBeTruthy();
    }
  });

  it("each room has 2-4 physical clues", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const scenes = generateRoomScenes(rooms, crew, timeline, rooms[0]);

    for (const scene of scenes) {
      expect(scene.physicalClues.length).toBeGreaterThanOrEqual(2);
      expect(scene.physicalClues.length).toBeLessThanOrEqual(4);
    }
  });

  it("clues have valid properties", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const scenes = generateRoomScenes(rooms, crew, timeline, rooms[0]);

    for (const scene of scenes) {
      for (const clue of scene.physicalClues) {
        expect(clue.id).toBeTruthy();
        expect(clue.type).toBeTruthy();
        expect(clue.text.length).toBeGreaterThan(10);
        expect(clue.examined).toBe(false);
        expect(clue.pos).toBeDefined();
        expect(typeof clue.pos.x).toBe("number");
        expect(typeof clue.pos.y).toBe("number");
        expect(["confirming", "ambiguous", "contradicting"]).toContain(clue.evidenceCategory);
      }
    }
  });

  it("timeline-critical rooms have crew present", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const scenes = generateRoomScenes(rooms, crew, timeline, rooms[0]);

    // Check that rooms referenced by timeline phases have crew assigned
    for (const [_phase, roomName] of Object.entries(timeline.phaseRooms)) {
      const scene = scenes.find(s => s.roomName === roomName);
      if (scene) {
        expect(scene.crewPresent.length).toBeGreaterThan(0);
      }
    }
  });

  it("ground truth is always set", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const scenes = generateRoomScenes(rooms, crew, timeline, rooms[0]);

    for (const scene of scenes) {
      expect(scene.groundTruth).toBeDefined();
      expect(scene.groundTruth.what).toBeTruthy();
      expect(scene.groundTruth.outcome).toBeTruthy();
      expect(Array.isArray(scene.groundTruth.who)).toBe(true);
    }
  });

  it("all scenes start unprocessed", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const scenes = generateRoomScenes(rooms, crew, timeline, rooms[0]);

    for (const scene of scenes) {
      expect(scene.processed).toBe(false);
      expect(scene.processAttempts).toBe(0);
    }
  });

  it("works for all archetypes", () => {
    const archetypes = Object.values(IncidentArchetype);
    for (const archetype of archetypes) {
      ROT.RNG.setSeed(184201);
      const crew = generateCrew(10, 184201, ROOM_NAMES);
      const timeline = generateTimeline(crew, archetype, ROOM_NAMES);
      const scenes = generateRoomScenes(rooms, crew, timeline, rooms[0]);

      expect(scenes.length).toBe(rooms.length);
      for (const scene of scenes) {
        expect(scene.physicalClues.length).toBeGreaterThanOrEqual(2);
        expect(scene.physicalClues.length).toBeLessThanOrEqual(4);
      }
    }
  });

  it("evidence categories vary by distance from start", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const scenes = generateRoomScenes(rooms, crew, timeline, rooms[0]);

    const categories = new Set(scenes.map(s => s.evidenceCategory));
    // With 21 rooms, should have at least 2 different categories
    expect(categories.size).toBeGreaterThanOrEqual(2);
  });

  it("is deterministic — same seed same result", () => {
    ROT.RNG.setSeed(42);
    const crew1 = generateCrew(10, 42, ROOM_NAMES);
    const tl1 = generateTimeline(crew1, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const scenes1 = generateRoomScenes(rooms, crew1, tl1, rooms[0]);

    ROT.RNG.setSeed(42);
    const crew2 = generateCrew(10, 42, ROOM_NAMES);
    const tl2 = generateTimeline(crew2, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const scenes2 = generateRoomScenes(rooms, crew2, tl2, rooms[0]);

    expect(scenes1.length).toBe(scenes2.length);
    for (let i = 0; i < scenes1.length; i++) {
      expect(scenes1[i].roomName).toBe(scenes2[i].roomName);
      expect(scenes1[i].physicalClues.length).toBe(scenes2[i].physicalClues.length);
      expect(scenes1[i].groundTruth.what).toBe(scenes2[i].groundTruth.what);
      expect(scenes1[i].groundTruth.outcome).toBe(scenes2[i].groundTruth.outcome);
      expect(scenes1[i].evidenceCategory).toBe(scenes2[i].evidenceCategory);
    }
  });

  it("sensor-gated clues are placed in story-critical rooms", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const scenes = generateRoomScenes(rooms, crew, timeline, rooms[0]);

    // Find rooms that are timeline phase rooms
    const phaseRoomNames = new Set(Object.values(timeline.phaseRooms));
    const criticalScenes = scenes.filter(s => phaseRoomNames.has(s.roomName));

    // At least one critical scene should have a sensor-gated clue
    const hasSensorClue = criticalScenes.some(s =>
      s.physicalClues.some(c => c.sensorRequired !== null)
    );
    expect(hasSensorClue).toBe(true);
  });
});

describe("processScene", () => {
  beforeEach(() => {
    ROT.RNG.setSeed(184201);
  });

  it("scores all correct answers as 3/3", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const rooms = makeRooms(ROOM_NAMES);
    const scenes = generateRoomScenes(rooms, crew, timeline, rooms[0]);

    // Find a scene with crew present
    const scene = scenes.find(s => s.crewPresent.length > 0)!;
    expect(scene).toBeDefined();

    const result = processScene(
      scene,
      scene.groundTruth.who,
      scene.groundTruth.what,
      scene.groundTruth.outcome,
    );

    expect(result.whoCorrect).toBe(true);
    expect(result.whatCorrect).toBe(true);
    expect(result.outcomeCorrect).toBe(true);
    expect(result.score).toBe(3);
  });

  it("scores all wrong answers as 0/3", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const rooms = makeRooms(ROOM_NAMES);
    const scenes = generateRoomScenes(rooms, crew, timeline, rooms[0]);

    const scene = scenes.find(s => s.crewPresent.length > 0)!;

    const result = processScene(
      scene,
      ["nonexistent_crew"],
      SceneActivity.Barricading, // wrong
      SceneOutcome.SealedInside, // wrong
    );

    expect(result.whoCorrect).toBe(false);
    expect(result.score).toBeLessThan(3);
  });

  it("turn cost increases with attempts", () => {
    const rooms = makeRooms(ROOM_NAMES);
    const scene = generateRoomScenes(
      rooms,
      generateCrew(10, 184201, ROOM_NAMES),
      generateTimeline(generateCrew(10, 184201, ROOM_NAMES), IncidentArchetype.CoolantCascade, ROOM_NAMES),
      rooms[0],
    )[0];

    // First attempt: 3 turns
    scene.processAttempts = 0;
    const r1 = processScene(scene, [], SceneActivity.RoutineWork, SceneOutcome.Unknown);
    expect(r1.turnCost).toBe(3);

    // Second attempt: 5 turns
    scene.processAttempts = 1;
    const r2 = processScene(scene, [], SceneActivity.RoutineWork, SceneOutcome.Unknown);
    expect(r2.turnCost).toBe(5);

    // Third attempt: 8 turns
    scene.processAttempts = 2;
    const r3 = processScene(scene, [], SceneActivity.RoutineWork, SceneOutcome.Unknown);
    expect(r3.turnCost).toBe(8);
  });

  it("partial correct answers get partial score", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const rooms = makeRooms(ROOM_NAMES);
    const scenes = generateRoomScenes(rooms, crew, timeline, rooms[0]);

    const scene = scenes.find(s => s.crewPresent.length > 0)!;

    // Correct WHO, wrong WHAT, correct OUTCOME
    const result = processScene(
      scene,
      scene.groundTruth.who,
      SceneActivity.Barricading, // wrong
      scene.groundTruth.outcome,
    );

    expect(result.whoCorrect).toBe(true);
    expect(result.whatCorrect).toBe(false);
    expect(result.outcomeCorrect).toBe(true);
    expect(result.score).toBe(2);
  });
});
