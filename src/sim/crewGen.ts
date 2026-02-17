/**
 * Procedural crew generator for SSR mystery engine.
 * Generates a crew manifest from a seed using ROT.RNG.
 */
import * as ROT from "rot-js";
import type { CrewMember, Relationship } from "../shared/types.js";
import { CrewRole, PersonalityTrait, CrewSecret, CrewFate } from "../shared/types.js";
import { FIRST_NAMES, LAST_NAMES, ROLE_BADGE_PREFIX } from "../data/namePools.js";

const ALL_ROLES = Object.values(CrewRole);
const ALL_PERSONALITIES = Object.values(PersonalityTrait);
const ALL_SECRETS = Object.values(CrewSecret);
const ALL_FATES: CrewFate[] = [CrewFate.Survived, CrewFate.Survived, CrewFate.Survived, CrewFate.Missing, CrewFate.InCryo];
const RELATIONSHIP_TYPES: Relationship["type"][] = ["ally", "rival", "romantic", "blackmail"];

/**
 * Role distribution constraints.
 * Returns an array of roles for the given crew size.
 */
function distributeRoles(crewSize: number): CrewRole[] {
  // Required roles: 1 captain, 1 engineer, 1 medic, 1 security
  const roles: CrewRole[] = [
    CrewRole.Captain,
    CrewRole.Engineer,
    CrewRole.Medic,
    CrewRole.Security,
  ];

  // Fill remaining slots with weighted distribution
  const fillerPool = [
    CrewRole.Scientist, CrewRole.Scientist, CrewRole.Scientist,
    CrewRole.Engineer,
    CrewRole.Robotics,
    CrewRole.LifeSupport,
    CrewRole.Comms,
    CrewRole.Scientist,
  ];

  while (roles.length < crewSize) {
    const idx = Math.floor(ROT.RNG.getUniform() * fillerPool.length);
    roles.push(fillerPool[idx]);
  }

  return roles;
}

/**
 * Pick unique names from the pools without replacement.
 */
function pickNames(count: number): { first: string; last: string }[] {
  const firstPool = [...FIRST_NAMES];
  const lastPool = [...LAST_NAMES];
  const names: { first: string; last: string }[] = [];

  for (let i = 0; i < count; i++) {
    const fi = Math.floor(ROT.RNG.getUniform() * firstPool.length);
    const li = Math.floor(ROT.RNG.getUniform() * lastPool.length);
    names.push({ first: firstPool[fi], last: lastPool[li] });
    // Remove to prevent duplicates
    firstPool.splice(fi, 1);
    lastPool.splice(li, 1);
    if (firstPool.length === 0 || lastPool.length === 0) break;
  }

  return names;
}

/**
 * Generate a badge ID from role and name.
 */
function makeBadgeId(role: CrewRole, lastName: string, seed: number, index: number): string {
  const prefix = ROLE_BADGE_PREFIX[role] || "CRW";
  const num = ((seed * 7919 + index * 1301) >>> 0) % 9000 + 1000;
  return `${prefix}-${lastName.toUpperCase()}-${num}`;
}

/**
 * Room names from procgen — used for lastKnownRoom assignment.
 */
const ROOM_ASSIGNMENTS = [
  "Engineering Storage", "Power Relay Junction", "Central Atrium",
  "Robotics Bay", "Life Support", "Communications Hub",
  "Crew Quarters", "Research Lab", "Med Bay", "Observation Deck",
  "Cargo Hold", "Bot Maintenance", "Vent Control Room",
];

/**
 * Generate a complete crew manifest for a run.
 * ROT.RNG must already be seeded before calling this.
 *
 * @param crewSize Number of crew members (8-12)
 * @param seed Game seed for deterministic badge IDs
 * @param roomNames Available room names from procgen
 */
export function generateCrew(crewSize: number, seed: number, roomNames: string[]): CrewMember[] {
  const size = Math.max(6, Math.min(20, crewSize));
  const roles = distributeRoles(size);
  const names = pickNames(size);
  const rooms = roomNames.length > 0 ? roomNames : ROOM_ASSIGNMENTS;

  const crew: CrewMember[] = [];

  for (let i = 0; i < size; i++) {
    const role = roles[i];
    const name = names[i];
    if (!name) break;

    const personalityIdx = Math.floor(ROT.RNG.getUniform() * ALL_PERSONALITIES.length);
    const fateIdx = Math.floor(ROT.RNG.getUniform() * ALL_FATES.length);
    const roomIdx = Math.floor(ROT.RNG.getUniform() * rooms.length);

    const member: CrewMember = {
      id: `crew_${name.last.toLowerCase()}`,
      firstName: name.first,
      lastName: name.last,
      role,
      badgeId: makeBadgeId(role, name.last, seed, i),
      personality: ALL_PERSONALITIES[personalityIdx],
      relationships: [],
      fate: ALL_FATES[fateIdx],
      lastKnownRoom: rooms[roomIdx],
    };

    crew.push(member);
  }

  // Assign 1-2 relationships per crew member
  for (const member of crew) {
    const relCount = 1 + Math.floor(ROT.RNG.getUniform() * 2);
    const others = crew.filter(c => c.id !== member.id);
    for (let r = 0; r < relCount && others.length > 0; r++) {
      const targetIdx = Math.floor(ROT.RNG.getUniform() * others.length);
      const target = others[targetIdx];
      const typeIdx = Math.floor(ROT.RNG.getUniform() * RELATIONSHIP_TYPES.length);
      // Avoid duplicate relationships to the same person
      if (!member.relationships.some(rel => rel.targetId === target.id)) {
        member.relationships.push({
          targetId: target.id,
          type: RELATIONSHIP_TYPES[typeIdx],
        });
      }
    }
  }

  // Assign 1 secret to a random crew member (not the captain)
  const secretCandidates = crew.filter(c => c.role !== CrewRole.Captain);
  if (secretCandidates.length > 0) {
    const secretIdx = Math.floor(ROT.RNG.getUniform() * secretCandidates.length);
    const secretTypeIdx = Math.floor(ROT.RNG.getUniform() * ALL_SECRETS.length);
    secretCandidates[secretIdx].secret = ALL_SECRETS[secretTypeIdx];
  }

  return crew;
}

/**
 * Find a crew member by role. Returns first match.
 */
export function findByRole(crew: CrewMember[], role: CrewRole): CrewMember | undefined {
  return crew.find(c => c.role === role);
}

/**
 * Get the crew member with a secret, if any.
 */
export function findSecretHolder(crew: CrewMember[]): CrewMember | undefined {
  return crew.find(c => c.secret !== undefined);
}
