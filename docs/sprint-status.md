# Sprint 174 — V344-V348 (Bugfix Sprint)
**Status:** COMPLETE
**Theme:** Fix game-breaking bugs from QA — subtitle spam, loading gate, fade, hazard, tutorial

## Tasks
- [x] 1. BUG-008/002: Subtitle queue overhaul — auto-dismiss system/sensor/warning msgs, queue limit 5, Space passes through — `src/render/display3d.ts` — large
- [ ] 2. BUG-007: Sensor pickup blue sphere — could not reproduce/locate in codebase, logged for visual verification — `src/render/display3d.ts` — deferred
- [x] 3. BUG-006: "ROOM CLEANED" at T:0 — guard on `state.turn >= 1` in updateTutorialObjective — `src/browser.ts` — small
- [x] 4. BUG-004: Loading gate — full-screen overlay with progress bar until models load — `src/render/display3d.ts` — medium
- [x] 5. BUG-001 + BUG-005: rAF fade CSS transition fallback + setTimeout safety + hazard border cleared in destroy/showTitleScreen — `src/render/display3d.ts`, `src/browser.ts` — small

## Unknowns
- BUG-007 (sensor blue sphere): Exhaustive search found no large sphere creation. May be scan wave ring animation (scales to 16x) or a GLTF model issue. Needs visual verification.

## Progress Log
- 2026-02-23: Sprint planned, awaiting approval
- 2026-02-23: All tasks executed in parallel
- 2026-02-23: Tasks 1, 3, 4, 5 complete — tsc clean, 408 tests passing
- 2026-02-23: BUG-007 deferred — could not identify blue sphere geometry
- 2026-02-23: Committed and pushed as V344-V348
