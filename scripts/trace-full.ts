import { generate } from "../src/sim/procgen.js";
import { step } from "../src/sim/step.js";
import { GOLDEN_SEED } from "../src/shared/constants.js";
import { ActionType, Direction } from "../src/shared/types.js";
import type { Action } from "../src/shared/types.js";

const move = (dir: Direction): Action => ({ type: ActionType.Move, direction: dir });
const interact = (targetId?: string): Action => ({ type: ActionType.Interact, targetId });
const scan = (): Action => ({ type: ActionType.Scan });

const N = Direction.North;
const S = Direction.South;
const E = Direction.East;
const W = Direction.West;

let state = generate(GOLDEN_SEED);

const actions: [string, Action][] = [
  ["move E", move(E)],
  ["interact log", interact("log_terminal_0")],
  ["move N", move(N)],
  ["move E", move(E)],
  ["move E", move(E)],
  ["move E", move(E)],
  ["move E", move(E)],
  ["move E", move(E)],
  ["move S", move(S)],
  ["interact sensor", interact("sensor_thermal")],
  ["interact bot", interact("service_bot")],
  ["scan", scan()],
  ["move N", move(N)],
  ["move W", move(W)],
  ["move N", move(N)],
  ["move N", move(N)],
  ["move N", move(N)],
  ["move N", move(N)],
  ["move N", move(N)],
  ["move W", move(W)],
  ["move W", move(W)],
];

for (const [desc, action] of actions) {
  const prev = state;
  state = step(state, action);
  const moved = state.turn !== prev.turn;
  const pos = state.player.entity.pos;
  const tile = state.tiles[pos.y][pos.x];

  // Also check heat at the target of the next moves
  console.log(
    `Turn ${state.turn}: ${desc} => (${pos.x},${pos.y}) heat=${tile.heat} alive=${state.player.alive}` +
    (moved ? "" : " [REJECTED]")
  );

  // Show heat around the path for turns >= 15
  if (state.turn >= 15) {
    // Show heat at key positions along the planned path
    const checkPositions = [
      [15,3], [16,3], [17,3], [17,4], [17,5], [17,6], [17,7], [17,8],
      [12,3], [12,4], [12,5], [13,4]
    ];
    const heatInfo = checkPositions
      .map(([x,y]) => `(${x},${y})=${state.tiles[y][x].heat}`)
      .join(" ");
    console.log(`  Heat: ${heatInfo}`);
  }
}
