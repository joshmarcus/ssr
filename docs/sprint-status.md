# Sprint 182 — V384-V388
**Status:** COMPLETE
**Theme:** Settings & polish — accessible settings menu, narrative scroll, investigation guidance

## Tasks
- [x] 1. Pause menu settings panel — Settings submenu with Volume bar, Camera, Outline, Relay Feed, TTS toggles — `src/browser.ts`, `src/render/display3d.ts`, `src/render/displayInterface.ts` — medium
- [x] 2. Narrative panel mousewheel scroll — already implemented (overflow-y:auto + pointer-events:auto already present) — `src/index.html` — N/A
- [x] 3. Help screen investigation section — "How to Investigate" 6-step guide with CORVUS-7 quote — `src/browser.ts` — small
- [x] 4. Room-entry audio SFX — playDoorTransition (whoosh), playClean (sweep), playPickup (chime) — `src/render/audio.ts`, `src/browser.ts` — small
- [x] 5. BUGS.md cleanup — trimmed verbose descriptions, all bugs now in clean table format — `BUGS.md` — small

## Progress Log
- 2026-02-25: Sprint planned (revised from bug-fix plan — all bugs already fixed)
- 2026-02-25: All 5 tasks complete. tsc clean, 408/408 tests passing. Visual QA verified settings panel and help screen.
