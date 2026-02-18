# SSR — Project Status

*Last updated: 2026-02-18*

## Current State

- **Phase**: Sprint 13 (Restart Fix + Relay Defeat + Crawl Polish + 3D Sync)
- **Test status**: 202 tests passing across 18 test files (0 failing)
- **Build**: TypeScript strict mode, tsc clean
- **Playtest**: Bot achieves VICTORY on seed 42 (175 turns, 5/5 deductions correct)

## What Works

- Core game loop: explore -> evidence -> puzzles -> transmit
- 7 player actions (Move, Interact, Scan, Clean, Wait, Look, Journal, SubmitDeduction)
- 25 entity types with distinct interactions (including Airlock)
- 3-sensor ladder (Cleanliness, Thermal, Atmospheric)
- Heat/smoke + pressure/breach hazard systems with spreading
- Fire system with slow spread and low-pressure suppression
- Airlock system: toggleable entities that vent atmosphere
- Procedural crew generation (8-12 crew, relationships, secrets, fates)
- 150+ narrative elements (38 log templates, 16 authored logs, 16 crew items)
- Ship computer PA announcements (periodic atmospheric messages)
- 6 incident archetypes with 5-phase timelines
- 5-6 chained deductions with evidence linking
- Narrative threads grouping evidence
- Evidence Browser overlay [v]: full journal with content, tags, threads, deduction links
- ROT.js browser rendering with viewport scrolling
- Harness CLI for AI playtesting (with deduction support)
- Heuristic playtest bot (playtest_bot.ts)
- Mystery choices: 3 narrative decisions in broadcast report (blame, data handling, incident-specific)
- Procedural sound effects: 12 Web Audio SFX (movement, interaction, scan, errors, victory/defeat, phase transitions, deductions, PA, choices)
- Game-over overlay: performance rating (S/A/B/C/D), stats summary, mystery choices recap
- Tutorial hints: context-sensitive tips at early turns and on first-time events
- Evacuation phase: RED ALERT banner, crew following, escape pod boarding with full audio
- Help overlay: HTML modal with complete key bindings, game phases, interaction details
- Evacuation status in Broadcast Report + mini-map crew/pod markers

## Known Issues

- Controller/gamepad input not yet implemented
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

## Sprint 13 Changes

- Restart state reset: all per-run variables (tutorial hints, drone encounters, bot introspections, broadcast/overlay state) properly cleared on restart
- Contextual defeat: heat-death shows RELAY TRIPPED prose, other defeats show LINK LOST
- Opening crawl: 2x faster typewriter (120 chars/sec), station subtitle, atmospheric first logs ("The station is quiet. What happened here?")
- 3D renderer: call rebuildEntityMeshes() on model load, entities get GLTF models immediately
- 3D game-over overlay: synced with 2D version (performance rating, rooms, evidence, deductions, crew evacuation, mystery choices)
- Removed dead VICTORY_TEXT import

## Sprint 12 Changes

- Evacuation phase transition: dramatic RED ALERT banner with tutorial hints and alarm SFX
- Help overlay: converted from log dump to HTML modal with complete bindings and game phase reference
- Evacuation tests: 13 new tests (crew discovery, following, hazard damage, pod boarding, state tracking)
- Broadcast Report: evacuation status section showing crew found/evacuated/dead, pods powered
- Mini-map: cyan markers for escape pods, yellow ! for following crew during evacuation
- 2 new audio SFX: evacuation alarm (descending tones), crew boarding confirmation

## Sprint 11 Changes

- Web Audio synthesizer: 12 procedural SFX (move, interact, scan, error, victory, defeat, phase transition, deduction ready/correct/wrong, PA static burst, choice ping)
- Game-over overlay polish: performance rating (S/A/B/C/D) with color-coded display, rooms explored, evidence collected, deduction accuracy, mystery choices summary
- Tutorial hints: 3 early-turn tips (turns 3/8/15) + event-triggered hints (first evidence, first deduction, investigation phase)

## Sprint 10 Changes

- Mystery choices wired into broadcast modal: 3 narrative decisions (blame, data handling, incident-specific) at evidence thresholds (3/6/10 journal entries)
- Consolidated applyDeductionReward: single sim-side pure function used by both browser and harness
- Log panel capacity increased from 16 to 24 entries
- Pinned notification at top of log panel: shows "DEDUCTION READY" or recovery phase guidance

## Sprint 9 Changes

- Deduction confirmation prompt: Y/N before locking in answers (both journal and broadcast paths)
- Broadcast modal now shows all 5-6 deductions (was only showing first per category, missing 3 of 6)
- [DEDUCTION READY] status bar indicator when unlocked deductions are available
- Phase indicator in sidebar objective panel: MAINTENANCE / INVESTIGATION / RECOVERY / EVACUATION
- Station map [m] renders as HTML overlay instead of destroying the log panel

## Sprint 8 Changes

- Save/load system: auto-saves every 5 turns to localStorage, resumes on page reload
- Phase-aware PA announcements: investigation and recovery phase-specific messages
- Mini-map widget in sidebar: compact ASCII room layout with player position
- Updated FUTURE_FEATURES.md, marked completed items

## Sprint 7 Changes

- Evidence Browser overlay: scrollable journal with full content, room locations, tags, thread grouping, crew references, and deduction linking (tabs: ALL / THREADS / DEDUCTIONS)
- Ship computer PA announcements: CORVUS-7 CENTRAL broadcasts every ~15 turns (context-aware: general, warning, atmospheric pools)
- Sidebar polish: evidence count, deduction progress (correct/total), updated key hints
- Airlock entity system: toggleable airlocks that vent atmosphere to 0 pressure
- Complete isEntityExhausted: added missing cases for EvidenceTrace, SensorPickup, DataCore, ServiceBot, CrewNPC, EscapePod, RepairCradle, SecurityTerminal
- Claude driver fixes: assistant prefill for JSON output, greedy regex for nested braces, Haiku model default
- Heuristic playtest bot: automated gameplay verification (playtest_bot.ts)
- Fire system: slow spread with low-pressure suppression

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
