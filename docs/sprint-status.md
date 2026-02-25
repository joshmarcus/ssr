# Sprint 181 — V379-V383
**Status:** COMPLETE
**Theme:** First & last impressions — title screen, evacuation HUD, scan wave fix, endgame polish

## Tasks
- [x] 1. Title screen with atmosphere: proper title card ("CORVUS-7" + tagline), animated starfield bg, difficulty selector, always shown — `src/browser.ts`, `src/index.html` — medium
- [x] 2. Evacuation progress HUD widget: dedicated bar showing crew evac count (X/Y safe) + pulsing urgency animation during Evacuate phase — `src/render/display3d.ts`, `src/index.html` — small
- [x] 3. Scan wave visual verified (BUG-007/012): confirmed ring expansion 4x/0.6s is reasonable, no sphere geometry on sensor pickup — verified fixed — small
- [x] 4. Game-over action buttons: styled [N] New Game + [R] Replay + [C] Copy buttons instead of plain text — `src/render/display3d.ts`, `src/index.html` — small
- [x] 5. Atmospheric starfield particles: 400 3D star points on rotating sphere, parallax depth through hull gaps — `src/render/display3d.ts` — medium

## Progress Log
- 2026-02-25: Sprint planned, executing immediately
- 2026-02-25: All 5 tasks complete — title screen, evac HUD, scan verified, game-over buttons, starfield
- 2026-02-25: Visual QA passed — title screen verified via Playwright, gameplay rendering confirmed
- 2026-02-25: All 408 tests passing, tsc clean. Sprint complete.
