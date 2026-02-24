# Sprint 174 — V344-V348 (Bugfix Sprint)
**Status:** IN PROGRESS
**Theme:** Fix game-breaking bugs from QA — subtitle spam, sensor sphere, false "room cleaned", loading gate, rAF fade

## Tasks
- [ ] 1. BUG-008/002: Subtitle queue overhaul — auto-dismiss low-priority messages, don't block movement, limit queue to 2-3 — `src/render/display3d.ts`, `src/browser.ts` — large
- [ ] 2. BUG-007: Sensor pickup blue sphere — dramatically reduce scale of sensor attachment visual effect — `src/render/display3d.ts` — small
- [ ] 3. BUG-006: "ROOM CLEANED" at T:0 — prevent cleaned banner firing before player acts — `src/sim/`, `src/render/display3d.ts` or `src/browser.ts` — medium
- [ ] 4. BUG-004: Loading gate — block 3D scene display until models finish loading, show progress bar — `src/render/display3d.ts`, `src/browser.ts` — medium
- [ ] 5. BUG-001 + BUG-005: rAF fade fallback + hazard border cleanup on title — use CSS transitions or setTimeout fallback; clear hazard border on screen change — `src/render/display3d.ts` — small

## Unknowns
- Subtitle system structure: need to locate the queue/dispatch logic to understand how to add auto-dismiss and priority levels

## Progress Log
- 2026-02-23: Sprint planned, awaiting approval
