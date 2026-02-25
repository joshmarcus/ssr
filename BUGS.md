# BUGS.md — QA Bug Tracker

All bugs from QA Sessions 1-3 are resolved. This file tracks the history for reference.

---

## Session 1 Bugs (Sprint 174-175)

| Bug | Severity | Status | Fix |
|-----|----------|--------|-----|
| **BUG-001** Room transition fade breaks on hidden tab | HIGH | FIXED (Sprint 174) | CSS transition + setTimeout fallbacks |
| **BUG-002** Subtitle queue requires excessive dismissals | MEDIUM | FIXED (Sprint 174) | Superseded by BUG-008 fix |
| **BUG-003** Room cleaned in single action from 59% | LOW | FIXED (Sprint 175) | Reduced per-clean dirt removal; requires 2-3 actions |
| **BUG-004** 3D scene shown before models load | HIGH | FIXED (Sprint 174) | Loading overlay with progress bar |
| **BUG-005** Hazard border persists on title screen | LOW | FIXED (Sprint 174) | Cleared in destroy() and showTitleScreen() |
| **BUG-006** "ROOM CLEANED" banner at T:0 | MEDIUM | FIXED (Sprint 174) | Guard `state.turn < 1` in updateTutorialObjective() |
| **BUG-007** Sensor pickup creates massive blue sphere | HIGH | VERIFIED FIXED (Sprint 175+181) | Ring expansion 4x/0.6s, no sphere geometry |
| **BUG-008** Subtitle queue blocks ALL input at game start | HIGH | FIXED (Sprint 174-175) | Auto-dismiss 3-4s, queue cap 5, deferred lore messages |

---

## Session 2 Bugs (Sprint 176-177)

| Bug | Severity | Status | Fix |
|-----|----------|--------|-----|
| **BUG-009** "NEW GOAL DISCOVERED" never auto-dismisses | HIGH | VERIFIED FIXED (Sprint 177) | 5s auto-dismiss timer + keypress dismiss handler |
| **BUG-010** Sensor "Nearby" subtitles spam and block gameplay | P0 | VERIFIED FIXED (Sprint 176) | "You detect:" and "Nearby" messages suppressed entirely |
| **BUG-011** Crew NPC models are placeholder blue shapes | MEDIUM | VERIFIED FIXED (Sprint 185) | GLTF models with Worlds texture atlas + per-role emissive suit colors (captain=gold, engineer=orange, medic=green, security=blue, scientist=purple, robotics=cyan, comms=teal, life_support=white) |
| **BUG-012** Scan wave still too large (BUG-007 follow-up) | HIGH | VERIFIED FIXED (Sprint 181) | See BUG-007 — 4x/0.6s ring, no sphere |
| **BUG-013** No way to cycle interaction targets | MEDIUM | VERIFIED FIXED (Sprint 177) | Tab cycles adjacent interactables, action bar shows counter |
| **BUG-014** Mandatory room cleaning gates exploration | MEDIUM | FIXED (Sprint 177) | Cleaning now advisory-only, no movement block |
| **BUG-015** Scanner cycling through sensor types is confusing | MEDIUM | FIXED (Sprint 177) | Q = unified scan, T = overlay toggle, Tab = target cycle |
| **BUG-016** Interaction prompt shown for non-adjacent entities | HIGH | VERIFIED FIXED (Sprint 177) | Display and sim ranges both use cardinal adjacency (dx+dy<=1) |

---

## Open Issues

All bugs resolved. No open issues.

---

*Last updated: 2026-02-25*
