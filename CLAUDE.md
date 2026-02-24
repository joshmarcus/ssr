# Space Station Terminal Roguelike (SSR)

A procedural roguelike where you remotely pilot maintenance bots through a low-bitrate terminal link to explore a silent research station, restore systems, solve puzzles, and uncover what happened to the crew.

## Core Pillars

1. **Exploration via constraints** — Low-bitrate UI + narrow sensors create meaningful uncertainty
2. **Puzzle-forward roguelike** — Hazards are solved, not fought
3. **Mystery as progression** — Restored subsystems unlock evidence and interpretation
4. **Procedural but coherent** — Varying runs with solvable critical paths

## Tech Stack

- **Language**: TypeScript (strict mode), ESM modules (`.js` extensions in imports)
- **Rendering**: Three.js (3D chase cam, cel-shaded), ROT.js (map generation)
- **Testing**: Vitest | **Runtime**: Node.js (via fnm), tsx for dev
- **Time model**: Turn-based | **Input**: Controller-first (Steam Deck target, 1280x800)

## Architecture

```
src/
  sim/       — Authoritative game rules (rendering-agnostic)
  render/    — 3D renderer (display3d.ts ~5500 lines) + HUD overlays
  harness/   — Headless runner + observation/action API (agent/AI playtesting)
  shared/    — Shared types, constants, utilities
  data/      — Lore data, golden seed room definitions
tests/       — Golden seed + unit tests (Vitest)
```

## Commands

- `npm run dev` — Run game (tsx)
- `npm run build` — TypeScript compile
- `npm test` — Run tests (vitest)
- `npm run harness` — Headless CLI runner
- `npm run lint` — Type-check without emit
- `npm run screenshot` — Playwright headless capture (`--seed`, `--turns`, `--overlay`, `--out`)

## Key Gameplay Systems

- **Player bot** (Sweepo): 3 attachment slots (Tool, Sensor, Utility), tank controls, chase cam
- **Sensor ladder**: Cleanliness → Thermal → Atmospheric → Radiation → Structural → EM/Signal
- **Puzzle types**: Power routing, pressure/leak management, access control, robotics salvage, signal relay
- **Mystery/narrative**: Procedurally generated crew (8-20), incident archetypes, evidence via logs/traces/still frames
- **Golden seed test**: seed 184201, 31-turn walkthrough

## Important Project Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | This file — project instructions and architecture |
| `STATUS.md` | Living project status (update after each sprint) |
| `TEAM.md` | Sprint team roles, file ownership, workflow |
| `FUTURE_FEATURES.md` | Deferred features and design ideas |
| `MYSTERY_GAMEPLAY.md` | Mystery/investigation system design |
| `RENDERER_ARCHITECTURE.md` | 3D renderer internals (scene, lights, camera, effects) |
| `SPRINT_LEARNINGS.md` | Accumulated dev patterns and gotchas (V34-V221) |
| `space_station_roguelike_docs_v10/` | All design docs, task specs, schemas, agent prompts |
| `space_station_roguelike_docs_v10/tasks/backlog.md` | Milestone roadmap and living task queue |
| `public/model-list.json` | Full 3D model manifest (300+ models) |

## Documentation Reference

All design docs live in `space_station_roguelike_docs_v10/`: design specs (`design/00-18`), task roadmaps (`tasks/`), data schemas (`schemas/`), and agent prompts (`agents/`). See individual files for details.

## Sprint Workflow

1. Review `STATUS.md` for current state
2. Check `backlog.md` and `FUTURE_FEATURES.md` for priorities
3. Plan sprint: 3-5 deliverables, prioritized by game design lead
4. Execute in parallel by role (see `TEAM.md`)
5. QA: `npx tsc --noEmit` + `npx vitest run`
6. **Visual QA** (MANDATORY — see Visual QA Checklist below)
7. **Always commit and push** after changes are verified
8. Update `STATUS.md` after each sprint
9. **Auto-continue**: Automatically begin the next sprint without waiting for user prompt
10. **Design priority**: Fun, interesting, and innovative > technical elegance

## Visual QA Checklist (MANDATORY after every sprint)

Code compilation and unit tests are NOT SUFFICIENT. The game must be visually playable. After every sprint that touches rendering, UI, or gameplay, run visual QA using Playwright:

### Step 1: Take screenshots at key game states
```bash
# Basic 3D gameplay after 10 turns (checks: models loaded, HUD correct, no crashes)
npx tsx screenshot.ts --3d --turns 10 --out qa_gameplay.png

# Investigation hub (checks: scene list, evidence, crew panels)
npx tsx screenshot.ts --3d --turns 20 --overlay hub --out qa_hub.png

# Scene processing (checks: WHO/WHAT/OUTCOME columns, clue display)
npx tsx screenshot.ts --3d --turns 20 --overlay hub-scenes --out qa_scenes.png

# Map overlay (checks: minimap, room layout, player position)
npx tsx screenshot.ts --3d --turns 5 --overlay map --out qa_map.png
```

### Step 2: Review each screenshot with the Read tool
Open each screenshot and check for:
- **3D models loading**: Sweepo visible? Crew NPCs visible? Props/furniture rendered?
- **HUD elements**: Minimap present? Action bar? Health/turn counter? Objective banner?
- **Text overlays**: Readable? No overlapping? No empty strings? No "Unknown" or "undefined"?
- **Spatial correctness**: Doors aligned with frames? No models clipping through walls? Camera angle reasonable?
- **Scene processing**: Clues showing text? WHO/WHAT/OUTCOME columns populated? No "Unknown" as answer option?

### Step 3: DOM state checks via Playwright
For deeper checks, extend `screenshot.ts` or use `page.evaluate()` to query:
- `document.querySelectorAll('.mode-3d canvas').length > 0` — 3D renderer active
- `document.getElementById('hud-objective')` — HUD present
- Console errors/warnings (already captured by screenshot.ts)
- Game state via `window.__gameState` if exposed

### When to run visual QA
- **Every sprint** that changes: browser.ts, display3d.ts, index.html, roomScenes.ts, procgen.ts
- **Before marking any UI/rendering task complete**
- **After fixing reported visual bugs** — verify the fix visually, not just by code review

### What to do with failures
- Fix the issue before committing
- If a visual issue is beyond current scope, log it in backlog.md with a screenshot reference
- NEVER ship changes that produce broken visuals just because tests pass

## Playwright MCP (Live Browser Control)

The Playwright MCP server allows Claude to directly control Chrome for interactive visual QA — navigating the game, pressing keys, taking screenshots, and inspecting DOM/JS state in real time. This is **preferred over the screenshot.ts script** for visual QA.

### Setup
The MCP server is configured via `claude mcp add`. If it needs to be re-added:
```bash
claude mcp add playwright -- cmd /c .claude\playwright-mcp.cmd
```
The wrapper script `.claude/playwright-mcp.cmd` sets the correct PATH for fnm-managed Node.js before launching `@playwright/mcp`.

### Usage
Once configured, Playwright MCP tools are available directly:

1. **Start dev server**: `npm run dev` (runs on localhost, typically port 5173+)
2. **Navigate**: `browser_navigate` to `http://localhost:<port>/ssr/`
3. **Interact**: `browser_click` to skip opening crawl, `browser_press_key` for game controls:
   - `ArrowUp/Down/Left/Right` — tank movement
   - `c` — clean room, `q` — scan, `m` — map overlay, `3` — 3D mode, `Enter` — interact
4. **Screenshot**: `browser_take_screenshot` to capture current viewport
5. **Inspect state**: `browser_evaluate` to run JS in the page context
6. **Snapshot**: `browser_snapshot` for accessibility tree (better than screenshot for DOM state)

### Tips
- **fnm PATH issue**: On Windows with fnm, spawned processes can't find `node`/`npx`. The `.claude/playwright-mcp.cmd` wrapper solves this by setting PATH explicitly.
- **Game state access**: Add `Object.defineProperty(window, '__gameState', { get: () => state, configurable: true })` in `browser.ts` (after `let state = ...`) to expose game state for JS inspection. Use a getter (not assignment) so it always returns the current state after reassignments.
- **Batch navigation**: Use `browser_run_code` with async loops for multi-step navigation (cleaning rooms, moving through corridors).
- **Entity positions**: Query `window.__gameState.entities` (a Map) to find entity positions by type (e.g., `crew_npc`, `relay`, `evidence_trace`).

## Autonomous Development

- **Keep going**: Continue developing without asking for input unless absolutely critical. Make design decisions independently.
- **Continuous sprints**: Finish sprint → update STATUS.md → update backlog → consult design leads → start next sprint. Never stop and wait.
- **Sprint focus**: Prioritize **mystery gameplay mechanics and discovery flow**. Inspiration: Return of the Obra Dinn, Alan Wake 2, Her Story, Disco Elysium. See `MYSTERY_GAMEPLAY.md`.
- **Backlog maintenance**: Keep `backlog.md` current as the living task queue.
- **Sprint retrospective**: Consult game design lead and visual design lead per `TEAM.md` to set next priorities.
- **Playtesting**: `npx tsx playtest_bot.ts [seed]` for automated playtesting. Claude API driver at `src/harness/claudeDriver.ts`.
- **Snapshots**: Screenshots saved as `review_v*.png`. Use to review visual progress between sprints.
- **Commit and push always**: Every passing change should be pushed immediately.
- **Sprint reflections**: Every 10 sprints, add learnings to `SPRINT_LEARNINGS.md`.

## 3D Model Assets

300+ models in `public/models/` (manifest: `public/model-list.json`). Key collections: `synty-space-gltf/` (station pieces), `synty-gltf/` (industrial props), `kenney-space/` (modular corridors/rooms), `Characters/`, `Vehicles/`, `Items/`. Priority: station architecture → props → characters → vehicles. Use `inspect-glb.cjs` to inspect model structure. Only ~40 models actively used — selective integration, not comprehensive.

## Critical Dev Patterns (from SPRINT_LEARNINGS.md)

- **InstancedMesh for all repeated geometry** — draw calls are the main bottleneck
- **CSS overlays for screen-space effects** — vignette, scanlines, hazard borders at zero GPU cost
- **Always check tile bounds** — `state.tiles[y][x]` must bounds-check, off-by-one crashes silently
- **Screenshot-driven development** — always take and review screenshots; code review misses spatial issues
- **Fundamental before decorative** — fix structural issues before adding polish effects
- **Append-only children on Sweepo's group** — never insert, always append to avoid index breakage
- **Lazily create lights/geometry** — on first animation frame, not during construction
- **Derive visual state from game state** — don't store visual state that can go stale
- **Sim/render separation** — game logic must never depend on rendering
- **Deterministic** — all simulation seeded and reproducible (ROT.RNG.setSeed)
- **Pure functions** — `step(state, action) → state'` pattern for simulation
- **Controller-first** — no typing required; action bar covers all interactions
