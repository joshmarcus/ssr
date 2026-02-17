# Backlog & Milestones

## V0.0 — Project Scaffold (COMPLETED)
- [x] TypeScript + ROT.js + Vite + Vitest project initialized
- [x] Folder structure: `src/sim/`, `src/render/`, `src/harness/`, `src/shared/`, `tests/`
- [x] `tsconfig.json` with strict mode
- [x] `vite.config.ts` and `vitest.config.ts` configured
- [x] Core sim files scaffolded (`state.ts`, `actions.ts`, `step.ts`, `procgen.ts`, `hazards.ts`, `objectives.ts`)
- [x] ROT.js terminal renderer scaffolded (`render/terminal.ts`)
- [x] Harness CLI scaffolded (`harness/cli.ts`)
- [x] Shared types and constants (`shared/types.ts`, `shared/constants.ts`)
- [x] Golden seed test file created (`tests/golden-seed.test.ts`)
- [x] CLAUDE.md project instructions
- [x] Create repo using `tasks/00_repo_scaffold_typescript.md`

## V0.1 — Core Sim Implementation (COMPLETED)
- [x] Procgen via ROT.js Digger (seeded map generation, room extraction, corridor/door placement)
- [x] Entity placement system (sensor pickup, relay, data core, locked door, service bot, log terminals)
- [x] Turn-based simulation loop (`step(state, action) -> state'` pure function)
- [x] Player movement (4-directional, wall collision)
- [x] Interact action (pickup sensor, reroute relay, transmit data core, read log terminals, activate service bot)
- [x] Scan action (thermal sensor reveals hotspot relays)
- [x] Clean action (reduces smoke on player tile)
- [x] Heat/smoke hazard system (spread per turn, damage threshold)
- [x] Win condition (transmit at data core) and loss condition (player destroyed)
- [x] Relay reroute unlocks locked doors (tile conversion + entity state update)
- [x] Log terminal interaction (crew/system logs)
- [x] Lore data module (`src/data/lore.ts`)
- [x] Golden seed room data (`src/data/goldenSeedRooms.ts`)
- [x] Test suites: hazards (7 tests), scan (3 tests), interact, determinism, objectives, procgen (multi-seed)
- [x] Browser renderer (`src/render/display.ts`, `src/render/input.ts`)
- [x] 82 of 89 tests passing (7 failures in seed 184201 entity placement — see known issues)

## Milestone 0 — Vertical Slice (IN PROGRESS)
- [x] Representational visuals only (glyphs/overlays/text; no bespoke art assets)
- [x] Deterministic map generation (seeded via ROT.js Digger)
- [x] Turn-based simulation loop
- [x] 1 bot with movement + interact/scan/clean actions
- [x] 1 subsystem puzzle (power routing via relay reroute)
- [x] 1 gate (locked door) + 1 key (relay activation) + 1 objective (data core transmit)
- [x] Basic logs + evidence display (log terminals)
- [ ] Deterministic map producing 10+ rooms for golden seed 184201 (currently produces fewer)
- [ ] Golden seed integration test passing end-to-end (31-turn walkthrough)
- [ ] Harness CLI fully functional (headless play + script replay)
- [ ] Steam Deck smoke test (Playable bar): 1280x800, controller-only run completion
- [ ] Controller-first navigation + action bar (no typing required)
- [ ] Save/load
- [ ] Add CI checks using `tasks/01_ci_plan_typescript.md`

## Milestone 1 — First "real" run (4-6 weeks)
- [ ] Procgen macro graph + zone tags
- [ ] 2-3 hazard types (fire, breach, radiation)
- [ ] 6 incident archetypes
- [ ] Crew generator + badge deduction
- [ ] 6-10 attachment items
- [ ] Bot swapping

## Milestone 2 — Content depth (8-12 weeks)
- [ ] More puzzles (leaks, relays, robotics salvage)
- [ ] Sensor modes (thermal, atmos)
- [ ] Optional combat-lite drones
- [ ] Meta-progression (light)
- [ ] Better UI polish + controller support

## Milestone 3 — "Release" scope
- [ ] 20-30 incident archetypes
- [ ] 30-50 puzzle variants
- [ ] 3 station sizes
- [ ] Tutorial / onboarding
- [ ] Bug fixing + performance + packaging

## Risks to avoid early
- Too many bespoke puzzles
- Heavy narrative branching
- Real-time combat
- Large art pipeline

---

See also: `tasks/v0_terminal_roadmap.md`

- [ ] Implement golden seed run test: `tasks/golden_seed_run_184201.md`
- [ ] Add CI checks using `tasks/01_ci_plan_typescript.md`
