## Tech stack
- TypeScript + ROT.js + Vitest
- See `design/18_tech_stack_rotjs_typescript.md` and `tasks/00_repo_scaffold_typescript.md`

# V0 Roadmap — Terminal Roguelike First

## Why V0 exists
- make the core loop fun quickly
- maximize automated testing and agent iteration
- avoid UI/graphics rabbit holes

## Milestone V0.1 — Sim + Terminal render
- Deterministic seed → map + items + bots
- Terminal renderer: full station visible
- Actions: move, interact, toggle sensor, wait
- One hazard: heat/smoke spread per turn
- One puzzle: hotspot relay (thermal)

## Milestone V0.2 — Objectives + recovery
- Primary objective: restore power to door + transmit
- Bot swap/spin-up
- Simple logs (10–15 entries) for narrative flavor

## Milestone V0.3 — Harness + CI
- Headless harness runner
- Replay logs
- Golden-seed tests

## After V0: UI/Deck polish
- Add controller mappings
- Add pane-based operator console
- Re-introduce fog-of-war/bandwidth if desired


## Golden seed integration target
- Implement `tasks/golden_seed_run_184201.md` as the first CI integration test.
