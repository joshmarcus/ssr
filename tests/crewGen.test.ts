import { describe, it, expect, beforeEach } from "vitest";
import * as ROT from "rot-js";
import { generateCrew, findByRole, findSecretHolder } from "../src/sim/crewGen.js";
import { CrewRole } from "../src/shared/types.js";

const ROOM_NAMES = [
  "Arrival Bay", "Engineering Storage", "Power Relay Junction",
  "Central Atrium", "Robotics Bay", "Life Support",
  "Communications Hub", "Crew Quarters", "Research Lab", "Med Bay",
];

describe("crewGen", () => {
  beforeEach(() => {
    ROT.RNG.setSeed(184201);
  });

  it("generates correct number of crew members", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    expect(crew.length).toBe(10);
  });

  it("respects minimum crew size", () => {
    const crew = generateCrew(3, 184201, ROOM_NAMES);
    expect(crew.length).toBe(6); // minimum is 6
  });

  it("always has exactly one captain", () => {
    for (const size of [8, 10, 12]) {
      ROT.RNG.setSeed(184201 + size);
      const crew = generateCrew(size, 184201, ROOM_NAMES);
      const captains = crew.filter(c => c.role === CrewRole.Captain);
      expect(captains.length).toBe(1);
    }
  });

  it("always has at least one engineer", () => {
    for (let seed = 1; seed <= 10; seed++) {
      ROT.RNG.setSeed(seed);
      const crew = generateCrew(10, seed, ROOM_NAMES);
      const engineers = crew.filter(c => c.role === CrewRole.Engineer);
      expect(engineers.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("always has a medic and security", () => {
    for (let seed = 1; seed <= 10; seed++) {
      ROT.RNG.setSeed(seed);
      const crew = generateCrew(10, seed, ROOM_NAMES);
      expect(crew.some(c => c.role === CrewRole.Medic)).toBe(true);
      expect(crew.some(c => c.role === CrewRole.Security)).toBe(true);
    }
  });

  it("generates no duplicate names across crew", () => {
    const crew = generateCrew(12, 184201, ROOM_NAMES);
    const fullNames = crew.map(c => `${c.firstName} ${c.lastName}`);
    const unique = new Set(fullNames);
    expect(unique.size).toBe(fullNames.length);
  });

  it("generates valid badge IDs", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    for (const member of crew) {
      expect(member.badgeId).toMatch(/^[A-Z]{3}-[A-Z]+-\d{4}$/);
    }
  });

  it("assigns 1-2 relationships per crew member", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    for (const member of crew) {
      expect(member.relationships.length).toBeGreaterThanOrEqual(1);
      expect(member.relationships.length).toBeLessThanOrEqual(2);
    }
  });

  it("assigns exactly one secret holder (not captain)", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const secretHolder = findSecretHolder(crew);
    expect(secretHolder).toBeDefined();
    expect(secretHolder!.role).not.toBe(CrewRole.Captain);
    // Only one person has a secret
    const withSecrets = crew.filter(c => c.secret !== undefined);
    expect(withSecrets.length).toBe(1);
  });

  it("is deterministic — same seed produces same crew", () => {
    ROT.RNG.setSeed(42);
    const crew1 = generateCrew(10, 42, ROOM_NAMES);
    ROT.RNG.setSeed(42);
    const crew2 = generateCrew(10, 42, ROOM_NAMES);

    expect(crew1.length).toBe(crew2.length);
    for (let i = 0; i < crew1.length; i++) {
      expect(crew1[i].firstName).toBe(crew2[i].firstName);
      expect(crew1[i].lastName).toBe(crew2[i].lastName);
      expect(crew1[i].role).toBe(crew2[i].role);
      expect(crew1[i].badgeId).toBe(crew2[i].badgeId);
    }
  });

  it("findByRole returns correct crew member", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const captain = findByRole(crew, CrewRole.Captain);
    expect(captain).toBeDefined();
    expect(captain!.role).toBe(CrewRole.Captain);
  });

  it("produces valid manifests for 10+ different seeds", () => {
    for (let seed = 1; seed <= 15; seed++) {
      ROT.RNG.setSeed(seed);
      const crew = generateCrew(10, seed, ROOM_NAMES);
      expect(crew.length).toBe(10);
      // Every member has required fields
      for (const member of crew) {
        expect(member.id).toBeTruthy();
        expect(member.firstName).toBeTruthy();
        expect(member.lastName).toBeTruthy();
        expect(member.role).toBeTruthy();
        expect(member.badgeId).toBeTruthy();
        expect(member.personality).toBeTruthy();
        expect(member.fate).toBeTruthy();
        expect(member.lastKnownRoom).toBeTruthy();
      }
    }
  });
});
