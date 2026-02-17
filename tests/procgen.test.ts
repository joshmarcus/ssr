import { describe, it, expect } from "vitest";
import { generate } from "../src/sim/procgen.js";
import { EntityType, TileType } from "../src/shared/types.js";
import { GOLDEN_SEED, DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT } from "../src/shared/constants.js";

describe("Procgen entity placement", () => {
  // Seeds that produce >= 5 rooms (full entity placement)
  const richSeeds = [99999, 42, 7, 314159];

  richSeeds.forEach((seed) => {
    describe(`seed ${seed} (multi-room)`, () => {
      const state = generate(seed);

      it("generates at least 5 rooms", () => {
        expect(state.rooms.length).toBeGreaterThanOrEqual(5);
      });

      it("places relay entities", () => {
        const relays = Array.from(state.entities.values()).filter(
          (e) => e.type === EntityType.Relay && e.id.startsWith("relay_p")
        );
        expect(relays.length).toBe(3);
      });

      it("places a sensor pickup entity", () => {
        const sensors = Array.from(state.entities.values()).filter(
          (e) => e.type === EntityType.SensorPickup
        );
        expect(sensors.length).toBeGreaterThanOrEqual(1);
      });

      it("places a data core entity", () => {
        const cores = Array.from(state.entities.values()).filter(
          (e) => e.type === EntityType.DataCore
        );
        expect(cores.length).toBe(1);
      });

      it("places a service bot entity", () => {
        const bots = Array.from(state.entities.values()).filter(
          (e) => e.type === EntityType.ServiceBot
        );
        expect(bots.length).toBe(1);
      });

      it("places log terminal entities", () => {
        const terminals = Array.from(state.entities.values()).filter(
          (e) => e.type === EntityType.LogTerminal
        );
        expect(terminals.length).toBeGreaterThanOrEqual(1);
      });

      it("places at least one locked door tile", () => {
        let hasLockedDoor = false;
        for (let y = 0; y < state.height; y++) {
          for (let x = 0; x < state.width; x++) {
            if (state.tiles[y][x].type === TileType.LockedDoor) {
              hasLockedDoor = true;
            }
          }
        }
        expect(hasLockedDoor).toBe(true);
      });

      it("places all entities on valid tile positions", () => {
        for (const [id, entity] of state.entities) {
          if (id === "player") continue;
          if (id === "locked_door_main") continue;
          if (id.startsWith("closed_door_")) continue;
          if (id.startsWith("clearance_door_")) continue;
          if (id.startsWith("env_door_")) continue;

          const tile = state.tiles[entity.pos.y][entity.pos.x];
          expect(
            tile.walkable,
            `Entity ${id} at (${entity.pos.x}, ${entity.pos.y}) is on non-walkable tile type ${tile.type}`
          ).toBe(true);
        }
      });

      it("places the player inside the map bounds", () => {
        const { x, y } = state.player.entity.pos;
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(state.width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThan(state.height);
      });
    });
  });

  describe(`golden seed ${GOLDEN_SEED}`, () => {
    const state = generate(GOLDEN_SEED);

    it("generates the map at expected dimensions", () => {
      expect(state.width).toBe(DEFAULT_MAP_WIDTH);
      expect(state.height).toBe(DEFAULT_MAP_HEIGHT);
    });

    it("places the player inside the map bounds", () => {
      const { x, y } = state.player.entity.pos;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(state.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(state.height);
    });

    it("generates at least 10 rooms", () => {
      expect(state.rooms.length).toBeGreaterThanOrEqual(10);
    });

    it("places all MVP entities", () => {
      const entities = Array.from(state.entities.values());
      // 3 relays
      const relays = entities.filter(e => e.type === EntityType.Relay && e.id.startsWith("relay_p"));
      expect(relays.length).toBe(3);
      expect(entities.some((e) => e.type === EntityType.SensorPickup)).toBe(true);
      expect(entities.some((e) => e.type === EntityType.DataCore)).toBe(true);
      expect(entities.some((e) => e.type === EntityType.ServiceBot)).toBe(true);
      expect(entities.some((e) => e.type === EntityType.LogTerminal)).toBe(true);
    });
  });
});
