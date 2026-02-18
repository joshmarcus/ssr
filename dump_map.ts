import { generate } from "./src/sim/procgen.js";
import { GOLDEN_SEED } from "./src/shared/constants.js";
import { TileType, EntityType } from "./src/shared/types.js";

const state = generate(GOLDEN_SEED);

// Print rooms
console.log("=== ROOMS ===");
for (const room of state.rooms) {
  console.log(`  ${room.name} (${room.zone ?? "?"}) @ (${room.x},${room.y}) ${room.width}x${room.height}`);
}

// Print entities with positions
console.log("\n=== KEY ENTITIES ===");
for (const [id, e] of state.entities) {
  if (id === "player") continue;
  console.log(`  ${id.padEnd(30)} ${e.type.padEnd(20)} (${e.pos.x},${e.pos.y})`);
}

// Print full ASCII map
console.log("\n=== FULL MAP ===");
console.log(`Size: ${state.width}x${state.height}`);

// Build entity position lookup
const entityAt = new Map<string, string>();
for (const [id, e] of state.entities) {
  const key = `${e.pos.x},${e.pos.y}`;
  if (id === "player") {
    entityAt.set(key, "@");
  } else if (!entityAt.has(key) || id === "player") {
    // Simple glyph mapping
    const g: Record<string, string> = {
      relay: "R", sensor_pickup: "?", data_core: "D", service_bot: "B",
      log_terminal: "L", closed_door: "d", crew_item: "c", med_kit: "+",
      repair_bot: "r", patrol_drone: "P", drone: "o", breach: "!",
      pressure_valve: "V", fuse_box: "F", power_cell: "p", evidence_trace: "E",
      radiation_source: "☢", shield_generator: "G", reinforcement_panel: "H",
      signal_booster: "b", hidden_device: "h", escape_pod: "e", crew_npc: "N",
      repair_cradle: "C", security_terminal: "T", console: "K",
    };
    entityAt.set(key, g[e.type] ?? "?");
  }
}

// Column headers (tens digit)
let header1 = "    ";
let header2 = "    ";
for (let x = 0; x < state.width; x++) {
  header1 += (x % 10 === 0) ? Math.floor(x / 10).toString() : " ";
  header2 += (x % 10).toString();
}
console.log(header1);
console.log(header2);

for (let y = 0; y < state.height; y++) {
  let row = y.toString().padStart(3) + " ";
  for (let x = 0; x < state.width; x++) {
    const key = `${x},${y}`;
    if (entityAt.has(key)) {
      row += entityAt.get(key);
    } else {
      const t = state.tiles[y][x];
      switch (t.type) {
        case TileType.Floor: row += "."; break;
        case TileType.Wall: row += "#"; break;
        case TileType.Door: row += "+"; break;
        case TileType.LockedDoor: row += "X"; break;
        case TileType.Corridor: row += "."; break;
        default: row += " "; break;
      }
    }
  }
  console.log(row);
}
