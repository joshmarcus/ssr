# Sprint 186 — V404-V408
**Status:** COMPLETE
**Theme:** Spatial presence — crew labels, speech bubbles, environmental particles, scanner compass

## Tasks
- [x] 1. Crew 3D floating name labels — CSS overlay with 3D→2D projection, shows name/role/status above crew NPCs — `src/render/display3d.ts`, `src/index.html` — medium
- [x] 2. Crew speech bubbles — speech bubble above crew NPC during escort arc dialogue, auto-fades 4s — `src/render/display3d.ts`, `src/browser.ts`, `src/index.html` — medium
- [x] 3. Environmental particle effects — SKIPPED (ambient dust motes + investigation aura particles already implemented in display3d.ts) — N/A
- [x] 4. Scanner compass HUD — directional arrows on screen edges pointing toward nearby scanner detections (evidence, sensors, crew) — `src/render/display3d.ts`, `src/index.html` — small
- [x] 5. Evidence discovery celebration — starburst CSS VFX + ascending E-G-B chime on new evidence — `src/render/display3d.ts`, `src/render/audio.ts`, `src/browser.ts`, `src/index.html` — small

## Progress Log
- 2026-02-25: Sprint planned, executing immediately
- 2026-02-25: Task 1 complete — crew floating labels with worldToScreen projection
- 2026-02-25: Task 2 complete — speech bubbles during escort arc dialogue
- 2026-02-25: Task 3 skipped — ambient particles already exist
- 2026-02-25: Task 4 complete — scanner compass with 8-direction arrows, type-colored
- 2026-02-25: Task 5 complete — starburst VFX + audio chime on evidence discovery
- 2026-02-25: All tasks done, tsc clean, 408/408 tests pass, visual QA confirmed compass arrows active
