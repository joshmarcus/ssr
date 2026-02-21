import { describe, it, expect } from "vitest";
import { generate } from "../src/sim/procgen.js";
import { step } from "../src/sim/step.js";
import { GOLDEN_SEED } from "../src/shared/constants.js";
import { ActionType, EntityType, SensorType, AttachmentSlot, ObjectivePhase } from "../src/shared/types.js";
import type { Action, GameState, Attachment } from "../src/shared/types.js";

const interact = (id?: string): Action => ({ type: ActionType.Interact, targetId: id });

const thermalSensor: Attachment = {
  slot: AttachmentSlot.Sensor,
  name: "thermal sensor",
  sensorType: SensorType.Thermal,
};

function equipThermal(state: GameState): GameState {
  const sensors = state.player.sensors ?? [];
  return {
    ...state,
    player: {
      ...state.player,
      sensors: sensors.includes(SensorType.Thermal) ? sensors : [...sensors, SensorType.Thermal],
      attachments: { ...state.player.attachments, [AttachmentSlot.Sensor]: thermalSensor },
    },
  };
}

describe("evidence system", () => {
  it("evidence traces are placed in generated maps", () => {
    const state = generate(GOLDEN_SEED);
    const roomTraces: string[] = [];
    const corridorTraces: string[] = [];
    for (const [id, entity] of state.entities) {
      if (entity.type === EntityType.EvidenceTrace) {
        if (entity.props["corridor"]) {
          corridorTraces.push(id);
        } else {
          roomTraces.push(id);
        }
      }
    }
    // Room-based evidence traces: 3-7 (includes sensor-gated traces)
    expect(roomTraces.length).toBeGreaterThanOrEqual(3);
    expect(roomTraces.length).toBeLessThanOrEqual(7);
    // Corridor evidence traces: 6-8 from placeCorridorClues + crew path breadcrumbs
    expect(corridorTraces.length).toBeGreaterThanOrEqual(6);
    expect(corridorTraces.length).toBeLessThanOrEqual(40);
  });

  it("evidence traces have proper properties", () => {
    const state = generate(GOLDEN_SEED);
    for (const [, entity] of state.entities) {
      if (entity.type === EntityType.EvidenceTrace) {
        expect(entity.props["text"]).toBeTruthy();
        if (entity.props["corridor"]) {
          // Corridor traces have interacted flag instead of phase
          expect(entity.props["interacted"]).toBe(false);
        } else {
          // Room-based traces have phase and discovered
          expect(entity.props["phase"]).toBeTruthy();
          expect(entity.props["discovered"]).toBe(false);
        }
      }
    }
  });

  it("interacting with evidence trace creates journal entry", () => {
    let state = generate(GOLDEN_SEED);
    // Find first evidence trace
    let traceId: string | undefined;
    for (const [id, entity] of state.entities) {
      if (entity.type === EntityType.EvidenceTrace && entity.props["sensorRequired"] === null) {
        traceId = id;
        break;
      }
    }
    if (!traceId) return; // skip if no non-sensor traces

    const trace = state.entities.get(traceId)!;
    state.player = {
      ...state.player,
      entity: { ...state.player.entity, pos: { ...trace.pos } },
    };

    const prevJournal = state.mystery?.journal.length || 0;
    state = step(state, interact(traceId));
    expect(state.mystery!.journal.length).toBeGreaterThan(prevJournal);
  });

  it("reading log terminal creates journal entry", () => {
    let state = generate(GOLDEN_SEED);
    // Find first log terminal
    let terminalId: string | undefined;
    for (const [id, entity] of state.entities) {
      if (entity.type === EntityType.LogTerminal) {
        terminalId = id;
        break;
      }
    }
    expect(terminalId).toBeDefined();

    const terminal = state.entities.get(terminalId!)!;
    state.player = {
      ...state.player,
      entity: { ...state.player.entity, pos: { ...terminal.pos } },
    };

    state = step(state, interact(terminalId));
    expect(state.mystery!.journal.length).toBeGreaterThan(0);
    expect(state.mystery!.journal[0].category).toBe("log");
  });

  it("examining crew item creates journal entry", () => {
    let state = generate(GOLDEN_SEED);
    // Find first non-hidden crew item
    let itemId: string | undefined;
    for (const [id, entity] of state.entities) {
      if (entity.type === EntityType.CrewItem && entity.props["hidden"] !== true) {
        itemId = id;
        break;
      }
    }
    if (!itemId) return;

    const item = state.entities.get(itemId)!;
    state.player = {
      ...state.player,
      entity: { ...state.player.entity, pos: { ...item.pos } },
    };

    state = step(state, interact(itemId));
    expect(state.mystery!.journal.some(j => j.category === "item")).toBe(true);
  });

  it("investigation phase transitions to recovery after enough evidence", () => {
    let state = generate(GOLDEN_SEED);
    // Game starts in Clean phase; fast-forward to Investigate for this test
    state = { ...state, mystery: { ...state.mystery!, objectivePhase: ObjectivePhase.Investigate } };
    expect(state.mystery!.objectivePhase).toBe(ObjectivePhase.Investigate);

    // Grant relay milestones so puzzle-gated terminals are accessible
    state.milestones.add("first_relay");
    state.milestones.add("all_relays");

    // Read enough log terminals to reach threshold
    const threshold = state.mystery!.evidenceThreshold;
    let logTerminals: string[] = [];
    for (const [id, entity] of state.entities) {
      if (entity.type === EntityType.LogTerminal) {
        logTerminals.push(id);
      }
    }

    for (let i = 0; i < threshold && i < logTerminals.length; i++) {
      const terminal = state.entities.get(logTerminals[i])!;
      state.player = {
        ...state.player,
        entity: { ...state.player.entity, pos: { ...terminal.pos } },
      };
      state = step(state, interact(logTerminals[i]));
    }

    expect(state.mystery!.objectivePhase).toBe(ObjectivePhase.Recover);
  });

  it("data core refuses transmission before evidence threshold", () => {
    let state = equipThermal(generate(GOLDEN_SEED));

    // Activate all relays first
    for (const relayId of ["relay_p01", "relay_p03", "relay_p04"]) {
      const relay = state.entities.get(relayId)!;
      state.player = {
        ...state.player,
        entity: { ...state.player.entity, pos: { ...relay.pos } },
      };
      state = step(state, interact(relayId));
    }

    // Try to transmit without evidence
    const dataCore = state.entities.get("data_core")!;
    state.player = {
      ...state.player,
      entity: { ...state.player.entity, pos: { ...dataCore.pos } },
    };
    state = step(state, interact("data_core"));

    expect(state.victory).toBe(false);
    expect(state.gameOver).toBe(false);
  });

});
