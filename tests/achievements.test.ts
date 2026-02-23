import { describe, it, expect, beforeEach } from "vitest";

// Mock localStorage for Node.js test environment
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// Import after localStorage is available
const { getRunHistory, recordRun, checkAchievements, getAchievements } = await import("../src/sim/saveLoad.js");
const { generate } = await import("../src/sim/procgen.js");
const { Difficulty } = await import("../src/shared/types.js");

/** Helper to create a minimal run record via recordRun. */
function addRun(opts: {
  seed?: number;
  victory?: boolean;
  turns?: number;
  deductionsCorrect?: number;
  deductionsTotal?: number;
  crewEvacuated?: number;
  difficulty?: string;
  rating?: string;
}): void {
  const seed = opts.seed ?? 42;
  const state = generate(seed, opts.difficulty === "hard" ? Difficulty.Hard : Difficulty.Normal);
  // Override fields for test purposes
  (state as any).victory = opts.victory ?? true;
  (state as any).turn = opts.turns ?? 100;
  if (state.mystery) {
    state.mystery.deductions = [];
    const total = opts.deductionsTotal ?? 5;
    const correct = opts.deductionsCorrect ?? total;
    for (let i = 0; i < total; i++) {
      state.mystery.deductions.push({
        id: `d${i}`,
        tier: i as any,
        question: `Q${i}`,
        options: [{ label: "A", correct: i < correct }, { label: "B", correct: i >= correct }],
        requiredTags: [],
        solved: true,
        answeredCorrectly: i < correct,
        wrongAttempts: i < correct ? 0 : 1,
        maxAttempts: 2,
        hintText: "",
      } as any);
    }
    if (opts.crewEvacuated && opts.crewEvacuated > 0) {
      (state.mystery as any).evacuation = {
        crewEvacuated: Array.from({ length: opts.crewEvacuated }, (_, i) => `crew_${i}`),
        crewDead: [],
        podsPowered: [],
        evacuationStartTurn: 50,
      };
    }
  }
  (state as any).difficulty = opts.difficulty ?? "normal";
  const rating = opts.rating ?? "B";
  recordRun(state, rating);
}

describe("achievement system", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("getAchievements returns all achievements with no unlocks initially", () => {
    const achievements = getAchievements();
    expect(achievements.length).toBe(8);
    expect(achievements.every(a => a.unlockedAt === undefined)).toBe(true);
  });

  it("checkAchievements returns empty array with no runs", () => {
    const newly = checkAchievements();
    expect(newly).toEqual([]);
  });

  it("first_victory unlocks after a winning run", () => {
    addRun({ victory: true });
    const newly = checkAchievements();
    expect(newly).toContain("first_victory");
    // Should also unlock perfect_deductions since all are correct by default
    expect(newly).toContain("perfect_deductions");
  });

  it("first_victory does NOT unlock after a losing run", () => {
    addRun({ victory: false });
    const newly = checkAchievements();
    expect(newly).not.toContain("first_victory");
  });

  it("speed_run unlocks when victory in under 100 turns", () => {
    addRun({ victory: true, turns: 80 });
    const newly = checkAchievements();
    expect(newly).toContain("speed_run");
  });

  it("speed_run does NOT unlock at exactly 100 turns", () => {
    addRun({ victory: true, turns: 100 });
    const newly = checkAchievements();
    expect(newly).not.toContain("speed_run");
  });

  it("s_rank unlocks with S rating", () => {
    addRun({ victory: true, rating: "S" });
    const newly = checkAchievements();
    expect(newly).toContain("s_rank");
  });

  it("hard_victory unlocks on hard difficulty win", () => {
    addRun({ victory: true, difficulty: "hard" });
    const newly = checkAchievements();
    expect(newly).toContain("hard_victory");
  });

  it("all_crew_saved unlocks when crew evacuated", () => {
    addRun({ victory: true, crewEvacuated: 3 });
    const newly = checkAchievements();
    expect(newly).toContain("all_crew_saved");
  });

  it("perfect_deductions does NOT unlock with wrong answers", () => {
    addRun({ victory: true, deductionsCorrect: 3, deductionsTotal: 5 });
    const newly = checkAchievements();
    expect(newly).not.toContain("perfect_deductions");
  });

  it("ten_runs unlocks after 10 completed runs", () => {
    for (let i = 0; i < 9; i++) {
      addRun({ seed: i, victory: i % 2 === 0 });
    }
    let newly = checkAchievements();
    expect(newly).not.toContain("ten_runs");

    addRun({ seed: 9, victory: true });
    newly = checkAchievements();
    expect(newly).toContain("ten_runs");
  });

  it("all_archetypes unlocks when 6 unique archetypes seen", () => {
    // Need 6 seeds that produce different archetypes (seed % 6)
    for (let i = 0; i < 6; i++) {
      addRun({ seed: i, victory: true });
    }
    const newly = checkAchievements();
    expect(newly).toContain("all_archetypes");
  });

  it("achievements persist across checkAchievements calls", () => {
    addRun({ victory: true });
    const first = checkAchievements();
    expect(first).toContain("first_victory");

    // Second call should NOT re-report first_victory
    const second = checkAchievements();
    expect(second).not.toContain("first_victory");

    // But getAchievements should still show it as unlocked
    const all = getAchievements();
    const firstVictory = all.find(a => a.id === "first_victory");
    expect(firstVictory?.unlockedAt).toBeDefined();
  });

  it("getAchievements shows mix of unlocked and locked", () => {
    addRun({ victory: true, turns: 200 }); // first_victory, perfect_deductions but NOT speed_run
    checkAchievements();

    const all = getAchievements();
    const unlocked = all.filter(a => a.unlockedAt);
    const locked = all.filter(a => !a.unlockedAt);
    expect(unlocked.length).toBeGreaterThan(0);
    expect(locked.length).toBeGreaterThan(0);
    expect(unlocked.length + locked.length).toBe(8);
  });
});
