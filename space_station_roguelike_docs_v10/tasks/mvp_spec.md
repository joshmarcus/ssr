# MVP Spec — Vertical Slice (Terminal V0 (Turn-based))

## MVP goal
A 10–15 minute run proving the loop:
connect → explore via sensors → solve a subsystem puzzle → unlock objective → transmit.

## Non-goals (for MVP)
- No full procgen station graph (hand-authored small map is fine)
- No complex enemy AI
- No deep meta progression (just a placeholder unlock screen)
- No elaborate still-frame imagery (text descriptions ok)

## MVP incident framing
- Incident archetype: **Fire/overheat cascade** (localized) + partial power loss
- Player goal: restore power to a critical door and prevent a spread that blocks the route.

## Visibility (V0)
- Entire station is visible (no fog-of-war).
- Sensors provide legibility and puzzle clues rather than gating discovery.

## Station
- 10 rooms + corridors
- 1 locked door (power-gated)
- 1 robotics bay (recovery option)
- 1 objective room (data core)

## Player bot
- Janitor rover
- Verbs: move, clean, interact, scan
- Movement is grid-based but time-based (e.g., 0.20s per tile).

## Upgrades in MVP
Pick 1 sensor package:
- **Thermal** (first non-cleanliness sensor)
Place the sensor upgrade in a reachable side room (e.g., Engineering Storage).

## Puzzle
- **Power routing** (stub UI) + **hotspot identification**:
  - use Thermal to locate the overheating relay/conduit
  - activate the correct relay → route power to the door
  - activate relay → route power to door
Success:
- unlocks the data core door
- generates a system log entry

## Hazards (per turn)
Pick one hazard that updates once per turn:
- **Heat/Smoke spread** (increasing heat + smoke intensity on tiles)
OR
- **Overheat cascade** (hot zone expands unless mitigated)

- Opening Systems or Logs pauses by default.
- Field mode runs in real time.
- Optional: slow mode toggle (can defer).

## Evidence / narrative
- 10–15 log entries from templates:
  - power events, door accesses, short personal note
- Display in log list.

## Recovery (hybrid requirement)
If the bot “fails” (hazard death or debug kill):
- allow transfer to a dormant service bot in Robotics Bay, if powered
- if not powered, allow dispatch of probe bot (cooldown + cost)

## Controller requirements
- Everything reachable via pane navigation + action bar.
- No typing required.

## Win/Lose
- Win: reach data core and transmit.
- Lose: no bots reachable + no probe available.

## Acceptance criteria
- Deterministic state with a seed.
- Same seed → same map + placements + logs.
- Controller-only playthrough succeeds.
- Hazard demonstrably advances over time.

## Steam Deck smoke test (MVP, Playable bar)
- Run at 1280×800 and confirm:
  - controller-only completion (no keyboard required)
  - readable text with default or “Deck preset”
  - action bar usable without a mouse pointer
- It’s okay if:
  - users sometimes tweak settings (UI scale, performance)
  - optional typed commands are inconvenient (macros must cover everything)
