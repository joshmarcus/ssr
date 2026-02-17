# Agent — Playtest & Balance (Real-Time)

## Mission
Add instrumentation and seed-based playtest tools for a real-time sim.

## Deliverables
- “Golden seed” list file
- Debug toggles:
  - show critical path
  - reveal fog-of-war
  - dump evidence table
  - hazard debug (spread visualization)
- Telemetry (local):
  - time-to-objective (seconds)
  - pause usage count/time
  - hazard damage taken
  - bot swaps / recoveries used
- Basic difficulty scaling:
  - station size
  - hazard rates
  - evidence density
  - recovery budget

## Output
- Short report per build with:
  - whether real-time feels stressful vs fair
  - whether pause/slow is sufficient
  - recommended rate adjustments


- Use the Agent Harness to run LLM playtests and produce transcripts.
