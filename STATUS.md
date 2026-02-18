# SSR — Project Status

*Last updated: 2026-02-17*

## Current State

- **Phase**: Sprint 6 (Harness Deduction Support + Demo Polish)
- **Test status**: 178 tests passing across 16 test files (0 failing)
- **Build**: TypeScript strict mode, tsc clean

## What Works

- Core game loop: explore -> evidence -> puzzles -> transmit
- 7 player actions (Move, Interact, Scan, Clean, Wait, Look, Journal, SubmitDeduction)
- 24 entity types with distinct interactions
- 3-sensor ladder (Cleanliness, Thermal, Atmospheric)
- Heat/smoke + pressure/breach hazard systems with spreading
- Procedural crew generation (8-12 crew, relationships, secrets, fates)
- 150+ narrative elements (38 log templates, 16 authored logs, 16 crew items)
- 6 incident archetypes with 5-phase timelines
- 5-6 chained deductions with evidence linking
- Narrative threads grouping evidence
- ROT.js browser rendering with viewport scrolling
- Harness CLI for AI playtesting (with deduction support as of Sprint 6)

## Known Issues

- Seed 184201 procgen produces only 1 room (golden seed test broken)
- Controller/gamepad input not yet implemented
- No save/load system
- No CI pipeline deployed

## Recent Changes (Git History)

```
2026-02-17 22:36  fix: add missing crewPaths.ts and threads.ts to repo
2026-02-17 22:31  refactor: remove radiation, structural, EM/signal systems and station integrity
2026-02-17 19:36  feat: playtest balance tuning + door auto-open + deduction gate
2026-02-17 15:44  feat: sprint 5 — landmark rooms, broadcast modal, crew rework, zones, balance
2026-02-17 15:15  docs: add TEAM.md with sprint team role definitions
2026-02-17 15:13  refactor: extract shared UI helpers, enrich AI harness observations
2026-02-17 14:56  feat: narrative cleaning directive messages + blocked-move explanation
2026-02-17 14:50  feat: dedicated overlay indicator line in sidebar
2026-02-17 14:49  feat: remove sensor requirements from interactions + fix overlay tag
2026-02-17 14:46  fix: objective display now tracks game phase properly
2026-02-17 14:44  feat: sidebar to left, wider + cleaning blocks exit instead of stun
2026-02-17 14:38  fix: playtest priority fixes — slow decay, room exits, relaxed directive
2026-02-17 14:36  add design docs to repo + fix: repair cradle full heal
2026-02-17 14:18  fix: repair cradle test for 1000 HP + AI driver improvements
2026-02-17 11:52  fix: use heavy box-drawing chars for wall connectivity
2026-02-17 11:50  fix: harness sensor refs, cleaning narrative on clean tiles
2026-02-17 11:29  feat: scrolling viewport, broadcast report, multi-sensor collection
2026-02-17 11:01  fix: emoji picks, player glyph bug, radiation nerf
2026-02-17 10:56  feat: AI playtesting harness — observation renderer, action parser, Claude driver
2026-02-17 10:42  feat: rubble system, glyph cleanup, 3D facing fix
```

## Sprint 6 Changes

- Added SubmitDeduction action type for harness AI playtesting
- Extended harness observations with journal entries, deductions, and progress
- Added deduction reward application in sim layer (extracted from browser.ts)
- Demo polish: color-coded logs, boot sequence, heat visibility, victory ceremony

## File Timestamps

### Source (src/)
| Directory    | Last Modified |
|-------------|---------------|
| src/sim/     | 2026-02-17    |
| src/render/  | 2026-02-17    |
| src/harness/ | 2026-02-17    |
| src/shared/  | 2026-02-17    |
| src/data/    | 2026-02-17    |

### Key Sim Files
| File                   | Last Modified       |
|-----------------------|---------------------|
| src/sim/step.ts        | 2026-02-17 22:49   |
| src/sim/procgen.ts     | 2026-02-17 22:22   |
| src/sim/deduction.ts   | 2026-02-17 21:53   |
| src/sim/hazards.ts     | 2026-02-17 22:18   |
| src/sim/crewPaths.ts   | 2026-02-17 22:02   |
| src/sim/incidents.ts   | 2026-02-17 22:20   |

### Design Docs (space_station_roguelike_docs_v10/design/)
| File                              | Last Modified       |
|----------------------------------|---------------------|
| golden_seed_puzzle_design.md      | 2026-02-16 00:13   |
| 08_technical_architecture.md      | 2026-02-16 00:07   |
| 16_agent_harness.md               | 2026-02-16 00:07   |
| 17_terminal_v0_prototype.md       | 2026-02-16 00:07   |
| 18_tech_stack_rotjs_typescript.md  | 2026-02-16 00:07   |

### Tests (tests/)
| File                          | Last Modified       |
|------------------------------|---------------------|
| sprint4.test.ts               | 2026-02-17 22:24   |
| deduction.test.ts             | 2026-02-17 21:53   |
| golden-walkthrough.test.ts    | 2026-02-17 19:35   |
| procgen.test.ts               | 2026-02-17 15:40   |
| edge-cases.test.ts            | 2026-02-17 22:18   |
| evidence.test.ts              | 2026-02-17 22:17   |

## Architecture

The project follows a strict sim/render separation:

```
src/
  sim/       — Authoritative game rules (rendering-agnostic)
  render/    — ROT.js terminal rendering (glyphs + panels)
  harness/   — Headless runner + observation/action API (agent/AI playtesting)
  shared/    — Shared types, constants, utilities
  data/      — Lore data, golden seed room definitions
tests/       — Golden seed + unit tests (Vitest)
```

The simulation is pure-functional: `step(state, action) -> state'`. All randomness is seeded via `ROT.RNG.setSeed()` for deterministic replay. The browser renderer (`src/render/display.ts`) and harness CLI (`src/harness/cli.ts`) are independent consumers of the same sim layer.

See `CLAUDE.md` for full architecture details, commands, and development conventions.
