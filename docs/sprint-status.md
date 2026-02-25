# Sprint 176 — V353-V358
**Status:** COMPLETE
**Theme:** Critical UX bug fixes + CORVUS-7 narrative personality for the relay feed panel

## Tasks
- [x] 1. BUG-010: Suppress low-value sensor/nearby messages that duplicate action bar — `src/browser.ts` — medium
- [x] 2. BUG-009: Auto-dismiss NEW GOAL DISCOVERED notification after 5s — `src/render/display3d.ts` — small (already had 5s auto-dismiss)
- [x] 3. BUG-012: Replace scan wave sphere with brief expanding ring — `src/render/display3d.ts` — small (already ring from Sprint 175)
- [x] 4. CORVUS-7 personality: contextual relay feed commentary (room-entry observations, evidence reactions, idle musings) — `src/data/narrative.ts`, `src/browser.ts` — large
- [x] 5. BUG-013: Tab key cycles interaction target — `src/render/display3d.ts` — medium (already implemented)

## Progress Log
- 2026-02-25: Sprint planned
- 2026-02-25: Task 1 complete — suppressed "You detect:" and "X objects to investigate" messages in browser.ts
- 2026-02-25: Tasks 2,3,5 verified already implemented in prior sprints
- 2026-02-25: Task 4 complete — added CORVUS_EVIDENCE_REACTIONS, CORVUS_IDLE_MUSINGS, CORVUS_ROOM_MUSINGS (3 personality variants, ~160 lines of dialog) with hooks in browser.ts
- 2026-02-25: Visual QA passed — CORVUS-7 personality dialog rendering correctly in narrative panel
- 2026-02-25: All 408 tests passing, tsc clean. Sprint complete.
