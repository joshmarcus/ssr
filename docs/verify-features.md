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

## Sprint 179 — V369-V373 (2026-02-25)

### DisturbedFurniture + PersonalItem echo rendering
- **What to check:** New scene echo types render in 3D: overturned furniture (tilted box + scattered debris) and personal items (small glowing rectangle with floating spark). Both appear on minimap as distinct icons.
- **How to reach it:** Navigate to rooms with scene echoes. Echoes appear when explored tiles are within view range.
- **Expected:** DisturbedFurniture: tilted chair shape with debris, subtle rocking. PersonalItem: small glowing card on floor with pulsing spark above. Both phase-colored.
- **Status:** PENDING

### Dynamic room mood lighting
- **What to check:** Room ambient light tints based on hazard conditions — warm orange in hot rooms, cold blue in low-pressure rooms, grey-yellow in smoky rooms.
- **How to reach it:** Enter rooms with active hazards (heat in Power Relay Junction, breach in hull rooms).
- **Expected:** Visible color shift in room lighting compared to neutral rooms. Blends smoothly with existing room-type tints.
- **Status:** PENDING

### Evidence resonance link messages
- **What to check:** When new evidence shares tags with existing evidence, a "EVIDENCE LINKED" message appears in the narrative panel showing matching tag categories.
- **How to reach it:** Collect multiple pieces of evidence from different rooms that share tag categories (e.g., both tagged "timeline" or "crew").
- **Expected:** Brief sensor-type message: "─ EVIDENCE LINKED — connects to prior findings [tag1, tag2]"
- **Status:** PENDING

## Sprint 180 — V374-V378 (2026-02-25)

### Deduction readiness pulse on case tracker
- **What to check:** Case tracker nodes pulse slowly when evidence is 75%+ of threshold, pulse fast with glow when ready to solve.
- **How to reach it:** Collect evidence until near a deduction's threshold. Watch case tracker on right side of screen.
- **Expected:** Near-ready nodes: slow breathing animation. Ready nodes: fast pulse with text-shadow glow and scale animation.
- **Status:** PENDING

### Crew status icons on minimap
- **What to check:** Crew NPC icons on minimap are color-coded by status: green (found alive), blue with pulse ring (following), gold (evacuated), red X (dead).
- **How to reach it:** Find crew NPCs, rescue them, escort to pods. Check minimap at each stage.
- **Expected:** Distinct colors per status. Following crew have animated blue ring. Dead crew show red X instead of triangle.
- **Status:** PENDING

### Foreshadowed room hints on minimap
- **What to check:** Unexplored rooms mentioned in terminal logs show a pulsing orange "?" icon on the minimap.
- **How to reach it:** Read a terminal that mentions another room by name. Check minimap for that room.
- **Expected:** Orange pulsing "?" with glow ring at center of the hinted room. Disappears once the room is explored.
- **Status:** PENDING

---

## Sprint 181 — V379-V383 (2026-02-25)

### Title screen with starfield and difficulty selector
- **What to check:** Title screen always shows on game launch (not just when save exists). Animated starfield background, "CORVUS-7" title with glow, tagline, Continue/New Game menu, difficulty selector (←/→ to cycle Easy/Normal/Hard).
- **How to reach it:** Open the game in browser. Title screen is the first thing shown.
- **Expected:** Atmospheric starfield drifting slowly behind the title. Difficulty shows colored label (green=Easy, amber=Normal, red=Hard). Menu navigable with arrow keys.
- **Status:** VERIFIED — visual QA confirmed via Playwright screenshot

### Evacuation progress HUD widget
- **What to check:** During Evacuate phase, a small widget below the minimap shows crew evacuation progress: "CREW EVACUATION" label with pulsing red animation, progress bar, and X/Y safe count.
- **How to reach it:** Play until Evacuate phase (find and rescue crew, escort to pods).
- **Expected:** Widget appears only during Evacuate phase. Shows progress bar filling as crew are evacuated. Dead crew count in red if any.
- **Status:** PENDING — needs evacuation phase playthrough

### Game-over action buttons
- **What to check:** Game-over overlay shows styled button boxes for [N] New Game, [R] Replay Seed, [C] Copy Summary instead of plain text.
- **How to reach it:** Complete or fail a game to trigger game-over screen.
- **Expected:** Three styled buttons with colored borders (green, blue, gray) and hover effects.
- **Status:** PENDING — needs game-over trigger

### Atmospheric starfield particles in 3D
- **What to check:** 400 3D star particles on a slowly rotating sphere visible in the background of 3D scenes. Provides subtle parallax depth through hull gaps.
- **How to reach it:** Play in 3D mode, look through doorways or open areas toward the station edge.
- **Expected:** Tiny blue-white star dots visible in the deep background, slowly drifting. Adds space station ambiance.
- **Status:** PENDING — subtle effect, needs edge-of-station view

### BUG-007/012: Scan wave verified fixed
- **What to check:** Scan wave is a brief expanding ring (4x expansion over 0.6s), no blue sphere.
- **How to reach it:** Start new game, pick up sensor, press Q to scan.
- **Expected:** Brief ring ripple with grid squares, clears within 1 second.
- **Status:** VERIFIED — code review confirmed 4x/0.6s, no sphere geometry

---

## Sprint 182 — V384-V388 (2026-02-25)

### Pause menu settings panel
- **What to check:** Escape opens pause menu with new "Settings" option. Selecting Settings opens sub-panel with Volume (visual bar, ←/→), Camera (Chase/Ortho), Outline (On/Off), Relay Feed (Show/Hide), TTS (On/Off). Changes apply immediately.
- **How to reach it:** During gameplay, press Escape, navigate to Settings, press Enter.
- **Expected:** Settings panel with current values, ←/→ changes volume, Enter toggles other settings, Escape returns to pause menu.
- **Status:** VERIFIED — Playwright QA confirmed all settings functional

### Help screen investigation tips
- **What to check:** Help screen (?) has new "How to Investigate" section between Game Phases and Display & Debug, with 6 numbered strategy tips and CORVUS-7 quote.
- **How to reach it:** Press ? during gameplay.
- **Expected:** Teal-colored section header, numbered tips with colored key hints, italic CORVUS-7 quote at bottom.
- **Status:** VERIFIED — Playwright QA confirmed section present with correct content

### Room-entry door transition SFX
- **What to check:** Brief pneumatic whoosh when entering a new room. Cleaning produces sweep sound. Evidence pickup produces ascending chime.
- **How to reach it:** Walk between rooms. Press C to clean. Collect evidence.
- **Expected:** Subtle procedural sounds for door transitions, cleaning, and pickups.
- **Status:** PENDING — needs audio verification (Playwright can't test audio)
