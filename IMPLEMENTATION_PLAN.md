# SSR Implementation Plan

## Sprint 2 — COMPLETE (15/15 items shipped)

### Carry-over from Sprint 1 (Items 1-5)
- [x] **Item 1: Mystery log entries** — 8 mystery logs in logs.json, 16 log terminals placed, logSelections includes all mystery entries
- [x] **Item 2: Bot introspection logs** — Turn milestones 20/50/80/120 with updated narrative text reflecting the bot's growing awareness
- [x] **Item 3: Drone encounter logs** — Per-drone unique encounter messages (drone_0 through drone_3), tracked with Set so each triggers once
- [x] **Item 4: Environmental room-entry cues** — Heat/smoke/relay/Cargo Hold atmospheric text on first room entry
- [x] **Item 5: Cleaning narrative logs** — Contextual messages: smoke cleared, dirt > 50 reveals boot prints, near-relay coolant clearing, hidden item revealed

### New for Sprint 2 (Items 6-15)
- [x] **Item 6: Repair Bot entity** — EntityType.RepairBot, glyph 'r', color '#fa8', 2 spawned near Engineering Storage and Life Support
- [x] **Item 7: Repair Bot movement** — moveRepairBots() in step.ts: seeks hottest tile within 10, cools heat by 8 when on hot tile, wanders when idle
- [x] **Item 8: Repair Bot interaction** — First interact: status report with room name and coolant %. Second interact: follows player for 10 turns
- [x] **Item 9: Ambiguous ending** — 4-tier discovery-based ending text (0-3, 4-8, 9-12, 13+ discoveries) in endgame.ts
- [x] **Item 10: Victory text references logs** — Specific discovery checks for Okafor's badge, Vasquez's toolkit, classified directive
- [x] **Item 11: Sensor cycling** — 't' key cycles: off -> cleanliness -> thermal (if available) -> off, with overlay name displayed
- [x] **Item 12: More hidden crew items** — 4 new items: Sealed Envelope (Observation Deck), Dog Tags (Maintenance Corridor), USB Drive (Signal Room), Shift Schedule (Charging Bay)
- [x] **Item 13: Room-specific cleaning discoveries** — Crew Quarters (K.V. initials), Research Lab (drag marks), Communications Hub (sticky note about Okafor)
- [x] **Item 14: Drone cleaning behavior** — Drones reduce dirt by 5 on tiles they leave (40% chance), player sees cleaning message when nearby
- [x] **Item 15: Repair Bot legend + proximity** — Added to display legend, entity colors, names, and proximity bar

## Sprint 1 — COMPLETE (previously shipped)
- [x] 70x35 map, 15-20 rooms, 3 relays, 16 log terminals
- [x] HP system with gradual heat damage + cool-tile recovery
- [x] Thermal sensor required to interact with overheating relays
- [x] Color-coded log messages (narrative/warning/critical/milestone)
- [x] Dramatic opening sequence (boot messages, SKIP prompt)
- [x] Victory ceremony with mission summary (turns, logs, HP)
- [x] WASD + expanded key bindings, movement trail animation
- [x] Entity proximity radar, room list panel, HP bar
- [x] Look command, ambient wait messages, contextual move feedback
- [x] Restart on game over, service bot recovery
- [x] 28 authored logs (20 story + 8 mystery), atmospheric room descriptions
- [x] Cleanliness sensor starting equipment, sensor cycling overlay
- [x] MedKit entity, hidden crew items revealed by cleaning
- [x] Memory echoes on crew item examination, discovery counter
- [x] Clean action fully clears smoke, reduces heat near relays
- [x] Drones wander each turn, heat tuned for exploration

## Sprint 3 — PLANNED

### Gameplay Depth
- [ ] **Atmospheric sensor pickup** — New sensor type found in station, reveals pressure differentials and air quality
- [ ] **Pressure/leak puzzle** — Seal breaches before entering depressurized rooms (requires atmospheric sensor)
- [ ] **Access control puzzle** — Locked terminals require crew badge codes found in logs/items
- [ ] **Repair Bot coolant depletion** — Coolant reserves decrease with each flush, eventually bot becomes inert
- [ ] **Heat cascade escalation** — After N turns without relay reroute, heat spreads more aggressively

### Narrative & World
- [ ] **Procedural crew generation** — Generate crew with parameterized names/roles for different seeds
- [ ] **Cross-referencing discoveries** — Reading certain logs + examining certain items unlocks "connection" insights
- [ ] **Ambient station sounds** — Expand AudioManager with ambient drone, relay alarm, smoke hiss
- [ ] **Time pressure narrative** — Bot introspections reference specific discoveries player has made

### Polish & Infrastructure
- [ ] **Save/load system** — JSON serialization to localStorage
- [ ] **Headless CLI harness** — Agent/AI playtesting observation/action format
- [ ] **CI pipeline** — GitHub Actions: lint + test on PR, golden seed regression
- [ ] **Gamepad/controller support** — Steam Deck "Playable" tier input mapping

## Phase Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| V0.1 (Sprint 1) | Core loop, rendering, narrative foundation | COMPLETE |
| V0.2 (Sprint 2) | Repair bots, ambiguous endings, per-entity narrative | COMPLETE |
| V0.3 (Sprint 3) | New sensor, puzzles, save/load, CI | PLANNED |
| M1 | Procedural crew, incident archetypes, full sensor ladder | PLANNED |
| M2 | Multiple endings, advanced puzzles, Steam Deck controls | PLANNED |
| M3 | Polish, balance, playtesting, release prep | PLANNED |
