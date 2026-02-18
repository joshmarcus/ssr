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
  data/      — Lore data, golden seed room definitions
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
- `design/07_content_pipeline_and_data_formats.md` — Content pipeline and data format specs
- `design/08_technical_architecture.md` — System architecture, module boundaries (TypeScript + ROT.js)
- `design/09_input_and_controller.md` — Input mapping and controller support
- `design/10_meta_progression.md` — Meta-progression design
- `design/11_sensor_ladder_and_variants.md` — Sensor types and variants
- `design/12_minimal_combat.md` — Optional combat-lite design
- `design/13_realtime_simulation.md` — Future real-time mode (post-MVP)
- `design/14_platform_pc_steam_deck.md` — Platform targets and Steam Deck constraints
- `design/15_visual_style_no_art.md` — Visual style: representational, no art pipeline
- `design/16_agent_harness.md` — AI testing framework, observation/action format
- `design/17_terminal_v0_prototype.md` — V0 prototype specs (ROT.js Display, full visibility)
- `design/18_tech_stack_rotjs_typescript.md` — Technology choices and rationale (active)
- `design/golden_seed_puzzle_design.md` — Thermal-gated power routing puzzle design
- `design/18_tech_stack_python_tcod.md` — (superseded) Original Python tech stack doc

### Tasks (implementation roadmap)
- `tasks/00_repo_scaffold_typescript.md` — Repository structure (TypeScript, active)
- `tasks/01_ci_plan_typescript.md` — CI/testing plan (GitHub Actions + Vitest)
- `tasks/mvp_spec.md` — MVP requirements and scope
- `tasks/golden_seed_run_184201.md` — Integration test spec (seed 184201, ROT.js Digger map)
- `tasks/backlog.md` — Milestone roadmap (V0.0 → V0.1 → M0 → M1 → M2 → M3)
- `tasks/v0_terminal_roadmap.md` — V0 terminal-first development roadmap
- `tasks/00_repo_scaffold_python.md` — (superseded) Original Python scaffold doc
- `tasks/01_ci_plan_python.md` — (superseded) Original Python CI plan

### Status
- `STATUS.md` — Current project status, what works, known issues, next steps

### Schemas (data formats)
- `schemas/` — Specs for bots, systems, puzzles, incidents, attachments, log templates

### Agent Prompts (AI-assisted dev)
- `agents/agent_core_engineering.md` — Core sim implementation (TypeScript)
- `agents/agent_ui_terminal.md` — UI/terminal rendering (ROT.js)
- `agents/agent_procgen.md` — Procedural generation
- `agents/agent_narrative_puzzle.md` — Narrative and puzzle design
- `agents/agent_input_controller.md` — Input and controller mapping
- `agents/agent_hazards_realtime.md` — Hazards and real-time systems
- `agents/agent_playtest_balance.md` — Playtesting and balance
- `agents/agent_packaging_steam_deck.md` — Packaging and Steam Deck deployment

## Important Project Files

- `CLAUDE.md` — This file. Project instructions and architecture reference
- `TEAM.md` — Sprint team roles, file ownership, workflow rules
- `STATUS.md` — Living project status (update after each sprint)
- `FUTURE_FEATURES.md` — Deferred features and design ideas
- `space_station_roguelike_docs_v10/tasks/backlog.md` — Milestone roadmap and backlog

## Sprint Workflow

1. Review `STATUS.md` for current state (what works, what's broken)
2. Check `backlog.md` and `FUTURE_FEATURES.md` for priorities
3. Plan sprint: 3-5 deliverables, prioritized by game design lead
4. Execute in parallel by role (see `TEAM.md`)
5. QA: run `npx tsc --noEmit` + `npx vitest run` to verify
6. **Always commit and push** after changes are verified
7. Update `STATUS.md` after each sprint with changes and new findings
8. **After major sprints**: Update critical docs, run a full playtest (harness or manual), share a playtest report before the next planning cycle. The whole team can propose priorities.
9. **Auto-continue**: When a sprint is completed, automatically begin the next sprint — review state, identify priorities, plan, and execute without waiting for user prompt.
10. **Design priority**: The game should be fun, interesting, and innovative — technical elegance is secondary

## Autonomous Development

- **Keep going**: Continue developing, sprinting, and iterating without asking the user for input unless absolutely critical (e.g., destructive action, ambiguous architectural direction). Make design decisions independently.
- **Playtesting**: Use `npx tsx playtest_bot.ts [seed]` for automated playtesting. The harness CLI is `npm run harness`. The Claude API driver is at `src/harness/claudeDriver.ts` (requires ANTHROPIC_API_KEY in .env).
- **Commit frequently**: After each feature or fix that passes tests, commit and push immediately.

## Development Conventions

- **Deterministic**: All simulation seeded and reproducible (ROT.RNG.setSeed)
- **Testable**: Golden seed integration test is the north star (seed 184201)
- **No fog-of-war** initially (for debugging and agent play)
- **Sim/render separation**: Game logic must never depend on rendering
- **Controller-first**: No typing required; action bar covers all interactions
- **Pure functions**: step(state, action) → state' pattern for simulation
- **ESM modules**: `"type": "module"` in package.json, `.js` extensions in imports
