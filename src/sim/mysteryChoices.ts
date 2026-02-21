/**
 * Mystery choices that affect the ending.
 * Generated from crew/timeline data and presented during gameplay.
 *
 * Choices are triggered when the player interacts with specific terminals
 * or examines certain crew items. Each choice maps to an ending consequence.
 */
import * as ROT from "rot-js";
import type { CrewMember, IncidentTimeline, MysteryChoice } from "../shared/types.js";
import { IncidentArchetype, CrewRole } from "../shared/types.js";
import { findByRole, findSecretHolder } from "./crewGen.js";
import { CHOICE_BRANCHED_EPILOGUES } from "../data/narrative.js";

/**
 * Generate 3-4 mystery choices for the run.
 * These are presented at key terminals and affect the ending.
 * ROT.RNG must be seeded.
 */
export function generateMysteryChoices(
  crew: CrewMember[],
  timeline: IncidentTimeline,
  roomNames: string[],
): MysteryChoice[] {
  const choices: MysteryChoice[] = [];
  const captain = findByRole(crew, CrewRole.Captain);
  const engineer = findByRole(crew, CrewRole.Engineer);
  const secretHolder = findSecretHolder(crew);

  // Choice 1: Always present — who to believe about the incident cause
  choices.push({
    id: "choice_blame",
    prompt: `Station logs conflict. ${captain ? captain.lastName : "The captain"} says the failure was unforeseeable. ${engineer ? engineer.lastName : "The engineer"} filed three warnings. Your transmission report will include one assessment. Who does the evidence support?`,
    options: [
      { label: `${engineer ? engineer.lastName : "Engineer"} — the warnings were ignored`, key: "engineer_right" },
      { label: `${captain ? captain.lastName : "Captain"} — the situation was unprecedented`, key: "captain_right" },
      { label: "System failure — no one is at fault", key: "system_fault" },
    ],
    turnPresented: -1,
    consequence: "blame",
  });

  // Choice 2: What to do with the classified data
  choices.push({
    id: "choice_data",
    prompt: "The data core contains both the research bundle and classified signal analysis files. UN-ORC protocol says transmit everything. But the classified data might endanger the crew if it reaches the wrong hands.",
    options: [
      { label: "Transmit everything — the truth matters", key: "transmit_all" },
      { label: "Research only — protect the crew", key: "research_only" },
      { label: "Transmit with encryption flag — let command decide", key: "encrypted" },
    ],
    turnPresented: -1,
    consequence: "data_handling",
  });

  // Choice 3: Incident-specific choice
  if (timeline.archetype === IncidentArchetype.Sabotage && secretHolder) {
    choices.push({
      id: "choice_saboteur",
      prompt: `Evidence points to ${secretHolder.lastName} as the saboteur. Security logs, badge access, motive. But the evidence is circumstantial. Include the accusation in the report?`,
      options: [
        { label: "Include — accountability matters", key: "accuse" },
        { label: "Omit — let the investigation team decide", key: "defer" },
        { label: "Flag as suspicious — note without accusing", key: "flag" },
      ],
      turnPresented: -1,
      consequence: "accusation",
    });
  } else if (timeline.archetype === IncidentArchetype.SignalAnomaly) {
    choices.push({
      id: "choice_signal",
      prompt: "The anomalous signal is still transmitting. Your bot can attempt to record it for analysis, or jam it to protect station systems. Recording risks further interference.",
      options: [
        { label: "Record it — this could be first contact", key: "record" },
        { label: "Jam it — crew safety first", key: "jam" },
        { label: "Log coordinates only — let the next team decide", key: "log_coords" },
      ],
      turnPresented: -1,
      consequence: "signal_response",
    });
  } else {
    // Generic choice about crew rescue priority
    const rooms2 = roomNames.length > 2 ? roomNames : ["Section A", "Section B", "Section C"];
    const r1 = rooms2[Math.floor(ROT.RNG.getUniform() * rooms2.length)];
    choices.push({
      id: "choice_priority",
      prompt: `Station sensors show life signs in two locations. Cargo hold has the main crew group. ${r1} shows a single weak signal — possibly someone left behind. You can only guide rescue to one location first.`,
      options: [
        { label: "Cargo hold — save the most people", key: "majority" },
        { label: `${r1} — no one left behind`, key: "individual" },
        { label: "Transmit both coordinates simultaneously", key: "both" },
      ],
      turnPresented: -1,
      consequence: "rescue_priority",
    });
  }

  return choices;
}

/**
 * Compute ending variations based on choices made.
 * Returns an array of ending text lines influenced by the player's decisions.
 */
export function computeChoiceEndings(choices: MysteryChoice[]): string[] {
  const lines: string[] = [];

  for (const choice of choices) {
    if (!choice.chosen) continue;

    switch (choice.consequence) {
      case "blame":
        if (choice.chosen === "engineer_right") {
          lines.push("Your report names the ignored maintenance requests. Someone will have to answer for the delays.");
        } else if (choice.chosen === "captain_right") {
          lines.push("Your report cites unprecedented circumstances. The command structure is preserved — but so are its flaws.");
        } else {
          lines.push("Your report blames no one. The system failed. Systems can be fixed. People are harder.");
        }
        break;

      case "data_handling":
        if (choice.chosen === "transmit_all") {
          lines.push("The full data streams through — research and classified alike. The truth is out there now, for better or worse.");
        } else if (choice.chosen === "research_only") {
          lines.push("The research bundle transmits clean. The classified files stay locked in the core. Some secrets keep their keepers safe.");
        } else {
          lines.push("The data transmits with an encryption flag. Command will decide what to release. You've passed the burden upward.");
        }
        break;

      case "accusation":
        if (choice.chosen === "accuse") {
          lines.push("The name is in the report. When the recovery team arrives, they'll come with questions and handcuffs.");
        } else if (choice.chosen === "defer") {
          lines.push("You leave the accusation out. Justice can wait for better evidence. Or maybe it already has what it needs.");
        } else {
          lines.push("A flag in the report — suspicious but unconfirmed. The investigation team will know where to look.");
        }
        break;

      case "signal_response":
        if (choice.chosen === "record") {
          lines.push("The signal recording joins the research bundle. If it's what the scientists think it is, everything changes.");
        } else if (choice.chosen === "jam") {
          lines.push("Static replaces the signal. The station systems stabilize. Whatever was out there, it's been silenced — for now.");
        } else {
          lines.push("Coordinates logged. Someone else will have to decide whether to listen. You've marked the spot on the map.");
        }
        break;

      case "rescue_priority":
        if (choice.chosen === "majority") {
          lines.push("Rescue coordinates target the cargo hold. The crew sees the beam lock on. Help is coming.");
        } else if (choice.chosen === "individual") {
          lines.push("The rescue beam targets the lone signal. Someone was waiting. Someone who almost wasn't found.");
        } else {
          lines.push("Both coordinates transmit. It splits the rescue response but leaves no one behind. The right call, if they get there in time.");
        }
        break;
    }
  }

  return lines;
}

/**
 * Compute archetype-specific choice epilogue lines.
 * Falls back to generic computeChoiceEndings if no branched text exists.
 */
export function computeBranchedEpilogue(
  choices: MysteryChoice[],
  archetype: IncidentArchetype,
): string[] {
  const pool = CHOICE_BRANCHED_EPILOGUES[archetype];
  if (!pool) return computeChoiceEndings(choices);

  const lines: string[] = [];
  for (const choice of choices) {
    if (!choice.chosen) continue;
    const consequencePool = pool[choice.consequence];
    if (consequencePool && consequencePool[choice.chosen]) {
      lines.push(consequencePool[choice.chosen]);
    }
  }
  // Fall back to generic if branched pool produced nothing
  return lines.length > 0 ? lines : computeChoiceEndings(choices);
}
