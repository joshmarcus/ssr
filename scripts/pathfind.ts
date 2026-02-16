import { generate } from "../src/sim/procgen.js";
import { GOLDEN_SEED } from "../src/shared/constants.js";

const state = generate(GOLDEN_SEED);

type Dir = "north" | "south" | "east" | "west";

function bfs(
  from: { x: number; y: number },
  to: { x: number; y: number }
): Dir[] {
  const visited = new Set<string>();
  const queue: { x: number; y: number; path: Dir[] }[] = [
    { x: from.x, y: from.y, path: [] },
  ];
  visited.add(`${from.x},${from.y}`);

  const dirs: [Dir, number, number][] = [
    ["north", 0, -1],
    ["south", 0, 1],
    ["east", 1, 0],
    ["west", -1, 0],
  ];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr.x === to.x && curr.y === to.y) return curr.path;

    for (const [dir, dx, dy] of dirs) {
      const nx = curr.x + dx;
      const ny = curr.y + dy;
      const key = `${nx},${ny}`;
      if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
      if (visited.has(key)) continue;
      if (!state.tiles[ny][nx].walkable) continue;
      visited.add(key);
      queue.push({ x: nx, y: ny, path: [...curr.path, dir] });
    }
  }
  return [];
}

const playerPos = state.player.entity.pos;
console.log("Player start:", playerPos);

for (const [id, e] of state.entities) {
  if (id === "player") continue;
  const path = bfs(playerPos, e.pos);
  console.log(`${id} at (${e.pos.x},${e.pos.y}): ${path.length} steps`);
}

// Plan the route
console.log("\n--- PLANNED ROUTE ---");

// 1. Read log terminal 0 at (21,13) - 1 step east
console.log("Phase 1: Read log terminal 0 (1 move + 1 interact = 2)");

// 2. From (21,13) go to relay at (12,7), interact adjacent
const pathToRelayAdj = bfs({x:21,y:13}, {x:12,y:8}); // approach from south (adjacent to relay)
console.log(`Phase 2: To relay adj (12,8): ${pathToRelayAdj.length} steps: ${pathToRelayAdj.join(",")}`);

// 3. From relay adj, go to sensor at (34,4)
const pathToSensor = bfs({x:12,y:8}, {x:34,y:4});
console.log(`Phase 3: To sensor: ${pathToSensor.length} steps: ${pathToSensor.join(",")}`);

// 4. From sensor, go to data core adj (approach locked door side)
const pathToDataCore = bfs({x:34,y:4}, {x:33,y:15});
console.log(`Phase 4: To data core: ${pathToDataCore.length} steps`);

// Alternative: go to sensor first, then relay, then data core
console.log("\n--- ALT ROUTE: sensor -> relay -> data core ---");
const p1 = bfs(playerPos, {x:34,y:4}); // player to sensor
const p2 = bfs({x:34,y:4}, {x:12,y:8}); // sensor to relay (adj)
const p3 = bfs({x:12,y:8}, {x:33,y:15}); // relay to data core (via locked door after unlock)

console.log(`Player to sensor: ${p1.length} steps: ${p1.join(",")}`);
console.log(`Sensor to relay(adj 12,8): ${p2.length} steps: ${p2.join(",")}`);
// After relay activation, locked door at (31,15) becomes walkable
console.log(`Relay to data core: ${p3.length} steps (locked door may block)`);

const total = 1 + p1.length + 1 + p2.length + 1 + p3.length + 1;
console.log(`Total: ${total} turns (1 log + ${p1.length} move + 1 pickup + ${p2.length} move + 1 relay + ${p3.length} move + 1 transmit)`);

// Also: player to service bot
const pBot = bfs(playerPos, {x:3,y:20});
console.log(`\nPlayer to service bot: ${pBot.length} steps`);

