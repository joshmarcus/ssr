# Mystery Gameplay Implementation Status

> **Master design document**: [`MYSTERY_GAMEPLAY.md`](./MYSTERY_GAMEPLAY.md) — do not lose the overall vision.
> This file tracks sprint-by-sprint implementation progress.

## Current Phase: Sprint 5 — Investigation Hub Redesign

### Sprint Overview

| Sprint | Goal | Status |
|--------|------|--------|
| Sprint 0 | Refactor timeline.ts for deterministic room assignment | DONE |
| Sprint 1 | Room Scene Foundation (RoomScene, PhysicalClue, scene processing) | DONE |
| Sprint 2 | Crew Dossiers & Identity (themed biographies, auto-populate) | DONE |
| Sprint 3 | Incident Board & Timeline (system-proposed cards, revelation triggers) | DONE |
| Sprint 4 | Two-Story Structure (evidence accumulation, contradiction pairs, Crack Moment) | DONE |
| Sprint 5 | Investigation Hub Redesign (3-band Dossier Wall, overlay consolidation) | IN PROGRESS |
| Sprint 6 | Moral Dimension & Endgame (moral choice, scoring, summary) | PLANNED |

---

## Sprint 0 — Refactor Timeline Room Assignment

**Status**: DONE (commit `49c4647`)

**Goal**: Make `timeline.ts` assign timeline beat locations deterministically based on room types and crew duty stations, not randomly.

### Changes Made
- **`src/shared/types.ts`**: Added `phaseRooms` field to `IncidentTimeline` interface
- **`src/sim/timeline.ts`**: `ARCHETYPE_PHASE_ROOMS` mapping (6 archetypes x 5 phases), `selectPhaseRoom()` with 3-tier priority, deterministic room selection
- **`src/sim/crewPaths.ts`**: Exported `ROLE_DUTY_ROOMS`
- 3 new timeline tests, 295 total passing

---

## Sprint 1 — Room Scene Foundation

**Status**: DONE (commit `a432f7c`)

**Goal**: Implement Room Scene data structures and physical clue generation pipeline.

### Changes Made
- **`src/shared/types.ts`**: Added `SceneActivity`, `SceneOutcome`, `PhysicalClue`, `RoomScene`, `EvidenceAccumulation`, `EvidenceCategory` types
- **`src/sim/roomScenes.ts`** (new, ~400 lines): Full room scene generation pipeline
  - Activity derivation from crew role + phase + archetype
  - Distance-based evidence category weighting
  - Clue text templates per type (badge, personal_effect, damage_pattern, access_log, terminal_log, tool, residue, barricade, modified_equipment, memory_echo)
  - Environmental damage clues (thermal, pressure, electrical, biological)
  - Sensor-gated clues (thermal handprints, atmospheric traces)
  - Scene processing with WHO/WHAT/OUTCOME scoring + increasing turn costs
- **`src/sim/procgen.ts`**: Wired room scene generation after crew path generation
- 14 new tests, 309 total passing

---

## Sprint 2 — Crew Dossiers & Identity

**Status**: DONE (commit `272737f`)

**Goal**: Crew members tracked as investigation targets with themed personalities.

### Changes Made
- **`src/shared/types.ts`**: Added `CrewDossier`, `CrewInvolvement` types
- **`src/sim/crewDossiers.ts`** (new, ~300 lines):
  - 30 themed character triplets across 6 themes (Homesick Professional, Obsessive Expert, Quiet Loyalist, Ambitious Outsider, Reluctant Authority, Careful Paranoid)
  - Triplet assignment without replacement during crew generation
  - Dossier lifecycle: create, confirmIdentity, updateTheoriesFromScene, linkEvidence, confirmFate
  - Activity-to-involvement mapping
  - Progress tracking (getDossierProgress, getIdentifiedCrewCount)
- **`src/sim/procgen.ts`**: Wired dossier creation with triplet assignment
- 21 new tests, 330 total passing

---

## Sprint 3 — Incident Board & Timeline

**Status**: DONE (commit `9bb4d29`)

**Goal**: System-proposed timeline reconstruction with player confirmation.

### Changes Made
- **`src/shared/types.ts`**: Added `TimelineSlotStatus`, `TimelineSlotCard`, `TimelineSlotState`, `IncidentBoardState` types
- **`src/sim/incidentBoard.ts`** (new, ~250 lines):
  - 5 timeline slots (NormalOps → Trigger → Escalation → Collapse → Aftermath)
  - Narrative-gated slot unlocking (rooms processed + crew identified + contradictions)
  - Summary Card generation from processed scenes
  - Red herring generation for player testing
  - Player confirm/reject with 5-turn penalty for wrong confirmations
  - Board completion tracking, narrative state builder
- **`src/sim/procgen.ts`**: Wired incident board creation
- 19 new tests, 349 total passing

---

## Sprint 4 — Two-Story Structure

**Status**: DONE (commit `364db6e`)

**Goal**: Official Story vs Real Story with contradiction pairs and Crack Moment.

### Changes Made
- **`src/sim/twoStory.ts`** (new, ~280 lines):
  - Contradiction pair templates for all 6 archetypes (2-3 pairs each)
  - Official Story evidence (near start) vs Real Story evidence (behind hazards)
  - Evidence accumulation tracking (confirming/ambiguous/contradicting)
  - Crack Moment trigger (confirming >= 3 AND contradicting >= 1)
  - Delayed contradiction detection (1-2 rooms after both halves found)
  - markEvidenceFound, revealContradiction, checkPendingContradictions
- **`src/sim/procgen.ts`**: Wired contradiction pair generation
- 16 new tests, 365 total passing

---

## Sprint 5 — Investigation Hub Redesign

**Status**: IN PROGRESS

**Goal**: Wire the new mystery systems into the game's step function and player interaction flow.

### Tasks
- [ ] Wire scene processing into step.ts (ActionType for examining clues and processing scenes)
- [ ] Wire dossier updates into step.ts (badge discovery, scene WHO answers)
- [ ] Wire incident board proposals into the game loop
- [ ] Wire evidence accumulation + crack moment + contradiction detection
- [ ] Update harness/observation format for new mystery systems
- [ ] Update Investigation Hub overlay rendering
- [ ] Integration test: full mystery flow from room entry to scene solved

### Changes Made
(will be filled in as work progresses)

### Issues Found
(will be filled in as work progresses)
