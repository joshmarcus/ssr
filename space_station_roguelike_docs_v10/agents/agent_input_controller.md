# Agent — Input & Controller Implementation

## Mission
Implement controller-first input for the whole game and make it impossible to create an unplayable UI state.

## Deliverables
- Input mapping:
  - move/select, confirm/cancel, pane switch, sensor cycle, action menu
- UI focus system:
  - consistent selection cursor
  - default focus on screen entry
  - escape/back always works
- Action bar:
  - context actions presented as buttons, mapped to controller buttons
- Virtual keyboard support is optional; not required for MVP.

## Acceptance tests
- Fresh install: complete MVP run without touching a keyboard.
- No “focus traps” (cannot get stuck in a panel).
- Rebindable controls (nice-to-have; can defer).

