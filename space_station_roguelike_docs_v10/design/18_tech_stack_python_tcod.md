# Tech Stack Choice — Python + python-tcod (Terminal Roguelike V0)

## Decision
For V0, we will build in **Python** using a terminal roguelike stack.

Primary library:
- **python-tcod** (Python bindings for libtcod): terminal-style rendering, input handling, and classic roguelike utilities.

Testing:
- **pytest** for unit + integration tests
- optional: **hypothesis** for fuzz/property tests

Rationale:
- fastest iteration (edit → run → replay golden seed)
- easiest headless testing (step turns without rendering)
- LLM playtesting works immediately (text-mode harness)

---

## Non-goals for V0
- Steam packaging polish
- controller-first UX
- real-time mode

Those come after the loop is fun and the golden seed test is stable.

---

## Keep the architecture portable
Even in Python, enforce separation:

1) `sim/` — authoritative game rules (no rendering, no input code)
2) `render/` — terminal rendering (glyph map + side panels)
3) `harness/` — headless runner + observation/action API
4) `tests/` — golden seed + unit tests

If you later add a richer UI engine, `sim/` should remain reusable.

---

## Library fallback (if python-tcod is annoying)
If you hit environment friction:
- use `curses`/`blessed` for rendering and keep your own input loop

The sim architecture stays the same.
