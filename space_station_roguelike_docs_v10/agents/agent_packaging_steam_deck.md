# Agent — Packaging, Steam, and Steam Deck (Playable Target)

## Mission
Set up builds and a Steam release pipeline that makes Steam Deck a first-class citizen,
with **Playable** as the minimum bar.

## Deliverables
- Build/export scripts:
  - Windows x86_64
  - Linux x86_64 (recommended for Steam Deck)
- Steam Input baseline (recommended):
  - correct glyphs when controller active
  - sane default controller config
- In-game settings:
  - UI scale / text size slider
  - “Deck preset” defaults (UI scale + performance)
- Basic compatibility notes:
  - minimize middleware complexity to reduce Proton issues

## QA plan (Playable bar)
- Handheld: 1280×800
  - can start a run and reach MVP win condition using controller only
  - text is readable after choosing “Deck preset” if needed
- Docked: 1080p
  - menus navigable by controller
- PC: 1080p/1440p
  - controller-first; keyboard/mouse optional

## Acceptance tests
- Steam Deck: can complete MVP without a keyboard.
- No “dead ends” where only mouse is viable.
- UI scale can be increased enough to be comfortable on handheld.

## V0 note
- Packaging for Steam Deck can wait until the terminal V0 loop is fun.
- Prioritize deterministic builds and CI harness first.
