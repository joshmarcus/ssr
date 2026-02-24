# Sprint 175 — V349-V352 (Polish & Balance)
**Status:** IN PROGRESS
**Theme:** Gameplay balance fixes + new player experience polish from QA findings

## Tasks
- [ ] 1. BUG-003: Cleaning requires multiple actions — reduce dirt-per-clean so 59% starting room needs 2-3 cleans to hit goal — `src/sim/step.ts` — small
- [ ] 2. BUG-007 investigation: Scan wave ring scale reduction — the triggerScanWave rings scale to 16x which may cause the reported "blue sphere"; cap ring expansion and reduce opacity — `src/render/display3d.ts` — small
- [ ] 3. Improve new game message pacing — delay CORVUS-7 narrative/lore messages until after player takes first action (turn > 0), prevent message dump at T:0 — `src/browser.ts` — medium
- [ ] 4. Update BUGS.md with fix status for all completed bugs — `BUGS.md` — small

## Unknowns
- None — all tasks are clear from QA findings

## Progress Log
- 2026-02-23: Sprint planned, awaiting approval
