# Visual Style — Representational, UI-First, No Art Pipeline

## Goal
Ship a strong aesthetic **without** requiring custom sprite/animation production.

We do this by making the *terminal UI + sensor modes* the primary “visuals,” and by using
procedural/typographic representation everywhere else.

## What “representational” means here
- The player never expects full video or high-fidelity imagery.
- The world is readable through:
  - ASCII/tiles (glyphs)
  - color/heat overlays (later unlocks)
  - simple icons from a built-in glyph set
  - short textual “still frame” descriptions generated from room tags

## Hard constraints (to protect scope)
- No bespoke character sprites.
- No hand-drawn room backgrounds.
- No animation requirements beyond simple UI/tiles effects (blink, pulse, scroll).
- Avoid new art dependencies (commissioning, pipelines, export formats).

## Rendering approach
### 1) Tile/Glyph map
- Use a fixed grid with:
  - walls: box-drawing glyphs or simple tiles
  - doors: a small set of glyph variants (locked/powered/open)
  - hazards: a small glyph set (smoke ~, heat ^, leak ≋, fire *)
- Optional: switch between ASCII and “clean tile” mode with the same underlying data.

### 2) Sensor overlays
Each sensor mode is an overlay layer:
- Thermal: heat clouds, hotspots, gradients
- Cleanliness: smears/trails
- Atmos: pressure vectors/leak arrows
- Radiation: hotspot halos
- Structural: stress lines
Implementation: render an overlay texture or per-tile tint (no new art).

### 3) Still frames (no images required)
When a camera is “requested,” return:
- a short textual vignette (2–4 lines) built from room tags + incident beats
- optionally an ASCII “thumbnail” (sparse blocks) that conveys layout only

Example:
> FRAME 12 (compressed)  
> Frost on the bulkhead. A scorched panel. Something dragged across the floor.

### 4) UI is the aesthetic
- Strong typography, borders, scanlines/glitch (optional)
- Consistent iconography (from a built-in glyph font)
- Clear focus/highlight for controller

## Testing rule
If a feature requires “we need new art,” it’s out of scope unless it can be represented with:
- a glyph, a tint, a border, a bar, or short text.
