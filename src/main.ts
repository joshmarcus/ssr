import { generate } from "./sim/procgen.js";
import { renderToString } from "./render/terminal.js";
import { GOLDEN_SEED } from "./shared/constants.js";

const seed = GOLDEN_SEED;
const state = generate(seed);
console.log(renderToString(state));
console.log("\nSpace Station Roguelike — v0.1.0");
console.log("Seed:", seed);
