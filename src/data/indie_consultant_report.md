# Indie Game Design Consultant Report: SSR (CORVUS-7)

**Date**: 2026-02-16
**Reviewer**: Independent Design Consultant
**Build Reviewed**: Current master branch, all source files in `src/`
**Time Spent With Build**: Full code audit + mental walkthrough of golden seed run

---

## 1. WHAT'S WORKING

**1.1 The Narrative Framing Is Genuinely Good**

The opening crawl in `src/data/lore.ts` (lines 13-36) nails a specific tone that very few roguelikes attempt: competent melancholy. The line "one janitor-class rover, designation A3, standing by in the arrival bay with a full battery and a cleanliness sensor" is doing real work. It immediately establishes stakes, limitation, and character without a single line of dialogue. The tagline ("A silent station. A fragile link. One bot.") is strong enough to ship.

**1.2 The Authored Log System Tells a Real Story**

The 16 entries in `src/data/logs.json` are structured as a genuine incident timeline, not filler. Vasquez's arc from frustrated engineer (LOG_CREW_001: "I filed three maintenance requests") to desperate last-stand operator (LOG_CREW_005: "I can't reach P03 -- too much heat") is a compact, effective character arc delivered entirely through found documents. The log placement in `src/sim/procgen.ts` (lines 252-277) is deliberately chronological -- the player discovers the timeline in roughly the right order. This is smart design.

**1.3 The Sensor-Gated Information Model Is the Right Core Mechanic**

The thermal sensor as a prerequisite for meaningful scanning (`src/sim/step.ts` lines 254-290) is the seed of a genuinely interesting design. The idea that you start with a cleanliness sensor (useless for the crisis) and must find the thermal module before the environment becomes legible is a good metaphor for the whole game's premise: limited information, remote operation.

**1.4 The Thermal Overlay Rendering Is Well-Executed**

The color interpolation in `src/render/display.ts` (lines 54-69, `heatToFgColor`/`heatToBgColor`) creates a readable thermal gradient. The CSS scanline overlay (`src/index.html` lines 32-45) combined with the canvas drop-shadow filter (line 51) gives the map a convincing retro-terminal look without going overboard. This is tasteful.

**1.5 The Objective System Provides Clear Guidance**

The `getObjective()` method in `src/render/display.ts` (lines 332-385) dynamically tracks game phase and gives the player explicit next steps. For a game about navigating an opaque situation, this is a necessary concession to playability. The three-phase structure (find sensor -> reroute relays -> transmit data) gives the run a clear narrative shape.

---

## 2. WHAT'S BROKEN

**2.1 There Are No Decisions -- Only a Checklist**

This is the fatal problem. Every run is a scavenger hunt: walk to S, press interact, walk to R, press interact, walk to R, press interact, walk to R, press interact, walk to D, press interact. The player never chooses between two meaningful options. There is no resource to manage (HP drains but the damage is gentle -- `HEAT_DAMAGE_PER_TURN = 5` at `src/shared/constants.ts` line 15, and the pain threshold of 40 means you can tank most relay rooms). There is no routing dilemma (the relays can be done in any order with no tradeoff). There is no risk-reward moment.

Compare Brogue: every corridor might contain a trap, a treasure, or both. You are constantly choosing between exploring deeper and retreating. SSR currently has no equivalent. The heat hazard exists but it has no teeth because (a) you can just walk through it, (b) there is no healing scarcity (service bot fully restores you), and (c) the damage scaling in `src/sim/hazards.ts` lines 117-118 is gentle enough that you can walk across a relay room in 5-6 turns and lose maybe 20 HP.

**2.2 The Map Is Illegible and Exploration Feels Random**

ROT.js Digger produces rooms connected by corridors, but the player has no way to know which direction to go. The map (`DEFAULT_MAP_WIDTH = 70, DEFAULT_MAP_HEIGHT = 35` in `src/shared/constants.ts` lines 2-3) is big enough that wandering corridors between rooms feels like dead time. There is no minimap, no autoexplore, no compass, no breadcrumb trail. Room names flash for 2 seconds (`src/render/display.ts` line 223) and then vanish. The player cannot see the room name of their current location persistently -- it is only in the status bar, buried between turn count and HP.

The room descriptions in `src/data/roomDescriptions.ts` are good writing, but they scroll through the log panel at the same priority as system messages. A first visit to "Power Relay Junction" should feel like a moment; instead, the description gets one line in a 12-entry scrollback (max height 100px, `src/index.html` line 101) before being pushed off by hazard warnings.

**2.3 The Hazard System Creates Ambience But Not Gameplay**

Heat spreads every turn (`src/sim/hazards.ts` lines 30-97) and this is technically interesting, but from the player's perspective, heat is just "tiles that hurt." There is no way to manipulate the heat -- the Clean action reduces smoke by 20 (`src/sim/step.ts` lines 330-336) but does nothing to heat. There is no "close a vent to redirect heat" or "activate fire suppression." The relays are binary toggles: walk up, press interact, relay deactivated. The heat was never a puzzle, just set dressing.

The smoke mechanic is particularly underused. Smoke spreads but has zero gameplay effect -- it does not block vision, slow movement, or damage the bot. It is purely cosmetic (`src/sim/hazards.ts` lines 72-80 spread it, but no code anywhere checks smoke for gameplay consequences).

**2.4 Entity Interactions Are Trivially Simple**

Every interactable entity in `src/sim/step.ts` (lines 54-248) follows the same pattern: walk adjacent, press 'i', get result. There is no minigame, no resource cost, no failure state, no timing consideration. Picking up the sensor is the same interaction as rerouting a relay, which is the same as transmitting the data core. The service bot activation (`src/sim/step.ts` lines 222-241) has no meaningful choice either -- you just activate it as insurance.

The game has 5 action types (Move, Interact, Scan, Clean, Wait) defined in `src/shared/types.ts` lines 75-81, but Scan is just a visual toggle, Clean is nearly useless (smoke has no gameplay effect), and Wait is a no-op. The player effectively has 2 verbs: Move and Interact.

**2.5 There Is No Replayability**

The game uses a seed (`src/sim/procgen.ts` line 46, `generate(seed)`) and the room layout changes, but the structure is identical every run: sensor is always in room 1, relays are always at ~20%/50%/75% through the room list, data core is always in the last room (`src/sim/procgen.ts` lines 157-162). The logs are always the same 8 entries from the same pool (`src/sim/procgen.ts` lines 253-261). The hazard types never vary. There is exactly one puzzle type (relay rerouting) and one win condition. A player who finishes one run has no reason to play again.

---

## 3. THE BIG IDEA

**The sensor ladder should be the entire game.**

The design docs mention a sensor progression: Cleanliness -> Thermal -> Atmospheric -> Radiation -> Structural -> EM/Signal (defined in `src/shared/types.ts` lines 50-57, `SensorType` enum). Right now only Thermal is implemented. But THIS is where the magic is.

Imagine: each sensor type reveals a different layer of the station's reality. With Cleanliness (your starting sensor), you see scuff marks, debris trails, disturbed dust -- evidence of where the crew went. With Thermal, you see the heat crisis. With Atmospheric, you see pressure differentials and air quality -- rooms that are vacuum-exposed, leaking corridors. With Radiation, you see the reactor status and contaminated zones. With EM/Signal, you see the station's electronic ghosts -- fragments of last transmissions, door access logs, security camera still frames.

Each sensor doesn't just reveal hazards; it reveals STORY. The same room looks different through each sensor. The crew quarters through Cleanliness shows a half-packed duffel. Through Thermal, it shows the room is cold -- life support failed here first. Through EM/Signal, it shows the last message sent from the terminal: "Tell my family I tried."

This turns the game from a linear checklist into a detective game. The player must choose which sensor to equip (you only have one slot per `src/shared/types.ts` line 68, `Partial<Record<AttachmentSlot, Attachment>>`), which means choosing which layer of reality to perceive. You cannot see everything at once. You must decide what to look for.

This is the game's equivalent of Brogue's "depth vs. safety" tension, Cogmind's "build identity through parts," or Caves of Qud's "every run tells a different story." The constraint IS the gameplay. The sensor you equip determines what you understand about what happened here. Different sensor paths through the same station reveal different pieces of the mystery. Suddenly there is a reason to replay: you only got the thermal story last time. What does the EM story tell you?

The tagline writes itself: "You can only see what you're looking for."

---

## 4. QUICK WINS (< 30 lines each)

### 4.1 Make Smoke Block Vision (Actual Gameplay Consequence)

**File**: `src/render/display.ts`, around line 253

Currently smoke is purely cosmetic. If tiles with smoke > 50 hide entity glyphs behind them, smoke becomes a real obstacle -- you cannot see the relay through the smoke, you have to move closer or clean first. This gives the Clean action a purpose and creates tension near relay rooms.

**Change**: In the render loop (lines 245-288), after the smoke rendering block, skip drawing entity glyphs on tiles where smoke > 50 unless the player is on that tile or adjacent to it. Approximately 8 lines of logic: check the Manhattan distance from the player to the entity position, and if smoke on that tile exceeds 50 and the distance is > 1, render the smoke glyph instead of the entity glyph.

### 4.2 Show a Persistent "Location" Header Above the Map

**File**: `src/render/display.ts`, method `render()`

The room name flashes for 2 seconds and disappears. Instead, always render the current room name at row 0 of the display in a distinct color. This gives the player spatial grounding at all times.

**Change**: In `render()` (line 230), after drawing the map, always call `this.renderCenteredText()` with the current room name at y=0 if the player is in a room. Remove the timeout-based flash system. Roughly 10 lines replacing the current `roomFlashMessage` approach with a persistent label derived from `getPlayerRoom(state)`.

### 4.3 Add an Unread Log Indicator to the Status Bar

**File**: `src/render/display.ts`, method `renderUI()`

When the player finds a log terminal, there is no visual indicator that new narrative content is available. Adding a simple "[3 UNREAD]" counter next to the turn display creates a pull toward the log panel and makes discoveries feel like they matter.

**Change**: In `renderUI()` (line 387), count `state.logs.filter(l => !l.read).length`, and if > 0, append a styled span like `<span class="unread-indicator">[N UNREAD]</span>` to the status bar HTML. Add a CSS class in `src/index.html`. Approximately 6 lines of code plus 2 lines of CSS.

### 4.4 Add Movement Cost in Hot Zones (Slow the Player Down)

**File**: `src/sim/step.ts`, in the `ActionType.Move` case (line 303)

Right now moving through a hot tile is free -- the only cost is the passive HP drain. If moving into a tile with heat >= 60 costs an extra turn (the step function advances the turn counter by 2 instead of 1, triggering an extra hazard tick), hot zones become genuinely dangerous to traverse. The player must plan a path AROUND heat or accept the time cost.

**Change**: After computing `newPos` (line 308), check if `state.tiles[newPos.y][newPos.x].heat >= 60`. If so, set `next.turn = state.turn + 2` instead of `state.turn + 1`, and run `tickHazards` twice. Approximately 8 lines of code.

### 4.5 Add a Boot-Up Flavor Line Per Turn When Idle

**File**: `src/browser.ts`, in the `handleAction` function, the `ActionType.Wait` case (line 171)

Currently waiting just says "Holding position. Systems nominal." This is a missed opportunity. Replace it with a random draw from a pool of 8-10 atmospheric one-liners that make the station feel alive even when nothing is happening. Examples: "A distant clang echoes through the hull plating.", "Coolant pipes tick rhythmically somewhere overhead.", "The emergency beacon pulses. No response."

**Change**: Define a `const IDLE_LINES: string[]` array of 8-10 strings in `src/browser.ts` (or a new small data file). In the Wait handler, replace the static string with `IDLE_LINES[state.turn % IDLE_LINES.length]`. Approximately 15 lines total.

---

## 5. NARRATIVE CRITIQUE

### What's Compelling

The CORVUS-7 incident is a believable, contained disaster story. It follows a classic accident investigation structure: warning signs ignored (Vasquez's maintenance requests), cascading failure (coolant loop B -> relay P03 -> door D17 -> comms loss), and human decisions that made it worse (Okafor dismissing Vasquez's concerns). The fact that the player is cleaning up after a preventable disaster gives the whole thing a melancholy weight that most roguelikes lack.

Vasquez is a real character. Her arc across four log entries (LOG_CREW_001, LOG_SYS_007/Vasquez at D17, LOG_CREW_004/Priya mentioning her, LOG_CREW_005/her final note) is the spine of the narrative and it works. She warned them. Nobody listened. She tried to fix it anyway.

### What's Missing

**The crew are names, not people.** Okafor, Chen, and Priya each get one log entry. We know Okafor dismissed the warnings, Chen smelled something burnt, and Priya powered down the bots. But we do not know anything about their relationships, their fears, what they were working on, or what they lost. The station had twelve crew members (`src/data/lore.ts` line 19: "Its crew of twelve") but we only hear from four. The other eight are ghosts with no names.

**There is no ambiguity.** The story is completely resolved by Vasquez's final note (LOG_CREW_005): coolant loop B failed, P03 overheated, doors sealed, crew evacuated. The player is never left wondering "what really happened?" because the answer is spelled out. Compare this to Return of the Obra Dinn, where every scene raises more questions than it answers. The mystery should have layers: what was the "classified signal analysis work" mentioned in the opening crawl? Why was maintenance request #47 still in the queue? Was the coolant failure really accidental?

**The ending is perfunctory.** The victory text (`src/data/endgame.ts` lines 12-20) is three lines. The player transmits the data core and gets "The crew's work survives." But we never learn what the research was. We never learn if the crew survived their evacuation. The defeat text (lines 26-32) is similarly brief. For a narrative-forward game, the ending should be the payoff for everything the player discovered. At minimum, the ending should reference which logs the player found and what they revealed.

### What Would Make the Player Care

Give each crew member one personal item visible on the map -- not a log terminal, but an object. A coffee mug with a name on it. A photograph taped to a console. A child's drawing pinned to a bunk. These do not need to be interactive; they just need to be *noticed*. The room descriptions in `src/data/roomDescriptions.ts` gesture at this ("A half-packed duffel bag lies open on one bed" in Crew Quarters, line 44) but these details are buried in the log scroll. Put them on the map. Make them glyphs. Let the player walk past a dead crew member's last trace and feel something.

---

## 6. UX CRITIQUE

### What's Confusing for a First-Time Player

**The interaction radius is invisible.** The game auto-targets the nearest interactable entity within Manhattan distance 1 (`src/sim/step.ts` lines 30-48), but the player has no way to know this. The interaction hint in the status bar (`src/render/display.ts` line 407) only appears when you are already adjacent. A player who walks to a relay and presses 'i' from two tiles away will get no feedback -- the action silently fails because `handleInteract` returns the state unchanged when no interactable is found (line 58). There should be a "Nothing to interact with here" message.

**The thermal scan toggle vs. action is confusing.** Pressing 's' does two things simultaneously: it sends a Scan action to the sim (which marks relay hotspots in `src/sim/step.ts` lines 264-272) AND toggles the thermal overlay in the renderer (`src/browser.ts` line 207). But the overlay is a UI toggle that persists, while the scan action is a one-time event. The player will toggle thermal on, see the heat, toggle it off, and never realize the scan action did anything separate from the visual toggle.

**The glyph legend is too dense.** The info bar (`src/render/display.ts` lines 428-448) shows 10 legend items and 4 control bindings on a single line. On a smaller screen, this wraps and becomes unreadable. More importantly, the legend shows everything at once, including entities the player has not encountered yet (Data Core, Service Bot). This removes discovery and adds cognitive load.

### What Information Is Missing

- **No distance indicator.** The player cannot tell how far away the next objective is. Even a simple "Relay P01: ~15 tiles NE" in the objective panel would help.
- **No visited room tracking on the map.** There is a `visitedRoomIds` set in `src/browser.ts` (line 82) but it is only used to prevent duplicate room descriptions. It should visually dim or mark rooms the player has already explored.
- **No HP recovery mechanic is explained.** The service bot provides recovery on death (`src/sim/objectives.ts` lines 24-66), but this is never communicated to the player. They discover it only if they die, and even then the log message ("Player bot destroyed. Transferring control to service bot.") does not explain what happened or that it was a one-time save.

### What's Shown But Shouldn't Be

- **The seed number in the URL.** Unless the player is a developer or speedrunner, `?seed=184201` in the address bar is noise. This is minor but contributes to a "dev build" feel.
- **System log timestamps in the in-game turn counter format.** The log entries in `logs.json` have ISO timestamps ("2187-03-14T06:00:00Z") but the game's `LogEntry.timestamp` field (`src/shared/types.ts` line 124) stores the turn number when the log was discovered, not its in-universe time. The in-universe timestamps appear in the log text itself, which is correct, but the display does not differentiate "things that happened to you" (system messages) from "things you found" (crew logs). These should be visually distinct.

---

## 7. THE PITCH

**Old pitch** (from lore.ts): "A silent station. A fragile link. One bot."

This is evocative but it describes the setting, not the experience.

**New pitch**:

A research station went silent fourteen hours ago. You are remotely piloting the only thing that answered the distress call -- a janitor bot with a cleanliness sensor and no idea what happened. Swap sensor modules to peel back layers of the disaster, piece together the crew's final hours from terminal logs and environmental evidence, and navigate spreading hazards to transmit the research data before the station's failing systems make it impossible. Every sensor shows you a different truth. You can never see the whole picture at once.

**Two-sentence version**:

You are remotely operating a janitor bot through a dying space station, swapping sensors to see different layers of a disaster you are trying to survive and understand. Every tool reveals part of the truth, but you can only equip one at a time -- and the station is getting worse.
