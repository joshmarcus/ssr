/**
 * Station identity and opening text crawl for SSR.
 */

export const STATION_NAME = "CORVUS-7";
export const STATION_SUBTITLE = "Deep Orbital Research Platform";
export const STATION_DESIGNATION = "UN-ORC Station CORVUS-7 / Registry DP-0184201";

/**
 * Opening text crawl displayed during the Boot / Link Establishment phase.
 * Rendered line-by-line with a terminal typewriter effect.
 */
export const OPENING_CRAWL: string[] = [
  `CORVUS-7 was a deep orbital research platform operated by the United`,
  `Nations Outer Rim Commission, stationed in a stable Lagrange orbit beyond`,
  `the Mars-Jupiter corridor. Its crew of twelve maintained a rotating`,
  `complement of long-duration experiments — materials science, vacuum`,
  `biology, and classified signal analysis work that required absolute`,
  `isolation from terrestrial interference. For nine months, CORVUS-7`,
  `reported nominal status on every scheduled uplink.`,
  ``,
  `Fourteen hours ago, the station missed its first check-in. Repeated`,
  `hails returned nothing but carrier static. Telemetry shows the reactor`,
  `is still online and life support registers partial function, but all`,
  `crew communication channels are dead. The only response to emergency`,
  `ping was a single automated handshake from a maintenance subsystem:`,
  `one janitor-class rover, designation A3, standing by in the arrival`,
  `bay with a full battery and a cleanliness sensor.`,
  ``,
  `You are the remote operator. Your link is low-bandwidth, terminal-only`,
  `— no video, no audio, no telemetry beyond what the bot can sense. The`,
  `station's data core holds the research bundle that CORVUS-7 existed to`,
  `produce. If the core can be powered and the bundle transmitted, the`,
  `mission is not a total loss. But first, you need to understand what`,
  `went silent — and whether anything on board is still a threat.`,
];

/**
 * Condensed opening (3-4 sentences) for compact display contexts
 * such as the boot screen or game-start summary panel.
 */
export const OPENING_SUMMARY =
  `Research station CORVUS-7 missed its scheduled uplink fourteen hours ago. ` +
  `Telemetry shows the reactor is still online, but all crew channels are dead ` +
  `and the data core sits unpowered behind a sealed door. ` +
  `The only response to emergency ping was a single handshake from a janitor-class ` +
  `rover standing by in the arrival bay with a full battery and a cleanliness sensor. ` +
  `You are the remote operator — recover the research bundle before the station's ` +
  `failing systems make it impossible.`;

/**
 * Short tagline for title screen / loading.
 */
export const TAGLINE = "A silent station. A fragile link. One bot.";
