/**
 * Timeline generator for the mystery engine.
 * Given seed + crew + archetype, generates a concrete incident timeline
 * with events, log text, and evidence placement.
 */
import * as ROT from "rot-js";
import type { CrewMember, TimelineEvent, IncidentTimeline } from "../shared/types.js";
import { IncidentArchetype, TimelinePhase, CrewRole, CrewSecret } from "../shared/types.js";
import { getTemplate } from "./incidents.js";
import { findByRole, findSecretHolder } from "./crewGen.js";
import { getTemplatesByCategories, type LogTemplate } from "../data/logTemplates.js";

const PHASES: TimelinePhase[] = [
  TimelinePhase.NormalOps,
  TimelinePhase.Trigger,
  TimelinePhase.Escalation,
  TimelinePhase.Collapse,
  TimelinePhase.Aftermath,
];

const TIMESTAMPS = [
  "06:00", "14:30", "19:45", "22:17", "03:42",
  "08:15", "11:30", "16:00", "20:30", "01:15",
  "07:00", "13:00", "17:45", "21:00", "02:30",
];

const PROCEDURE_HINTS = [
  "Reroute the relays in sequence — P01, P03, P04. The thermal sensor shows which ones are overheating",
  "The service bot in the robotics bay can still help. Activate it before approaching the hot zones",
  "Seal the breaches first, then the pressure normalizes. The atmospheric sensor will guide you",
  "The data core needs all relays online. Check each junction — the thermal overlay reveals the problem",
  "Follow the dirt trails. The crew evacuated toward the cargo hold. Their path leads through the key areas",
];

/**
 * Build a role-to-crew lookup for template filling.
 */
function buildRoleLookup(crew: CrewMember[]): Map<CrewRole, CrewMember> {
  const lookup = new Map<CrewRole, CrewMember>();
  for (const member of crew) {
    if (!lookup.has(member.role)) {
      lookup.set(member.role, member);
    }
  }
  return lookup;
}

/**
 * Fill template variables with concrete crew data.
 */
function fillTemplate(
  template: string,
  roleLookup: Map<CrewRole, CrewMember>,
  rooms: string[],
  extraVars: Record<string, string> = {},
): string {
  let result = template;

  // Role-based replacements
  const roleMap: Record<string, CrewRole> = {
    engineer: CrewRole.Engineer,
    captain: CrewRole.Captain,
    medic: CrewRole.Medic,
    security: CrewRole.Security,
    scientist: CrewRole.Scientist,
    robotics: CrewRole.Robotics,
    life_support: CrewRole.LifeSupport,
    comms: CrewRole.Comms,
  };

  for (const [key, role] of Object.entries(roleMap)) {
    const member = roleLookup.get(role);
    if (member) {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), `${member.firstName} ${member.lastName}`);
      result = result.replace(new RegExp(`\\{${key}_last\\}`, "g"), member.lastName);
      result = result.replace(new RegExp(`\\{${key}_badge\\}`, "g"), member.badgeId);
    } else {
      // Fallback: remove the placeholder
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), "crew member");
      result = result.replace(new RegExp(`\\{${key}_last\\}`, "g"), "unknown");
      result = result.replace(new RegExp(`\\{${key}_badge\\}`, "g"), "UNKNOWN");
    }
  }

  // Room replacements
  if (rooms.length > 0) {
    const r1 = rooms[Math.floor(ROT.RNG.getUniform() * rooms.length)];
    const r2 = rooms[Math.floor(ROT.RNG.getUniform() * rooms.length)];
    result = result.replace(/\{room\}/g, r1);
    result = result.replace(/\{room2\}/g, r2);
  }

  // Time replacement
  const timeIdx = Math.floor(ROT.RNG.getUniform() * TIMESTAMPS.length);
  result = result.replace(/\{time\}/g, TIMESTAMPS[timeIdx]);

  // Number replacements
  const num = Math.floor(ROT.RNG.getUniform() * 200) + 1;
  result = result.replace(/\{num\}/g, String(num));
  const weeks = Math.floor(ROT.RNG.getUniform() * 12) + 1;
  result = result.replace(/\{weeks\}/g, String(weeks));

  // Door replacement
  const doorId = `D-${Math.floor(ROT.RNG.getUniform() * 20) + 1}`;
  result = result.replace(/\{door\}/g, doorId);
  result = result.replace(/\{result\}/g, "GRANTED");

  // Procedure hint
  const hintIdx = Math.floor(ROT.RNG.getUniform() * PROCEDURE_HINTS.length);
  result = result.replace(/\{procedure_hint\}/g, PROCEDURE_HINTS[hintIdx]);

  // Extra variables
  for (const [k, v] of Object.entries(extraVars)) {
    result = result.replace(new RegExp(`\\{${k}\\}`, "g"), v);
  }

  return result;
}

/**
 * Generate an incident timeline from crew, archetype, and rooms.
 * ROT.RNG must already be seeded.
 */
export function generateTimeline(
  crew: CrewMember[],
  archetype: IncidentArchetype,
  roomNames: string[],
): IncidentTimeline {
  const template = getTemplate(archetype);
  const roleLookup = buildRoleLookup(crew);

  // Generate timeline events from beat descriptions
  const events: TimelineEvent[] = [];
  for (let i = 0; i < PHASES.length; i++) {
    const phase = PHASES[i];
    const beatText = template.beats[phase];
    const filledText = fillTemplate(beatText, roleLookup, roomNames);

    // Determine actor — the first central role for this phase
    const centralRole = template.centralRoles[i % template.centralRoles.length];
    const actor = roleLookup.get(centralRole) || crew[0];
    const location = roomNames.length > 0
      ? roomNames[Math.floor(ROT.RNG.getUniform() * roomNames.length)]
      : "Unknown Section";

    events.push({
      phase,
      timestamp: TIMESTAMPS[i] || TIMESTAMPS[0],
      actorId: actor.id,
      action: filledText,
      location,
    });
  }

  // Determine culprit for sabotage archetype
  let culpritId: string | undefined;
  if (archetype === IncidentArchetype.Sabotage) {
    const secretHolder = findSecretHolder(crew);
    if (secretHolder && secretHolder.secret === CrewSecret.Sabotage) {
      culpritId = secretHolder.id;
    } else {
      // Pick a random non-captain with a plausible motive
      const candidates = crew.filter(c => c.role !== CrewRole.Captain);
      if (candidates.length > 0) {
        culpritId = candidates[Math.floor(ROT.RNG.getUniform() * candidates.length)].id;
      }
    }
  }

  return {
    archetype,
    events,
    culpritId,
    primaryHazard: template.primaryHazard,
    sensorBias: template.sensorBias,
  };
}

/**
 * Generate log entries from the timeline + templates.
 * Returns an array of log objects ready to be placed in LogTerminals.
 */
export function generateLogs(
  crew: CrewMember[],
  timeline: IncidentTimeline,
  roomNames: string[],
  count: number,
): { title: string; text: string; source: string }[] {
  const template = getTemplate(timeline.archetype);
  const roleLookup = buildRoleLookup(crew);
  const categoryTemplates = getTemplatesByCategories(template.logCategories);

  if (categoryTemplates.length === 0) {
    return [];
  }

  const logs: { title: string; text: string; source: string }[] = [];

  // First, generate logs from timeline events (1 per phase)
  for (const event of timeline.events) {
    if (logs.length >= count) break;
    const actor = crew.find(c => c.id === event.actorId) || crew[0];
    logs.push({
      title: `${event.phase.replace(/_/g, " ").toUpperCase()} — ${event.timestamp}`,
      text: event.action,
      source: actor.lastName,
    });
  }

  // Then fill remaining from category templates
  let templateIdx = 0;
  while (logs.length < count && categoryTemplates.length > 0) {
    const tmpl = categoryTemplates[templateIdx % categoryTemplates.length];
    const filledText = fillTemplate(tmpl.text, roleLookup, roomNames);
    const filledTitle = fillTemplate(tmpl.title, roleLookup, roomNames);
    const filledSource = fillTemplate(tmpl.source, roleLookup, roomNames);

    logs.push({
      title: filledTitle,
      text: filledText,
      source: filledSource,
    });
    templateIdx++;

    // Safety: don't loop forever if we've exhausted templates
    if (templateIdx >= categoryTemplates.length * 2) break;
  }

  // Replace some logs with foreshadowing entries (manuscript page style) — these reference rooms
  // the player hasn't visited yet, creating anticipation
  const foreshadowTemplates = getTemplatesByCategories(["foreshadowing"]);
  if (foreshadowTemplates.length > 0 && roomNames.length > 2 && logs.length >= 3) {
    const numForeshadow = Math.min(3, Math.floor(roomNames.length / 4));
    for (let fi = 0; fi < numForeshadow && fi < foreshadowTemplates.length; fi++) {
      const tmpl = foreshadowTemplates[fi % foreshadowTemplates.length];
      const filledText = fillTemplate(tmpl.text, roleLookup, roomNames);
      const filledTitle = fillTemplate(tmpl.title, roleLookup, roomNames);
      const filledSource = fillTemplate(tmpl.source, roleLookup, roomNames);
      // Replace a non-timeline log (from the template-filled section) with a foreshadowing one
      const replaceIdx = timeline.events.length + fi; // skip timeline logs, replace template logs
      if (replaceIdx < logs.length) {
        logs[replaceIdx] = { title: filledTitle, text: filledText, source: filledSource };
      }
    }
  }

  return logs;
}

/**
 * Check if a filled string still has unresolved {variable} markers.
 */
export function hasUnresolvedVars(text: string): boolean {
  return /\{[a-z_]+\}/.test(text);
}
