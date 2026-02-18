import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { generate } from "../sim/procgen.js";
import { step } from "../sim/step.js";
import { renderToString } from "../render/terminal.js";
import { GOLDEN_SEED } from "../shared/constants.js";
import { parseAction, getValidActionsForState, describeAction } from "./actionParser.js";
import type { GameState } from "../shared/types.js";
import type { HarnessObservation } from "./types.js";

// ── Arg parsing ──────────────────────────────────────────────

interface CliArgs {
  seed: number;
  visibility: "full" | "player";
  maxTurns: number;
  script: string | null;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const opts: CliArgs = {
    seed: GOLDEN_SEED,
    visibility: "full",
    maxTurns: 500,
    script: null,
  };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--seed":
        opts.seed = parseInt(argv[++i], 10);
        if (Number.isNaN(opts.seed)) {
          console.error("ERROR: --seed requires a valid integer");
          process.exit(1);
        }
        break;
      case "--visibility":
        opts.visibility = argv[++i] as "full" | "player";
        if (opts.visibility !== "full" && opts.visibility !== "player") {
          console.error("ERROR: --visibility must be 'full' or 'player'");
          process.exit(1);
        }
        break;
      case "--max-turns":
        opts.maxTurns = parseInt(argv[++i], 10);
        if (Number.isNaN(opts.maxTurns) || opts.maxTurns < 1) {
          console.error("ERROR: --max-turns requires a positive integer");
          process.exit(1);
        }
        break;
      case "--script":
        opts.script = argv[++i];
        break;
      default:
        console.error(`WARNING: Unknown argument "${argv[i]}"`);
        break;
    }
  }

  return opts;
}

// ── Observation building ─────────────────────────────────────

/**
 * Try to use the dedicated observation renderer if it exists.
 * Falls back to a basic observation built from renderToString.
 */
let obsRenderer: {
  buildObservation: (state: GameState, visibility: "full" | "player") => HarnessObservation;
  renderObservationAsText: (obs: HarnessObservation) => string;
} | null = null;

// Dynamic import for the optional obsRenderer module.
// If it doesn't exist yet, we use the fallback below.
try {
  obsRenderer = await import("./obsRenderer.js");
} catch {
  obsRenderer = null;
}

/**
 * Fallback observation: simple text rendering when obsRenderer is not available.
 */
function buildFallbackObservation(state: GameState, visibility: "full" | "player"): string {
  const lines: string[] = [];
  const p = state.player;

  lines.push(`Turn: ${state.turn}`);
  lines.push(`HP: ${p.hp}/${p.maxHp}`);
  lines.push(`Position: (${p.entity.pos.x}, ${p.entity.pos.y})`);
  lines.push(`Game Over: ${state.gameOver}  Victory: ${state.victory}`);
  if (p.stunTurns > 0) {
    lines.push(`STUNNED: ${p.stunTurns} turns remaining`);
  }

  // Find current room
  const room = state.rooms.find(r =>
    p.entity.pos.x >= r.x && p.entity.pos.x < r.x + r.width
    && p.entity.pos.y >= r.y && p.entity.pos.y < r.y + r.height
  );
  if (room) {
    lines.push(`Room: ${room.name}`);
  }

  // Sensors
  const sensors = p.sensors ?? [];
  if (sensors.length > 0) {
    lines.push(`Sensors: ${sensors.join(", ")}`);
  }

  // Recent logs (last 5)
  const recentLogs = state.logs.slice(-5);
  if (recentLogs.length > 0) {
    lines.push("");
    lines.push("--- Recent Logs ---");
    for (const log of recentLogs) {
      lines.push(`  [${log.source}] ${log.text}`);
    }
  }

  // Valid actions
  const validActions = getValidActionsForState(state);
  lines.push("");
  lines.push("--- Valid Actions ---");
  for (const va of validActions) {
    const desc = describeAction(va);
    lines.push(`  ${JSON.stringify(va)}  // ${desc}`);
  }

  // Map (use visibility setting — in fallback mode we always show full)
  lines.push("");
  lines.push("--- Map ---");
  if (visibility === "full") {
    lines.push(renderToString(state));
  } else {
    // Player visibility: only show explored tiles
    for (let y = 0; y < state.height; y++) {
      let row = "";
      for (let x = 0; x < state.width; x++) {
        if (state.player.entity.pos.x === x && state.player.entity.pos.y === y) {
          row += "@";
        } else if (state.tiles[y][x].visible) {
          row += state.tiles[y][x].glyph;
        } else if (state.tiles[y][x].explored) {
          row += ".";
        } else {
          row += " ";
        }
      }
      lines.push(row);
    }
  }

  return lines.join("\n");
}

/**
 * Emit the observation block to stdout, delimited for agent parsing.
 */
function emitObservation(state: GameState, visibility: "full" | "player"): void {
  console.log("===OBSERVATION_START===");

  if (obsRenderer) {
    const obs = obsRenderer.buildObservation(state, visibility);
    console.log(obsRenderer.renderObservationAsText(obs));
  } else {
    console.log(buildFallbackObservation(state, visibility));
  }

  console.log("===OBSERVATION_END===");
}

// ── Game summary ─────────────────────────────────────────────

function printSummary(state: GameState): void {
  const p = state.player;

  // Count visited rooms (rooms where any tile has been explored)
  let roomsVisited = 0;
  for (const room of state.rooms) {
    let visited = false;
    for (let y = room.y; y < room.y + room.height && !visited; y++) {
      for (let x = room.x; x < room.x + room.width && !visited; x++) {
        if (y >= 0 && y < state.height && x >= 0 && x < state.width) {
          if (state.tiles[y][x].explored) {
            visited = true;
          }
        }
      }
    }
    if (visited) roomsVisited++;
  }

  // Count evidence found
  const evidenceFound = state.mystery?.discoveredEvidence.size ?? 0;

  console.log("");
  console.log("=== GAME OVER ===");
  console.log(`Result: ${state.victory ? "VICTORY" : "DEFEAT"}`);
  console.log(`Turns: ${state.turn}`);
  console.log(`HP: ${p.hp}/${p.maxHp}`);
  console.log(`Rooms visited: ${roomsVisited}/${state.rooms.length}`);
  console.log(`Evidence found: ${evidenceFound}`);
}

// ── Script mode ──────────────────────────────────────────────

async function runScript(
  scriptPath: string,
  state: GameState,
  visibility: "full" | "player",
  maxTurns: number,
): Promise<void> {
  let rawLines: string[];
  try {
    const content = readFileSync(scriptPath, "utf-8");
    rawLines = content.split("\n").map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith("//"));
  } catch (err) {
    console.error(`ERROR: Could not read script file "${scriptPath}": ${err}`);
    process.exit(1);
  }

  emitObservation(state, visibility);

  for (const line of rawLines) {
    if (state.gameOver) break;
    if (state.turn >= maxTurns) {
      console.log(`MAX TURNS (${maxTurns}) reached.`);
      break;
    }

    const result = parseAction(line);
    if ("error" in result) {
      console.log(`===ERROR=== ${result.error}`);
      continue;
    }

    state = step(state, result);
    emitObservation(state, visibility);
  }

  printSummary(state);
}

// ── Interactive stdin mode ───────────────────────────────────

async function runInteractive(
  state: GameState,
  visibility: "full" | "player",
  maxTurns: number,
): Promise<void> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  emitObservation(state, visibility);

  for await (const line of rl) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;

    // Allow quit command
    if (trimmed.toLowerCase() === "quit" || trimmed.toLowerCase() === "exit") {
      console.log("Agent requested exit.");
      printSummary(state);
      process.exit(0);
    }

    const result = parseAction(trimmed);
    if ("error" in result) {
      console.log(`===ERROR=== ${result.error}`);
      // Re-emit observation so the agent can try again
      emitObservation(state, visibility);
      continue;
    }

    state = step(state, result);
    emitObservation(state, visibility);

    if (state.gameOver) {
      printSummary(state);
      process.exit(state.victory ? 0 : 1);
    }

    if (state.turn >= maxTurns) {
      console.log(`MAX TURNS (${maxTurns}) reached.`);
      printSummary(state);
      process.exit(1);
    }
  }

  // stdin closed (pipe ended)
  console.log("stdin closed.");
  printSummary(state);
}

// ── Main ─────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs();

  console.log(`SSR Harness v0.1`);
  console.log(`Seed: ${args.seed}  Visibility: ${args.visibility}  Max turns: ${args.maxTurns}`);
  if (args.script) {
    console.log(`Script: ${args.script}`);
  }
  console.log("");

  let state = generate(args.seed);

  if (args.script) {
    await runScript(args.script, state, args.visibility, args.maxTurns);
  } else {
    await runInteractive(state, args.visibility, args.maxTurns);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
