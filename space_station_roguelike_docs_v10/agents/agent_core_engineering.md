# Agent — Core Engineering (Real-Time Core)

## Mission
Build the playable vertical slice: **fixed-timestep real-time sim** + basic terminal UI + a tiny station with 1–2 puzzles.

## Deliverables
- RealTimeSim CoreSim with:
  - grid map, rooms/doors
  - entities: player bot, door, item, hazard (choose 1)
  - fixed timestep loop (tick-based)
  - action “jobs” (move, clean, interact)
- Command/macro layer:
  - action bar triggers commands; typed commands optional
- Save/load:
  - seed + tick + minimal state
- (Optional) replay:
  - record input actions with tick stamps

## Constraints
- Determinism: seed must reproduce the same station.
- Fixed timestep: sim must not depend on frame delta.
- Separation: sim must not depend on rendering.

## Suggested implementation steps
1. Define data model types (Station, Tile, Entity, Bot, Door, Hazard).
2. Implement tick loop + scheduler (events + jobs).
3. Implement action jobs:
   - move 1 tile (duration ticks)
   - clean tile
   - interact (instant or short)
4. Implement one hazard:
   - smoke spread OR leak drain
5. Render:
   - ASCII grid + panes + action bar
6. Add one subsystem screen:
   - power routing stub unlocks a door.

## Acceptance tests
- Same seed produces same map.
- Same sequence of controller actions at same ticks produces same outcomes.
- Hazard progresses over time and is paused when Systems/Logs open (MVP policy).


## Rendering note
- Use glyph/tiles + overlay layers; avoid custom sprites.


## Additional deliverable (high leverage)
- Implement the headless **Agent Harness** CLI for observations/actions (see `design/16_agent_harness.md`).


## V0 implementation notes (TypeScript)
- Implement `step(state, action)` as the deterministic pure-function transition in `src/sim/step.ts`.
- Keep `src/sim/` free of ROT.js Display imports (ROT.js Map/RNG are allowed in procgen).
- Add a stable `stateHash(state)` for regression tests.
- Special-case seed 184201 in procgen to match the golden map.
