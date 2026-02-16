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
  ["move E", move(E)],         // 1
  ["interact log", interact("log_terminal_0")],  // 2
  ["move N", move(N)],         // 3
  ["move E", move(E)],         // 4
  ["move E", move(E)],         // 5
  ["move E", move(E)],         // 6
  ["move E", move(E)],         // 7
  ["move E", move(E)],         // 8
  ["move S", move(S)],         // 9
  ["interact sensor", interact("sensor_thermal")],  // 10
  ["interact bot", interact("service_bot")],  // 11
  ["scan", scan()],            // 12
  // Phase 4: Navigate from (18,9) to relay at (12,4)
  ["move N", move(N)],   // 13: (18,8)
  ["move W", move(W)],   // 14: (17,8)
  ["move N", move(N)],   // 15: (17,7) door
  ["move N", move(N)],   // 16: (17,6)
  ["move N", move(N)],   // 17: (17,5)
  ["move N", move(N)],   // 18: (17,4)
  ["move N", move(N)],   // 19: (17,3)
  ["move W", move(W)],   // 20: (16,3) door
  ["move W", move(W)],   // 21: (15,3)
  ["move S", move(S)],   // 22: (15,4)
  ["move W", move(W)],   // 23: (14,4)
  ["move W", move(W)],   // 24: (13,4)
  ["move W", move(W)],   // 25: (12,4)
];

for (const [desc, action] of actions) {
  const prev = state;
  state = step(state, action);
  const moved = state.turn !== prev.turn;
  console.log(
    `Turn ${state.turn}: ${desc} => (${state.player.entity.pos.x},${state.player.entity.pos.y})` +
    (moved ? "" : " [REJECTED]")
  );
}
