# Agent — Narrative, Crew, Evidence

## Mission
Build the run narrative generator: crew list + incident archetype + evidence distribution.

## Deliverables
- Crew generator:
  - names (use a small embedded list)
  - roles
  - 1–2 relationships
  - 1 secret per run (MVP)
- Incident archetype selector (6 archetypes)
- Evidence generator:
  - 10–25 log entries, placed in rooms
  - badge IDs that connect to doors
- Deduction board (MVP):
  - match badge IDs to crew
  - unlock 1 door when enough matches are correct

## Constraints
- Keep everything template-driven.
- Evidence must support solvability (don’t generate contradictions).

## Hooks
- `generate_story(seed, station) -> StoryState`
- `place_evidence(station, story) -> station_with_evidence`

