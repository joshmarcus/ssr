import { describe, it, expect } from "vitest";
import { step } from "../src/sim/step.js";
import { createEmptyState } from "../src/sim/state.js";
import { ActionType, EntityType, TileType, ObjectivePhase, SensorType, IncidentArchetype } from "../src/shared/types.js";
import { GLYPHS } from "../src/shared/constants.js";
import type { Entity, GameState, MysteryState, IncidentTimeline } from "../src/shared/types.js";

/** Create a 15x15 walkable floor grid with a room and mystery state. */
function makeRecoveryState(phase: ObjectivePhase = ObjectivePhase.Recover) {
  const state = createEmptyState(1, 15, 15);
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
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
    width: 15,
    height: 15,
  });

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
    evidenceThreshold: 3,
    cleaningDirective: false,
    roomCleanlinessGoal: 80,
  };
  return { ...state, mystery };
}

function makeRelay(id: string, x: number, y: number): Entity {
  return {
    id,
    type: EntityType.Relay,
    pos: { x, y },
    props: { overheating: true, activated: false, powered: false },
  };
}

describe("Recovery phase integration", () => {
  it("activating all relays unlocks locked doors", () => {
    const state = makeRecoveryState();

    // Place 2 relays adjacent to player
    state.entities.set("relay_1", makeRelay("relay_1", 5, 4));
    state.entities.set("relay_2", makeRelay("relay_2", 6, 5));

    // Place locked door at (10, 10) WITH an entity so tickHazards won't auto-reopen it
    state.tiles[10][10] = {
      type: TileType.LockedDoor,
      glyph: GLYPHS.lockedDoor,
      walkable: false,
      heat: 0,
      smoke: 0,
      dirt: 0,
      pressure: 100,
      explored: true,
      visible: true,
    };
    state.entities.set("locked_door_main", {
      id: "locked_door_main",
      type: EntityType.Relay,
      pos: { x: 10, y: 10 },
      props: { powered: false, locked: true },
    });

    // Activate first relay — door should stay locked
    let next = step(state, { type: ActionType.Interact, targetId: "relay_1" });
    expect(next.tiles[10][10].type).toBe(TileType.LockedDoor);
    expect(next.entities.get("relay_1")!.props["activated"]).toBe(true);
    // Log should mention remaining relays
    const remainLog = next.logs.find(l => l.text.includes("still overheating"));
    expect(remainLog).toBeDefined();

    // Move player to be adjacent to relay_2
    next = { ...next, player: { ...next.player, entity: { ...next.player.entity, pos: { x: 5, y: 5 } } } };

    // Activate second relay — door should unlock
    next = step(next, { type: ActionType.Interact, targetId: "relay_2" });
    expect(next.tiles[10][10].type).toBe(TileType.Door);
    expect(next.tiles[10][10].walkable).toBe(true);
    expect(next.entities.get("relay_2")!.props["activated"]).toBe(true);

    // Log should mention "UNLOCKED"
    const unlockLog = next.logs.find(l => l.text.includes("UNLOCKED"));
    expect(unlockLog).toBeDefined();
  });

  it("Data Core grants victory in Recover phase", () => {
    const state = makeRecoveryState(ObjectivePhase.Recover);
    const dataCore: Entity = {
      id: "data_core",
      type: EntityType.DataCore,
      pos: { x: 5, y: 5 },
      props: { transmitted: false },
    };
    state.entities.set(dataCore.id, dataCore);

    const next = step(state, { type: ActionType.Interact, targetId: "data_core" });
    expect(next.victory).toBe(true);
    expect(next.gameOver).toBe(true);
  });

  it("Data Core denies transmission in Clean phase", () => {
    const state = makeRecoveryState(ObjectivePhase.Clean);
    state.mystery!.cleaningDirective = true;
    const dataCore: Entity = {
      id: "data_core",
      type: EntityType.DataCore,
      pos: { x: 5, y: 5 },
      props: { transmitted: false },
    };
    state.entities.set(dataCore.id, dataCore);

    const next = step(state, { type: ActionType.Interact, targetId: "data_core" });
    expect(next.victory).toBe(false);
    expect(next.gameOver).toBe(false);
    // Should have a denial log
    const denyLog = next.logs.find(l => l.text.includes("directive") || l.text.includes("maintenance"));
    expect(denyLog).toBeDefined();
  });

  it("service bot activates on interaction", () => {
    const state = makeRecoveryState();
    const bot: Entity = {
      id: "service_bot",
      type: EntityType.ServiceBot,
      pos: { x: 5, y: 4 },
      props: { active: false },
    };
    state.entities.set(bot.id, bot);

    const next = step(state, { type: ActionType.Interact, targetId: "service_bot" });
    expect(next.entities.get("service_bot")!.props["active"]).toBe(true);
    const activationLog = next.logs.find(l => l.text.includes("Service bot") || l.text.includes("powered up"));
    expect(activationLog).toBeDefined();
  });

  it("investigation → recovery phase transition on evidence threshold", () => {
    const state = makeRecoveryState(ObjectivePhase.Investigate);
    state.mystery!.evidenceThreshold = 2;
    state.mystery!.journal = [
      { id: "j1", type: "log", summary: "First clue", content: "Details", room: "Bridge", turn: 1, tags: [] },
    ];

    // Place a log terminal that will add a journal entry
    const terminal: Entity = {
      id: "log_term_1",
      type: EntityType.LogTerminal,
      pos: { x: 5, y: 4 },
      props: { text: "Critical evidence found", source: "captain" },
    };
    state.entities.set(terminal.id, terminal);

    const next = step(state, { type: ActionType.Interact, targetId: "log_term_1" });

    // Phase should have transitioned to Recover
    expect(next.mystery!.objectivePhase).toBe(ObjectivePhase.Recover);
    expect(next.mystery!.cleaningDirective).toBe(false);
  });

  it("relay already activated gives informational log", () => {
    const state = makeRecoveryState();
    const relay: Entity = {
      id: "relay_1",
      type: EntityType.Relay,
      pos: { x: 5, y: 4 },
      props: { overheating: false, activated: true, powered: true },
    };
    state.entities.set(relay.id, relay);

    const next = step(state, { type: ActionType.Interact, targetId: "relay_1" });
    const dupLog = next.logs.find(l => l.text.includes("already rerouted"));
    expect(dupLog).toBeDefined();
  });

  it("full pipeline: relays → unlock → Data Core → victory", () => {
    const state = makeRecoveryState(ObjectivePhase.Recover);

    // Place 1 relay and locked door with entity
    state.entities.set("relay_solo", makeRelay("relay_solo", 5, 4));
    state.tiles[10][10] = {
      type: TileType.LockedDoor,
      glyph: GLYPHS.lockedDoor,
      walkable: false,
      heat: 0,
      smoke: 0,
      dirt: 0,
      pressure: 100,
      explored: true,
      visible: true,
    };
    state.entities.set("locked_door_main", {
      id: "locked_door_main",
      type: EntityType.Relay,
      pos: { x: 10, y: 10 },
      props: { powered: false, locked: true },
    });

    // Data Core behind the locked door (at a different position)
    const dataCore: Entity = {
      id: "data_core",
      type: EntityType.DataCore,
      pos: { x: 11, y: 10 },
      props: { transmitted: false },
    };
    state.entities.set(dataCore.id, dataCore);

    // Step 1: Activate relay — unlocks door
    let next = step(state, { type: ActionType.Interact, targetId: "relay_solo" });
    expect(next.tiles[10][10].type).toBe(TileType.Door);

    // Step 2: Move player to Data Core position (simulate reaching it)
    next = {
      ...next,
      player: { ...next.player, entity: { ...next.player.entity, pos: { x: 11, y: 10 } } },
    };

    // Step 3: Transmit Data Core — victory
    next = step(next, { type: ActionType.Interact, targetId: "data_core" });
    expect(next.victory).toBe(true);
    expect(next.gameOver).toBe(true);
  });
});
