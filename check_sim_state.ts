import { generate } from "./src/sim/procgen.js";
import { step } from "./src/sim/step.js";
import { GOLDEN_SEED } from "./src/shared/constants.js";
import { ActionType, Direction } from "./src/shared/types.js";
import type { GameState, Action } from "./src/shared/types.js";
import * as fs from "fs";

// Load and replay the playtest script
const state = generate(GOLDEN_SEED);
const lines = fs.readFileSync("playtest.jsonl", "utf-8").trim().split("\n");

const DIR_MAP: Record<string, Direction> = {
  N: Direction.North, S: Direction.South, E: Direction.East, W: Direction.West,
  NE: Direction.NorthEast, NW: Direction.NorthWest, SE: Direction.SouthEast, SW: Direction.SouthWest,
};

let simState = state;

function bfsFrom(s: GameState, sx: number, sy: number): Set<string> {
  const key = (x: number, y: number) => `${x},${y}`;
  const dirs: [number, number][] = [[0,-1],[0,1],[1,0],[-1,0],[1,-1],[-1,-1],[1,1],[-1,1]];
  const visited = new Set<string>();
  const queue: {x: number; y: number}[] = [{x: sx, y: sy}];
  visited.add(key(sx, sy));
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || nx >= s.width || ny < 0 || ny >= s.height) continue;
      if (visited.has(key(nx, ny))) continue;
      if (!s.tiles[ny][nx].walkable) continue;
      if (dx !== 0 && dy !== 0) {
        if (!s.tiles[cur.y][cur.x + dx].walkable || !s.tiles[cur.y + dy][cur.x].walkable) continue;
      }
      visited.add(key(nx, ny));
      queue.push({x: nx, y: ny});
    }
  }
  return visited;
}

// Replay actions up to line 114 (relay_p03 interact) which is around T122
for (let i = 0; i < Math.min(lines.length, 114); i++) {
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
}

const px = simState.player.entity.pos.x;
const py = simState.player.entity.pos.y;
console.error(`After T${simState.turn}, player at (${px},${py})`);

const reachable = bfsFrom(simState, px, py);
console.error(`Reachable tiles: ${reachable.size}`);

const key = (x: number, y: number) => `${x},${y}`;
console.error(`Breach (50,30) reachable? ${reachable.has(key(50, 30))}`);
console.error(`Breach (63,25) reachable? ${reachable.has(key(63, 25))}`);

// Check what tiles changed walkability since start
let changedCount = 0;
const initialState = generate(GOLDEN_SEED);
for (let y = 0; y < simState.height; y++) {
  for (let x = 0; x < simState.width; x++) {
    if (simState.tiles[y][x].walkable !== initialState.tiles[y][x].walkable) {
      changedCount++;
      if (!simState.tiles[y][x].walkable && initialState.tiles[y][x].walkable) {
        const tile = simState.tiles[y][x];
        const initTile = initialState.tiles[y][x];
        console.error(`  BLOCKED: (${x},${y}) type=${tile.type} (was ${initTile.type}) stress=${tile.stress.toFixed(1)} pressure=${tile.pressure.toFixed(0)} stressTurns=${tile.stressTurns}`);
      }
    }
  }
}
console.error(`\nTiles with changed walkability: ${changedCount}`);

// Check doors
console.error(`\nDoor states at T${simState.turn}:`);
for (const [id, e] of simState.entities) {
  if (e.type.includes("door") || e.type === "closed_door") {
    console.error(`  ${id} type=${e.type} pos=(${e.pos.x},${e.pos.y}) walkable=${simState.tiles[e.pos.y][e.pos.x].walkable} props=${JSON.stringify(e.props)}`);
  }
}
