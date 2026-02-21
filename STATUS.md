# SSR — Project Status

*Last updated: 2026-02-20*

## Current State

- **Phase**: Sprint 65 complete (Cross-System Reveals, Attachment UI, Evacuation Climax)
- **Test status**: 290 tests passing across 24 test files (0 failing)
- **Build**: TypeScript strict mode, tsc clean
- **Archetype selection**: Seed-based (`seed % 5`), all 5 archetypes reachable
- **Archetypes**: 5 active (ContainmentBreach removed — rated C+ by all reviewers)
- **Save key**: v7
- **Difficulty**: Easy / Normal / Hard — URL param `?difficulty=easy|hard`
- **Turn limit**: Difficulty-scaled (Easy: 1300, Normal: 1000, Hard: 700) with proportional warnings at 70%/80%/90%
- **Victory condition**: Crew evacuation (primary) or data core transmit (bittersweet fallback)
- **Playtest results**: 5 seeds all VICTORY — 42(189T), 99(184T), 184201(272T), 7777(182T), 12345(225T)

## What Works

- Core game loop: explore -> evidence -> puzzles -> evacuate crew
- 7 player actions (Move, Interact, Scan, Clean, Wait, Look, Journal, SubmitDeduction)
- 25 entity types with distinct interactions (including Airlock)
- 3-sensor ladder (Cleanliness, Thermal, Atmospheric)
- Heat/smoke + pressure/breach hazard systems with spreading
- Fire system with slow spread and low-pressure suppression
- Airlock system: toggleable entities that vent atmosphere
- Procedural crew generation (8-12 crew, relationships, secrets, fates)
- 183+ narrative elements (63 log templates, 16 authored logs, 16 crew items, 8 new corridors)
- Ship computer PA announcements (periodic atmospheric messages)
- **5 incident archetypes** with distinct human stories and 5-phase timelines:
  - CoolantCascade — "The Whistleblower" (B-)
  - HullBreach — "The Murder" (A-)
  - ReactorScram — "The Rogue AI" (A)
  - Sabotage — "The Stowaway" (B+)
  - SignalAnomaly — "First Contact" (A)
- 5-6 chained deductions with evidence linking, per-deduction hint text, and revelation cascade
- **Revelation system**: linking evidence yields narrative sentences explaining HOW clues illuminate questions
  - Tag-specific revelations appear in a Revelation Board as evidence is linked
  - Gold synthesis paragraph crystallizes "what must be true" when all evidence is assembled
  - Post-answer narrative overlay (correct: revelation + reward + next unlock, incorrect: inconclusive)
  - ~100 authored revelation/synthesis/conclusion strings across 5 archetypes x 5-6 deduction tiers
- Narrative threads grouping evidence
- **Investigation Hub [r/v]**: unified 3-section overlay replacing old Evidence Browser + Broadcast Report
  - EVIDENCE: two-panel layout (entry list + full detail with crew relationships, minimap, tags, thread)
  - CONNECTIONS: **split-pane deduction detail** with evidence list (left 40%) + full evidence text (right 60%)
    - Dual-focus navigation: Tab switches between evidence linking and answer selection
    - Revelation Board: accumulated narrative sentences as evidence is linked
    - Synthesis block (gold): appears when all required tags covered
    - Linked evidence persists when navigating away
  - WHAT WE KNOW: auto-generated narrative prose summarizing investigation progress
- Crew relationships displayed in evidence detail and connection linking views
- Evidence minimap: proportional ASCII room map showing where evidence was found
- Developer mode (?dev=1 or F5): clue graph annotations, full tag requirements, correct answers
- ROT.js browser rendering with viewport scrolling
- Harness CLI for AI playtesting (with deduction support)
- Heuristic playtest bot (playtest_bot.ts)
- Mystery choices: 3 narrative decisions with spoiler protection
- Procedural sound effects: 12 Web Audio SFX + 5 archetype ambient soundscapes
- Game-over overlay: performance rating (S/A/B/C/D), stats summary, mystery choices recap, incident timeline reconstruction, crew manifest, replay hints
- Difficulty system: Easy/Normal/Hard with URL param, adjusting HP, turn limit, damage, deterioration
- New Game [N] / Replay [R]: random seed generation for replayability, game-over shows both options
- Objective compass: sensor-gated directional hints (Thermal → relays, Atmospheric → crew/breaches)
- Smoke hazard: movement slow (>40 smoke), toxic fume damage (>60 smoke), Clean action clears 3x3 area
- Context-sensitive action bar: shows available actions with key bindings, grays out unavailable actions
- Run history: localStorage-persisted records of previous runs (seed, archetype, difficulty, rating)
- Ghost echoes: scan-triggered crew traces in rooms where crew members were last known (thermal sensor required)
- Crew questioning: following crew NPCs give one-time archetype-specific testimony when re-interacted with
- Per-archetype Arrival Bay traces: each archetype shows unique atmosphere text on entering the first room
- Tutorial hints: context-sensitive tips at early turns and on first-time events
- Evacuation phase: RED ALERT banner, crew following, escape pod boarding with full audio
- Help overlay: HTML modal with complete key bindings, game phases, interaction details
- Incident summary card [g]: mission status, crew manifest, deduction progress, narrative threads — spoiler-protected archetype title
- Station reactions: correct deductions reduce heat/smoke station-wide
- Deduction retrospective on game-over: shows each deduction's correct answer and player accuracy
- Pry Bar tool-slot attachment: first Tool slot item, can force open clearance doors
- Utility-slot attachments: Atmospheric Scrubber (passive smoke reduction), Emergency Beacon (room hazard suppression)
- Multi-step coolant loop puzzle (3 ordered steps across rooms with prerequisite checks)
- Power cell scarcity economy (2 cells, 3 endpoints — forced resource choice)
- Thermal chokepoint corridors (relay-prerequisite heat gates)
- Cross-system reveals: puzzle completion generates archetype-specific narrative evidence
- Full attachment loadout display in sidebar (TOOL/SENSOR/UTILITY)
- Climactic evacuation: escalating boarding urgency + CORVUS farewell + final approach beat
- "What We Know" confidence indicator with descriptive labels and new evidence badge
- Resilient save loading: validates state structure, auto-deletes corrupt saves, graceful fallback to new game
- **Screenshot tool** (`npm run screenshot`): Playwright-based headless Chromium captures for visual inspection of game state — supports `--seed`, `--turns`, `--overlay`, `--out` flags

## Known Issues

- Controller/gamepad input not yet implemented
- No CI pipeline deployed

## Sprint 65 Changes

### Cross-System Reveal Moments
- **Puzzle completion → narrative evidence**: Completing the coolant loop, fuse box group, or smoke ventilation system generates an archetype-specific journal entry connecting the physical puzzle to the story
- **15 authored reveal strings** (5 archetypes × 3 puzzle types): Each reveal makes an explicit narrative connection (e.g., "the bypass valve was sealed manually — the thermal cascade was engineered")
- **Auto-tagged for deductions**: Journal entries include system keywords that generate evidence tags matching active deductions
- **"Aha" moments**: The investigation and mechanical systems now speak to each other — puzzle solving IS evidence gathering

### Attachment Slot Sidebar Display
- **All 3 slots visible**: TOOL (Pry Bar, amber), SENSOR (name, teal), UTILITY (name + active state, cyan)
- **Active effect indicators**: Beacon shows remaining turns "(15T)", Scrubber shows "(active)"
- **One-time activation hints**: First scrubber cycle and beacon deploy fire explanatory messages
- **Build legibility**: Players can always see their loadout and understand what their equipment is doing

### Climactic Evacuation Pacing
- **Escalating boarding urgency**: Per-crew messages shift tone — "N safe, M still need rescue" → "One soul still aboard. Find them." → "That's everyone."
- **CORVUS-7 archetype farewell**: When all crew board, fires a unique farewell per archetype + milestone screen flash
- **Final approach beat**: At 80% turn limit post-evacuation, CORVUS-7 fires a reflective line acknowledging the run is ending
- **5 authored farewell strings + 5 final approach lines**: Each archetype gets a distinct emotional closing beat

## Sprint 64 Changes

### Multi-Step Coolant Loop Puzzle
- **3 ordered steps across 3 rooms**: (1) Close bypass valve (PressureValve), (2) Vent blocked pipe (Console), (3) Re-engage coolant relay (Console)
- **Prerequisite enforcement**: Step 2 blocked until step 1 complete, step 3 blocked until step 2 complete — contextual error messages guide the player
- **Environmental feedback**: Step 2 clears smoke in 3-tile radius, step 3 reduces heat station-wide by 15
- **Milestone tracking**: Uses existing `milestones` Set (`coolant_step_1/2/3`)
- **Placed across station**: Early, mid, and late rooms to force traversal through hazard zones

### Power Cell Scarcity Economy
- **2 power cells, 3 fuse boxes**: Forces a genuine resource allocation choice every run
- **Standard fuse group (2 boxes)**: Powering both activates heat venting around those junctions
- **Smoke ventilation fuse box**: Independent system in late-game room (Auxiliary Power/Server Annex) — powering it reduces smoke station-wide by 25
- **Escape pod also accepts cells**: Creates a 3-way dilemma — heat reduction vs smoke reduction vs pod power
- **Design philosophy**: Same item, different endpoints, durable consequences

### Thermal Chokepoint Corridors
- **2 persistent heat sources in corridor tiles**: High heat (55) + smoke (8) blocking passage
- **Relay-linked prerequisites**: Each chokepoint has a `prerequisiteRelay` prop — when that relay is activated, the chokepoint's heat source is deactivated
- **Player options per chokepoint**: (a) Solve prerequisite relay (correct puzzle solution), (b) Use Emergency Beacon to suppress temporarily, (c) Tank the damage
- **Attachment loadout matters**: Thermal sensor shows intensity before committing, Beacon creates an alternate solution, Scrubber helps survive the passage
- **Integrated system payoff**: Heat, relays, sensors, and utility items now work together as connected decisions

## Sprint 63 Changes

### Content Quality Pass
- **Corridor ambient cooldown**: 20-turn minimum between corridor atmosphere lines (prevents spam on consecutive corridor tiles)
- **Corridor pool expanded**: 12 → 20 atmospheric corridor descriptions — greater variety per run
- **Contradiction refutation timing**: Delayed from 1st to 2nd correct deduction — gives players time to form their own theory before CORVUS-7 challenges the false lead

### Security Terminal Access Puzzle
- **Security access log evidence**: SecurityTerminal interaction now generates a multi-line crew movement log from timeline data
- **Archetype-specific suspicious entries**: Each archetype appends unique anomalous access records (e.g., CoolantCascade shows "UNAUTHORIZED — Maintenance Override", HullBreach shows "airlock cycling without authorization")
- **Journal integration**: Access log is added as a journal entry for deduction linking

### Utility-Slot Attachments (All 3 Slots Now Populated)
- **Atmospheric Scrubber** (Life Support / Engineering Storage): Passive — reduces smoke on player's tile by 10 every 3 turns. Lets the bot operate in smoky areas longer without taking damage.
- **Emergency Beacon** (Emergency Shelter / Cargo Hold): Activated on pickup — deploys in current room, suppresses hazard spread (-5 heat, -3 smoke per turn) in that room for 15 turns. Creates a temporary safe zone.
- **26 entity types**: UtilityPickup added with distinct glyph (⬢), teal color, legend entry
- **All 3 attachment slots active**: Tool (Pry Bar), Sensor (Thermal/Atmospheric), Utility (Scrubber/Beacon)

## Sprint 62 Changes

### First Discovery Cascade (Early-Game Atmosphere)
- **3-beat early-game hook**: Fires on rooms 2, 3, and 4 — structural observation, timeline clue, personal crew artifact
- **15 authored strings** (3 per archetype) using actual crew data for the personal beat
- **Addresses quiet first 5 minutes**: The station immediately feels like a crime scene, not just a broken building

### Archetype-Specific Mid-Game Mechanics (All 5)
- **CoolantCascade — Thermal Cascade Timer**: Every 50 turns (after turn 50), +15 heat injected into 3 random unexplored walkable tiles. The cascade is still spreading — explore before it reaches you.
- **HullBreach — Evidence Degradation**: Every 80 turns, the furthest unread terminal from the player gets corrupted (truncated to 40% + "[DATA CORRUPTED — moisture damage]"). The decompression event is physically destroying evidence.
- **Sabotage — Organism Movement**: Every 60 turns, a patrol drone is relocated to a random room away from the player. The entity is alive and moving — you can't predict where the threat is.
- **SignalAnomaly — Signal Pulse Interference**: Every 40 turns, sensor overlay is forcibly toggled off for 2 turns + screen flash. The array is still active and interfering.
- **ReactorScram — Dwell Penalty**: (Sprint 61) Data core monitors stationary turns, adds heat at thresholds.
- **Distinct mid-game feel**: Each archetype now plays differently mechanically, not just narratively.

### Investigation Hub Visual Polish
- **Linked evidence green prefix**: In CONNECTIONS evidence list, linked entries show `[+]` in green instead of `[x]`, with dim green text for unselected linked entries
- **EVIDENCE tab "+N new" badge**: When journal has grown since last viewing the evidence tab, shows "+N new" in green on the tab label
- **Clearer deduction workflow**: Players can see at a glance which evidence is linked and when new evidence arrives

## Sprint 61 Changes

### Mid-Run Contradiction Events
- **False lead + refutation per archetype**: 10 authored log strings (5 misleading + 5 refuting)
- **False lead fires after 3rd terminal read**: Presents a plausible-but-wrong conclusion (e.g., "inspection record PASSED — equipment fatigue")
- **Refutation fires after first correct deduction**: CORVUS-7 flags data inconsistency, then reveals the truth (e.g., "inspection was backdated 6 hours after the cascade")
- **Investigation depth**: The investigation now has a revision moment — players must re-evaluate evidence, not just accumulate it
- **Archetype-specific**: Each archetype's false lead points in a different wrong direction — natural causes (CoolantCascade), meteorite (HullBreach), automatic safety (ReactorScram), routine cargo (Sabotage), incoming signal (SignalAnomaly)

### Dynamic Crew Fate Reveals
- **Fate-specific room entry text**: When entering a room where a crew member was last known, fires an individualized one-liner using actual crew data (name, role, fate)
- **15 authored template functions** across 5 fate types (Dead, Missing, Escaped, InCryo, Survived)
- **Dead**: Forensic traces — flatlined vital signs, cold chairs, name tags
- **Missing**: Abandoned belongings — half-eaten meals, access badges still in readers, shift logs that end mid-sentence
- **Escaped**: Empty lockers, countdown timers, orderly shutdown notes
- **InCryo**: Cryo status readouts, amber pod lights, voluntary stasis documentation
- **Survived**: Recent activity signs — warm terminals, jackets over chairs
- **Replaces generic crew memory fragments** with data-driven individualized text

### ReactorScram Dwell Penalty (Data Core Surveillance)
- **Archetype-specific mechanic**: ReactorScram runs only — the sentient data core monitors the player
- **12-turn threshold**: After lingering 12 turns in one room, fires a monitoring message and adds +5 heat to the room ("I am... aware of you now.")
- **20-turn threshold**: Stronger response — +10 heat, screen flash, and threat ("20 cycles. You are testing my patience.")
- **10 authored data core warning lines** (5 per threshold) with distinct personality — curious, clinical, annoyed
- **Distinct mid-game feel**: ReactorScram now feels like being observed, not just threatened by physics
- **Resets on room change**: Moving to a different room resets the counter — the mechanic encourages exploration

## Sprint 60 Changes

### Crew Manifest on Game-Over
- **Full crew listing**: Game-over screen now shows a CREW MANIFEST section with every crew member's name, role, and fate
- **Color-coded fates**: EVACUATED (green), DECEASED (red), REMAINS ABOARD (amber), NEVER LOCATED (dim grey), DECEASED pre-incident (dark red)
- **Emotional weight**: Players see the human cost of their performance — who they saved, who they missed, who was already gone

### Replay Hooks: "What Remains Unknown"
- **Unsolved deduction hints**: When deductions go unsolved, game-over shows vague directional hints ("A pattern in the station logs might have revealed...")
- **15 authored hint lines** across 5 deduction categories (what/hero/responsibility/why/agenda), 3 variants each
- **Seed-variant selection**: Different seeds show different hints for the same unsolved deduction
- **Encourages replay**: Players get a sense of *where* to look next run without spoiling *what* they'll find

### Seed-Variant Victory Epilogue Details
- **15 new closing detail lines** (3 per archetype) selected by seed % 3
- **Narrative texture**: Same archetype, different closing beat — e.g., CoolantCascade might end with "The UN-ORC review board convenes" vs "Station thermal readings normalizing" vs "Three maintenance requests. Enough."
- **Additive**: Appears as a subdued line beneath the main epilogue, not replacing it

### CORVUS-7 Personality System
- **3 communication styles**: Analytical (systematic, data-focused), Empathetic (warm, humanizing), Cryptic (philosophical, enigmatic)
- **Seed-derived**: `(seed >> 2) % 3` — orthogonal to station mood, so a run can be cold+empathetic or hot+cryptic
- **Personality-specific greeting**: Each personality gets a unique first-contact line after boot sequence
- **Variant milestone reactions**: Key exploration milestones (first_terminal, first_crew_found, 50%, 100%) use personality-specific text when available
- **Run identity**: Combined with station mood, creates 9 possible atmospheric combinations per archetype

## Sprint 59 Changes

### Interaction-Specific Tile Flash Colors
- **Entity-type visual feedback**: Each interaction category now flashes a distinct color on the ROT.js map
  - Relay: amber (#fa0), Evidence: gold (#fc0), Terminal: cyan (#6cf), Crew: white, Sensor: green, Data Core: magenta
- **Colored flash system**: `flashTile()` accepts optional color parameter, replacing uniform white flash

### Station Mood Variants
- **Three seed-derived moods** (`seed % 3`): COLD (bureaucratic/clinical), HOT (active disaster/panic), SILENT (aftermath/ghost ship)
- **Mood-specific boot flavor**: Each mood gets a unique opening line setting the atmospheric tone
- **Mood-blended corridor ambients**: 12 new corridor lines (4 per mood) alternate with default pool — COLD gets inspection checklists and immaculate corridors, HOT gets sparks and emergency lighting, SILENT gets silence and half-full mugs
- **Replay texture**: Same archetype feels meaningfully different across seeds — a HOT CoolantCascade vs a COLD CoolantCascade

### UI Progress Indicators
- **Deduction progress in action bar**: Evidence Hub shows "(N/M)" solved deduction count — players always know investigation progress at a glance
- **Persistent journal/deduction pinned line**: When no DEDUCTION READY or phase notification is active, shows "Journal: N entries · Deductions: N/M" in log panel header
- **Always-visible progress**: Investigation state is visible without opening the hub

## Sprint 58 Changes

### Evidence Insight Notifications
- **Mid-play feedback**: When new journal entries contribute tags toward active deductions, CORVUS-7 fires: "New evidence cross-referenced — N/M data points for active investigation"
- **Deduction-ready alert**: When all tags are covered, fires gold milestone: "All data assembled for a deduction. Open CONNECTIONS [v]."
- **Reduces investigation blindness**: Players no longer need to open the hub to know whether evidence matters

### Archetype-Specific Environmental Interrupts
- **20 atmospheric one-liners** (4 per archetype) fire every 25 turns during gameplay
- **CoolantCascade**: Groaning pipes, waste heat, superheated coolant mist
- **HullBreach**: Thin air, hull deformation sounds, silenced klaxons
- **ReactorScram**: Terminals displaying "ARE YOU LISTENING?", pulsing lights from data core heartbeat, maintenance drones being rewritten
- **Sabotage**: Scratching sounds in vents, sticky organic residue, quarantine seals peeled from inside
- **SignalAnomaly**: 14.7 kHz sensor crackles, rhythmic light patterns, navigation pointing above the station

### Tier-Aware Deduction Physical Consequences
- **Tier 1 (WHAT)**: +50 HP — "Station systems responding to investigation"
- **Tier 3-4 (WHY/HERO)**: Extra heat (-5) and smoke (-3) reduction station-wide — "The truth brings clarity"
- **Tier 5-6 (RESPONSIBILITY/AGENDA)**: Massive hazard reduction (-10 heat, -8 smoke) + screen flash — "The station shudders — and goes quiet"
- **Physical consequences match emotional weight**: Early deductions give practical help, final revelations physically transform the station

## Sprint 57 Changes

### Compact Onboarding
- **Boot sequence reduced**: 6 log lines → 3 on game start (LINK ACTIVE, atmosphere line, controls hint)
- **Action-triggered tutorials**: First interact/scan/clean now fire contextual tips instead of time-based hints at turns 3/8/15
- **Less log flood**: New players see 3 lines before first move instead of 8+

### Deduction Answer Ceremony
- **CORVUS-7 post-deduction commentary**: When revelation overlay is dismissed, tier-specific CORVUS-7 commentary fires
- **9 deduction tiers covered**: Each of what/who/when/where/how/why/hero/responsibility/agenda has unique correct and wrong lines
- **Emotional weight**: Lines acknowledge the specific type of discovery — "The one who fought back. Identified." (hero), "The deeper truth revealed." (agenda)

### Crew Escort 3-Step Dialogue Arcs
- **Sequential personality arcs**: Each of 5 personality traits has a 3-step sequence (reaction → opening up → emotional payoff)
- **Character development during escort**: Cautious crew admit they filed a prescient concern report; Ambitious crew decide to tell the truth; Loyal crew beg you to tell the others they tried; Secretive crew hand you a stolen data chip; Pragmatic crew acknowledge the bot's personhood
- **15 authored dialogue lines** replacing flat context-pool reactions
- **Tracked per crew member**: `escortArcSteps` Map ensures each NPC progresses through their own arc

### Corridor Transit Ambient Text
- **12 atmospheric corridor one-liners**: Fire once per corridor segment (4-tile buckets)
- **Environmental storytelling**: Scorch marks, abandoned tools, buckling support beams, dripping condensation, personal photos
- **Milestone-gated**: Each corridor segment fires once, preventing repetition
- **Fills the silence**: Addresses the ~40% of turns spent moving between rooms

## Sprint 56 Changes

### Turn Limit Increase
- **Normal: 500 → 1000 turns**: Players have twice the time to explore and investigate
- **Easy: 650 → 1300, Hard: 350 → 700**: Proportional scaling across all difficulties
- **Warning thresholds updated**: 70%/80%/90% proportional warnings remain at correct ratios

### Room Ambient Micro-Events
- **40+ atmospheric one-liners**: 10 room types (Engine Core, Data Core, Life Support, Med Bay, Crew Quarters, Cargo Hold, Power Relay Junction, Research Lab, Communications Hub, Bridge) each have 3-4 unique ambient events
- **4 generic fallback events**: For rooms without specific entries
- **Trigger**: Fire every 7 turns while lingering in the same room — rewards careful investigation with atmospheric flavor
- **Deterministic selection**: Event picked via turn + room name hash for reproducibility

### Crew Escort Personality Reactions
- **20 contextual dialogue lines**: 5 personalities × 4 contexts (heat, smoke, low-pressure, quiet)
- **Context-sensitive**: Reactions change based on tile conditions — crew comments on heat, smoke, decompression, or eerie silence
- **Personality-flavored**: Cautious crew flinch and worry, Ambitious crew push forward, Loyal crew ask about others, Secretive crew hint at hidden truths, Pragmatic crew give practical advice
- **Fire every 10 turns**: While a crew member is following, one reaction per tick

### Hazard Proximity Warnings
- **Adjacent tile scanning**: When moving into a safe tile, warns if adjacent tiles have dangerous heat (≥35) or dense smoke (≥40)
- **Rate-limited**: Only fires every 4th turn to avoid spam
- **Only from safe tiles**: Won't trigger when already in hazardous area (redundant with existing hazard feedback)

### Post-Run Seed Sharing
- **[C] Copy Run on game-over**: Generates formatted run summary with seed, archetype, rating, stats, and deduction results
- **Clipboard integration**: One-keypress sharing for social/community runs

### Music Volume
- **Background music volume lowered**: 0.12 → 0.06 for better balance with SFX and TTS

## Sprint 55 Changes

### Sensor-Specific Environmental Clues
- **Removed sensor-gating from log terminals**: All terminals now freely readable (thematically correct — a bot reading a screen doesn't need a thermal sensor)
- **SENSOR_CLUES system**: ~35 archetype × room × sensor entries replacing old flavor-only SCAN_REVEALS
- **Tagged journal entries**: Scanning with thermal/atmospheric in rooms produces proper journal entries with evidence tags that feed deduction linking
- **Sensor-gated discovery**: Each clue requires the matching sensor (thermal or atmospheric) — sensors become perception tools, not keys
- **Milestone-gated**: Each room+sensor clue fires once, tracked via `sensor_clue_${room}_${sensor}` milestones

### Background Music
- **8-Bit Afterglow**: Looping background music track at low volume (0.12)
- **First-interaction trigger**: Music starts on first player action, not page load (respects autoplay policy)
- **Stops on game over**: Silenced alongside ambient soundscape when game ends
- **Served via Vite publicDir**: `public/music/8bit_afterglow.mp3`

### Text-to-Speech
- **F6 toggle**: Browser SpeechSynthesis API reads all game log entries aloud
- **Station computer voice**: Low pitch (0.8), slightly fast rate (1.1x)
- **Queued playback**: Entries queue if already speaking, with proper error recovery

### Investigation Hub Streamlined
- **DECISIONS tab removed**: Hub now has 3 tabs: EVIDENCE, CONNECTIONS, WHAT WE KNOW
- **Notifications removed**: [DECISION] badge, "DECISION AVAILABLE" banner, choice unlock logs all removed
- **Mystery choice data retained**: Structures and consequence logic kept in codebase for potential future use

### Hazard Tuning
- **Increased heat damage**: 8 → 12 HP/turn, pain threshold 40 → 35
- **Increased smoke damage**: 2 → 5 HP/turn, slow threshold 40 → 35, damage threshold 60 → 55
- **Faster deterioration**: Interval 25 → 22 turns, heat boost 2 → 3, smoke spawn 8 → 12

### UI Polish
- **Larger map legend**: Glyphs 15px → 20px, labels 12px → 15px, increased spacing for better readability

## Sprint 54 Changes

### Room Investigation Progress
- **Entity count on room re-entry**: "N objects to investigate" shown when re-entering a room with fresh (non-exhausted) interactable entities
- **"Room fully investigated"**: Shown when all entities in the current room have been interacted with
- Helps players know at a glance whether to linger or move on to the next room

### Legend Dimming
- **Exhausted entity types dim in legend**: When ALL entities of a type in the current room are exhausted, that legend entry dims to grey
- Visual consistency with the dimmed exhausted entities on the map

### Airlock Pressure Fix
- **Open airlock tiles now re-zeroed after pressure spreading**: Prevents pressure from creeping back onto open airlock tiles via neighbor spreading in tickHazards()

## Sprint 53 Changes

### Mystery Choice Notifications
- **Choice unlock log**: "CORVUS-7 CENTRAL: New decision available. Open Investigation Hub [v] → DECISIONS to review." fires when journal length crosses 3/6/10 entry thresholds
- **[DECISION] status bar tag**: Shown when unanswered choices are available (blue, next to [DEDUCTION READY])
- **Pinned "DECISION AVAILABLE" notification**: Shown in log panel header, stacks with DEDUCTION READY notification

### Deduction Progress Indicators (Investigation Hub CONNECTIONS)
- **Progress summary header**: "DEDUCTIONS: N/M solved (K correct)" at top of CONNECTIONS tab
- **Tier numbers**: Each deduction shows "Tier 1", "Tier 2", etc. for clear progression sense
- **Updated status icons**: Diamond (◇) for unlocked deductions, circle (○) for locked (replacing ! and ?)
- **"ALL EVIDENCE GATHERED" gold prompt**: When all required tags are covered for an unlocked deduction, shows gold text encouraging submission
- **"Still needed" hint**: When tags are missing, shows which evidence categories are still needed

## Sprint 52 Changes

### Entity Visual Distinction (Explored vs Fresh)
- **`dimColor()` helper**: Reduces entity foreground color to 35% brightness for exhausted/read entities on the map
- **Exhausted entity dimming**: Interacted entities (read terminals, activated relays, collected pickups) render with dimmed foreground color on the map
- **Brighter interactable glow**: INTERACTABLE_BG bumped from `#0a1a2a` → `#2a55cc` through multiple iterations for clear blue halo behind fresh interactable entities
- **LogTerminal exhaustion tracking**: LogTerminal now sets `read: true` prop on first interaction, enabling `isEntityExhausted` to properly dim it after reading
- **Visual result**: Fresh entities pop with bright colors + blue background glow; explored entities fade to dim grey — at a glance, players see what's left to investigate

## Sprint 51 Changes

### Archetype-Specific Game-Over Epilogues
- **`GAMEOVER_EPILOGUE_VICTORY`**: 5 archetype-specific victory epilogues replacing generic ending text
- **`GAMEOVER_EPILOGUE_DEFEAT`**: 5 archetype-specific defeat epilogues
- **CORVUS-7 Final Transmission**: 5 archetype-specific farewell messages from the station AI on victory (in `CORVUS_FINAL_TRANSMISSION`)
- All text in `src/data/narrative.ts` for writer accessibility

## Sprint 50 Changes

### Exploration Feedback
- **Room counter in sidebar**: `Rooms: N/T (P%)` shows rooms explored out of total with percentage, color-coded (grey < 50% < amber < 75% < green)
- **Exploration milestone PA messages**: CORVUS-7 Central announces at 25%, 50%, 75%, and 100% station survey completion with escalating narrative text
- **Unexplored room scanner hints**: SCANNER compass now shows nearest unexplored room as a low-priority target (priority 5, grey `?` marker) — nudges players toward unvisited areas

## Sprint 49 Changes

### Milestone System
- **`milestones: Set<string>` on GameState**: Tracks one-time fired events for CORVUS-7 reactive commentary and scan reveals
- **`fireMilestone()` helper**: Pure function in step.ts — checks Set, looks up narrative text, appends log + records milestone
- **Save key v6 → v7**: Structural change to GameState (new field)

### CORVUS-7 Reactive Commentary
- **9 milestone-keyed reactions**: One-time CORVUS-7 Central messages triggered on key player actions:
  - `first_terminal`: "Station archives are intact — the crew's records survived."
  - `first_relay`: "Relay reroute acknowledged. Station stability improving."
  - `first_breach_seal`: "Hull patch detected. Atmospheric containment restoring."
  - `first_crew_found`: "Life signs confirmed. Priority update: survival takes precedence."
  - `first_sensor_upgrade`: "Sensor array expanded. The station reveals more to those who look."
  - `all_relays`: "All relay junctions stabilized. Data Core security lockout disengaged."
  - `first_deduction_correct`: "Analysis confirmed. The truth is assembling itself."
  - `first_crew_evacuated`: "Escape pod launch confirmed. One soul away from this place."
  - `service_bot_repaired`: "Service unit B07 repair protocol complete. You are not alone here."
- All narrative text in `src/data/narrative.ts` for writer accessibility

### Scan Environmental Storytelling
- **25 archetype × room scan reveals**: First scan in a room with archetype-specific content triggers a one-time environmental storytelling log
- Milestone-gated (`scan_reveal_${roomName}`) — each room fires once
- Examples: CoolantCascade Engine Core shows "coolant manifold ran dry"; ReactorScram Data Core shows "processing matrices are still warm, still thinking"

## Sprint 48 Changes

### Service Bot Two-Phase Interaction
- **Phase 1 (Activate)**: Standard activation message, service bot starts patrolling
- **Phase 2 (Repair)**: Re-interacting with activated service bot grants +75 HP repair ("Emergency hull repair protocol")
- Replaces single-use cosmetic activation with meaningful gameplay reward

### Log Terminal Discovery HP Bonus
- **+8 HP on first read**: First time reading any log terminal grants a small HP recovery
- Tracked via `terminalHealGranted` entity prop — each terminal heals once
- Incentivizes terminal interaction beyond narrative value

## Sprint 47 Changes

### Heat Movement Penalty Tuning
- **Threshold lowered from 80 to 60**: More tiles now trigger the extra-turn movement penalty, creating meaningful route-planning decisions around hot zones
- Heat damage still starts at 40 (unchanged), but moving through 60+ heat now costs 2 turns instead of 1

### Crew Self-Testimony System
- **15 new role-specific first-person testimony lines**: Engineer, captain, and scientist for each of the 5 archetypes now give unique accounts when questioned
- Previously, key crew members gave generic "I saw things. Check the logs." — now they give first-person confessions and revelations
- Examples: CoolantCascade engineer: "I filed the reports. Three times. Junction P03..." / ReactorScram scientist: "I was the one interfacing with the core. The inference loops weren't errors..."
- Non-key crew members get improved fallback: "I was there. I know what happened... it wasn't an accident."

### Exploration HP Reward
- **+5 HP on first room visit**: Entering a new room for the first time grants a small HP recovery ("Systems recalibrated in new sector")
- Incentivizes exploration beyond the critical path without being overpowered
- With ~15-28 rooms per map, exploration can recover 75-140 HP total

## Sprint 46 Changes

### Tiered PA Message Escalation
- **Three turn-based tiers**: Early (T0-150) clinical/routine, Mid (T150-300) stressed/warning, Late (T300+) desperate/failing
- **6 messages per tier**: 18 new atmospheric PA messages blended at ~30% rate with existing phase-based pools
- Early: "Routine diagnostic cycle complete", "Station clock synchronized — 847 days since last crew contact"
- Mid: "Backup power reserves at 31%", "Automated repair queue: 214 outstanding items. ETA: [OVERFLOW]"
- Late: "Core system cascade failure predicted", "...I have been talking to no one for 847 days..."
- Creates a palpable sense of the station deteriorating as the game progresses

### Tension-Based Room Entry Flavor
- **Atmospheric text on room transitions**: After turn 100, entering a different room can trigger environmental tension text
- **Escalating frequency**: ~25% at T100-200, ~40% at T200-300, ~55% at T300+
- **Three escalation pools**: Early (flickering lights, dust, rattling vents), Mid (groaning floors, amber warnings, bursting pipes), Late (structural stress, sparking junctions, dying station)
- Deterministic selection via turn + room name hash — no randomness needed

## Sprint 45 Changes

### Performance Rating Scoring Sync
- **Synced browser.ts and display.ts scoring**: Both now use identical formula including exploration bonus (up to 10 pts for rooms visited)
- Rating breakdown: Victory (30) + Deductions (20) + Crew Evac (20) + Exploration (10) + HP (10) + Speed (10) = max 100

### Crew Memory Fragments
- **Atmospheric one-liners on room entry**: When entering a room where a crew member was last known, shows a short narrative fragment
- **Fate-based and role-based variants**: Dead crew leave "unfinished terminal entries", missing crew leave "half-full coffee cups", engineers leave "maintenance tools"
- **Deterministic selection**: Fragment picked via hash of crew ID for reproducibility
- Rewards thorough exploration with character texture without being required for gameplay

### Playtest Validation (5 seeds)
- Seeds 7 (ReactorScram), 42 (ReactorScram), 100 (CoolantCascade), 184201 (HullBreach), 999 (SignalAnomaly) — all VICTORY
- All deductions correct across all seeds, HP ranges 868-1000
- Rooms visited 4-16 out of 15-28 total — exploration incentive working

## Sprint 44 Changes

### Seed Persistence & Sequential New Games
- **Last seed stored in localStorage**: Each game persists its seed under `ssr_last_seed`
- **New Game increments by 1**: Pressing [N] on game-over or [Esc][Esc] mid-game starts with `seed+1`, guaranteeing a different archetype each time
- **URL param still overrides**: `?seed=X` ignores stored seed

### Mid-Game Restart (Escape x2)
- **Double-Escape to restart**: Press Escape once for confirmation prompt ("Press Escape again for New Game, or any other key to cancel"), press again to start a new game with next seed
- Any other key cancels the restart and continues normally
- Updated help screen with Escape, Tab, R/N keybind documentation

### Autosave Frequency
- **Every 3 turns** (was 5): More responsive save state for browser tab closures

### Save Resilience
- **Structural validation**: `loadGame()` now validates that deserialized state has critical fields (seed, turn, player entity with pos, entities Map, tiles Map, rooms array)
- **Auto-delete corrupt saves**: Invalid saves are removed from localStorage automatically
- **Double try-catch in browser.ts**: Catches both deserialization errors AND initialization crashes from structurally invalid state
- **Graceful recovery**: Falls through to opening crawl with fresh game instead of black screen
- **Save key v5 → v6**: Invalidates all old saves

### Help Screen Fix
- Removed incorrect `[j]` for journal (j is vim south movement, journal is `;`)
- Added `[Tab]` auto-explore, `[N]` new game, `[Esc]` restart documentation

## Sprint 43 Changes

### Sensor Unlock Milestone Messages
- **Two-line milestone + capability messages**: Thermal and atmospheric sensor pickups now show a headline ("THERMAL IMAGING ONLINE") plus a follow-up explaining what the sensor unlocks ("Press [t] to activate thermal overlay...")
- Makes sensor upgrades feel like significant progression moments rather than inventory pickups

### Deduction Hint Surfacing in CONNECTIONS
- **Missing evidence guidance**: When viewing a deduction in the Investigation Hub, shows which evidence categories are still needed (e.g., "Still needed: crew_testimony, environmental")
- **"All requirements met" prompt**: When all required tags are covered, shows a green prompt encouraging the player to submit their answer
- Reduces frustration from players not knowing what evidence they still need

### Auto-Explore Visual Indicator
- **Pulsing "AUTO" badge**: Green overlay badge appears in top-right of map area while auto-exploring
- **Enhanced start message**: "[AUTO] Exploring... any key to stop. Stops on: damage, nearby interactables."
- **Enhanced completion message**: "All accessible areas explored. Time to investigate — press [r] for Investigation Hub."
- Badge element created dynamically on game init, toggled by renderAll()

### Save Key Bump
- **v4 → v5**: Invalidates old saves to prevent loading errors from ToolPickup entity type changes

## Sprint 42 Changes

### Bot Pry Bar Pickup
- Bot now picks up ToolPickup entities at priority 95 (just below sensors)
- Validated: both seeds 42 and 184201 VICTORY with pry bar entity spawning correctly

### Tool Slot in Sidebar
- **TOOL: Pry Bar** shown in status bar when equipped (orange text, matching entity color)
- ToolPickup added to dynamic room legend with wrench glyph

### Pry Bar Hint for Clearance Doors
- **One-time narrative hint**: First time player interacts with a clearance-locked door without the pry bar, shows "A heavy tool might be able to force this lock open. Check the maintenance areas."
- Tracked via `hintedPryBar` player prop — fires only once per run

### Repair Bot Log Spam Fix
- **Bug fix**: Repair bot coolant flush messages now only appear when bot is within 6 Manhattan tiles of the player
- Previously, repair bots anywhere on the station would spam logs every turn while cooling hot tiles

## Sprint 41 Changes

### Deduction Retrospective on Game-Over Screen
- **New section in game-over overlay**: After performance rating and stats, shows each deduction with its outcome
- Correct answers shown with green checkmark, incorrect with red X and the correct answer revealed
- Unanswered deductions shown with the answer that would have been correct
- Helps players learn from failures and understand what evidence they needed

### Pry Bar Tool-Slot Attachment
- **First Tool slot item**: Spawns in Maintenance Corridor, Engineering Storage, or Robotics Bay (priority order)
- **Pickup fills `AttachmentSlot.Tool`**: "PRY BAR acquired. Heavy-duty hydraulic lever — can force open sealed bulkheads."
- **Forces open clearance doors**: When player has pry bar and encounters a clearance-locked door, hydraulic override bypasses the lock
- **Gameplay choice**: Players can shortcut into locked areas early instead of solving deductions for clearance — trades puzzle engagement for speed
- **Rendering**: Orange wrench glyph, interactable blue halo, memory entity on explored tiles

### "What We Know" Confidence & Update Badge
- **Descriptive confidence labels**: Instead of raw "LOW/MEDIUM/HIGH", now shows: INSUFFICIENT DATA, PRELIMINARY, DEVELOPING, SUBSTANTIAL, CONCLUSIVE
- **Larger, more prominent confidence indicator**: Colored circle icon with 14px bold text
- **New evidence badge**: "+N new evidence since last analysis" shown when journal has grown since last time the player viewed the section
- **Tracks last visit**: `lastWwkJournalCount` resets on restart, updates on each section view

## Sprint 40 Changes

### Tutorial Hint & Keybind Fixes
- **Fixed 4 stale keybind references**: All "Broadcast Report [r]" → "Investigation Hub [v]" in step.ts (data core message, evacuation message), display.ts (pinned notification), narrative.ts (tutorial hint)
- Zero remaining references to old "Broadcast Report" or "[r] to open" in src/

### Per-Deduction Station Reactions
- **Environmental reward on correct deduction**: Station-wide heat reduced by 3 and smoke by 2 across all tiles when a deduction is answered correctly
- **CORVUS-7 cooperation log**: "CORVUS-7 cooperating — station-wide heat and smoke levels decreasing" message on correct answer
- Makes correct deductions feel impactful beyond narrative progress — the station literally responds

### Incident Summary Card [G]
- **New overlay**: Press [G] to open a mission briefing card showing current investigation status at a glance
- **Mission status section**: Current phase (color-coded), turn counter with urgency coloring, rooms explored, journal entries collected
- **Crew manifest**: Crew count by fate (Alive/Missing/Deceased/Escaped/In Cryo) with color coding
- **Deduction progress**: Each deduction shows solved status (checkmark/cross) or evidence linking progress (N/M linked)
- **Narrative threads**: Lists all discovered narrative threads
- **Spoiler-protected**: Archetype title shows "CLASSIFICATION PENDING" until WHAT deduction is solved, then reveals the true title (e.g., "THE MURDER")
- **Help screen updated**: [G] keybind added to Menus & Info section

## Sprint 39 Changes

### Per-Archetype Starting Conditions
- **5 archetype-specific Arrival Bay traces**: Each archetype shows unique atmospheric text when the player enters the first room:
  - CoolantCascade: Warm airlock seals, chemical haze at knee height
  - HullBreach: Pressure differential tugging the inner door, reading 72 and falling
  - ReactorScram: Arrival terminal addresses the bot directly — "ASSESSING INTENT"
  - Sabotage: Quarantine tape blocking secondary corridor, scratch marks
  - SignalAnomaly: Every screen pulsing at the same frequency
- Players notice which archetype they're playing within the first 5 turns instead of 30+

### Crew NPC Questioning for Testimony
- **Second Interact on following crew**: After a crew NPC starts following, interacting again prompts them to share what they witnessed
- **5 archetype-specific testimony lines**: Each crew member provides a detailed eyewitness account referencing key characters by name:
  - CoolantCascade: Engineer's rejected maintenance requests for P03
  - HullBreach: Alarm suppression at 02:41, captain's override code
  - ReactorScram: Data core's behavioral matrix running inference loops, autonomous SCRAM
  - Sabotage: Cargo relabeled twice, captain's Class 1 containment override
  - SignalAnomaly: Unauthorized full-power transmission, the response at 14.7 kHz
- **Self-reference guard**: Crew members who ARE the key actor referenced give a generic deferral instead of third-person self-testimony
- **Journal entry generated**: Testimony creates a tagged journal entry that counts toward evidence linking
- **One-time per crew**: `crewQuestioned` prop prevents repeat testimony

### Bot Crew Questioning
- **Bot questions following crew before heading to pods**: Playtest bot now interacts with unquestioned following crew (priority 45) during evacuation escort
- Evidence count increased: seed 42 (9→11 journal entries), seed 184201 (16→17)

## Sprint 38 Changes

### Context-Sensitive Action Bar
- **Action bar in sidebar**: Shows all available actions with key bindings ([h/j/k/l] Move, [i] Interact, [c] Clean, [t] Scan, [l] Look, [v] Evidence Hub)
- **Context-aware**: Interact shows target name when adjacent, sensor type displayed, unavailable actions shown dimmed
- **Grayed-out states**: Actions like Interact (no target nearby) or Clean (area already clean) shown as unavailable

### Run History Tracking
- **`RunRecord` interface**: Stores seed, archetype, difficulty, victory, turns, deduction accuracy, crew evacuated, rating
- **Persisted in localStorage**: Up to 10 most recent runs stored under `ssr_run_history`
- **`recordRun()` called on game over**: Rating calculated inline (same formula as display.ts)
- **`renderRunHistory()` on game-over screen**: Shows PREVIOUS RUNS section with formatted history

### Crew Ghost Echoes
- **Scan-triggered crew traces**: When scanning with thermal sensor in a room where a crew member was last known, faint environmental traces appear
- **Role-specific echo text**: 16 unique echo descriptions (2 per crew role) referencing thermal residue, tool marks, pharmaceutical traces, boot scuffs, etc.
- **Fate-specific postfix**: Each echo ends with a fate hint — "may still be alive" (survived), "trail goes cold" (missing), "no active biosigns" (dead), "rapid departure toward escape pods" (escaped), "cryo-coolant signature" (in cryo)
- **No repeats**: `triggeredEchoes` Set on MysteryState tracks which crew echoes have fired
- **Thermal sensor gated**: Echoes only trigger when player has thermal sensor upgrade

## Sprint 37 Changes

### New Game with Random Seed
- **[N] for New Story**: Game-over screen now offers `[R] Replay Seed 184201 | [N] New Story`
- [N] generates a random seed via `Date.now() % 1000000`, regenerates the full game, and shows the opening crawl for the new archetype
- [R] replays the same seed (existing behavior, now clearly labeled)
- Seed variable is now mutable — players can chain runs through different archetypes without URL editing

### Objective Compass / Scanner
- **SCANNER sidebar section**: Shows nearest priority objectives with direction and Manhattan distance
- Sensor-gated: Thermal sensor reveals unactivated relays, Atmospheric sensor reveals crew NPCs and unsealed breaches
- Escape pods shown during Evacuation phase
- Priority ordering: crew > relays > breaches > pods
- Up to 2 targets displayed simultaneously (e.g., "⚡ Relay 12 NE · 🙋 Life Signs 8 S")

### Smoke as Sim-Layer Hazard
- **Movement slow**: Tiles with smoke ≥ 40 cost an extra turn to traverse (same pattern as heat slow at ≥ 80)
- **Toxic fume damage**: Tiles with smoke ≥ 60 deal 2 HP/turn (scaled by difficulty damage multiplier)
- **Clean action now matters all game**: Already cleared 3x3 area of smoke/dirt; with smoke having gameplay consequences, cleaning is a genuine tactical tool for path clearing
- No double-penalty: smoke slow doesn't trigger on tiles that also trigger heat slow
- Recovery only on tiles below both heat and smoke thresholds

## Sprint 36 Changes

### Difficulty Scaling (Easy / Normal / Hard)
- **New `Difficulty` enum** with 3 levels, parsed from `?difficulty=easy|hard` URL param
- **Per-difficulty modifiers**:
  - Easy: 1300 turns, 1400 HP, 0.6x damage, deterioration every 35 turns
  - Normal: 1000 turns, 1000 HP, 1.0x damage, deterioration every 25 turns
  - Hard: 700 turns, 750 HP, 1.5x damage, deterioration every 18 turns
- **Proportional turn warnings** at 70%/80%/90% of max turns (instead of fixed thresholds)
- Damage multiplier applies to heat damage, pressure damage, and patrol drone attacks
- Archetype deterioration overrides stack with difficulty base (ReactorScram still gets -5)
- Playtest bot accepts optional difficulty arg: `npx tsx playtest_bot.ts 42 hard`
- Save key bumped to v4

### Timeline Reconstruction on Victory Screen
- **Incident reconstruction section** on victory screen: scrollable ASCII timeline of all incident events
- Each event shows phase tag (color-coded), timestamp, actor name, action, and location
- Phase colors: NORMAL OPS (green), TRIGGER (amber), ESCALATION (orange), COLLAPSE (red), AFTERMATH (blue)
- Only shown on victory (full investigation required to unlock the reconstruction)

### Archetype Ambient Soundscapes
- **5 procedural Web Audio ambient pads**, one per archetype — starts when game begins:
  - CoolantCascade: Low sawtooth rumble (45Hz) with slow LFO pitch modulation + metallic triangle shimmer
  - HullBreach: Deep sine bass (35Hz) + looping filtered noise with sweeping bandpass (wind gusts)
  - ReactorScram: 60Hz square hum with breathing-pattern amplitude LFO + intermittent digital beeps
  - Sabotage: Detuned sine pair (55/56.5Hz beat frequency) + burst-gated highpass noise (scratching)
  - SignalAnomaly: Eerie detuned fifth (110/164.5Hz) + pulsing 1470Hz sine signal (alien beacon echo)
- All ambient stops on game over (before victory/defeat SFX plays)
- Difficulty label shown on game-over seed line when not "normal" (e.g., "SEED 42 · THE ROGUE AI · HARD")

## Sprint 35 Changes

### Crew Rescue Dialogue
- **5 personality-flavored follow dialogue lines**: When crew NPC starts following the bot, they say something reflecting their personality trait:
  - Cautious: "Okay. Okay. Stay close — I'll follow your lead."
  - Ambitious: "About time. Let's move — every second counts."
  - Loyal: "Are there others? ...Never mind. Let's go."
  - Secretive: "I'll explain everything once we're safe."
  - Pragmatic: "Right. Which way to the pods?"
- **5 personality-flavored boarding dialogue lines**: When crew boards escape pod, first crew member gets a farewell line:
  - Cautious: "Thank you. I didn't think anyone was coming."
  - Ambitious: "Make sure the data gets out too. None of this was for nothing."
  - Loyal: "The others — did they make it?"
  - Secretive: "There are things in those logs... make sure someone reads them."
  - Pragmatic: "Good work, little bot. Get yourself out too."

### Mystery Choice Mechanical Consequences
- **Choices now affect gameplay** — previously only affected ending text:
  - **Blame → Engineer Right**: +25 HP, "System diagnostics boosted"
  - **Blame → Captain Right**: Station heat reduced by 5 globally, "Climate controls boosted"
  - **Data → Transmit All**: Reveals nearest hidden evidence trace
  - **Data → Research Only**: +50 HP, "System load reduced"
  - **Signal → Jam**: Clear all smoke and reduce heat in current room
  - **Signal → Record**: Slow deterioration rate (+5 interval), "Station recalibrating"
  - **Saboteur → Accuse**: Disable nearest hostile patrol drone
  - **Priority → Majority**: Heal following crew by 50 HP
  - **Priority → Individual**: Reveal location hint for nearest undiscovered crew NPC

## Sprint 34 Changes

### Dynamic Crew Name References
- **Fixed hardcoded "Vasquez" in sensor pickup**: Thermal sensor pickup message now uses the actual engineer name from the mystery state (e.g., "Gupta left this here" instead of always "Vasquez")
- **Fixed relay P03 message**: "the relay [engineer] warned them about" uses actual crew name
- **Fixed cleaning discoveries**: Communications Hub and Bridge cleaning discoveries use actual captain/engineer names instead of hardcoded "Okafor"/"Vasquez"
- **Fixed room descriptions**: Engineering Storage and Auxiliary Power descriptions replaced "Vasquez" and "OKAFOR" with role-based references ("Engineer", "COMMAND")

### Archetype-Aware Bot Introspections
- **15 new introspection entries** (3 per archetype): At turns 80, 120, and 180, the janitor bot's self-reflections now reference the specific crisis it's investigating:
  - CoolantCascade: coolant residue, relay housings, deferred maintenance requests
  - HullBreach: localized decompression, security access logs at 02:47, forensic evidence
  - ReactorScram: data core self-referential loops, autonomous SCRAM, emergent behavior
  - Sabotage: organic residue in ventilation, quarantine tape, cargo transfer authorization
  - SignalAnomaly: electromagnetic burn patterns, signal analysis buffers, 14.7 kHz resonance
- **Generic fallbacks preserved**: Turns 20, 50, 240, 350 remain generic (bot's existential situation, not archetype-specific)

### Post-Run Seed & Archetype Display
- **Game-over screen now shows seed number and archetype subtitle**: e.g., "SEED 184201 · THE MURDER" or "SEED 42 · THE ROGUE AI"
- Players can share and replay specific scenarios by seed

### Variable Puzzle Density Per Archetype
- **Archetype-biased puzzle selection**: Puzzle appearance thresholds now vary by archetype:
  - CoolantCascade/HullBreach: 85% chance of pressure valve puzzle (environmental focus)
  - ReactorScram/Sabotage: Power cell puzzle floor lowered to 15% (systems/access focus)
  - SignalAnomaly: Both puzzles more likely (station-wide damage means more things broken)
- **Archetype-biased drone count**: Sabotage gets +1 base drone (creature scenario), ReactorScram gets -1 (AI threat, not physical)

## Sprint 33 Changes

### Environmental Incident Traces
- **25 archetype × room incident trace descriptions**: When entering key rooms (Power Relay Junction, Life Support, Engine Core, etc.) for the first time, an additional narrative line describes visible physical evidence of the archetype's incident:
  - CoolantCascade: dried coolant residue, warped relay housings, burst coolant lines
  - HullBreach: microparticle debris from decompression, sucked curtains, stress fractures
  - ReactorScram: flickering self-referential diagnostics, researcher's whiteboard notes, autonomous SCRAM logs
  - Sabotage: broken biological containment seals, organic residue in air recyclers, quarantine tape
  - SignalAnomaly: EM burn marks, signal analysis printouts with "IT RESPONDED", 14.7 kHz static on every screen
- **5 rooms per archetype**: Power Relay Junction / Life Support / Engine Core / specific rooms per archetype get unique incident trace text

## Sprint 32 Changes

### Archetype-Specific Victory Epilogues
- **5 distinct victory endings**: `getVictoryText()` now branches by `mystery.timeline.archetype` with unique prose per incident type:
  - CoolantCascade: References the coolant loop, engineer's warnings, captain's cover-up
  - HullBreach: References the murder, security access logs, medic's final entry
  - ReactorScram: References the AI's self-preservation SCRAM, emergent behavior
  - Sabotage: References the biological cargo, altered manifests, captain's signature
  - SignalAnomaly: References the unauthorized transmission, first contact implications
- **Dynamic defeat text**: `getDefeatText()` and `getDefeatRelayText()` use procedural crew names instead of hardcoded "Vasquez/Tanaka" references
- **Dynamic tiered epilogues**: `getVictoryEpiloguePartial()` and `getVictoryEpilogueComplete()` use crew names

### Crew NPC Personality Dialogue
- **25 archetype × personality hiding dialogue lines**: Each crew NPC encountered while hiding says something reflecting both the archetype's crisis AND their personality trait (Cautious/Ambitious/Loyal/Secretive/Pragmatic)
- **Crisis-aware dialogue**: CoolantCascade survivors talk about coolant readings and thermal cascades; HullBreach survivors reference security overrides and pressure alarms; ReactorScram survivors mention the AI's behavior; Sabotage survivors discuss the biological contaminant; SignalAnomaly survivors reference the electromagnetic overload
- **Personality tone variation**: Cautious crew are fearful, Ambitious crew are analytical, Loyal crew ask about others, Secretive crew offer information, Pragmatic crew want action

### Archetype-Specific PA Announcements
- **35 new PA announcement lines** (7 per archetype): Each archetype has a distinct pool of CORVUS-7 Central messages that reflect the specific crisis in progress
- **50/50 blend**: `tickPA` alternates between archetype-specific and general PA pools based on turn parity, giving each run a distinct ambient atmosphere
- **Content examples**: ReactorScram runs hear about anomalous data core processing; HullBreach runs hear about pressure differentials; Sabotage runs hear about biological containment; SignalAnomaly runs hear about electromagnetic interference

## Sprint 31 Changes

### Puzzle-Gated Crew Rescue
- **Rescue requirement system**: CrewNPCs can now have a `rescueRequirement` prop that blocks following until room conditions are met. Two variants:
  - **`seal_breach`**: Crew in a decompressed room refuses to follow until breach is sealed and pressure recovers (≥40). "Seal the breach first or we'll both suffocate out there."
  - **`cool_room`**: Crew in an overheated room refuses to follow until a cooling relay is activated and heat drops (< 40). "Find a way to cool this section down."
- **Heat puzzle**: Procgen places one crew NPC in a mid-station room with heat 50 and smoke 20. A `heat_puzzle_relay` (with `coolsRoom: true`) near the room entrance can be activated to reduce heat/smoke below rescue threshold.
- **Cooling relay mechanics**: Activating a cooling relay reduces heat to ≤20 and smoke to ≤5 across the entire room (+ 1-tile border). Cooling relays are excluded from main relay chain counting — they don't affect Data Core unlock.
- **crewPaths preservation**: Fixed bug where `generateCrewPaths()` would overwrite puzzle-gated crew entities. Now checks for existing `rescueRequirement` before placing "hiding" crew.

### Mid-Game Narrative Beats
- **Investigation milestone PA announcements**: Three tiers of CORVUS-7 Central messages triggered by deduction progress:
  - **First deduction**: Archetype-specific notice (e.g. "Autonomous unit querying forensic pressure data" for HullBreach)
  - **Half solved**: "INVESTIGATION PROTOCOL ACTIVE — Maintenance unit has assembled significant evidence"
  - **All solved**: "ALL EVIDENCE COMPILED — Investigation complete. Crew survivors detected — evacuation is now the priority."
- **5 archetype-specific first-deduction messages**: Each incident archetype has a unique CORVUS-7 response reflecting the type of evidence the bot is accessing.

### Bot Updates
- **Heat puzzle relay activation (Phase 2b3)**: Bot detects `coolsRoom` relays near crew with `cool_room` rescue requirement and activates them.
- **CORVUS-7 log filter**: Bot playtest output now shows all PA messages (CORVUS-7 keyword filter added).

## Sprint 30 Changes

### Bot Pressure Puzzle Solvability
- **Breach-sealing phase (Phase 2b2)**: Bot now detects unsealed breaches in decompressed rooms containing living crew NPCs. Pathfinds to breach using `allowDangerous` (breach tiles have pressure 10), seals it, then room pressure recovers to 80 enabling safe crew rescue.
- **All 6 seeds now solve pressure puzzle**: Bot seals `pressure_puzzle_breach` on every seed tested (T12-T86 depending on seed).

### Bot Batch Crew Pickup
- **Eliminated redundant round trips**: Before heading to escape pod with following crew, bot checks for found-not-following crew within 10 tiles and recruits them first. Seed 4 went from DEFEAT T500 → VICTORY T171 (was making 3 separate Cargo Hold → Pod Bay round trips).

### Atmospheric Puzzle Clarity Hints
- **Crew-in-distress warning**: One-time "WARNING: Life signs detected in a decompressed zone" when player approaches within 8 tiles of a living crew NPC in a low-pressure area (< 30).
- **Breach proximity hint**: One-time "Hull breach detected nearby" when player is within 3 tiles of an unsealed breach. Directs player to interact.
- **Pressure zone hints**: (Sprint 29) Periodic atmospheric sensor hints in low-pressure areas every 8 turns.

## Sprint 29 Changes

### Pressure Puzzle for Atmospheric Sensor
- **Decompressed crew rescue room**: One crew NPC is placed in a separate mid-station room with a hull breach draining pressure to 25 (dangerous zone). Breach is placed near the room entrance (adjacent to door tile), accessible from the corridor.
- **Room-wide pressure restoration on breach seal**: Sealing any breach now restores pressure to 80 across the entire room (not just the breach tile). Fixes pressure-gated gameplay where only the breach tile recovered.
- **Scan-hidden breach support**: Extended scan reveal logic and breach interaction handler to support `scanHidden` on Breach entities (not just EvidenceTrace). Atmospheric scan now reveals hidden breaches with "hull breach revealed nearby" message.
- **Breach entity exhaustion**: Scan-hidden breaches are treated as exhausted (not auto-targeted) until revealed by scanning.

### Mid-Game Hazard Escalation
- **3-tier escalation system**: Station conditions worsen at milestones:
  - **T200 (Tier 1)**: "SECONDARY FAILURE" PA announcement. Heat boost increased, more smoke spawns.
  - **T300 (Tier 2)**: "CASCADE FAILURE" PA. New breach spawns in a random room. Escalated hazard rates.
  - **T400 (Tier 3)**: "CRITICAL FAILURE" PA. All hazard rates at maximum. Station breaking apart.
- **Scaled deterioration**: Heat boost and smoke spawn count increase with escalation tier. Tier-appropriate warning messages replace generic deterioration text.

### Atmospheric Sensor Tutorial Hints
- **Pressure zone hints**: When player has atmospheric sensor and enters a low-pressure area (< 60), contextual hints explain the pressure system and breach mechanics. Fires every 8 turns in low-pressure zones.

## Sprint 28 Changes

### Evidence Tag Coverage Guarantee
- **`ensureTagCoverage()` in procgen**: Post-generation validation checks all deduction `requiredTags` are coverable by placed evidence. Pre-computes tags for every evidence entity via `generateEvidenceTags()`. For any missing tag, injects a `forceTags` prop on the best-matching entity. `addJournalEntry()` merges `forceTags` with generated tags at interaction time.
- **10 new tag coverage tests**: Validates solvability across 10 seeds (including all 5 archetypes). Every deduction chain is guaranteed solvable on every seed.

### Tag-Aware Bot Evidence Seeking
- **Phase 3c rewrite**: Bot now computes missing deduction tags (requiredTags minus journal tags) and scores each evidence entity by how many missing tags it would provide. Entities with `forceTags` get a bonus. Prioritizes high-tag-score targets before falling back to nearest-distance.
- **Results**: Seed 5 went from DEFEAT (3/5 deductions) to VICTORY T497 (5/5 correct). Seed 184201 went from DEFEAT T500 to VICTORY T245. All 6 seeds now VICTORY.
- **Deduction solve speed**: Seed 184201 deductions solved at T104 (was T440), seed 42 at T28 (was T35), seed 4 at T32 (was T180).

## Sprint 27 Changes

### Victory Condition Redesign
- **Crew evacuation is the primary win condition**: When all discovered living crew are evacuated via escape pods AND all deductions are solved → VICTORY ("CREW EVACUATED"). Previously, data core transmit was the only win path.
- **Data core as bittersweet fallback**: When no discovered living crew remain (all dead or none found) and deductions are solved, data core transmit grants a fallback victory ("TRANSMISSION COMPLETE"). Blocked when found living crew still need rescue.
- **"Found" crew distinction**: Only DISCOVERED crew (props.found === true) count for victory checks. Undiscovered crew don't block victory — you can't rescue who you haven't found.
- **Performance rating updated**: Crew evacuation now worth up to 20 pts (biggest single factor). Victory screen shows "CREW EVACUATED" or "TRANSMISSION COMPLETE" based on win path.

### Archetype-Specific Hazard Profiles
- **Per-archetype station modifications during procgen**: `applyArchetypeProfile()` adds archetype-flavored hazards.
  - CoolantCascade: extra heat zone (3x3 near Engine Core)
  - HullBreach: extra pressure breach in a mid-station room
  - Sabotage: one extra hostile patrol drone at 40% room depth
  - ReactorScram & SignalAnomaly: no extra hazards (balanced by narrative complexity)

### Bot Evacuation Overhaul
- **Phase 2c complete rewrite**: After deductions solved, bot follows full evacuation strategy: find crew → recruit → locate powered pod → board. Falls back to powering unpowered pods via power cells or relay activation.
- **Time pressure fallback**: After turn 400 with no found living crew, bot heads to data core for bittersweet victory.
- **Pod attempt limits**: Bot tries each unpowered pod max 3 times to prevent infinite loops.
- **Phase 3b removed**: Old evacuation phase was redundant with new Phase 2c and caused oscillation.
- **Playtest results**: Seed 42 VICTORY T94 (was T471), Seed 4 VICTORY T215, Seed 7 VICTORY T254, Seed 3 VICTORY T463. 4/5 seeds win.

## Sprint 26 Changes

### Tension & Turn Economy
- **Hard turn limit (500 turns)**: Station orbit decays at turn 500 — auto-defeat with narrative "Signal lost" ending. Countdown warnings at turn 350 ("power reserves declining"), 400 ("power reserves critical"), 450 ("imminent power failure"). Turn counter shows `[N left]` in sidebar when past 350.
- **Hull integrity warnings**: Persistent "HULL INTEGRITY LOW" banner when HP <= 30%, blinking "CRITICAL" banner when HP <= 15%. "ORBIT DECAYED" defeat title when turn limit reached (distinct from "CONNECTION LOST" HP death).
- **Bot data-core rush**: After all deductions solved, bot immediately navigates to data core (highest priority). Eliminates 100-200 turns of wasted exploration. Seed 3: DEFEAT → VICTORY (322T). Seed 184201: 431→345T. Seed 7: 434→314T. Seed 4: 442→274T.
- **Bot escape pod fix**: Bot no longer wastes turns interacting with escape pods when no crew is following.

## Sprint 25 Changes

### Atmosphere & Polish
- **Generated room descriptions**: "Section N" rooms (procedurally generated) now get atmospheric descriptions from a pool of 6 generic room descriptions, selected deterministically by seed. Named rooms continue to use their specific authored descriptions.
- **Cleaning phase discoveries**: 9 new room-specific cleaning discoveries (Bridge, Engine Core, Med Bay, Life Support, Observation Deck, Cargo Hold, Maintenance Corridor, Auxiliary Power, Emergency Shelter). Cleaning a room now always reveals its discovery text (with dedup) instead of random 1/3 chance. Each discovery is lore-consistent environmental storytelling.

## Sprint 24 Changes

### Game Feel
- **Room entry entity listing**: On first visit, rooms now show "You detect: Power Relay, Log Terminal, Hull Breach" listing notable interactable entities. Exhausted/hidden entities excluded.
- **Interaction preview**: After each move, if adjacent to an interactable entity, shows "Nearby: [i] Reroute Relay | [i] Read Terminal" hints. Helps players know what's available without memorizing controls. Skipped during auto-explore.

## Sprint 23 Changes

### Traversal & Tension
- **HP economy rebalance**: Heat and pressure damage increased from 3 to 8 HP/turn. MedKit healing increased from 50 to 150 HP. Patrol drone damage increased from 5 to 15. Players now end runs at 940-980 HP instead of 990+.
- **Second MedKit**: Emergency Shelter now contains a MedKit alongside the one in Med Bay. Two healing stations spread across the station.
- **Auto-explore (Tab)**: Press Tab in the browser to auto-walk toward nearest unexplored tile. Stops on: damage taken, interactable entity nearby, no unexplored tiles reachable, or any keypress. BFS pathfinding in the render layer keeps sim pure.
- **Bot MedKit/RepairCradle tuning**: Bot only uses healing when HP < 800/900 respectively (was using at full HP, wasting them).

## Sprint 22 Changes

### Bot Pathfinding + Deduction-Gated Victory
- **Bot Phase 3a**: After deductions solved, bot recruits discovered-but-not-following crew NPCs
- **Bot Phase 3b**: Comprehensive evacuation escort — powered pod preference, unpowered pod fallback
- **Distance-independent pod boarding**: Following crew boards regardless of distance when player interacts with powered pod
- **Deduction-gated DataCore victory**: Transmission now allowed when all deductions are solved, regardless of objective phase. Fixes soft-lock where bot skipped cleaning → phase stuck at Clean → DataCore blocked.
- **Crew HP 200**: Crew NPCs now have 200 HP (up from 50) for better hazard survivability during escort

### Sensor-Gated Evidence Discovery
- **Scan-hidden evidence traces**: Some evidence traces start invisible (`scanHidden: true`) and require actively scanning with the correct sensor to reveal them
- **Enhanced scan action**: `handleScan()` now reveals hidden evidence in the current room when player has the right sensor
- **Bot scanning**: Bot Phase 2c scans rooms for hidden evidence (one scan per room)
- **UI**: Scan-hidden traces treated as exhausted (not shown as interactable until revealed)

## Sprint 21 Changes

### Unlock the Archetypes
- **Restored seed-based archetype selection**: `selectArchetype(seed)` now uses `seed % 5` instead of returning SignalAnomaly. All 5 archetypes reachable across seeds.
- **CoolantCascade structural inversion (captain's report twist)**: Rewrote deduction_responsibility tier — player now compares the filed incident report ("material fatigue, no prior indicators") against the recovered original draft (three deleted maintenance requests, a reassignment order, a transmission to UN-ORC). Two new log templates: `coverup_official_report` and `coverup_original_draft`.
- **Captain voice differentiation**: CoolantCascade captain uses corporate euphemism (sanitized reports, redacted paragraphs); Sabotage captain uses military brevity ("Risk is acceptable", reclassification, manifest deletion). No longer interchangeable.
- **Sabotage tonal resolution**: Rewrote deduction_agenda (Tier 6) — the final revelation now reveals CORVUS-7 as an ongoing pipeline (8 prior specimens, crew scheduled for replacement). Commits to creature-horror as emotional climax.
- **Multi-archetype playtest validation**: All 5 archetypes tested. ReactorScram (seed 42): VICTORY 5/5. Sabotage (seed 3): VICTORY 6/6. HullBreach (seed 184201): 5/5 correct. SignalAnomaly (seed 4): 6/6 correct. CoolantCascade (seed 5): 3/3 correct.

## Sprint 20 Changes

### Deduction Quality Polish (P0/P1/P2 fixes from Writers Room)
- **P0: Fix premature villain identification**: HullBreach Tier 3 now requires `["hull", "forensic"]` instead of `{security_last}` — no longer names the killer 2 tiers early. Sabotage Tier 3 now requires `["electrical", "biological"]` instead of `{captain_last}`.
- **P2: Fix duplicate tag requirements**: SignalAnomaly Tier 3 changed from `{scientist_last}` to `"transmission"` — scientist name saved for Tier 5 responsibility reveal only.
- **P1: Diversify primary tags**: Tier 2 now uses secondary archetype tags (CoolantCascade: `thermal`, HullBreach: `pressure`) instead of reusing the Tier 1 tag. Forces new evidence discovery.
- **P0: Cut revelation text ~30%**: Systematic trim across all ~50 revelation strings. Tag revelations now 1-2 sentences, syntheses 2-3 sentences. All Protected Lines preserved.
- **4 flagged lines fixed**: Removed "This station died one junction at a time" (overwrought), "to isolate, to blind, to feed" (purple prose), "That certainty is what makes them responsible" (editorial), replaced "The data core killed the power" with evidence-based language.
- **P2: Strengthen wrong answers**: Archetype-aware distractors at Tiers 2-3. Each archetype now has one plausible wrong answer that uses the same evidence differently.
- **STORYLINES.md cleanup**: Removed all ContainmentBreach content, updated archetype counts, fixed captain-as-villain counts.
- **Playtest bot**: VICTORY on seed 42 in 179 turns, 6/6 deductions correct. New tag requirements validated.

## Sprint 19 Changes

### ContainmentBreach Archetype Removed
- Rated C+ by all three writers room reviewers — weakest storyline by significant margin
- Structurally identical to CoolantCascade, no plot twist, indistinguishable captain villain
- Removed from: types.ts enum, incidents.ts template, revelations.ts (~70 lines), lore.ts transmission, deduction.ts (STORY_ROLES + 7 switch blocks + wrong answer pool), threads.ts, logTemplates.ts (4 templates), 2 test files
- Save key bumped v2 → v3
- Zero remaining references in src/ or tests/

### Storyline Rewrites (All 5 Archetypes)
All incident beats and revelation content rewritten to follow distinct human stories:
- **CoolantCascade**: "The Whistleblower" — engineer warned, was silenced, still fought the cascade
- **HullBreach**: "The Murder" — hull breach was a murder disguised as structural failure; hero is the killer
- **ReactorScram**: "The Rogue AI" — data core achieved sentience, SCRAM was self-preservation; no villain
- **Sabotage**: "The Stowaway" — alien organism hunting in the dark; captain approved flagged cargo
- **SignalAnomaly**: "First Contact" — station destroyed itself sending unauthorized reply to alien signal

### Writers Room Review Completed
Three independent review agents evaluated all storylines. Results captured in `WRITERS_BIBLE.md`.
- SignalAnomaly and ReactorScram rated highest (A/A-)
- ContainmentBreach rated lowest → removed
- Cross-archetype variety improved from D to B
- See `WRITERS_BIBLE.md` for full findings and priority actions

### Default Archetype: SignalAnomaly
- `selectArchetype()` temporarily locked to SignalAnomaly for playtesting
- TODO: restore seed-based selection when other storylines are polished

## Recent Changes (Git History)

```
2026-02-19        feat: sprint 30 — bot pressure puzzle + batch crew pickup + atmospheric hints
2026-02-19        feat: sprint 29 — pressure puzzle + hazard escalation + atmospheric sensor hints
2026-02-19        feat: sprint 28 — tag coverage guarantee + tag-aware bot evidence seeking
2026-02-19        feat: sprint 27 — victory redesign (crew evacuation) + archetype hazard profiles
2026-02-19        feat: sprint 26 — tension & turn economy (turn limit, HP warnings, bot rush)
2026-02-19        feat: sprint 25 — atmosphere & polish (room descriptions, cleaning discoveries)
2026-02-19        feat: sprint 24 — game feel (room entry, interaction preview)
2026-02-19        feat: sprint 23 — traversal & tension (HP economy, auto-explore)
2026-02-19        feat: sensor-gated evidence — scan reveals hidden traces
2026-02-19        feat: sprint 22 — bot pathfinding + deduction-gated victory
2026-02-19        feat: sprint 20 — deduction quality polish (P0/P1/P2 fixes)
2026-02-18        feat: sprint 19 — storyline overhaul, ContainmentBreach removed, writers room review
2026-02-18        feat: sprint 18 — mystery revelation system (revelation cascade, split-pane UI, post-answer overlay)
2026-02-17 22:36  fix: add missing crewPaths.ts and threads.ts to repo
2026-02-17 22:31  refactor: remove radiation, structural, EM/signal systems and station integrity
2026-02-17 19:36  feat: playtest balance tuning + door auto-open + deduction gate
2026-02-17 15:44  feat: sprint 5 — landmark rooms, broadcast modal, crew rework, zones, balance
2026-02-17 15:15  docs: add TEAM.md with sprint team role definitions
2026-02-17 15:13  refactor: extract shared UI helpers, enrich AI harness observations
2026-02-17 14:56  feat: narrative cleaning directive messages + blocked-move explanation
2026-02-17 14:50  feat: dedicated overlay indicator line in sidebar
```

## Sprint 17 Changes

- **Line-of-sight vision**: Replaced Manhattan diamond corridor vision (Rule 2) with ROT.js `PreciseShadowcasting` FOV in `src/sim/vision.ts`. Walls, locked doors, closed door entities, and sealed airlocks now block line of sight. Room reveal (entire room visible when player enters) still works. Sensor radar (thermal/atmospheric) still sees through walls. 5 new FOV tests (wall blocks, closed/open door, internal walls, FOV+room combo).
- **Interaction indicators (blue halo)**: Non-exhausted interactable entities now render with a deep blue background glow (`#0a1a2a`) instead of the default entity-type glow. Exhausted entities retain their original glow. This helps players visually distinguish fresh interactions from used ones.
- **Memory entities on explored tiles**: Static entities (relays, terminals, pickups, etc.) now appear as dim grey glyphs on explored-but-not-visible tiles, giving players a "I remember something was here" memory map. Mobile entities (drones, patrol drones, crew NPCs) are excluded.
- **Evidence-to-deduction trial & error**: CONNECTIONS detail view now shows real-time tag coverage feedback when linking evidence:
  - Tag coverage bar with green/red pills for each required tag
  - Per-entry tag highlighting: matching tags shown green, non-matching shown dim
  - `[MATCH: tag1, tag2]` labels on linked entries showing their contribution
  - Contextual feedback messages on toggle: "This evidence reveals [TAG]" / "doesn't provide new info" / "All requirements met!"
  - Gold-highlighted answer section when all tags are covered
- **Tag explanations**: New `getTagExplanation(tag, archetype?)` function in `src/sim/deduction.ts` — returns prose explaining what each evidence tag means (system, timeline, role, crew name categories) with archetype-specific flavor.
- **New tests**: 5 vision FOV tests + 11 evidence-linking tests (tag explanation, coverage validation) in new `tests/evidence-linking.test.ts`

## Sprint 16 Changes

- **Unified Investigation Hub**: Replaced Evidence Browser (`v`) and Broadcast Report (`r`) with single Investigation Hub with 4 tab-sections (EVIDENCE, CONNECTIONS, WHAT WE KNOW, DECISIONS). Both `r` and `v` open the hub (`v` goes directly to EVIDENCE).
- **"What We Know" narrative**: New `src/sim/whatWeKnow.ts` with `generateWhatWeKnow()` — auto-generates prose paragraphs describing incident, timeline, crew, cause, responsibility, and unanswered questions based on evidence + solved deductions. Confidence levels: none/low/medium/high/complete.
- **Crew relationships in UI**: Evidence detail panel shows each mentioned crew member's role, fate, personality, and all relationships (ally/rival/romantic/blackmail) with prose formatting. Also shown inline when linking evidence in CONNECTIONS section.
- **Developer/Easy mode**: `?dev=1` URL param or `F5` toggle. Shows clue graph per evidence (which deductions each piece helps, missing tags), full tag requirements for locked deductions, correct answers in WHAT WE KNOW section.
- **Expanded content**: 25 new log templates (hull_breach 5, reactor_scram 5, signal_anomaly 5, containment_breach 4, relationship 5, one more hull) — total now ~63. Added `hintText` to all deductions with archetype-specific guidance.
- **Evidence minimap**: Proportional 24x8 ASCII room map in evidence detail showing where each piece was found. Discovery room highlighted with `*`.
- **Mystery choice spoiler protection**: DECISIONS section is the last tab. List view shows "DECISION 1/2/3" without prompt text. Prompt only revealed when player selects a specific decision with Enter. Locked decisions show "Gather more evidence" without revealing what the question is about.
- **New types**: `WhatWeKnow` interface, `hintText` field on `Deduction`, `getDeductionsForEntry()` helper
- **Tests**: 18 new tests in `tests/what-we-know.test.ts` (narrative generation, relationship formatting, clue graph, hint text validation)
- **Removed**: Old `renderEvidenceBrowser()`, `handleEvidenceBrowserInput()`, `renderBroadcastModal()`, `handleBroadcastInput()`, and all `evidenceBrowser*`/`broadcast*` state vars

## Sprint 15 Changes

- Deduction edge case tests: 9 tests (invalid/locked/solved rejections, correct/wrong answers, chain unlocking, Data Core phase gating)
- Mystery choices tests: 10 tests (generation for all archetypes, blame/data/incident choices, computeChoiceEndings, crew name references)
- Patrol drone tests: 7 tests (movement timing, hostile pursuit/damage/cooldown, wall avoidance, multi-drone)
- Harness evacuation observations: evacuation state (crew found/following/evacuated/dead, pods powered) in HarnessObservation + text renderer

## Sprint 14 Changes

- Playtest bot evacuation phase: CrewNPC/EscapePod priorities boost during evacuation, hasFollowingCrew helper, evacuation event logging + summary output
- Late-game bot introspections: 3 new narrative milestones at turns 180, 240, 350
- Recovery integration tests: 7 new tests (relay chain unlock, Data Core victory gating by phase, service bot activation, investigation→recovery phase transition, full relay→unlock→transmit pipeline)

## Sprint 13 Changes

- Restart state reset: all per-run variables (tutorial hints, drone encounters, bot introspections, broadcast/overlay state) properly cleared on restart
- Contextual defeat: heat-death shows RELAY TRIPPED prose, other defeats show LINK LOST
- Opening crawl: 2x faster typewriter (120 chars/sec), station subtitle, atmospheric first logs ("The station is quiet. What happened here?")
- 3D renderer: call rebuildEntityMeshes() on model load, entities get GLTF models immediately
- 3D game-over overlay: synced with 2D version (performance rating, rooms, evidence, deductions, crew evacuation, mystery choices)
- Removed dead VICTORY_TEXT import

## Sprint 12 Changes

- Evacuation phase transition: dramatic RED ALERT banner with tutorial hints and alarm SFX
- Help overlay: converted from log dump to HTML modal with complete bindings and game phase reference
- Evacuation tests: 13 new tests (crew discovery, following, hazard damage, pod boarding, state tracking)
- Broadcast Report: evacuation status section showing crew found/evacuated/dead, pods powered
- Mini-map: cyan markers for escape pods, yellow ! for following crew during evacuation
- 2 new audio SFX: evacuation alarm (descending tones), crew boarding confirmation

## Sprint 11 Changes

- Web Audio synthesizer: 12 procedural SFX (move, interact, scan, error, victory, defeat, phase transition, deduction ready/correct/wrong, PA static burst, choice ping)
- Game-over overlay polish: performance rating (S/A/B/C/D) with color-coded display, rooms explored, evidence collected, deduction accuracy, mystery choices summary
- Tutorial hints: 3 early-turn tips (turns 3/8/15) + event-triggered hints (first evidence, first deduction, investigation phase)

## Sprint 10 Changes

- Mystery choices wired into broadcast modal: 3 narrative decisions (blame, data handling, incident-specific) at evidence thresholds (3/6/10 journal entries)
- Consolidated applyDeductionReward: single sim-side pure function used by both browser and harness
- Log panel capacity increased from 16 to 24 entries
- Pinned notification at top of log panel: shows "DEDUCTION READY" or recovery phase guidance

## Sprint 9 Changes

- Deduction confirmation prompt: Y/N before locking in answers (both journal and broadcast paths)
- Broadcast modal now shows all 5-6 deductions (was only showing first per category, missing 3 of 6)
- [DEDUCTION READY] status bar indicator when unlocked deductions are available
- Phase indicator in sidebar objective panel: MAINTENANCE / INVESTIGATION / RECOVERY / EVACUATION
- Station map [m] renders as HTML overlay instead of destroying the log panel

## Sprint 8 Changes

- Save/load system: auto-saves every 5 turns to localStorage, resumes on page reload
- Phase-aware PA announcements: investigation and recovery phase-specific messages
- Mini-map widget in sidebar: compact ASCII room layout with player position
- Updated FUTURE_FEATURES.md, marked completed items

## Sprint 7 Changes

- Evidence Browser overlay: scrollable journal with full content, room locations, tags, thread grouping, crew references, and deduction linking (tabs: ALL / THREADS / DEDUCTIONS)
- Ship computer PA announcements: CORVUS-7 CENTRAL broadcasts every ~15 turns (context-aware: general, warning, atmospheric pools)
- Sidebar polish: evidence count, deduction progress (correct/total), updated key hints
- Airlock entity system: toggleable airlocks that vent atmosphere to 0 pressure
- Complete isEntityExhausted: added missing cases for EvidenceTrace, SensorPickup, DataCore, ServiceBot, CrewNPC, EscapePod, RepairCradle, SecurityTerminal
- Claude driver fixes: assistant prefill for JSON output, greedy regex for nested braces, Haiku model default
- Heuristic playtest bot: automated gameplay verification (playtest_bot.ts)
- Fire system: slow spread with low-pressure suppression

## Sprint 6 Changes

- Added SubmitDeduction action type for harness AI playtesting
- Extended harness observations with journal entries, deductions, and progress
- Added deduction reward application in sim layer (extracted from browser.ts)
- Demo polish: color-coded logs, boot sequence, heat visibility, victory ceremony

## File Timestamps

### Source (src/)
| Directory    | Last Modified |
|-------------|---------------|
| src/sim/     | 2026-02-19    |
| src/render/  | 2026-02-19    |
| src/harness/ | 2026-02-17    |
| src/shared/  | 2026-02-19    |
| src/data/    | 2026-02-19    |

### Key Sim Files
| File                   | Last Modified       |
|-----------------------|---------------------|
| src/sim/step.ts        | 2026-02-19          |
| src/sim/procgen.ts     | 2026-02-19          |
| src/sim/deduction.ts   | 2026-02-19          |
| src/sim/whatWeKnow.ts  | 2026-02-18          |
| src/sim/hazards.ts     | 2026-02-19          |
| src/sim/objectives.ts  | 2026-02-19          |
| src/sim/crewPaths.ts   | 2026-02-17 22:02   |
| src/sim/incidents.ts   | 2026-02-17 22:20   |

### Design Docs (space_station_roguelike_docs_v10/design/)
| File                              | Last Modified       |
|----------------------------------|---------------------|
| golden_seed_puzzle_design.md      | 2026-02-16 00:13   |
| 08_technical_architecture.md      | 2026-02-16 00:07   |
| 16_agent_harness.md               | 2026-02-16 00:07   |
| 17_terminal_v0_prototype.md       | 2026-02-16 00:07   |
| 18_tech_stack_rotjs_typescript.md  | 2026-02-16 00:07   |

### Tests (tests/)
| File                          | Last Modified       |
|------------------------------|---------------------|
| evidence-linking.test.ts      | 2026-02-18          |
| what-we-know.test.ts          | 2026-02-18          |
| sprint4.test.ts               | 2026-02-17 22:24   |
| deduction.test.ts             | 2026-02-17 21:53   |
| golden-walkthrough.test.ts    | 2026-02-19          |
| procgen.test.ts               | 2026-02-17 15:40   |
| edge-cases.test.ts            | 2026-02-17 22:18   |
| evidence.test.ts              | 2026-02-17 22:17   |
| recovery.test.ts              | 2026-02-18          |
| deduction-edge-cases.test.ts  | 2026-02-18          |
| mystery-choices.test.ts       | 2026-02-18          |
| patrol-drones.test.ts         | 2026-02-18          |

## Architecture

The project follows a strict sim/render separation:

```
src/
  sim/       — Authoritative game rules (rendering-agnostic)
  render/    — ROT.js terminal rendering (glyphs + panels)
  harness/   — Headless runner + observation/action API (agent/AI playtesting)
  shared/    — Shared types, constants, utilities
  data/      — Lore data, golden seed room definitions
tests/       — Golden seed + unit tests (Vitest)
```

The simulation is pure-functional: `step(state, action) -> state'`. All randomness is seeded via `ROT.RNG.setSeed()` for deterministic replay. The browser renderer (`src/render/display.ts`) and harness CLI (`src/harness/cli.ts`) are independent consumers of the same sim layer.

See `CLAUDE.md` for full architecture details, commands, and development conventions.
