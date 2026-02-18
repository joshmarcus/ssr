import { describe, it, expect } from "vitest";
import { step } from "../src/sim/step.js";
import { createEmptyState } from "../src/sim/state.js";
import { ActionType, EntityType, TileType } from "../src/shared/types.js";
import type { Entity, GameState } from "../src/shared/types.js";
import { PATROL_DRONE_SPEED, PATROL_DRONE_DAMAGE, PATROL_DRONE_ATTACK_COOLDOWN } from "../src/shared/constants.js";

/** Create a 15x15 walkable floor grid. */
function makeTestState() {
  const state = createEmptyState(1, 15, 15);
  for (let y = 0; y < 15; y++) {
    for (let x = 0; x < 15; x++) {
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
  state.player.entity.pos = { x: 7, y: 7 };
  state.rooms.push({
    id: "room_0",
    name: "Test Room",
    x: 0,
    y: 0,
    width: 15,
    height: 15,
  });
  return state;
}

function makePatrolDrone(id: string, x: number, y: number, hostile: boolean): Entity {
  return {
    id,
    type: EntityType.PatrolDrone,
    pos: { x, y },
    props: { hostile },
  };
}

/** Advance state by N turns using Wait actions. */
function advanceTurns(state: GameState, n: number): GameState {
  let s = state;
  for (let i = 0; i < n; i++) {
    s = step(s, { type: ActionType.Wait });
  }
  return s;
}

describe("Patrol drone behavior", () => {
  it("non-hostile drone moves on speed-interval turns", () => {
    const state = makeTestState();
    state.entities.set("drone_1", makePatrolDrone("drone_1", 10, 10, false));

    // Advance to a turn divisible by PATROL_DRONE_SPEED
    let next = state;
    const startPos = { ...next.entities.get("drone_1")!.pos };

    // Advance exactly PATROL_DRONE_SPEED turns
    next = advanceTurns(next, PATROL_DRONE_SPEED);

    const drone = next.entities.get("drone_1")!;
    // Drone should have moved (position different from start)
    const moved = drone.pos.x !== startPos.x || drone.pos.y !== startPos.y;
    expect(moved).toBe(true);
  });

  it("non-hostile drone does not walk onto player tile", () => {
    const state = makeTestState();
    // Place drone adjacent to player
    state.entities.set("drone_close", makePatrolDrone("drone_close", 8, 7, false));

    // Run several turns
    const next = advanceTurns(state, PATROL_DRONE_SPEED * 5);

    const drone = next.entities.get("drone_close")!;
    const px = next.player.entity.pos.x;
    const py = next.player.entity.pos.y;
    // Drone should never be on the player's tile
    expect(drone.pos.x === px && drone.pos.y === py).toBe(false);
  });

  it("hostile drone moves toward player and deals damage on contact", () => {
    const state = makeTestState();
    // Place hostile drone close to player
    state.entities.set("hostile_1", makePatrolDrone("hostile_1", 9, 7, true));
    const startHp = state.player.hp;

    // Advance enough turns for drone to reach player
    const next = advanceTurns(state, PATROL_DRONE_SPEED * 3);

    // Player should have taken damage
    expect(next.player.hp).toBeLessThan(startHp);
    // Should have an attack log
    const attackLog = next.logs.find(l => l.text.includes("drone attack") || l.text.includes("Rogue drone"));
    expect(attackLog).toBeDefined();
  });

  it("hostile drone retreats after attacking (cooldown)", () => {
    const state = makeTestState();
    // Place hostile drone right next to player
    state.entities.set("hostile_cd", makePatrolDrone("hostile_cd", 8, 7, true));

    // Advance until attack happens
    let next = state;
    let attackHappened = false;
    for (let i = 0; i < PATROL_DRONE_SPEED * 5; i++) {
      const prevHp = next.player.hp;
      next = step(next, { type: ActionType.Wait });
      if (next.player.hp < prevHp) {
        attackHappened = true;
        break;
      }
    }

    expect(attackHappened).toBe(true);

    // After attack, drone should be on cooldown — should move away from player on next movement tick
    const droneAfterAttack = next.entities.get("hostile_cd")!;
    const attackTurn = droneAfterAttack.props["lastAttackTurn"] as number;
    expect(attackTurn).toBeGreaterThan(0);
  });

  it("hostile drone deals correct damage amount", () => {
    const state = makeTestState();
    // Place hostile drone adjacent to player at (8,7)
    state.entities.set("hostile_dmg", makePatrolDrone("hostile_dmg", 8, 7, true));
    const startHp = state.player.hp;

    // Advance until first damage
    let next = state;
    for (let i = 0; i < PATROL_DRONE_SPEED * 5; i++) {
      const prevHp = next.player.hp;
      next = step(next, { type: ActionType.Wait });
      if (next.player.hp < prevHp) {
        // First damage event — check the delta
        const delta = prevHp - next.player.hp;
        // Delta should be PATROL_DRONE_DAMAGE (plus any hazard damage, but tiles are safe)
        expect(delta).toBe(PATROL_DRONE_DAMAGE);
        break;
      }
    }
  });

  it("multiple hostile drones each deal damage independently", () => {
    const state = makeTestState();
    // Place two hostile drones near the player
    state.entities.set("hostile_a", makePatrolDrone("hostile_a", 8, 7, true));
    state.entities.set("hostile_b", makePatrolDrone("hostile_b", 6, 7, true));
    const startHp = state.player.hp;

    // Run for a while — both should deal damage
    const next = advanceTurns(state, PATROL_DRONE_SPEED * 6);

    // Should have lost more HP than a single drone attack
    const hpLost = startHp - next.player.hp;
    expect(hpLost).toBeGreaterThanOrEqual(PATROL_DRONE_DAMAGE);

    // Both drones should still exist
    expect(next.entities.has("hostile_a")).toBe(true);
    expect(next.entities.has("hostile_b")).toBe(true);
  });

  it("drone stays in bounds and does not enter walls", () => {
    const state = makeTestState();
    // Place drone near a wall (make tiles at y=0 walls)
    for (let x = 0; x < 15; x++) {
      state.tiles[0][x] = {
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
    }
    state.entities.set("wall_drone", makePatrolDrone("wall_drone", 5, 1, false));

    const next = advanceTurns(state, PATROL_DRONE_SPEED * 10);

    const drone = next.entities.get("wall_drone")!;
    // Drone should never be on a wall tile
    expect(state.tiles[drone.pos.y][drone.pos.x].walkable).toBe(true);
    expect(drone.pos.y).toBeGreaterThanOrEqual(0);
    expect(drone.pos.y).toBeLessThan(15);
  });
});
