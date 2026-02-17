# Agent Harness — Text Mode Observations + Action API

## Goal
Enable:
- automated integration tests (headless)
- LLM playtesting (Claude / ChatGPT / others)
- deterministic replays
…without requiring any pixel parsing.

**Critical constraint:** observations must reflect *player knowledge* (fog-of-war, sensors, bandwidth limits).

---

## Architectural placement
Simulation Core (authoritative) is engine-agnostic.

Two front-ends:
1. **Human UI** (ROT.js Display): panes + glyph map + overlays + controller.
2. **Agent Harness** (CLI via tsx): emits observations and accepts actions.

Both use the same:
- action validation
- fog-of-war rules
- sensor rules
- link/bandwidth rules

---

## Observation renderer
### Contract
`render_observation(state, perspective) -> Observation`

Where `perspective` includes:
- current bot entity ID
- known map tiles / explored tiles
- available sensors
- link/bandwidth (what high-fidelity info can be requested)

### Output formats
Support both:
- **Text** (human/LLM readable)
- **JSON** (machine-friendly)

The text format should be stable and diff-friendly.
The JSON format should be versioned (`obs_version`).

---

## Text observation format (canonical)
```
OBS v1
SEED {seed} | TICK {tick} | MODE {FIELD|CONSOLE} | TIME {NORMAL|SLOW|PAUSED}
LINK {cur}/{max} (+{regen}/s) | RISK {0-5}

BOT {bot_id} "{bot_name}" | HP {hp}/{hpmax} | BAT {bat}% | POS ({x},{y})
SENSORS: {CLEANLINESS,THERMAL,...}
ALERTS:
- {alert line}
- ...

LOCAL MAP (centered on bot, {w}x{h}):
{glyph rows}

LEGEND:
# wall  . floor  D door  P panel  I item  ~ smoke  ^ heat  * fire

POI (known in view):
- {id} {type} "{name}" at ({x},{y}) attrs={k:v,...}
- ...

ACTIONS (available now):
- MOVE {N,S,E,W}
- INTERACT {target_id}
- TOGGLE_SENSOR {mode}
- SPEND_LINK {REFRESH_MAP|REQUEST_FRAME|DEEP_SCAN} args=...
- OPEN_CONSOLE {SYSTEMS|LOGS|NETWORK}
- WAIT {ticks}
```

Notes:
- Keep map window small (15–25 tiles) so LLMs can reason.
- POIs must have stable IDs and coordinates.
- `ACTIONS` must be exhaustive: never hide a valid action.

---

## JSON observation schema (v1 sketch)
```json
{
  "obs_version": 1,
  "seed": 184201,
  "tick": 9123,
  "time_mode": "NORMAL",
  "mode": "FIELD",
  "link": {"cur": 14, "max": 20, "regen_per_s": 0.2},
  "risk": 2,
  "bot": {"id":"A3","hp":7,"hpmax":10,"bat":43,"pos":[8,5]},
  "sensors": ["CLEANLINESS","THERMAL"],
  "alerts": [{"code":"SMOKE_SPREAD","text":"Smoke spreading in E-10"}],
  "map_window": {
    "center":[8,5],
    "w": 15,
    "h": 15,
    "glyph_rows": ["####...", "..."]
  },
  "poi": [
    {"id":"D17","kind":"DOOR","name":"Bulkhead Door","pos":[12,2],"attrs":{"locked":true,"powered":false}}
  ],
  "actions": [
    {"type":"MOVE","params":{"dir":["N","S","E","W"]}},
    {"type":"INTERACT","params":{"target_id":["D17","P03"]}}
  ]
}
```

---

## Action API
### Canonical action set (keep small)
- `MOVE(dir)`
- `INTERACT(target_id)`
- `USE_TOOL(tool_id, target_id?)` (optional for MVP)
- `TOGGLE_SENSOR(mode)`
- `OPEN_CONSOLE(panel)`
- `SPEND_LINK(kind, params)`
- `WAIT(ticks)`
- `SET_TIME_MODE(NORMAL|SLOW|PAUSED)` (optional; in MVP pause is implicit via console)

### Action envelope (JSON)
```json
{"action":"MOVE","params":{"dir":"N"}}
```

### Action result
Return:
- `ok` boolean
- error code/message if invalid
- a small list of events that occurred (for debugging)
- next observation

---

## Deterministic replay
### Recording
Record every accepted action with:
- tick index at which it was applied
- action payload (JSON)

Example:
```json
{"seed":184201,"actions":[
  {"tick":12,"action":"MOVE","params":{"dir":"E"}},
  {"tick":40,"action":"INTERACT","params":{"target_id":"P03"}}
]}
```

### Playback
- Initialize sim with seed.
- Step until next action tick.
- Apply action.
- Continue until end condition or tick limit.

**Property:** same seed + same action log => same terminal state.

---

## Test types enabled by harness
### 1) Golden-seed regression tests
- “This seed should be winnable in ≤ N seconds by scripted policy.”
- “Door D17 becomes powered after puzzle completion.”

### 2) Procgen solvability tests
- generator outputs critical path proof
- harness verifies path is reachable with capability plan

### 3) Fuzz tests
- random valid actions for N ticks must not crash
- state invariants (HP non-negative, map bounds)

### 4) LLM playtests
- LLM reads observations and outputs actions
- log transcript (obs+action) can be used as bug reports

---

## Player-knowledge enforcement
The harness must:
- respect fog-of-war and sensor limitations
- never reveal hidden entities outside discovered areas
- only reveal derived info if the player has the sensor and has scanned/refreshed

Implementation tip:
- maintain a `KnownWorld` layer separate from `TrueWorld`.
- observation renderer only uses `KnownWorld`.

---

## MVP subset
For MVP, implement:
- Text observation (no JSON required yet)
- Actions: MOVE, INTERACT, TOGGLE_SENSOR, OPEN_CONSOLE, WAIT
- Replay recorder (optional but recommended)


## V0 visibility mode (for fast iteration)
Add a harness flag:
- `--visibility=full` (default for V0): reveal entire station and all POIs
- `--visibility=player` (later): enforce known-world/fog-of-war rules

This lets agents and tests run on a fully observable environment first, then tighten constraints later.


## TypeScript CLI expectation (V0)
Implement an entry point like:
- `npx tsx src/harness/cli.ts --seed 184201 --visibility full`
It should print canonical observations and accept action JSON (stdin) or `--script`.
