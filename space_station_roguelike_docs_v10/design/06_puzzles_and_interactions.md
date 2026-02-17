# Puzzles & Interactions

## Puzzle principles
- Every puzzle should be solvable with in-game information (no external guessing).
- Puzzles should integrate with **systems** (power, air, doors) and **sensors** (what you can perceive).
- Keep puzzle difficulty from spiking: provide optional hints through extra exploration.

## Puzzle categories (MVP set)
1. **Power routing**
   - Connect source → relays → target while avoiding overload.
2. **Pressure / leak management**
   - Identify leak direction (atmos sensor), seal with tool, rebalance airlocks.
3. **Access control**
   - Recover badge/codes; override via terminal mini-puzzle.
4. **Robotics salvage**
   - Harvest parts; repair disabled units; swap chassis.
5. **Signal relay**
   - Place/activate relays to extend network coverage.

## Puzzle templates (parameterized)
Each puzzle is described by:
- inputs (sensors required)
- constraints (timers, hazards, limited power budget)
- solution checks (state predicates)
- reward (unlock/gain)

## Hints
- Primary hint: log entries and system alarms.
- Secondary hint: environmental traces in sensor modes (heat, dirt trails, EM patterns).
- Tertiary hint: optional “assistant” subsystem once restored (e.g., diagnostic AI gives vague guidance).

## Combat-lite hazard encounters (optional)
- Instead of fighting: disable, trap, or outsmart malfunctioning drones by manipulating doors and power.


## Thermal-first MVP puzzle seed
- **Hotspot relay**: one of several relays is overheating; Thermal reveals which. The player must reroute power or open vents to cool it before it trips, then use it to power the objective door.
