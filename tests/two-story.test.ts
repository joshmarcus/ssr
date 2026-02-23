import { describe, it, expect, beforeEach } from "vitest";
import * as ROT from "rot-js";
import {
  generateContradictionPairs,
  recordEvidence,
  shouldFireCrackMoment,
  fireCrackMoment,
  checkPendingContradictions,
  revealContradiction,
  markEvidenceFound,
  getRevealedContradictionCount,
} from "../src/sim/twoStory.js";
import type { EvidenceAccumulation } from "../src/shared/types.js";
import { IncidentArchetype } from "../src/shared/types.js";

describe("contradiction pairs", () => {
  beforeEach(() => {
    ROT.RNG.setSeed(184201);
  });

  it("generates 2-3 pairs per archetype", () => {
    for (const archetype of Object.values(IncidentArchetype)) {
      const pairs = generateContradictionPairs(archetype);
      expect(pairs.length).toBeGreaterThanOrEqual(2);
      expect(pairs.length).toBeLessThanOrEqual(3);
    }
  });

  it("each pair has official and contradicting text", () => {
    const pairs = generateContradictionPairs(IncidentArchetype.CoolantCascade);
    for (const pair of pairs) {
      expect(pair.official.text.length).toBeGreaterThan(20);
      expect(pair.contradicting.text.length).toBeGreaterThan(20);
      expect(pair.official.text).not.toBe(pair.contradicting.text);
    }
  });

  it("pairs start undiscovered and unrevealed", () => {
    const pairs = generateContradictionPairs(IncidentArchetype.HullBreach);
    for (const pair of pairs) {
      expect(pair.officialFound).toBe(false);
      expect(pair.contradictingFound).toBe(false);
      expect(pair.revealed).toBe(false);
    }
  });

  it("has unique IDs per pair", () => {
    const pairs = generateContradictionPairs(IncidentArchetype.Sabotage);
    const ids = new Set(pairs.map(p => p.id));
    expect(ids.size).toBe(pairs.length);
  });
});

describe("evidence accumulation", () => {
  it("tracks confirming evidence", () => {
    let acc: EvidenceAccumulation = {
      confirming_found: 0, ambiguous_found: 0, contradicting_found: 0, crack_moment_fired: false,
    };
    acc = recordEvidence(acc, "confirming");
    acc = recordEvidence(acc, "confirming");
    expect(acc.confirming_found).toBe(2);
    expect(acc.ambiguous_found).toBe(0);
  });

  it("tracks all three categories independently", () => {
    let acc: EvidenceAccumulation = {
      confirming_found: 0, ambiguous_found: 0, contradicting_found: 0, crack_moment_fired: false,
    };
    acc = recordEvidence(acc, "confirming");
    acc = recordEvidence(acc, "ambiguous");
    acc = recordEvidence(acc, "contradicting");
    expect(acc.confirming_found).toBe(1);
    expect(acc.ambiguous_found).toBe(1);
    expect(acc.contradicting_found).toBe(1);
  });
});

describe("crack moment", () => {
  it("does not fire with only confirming evidence", () => {
    const acc: EvidenceAccumulation = {
      confirming_found: 5, ambiguous_found: 0, contradicting_found: 0, crack_moment_fired: false,
    };
    expect(shouldFireCrackMoment(acc)).toBe(false);
  });

  it("does not fire with only contradicting evidence (no buildup)", () => {
    const acc: EvidenceAccumulation = {
      confirming_found: 0, ambiguous_found: 0, contradicting_found: 3, crack_moment_fired: false,
    };
    expect(shouldFireCrackMoment(acc)).toBe(false);
  });

  it("fires when confirming >= 3 AND contradicting >= 1", () => {
    const acc: EvidenceAccumulation = {
      confirming_found: 3, ambiguous_found: 0, contradicting_found: 1, crack_moment_fired: false,
    };
    expect(shouldFireCrackMoment(acc)).toBe(true);
  });

  it("does not fire twice", () => {
    let acc: EvidenceAccumulation = {
      confirming_found: 3, ambiguous_found: 0, contradicting_found: 1, crack_moment_fired: false,
    };
    expect(shouldFireCrackMoment(acc)).toBe(true);
    acc = fireCrackMoment(acc);
    expect(shouldFireCrackMoment(acc)).toBe(false);
    expect(acc.crack_moment_fired).toBe(true);
  });

  it("requires minimum 3 confirming (not 2)", () => {
    const acc: EvidenceAccumulation = {
      confirming_found: 2, ambiguous_found: 0, contradicting_found: 1, crack_moment_fired: false,
    };
    expect(shouldFireCrackMoment(acc)).toBe(false);
  });
});

describe("delayed contradiction detection", () => {
  beforeEach(() => {
    ROT.RNG.setSeed(184201);
  });

  it("no pending contradictions when nothing found", () => {
    const pairs = generateContradictionPairs(IncidentArchetype.CoolantCascade);
    const pending = checkPendingContradictions(pairs);
    expect(pending.length).toBe(0);
  });

  it("no pending when only one half found", () => {
    let pairs = generateContradictionPairs(IncidentArchetype.CoolantCascade);
    pairs = markEvidenceFound(pairs, pairs[0].id, "official");
    const pending = checkPendingContradictions(pairs);
    expect(pending.length).toBe(0);
  });

  it("creates pending when both halves found", () => {
    let pairs = generateContradictionPairs(IncidentArchetype.CoolantCascade);
    pairs = markEvidenceFound(pairs, pairs[0].id, "official");
    pairs = markEvidenceFound(pairs, pairs[0].id, "contradicting");
    const pending = checkPendingContradictions(pairs);
    expect(pending.length).toBe(1);
    expect(pending[0].roomsUntilReveal).toBeGreaterThanOrEqual(1);
    expect(pending[0].roomsUntilReveal).toBeLessThanOrEqual(2);
  });

  it("reveal marks pair as revealed", () => {
    let pairs = generateContradictionPairs(IncidentArchetype.CoolantCascade);
    pairs = markEvidenceFound(pairs, pairs[0].id, "official");
    pairs = markEvidenceFound(pairs, pairs[0].id, "contradicting");
    pairs = revealContradiction(pairs, pairs[0].id);
    expect(pairs[0].revealed).toBe(true);
    // No longer shows up as pending
    const pending = checkPendingContradictions(pairs);
    expect(pending.length).toBe(0);
  });

  it("getRevealedContradictionCount tracks reveals", () => {
    let pairs = generateContradictionPairs(IncidentArchetype.CoolantCascade);
    expect(getRevealedContradictionCount(pairs)).toBe(0);
    pairs = revealContradiction(pairs, pairs[0].id);
    expect(getRevealedContradictionCount(pairs)).toBe(1);
  });
});
