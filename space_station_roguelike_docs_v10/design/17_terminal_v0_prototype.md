# Terminal V0 Prototype — Traditional Roguelike, Fully Visible

## Goal
Get to a *playable*, testable, agent-friendly version fast:
- classic roguelike grid
- deterministic simulation
- full visibility to reduce UI uncertainty and maximize debugging speed

This V0 exists to accelerate development. Later versions can re-introduce:
- fog-of-war
- bandwidth constraints
- “known world” vs “true world”
…once the core loop is fun.

---

## Rendering
- Primary renderer: **ROT.js Display** — canvas-based terminal glyph grid (ASCII / tileset font).
- No bespoke art. Use glyphs + overlays (heat/smoke) where needed.
- UI layout: map + side panel (status) + bottom log.
- Runs in browser via Vite dev server (`npm run dev`).

### “Totally visible” rules (V0)
- Entire station map is visible from the start.
- All interactive POIs are visible (doors/panels/items).
- Sensor modes still exist, but they *augment* instead of gating visibility.

Rationale:
- Faster iteration
- Easier automated testing
- Agents can play without hidden-information confusion

---

## Simulation model (turn-based / step-based)
- Player chooses one action.
- Simulation advances exactly one “turn step.”
- Hazards tick once per turn (fire grows, heat spreads, smoke drifts).

This is deterministic and testable:
- record action list
- replay and compare end states

### Future-proofing for real-time
Keep the sim internally tick-based:
- a “turn” may advance N ticks
- later, real-time is just “advance ticks automatically over wall time”

---

## MVP focus with Thermal
Thermal is the first sensor upgrade.
Use it as a *teaching moment*:
- “Hotspot relay” puzzle: thermal reveals the overheating relay/conduit.

Even with full visibility, thermal should provide:
- better legibility
- faster path to solution
- safer routes (avoid hot zones)

---

## What we postpone
- camera still frames (text-only is fine)
- fog-of-war / bandwidth as gating
- multi-pane UI complexity

---

## Acceptance criteria
- A deterministic seed produces the same map and placements.
- A seed + action list reproduces the same outcomes.
- Full station is visible in the terminal renderer.
- Controller mappings can be added later, but V0 can be keyboard-first.

