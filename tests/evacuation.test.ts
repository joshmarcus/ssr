import { describe, it, expect } from "vitest";
import { step } from "../src/sim/step.js";
import { createEmptyState } from "../src/sim/state.js";
import { ActionType, EntityType, TileType, ObjectivePhase, SensorType, IncidentArchetype } from "../src/shared/types.js";
import type { Entity, GameState, MysteryState, EvacuationState, IncidentTimeline } from "../src/shared/types.js";

/**
 * Helper: create a state with a small 10x10 walkable floor grid.
 */
function makeTestState(width = 10, height = 10) {
  const state = createEmptyState(1, width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      state.tiles[y][x] = {
        type: TileType.Floor,
        glyph: ".",
        walkable: true,
        heat: 0,
        smoke: 0,
        dirt: 0,
        pressure: 100,
        explored: true,
        visible: true,
      };
    }
  }
  state.player.entity.pos = { x: 5, y: 5 };
  state.rooms.push({
    id: "room_0",
    name: "Test Room",
    x: 0,
    y: 0,
    width,
    height,
  });
  return state;
}

/** Helper: add a basic mystery state in Recover phase for evacuation tests. */
function addMysteryState(state: GameState, phase: ObjectivePhase = ObjectivePhase.Recover): GameState {
  const timeline: IncidentTimeline = {
    archetype: IncidentArchetype.Sabotage,
    events: [],
    primaryHazard: "fire",
    sensorBias: SensorType.Thermal,
  };
  const mystery: MysteryState = {
    crew: [],
    timeline,
    generatedLogs: [],
    discoveredEvidence: new Set<string>(),
    journal: [],
    deductions: [],
    choices: [],
    threads: [],
    objectivePhase: phase,
    roomsCleanedCount: 5,
    investigationTrigger: 3,
    evidenceThreshold: 5,
    cleaningDirective: false,
    roomCleanlinessGoal: 80,
    triggeredEchoes: new Set<string>(),
    sceneEchoes: [],
    connections: [],
    insights: [],
  };
  return { ...state, mystery };
}

/** Helper: create a CrewNPC entity. */
function makeCrewNPC(id: string, x: number, y: number, opts: Record<string, unknown> = {}): Entity {
  return {
    id,
    type: EntityType.CrewNPC,
    pos: { x, y },
    props: {
      firstName: "Test",
      lastName: "Crew",
      crewId: id,
      hp: 50,
      found: false,
      following: false,
      evacuated: false,
      dead: false,
      sealed: false,
      unconscious: false,
      personality: "cautious",
      ...opts,
    },
  };
}

/** Helper: create an EscapePod entity. */
function makeEscapePod(id: string, x: number, y: number, powered = false, capacity = 3): Entity {
  return {
    id,
    type: EntityType.EscapePod,
    pos: { x, y },
    props: { powered, capacity, boarded: 0 },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CrewNPC Discovery & Following
// ─────────────────────────────────────────────────────────────────────────────

describe("CrewNPC Discovery", () => {
  it("should discover crew on first interaction and add journal entry", () => {
    let state = makeTestState();
    state = addMysteryState(state);
    const crew = makeCrewNPC("crew_1", 5, 4); // adjacent to player at (5,5)
    state.entities.set(crew.id, crew);

    const next = step(state, { type: ActionType.Interact, targetId: "crew_1" });

    const updatedCrew = next.entities.get("crew_1")!;
    expect(updatedCrew.props["found"]).toBe(true);
    // Should have created a journal entry
    expect(next.mystery!.journal.length).toBeGreaterThan(0);
    expect(next.mystery!.journal.some(j => j.summary.includes("Crew found"))).toBe(true);
  });

  it("should activate evacuation phase when crew is found in Recover phase", () => {
    let state = makeTestState();
    state = addMysteryState(state, ObjectivePhase.Recover);
    const crew = makeCrewNPC("crew_1", 5, 4);
    state.entities.set(crew.id, crew);

    const next = step(state, { type: ActionType.Interact, targetId: "crew_1" });

    expect(next.mystery!.objectivePhase).toBe(ObjectivePhase.Evacuate);
    expect(next.mystery!.evacuation).toBeDefined();
    expect(next.mystery!.evacuation!.active).toBe(true);
    expect(next.mystery!.evacuation!.crewFound).toContain("crew_1");
  });

  it("should start crew following on second interaction after discovery", () => {
    let state = makeTestState();
    state = addMysteryState(state, ObjectivePhase.Evacuate);
    const crew = makeCrewNPC("crew_1", 5, 4, { found: true });
    state.entities.set(crew.id, crew);
    // Add evacuation state
    state = {
      ...state,
      mystery: {
        ...state.mystery!,
        evacuation: {
          active: true,
          crewFound: ["crew_1"],
          crewEvacuated: [],
          crewDead: [],
          podsPowered: [],
          evacuationStartTurn: 1,
        },
      },
    };

    const next = step(state, { type: ActionType.Interact, targetId: "crew_1" });

    const updatedCrew = next.entities.get("crew_1")!;
    expect(updatedCrew.props["following"]).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Crew Following Movement
// ─────────────────────────────────────────────────────────────────────────────

describe("Crew Following Movement", () => {
  it("following crew should move toward player when player moves", () => {
    let state = makeTestState();
    state = addMysteryState(state, ObjectivePhase.Evacuate);
    // Place following crew at (5, 2) — 3 tiles from player at (5, 5)
    const crew = makeCrewNPC("crew_1", 5, 2, { found: true, following: true });
    state.entities.set(crew.id, crew);
    state = {
      ...state,
      mystery: {
        ...state.mystery!,
        evacuation: {
          active: true,
          crewFound: ["crew_1"],
          crewEvacuated: [],
          crewDead: [],
          podsPowered: [],
          evacuationStartTurn: 1,
        },
      },
    };

    // Player moves east
    const next = step(state, { type: ActionType.Move, dx: 1, dy: 0 });
    const crewAfter = next.entities.get("crew_1")!;

    // Crew should have moved closer to player (y should have increased toward player's y)
    expect(crewAfter.pos.y).toBeGreaterThan(2);
  });

  it("following crew should not move onto player tile", () => {
    let state = makeTestState();
    state = addMysteryState(state, ObjectivePhase.Evacuate);
    // Place following crew at (5, 4) — 1 tile from player at (5, 5)
    const crew = makeCrewNPC("crew_1", 5, 4, { found: true, following: true });
    state.entities.set(crew.id, crew);
    state = {
      ...state,
      mystery: {
        ...state.mystery!,
        evacuation: {
          active: true,
          crewFound: ["crew_1"],
          crewEvacuated: [],
          crewDead: [],
          podsPowered: [],
          evacuationStartTurn: 1,
        },
      },
    };

    // Player waits in place
    const next = step(state, { type: ActionType.Wait });
    const crewAfter = next.entities.get("crew_1")!;

    // Crew should stay put (already adjacent)
    expect(crewAfter.pos.x).toBe(5);
    expect(crewAfter.pos.y).toBe(4);
  });

  it("crew should take hazard damage from heat", () => {
    let state = makeTestState();
    state = addMysteryState(state, ObjectivePhase.Evacuate);
    const crew = makeCrewNPC("crew_1", 5, 4, { found: true, following: true, hp: 10 });
    state.entities.set(crew.id, crew);
    // Set tile heat to dangerous level
    state.tiles[4][5].heat = 50;
    state = {
      ...state,
      mystery: {
        ...state.mystery!,
        evacuation: {
          active: true,
          crewFound: ["crew_1"],
          crewEvacuated: [],
          crewDead: [],
          podsPowered: [],
          evacuationStartTurn: 1,
        },
      },
    };

    const next = step(state, { type: ActionType.Wait });
    const crewAfter = next.entities.get("crew_1")!;

    // Crew should have taken damage
    expect((crewAfter.props["hp"] as number)).toBeLessThan(10);
  });

  it("crew should die if HP reaches 0 from hazards", () => {
    let state = makeTestState();
    state = addMysteryState(state, ObjectivePhase.Evacuate);
    const crew = makeCrewNPC("crew_1", 5, 4, { found: true, following: true, hp: 1 });
    state.entities.set(crew.id, crew);
    // Set extreme heat to kill crew in one tick
    state.tiles[4][5].heat = 50;
    state = {
      ...state,
      mystery: {
        ...state.mystery!,
        evacuation: {
          active: true,
          crewFound: ["crew_1"],
          crewEvacuated: [],
          crewDead: [],
          podsPowered: [],
          evacuationStartTurn: 1,
        },
      },
    };

    const next = step(state, { type: ActionType.Wait });
    const crewAfter = next.entities.get("crew_1")!;

    expect(crewAfter.props["dead"]).toBe(true);
    expect(crewAfter.props["following"]).toBe(false);
    expect(next.mystery!.evacuation!.crewDead).toContain("crew_1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Escape Pod Boarding
// ─────────────────────────────────────────────────────────────────────────────

describe("Escape Pod Boarding", () => {
  it("should report pod unpowered when no power source nearby", () => {
    let state = makeTestState();
    state = addMysteryState(state, ObjectivePhase.Evacuate);
    const pod = makeEscapePod("escape_pod_1", 5, 4);
    state.entities.set(pod.id, pod);

    const next = step(state, { type: ActionType.Interact, targetId: "escape_pod_1" });
    const podLog = next.logs.find(l => l.text.includes("unpowered"));
    expect(podLog).toBeDefined();
  });

  it("should power pod from nearby activated relay", () => {
    let state = makeTestState();
    state = addMysteryState(state, ObjectivePhase.Evacuate);
    const pod = makeEscapePod("escape_pod_1", 5, 4);
    state.entities.set(pod.id, pod);
    // Place an activated relay within 3 tiles
    const relay: Entity = {
      id: "relay_1",
      type: EntityType.Relay,
      pos: { x: 5, y: 3 },
      props: { activated: true, locked: false },
    };
    state.entities.set(relay.id, relay);
    state = {
      ...state,
      mystery: {
        ...state.mystery!,
        evacuation: {
          active: true,
          crewFound: [],
          crewEvacuated: [],
          crewDead: [],
          podsPowered: [],
          evacuationStartTurn: 1,
        },
      },
    };

    const next = step(state, { type: ActionType.Interact, targetId: "escape_pod_1" });
    const updatedPod = next.entities.get("escape_pod_1")!;
    expect(updatedPod.props["powered"]).toBe(true);
    expect(next.mystery!.evacuation!.podsPowered).toContain("escape_pod_1");
  });

  it("should board following crew when pod is powered", () => {
    let state = makeTestState();
    state = addMysteryState(state, ObjectivePhase.Evacuate);
    const pod = makeEscapePod("escape_pod_1", 5, 4, true); // powered
    state.entities.set(pod.id, pod);
    // Place following crew near the pod (within 2 tiles)
    const crew = makeCrewNPC("crew_1", 5, 3, { found: true, following: true });
    state.entities.set(crew.id, crew);
    state = {
      ...state,
      mystery: {
        ...state.mystery!,
        evacuation: {
          active: true,
          crewFound: ["crew_1"],
          crewEvacuated: [],
          crewDead: [],
          podsPowered: ["escape_pod_1"],
          evacuationStartTurn: 1,
        },
      },
    };

    const next = step(state, { type: ActionType.Interact, targetId: "escape_pod_1" });

    const updatedCrew = next.entities.get("crew_1")!;
    expect(updatedCrew.props["evacuated"]).toBe(true);
    expect(updatedCrew.props["following"]).toBe(false);
    expect(next.mystery!.evacuation!.crewEvacuated).toContain("crew_1");

    const updatedPod = next.entities.get("escape_pod_1")!;
    expect(updatedPod.props["boarded"]).toBe(1);
  });

  it("should board following crew regardless of distance from pod", () => {
    let state = makeTestState();
    state = addMysteryState(state, ObjectivePhase.Evacuate);
    const pod = makeEscapePod("escape_pod_1", 5, 4, true);
    state.entities.set(pod.id, pod);
    // Place following crew far from the pod — they still board
    const crew = makeCrewNPC("crew_1", 0, 0, { found: true, following: true });
    state.entities.set(crew.id, crew);
    state = {
      ...state,
      mystery: {
        ...state.mystery!,
        evacuation: {
          active: true,
          crewFound: ["crew_1"],
          crewEvacuated: [],
          crewDead: [],
          podsPowered: ["escape_pod_1"],
          evacuationStartTurn: 1,
        },
      },
    };

    const next = step(state, { type: ActionType.Interact, targetId: "escape_pod_1" });

    const updatedCrew = next.entities.get("crew_1")!;
    expect(updatedCrew.props["evacuated"]).toBeTruthy();
    const boarded = next.logs.find(l => l.text.includes("boards"));
    expect(boarded).toBeDefined();
  });

  it("should respect pod capacity", () => {
    let state = makeTestState();
    state = addMysteryState(state, ObjectivePhase.Evacuate);
    // Pod with capacity 1 already has 1 boarded
    const pod: Entity = {
      id: "escape_pod_1",
      type: EntityType.EscapePod,
      pos: { x: 5, y: 4 },
      props: { powered: true, capacity: 1, boarded: 1 },
    };
    state.entities.set(pod.id, pod);

    const next = step(state, { type: ActionType.Interact, targetId: "escape_pod_1" });
    const fullLog = next.logs.find(l => l.text.includes("capacity"));
    expect(fullLog).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Evacuation State Tracking
// ─────────────────────────────────────────────────────────────────────────────

describe("Evacuation State Tracking", () => {
  it("should track multiple crew found", () => {
    let state = makeTestState();
    state = addMysteryState(state, ObjectivePhase.Recover);

    // First crew discovery — triggers evacuation
    const crew1 = makeCrewNPC("crew_1", 5, 4);
    state.entities.set(crew1.id, crew1);
    let next = step(state, { type: ActionType.Interact, targetId: "crew_1" });
    expect(next.mystery!.evacuation!.crewFound).toContain("crew_1");

    // Second crew discovery
    const crew2 = makeCrewNPC("crew_2", 6, 5, { firstName: "Another", lastName: "Crew" });
    next.entities.set(crew2.id, crew2);
    // Move player next to crew_2
    next.player = { ...next.player, entity: { ...next.player.entity, pos: { x: 6, y: 6 } } };
    next.entities.set("player", { ...next.player.entity, pos: { x: 6, y: 6 } });

    const next2 = step(next, { type: ActionType.Interact, targetId: "crew_2" });
    expect(next2.mystery!.evacuation!.crewFound).toContain("crew_1");
    expect(next2.mystery!.evacuation!.crewFound).toContain("crew_2");
  });
});
