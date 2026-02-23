import { describe, it, expect, beforeEach } from "vitest";
import * as ROT from "rot-js";
import { generateCrew } from "../src/sim/crewGen.js";
import { generateTimeline } from "../src/sim/timeline.js";
import {
  createIncidentBoard,
  updateSlotUnlocks,
  generateProposal,
  generateRedHerring,
  confirmCard,
  rejectCard,
  isBoardComplete,
  getConfirmedCount,
  getNextUnlockedSlot,
  buildNarrativeState,
} from "../src/sim/incidentBoard.js";
import type { RoomScene, CrewDossier } from "../src/shared/types.js";
import { IncidentArchetype, TimelinePhase, SceneActivity, SceneOutcome } from "../src/shared/types.js";

const ROOM_NAMES = [
  "Arrival Bay", "Bridge", "Engine Core", "Cargo Hold", "Crew Quarters",
  "Med Bay", "Research Lab", "Life Support", "Power Relay Junction",
  "Engineering Storage", "Communications Hub", "Robotics Bay", "Data Core",
];

describe("incident board creation", () => {
  it("creates 5 timeline slots", () => {
    const board = createIncidentBoard();
    expect(board.slots.length).toBe(5);
  });

  it("NormalOps starts unlocked, others locked", () => {
    const board = createIncidentBoard();
    expect(board.slots[0].phase).toBe(TimelinePhase.NormalOps);
    expect(board.slots[0].status).toBe("unlocked");
    expect(board.slots[1].status).toBe("locked");
    expect(board.slots[2].status).toBe("locked");
    expect(board.slots[3].status).toBe("locked");
    expect(board.slots[4].status).toBe("locked");
  });

  it("starts with zero penalties", () => {
    const board = createIncidentBoard();
    expect(board.wrongConfirmations).toBe(0);
    expect(board.totalTurnPenalty).toBe(0);
  });
});

describe("slot unlocking", () => {
  it("TRIGGER unlocks with 3+ rooms and 2+ crew identified", () => {
    let board = createIncidentBoard();

    // Not enough rooms
    board = updateSlotUnlocks(board, {
      roomsProcessed: 2, crewIdentified: 2, contradictionsFound: 0, slotsConfirmed: 0, crackMomentFired: false,
    });
    expect(board.slots[1].status).toBe("locked");

    // Enough rooms + crew
    board = updateSlotUnlocks(board, {
      roomsProcessed: 3, crewIdentified: 2, contradictionsFound: 0, slotsConfirmed: 0, crackMomentFired: false,
    });
    expect(board.slots[1].status).toBe("unlocked");
  });

  it("ESCALATION unlocks with 5+ rooms and 1+ contradiction", () => {
    let board = createIncidentBoard();

    board = updateSlotUnlocks(board, {
      roomsProcessed: 4, crewIdentified: 2, contradictionsFound: 1, slotsConfirmed: 0, crackMomentFired: false,
    });
    expect(board.slots[2].status).toBe("locked"); // not enough rooms

    board = updateSlotUnlocks(board, {
      roomsProcessed: 5, crewIdentified: 2, contradictionsFound: 1, slotsConfirmed: 0, crackMomentFired: false,
    });
    expect(board.slots[2].status).toBe("unlocked");
  });

  it("COLLAPSE unlocks with 7+ rooms, 3+ crew, and crack moment", () => {
    let board = createIncidentBoard();

    board = updateSlotUnlocks(board, {
      roomsProcessed: 7, crewIdentified: 3, contradictionsFound: 1, slotsConfirmed: 0, crackMomentFired: false,
    });
    expect(board.slots[3].status).toBe("locked"); // no crack moment

    board = updateSlotUnlocks(board, {
      roomsProcessed: 7, crewIdentified: 3, contradictionsFound: 1, slotsConfirmed: 0, crackMomentFired: true,
    });
    expect(board.slots[3].status).toBe("unlocked");
  });

  it("AFTERMATH unlocks only when all prior slots confirmed", () => {
    let board = createIncidentBoard();

    // Unlock everything except aftermath
    board = updateSlotUnlocks(board, {
      roomsProcessed: 10, crewIdentified: 5, contradictionsFound: 3, slotsConfirmed: 0, crackMomentFired: true,
    });
    expect(board.slots[4].status).toBe("locked"); // prior slots not confirmed

    // Confirm first 4 slots
    for (let i = 0; i < 4; i++) {
      board.slots[i] = { ...board.slots[i], status: "confirmed" };
    }
    board = updateSlotUnlocks(board, {
      roomsProcessed: 10, crewIdentified: 5, contradictionsFound: 3, slotsConfirmed: 4, crackMomentFired: true,
    });
    expect(board.slots[4].status).toBe("unlocked");
  });

  it("doesn't regress confirmed slots", () => {
    let board = createIncidentBoard();
    board.slots[0] = { ...board.slots[0], status: "confirmed" };

    board = updateSlotUnlocks(board, {
      roomsProcessed: 0, crewIdentified: 0, contradictionsFound: 0, slotsConfirmed: 1, crackMomentFired: false,
    });
    expect(board.slots[0].status).toBe("confirmed"); // stays confirmed
  });
});

describe("summary card generation", () => {
  beforeEach(() => {
    ROT.RNG.setSeed(184201);
  });

  it("generates a proposal for a valid phase", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);
    const processedScenes: RoomScene[] = [{
      roomId: "room_0",
      roomName: "Engine Core",
      crewPresent: [],
      physicalClues: [],
      environmentalState: { damageType: "none", damageLevel: 0, hasBarricade: false, sealState: "open" },
      evidenceCategory: "confirming",
      processed: true,
      processAttempts: 1,
      groundTruth: { who: [], what: SceneActivity.EquipmentRepair, outcome: SceneOutcome.LeftNormally },
    }];

    const proposal = generateProposal(TimelinePhase.NormalOps, timeline, processedScenes, crew);
    expect(proposal).not.toBeNull();
    expect(proposal!.phase).toBe(TimelinePhase.NormalOps);
    expect(proposal!.keyActor).toBeTruthy();
    expect(proposal!.location).toBeTruthy();
    expect(proposal!.correct).toBe(true);
  });

  it("generates a red herring with wrong actor", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const timeline = generateTimeline(crew, IncidentArchetype.CoolantCascade, ROOM_NAMES);

    const herring = generateRedHerring(TimelinePhase.Trigger, timeline, crew);
    expect(herring).not.toBeNull();
    expect(herring!.correct).toBe(false);
  });
});

describe("card confirmation", () => {
  it("correct confirmation locks the slot", () => {
    let board = createIncidentBoard();
    const card = {
      phase: TimelinePhase.NormalOps,
      event: "Test event",
      keyActor: "Test Actor",
      action: "test action",
      location: "Bridge",
      correct: true,
    };

    const { board: newBoard, result } = confirmCard(board, TimelinePhase.NormalOps, card);
    expect(result.correct).toBe(true);
    expect(result.turnPenalty).toBe(0);
    expect(newBoard.slots[0].status).toBe("confirmed");
    expect(newBoard.slots[0].confirmedCard).toEqual(card);
  });

  it("wrong confirmation adds penalty", () => {
    let board = createIncidentBoard();
    const card = {
      phase: TimelinePhase.NormalOps,
      event: "Wrong event",
      keyActor: "Wrong Actor",
      action: "wrong action",
      location: "Wrong Room",
      correct: false,
    };

    const { board: newBoard, result } = confirmCard(board, TimelinePhase.NormalOps, card);
    expect(result.correct).toBe(false);
    expect(result.turnPenalty).toBe(5);
    expect(newBoard.wrongConfirmations).toBe(1);
    expect(newBoard.totalTurnPenalty).toBe(5);
    expect(newBoard.slots[0].status).toBe("unlocked"); // reverts to unlocked
  });

  it("cannot confirm a locked slot", () => {
    const board = createIncidentBoard();
    const card = {
      phase: TimelinePhase.Trigger,
      event: "Test",
      keyActor: "Test",
      action: "test",
      location: "Bridge",
      correct: true,
    };

    // Trigger is locked
    const { board: newBoard, result } = confirmCard(board, TimelinePhase.Trigger, card);
    expect(result.correct).toBe(false);
    expect(newBoard.slots[1].status).toBe("locked");
  });
});

describe("card rejection", () => {
  it("clears proposed card and reverts to unlocked", () => {
    let board = createIncidentBoard();
    board.slots[0] = {
      ...board.slots[0],
      status: "proposed",
      proposedCard: {
        phase: TimelinePhase.NormalOps,
        event: "Test",
        keyActor: "Test",
        action: "test",
        location: "Bridge",
        correct: true,
      },
    };

    board = rejectCard(board, TimelinePhase.NormalOps);
    expect(board.slots[0].status).toBe("unlocked");
    expect(board.slots[0].proposedCard).toBeUndefined();
  });
});

describe("board queries", () => {
  it("isBoardComplete returns false until all confirmed", () => {
    const board = createIncidentBoard();
    expect(isBoardComplete(board)).toBe(false);
  });

  it("isBoardComplete returns true when all confirmed", () => {
    const board = createIncidentBoard();
    for (let i = 0; i < 5; i++) {
      board.slots[i] = { ...board.slots[i], status: "confirmed" };
    }
    expect(isBoardComplete(board)).toBe(true);
  });

  it("getConfirmedCount tracks progress", () => {
    const board = createIncidentBoard();
    expect(getConfirmedCount(board)).toBe(0);
    board.slots[0] = { ...board.slots[0], status: "confirmed" };
    expect(getConfirmedCount(board)).toBe(1);
  });

  it("getNextUnlockedSlot finds the first unlocked slot", () => {
    const board = createIncidentBoard();
    const next = getNextUnlockedSlot(board);
    expect(next?.phase).toBe(TimelinePhase.NormalOps);
  });
});

describe("buildNarrativeState", () => {
  it("counts processed rooms and identified crew", () => {
    const scenes: RoomScene[] = [
      { roomId: "r1", roomName: "Test", crewPresent: [], physicalClues: [], environmentalState: { damageType: "none", damageLevel: 0, hasBarricade: false, sealState: "open" }, evidenceCategory: "confirming", processed: true, processAttempts: 1, groundTruth: { who: [], what: SceneActivity.RoutineWork, outcome: SceneOutcome.Unknown } },
      { roomId: "r2", roomName: "Test2", crewPresent: [], physicalClues: [], environmentalState: { damageType: "none", damageLevel: 0, hasBarricade: false, sealState: "open" }, evidenceCategory: "confirming", processed: false, processAttempts: 0, groundTruth: { who: [], what: SceneActivity.RoutineWork, outcome: SceneOutcome.Unknown } },
    ];
    const dossiers: CrewDossier[] = [
      { crewId: "c1", confirmed: { name: "Test", role: "captain" as any, badgeId: "T-1" }, theories: {}, personalDetails: {}, linkedEvidence: [], roomsSeen: [] },
      { crewId: "c2", confirmed: {}, theories: {}, personalDetails: {}, linkedEvidence: [], roomsSeen: [] },
    ];

    const state = buildNarrativeState(scenes, dossiers, 2);
    expect(state.roomsProcessed).toBe(1);
    expect(state.crewIdentified).toBe(1);
    expect(state.contradictionsFound).toBe(2);
  });
});
