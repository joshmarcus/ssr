# Space Station Terminal Roguelike (SSR)

A procedural roguelike where you remotely pilot maintenance bots through a low-bitrate terminal link to explore a silent research station, restore systems, solve puzzles, and uncover what happened to the crew.

## Core Pillars

1. **Exploration via constraints** — Low-bitrate UI + narrow sensors create meaningful uncertainty
2. **Puzzle-forward roguelike** — Hazards are solved, not fought
3. **Mystery as progression** — Restored subsystems unlock evidence and interpretation
4. **Procedural but coherent** — Varying runs with solvable critical paths

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Rendering**: ROT.js (ASCII/glyph roguelike display)
- **Testing**: Vitest
- **Runtime**: Node.js (via fnm), tsx for dev
- **Time model**: Turn-based (one action = one time step)
- **Input**: Controller-first (Steam Deck "Playable" tier target, 1280x800)
- **Platform**: PC + Steam Deck (browser-based via ROT.js)

## Architecture

```
src/
  sim/       — Authoritative game rules (rendering-agnostic)
  render/    — ROT.js terminal rendering (glyphs + panels)
  harness/   — Headless runner + observation/action API (agent/AI playtesting)
  shared/    — Shared types, constants, utilities
tests/       — Golden seed + unit tests (Vitest)
```

## Commands

- `npm run dev` — Run game (tsx)
- `npm run build` — TypeScript compile
- `npm test` — Run tests (vitest)
- `npm run harness` — Headless CLI runner
- `npm run lint` — Type-check without emit

## Key Gameplay Systems

- **Player bot** (Janitor Rover): 3 attachment slots (Tool, Sensor, Utility), base cleanliness sensor
- **Sensor ladder**: Cleanliness → Thermal → Atmospheric → Radiation → Structural → EM/Signal
- **Puzzle types**: Power routing, pressure/leak management, access control, robotics salvage, signal relay
- **Mystery/narrative**: Procedurally generated crew (8-20), incident archetypes, evidence via logs/traces/still frames

## MVP Target

10-15 minute vertical slice: 10 rooms, 1 locked door (power-gated), 1 robotics bay, 1 data core objective, thermal sensor upgrade, heat/smoke hazard. Deterministic with seed. Golden seed test: seed 184201, 31-turn walkthrough.

## Documentation Reference

All design docs live in `space_station_roguelike_docs_v10/`:

### Design (core specs)
- `design/00_high_concept.md` — Vision, pillars, one-liner
- `design/01_game_loop.md` — State machine, progression phases
- `design/02_player_bot_and_upgrades.md` — Bot systems, attachments, sensor ladder
- `design/03_terminal_ui_and_sensors.md` — UI/UX, controller mapping, action bar
- `design/04_procgen_station_layout.md` — Generation pipeline (macro graph → rooms → doors → hazards → loot)
- `design/05_mystery_narrative_system.md` — Crew gen, evidence types, incident archetypes
- `design/06_puzzles_and_interactions.md` — Puzzle categories and mechanics
- `design/08_technical_architecture.md` — System architecture, module boundaries
- `design/13_realtime_simulation.md` — Future real-time mode (post-MVP)
- `design/16_agent_harness.md` — AI testing framework, observation/action format
- `design/17_terminal_v0_prototype.md` — V0 prototype specs

### Tasks (implementation roadmap)
- `tasks/mvp_spec.md` — MVP requirements and scope
- `tasks/golden_seed_run_184201.md` — Integration test spec (seed 184201, 25x17 map, 31 turns)
- `tasks/backlog.md` — Milestone roadmap (V0.1 → V0.3 → M1 → M2 → M3)

### Schemas (data formats)
- `schemas/` — Specs for bots, systems, puzzles, incidents, attachments, log templates

### Agent Prompts (AI-assisted dev)
- `agents/agent_core_engineering.md` — Core sim implementation
- `agents/agent_ui_terminal.md` — UI/terminal rendering
- `agents/agent_procgen.md` — Procedural generation
- Plus specialized agents for narrative, puzzles, harness, QA, and integration

## Development Conventions

- **Deterministic**: All simulation seeded and reproducible (ROT.RNG.setSeed)
- **Testable**: Golden seed integration test is the north star (seed 184201)
- **No fog-of-war** initially (for debugging and agent play)
- **Sim/render separation**: Game logic must never depend on rendering
- **Controller-first**: No typing required; action bar covers all interactions
- **Pure functions**: step(state, action) → state' pattern for simulation
- **ESM modules**: `"type": "module"` in package.json, `.js` extensions in imports
