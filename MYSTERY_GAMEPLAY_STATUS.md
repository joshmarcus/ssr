# Mystery Gameplay Implementation Status

> **Master design document**: [`MYSTERY_GAMEPLAY.md`](./MYSTERY_GAMEPLAY.md) — do not lose the overall vision.
> This file tracks sprint-by-sprint implementation progress.

## Current Phase: Sprint 0 — Refactor Timeline Room Assignment

### Sprint Overview

| Sprint | Goal | Status |
|--------|------|--------|
| Sprint 0 | Refactor timeline.ts for deterministic room assignment | IN PROGRESS |
| Sprint 1 | Room Scene Foundation (RoomScene, PhysicalClue, scene processing) | PLANNED |
| Sprint 2 | Crew Dossiers & Identity (themed biographies, auto-populate) | PLANNED |
| Sprint 3 | Incident Board & Timeline (system-proposed cards, revelation triggers) | PLANNED |
| Sprint 4 | Two-Story Structure (evidence accumulation, contradiction pairs, Crack Moment) | PLANNED |
| Sprint 5 | Investigation Hub Redesign (3-band Dossier Wall, overlay consolidation) | PLANNED |
| Sprint 6 | Moral Dimension & Endgame (moral choice, scoring, summary) | PLANNED |

---

## Sprint 0 — Refactor Timeline Room Assignment

**Status**: IN PROGRESS

**Goal**: Make `timeline.ts` assign timeline beat locations deterministically based on room types and crew duty stations, not randomly.

### Tasks
- [ ] Refactor `generateTimeline()` to accept rooms with types
- [ ] Map each TimelinePhase to a logical room type per archetype
- [ ] Add `phaseRoom: Record<TimelinePhase, string>` to timeline interface
- [ ] Fallback logic when needed room type doesn't exist in procgen layout
- [ ] Verify with golden seed test (seed 184201)
- [ ] All 292+ tests passing

### Changes Made
(will be filled in as work progresses)

### Issues Found
(will be filled in as work progresses)
