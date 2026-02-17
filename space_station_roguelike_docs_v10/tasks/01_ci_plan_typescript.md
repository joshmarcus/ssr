# CI Plan — Golden Seed Regression (TypeScript)

## Goal
Every PR should prove:
- golden seed run still wins
- determinism holds (seed + action log => same state hash)
- type checking passes
- unit tests pass

## GitHub Actions workflow
```yaml
name: CI
on: [push, pull_request]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx tsc --noEmit          # type checking
      - run: npx vitest run             # unit + integration tests
```

## Suggested checks
1. `npx tsc --noEmit` — compile-time type safety
2. `npx vitest run` — all tests including golden seed
3. Golden seed script (when harness is ready):
   - `npx tsx src/harness/cli.ts --seed 184201 --script tasks/golden_seed_actions.json --assert-victory`
4. Determinism:
   - run the same script twice and compare `state_hash`

## Failure artifacts (nice-to-have)
- final observation text
- last 200 log lines
- action log used
