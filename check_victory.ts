import { generate } from "./src/sim/procgen.js";
import { step } from "./src/sim/step.js";
import { GOLDEN_SEED } from "./src/shared/constants.js";
import { ActionType, Direction } from "./src/shared/types.js";
import type { GameState, Action } from "./src/shared/types.js";
import * as fs from "fs";

const state = generate(GOLDEN_SEED);
const lines = fs.readFileSync("playtest.jsonl", "utf-8").trim().split("\n");

const DIR_MAP: Record<string, Direction> = {
  N: Direction.North, S: Direction.South, E: Direction.East, W: Direction.West,
  NE: Direction.NorthEast, NW: Direction.NorthWest, SE: Direction.SouthEast, SW: Direction.SouthWest,
};

let simState: GameState = state;

for (let i = 0; i < lines.length; i++) {
  const parsed = JSON.parse(lines[i]);
  let action: Action;
  if (parsed.action === "MOVE") {
    action = { type: ActionType.Move, direction: DIR_MAP[parsed.params.dir] };
  } else if (parsed.action === "INTERACT") {
    action = { type: ActionType.Interact, targetId: parsed.params.target };
  } else if (parsed.action === "CLEAN") {
    action = { type: ActionType.Clean };
  } else if (parsed.action === "LOOK") {
    action = { type: ActionType.Look };
  } else {
    action = { type: ActionType.Wait };
  }
  simState = step(simState, action);
  if (simState.gameOver) {
    console.error(`\nGAME OVER at action ${i + 1}, turn ${simState.turn}`);
    console.error(`Victory: ${simState.victory}`);
    console.error(`HP: ${simState.player.hp}`);
    console.error(`Integrity: ${simState.stationIntegrity.toFixed(1)}%`);
    console.error(`Phase: ${simState.mystery?.objectivePhase}`);
    console.error(`Journal entries: ${simState.mystery?.journal.length}`);
    console.error(`Evidence threshold: ${simState.mystery?.evidenceThreshold}`);
    // Show last few logs
    const recentLogs = simState.logs.slice(-5);
    console.error(`\nRecent logs:`);
    for (const log of recentLogs) {
      console.error(`  [${log.source}] ${log.text}`);
    }
    break;
  }
}

if (!simState.gameOver) {
  console.error(`\nGame NOT over after ${lines.length} actions`);
  console.error(`Turn: ${simState.turn}, HP: ${simState.player.hp}, Integrity: ${simState.stationIntegrity.toFixed(1)}%`);
  console.error(`Phase: ${simState.mystery?.objectivePhase}`);
  console.error(`Journal: ${simState.mystery?.journal.length}/${simState.mystery?.evidenceThreshold}`);
}
