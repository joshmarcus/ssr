# Agent — Hazards & Timers (Real-Time)

## Mission
Implement one real-time hazard (MVP) and the general hazard framework for future expansion.

## MVP hazard choices (pick one)
1. Smoke spread:
   - spreads through connected tiles over time
   - reduces visibility and causes damage over time
2. Vacuum leak:
   - creates pressure gradient and vents a zone
   - drains battery/health and may push lightweight items

## Deliverables
- Hazard component model:
  - state (intensity), update(ticks), interactions (sealed, extinguished)
- Visual representation in ASCII/tiles + sensor overlays.
- Pause integration:
  - hazard updates stop when paused (MVP), or optionally continue in “hardcore” mode.

## Acceptance tests
- Hazard is deterministic given seed.
- Player can counter it with at least one tool/system interaction (even if stubbed).

