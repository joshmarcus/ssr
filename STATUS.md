# SSR — Project Status

*Last updated: 2026-02-19*

## Current State

- **Phase**: Sprint 31 complete (Puzzle-Gated Crew + Narrative Milestones)
- **Test status**: 290 tests passing across 24 test files (0 failing)
- **Build**: TypeScript strict mode, tsc clean
- **Archetype selection**: Seed-based (`seed % 5`), all 5 archetypes reachable
- **Archetypes**: 5 active (ContainmentBreach removed — rated C+ by all reviewers)
- **Save key**: v3
- **Turn limit**: 500 turns (warnings at 350/400/450, escalation at 200/300/400)
- **Victory condition**: Crew evacuation (primary) or data core transmit (bittersweet fallback)
- **Playtest results**: 6/6 seeds VICTORY — 184201 (270T), 3 (254T), 7 (147T), 5 (409T), 42 (188T), 4 (171T)

## What Works

- Core game loop: explore -> evidence -> puzzles -> evacuate crew
- 7 player actions (Move, Interact, Scan, Clean, Wait, Look, Journal, SubmitDeduction)
- 25 entity types with distinct interactions (including Airlock)
- 3-sensor ladder (Cleanliness, Thermal, Atmospheric)
- Heat/smoke + pressure/breach hazard systems with spreading
- Fire system with slow spread and low-pressure suppression
- Airlock system: toggleable entities that vent atmosphere
- Procedural crew generation (8-12 crew, relationships, secrets, fates)
- 175+ narrative elements (63 log templates, 16 authored logs, 16 crew items)
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
- **Investigation Hub [r/v]**: unified 4-section overlay replacing old Evidence Browser + Broadcast Report
  - EVIDENCE: two-panel layout (entry list + full detail with crew relationships, minimap, tags, thread)
  - CONNECTIONS: **split-pane deduction detail** with evidence list (left 40%) + full evidence text (right 60%)
    - Dual-focus navigation: Tab switches between evidence linking and answer selection
    - Revelation Board: accumulated narrative sentences as evidence is linked
    - Synthesis block (gold): appears when all required tags covered
    - Linked evidence persists when navigating away
  - WHAT WE KNOW: auto-generated narrative prose summarizing investigation progress
  - DECISIONS: spoiler-protected mystery choices (title-only list, prompt revealed on select)
- Crew relationships displayed in evidence detail and connection linking views
- Evidence minimap: proportional ASCII room map showing where evidence was found
- Developer mode (?dev=1 or F5): clue graph annotations, full tag requirements, correct answers
- ROT.js browser rendering with viewport scrolling
- Harness CLI for AI playtesting (with deduction support)
- Heuristic playtest bot (playtest_bot.ts)
- Mystery choices: 3 narrative decisions with spoiler protection
- Procedural sound effects: 12 Web Audio SFX
- Game-over overlay: performance rating (S/A/B/C/D), stats summary, mystery choices recap
- Tutorial hints: context-sensitive tips at early turns and on first-time events
- Evacuation phase: RED ALERT banner, crew following, escape pod boarding with full audio
- Help overlay: HTML modal with complete key bindings, game phases, interaction details

## Known Issues

- Controller/gamepad input not yet implemented
- No CI pipeline deployed

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
