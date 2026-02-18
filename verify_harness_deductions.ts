/**
 * Focused verification of SUBMIT_DEDUCTION through the step() function.
 * Tests the exact same code path the harness CLI uses.
 *
 * This verifies:
 * 1. Deductions show up in observations with correct structure
 * 2. SUBMIT_DEDUCTION is accepted and processed correctly
 * 3. Deduction rewards are applied (clearance, room_reveal, drone_disable, sensor_hint)
 * 4. After all deductions solved, DataCore interaction triggers victory
 * 5. The full chain: gather evidence -> unlock -> solve -> next unlock -> ... -> transmit
 */
import { generate } from "./src/sim/procgen.js";
import { step } from "./src/sim/step.js";
import { getUnlockedDeductions } from "./src/sim/deduction.js";
import { parseAction, getValidActionsForState } from "./src/harness/actionParser.js";
import { ActionType, EntityType, ObjectivePhase } from "./src/shared/types.js";
import type { GameState, Action, Entity } from "./src/shared/types.js";

const SEED = 42;
let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  PASS: ${msg}`);
    passed++;
  } else {
    console.log(`  FAIL: ${msg}`);
    failed++;
  }
}

function movePlayerTo(state: GameState, tx: number, ty: number): GameState {
  const newEntity = { ...state.player.entity, pos: { x: tx, y: ty } };
  const newEntities = new Map(state.entities);
  newEntities.set("player", newEntity);
  return {
    ...state,
    player: { ...state.player, entity: newEntity },
    entities: newEntities,
  };
}

console.log("=== Test 1: parseAction handles SUBMIT_DEDUCTION ===");
{
  const result = parseAction('{"action":"SUBMIT_DEDUCTION","params":{"deductionId":"deduction_what","answerKey":"correct"}}');
  assert(!("error" in result), "parseAction should parse SUBMIT_DEDUCTION without error");
  if (!("error" in result)) {
    assert(result.type === ActionType.SubmitDeduction, "parsed action type should be SubmitDeduction");
    assert(result.deductionId === "deduction_what", "deductionId should be deduction_what");
    assert(result.answerKey === "correct", "answerKey should be correct");
  }
}

console.log("\n=== Test 2: SUBMIT_DEDUCTION rejected when locked ===");
{
  let state = generate(SEED);
  const action: Action = { type: ActionType.SubmitDeduction, deductionId: "deduction_what", answerKey: "correct" };
  const newState = step(state, action);
  const d = newState.mystery!.deductions.find(d => d.id === "deduction_what");
  // deduction_what requires "reactor" tag, which we don't have yet
  assert(!d!.solved, "deduction_what should remain unsolved without evidence");
  assert(newState.logs.some(l => l.text.includes("locked") || l.text.includes("evidence")),
    "should produce a log about locked/evidence");
}

console.log("\n=== Test 3: Evidence gathering creates journal entries with tags ===");
{
  let state = generate(SEED);

  // Find an evidence_trace and teleport next to it
  let evidenceTrace: Entity | undefined;
  for (const [, e] of state.entities) {
    if (e.type === EntityType.EvidenceTrace && e.props["discovered"] !== true) {
      evidenceTrace = e;
      break;
    }
  }
  assert(!!evidenceTrace, "should find an evidence trace entity");

  if (evidenceTrace) {
    state = movePlayerTo(state, evidenceTrace.pos.x - 1, evidenceTrace.pos.y);
    const before = state.mystery!.journal.length;
    state = step(state, { type: ActionType.Interact, targetId: evidenceTrace.id });
    const after = state.mystery!.journal.length;
    assert(after > before, "interacting with evidence trace should add journal entry");
    if (after > before) {
      const entry = state.mystery!.journal[state.mystery!.journal.length - 1];
      assert(entry.tags.length > 0, "journal entry should have tags");
      assert(entry.category === "trace", "journal entry category should be 'trace'");
      console.log(`    Tags: [${entry.tags.join(", ")}]`);
    }
  }
}

console.log("\n=== Test 4: Full deduction chain with evidence ===");
{
  let state = generate(SEED);

  // Gather all evidence by teleporting to each source
  const evidenceSources: Entity[] = [];
  for (const [, e] of state.entities) {
    if (e.type === EntityType.EvidenceTrace ||
        e.type === EntityType.LogTerminal ||
        e.type === EntityType.CrewItem ||
        e.type === EntityType.Console) {
      evidenceSources.push(e);
    }
  }

  let interacted = 0;
  for (const target of evidenceSources) {
    if (interacted >= 25) break;
    state = movePlayerTo(state, target.pos.x - 1, target.pos.y);
    const current = state.entities.get(target.id);
    if (!current) continue;
    const before = state.mystery!.journal.length;
    state = step(state, { type: ActionType.Interact, targetId: target.id });
    if (state.mystery!.journal.length > before) interacted++;
  }

  console.log(`  Gathered ${state.mystery!.journal.length} journal entries from ${interacted} interactions`);

  // Force phase to Recover (in a real game, this happens via cleaning rooms)
  state = {
    ...state,
    mystery: {
      ...state.mystery!,
      objectivePhase: ObjectivePhase.Recover,
      cleaningDirective: false,
    },
  };

  // Collect all tags
  const allTags = new Set(state.mystery!.journal.flatMap(j => j.tags));

  // Inject any missing tags for testing purposes
  const neededTags = new Set<string>();
  for (const d of state.mystery!.deductions) {
    for (const tag of d.requiredTags) {
      if (!allTags.has(tag)) neededTags.add(tag);
    }
  }

  if (neededTags.size > 0) {
    console.log(`  Injecting ${neededTags.size} missing tags: [${[...neededTags].join(", ")}]`);
    const synth = [...neededTags].map((tag, i) => ({
      id: `synth_${tag}_${i}`,
      turnDiscovered: state.turn,
      category: "trace" as const,
      summary: `Synthetic ${tag}`,
      detail: `Test evidence for ${tag}`,
      crewMentioned: [],
      roomFound: "Test",
      tags: [tag],
    }));
    state = {
      ...state,
      mystery: { ...state.mystery!, journal: [...state.mystery!.journal, ...synth] },
    };
  }

  // Now solve each deduction in chain order
  for (const d of state.mystery!.deductions) {
    const correctOpt = d.options.find(o => o.correct);
    assert(!!correctOpt, `${d.id} should have a correct option`);
    if (!correctOpt) continue;

    const unlocked = getUnlockedDeductions(state.mystery!.deductions, state.mystery!.journal);
    assert(unlocked.some(u => u.id === d.id), `${d.id} should be unlocked before solving`);

    state = step(state, {
      type: ActionType.SubmitDeduction,
      deductionId: d.id,
      answerKey: correctOpt.key,
    });

    const updated = state.mystery!.deductions.find(dd => dd.id === d.id);
    assert(updated!.solved === true, `${d.id} should be solved after submission`);
    assert(updated!.answeredCorrectly === true, `${d.id} should be answered correctly`);
  }

  const allSolved = state.mystery!.deductions.every(d => d.solved);
  const allCorrect = state.mystery!.deductions.every(d => d.answeredCorrectly);
  assert(allSolved, "all deductions should be solved");
  assert(allCorrect, "all deductions should be answered correctly");
}

console.log("\n=== Test 5: Deduction rewards are applied ===");
{
  let state = generate(SEED);

  // Gather evidence
  for (const [, e] of state.entities) {
    if (e.type === EntityType.EvidenceTrace || e.type === EntityType.LogTerminal ||
        e.type === EntityType.CrewItem || e.type === EntityType.Console) {
      state = movePlayerTo(state, e.pos.x - 1, e.pos.y);
      state = step(state, { type: ActionType.Interact, targetId: e.id });
    }
  }

  state = {
    ...state,
    mystery: { ...state.mystery!, objectivePhase: ObjectivePhase.Recover, cleaningDirective: false },
  };

  // Inject missing tags
  const allTags = new Set(state.mystery!.journal.flatMap(j => j.tags));
  const missing: string[] = [];
  for (const d of state.mystery!.deductions) {
    for (const t of d.requiredTags) if (!allTags.has(t)) missing.push(t);
  }
  if (missing.length > 0) {
    state = {
      ...state,
      mystery: {
        ...state.mystery!,
        journal: [
          ...state.mystery!.journal,
          ...missing.map((t, i) => ({
            id: `s_${t}_${i}`, turnDiscovered: 0, category: "trace" as const,
            summary: t, detail: t, crewMentioned: [], roomFound: "x", tags: [t],
          })),
        ],
      },
    };
  }

  // Track rewards for each deduction
  const rewardTypes = state.mystery!.deductions.map(d => d.rewardType);
  console.log(`  Reward types: ${rewardTypes.join(", ")}`);

  const clearanceBefore = state.player.clearanceLevel || 0;
  let patrolDronesBefore = 0;
  for (const [, e] of state.entities) {
    if (e.type === EntityType.PatrolDrone) patrolDronesBefore++;
  }

  // Solve all deductions
  for (const d of state.mystery!.deductions) {
    const correct = d.options.find(o => o.correct);
    if (correct) {
      state = step(state, {
        type: ActionType.SubmitDeduction,
        deductionId: d.id,
        answerKey: correct.key,
      });
    }
  }

  const clearanceAfter = state.player.clearanceLevel || 0;
  let patrolDronesAfter = 0;
  for (const [, e] of state.entities) {
    if (e.type === EntityType.PatrolDrone) patrolDronesAfter++;
  }

  // Check rewards were applied
  if (rewardTypes.includes("clearance")) {
    assert(clearanceAfter > clearanceBefore, "clearance reward should increase clearance level");
  }
  if (rewardTypes.includes("drone_disable")) {
    assert(patrolDronesAfter < patrolDronesBefore, "drone_disable reward should remove a patrol drone");
  }

  // Check reward logs exist
  const hasRewardLog = state.logs.some(l =>
    l.text.includes("Room revealed") || l.text.includes("clearance") ||
    l.text.includes("deactivated") || l.text.includes("Sensor upgrade"));
  assert(hasRewardLog, "reward logs should be present after solving deductions");
}

console.log("\n=== Test 6: DataCore gates on deductions, then grants victory ===");
{
  let state = generate(SEED);

  // Gather evidence and set phase
  for (const [, e] of state.entities) {
    if (e.type === EntityType.EvidenceTrace || e.type === EntityType.LogTerminal ||
        e.type === EntityType.CrewItem || e.type === EntityType.Console) {
      state = movePlayerTo(state, e.pos.x - 1, e.pos.y);
      state = step(state, { type: ActionType.Interact, targetId: e.id });
    }
  }
  state = {
    ...state,
    mystery: { ...state.mystery!, objectivePhase: ObjectivePhase.Recover, cleaningDirective: false },
  };

  // Find DataCore
  let dataCore: Entity | undefined;
  for (const [, e] of state.entities) {
    if (e.type === EntityType.DataCore) { dataCore = e; break; }
  }
  assert(!!dataCore, "DataCore entity should exist");

  // Teleport next to DataCore and try to transmit WITHOUT solving deductions
  state = movePlayerTo(state, dataCore!.pos.x + 1, dataCore!.pos.y);
  state = step(state, { type: ActionType.Interact, targetId: dataCore!.id });
  assert(!state.victory, "should NOT win before solving deductions");
  assert(state.logs.some(l => l.text.includes("deduction") || l.text.includes("incident report")),
    "should get a message about needing deductions");

  // Now solve all deductions
  const allTags = new Set(state.mystery!.journal.flatMap(j => j.tags));
  const missing: string[] = [];
  for (const d of state.mystery!.deductions) {
    for (const t of d.requiredTags) if (!allTags.has(t)) missing.push(t);
  }
  if (missing.length > 0) {
    state = {
      ...state,
      mystery: {
        ...state.mystery!,
        journal: [
          ...state.mystery!.journal,
          ...missing.map((t, i) => ({
            id: `s2_${t}_${i}`, turnDiscovered: 0, category: "trace" as const,
            summary: t, detail: t, crewMentioned: [], roomFound: "x", tags: [t],
          })),
        ],
      },
    };
  }

  for (const d of state.mystery!.deductions) {
    const correct = d.options.find(o => o.correct);
    if (correct) {
      state = step(state, {
        type: ActionType.SubmitDeduction,
        deductionId: d.id,
        answerKey: correct.key,
      });
    }
  }

  assert(state.mystery!.deductions.every(d => d.solved), "all deductions should be solved before transmit");

  // Now interact with DataCore again
  state = movePlayerTo(state, dataCore!.pos.x + 1, dataCore!.pos.y);
  state = step(state, { type: ActionType.Interact, targetId: dataCore!.id });
  assert(state.victory === true, "should achieve victory after all deductions + DataCore interact");
  assert(state.gameOver === true, "gameOver should be true");
  assert(state.logs.some(l => l.text.includes("Uplink locked")), "victory log should mention Uplink");
}

console.log("\n=== Test 7: getValidActionsForState includes SUBMIT_DEDUCTION ===");
{
  let state = generate(SEED);

  // Gather evidence to unlock deduction_what
  for (const [, e] of state.entities) {
    if (e.type === EntityType.EvidenceTrace) {
      state = movePlayerTo(state, e.pos.x - 1, e.pos.y);
      state = step(state, { type: ActionType.Interact, targetId: e.id });
    }
  }

  const allTags = new Set(state.mystery!.journal.flatMap(j => j.tags));
  const hasReactor = allTags.has("reactor");
  assert(hasReactor, "should have reactor tag after interacting with evidence traces");

  const validActions = getValidActionsForState(state);
  const deductionActions = validActions.filter(a => a.action === "SUBMIT_DEDUCTION");
  assert(deductionActions.length > 0, "SUBMIT_DEDUCTION should appear in valid actions");
  console.log(`  Found ${deductionActions.length} SUBMIT_DEDUCTION actions`);
  for (const da of deductionActions) {
    console.log(`    ${da.params?.deductionId} -> ${da.params?.answerKey}`);
  }
}

console.log("\n=== Test 8: Wrong answer still solves (but marks incorrect) ===");
{
  let state = generate(SEED);

  // Gather evidence
  for (const [, e] of state.entities) {
    if (e.type === EntityType.EvidenceTrace) {
      state = movePlayerTo(state, e.pos.x - 1, e.pos.y);
      state = step(state, { type: ActionType.Interact, targetId: e.id });
    }
  }

  // Submit with a wrong answer
  state = step(state, {
    type: ActionType.SubmitDeduction,
    deductionId: "deduction_what",
    answerKey: "wrong_0",
  });

  const d = state.mystery!.deductions.find(d => d.id === "deduction_what");
  assert(d!.solved === true, "deduction should be marked solved even with wrong answer");
  assert(d!.answeredCorrectly === false, "answeredCorrectly should be false for wrong answer");
}

// ── Summary ──────────────────────────────────────────────────────

console.log(`\n=== SUMMARY: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
