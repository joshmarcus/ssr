# Space Station Terminal Roguelike (SSR)

A procedural roguelike where you remotely pilot maintenance bots through a low-bitrate terminal link to explore a silent research station, restore systems, solve puzzles, and uncover what happened to the crew.

## Core Pillars

1. **Exploration via constraints** — Low-bitrate UI + narrow sensors create meaningful uncertainty
2. **Puzzle-forward roguelike** — Hazards are solved, not fought
3. **Mystery as progression** — Restored subsystems unlock evidence and interpretation
4. **Procedural but coherent** — Varying runs with solvable critical paths

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Rendering**: ROT.js (ASCII/glyph roguelike display)
- **Testing**: Vitest
- **Runtime**: Node.js (via fnm), tsx for dev
- **Time model**: Turn-based (one action = one time step)
- **Input**: Controller-first (Steam Deck "Playable" tier target, 1280x800)
- **Platform**: PC + Steam Deck (browser-based via ROT.js)

## Architecture

```
src/
  sim/       — Authoritative game rules (rendering-agnostic)
  render/    — ROT.js terminal rendering (glyphs + panels)
  harness/   — Headless runner + observation/action API (agent/AI playtesting)
  shared/    — Shared types, constants, utilities
  data/      — Lore data, golden seed room definitions
tests/       — Golden seed + unit tests (Vitest)
```

## Commands

- `npm run dev` — Run game (tsx)
- `npm run build` — TypeScript compile
- `npm test` — Run tests (vitest)
- `npm run harness` — Headless CLI runner
- `npm run lint` — Type-check without emit

## Key Gameplay Systems

- **Player bot** (Janitor Rover): 3 attachment slots (Tool, Sensor, Utility), base cleanliness sensor
- **Sensor ladder**: Cleanliness → Thermal → Atmospheric → Radiation → Structural → EM/Signal
- **Puzzle types**: Power routing, pressure/leak management, access control, robotics salvage, signal relay
- **Mystery/narrative**: Procedurally generated crew (8-20), incident archetypes, evidence via logs/traces/still frames

## MVP Target

10-15 minute vertical slice: 10 rooms, 1 locked door (power-gated), 1 robotics bay, 1 data core objective, thermal sensor upgrade, heat/smoke hazard. Deterministic with seed. Golden seed test: seed 184201, 31-turn walkthrough.

## Documentation Reference

All design docs live in `space_station_roguelike_docs_v10/`:

### Design (core specs)
- `design/00_high_concept.md` — Vision, pillars, one-liner
- `design/01_game_loop.md` — State machine, progression phases
- `design/02_player_bot_and_upgrades.md` — Bot systems, attachments, sensor ladder
- `design/03_terminal_ui_and_sensors.md` — UI/UX, controller mapping, action bar
- `design/04_procgen_station_layout.md` — Generation pipeline (macro graph → rooms → doors → hazards → loot)
- `design/05_mystery_narrative_system.md` — Crew gen, evidence types, incident archetypes
- `design/06_puzzles_and_interactions.md` — Puzzle categories and mechanics
- `design/07_content_pipeline_and_data_formats.md` — Content pipeline and data format specs
- `design/08_technical_architecture.md` — System architecture, module boundaries (TypeScript + ROT.js)
- `design/09_input_and_controller.md` — Input mapping and controller support
- `design/10_meta_progression.md` — Meta-progression design
- `design/11_sensor_ladder_and_variants.md` — Sensor types and variants
- `design/12_minimal_combat.md` — Optional combat-lite design
- `design/13_realtime_simulation.md` — Future real-time mode (post-MVP)
- `design/14_platform_pc_steam_deck.md` — Platform targets and Steam Deck constraints
- `design/15_visual_style_no_art.md` — Visual style: representational, no art pipeline
- `design/16_agent_harness.md` — AI testing framework, observation/action format
- `design/17_terminal_v0_prototype.md` — V0 prototype specs (ROT.js Display, full visibility)
- `design/18_tech_stack_rotjs_typescript.md` — Technology choices and rationale (active)
- `design/golden_seed_puzzle_design.md` — Thermal-gated power routing puzzle design
- `design/18_tech_stack_python_tcod.md` — (superseded) Original Python tech stack doc

### Tasks (implementation roadmap)
- `tasks/00_repo_scaffold_typescript.md` — Repository structure (TypeScript, active)
- `tasks/01_ci_plan_typescript.md` — CI/testing plan (GitHub Actions + Vitest)
- `tasks/mvp_spec.md` — MVP requirements and scope
- `tasks/golden_seed_run_184201.md` — Integration test spec (seed 184201, ROT.js Digger map)
- `tasks/backlog.md` — Milestone roadmap (V0.0 → V0.1 → M0 → M1 → M2 → M3)
- `tasks/v0_terminal_roadmap.md` — V0 terminal-first development roadmap
- `tasks/00_repo_scaffold_python.md` — (superseded) Original Python scaffold doc
- `tasks/01_ci_plan_python.md` — (superseded) Original Python CI plan

### Status
- `STATUS.md` — Current project status, what works, known issues, next steps

### Schemas (data formats)
- `schemas/` — Specs for bots, systems, puzzles, incidents, attachments, log templates

### Agent Prompts (AI-assisted dev)
- `agents/agent_core_engineering.md` — Core sim implementation (TypeScript)
- `agents/agent_ui_terminal.md` — UI/terminal rendering (ROT.js)
- `agents/agent_procgen.md` — Procedural generation
- `agents/agent_narrative_puzzle.md` — Narrative and puzzle design
- `agents/agent_input_controller.md` — Input and controller mapping
- `agents/agent_hazards_realtime.md` — Hazards and real-time systems
- `agents/agent_playtest_balance.md` — Playtesting and balance
- `agents/agent_packaging_steam_deck.md` — Packaging and Steam Deck deployment

## Important Project Files

- `CLAUDE.md` — This file. Project instructions and architecture reference
- `TEAM.md` — Sprint team roles, file ownership, workflow rules
- `STATUS.md` — Living project status (update after each sprint)
- `FUTURE_FEATURES.md` — Deferred features and design ideas
- `space_station_roguelike_docs_v10/tasks/backlog.md` — Milestone roadmap and backlog

## Sprint Workflow

1. Review `STATUS.md` for current state (what works, what's broken)
2. Check `backlog.md` and `FUTURE_FEATURES.md` for priorities
3. Plan sprint: 3-5 deliverables, prioritized by game design lead
4. Execute in parallel by role (see `TEAM.md`)
5. QA: run `npx tsc --noEmit` + `npx vitest run` to verify
6. **Always commit and push** after changes are verified
7. Update `STATUS.md` after each sprint with changes and new findings
8. **After major sprints**: Update critical docs, run a full playtest (harness or manual), share a playtest report before the next planning cycle. The whole team can propose priorities.
9. **Auto-continue**: When a sprint is completed, automatically begin the next sprint — review state, identify priorities, plan, and execute without waiting for user prompt.
10. **Design priority**: The game should be fun, interesting, and innovative — technical elegance is secondary

## Autonomous Development

- **Keep going**: Continue developing, sprinting, and iterating without asking the user for input unless absolutely critical (e.g., destructive action, ambiguous architectural direction). Make design decisions independently.
- **Continuous sprints**: After completing a sprint, immediately launch the next one. Never stop and wait — always pick up the next highest-priority work from the backlog. The development loop is: finish sprint → update STATUS.md → update backlog → consult design leads → start next sprint.
- **Backlog maintenance**: Keep `space_station_roguelike_docs_v10/tasks/backlog.md` up to date as the living task queue. After each sprint, add new tasks discovered during development, reprioritize existing items, and remove completed work. The backlog should always reflect what's next.
- **Sprint retrospective**: At the end of each sprint, consult the **game design lead** and the **visual design lead** (per `TEAM.md` roles) to set priorities for the next sprint. They should weigh in on what will most improve the game — whether that's visual polish, new mechanics, performance, model integration, or atmosphere. Their priorities drive the next sprint's scope.
- **Sprint focus**: Autonomous sprints should prioritize **visual display/appearance** and **3D rendering optimization**. The game's visual identity is a top priority — keep pushing on lighting, materials, model integration, camera work, atmosphere, and performance.
- **STATUS.md updates**: Always update `STATUS.md` after every sprint with what changed, what's new, and any issues found. This is the living record of project progress — keep it current.
- **Playtesting**: Use `npx tsx playtest_bot.ts [seed]` for automated playtesting. The harness CLI is `npm run harness`. The Claude API driver is at `src/harness/claudeDriver.ts` (requires ANTHROPIC_API_KEY in .env).
- **Snapshots**: There is a tool/workflow for taking screenshots of the running application (saved as `review_v*.png` in the project root). Use these snapshots to review visual progress between sprints.
- **Commit and push always**: After each feature or fix that passes tests, commit and push immediately. Never leave work uncommitted — every passing change should be pushed to the remote so progress is never lost.
- **Sprint reflections**: Every 10 sprints, pause and reflect — add important learnings, patterns, and gotchas to CLAUDE.md so future sessions benefit from accumulated knowledge.

## 3D Model Assets

There is a significant collection of 3D models in `public/models/` (~300+ models) that should be progressively integrated into the 3D view. A full manifest is in `public/model-list.json`. Key collections:

- **synty-space-gltf/**: Sci-fi space station pieces — walls, floors, ceilings, corridors, doorframes, props, consoles, beds, desks, characters, robots (`.glb`)
- **synty-gltf/**: Industrial/sci-fi props — barrels, pipes, conveyors, panels, chairs, tables, machinery (`.glb`)
- **kenney-space/**: Modular corridor/room pieces — corridors, corners, junctions, intersections, gates, rooms (`.glb`)
- **kenney-chars/**: Character models
- **kenney-blaster/**: Weapon models
- **quaternius-robot/**: Robot character model
- **Characters/**: Astronaut and mech character models (`.gltf`)
- **Vehicles/**: Rovers and spaceships (`.gltf`)
- **Items/**: Pickups — keycards, crates, health, etc. (`.gltf`)

Priority for integration: station architecture (walls, floors, ceilings, corridors) → props and furniture → characters/robots → vehicles and items. Use `inspect-glb.cjs` to inspect model structure when needed.

## 3D Renderer Architecture

The 3D renderer lives in `src/render/display3d.ts` (~5500 lines). Key architecture notes:

### Scene Structure
- **Instanced meshes** for tiles: separate InstancedMesh for floor, corridor floor, walls, wall corners, doors, ceilings
- **Procedural textures**: floor grid, wall panels, corridor grates, caution stripes — all generated via canvas
- **Distance culling**: 12-tile Manhattan distance, corridor spatial buckets (6 tiles each), updated every 5 frames
- **Room groups**: `roomTrimGroups`, `roomDecoGroups`, `roomCeilGroups` for per-room visibility control

### Lighting Stack
- **Global**: AmbientLight + 3 DirectionalLights (key/fill/rim) + HemisphereLight
- **Player**: Green PointLight (follows player) + white fill light
- **Room lights**: PointLights at room centers, colored by room type, red/amber for hazards (with emergency flicker)
- **Corridor lights**: Dim blue every 5th tile along explored corridors
- **Door lights**: Red (locked, pulsing) or green (open)
- **Entity glow lights**: Per-entity PointLights with configured color/intensity/distance

### Camera System
- **Chase cam** (default, F2 toggle): Perspective, 2.5 units behind, 1.8 height, look-ahead 2.0, wall avoidance via walkability map, head-bob, FOV breathing (base 60 + 3 during movement)
- **Ortho cam**: Top-down/isometric, adjustable frustum (wheel) and elevation

### Visual Effects
- **Fog**: THREE.Fog adjusting near/far per camera mode
- **Fog-of-war**: Overlay planes — dark navy (unexplored, 0.92 opacity) vs blue-grey (memory, 0.45 opacity)
- **Hazard sprites**: Smoke wisps (grey, upward drift), heat glow (orange pulse), vacuum frost (blue sparkle)
- **Particles**: 400-star nebula backdrop with shader gradient, 120 ambient dust motes, 12-point movement trail
- **Entity animations**: Per-type rotation, bob, pulse, hover, wobble
- **Cel shading**: Toon gradient (4-step), OutlineEffect (F4 toggle), MeshStandardMaterial with roughness 0.7

### Room Decoration Pipeline
- `ROOM_DECORATIONS` lookup → GLTF models from Synty Space library
- `placeRoomTrim()`: baseboard, edge glow, top rail, door frames
- `placeRoomCeiling()`: cross-bracing beams every 3 tiles
- `placeCorridorArches/Pipes/StripLights/WallProps()`: corridor architecture

### Key Constants
- `COLORS_3D`: floor 0xcccccc, wall 0xddeeee, door 0xeeaa55, corridor 0xbbbbbb, background 0x060610
- Room wall tints: per-room-type vibrant colors (Power Relay = 0xffee88, Life Support = 0x99ddff, etc.)
- Entity glow: DataCore 0xff44ff, Breach 0xff2200, EscapePod 0x44ffaa, Relay 0xffcc00, etc.

### Screenshot Tool
- `npm run screenshot` — Playwright-based headless Chromium capture
- Flags: `--seed`, `--turns`, `--overlay`, `--out`
- Saves to project root as `review_v*.png`

## Sprint Learnings (V34-V43 Reflection)

Key patterns and gotchas discovered during visual sprints:

- **Ground-level camera changes everything**: Lowering the chase cam from 1.8 to 0.7-1.2 transformed the game feel. All subsequent visual work (wall fixtures, floor detail, door gaps) is driven by what's visible at ground level.
- **Headlight is the hero light**: Adding a SpotLight to Sweepo and reducing corridor ambient lighting creates dramatic exploration atmosphere. Shadows from the headlight are the primary visual interest.
- **Context-aware parameters**: Camera FOV, height, distance, and fog should all adapt to room vs corridor context. Smooth lerp transitions between parameters prevent jarring cuts.
- **InstancedMesh for everything**: Floor strips, trim, emergency lights — always use InstancedMesh for repeated small elements. Draw call count is the main performance bottleneck.
- **CSS post-processing is free**: Vignette, scanlines, hazard borders — all CSS overlays with zero GPU cost. Layer via z-index.
- **Hazard sprites need userData type unions**: When adding new hazard types (spark, drip, scorch), expand the userData type assertion or it won't compile.
- **Shadow maps**: Only enable castShadow on the headlight SpotLight (512x512). Directional light shadows would require covering the whole map and are too expensive.
- **display3d.ts is 5500+ lines**: Consider splitting into modules if it grows further. The file has clear sections (textures, lights, camera, entities, corridors, rooms) that could be extracted.
- **Grep tool sometimes fails on large files**: Use bash grep as fallback when the Grep tool returns no results on display3d.ts.
- **Always check tile bounds**: Any code accessing `state.tiles[y][x]` must bounds-check first. Off-by-one errors crash the renderer silently.

## Sprint Learnings (V44-V61 Reflection)

Room-focused rendering paradigm shift and atmosphere refinement:

- **Room-focused rendering is transformative**: Showing only the current room + nearby corridors makes every room feel like a distinct discovery. The infrastructure (room sub-groups, distance culling, room transition detection) was already there — just needed tighter parameters.
- **Corridor darkness sells the atmosphere**: Reducing ambient to 35% in corridors with a brighter headlight creates genuine tension. The contrast between dark corridors and lit rooms is the game's strongest visual element.
- **Fog is the most powerful atmosphere tool**: Dynamic fog parameters (near/far) varying by room vs corridor create more visual impact than adding geometry. Chase cam fog near=2/far=10 in corridors is claustrophobic perfection.
- **Hazard-reactive everything**: Room center glow, headlight color, fog color, screen border, dust particles — everything should react to the current hazard state. Creates visceral danger feedback.
- **Player animation adds life**: Forward tilt, turn lean, and movement bob on Sweepo are tiny changes (~20 lines) but make the character feel alive and weighty.
- **Idle camera sway prevents deadness**: Even 0.04-unit lateral drift at 0.5Hz makes a static scene feel like it's "breathing". Never have a truly static camera.
- **Property declarations before use**: Always add class property declarations before writing code that references them. Missing `_doorSlideState` declaration caused a TypeScript error.
- **Performance budget per-room**: Room-focused rendering means you can increase decoration density (7→9), wall props (3→5), corridor props (12%→20%) since only one room renders at a time.
- **Transition effects need CSS overlay**: The room transition fade uses a simple fixed-position div with opacity animation. Simpler and faster than a Three.js post-processing pass.
- **Map state to visual, don't store visual state**: Room haze meshes store hazard color but should derive it from game state each frame. Storing visual state leads to stale data when game state changes.

## Sprint Learnings (V65-V74 Reflection)

Entity personality and environmental storytelling through animation:

- **Entity awareness sells the world**: CrewNPC facing the player, Drone eye tracking, RepairBot extending its arm — these tiny reactions (3-5 lines each) make entities feel conscious rather than static props. Use `atan2` for smooth face-player rotation with shortest-path lerp.
- **Heartbeat/beacon rhythms > sine waves**: MedKit's double-beat pulse (`pow(sin,8) + pow(sin+offset,12)`) and EscapePod's beacon flash (modulo timing with narrow window) feel more organic than simple sine oscillations.
- **Screen glow projection transforms rooms**: Adding a PointLight to Console/LogTerminal that casts colored light onto the floor creates the sci-fi control room look for free. Sync light intensity with material flicker for coherence.
- **Volumetric light cones are cheap drama**: A semi-transparent ConeGeometry with additive blending on Sweepo's headlight costs one mesh but adds massive corridor atmosphere. Opacity 0.03-0.045 is the sweet spot.
- **Room signatures = room identity**: A brief tinted CSS overlay on room entry (300-400ms fade) makes each room type feel distinct. Purple for Data Core, white for Med Bay — simple but effective.
- **Damage state on the player model**: Antenna droop, ground glow color shift, body sparks — these visual cues communicate HP without UI. The stun jitter (random rotation) is immediately readable.
- **Evacuation needs visual escalation**: Red ceiling emissive, klaxon ambient pulse, persistent hazard border — the endgame should feel dramatically different from exploration. Phase-reactive effects stack.
- **Room exit transitions matter**: Going from room to corridor should feel like "leaving safety". Brief darkness pulse + FOV tighten creates the contrast needed.
- **Corridor steam vents = atmospheric filler**: Occasional sprite puffs near the player fill the visual silence of corridor traversal. Pool and dispose to avoid memory leaks.
- **Scan grid ripple gives feedback**: Floor grid squares that flash as the scan wave passes make scanning feel satisfying and tech-forward. Use additive blending for the glow-through-floor effect.

## Sprint Learnings (V75-V84 Reflection)

Layered atmospheric effects and ground-level visual feedback:

- **Corridor light shafts make dark corridors readable**: Volumetric cylinders (CylinderGeometry, additive blend) descending from ceiling lights with floor pool discs create visible "islands of light" in corridors. Distance-based fade + hazard-reactive flicker keeps performance tight.
- **Floor-level effects ground the player**: Footstep dust kicks, headlight ground spots, and breath puffs all operate near y=0. These tiny effects (0.04-0.15 opacity) are surprisingly impactful because the chase cam is low-angle and they fill the foreground.
- **Discovery sparkles reward exploration**: First-time room entry triggers 12 room-tinted twinkle sprites. The 15Hz twinkle (`sin(life*15)`) reads as magical/rewarding without being overwhelming. Track visited rooms in a session Set.
- **Wall LEDs sell "active station"**: 4 tiny blinking sprites per room wall with position-based phase offsets create the illusion of computer panel status indicators. Each blink cycle needs both a primary and secondary flash for visual interest.
- **Sweepo personality through the eye**: A single emissive sphere (0.04 radius) on the bot's front with HP-reactive color (green→amber→orange→red) adds character. Combined with antenna droop and ground glow, the bot tells its story visually.
- **Breath puffs in corridors**: Small white puffs from Sweepo's front in corridors (every 2-3s) sell the "cold damaged station" atmosphere. Must drift in facing direction, not just upward.
- **Entity shadow discs vs shadow maps**: A simple dark circle (0.15 opacity) under each entity is cheaper than shadow casting and always visible. Works alongside the existing ground ring for a grounded look.
- **Puzzle feedback with energy dots**: Sprites traveling along bezier curves between activated relays give satisfying visual confirmation that "power is flowing". Store the curve reference alongside the line for animation.
- **Child index stability**: When adding meshes to Sweepo's group, always append (don't insert) to avoid breaking existing damage visualization that references specific child indices.
- **Compass HUD below minimap**: Canvas-rendered compass works better than Three.js overlay because it stays pixel-sharp. Cardinal labels rotating with `playerFacing` gives instant directional awareness.

## Sprint Learnings (V91-V100 Reflection)

Screen-space overlays, Sweepo detail, and minimap utility:

- **Antenna as gameplay signal**: Converting Sweepo's antenna tip to MeshBasicMaterial enables real-time proximity detection feedback. Pulse rate 2-8Hz scales with distance to nearest unexhausted entity — players learn to "follow the signal" intuitively.
- **CSS overlays are cheap state indicators**: Stun static (randomized gradient noise), HP vignette (inset box-shadow), sensor visor tint (mix-blend-mode:multiply) — all use DOM elements with z-index layering. Create/show/hide pattern avoids DOM churn.
- **Multiple damage indicators compound**: Headlight flicker (multi-frequency sine), HP vignette (pulsing red edges), body sparks, eye color shift, antenna droop — each individually subtle, together they create escalating dread as HP drops. The headlight flicker is most impactful because it affects what the player can see.
- **Pipe leaks from known positions**: Reusing `corridorPipeTiles` Set to spawn drip particles at actual pipe locations ensures visual coherence. "Find nearest pipe tile" search is O(n) on the Set but runs infrequently (every 3-8s).
- **Minimap information density**: Room names (abbreviated first word), entity shape icons, room checkmarks, and facing arrows all fit on a small canvas without clutter. Each uses a different visual channel (text, shape, symbol, line) to avoid collision.
- **Cleaning brushes sell identity**: Two small counter-rotating cylinders under Sweepo (children 6-7) that spin fast when moving and slow when idle. Tiny detail that reinforces "this is a cleaning bot" every time the player moves.
- **Sensor visor tint is barely visible but important**: 6% opacity color wash with mix-blend-mode:multiply is almost subliminal, but players notice when it's removed. The breathing animation (1.5Hz) prevents it from feeling static.
- **Append-only child strategy proven**: Through V91-V100, Sweepo group grew to 8+ children (body, head, antenna, tip, glow, eye, brushL, brushR) with zero index breakage. Always add new meshes at the end.

## Sprint Learnings (V101-V110 Reflection)

Minimap utility, environmental warnings, and interaction feedback polish:

- **Minimap as planning tool**: Hazard icons (V101), room checkmarks (V98), exploration % (V107), and room names (V94) collectively turn the minimap from a simple map into a strategic planning overlay. Players can identify which rooms need attention, where dangers are, and how much they've explored without moving.
- **Idle animations sell character**: Antenna sway (dual-frequency 1.2Hz + 0.7Hz, V102) makes Sweepo feel alive when stationary. The layered frequencies avoid mechanical repetition — a single sine wave looks robotic, two create organic motion.
- **Entity-specific interaction colors**: Using ENTITY_COLORS_3D lookup in flashTile (V103) means each entity type has a distinct interaction feel. Brightening particles +60 per channel ensures visibility against the entity's base color.
- **Flicker ratio as shared state**: Storing `_headlightFlickerRatio` (V104) as a class property lets cone mesh and ground spot sync without recalculating. Single source of truth for multi-element visual effects.
- **Door proximity as spatial storytelling**: Unlocked doors brightening on approach (V105) creates a "motion sensor" feel. The contrast with locked doors' red pulse tells players at a glance which doors they can enter. Simple distance-based lerp, big navigation payoff.
- **Following crew glow as social signal**: Green emissive on following NPCs (V106) provides constant reassurance that rescued crew are still with you. Pulsing prevents it from blending into static scene lighting.
- **Breach danger rings scale to threat**: Additive-blend red rings (V108) with expanding pulse draw the eye to active hazards without blocking gameplay. The cleanup-on-seal pattern (remove from scene when userData._sealed flips) prevents visual artifacts.
- **Sparkle pool reuse for different effects**: Relay activation sparks (V109) reuse `_discoverySparkles` pool with high `_driftY` values for upward burst. Same lifecycle management (spawn, drift, fade, cleanup) serves both ambient sparkles and event bursts. Pool reuse > new particle system.

## Sprint Learnings (V111-V120 Reflection)

Entity animation completeness, particle systems as feedback, and Sweepo personality:

- **Complete animation coverage matters**: Animating all 4 remaining static entity types (V110: PressureValve, RepairCradle, ClosedDoor, Airlock) eliminated visual deadness. Even tiny motion (0.01 radian door tremor, 0.15 radian arm oscillation) prevents entities from feeling like props.
- **One-shot spawn flags for periodic particles**: PowerCell sparks (V111), DataCore arcs (V119) use `_sparkSpawned`/`_arcSpawned` boolean on userData to prevent spawning every frame during the brief spark window. Pattern: set true on spawn, reset false when window passes.
- **Separate animation for distinct behavior**: Splitting SecurityTerminal from LogTerminal (V112) enables lens tracking, awareness pulsing, and idle sweep. Shared code with minor differences is worse than separate blocks when behaviors diverge significantly.
- **Eye emotion sells personality**: Blink (Y-scale squish), squint (scale 0.7 at low HP), widen (scale 1.3 on interaction) — three simple scale changes give Sweepo expressiveness (V113). The widen timer triggered from flashTile creates cause-and-effect: interact → Sweepo reacts.
- **Lazily-created lights avoid upfront cost**: MedKit heartbeat light (V114), drone propwash rings (V115) create geometry on first animation frame, not during entity construction. Entities that never enter view never allocate their animated elements.
- **Visual feedback for core loop is critical**: Cleaning sparkles (V116) are the single most important particle effect because they reward the primary gameplay action. Dirt threshold (>30) ensures sparkles only appear when cleaning is meaningful.
- **Damage feedback layers**: Emissive body flash + actual sprite sparks (V117) + headlight flicker + HP vignette + eye color + antenna droop = 6 simultaneous damage indicators. Each addresses a different perception channel (body, particles, light, screen edges, eye, posture).
- **Minimap attention drawing**: Pulsing rings on key entities (V120) use globalAlpha for clean fade without creating permanent canvas state. Ring radius oscillation (±1.5px) is subtle enough to not obscure underlying map data.

## Sprint Learnings (V121-V130 Reflection)

Interaction feedback, atmospheric layers, and animation lifecycle management:

- **Single reusable indicator sprite**: The floating interact indicator (V121) creates one sprite, reuses it across frames by updating position/visibility. Avoids per-frame allocation for constantly-updating UI elements. Pattern: create lazily, hide when no target, show when target found.
- **CSS overlays complement 3D rendering**: Room atmosphere tint (V123) uses a fixed div with `mix-blend-mode: soft-light` at 4% opacity — imperceptible individually but creates subconscious color association. CSS post-processing is nearly free compared to shader-based alternatives.
- **Scout light for spatial awareness**: Forward blue PointLight (V124) uses 5% lerp to smoothly follow player facing direction 3 tiles ahead. Hidden in rooms (ceiling lights suffice), only active in corridors where visibility is the challenge.
- **World-to-local conversion for eye tracking**: Sweepo eye look direction (V126) converts world-space entity direction to local space using player rotation matrix. Simple 2D rotation: `localX = cos(rot)*dx + sin(rot)*dz`. Prevents eye from "snapping" when player turns.
- **One-shot discovery burst pattern**: EvidenceTrace golden burst (V125) uses `_discoveryBurst` flag on entity userData — fires once when player is within 3 tiles, never again. Prevents repeated triggering as player moves in and out of range.
- **Minimap trail aging**: Player trail (V128) records positions at 1+ tile intervals, ages each dot every frame (age 0→1), removes when expired. Linear alpha decay creates natural fade. Cap at 40 entries prevents unbounded growth.
- **Relay pulse wave as chain reaction visual**: Pulse waves (V129) spawn from activated relay position, travel along all connected curves at 4.5x normal dot speed. Pending pulse queue bridges the gap between activation detection and curve rebuilding.
- **Collection fly-to-player animation**: Instead of instant entity removal (V130), pickup entities arc toward player with ease-in acceleration, spin, shrink, and opacity fade. Reparent from entityGroup to scene so they stay visible during animation. Traverse children for opacity since GLTF models have nested meshes.

## Sprint Learnings (V131-V140 Reflection)

Particle physics, 2D-3D parity, and cinematic polish:

- **Breach vacuum suction on particles**: Inverse-square gravitational pull (V131) applied to sparkles, dust kicks, and breath puffs toward unsealed breaches. Range-limited (4 tiles) with `pull = delta * 2.0 / (dist² + 0.5)` prevents division-by-zero. Reuse `_breachPositions` array across all particle loops to avoid recomputing.
- **Sparkle pool drift extensions**: Adding `_driftX`/`_driftZ` (V132) to the existing sparkle pool lets radial airlock wind streaks reuse the same particle system. Check with `if ((sp as any)._driftX)` avoids adding properties to all sprites — only wind streak sprites carry drift.
- **HP-reactive lighting as body language**: Headlight color shift (V133) tells the player about bot health without UI reading. Four tiers map cleanly to color temperature: cool white → warm → amber → red-orange. Room hazard tints override to prevent conflicting signals.
- **Damped spring for appendage physics**: Antenna wobble (V134) uses `sin(t * freq) * amp * exp(-decay)` for natural bounce during movement. Two frequencies (14Hz Z, 11Hz X) prevent symmetry. Idle uses slower sinusoidal sway with 0.9 exponential decay on cross-axis.
- **Minimap as information canvas**: Fog border (V135), turn counter (V136), and player trail (V128) transform the minimap from passive map to active dashboard. Each feature uses minimal canvas operations — the fog border is just one `fillRect` per frontier tile.
- **Game over orbit camera**: Simple `sin/cos * radius` orbit (V138) creates cinematic end-of-game feel. Initial angle from player facing prevents jarring camera jump. Only 4 lines of math in the animate loop.
- **2D-3D parity via Explore agent**: When feature novelty runs dry, systematic gap analysis between display.ts and display3d.ts (V139-V140) identifies high-value ports. Scanner compass and turn warning are gameplay-impactful, not just visual polish.
- **Avoiding duplicate indicators**: Always search existing code for similar functionality before adding new indicators. V140 initially added a deduction-ready indicator that duplicated existing `[NEW]` tag — caught by code review before commit.

## Development Conventions

- **Deterministic**: All simulation seeded and reproducible (ROT.RNG.setSeed)
- **Testable**: Golden seed integration test is the north star (seed 184201)
- **No fog-of-war** initially (for debugging and agent play)
- **Sim/render separation**: Game logic must never depend on rendering
- **Controller-first**: No typing required; action bar covers all interactions
- **Pure functions**: step(state, action) → state' pattern for simulation
- **ESM modules**: `"type": "module"` in package.json, `.js` extensions in imports
