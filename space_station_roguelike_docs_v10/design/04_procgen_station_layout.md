# Procedural Generation — Station Layout

## Goal
Generate stations that feel like real infrastructure:
- connected systems
- plausible room groupings
- a solvable critical path
- interesting optional branches

## Generation pipeline (recommended)
1. **Macro graph**
   - Create a graph of “zones” (Hab, Lab, Reactor, Dock, Med, Security, Data Core, Robotics).
2. **Critical path**
   - Place required objectives and gates in order.
3. **Room expansion**
   - Expand each zone node into a set of rooms + corridors with local patterns.
4. **Door & keying**
   - Add locks tied to subsystems (power, access levels, physical obstructions).
5. **Hazards & clutter**
   - Add localized disasters (fire, vacuum breach, radiation leak, infestation).
6. **Loot & bots**
   - Place attachments and alternate bots in “reasonable” places (tools in workshop, sensors in lab).
7. **Evidence distribution**
   - Logs, bodies, terminals placed to match crew routines.

## Solvability constraints
- Maintain an explicit capability model:
  - movement: debris, zero-g, vents
  - tools: cut/pry/weld/seal
  - access: clearance, powered doors
  - sensors: required to interpret a puzzle clue
- Generation must guarantee a path from start to primary objective given an achievable sequence of capability upgrades.

## Gating styles (pick 2–3 for MVP)
- Power-gated doors (needs routed power)
- Clearance-gated doors (needs recovered badge/codes)
- Physical obstructions (needs cutter/pry)
- Environmental (vacuum/fire/radiation) requiring seal/foam/shield

## Station “mission secrets”
Add a run seed that selects a secret “backbone”:
- illegal cloning
- alien artifact
- weapons test
- pirate takeover
- time experiment
This influences: which zones exist, hazard types, what evidence appears, final objective.

## Data structures (for deterministic generation)
- Seed → RNG stream(s)
- StationSpec: zones, objectives, secret, difficulty
- RoomGraph: nodes, edges, tags
- TileMap: grid + entities + features

