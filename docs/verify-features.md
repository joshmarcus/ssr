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

---

## Sprint 176 — V353-V358 (2026-02-25)

### CORVUS-7 personality relay feed commentary
- **What to check:** CORVUS-7 personality-driven messages appear in the left narrative panel during gameplay: room-entry observations when entering named rooms, evidence discovery reactions when finding clues, idle musings every ~11 turns of inactivity. Three personality variants (analytical, empathetic, cryptic) selected by seed.
- **How to reach it:** Start a new game, explore rooms and collect evidence. Check the RELAY FEED panel on the left.
- **Expected:** Teal-colored CORVUS-7 messages interspersed with system messages. Room observations on first entry to named rooms (Command Center, Engineering, etc.). Evidence reactions when picking up logs/traces/items.
- **Status:** VERIFIED — visual QA confirmed CORVUS-7 messages in relay feed panel

### BUG-010: Suppressed low-value sensor/nearby messages
- **What to check:** "You detect:" sensor readouts and "X objects to investigate" messages no longer spam the subtitle bar or narrative panel. Scanner bar at bottom still shows nearby entities.
- **How to reach it:** Enter a room with multiple entities. Check that subtitle bar doesn't show "You detect:" messages.
- **Expected:** Clean relay feed without redundant sensor readouts. Action bar still shows interactable entities.
- **Status:** VERIFIED — confirmed suppressed in visual QA

---

## Sprint 177 — V359-V363 (2026-02-25)

### Unified scan action (BUG-015)
- **What to check:** Q key performs scan AND auto-activates sensor overlay. T key toggles overlay on/off (free, no turn cost). Tab only cycles interaction targets, not sensors.
- **How to reach it:** Start game, press Q to scan, check overlay activates. Press T to toggle overlay off. Press Tab near multiple entities to cycle targets.
- **Expected:** Q = scan + overlay auto-on. T = overlay toggle. Tab = interaction target cycle. No confusing sensor mode cycling.
- **Status:** VERIFIED — all three keys function correctly

### Optional room cleaning (BUG-014)
- **What to check:** Player can leave rooms freely without being forced to clean first. Cleaning is still available but not mandatory.
- **How to reach it:** Enter a room with low cleanliness and try to leave without cleaning.
- **Expected:** Player moves freely. No "Maintenance subroutine override" blocking message. Advisory warnings may still appear periodically.
- **Status:** VERIFIED — player moved between rooms freely

### Narrative panel polish
- **What to check:** Panel scrollable via mousewheel, turn timestamps (T##) on each message, [L] key toggles panel visibility, themed thin scrollbar.
- **How to reach it:** Play the game, accumulate messages in relay feed. Try scrolling up. Press L to hide/show panel.
- **Expected:** Smooth scroll, timestamps visible, L toggles panel with fade animation.
- **Status:** VERIFIED — all features working

### CORVUS-7 contextual mechanic tips
- **What to check:** CORVUS-7 personality-driven tips appear on first scan, first evidence, first deduction, first crew discovery, and first room exit. Three personality variants.
- **How to reach it:** Start new game, perform first scan (Q), find evidence, trigger deduction.
- **Expected:** Teal CORVUS-7 messages in relay feed providing personality-colored gameplay guidance.
- **Status:** VERIFIED — tips appearing correctly for all events

## Sprint 178 — V364-V368 (2026-02-25)

### Crew NPC personality discovery one-liners
- **What to check:** When first discovering a crew NPC, they speak an in-character line based on their personality trait and role (not just "They look shaken"). 20 unique lines across 5 personalities.
- **How to reach it:** Play until finding a crew NPC (typically Recover phase). Interact to discover them.
- **Expected:** Rich, character-driven first contact line with personality flavor (cautious = fearful, ambitious = commanding, loyal = worried about others, secretive = paranoid, pragmatic = practical).
- **Status:** PENDING

### Investigation case tracker HUD widget
- **What to check:** Small persistent tracker on right side showing WHAT→WHERE→WHY→WHO→BLAME deduction chain with colored symbols (green check, red X, orange diamond for unlocked, gray circle for locked).
- **How to reach it:** Start game, navigate to a room with evidence. The tracker should appear once deductions exist.
- **Expected:** Vertical/horizontal chain of labeled nodes with connecting lines. Colors update as deductions are solved.
- **Status:** VERIFIED — tracker visible with correct chain nodes

### CORVUS-7 investigation nudges
- **What to check:** When player lingers in investigation/recovery phase, CORVUS-7 provides contextual nudges ("Have you tried scanning nearby compartments?" etc.). 3 personalities × 3 messages.
- **How to reach it:** Play through investigation phase, wait several turns without progress.
- **Expected:** Personality-flavored hints appear in narrative panel as teal CORVUS-7 messages.
- **Status:** PENDING

### Evidence discovery screen flash VFX
- **What to check:** Brief teal screen-edge glow when picking up new evidence (distinct from red damage flash and green milestone flash).
- **How to reach it:** Find evidence during gameplay (scan rooms, interact with terminals/crew).
- **Expected:** Subtle teal radial glow from screen edges that fades quickly.
- **Status:** PENDING

### Room location headers in relay feed
- **What to check:** When entering a new room, a styled location header appears in the narrative panel (like Disco Elysium's location chapter markers).
- **How to reach it:** Navigate between rooms in 3D mode.
- **Expected:** Cyan uppercase text with bottom border showing room name, animated in with the same slide effect as messages.
- **Status:** VERIFIED — room names appearing on transitions
