# Player Bot & Upgrades

## Design goals
- Start **weak but readable**: the bot’s limitations are part of the fun.
- Attachments should create **new information** (sensors) or **new verbs** (tools), not just bigger numbers.

## Base bot (default: cleaning unit)
**Capabilities**
- Movement: slow, ground-only
- Interaction: bump/clean; can operate simple floor panels
- Sensor: cleanliness map + basic obstacle detection
- Inventory: 1 attachment slot, 1 battery slot

**Unique affordance**
- Cleaning reveals clues: blood residue, ash trails, leaked coolant, footprints, hidden symbols.

## Attachment categories
1. **Mobility**
   - Wheels upgrade (faster), tracks (debris), mag-clamps (zero-g sections), vent-crawler kit.
2. **Manipulation**
   - Gripper arm, cutter, pry bar, welding tool, foam sprayer (fire suppression), adhesive patches (seal leaks).
3. **Sensors**
   - Thermal, radiation, atmospheric, structural stress, chemical sniff, EM field, biosign.
4. **Comms**
   - Signal booster, mesh relay, antenna array (enables multi-zone control).
5. **Power**
   - High-capacity battery, fast-charge module, solar trickle (rare), capacitor burst.

## Slot system (simple)
- Core chassis has 3 slots:
  - Tool slot
  - Sensor slot
  - Utility slot
- Some bots have different slot layouts; swapping bots is a strategic choice.

## Bot swapping
- You can “inhabit” a new bot if:
  - You can connect via station network OR
  - You physically dock your current bot to a disabled unit (hard-wired transfer).
- Swapping should feel like “changing classes.”

## Enemy/hostile bots (optional early)
- Malfunctioning janitors, security drones.
- Prefer simple behaviors:
  - Patrol, react to sound/door triggers, short-range zap.
- Player counterplay is puzzle-like: disable via power cut, door trap, EMP module.

## Example upgrade curves (suggested)
- Early: gripper + thermal
- Mid: cutter + radiation + relay
- Late: multi-bot relay + structural stress sensor

