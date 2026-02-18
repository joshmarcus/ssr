import { generate } from "./src/sim/procgen.js";
import { GOLDEN_SEED } from "./src/shared/constants.js";

const state = generate(GOLDEN_SEED);

// Full station walkability map
console.log("WALKABILITY MAP (. = walkable, # = blocked, @ = player, E = entity):");
for (let y = 0; y < state.height; y++) {
  let row = `${y.toString().padStart(2)} `;
  for (let x = 0; x < state.width; x++) {
    const tile = state.tiles[y][x];
    if (x === 34 && y === 18) {
      row += "@";
    } else {
      const ents = Array.from(state.entities.values()).filter(e => e.pos.x === x && e.pos.y === y);
      if (ents.length > 0) {
        row += tile.walkable ? "e" : "X";
      } else {
        row += tile.walkable ? "." : "#";
      }
    }
  }
  console.log(row);
}
