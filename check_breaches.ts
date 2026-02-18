import { generate } from "./src/sim/procgen.js";
import { GOLDEN_SEED } from "./src/shared/constants.js";

const s = generate(GOLDEN_SEED);

const key = (x: number, y: number) => `${x},${y}`;
const dirs: [number, number][] = [[0,-1],[0,1],[1,0],[-1,0],[1,-1],[-1,-1],[1,1],[-1,1]];

function bfsFrom(sx: number, sy: number): Set<string> {
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

const fromStart = bfsFrom(34, 18);
console.error(`From start (34,18): ${fromStart.size} tiles reachable`);

const breaches: {id: string; pos: {x: number; y: number}}[] = [];
const doors: {id: string; pos: {x: number; y: number}; props: any}[] = [];
for (const [id, e] of s.entities) {
  if (id.startsWith("breach")) breaches.push({id, pos: e.pos});
  if (e.type === "closed_door" || e.type === "door" || (e.props && e.props.locked !== undefined)) {
    doors.push({id, pos: e.pos, props: e.props});
  }
}

console.error(`\nFound ${breaches.length} breaches, ${doors.length} doors`);

for (const b of breaches) {
  console.error(`\nBreach: ${b.id} pos=(${b.pos.x},${b.pos.y})`);
  console.error(`  tile walkable? ${s.tiles[b.pos.y][b.pos.x].walkable}`);
  console.error(`  reachable from start? ${fromStart.has(key(b.pos.x, b.pos.y))}`);
  for (const [dx, dy] of [[0,-1],[0,1],[1,0],[-1,0]]) {
    const ax = b.pos.x + dx, ay = b.pos.y + dy;
    if (ax >= 0 && ax < s.width && ay >= 0 && ay < s.height) {
      console.error(`  adj(${ax},${ay}) walkable=${s.tiles[ay][ax].walkable} reachable=${fromStart.has(key(ax, ay))}`);
    }
  }
}

for (const d of doors) {
  console.error(`\nDoor: ${d.id} pos=(${d.pos.x},${d.pos.y}) props=${JSON.stringify(d.props)}`);
  console.error(`  tile walkable? ${s.tiles[d.pos.y][d.pos.x].walkable}`);
  console.error(`  reachable from start? ${fromStart.has(key(d.pos.x, d.pos.y))}`);
}

// Also check: from relay_p03 location (14,19)
const fromP03 = bfsFrom(14, 19);
console.error(`\nFrom relay_p03 (14,19): ${fromP03.size} tiles reachable`);
for (const b of breaches) {
  console.error(`  ${b.id} reachable? ${fromP03.has(key(b.pos.x, b.pos.y))}`);
}

// Check all rooms
console.error(`\nRooms:`);
for (const r of s.rooms) {
  const center = { x: r.x + Math.floor(r.width / 2), y: r.y + Math.floor(r.height / 2) };
  const reachable = fromStart.has(key(center.x, center.y));
  console.error(`  ${r.name} (${r.x},${r.y}) ${r.width}x${r.height} reachable=${reachable}`);
}

// Check all entity types
console.error(`\nAll entity types:`);
const typeCounts: Record<string, number> = {};
for (const [id, e] of s.entities) {
  const t = e.type;
  typeCounts[t] = (typeCounts[t] || 0) + 1;
}
for (const [t, c] of Object.entries(typeCounts)) {
  console.error(`  ${t}: ${c}`);
}

// List closed doors specifically
console.error(`\nAll closed-door / locked entities:`);
for (const [id, e] of s.entities) {
  if (e.type.includes("door") || e.type.includes("Door") || e.type === "closed_door" || e.type === "ClosedDoor") {
    console.error(`  ${id} type=${e.type} pos=(${e.pos.x},${e.pos.y}) walkable=${s.tiles[e.pos.y][e.pos.x].walkable} props=${JSON.stringify(e.props)}`);
  }
}
