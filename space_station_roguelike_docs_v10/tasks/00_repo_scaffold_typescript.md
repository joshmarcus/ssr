# Repo Scaffold — TypeScript + ROT.js Terminal Roguelike V0

Recommended repository structure for agent-friendly development.

## Folder layout (current)
```
ssr/
  package.json             # dependencies + scripts
  package-lock.json
  tsconfig.json            # TypeScript strict mode config
  vite.config.ts           # Vite dev server + build config
  vitest.config.ts         # Vitest test runner config
  CLAUDE.md                # project instructions for AI agents
  src/
    index.html             # entry point (loads main.ts)
    main.ts                # human play (ROT.js Display renderer)
    sim/
      state.ts             # GameState, Entity, Components
      actions.ts           # action enums + validation
      step.ts              # step(state, action) -> state'
      procgen.ts           # seed -> initial state (golden seed override allowed)
      hazards.ts           # heat/smoke update per turn
      objectives.ts        # win/loss checks
    render/
      terminal.ts          # ROT.js Display renderer
    shared/
      types.ts             # shared type definitions
      constants.ts         # game constants
    harness/
      cli.ts               # headless runner (obs/action)
  tests/
    golden-seed.test.ts    # golden seed integration test (seed 184201)
```

## Dependencies
- Node.js 18+ (recommended: 20 LTS)
- rot-js
- TypeScript (strict mode)
- Vite (dev server + bundler)
- Vitest (test runner)

## Commands
- Dev server: `npm run dev`
- Build: `npm run build`
- Type check: `npx tsc --noEmit`
- Tests: `npx vitest run`
- Run golden seed headless: `npx tsx src/harness/cli.ts --seed 184201 --script tasks/golden_seed_actions.json`

## Golden seed approach
During V0:
- `procgen.ts` may special-case `seed==184201` to return the golden map.
- other seeds can remain simple until later.
