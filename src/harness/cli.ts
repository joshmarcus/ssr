import { generate } from "../sim/procgen.js";
import { step } from "../sim/step.js";
import { renderToString } from "../render/terminal.js";
import { GOLDEN_SEED } from "../shared/constants.js";
import type { Action } from "../shared/types.js";

/**
 * Headless CLI runner for agent playtesting and CI.
 * Usage: tsx src/harness/cli.ts [--seed N] [--script path.json]
 */
const args = process.argv.slice(2);
const seedIdx = args.indexOf("--seed");
const seed = seedIdx >= 0 ? parseInt(args[seedIdx + 1], 10) : GOLDEN_SEED;

let state = generate(seed);
console.log(renderToString(state));
console.log("--- Headless harness ready (seed:", seed, ") ---");
