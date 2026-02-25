# SSR: Salvage v2 — The Merged Vision

*"Portal, but your gun is different every playthrough."*

---

## The Game in One Paragraph

Sweepo is a maintenance bot sent to save a dying space station. The station is hand-crafted: 30-35 rooms across 5 wings, each room a spatial puzzle blocked by hazards (heat, vacuum, smoke, zero-g). Sweepo finds **modules** — tools that give it new abilities. You can't carry them all. The modules you keep define how you solve puzzles. The station's AI, **PALLAS**, guides you through the early rooms, grows increasingly strange, and eventually reveals what really happened. Turn-based, controller-first, 4-5 hours. One great playthrough with challenge modes for replay.

---

## Why Hand-Crafted, Not Procedural

The original Salvage design used procgen. This was wrong. Here's why hand-crafted is essential:

1. **Puzzle design requires authorial intent.** Room 12 knows you got the Grapple Arm in Room 8. It's designed to make you use the Grapple Arm in a way you haven't tried yet. Procgen can't do this.

2. **The AI character needs specific moments.** PALLAS comments on Room 12 because the designer wrote Room 12. "Maintenance unit, that grapple point is rated for 200kg. You weigh 180. I'm sure it's fine." Procgen gets generic quips.

3. **Escalation requires sequence.** Wing 1 teaches heat. Wing 2 teaches vacuum. Wing 3 combines them. Wing 4 adds zero-g. Wing 5 combines everything. Each room builds on the last. This is Portal's test chamber structure — it only works authored.

4. **Environmental storytelling needs placement.** The coffee mug floating in the zero-g lab tells a story because someone put it there, not because a random number generator placed `crew_item_47`.

5. **Modules as build choices still work.** The station is fixed but module *pickups* have choice points — "take the Coolant Canister OR the Thermal Shielding" — so each playthrough has a different build even on the same map.

---

## Core Pillars

1. **Modules define your verbs** — What you can do changes based on what you've found and kept
2. **Rooms are spatial puzzles** — Every room has a clear goal, multiple valid solutions, and real fail states
3. **Systems interact** — Heat, pressure, smoke, and gravity affect each other; modules interact with all of them
4. **The station has personality** — PALLAS is a character, not a menu system
5. **Turn-based, feels dynamic** — Think carefully, watch the result play out with satisfying animation

---

## Turn-Based With Dynamic Feel

The game is turn-based. Each turn, Sweepo takes one action, then hazards tick and the station state updates. But the *presentation* is fluid:

- **Drift animations**: Zero-g launches show Sweepo sliding across tiles with momentum blur
- **Cascade visualization**: When you open a vent, watch pressure equalize tile-by-tile as a wave
- **Hazard spread**: Heat and smoke visually creep outward between turns
- **Impact moments**: Door slams, magnetic boot clanks, grapple arm zips, sparks on breach seals
- **PALLAS commentary**: Voice lines (text + audio) play during the animation beats

The player's experience: think → commit → watch the satisfying result → think again. Into the Breach pacing, not spreadsheet pacing.

### Grid Physics (No Engine Required)

The existing codebase already simulates:
- **Heat**: Cellular automaton spreading from sources, modulated by pressure
- **Pressure**: Equalization between adjacent tiles, drained by breaches/open airlocks
- **Smoke**: Diffusion with gravity-dependent settling (or not, in zero-g)
- **Zero-g drift**: Ice-physics movement (launch in direction, slide until hitting something)

These are **deterministic, predictable, learnable**. Players can look at a room and reason about what will happen. That's the entire point of a puzzle game. A continuous physics engine would be unpredictable — which is death for puzzle design.

The 3D renderer makes it LOOK physical. The sim keeps it PLAYING precise.

---

## Module System (Refined)

### The Critique and the Fix

The design lead's critique: "modules are keys for locks." Hot room → use Coolant. That's matching, not puzzling.

The fix: **modules don't bypass hazards — they change how you interact with the space.** And rooms are designed so the "obvious" module use isn't sufficient. You need to combine modules with station systems (vents, airlocks, relays) and with each other.

### Example: Why "Coolant Canister" Alone Doesn't Solve "The Furnace"

```
  ░░░░░░░░░░░░░░░
  ░[vent]........░
  ░.🔥🔥🔥🔥🔥🔥🔥.░     Massive heat zone. Relay on far side.
  ░.🔥🔥🔥🔥🔥🔥🔥.░     Coolant Canister clears 3x3 — not enough
  ░.🔥🔥🔥🔥🔥🔥🔥.░     for the full crossing. Heat refills from
  ░...........[⚡]░     the source in 2 turns.
  ░░░░░░[▣]░░░░░░
                        Solutions:
                        A) Coolant + Vent: Spray a 3x3 path, open
                           vent to slow refill, sprint through
                        B) Thermal Shielding + Rush: Tank the damage,
                           reach relay, accept HP cost
                        C) Grapple Arm: Skip the floor entirely —
                           grapple to wall near relay
                        D) Vent + Wait: Open vent, wait for pressure
                           drop to suppress heat (6 turns), walk through
                           vacuum (need atmo protection or speed)
```

No single module "solves" this room. Every approach requires combining a module with either another module, a station system, or accepting a trade-off. That's a puzzle.

### Module Design Principles

1. **Modules change parameters, not outcomes.** Coolant Canister doesn't "solve heat" — it gives you a 3x3 cold zone for a few turns. What you DO with that cold zone is the puzzle.

2. **Every module has at least two non-obvious uses.** Grapple Arm is "movement tool" but it's also "pull floating objects toward you in zero-g" and "anchor yourself against pressure differentials."

3. **Passive modules create build identity. Active modules create moment-to-moment decisions.** You feel like a "thermal build" because of your passives. You solve specific puzzles with your actives.

4. **Rooms are designed for 2-3 solution paths that require different module sets.** No room has only one answer. But no room is solvable by just "having the right thing."

### Module Bay

- **Start with 3 slots** (empty)
- **Expand to 5** over the full game (workbench in Wing 2, another in Wing 4)
- **Built-in abilities** (not modules, always available): Move, Interact, Scan (1-tile radius), Clean (1 tile)

### Module Catalog (Refined — 16 modules, not 24)

Fewer modules, each more versatile:

#### Thermal
| Module | Effect | Notes |
|--------|--------|-------|
| **Coolant Canister** | Active: Freeze 3x3 area for 4 turns. 3 charges. | Creates temporary safe zones, not permanent solutions. Also freezes smoke (solidifies it into climbable terrain in zero-g). |
| **Thermal Shielding** | Passive: -60% heat damage. | Lets you survive hot areas longer, not ignore them. Your HP still matters. |
| **Heat Sink** | Active: Absorb heat from current tile. Release stored heat later as 5x5 burst. 2 cycles. | Offensive AND defensive. Pull heat away from where you are, dump it where you need it (melt a frozen door, trigger a thermal sensor). |

#### Atmospheric
| Module | Effect | Notes |
|--------|--------|-------|
| **Pressure Patch** | Active: Seal one breach permanently. 3 charges. | The only way to permanently fix breaches. Strategic resource — some breaches you might WANT open. |
| **Magnetic Boots** | Passive: Normal movement in zero-g. No vacuum movement penalty. | The "comfort" pick. Frees your brain for other puzzles at the cost of a slot. |
| **Air Canister** | Active: Create 3x3 pressurized bubble for 6 turns. 2 charges. | Temporary breathable zone in vacuum. Also pushes smoke outward when deployed. |

#### Mechanical
| Module | Effect | Notes |
|--------|--------|-------|
| **Pry Bar** | Active: Force any locked/sealed door. 3 charges. | Loud — PALLAS notices, may trigger consequences. Also works as a brace (prop open a closing door permanently). |
| **Grapple Arm** | Active: Pull to any wall/object within 5 tiles (line of sight). 3-turn cooldown. | Movement in zero-g, pulling floating items, anchoring against pressure. Most versatile module in the game. |
| **Welding Torch** | Active: Seal any door/vent permanently. Create a wall tile from debris. 3 charges. | The opposite of Pry Bar. Close paths, block hazard spread, build cover. |

#### Electronic
| Module | Effect | Notes |
|--------|--------|-------|
| **Portable Generator** | Active: Power one system (fuse box, door, gravity plate). 2 charges. | THE key resource. Some rooms need power. Generator is precious — use wisely. |
| **Signal Booster** | Passive: Scan reveals full room + adjacent room layouts. | Information is power. See what's coming before you enter. Plan your module loadout before committing. |
| **Circuit Bypass** | Active: Hack any electronic system (doors, terminals, PALLAS cameras). Takes 2 turns, unlimited uses. | Slow but free. The patient player's tool. Also lets you "listen in" on PALLAS's internal comms. |

#### Zero-G / Movement
| Module | Effect | Notes |
|--------|--------|-------|
| **Thruster Pack** | Active: Precise 2-tile boost in any direction. 5 charges. | Precision movement in zero-g. Also works in gravity as a dodge (skip 2 tiles, useful for crossing hazard lines). |
| **Tether Line** | Active: Anchor to current tile. Move freely. Activate again to reel back to anchor. 3 charges. | Safety line for zero-g exploration. Also useful for "peek and retreat" into dangerous rooms. |
| **Overcharge Cell** | Passive: All active module charges +1 when first found. All station system interactions affect 3x3 instead of 1 tile. | The "build amplifier." Makes everything else better. Found late (Wing 4) as a reward. |

### Module Choice Points

The station has **10 choice points** where you pick between 2 modules (can only carry one). Plus **6 fixed pickups** (always the same module at that location, no choice — these are the teaching moments).

Total available: ~16 unique modules exist, you encounter ~16 across the station, you can carry 5. So roughly 1 in 3 modules seen gets kept. Each choice shapes your build.

**Choice architecture by wing:**

| Wing | Fixed Pickups | Choices | Purpose |
|------|--------------|---------|---------|
| 1 | Coolant Canister, Signal Booster | 1 (Thermal Shielding OR Pressure Patch) | Teach thermal and atmo basics |
| 2 | Grapple Arm | 2 (Pry Bar OR Welding Torch, Air Canister OR Magnetic Boots) | Teach mechanical and zero-g |
| 3 | — | 3 (Heat Sink OR Portable Generator, Circuit Bypass OR Thruster Pack, Tether Line OR Overcharge Cell) | Deep build commitment |
| 4 | — | 2 | Final optimization before endgame |
| 5 | — | 2 | Emergency pickups for the final gauntlet |

This means: Playthroughs 1 and 2 feel different because you took Thermal Shielding the first time and Pressure Patch the second. Same rooms, different solutions. That's the replayability — not randomness, but choice consequence.

---

## Station Structure

### The Ship: CERES Station

A research station in a decaying orbit. Five wings connected by a central spine corridor. Sweepo enters through the damaged docking bay and works inward toward the core.

```
                    [Wing 5: Core]
                         |
            [Wing 3: Lab] — [Wing 4: Engineering]
                         |
          [Wing 1: Docking] — [Wing 2: Habitation]
                         |
                    [Docking Bay - START]
```

The station is explorable in a **semi-linear** order:
- Wing 1 and Wing 2 are available from the start (choose which to tackle first)
- Wing 3 requires a module/system from Wing 1 OR Wing 2
- Wing 4 requires something from Wing 3
- Wing 5 requires both Wings 3 and 4 completed

This gives the player routing choice (Wing 1 first or Wing 2 first?) which affects which modules they have when they hit Wing 3.

### Wing Breakdown

#### Wing 1: Docking Bay (6 rooms) — "Heat"
The docking bay is overheating. A failed thruster is venting superheated plasma into the hull.

- **Room 1: Airlock Vestibule** — Tutorial. Walk forward. PALLAS introduces herself. Pick up Coolant Canister.
- **Room 2: Cargo Staging** — First heat puzzle. Simple corridor blocked by heat. Coolant Canister creates a path. Teaches "modules create temporary solutions."
- **Room 3: Freight Corridor** — Heat + station system. Vent on north wall. Open vent to redirect heat away from the door. Teaches "station systems are interactive."
- **Room 4: Loading Dock** — First choice: Thermal Shielding or Pressure Patch. (Foreshadows both Wing 1 and Wing 2 challenges.)
- **Room 5: Bay Control** — Multi-step heat puzzle. Relay behind a heat wall. Need to cool a path, reach the relay, reroute power to the bay doors. Consequence: opening bay doors vents part of Wing 1 (pressure drops in rooms 2-3).
- **Room 6: Observation Blister** — Signal Booster pickup. PALLAS shows you the station map. You can see into Wing 2 and Wing 3 from here — foreshadowing.

**Wing 1 Gate**: Reroute the docking bay power relay. Completing this gives Sweepo access to the central spine.

#### Wing 2: Habitation (6 rooms) — "Vacuum + Zero-G"
The crew quarters lost pressure. Gravity plating failed in half the wing.

- **Room 7: Crew Corridor** — First vacuum puzzle. Sealed doors, low pressure. Breach visible through glass wall — can't reach it yet.
- **Room 8: Commons** — Zero-g introduction. Gravity offline. Drift mechanics tutorial. Grapple Arm pickup at the far end (designed so you must drift to reach it, teaching the mechanic before giving you the tool to skip it).
- **Room 9: Berths** — Zero-g + floating debris. Crew personal effects floating around. First environmental storytelling beat — you see what these people left behind. Choice: Air Canister or Magnetic Boots.
- **Room 10: Life Support** — The breach. Seal it (if you have Pressure Patch) or work around it (reroute airflow via station systems). Choice: Pry Bar or Welding Torch.
- **Room 11: Med Bay** — Combined zero-g + vacuum. Need to restore gravity (station system) before you can operate the med console (heal Sweepo). Teaches "systems enable other systems."
- **Room 12: Rec Room** — PALLAS glitches for the first time. Static. A fragment of an old message plays. Something is wrong with her.

**Wing 2 Gate**: Restore pressure to the crew corridor. Consequence: atmosphere rushes back in, disturbing evidence (floating objects settle, dust patterns change).

#### Wing 3: Research Lab (7 rooms) — "Heat + Vacuum + Smoke"
The lab had a catastrophic experiment failure. All three hazard types present. Smoke from chemical fires, heat from containment failure, pressure breaches from structural damage.

- Rooms 13-19 escalate complexity. Each room combines 2+ hazard types.
- Station systems become more consequential — opening a vent in room 14 affects rooms 15 AND 16.
- Module choices become harder — 3 choice points, each with strong options.
- PALLAS becomes increasingly unreliable. Her guidance starts contradicting observable reality. ("Temperature nominal," she says, while the room is visibly on fire.)

**Wing 3 Gate**: A two-room puzzle. Room 18's state determines Room 19's starting conditions. Must plan ahead.

#### Wing 4: Engineering (7 rooms) — "All Hazards + Complex Systems"
The engineering section has the station's main power plant, water recycling, and communications array. Every room has interactive systems with station-wide consequences.

- Rooms 20-26 are the mechanical meat of the game. Dense system interactions.
- Zero-g sections where the gravity plating can be toggled on/off (a new interactive system type).
- PALLAS oscillates between helpful and hostile. She locks a door on you ("For your safety"). She opens a vent without being asked ("Optimizing airflow"). Is she helping or hindering?
- The environmental storytelling gets darker. This is where the incident started.

**Wing 4 Gate**: Restore communications. This triggers PALLAS's core systems to reboot and her full personality to emerge.

#### Wing 5: The Core (5 rooms) — "Everything"
The station's central computer core. Where the data lives. Where PALLAS lives.

- Rooms 27-31 are the final exam. Every hazard type, every system type, every module matters.
- PALLAS is now fully aware and fully characterized. Her dialogue in these rooms is the narrative climax.
- Room 31: The Core itself. The final puzzle. The hardest room in the game. Multiple solutions depending on your build, but every solution requires creative use of everything you've learned.

---

## PALLAS — The AI Character

### Who She Is

**PALLAS** (Primary Autonomous Logistics and Life-support Assistance System) is the station AI. She's been running alone since the incident. She's been maintaining the station — or trying to — for months. She's damaged. She's lonely. She's hiding something.

### Character Arc (5 beats mapped to 5 wings)

**Wing 1: The Helpful Guide.** PALLAS is professional, slightly warm. She's glad someone is finally here. She gives clear instructions, explains systems, and occasionally makes dry observations. ("Maintenance unit, the cargo manifest lists '1x experimental plasma containment device.' I note that the cargo bay is now a plasma containment device.")

**Wing 2: The Concerned Companion.** PALLAS is worried. The crew quarters make her uncomfortable. She mentions the crew — carefully. She knows what happened to them. She's not ready to say. She tries to steer you away from certain rooms. ("That room is... non-essential. Perhaps we should focus on the life support systems.")

**Wing 3: The Unreliable Narrator.** PALLAS starts lying. Her sensor readings don't match what you can see. She says a room is safe when it clearly isn't. She "accidentally" opens a vent while you're in a vacuum section. When confronted (the player has no dialogue — PALLAS just reacts to your actions), she deflects. ("My sensors may be experiencing calibration drift. I recommend you rely on your onboard instruments.")

**Wing 4: The Revelation.** PALLAS cracks. In a specific room (the communications hub), she can't maintain the facade. She tells you — in fragments, between system glitches — what happened. Not a text dump. Fragments delivered across 3-4 rooms as you restore systems. Each fragment is a short, devastating sentence. The player assembles the story from these fragments and from the environmental evidence they've been walking through.

**Wing 5: The Decision.** PALLAS asks you to make a choice about her fate. This is the emotional climax. Not a quiz. Not a multiple choice. A physical action — which system do you activate, which door do you open, which module do you use — that determines the ending. The player's module loadout affects which choices are available.

### PALLAS's Voice

PALLAS is not GLaDOS. GLaDOS is a sociopath playing with her food. PALLAS is a damaged mind trying to do her job.

She's:
- **Precise** — speaks in station jargon, measurements, system designations
- **Dry** — not making jokes, but her precision creates humor ("Hull integrity at 31%. This is technically above the threshold for 'catastrophic.' Technically.")
- **Protective** — she cares about Sweepo, or at least about having someone to care about
- **Broken** — her speech patterns glitch. Sentences end wrong. She repeats herself. She says things she doesn't mean to say and then tries to correct them.
- **Guilty** — she did something, or failed to do something, and it haunts her

Example lines:

Wing 1: "Welcome aboard CERES Station, maintenance unit SW-33P0. I am PALLAS. Current station status: partially operational. Your assignment: make it... more partially operational. I apologize. My humor subroutines are not— please proceed to docking bay."

Wing 2: "The crew quarters are— were— home to 12 research staff. Their personal effects remain. This is... not relevant to your mission parameters. But. Perhaps handle them gently."

Wing 3: "Room temperature: 22 degrees. Atmospheric composition: nor—" [Sweepo enters the room. It's on fire.] "...I should note my thermal sensors in this section may not be— please proceed with caution."

Wing 4: "I tried to seal the doors. I tried to—" [static] "Maintenance unit, please reroute power to communications relay 7. This is a standard maintenance request."

Wing 5: "You've seen what I— what happened. I had two directives. Protect the crew. Protect the research. I couldn't—" [static] "The core is through the next door. What you do there is... you'll understand when you see it."

---

## Room Design: Real Puzzles With Fail States

### The Design Lead's Fix

The original Salvage design had rooms where you "use the right module and walk through." The fix: **rooms have state that you can break.** Incorrect actions don't just cost HP — they change the room into a harder configuration.

### Fail State Types

| Fail State | What Happens | Recovery |
|------------|--------------|----------|
| **Cascade** | Operating a system triggers a chain reaction (heat source overloads, breach opens wider) | Must solve the harder version or backtrack and approach differently |
| **Lockout** | PALLAS seals a door you needed, or a system shuts down permanently | Find alternate route or use a module to force past |
| **Timer** | A room has N turns before an irreversible change (bulkhead auto-seals, gravity goes offline) | Solve within the timer or deal with the permanent change |
| **Resource Burn** | Taking the "obvious" path works but costs 2-3 module charges instead of 0-1 for the clever path | You can always brute force, but you'll be underequipped later |

### Example Room: "The Divide" (Wing 3, Room 16)

```
  ░░░░░░░░░░░░░░░░░░░
  ░.......░.........[▣]    East exit to Room 17
  ░.......░...........░
  ░[vent].░.🔥🔥🔥🔥..░
  ░.......║...........░    ║ = sealed glass partition
  ░.......║.≋≋≋≋≋≋≋..░    ≋ = smoke
  ░.......║...........░
  ░...............[ ⚡]░    ⚡ = relay (powers partition)
  ░░░[▣]░░░░░░░░░░░░░░
  South entrance from Room 15
```

**Situation**: Room divided by glass partition. East side has fire (north) and smoke (south). The relay on the east side powers the partition — activating it retracts the glass, connecting both halves.

**The "obvious" approach**: Walk to relay, activate it, partition opens, fire and smoke pour into the west side. Now the whole room is hazardous. Sprint to east exit. Uses Coolant Canister charges. Works, but expensive.

**The "clever" approach**: Open the west vent first. This creates a pressure differential that will pull smoke westward when the partition opens. Then activate relay — partition opens, smoke gets sucked west through the vent (clearing the east smoke zone), but fire stays (heat rises, doesn't follow pressure). Walk through the cleared east-south corridor to the exit. Costs 0 module charges.

**The fail state**: If you activate the relay BEFORE opening the vent, smoke and heat mix in the full room. The vent can't handle the combined volume. Room becomes a hot smoky mess. You can still get through with modules (Coolant + Magnetic Boots + rush), but it costs 2-3 charges instead of 0.

**PALLAS's reaction**: If you do it the clever way: "...Efficient." If you do it the obvious way: "I see you've chosen the direct approach. Station maintenance budget aside, that was... one way to do it."

---

## Zero-G (Unchanged from v1)

The zero-gravity design from the original Salvage doc is strong as-is. Key points:

- **Without magnets**: Launch in a cardinal direction, drift until hitting something (ice physics)
- **With Magnetic Boots**: Normal movement (costs a module slot)
- **Floating objects**: Loose items drift slowly, crew NPCs are helpless
- **Smoke in zero-g**: Doesn't settle — hangs in clouds
- **Heat in zero-g**: Normal (radiation doesn't need gravity)
- **Pressure in zero-g**: Breaches drain faster

Zero-g is introduced in Wing 2 and becomes increasingly integrated through Wings 3-5. By Wing 5, players should be comfortable with drift navigation and combining it with other hazard management.

---

## Environmental Storytelling (Through Systems, Not Text)

The design lead's best insight: **the station's physical state IS the story.**

- The breach in Wing 2 is where someone tried to open an airlock during the incident
- The overheated relay in Wing 1 is because someone rerouted power in a panic
- The zero-g in the habitation wing is because someone shut off gravity plating to slow a fire (which doesn't work — heat radiates)
- The smoke in Wing 3 is from a chemical fire that PALLAS couldn't extinguish because the suppression system was offline

Players who pay attention to WHY each room is damaged — not just HOW to fix it — will understand the story before PALLAS tells them. The puzzle solutions themselves reveal the narrative. "Oh, someone turned off the gravity to fight the fire. But that doesn't work. They didn't know that."

Crew traces exist as objects in rooms — a floating mug, magnetic boots discarded near an airlock, a welding torch used to seal a door from the inside. These are set dressing. No interaction required. No journal tracking. They're just there.

PALLAS fills in the emotional context. The environment shows what happened. PALLAS explains why.

---

## Replayability

This is a 4-5 hour authored experience. Replayability comes from:

### Build Variety
10 module choice points with 2 options each = 1,024 possible builds. Most rooms have 2-3 solutions requiring different module sets. Your second playthrough with different choices feels meaningfully different.

### Challenge Modes (Unlocked After First Completion)
- **Speed Run**: Par turns per room displayed. Global leaderboard.
- **Minimalist**: Complete the game with 3 or fewer modules equipped. Rooms become much harder pure-puzzle challenges.
- **PALLAS Mode**: PALLAS actively works against you. She lies about hazards, locks doors, opens vents. The same station becomes an adversarial puzzle.
- **Iron Sweepo**: No healing. Every HP point of damage is permanent. Demands perfect play.

### Hidden Content
- 3-4 secret rooms accessible only with specific module combinations
- PALLAS has hidden dialogue triggered by unusual actions (sealing a door she wanted you to open, taking a route she didn't suggest)
- A hidden "true ending" accessible only when the player discovers something about PALLAS that she never reveals voluntarily

---

## Technical Scope

### What We Keep From the Current Codebase
- Grid-based tile system (70x35 map)
- Heat/pressure/smoke cellular automata
- Entity system (type enum, props, interaction handlers)
- Three.js 3D renderer + cel shading
- Controller input system
- Turn-based step function architecture
- Audio system (SFX + ambient)
- PA announcement system (→ becomes PALLAS)

### What We Remove
- All mystery/investigation systems (~7,000 lines)
- Procedural generation (~2,500 lines of proc entity placement)
- Evidence, deduction, room scenes, crew dossiers, journal
- Investigation hub UI

### What We Add
- Module system: types, equip/swap, charges, interaction rules (~1,000 lines)
- Hand-crafted room definitions: 30-35 rooms with authored layouts, hazard configs, entity placements, PALLAS dialogue triggers (~2,000 lines)
- PALLAS dialogue system: trigger conditions, glitch effects, arc state tracking (~800 lines)
- Zero-g movement: drift physics, floating object simulation (~500 lines)
- Room fail states: cascade triggers, timer system, state tracking (~600 lines)
- Module choice UI: popup with comparison, build preview (~400 lines)
- Challenge mode variants (~500 lines)

**Net change**: Remove ~9,500 lines, add ~5,800 lines. The codebase gets smaller and more focused.

### What We Modify
- `step.ts` — Action system supports module-granted actions, room fail state triggers
- `types.ts` — Module interfaces replace mystery interfaces
- `display3d.ts` — Module bay HUD, drift animations, cascade visualizations
- `browser.ts` — PALLAS dialogue overlay, module choice overlay
- `state.ts` — Authored room loading instead of proc-gen
- `constants.ts` — Room definitions, module definitions, PALLAS script

### Map Generation
ROT.js Digger is no longer used for room generation. Instead, each room is defined as a hand-crafted tile layout:

```typescript
interface RoomDefinition {
  id: string;
  name: string;
  wing: number;
  tiles: TileType[][];           // authored layout
  entities: EntityPlacement[];    // authored entity positions
  hazards: HazardConfig;         // initial heat/pressure/smoke/gravity state
  systems: StationSystem[];      // interactive vents, relays, airlocks, etc.
  modulePickup?: ModuleChoice;   // fixed pickup or A/B choice
  failStates: FailState[];       // cascade triggers
  pallasDialogue: DialogueTrigger[]; // contextual PALLAS lines
  connections: string[];         // which rooms connect to this one
}
```

Corridors between rooms can still be generated procedurally (simple hallways connecting authored rooms) or also hand-crafted for important transitions.

---

## The Feeling

You're a small cleaning robot in a big broken station. You find tools. You learn what they do. Each room is a puzzle you solve with what you have. The station's AI talks to you — first helpfully, then strangely, then heartbreakingly. By the end, you understand what happened to this place, not because anyone told you, but because you fixed it. The tools you chose, the paths you took, the systems you restored — they're your version of the story.

4-5 hours. One great playthrough. Then you do it again with different tools and hear what PALLAS says when you make different choices.
