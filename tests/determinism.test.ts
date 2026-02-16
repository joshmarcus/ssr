import { describe, it, expect } from "vitest";
import { generate } from "../src/sim/procgen.js";
import { GOLDEN_SEED } from "../src/shared/constants.js";

/**
 * Serialize a GameState's core data for deep equality comparison.
 * Maps are not directly comparable, so we convert entities to sorted arrays.
 */
function serializeState(state: ReturnType<typeof generate>) {
  const tiles = state.tiles.map((row) =>
    row.map((t) => ({ type: t.type, glyph: t.glyph, walkable: t.walkable, heat: t.heat, smoke: t.smoke, explored: t.explored, visible: t.visible }))
  );

  const entities = Array.from(state.entities.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, e]) => ({ id, type: e.type, pos: { ...e.pos }, props: { ...e.props } }));

  const rooms = state.rooms.map((r) => ({
    id: r.id,
    name: r.name,
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
  }));

  return { tiles, entities, rooms, playerPos: { ...state.player.entity.pos } };
}

describe("Determinism", () => {
  it("generate(184201) produces identical output across 10 runs", () => {
    const baseline = serializeState(generate(GOLDEN_SEED));

    for (let i = 1; i < 10; i++) {
      const current = serializeState(generate(GOLDEN_SEED));
      expect(current.tiles).toEqual(baseline.tiles);
      expect(current.entities).toEqual(baseline.entities);
      expect(current.rooms).toEqual(baseline.rooms);
      expect(current.playerPos).toEqual(baseline.playerPos);
    }
  });

  it("generate(99999) produces identical output across 10 runs", () => {
    const baseline = serializeState(generate(99999));

    for (let i = 1; i < 10; i++) {
      const current = serializeState(generate(99999));
      expect(current).toEqual(baseline);
    }
  });

  it("generate(42) produces identical output across 10 runs", () => {
    const baseline = serializeState(generate(42));

    for (let i = 1; i < 10; i++) {
      const current = serializeState(generate(42));
      expect(current).toEqual(baseline);
    }
  });

  it("different seeds produce different maps", () => {
    const a = serializeState(generate(GOLDEN_SEED));
    const b = serializeState(generate(99999));
    const c = serializeState(generate(42));

    // At least tiles or entity positions should differ between seeds
    expect(a.tiles).not.toEqual(b.tiles);
    expect(a.tiles).not.toEqual(c.tiles);
    expect(b.tiles).not.toEqual(c.tiles);
  });
});
