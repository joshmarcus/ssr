# CI Plan — Golden Seed Regression (Python)

## Goal
Every PR should prove:
- golden seed run still wins
- determinism holds (seed + action log => same state hash)
- unit tests pass

## Suggested checks
1. `pytest -q`
2. Golden seed script:
   - `python -m ssrogue.harness.cli --seed 184201 --script tasks/golden_seed_actions.json --assert-victory`
3. Determinism:
   - run the same script twice and compare `state_hash`

## Failure artifacts (nice-to-have)
- final observation text
- last 200 log lines
- action log used
