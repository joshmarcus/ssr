# Technical Architecture (Terminal V0, Deterministic)

## Recommended stack
- Language: **TypeScript** (strict mode, V0)
- Terminal rendering: **ROT.js** (browser-native roguelike toolkit)
- Tests: **Vitest** (ESM-native, fast)
- Build: **Vite** (dev server + bundling)
- Later UI upgrade (optional): richer front-end, keeping the same sim core

## Terminal-first prototype option (recommended for V0)
For maximum testability and agent iteration speed:
- Prototype the full game as a **terminal roguelike** first (ASCII/glyph grid via ROT.js Display).
- Keep the simulation core rendering-agnostic.
- Later, add a richer UI front-end if desired.

Key requirements:
- deterministic seed + replay
- headless sim runner for CI
- terminal renderer for "totally visible" V0 play


## Architecture overview
### Modules
1. **CoreSim**
   - Turn-based simulation loop, entity updates, hazards, actions.
   - `src/sim/state.ts` — GameState, Entity, Components
   - `src/sim/actions.ts` — action enums + validation
   - `src/sim/step.ts` — step(state, action) -> state'
   - `src/sim/procgen.ts` — seed -> initial state
   - `src/sim/hazards.ts` — heat/smoke update per turn
   - `src/sim/objectives.ts` — win/loss checks
2. **ProcGen**
   - Seeded generation: station graph -> rooms -> tiles -> placements.
3. **Narrative**
   - Incident archetypes, crew generation, evidence generation.
4. **Puzzles**
   - Template-driven subsystem puzzles + validation.
5. **UI**
   - ROT.js Display renderer, panes, focus model, action bar, sensor overlays.
   - `src/render/terminal.ts` — ROT.js terminal renderer
6. **Input**
   - Input mapping, focus traversal, context action routing.
7. **Shared**
   - `src/shared/types.ts` — shared type definitions
   - `src/shared/constants.ts` — game constants
8. **Save/Load**
   - Full state + seed + versioned serialization (JSON).
9. **Replay (optional but recommended)**
   - Record inputs with turn indices for deterministic replay.

### Key design patterns
- Component-based entities (bot, doors, hazards).
- Event bus for system events (door opened, power rerouted, alarm triggered).
- Deterministic RNG streams:
  - `rng_layout`, `rng_loot`, `rng_narrative`, plus `rng_hazards/<id>`.

## Save format
Must include:
- seed
- current turn
- entity states (including active jobs: job type + remaining turns)
- hazard states (including any RNG stream position if needed)
- player meta unlocks (if any)
- version number

## Testing strategy
- Golden seeds: known-good station runs.
- Deterministic replays:
  - record controller actions as commands with turn timestamps
  - replay to verify identical outcomes
- "Pause/slow" UX smoke tests (controller-only)



## Platform / Steam
- Export targets:
  - Web (primary, via Vite build)
  - Desktop via Electron or Tauri (later)
  - Steam Deck (Linux x86_64, browser or wrapped)
- Steam-specific:
  - consider Steam Input for robust glyphs + controller abstraction
  - avoid external launchers; if unavoidable, controller-navigable
  - keep dependencies/middleware minimal



## Agent harness (headless)
Add a small CLI runner that:
- steps the turn-based sim
- renders text/JSON observations (player-knowledge only)
- accepts action JSON
- records and replays action logs

Entry point: `npx tsx src/harness/cli.ts`

This enables CI regression tests and LLM playtesting without pixel parsing.


## V0: terminal-first development
V0 is a traditional roguelike: ROT.js Display glyph renderer, turn-based steps, fully visible map.
