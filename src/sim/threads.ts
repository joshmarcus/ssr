import type { CrewMember, IncidentTimeline, NarrativeThread } from "../shared/types.js";
import { IncidentArchetype, CrewRole } from "../shared/types.js";
import { findByRole } from "./crewGen.js";

export function generateThreads(
  crew: CrewMember[],
  timeline: IncidentTimeline,
): NarrativeThread[] {
  const threads: NarrativeThread[] = [];
  const engineer = findByRole(crew, CrewRole.Engineer);
  const captain = findByRole(crew, CrewRole.Captain);

  // Thread 1: "The Warning Signs" — always present
  threads.push({
    name: "The Warning Signs",
    description: `Early indicators that something was wrong — maintenance logs, sensor anomalies, ignored reports.`,
    entries: [], // populated as journal entries are discovered
  });

  // Thread 2: "The Trigger Event" — always present
  threads.push({
    name: "The Trigger Event",
    description: `What actually set off the chain of events that led to the station's current state.`,
    entries: [],
  });

  // Thread 3: "The Response" — always present
  threads.push({
    name: "The Response",
    description: `How the crew reacted when the alarms went off — who helped, who ran, who froze.`,
    entries: [],
  });

  // Thread 4: Archetype-specific
  switch (timeline.archetype) {
    case IncidentArchetype.Sabotage:
    case IncidentArchetype.SignalAnomaly:
      threads.push({
        name: "The Hidden Agenda",
        description: "Someone aboard had secrets. The evidence doesn't add up to an accident.",
        entries: [],
      });
      break;
    case IncidentArchetype.CoolantCascade:
    case IncidentArchetype.ReactorScram:
      threads.push({
        name: "The Breakdown",
        description: "A trail of deferred maintenance, budget cuts, and system failures that made disaster inevitable.",
        entries: [],
      });
      break;
    case IncidentArchetype.HullBreach:
    case IncidentArchetype.ContainmentBreach:
      threads.push({
        name: "The Breach",
        description: "Physical evidence of the catastrophic failure — structural damage, pressure loss, containment failure.",
        entries: [],
      });
      break;
  }

  return threads;
}

/**
 * Determine which thread a journal entry belongs to based on its tags.
 */
export function assignThread(
  tags: string[],
  threads: NarrativeThread[],
): string | undefined {
  // Priority: timeline tags determine thread assignment
  if (tags.includes("timeline_early") || tags.includes("timeline_warning")) {
    return "The Warning Signs";
  }
  if (tags.includes("timeline_trigger")) {
    return "The Trigger Event";
  }
  if (tags.includes("timeline_response")) {
    return "The Response";
  }
  if (tags.includes("timeline_aftermath")) {
    // Assign to the archetype-specific thread (4th thread)
    return threads.length >= 4 ? threads[3].name : undefined;
  }
  return undefined;
}
