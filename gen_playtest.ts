import { generate } from "./src/sim/procgen.js";
import { step } from "./src/sim/step.js";
import { GOLDEN_SEED } from "./src/shared/constants.js";
import { ActionType, Direction, EntityType, TileType } from "./src/shared/types.js";
import type { GameState, Action } from "./src/shared/types.js";

const state = generate(GOLDEN_SEED);

// Check if a non-walkable tile can be bumped through (unlocked door or auto-sealed bulkhead)
function isPassable(s: GameState, x: number, y: number): boolean {
  const tile = s.tiles[y][x];
  if (tile.walkable) return true;
  // Auto-sealed bulkhead: LockedDoor tile with no entity
  if (tile.type === TileType.LockedDoor) {
    let hasEntity = false;
    for (const [, e] of s.entities) {
      if (e.pos.x === x && e.pos.y === y) { hasEntity = true; break; }
    }
    if (!hasEntity) return true;
  }
  // Unlocked closed door entity
  for (const [, e] of s.entities) {
    if (e.type === EntityType.ClosedDoor && e.pos.x === x && e.pos.y === y &&
        e.props["closed"] === true && e.props["locked"] !== true) {
      return true;
    }
  }
  return false;
}

// BFS pathfinder
function findPath(s: GameState, sx: number, sy: number, tx: number, ty: number): string[] | null {
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
      if (nx < 0 || nx >= s.width || ny < 0 || ny >= s.height) continue;
      const k = key(nx, ny);
      if (visited.has(k)) continue;
      const tile = s.tiles[ny][nx];
      if (!tile.walkable && !isPassable(s, nx, ny)) continue;
      if (dx !== 0 && dy !== 0) {
        const t1 = s.tiles[cur.y][cur.x + dx];
        const t2 = s.tiles[cur.y + dy][cur.x];
        if ((!t1.walkable && !isPassable(s, cur.x + dx, cur.y)) ||
            (!t2.walkable && !isPassable(s, cur.x, cur.y + dy))) continue;
      }
      visited.add(k);
      queue.push({ x: nx, y: ny, path: [...cur.path, dir] });
    }
  }
  return null;
}

// Find path to adjacent walkable tile of target
function findPathAdjacent(s: GameState, sx: number, sy: number, tx: number, ty: number): { path: string[], endX: number, endY: number } | null {
  const adjacents: [number, number][] = [
    [tx, ty-1], [tx, ty+1], [tx-1, ty], [tx+1, ty],
  ];
  let best: { path: string[], endX: number, endY: number } | null = null;
  for (const [ax, ay] of adjacents) {
    if (ax < 0 || ax >= s.width || ay < 0 || ay >= s.height) continue;
    if (!s.tiles[ay][ax].walkable) continue;
    const path = findPath(s, sx, sy, ax, ay);
    if (path && (!best || path.length < best.path.length)) {
      best = { path, endX: ax, endY: ay };
    }
  }
  return best;
}

// Direction string to action
const DIR_MAP: Record<string, Direction> = {
  N: Direction.North, S: Direction.South, E: Direction.East, W: Direction.West,
  NE: Direction.NorthEast, NW: Direction.NorthWest, SE: Direction.SouthEast, SW: Direction.SouthWest,
};

function getRoomAt(s: GameState, x: number, y: number) {
  return s.rooms.find(r => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height);
}

function getRoomCleanliness(s: GameState, roomName: string) {
  const room = s.rooms.find(r => r.name === roomName);
  if (!room) return 100;
  let total = 0, count = 0;
  for (let y = room.y; y < room.y + room.height; y++) {
    for (let x = room.x; x < room.x + room.width; x++) {
      if (x >= 0 && x < s.width && y >= 0 && y < s.height) {
        const tile = s.tiles[y][x];
        if (tile.walkable) {
          const dirt = (tile as any).dirt ?? 0;
          total += Math.max(0, 100 - dirt);
          count++;
        }
      }
    }
  }
  return count > 0 ? Math.round(total / count) : 100;
}

// Build the route with simulation
interface Stop {
  name: string;
  x: number;
  y: number;
  interact: string;
  adjacent?: boolean;
}

const stops: Stop[] = [
  // Phase 1: Sensors + nearby evidence in Comms Hub
  { name: "atmospheric sensor", x: 39, y: 24, interact: "sensor_atmospheric", adjacent: true },
  { name: "evidence trace 2", x: 39, y: 25, interact: "evidence_trace_2" },
  { name: "log terminal 7", x: 41, y: 25, interact: "log_terminal_7" },
  { name: "structural sensor", x: 39, y: 26, interact: "sensor_structural", adjacent: true },
  { name: "em sensor", x: 41, y: 24, interact: "sensor_em_signal", adjacent: true },
  { name: "log terminal 4", x: 34, y: 22, interact: "log_terminal_4" },

  // Phase 2: Go west to activate relays (grab evidence on the way)
  { name: "log terminal 10", x: 32, y: 10, interact: "log_terminal_10" },
  { name: "relay p04", x: 31, y: 6, interact: "relay_p04", adjacent: true },
  { name: "log terminal 12", x: 25, y: 17, interact: "log_terminal_12" },
  { name: "relay p03", x: 13, y: 19, interact: "relay_p03", adjacent: true },

  // Phase 3: Go east to seal breaches and activate last relay
  { name: "breach 1", x: 50, y: 30, interact: "breach_1", adjacent: true },
  { name: "breach 0", x: 63, y: 25, interact: "breach_0", adjacent: true },
  { name: "relay p01", x: 60, y: 14, interact: "relay_p01", adjacent: true },

  // Phase 4: Cargo hold (now have 3 relays + breaches sealed)
  { name: "cargo hold env lock", x: 56, y: 7, interact: "cargo_hold_env_lock", adjacent: true },
  { name: "crew tanaka", x: 57, y: 6, interact: "crew_npc_crew_tanaka" },

  // Phase 5: Lead crew west to data core + escape pods
  { name: "data core", x: 6, y: 21, interact: "data_core", adjacent: true },
  { name: "escape pod 0", x: 6, y: 9, interact: "escape_pod_0", adjacent: true },
];

const actions: string[] = [];
let simState: GameState = state;
let cx = 34, cy = 18;
let lastRoom = "";

function emit(line: string) { actions.push(line); }
function emitMove(dir: string) { emit(`{"action": "MOVE", "params": {"dir": "${dir}"}}`); }
function emitInteract(id: string) { emit(`{"action": "INTERACT", "params": {"target": "${id}"}}`); }
function emitClean() { emit(`{"action": "CLEAN"}`); }
function emitLook() { emit(`{"action": "LOOK"}`); }

function applyAction(a: Action): void {
  simState = step(simState, a);
}

for (const stop of stops) {
  let path: string[] | null;
  let endX: number, endY: number;

  if (stop.adjacent) {
    const result = findPathAdjacent(simState, cx, cy, stop.x, stop.y);
    if (!result) {
      const directPath = findPath(simState, cx, cy, stop.x, stop.y);
      if (directPath) {
        path = directPath;
        endX = stop.x;
        endY = stop.y;
      } else {
        console.error(`NO PATH to ${stop.name} at (${stop.x},${stop.y}) from (${cx},${cy})`);
        continue;
      }
    } else {
      path = result.path;
      endX = result.endX;
      endY = result.endY;
    }
  } else {
    path = findPath(simState, cx, cy, stop.x, stop.y);
    if (!path) {
      console.error(`NO PATH to ${stop.name} at (${stop.x},${stop.y}) from (${cx},${cy})`);
      continue;
    }
    endX = stop.x;
    endY = stop.y;
  }

  // Execute path with cleaning at room boundaries
  for (const dir of path!) {
    const direction = DIR_MAP[dir];
    const delta = getDelta(dir);
    const newX = cx + delta.x;
    const newY = cy + delta.y;

    // Check if we're entering a new room
    const curRoom = getRoomAt(simState, cx, cy);
    const destRoom = getRoomAt(simState, newX, newY);

    // If we're in a room and about to leave, check cleanliness
    if (curRoom && (!destRoom || destRoom.id !== curRoom.id)) {
      const cl = getRoomCleanliness(simState, curRoom.name);
      if (cl < 80 && simState.mystery?.cleaningDirective) {
        // Need to clean before leaving
        let cleanCount = 0;
        while (cleanCount < 40) {
          const clNow = getRoomCleanliness(simState, curRoom.name);
          if (clNow >= 80) break;
          emitClean();
          applyAction({ type: ActionType.Clean });
          cx = simState.player.entity.pos.x;
          cy = simState.player.entity.pos.y;
          cleanCount++;
        }
      }
    }

    emitMove(dir);
    applyAction({ type: ActionType.Move, direction });
    cx = simState.player.entity.pos.x;
    cy = simState.player.entity.pos.y;
  }

  // Interact
  emitInteract(stop.interact);
  applyAction({ type: ActionType.Interact, targetId: stop.interact });
  emitLook();
  applyAction({ type: ActionType.Look });

  cx = simState.player.entity.pos.x;
  cy = simState.player.entity.pos.y;

  console.error(`  [T${simState.turn}] ${stop.name} @ (${cx},${cy}) HP=${simState.player.hp} Integrity=${simState.stationIntegrity.toFixed(1)}%`);
}

// Output script
console.log(actions.join("\n"));
console.error(`\nTotal actions: ${actions.length} (turns ~${simState.turn})`);
console.error(`Final state: HP=${simState.player.hp} Integrity=${simState.stationIntegrity.toFixed(1)}% GameOver=${simState.gameOver}`);

function getDelta(dir: string): { x: number; y: number } {
  const d: Record<string, { x: number; y: number }> = {
    N: { x: 0, y: -1 }, S: { x: 0, y: 1 }, E: { x: 1, y: 0 }, W: { x: -1, y: 0 },
    NE: { x: 1, y: -1 }, NW: { x: -1, y: -1 }, SE: { x: 1, y: 1 }, SW: { x: -1, y: 1 },
  };
  return d[dir];
}
