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
    storyHook: "Engineer warned about failing coolant loop",
    centralRoles: [CrewRole.Engineer, CrewRole.Captain, CrewRole.Medic],
    possibleSecrets: ["sabotage", "whistleblower"],
    beats: {
      [TimelinePhase.NormalOps]: "{engineer} files maintenance request for coolant loop B. {captain} marks it low priority.",
      [TimelinePhase.Trigger]: "Coolant pressure drops in relay junction. {engineer} detects anomaly during routine check.",
      [TimelinePhase.Escalation]: "Heat cascade begins at P03. {engineer} attempts emergency bypass. {captain} orders evacuation of affected sections.",
      [TimelinePhase.Collapse]: "Multiple relay overheats trigger automated lockdown. {medic} treats burn injuries. Data core power interrupted.",
      [TimelinePhase.Aftermath]: "Crew shelters in cargo hold. {engineer} documents backup procedure. Station awaits external assistance.",
    },
    logCategories: ["maintenance", "warning", "personal", "emergency", "aftermath"],
  },

  [IncidentArchetype.HullBreach]: {
    archetype: IncidentArchetype.HullBreach,
    name: "Hull Breach",
    primaryHazard: "pressure",
    sensorBias: SensorType.Atmospheric,
    storyHook: "Structural failure in outer ring, emergency seals activated",
    centralRoles: [CrewRole.Engineer, CrewRole.Security, CrewRole.LifeSupport],
    possibleSecrets: ["sabotage", "smuggling"],
    beats: {
      [TimelinePhase.NormalOps]: "{security} reports micro-impacts on hull sensors. {engineer} schedules inspection.",
      [TimelinePhase.Trigger]: "Hull integrity alarm in sector 4. Pressure drop detected by {life_support} monitoring.",
      [TimelinePhase.Escalation]: "Emergency bulkheads seal automatically. {engineer} reroutes atmosphere. Two sections depressurized.",
      [TimelinePhase.Collapse]: "Secondary breach in maintenance corridor. {security} coordinates crew movement to safe zones.",
      [TimelinePhase.Aftermath]: "Crew in sealed sections. {life_support} manages remaining atmosphere reserves. Structural damage prevents full repair.",
    },
    logCategories: ["maintenance", "security", "emergency", "personal", "aftermath"],
  },

  [IncidentArchetype.ReactorScram]: {
    archetype: IncidentArchetype.ReactorScram,
    name: "Reactor Scram",
    primaryHazard: "radiation",
    sensorBias: SensorType.Thermal,
    storyHook: "Containment failure triggered emergency reactor shutdown",
    centralRoles: [CrewRole.Engineer, CrewRole.Scientist, CrewRole.Captain],
    possibleSecrets: ["sabotage", "whistleblower"],
    beats: {
      [TimelinePhase.NormalOps]: "{scientist} notes fluctuations in reactor output. {engineer} runs diagnostics — inconclusive.",
      [TimelinePhase.Trigger]: "Containment field fluctuation detected. Automated scram sequence initiates. {captain} orders immediate area evacuation.",
      [TimelinePhase.Escalation]: "Radiation levels spike in reactor ring. {engineer} attempts manual containment reset. Shielding partially compromised.",
      [TimelinePhase.Collapse]: "Full scram. Station on backup power. {scientist} seals lab samples. Radiation bleeds into adjacent sections.",
      [TimelinePhase.Aftermath]: "Emergency power only. Crew sealed in habitation ring. {captain} authorizes distress beacon activation.",
    },
    logCategories: ["technical", "warning", "emergency", "personal", "aftermath"],
  },

  [IncidentArchetype.Sabotage]: {
    archetype: IncidentArchetype.Sabotage,
    name: "Sabotage",
    primaryHazard: "varies",
    sensorBias: SensorType.Atmospheric,
    storyHook: "Deliberate damage to station systems — who and why?",
    centralRoles: [CrewRole.Security, CrewRole.Captain, CrewRole.Engineer],
    possibleSecrets: ["sabotage", "false_identity", "smuggling"],
    beats: {
      [TimelinePhase.NormalOps]: "Station operations normal. {security} reviews routine access logs. Nothing out of the ordinary — or so it seems.",
      [TimelinePhase.Trigger]: "Multiple system faults across different sections. {engineer} says this pattern isn't random. {security} begins investigation.",
      [TimelinePhase.Escalation]: "{captain} orders lockdown. Accusation and tension rise. Someone accessed restricted systems using a forged badge.",
      [TimelinePhase.Collapse]: "Critical system disabled. Evidence points to an insider. {security} confronts the suspect. Situation deteriorates.",
      [TimelinePhase.Aftermath]: "Crew divided. Trust broken. Damaged systems require external repair. Evidence scattered across the station.",
    },
    logCategories: ["security", "access_log", "personal", "confrontation", "aftermath"],
  },

  [IncidentArchetype.SignalAnomaly]: {
    archetype: IncidentArchetype.SignalAnomaly,
    name: "Signal Anomaly",
    primaryHazard: "em_interference",
    sensorBias: SensorType.Atmospheric,
    storyHook: "External signal causes system glitches and crew paranoia",
    centralRoles: [CrewRole.Comms, CrewRole.Scientist, CrewRole.Captain],
    possibleSecrets: ["false_identity", "whistleblower"],
    beats: {
      [TimelinePhase.NormalOps]: "{comms} picks up unusual signal pattern during routine sweep. {scientist} requests analysis time.",
      [TimelinePhase.Trigger]: "Signal intensifies. Station systems begin showing interference. {comms} isolates the frequency — it's not natural.",
      [TimelinePhase.Escalation]: "Electronics malfunction across the station. Doors cycle, lights flicker. {captain} questions whether to jam the signal.",
      [TimelinePhase.Collapse]: "Station-wide system reset. Signal source triangulated but unresolved. Crew divided on whether it's hostile.",
      [TimelinePhase.Aftermath]: "Systems partially restored. Signal continues. {scientist} compiles findings. Station comms compromised.",
    },
    logCategories: ["technical", "comms", "personal", "warning", "aftermath"],
  },

  [IncidentArchetype.ContainmentBreach]: {
    archetype: IncidentArchetype.ContainmentBreach,
    name: "Containment Breach",
    primaryHazard: "atmospheric",
    sensorBias: SensorType.Atmospheric,
    storyHook: "Lab containment failure releases toxic atmosphere",
    centralRoles: [CrewRole.Scientist, CrewRole.Medic, CrewRole.LifeSupport],
    possibleSecrets: ["smuggling", "whistleblower"],
    beats: {
      [TimelinePhase.NormalOps]: "{scientist} works late on experiment samples. {medic} notes unusual supply requests from the lab.",
      [TimelinePhase.Trigger]: "Containment seal failure in Research Lab. Atmospheric contamination alarm triggered. {life_support} scrambles to isolate ventilation.",
      [TimelinePhase.Escalation]: "Toxic atmosphere spreads through connected sections. {medic} sets up decontamination in Med Bay. {scientist} tries to reseal containment.",
      [TimelinePhase.Collapse]: "Lab section quarantined. Several crew exposed. {life_support} reroutes clean air to shelter zones.",
      [TimelinePhase.Aftermath]: "Crew in clean zones. Contamination slowly venting. {medic} monitoring exposed personnel. Lab work lost.",
    },
    logCategories: ["technical", "medical", "emergency", "personal", "aftermath"],
  },
};

/**
 * Select an incident archetype deterministically from a seed.
 * Golden seed 184201 always returns CoolantCascade for backward compatibility.
 */
export function selectArchetype(seed: number): IncidentArchetype {
  const archetypes = Object.values(IncidentArchetype);
  const idx = ((seed * 2654435761) >>> 0) % archetypes.length;
  return archetypes[idx];
}

/**
 * Get the template for an archetype.
 */
export function getTemplate(archetype: IncidentArchetype): IncidentTemplate {
  return INCIDENT_TEMPLATES[archetype];
}
