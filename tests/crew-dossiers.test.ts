import { describe, it, expect, beforeEach } from "vitest";
import * as ROT from "rot-js";
import { generateCrew } from "../src/sim/crewGen.js";
import {
  THEMED_TRIPLETS,
  assignTriplets,
  createDossiers,
  confirmIdentity,
  updateTheoriesFromScene,
  linkEvidence,
  confirmFate,
  getDossierProgress,
  getIdentifiedCrewCount,
} from "../src/sim/crewDossiers.js";
import { CrewFate, SceneActivity } from "../src/shared/types.js";

const ROOM_NAMES = [
  "Arrival Bay", "Bridge", "Engine Core", "Cargo Hold", "Crew Quarters",
  "Med Bay", "Research Lab", "Life Support", "Power Relay Junction",
  "Engineering Storage", "Communications Hub", "Robotics Bay",
];

describe("themed triplets", () => {
  it("has at least 30 unique triplets", () => {
    expect(THEMED_TRIPLETS.length).toBeGreaterThanOrEqual(30);
  });

  it("each triplet has all three fields", () => {
    for (const triplet of THEMED_TRIPLETS) {
      expect(triplet.theme).toBeTruthy();
      expect(triplet.want).toBeTruthy();
      expect(triplet.habit).toBeTruthy();
      expect(triplet.contradiction).toBeTruthy();
    }
  });

  it("has 6 themes", () => {
    const themes = new Set(THEMED_TRIPLETS.map(t => t.theme));
    expect(themes.size).toBe(6);
  });

  it("each theme has at least 5 variations", () => {
    const themeCounts = new Map<string, number>();
    for (const t of THEMED_TRIPLETS) {
      themeCounts.set(t.theme, (themeCounts.get(t.theme) ?? 0) + 1);
    }
    for (const [theme, count] of themeCounts) {
      expect(count, `${theme} should have >= 5 variations`).toBeGreaterThanOrEqual(5);
    }
  });
});

describe("assignTriplets", () => {
  beforeEach(() => {
    ROT.RNG.setSeed(184201);
  });

  it("assigns one triplet per crew member", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const assignments = assignTriplets(crew);
    expect(assignments.size).toBe(crew.length);
  });

  it("assigns unique triplets (no duplicates)", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const assignments = assignTriplets(crew);
    const tripletThemes = new Set<string>();
    const tripletWants = new Set<string>();
    for (const [_, triplet] of assignments) {
      tripletWants.add(triplet.want);
    }
    // All wants should be unique (since triplets are drawn without replacement)
    expect(tripletWants.size).toBe(crew.length);
  });

  it("is deterministic", () => {
    ROT.RNG.setSeed(42);
    const crew1 = generateCrew(8, 42, ROOM_NAMES);
    const a1 = assignTriplets(crew1);

    ROT.RNG.setSeed(42);
    const crew2 = generateCrew(8, 42, ROOM_NAMES);
    const a2 = assignTriplets(crew2);

    for (const [id, triplet] of a1) {
      expect(a2.get(id)?.want).toBe(triplet.want);
    }
  });
});

describe("createDossiers", () => {
  beforeEach(() => {
    ROT.RNG.setSeed(184201);
  });

  it("creates one dossier per crew member", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const triplets = assignTriplets(crew);
    const dossiers = createDossiers(crew, triplets);
    expect(dossiers.length).toBe(crew.length);
  });

  it("dossiers start with empty confirmed fields", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const triplets = assignTriplets(crew);
    const dossiers = createDossiers(crew, triplets);

    for (const d of dossiers) {
      expect(d.confirmed.name).toBeUndefined();
      expect(d.confirmed.role).toBeUndefined();
      expect(d.confirmed.badgeId).toBeUndefined();
    }
  });

  it("dossiers have personal details from triplets", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const triplets = assignTriplets(crew);
    const dossiers = createDossiers(crew, triplets);

    for (const d of dossiers) {
      expect(d.personalDetails.want).toBeTruthy();
      expect(d.personalDetails.habit).toBeTruthy();
      expect(d.personalDetails.contradiction).toBeTruthy();
    }
  });

  it("dossiers start with empty evidence", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const triplets = assignTriplets(crew);
    const dossiers = createDossiers(crew, triplets);

    for (const d of dossiers) {
      expect(d.linkedEvidence).toEqual([]);
      expect(d.roomsSeen).toEqual([]);
    }
  });
});

describe("dossier updates", () => {
  let crew: ReturnType<typeof generateCrew>;
  let dossiers: ReturnType<typeof createDossiers>;

  beforeEach(() => {
    ROT.RNG.setSeed(184201);
    crew = generateCrew(10, 184201, ROOM_NAMES);
    const triplets = assignTriplets(crew);
    dossiers = createDossiers(crew, triplets);
  });

  it("confirmIdentity fills name, role, badgeId", () => {
    const d = dossiers[0];
    const updated = confirmIdentity(d, crew[0]);
    expect(updated.confirmed.name).toBe(`${crew[0].firstName} ${crew[0].lastName}`);
    expect(updated.confirmed.role).toBe(crew[0].role);
    expect(updated.confirmed.badgeId).toBe(crew[0].badgeId);
  });

  it("updateTheoriesFromScene sets lastKnownRoom and involvement", () => {
    const d = dossiers[0];
    const updated = updateTheoriesFromScene(d, "Engine Core", SceneActivity.EquipmentRepair);
    expect(updated.theories.lastKnownRoom).toBe("Engine Core");
    expect(updated.theories.involvement).toBe("responder");
    expect(updated.roomsSeen).toContain("Engine Core");
  });

  it("updateTheoriesFromScene doesn't duplicate rooms", () => {
    let d = dossiers[0];
    d = updateTheoriesFromScene(d, "Engine Core", SceneActivity.EquipmentRepair);
    d = updateTheoriesFromScene(d, "Engine Core", SceneActivity.EmergencyResponse);
    expect(d.roomsSeen.filter(r => r === "Engine Core").length).toBe(1);
  });

  it("linkEvidence adds journal entry ID", () => {
    const d = dossiers[0];
    const updated = linkEvidence(d, "journal_001");
    expect(updated.linkedEvidence).toContain("journal_001");
  });

  it("linkEvidence doesn't duplicate", () => {
    let d = dossiers[0];
    d = linkEvidence(d, "journal_001");
    d = linkEvidence(d, "journal_001");
    expect(d.linkedEvidence.length).toBe(1);
  });

  it("confirmFate sets fate theory", () => {
    const d = dossiers[0];
    const updated = confirmFate(d, CrewFate.Dead);
    expect(updated.theories.fate).toBe(CrewFate.Dead);
  });
});

describe("dossier progress", () => {
  beforeEach(() => {
    ROT.RNG.setSeed(184201);
  });

  it("empty dossier has 0 progress", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const triplets = assignTriplets(crew);
    const dossiers = createDossiers(crew, triplets);
    expect(getDossierProgress(dossiers[0])).toBe(0);
  });

  it("fully identified dossier has 0.6 progress (3/5)", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const triplets = assignTriplets(crew);
    const dossiers = createDossiers(crew, triplets);
    const updated = confirmIdentity(dossiers[0], crew[0]);
    expect(getDossierProgress(updated)).toBeCloseTo(0.6);
  });

  it("getIdentifiedCrewCount starts at 0", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const triplets = assignTriplets(crew);
    const dossiers = createDossiers(crew, triplets);
    expect(getIdentifiedCrewCount(dossiers)).toBe(0);
  });

  it("getIdentifiedCrewCount increases with confirmations", () => {
    const crew = generateCrew(10, 184201, ROOM_NAMES);
    const triplets = assignTriplets(crew);
    let dossiers = createDossiers(crew, triplets);
    dossiers[0] = confirmIdentity(dossiers[0], crew[0]);
    dossiers[1] = confirmIdentity(dossiers[1], crew[1]);
    expect(getIdentifiedCrewCount(dossiers)).toBe(2);
  });
});
