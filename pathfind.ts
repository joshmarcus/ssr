import { generate } from "./src/sim/procgen.js";
import { GOLDEN_SEED } from "./src/shared/constants.js";

const state = generate(GOLDEN_SEED);

// BFS pathfinder
function findPath(sx: number, sy: number, tx: number, ty: number): string[] | null {
  const key = (x: number, y: number) => `${x},${y}`;
  const visited = new Set<string>();
  const dirs: [string, number, number][] = [
    ["N", 0, -1], ["S", 0, 1], ["E", 1, 0], ["W", -1, 0],
    ["NE", 1, -1], ["NW", -1, -1], ["SE", 1, 1], ["SW", -1, 1],
  ];

  interface Node { x: number; y: number; path: string[] }
  const queue: Node[] = [{ x: sx, y: sy, path: [] }];
  visited.add(key(sx, sy));

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.x === tx && cur.y === ty) return cur.path;

    for (const [dir, dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
      const k = key(nx, ny);
      if (visited.has(k)) continue;

      // Check walkability - allow doors (they're walkable) but skip non-walkable
      const tile = state.tiles[ny][nx];
      if (!tile.walkable) continue;

      // For diagonal moves, check that both cardinal neighbors are walkable
      if (dx !== 0 && dy !== 0) {
        const t1 = state.tiles[cur.y][cur.x + dx];
        const t2 = state.tiles[cur.y + dy][cur.x];
        if (!t1.walkable || !t2.walkable) continue;
      }

      visited.add(k);
      queue.push({ x: nx, y: ny, path: [...cur.path, dir] });
    }
  }
  return null;
}

// Key destinations
const targets: [string, number, number][] = [
  // Sensors
  ["sensor_atmospheric (39,24)", 39, 24],
  ["sensor_structural (39,26)", 39, 26],
  ["sensor_em_signal (41,24)", 41, 24],
  ["sensor_radiation (28,31)", 28, 31],
  ["sensor_thermal (60,2)", 60, 2],

  // Relays
  ["relay_p04 (31,6)", 31, 6],
  ["relay_p03 (13,19)", 13, 19],
  ["relay_p01 (60,14)", 60, 14],

  // Breaches
  ["breach_0 (63,25)", 63, 25],
  ["breach_1 (50,30)", 50, 30],

  // Crew rescue
  ["cargo_hold_env_lock (56,7)", 56, 7],
  ["escape_pod_0 (6,9)", 6, 9],

  // Objectives
  ["data_core (6,21)", 6, 21],

  // Key interactions
  ["repair_cradle_0 (55,25)", 55, 25],
  ["log_terminal_4 (34,22)", 34, 22],
  ["service_bot (25,23)", 25, 23],
];

const start = { x: 34, y: 18 };
console.log(`Starting from player position (${start.x}, ${start.y})\n`);

for (const [name, tx, ty] of targets) {
  const path = findPath(start.x, start.y, tx, ty);
  if (path) {
    console.log(`${name}: ${path.length} steps`);
    console.log(`  ${path.join(" ")}`);
  } else {
    console.log(`${name}: NO PATH FOUND`);
  }
  console.log();
}

// Now find an efficient multi-destination tour
// Greedy: from start, go to nearest unvisited, repeat
console.log("=== GREEDY TOUR ===");
const tourTargets: [string, number, number][] = [
  // Must-hit: sensors, relays, breaches, key interactions, data core
  ["sensor_atmospheric", 39, 24],
  ["sensor_structural", 39, 26],
  ["sensor_em_signal", 41, 24],
  ["relay_p04", 31, 6],
  ["relay_p03", 13, 19],
  ["breach_1", 50, 30],
  ["breach_0", 63, 25],
  ["relay_p01", 60, 14],
  ["cargo_hold_env_lock", 56, 7],
  ["data_core", 6, 21],
  ["escape_pod_0", 6, 9],
];

let cx = start.x, cy = start.y;
let totalSteps = 0;
const fullRoute: string[] = [];
const remaining = [...tourTargets];

while (remaining.length > 0) {
  // Find nearest unvisited
  let bestIdx = -1;
  let bestPath: string[] | null = null;
  let bestDist = Infinity;

  for (let i = 0; i < remaining.length; i++) {
    const [, tx, ty] = remaining[i];
    const path = findPath(cx, cy, tx, ty);
    if (path && path.length < bestDist) {
      bestDist = path.length;
      bestPath = path;
      bestIdx = i;
    }
  }

  if (bestIdx === -1) {
    console.log("No path to any remaining target!");
    break;
  }

  const [name, tx, ty] = remaining[bestIdx];
  remaining.splice(bestIdx, 1);
  totalSteps += bestPath!.length;
  fullRoute.push(...bestPath!);
  fullRoute.push(`INTERACT_${name}`);
  cx = tx; cy = ty;
  console.log(`  → ${name} (${tx},${ty}): ${bestPath!.length} steps (total: ${totalSteps})`);
}

console.log(`\nTotal movement steps: ${totalSteps}`);
console.log(`Full route has ${fullRoute.length} actions`);
