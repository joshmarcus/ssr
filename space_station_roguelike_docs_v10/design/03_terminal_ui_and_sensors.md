# Terminal UI & Sensor Views (Controller-first)

## UI promise
Everything is delivered through a “real” operator console:
- Monochrome at start
- Color unlock later (module or story unlock)
- Multiple panes: map, system readout, logs, command macros

## Interaction modes
1. **Panel navigation (primary)**
   - Designed for controller: lists, panes, action bar.
2. **Command macros (diegetic)**
   - Every action has an equivalent “command” shown for flavor and learnability.
3. **Typed command line (optional)**
   - PC shortcut; never required.

## Macro taxonomy (example)
- Movement: `MOVE N|S|E|W`
- Actions: `INTERACT`, `SCAN`, `USE <tool>`, `EQUIP <id>`
- Systems: `SYS LIST`, `SYS OPEN <id>`, `SYS ROUTE_POWER`
- Logs: `LOG LIST`, `LOG READ <id>`, `LOG FILTER <term>`

## Sensor modes (map shaders)
Each sensor mode changes what the map depicts:
- **Cleanliness**: clean/dirty gradient, smears/trails, “recent activity” hints
- **Thermal**: heat clouds, cold spots, heat sources
- **Atmospheric**: O2/CO2, pressure, leak vectors
- **Radiation**: hotspots, shielding gradients
- **Structural**: stress lines, cracked bulkheads, unsafe floors
- **EM/Signal**: powered conduits, active devices, signal strength

## “Camera” (still frames)
When available, a camera provides:
- Low-res monochrome still, heavily compressed, updated on demand
- Or a textual description generated from room tags (“A mess of cables. A cracked visor. Frost on the wall.”)

## Accessibility / readability
- Always provide a textual summary of sensor heatmaps.
- No critical info via color alone.
- Controller flows: back/cancel always works; no modal traps.


## Real-time indicators
- Time flow indicator: NORMAL / SLOW / PAUSED
- Hazard indicators: rising smoke, dropping pressure, etc.
- When Systems/Logs open, show "LINK HELD" (paused) to keep diegetic tone.

## Representational graphics (no bespoke art)
- Map uses glyphs/tiles; hazards are glyph effects.
- “Camera” output can be text-only vignettes (optionally ASCII thumbnails).
- UI typography + overlays carry the aesthetic.
