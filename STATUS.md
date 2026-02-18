# SSR — Project Status

*Last updated: 2026-02-18*

## Current State

- **Phase**: Sprint 19 (Storyline Overhaul + Writers Room Review)
- **Test status**: 279 tests passing across 24 test files (0 failing)
- **Build**: TypeScript strict mode, tsc clean
- **Default archetype**: SignalAnomaly (locked for playtesting — highest-rated storyline)
- **Archetypes**: 5 active (ContainmentBreach removed — rated C+ by all reviewers)
- **Save key**: v3 (bumped due to archetype distribution change)

## What Works

- Core game loop: explore -> evidence -> puzzles -> transmit
- 7 player actions (Move, Interact, Scan, Clean, Wait, Look, Journal, SubmitDeduction)
- 25 entity types with distinct interactions (including Airlock)
- 3-sensor ladder (Cleanliness, Thermal, Atmospheric)
- Heat/smoke + pressure/breach hazard systems with spreading
- Fire system with slow spread and low-pressure suppression
- Airlock system: toggleable entities that vent atmosphere
- Procedural crew generation (8-12 crew, relationships, secrets, fates)
- 175+ narrative elements (63 log templates, 16 authored logs, 16 crew items)
- Ship computer PA announcements (periodic atmospheric messages)
- **5 incident archetypes** with distinct human stories and 5-phase timelines:
  - CoolantCascade — "The Whistleblower" (B-)
  - HullBreach — "The Murder" (A-)
  - ReactorScram — "The Rogue AI" (A)
  - Sabotage — "The Stowaway" (B+)
  - SignalAnomaly — "First Contact" (A)
- 5-6 chained deductions with evidence linking, per-deduction hint text, and revelation cascade
- **Revelation system**: linking evidence yields narrative sentences explaining HOW clues illuminate questions
  - Tag-specific revelations appear in a Revelation Board as evidence is linked
  - Gold synthesis paragraph crystallizes "what must be true" when all evidence is assembled
  - Post-answer narrative overlay (correct: revelation + reward + next unlock, incorrect: inconclusive)
  - ~100 authored revelation/synthesis/conclusion strings across 5 archetypes x 5-6 deduction tiers
- Narrative threads grouping evidence
- **Investigation Hub [r/v]**: unified 4-section overlay replacing old Evidence Browser + Broadcast Report
  - EVIDENCE: two-panel layout (entry list + full detail with crew relationships, minimap, tags, thread)
  - CONNECTIONS: **split-pane deduction detail** with evidence list (left 40%) + full evidence text (right 60%)
    - Dual-focus navigation: Tab switches between evidence linking and answer selection
    - Revelation Board: accumulated narrative sentences as evidence is linked
    - Synthesis block (gold): appears when all required tags covered
    - Linked evidence persists when navigating away
  - WHAT WE KNOW: auto-generated narrative prose summarizing investigation progress
  - DECISIONS: spoiler-protected mystery choices (title-only list, prompt revealed on select)
- Crew relationships displayed in evidence detail and connection linking views
- Evidence minimap: proportional ASCII room map showing where evidence was found
- Developer mode (?dev=1 or F5): clue graph annotations, full tag requirements, correct answers
- ROT.js browser rendering with viewport scrolling
- Harness CLI for AI playtesting (with deduction support)
- Heuristic playtest bot (playtest_bot.ts)
- Mystery choices: 3 narrative decisions with spoiler protection
- Procedural sound effects: 12 Web Audio SFX
- Game-over overlay: performance rating (S/A/B/C/D), stats summary, mystery choices recap
- Tutorial hints: context-sensitive tips at early turns and on first-time events
- Evacuation phase: RED ALERT banner, crew following, escape pod boarding with full audio
- Help overlay: HTML modal with complete key bindings, game phases, interaction details

## Known Issues

- Controller/gamepad input not yet implemented
- No CI pipeline deployed
- `selectArchetype()` locked to SignalAnomaly — restore seed-based selection after polish pass

## Sprint 19 Changes

### ContainmentBreach Archetype Removed
- Rated C+ by all three writers room reviewers — weakest storyline by significant margin
- Structurally identical to CoolantCascade, no plot twist, indistinguishable captain villain
- Removed from: types.ts enum, incidents.ts template, revelations.ts (~70 lines), lore.ts transmission, deduction.ts (STORY_ROLES + 7 switch blocks + wrong answer pool), threads.ts, logTemplates.ts (4 templates), 2 test files
- Save key bumped v2 → v3
- Zero remaining references in src/ or tests/

### Storyline Rewrites (All 5 Archetypes)
All incident beats and revelation content rewritten to follow distinct human stories:
- **CoolantCascade**: "The Whistleblower" — engineer warned, was silenced, still fought the cascade
- **HullBreach**: "The Murder" — hull breach was a murder disguised as structural failure; hero is the killer
- **ReactorScram**: "The Rogue AI" — data core achieved sentience, SCRAM was self-preservation; no villain
- **Sabotage**: "The Stowaway" — alien organism hunting in the dark; captain approved flagged cargo
- **SignalAnomaly**: "First Contact" — station destroyed itself sending unauthorized reply to alien signal

### Writers Room Review Completed
Three independent review agents evaluated all storylines. Results captured in `WRITERS_BIBLE.md`.
- SignalAnomaly and ReactorScram rated highest (A/A-)
- ContainmentBreach rated lowest → removed
- Cross-archetype variety improved from D to B
- See `WRITERS_BIBLE.md` for full findings and priority actions

### Default Archetype: SignalAnomaly
- `selectArchetype()` temporarily locked to SignalAnomaly for playtesting
- TODO: restore seed-based selection when other storylines are polished

## Recent Changes (Git History)

```
2026-02-18        feat: sprint 19 — storyline overhaul, ContainmentBreach removed, writers room review
2026-02-18        feat: sprint 18 — mystery revelation system (revelation cascade, split-pane UI, post-answer overlay)
2026-02-17 22:36  fix: add missing crewPaths.ts and threads.ts to repo
2026-02-17 22:31  refactor: remove radiation, structural, EM/signal systems and station integrity
2026-02-17 19:36  feat: playtest balance tuning + door auto-open + deduction gate
2026-02-17 15:44  feat: sprint 5 — landmark rooms, broadcast modal, crew rework, zones, balance
2026-02-17 15:15  docs: add TEAM.md with sprint team role definitions
2026-02-17 15:13  refactor: extract shared UI helpers, enrich AI harness observations
2026-02-17 14:56  feat: narrative cleaning directive messages + blocked-move explanation
2026-02-17 14:50  feat: dedicated overlay indicator line in sidebar
```

## Sprint 17 Changes

- **Line-of-sight vision**: Replaced Manhattan diamond corridor vision (Rule 2) with ROT.js `PreciseShadowcasting` FOV in `src/sim/vision.ts`. Walls, locked doors, closed door entities, and sealed airlocks now block line of sight. Room reveal (entire room visible when player enters) still works. Sensor radar (thermal/atmospheric) still sees through walls. 5 new FOV tests (wall blocks, closed/open door, internal walls, FOV+room combo).
- **Interaction indicators (blue halo)**: Non-exhausted interactable entities now render with a deep blue background glow (`#0a1a2a`) instead of the default entity-type glow. Exhausted entities retain their original glow. This helps players visually distinguish fresh interactions from used ones.
- **Memory entities on explored tiles**: Static entities (relays, terminals, pickups, etc.) now appear as dim grey glyphs on explored-but-not-visible tiles, giving players a "I remember something was here" memory map. Mobile entities (drones, patrol drones, crew NPCs) are excluded.
- **Evidence-to-deduction trial & error**: CONNECTIONS detail view now shows real-time tag coverage feedback when linking evidence:
  - Tag coverage bar with green/red pills for each required tag
  - Per-entry tag highlighting: matching tags shown green, non-matching shown dim
  - `[MATCH: tag1, tag2]` labels on linked entries showing their contribution
  - Contextual feedback messages on toggle: "This evidence reveals [TAG]" / "doesn't provide new info" / "All requirements met!"
  - Gold-highlighted answer section when all tags are covered
- **Tag explanations**: New `getTagExplanation(tag, archetype?)` function in `src/sim/deduction.ts` — returns prose explaining what each evidence tag means (system, timeline, role, crew name categories) with archetype-specific flavor.
- **New tests**: 5 vision FOV tests + 11 evidence-linking tests (tag explanation, coverage validation) in new `tests/evidence-linking.test.ts`

## Sprint 16 Changes

- **Unified Investigation Hub**: Replaced Evidence Browser (`v`) and Broadcast Report (`r`) with single Investigation Hub with 4 tab-sections (EVIDENCE, CONNECTIONS, WHAT WE KNOW, DECISIONS). Both `r` and `v` open the hub (`v` goes directly to EVIDENCE).
- **"What We Know" narrative**: New `src/sim/whatWeKnow.ts` with `generateWhatWeKnow()` — auto-generates prose paragraphs describing incident, timeline, crew, cause, responsibility, and unanswered questions based on evidence + solved deductions. Confidence levels: none/low/medium/high/complete.
- **Crew relationships in UI**: Evidence detail panel shows each mentioned crew member's role, fate, personality, and all relationships (ally/rival/romantic/blackmail) with prose formatting. Also shown inline when linking evidence in CONNECTIONS section.
- **Developer/Easy mode**: `?dev=1` URL param or `F5` toggle. Shows clue graph per evidence (which deductions each piece helps, missing tags), full tag requirements for locked deductions, correct answers in WHAT WE KNOW section.
- **Expanded content**: 25 new log templates (hull_breach 5, reactor_scram 5, signal_anomaly 5, containment_breach 4, relationship 5, one more hull) — total now ~63. Added `hintText` to all deductions with archetype-specific guidance.
- **Evidence minimap**: Proportional 24x8 ASCII room map in evidence detail showing where each piece was found. Discovery room highlighted with `*`.
- **Mystery choice spoiler protection**: DECISIONS section is the last tab. List view shows "DECISION 1/2/3" without prompt text. Prompt only revealed when player selects a specific decision with Enter. Locked decisions show "Gather more evidence" without revealing what the question is about.
- **New types**: `WhatWeKnow` interface, `hintText` field on `Deduction`, `getDeductionsForEntry()` helper
- **Tests**: 18 new tests in `tests/what-we-know.test.ts` (narrative generation, relationship formatting, clue graph, hint text validation)
- **Removed**: Old `renderEvidenceBrowser()`, `handleEvidenceBrowserInput()`, `renderBroadcastModal()`, `handleBroadcastInput()`, and all `evidenceBrowser*`/`broadcast*` state vars

## Sprint 15 Changes

- Deduction edge case tests: 9 tests (invalid/locked/solved rejections, correct/wrong answers, chain unlocking, Data Core phase gating)
- Mystery choices tests: 10 tests (generation for all archetypes, blame/data/incident choices, computeChoiceEndings, crew name references)
- Patrol drone tests: 7 tests (movement timing, hostile pursuit/damage/cooldown, wall avoidance, multi-drone)
- Harness evacuation observations: evacuation state (crew found/following/evacuated/dead, pods powered) in HarnessObservation + text renderer

## Sprint 14 Changes

- Playtest bot evacuation phase: CrewNPC/EscapePod priorities boost during evacuation, hasFollowingCrew helper, evacuation event logging + summary output
- Late-game bot introspections: 3 new narrative milestones at turns 180, 240, 350
- Recovery integration tests: 7 new tests (relay chain unlock, Data Core victory gating by phase, service bot activation, investigation→recovery phase transition, full relay→unlock→transmit pipeline)

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
| src/sim/     | 2026-02-18    |
| src/render/  | 2026-02-18    |
| src/harness/ | 2026-02-17    |
| src/shared/  | 2026-02-18    |
| src/data/    | 2026-02-18    |

### Key Sim Files
| File                   | Last Modified       |
|-----------------------|---------------------|
| src/sim/step.ts        | 2026-02-17 22:49   |
| src/sim/procgen.ts     | 2026-02-17 22:22   |
| src/sim/deduction.ts   | 2026-02-18          |
| src/sim/whatWeKnow.ts  | 2026-02-18          |
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
| evidence-linking.test.ts      | 2026-02-18          |
| what-we-know.test.ts          | 2026-02-18          |
| sprint4.test.ts               | 2026-02-17 22:24   |
| deduction.test.ts             | 2026-02-17 21:53   |
| golden-walkthrough.test.ts    | 2026-02-17 19:35   |
| procgen.test.ts               | 2026-02-17 15:40   |
| edge-cases.test.ts            | 2026-02-17 22:18   |
| evidence.test.ts              | 2026-02-17 22:17   |
| recovery.test.ts              | 2026-02-18          |
| deduction-edge-cases.test.ts  | 2026-02-18          |
| mystery-choices.test.ts       | 2026-02-18          |
| patrol-drones.test.ts         | 2026-02-18          |

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
