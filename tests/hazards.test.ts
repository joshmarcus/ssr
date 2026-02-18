import { describe, it, expect } from "vitest";
import { tickHazards, applyHazardDamage } from "../src/sim/hazards.js";
import { createEmptyState } from "../src/sim/state.js";
import { TileType } from "../src/shared/types.js";
import { HEAT_SPREAD_RATE, SMOKE_SPREAD_RATE, HEAT_DECAY_RATE, HEAT_PAIN_THRESHOLD, HEAT_SPREAD_MIN, PLAYER_MAX_HP } from "../src/shared/constants.js";

function makeFloorState(width = 5, height = 5) {
  const state = createEmptyState(1, width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      state.tiles[y][x] = {
        type: TileType.Floor,
        glyph: ".",
        walkable: true,
        heat: 0,
        smoke: 0,
        dirt: 0,
        pressure: 100,
        explored: true,
        visible: true,
      };
    }
  }
  state.player.entity.pos = { x: 0, y: 0 };
  return state;
}

describe("Hazard system", () => {
  it("spreads heat to adjacent floor tiles", () => {
    const state = makeFloorState();
    // Use high heat so proportional spread is meaningful
    // spreadAmount = ceil(HEAT_SPREAD_RATE * (heat / 100))
    const initialHeat = 80;
    state.tiles[2][2].heat = initialHeat;

    const next = tickHazards(state);

    // Source decays by HEAT_DECAY_RATE
    expect(next.tiles[2][2].heat).toBe(initialHeat - HEAT_DECAY_RATE);
    // Adjacent tiles get proportional spread minus decay
    const spreadAmount = Math.ceil(HEAT_SPREAD_RATE * (initialHeat / 100));
    const expectedAdj = Math.max(0, spreadAmount - HEAT_DECAY_RATE);
    expect(next.tiles[1][2].heat).toBe(expectedAdj);
    expect(next.tiles[3][2].heat).toBe(expectedAdj);
    expect(next.tiles[2][1].heat).toBe(expectedAdj);
    expect(next.tiles[2][3].heat).toBe(expectedAdj);
  });

  it("spreads smoke to adjacent floor tiles", () => {
    const state = makeFloorState();
    state.tiles[2][2].smoke = 10;

    const next = tickHazards(state);

    expect(next.tiles[1][2].smoke).toBe(Math.max(0, SMOKE_SPREAD_RATE - 1));
    expect(next.tiles[3][2].smoke).toBe(Math.max(0, SMOKE_SPREAD_RATE - 1));
  });

  it("does not spread heat through walls", () => {
    const state = makeFloorState();
    const initialHeat = 80;
    state.tiles[2][2].heat = initialHeat;
    state.tiles[1][2] = {
      type: TileType.Wall,
      glyph: "#",
      walkable: false,
      heat: 0,
      smoke: 0,
      dirt: 0,
      pressure: 100,
      explored: true,
      visible: true,
    };

    const next = tickHazards(state);

    const spreadAmount = Math.ceil(HEAT_SPREAD_RATE * (initialHeat / 100));
    expect(next.tiles[1][2].heat).toBe(0); // wall blocks spread
    expect(next.tiles[3][2].heat).toBe(Math.max(0, spreadAmount - HEAT_DECAY_RATE));
  });

  it("caps heat at 100", () => {
    const state = makeFloorState();
    state.tiles[2][2].heat = 100;
    state.tiles[2][3].heat = 99;

    const next = tickHazards(state);

    expect(next.tiles[2][3].heat).toBeLessThanOrEqual(100);
  });

  it("does not modify original state tiles", () => {
    const state = makeFloorState();
    state.tiles[2][2].heat = 50;

    tickHazards(state);

    expect(state.tiles[1][2].heat).toBe(0);
  });

  it("damages player HP on tile above pain threshold", () => {
    const state = makeFloorState();
    state.player.entity.pos = { x: 2, y: 2 };
    state.tiles[2][2].heat = HEAT_PAIN_THRESHOLD + 20;

    const next = applyHazardDamage(state);

    expect(next.player.hp).toBeLessThan(PLAYER_MAX_HP);
    expect(next.player.alive).toBe(true); // gradual, not instant kill
  });

  it("kills player when HP reaches 0 from sustained heat", () => {
    const state = makeFloorState();
    state.player.entity.pos = { x: 2, y: 2 };
    state.tiles[2][2].heat = 100; // max heat for reliable kill
    state.player.hp = 1; // almost dead

    const next = applyHazardDamage(state);

    expect(next.player.hp).toBe(0);
    expect(next.player.alive).toBe(false);
  });

  it("does not damage player below pain threshold", () => {
    const state = makeFloorState();
    state.player.entity.pos = { x: 2, y: 2 };
    state.tiles[2][2].heat = HEAT_PAIN_THRESHOLD - 1;

    const next = applyHazardDamage(state);

    expect(next.player.hp).toBe(PLAYER_MAX_HP);
    expect(next.player.alive).toBe(true);
  });
});
