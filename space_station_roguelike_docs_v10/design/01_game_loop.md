# Game Loop & Progression (Terminal V0, Turn-based)

## State machine
1. **Boot / Link Establishment**
   - Narrative cold open: failed video/audio → terminal handshake.
2. **Operator Console**
   - Systems, logs, inventory, objectives.
3. **Robot Field Mode (terminal roguelike)**
   - Grid exploration and interactions.
4. **System Puzzles**
   - Power routing, access control, robotics, life support.
5. **Evidence**
   - Read recovered logs/notes; optional deductions.
6. **Escalation**
   - Hazards worsen as time advances.
7. **End**
   - Win: complete primary objective and transmit.
   - Loss: no controllable bots + recovery exhausted, or catastrophic station failure.

## Time model (V0)
- **Turn-based / step-based**:
  - one player action advances time by one step
  - hazards update once per step
  - NPCs update once per step

This is easiest to test and ideal for agent development loops.

## Visibility model (V0)
- Entire station is visible from the start.
- Sensors are still meaningful (legibility, safer routes, puzzle-solving), but do not gate basic visibility.

Later versions can add:
- fog-of-war
- bandwidth constraints
- known-world vs true-world

## Progression
- In-run: upgrades + system unlocks + bot swaps
- Meta: light roguelite unlocks (optional)

## Recovery (hybrid requirement)
- Transfer control to another bot
- Spin up/activate a dormant bot
- Dispatch probe bot to dock (costs time/resources)

