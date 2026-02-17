# Real-Time Simulation Design (Future Option)


## Why real-time can still feel “roguelike”
This document describes a *future* real-time mode. V0 ships turn-based for testability.

We keep a **grid** and **discrete actions** while time flows continuously.
Think: action durations + hazard ticks, rather than per-turn resolution.

## Golden rule
**Do not require twitch reflexes.**
Real-time is for *tension and urgency*, not dexterity.

To keep the game finishable and fair:
- allow **Pause** when opening console/logs by default
- allow **Slow** mode as an unlock or accessibility option
- keep action durations “chunky” (0.2s–2.0s) so controller play is calm

## Timing model (engineering contract)
- Use a **fixed timestep** (e.g., 60 Hz or 30 Hz simulation ticks).
- UI/render can run variable FPS, but sim must advance in fixed steps.
- Never use raw frame `delta` for authoritative sim; use tick counts.

### Determinism (for procgen + testing)
- Seeded generation is deterministic.
- Real-time sim is deterministic if:
  - sim uses fixed ticks
  - RNG calls are deterministic and occur in consistent order
  - any “random” hazard spreads are driven by a per-hazard RNG stream
- For replays:
  - record *input commands* with the tick they were issued
  - replay by feeding the same commands at the same ticks

## Entity updates
Each tick:
1. Process scheduled events (timers, door close, alarm triggers).
2. Update hazards (fire spread, leak venting, radiation damage).
3. Update NPC drones (rare; simple patrol).
4. Update player bot action progress (move/clean/use tool).
5. Apply outcomes (damage, item pickup, system unlock).

## Actions as “jobs”
Represent actions as jobs with:
- `start_tick`
- `duration_ticks`
- `can_interrupt`
- `on_complete` callback (e.g., cleaned tile, sealed leak)

Example jobs:
- Move 1 tile
- Clean tile
- Weld panel
- Deploy relay

## Pausing rules (design + UX)
- Entering System Mode pauses by default (configurable).
- Reading logs pauses by default.
- You can choose “hardcore real-time” later as a challenge mode.

## Minimal combat in real-time
Combat is resolved as hazards + simple drone contact:
- drone zap applies a debuff or damage over time
- counterplay is environmental (doors/power/EMP)
- avoid complex pathfinding battles

## ASCII representation
Even in real-time:
- the map can be ASCII-like (tile grid)
- animations can be minimal (blinking hazard glyphs, simple sprite swaps)
- “bandwidth” vibe remains: updates may appear as bursts or delayed refresh
