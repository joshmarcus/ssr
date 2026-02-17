# Golden Seed Run — MVP Walkthrough + Integration Test Target

This document defines a **single deterministic run** that serves as:
- a first "end-to-end" integration test (CI)
- a first agent-playable target (Agent Harness)
- a debugging baseline for procgen, hazards, sensors, and objectives

> V0 assumptions: TypeScript + ROT.js terminal roguelike, **full visibility**, turn-based/step-based time.

---

## Seed and mode
- Seed: **184201**
- Visibility: **full** (entire station visible)
- Time: **turn-based**
- Sensor progression: start with CLEANLINESS; Thermal upgrade obtainable early
- Map generator: `ROT.Map.Digger` (25x17 grid, seeded via `ROT.RNG.setSeed`)

## MVP objective
**Restore power to the Data Core door and transmit the core bundle.**

Win condition:
- `TRANSMIT` action succeeds at Data Core (interact with `data_core` entity).

Loss condition (for this run):
- player bot destroyed (heat damage) AND no recovery bot can be activated.

---

## Golden map (authoritative for V0)

### Generation method
The map is produced by `ROT.Map.Digger` with these parameters:
- Width: 25, Height: 17
- `dugPercentage: 0.4`
- Seed: `ROT.RNG.setSeed(184201)`

The Digger algorithm produces rooms connected by corridors. Doors are placed at corridor-room junctions. The exact room count and layout depend on the Digger's internal algorithm for this seed.

> **IMPORTANT**: The current Digger configuration for seed 184201 at 25x17 produces fewer rooms than the target 10. The procgen parameters need tuning (e.g., adjusting `dugPercentage`, `roomWidth`, `roomHeight` ranges, or map dimensions) to achieve 10+ rooms. Until this is resolved, the coordinates below are **targets** that will be finalized once the map stabilizes.

### Coordinate system
- (0,0) is top-left
- x increases right, y increases down

### Glyph legend
- `#` wall
- `.` floor
- `+` door (regular)
- `X` locked door (unpowered)
- `@` player bot
- `R` relay panel
- `S` sensor pickup
- `D` data core
- `B` service bot
- `T` log terminal
- `~` heat overlay
- `░` smoke overlay

### Entity placement rules (implemented in `src/sim/procgen.ts`)
Entities are placed in room centers (or offset from center) based on room index:
- **Player bot** (`player`): center of room 0
- **Thermal sensor pickup** (`sensor_thermal`): center of room 1
- **Overheating relay** (`relay_main`): center of room 2 (initial heat=40, smoke=15)
- **Data core** (`data_core`): center of last room
- **Locked door** (`locked_door_main`): first door tile adjacent to the data core room perimeter, converted to `LockedDoor` type
- **Service bot** (`service_bot`): center of middle room (room index = floor(rooms.length / 2))
- **Log terminals** (`log_terminal_0`, `log_terminal_1`): offset from center of rooms 0 and 3

### Hazard (Overheat cascade)
- Source: relay tile (center of room 2), starts at heat=40, smoke=15
- Each turn: heat spreads `HEAT_SPREAD_RATE` (5 units) to adjacent walkable tiles (cap 100)
- Smoke spreads `SMOKE_SPREAD_RATE` (3 units) to adjacent walkable tiles (cap 100)
- Player takes fatal damage at `HEAT_DAMAGE_THRESHOLD` (heat >= 80)

### Thermal sensor behavior (V0)
- Without Thermal: relay shows as generic entity, no hotspot indicator
- With Thermal (after pickup + scan action): relay marked with `scannedHotspot: true`
- This is the **first "map language" teaching moment**

---

## Expected action sequence (golden path)

The exact turn-by-turn walkthrough depends on the final room positions from the Digger algorithm. The general sequence is:

### Phase 1: Reach sensor pickup (room 1)
1. Move from room 0 toward room 1 through corridors/doors
2. `INTERACT sensor_thermal` at sensor position -- equips Thermal sensor
3. `SCAN` -- reveals thermal data, marks relay as hotspot

### Phase 2: Mitigate overheat + power the door (room 2)
4. Navigate from room 1 to room 2 (relay location)
5. `INTERACT relay_main` -- reroutes power, stops overheating, powers locked door
6. Locked door tile converts from `X` to `+` (walkable)

### Phase 3: Reach Data Core and transmit (last room)
7. Navigate to the data core room (through now-unlocked door)
8. `INTERACT data_core` -- transmits bundle, **victory=true**

### Turn budget
The walkthrough should complete in roughly 25-35 turns depending on room distances. The hazard heat starts at 40 at the relay and spreads 5 units per turn to adjacent tiles, giving the player a comfortable window before heat becomes dangerous on the travel path.

---

## Assertions for automated tests (minimal set)

### Map invariants at start
- Entity `player` exists and is on a floor tile
- Entity `sensor_thermal` exists on a floor tile
- Entity `relay_main` exists on a floor tile with `overheating=true`
- Entity `data_core` exists on a floor tile with `transmitted=false`
- At least one `LockedDoor` tile exists on the map
- At least 3 rooms generated (target: 10+)

### Progress invariants
After picking up sensor:
- Player attachments include Thermal sensor

After interacting with relay:
- `relay_main.props.activated == true`
- `locked_door_main.props.powered == true`
- All LockedDoor tiles converted to Door tiles

After interacting with data core:
- `victory == true`
- `gameOver == true`

### Determinism invariant
Replaying the same action list with seed 184201 produces the same final state (tile-by-tile comparison + entity state comparison).

---

## Reconciliation notes (2026-02-16)

The original golden seed spec assumed a hand-designed 25x17 map with 10 named rooms and fixed entity coordinates (e.g., player at (3,2), sensor at (3,6), relay at (18,6)). The actual implementation uses `ROT.Map.Digger` which produces procedural room layouts.

**Key differences from the original spec:**
- Entity IDs changed: `A3` -> `player`, `I09` -> `sensor_thermal`, `P03` -> `relay_main`, `D17` -> `locked_door_main`, `T01` -> `data_core`
- Entity positions are dynamically computed from room centers rather than hard-coded
- Room count depends on Digger algorithm output for this seed (currently fewer than 10)
- The hand-drawn ASCII map in the original spec does not match the Digger output
- Hazard mechanics use continuous heat values (0-100) rather than discrete intensity levels (1-6)

**To finalize this spec:** Tune the Digger parameters until seed 184201 reliably produces 10+ rooms, then record the actual positions and update the walkthrough with exact turn-by-turn coordinates.
