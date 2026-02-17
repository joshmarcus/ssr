# Input & Controller-First UX

## Goal
The entire game is playable on a controller without feeling like a compromise.

## Core UI model
You have **two parallel interaction layers**:
1. **Menu/Panel layer (primary)**
   - Navigate panes, select actions, confirm/cancel.
2. **Command line layer (optional flavor + PC speed)**
   - Commands are surfaced as “macros” in menus.

## Controller mapping (suggested)
- Left stick / D-pad: move cursor / select tiles / navigate lists
- Right stick: switch panes (map ↔ logs ↔ systems) or pan map
- A: confirm / execute
- B: cancel / back
- X: context action menu (interact/use)
- Y: quick sensor toggle
- LB/RB: cycle sensor modes
- LT/RT: cycle entities/points of interest (doors, terminals, items)
- Start: pause / settings
- Select: help / tutorial overlay

## “Action bar” concept
In field mode, show 4–6 context-aware actions:
- Move
- Interact
- Scan
- Use Tool
- Toggle Sensor
- Open Console (systems/logs)

The action bar drives accessibility and reduces “typing dependency.”

## Command line as diegetic UI
Even on controller, we can keep the terminal vibe by:
- an on-screen “macro prompt” where selecting an action shows the equivalent command
- a history log of executed commands
- optional virtual keyboard input (not required to win)

## Accessibility requirements
- Every sensor mode has a text summary (“Heat high to NE; pressure leak W”).
- No critical info is conveyed by color alone.
- Font scaling and high-contrast mode.

## Tutorial strategy
- Teach the action bar first.
- Teach command macros as “advanced shortcuts.”


## Steam Deck considerations
- Target the 16:10 layout at 1280×800.
- Make the **action bar** the default experience; do not require typing.
- Controller glyphs must match controller mode; avoid keyboard/mouse prompts.
- Provide a text size slider and high-contrast option (small screen).
- If you include any required text entry, support on-screen keyboard APIs or a controller-native text input UI.

