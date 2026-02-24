# Feature Verification Log

Features requiring manual visual/browser verification. Review in-game via Claude Desktop (browser control) or manual playtesting.

Status key: `PENDING` → `VERIFIED` or `FAILED — {reason}`

---

## Sprint 174 — V344-V348 (2026-02-23)

### Subtitle auto-dismiss system
- **What to check:** System/sensor/warning messages auto-dismiss after 3-4 seconds without requiring keypress. Milestone/critical messages still need Esc to dismiss. Space key passes through to game input while subtitle is showing. Queue limited to 5 messages.
- **How to reach it:** Start a new game. Observe the subtitle bar at bottom of screen during the boot messages and first few turns.
- **Expected:** Messages appear and fade away on their own. No need to mash Space. Movement works even while subtitles are showing.
- **Status:** PENDING

### Loading overlay with progress bar
- **What to check:** A loading screen ("LOADING STATION DATA") with progress bar appears after the boot sequence and before the 3D scene is visible. No placeholder geometry should be visible.
- **How to reach it:** Start a new game (or reload the page). Watch the transition from boot text to 3D gameplay.
- **Expected:** Dark screen with progress bar fills to 100%, then fades out to reveal the fully-loaded 3D scene.
- **Status:** PENDING

### "ROOM CLEANED" no longer shows at T:0
- **What to check:** The tutorial objective banner should show "Clean this room [C]" at T:0, NOT "ROOM CLEANED".
- **How to reach it:** Start a new game. Look at the tutorial objective at the top of the screen immediately.
- **Expected:** Shows cleaning objective with progress bar at game start. Only shows "ROOM CLEANED" after player presses C.
- **Status:** PENDING

### Room transition fade doesn't stick
- **What to check:** Moving between rooms produces a brief dark flash that always fades away, even if the tab loses focus.
- **How to reach it:** Start a game, move to another room. While the fade is happening, switch tabs and switch back.
- **Expected:** Fade clears within 0.5-0.6 seconds regardless of tab visibility.
- **Status:** PENDING

### Hazard border cleared on title screen
- **What to check:** Returning to the title screen should not show any red/amber hazard border glow from gameplay.
- **How to reach it:** Play until hazard border appears, then return to title screen.
- **Expected:** Clean title screen with no gameplay overlays.
- **Status:** PENDING

### BUG-007: Sensor pickup blue sphere (MITIGATED)
- **What to check:** Whether picking up the sensor in Arrival Bay still creates an enormous blue sphere/dome obscuring the view. Scan wave ring expansion was reduced from 16x to 9x.
- **How to reach it:** Start new game, navigate to sensor pickup (green diamond), press Enter. Also toggle sensor mode with [T] key.
- **Expected:** Brief visual effect (expanding ring), no giant blue sphere.
- **Status:** PENDING — scan wave reduced in Sprint 175, needs visual verification

### Cleaning requires multiple actions (BUG-003 fix)
- **What to check:** Cleaning the starting room now requires 2-3 C presses, not 1.
- **How to reach it:** Start new game, press C to clean. Check the cleanliness % in the tutorial progress bar.
- **Expected:** Each clean increases cleanliness by ~15-25%, requiring 2-3 cleans to hit 60% goal.
- **Status:** PENDING

### New game message pacing
- **What to check:** Only "LINK ACTIVE" intro message appears at game start. CORVUS-7 lore messages don't appear until player takes first action.
- **How to reach it:** Start a new game. Do NOT press anything for 5 seconds. Observe subtitle bar.
- **Expected:** One intro message, no flood of 10+ messages. After first move, deferred messages appear with auto-dismiss.
- **Status:** PENDING
