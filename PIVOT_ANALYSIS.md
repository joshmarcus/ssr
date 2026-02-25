# SSR Pivot Analysis — Game Design Review

*Date: 2026-02-25*

## Executive Summary

SSR has strong mechanical foundations (Sweepo, hazard systems, 3D station, turn-based grid, controller support) but the mystery/investigation layer — 175 sprints of procedural detective quiz — may not be delivering genuine fun. This document analyzes what's working, what's not, and proposes 10 alternate directions.

---

## What's Working

- **Sweepo as character**: A cleaning robot is inherently sympathetic with natural power asymmetry
- **Station as environment**: Hazard spreading, sensor-layered perception, atmospheric lighting, environmental degradation create real mood and real decisions
- **Turn-based resource management**: Limited turns, HP as a resource, exploration vs. survival tension
- **3D renderer**: Cel-shaded Three.js with 300+ models is a significant asset
- **Controller-first design**: Steam Deck targeting is smart and distinctive
- **Hazard systems**: Heat/smoke/pressure spreading and interacting creates spatial puzzles
- **Sensor ladder**: Changing what you perceive changes what the map means

## What's Not Working

### Problem 1: Two Games Duct-Taped Together

**Game A (Atmospheric Survival Exploration)** — visceral, immediate, satisfying. Every turn matters because the station degrades around you.

**Game B (Procedural Detective Quiz Show)** — walk into rooms, press button on glowing objects to read text, answer WHO/WHAT/OUTCOME multiple-choice. Get scored. Get HP penalties. An AI assistant tells you how you're doing.

### Problem 2: Procedurally Generated Evidence Can't Create "Aha" Moments

Obra Dinn works because every death scene is a handcrafted 3D diorama. Her Story works because the actress's performance carries weight. SSR's evidence is templated log entries with variable slots. No amount of "themed triplet pools" makes `"{engineer} filed maintenance request #{num}"` feel like discovery.

### Problem 3: Quiz Interface ≠ Investigation

Selecting from dropdown menus (WHO: scroll crew roster; WHAT: select from 12 activity enums; OUTCOME: pick from 7 outcomes) isn't detective work. It's a matching exercise.

### Problem 4: No Stakes Beyond Score

The autoplay bot solves everything perfectly with keyword matching. If an AI can brute-force the mystery, human players aren't doing detective work — they're doing data entry.

### Problem 5: Complexity Spiral

Evidence Accumulation, Contradiction Pairs, Crack Moments, Narrative Threads, Investigation Quality (30% scenes + 25% crew + 25% timeline + 20% contradictions), Investigation Momentum, Scene Confidence Badges, CORVUS-7 milestone commentary... all tracking systems that tell the player how well they're doing, rather than creating interesting choices.

---

## 10 Pivot Proposals

### 1. "Triage" — The Trolley Problem Station

The station is dying and you can't save everything. Each room contains a system or person that matters, but restoring one makes another unreachable (power is zero-sum, time is finite, routes collapse). Every run is 5-6 genuinely hard either/or decisions.

**Reuse**: Power routing, hazard systems, spatial navigation, crew NPCs
**Replace**: Mystery/deduction with triage board showing competing objectives with real mechanical tradeoffs
**Inspiration**: Papers Please, This War of Mine, Frostpunk

### 2. "Repair Rush" — Into the Breach on a Space Station

You can see the whole station map. Hazards will cascade in a known pattern over N turns (shown as forecast). Plan a route to address critical failures before chain reactions. Each turn is a spatial puzzle.

**Reuse**: Hazard spreading, power routing, sensor system, full map
**Replace**: Mystery with hazard forecasting and turn optimization
**Inspiration**: Into the Breach, Opus Magnum

### 3. "Echoes" — Environmental Storytelling Without Quizzes

Keep the dead station and crew, but strip all scoring/evaluation. The player's goal is purely mechanical (restore systems, evacuate). The story happens as environmental texture — object arrangements, ghost echoes, spatial evidence. No HUB, no deductions, no grading.

**Reuse**: Everything except mystery state tracking
**Replace**: Investigation systems with expanded environmental object variety
**Inspiration**: Dark Souls (environmental narrative), Gone Home, What Remains of Edith Finch

### 4. "Signal" — Asymmetric Multiplayer

One player is the remote operator (terminal view, gives directions). One player is the bot (limited vision, hazard pressure). Communication through a deliberately constrained channel.

**Reuse**: Dual-view architecture (already have terminal + 3D modes), sensor asymmetry
**Replace**: Single-player mystery with co-op communication puzzle
**Inspiration**: Keep Talking and Nobody Explodes, We Were Here

### 5. "Salvage" — Roguelike Deckbuilder with Physical Puzzles

Collect tools, parts, and attachments. Each pickup is a "card" in your loadout. Rooms present physical puzzle configurations requiring specific tool combinations. Roguelike progression = what tools you find and in what order.

**Reuse**: 3 attachment slots, entity interaction system, room variety
**Replace**: Evidence reading with spatial tool-combination puzzles
**Inspiration**: Slay the Spire, Backpack Hero, Void Stranger

### 6. "Contagion" — The Thing on a Space Station

Something is spreading — biological, digital, or both. Core mechanic is quarantine: sealing sections, decontaminating, deciding which areas to sacrifice. Some crew NPCs are compromised (you don't know which). Rescuing the wrong person spreads it.

**Reuse**: Pressure/airlock sealing, crew system with secrets/fates, hazard spreading
**Replace**: Retrospective mystery with real-time containment and trust mechanics
**Inspiration**: The Thing, Among Us, Pandemic

### 7. "Dispatch" — Multi-Bot Coordination Puzzle

Control 1-3 bots simultaneously. Each has different capabilities (cleaning, heavy lifting, electronics). Puzzles require coordinated action — one holds a door while another passes, one reroutes power while another accesses the terminal.

**Reuse**: Grid movement, entity interactions, room puzzles
**Replace**: Single-bot mystery with multi-agent spatial coordination
**Inspiration**: Lemmings, Spacechem, Baba Is You

### 8. "Last Light" — Survival Horror Roguelike

Drop mystery entirely. Something is in the station — not a monster you fight, but a presence detected through sensor readings (thermal signatures, pressure changes, EM spikes). Cat-and-mouse: complete objectives while avoiding detection by something you can never directly see.

**Reuse**: Sensor ladder (now threat detection), atmospheric effects, environmental systems
**Replace**: Evidence collection with antagonist AI and stealth mechanics
**Inspiration**: Alien: Isolation, Signalis, Darkwood

### 9. "Homecoming" — Cozy Station Restoration

The station isn't a crime scene — it's a fixer-upper. Sweepo restores the station for returning crew. Clean rooms, repair systems, decorate spaces, grow plants. Roguelike element: each station has different damage patterns and crew preferences.

**Reuse**: Cleaning mechanic, 300+ 3D models (as furniture), room variety, sensor system
**Replace**: All combat/hazards/mystery with restoration satisfaction and crew preference system
**Inspiration**: Powerwash Simulator, Unpacking, Stardew Valley

### 10. "Black Box" — One Great Authored Story

Instead of 6 procedural archetypes, write one really good story. Hand-craft 30-40 rooms with bespoke evidence, specific object arrangements, authored dialogue. A 2-3 hour narrative experience, not a replayable roguelike.

**Reuse**: 3D renderer, station environment, all presentation systems
**Replace**: Procedural generation with authored content; replayability with narrative depth
**Inspiration**: Outer Wilds, The Forgotten City, Case of the Golden Idol

---

## Recommendation

**Pivots 1, 2, or 8 have the highest ratio of "fun gained" to "work required."**

- **Triage** and **Repair Rush** reuse almost everything. Just reframe the goal from "investigate the past" to "make impossible choices about the present."
- **Last Light** transforms mood without changing much mechanically. The sensor system, atmospheric effects, and environmental storytelling are already horror-adjacent.

Common thread: **stop asking the player to read and evaluate text, and start asking them to make hard decisions in space.** The strongest systems are spatial and mechanical. The weakest system asks players to care about procedurally generated prose.
