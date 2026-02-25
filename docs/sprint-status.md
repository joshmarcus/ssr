# Sprint 177 — V359-V363
**Status:** COMPLETE
**Theme:** Critical interaction UX fixes — false affordance, cleaning pacing, unified scan

## Tasks
- [x] 1. BUG-016: Verified already fixed — display and sim interaction ranges match (cardinal adjacency)
- [x] 2. BUG-014: Make room cleaning optional — removed mandatory clean-before-exit gate from actions.ts and browser.ts
- [x] 3. BUG-015: Unified scanner — Q performs scan + auto-activates overlay, T toggles overlay (free), Tab cycles targets only
- [x] 4. Narrative panel polish: scrollable (mousewheel), turn timestamps (T##), [L] key toggle, themed scrollbar
- [x] 5. CORVUS-7 contextual mechanic tips: first_scan, first_evidence, first_deduction, first_crew, first_room_exit (3 personalities × 5 tips)

## Progress Log
- 2026-02-25: Sprint planned, executing immediately
- 2026-02-25: Task 1 verified — BUG-016 already fixed in current code
- 2026-02-25: Task 2 complete — removed cleaning gate from actions.ts and browser.ts
- 2026-02-25: Task 3 complete — unified scan (Q=action+overlay, T=toggle, removed T from scan action)
- 2026-02-25: Task 4 complete — scrollable panel, turn timestamps, L key toggle, themed scrollbar
- 2026-02-25: Task 5 complete — 15 mechanic tips (3 personalities × 5 events) in narrative.ts + hooks in browser.ts
- 2026-02-25: Visual QA passed — all features verified via Playwright MCP
- 2026-02-25: All 408 tests passing, tsc clean. Sprint complete.
