/**
 * Station identity and opening text crawl for SSR.
 */

import { IncidentArchetype } from "../shared/types.js";

export const STATION_NAME = "CORVUS-7";
export const STATION_SUBTITLE = "Deep Orbital Research Platform";
export const STATION_DESIGNATION = "UN-ORC Station CORVUS-7 / Registry DP-0184201";

/**
 * Opening text crawl — trimmed core intro (archetype-agnostic).
 * The per-archetype "last transmission" is appended by getOpeningCrawl().
 */
const OPENING_INTRO: string[] = [
  `CORVUS-7. Deep orbital research platform, Lagrange orbit beyond`,
  `the Mars-Jupiter corridor. Crew of twelve. Nine months of nominal`,
  `uplinks to UN-ORC command.`,
  ``,
  `Fourteen hours ago, the station went silent. Reactor still online,`,
  `life support partial, all crew channels dead. The only response to`,
  `emergency ping: a single automated handshake from a janitor-class`,
  `rover standing by in the arrival bay.`,
];

/**
 * Per-archetype "last transmission" — the final fragmented message
 * intercepted from CORVUS-7 before the station went dark.
 * Each hints at the storyline without spoiling it.
 */
const LAST_TRANSMISSIONS: Record<IncidentArchetype, string[]> = {
  [IncidentArchetype.CoolantCascade]: [
    `LAST TRANSMISSION [14:07:33 UTC]:`,
    `"...thermal cascade in relay section four... I filed three`,
    `requests... three... they reassigned me for it... the junction`,
    `is going to—" [SIGNAL LOST]`,
  ],
  [IncidentArchetype.HullBreach]: [
    `LAST TRANSMISSION [02:41:17 UTC]:`,
    `"...pressure drop in crew quarters... breach point is in the`,
    `residential ring... the alarms were off... someone turned them`,
    `off..." [SIGNAL LOST]`,
  ],
  [IncidentArchetype.ReactorScram]: [
    `LAST TRANSMISSION [09:22:08 UTC]:`,
    `"...SCRAM came from the data core... no one was at the terminal`,
    `...it issued the command itself... I don't think this is a`,
    `malfunction..." [CARRIER LOST]`,
  ],
  [IncidentArchetype.Sabotage]: [
    `LAST TRANSMISSION [03:52:44 UTC]:`,
    `"...junctions failing in sequence... it's moving faster than`,
    `anyone can walk... there's something in the walls... this is`,
    `not a systems fault..." [SIGNAL LOST]`,
  ],
  [IncidentArchetype.SignalAnomaly]: [
    `LAST TRANSMISSION [16:33:21 UTC]:`,
    `"...the array wasn't receiving — it was transmitting... someone`,
    `sent a response... the overload is spreading through every`,
    `connected system—" [EM INTERFERENCE — SIGNAL LOST]`,
  ],
  [IncidentArchetype.ContainmentBreach]: [
    `LAST TRANSMISSION [11:15:56 UTC]:`,
    `"...containment breach in a section that's not on our plans...`,
    `the symptoms don't match anything in the station inventory...`,
    `what were they doing in there..." [SIGNAL LOST]`,
  ],
};

/**
 * Closing lines after the last transmission.
 */
const OPENING_OUTRO: string[] = [
  `You are the remote operator. Terminal-only link — no video, no`,
  `audio. The data core holds the research bundle. Power it, transmit`,
  `it, and find out what happened aboard CORVUS-7.`,
];

/**
 * Build the full opening crawl for a given archetype.
 * Combines intro + last transmission + outro.
 */
export function getOpeningCrawl(archetype: IncidentArchetype): string[] {
  return [
    ...OPENING_INTRO,
    "",
    ...LAST_TRANSMISSIONS[archetype],
    "",
    ...OPENING_OUTRO,
  ];
}

/** Legacy constant for backward compatibility (uses CoolantCascade default). */
export const OPENING_CRAWL: string[] = getOpeningCrawl(IncidentArchetype.CoolantCascade);

/**
 * Condensed opening for compact display contexts.
 */
export const OPENING_SUMMARY =
  `Research station CORVUS-7 went silent fourteen hours ago. ` +
  `Reactor online, life support partial, all crew channels dead. ` +
  `The only response: a handshake from a janitor-class rover in the arrival bay. ` +
  `You are the remote operator — recover the research bundle and find out what happened.`;

/**
 * Short tagline for title screen / loading.
 */
export const TAGLINE = "A silent station. A fragile link. One bot.";
