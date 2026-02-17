# SSR Project Status

**Date:** 2026-02-16
**Current milestone:** Milestone 0 (Vertical Slice) — In Progress
**Tech stack:** TypeScript + ROT.js + Vitest + Vite

---

## What's Built

### Scaffold (V0.0 -- Complete)
- TypeScript project with strict mode, Vite dev server, Vitest test runner
- Folder structure: `src/sim/`, `src/render/`, `src/harness/`, `src/shared/`, `src/data/`, `tests/`
- ROT.js integrated for map generation and browser-based terminal display
- CLAUDE.md and all design docs updated from Python to TypeScript/ROT.js

### Core Simulation (V0.1 -- Complete)
- **Procgen**: `ROT.Map.Digger` generates seeded room-and-corridor maps (25x17 grid)
- **Entity system**: Sensor pickup, relay panel, data core, locked door, service bot, log terminals
- **Turn-based loop**: Pure `step(state, action) -> state'` function with immutable state transitions
- **Actions implemented**: Move (4-dir), Interact (entity-specific), Scan (thermal reveal), Clean (smoke reduction), Wait
- **Hazards**: Heat and smoke spread per turn to adjacent walkable tiles; damage threshold kills player bot
- **Puzzle**: Relay reroute (interact with overheating relay -> powers locked door -> unlocks data core room)
- **Win/loss**: Transmit at data core = victory; player destroyed with no recovery = defeat
- **Logs**: System and crew log entries generated from interactions and lore data

### Rendering
- **Browser renderer**: `src/render/display.ts` with ROT.js Display, `src/render/input.ts` for keyboard input
- **Harness CLI**: `src/harness/cli.ts` scaffolded (not yet fully functional for scripted replay)

### Tests
- **8 test files**, **89 total tests**
- **82 passing**, 7 failing (all in seed 184201 procgen entity placement)
- Test suites: golden-seed, hazards, scan, interact, determinism, objectives, procgen (multi-seed)

---

## What Works

- Generating deterministic maps from any seed using ROT.js Digger
- Moving the player bot around the map, interacting with entities
- Picking up thermal sensor, scanning to reveal hotspot relays
- Rerouting power at relay -> unlocking doors -> reaching data core -> transmitting (victory)
- Heat/smoke spreading each turn and damaging the player at high intensity
- Reading log terminals for narrative clues
- All core game mechanics for the MVP loop are functional
- Most seeds produce valid, playable maps with all required entities

---

## Known Issues

### Seed 184201 Entity Placement (7 failing tests)
The golden seed (184201) with `ROT.Map.Digger` at 25x17 and `dugPercentage: 0.4` currently produces only 1 room. This causes:
- Relay entity not placed (needs room index 2)
- Sensor pickup not placed correctly (needs room index 1)
- Data core not in expected position
- Service bot not in expected position
- Log terminals not in expected positions
- No locked door tile generated (no door at data core room boundary)
- Fewer than 3 rooms generated

**Root cause**: The Digger algorithm's output for this specific seed at this map size produces insufficient rooms. The fix requires either:
1. Tuning Digger parameters (e.g. higher `dugPercentage`, different `roomWidth`/`roomHeight` ranges)
2. Using a different ROT.js map generator for the golden seed
3. Falling back to a hand-coded room layout for seed 184201

Other seeds (tested: 42, 99999, 314159, 271828) produce 3+ rooms and pass all entity placement tests.

### Golden Seed Walkthrough Not Yet Validated
The 31-turn walkthrough in `golden_seed_run_184201.md` was written for a hand-designed map with fixed entity positions. The actual map produced by ROT.js Digger differs, so the walkthrough coordinates and turn counts need to be reconciled once the seed 184201 map stabilizes.

### Harness CLI Not Complete
The headless harness (`src/harness/cli.ts`) is scaffolded but not yet capable of running scripted action sequences or producing canonical observation text.

### No CI Pipeline Yet
GitHub Actions workflow defined in `tasks/01_ci_plan_typescript.md` but not yet configured in the repository.

---

## What's Left for MVP (Milestone 0)

### Critical Path
1. **Fix seed 184201 procgen** -- Make the golden seed produce 10+ rooms with correct entity placement (tune Digger params or add fallback)
2. **Validate golden seed walkthrough** -- Update `golden_seed_run_184201.md` with actual positions from the stabilized map, verify 31-turn win path
3. **Make all 89 tests pass** -- Resolve the 7 procgen failures

### Important but Non-Blocking
4. **Harness CLI** -- Implement scripted action replay and canonical observation output
5. **CI pipeline** -- Set up GitHub Actions per `tasks/01_ci_plan_typescript.md`
6. **Save/load** -- Serialize and deserialize GameState (JSON)
7. **Controller support** -- Gamepad input mapping for Steam Deck

### Polish (can defer past M0)
8. **Steam Deck smoke test** -- 1280x800 controller-only completion
9. **Action bar UI** -- Context-aware action menu in the browser renderer
10. **Vent control puzzle path** -- P04 OPEN_VENTS as alternative mitigation

---

## Next Steps (Recommended Order)

1. Tune procgen parameters for seed 184201 to produce 10+ rooms (highest priority -- unblocks golden seed test)
2. Once map is stable, record actual entity positions and update golden seed walkthrough
3. Get all 89 tests green
4. Implement harness CLI scripted replay
5. Add GitHub Actions CI
6. Implement save/load

---

## Future Design Ideas (Noted for Later)

- **Objective branching after investigation**: Once the initial investigation findings are shared back to base, the objective updates from home base. Depending on the scenario, sub-objectives can vary — e.g. "get crew to escape pods" or "set station to self-destruct". The player can still activate escape pods and help crew escape even if that's not the assigned objective.
- **Environmental prerequisites for crew rescue**: The player should need to address environmental hazards (seal breaches, suppress fires, stabilize pressure) before attempting to save crew. Crew NPCs won't follow through dangerous areas, or escape routes require safe/powered corridors first.
- **Scrolling viewport ready for larger maps**: Viewport is 40x25 — map sizes can now grow to 90x45, 110x55 without UI changes.
- **Multi-sensor stacking**: All collected sensors apply simultaneously. Future balance consideration: sensor-specific puzzles still gate on having that specific sensor, but vision/damage-reduction bonuses all stack.

---

Updated: 2026-02-17
