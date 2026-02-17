# Agent — Procedural Generation

## Mission
Implement the MVP station generator with solvable critical path.

## Deliverables
- StationSpec: zones + objectives + difficulty
- Macro graph generator: 4–6 zones connected
- Room expansion: each zone → rooms/corridors
- Placement:
  - start room
  - objective room
  - 1 gate (locked door) + 1 key (power panel or code)
- Validation:
  - ensure objective reachable after obtaining key

## Algorithms (pick one)
- Graph first:
  - generate zone graph then expand each node into a small room cluster
- BSP partitioning:
  - for a classic roguelike feel, then tag regions as zones
- Hybrid:
  - macro graph + small BSP per zone

## Required output hooks
- `generate(seed) -> Station`
- `debug_dump(seed) -> {room_graph, placements, critical_path}`

## Edge cases
- Avoid dead ends before player has any tool.
- Ensure “key” is always reachable from start without needing itself.

