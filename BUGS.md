# BUGS.md — QA Bug Tracker

## BUG-001: room-transition-fade relies solely on requestAnimationFrame — breaks when tab is hidden
- **Severity**: HIGH (visual)
- **Status**: FIXED (Sprint 174, V344-V348)
- **Fix**: Added CSS `transition: opacity 0.5s ease-out` to fade overlay + setTimeout fallbacks at 500-600ms. Fade overlay cleared in `destroy()` and `showTitleScreen()`.

## BUG-002: Subtitle message queue requires excessive dismissals
- **Severity**: MEDIUM (UX)
- **Status**: FIXED (Sprint 174, V344-V348) — Superseded by BUG-008 fix.

## BUG-003: Room cleaned in single action from 59%
- **Severity**: LOW (balance)
- **Status**: FIXED (Sprint 175, V349-V352)
- **Fix**: Reduced per-clean dirt removal from 25-35 center/15-20 surrounding to 12-17 center/6-9 surrounding. Now requires 2-3 clean actions.

## BUG-004: 3D scene shown before models finish loading — placeholder geometry visible
- **Severity**: HIGH (visual)
- **Status**: FIXED (Sprint 174, V344-V348)
- **Fix**: Added full-screen loading overlay with progress bar ("LOADING STATION DATA") that covers the 3D scene until all models are loaded, then fades out.

## BUG-005: Hazard border persists across title screen after returning from gameplay
- **Severity**: LOW (visual)
- **Status**: FIXED (Sprint 174, V344-V348)
- **Fix**: Hazard border and fade overlay cleared in both `destroy()` method and `showTitleScreen()`.

## BUG-006: "ROOM CLEANED" banner shows at T:0 on new game start
- **Severity**: MEDIUM (UX/logic)
- **Status**: FIXED (Sprint 174, V344-V348)
- **Fix**: Added guard `state.turn < 1` in `updateTutorialObjective()` to prevent cleaning objective from completing before player acts.

## BUG-007: Sensor pickup creates massive blue sphere that obscures the entire view
- **Severity**: HIGH (visual)
- **Status**: MITIGATED (Sprint 175, V349-V352) — needs visual verification
- **Fix**: Reduced scan wave ring expansion from 16x to 9x max, secondary from 13x to 7x, duration from 1.5s to 1.0s. Could not definitively identify the exact "blue sphere" geometry — may also be related to subtitle messages blocking view while the scan wave plays.

## BUG-008: Subtitle queue blocks ALL input including movement — 10+ messages at game start
- **Severity**: HIGH (UX)
- **Status**: FIXED (Sprint 174 + Sprint 175)
- **Fix (Sprint 174)**: Subtitle system overhauled — system/sensor/warning messages auto-dismiss after 3-4s, queue capped at 5, Space key passes through to game input.
- **Fix (Sprint 175)**: Deferred all CORVUS-7 narrative/lore messages until player takes first action. Only "LINK ACTIVE" intro shown at T:0.

---

## NEW BUGS — QA Session 2 (Mystery Mechanics Playthrough)

## BUG-009: "NEW GOAL DISCOVERED" notification never auto-dismisses
- **Severity**: HIGH (UX)
- **Location**: `#hud-notification` element, `position: fixed`, `display: block`
- **Steps**: Collect evidence that triggers a new goal (e.g., find crew member → "Identify the Crew" goal unlocked)
- **Expected**: Notification should auto-dismiss after 3-5 seconds, or dismiss on any keypress
- **Actual**: The "NEW GOAL DISCOVERED / Identify the Crew / Press [G] to view Mission Goals" popup stays on screen permanently. It covers ~15% of the viewport and overlaps with other HUD elements. It persisted for 30+ turns of gameplay, through map overlay, investigation hub, pause menu, and room transitions. Pressing G opens goals but the notification returns after closing.
- **Impact**: Blocks visibility of the game world. Overlaps with room labels and HUD elements. Cannot be dismissed. Makes the game feel broken.
- **Fix suggestion**: Add a setTimeout to auto-hide after 5s, or dismiss on any game input, or track "seen" state and never re-show.

## BUG-010: Sensor "Nearby" subtitle notifications are excessive, repetitive, and block gameplay
- **Severity**: P0 — CRITICAL (UX — game-breaking)
- **Location**: Subtitle bar / sensor system
- **Steps**: Enter any room with multiple entities (e.g., Cargo Hold with terminal, crew, evidence, crew items)
- **Expected**: Sensor readout should be silent or shown in the HUD scanner panel. Player should be able to move freely.
- **Actual**: Every few steps, a SENSOR subtitle fires: "Nearby: [i] Read Terminal", "Nearby: [i] Life Signs | [i] Evidence", "Nearby: [i] Examine", etc. These subtitles:
  1. Block all movement until dismissed with Space/Esc
  2. Re-trigger when you move even one tile
  3. Repeat the SAME messages you've already seen
  4. Stack up 5-8 messages when you first enter a room (room description, clue descriptions, nearby sensors, evacuation flavor text — all queued)
  5. Loop endlessly — dismissing all messages, moving one tile, triggers the same "Nearby" messages again
- **Impact**: THE #1 pacing killer in the game. You spend more time pressing Space to dismiss sensor messages than actually playing. Movement feels impossible in entity-dense rooms. The game becomes a "press Space, press Space, press Space" loop.

### ACTION REQUIRED: Eliminate all low-value subtitles that duplicate existing UI

The following subtitle types **MUST be removed** because they already have alternate UI representations and add zero value while blocking all input:

| Subtitle text | Already shown in... | Action |
|---|---|---|
| `"Nearby: [i] Examine \| [i] Security Terminal"` | **Action bar** already shows `▸ [Enter] Security Terminal` | **DELETE** |
| `"6 objects to investigate."` | **Action bar** lists all interactables (Terminal, Crew Item, Breach, Security, Crew, Evidence, Console) | **DELETE** |
| `"You detect: Crew Item, Security Terminal, Life Signs Detected, Hull Breach, Evidence Trace, Console"` | **Action bar** + **Scanner bar** already show all of this | **DELETE** |
| `"Nearby: [i] Read Terminal"` | **Action bar** shows `[Enter] Log Terminal` | **DELETE** |
| `"Nearby: [i] Life Signs \| [i] Evidence"` | **Action bar** shows `@Crew` and `?Evidence` | **DELETE** |
| `"CORVUS-7: Sensor sweep detects upgrade modules aboard the station..."` | Could go in Investigation Hub evidence log instead | **DELETE or move to non-blocking UI** |
| Evacuation route flavor text | Not in any UI, but not worth blocking input for | **DELETE or make non-blocking** |

**Rule of thumb**: If information is already visible in the action bar, scanner bar, or HUD, it should NEVER appear as a blocking subtitle. Subtitles should be reserved ONLY for unique narrative content (station logs, crew discoveries, deduction results) that has no other representation in the UI.

## BUG-011: Crew NPC models are placeholder blue shapes — no character models loaded
- **Severity**: MEDIUM (visual)
- **Location**: Crew NPC entity rendering in display3d.ts
- **Steps**: Navigate to a crew member (blue @ icon on minimap) in any room
- **Expected**: A humanoid character model (Synty character from `public/models/Characters/`) rendered in a recognizable pose (standing, slumped, in cryo-stasis, etc.)
- **Actual**: Crew NPCs render as a simple **blue sphere on a blue rectangle** — clearly placeholder primitive geometry. The blue silhouette is about 2 units tall. No arms, no legs, no face, no clothing details. When you interact with them, you get great narrative text ("Discovered Sana Ortiz alive in Cargo Hold. Currently in cryo-stasis.") but visually there's nothing to distinguish one crew member from another.
- **Impact**: Undermines the mystery/identification gameplay. In Obra Dinn, seeing the crew members is ESSENTIAL to identifying them. Here, every crew member looks identical — a blue blob. The rich crew dossiers (personality, habits, contradictions) have no visual anchor.
- **Fix suggestion**: Load Synty character models for crew NPCs. Different poses based on status (alive/cryo-stasis, dead, barricaded, etc.). Even simple color/uniform variation would help.

## BUG-012: Sensor scan wave (BUG-007) still too large — obscures gameplay for ~20 seconds
- **Severity**: HIGH (visual)
- **Status**: BUG-007 was marked "MITIGATED" but the blue sphere is still very large
- **Steps**: Start new game, pick up sensor upgrade in Arrival Bay
- **Actual**: A large semi-transparent blue sphere appears centered on Sweepo. While smaller than the original report, it still covers roughly 40-50% of the viewport. It takes approximately 20 seconds to fully fade/shrink away. During this time, entities, walls, and doors behind it are partially obscured.
- **Fix suggestion**: Either (a) reduce the sphere to max 2x Sweepo's radius, (b) make it fully transparent after 2 seconds, or (c) replace with a brief expanding ring effect (1 second) instead of a persistent sphere.

## BUG-013: No way to cycle interaction target — nearest entity always selected
- **Severity**: MEDIUM (UX — confusing/frustrating)
- **Location**: `display3d.ts:9970-9991` (interactionTargetId auto-selects nearest)
- **Steps**: Stand in a room with multiple entities (terminal, crew item, crew NPC, evidence). Try to interact with a specific entity that isn't the closest one.
- **Expected**: Some way to cycle targets (Tab, brackets, or similar) so you can choose which entity to interact with
- **Actual**: The game always auto-targets the nearest entity. The action bar shows "[Enter] Crew Item (examined)" and there's no way to switch to the Terminal or Evidence Trace without physically moving closer to it than to any other entity. In entity-dense rooms, this means tedious trial-and-error movement trying to get adjacent to the right target.
- **Impact**: Makes terminal interaction nearly impossible in rooms where crew items/crew NPCs are clustered nearby. I spent 20+ turns trying to reach a terminal in Cargo Hold and couldn't get the target to switch from "Crew Item" to "Terminal" despite multiple approach angles.
- **Fix suggestion**: Add target cycling with Tab or [ / ] keys. Show all interactable entities in the action bar and let the player select which one to interact with.

## BUG-014: Mandatory room cleaning gates exploration — interrupts investigation flow
- **Severity**: MEDIUM (not fun)
- **Location**: Room exit check (MAINTENANCE objective)
- **Steps**: Enter a new room and try to leave to continue exploring
- **Expected**: Can freely explore the station to collect evidence and solve the mystery
- **Actual**: "Clean the station (0/1 rooms)" objective requires cleaning to 80% before you can leave. The HUD constantly shows "[MAINTENANCE] Clean the station" and "[CLEANLINESS]" mode. You must press C multiple times to clean, which consumes turns, before you can exit the room.
- **Impact**: The cleaning mechanic feels like busywork that interrupts the much more interesting investigation/mystery gameplay. After the deduction system showed me "What happened? → Crew mutiny!" I was excited to explore more rooms and find terminal logs — but first I have to spend 5+ turns pressing C to clean the floor. The pacing disconnect between "solve a thrilling space station mystery" and "mop the floors" is jarring. It's not fun — it's a chore gate between the fun parts.
- **Note**: The cleaning mechanic IS thematic (Sweepo is a cleaning bot), but it should be optional or much faster. One C press should be enough, or cleaning should happen passively while moving.

## BUG-015: Scanner cycling through individual sensor types is confusing — should be one unified SCAN
- **Severity**: MEDIUM (UX design — confusing)
- **Location**: Scanner system / sensor overlay cycling (Q/T key, Tab key)
- **Current behavior**: Pressing Q/T cycles through individual sensor modes: CLEANLINESS, THERMAL, ATMOSPHERIC, RADIATION, STRUCTURAL, EM/SIGNAL. Each mode shows different overlay data. The player must manually cycle to the "right" sensor to see relevant information. Tab also cycles sensor overlays.
- **Problem**:
  1. The cycling mechanic is confusing — new players don't know which sensor to use when
  2. It adds friction to the core gameplay loop (scan room → find clues) for no benefit
  3. Most players will just mash Q repeatedly to cycle through all modes, which defeats the purpose of having separate modes
  4. The HUD shows "[CLEANLINESS]" mode by default, which is the least interesting sensor for mystery gameplay
  5. The key overlap between Q (scan) and T (also scan) and Tab (also scan overlay) is confusing — three keys for related but different scan functions
- **Proposed redesign**: One **[Q] SCAN** button that uses ALL available sensors simultaneously. Results show everything detected (cleanliness, life signs, evidence, hazards) in a single readout. Individual sensor overlays could optionally exist as a visual filter (press Tab to cycle overlay visualization) but the SCAN action itself should always use all sensors at once. This matches the fantasy — Sweepo has upgraded sensors, they should all fire together.
- **Impact**: Simplifies the input model, reduces confusion, makes the scan action feel powerful and informative every time.

## BUG-016: Interaction prompt "[Enter] X" shown for non-adjacent entities — false affordance
- **Severity**: HIGH (UX — misleading)
- **Location**: `display3d.ts` interaction target detection vs `step.ts:84-103` `getInteractableEntities()`
- **Steps**: Enter a room with a Security Terminal. Walk within ~3 tiles. The HUD shows `▸ [Enter] Security Terminal`. Press Enter/i/e.
- **Expected**: Interaction opens the terminal (since the HUD says you can)
- **Actual**: The turn is consumed but NOTHING happens. The HUD prompt says "[Enter] Security Terminal" but the sim only allows interaction with entities at **cardinal adjacency (1 tile)**. The display layer (`display3d.ts:9970-9991`) detects targets from a wider radius, creating a false interaction affordance. The player presses Enter 5-10 times thinking the key is broken, losing turns and HP (in hazard zones) for nothing.
- **Root cause**: `display3d.ts` uses distance-based detection for the interaction prompt (selects nearest visible entity), but `step.ts:getInteractableEntities()` only checks 5 tiles (same + cardinal adjacent). These radii don't match.
- **Impact**: Spent 10+ turns pressing Enter at the Security Terminal prompt, losing ~80 HP from breach damage, with no interaction. The HUD literally told me to press Enter. This makes the player feel like the game is broken.
- **Fix suggestion**: Either (a) only show "[Enter] X" when the entity is within interaction range (cardinal adjacent), or (b) expand the sim's interaction range to match the display's detection range, or (c) show distance feedback like "[Enter] Security Terminal (2 tiles away — move closer)".

---

## Summary — Priority Fix Order (Session 2)

### P0 — Game-breaking UX
1. **BUG-010**: Remove "Nearby" sensor subtitles entirely — they make the game unplayable in entity-dense rooms
2. **BUG-009**: "NEW GOAL DISCOVERED" notification never dismisses — covers viewport permanently

### P1 — Significant impact
3. **BUG-016**: "[Enter] Security Terminal" prompt shown for non-adjacent entities — wasted 10+ turns pressing Enter
4. **BUG-013**: No target cycling — can't interact with terminals when other entities are closer
5. **BUG-011**: Crew NPCs are featureless blue blobs — undermines the core mystery mechanic
6. **BUG-012**: Sensor scan wave still too large (BUG-007 follow-up)
7. **BUG-015**: Scanner cycling confusing — unify into single SCAN action

### P2 — Polish / Design
7. **BUG-014**: Mandatory cleaning gates exploration — interrupts investigation pacing

---

## Mystery Mechanics Assessment (QA Session 2)

### What Works BRILLIANTLY

- **Deduction chain (WHAT → WHERE → WHY → WHO → BLAME)**: This is the crown jewel. Five sequential deductions that unlock progressively, each requiring specific evidence types. The WHAT deduction ("What happened aboard CORVUS-7?") presented 4 plausible answers, with the evidence clearly pointing to the correct one. Answering correctly feels earned and satisfying.

- **Evidence synthesis**: The deduction screen shows "WHAT THE EVIDENCE SUGGESTS" — a narrative synthesis of collected clues that guides the player toward the answer without giving it away. This is smart design that makes the player feel like a detective, not just a multiple-choice test-taker.

- **Deduction stakes**: Wrong answers cost 3 HP and 10 turns, with only 2 attempts. This prevents guess-spamming and makes each deduction feel meaningful. You want to collect more evidence before committing.

- **Investigation Hub**: All 5 tabs are well-designed:
  - **Evidence**: Filterable by room/type/unread, with detail panel showing relevance tags ("Relevant to: WHAT (1/1), WHY (1/2)")
  - **Scenes**: 8 room scenes with clue counts, sensor-gated clues, incident phase mapping
  - **Connections**: Case progress bar (WHAT→WHERE→WHY→WHO→BLAME at 20%), deduction queue
  - **Crew**: 10 dossiers with rich personal details (wants, habits, contradictions, personality, relationships)
  - **Analysis**: Running case summary, incident timeline, evidence balance, conclusions reached

- **Dynamic case file**: After solving WHAT ("crew mutiny"), the Analysis tab names the case "THE MUTINY" — the game adapts its narrative framing based on your deductions.

- **Evidence writing quality**: Every evidence card has atmospheric, evocative text. "Half-eaten, fork still stuck in it. Turkey and rice variant. The timestamp on the wrapper: 14:58, fifteen minutes before everything went wrong." This is excellent mystery writing.

- **Crew dossiers**: Each crew member has: wants, habits, contradictions, personality, last known location, and relationships (with specific connection types like "blackmail", "romantic"). The contradictions are particularly good — "filed three safety complaints nobody listened to, then stopped filing" — creating suspicion and empathy simultaneously.

- **Sensor-gated clues**: Some scene clues require specific sensors (atmospheric, thermal) to access. This creates a meaningful progression loop: explore → find sensor upgrades → revisit rooms to access locked clues.

- **Investigation rewards**: Solving a deduction gives tangible gameplay rewards ("Reveals the location of an unexplored room on the map") that feed back into exploration.

### What Needs Work

- **Pacing is destroyed by subtitle spam (BUG-010)**: The excellent mystery content is buried under an avalanche of sensor notifications. For every 1 piece of interesting evidence, you dismiss 8-10 "Nearby" sensor messages. The ratio of interesting content to noise is terrible. These subtitles duplicate information already visible in the action bar and scanner — they must be eliminated entirely (see BUG-010 elimination table).

- **Interaction prompts are misleading (BUG-016)**: The HUD shows "[Enter] Security Terminal" from 3+ tiles away, but the sim only allows interaction at cardinal adjacency (1 tile). I spent 10+ turns pressing Enter at the prompt, losing ~80 HP from breach damage, with no response. The game literally told me to press Enter and it didn't work. The display detection radius and sim interaction radius MUST match.

- **Terminal interaction target conflicts (BUG-013)**: Even when adjacent, the nearest-entity auto-targeting often selects an already-examined crew item instead of the terminal you want. No way to cycle targets.

- **Crew NPCs have no visual identity (BUG-011)**: The blue placeholder shapes make crew identification purely text-based. In a game inspired by Obra Dinn (where visual identification is THE core mechanic), having featureless blue blobs defeats the purpose.

- **Cleaning interrupts investigation (BUG-014)**: Being forced to clean before leaving a room creates a tedious gate between mystery content. The player's motivation after a deduction is "I need to find more evidence!" not "I need to mop the floor."

- **Goal notification permanently covering the viewport (BUG-009)**: "NEW GOAL DISCOVERED: Identify the Crew" persisted for 60+ turns across every overlay and room transition. Cannot be dismissed.

- **Hazard zones drain HP with no clear mitigation**: The Power Relay Junction has a hull breach that costs ~8 HP/turn. Combined with BUG-016 (can't interact with nearby terminal) and BUG-010 (subtitle spam consuming turns), the player hemorrhages HP for zero progress. I lost 70+ HP in that room accomplishing nothing except picking up a crew item.

### Mystery Solvability Assessment (Extended Playthrough: T:0 → T:131)

**Can the mystery be solved? YES — in theory.** The design is sound:
- 5 deductions (WHAT→WHERE→WHY→WHO→BLAME) with specific clue-type gates
- Evidence is procedurally distributed across 28 rooms with 8 scene locations
- Sensor-gated clues create meaningful progression (find sensors → revisit rooms)
- Crew connections are tracked with relationship types (Close to, Compromised by)
- The Analysis tab dynamically synthesizes findings into a coherent narrative

**In practice? Currently NO — the UX blocks prevent meaningful progress:**
- In 131 turns, I visited 3/28 rooms and solved 1/5 deductions
- ~40% of turns were spent cleaning, dismissing subtitles, or pressing interact on non-adjacent targets
- The WHERE deduction requires a "timeline trigger" clue — I need to read terminals in other rooms, but interaction bugs make this extremely difficult
- At ~8 HP/turn in hazard rooms + wasted turns from BUG-016, the player will die before exploring enough rooms
- Navigation through entity-dense rooms is painfully slow due to subtitle interruptions

**Estimated solvability after P0/P1 bug fixes:** Very high. If subtitles are eliminated, interaction prompts match sim range, and target cycling is added, a skilled player could solve the full mystery in ~300-400 turns across 15-20 rooms. The evidence distribution, deduction gating, and crew relationship web are all well-designed for this.

### Overall Verdict

The mystery mechanics are **genuinely excellent in design** — the deduction chain, evidence synthesis, crew dossiers, investigation hub, dynamic case naming ("THE MUTINY"), incident timeline (BEFORE→TRIGGER→ESCALATION→COLLAPSE→AFTERMATH), and relationship web are some of the best mystery game mechanics I've seen in a roguelike. The writing quality is high, the progression system is well-thought-out, and the Obra Dinn inspiration is executed thoughtfully.

However, the **player experience is currently blocked by 4 critical bugs** that make the game feel broken rather than challenging:
1. **BUG-010** — Subtitle spam blocks all input, duplicates existing UI
2. **BUG-016** — Interaction prompts shown for non-adjacent entities (false affordance)
3. **BUG-009** — Goal notification covers viewport permanently
4. **BUG-013** — Can't cycle interaction targets

**Fix priority**: BUG-010 + BUG-016 together would transform the game from unplayable to compelling. BUG-013 would make it genuinely fun. All three are code-level fixes (not content/asset changes) and should be achievable in a single sprint.

---

## What Works Well (QA Observations — Sessions 1 & 2)

- **3D scene rendering**: Once models load, the station looks great — floor grids, wall panels, door frames, ceiling beams, lighting all render correctly. The cel-shaded aesthetic is cohesive.
- **Chase camera**: Smooth, responsive, follows Sweepo well. Tank controls (turn + move) feel natural.
- **Sweepo model**: Charming little robot, well-proportioned, good animations (eye widen on interaction).
- **HUD system**: Health bar, turn counter, room name, seed display, scanner readout, action bar — all functional and readable. Minimap + compass in top right work well.
- **Investigation Hub**: Excellently designed — 5 tabs (Evidence, Scenes, Connections, Crew, Analysis) with rich structured data. Navigable with keyboard. Number keys switch tabs smoothly.
- **Mission Goals overlay**: Clean design with 4 tracked goals, task progress, descriptions.
- **Map overlay**: Works, shows explored rooms with labels and player position.
- **Entity interactions**: Green diamonds for pickups, blue glow for interactables, evidence traces — the visual language is clear.
- **Narrative text**: Evidence cards, deduction summaries, and crew dossiers are well-written with atmosphere.
- **Deduction system**: The WHAT→WHERE→WHY→WHO→BLAME chain with stakes (HP/turn cost for wrong answers) is brilliant game design.
- **No console errors**: Clean runtime — no JS errors, no rendering warnings during gameplay.
- **Autosave**: "SAVED" indicator appears reliably.

---

## QA Setup Notes

### What works: Claude in Chrome (visible browser tab)
The correct way to QA this game with Claude Code is to use the **Claude in Chrome MCP tools** (not the `preview_*` tools):

1. Make sure the dev server is running: `npm run dev` (or `preview_start` with a `dev` entry in `.claude/launch.json`)
2. Use `mcp__Claude_in_Chrome__tabs_context_mcp` with `createIfEmpty: true` to get a visible Chrome tab
3. Navigate to `http://localhost:5173/ssr/` with `mcp__Claude_in_Chrome__navigate`
4. Use `mcp__Claude_in_Chrome__computer` for screenshots and input (clicks, keypresses)
5. Use `mcp__Claude_in_Chrome__javascript_tool` for DOM inspection

### What does NOT work: preview_screenshot
The `preview_*` tools run in a headless/hidden tab where `document.hidden === true`. This means:
- `requestAnimationFrame` never fires — the Three.js render loop is completely suspended
- The 3D scene never renders (canvas stays blank)
- All rAF-driven effects (fade overlays, camera animations, particle effects) never update
- `preview_screenshot` causes Claude Code to lock up / hang indefinitely (likely because the renderer never produces a frame)
- `preview_snapshot` and `preview_eval` still work for DOM text inspection, but you can't see the 3D game

**Bottom line**: Always use Claude in Chrome for visual QA of this game.

---
*Last updated: 2026-02-23 (Session 2+3 — Mystery Mechanics QA + Extended Playthrough T:0→T:131)*
