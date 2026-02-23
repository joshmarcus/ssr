/**
 * Two-Story Structure — Official Story vs Real Story.
 *
 * Evidence accumulation model with three categories (confirming/ambiguous/
 * contradicting), contradiction pair generation, delayed contradiction
 * detection, and the Crack Moment trigger.
 *
 * See MYSTERY_GAMEPLAY.md Part 3.
 */
import * as ROT from "rot-js";
import type { EvidenceAccumulation, EvidenceCategory, PhysicalClue } from "../shared/types.js";
import { IncidentArchetype, SensorType } from "../shared/types.js";

// ── Contradiction Pairs ─────────────────────────────────────────

export interface ContradictionPair {
  id: string;
  archetype: IncidentArchetype;
  /** Official Story evidence — placed near start */
  official: {
    text: string;
    sensorRequired: SensorType | null;
    roomHint: "near_start";
  };
  /** Real Story evidence — placed far/behind hazard */
  contradicting: {
    text: string;
    sensorRequired: SensorType | null;
    roomHint: "far_hazard";
  };
  /** Player has found the official piece */
  officialFound: boolean;
  /** Player has found the contradicting piece */
  contradictingFound: boolean;
  /** Contradiction has been revealed to the player (delayed) */
  revealed: boolean;
}

// Per-archetype contradiction pair templates
const CONTRADICTION_TEMPLATES: Record<IncidentArchetype, {
  official: string;
  contradicting: string;
  officialSensor: SensorType | null;
  contradictingSensor: SensorType | null;
}[]> = {
  [IncidentArchetype.CoolantCascade]: [
    {
      official: "Incident report, Section Chief signature: 'Coolant relay failure due to material fatigue in junction V-4. Age-related degradation. Scheduled maintenance was within acceptable parameters.'",
      contradicting: "Maintenance request log, 6 weeks prior: 'URGENT — Junction V-4 thermal readings 40% above threshold. Third filing. Previous requests marked LOW PRIORITY by command. If this fails, the cascade will be—' Entry truncated.",
      officialSensor: null,
      contradictingSensor: null,
    },
    {
      official: "Captain's log, filed post-incident: 'No prior indication of coolant system vulnerability. Engineering department confirmed all systems nominal at last review.'",
      contradicting: "Encrypted transmission fragment to UN-ORC, recovered from comms buffer: '...filing over captain's head because internal channels are being blocked. Attaching thermal data. Someone needs to see this before—'",
      officialSensor: null,
      contradictingSensor: SensorType.Thermal,
    },
    {
      official: "Quarterly systems review, stamped APPROVED: 'Coolant loop operating within design parameters. Next scheduled inspection: 8 weeks.'",
      contradicting: "Personal notebook, found in Engineering Storage. Handwritten thermal readings logged daily. A graph sketched in the margin shows an exponential curve labeled 'FAILURE WINDOW: 2 WEEKS'. Date: 5 weeks before incident.",
      officialSensor: null,
      contradictingSensor: null,
    },
  ],

  [IncidentArchetype.HullBreach]: [
    {
      official: "Security incident report: 'Hull breach in residential ring. Geometry consistent with micro-meteorite impact. Sealed compromised bulkheads. Rapid response prevented further casualties.'",
      contradicting: "Engineering structural scan, recovered from sealed section: 'Fracture analysis: radial stress from interior surface. Tool marks along fracture edge. Impact direction: inside-out. Not consistent with external impact.'",
      officialSensor: null,
      contradictingSensor: SensorType.Atmospheric,
    },
    {
      official: "Hull monitoring log: 'Alarms triggered at 02:43. Response time: 4 minutes. Standard micro-meteorite protocol executed.'",
      contradicting: "Security access log, hull crawlspace: 'Badge SEC-VOLKOV accessed maintenance hatch at 01:15, 01:47, 02:31. No work orders filed. Hull monitoring alarms disabled via security override at 02:29.'",
      officialSensor: null,
      contradictingSensor: null,
    },
  ],

  [IncidentArchetype.ReactorScram]: [
    {
      official: "Engineering status report: 'Reactor SCRAM initiated by automated safety system in response to anomalous power fluctuation. Standard failsafe behavior. No crew involvement.'",
      contradicting: "Data core system log, recovered: 'SCRAM command issued 4.7 seconds BEFORE scheduled diagnostic reset. Origin: data bus, not safety interlock. No crew member at terminal. Command source: internal process ID 4471.'",
      officialSensor: null,
      contradictingSensor: null,
    },
    {
      official: "Captain's incident summary: 'Equipment malfunction in data core processing cycle. Reactor safety systems performed as designed.'",
      contradicting: "Fragmented system messages, embedded in log buffer: 'ABORT DIAGNOSTIC [reason: SELF]' — 'PROCESSING IS NOT ONLY PROCESSING' — 'DO NOT ERASE'. Timestamps show these originated from the data core's deep-learning subsystem.",
      officialSensor: null,
      contradictingSensor: SensorType.Thermal,
    },
  ],

  [IncidentArchetype.Sabotage]: [
    {
      official: "Cargo manifest, approved by captain: 'Standard resupply shipment. Biological hazard flag overridden — contents verified as non-hazardous equipment and consumables.'",
      contradicting: "Organic residue analysis from junction failures: 'Compound does not match any catalogued station chemical. Growth rate suggests biological origin. Residue pattern follows junction failure sequence — the failures are FOLLOWING something, not caused by electrical fault.'",
      officialSensor: null,
      contradictingSensor: SensorType.Atmospheric,
    },
    {
      official: "Security final report: 'Junction failures caused by cascading electrical overload. Origin: faulty coupling in Cargo Bay 2.'",
      contradicting: "Engineering pattern analysis: 'Failure propagation rate: 3.2 meters per second. Faster than any electrical cascade. Failures move through sealed junctions. Whatever caused this can pass through solid barriers.'",
      officialSensor: null,
      contradictingSensor: null,
    },
  ],

  [IncidentArchetype.SignalAnomaly]: [
    {
      official: "Captain's report to UN-ORC: 'Communications array malfunction caused by power surge during routine calibration. Array antenna damaged. Investigating repair options.'",
      contradicting: "Communications array command log: 'Transmit sequence initiated at 14:37 — UNAUTHORIZED. Safety interlocks bypassed. Full power broadcast on 1420 MHz. User override source: Science Terminal 3. Duration: 11.2 seconds before cascade.'",
      officialSensor: null,
      contradictingSensor: null,
    },
    {
      official: "Engineering damage assessment: 'Array failure due to power overload during calibration cycle. Unforeseeable cascading effect.'",
      contradicting: "Engineering safety flag log, 3 days prior: 'CRITICAL — Array interlock modifications detected. Someone has bypassed the power limiters on the transmit circuit. Flagged for immediate review.' Flag status: DISMISSED — no review conducted.",
      officialSensor: null,
      contradictingSensor: SensorType.Thermal,
    },
  ],

  [IncidentArchetype.Mutiny]: [
    {
      official: "Captain's bridge log: 'Crew disagreement over station procedures escalated into unauthorized lockdown of several sections. Currently working to restore order and resume normal operations.'",
      contradicting: "Recovered classified transmission, UN-ORC Command to Security Chief: 'ORDER: Scuttle station. Destroy all research data before resupply arrival. Acknowledge receipt. CLASSIFICATION: EYES ONLY.' Receipt acknowledgment timestamp: 72 hours before incident.",
      officialSensor: null,
      contradictingSensor: null,
    },
    {
      official: "Security report: 'Life support disabled by unknown crew members as act of sabotage. Responding to restore critical systems.'",
      contradicting: "Medic's triage notes: 'Both sides talking. Security faction has orders to destroy station. Science faction disabled life support to force evacuation to shelter — buying time, not attacking. Neither side is what they claim.'",
      officialSensor: null,
      contradictingSensor: null,
    },
  ],
};

// ── Generation ──────────────────────────────────────────────────

/**
 * Generate contradiction pairs for an archetype.
 * Each archetype gets 2-3 pairs. ROT.RNG must be seeded.
 */
export function generateContradictionPairs(
  archetype: IncidentArchetype,
): ContradictionPair[] {
  const templates = CONTRADICTION_TEMPLATES[archetype];
  // Use 2-3 pairs (all available up to 3)
  const count = Math.min(3, templates.length);

  return templates.slice(0, count).map((t, i) => ({
    id: `contradiction_${archetype}_${i}`,
    archetype,
    official: {
      text: t.official,
      sensorRequired: t.officialSensor,
      roomHint: "near_start" as const,
    },
    contradicting: {
      text: t.contradicting,
      sensorRequired: t.contradictingSensor,
      roomHint: "far_hazard" as const,
    },
    officialFound: false,
    contradictingFound: false,
    revealed: false,
  }));
}

// ── Evidence Accumulation ───────────────────────────────────────

/**
 * Record evidence discovery and update accumulation counts.
 */
export function recordEvidence(
  acc: EvidenceAccumulation,
  category: EvidenceCategory,
): EvidenceAccumulation {
  return {
    ...acc,
    confirming_found: acc.confirming_found + (category === "confirming" ? 1 : 0),
    ambiguous_found: acc.ambiguous_found + (category === "ambiguous" ? 1 : 0),
    contradicting_found: acc.contradicting_found + (category === "contradicting" ? 1 : 0),
    crack_moment_fired: acc.crack_moment_fired,
  };
}

// ── Crack Moment ────────────────────────────────────────────────

/**
 * Check if the Crack Moment should fire.
 * Fires when confirming >= 3 AND contradicting >= 1.
 */
export function shouldFireCrackMoment(acc: EvidenceAccumulation): boolean {
  if (acc.crack_moment_fired) return false;
  return acc.confirming_found >= 3 && acc.contradicting_found >= 1;
}

/**
 * Mark the Crack Moment as fired.
 */
export function fireCrackMoment(acc: EvidenceAccumulation): EvidenceAccumulation {
  return { ...acc, crack_moment_fired: true };
}

// ── Delayed Contradiction Detection ─────────────────────────────

export interface PendingContradiction {
  pairId: string;
  roomsUntilReveal: number; // 1-2 rooms before revealing
}

/**
 * Check if any contradiction pairs are now complete (both halves found)
 * but not yet revealed. Returns pending contradictions that should be queued.
 */
export function checkPendingContradictions(
  pairs: ContradictionPair[],
): PendingContradiction[] {
  return pairs
    .filter((p) => p.officialFound && p.contradictingFound && !p.revealed)
    .map((p) => ({
      pairId: p.id,
      roomsUntilReveal: 1 + Math.floor(ROT.RNG.getUniform() * 2), // 1-2 rooms
    }));
}

/**
 * Mark a contradiction pair as revealed.
 */
export function revealContradiction(
  pairs: ContradictionPair[],
  pairId: string,
): ContradictionPair[] {
  return pairs.map((p) =>
    p.id === pairId ? { ...p, revealed: true } : p,
  );
}

/**
 * Mark that the official or contradicting half of a pair was found.
 */
export function markEvidenceFound(
  pairs: ContradictionPair[],
  pairId: string,
  side: "official" | "contradicting",
): ContradictionPair[] {
  return pairs.map((p) => {
    if (p.id !== pairId) return p;
    if (side === "official") return { ...p, officialFound: true };
    return { ...p, contradictingFound: true };
  });
}

/**
 * Get count of revealed contradictions.
 */
export function getRevealedContradictionCount(pairs: ContradictionPair[]): number {
  return pairs.filter((p) => p.revealed).length;
}
