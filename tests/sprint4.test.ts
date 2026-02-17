import { describe, it, expect } from "vitest";
import { step } from "../src/sim/step.js";
import { createEmptyState } from "../src/sim/state.js";
import { tickHazards, tickRadiation, tickStructuralStress, applyHazardDamage } from "../src/sim/hazards.js";
import {
  ActionType, EntityType, TileType, AttachmentSlot, SensorType,
  DoorKeyType, ObjectivePhase,
} from "../src/shared/types.js";
import {
  GLYPHS,
  RADIATION_SPREAD_RATE, SHIELD_GENERATOR_RADIUS,
  STRESS_COLLAPSE_THRESHOLD, STRESS_COLLAPSE_TURNS,
  STATION_INTEGRITY_DECAY_RATE, STATION_INTEGRITY_BREACH_PENALTY,
  STATION_INTEGRITY_RELAY_BONUS,
} from "../src/shared/constants.js";
import type { Entity } from "../src/shared/types.js";

/**
 * Helper: create a small all-floor test state with one room.
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
        radiation: 0,
        stress: 0,
        stressTurns: 0,
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

// ========================================================================
// 2.1 Door Keying Tests
// ========================================================================

describe("Door keying system", () => {
  describe("Clearance doors", () => {
    it("blocks player without clearance", () => {
      const state = makeTestState();
      // Place a clearance door adjacent to the player
      state.tiles[5][6] = {
        type: TileType.Door,
        glyph: GLYPHS.closedDoor,
        walkable: false,
        heat: 0,
        smoke: 0,
        dirt: 0,
        pressure: 100,
        radiation: 0,
        stress: 0,
        stressTurns: 0,
        explored: true,
        visible: true,
      };
      state.entities.set("clearance_door_0", {
        id: "clearance_door_0",
        type: EntityType.ClosedDoor,
        pos: { x: 6, y: 5 },
        props: {
          closed: true,
          keyType: DoorKeyType.Clearance,
          clearanceLevel: 1,
          locked: true,
        },
      });

      // Player has clearanceLevel 0 (default)
      expect(state.player.clearanceLevel).toBe(0);

      const next = step(state, { type: ActionType.Interact, targetId: "clearance_door_0" });

      // Door should remain closed
      const door = next.entities.get("clearance_door_0")!;
      expect(door.props["closed"]).toBe(true);
      expect(next.tiles[5][6].walkable).toBe(false);
      // Should have an ACCESS DENIED log
      expect(next.logs.some(l => l.text.includes("ACCESS DENIED"))).toBe(true);
    });

    it("opens when player has sufficient clearance level", () => {
      const state = makeTestState();
      // Place a clearance door adjacent to the player
      state.tiles[5][6] = {
        type: TileType.Door,
        glyph: GLYPHS.closedDoor,
        walkable: false,
        heat: 0,
        smoke: 0,
        dirt: 0,
        pressure: 100,
        radiation: 0,
        stress: 0,
        stressTurns: 0,
        explored: true,
        visible: true,
      };
      state.entities.set("clearance_door_0", {
        id: "clearance_door_0",
        type: EntityType.ClosedDoor,
        pos: { x: 6, y: 5 },
        props: {
          closed: true,
          keyType: DoorKeyType.Clearance,
          clearanceLevel: 1,
          locked: true,
        },
      });

      // Give the player clearance level 1
      state.player = { ...state.player, clearanceLevel: 1 };

      const next = step(state, { type: ActionType.Interact, targetId: "clearance_door_0" });

      // Door should be open
      const door = next.entities.get("clearance_door_0")!;
      expect(door.props["closed"]).toBe(false);
      expect(next.tiles[5][6].walkable).toBe(true);
      // Should have a clearance granted log
      expect(next.logs.some(l => l.text.includes("Access granted"))).toBe(true);
    });

    it("clearance level 2 opens level 1 doors", () => {
      const state = makeTestState();
      state.tiles[5][6] = {
        type: TileType.Door,
        glyph: GLYPHS.closedDoor,
        walkable: false,
        heat: 0,
        smoke: 0,
        dirt: 0,
        pressure: 100,
        radiation: 0,
        stress: 0,
        stressTurns: 0,
        explored: true,
        visible: true,
      };
      state.entities.set("clearance_door_0", {
        id: "clearance_door_0",
        type: EntityType.ClosedDoor,
        pos: { x: 6, y: 5 },
        props: {
          closed: true,
          keyType: DoorKeyType.Clearance,
          clearanceLevel: 1,
          locked: true,
        },
      });

      // Give the player clearance level 2 (exceeds requirement)
      state.player = { ...state.player, clearanceLevel: 2 };

      const next = step(state, { type: ActionType.Interact, targetId: "clearance_door_0" });

      const door = next.entities.get("clearance_door_0")!;
      expect(door.props["closed"]).toBe(false);
      expect(next.tiles[5][6].walkable).toBe(true);
    });
  });

  describe("Environmental doors", () => {
    it("blocks when heat hazard is active", () => {
      const state = makeTestState();
      // Place an environmental door with high heat
      state.tiles[5][6] = {
        type: TileType.Door,
        glyph: GLYPHS.closedDoor,
        walkable: false,
        heat: 65,
        smoke: 0,
        dirt: 0,
        pressure: 100,
        radiation: 0,
        stress: 0,
        stressTurns: 0,
        explored: true,
        visible: true,
      };
      state.entities.set("env_door_0", {
        id: "env_door_0",
        type: EntityType.ClosedDoor,
        pos: { x: 6, y: 5 },
        props: {
          closed: true,
          keyType: DoorKeyType.Environmental,
          hazardType: "heat",
          locked: true,
        },
      });

      const next = step(state, { type: ActionType.Interact, targetId: "env_door_0" });

      // Door should remain closed
      const door = next.entities.get("env_door_0")!;
      expect(door.props["closed"]).toBe(true);
      expect(next.tiles[5][6].walkable).toBe(false);
      // Should have a hazard warning log
      expect(next.logs.some(l => l.text.includes("heat hazard"))).toBe(true);
    });

    it("opens when heat hazard is cleared", () => {
      const state = makeTestState();
      // Place an environmental door with LOW heat (hazard cleared)
      state.tiles[5][6] = {
        type: TileType.Door,
        glyph: GLYPHS.closedDoor,
        walkable: false,
        heat: 10,
        smoke: 0,
        dirt: 0,
        pressure: 100,
        radiation: 0,
        stress: 0,
        stressTurns: 0,
        explored: true,
        visible: true,
      };
      state.entities.set("env_door_0", {
        id: "env_door_0",
        type: EntityType.ClosedDoor,
        pos: { x: 6, y: 5 },
        props: {
          closed: true,
          keyType: DoorKeyType.Environmental,
          hazardType: "heat",
          locked: true,
        },
      });

      const next = step(state, { type: ActionType.Interact, targetId: "env_door_0" });

      // Door should be open — hazard cleared (all adjacent tiles heat < 30)
      const door = next.entities.get("env_door_0")!;
      expect(door.props["closed"]).toBe(false);
      expect(next.tiles[5][6].walkable).toBe(true);
      expect(next.logs.some(l => l.text.includes("Environmental seal released"))).toBe(true);
    });

    it("blocks when pressure hazard is active", () => {
      const state = makeTestState();
      // Place an environmental door with low pressure
      state.tiles[5][6] = {
        type: TileType.Door,
        glyph: GLYPHS.closedDoor,
        walkable: false,
        heat: 0,
        smoke: 0,
        dirt: 0,
        pressure: 35,
        radiation: 0,
        stress: 0,
        stressTurns: 0,
        explored: true,
        visible: true,
      };
      state.entities.set("env_door_0", {
        id: "env_door_0",
        type: EntityType.ClosedDoor,
        pos: { x: 6, y: 5 },
        props: {
          closed: true,
          keyType: DoorKeyType.Environmental,
          hazardType: "pressure",
          locked: true,
        },
      });

      const next = step(state, { type: ActionType.Interact, targetId: "env_door_0" });

      const door = next.entities.get("env_door_0")!;
      expect(door.props["closed"]).toBe(true);
      expect(next.logs.some(l => l.text.includes("pressure hazard"))).toBe(true);
    });

    it("opens when pressure hazard is cleared", () => {
      const state = makeTestState();
      // Place an environmental door with GOOD pressure (hazard cleared)
      state.tiles[5][6] = {
        type: TileType.Door,
        glyph: GLYPHS.closedDoor,
        walkable: false,
        heat: 0,
        smoke: 0,
        dirt: 0,
        pressure: 80,
        radiation: 0,
        stress: 0,
        stressTurns: 0,
        explored: true,
        visible: true,
      };
      state.entities.set("env_door_0", {
        id: "env_door_0",
        type: EntityType.ClosedDoor,
        pos: { x: 6, y: 5 },
        props: {
          closed: true,
          keyType: DoorKeyType.Environmental,
          hazardType: "pressure",
          locked: true,
        },
      });

      const next = step(state, { type: ActionType.Interact, targetId: "env_door_0" });

      const door = next.entities.get("env_door_0")!;
      expect(door.props["closed"]).toBe(false);
      expect(next.tiles[5][6].walkable).toBe(true);
    });
  });

  describe("Physical doors (existing behavior)", () => {
    it("opens with interact action (no keyType prop)", () => {
      const state = makeTestState();
      state.tiles[5][6] = {
        type: TileType.Door,
        glyph: GLYPHS.closedDoor,
        walkable: false,
        heat: 0,
        smoke: 0,
        dirt: 0,
        pressure: 100,
        radiation: 0,
        stress: 0,
        stressTurns: 0,
        explored: true,
        visible: true,
      };
      state.entities.set("closed_door_0", {
        id: "closed_door_0",
        type: EntityType.ClosedDoor,
        pos: { x: 6, y: 5 },
        props: { closed: true },
      });

      const next = step(state, { type: ActionType.Interact, targetId: "closed_door_0" });

      const door = next.entities.get("closed_door_0")!;
      expect(door.props["closed"]).toBe(false);
      expect(next.tiles[5][6].walkable).toBe(true);
    });

    it("opens with explicit Physical keyType", () => {
      const state = makeTestState();
      state.tiles[5][6] = {
        type: TileType.Door,
        glyph: GLYPHS.closedDoor,
        walkable: false,
        heat: 0,
        smoke: 0,
        dirt: 0,
        pressure: 100,
        radiation: 0,
        stress: 0,
        stressTurns: 0,
        explored: true,
        visible: true,
      };
      state.entities.set("closed_door_0", {
        id: "closed_door_0",
        type: EntityType.ClosedDoor,
        pos: { x: 6, y: 5 },
        props: { closed: true, keyType: DoorKeyType.Physical },
      });

      const next = step(state, { type: ActionType.Interact, targetId: "closed_door_0" });

      const door = next.entities.get("closed_door_0")!;
      expect(door.props["closed"]).toBe(false);
      expect(next.tiles[5][6].walkable).toBe(true);
    });
  });
});

// ========================================================================
// 2.2 Radiation / Structural Tests (verify Sprint 3 work)
// ========================================================================

describe("Radiation system", () => {
  it("radiation spreads through walls (unlike heat)", () => {
    const state = makeTestState(7, 7);
    // Place a wall between radiation source and target
    state.tiles[3][3].radiation = 50;
    state.tiles[3][2] = {
      type: TileType.Wall,
      glyph: "#",
      walkable: false,
      heat: 0,
      smoke: 0,
      dirt: 0,
      pressure: 100,
      radiation: 0,
      stress: 0,
      stressTurns: 0,
      explored: true,
      visible: true,
    };

    // Place a radiation source entity at (3,3)
    state.entities.set("radiation_source_0", {
      id: "radiation_source_0",
      type: EntityType.RadiationSource,
      pos: { x: 3, y: 3 },
      props: {},
    });

    const next = tickRadiation(state);

    // Radiation should have spread through the wall
    // Wall at (2,3) should have radiation > 0
    expect(next.tiles[3][2].radiation).toBeGreaterThan(0);
    // Verify heat would NOT spread through walls (for contrast)
    // (Heat spread is tested in hazards.test.ts — just confirm radiation penetrates)
  });

  it("shield generator zeroes radiation in radius", () => {
    const state = makeTestState(15, 15);
    // Seed radiation across the area
    for (let y = 3; y <= 10; y++) {
      for (let x = 3; x <= 10; x++) {
        state.tiles[y][x].radiation = 40;
      }
    }

    // Place an activated shield generator at center
    state.entities.set("shield_generator_0", {
      id: "shield_generator_0",
      type: EntityType.ShieldGenerator,
      pos: { x: 7, y: 7 },
      props: { activated: true },
    });

    const next = tickRadiation(state);

    // All tiles within SHIELD_GENERATOR_RADIUS manhattan distance should have 0 radiation
    for (let dy = -SHIELD_GENERATOR_RADIUS; dy <= SHIELD_GENERATOR_RADIUS; dy++) {
      for (let dx = -SHIELD_GENERATOR_RADIUS; dx <= SHIELD_GENERATOR_RADIUS; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > SHIELD_GENERATOR_RADIUS) continue;
        const nx = 7 + dx;
        const ny = 7 + dy;
        if (nx >= 0 && nx < 15 && ny >= 0 && ny < 15) {
          expect(
            next.tiles[ny][nx].radiation,
            `Tile (${nx},${ny}) should have 0 radiation within shield radius`
          ).toBe(0);
        }
      }
    }
  });

  it("inactive shield generator does not suppress radiation", () => {
    const state = makeTestState(10, 10);
    state.tiles[5][5].radiation = 40;

    // Place an INACTIVE shield generator
    state.entities.set("shield_generator_0", {
      id: "shield_generator_0",
      type: EntityType.ShieldGenerator,
      pos: { x: 5, y: 5 },
      props: { activated: false },
    });

    const next = tickRadiation(state);

    // Radiation should still be present (generator not activated)
    expect(next.tiles[5][5].radiation).toBeGreaterThan(0);
  });
});

describe("Structural stress system", () => {
  it("collapses tile after 3 turns above threshold", () => {
    const state = makeTestState(5, 5);
    // Set a tile above collapse threshold
    state.tiles[2][2].stress = STRESS_COLLAPSE_THRESHOLD + 10;
    state.tiles[2][2].stressTurns = 0;

    // Tick 3 times
    let current = state;
    for (let i = 0; i < STRESS_COLLAPSE_TURNS; i++) {
      current = tickStructuralStress(current);
    }

    // Tile should have collapsed to wall
    expect(current.tiles[2][2].type).toBe(TileType.Wall);
    expect(current.tiles[2][2].walkable).toBe(false);
  });

  it("does not collapse before 3 turns above threshold", () => {
    const state = makeTestState(5, 5);
    state.tiles[2][2].stress = STRESS_COLLAPSE_THRESHOLD + 10;
    state.tiles[2][2].stressTurns = 0;

    // Tick only 2 times
    let current = state;
    for (let i = 0; i < STRESS_COLLAPSE_TURNS - 1; i++) {
      current = tickStructuralStress(current);
    }

    // Tile should still be floor
    expect(current.tiles[2][2].type).toBe(TileType.Floor);
    expect(current.tiles[2][2].walkable).toBe(true);
    expect(current.tiles[2][2].stressTurns).toBe(STRESS_COLLAPSE_TURNS - 1);
  });

  it("reinforcement panel prevents collapse", () => {
    const state = makeTestState(5, 5);
    state.tiles[2][2].stress = STRESS_COLLAPSE_THRESHOLD + 10;
    state.tiles[2][2].stressTurns = 0;

    // Place an installed reinforcement panel at (2,2)
    state.entities.set("reinforcement_panel_0", {
      id: "reinforcement_panel_0",
      type: EntityType.ReinforcementPanel,
      pos: { x: 2, y: 2 },
      props: { installed: true },
    });

    // Tick many times
    let current = state;
    for (let i = 0; i < STRESS_COLLAPSE_TURNS + 5; i++) {
      current = tickStructuralStress(current);
    }

    // Tile should NOT have collapsed — reinforcement prevents it
    expect(current.tiles[2][2].type).toBe(TileType.Floor);
    expect(current.tiles[2][2].walkable).toBe(true);
    // stressTurns should be reset each tick because of reinforcement
    expect(current.tiles[2][2].stressTurns).toBe(0);
  });

  it("reinforcement panel also protects adjacent tiles", () => {
    const state = makeTestState(5, 5);
    // Set an adjacent tile above threshold
    state.tiles[2][3].stress = STRESS_COLLAPSE_THRESHOLD + 10;
    state.tiles[2][3].stressTurns = 0;

    // Place reinforcement panel at (2,2) — tile (3,2) is adjacent
    state.entities.set("reinforcement_panel_0", {
      id: "reinforcement_panel_0",
      type: EntityType.ReinforcementPanel,
      pos: { x: 2, y: 2 },
      props: { installed: true },
    });

    let current = state;
    for (let i = 0; i < STRESS_COLLAPSE_TURNS + 5; i++) {
      current = tickStructuralStress(current);
    }

    // Adjacent tile should NOT have collapsed
    expect(current.tiles[2][3].type).toBe(TileType.Floor);
    expect(current.tiles[2][3].walkable).toBe(true);
  });
});

// ========================================================================
// 2.3 Cleaning Directive Tests
// ========================================================================

describe("Cleaning directive", () => {
  function makeDirectiveState() {
    const state = makeTestState();
    // Set up mystery state with cleaning directive active
    state.mystery = {
      crew: [],
      timeline: {
        archetype: "coolant_cascade" as any,
        events: [],
        primaryHazard: "heat",
        sensorBias: SensorType.Thermal,
      },
      generatedLogs: [],
      discoveredEvidence: new Set<string>(),
      choices: [],
      journal: [],
      deductions: [],
      objectivePhase: ObjectivePhase.Investigate,
      roomsCleanedCount: 0,
      investigationTrigger: 3,
      evidenceThreshold: 5,
      cleaningDirective: true,
      roomCleanlinessGoal: 80,
      directiveViolationTurns: 0,
    };

    // Make the room dirty (average dirt > 20 = cleanliness < 80)
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        state.tiles[y][x].dirt = 30; // cleanliness = 100 - 30 = 70% < 80% goal
      }
    }

    return state;
  }

  it("directive violation warning appears after 5 turns in dirty room", () => {
    let state = makeDirectiveState();

    // Step 5 turns (Wait actions) in a dirty room
    for (let i = 0; i < 5; i++) {
      state = step(state, { type: ActionType.Wait });
    }

    // After 5 violation turns, should have a warning log
    expect(state.logs.some(l => l.text.includes("DIRECTIVE VIOLATION"))).toBe(true);
  });

  it("directive stun at 10 violation turns", () => {
    let state = makeDirectiveState();

    // Step 10 turns in a dirty room
    for (let i = 0; i < 10; i++) {
      state = step(state, { type: ActionType.Wait });
    }

    // Should have the compliance stun log
    expect(state.logs.some(l => l.text.includes("forcing compliance"))).toBe(true);
  });

  it("cleaning resets violation counter", () => {
    let state = makeDirectiveState();

    // Step 4 turns to accumulate violations
    for (let i = 0; i < 4; i++) {
      state = step(state, { type: ActionType.Wait });
    }

    expect(state.mystery!.directiveViolationTurns).toBe(4);

    // Clean action resets violations to 0 during the action.
    // However, the cleaning directive check runs after the action and
    // may re-increment by 1 if the room is still dirty overall.
    // So the counter should be at most 1 (reset to 0, then +1 from post-check).
    state = step(state, { type: ActionType.Clean });

    expect(state.mystery!.directiveViolationTurns).toBeLessThanOrEqual(1);
    // Key assertion: the counter was reset from 4, not continued at 5
    expect(state.mystery!.directiveViolationTurns).toBeLessThan(4);
  });

  it("directive overridden when phase transitions to Recover", () => {
    const state = makeDirectiveState();
    state.mystery!.evidenceThreshold = 1; // Only need 1 journal entry to transition

    // Place a log terminal for the player to read and gain a journal entry
    state.entities.set("log_terminal_0", {
      id: "log_terminal_0",
      type: EntityType.LogTerminal,
      pos: { x: 5, y: 5 },
      props: { text: "Test log for phase transition", source: "test" },
    });

    // Read the terminal — this should add a journal entry and trigger phase transition
    const next = step(state, { type: ActionType.Interact, targetId: "log_terminal_0" });

    // Phase should transition to Recover
    expect(next.mystery!.objectivePhase).toBe(ObjectivePhase.Recover);
    // Cleaning directive should be overridden
    expect(next.mystery!.cleaningDirective).toBe(false);
    // Should have a directive override log
    expect(next.logs.some(l => l.text.includes("Cleaning directive suspended"))).toBe(true);
  });
});

// ========================================================================
// 2.4 Station Integrity Tests
// ========================================================================

describe("Station integrity", () => {
  it("integrity decays each turn", () => {
    const state = makeTestState();
    const initial = state.stationIntegrity;

    // Step one turn
    const next = step(state, { type: ActionType.Wait });

    // Integrity should have decreased
    expect(next.stationIntegrity).toBeLessThan(initial);
  });

  it("unsealed breaches increase decay rate", () => {
    const state = makeTestState();
    const initial = state.stationIntegrity;

    // Step one turn without breaches
    const noBreachState = step(state, { type: ActionType.Wait });
    const decayWithout = initial - noBreachState.stationIntegrity;

    // Now add an unsealed breach and step again from the same starting state
    const stateWithBreach = makeTestState();
    stateWithBreach.entities.set("breach_0", {
      id: "breach_0",
      type: EntityType.Breach,
      pos: { x: 3, y: 3 },
      props: { sealed: false },
    });
    const breachState = step(stateWithBreach, { type: ActionType.Wait });
    const decayWith = initial - breachState.stationIntegrity;

    // Decay with breach should be higher than without
    expect(decayWith).toBeGreaterThan(decayWithout);
  });

  it("relay rerouting boosts integrity", () => {
    const state = makeTestState();
    // Lower integrity to see the boost
    state.stationIntegrity = 70;

    // Equip thermal sensor
    state.player.attachments[AttachmentSlot.Sensor] = {
      slot: AttachmentSlot.Sensor,
      name: "thermal sensor",
      sensorType: SensorType.Thermal,
    };

    // Place a relay
    state.entities.set("relay_test", {
      id: "relay_test",
      type: EntityType.Relay,
      pos: { x: 5, y: 4 },
      props: { overheating: true, activated: false, powered: false },
    });

    const next = step(state, { type: ActionType.Interact, targetId: "relay_test" });

    // Integrity should be boosted by STATION_INTEGRITY_RELAY_BONUS
    // (may also have some decay from the turn tick, so check relative to expected)
    // The relay interaction adds the bonus before the tick, so the result should be
    // higher than what it would be with just decay
    const expectedMinimum = 70 + STATION_INTEGRITY_RELAY_BONUS - (STATION_INTEGRITY_DECAY_RATE * 2);
    expect(next.stationIntegrity).toBeGreaterThanOrEqual(expectedMinimum);
  });

  it("sealed breaches do not increase decay rate", () => {
    const state = makeTestState();
    const initial = state.stationIntegrity;

    // Add a SEALED breach — should not increase decay
    state.entities.set("breach_0", {
      id: "breach_0",
      type: EntityType.Breach,
      pos: { x: 3, y: 3 },
      props: { sealed: true },
    });

    const next = step(state, { type: ActionType.Wait });
    const decay = initial - next.stationIntegrity;

    // Decay should be roughly the base rate (no breach penalty)
    expect(decay).toBeLessThanOrEqual(STATION_INTEGRITY_DECAY_RATE + 0.1);
  });
});
