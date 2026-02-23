# Mystery Gameplay Implementation Status

> **Master design document**: [`MYSTERY_GAMEPLAY.md`](./MYSTERY_GAMEPLAY.md) — do not lose the overall vision.
> This file tracks sprint-by-sprint implementation progress.

## Current Phase: Sprint 1 — Room Scene Foundation

### Sprint Overview

| Sprint | Goal | Status |
|--------|------|--------|
| Sprint 0 | Refactor timeline.ts for deterministic room assignment | DONE |
| Sprint 1 | Room Scene Foundation (RoomScene, PhysicalClue, scene processing) | IN PROGRESS |
| Sprint 2 | Crew Dossiers & Identity (themed biographies, auto-populate) | PLANNED |
| Sprint 3 | Incident Board & Timeline (system-proposed cards, revelation triggers) | PLANNED |
| Sprint 4 | Two-Story Structure (evidence accumulation, contradiction pairs, Crack Moment) | PLANNED |
| Sprint 5 | Investigation Hub Redesign (3-band Dossier Wall, overlay consolidation) | PLANNED |
| Sprint 6 | Moral Dimension & Endgame (moral choice, scoring, summary) | PLANNED |

---

## Sprint 0 — Refactor Timeline Room Assignment

**Status**: DONE (commit `49c4647`)

**Goal**: Make `timeline.ts` assign timeline beat locations deterministically based on room types and crew duty stations, not randomly.

### Tasks
- [x] Refactor `generateTimeline()` to accept rooms with types
- [x] Map each TimelinePhase to a logical room type per archetype (`ARCHETYPE_PHASE_ROOMS`)
- [x] Add `phaseRooms: Partial<Record<TimelinePhase, string>>` to `IncidentTimeline` interface
- [x] Fallback logic when needed room type doesn't exist in procgen layout
- [x] Verify with golden seed test (seed 184201)
- [x] All 295 tests passing (292 original + 3 new)

### Changes Made
- **`src/shared/types.ts`**: Added `phaseRooms` field to `IncidentTimeline` interface
- **`src/sim/timeline.ts`**:
  - Added `ARCHETYPE_PHASE_ROOMS` mapping (6 archetypes x 5 phases = 30 room preferences)
  - Added `selectPhaseRoom()` function with 3-tier priority: archetype prefs → crew duty rooms → random fallback
  - Refactored `generateTimeline()` to use deterministic room selection per phase
  - Updated `fillTemplate()` to use event location for `{room}` placeholder when available
  - Imported `ROLE_DUTY_ROOMS` from `crewPaths.ts`
- **`src/sim/crewPaths.ts`**: Exported `ROLE_DUTY_ROOMS` (was module-private)
- **`tests/timeline.test.ts`**: Added 3 tests — archetype-appropriate rooms, unique room preference, all-archetype coverage
- **`tests/recovery.test.ts`, `tests/evacuation.test.ts`, `tests/deduction-edge-cases.test.ts`**: Added `phaseRooms: {}` to test IncidentTimeline objects

### Issues Found
- None. All existing tests including golden seed determinism test pass cleanly.

---

## Sprint 1 — Room Scene Foundation

**Status**: IN PROGRESS

**Goal**: Implement Room Scene data structures and the physical clue generation pipeline. Each room becomes a "crime scene" with 2-4 physical clue objects tied to what happened there.

### Tasks
- [ ] Define `PhysicalClue` interface (type, description, sensorRequired, crewId, phase, position)
- [ ] Define `RoomScene` interface (roomName, clues, sceneQuestion WHO/WHAT/OUTCOME, groundTruth, processed)
- [ ] Add `roomScenes` to `MysteryState`
- [ ] Create `src/sim/roomScenes.ts` — generation pipeline using timeline phaseRooms + crew paths
- [ ] Generate 2-4 clues per room using evidence writing templates (Interrupted Moment, Unreliable Observer, Physical Tell)
- [ ] Scene processing answer pools per archetype (WHO options, WHAT options, OUTCOME options)
- [ ] Wire into procgen pipeline (`src/sim/procgen.ts`)
- [ ] Tests for room scene generation
- [ ] Verify with golden seed

### Changes Made
(will be filled in as work progresses)

### Issues Found
(will be filled in as work progresses)
