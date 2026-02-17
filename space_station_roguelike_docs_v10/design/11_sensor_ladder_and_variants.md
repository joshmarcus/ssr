# Sensor Ladder & Variants (Variable by Run)

## Core idea
Sensors are not just upgrades; they are **alternate map languages**.
The order can vary by run, but procgen must ensure any puzzle requiring a sensor
is only generated after that sensor is plausibly obtainable.

## Baseline
- Start with **cleanliness** (janitor bot identity) + obstacle detection.
- Cleanliness reveals traces: smears, trails, residues, footprints.

## Sensor packages
Treat sensors as “packages” tied to zones/systems:

1. **Thermal** (Lab/Engineering)
   - reveals heat clouds, cold spots, active machines
   - enables puzzles: overheated conduit, frozen door, thermal leak tracing

2. **Atmospheric** (Life Support/Airlocks)
   - O2/CO2, pressure gradients, leak vectors
   - enables puzzles: seal breach, rebalance airlocks, smoke management

3. **Radiation** (Reactor/Containment)
   - hotspots, shielding gradients
   - enables puzzles: routing through safe corridors, shielding restoration

4. **Structural stress** (Hull/Construction)
   - stress lines, weak floors, collapse risk
   - enables puzzles: choosing safe paths, reinforcing bulkheads

5. **EM/Signal** (Comms/Data Core)
   - powered conduits, signal strength
   - enables puzzles: relay placement, device discovery

## Variable ordering rules
- Each run selects an **incident archetype** that biases sensor order.
- Example:
  - Fire incident: Thermal early → Atmos → Structural
  - Breach incident: Atmos early → Structural → Thermal
  - Reactor leak: Radiation early → Thermal → EM

## Hard constraints for solvability
- Never require sensor X to reach the zone that grants sensor X.
- If a gate requires sensor X (e.g., “find leak”), ensure the sensor package is on the critical path *before* that gate.
- If ordering is randomized, lock randomization to a set of valid permutations per incident type.

## Implementation suggestion
- Capability model includes `available_sensors`.
- Puzzle templates declare `requires_sensors`.
- Generator selects puzzle instances only when requirements can be met by planned progression.


## MVP recommendation
- First non-cleanliness sensor: **Thermal** (teaches the "map language" concept immediately)
- Pair with one hazard/puzzle that is only legible via Thermal (hotspot, fire, overheated conduit).
