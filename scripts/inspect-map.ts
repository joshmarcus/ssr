import { generate } from "../src/sim/procgen.js";
import { GOLDEN_SEED } from "../src/shared/constants.js";

const state = generate(GOLDEN_SEED);

console.log("=== MAP ===");
for (let y = 0; y < state.height; y++) {
  let row = "";
  for (let x = 0; x < state.width; x++) {
    let entityChar: string | null = null;
    for (const [id, e] of state.entities) {
      if (e.pos.x === x && e.pos.y === y) {
        if (id === "player") entityChar = "@";
        else if (e.type === "relay" && id === "relay_main") entityChar = "R";
        else if (e.type === "relay" && id === "locked_door_main") entityChar = "L";
        else if (e.type === "sensor_pickup") entityChar = "S";
        else if (e.type === "data_core") entityChar = "D";
        else if (e.type === "service_bot") entityChar = "B";
        else if (e.type === "log_terminal") entityChar = "T";
      }
    }
    row += entityChar || state.tiles[y][x].glyph;
  }
  console.log(y.toString().padStart(2) + ": " + row);
}

console.log("\nROOMS:");
state.rooms.forEach((r) =>
  console.log(r.id, r.name, `at (${r.x},${r.y}) size ${r.width}x${r.height}`)
);

console.log("\nENTITIES:");
for (const [id, e] of state.entities) {
  console.log(`  ${id} (${e.type}) at (${e.pos.x},${e.pos.y})`, JSON.stringify(e.props));
}

console.log("\nLOCKED DOORS:");
for (let y = 0; y < state.height; y++) {
  for (let x = 0; x < state.width; x++) {
    if (state.tiles[y][x].type === "locked_door") console.log(`  at (${x},${y})`);
  }
}

console.log("\nHEAT:");
for (let y = 0; y < state.height; y++) {
  for (let x = 0; x < state.width; x++) {
    if (state.tiles[y][x].heat > 0)
      console.log(`  at (${x},${y}) heat=${state.tiles[y][x].heat} smoke=${state.tiles[y][x].smoke}`);
  }
}
