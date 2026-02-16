/**
 * End-game screen text for SSR.
 *
 * Displayed after the game concludes — either by successful data core
 * transmission (victory) or bot destruction / relay trip (defeat).
 */

// ── Victory ─────────────────────────────────────────────────

export const VICTORY_TITLE = "TRANSMISSION COMPLETE";

export const VICTORY_TEXT: string[] = [
  `The data core hums to life. Nine months of classified signal analysis`,
  `— Tanaka's careful work, every long shift in isolation — streams`,
  `through the low-band uplink. Slow, but steady. Somewhere far away,`,
  `a receiving dish locks on. The research bundle is preserved.`,
  ``,
  `She was right about the coolant loop. She was right about P03, about`,
  `the cascade, about all of it. Vasquez filed three maintenance requests`,
  `and wrote a backup procedure nobody asked for. A janitor bot and a`,
  `fragile terminal link — that's all it took to prove her right.`,
  ``,
  `In the cargo hold, twelve people feel the lights come back on.`,
  `Recovery teams are already en route. The crew of CORVUS-7 will`,
  `see home again. Their work survives. Hers most of all.`,
];

// ── Tiered victory epilogues based on discovery count ────────

export const VICTORY_EPILOGUE_MINIMAL: string[] = [
  ``,
  `The data is transmitted. The mission is complete.`,
  `But the station holds more questions than answers. The crew's`,
  `personal stories — their warnings, their regrets, their small`,
  `moments of humanity — remain undiscovered in the dark.`,
];

export const VICTORY_EPILOGUE_PARTIAL: string[] = [
  ``,
  `Some of the truth made it through with the data. Vasquez's warnings.`,
  `Chen's quiet observations. Fragments of the story that explain how`,
  `a routine mission became a crisis — and how twelve people survived it.`,
  `But pieces are still missing. The full picture remains just out of reach.`,
];

export const VICTORY_EPILOGUE_COMPLETE: string[] = [
  ``,
  `Every log recovered. Every personal item examined. The full record`,
  `accompanies the research data — not just what the crew accomplished,`,
  `but who they were. Vasquez's stubbornness. Tanaka's hope. Chen's`,
  `quiet competence. Okafor's too-late regret. Priya's foresight.`,
  ``,
  `When the recovery team arrives, they'll find more than a rescued crew.`,
  `They'll find the whole truth: the ignored warnings, the midnight`,
  `access logs, the classified signals nobody was supposed to ask about.`,
  `Some stories survive because someone was too stubborn to let them die.`,
];

// ── Discovery-count-based ending text (Item 9 Sprint 2) ─────
export const ENDING_BY_DISCOVERY: { min: number; text: string }[] = [
  { min: 13, text: "The data transmits. You found everything — the classified directive, the deferred maintenance, the override. Someone will have to answer for this." },
  { min: 9, text: "The data transmits. You found Okafor's note. The badge. Vasquez's tools. Enough to reconstruct what went wrong." },
  { min: 4, text: "The data transmits. Vasquez tried to warn them. The rest is fragments." },
  { min: 0, text: "The data transmits. You don't know what happened here. Maybe nobody will." },
];

// ── Victory text referencing specific discoveries (Item 10 Sprint 2) ──
export interface SpecificDiscovery {
  entityId: string;
  text: string;
}

export const SPECIFIC_DISCOVERIES: SpecificDiscovery[] = [
  { entityId: "crew_item_okafor_badge", text: "Okafor's badge — the star on the back. Someone who cared." },
  { entityId: "crew_item_vasquez_toolkit", text: "Vasquez's tools, teeth marks on the handle. Long shifts alone." },
];

// Log-based discovery: the classified directive
export const CLASSIFIED_DIRECTIVE_LOG_FRAGMENT = "signal analysis directive";
export const CLASSIFIED_DIRECTIVE_TEXT = "The signal analysis directive. What were they really looking for?";

// ── Defeat: Bot Destroyed ───────────────────────────────────

export const DEFEAT_TITLE = "LINK LOST";

export const DEFEAT_TEXT: string[] = [
  `The terminal feed dissolves into static. Rover A3's last telemetry`,
  `shows critical heat damage across the main board — then nothing.`,
  `The link is gone.`,
  ``,
  `In the cargo hold, twelve people hear the silence change. Chen`,
  `reaches for her mug. Tanaka stares at the bulkhead. Vasquez`,
  `closes her eyes and starts writing the procedure again, from`,
  `memory, on the back of a ration wrapper. Just in case.`,
  ``,
  `The low-band beacon pulses on, steady and patient, broadcasting`,
  `into empty space. Someone, somewhere, might still be listening.`,
];

// ── Defeat: Relay Tripped ───────────────────────────────────

export const DEFEAT_RELAY_TITLE = "RELAY TRIPPED";

export const DEFEAT_RELAY_TEXT: string[] = [
  `A dull thud echoes through the station as Relay P03 trips for good.`,
  `The sound Vasquez spent weeks warning them about — the one Okafor`,
  `swore would never come. Lights dim in sequence down the corridor.`,
  `Panels go dark. The Data Core wing drops off the grid entirely.`,
  ``,
  `Nine months of classified signal analysis, locked behind a door`,
  `that will never open again. Tanaka's work. The whole crew's work.`,
  `Gone the way Vasquez said it would go, for exactly the reason`,
  `she said it would happen.`,
  ``,
  `In the cargo hold, someone hears that thud and knows. The station`,
  `drifts on. The beacon keeps pulsing. Vasquez's procedure is still`,
  `there, on a terminal no one can reach, waiting for another chance.`,
];
