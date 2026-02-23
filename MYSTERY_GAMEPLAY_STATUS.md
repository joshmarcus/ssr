# Mystery Gameplay Implementation Status

> **Master design document**: [`MYSTERY_GAMEPLAY.md`](./MYSTERY_GAMEPLAY.md) — do not lose the overall vision.
> This file tracks sprint-by-sprint implementation progress.

## Current Phase: Sprint 8 — Memory Echoes + Vestigial Cleanup

### Sprint Overview

| Sprint | Goal | Status |
|--------|------|--------|
| Sprint 0 | Refactor timeline.ts for deterministic room assignment | DONE |
| Sprint 1 | Room Scene Foundation (RoomScene, PhysicalClue, scene processing) | DONE |
| Sprint 2 | Crew Dossiers & Identity (themed biographies, auto-populate) | DONE |
| Sprint 3 | Incident Board & Timeline (system-proposed cards, revelation triggers) | DONE |
| Sprint 4 | Two-Story Structure (evidence accumulation, contradiction pairs, Crack Moment) | DONE |
| Sprint 5 | Game Loop Integration (step.ts wiring, harness updates, integration tests) | DONE |
| Sprint 6 | Investigation Hub UI + Moral Dimension (overlay rendering, endgame) | DONE |
| Sprint 7 | Discovery Moments VFX + Moral Dimension + Delayed Feedback | DONE |
| Sprint 8 | Memory Echoes + Vestigial Cleanup | DONE |

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

## Sprint 5 — Game Loop Integration

**Status**: DONE

**Goal**: Wire the new mystery systems into the game's step function and player interaction flow.

### Tasks
- [x] Wire scene processing into step.ts (ActionType for examining clues and processing scenes)
- [x] Wire dossier updates into step.ts (badge discovery, scene WHO answers)
- [x] Wire incident board proposals into the game loop
- [x] Wire evidence accumulation + crack moment + contradiction detection
- [x] Update harness/observation format for new mystery systems
- [ ] Update Investigation Hub overlay rendering (deferred to Sprint 6)
- [x] Integration test: full mystery flow from room entry to scene solved

### Changes Made
- **`src/shared/types.ts`**: Added 4 new ActionTypes (`ExamineScene`, `ProcessScene`, `ConfirmTimeline`, `RejectTimeline`), extended Action interface with `sceneRoomId`, `whoAnswer`, `whatAnswer`, `outcomeAnswer`, `timelinePhase`, `cardCorrect` fields
- **`src/sim/step.ts`**: Added imports for roomScenes, crewDossiers, twoStory, incidentBoard modules. Added `updateMysteryBoardState()` helper. Implemented 4 new action handlers:
  - `ExamineScene`: Marks room clues as examined, adds journal entries, updates dossiers (badge → confirmIdentity), records evidence accumulation, checks crack moment, detects contradiction pair matches
  - `ProcessScene`: Evaluates WHO/WHAT/OUTCOME against ground truth, costs turns (escalating: 3/5/8/...), updates dossier theories from WHO, adds journal entry on success (score ≥ 2), decrements pending contradictions, detects new pending contradictions
  - `ConfirmTimeline`: Confirms/rejects timeline cards via incident board, auto-generates proposals/red herrings, applies 5-turn penalty on wrong, checks board completion
  - `RejectTimeline`: Reverts slot to unlocked
- **`src/harness/types.ts`**: Added `sceneStatus`, `evidenceAccumulation`, `dossierProgress`, `incidentBoard`, `contradictions`, `crackMomentFired` to HarnessObservation
- **`src/harness/claudeDriver.ts`**: Added mystery system fields to observation output, added `EXAMINE_SCENE`/`PROCESS_SCENE`/`CONFIRM_TIMELINE`/`REJECT_TIMELINE` to valid actions and action parser
- **`src/harness/obsRenderer.ts`**: Added mystery system fields to observation builder
- **`tests/mystery-integration.test.ts`** (new, 14 tests): Full integration tests covering examine→process→accumulate→confirm flow

### Issues Found
- Journal categories are `"log" | "item" | "trace" | "access" | "crew"`, not the more descriptive names I initially tried. Mapped physical clue types: badge/personal_effect → "crew", terminal_log/access_log → "log", everything else → "trace"
- "Free action" in this codebase still increments turn by 1 (just skips world tick). ExamineScene, ConfirmTimeline, RejectTimeline all do early return after the initial `turn + 1`
- `generateProposal()` returns null when no scenes are processed — timeline confirmation needs scene processing first
- TypeScript non-null assertions (`!`) needed throughout the ExamineScene handler because mystery state spreads lose type narrowing across reassignment

---

## Sprint 6 — Investigation Hub UI + Moral Dimension

**Status**: DONE

**Goal**: Update the Investigation Hub overlay rendering for the new mystery systems, add moral dimension and endgame.

### Tasks
- [x] Update Investigation Hub overlay to show room scenes, clue examination, scene processing UI
- [x] Add incident board timeline display (in SCENES tab sidebar)
- [x] Add evidence accumulation + crack moment visual feedback (in SCENES tab sidebar)
- [x] Add dossier progress summary (in SCENES tab sidebar)
- [x] Add dossier wall display (3-band: identified/partial/unknown) — enhanced CREW tab
- [x] Add investigation quality scoring + endgame summary
- [x] Playtest full mystery flow end-to-end (playtest bot + unit tests)

### Changes Made
- **`src/browser.ts`**: Major Investigation Hub expansion
  - New SCENES tab (5th tab) with scene list, detail view, and processing UI
  - Scene list shows: room name, clue count (examined/total/sensor-gated), evidence category, processing status
  - Evidence accumulation summary: confirming/ambiguous/contradicting counts + crack moment indicator
  - Incident board timeline display: 5 phases with status icons (locked/unlocked/proposed/confirmed)
  - Dossier progress summary: identified/total crew count
  - Scene detail view: all clues with type, text, crew links, evidence categories, sensor requirements
  - Scene process view: 3-column WHO/WHAT/OUTCOME picker with keyboard navigation
    - WHO: select from crew list (identified names or "Crew #N")
    - WHAT: 12 SceneActivity options
    - OUTCOME: 7 SceneOutcome options
    - Arrow keys navigate within column, Left/Right switch columns, Enter submits with Y/N confirm
  - Dev mode: shows ground truth WHO/WHAT/OUTCOME for debugging
  - State variables: hubSceneDetail, hubSceneSubView, hubSceneWhoIdx, hubSceneWhatIdx, hubSceneOutcomeIdx, hubSceneConfirming
  - [x] key binding: ExamineScene in current room
  - Scene notification on room entry: "SCENE: N physical clues detected. Press [x] to examine."
  - CREW tab enhanced with 3-band dossier display (IDENTIFIED/PARTIAL DATA/UNKNOWN)
  - Dossier theories (involvement, fate, location), personal details, scene evidence links
  - Banded keyboard navigation follows visual order
  - Investigation quality summary in endgame log (scenes, crew, timeline, contradictions, crack moment)
- **`src/render/display3d.ts`**: Endgame overlay enhancement
  - INVESTIGATION QUALITY section in game-over overlay
  - Enhanced scoring formula includes investigation quality (30% weight)
- **`playtest_bot.ts`**: Scene examination and processing support
  - Bot examines scene clues on room entry, processes scenes with ground truth
  - Station Autopsy stats in summary output
- New imports: SceneActivity, SceneOutcome, TimelinePhase, CrewDossier, RoomScene

### Playtest Results (seed 184201)
- 11/24 scenes processed (bot visits 12 rooms)
- 9 confirming / 8 ambiguous / 6 contradicting evidence
- CRACK MOMENT triggered
- 5/5 deductions correct, 36 evidence pieces
- All 379 tests passing across 29 test files

---

## Sprint 7 — Discovery Moments VFX + Moral Dimension + Delayed Feedback

**Status**: DONE

**Goal**: Implement all missing visual/UX feedback from the design doc, plus the Moral Dimension endgame system.

### Gaps Identified (from design doc audit)

The simulation layer was 95% complete but the visual feedback layer had significant gaps:

1. **Moral Dimension (Part 6)** — Final moral deduction at DataCore terminal was entirely unimplemented
2. **Crack Moment VFX (Part 3)** — Was only a text log, needed to be the game's biggest dramatic beat
3. **Contradiction Found VFX (Part 4)** — Needed VHS-style tear, split view, "CONTRADICTION DETECTED" overlay
4. **Timeline Confirmed VFX (Part 4)** — Needed card confirmation visual + completion sweep
5. **Crew Fate Confirmed VFX (Part 4)** — Needed identification milestone log
6. **Delayed Scene Feedback** — Design says delay until room exit; implementation was instant
7. **Memory Echo rendering** — memory_echo clue type exists but has no ghost animation in 3D (deferred)

### Tasks
- [x] Implement Moral Dimension: final moral deduction at DataCore with archetype-specific moral questions
- [x] Implement Crack Moment VFX: screen glitch, fracture overlay, amber tint, "NARRATIVE BREACH" banner
- [x] Implement Contradiction Found VFX: VHS-style glitch, split-view clue comparison, "CONTRADICTION DETECTED"
- [x] Implement Timeline Confirmed VFX: milestone flash, completion sweep overlay when all 5 phases filled
- [x] Implement Crew Fate Confirmed VFX: milestone log with identified count
- [x] Delay scene processing feedback until room exit
- [x] Update STATUS.md with Sprint 7 changes
- [ ] Memory Echo ghost rendering in 3D (deferred to future sprint)

### Changes Made
- **`src/sim/mysteryChoices.ts`**:
  - `generateMoralChoice()` — archetype-specific moral questions for all 6 archetypes
  - Each moral choice has 3 options with no correct answer (accountability/systemic/nuance framing)
  - `isMoralChoiceUnlocked()` — investigation-quality gate (crack moment fired OR 5+ scenes + 3+ crew ID'd)
  - Moral choice ending text in `computeChoiceEndings()` — unique per-answer epilogue lines
- **`src/sim/step.ts`**:
  - `isMoralChoiceUnlocked` import and special-case unlock check in SubmitChoice handler
  - `moral_judgment` consequence in `applyChoiceConsequence()` — no mechanical effect, narrative only
- **`src/browser.ts`**: Major discovery moment system
  - `showDiscoveryOverlay()` — reusable full-screen cinematic overlay with title, subtitle, body, glitch animation, auto-dismiss
  - `triggerCrackMoment()` — "NARRATIVE BREACH" overlay with amber tint, glitch animation, fracture text
  - `triggerContradictionFound()` — "CONTRADICTION DETECTED" overlay with red tint, split evidence view
  - `triggerTimelineConfirmed()` — "TIMELINE COMPLETE" overlay when all 5 phases filled, milestone flash for individual phases
  - `triggerCrewFateConfirmed()` — milestone log with crew identification progress
  - `checkDiscoveryMoments()` — state transition detector comparing pre/post step() values
  - Delayed scene feedback: ProcessScene result logs stored as `pendingSceneResult`, shown when player exits room
  - Moral choice unlock notification: "Final moral assessment now available at the Data Core"
  - CSS animation keyframes: discoveryGlitch (screen shake), discoveryFlicker (opacity pulse)
  - All transition tracking variables reset on game restart
- **Tests**: Updated mystery-choices.test.ts and timeline.test.ts for 4 choices (3 standard + 1 moral)
- All 379 tests passing across 29 test files

---

## Sprint 8 — Memory Echoes + Vestigial Cleanup

**Status**: DONE

**Goal**: Complete memory echo ghost rendering pipeline, delete deprecated code, remove vestigial UI elements.

### Tasks
- [x] Generate memory_echo clues in roomScenes.ts (30% chance per room with crew, Thermal sensor required)
- [x] Emit special `log_memory_echo_` logs in step.ts ExamineScene handler
- [x] Add `triggerGhostReveal(crewId)` public method to display3d.ts — triggers existing SceneEcho revelation animation
- [x] Detect `log_memory_echo_` logs in browser.ts and call `triggerGhostReveal` on the 3D renderer
- [x] Delete deprecated 2D renderer `src/render/display.ts` (no imports, only comment references)
- [x] Remove vestigial WHAT WE KNOW tab from Investigation Hub (4 tabs instead of 5)
- [x] Update displayInterface.ts with optional `triggerGhostReveal` method

### Changes Made
- **`src/sim/roomScenes.ts`**: Added memory_echo clue generation — 30% chance per room with crew present, requires Thermal sensor, uses `CLUE_TEMPLATES.memory_echo` templates
- **`src/sim/step.ts`**: ExamineScene handler emits `log_memory_echo_<crewId>_<turn>` log for memory echo clues with source "milestone"
- **`src/render/display3d.ts`**: Added `triggerGhostReveal(crewId)` — finds matching GhostSilhouette SceneEchoes by crewId, triggers revelation animation (0.5s ramp, 1.0s hold, 1.0s fade) via existing `_echoDiscoveryTimes` system
- **`src/render/displayInterface.ts`**: Added optional `triggerGhostReveal?(crewId: string): void` to IGameDisplay interface
- **`src/browser.ts`**:
  - Detects `log_memory_echo_` logs in the log processing loop, extracts crewId, calls `display.triggerGhostReveal?.()` on the 3D renderer
  - Removed WHAT WE KNOW tab: deleted from tab arrays, tab labels, rendering branch, input handling branch
  - Removed `generateWhatWeKnow` import (kept `formatRelationship`, `formatCrewMemberDetail`, `getDeductionsForEntry` — still used in CREW and EVIDENCE tabs)
  - Removed `lastWwkJournalCount` state variable and its reset
  - Investigation Hub now has 4 tabs: EVIDENCE, SCENES, CONNECTIONS, CREW
- **`src/render/display.ts`**: DELETED — deprecated 2D renderer, no imports anywhere in codebase
- All 379 tests passing across 29 test files
