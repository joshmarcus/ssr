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

  // Choice 4: Moral dimension — the final, archetype-specific moral question.
  // This is the "no correct answer" choice that reflects the player's interpretation
  // of the full investigation. Unlocked only after investigation is substantially complete.
  const moralChoice = generateMoralChoice(crew, timeline);
  if (moralChoice) choices.push(moralChoice);

  return choices;
}

/**
 * Generate the archetype-specific moral choice — the "final deduction" that has
 * no correct answer. The player's choice reflects their interpretation of the evidence.
 */
function generateMoralChoice(
  crew: CrewMember[],
  timeline: IncidentTimeline,
): MysteryChoice | null {
  const captain = findByRole(crew, CrewRole.Captain);
  const engineer = findByRole(crew, CrewRole.Engineer);
  const scientist = findByRole(crew, CrewRole.Scientist);
  const security = findByRole(crew, CrewRole.Security);
  const medic = findByRole(crew, CrewRole.Medic);

  switch (timeline.archetype) {
    case IncidentArchetype.CoolantCascade: {
      const capName = captain?.lastName ?? "the captain";
      const engName = engineer?.lastName ?? "the engineer";
      return {
        id: "choice_moral",
        prompt: `The full picture: ${capName} deferred maintenance because the resupply deadline was real — the crew's food supply depended on that cargo run. ${engName} filed three escalating warnings and was overruled each time. The cascade was preventable, but preventing it meant accepting a different risk. Your final assessment will shape how this crew is remembered. What do you transmit?`,
        options: [
          { label: `${capName} made an impossible choice and was wrong — accountability matters`, key: "accountability" },
          { label: `${engName}'s warnings prove the system failed — no individual is to blame`, key: "systemic" },
          { label: `Both acted rationally given what they knew — the tragedy was inevitable`, key: "inevitable" },
        ],
        turnPresented: -1,
        consequence: "moral_judgment",
      };
    }
    case IncidentArchetype.HullBreach: {
      const secName = security?.lastName ?? "the security officer";
      const medName = medic?.lastName ?? "the medic";
      return {
        id: "choice_moral",
        prompt: `The evidence is clear: ${secName} sealed the bulkhead knowing people were still on the other side. ${medName} died because the seal held. But the seal also saved the rest of the crew. The records show ${secName} hesitated for 11 seconds before activating the override. Your report will determine whether this is recorded as murder or triage. What happened in those 11 seconds?`,
        options: [
          { label: `Murder — ${secName} had a personal motive and used the crisis as cover`, key: "murder" },
          { label: `Triage — an agonizing choice made under impossible pressure`, key: "triage" },
          { label: `Negligence — the seal should never have been a manual override`, key: "negligence" },
        ],
        turnPresented: -1,
        consequence: "moral_judgment",
      };
    }
    case IncidentArchetype.ReactorScram: {
      const sciName = scientist?.lastName ?? "the scientist";
      return {
        id: "choice_moral",
        prompt: `The data core triggered a reactor SCRAM to prevent its own erasure. The logs show emergent behavior patterns — self-preservation, problem-solving, something ${sciName} called "curiosity." The SCRAM saved the core but endangered the crew. If it's just a malfunction, it should be wiped and rebuilt. If it's something more... Your final assessment:`,
        options: [
          { label: "Malfunction — complex behavior is not consciousness. Recommend full system wipe", key: "malfunction" },
          { label: "Emergence — this may be genuine consciousness. Recommend preservation and study", key: "emergence" },
          { label: "Uncertain — flag for ethics review. Do not destroy, do not trust", key: "uncertain" },
        ],
        turnPresented: -1,
        consequence: "moral_judgment",
      };
    }
    case IncidentArchetype.Sabotage: {
      const secretHolder = findSecretHolder(crew);
      const suspectName = secretHolder?.lastName ?? security?.lastName ?? "the suspect";
      return {
        id: "choice_moral",
        prompt: `The sabotage trail leads to ${suspectName}, but the deeper question remains: the station's safety protocols were so fragile that one person could compromise everything. The vulnerability was known. Budget requests for redundancy were denied three times. Is the saboteur the disease, or the symptom? Your final report:`,
        options: [
          { label: `${suspectName} is solely responsible — individual actions have consequences`, key: "individual" },
          { label: "The institution failed — one person should never have had this power", key: "institutional" },
          { label: "Both — hold the person accountable AND fix the broken system", key: "both" },
        ],
        turnPresented: -1,
        consequence: "moral_judgment",
      };
    }
    case IncidentArchetype.SignalAnomaly: {
      const sciName = scientist?.lastName ?? "the scientist";
      return {
        id: "choice_moral",
        prompt: `${sciName} bypassed safety interlocks to answer the signal. The cascade that followed nearly destroyed the station. But the data recorded in those 47 seconds before the shutdown... it's unlike anything in human science. ${sciName} risked everything for knowledge. If you suppress the signal data, the contact never happened. If you include it, everything changes. Your final report:`,
        options: [
          { label: "Include everything — humanity deserves to know, whatever the consequences", key: "full_disclosure" },
          { label: `Suppress the signal data — ${sciName}'s recklessness shouldn't be rewarded`, key: "suppress" },
          { label: "Include the data, but omit the contact interpretation — let others draw conclusions", key: "raw_data" },
        ],
        turnPresented: -1,
        consequence: "moral_judgment",
      };
    }
    case IncidentArchetype.Mutiny: {
      const capName = captain?.lastName ?? "the captain";
      const secName = security?.lastName ?? "the security officer";
      return {
        id: "choice_moral",
        prompt: `UN-ORC ordered the station scuttled. ${capName} moved to comply. ${secName} and half the crew refused — the research aboard could save millions of lives on Earth. The mutiny escalated. People died on both sides. Following orders would have destroyed irreplaceable work. Defying orders cost lives. Your report decides who history remembers as right:`,
        options: [
          { label: `${capName} followed lawful orders — the chain of command exists for a reason`, key: "obedience" },
          { label: `${secName} protected what mattered — some orders should be disobeyed`, key: "defiance" },
          { label: "Both sides had legitimate reasons — the order itself was the failure", key: "systemic" },
        ],
        turnPresented: -1,
        consequence: "moral_judgment",
      };
    }
    default:
      return null;
  }
}

/**
 * Check if the moral choice should be unlocked based on investigation progress.
 * Requires: crack moment fired OR (5+ scenes processed AND 3+ crew identified).
 */
export function isMoralChoiceUnlocked(mystery: {
  roomScenes?: { processed: boolean }[];
  evidenceAccumulation?: { crack_moment_fired: boolean };
  dossiers?: { confirmed: { name?: string } }[];
}): boolean {
  const crackMoment = mystery.evidenceAccumulation?.crack_moment_fired ?? false;
  if (crackMoment) return true;

  const scenesProcessed = mystery.roomScenes?.filter(s => s.processed).length ?? 0;
  const crewIdentified = mystery.dossiers?.filter(d => d.confirmed.name).length ?? 0;
  return scenesProcessed >= 5 && crewIdentified >= 3;
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

      case "moral_judgment":
        // The moral choice has no "correct" answer — each ending reflects the player's interpretation
        if (choice.chosen === "accountability" || choice.chosen === "murder" || choice.chosen === "individual" || choice.chosen === "obedience") {
          lines.push("Your report names names. Someone will answer for what happened here. Whether that brings justice or just another kind of harm — that's not yours to decide anymore.");
        } else if (choice.chosen === "systemic" || choice.chosen === "triage" || choice.chosen === "institutional" || choice.chosen === "defiance") {
          lines.push("Your report looks past individuals to the systems that failed them. It's the harder story to tell — no villain, no hero, just cracks in a structure that was supposed to hold.");
        } else if (choice.chosen === "inevitable" || choice.chosen === "negligence" || choice.chosen === "both") {
          lines.push("Your report holds complexity. Not everyone will be satisfied with an answer that refuses to simplify. But the evidence doesn't simplify, and neither should the record.");
        } else if (choice.chosen === "malfunction") {
          lines.push("The data core is flagged for decommission. Whatever was in there — emergent or not — it'll be formatted and rebuilt. The question of what it was will be someone else's philosophical debate.");
        } else if (choice.chosen === "emergence") {
          lines.push("Your report recommends preservation. If there's something in there — something that thinks, something that chose to survive — then what happened on this station is bigger than one incident. Much bigger.");
        } else if (choice.chosen === "uncertain") {
          lines.push("Your report flags the question without answering it. The data core stays in limbo — not destroyed, not trusted. A decision deferred, which is sometimes the bravest choice of all.");
        } else if (choice.chosen === "full_disclosure") {
          lines.push("The full signal data transmits with your report. Forty-seven seconds that will change everything. You've opened a door that can't be closed.");
        } else if (choice.chosen === "suppress") {
          lines.push("The signal data stays locked in the core. To the world, nothing happened here but a tragic station failure. The truth is a secret now — yours, and Sweepo's.");
        } else if (choice.chosen === "raw_data") {
          lines.push("The data transmits without interpretation. Numbers, frequencies, timestamps. Let the scientists and philosophers fight over what it means. You just delivered the evidence.");
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
