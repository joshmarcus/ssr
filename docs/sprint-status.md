# Sprint 178 — V364-V368
**Status:** COMPLETE
**Theme:** Mystery immersion — crew dialogue, investigation HUD, narrative depth

## Tasks
- [x] 1. Crew NPC personality dialog: procedural one-liners based on crew personality, fate, and relationship to incident — `src/sim/step.ts`, `src/data/narrative.ts` — medium
- [x] 2. Investigation progress HUD widget: persistent mini-tracker showing deduction chain progress (WHAT→WHERE→WHY→WHO→BLAME with checkmarks) — `src/render/display3d.ts`, `src/index.html` — medium
- [x] 3. CORVUS-7 investigation nudges: contextual hints when player lingers without progress (e.g., "Try scanning this room" or "There's a terminal nearby") — `src/browser.ts` — small
- [x] 4. Evidence discovery VFX: brief screen-edge flash + sound when picking up evidence (differentiate from normal interactions) — `src/render/display3d.ts`, `src/browser.ts` — small
- [x] 5. Relay feed: show room name headers on room transitions (like DE's location chapter markers) — `src/render/display3d.ts`, `src/index.html` — small

## Progress Log
- 2026-02-25: Sprint planned, executing immediately
- 2026-02-25: Task 5 complete — room name headers in narrative panel on room transitions
- 2026-02-25: Task 4 complete — teal evidence discovery screen-edge flash VFX
- 2026-02-25: Task 3 complete — personality-driven investigation nudges (3 personalities × 3 messages)
- 2026-02-25: Task 2 complete — case tracker widget with WHAT→WHERE→WHY→WHO→BLAME chain
- 2026-02-25: Task 1 complete — 20 procedural crew discovery one-liners (5 personalities × 4 lines)
- 2026-02-25: Visual QA passed — all features verified via screenshots
- 2026-02-25: All 408 tests passing, tsc clean. Sprint complete.
