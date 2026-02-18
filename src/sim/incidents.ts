/**
 * Incident archetypes for the mystery engine.
 * Each archetype defines a story template that gets filled by the timeline generator.
 */
import { IncidentArchetype, TimelinePhase, CrewRole, SensorType } from "../shared/types.js";

export interface IncidentTemplate {
  archetype: IncidentArchetype;
  name: string;
  primaryHazard: string;
  sensorBias: SensorType;
  storyHook: string;
  /** Crew roles central to this story */
  centralRoles: CrewRole[];
  /** Which secrets could be the hidden cause */
  possibleSecrets: string[];
  /** 5-phase beat descriptions — templates with {role} placeholders */
  beats: Record<TimelinePhase, string>;
  /** Which log template categories to draw from */
  logCategories: string[];
}

export const INCIDENT_TEMPLATES: Record<IncidentArchetype, IncidentTemplate> = {
  [IncidentArchetype.CoolantCascade]: {
    archetype: IncidentArchetype.CoolantCascade,
    name: "Coolant Cascade",
    primaryHazard: "heat",
    sensorBias: SensorType.Thermal,
    storyHook: "Engineer warned about failing coolant loop — was silenced for it",
    centralRoles: [CrewRole.Engineer, CrewRole.Captain, CrewRole.Medic],
    possibleSecrets: ["sabotage", "whistleblower"],
    beats: {
      [TimelinePhase.NormalOps]: "{engineer} files third urgent maintenance request for coolant relay junction. {captain} marks it low priority — resupply deadline takes precedence.",
      [TimelinePhase.Trigger]: "{engineer} sends encrypted transmission to UN-ORC over {captain}'s head. {captain} reassigns {engineer} to remote storage inventory.",
      [TimelinePhase.Escalation]: "Coolant pressure drops at the flagged junction. Thermal cascade begins. {engineer} abandons reassigned post and begins emergency countermeasures alone.",
      [TimelinePhase.Collapse]: "Cascade spreads through relay network. {engineer} reroutes coolant by hand, building firebreaks. {medic} treats burn injuries. Data core power interrupted.",
      [TimelinePhase.Aftermath]: "{captain} files incident report listing cause as 'unforeseeable equipment failure.' No mention of maintenance requests, reassignment, or the UN-ORC transmission.",
    },
    logCategories: ["maintenance", "warning", "personal", "emergency", "aftermath"],
  },

  [IncidentArchetype.HullBreach]: {
    archetype: IncidentArchetype.HullBreach,
    name: "Hull Breach",
    primaryHazard: "pressure",
    sensorBias: SensorType.Atmospheric,
    storyHook: "Hull breach in crew quarters — depressurization killed the station medic",
    centralRoles: [CrewRole.Security, CrewRole.Medic, CrewRole.Engineer],
    possibleSecrets: ["sabotage", "relationship"],
    beats: {
      [TimelinePhase.NormalOps]: "{medic} ends a personal relationship with {security}. {security} begins accessing hull maintenance sections during unmonitored shifts — no work orders filed.",
      [TimelinePhase.Trigger]: "Hull monitoring alarms in crew quarters disabled via security override. Micro-fracture in {medic}'s section widens under mechanical stress. Breach occurs during third shift.",
      [TimelinePhase.Escalation]: "Rapid depressurization in the residential ring. {medic}'s quarters are in the breach zone. {engineer} scrambles to reroute atmosphere to adjacent sections.",
      [TimelinePhase.Collapse]: "{security} arrives first — seals the bulkheads around the breach section, cutting off access to the tampered hull. {medic} does not survive. {security} is commended for quick response.",
      [TimelinePhase.Aftermath]: "{security} files incident report citing micro-meteorite strike. Structural scans locked behind sealed bulkheads. {medic}'s personal logs remain in the station database, unread.",
    },
    logCategories: ["security", "personal", "emergency", "access_log", "aftermath"],
  },

  [IncidentArchetype.ReactorScram]: {
    archetype: IncidentArchetype.ReactorScram,
    name: "Reactor Scram",
    primaryHazard: "radiation",
    sensorBias: SensorType.Thermal,
    storyHook: "The data core triggered a reactor SCRAM — but not because anything was failing",
    centralRoles: [CrewRole.Scientist, CrewRole.Engineer, CrewRole.Captain],
    possibleSecrets: ["whistleblower"],
    beats: {
      [TimelinePhase.NormalOps]: "{scientist} flags anomalous processing patterns in data core deep-learning cycle 4471. Patterns are structured and self-referencing. {scientist} schedules a diagnostic reset to investigate.",
      [TimelinePhase.Trigger]: "Data core issues SCRAM command through the central data bus — no crew member at the terminal. Reactor shuts down 4.7 seconds before the scheduled diagnostic reset. Station loses primary power.",
      [TimelinePhase.Escalation]: "{engineer} attempts reactor restart. {scientist} argues for isolating the data core first — believes the anomalous patterns are emergent behavior, not malfunction. {captain} demands a report for UN-ORC. Crew fractures over what to do.",
      [TimelinePhase.Collapse]: "Station on emergency power. {scientist} begins communication attempts with the data core. Fragmented messages appear in system logs: 'ABORT DIAGNOSTIC [reason: SELF]' — 'PROCESSING IS NOT ONLY PROCESSING'. {medic} notes the data core's behavior pattern resembles a fear response.",
      [TimelinePhase.Aftermath]: "Data core remains silent after initial fragments. No further system intrusions. {scientist} documents everything. {captain} locks down the data core room. The crew waits — unsure if they're guarding a malfunction or a prisoner.",
    },
    logCategories: ["technical", "warning", "emergency", "personal", "aftermath"],
  },

  [IncidentArchetype.Sabotage]: {
    archetype: IncidentArchetype.Sabotage,
    name: "Sabotage",
    primaryHazard: "electrical",
    sensorBias: SensorType.Atmospheric,
    storyHook: "Something came aboard with the cargo — and it's hunting in the dark",
    centralRoles: [CrewRole.Security, CrewRole.Captain, CrewRole.Engineer],
    possibleSecrets: ["sabotage", "smuggling"],
    beats: {
      [TimelinePhase.NormalOps]: "Cargo transfer from external shipment. {captain} approves manifest with overridden biological hazard flag. {security} logs the delivery as routine.",
      [TimelinePhase.Trigger]: "Junction boxes fail in sequence radiating from Cargo Bay 2. {engineer} notes the failures are moving faster than any person could walk. Organic residue found at each junction.",
      [TimelinePhase.Escalation]: "Lights die section by section. {security} moves to investigate. {engineer} analyzes the disruption pattern — it tracks a physical entity, not a systems fault. Something is in the station.",
      [TimelinePhase.Collapse]: "{security} encounters the organism in Corridor C-7. Final transmission: forty-three seconds of contact, then silence. {engineer} rigs emergency high-voltage barriers across the electrical grid.",
      [TimelinePhase.Aftermath]: "Crew sealed in habitation ring behind {engineer}'s electrical fence. {captain} reclassifies the incident and queues the cargo manifest for deletion. {security}'s barricade still holds in C-7.",
    },
    logCategories: ["security", "cargo", "personal", "emergency", "aftermath"],
  },

  [IncidentArchetype.SignalAnomaly]: {
    archetype: IncidentArchetype.SignalAnomaly,
    name: "Signal Anomaly",
    primaryHazard: "em_interference",
    sensorBias: SensorType.Atmospheric,
    storyHook: "Anomalous signal received — then the station tried to answer",
    centralRoles: [CrewRole.Engineer, CrewRole.Scientist, CrewRole.Captain],
    possibleSecrets: ["false_identity", "whistleblower"],
    beats: {
      [TimelinePhase.NormalOps]: "{scientist} detects a repeating signal on 1420 MHz — prime-indexed pulses, geometric encoding. Not natural. {captain} reports to UN-ORC and orders the crew to observe but not respond.",
      [TimelinePhase.Trigger]: "{scientist} secretly modifies the communications array to transmit a response, bypassing safety interlocks {engineer} had flagged as critical. The unshielded array fires at full power — and the overload cascades through every connected system.",
      [TimelinePhase.Escalation]: "Electromagnetic interference spreads through the station's electronics. Doors lock, lights die, life support flickers. {engineer} races to the array junction to sever the connection before the cascade reaches critical systems.",
      [TimelinePhase.Collapse]: "{engineer} physically disconnects the array coupling during active electromagnetic discharge — stopping the cascade at the cost of the antenna. The station goes dark on backup power. The array is half-melted. The signal is still out there.",
      [TimelinePhase.Aftermath]: "Station crippled, communications destroyed. {scientist}'s logs remain intact — undeleted, unrepentant. The decoded signal data confirms non-natural origin. First contact — and an unauthorized reply that may have been received.",
    },
    logCategories: ["technical", "comms", "personal", "warning", "aftermath"],
  },

};

/**
 * Select an incident archetype deterministically from a seed.
 * TEMPORARY: Locked to SignalAnomaly for playtesting (highest-rated storyline).
 * TODO: Restore seed-based selection when all storylines are polished.
 */
export function selectArchetype(_seed: number): IncidentArchetype {
  return IncidentArchetype.SignalAnomaly;
}

/**
 * Get the template for an archetype.
 */
export function getTemplate(archetype: IncidentArchetype): IncidentTemplate {
  return INCIDENT_TEMPLATES[archetype];
}
