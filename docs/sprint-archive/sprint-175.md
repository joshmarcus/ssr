# Sprint 175 — V349-V352 (Polish & Balance)
**Status:** COMPLETE
**Theme:** Gameplay balance fixes + new player experience polish from QA findings

## Tasks
- [x] 1. BUG-003: Cleaning requires multiple actions — reduced dirt-per-clean (center 12-17, surrounding 6-9) — `src/sim/step.ts` — small
- [x] 2. BUG-007: Scan wave ring reduced — max scale 9x (was 16x), duration 1.0s (was 1.5s) — `src/render/display3d.ts` — small
- [x] 3. New game message pacing — CORVUS-7 lore deferred until player acts, only "LINK ACTIVE" at T:0 — `src/browser.ts` — medium
- [x] 4. Updated BUGS.md — all 8 bugs marked with fix status — `BUGS.md` — small

## Progress Log
- 2026-02-23: Sprint planned
- 2026-02-23: All 4 tasks completed, tsc clean, 408 tests passing
- 2026-02-23: Committed and pushed as V349-V352
