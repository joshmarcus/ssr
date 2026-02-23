/**
 * Incident Board — Timeline Reconstruction system.
 *
 * The Incident Board is a system-proposed, player-confirmed timeline
 * with 5 phase slots. As the player processes room scenes and discovers
 * evidence, the system proposes Summary Cards for timeline slots.
 *
 * See MYSTERY_GAMEPLAY.md Part 2 (Pillar 3).
 */
import type {
  CrewMember,
  IncidentTimeline,
  RoomScene,
  CrewDossier,
  TimelineSlotCard,
  TimelineSlotState,
  IncidentBoardState,
  TimelineSlotStatus,
} from "../shared/types.js";
import { TimelinePhase, SceneActivity } from "../shared/types.js";
import { getIdentifiedCrewCount } from "./crewDossiers.js";

// Re-export shared types for convenience
export type SummaryCard = TimelineSlotCard;
export type TimelineSlot = TimelineSlotState;
export type SlotStatus = TimelineSlotStatus;
export type IncidentBoard = IncidentBoardState;

// ── Initialization ──────────────────────────────────────────────

/** Create an empty Incident Board with 5 timeline slots. */
export function createIncidentBoard(): IncidentBoard {
  const phases = [
    TimelinePhase.NormalOps,
    TimelinePhase.Trigger,
    TimelinePhase.Escalation,
    TimelinePhase.Collapse,
    TimelinePhase.Aftermath,
  ];

  return {
    slots: phases.map((phase) => ({
      phase,
      status: phase === TimelinePhase.NormalOps ? "unlocked" : "locked",
    })),
    wrongConfirmations: 0,
    totalTurnPenalty: 0,
  };
}

// ── Slot Unlocking ──────────────────────────────────────────────

export interface NarrativeState {
  roomsProcessed: number;
  crewIdentified: number;
  contradictionsFound: number;
  slotsConfirmed: number;
  crackMomentFired: boolean;
}

/**
 * Check and update slot unlock status based on narrative state.
 *
 * | Slot        | Unlock Condition                                              |
 * |-------------|---------------------------------------------------------------|
 * | BEFORE      | Available from start                                          |
 * | TRIGGER     | 3+ rooms processed AND 2+ crew identified                     |
 * | ESCALATION  | 5+ rooms processed AND 1+ contradiction found                 |
 * | COLLAPSE    | 7+ rooms processed AND 3+ crew identified AND crack moment    |
 * | AFTERMATH   | All prior slots confirmed                                     |
 */
export function updateSlotUnlocks(
  board: IncidentBoard,
  state: NarrativeState,
): IncidentBoard {
  const newSlots = board.slots.map((slot) => {
    // Already confirmed or proposed — don't regress
    if (slot.status === "confirmed" || slot.status === "proposed") return slot;

    let shouldUnlock = false;
    switch (slot.phase) {
      case TimelinePhase.NormalOps:
        shouldUnlock = true; // always unlocked
        break;
      case TimelinePhase.Trigger:
        shouldUnlock = state.roomsProcessed >= 3 && state.crewIdentified >= 2;
        break;
      case TimelinePhase.Escalation:
        shouldUnlock = state.roomsProcessed >= 5 && state.contradictionsFound >= 1;
        break;
      case TimelinePhase.Collapse:
        shouldUnlock = state.roomsProcessed >= 7 && state.crewIdentified >= 3 && state.crackMomentFired;
        break;
      case TimelinePhase.Aftermath:
        // All prior slots must be confirmed
        shouldUnlock = board.slots
          .filter((s) => s.phase !== TimelinePhase.Aftermath)
          .every((s) => s.status === "confirmed");
        break;
    }

    if (shouldUnlock && slot.status === "locked") {
      return { ...slot, status: "unlocked" as SlotStatus };
    }
    return slot;
  });

  return { ...board, slots: newSlots };
}

// ── Summary Card Generation ─────────────────────────────────────

/** Activity description for a summary card. */
function activityDescription(activity: SceneActivity): string {
  switch (activity) {
    case SceneActivity.EmergencyResponse: return "emergency response operations";
    case SceneActivity.Fleeing: return "evacuating the area";
    case SceneActivity.Hiding: return "taking shelter";
    case SceneActivity.Sabotage: return "sabotage activity";
    case SceneActivity.MedicalTreatment: return "treating injuries";
    case SceneActivity.RoutineWork: return "routine station operations";
    case SceneActivity.Investigation: return "investigating the situation";
    case SceneActivity.EquipmentRepair: return "emergency equipment repair";
    case SceneActivity.DataAccess: return "accessing station data systems";
    case SceneActivity.Confrontation: return "confrontation with crew";
    case SceneActivity.Communication: return "sending/receiving communications";
    case SceneActivity.Barricading: return "barricading the area";
    default: return "unknown activity";
  }
}

/**
 * Generate a Summary Card proposal from processed scene data.
 * Returns null if no card can be generated for this phase.
 */
export function generateProposal(
  phase: TimelinePhase,
  timeline: IncidentTimeline,
  processedScenes: RoomScene[],
  crew: CrewMember[],
): SummaryCard | null {
  // Find the ground truth for this phase
  const event = timeline.events.find((e) => e.phase === phase);
  if (!event) return null;

  // Find scenes from the phase's location
  const phaseRoom = timeline.phaseRooms[phase];
  const relevantScene = processedScenes.find(
    (s) => s.roomName === phaseRoom && s.processed,
  );

  // We need at least some evidence to propose
  if (!relevantScene && processedScenes.length === 0) return null;

  const actor = crew.find((c) => c.id === event.actorId);
  const actorName = actor
    ? `${actor.firstName} ${actor.lastName}`
    : "Unknown crew member";

  // Build the proposal from the event ground truth
  const activity = relevantScene?.groundTruth.what ?? SceneActivity.RoutineWork;

  return {
    phase,
    event: event.action.substring(0, 80) + (event.action.length > 80 ? "..." : ""),
    keyActor: actorName,
    action: activityDescription(activity),
    location: event.location,
    correct: true, // the system-generated proposals based on ground truth are correct
  };
}

/**
 * Generate a plausible but WRONG proposal (red herring).
 * Used to test the player's understanding.
 */
export function generateRedHerring(
  phase: TimelinePhase,
  timeline: IncidentTimeline,
  crew: CrewMember[],
): SummaryCard | null {
  const event = timeline.events.find((e) => e.phase === phase);
  if (!event) return null;

  // Pick a different crew member as the key actor
  const wrongActors = crew.filter((c) => c.id !== event.actorId);
  if (wrongActors.length === 0) return null;

  const wrongActor = wrongActors[Math.floor(Math.random() * wrongActors.length)];

  // Pick a different location
  const wrongPhase = phase === TimelinePhase.NormalOps
    ? TimelinePhase.Collapse
    : TimelinePhase.NormalOps;
  const wrongLocation = timeline.phaseRooms[wrongPhase] ?? "Unknown Section";

  return {
    phase,
    event: `Misleading interpretation of ${phase.replace(/_/g, " ")} phase events`,
    keyActor: `${wrongActor.firstName} ${wrongActor.lastName}`,
    action: activityDescription(SceneActivity.RoutineWork),
    location: wrongLocation,
    correct: false,
  };
}

// ── Player Actions ──────────────────────────────────────────────

export interface ConfirmResult {
  correct: boolean;
  turnPenalty: number;
  revelationText?: string;
}

const WRONG_CONFIRMATION_PENALTY = 5;

/**
 * Player confirms a proposed Summary Card for a timeline slot.
 */
export function confirmCard(
  board: IncidentBoard,
  phase: TimelinePhase,
  card: SummaryCard,
): { board: IncidentBoard; result: ConfirmResult } {
  const slotIdx = board.slots.findIndex((s) => s.phase === phase);
  if (slotIdx === -1) {
    return {
      board,
      result: { correct: false, turnPenalty: 0 },
    };
  }

  const slot = board.slots[slotIdx];
  if (slot.status !== "unlocked" && slot.status !== "proposed") {
    return {
      board,
      result: { correct: false, turnPenalty: 0 },
    };
  }

  if (card.correct) {
    // Correct placement
    const newSlots = [...board.slots];
    newSlots[slotIdx] = {
      ...slot,
      status: "confirmed",
      confirmedCard: card,
    };
    return {
      board: { ...board, slots: newSlots },
      result: {
        correct: true,
        turnPenalty: 0,
        revelationText: `Timeline ${phase.replace(/_/g, " ")} confirmed — ${card.event}`,
      },
    };
  } else {
    // Wrong confirmation — penalty
    const newSlots = [...board.slots];
    newSlots[slotIdx] = {
      ...slot,
      status: "unlocked", // revert to unlocked for retry
      proposedCard: undefined,
    };
    return {
      board: {
        ...board,
        slots: newSlots,
        wrongConfirmations: board.wrongConfirmations + 1,
        totalTurnPenalty: board.totalTurnPenalty + WRONG_CONFIRMATION_PENALTY,
      },
      result: {
        correct: false,
        turnPenalty: WRONG_CONFIRMATION_PENALTY,
      },
    };
  }
}

/**
 * Player rejects a proposed Summary Card.
 */
export function rejectCard(
  board: IncidentBoard,
  phase: TimelinePhase,
): IncidentBoard {
  const slotIdx = board.slots.findIndex((s) => s.phase === phase);
  if (slotIdx === -1) return board;

  const newSlots = [...board.slots];
  newSlots[slotIdx] = {
    ...newSlots[slotIdx],
    status: "unlocked",
    proposedCard: undefined,
  };

  return { ...board, slots: newSlots };
}

// ── Board Queries ───────────────────────────────────────────────

/** Check if all timeline slots are confirmed. */
export function isBoardComplete(board: IncidentBoard): boolean {
  return board.slots.every((s) => s.status === "confirmed");
}

/** Get the number of confirmed slots. */
export function getConfirmedCount(board: IncidentBoard): number {
  return board.slots.filter((s) => s.status === "confirmed").length;
}

/** Get the next unlocked slot that needs a proposal. */
export function getNextUnlockedSlot(board: IncidentBoard): TimelineSlot | undefined {
  return board.slots.find((s) => s.status === "unlocked");
}

/**
 * Build the narrative state from game data for slot unlocking.
 */
export function buildNarrativeState(
  roomScenes: RoomScene[],
  dossiers: CrewDossier[],
  contradictionsFound: number,
  crackMomentFired: boolean = false,
): NarrativeState {
  return {
    roomsProcessed: roomScenes.filter((s) => s.processed).length,
    crewIdentified: getIdentifiedCrewCount(dossiers),
    contradictionsFound,
    slotsConfirmed: 0, // will be set by caller from the board
    crackMomentFired,
  };
}
