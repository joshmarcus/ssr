# Golden Seed 184201 — Power Routing Puzzle Design

## Overview

The MVP puzzle is a **thermal-gated power routing** challenge. The player must restore power to the Data Core door (D17) by diagnosing and mitigating an overheating relay (P03) in the Life Support sector. The Thermal sensor upgrade is the key enabler — without it, the player cannot identify which relay is the problem or confirm that the fix worked.

---

## Puzzle Structure

### The Problem

Relay P03 in Life Support is overheating due to a failed coolant loop (Loop B). The heat cascade has already caused an automatic load-shed that depowered Door D17, sealing the Data Core. If P03 reaches critical temperature (intensity 6), it trips permanently and the reroute becomes much harder (requires a longer path through Vent Control first).

### What the Player Knows at Start

- The station is silent. The bot (A3) starts in Arrival Bay with only a Cleanliness sensor.
- All rooms are visible (no fog of war), but panels show limited information without the right sensor.
- Panels P03 and P04 are visible on the map as generic "Relay Panel (status unknown)" markers.
- Door D17 to the Data Core shows "LOCKED — NO POWER".

### What the Player Learns from Logs

The log entries are distributed across terminals and provide the following clue chain:

1. **LOG_SYS_001** (morning diagnostic): Establishes that P03 was normal at 06:00. Temperature was 41C. Four relays total.
2. **LOG_SYS_002** (thermal warning): P03 temp rising. Coolant loop B pressure low. First direct pointer to the problem relay.
3. **LOG_CREW_001** (Vasquez personal note): Written the night before. Vasquez predicted P03 would fail. She left a backup routing procedure in Engineering Storage. This is a *soft hint* directing the player toward the Thermal module location.
4. **LOG_CREW_003** (Chen note): Chen smelled burning near the relay junction, confirmed heat with a portable thermal scan. Reinforces the thermal sensor as the diagnostic tool.
5. **LOG_SYS_004** (critical overheat): Confirms P03 hit 94C, D17 was depowered, coolant loop B offline. This is the "what happened" log.
6. **LOG_CREW_005** (Vasquez final note): The most direct hint. Explicitly says: equip thermal, identify the hot relay, reroute power before it trips. Also mentions P04 vent override as a fallback.

### The Thermal Sensor — Puzzle Key

**Without Thermal sensor installed:**
- All relay panels display: `Relay Panel (status unknown)`
- Heat overlays are not visible on the map
- The player can still interact with panels, but choosing the right one is a guess (there are multiple panels: P_STATUS in the Atrium, P03 in Life Support, P04 in Vent Control, P_CARGO in Cargo Hold)

**With Thermal sensor installed and active (TOGGLE_SENSOR THERMAL):**
- P03 displays: `Relay Panel (HOTSPOT)` — glowing red/orange indicator
- Heat overlay tiles appear around P03's position (18,6), showing the cascade spreading to adjacent tiles
- Other panels show normal temperature readings
- The player can clearly see which relay is the problem and confirm the fix worked

This is the game's first "map language teaching moment" — the Thermal sensor literally changes what the map communicates, demonstrating the core sensor-ladder mechanic.

---

## Solution Paths

### Path A: Direct Reroute (Optimal — Golden Path)

1. Pick up Thermal Module at (3,6) in Engineering Storage
2. Install it on bot A3
3. Toggle Thermal sensor on — P03 lights up as HOTSPOT
4. Travel east to P03 at (18,6) in Life Support
5. `INTERACT P03 REROUTE_POWER`
6. Result: Heat cascade stops. D17 receives power. Door unlockable.

**Turn budget:** ~22 turns (tight but comfortable before P03 trips at intensity 6)

### Path B: Vent-First Mitigation (Safer, Longer)

1. Pick up Thermal Module, install, toggle (same as Path A)
2. Travel to P04 at (19,11) in Vent Control Room
3. `INTERACT P04 OPEN_VENTS` — reduces P03 heat intensity by 2 immediately, then -1/turn for 3 turns
4. This buys significant time before P03 trips
5. Travel to P03 at (18,6)
6. `INTERACT P03 REROUTE_POWER`

**Turn budget:** ~28 turns (more margin, but longer route)

### Path C: Blind Guess (Risky, No Sensor)

If the player skips the Thermal module and goes directly to P03:
- P03 shows "status unknown" — the player might try REROUTE_POWER anyway
- **Design decision:** Allow the reroute to work even without Thermal, but:
  - The player has no confirmation the fix worked until they reach D17
  - No heat overlay means they might walk through dangerous heat tiles unknowingly
  - This path is "possible but punishing" — teaching the value of sensors

---

## Hazard Mechanics

### Heat Cascade (H01_OVERHEAT)

| Turn | P03 Intensity | Adjacent Tile Heat | Effect |
|------|---------------|-------------------|--------|
| 0    | 1             | 0                 | Barely warm |
| 1    | 2             | 0                 | Warm |
| 2    | 3             | 1                 | Adjacent tiles start heating |
| 3    | 4             | 2                 | Smoke begins |
| 4    | 5             | 3                 | Dangerous to bots |
| 5    | 6 (TRIP)      | 4                 | Relay trips — reroute disabled until repaired via P04 first |

- Heat intensity at source: +1 per turn (cap 6)
- When intensity >= 3: adjacent tiles gain +1 heat per turn (cap 4)
- Bot damage: at heat >= 5, bot takes 1 HP damage per turn on that tile
- Mitigation via P04 OPEN_VENTS: source -2 immediately, then -1 per turn for 3 turns

### Smoke

- Smoke appears on tiles with heat >= 3
- Smoke is cosmetic in V0 (does not block movement or vision, since there is no fog of war)
- Future: smoke could reduce sensor range or require atmospheric sensor to see through

---

## Clue Layering (Hint Tiers)

### Tier 1 — System Logs (Obvious)
Logs explicitly name P03, mention overheating, and reference coolant loop B failure. A player who reads the logs knows exactly what to do.

### Tier 2 — Environmental (Moderate)
With Thermal sensor, the heat overlay makes the problem visually obvious even without reading logs. The HOTSPOT label on P03 is unambiguous.

### Tier 3 — Crew Notes (Narrative + Guidance)
Vasquez's final note is essentially a walkthrough disguised as an in-character plea. Chen's note reinforces "use thermal scan." Priya's note hints at the backup bot in Robotics Bay.

### Tier 4 — Exploration (Implicit)
Even without logs or thermal, a player who visits all rooms will eventually find P03 and can try interacting with it. The worst case is trial and error across 4 panels.

---

## Post-Puzzle State

After successful REROUTE_POWER at P03:
- P03 status changes to `REROUTED — STABLE`
- Heat cascade stops (intensity freezes, then decays -1/turn)
- D17 status changes to `POWERED`
- Player can now `INTERACT D17 OPEN` to enter Data Core
- A new system log is generated: `[TURN N] PWR-MAIN: Relay P03 rerouted. Data Core wing POWERED. Door D17 operable.`
- Reaching T01 and executing `TRANSMIT` wins the game

---

## Design Rationale

This puzzle teaches three core SSR principles in sequence:

1. **Upgrades change perception** — The Thermal module transforms the map from opaque to legible. The player experiences the sensor ladder firsthand.
2. **Logs provide context, not just lore** — Reading Vasquez's notes isn't just flavour; it's the most efficient path to understanding the puzzle.
3. **Multiple valid approaches** — Direct reroute, vent-first safety play, or blind brute force all work. The game rewards preparation but doesn't hard-gate on it.

The 22-turn golden path leaves a comfortable 5-6 turn margin before P03 trips, meaning the player can explore a bit, read some logs, and still solve the puzzle in time. The vent path provides a deliberate "pressure release valve" for players who feel rushed.

---

## Detailed Clue Trail — Room by Room

This section documents exactly what the player perceives in each room, before and after acquiring the Thermal sensor, and how each piece of information directs them toward the solution.

### Arrival Bay (room_0)

**Without Thermal:** The bot powers on. The room description mentions scuff marks leading inward. No actionable puzzle information here — this is the orientation room.

**Logs available:** LOG_SYS_010 (Bot Controller status) is the first log the player can read. It confirms the bot has only a Cleanliness sensor and that Service Bot B07 is dormant in Robotics Bay. This plants two seeds: (1) the current sensor is limited, and (2) another bot exists elsewhere.

**Player direction:** The only paths forward are east to Central Atrium or south to Engineering Storage. Both are valid early moves.

### Central Atrium (room_1)

**Without Thermal:** The status board is mostly dead. Panel P_STATUS shows a generic station overview but with Cleanliness-only sensor, relay statuses read as "unknown." The player sees Door D17 to the east marked "LOCKED — NO POWER."

**With Thermal:** P_STATUS still shows limited relay info (it is an information panel, not a relay), but heat readings become visible — the player can see elevated ambient temperature to the east and south.

**Logs available:** LOG_CREW_002 (Okafor's commander log) — reveals that the crew was planning to route all power to Data Core, establishing why D17's power matters and foreshadowing the overload.

**Player direction:** The locked door is the first major obstacle. The player needs to find out why it has no power. Logs point toward relay problems. Engineering Storage is accessible to the south-west.

### Engineering Storage (room_3)

**Without Thermal:** The room description mentions a thermal module on a shelf. Entity I09 (Thermal Sensor Module) is visible as an item the bot can pick up and equip.

**Logs available:** LOG_CREW_001 (Vasquez personal note, written the night before) — this is the most important early log. Vasquez explicitly names P03, predicts it will fail, mentions coolant loop B, and says she left a backup routing procedure here. LOG_SYS_002 (Coolant Loop B pressure drop) — system confirmation that Loop B was losing pressure hours before the crisis.

**Key moment:** The player picks up the Thermal module and equips it. This is the puzzle's enabling action. From this point, the map becomes legible in a fundamentally different way.

**Player direction:** Vasquez's note directs the player to find and fix P03. The thermal module is the tool to do it. The player should head east toward Life Support.

### Power Relay Junction (room_4)

**Without Thermal:** A generic description of conduit runs. No panels to interact with directly — this is a transit room connecting the upper and lower halves of the station.

**With Thermal:** Heat overlay tiles become visible, showing elevated temperatures radiating from the east (toward Life Support where P03 is located). The "visible heat distortion" in the room description becomes confirmed by sensor data. This is the thermal gradient that guides the player directionally.

**Player direction:** The heat gradient points east toward Life Support. The player can also head south toward Robotics Bay or Charging Bay, but the thermal data creates urgency to go east.

### Life Support (room_5)

**Without Thermal:** Panel P03 shows "Relay Panel (status unknown)." The room description mentions an overheating relay panel with red warnings — the room text itself is a hint, but the panel data is opaque.

**With Thermal:** P03 displays "Relay Panel (HOTSPOT)" with a glowing indicator. Heat overlay tiles surround the panel position at (18,6), showing the cascade spreading outward. The thermal reading is unambiguous — this is the problem relay. The player can now execute `INTERACT P03 REROUTE_POWER` with confidence.

**Logs available:** LOG_SYS_004 (Thermal Warning), LOG_SYS_006 (Critical Overheat) — if the player reads terminals here, they get system-level confirmation of what the thermal sensor already shows.

**Key moment:** The player interacts with P03 and reroutes power. The heat cascade stops. This is the puzzle's resolution.

### Vent Control Room (room_8)

**Without Thermal:** Panel P04 shows "VENT STATUS: SEALED." The player can interact with it but may not understand why.

**With Thermal:** Heat readings in this room are lower than Life Support, confirming the vents are sealed and preventing heat dissipation. The panel's function becomes clear — opening vents would reduce heat in the affected sectors.

**Logs available:** LOG_SYS_007 (Vent Auto-Seal), LOG_SYS_009 (Cascade Alert mentioning P04 OPEN_VENTS) — both point to P04 as a mitigation tool.

**Player direction:** This is the safety valve for Path B. A player who comes here first can `INTERACT P04 OPEN_VENTS` to buy time before heading to P03.

### Robotics Bay (room_7)

**Without Thermal:** Service Bot B07 is visible in its dock, powered down.

**With Thermal:** No significant thermal data here — the room is cool and stable.

**Logs available:** LOG_CREW_004 (Priya's emergency note) — reveals that Priya powered down the bots to reduce grid draw, and provides badge override PRIYA-7741 for B07. This is a future-proofing clue for post-MVP content (salvaging B07).

**Player direction:** This room is optional for the MVP puzzle. It rewards exploration with narrative context and hints at expanded gameplay.

### Data Core (room_2) — After Puzzle Resolution

**After reroute:** Door D17 changes to "POWERED." The player can `INTERACT D17 OPEN` to enter. Inside, terminal T01 accepts the `TRANSMIT` command. Executing it triggers the victory condition.

---

## Clue Density and Redundancy

The puzzle is designed with deliberate redundancy so that no single missed clue makes it unsolvable:

| Information needed | Sources providing it |
|---|---|
| P03 is the problem relay | LOG_SYS_004, LOG_SYS_006, LOG_CREW_001, LOG_CREW_003, LOG_CREW_005, Thermal sensor overlay |
| Thermal module location | LOG_CREW_001 (mentions Engineering Storage), room_3 description, item visible on map |
| Reroute is the fix | LOG_CREW_005 (explicit procedure), LOG_SYS_009 (mentions reroute at P03), LOG_SYS_011 (says reroute procedure available) |
| P04 vents as backup | LOG_SYS_007, LOG_SYS_009, LOG_CREW_005 |
| D17 is power-gated | LOG_SYS_005, LOG_SYS_006, door display on map |

A player who reads zero logs can still solve the puzzle with the thermal sensor alone (the HOTSPOT label is self-explanatory). A player who skips the thermal sensor can solve it by reading logs and guessing which panel is P03. The puzzle is generous but rewards engagement with both systems.
