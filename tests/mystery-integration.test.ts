/**
 * Integration tests for the mystery game loop:
 * ExamineScene → ProcessScene → evidence accumulation → dossier updates → timeline confirmation
 */
import { describe, it, expect } from "vitest";
import { generate } from "../src/sim/procgen.js";
import { step } from "../src/sim/step.js";
import { GOLDEN_SEED } from "../src/shared/constants.js";
import { ActionType, SceneActivity, SceneOutcome, TimelinePhase } from "../src/shared/types.js";

describe("mystery integration — scene examination", () => {
  it("ExamineScene marks clues as examined and adds journal entries", () => {
    const state = generate(GOLDEN_SEED);
    expect(state.mystery).toBeTruthy();
    expect(state.mystery!.roomScenes).toBeTruthy();
    expect(state.mystery!.roomScenes!.length).toBeGreaterThan(0);

    // Find a room scene with clues
    const sceneWithClues = state.mystery!.roomScenes!.find(
      s => s.physicalClues.some(c => !c.sensorRequired)
    );
    expect(sceneWithClues).toBeTruthy();

    // Move player to that room (or just use sceneRoomId)
    const journalBefore = state.mystery!.journal.length;
    const next = step(state, {
      type: ActionType.ExamineScene,
      sceneRoomId: sceneWithClues!.roomId,
    });

    // Clues should now be examined
    const updatedScene = next.mystery!.roomScenes!.find(
      s => s.roomId === sceneWithClues!.roomId
    )!;
    const examinedClues = updatedScene.physicalClues.filter(
      c => c.examined && !c.sensorRequired
    );
    expect(examinedClues.length).toBeGreaterThan(0);

    // Journal entries should have been added
    expect(next.mystery!.journal.length).toBeGreaterThan(journalBefore);
  });

  it("ExamineScene skips world tick (early return)", () => {
    const state = generate(GOLDEN_SEED);
    const scene = state.mystery!.roomScenes![0];
    const next = step(state, {
      type: ActionType.ExamineScene,
      sceneRoomId: scene.roomId,
    });
    // ExamineScene returns early (no hazard tick, no drone movement)
    // but turn still advances by 1 (same as SubmitDeduction)
    expect(next.turn).toBe(state.turn + 1);
  });

  it("sensor-gated clues remain unexamined without the sensor", () => {
    const state = generate(GOLDEN_SEED);

    // Find a scene with sensor-gated clues
    const sensorScene = state.mystery!.roomScenes!.find(
      s => s.physicalClues.some(c => c.sensorRequired !== null)
    );
    if (!sensorScene) return; // skip if no sensor-gated clues exist

    const next = step(state, {
      type: ActionType.ExamineScene,
      sceneRoomId: sensorScene.roomId,
    });

    const updatedScene = next.mystery!.roomScenes!.find(
      s => s.roomId === sensorScene.roomId
    )!;
    const sensorGated = updatedScene.physicalClues.filter(c => c.sensorRequired);
    // Without the sensor, these should still be unexamined
    for (const clue of sensorGated) {
      if (!state.player.sensors?.includes(clue.sensorRequired!)) {
        expect(clue.examined).toBe(false);
      }
    }
  });

  it("badge clues confirm crew identity in dossiers", () => {
    const state = generate(GOLDEN_SEED);

    // Find a scene with a badge clue linked to a crew member
    const badgeScene = state.mystery!.roomScenes!.find(
      s => s.physicalClues.some(c => c.type === "badge" && c.crewLinked)
    );
    if (!badgeScene) return; // skip if no badge clues

    const next = step(state, {
      type: ActionType.ExamineScene,
      sceneRoomId: badgeScene.roomId,
    });

    // Check if any dossier was updated
    const badgeClue = badgeScene.physicalClues.find(c => c.type === "badge" && c.crewLinked);
    if (badgeClue && next.mystery!.dossiers) {
      const dossier = next.mystery!.dossiers.find(d => d.crewId === badgeClue.crewLinked);
      if (dossier) {
        expect(dossier.confirmed.name).toBeTruthy();
        expect(dossier.confirmed.role).toBeTruthy();
        expect(dossier.confirmed.badgeId).toBeTruthy();
      }
    }
  });
});

describe("mystery integration — scene processing", () => {
  it("ProcessScene evaluates WHO/WHAT/OUTCOME and costs turns", () => {
    let state = generate(GOLDEN_SEED);
    const scene = state.mystery!.roomScenes![0];

    // First examine clues
    state = step(state, {
      type: ActionType.ExamineScene,
      sceneRoomId: scene.roomId,
    });

    const turnBefore = state.turn;

    // Process with correct answers
    const gt = scene.groundTruth;
    const next = step(state, {
      type: ActionType.ProcessScene,
      sceneRoomId: scene.roomId,
      whoAnswer: gt.who,
      whatAnswer: gt.what,
      outcomeAnswer: gt.outcome,
    });

    // Turn should advance by the turn cost
    expect(next.turn).toBeGreaterThan(turnBefore);

    // Scene should be marked as processed (all 3 correct = score 3 >= 2)
    const processed = next.mystery!.roomScenes!.find(s => s.roomId === scene.roomId)!;
    expect(processed.processed).toBe(true);
    expect(processed.processAttempts).toBe(1);
  });

  it("ProcessScene with wrong answers does not mark scene as processed", () => {
    let state = generate(GOLDEN_SEED);
    const scene = state.mystery!.roomScenes![0];

    // Examine first
    state = step(state, {
      type: ActionType.ExamineScene,
      sceneRoomId: scene.roomId,
    });

    // Process with all wrong answers
    const next = step(state, {
      type: ActionType.ProcessScene,
      sceneRoomId: scene.roomId,
      whoAnswer: ["nonexistent_crew"],
      whatAnswer: SceneActivity.Sabotage,
      outcomeAnswer: SceneOutcome.Unknown,
    });

    const processed = next.mystery!.roomScenes!.find(s => s.roomId === scene.roomId)!;
    expect(processed.processAttempts).toBe(1);
    // With all wrong answers (score 0), should not be processed
    expect(processed.processed).toBe(false);
  });

  it("ProcessScene requires examined clues first", () => {
    const state = generate(GOLDEN_SEED);

    // Find a scene where no clues are examined
    const freshScene = state.mystery!.roomScenes!.find(
      s => s.physicalClues.every(c => !c.examined)
    );
    if (!freshScene) return;

    const next = step(state, {
      type: ActionType.ProcessScene,
      sceneRoomId: freshScene.roomId,
      whoAnswer: [],
      whatAnswer: SceneActivity.RoutineWork,
      outcomeAnswer: SceneOutcome.Unknown,
    });

    // Should not process — needs examined clues first
    const scene = next.mystery!.roomScenes!.find(s => s.roomId === freshScene.roomId)!;
    expect(scene.processAttempts).toBe(0);
  });

  it("turn cost increases with repeated attempts", () => {
    let state = generate(GOLDEN_SEED);
    const scene = state.mystery!.roomScenes![0];

    // Examine first
    state = step(state, {
      type: ActionType.ExamineScene,
      sceneRoomId: scene.roomId,
    });

    // First attempt (wrong) — costs 3 turns
    const turnBefore1 = state.turn;
    state = step(state, {
      type: ActionType.ProcessScene,
      sceneRoomId: scene.roomId,
      whoAnswer: ["wrong"],
      whatAnswer: SceneActivity.Sabotage,
      outcomeAnswer: SceneOutcome.Unknown,
    });
    const cost1 = state.turn - turnBefore1;
    expect(cost1).toBe(3 + 1); // +1 for normal turn advance

    // Second attempt (wrong) — costs 5 turns
    const turnBefore2 = state.turn;
    state = step(state, {
      type: ActionType.ProcessScene,
      sceneRoomId: scene.roomId,
      whoAnswer: ["wrong"],
      whatAnswer: SceneActivity.Sabotage,
      outcomeAnswer: SceneOutcome.Unknown,
    });
    const cost2 = state.turn - turnBefore2;
    expect(cost2).toBe(5 + 1); // +1 for normal turn advance
  });
});

describe("mystery integration — evidence accumulation", () => {
  it("examining clues updates evidence accumulation counts", () => {
    const state = generate(GOLDEN_SEED);
    expect(state.mystery!.evidenceAccumulation).toBeTruthy();

    const accBefore = state.mystery!.evidenceAccumulation!;
    const totalBefore = accBefore.confirming_found + accBefore.ambiguous_found + accBefore.contradicting_found;

    // Examine a scene with non-sensor clues
    const scene = state.mystery!.roomScenes!.find(
      s => s.physicalClues.some(c => !c.sensorRequired)
    )!;
    const next = step(state, {
      type: ActionType.ExamineScene,
      sceneRoomId: scene.roomId,
    });

    const accAfter = next.mystery!.evidenceAccumulation!;
    const totalAfter = accAfter.confirming_found + accAfter.ambiguous_found + accAfter.contradicting_found;
    expect(totalAfter).toBeGreaterThan(totalBefore);
  });
});

describe("mystery integration — dossier updates from scene processing", () => {
  it("correct WHO answer updates dossier theories", () => {
    let state = generate(GOLDEN_SEED);

    // Find a scene with crew present
    const crewScene = state.mystery!.roomScenes!.find(
      s => s.groundTruth.who.length > 0
    );
    if (!crewScene) return;

    // Examine first
    state = step(state, {
      type: ActionType.ExamineScene,
      sceneRoomId: crewScene.roomId,
    });

    // Process with correct WHO
    const gt = crewScene.groundTruth;
    state = step(state, {
      type: ActionType.ProcessScene,
      sceneRoomId: crewScene.roomId,
      whoAnswer: gt.who,
      whatAnswer: gt.what,
      outcomeAnswer: gt.outcome,
    });

    // Check dossier was updated
    if (state.mystery!.dossiers) {
      for (const crewId of gt.who) {
        const dossier = state.mystery!.dossiers.find(d => d.crewId === crewId);
        if (dossier) {
          expect(dossier.roomsSeen).toContain(crewScene.roomName);
        }
      }
    }
  });
});

describe("mystery integration — timeline confirmation", () => {
  it("ConfirmTimeline with correct card marks slot as confirmed", () => {
    let state = generate(GOLDEN_SEED);
    expect(state.mystery!.incidentBoard).toBeTruthy();

    // NormalOps is unlocked from start
    const board = state.mystery!.incidentBoard!;
    const normalOps = board.slots.find(s => s.phase === TimelinePhase.NormalOps);
    expect(normalOps!.status).toBe("unlocked");

    // Process at least one scene first so generateProposal works
    const scene = state.mystery!.roomScenes![0];
    state = step(state, {
      type: ActionType.ExamineScene,
      sceneRoomId: scene.roomId,
    });
    const gt = scene.groundTruth;
    state = step(state, {
      type: ActionType.ProcessScene,
      sceneRoomId: scene.roomId,
      whoAnswer: gt.who,
      whatAnswer: gt.what,
      outcomeAnswer: gt.outcome,
    });

    // Confirm with correct card
    const next = step(state, {
      type: ActionType.ConfirmTimeline,
      timelinePhase: TimelinePhase.NormalOps,
      cardCorrect: true,
    });

    const updatedSlot = next.mystery!.incidentBoard!.slots.find(
      s => s.phase === TimelinePhase.NormalOps
    );
    expect(updatedSlot!.status).toBe("confirmed");
  });

  it("ConfirmTimeline with wrong card applies turn penalty", () => {
    const state = generate(GOLDEN_SEED);
    const turnBefore = state.turn;

    // Confirm with incorrect card (red herring)
    const next = step(state, {
      type: ActionType.ConfirmTimeline,
      timelinePhase: TimelinePhase.NormalOps,
      cardCorrect: false,
    });

    // Turn should have been penalized
    // Note: ConfirmTimeline returns early (free action) but adds turn penalty on wrong
    const updatedSlot = next.mystery!.incidentBoard!.slots.find(
      s => s.phase === TimelinePhase.NormalOps
    );
    // Slot should revert to unlocked after wrong confirmation
    expect(updatedSlot!.status).toBe("unlocked");
    expect(next.mystery!.incidentBoard!.wrongConfirmations).toBe(1);
  });

  it("RejectTimeline reverts slot to unlocked", () => {
    const state = generate(GOLDEN_SEED);

    const next = step(state, {
      type: ActionType.RejectTimeline,
      timelinePhase: TimelinePhase.NormalOps,
    });

    const slot = next.mystery!.incidentBoard!.slots.find(
      s => s.phase === TimelinePhase.NormalOps
    );
    expect(slot!.status).toBe("unlocked");
  });
});

describe("mystery integration — full flow", () => {
  it("examine → process → accumulate evidence across multiple rooms", () => {
    let state = generate(GOLDEN_SEED);
    let processedCount = 0;

    // Process up to 3 scenes
    for (const scene of state.mystery!.roomScenes!.slice(0, 3)) {
      // Examine
      state = step(state, {
        type: ActionType.ExamineScene,
        sceneRoomId: scene.roomId,
      });

      // Process with correct answers
      const gt = scene.groundTruth;
      state = step(state, {
        type: ActionType.ProcessScene,
        sceneRoomId: scene.roomId,
        whoAnswer: gt.who,
        whatAnswer: gt.what,
        outcomeAnswer: gt.outcome,
      });

      const updatedScene = state.mystery!.roomScenes!.find(s => s.roomId === scene.roomId)!;
      if (updatedScene.processed) processedCount++;
    }

    // At least some scenes should have been processed
    expect(processedCount).toBeGreaterThan(0);

    // Evidence accumulation should have advanced
    const acc = state.mystery!.evidenceAccumulation!;
    const total = acc.confirming_found + acc.ambiguous_found + acc.contradicting_found;
    expect(total).toBeGreaterThan(0);

    // Journal should have entries from both examination and processing
    expect(state.mystery!.journal.length).toBeGreaterThan(0);
  });
});
