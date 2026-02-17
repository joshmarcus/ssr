# Repo Scaffold — Python Terminal Roguelike V0

Recommended repository structure for agent-friendly development.

## Folder layout
```
space-station-rogue/
  pyproject.toml           # or requirements.txt
  src/
    ssrogue/
      __init__.py
      main.py              # human play (terminal renderer)
      sim/
        state.py           # GameState, Entity, Components
        actions.py         # action enums + validation
        step.py            # step(state, action) -> state'
        procgen.py         # seed -> initial state (golden seed override allowed)
        hazards.py         # heat/smoke update per turn
        sensors.py         # thermal overlay computation
        objectives.py      # win/loss checks
      render/
        terminal.py        # python-tcod renderer
        layout.py          # panel helpers
      harness/
        cli.py             # headless runner (obs/action)
        observation.py     # text/json observation renderer
        replay.py          # record/replay action logs
  tests/
    test_golden_seed_184201.py
    test_determinism.py
    test_hazards.py
  tasks/
    run_golden_seed.py
```

## Minimal dependencies
- python 3.11+ (recommended)
- python-tcod
- pytest

## Commands
- Run game: `python -m ssrogue.main`
- Run golden seed headless: `python -m ssrogue.harness.cli --seed 184201 --script tasks/golden_seed_actions.json`
- Tests: `pytest -q`

## Golden seed approach
During V0:
- `procgen.py` may special-case `seed==184201` to return the golden map.
- other seeds can remain simple until later.
