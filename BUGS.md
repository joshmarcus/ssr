# BUGS.md — QA Bug Tracker

## BUG-001: room-transition-fade relies solely on requestAnimationFrame — breaks when tab is hidden
- **Severity**: HIGH (visual)
- **Status**: FIXED (Sprint 174, V344-V348)
- **Fix**: Added CSS `transition: opacity 0.5s ease-out` to fade overlay + setTimeout fallbacks at 500-600ms. Fade overlay cleared in `destroy()` and `showTitleScreen()`.

## BUG-002: Subtitle message queue requires excessive dismissals
- **Severity**: MEDIUM (UX)
- **Status**: FIXED (Sprint 174, V344-V348) — Superseded by BUG-008 fix.

## BUG-003: Room cleaned in single action from 59%
- **Severity**: LOW (balance)
- **Status**: FIXED (Sprint 175, V349-V352)
- **Fix**: Reduced per-clean dirt removal from 25-35 center/15-20 surrounding to 12-17 center/6-9 surrounding. Now requires 2-3 clean actions.

## BUG-004: 3D scene shown before models finish loading — placeholder geometry visible
- **Severity**: HIGH (visual)
- **Status**: FIXED (Sprint 174, V344-V348)
- **Fix**: Added full-screen loading overlay with progress bar ("LOADING STATION DATA") that covers the 3D scene until all models are loaded, then fades out.

## BUG-005: Hazard border persists across title screen after returning from gameplay
- **Severity**: LOW (visual)
- **Status**: FIXED (Sprint 174, V344-V348)
- **Fix**: Hazard border and fade overlay cleared in both `destroy()` method and `showTitleScreen()`.

## BUG-006: "ROOM CLEANED" banner shows at T:0 on new game start
- **Severity**: MEDIUM (UX/logic)
- **Status**: FIXED (Sprint 174, V344-V348)
- **Fix**: Added guard `state.turn < 1` in `updateTutorialObjective()` to prevent cleaning objective from completing before player acts.

## BUG-007: Sensor pickup creates massive blue sphere that obscures the entire view
- **Severity**: HIGH (visual)
- **Status**: MITIGATED (Sprint 175, V349-V352) — needs visual verification
- **Fix**: Reduced scan wave ring expansion from 16x to 9x max, secondary from 13x to 7x, duration from 1.5s to 1.0s. Could not definitively identify the exact "blue sphere" geometry — may also be related to subtitle messages blocking view while the scan wave plays.

## BUG-008: Subtitle queue blocks ALL input including movement — 10+ messages at game start
- **Severity**: HIGH (UX)
- **Status**: FIXED (Sprint 174 + Sprint 175)
- **Fix (Sprint 174)**: Subtitle system overhauled — system/sensor/warning messages auto-dismiss after 3-4s, queue capped at 5, Space key passes through to game input.
- **Fix (Sprint 175)**: Deferred all CORVUS-7 narrative/lore messages until player takes first action. Only "LINK ACTIVE" intro shown at T:0.

---

## Summary

All 8 bugs addressed across Sprint 174-175. BUG-007 needs visual verification to confirm the fix.

---

## What Works Well (QA Observations)

- **3D scene rendering**: Once models load, the station looks great — floor grids, wall panels, door frames, ceiling beams, lighting all render correctly. The cel-shaded aesthetic is cohesive.
- **Chase camera**: Smooth, responsive, follows Sweepo well. Tank controls (turn + move) feel natural.
- **Sweepo model**: Charming little robot, well-proportioned, good animations (eye widen on interaction).
- **HUD system**: Health bar, turn counter, room name, seed display, scanner readout, action bar — all functional and readable. Minimap + compass in top right work well.
- **Investigation Hub**: Excellently designed — 5 tabs (Evidence, Scenes, Connections, Crew, Analysis) with rich structured data. Crew dossiers with personality, wants, habits, contradictions, relationships. Very Obra Dinn-like. Navigable with keyboard.
- **Mission Goals overlay**: Clean design with task tracking, progress percentages, and goal descriptions.
- **Map overlay**: Works, shows explored rooms with labels and player position.
- **Sensor system**: Scanner readout shows nearby entities with type/distance/direction. Sensor upgrades expand detection (Relay detection after thermal pickup).
- **Entity interactions**: Green diamonds for pickups, blue glow for interactables, evidence traces — the visual language is clear.
- **Narrative text**: Subtitle messages are well-written with atmosphere and character references (Vasquez, Tariq Hassan). The mystery setup is compelling.
- **No console errors**: Clean runtime — no JS errors, no rendering warnings, no missing assets during gameplay.
- **Autosave**: "SAVED" indicator appears reliably.

---

## QA Setup Notes

### What works: Claude in Chrome (visible browser tab)
The correct way to QA this game with Claude Code is to use the **Claude in Chrome MCP tools** (not the `preview_*` tools):

1. Make sure the dev server is running: `npm run dev` (or `preview_start` with a `dev` entry in `.claude/launch.json`)
2. Use `mcp__Claude_in_Chrome__tabs_context_mcp` with `createIfEmpty: true` to get a visible Chrome tab
3. Navigate to `http://localhost:5173/ssr/` with `mcp__Claude_in_Chrome__navigate`
4. Use `mcp__Claude_in_Chrome__computer` for screenshots and input (clicks, keypresses)
5. Use `mcp__Claude_in_Chrome__javascript_tool` for DOM inspection

### What does NOT work: preview_screenshot
The `preview_*` tools run in a headless/hidden tab where `document.hidden === true`. This means:
- `requestAnimationFrame` never fires — the Three.js render loop is completely suspended
- The 3D scene never renders (canvas stays blank)
- All rAF-driven effects (fade overlays, camera animations, particle effects) never update
- `preview_screenshot` causes Claude Code to lock up / hang indefinitely (likely because the renderer never produces a frame)
- `preview_snapshot` and `preview_eval` still work for DOM text inspection, but you can't see the 3D game

**Bottom line**: Always use Claude in Chrome for visual QA of this game.

---
*Last updated: 2026-02-23*
