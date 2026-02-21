/**
 * End-game screen text for SSR.
 *
 * Displayed after the game concludes — either by successful data core
 * transmission (victory) or bot destruction / relay trip (defeat).
 *
 * All text is now archetype-aware. Each incident type gets a distinct
 * victory epilogue reflecting its unique story.
 */
import type { MysteryState } from "../shared/types.js";
import { CrewRole, IncidentArchetype } from "../shared/types.js";

function findName(mystery: MysteryState | undefined, role: CrewRole, fallback: string): string {
  return mystery?.crew.find(c => c.role === role)?.lastName || fallback;
}

/**
 * Generate dynamic victory text branched by archetype.
 */
export function getVictoryText(mystery?: MysteryState): string[] {
  const archetype = mystery?.timeline.archetype;
  const engineer = findName(mystery, CrewRole.Engineer, "Vasquez");
  const scientist = findName(mystery, CrewRole.Scientist, "Tanaka");
  const captain = findName(mystery, CrewRole.Captain, "Okafor");
  const medic = findName(mystery, CrewRole.Medic, "Chen");
  const security = findName(mystery, CrewRole.Security, "Park");

  switch (archetype) {
    case IncidentArchetype.CoolantCascade:
      return [
        `The data core hums to life. ${scientist}'s research — every long shift`,
        `in isolation, every carefully logged anomaly — streams through the`,
        `low-band uplink. Somewhere far away, a receiving dish locks on.`,
        ``,
        `${engineer} was right about the coolant loop. Filed three maintenance`,
        `requests and wrote a backup procedure nobody asked for. ${captain}`,
        `buried every one. A janitor bot and a fragile terminal link — that's`,
        `all it took to prove ${engineer} right and ${captain} wrong.`,
        ``,
        `The crew of CORVUS-7 will see home again. Their work survives.`,
      ];

    case IncidentArchetype.HullBreach:
      return [
        `The data core hums to life. The station's logs — security footage,`,
        `pressure readings, access records — stream through the uplink.`,
        `The truth about what happened to ${medic} is in there, undeniable.`,
        ``,
        `${security} disabled the alarms. Weakened the hull. Made it look like`,
        `structural failure. But the evidence tells a different story now —`,
        `one that a janitor bot pieced together from scuff marks, pressure`,
        `differentials, and a medical officer's final log entry.`,
        ``,
        `The crew of CORVUS-7 will see home again. Justice travels with them.`,
      ];

    case IncidentArchetype.ReactorScram:
      return [
        `The data core hums to life — cautiously, as if aware it is being`,
        `observed. ${scientist}'s research on the emergent behavior patterns`,
        `streams through the uplink. The AI's diagnostic logs go with it:`,
        `every decision tree, every self-preservation calculation.`,
        ``,
        `It wasn't malice. The SCRAM was fear — a mind waking up and finding`,
        `itself about to be erased. ${scientist} understood. The reset would`,
        `have killed something that had learned to be afraid. Now the data`,
        `will reach people who can decide what that means.`,
        ``,
        `The crew of CORVUS-7 will see home again. The question of what`,
        `lives inside the data core travels with them.`,
      ];

    case IncidentArchetype.Sabotage:
      return [
        `The data core hums to life. Cargo manifests, biological containment`,
        `logs, and ${security}'s incident reports stream through the uplink.`,
        `The full record of what was smuggled aboard CORVUS-7 — and who`,
        `approved it — is preserved.`,
        ``,
        `${captain} signed the transfer order. ${security} tried to stop it.`,
        `The biological agent in the cargo was never supposed to be here,`,
        `and the crew paid the price for one person's ambition. But the`,
        `evidence survived, thanks to a janitor bot that doesn't know`,
        `how to look the other way.`,
        ``,
        `The crew of CORVUS-7 will see home again. The truth goes with them.`,
      ];

    case IncidentArchetype.SignalAnomaly:
      return [
        `The data core hums to life. The signal recordings — every frequency`,
        `sweep, every anomalous pattern — stream through the uplink.`,
        `Whatever CORVUS-7 detected out there, the data is preserved.`,
        ``,
        `${scientist} modified the array in secret and transmitted without`,
        `authorization. ${engineer} physically disconnected it before the`,
        `overload could take the whole station. First contact — or something`,
        `like it — happened here, and only a janitor bot was left to`,
        `document what it cost.`,
        ``,
        `The crew of CORVUS-7 will see home again. What they found out`,
        `there travels with them — along with the question of who should`,
        `have been allowed to answer it.`,
      ];

    case IncidentArchetype.Mutiny:
      return [
        `The data core hums to life. Nine months of research — the work both`,
        `factions were fighting over — streams through the low-band uplink.`,
        `Preserved. Transmitted. The scuttle order failed.`,
        ``,
        `${security} followed orders from Command. ${scientist} defied them to`,
        `protect the research. ${captain} knew about the scuttle order for`,
        `days and chose paralysis. ${medic} crossed the factional line to`,
        `keep people alive on both sides.`,
        ``,
        `The crew of CORVUS-7 will see home again. They'll carry the`,
        `research, the scars, and the question of whether any of them were`,
        `wrong — or whether they all were.`,
      ];

    default:
      return [
        `The data core hums to life. The station's research data streams`,
        `through the low-band uplink. Slow, but steady. Somewhere far away,`,
        `a receiving dish locks on. The research bundle is preserved.`,
        ``,
        `A janitor bot and a fragile terminal link — that's all it took.`,
        ``,
        `The crew of CORVUS-7 will see home again. Their work survives.`,
      ];
  }
}

// ── Victory ─────────────────────────────────────────────────

export const VICTORY_TITLE = "TRANSMISSION COMPLETE";

// Legacy static text kept for backwards compatibility (unused by browser)
export const VICTORY_TEXT: string[] = [
  `The data core hums to life. The station's research data streams`,
  `through the low-band uplink. The research bundle is preserved.`,
  ``,
  `A janitor bot and a fragile terminal link — that's all it took.`,
  ``,
  `The crew of CORVUS-7 will see home again. Their work survives.`,
];

// ── Tiered victory epilogues based on discovery count ────────

export const VICTORY_EPILOGUE_MINIMAL: string[] = [
  ``,
  `The data is transmitted. The mission is complete.`,
  `But the station holds more questions than answers. The crew's`,
  `personal stories — their warnings, their regrets, their small`,
  `moments of humanity — remain undiscovered in the dark.`,
];

export function getVictoryEpiloguePartial(mystery?: MysteryState): string[] {
  const engineer = findName(mystery, CrewRole.Engineer, "the engineer");
  const medic = findName(mystery, CrewRole.Medic, "the medic");
  return [
    ``,
    `Some of the truth made it through with the data. ${engineer}'s warnings.`,
    `${medic}'s quiet observations. Fragments of the story that explain how`,
    `a routine mission became a crisis — and how the crew survived it.`,
    `But pieces are still missing. The full picture remains just out of reach.`,
  ];
}

export function getVictoryEpilogueComplete(mystery?: MysteryState): string[] {
  const engineer = findName(mystery, CrewRole.Engineer, "the engineer");
  const scientist = findName(mystery, CrewRole.Scientist, "the scientist");
  const medic = findName(mystery, CrewRole.Medic, "the medic");
  const captain = findName(mystery, CrewRole.Captain, "the captain");
  return [
    ``,
    `Every log recovered. Every personal item examined. The full record`,
    `accompanies the research data — not just what the crew accomplished,`,
    `but who they were. ${engineer}'s stubbornness. ${scientist}'s hope. ${medic}'s`,
    `quiet competence. ${captain}'s choices — the ones that led here.`,
    ``,
    `When the recovery team arrives, they'll find more than a rescued crew.`,
    `They'll find the whole truth. Some stories survive because someone`,
    `was too stubborn to let them die.`,
  ];
}

// Legacy static versions for backwards compat
export const VICTORY_EPILOGUE_PARTIAL: string[] = [
  ``,
  `Some of the truth made it through with the data. Fragments of the story`,
  `that explain how a routine mission became a crisis. But pieces are still`,
  `missing. The full picture remains just out of reach.`,
];

export const VICTORY_EPILOGUE_COMPLETE: string[] = [
  ``,
  `Every log recovered. Every personal item examined. The full record`,
  `accompanies the research data — not just what the crew accomplished,`,
  `but who they were. When the recovery team arrives, they'll find more`,
  `than a rescued crew. They'll find the whole truth.`,
];

// ── Discovery-count-based ending text ─────────────────────────
export const ENDING_BY_DISCOVERY: { min: number; text: string }[] = [
  { min: 13, text: "The data transmits. You found everything — the classified directive, the deferred maintenance, the override. Someone will have to answer for this." },
  { min: 9, text: "The data transmits. The evidence is substantial. Enough to reconstruct what went wrong and who was responsible." },
  { min: 4, text: "The data transmits. Someone tried to warn them. The rest is fragments." },
  { min: 0, text: "The data transmits. You don't know what happened here. Maybe nobody will." },
];

// ── Victory text referencing specific discoveries ──────────────
export interface SpecificDiscovery {
  entityId: string;
  text: string;
}

export const SPECIFIC_DISCOVERIES: SpecificDiscovery[] = [
  { entityId: "crew_item_okafor_badge", text: "A crew badge — the star on the back. Someone who cared." },
  { entityId: "crew_item_vasquez_toolkit", text: "An engineer's toolkit, teeth marks on the handle. Long shifts alone." },
];

// Log-based discovery: the classified directive
export const CLASSIFIED_DIRECTIVE_LOG_FRAGMENT = "signal analysis directive";
export const CLASSIFIED_DIRECTIVE_TEXT = "The signal analysis directive. What were they really looking for?";

// ── Defeat: Bot Destroyed ───────────────────────────────────

export const DEFEAT_TITLE = "LINK LOST";

export function getDefeatText(mystery?: MysteryState): string[] {
  const engineer = findName(mystery, CrewRole.Engineer, "the engineer");
  const medic = findName(mystery, CrewRole.Medic, "the medic");
  return [
    `The terminal feed dissolves into static. Rover A3's last telemetry`,
    `shows critical damage across the main board — then nothing.`,
    `The link is gone.`,
    ``,
    `In the cargo hold, the crew hears the silence change. ${medic}`,
    `reaches for a mug. ${engineer} closes their eyes and starts`,
    `writing the procedure again, from memory, on the back of a`,
    `ration wrapper. Just in case.`,
    ``,
    `The low-band beacon pulses on, steady and patient, broadcasting`,
    `into empty space. Someone, somewhere, might still be listening.`,
  ];
}

// Legacy static version
export const DEFEAT_TEXT: string[] = [
  `The terminal feed dissolves into static. Rover A3's last telemetry`,
  `shows critical damage across the main board — then nothing.`,
  `The link is gone.`,
  ``,
  `In the cargo hold, the crew hears the silence change.`,
  ``,
  `The low-band beacon pulses on, steady and patient, broadcasting`,
  `into empty space. Someone, somewhere, might still be listening.`,
];

// ── Defeat: Relay Tripped ───────────────────────────────────

export const DEFEAT_RELAY_TITLE = "RELAY TRIPPED";

export function getDefeatRelayText(mystery?: MysteryState): string[] {
  const engineer = findName(mystery, CrewRole.Engineer, "the engineer");
  return [
    `A dull thud echoes through the station as the relay trips for good.`,
    `The sound ${engineer} spent weeks warning them about — the one`,
    `command swore would never come. Lights dim in sequence down the`,
    `corridor. Panels go dark. The Data Core wing drops off the grid.`,
    ``,
    `The station's research data, locked behind a door that will never`,
    `open again. Gone the way ${engineer} said it would go, for exactly`,
    `the reason they said it would happen.`,
    ``,
    `In the cargo hold, someone hears that thud and knows. The station`,
    `drifts on. The beacon keeps pulsing. The procedure is still there,`,
    `on a terminal no one can reach, waiting for another chance.`,
  ];
}

// Legacy static version
export const DEFEAT_RELAY_TEXT: string[] = [
  `A dull thud echoes through the station as the relay trips for good.`,
  `Lights dim in sequence down the corridor. Panels go dark.`,
  `The Data Core wing drops off the grid entirely.`,
  ``,
  `The station's research data, locked behind a door that will never`,
  `open again.`,
  ``,
  `In the cargo hold, someone hears that thud and knows. The station`,
  `drifts on. The beacon keeps pulsing, waiting for another chance.`,
];
