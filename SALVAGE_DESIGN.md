# SSR: Salvage — Roguelike Deckbuilder Design

*"Portal, but your gun is different every run."*

---

## Elevator Pitch

Sweepo the maintenance bot enters a dying space station to salvage research data. Each room is a spatial puzzle blocked by hazards. Sweepo finds **modules** — tools that change how it interacts with the grid. You can't carry them all. The modules you keep define your build. The build defines which routes through the station are possible. Every run is a different puzzle because your toolkit is different.

---

## Why This Works With What Exists

SSR already has:
- A 2D grid with turn-based movement ✓
- Hazards that spread and interact (heat, pressure, smoke) ✓
- Rooms connected by corridors with chokepoints ✓
- A 3D renderer with 300+ models ✓
- Controller-first input ✓
- Deterministic seeded generation ✓
- Entity interaction system ✓

What we're replacing:
- Evidence collection, mystery scoring, deduction quizzes, investigation hub → **gone**
- Room scenes, crew dossiers, CORVUS-7 grading → **gone**
- 4,400+ lines of mystery state tracking → **replaced with ~800 lines of module system**

What we're keeping and enhancing:
- Hazard systems → now the primary puzzle medium
- Room generation → rooms become spatial puzzle configurations
- Entity placement → module drops replace evidence drops
- Relay/power routing → one puzzle type among many
- Sensor system → becomes scanner modules with trade-offs
- PA announcements → sardonic commentary (the GLaDOS parallel)

---

## Core Loop

```
Enter Room → Read the Puzzle → Use Modules to Solve → Loot → Choose What to Keep → Next Room
```

### Turn Structure

Each turn, Sweepo can take ONE action:
- **Move** (built-in) — move one tile in any cardinal direction
- **Wait** (built-in) — pass turn, hazards tick
- **Module action** — activate an equipped module (each has its own effect)

Hazards tick every turn. The station is degrading. You're solving spatial puzzles against a clock.

### The Room-as-Puzzle

Each room has a **configuration**: a spatial arrangement of hazards, obstacles, and objectives. The objective is always spatial — reach a point, activate a thing, create a path.

Example room configurations:

**"The Hot Corridor"**
```
  ░░░░░░░░░
  ░........░
  ░..🔥🔥🔥..░    Heat source blocks the corridor.
  ░..🔥🔥🔥..░    Solutions:
  ░........░    - Coolant Module: spray tiles to create a path
  ░░░[▣]░░░    - Shield Module: tank through (costs HP)
                - Pressure Module: vent the room (vacuum suppresses heat)
                - Detour: find alternate route through adjacent room
```

**"The Vacuum Lock"**
```
  ░░░[▣]░░░
  ░........░    Room is depressurized. Breach in north wall.
  ░...⊘....░    Solutions:
  ░........░    - Patch Module: seal breach, pressure restores
  ░........░    - Magboots Module: walk through vacuum safely
  ░░░[▣]░░░    - Rush: sprint through, take pressure damage
```

**"The Power Gate"**
```
  ░░░░░░░░░
  ░........░
  ░...╫....░    Locked door requires power.
  ░........░    Solutions:
  ░...[⚡]..░    - Generator Module: power the fuse box directly
  ░░░░░░░░░    - Reroute Module: redirect power from adjacent room
                - Pry Bar: brute force the door (noisy, spawns drone)
                - Bypass Module: hack the lock electronically
```

**"The Smoke Maze"**
```
  ░░░░░░░░░
  ░.≋≋≋≋≋.░    Dense smoke fills the room. Can't see layout.
  ░.≋≋≋≋≋.░    Solutions:
  ░.≋≋≋≋≋.░    - Scrubber Module: clear smoke as you move
  ░.≋≋≋≋≋.░    - Fan Module: push smoke in a direction to create lane
  ░░░[▣]░░░    - Scanner Module: see through smoke (still takes damage)
                - Rush: move blind, hope for the best
```

The same room with different modules equipped is a different puzzle. That's the Portal insight — the tool defines the experience.

---

## Module System

### What Is a Module?

A module is a tool Sweepo can equip. Each module:
- Occupies **1 slot** in Sweepo's module bay
- Has a **type** (Thermal, Atmospheric, Mechanical, Electronic, Sensor)
- Has an **effect** (active action OR passive buff)
- May have **charges** (consumable) or be **permanent** (always available)
- May have **synergies** with other module types

### Module Bay

Sweepo starts with **3 module slots**. Slots can be expanded:
- Workbench interaction: +1 slot (found ~1 per run, max 6 total)
- Trade-off: more slots = more options but also more decision paralysis

When you find a module and your bay is full, you choose:
- **Take it** (swap out an existing module — the old one is gone)
- **Leave it** (walk away — it stays in the room if you come back)

This is the core deckbuilder decision. Every module pickup is a build-defining choice.

### Module Catalog

#### Thermal Modules
| Module | Type | Effect | Charges |
|--------|------|--------|---------|
| **Coolant Canister** | Active | Spray target tile: reduce heat to 0 in 3x3 area | 3 uses |
| **Thermal Shielding** | Passive | Reduce heat damage by 60% | Permanent |
| **Heat Sink** | Active | Absorb all heat from current tile (stores it). Release later as AoE. | 2 absorb, 1 release |
| **Cryo Grenade** | Active | Freeze 5x5 area: heat locked at 0 for 8 turns | 1 use |

#### Atmospheric Modules
| Module | Type | Effect | Charges |
|--------|------|--------|---------|
| **Pressure Patch** | Active | Seal one breach permanently | 2 uses |
| **Magnetic Boots** | Passive | No movement penalty or damage in vacuum | Permanent |
| **Vent Control** | Active | Open/close vents in current room (toggle pressure flow) | Unlimited |
| **Air Canister** | Active | Restore pressure to normal in 3x3 area for 5 turns | 2 uses |

#### Mechanical Modules
| Module | Type | Effect | Charges |
|--------|------|--------|---------|
| **Pry Bar** | Active | Force open any locked door | 3 uses |
| **Welding Torch** | Active | Seal a door permanently (blocks hazard spread) | 2 uses |
| **Grapple Arm** | Active | Pull yourself to target wall tile (2-5 range) | Unlimited, 3 turn cooldown |
| **Blast Charge** | Active | Destroy wall tile, creating new passage. Loud. | 1 use |

#### Electronic Modules
| Module | Type | Effect | Charges |
|--------|------|--------|---------|
| **Portable Generator** | Active | Power one dead fuse box or system | 2 uses |
| **Circuit Bypass** | Active | Hack locked door without power (takes 3 turns) | Unlimited |
| **EMP Pulse** | Active | Disable all drones in room for 10 turns | 1 use |
| **Overcharge** | Passive | Powered modules get +1 charge when found | Permanent |

#### Zero-G / Movement Modules
| Module | Type | Effect | Charges |
|--------|------|--------|---------|
| **Magnetic Boots** | Passive | Normal movement in zero-g tiles | Permanent |
| **Grapple Arm** | Active | Pull to any wall tile within 5 range (line of sight) | Unlimited, 3 turn cooldown |
| **Thruster Pack** | Active | Launch in any direction but STOP after exactly 2 tiles (precision drift) | 4 uses |
| **Tether Line** | Active | Anchor to current tile. After launching, press again to reel back to anchor point. | 2 uses |

#### Sensor Modules
| Module | Type | Effect | Charges |
|--------|------|--------|---------|
| **Thermal Scanner** | Passive | See heat values on all visible tiles | Permanent |
| **Atmo Scanner** | Passive | See pressure values, detect breaches through walls | Permanent |
| **Deep Scanner** | Active | Reveal full layout of adjacent unexplored room | 2 uses |
| **Anomaly Detector** | Passive | Module drops glow on minimap (can plan routes) | Permanent |

### Synergy System

Equipping modules of compatible types creates **synergy bonuses**:

| Combo | Bonus |
|-------|-------|
| 2 Thermal modules | Heat damage immunity below 50 heat |
| 2 Atmospheric modules | Passive pressure restoration (1/turn in low-pressure tiles) |
| 2 Mechanical modules | All mechanical actions are 1 turn faster |
| 2 Electronic modules | Power cells found in world give +1 charge to all active modules |
| Thermal + Atmospheric | "Pressure Cooling" — low pressure rooms auto-reduce heat |
| Mechanical + Electronic | "Power Tools" — Pry Bar doesn't consume charges on unpowered doors |
| Sensor + Any type | That module type's effects have +50% range/area |

Synergies encourage **build commitment** without requiring it. You can run 5 different types for flexibility, or double down on 2-3 for powerful combos.

---

## Station Structure

### Map Layout

The station is a sequence of **3 wings**, each with 3-5 rooms and a **wing boss puzzle** at the end.

```
[Airlock] → [Wing A: 3-5 rooms] → [Wing Gate A] → [Wing B: 3-5 rooms] → [Wing Gate B] → [Wing C: 3-5 rooms] → [Data Core]
```

**Wing Gates** are major multi-step puzzles requiring specific module capabilities. They're the "boss fights" — not combat, but spatial puzzle gauntlets.

### Room Generation

Each room is generated with:
1. **Shape** (from ROT.js Digger — already exists)
2. **Hazard configuration** (heat/pressure/smoke pattern — already exists)
3. **Obstacle layout** (locked doors, wall segments, chokepoints)
4. **Objective** (what you need to do/reach in this room)
5. **Loot** (0-2 module drops, health pickup, workbench)

Hazard configurations are the "level design." The same room shape with heat vs. vacuum vs. smoke is three different puzzles.

### Room Objectives

Every room has a clear spatial goal:

| Objective | Description |
|-----------|-------------|
| **Traverse** | Get from entrance to exit (hazards block the path) |
| **Activate** | Reach and interact with a relay/console/fuse box |
| **Rescue** | Reach a crew NPC and escort them to the exit |
| **Salvage** | Reach a data terminal and download (takes 3 turns standing still) |
| **Survive** | Hazard wave incoming — stay alive for N turns until it passes |
| **Contain** | Seal all breaches/vents before pressure drops to critical |

### Difficulty Curve

- **Wing A**: Single-hazard rooms. One module can solve most puzzles. Learning the systems.
- **Wing B**: Multi-hazard rooms. Need module combos. Some rooms have 2 valid paths requiring different builds.
- **Wing C**: Cascading hazards. Rooms degrade as you solve them. Timer pressure. Your build is tested hard.
- **Data Core**: Final puzzle uses all three hazard types. The ultimate test of your build.

---

## The Run

### Starting Loadout

Sweepo starts with:
- **3 module slots** (empty)
- **Basic Scanner** (built-in, not a module — reveals adjacent tiles)
- **Clean action** (built-in — clears smoke/dirt in 1 tile)
- **100 HP** (lower than current game — runs are shorter and tighter)

The first room always has 2-3 module drops to choose from. This is your opening hand — it sets the tone for the run.

### Pacing

A full run: **40-80 turns** (much shorter than current 200-1000 turn games).
- Wing A: ~10-20 turns (3-4 rooms, simple puzzles)
- Wing B: ~15-25 turns (4-5 rooms, compound puzzles)
- Wing C: ~15-30 turns (3-4 rooms + final puzzle, cascading hazards)

Short runs mean you can play 3-4 runs in a session. Deckbuilder pacing — learn from each run, try a different build next time.

### Module Drop Economy

Per run, you'll encounter **12-18 modules** across the station. You can carry **3-6**. So roughly 1 in 3 modules found gets kept. This ratio creates meaningful tension at every drop.

Modules are generated from a weighted pool:
- **Common** (60%): Basic tools — Coolant Canister, Pressure Patch, Pry Bar, etc.
- **Uncommon** (30%): Specialized tools — Heat Sink, Grapple Arm, Deep Scanner, etc.
- **Rare** (10%): Build-defining tools — Cryo Grenade, Blast Charge, Overcharge, etc.

The pool is biased toward modules relevant to the station's hazard profile. A heat-heavy station drops more thermal modules. But some off-type modules appear to enable creative solutions.

### Death and Reward

**Death**: HP reaches 0. Run ends. You see:
- How far you got (Wing A/B/C, room count)
- Your final build (modules equipped)
- A "station report" (environmental storytelling about what you saw — not graded)

**Victory**: Reach Data Core, download research data. You see:
- Data recovered (score based on optional salvage collected along the way)
- Efficiency rating (turns used vs. optimal)
- **New module unlock** — each Data Core download adds a new module to the global pool

**Meta-Progression**: Across runs:
- **Module pool expands** — new modules unlocked by winning with specific builds
- **Station variants** — complete all wings to unlock harder station configurations
- **Sweepo upgrades** — persistent unlocks: +1 starting slot, starting with a basic module, etc.
- **Logbook** — environmental details from each run accumulate (the mystery told through texture, never through quizzes)

---

## The Portal Parallel

Portal's genius: one tool, infinite spatial puzzles. The portal gun doesn't change — the rooms do.

SSR Salvage inverts this: the rooms change AND your tools change. Each run is a unique intersection of "what puzzles does this station have" and "what tools did I find to solve them."

| Portal | SSR Salvage |
|--------|-------------|
| Portal gun | Module loadout |
| Test chambers | Station rooms with hazard configurations |
| GLaDOS | PA system (sardonic commentary on Sweepo's attempts) |
| Momentum / physics | Hazard interactions (heat + pressure + smoke) |
| Companion cube | Crew NPCs to rescue (optional objective) |
| Ratman dens | Environmental storytelling (crew traces, not graded) |
| Escalating complexity | Wing A → B → C difficulty curve |
| "The cake is a lie" | The Data Core might not contain what you think |

### The PA System as GLaDOS

The PA system already exists. Reframe it:
- Comments on your module choices ("Maintenance unit has equipped... a pry bar. Station management reminds all personnel that doors are not designed to be pried.")
- Reacts to damage taken ("Maintenance unit structural integrity at 60%. This is within acceptable parameters for non-essential equipment.")
- Provides "helpful" hints that are slightly threatening ("The atmospheric scrubber is rated for 200 hours of continuous operation. Current session duration: 199 hours, 47 minutes.")
- Escalates tone as you go deeper ("Maintenance unit. You are now entering Wing C. Station management has not authorized maintenance operations in this sector. Proceed at own risk. Station management accepts no liability.")

This is flavor, not mechanics. But it's the difference between a puzzle game and a *game with personality*.

---

## Environmental Storytelling (Not Mystery Quizzes)

The crew and the incident still exist. But you're not scored on understanding them. Instead:

- **Room flavor**: Each room has visual details — overturned furniture, burn marks, personal items. These tell the story passively. No interaction required.
- **Optional terminals**: Some rooms have readable logs. Short. Atmospheric. No journal tracking, no evidence tags, no deduction scoring. Just... a log. Read it or don't.
- **Crew traces**: Handprints on walls near thermal vents. A jacket draped over a console. Magnetic boots left near a breach. These are set dressing that tells a story to players who pay attention.
- **PA fragments**: The PA system occasionally glitches and plays old announcements from before the incident. These provide narrative context without demanding engagement.

The story is there for players who want it. It never interrupts the puzzle-solving. It never grades you.

---

## What Changes in the Codebase

### Remove (~7,000 lines)
- Mystery state: deductions, evidence tags, room scenes, investigation hub, crew dossiers, CORVUS-7
- Investigation phases, crack moments, narrative threads
- Journal/evidence UI overlays
- Scene processing, testimony system

### Keep (~8,000 lines)
- Hazard systems (heat, pressure, smoke spreading and interaction)
- Map generation (ROT.js Digger rooms and corridors)
- Entity system (type enum, props, interaction handlers)
- Movement, collision, door mechanics
- 3D renderer (display3d.ts)
- Turn system, HP, game over flow
- PA announcement system
- Controller input

### Add (~2,000-3,000 lines)
- Module system (types, equip/swap, charge tracking, synergies)
- Module generation (weighted pools, drop placement)
- Wing structure (gate puzzles, progression tracking)
- Room configuration templates (hazard patterns tied to objectives)
- Module choice UI (popup when finding a module with bay full)
- Meta-progression (unlock tracking, persistent state)
- Victory/death screen rework (show build, show progress)

### Modify (~1,500 lines)
- `procgen.ts` — room generation adds hazard configs and module drops instead of evidence
- `step.ts` — action system supports module-granted actions instead of mystery actions
- `types.ts` — Module interfaces replace mystery interfaces
- `display3d.ts` — module bay HUD replaces investigation hub
- `browser.ts` — remove investigation overlays, add module choice overlay

---

## Estimated Effort

This is a **significant pivot** but not a rewrite:
- **Week 1**: Strip mystery systems, add Module type system and equip/swap
- **Week 2**: Room configuration templates, hazard-as-puzzle design for 15-20 room configs
- **Week 3**: Wing structure, module drop economy, meta-progression
- **Week 4**: PA personality, environmental storytelling, balance tuning
- **Week 5**: Polish, playtesting, difficulty curve adjustment

The foundation (grid, hazards, 3D, controls) stays. The top layer (what you're doing and why) changes completely.

---

## Zero Gravity — The Fourth Hazard Type

The existing hazards (heat, pressure, smoke) are all tile-state systems — values on tiles that spread and damage. Zero-g is fundamentally different: it changes **how movement works**.

### How It Works

Some rooms or corridors have **gravity offline** (marked on tiles, like heat/pressure values). In zero-g tiles:

- **Without magnets**: Sweepo's Move action becomes **Launch**. Pick a cardinal direction. Sweepo drifts in that direction until hitting a wall, obstacle, or gravity-on tile. Each launch = 1 turn, but covers multiple tiles. This is the ice puzzle mechanic, but it makes spatial sense because *you're in space*.

- **With Magnetic Boots module**: Normal grid movement in zero-g. Clank, clank, clank. Full control. But it costs a module slot.

- **With Grapple Arm module**: Can target any wall tile within range. Pull yourself there in 1 turn. More flexible than magnets (can cross gaps) but requires line of sight to a wall.

### What Floats

In zero-g rooms:
- **Loose objects drift** — module pickups, power cells, and debris slowly float around (move 1 tile in a random direction every 3-5 turns)
- **Crew NPCs are helpless** — floating, rotating slowly, can't self-rescue. You need magnets or grapple to reach them, then tether them to drag them to gravity.
- **Smoke doesn't settle** — smoke in zero-g doesn't clear naturally (no convection). Scrubber module or vent control needed.
- **Heat still radiates** — thermal hazards work normally (radiation doesn't need gravity)
- **Pressure behaves differently** — breaches in zero-g rooms drain faster (no gravity holding atmosphere in place)

### Zero-G Room Puzzles

**"The Drift"**
```
  ░░░░░░░░░░░░░
  ░...........░    Zero-g room. Module pickup floating
  ░...........░    in center. No walls to stop against
  ░.....◆.....░    if you launch toward it — you'll
  ░...........░    overshoot and hit the far wall.
  ░...........░
  ░░░░░[▣]░░░░    Solution: Launch sideways to hit a
                   wall near the pickup, then launch
                   again. Or: Grapple Arm to a wall
                   segment. Or: Magnetic Boots and
                   just walk.
```

**"The Pinball"**
```
  ░░░░░░░░░░░
  ░.....░...░    Zero-g corridor with wall segments.
  ░.░░..░...░    Launch and ricochet off walls to
  ░.░░......░    navigate to the exit. Each launch
  ░.....░░..░    = 1 turn, hazards tick. Plan your
  ░░░[▣]░░░░░    bounces or take too many turns and
                  the heat from adjacent room spreads in.
```

**"The Debris Field"**
```
  ░░░░░░░░░░░░░
  ░.◇...◇.◇..░    Floating debris (◇) moves each turn.
  ░...◇....◇.░    If you launch, you might collide with
  ░.◇....◇...░    debris mid-drift (stops you early,
  ░...◇..◇...░    takes damage). Time your launches
  ░░░░░░[▣]░░░    between debris movement cycles.
```

### The Magnet Decision

Magnetic Boots are a **permanent passive module** taking 1 slot. The design question they create:

- **With magnets**: Zero-g rooms are trivial. You walk normally. But you have 1 fewer slot for active tools.
- **Without magnets**: Zero-g rooms are ice puzzles. Challenging, sometimes fun, sometimes frustrating. But you have a free slot for Cryo Grenade or Blast Charge.

This is a genuine deckbuilder decision. "Do I spend a slot on convenience, or do I learn to play around the constraint?"

Experienced players will skip magnets and master drift navigation. New players will equip magnets and feel safe. Both are valid builds.

### Zero-G as Level Design Tool

Zero-g sections create natural **one-way gates**: you can drift into a zero-g room easily, but drifting back requires a wall to push off at the right angle. This means:

- Rooms can have "easy in, hard out" design (you committed by entering)
- Corridors with zero-g segments become routing puzzles (which direction do I approach from?)
- Mixed rooms (partial zero-g) create interesting boundaries where you transition mid-room

### Integration with Other Hazards

| Combo | Effect |
|-------|--------|
| Zero-g + Heat | Can't stop on hot tiles — drift carries you through (either good or bad) |
| Zero-g + Vacuum | Double jeopardy — no magnets AND no air. Need 2 modules or take both damage types |
| Zero-g + Smoke | Smoke never clears, blocks visibility. Drifting blind. |
| Zero-g + Debris + Heat | The "asteroid field" — time your launches between floating hot debris |

---

## Open Design Questions

1. **Should modules degrade?** Charges create urgency but permanents feel good. Current split: ~60% charged, ~40% permanent. Right ratio?

2. **How punishing is module loss?** Current design: swapped-out modules are gone forever. Alternative: they stay in the room and you can backtrack. Backtracking adds time pressure vs. module flexibility trade-off.

3. **Drone encounters**: Current game has patrol drones. Keep as hazards? Make them another puzzle type (stealth/avoidance)? Or remove entirely?

4. **Crew rescue**: Keep as optional side objective (bonus score) or remove? Good argument for keeping: escorts are spatial puzzles too (crew NPCs can't survive hazards you can tank).

5. **Meta-progression depth**: How much between-run progression? Slay the Spire has ~300 hours of unlocks. We probably want 20-40 hours. How many modules, station variants, and Sweepo upgrades?

6. **Wing Gate design**: Linear (must solve A before B) or branching (choose your path through the station)? Branching adds replayability but complicates difficulty curve.

---

## Summary

Strip the mystery quiz. Keep the spatial systems. Add modules that change your verb set each run. Make every room a Portal test chamber solved by your current loadout. Let the PA be GLaDOS. Let the story be wallpaper, not homework.

The game becomes: **"What can I do with what I've found?"** — and the answer is different every time.
