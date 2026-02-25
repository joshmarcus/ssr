# Sprint 184 — V394-V398
**Status:** COMPLETE
**Theme:** Tension & awareness — health concern, save preview, audio variation, pacing

## Tasks
- [x] 1. Title screen save preview — when Continue is highlighted, shows T:{turn} · {room} · {phase} · {%}% explored — `src/browser.ts`, `src/sim/saveLoad.ts`
- [x] 2. CORVUS-7 HP concern messages — 3 personality variants × 3 severity levels (75%/50%/25%), once per threshold per run — `src/browser.ts`, `src/data/narrative.ts`
- [x] 3. Room-type movement audio variation — 6 room-type categories with distinct pitch/timbre/waveform — `src/render/audio.ts`, `src/browser.ts`
- [x] 4. Turn pacing color indicator — T: counter shifts green→white→amber→red as turns progress — `src/render/display3d.ts`
- [x] 5. Low-HP heartbeat audio — persistent double-tap heartbeat below 40% HP, faster as HP drops, stops on game over — `src/render/audio.ts`, `src/browser.ts`

## Progress Log
- 2026-02-25: Sprint planned, executing immediately
- 2026-02-25: All 5 tasks implemented
- 2026-02-25: Fixed peekSave() — save wrapper format (_version/state), room width/height fields, objectivePhase instead of milestones
- 2026-02-25: Visual QA via Playwright: title screen save preview verified, turn counter visible, game renders correctly
- 2026-02-25: tsc clean, 408/408 tests pass
