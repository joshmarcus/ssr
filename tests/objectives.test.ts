import { describe, it, expect } from "vitest";
import { step } from "../src/sim/step.js";
import { createEmptyState } from "../src/sim/state.js";
import { ActionType, EntityType, TileType, Direction } from "../src/shared/types.js";
import type { Entity } from "../src/shared/types.js";
import { HEAT_PAIN_THRESHOLD } from "../src/shared/constants.js";

function makeFloorState(width = 10, height = 10) {
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
        radiation: 0,
        stress: 0,
        stressTurns: 0,
        explored: true,
        visible: true,
      };
    }
  }
  state.player.entity.pos = { x: 5, y: 5 };
  return state;
}

describe("Objectives", () => {
  describe("Win condition", () => {
    it("interacting with data core sets victory and gameOver", () => {
      const state = makeFloorState();
      const dataCore: Entity = {
        id: "data_core",
        type: EntityType.DataCore,
        pos: { x: 5, y: 5 },
        props: { transmitted: false },
      };
      state.entities.set(dataCore.id, dataCore);

      const next = step(state, { type: ActionType.Interact, targetId: "data_core" });

      expect(next.victory).toBe(true);
      expect(next.gameOver).toBe(true);
    });

    it("adds a transmission log entry on victory", () => {
      const state = makeFloorState();
      const dataCore: Entity = {
        id: "data_core",
        type: EntityType.DataCore,
        pos: { x: 5, y: 5 },
        props: { transmitted: false },
      };
      state.entities.set(dataCore.id, dataCore);

      const next = step(state, { type: ActionType.Interact, targetId: "data_core" });

      expect(next.logs.some((l) => l.source === "data_core")).toBe(true);
    });
  });

  describe("Loss condition", () => {
    it("player at 0 HP with no service bot triggers game over", () => {
      const state = makeFloorState();
      state.player.entity.pos = { x: 5, y: 5 };
      state.player.hp = 1;
      state.tiles[5][5].heat = HEAT_PAIN_THRESHOLD + 30;

      const next = step(state, { type: ActionType.Wait });

      expect(next.player.alive).toBe(false);
      expect(next.gameOver).toBe(true);
      expect(next.victory).toBe(false);
    });

    it("player at 0 HP with active service bot triggers recovery", () => {
      const state = makeFloorState();
      state.player.entity.pos = { x: 5, y: 5 };
      state.player.hp = 1;
      state.tiles[5][5].heat = HEAT_PAIN_THRESHOLD + 30;

      const bot: Entity = {
        id: "svc_bot",
        type: EntityType.ServiceBot,
        pos: { x: 1, y: 1 },
        props: { active: true },
      };
      state.entities.set(bot.id, bot);

      const next = step(state, { type: ActionType.Wait });

      expect(next.player.alive).toBe(true);
      expect(next.player.entity.pos).toEqual({ x: 1, y: 1 });
      expect(next.player.hp).toBe(Math.ceil(next.player.maxHp * 0.3)); // recovered with 30% HP (resource scarcity)
      expect(next.gameOver).toBe(false);
      expect(next.entities.has("svc_bot")).toBe(false);
    });

    it("player at 0 HP with inactive service bot DOES trigger game over", () => {
      const state = makeFloorState();
      state.player.entity.pos = { x: 5, y: 5 };
      state.player.hp = 1;
      state.tiles[5][5].heat = HEAT_PAIN_THRESHOLD + 30;

      const bot: Entity = {
        id: "svc_bot",
        type: EntityType.ServiceBot,
        pos: { x: 1, y: 1 },
        props: { active: false },
      };
      state.entities.set(bot.id, bot);

      const next = step(state, { type: ActionType.Wait });

      expect(next.player.alive).toBe(false);
      expect(next.gameOver).toBe(true);
      expect(next.victory).toBe(false);
    });
  });

  describe("Actions after gameOver", () => {
    it("move action is rejected after game over (victory)", () => {
      const state = makeFloorState();
      state.gameOver = true;
      state.victory = true;

      const next = step(state, { type: ActionType.Move, direction: Direction.East });

      expect(next.turn).toBe(state.turn);
      expect(next.player.entity.pos).toEqual(state.player.entity.pos);
    });

    it("interact action is rejected after game over (loss)", () => {
      const state = makeFloorState();
      state.gameOver = true;
      state.victory = false;
      state.player.alive = false;

      const dataCore: Entity = {
        id: "data_core",
        type: EntityType.DataCore,
        pos: { x: 5, y: 5 },
        props: { transmitted: false },
      };
      state.entities.set(dataCore.id, dataCore);

      const next = step(state, { type: ActionType.Interact, targetId: "data_core" });

      expect(next.turn).toBe(state.turn);
    });

    it("scan action is rejected after game over", () => {
      const state = makeFloorState();
      state.gameOver = true;

      const logsBefore = state.logs.length;
      const next = step(state, { type: ActionType.Scan });

      expect(next.turn).toBe(state.turn);
      expect(next.logs.length).toBe(logsBefore);
    });

    it("wait action is rejected after game over", () => {
      const state = makeFloorState();
      state.gameOver = true;

      const next = step(state, { type: ActionType.Wait });

      expect(next.turn).toBe(state.turn);
    });
  });
});
