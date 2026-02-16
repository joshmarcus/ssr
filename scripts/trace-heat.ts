import { generate } from "../src/sim/procgen.js";
import { step } from "../src/sim/step.js";
import { GOLDEN_SEED } from "../src/shared/constants.js";
import { ActionType } from "../src/shared/types.js";
import type { Action, GameState } from "../src/shared/types.js";

let state = generate(GOLDEN_SEED);

function printHeat(s: GameState, turn: number) {
  console.log(`\n=== Turn ${turn} heat ===`);
  for (let y = 0; y < s.height; y++) {
    let row = "";
    for (let x = 0; x < s.width; x++) {
      const h = s.tiles[y][x].heat;
      if (!s.tiles[y][x].walkable && s.tiles[y][x].type !== "locked_door") {
        row += "  #";
      } else if (h === 0) {
        row += "  .";
      } else {
        row += h.toString().padStart(3);
      }
    }
    console.log(y.toString().padStart(2) + ":" + row);
  }
}

printHeat(state, 0);

// Simulate 20 wait actions
for (let i = 0; i < 20; i++) {
  state = step(state, { type: ActionType.Wait });
  if ((i + 1) % 5 === 0) {
    printHeat(state, i + 1);
  }
}
