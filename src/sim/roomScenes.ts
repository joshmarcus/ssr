/**
 * Room Scene Generator — "Station Autopsy" mystery system.
 *
 * Each room is a crime scene with 2-4 physical clue objects. The player
 * processes scenes by answering WHO/WHAT/OUTCOME questions against
 * deterministic ground truth derived from the timeline and crew paths.
 *
 * See MYSTERY_GAMEPLAY.md Part 2 (Pillar 1) and Part 5 (Generation Algorithm).
 */
import * as ROT from "rot-js";
import type {
  CrewMember,
  Room,
  IncidentTimeline,
  PhysicalClue,
  RoomScene,
  EvidenceCategory,
  PhysicalClueType,
  Position,
} from "../shared/types.js";
import {
  TimelinePhase,
  SceneActivity,
  SceneOutcome,
  SensorType,
  CrewRole,
  CrewFate,
  IncidentArchetype,
} from "../shared/types.js";
import { ROLE_DUTY_ROOMS } from "./crewPaths.js";

// ── Activity derivation ─────────────────────────────────────────

/** Map crew role + timeline phase to the most likely activity. */
function deriveActivity(
  role: CrewRole,
  phase: TimelinePhase,
  archetype: IncidentArchetype,
): SceneActivity {
  // Phase-dominant activities (override role in critical phases)
  if (phase === TimelinePhase.Collapse) {
    if (role === CrewRole.Medic) return SceneActivity.MedicalTreatment;
    if (role === CrewRole.Security) return SceneActivity.EmergencyResponse;
    if (role === CrewRole.Engineer) return SceneActivity.EquipmentRepair;
    return SceneActivity.Fleeing;
  }
  if (phase === TimelinePhase.Aftermath) {
    if (role === CrewRole.Captain) return SceneActivity.Communication;
    if (role === CrewRole.Security) return SceneActivity.Investigation;
    return SceneActivity.Fleeing;
  }

  // Archetype-specific overrides for Trigger/Escalation
  if (phase === TimelinePhase.Trigger) {
    if (archetype === IncidentArchetype.Sabotage) {
      if (role === CrewRole.Security || role === CrewRole.Captain) return SceneActivity.Investigation;
      return SceneActivity.RoutineWork;
    }
    if (archetype === IncidentArchetype.Mutiny) {
      if (role === CrewRole.Security) return SceneActivity.Confrontation;
      if (role === CrewRole.Scientist) return SceneActivity.Investigation;
      return SceneActivity.RoutineWork;
    }
    // Default trigger: the inciting action
    if (role === CrewRole.Engineer) return SceneActivity.EquipmentRepair;
    if (role === CrewRole.Scientist) return SceneActivity.DataAccess;
    if (role === CrewRole.Comms) return SceneActivity.Communication;
    return SceneActivity.RoutineWork;
  }

  if (phase === TimelinePhase.Escalation) {
    if (role === CrewRole.Engineer) return SceneActivity.EmergencyResponse;
    if (role === CrewRole.Security) return SceneActivity.EmergencyResponse;
    if (role === CrewRole.Medic) return SceneActivity.MedicalTreatment;
    if (role === CrewRole.LifeSupport) return SceneActivity.EquipmentRepair;
    return SceneActivity.Fleeing;
  }

  // NormalOps: everyone is doing their job
  if (role === CrewRole.Captain) return SceneActivity.Communication;
  if (role === CrewRole.Engineer) return SceneActivity.EquipmentRepair;
  if (role === CrewRole.Medic) return SceneActivity.MedicalTreatment;
  if (role === CrewRole.Security) return SceneActivity.Investigation;
  if (role === CrewRole.Scientist) return SceneActivity.DataAccess;
  if (role === CrewRole.Robotics) return SceneActivity.EquipmentRepair;
  if (role === CrewRole.LifeSupport) return SceneActivity.EquipmentRepair;
  if (role === CrewRole.Comms) return SceneActivity.Communication;
  return SceneActivity.RoutineWork;
}

/** Derive scene outcome from crew fate and activity. */
function deriveOutcome(fate: CrewFate, activity: SceneActivity): SceneOutcome {
  if (fate === CrewFate.Dead) return SceneOutcome.DiedHere;
  if (fate === CrewFate.InCryo) return SceneOutcome.SealedInside;
  if (activity === SceneActivity.Hiding || activity === SceneActivity.Barricading) {
    return SceneOutcome.StillHere;
  }
  if (activity === SceneActivity.Fleeing) return SceneOutcome.LeftInHurry;
  if (
    activity === SceneActivity.EmergencyResponse ||
    activity === SceneActivity.MedicalTreatment
  ) {
    return SceneOutcome.Injured;
  }
  return SceneOutcome.LeftNormally;
}

// ── Damage type mapping ─────────────────────────────────────────

type DamageType = "thermal" | "pressure" | "electrical" | "biological" | "none";

function hazardToDamageType(primaryHazard: string): DamageType {
  if (primaryHazard === "heat" || primaryHazard === "radiation") return "thermal";
  if (primaryHazard === "pressure" || primaryHazard === "atmospheric") return "pressure";
  if (primaryHazard === "electrical" || primaryHazard === "em_interference") return "electrical";
  return "none";
}

// ── Evidence category assignment ────────────────────────────────

/** Distance-based weight: near start = confirming, far = contradicting. */
function evidenceWeight(distFromStart: number, maxDist: number): EvidenceCategory {
  if (maxDist <= 0) return "ambiguous";
  const t = distFromStart / maxDist;
  const r = ROT.RNG.getUniform();
  if (t < 0.3) return r < 0.85 ? "confirming" : "ambiguous";
  if (t < 0.6) {
    if (r < 0.4) return "ambiguous";
    return r < 0.7 ? "confirming" : "contradicting";
  }
  return r < 0.5 ? "contradicting" : "ambiguous";
}

// ── Clue text generation ────────────────────────────────────────

/** Templates for each clue type, per evidence writing style. */
const CLUE_TEMPLATES: Record<PhysicalClueType, ((crew: CrewMember, room: string, archetype: IncidentArchetype) => string)[]> = {
  badge: [
    (c) => `${c.role.toUpperCase().replace(/_/g, " ")}-${c.lastName.toUpperCase()}-${c.badgeId} — scuffed, found face-down near the threshold.`,
    (c) => `Crew badge: ${c.badgeId}. Name partially smudged — "${c.lastName}" still legible. Magnetic strip demagnetized.`,
    (c) => `${c.firstName} ${c.lastName}'s badge, cracked down the middle. Lanyard snapped clean.`,
  ],
  personal_effect: [
    (c) => `A worn notebook with "${c.firstName}" in careful handwriting on the cover. Last entry mid-sentence.`,
    (c) => `Coffee mug, still in the holder. "${c.lastName}" scratched into the ceramic. Cold.`,
    (c) => `Family photo tucked behind a wall panel. Someone — probably ${c.lastName} — didn't want it found.`,
  ],
  damage_pattern: [
    (_c, room) => `Scorch marks radiate outward from the central junction in ${room}. Intensity decreases with distance.`,
    (_c, _room, arch) => arch === IncidentArchetype.HullBreach
      ? `Fracture pattern on the inner wall. Stress lines radiate from a central point — direction: inside-out.`
      : `Char marks climb the wall in a V-pattern. The heat source was at floor level.`,
    (_c, room) => `Impact damage on the far wall of ${room}. Something heavy hit it moving fast.`,
  ],
  access_log: [
    (c) => `Door panel log: last 5 accesses — 3 from ${c.role.replace(/_/g, " ")} override. Timestamps cluster between 22:00-23:00.`,
    (c) => `Terminal access history shows ${c.lastName} logged in 14 times in 48 hours. Previous average: twice daily.`,
    (c) => `Security override ${c.badgeId} used at 03:17. No corresponding work order filed.`,
  ],
  terminal_log: [
    (c) => `Draft message, half-deleted: "They won't listen to—" Sender field: ${c.lastName}. Never transmitted.`,
    (c) => `Terminal frozen mid-session. User: ${c.lastName}. Last command: file transfer to personal drive. Transfer: 73% complete.`,
    (c) => `Encrypted log entry. Header: "${c.firstName} ${c.lastName} — PERSONAL." Decryption failed. Timestamp: 6 hours before incident.`,
  ],
  tool: [
    () => `Voltage tester, teeth marks on the handle. Still powered on. Reading: 847V — well above safe threshold.`,
    () => `Emergency sealing kit, half-used. Two patches applied, third abandoned. Sealant still tacky.`,
    () => `Portable scanner, screen cracked but still displaying. Last reading: atmospheric composition anomaly.`,
  ],
  residue: [
    () => `Chemical residue on the floor — crystalline pattern, not standard cleaning solution. Smells faintly of ozone.`,
    () => `Dark stain near the console base. Not lubricant — wrong viscosity. Biological.`,
    () => `Fine particulate coating on every horizontal surface. Dust doesn't settle this evenly naturally.`,
  ],
  barricade: [
    () => `Furniture pushed against the door from inside. Chair legs wedged under the handle. Desperate geometry.`,
    () => `Access panel removed and wiring cut — someone disabled the door actuator deliberately.`,
    () => `Storage crates stacked three high against the vent. Whatever they were keeping out, it was small enough to fit through.`,
  ],
  modified_equipment: [
    () => `Coolant bypass rigged with non-standard connectors. Whoever did this knew the system but didn't have proper parts.`,
    () => `Power junction rewired — the safety cutoff has been bridged. This was done on purpose.`,
    () => `Environmental controls locked to manual override. Digital readout taped over with a handwritten note: "DO NOT TOUCH."`,
  ],
  memory_echo: [
    (c) => `The terminal flickers — for a moment, a translucent silhouette. ${c.firstName}, sitting here, typing. Then static.`,
    (c) => `A ghost in the display glass. ${c.lastName}'s reflection, caught mid-gesture. Gone before you can focus.`,
    (c) => `The air feels heavy here. For an instant, you see ${c.firstName} — standing, looking at something you can't see. Then nothing.`,
  ],
};

/** Environmental damage clue templates. */
const ENVIRONMENTAL_CLUE_TEMPLATES: Record<DamageType, string[]> = {
  thermal: [
    "Melted wall panel — the metal sagged before it cooled. Temperature peaked above 400°C.",
    "Heat-warped floor grating. The expansion pattern shows the thermal wave came from the corridor.",
    "Scorch ring around the ceiling vent. Something burned hot enough to char the filter housing.",
  ],
  pressure: [
    "Frost crystals on the inner wall. Rapid depressurization froze the moisture in the air.",
    "Cracked viewport seal — the pressure differential bowed the glass outward. Emergency foam applied, partially.",
    "Deformation along the bulkhead seam. The pressure spike exceeded the section's rated tolerance.",
  ],
  electrical: [
    "Arc burns on the junction box. The discharge pattern traces a path across three conduits.",
    "Fused relay contacts — the surge welded them shut. Burned copper smell still lingers.",
    "Scorch marks climb from the floor socket in branching patterns. Lightning in miniature.",
  ],
  biological: [
    "Organic residue along the baseboard. It doesn't match any standard chemical compound.",
    "Discoloration on the wall — cellular growth pattern. Something was growing here.",
    "Contamination markers placed by someone who knew the protocol. The tape is already yellowing.",
  ],
  none: [],
};

/** Thermal clue templates (sensor-gated). */
const THERMAL_CLUE_TEMPLATES = [
  (c: CrewMember) => `Residual heat signature on the wall panel — hand-shaped, pressed hard. Sustained contact. Size matches ${c.role.replace(/_/g, " ")} gloves.`,
  () => `Thermal trace on the floor — two sets of footprints, one walking, one running. The running ones are warmer.`,
  () => `Heat bloom around the sealed access panel. Something behind it is still generating warmth.`,
];

/** Atmospheric clue templates (sensor-gated). */
const ATMOSPHERIC_CLUE_TEMPLATES = [
  () => `Trace adrenaline metabolites in the recycler intake. Someone was breathing hard here. Recently.`,
  () => `Chemical signature in the air — not from the station's systems. External origin.`,
  (c: CrewMember) => `Micro-pressure differential near ${c.lastName}'s station. The seal was breached and re-sealed.`,
];

// ── Clue generation helpers ─────────────────────────────────────

function pickTemplate<T>(templates: T[]): T {
  return templates[Math.floor(ROT.RNG.getUniform() * templates.length)];
}

function makeClueId(roomId: string, index: number): string {
  return `clue_${roomId}_${index}`;
}

/** Generate a position within a room's bounds. */
function randomPosInRoom(room: Room): Position {
  const x = room.x + 1 + Math.floor(ROT.RNG.getUniform() * Math.max(1, room.width - 2));
  const y = room.y + 1 + Math.floor(ROT.RNG.getUniform() * Math.max(1, room.height - 2));
  return { x, y };
}

/** Pick a clue type appropriate for the crew activity. */
function clueTypeForActivity(activity: SceneActivity): PhysicalClueType {
  switch (activity) {
    case SceneActivity.EmergencyResponse: return "damage_pattern";
    case SceneActivity.Fleeing: return "personal_effect";
    case SceneActivity.Hiding: return "barricade";
    case SceneActivity.Sabotage: return "modified_equipment";
    case SceneActivity.MedicalTreatment: return "tool";
    case SceneActivity.RoutineWork: return "access_log";
    case SceneActivity.Investigation: return "terminal_log";
    case SceneActivity.EquipmentRepair: return "tool";
    case SceneActivity.DataAccess: return "terminal_log";
    case SceneActivity.Confrontation: return "damage_pattern";
    case SceneActivity.Communication: return "terminal_log";
    case SceneActivity.Barricading: return "barricade";
    default: return "personal_effect";
  }
}

/** Generate a physical clue for a crew member's presence. */
function generateCrewClue(
  crew: CrewMember,
  activity: SceneActivity,
  room: Room,
  archetype: IncidentArchetype,
  clueIndex: number,
  evidenceCat: EvidenceCategory,
): PhysicalClue {
  // First clue for a crew member is often a badge or personal effect (WHO clues)
  const isBadgeClue = clueIndex === 0 && ROT.RNG.getUniform() < 0.4;
  const clueType: PhysicalClueType = isBadgeClue ? "badge" : clueTypeForActivity(activity);

  const templates = CLUE_TEMPLATES[clueType];
  const template = pickTemplate(templates);
  const text = template(crew, room.name, archetype);

  return {
    id: makeClueId(room.id, clueIndex),
    type: clueType,
    text,
    sensorRequired: null,
    crewLinked: crew.id,
    examined: false,
    pos: randomPosInRoom(room),
    evidenceCategory: evidenceCat,
  };
}

/** Generate an environmental clue from the room's hazard state. */
function generateEnvironmentalClue(
  damageType: DamageType,
  room: Room,
  clueIndex: number,
  evidenceCat: EvidenceCategory,
): PhysicalClue | null {
  const templates = ENVIRONMENTAL_CLUE_TEMPLATES[damageType];
  if (!templates || templates.length === 0) return null;

  return {
    id: makeClueId(room.id, clueIndex),
    type: "damage_pattern",
    text: pickTemplate(templates),
    sensorRequired: null,
    crewLinked: undefined,
    examined: false,
    pos: randomPosInRoom(room),
    evidenceCategory: evidenceCat,
  };
}

/** Generate a sensor-gated clue (thermal or atmospheric). */
function generateSensorClue(
  sensor: SensorType,
  crew: CrewMember | undefined,
  room: Room,
  clueIndex: number,
  evidenceCat: EvidenceCategory,
): PhysicalClue {
  const templates = sensor === SensorType.Thermal
    ? THERMAL_CLUE_TEMPLATES
    : ATMOSPHERIC_CLUE_TEMPLATES;
  const template = pickTemplate(templates);
  const dummyCrew: CrewMember = crew ?? {
    id: "unknown",
    firstName: "Unknown",
    lastName: "Crew",
    role: CrewRole.Engineer,
    badgeId: "UNK-0000",
    personality: "cautious" as any,
    relationships: [],
    fate: CrewFate.Missing,
    lastKnownRoom: room.name,
  };
  const text = template(dummyCrew);

  return {
    id: makeClueId(room.id, clueIndex),
    type: "residue",
    text,
    sensorRequired: sensor,
    crewLinked: crew?.id,
    examined: false,
    pos: randomPosInRoom(room),
    evidenceCategory: evidenceCat,
  };
}

// ── Main generation function ────────────────────────────────────

/**
 * Generate room scenes for all rooms in the station.
 *
 * Each room gets:
 * - 0-2 crew presence entries (from timeline phase rooms + duty stations)
 * - 2-4 physical clue objects
 * - Environmental state from the archetype's primary hazard
 * - Ground truth for scene processing (WHO/WHAT/OUTCOME)
 * - Evidence category (confirming/ambiguous/contradicting) based on distance from start
 *
 * @param rooms - All rooms in the station layout
 * @param crew - All crew members
 * @param timeline - The incident timeline with deterministic phase rooms
 * @param playerStartRoom - The room the player starts in (for distance weighting)
 */
export function generateRoomScenes(
  rooms: Room[],
  crew: CrewMember[],
  timeline: IncidentTimeline,
  playerStartRoom: Room,
): RoomScene[] {
  const scenes: RoomScene[] = [];
  const crewByRole = new Map<CrewRole, CrewMember>();
  for (const c of crew) {
    if (!crewByRole.has(c.role)) crewByRole.set(c.role, c);
  }

  // Build room name → Room lookup
  const roomByName = new Map<string, Room>();
  for (const r of rooms) roomByName.set(r.name, r);

  // Build phase → room name from timeline
  const phaseToRoom = timeline.phaseRooms ?? {};

  // Determine which crew members are associated with which rooms
  // via timeline phase assignments and duty stations
  const roomCrewMap = new Map<string, { crewId: string; phase: TimelinePhase; activity: SceneActivity }[]>();

  // Step 1: Place crew from timeline events (central roles in their phase rooms)
  for (const event of timeline.events) {
    const crewMember = crew.find((c) => c.id === event.actorId);
    if (!crewMember) continue;
    const activity = deriveActivity(crewMember.role, event.phase, timeline.archetype);
    const existing = roomCrewMap.get(event.location) ?? [];
    // Avoid duplicates
    if (!existing.some((e) => e.crewId === crewMember.id)) {
      existing.push({ crewId: crewMember.id, phase: event.phase, activity });
      roomCrewMap.set(event.location, existing);
    }
  }

  // Step 2: Place remaining crew in their duty station rooms
  for (const c of crew) {
    const dutyRooms = ROLE_DUTY_ROOMS[c.role] ?? [];
    const dutyRoom = dutyRooms[0]; // primary duty station
    if (dutyRoom && roomByName.has(dutyRoom)) {
      const existing = roomCrewMap.get(dutyRoom) ?? [];
      if (!existing.some((e) => e.crewId === c.id)) {
        const activity = deriveActivity(c.role, TimelinePhase.NormalOps, timeline.archetype);
        existing.push({ crewId: c.id, phase: TimelinePhase.NormalOps, activity });
        roomCrewMap.set(dutyRoom, existing);
      }
    }
  }

  // Calculate max distance from start for evidence weighting
  const maxDist = Math.max(1, ...rooms.map((r) => roomDistance(playerStartRoom, r)));

  const damageType = hazardToDamageType(timeline.primaryHazard);

  // Step 3: Generate scenes for each room
  for (const room of rooms) {
    const crewPresent = roomCrewMap.get(room.name) ?? [];
    const dist = roomDistance(playerStartRoom, room);
    const roomEvCat = evidenceWeight(dist, maxDist);

    // Determine if this is a timeline-critical room
    const timelinePhase = Object.entries(phaseToRoom).find(([_, rn]) => rn === room.name)?.[0] as TimelinePhase | undefined;
    const isStoryCritical = !!timelinePhase;

    // Determine damage level based on distance and archetype
    let damageLevel: 0 | 1 | 2 | 3 = 0;
    if (isStoryCritical && timelinePhase !== TimelinePhase.NormalOps) {
      damageLevel = timelinePhase === TimelinePhase.Collapse ? 3
        : timelinePhase === TimelinePhase.Escalation ? 2 : 1;
    } else if (ROT.RNG.getUniform() < 0.3) {
      damageLevel = 1;
    }

    // Generate clues
    const clues: PhysicalClue[] = [];
    let clueIdx = 0;

    // Crew-based clues (1 per crew present, up to 2)
    const crewForClues = crewPresent.slice(0, 2);
    for (const cp of crewForClues) {
      const crewMember = crew.find((c) => c.id === cp.crewId);
      if (!crewMember) continue;
      const clue = generateCrewClue(
        crewMember, cp.activity, room, timeline.archetype, clueIdx, roomEvCat,
      );
      clues.push(clue);
      clueIdx++;
    }

    // Environmental clue (if room has damage)
    if (damageLevel > 0 && damageType !== "none") {
      const envClue = generateEnvironmentalClue(damageType, room, clueIdx, roomEvCat);
      if (envClue) {
        clues.push(envClue);
        clueIdx++;
      }
    }

    // Sensor-gated clue for story-critical rooms (adds depth for sensor upgrades)
    if (isStoryCritical && clues.length < 4) {
      const sensorType = timeline.sensorBias;
      const primaryCrew = crewForClues[0]
        ? crew.find((c) => c.id === crewForClues[0].crewId)
        : undefined;
      const sClue = generateSensorClue(sensorType, primaryCrew, room, clueIdx, roomEvCat);
      clues.push(sClue);
      clueIdx++;
    }

    // Ensure at least 2 clues per room (even non-story rooms get environmental detail)
    while (clues.length < 2) {
      if (damageType !== "none") {
        const envClue = generateEnvironmentalClue(damageType, room, clueIdx, roomEvCat);
        if (envClue) {
          clues.push(envClue);
          clueIdx++;
          continue;
        }
      }
      // Generic environmental clue fallback
      clues.push({
        id: makeClueId(room.id, clueIdx),
        type: "tool",
        text: "Emergency kit, seal broken. Bandage wrapper on the floor. Someone treated a wound here.",
        sensorRequired: null,
        examined: false,
        pos: randomPosInRoom(room),
        evidenceCategory: roomEvCat,
      });
      clueIdx++;
    }

    // Cap at 4 clues
    const finalClues = clues.slice(0, 4);

    // Determine ground truth
    const primaryCrew = crewForClues[0];
    const primaryCrewMember = primaryCrew ? crew.find((c) => c.id === primaryCrew.crewId) : undefined;
    const primaryActivity = primaryCrew?.activity ?? SceneActivity.RoutineWork;
    const primaryOutcome = primaryCrewMember
      ? deriveOutcome(primaryCrewMember.fate, primaryActivity)
      : SceneOutcome.Unknown;

    // Check for barricade evidence
    const hasBarricade = crewPresent.some(
      (cp) => cp.activity === SceneActivity.Hiding || cp.activity === SceneActivity.Barricading,
    );

    scenes.push({
      roomId: room.id,
      roomName: room.name,
      crewPresent,
      physicalClues: finalClues,
      environmentalState: {
        damageType: damageLevel > 0 ? damageType : "none",
        damageLevel,
        hasBarricade,
        sealState: hasBarricade ? "sealed_inside" : "open",
      },
      evidenceCategory: roomEvCat,
      processed: false,
      processAttempts: 0,
      groundTruth: {
        who: crewPresent.map((cp) => cp.crewId),
        what: primaryActivity,
        outcome: primaryOutcome,
      },
    });
  }

  return scenes;
}

/** Simple Manhattan distance between room centers. */
function roomDistance(a: Room, b: Room): number {
  const ax = a.x + Math.floor(a.width / 2);
  const ay = a.y + Math.floor(a.height / 2);
  const bx = b.x + Math.floor(b.width / 2);
  const by = b.y + Math.floor(b.height / 2);
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

// ── Scene Processing ────────────────────────────────────────────

export interface SceneProcessingResult {
  whoCorrect: boolean;
  whatCorrect: boolean;
  outcomeCorrect: boolean;
  score: number;      // 0-3
  turnCost: number;   // increases with attempts
}

/**
 * Process a scene: evaluate the player's WHO/WHAT/OUTCOME answers against ground truth.
 */
export function processScene(
  scene: RoomScene,
  whoAnswer: string[],   // crew IDs the player selected
  whatAnswer: SceneActivity,
  outcomeAnswer: SceneOutcome,
): SceneProcessingResult {
  const gt = scene.groundTruth;

  // WHO: check if player identified the correct crew (any overlap counts)
  const whoSet = new Set(gt.who);
  const whoCorrect = whoAnswer.length > 0 && whoAnswer.some((id) => whoSet.has(id));

  // WHAT: exact match
  const whatCorrect = whatAnswer === gt.what;

  // OUTCOME: exact match
  const outcomeCorrect = outcomeAnswer === gt.outcome;

  const score = (whoCorrect ? 1 : 0) + (whatCorrect ? 1 : 0) + (outcomeCorrect ? 1 : 0);

  // Turn cost increases with attempts: 3, 5, 8, 12, ...
  const attempt = scene.processAttempts;
  const turnCost = attempt === 0 ? 3 : attempt === 1 ? 5 : attempt === 2 ? 8 : 8 + (attempt - 2) * 4;

  return { whoCorrect, whatCorrect, outcomeCorrect, score, turnCost };
}
