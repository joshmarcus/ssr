# Agent — Terminal UI & UX (Controller-first)

## Mission
Create a V0 terminal renderer (traditional roguelike) with full visibility, then evolve toward the multi-pane console.
Create a terminal-like UI that is **fully playable on controller**, with typed commands as optional flavor/shortcut.

## Deliverables
- Panes:
  - Map pane (ASCII/tiles)
  - Log pane
  - Systems pane
  - Status pane
- **Action bar** (context aware) for field mode
- Monochrome theme + later color toggle (placeholder/module)
- Accessibility:
  - readable fonts, scalable UI, clear sensor summaries

## Interaction model
- Controller navigation supports:
  - pane switching
  - list selection
  - action execution
- Typed command line can exist for PC, but **no game-critical actions require it**.

## Must-have screens
- Help / tutorial overlay
- Status
- Map
- Systems list (stub)
- Log list + log read

## UX constraints
- Always provide a “Back” path.
- Avoid nested modals; prefer panels.
- Show the “equivalent command macro” when executing actions for vibe/learnability.


## Scope constraint
- Do not introduce dependencies on new art assets.
- Use glyphs, UI styling, and overlay rendering for visuals.

## V0 scope
- Single-screen terminal layout: map + status + log
- Full visibility (no fog-of-war)
- Minimal menus (inventory, systems) can be hotkeys
- Avoid any art dependencies (glyphs only)


## V0 renderer choice
- Use **ROT.js Display** for the glyph grid + status/log panels.
- Rendering must be pure: render from state each turn.
