# Tech Stack Choice — TypeScript + ROT.js (Terminal Roguelike V0)

## Decision
For V0, we will build in **TypeScript** using **ROT.js** as the roguelike toolkit.

### Primary libraries
- **ROT.js**: Browser-native roguelike toolkit providing:
  - `ROT.Display` — canvas-based terminal rendering (ASCII/tile)
  - `ROT.Map.*` — built-in map generators (Arena, Cellular, Digger, Uniform, Rogue)
  - `ROT.FOV` — field-of-view algorithms (precise shadowcasting)
  - `ROT.Path` — pathfinding (A*, Dijkstra)
  - `ROT.RNG` — seedable random number generator
  - `ROT.Scheduler` — turn scheduling (simple, speed, action)
- **Vite**: Dev server + production bundler (fast HMR, native ESM)

### Language
- **TypeScript** in strict mode (`"strict": true` in tsconfig.json):
  - Compile-time type safety catches bugs before runtime
  - Interfaces model game entities, actions, and state transitions
  - Enums and union types for action types and game phases
  - IDE support (autocomplete, refactoring) accelerates development

### Testing
- **Vitest**: ESM-native test runner
  - Zero-config with Vite projects
  - Fast execution (no transpilation overhead)
  - Compatible with Jest API (describe/it/expect)
  - Built-in coverage reporting

---

## Rationale (why this over Python + python-tcod)
1. **Browser-native**: No install step for playtesting; open a URL and play
2. **ROT.js is purpose-built**: Map generation, FOV, pathfinding, and display all included
3. **Type safety**: TypeScript catches entire categories of bugs at compile time
4. **Single ecosystem**: Same language for sim, rendering, tests, and harness
5. **Fast iteration**: Vite HMR means edit -> see change in milliseconds
6. **Deployment flexibility**: Web, Electron, Tauri, or any wrapper for Steam

---

## Non-goals for V0
- Steam packaging polish
- Controller-first UX
- Real-time mode

Those come after the loop is fun and the golden seed test is stable.

---

## Architecture (kept portable)
Enforce separation even in a single TypeScript codebase:

1. `src/sim/` — authoritative game rules (no rendering, no input code)
2. `src/render/` — ROT.js Display rendering (glyph map + side panels)
3. `src/harness/` — headless runner + observation/action API
4. `src/shared/` — shared types and constants
5. `tests/` — golden seed + unit tests (Vitest)

If you later add a richer UI engine, `src/sim/` should remain reusable.

---

## Commands
- Dev server: `npm run dev` (Vite)
- Build: `npm run build`
- Type check: `npx tsc --noEmit`
- Tests: `npx vitest run`
- Harness CLI: `npx tsx src/harness/cli.ts --seed 184201`
