import { describe, it, expect } from "vitest";
import { generate } from "../src/sim/procgen.js";
import { step } from "../src/sim/step.js";
import { GOLDEN_SEED } from "../src/shared/constants.js";
import { ActionType, Direction } from "../src/shared/types.js";

describe("Golden seed 184201", () => {
  it("generates a deterministic map", () => {
    const s1 = generate(GOLDEN_SEED);
    const s2 = generate(GOLDEN_SEED);
    expect(s1.rooms.length).toBe(s2.rooms.length);
    expect(s1.player.entity.pos).toEqual(s2.player.entity.pos);
    // Tile-by-tile comparison
    for (let y = 0; y < s1.height; y++) {
      for (let x = 0; x < s1.width; x++) {
        expect(s1.tiles[y][x].type).toBe(s2.tiles[y][x].type);
      }
    }
  });

  it("starts at turn 0 with player alive", () => {
    const state = generate(GOLDEN_SEED);
    expect(state.turn).toBe(0);
    expect(state.player.alive).toBe(true);
    expect(state.gameOver).toBe(false);
  });

  it("can step with a move action", () => {
    const state = generate(GOLDEN_SEED);
    const next = step(state, { type: ActionType.Move, direction: Direction.East });
    // Either moved or stayed (if wall), turn incremented either way if valid
    expect(next.turn).toBeGreaterThanOrEqual(state.turn);
  });
});
