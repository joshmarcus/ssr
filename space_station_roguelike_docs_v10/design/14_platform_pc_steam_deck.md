# Platform Targets — PC + Steam Deck (Playable is OK)

## What “Playable” means for this project
We’ll treat Steam Deck as a first-class target, but we’re **not** going to chase perfection.
A “Playable” outcome is acceptable: the game runs and is enjoyable, even if users sometimes need
minor manual tweaks (e.g., selecting a controller config, using touchscreen for a launcher, etc.).

That said, many “Verified” criteria are still good product design — we’ll keep most of them as goals
when they’re cheap.

---

## Display targets
### Handheld (Steam Deck)
- Primary: **1280×800 (16:10)**.
- Secondary: **1280×720**.

### Docked (Deck / PC)
- Support arbitrary desktop resolutions.
- UI must scale gracefully (no tiny terminal text).

### Practical legibility bar (Playable)
- Provide **text size / UI scale**.
- Provide a “Deck preset” or “Handheld” preset that bumps text.

---

## Input targets
### Must-have (because it matches your game’s design)
- Full controller support for all gameplay and all menus.
- A clear focus/highlight system (no mouse required).

### Allowed under “Playable”
- Optional typed terminal commands can be awkward on Deck, as long as:
  - everything is doable via controller macros
  - any text entry is optional or has a workable fallback

---

## Text input policy
Preferred: avoid required text input entirely.

If you ever require text input (naming a save, entering a code):
- support an on-screen keyboard API, OR
- ship a controller-native text entry UI

If you don’t do this, you can still be Playable, but it adds friction.

---

## Launchers
Best: no launcher.

Playable-acceptable:
- a launcher is okay if it can be navigated via controller or (worst case) touchscreen.

---

## Build strategy
### Option A — Ship native Linux + Windows builds (recommended for Deck)
Pros: fewer Proton surprises.  
Cons: requires Linux QA.

### Option B — Ship Windows only and rely on Proton
Pros: one build.  
Cons: more compatibility risk.

---

## QA matrix (minimal)
- Steam Deck handheld: 1280×800, controller-only run completion.
- Steam Deck docked: 1080p, controller-only menu navigation.
- PC: 1080p + 1440p, controller-first + optional keyboard/mouse.

---

## “Steam Deck feel” guidelines
- Default UI scale should assume “handheld distance.”
- Make selection states big and obvious.
- Let players expand panes; avoid cramming tiny panels.
- Real-time stress must be fair: pause/slow should work well on Deck.
