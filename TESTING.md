# SSR Manual Testing Script

Target time: 10-15 minutes. Use the golden seed (184201, loaded by default).

---

## 1. Setup

- [ ] Run `npm run dev` from the project root
- [ ] A browser tab should open automatically (Vite dev server, typically `http://localhost:5173`)
- [ ] Confirm the URL does NOT have a `?seed=` parameter (defaults to golden seed 184201)

---

## 2. Visual Checks (on load)

- [ ] A dark canvas appears with a dungeon map made of ASCII characters
- [ ] The player `@` (bright green) is visible somewhere in the map
- [ ] Walls are `#` (gray), floors are `.` (dark gray), doors are `+` (amber/brown)
- [ ] At least one locked door `X` (red) is visible somewhere on the map
- [ ] Colored entity glyphs are visible: `S` (cyan, sensor pickup), `R` (yellow, relay), `D` (magenta, data core), `B` (orange, service bot), `T` (light blue, log terminal)
- [ ] A UI panel sits below the map canvas showing:
  - **Turn:** 0
  - **Pos:** the player's starting coordinates
  - **Seed:** 184201
  - **Actions:** `[Arrows] Move | [i] Interact | [s] Scan | [.] Wait`
  - **Log:** `Station link established. Seed: 184201. Awaiting commands.`

---

## 3. Movement Test

- [ ] Press **Arrow Up** -- the `@` moves one tile north (if not blocked by wall)
- [ ] Press **Arrow Down** -- the `@` moves one tile south
- [ ] Press **Arrow Left** -- the `@` moves one tile west
- [ ] Press **Arrow Right** -- the `@` moves one tile east
- [ ] After each move, verify the **Turn** counter in the UI panel increments by 1
- [ ] After each move, verify the **Pos** values update to match the `@` position
- [ ] Walk the `@` into a wall (`#`) -- the `@` should NOT move, the turn should NOT increment, and the log should read: `Cannot move there -- path blocked.`
- [ ] Walk through an unlocked door (`+`) -- the `@` should pass through normally

---

## 4. Wait Test

- [ ] Press `.` (period) -- the player stays in place
- [ ] Verify the **Turn** counter increments by 1
- [ ] Verify the log reads: `Holding position. Systems nominal.`

---

## 5. Interact Test (KNOWN BUG)

**IMPORTANT:** There is a known bug where pressing `i` does not auto-target nearby entities. The browser input sends an Interact action without a `targetId`, so the sim ignores it. The log will read `Interact command sent. No target in range.` regardless of proximity.

Expected behavior once fixed: standing on or adjacent to an entity and pressing `i` should interact with it.

To verify the bug is still present:

- [ ] Navigate `@` to the sensor pickup `S` (cyan glyph, typically in room 1)
- [ ] Stand on the same tile as `S` or one tile away (4-directional)
- [ ] Press `i`
- [ ] **Expected (bug):** Log says `Interact command sent. No target in range.` and nothing happens
- [ ] **Expected (once fixed):** The `S` disappears, log says `Equipped thermal sensor module.`, and the sensor is added to attachments

Until this bug is fixed, tests 6-8 below cannot be completed through keyboard input alone.

---

## 6. Thermal Scan Test

The scan overlay toggle (`s` key) works independently of the interact bug because it toggles the display layer directly.

- [ ] Press `s` -- the map should switch to a thermal overlay view
- [ ] Verify tiles near the relay `R` show warm colors (orange/red tints) since the relay starts with heat=40
- [ ] Verify cool tiles show a subtle blue tint
- [ ] Verify tiles with heat > 50 display as `~` (heat glyph)
- [ ] Verify the UI panel shows `[THERMAL ACTIVE]` in red text
- [ ] Verify the log reads: `Thermal overlay engaged. Heat signatures visible.`
- [ ] Press `s` again -- the thermal overlay should turn off, returning to normal view
- [ ] Verify `[THERMAL ACTIVE]` disappears from the UI panel
- [ ] Verify the log reads: `Thermal overlay disengaged. Standard view.`

**Note:** The thermal overlay is a display-only toggle. It does NOT require the thermal sensor to be equipped. The sim-side scan action (which marks relay hotspots in state) does require the sensor, but the visual toggle always works. This may be an intentional debug feature or a bug worth discussing.

---

## 7. Locked Door Test

- [ ] Locate the locked door `X` (red glyph, near the last room / data core)
- [ ] Walk `@` into the locked door -- the `@` should NOT pass through (locked doors have `walkable: false`)
- [ ] Verify the log reads: `Cannot move there -- path blocked.`
- [ ] Verify the turn does NOT increment

(Unlocking the door requires interacting with the relay `R`, which is blocked by the interact bug described in test 5.)

---

## 8. Hazard Spread Test

- [ ] Navigate near the relay `R` (room 2) -- this tile starts with heat=40, smoke=15
- [ ] Press `.` (wait) repeatedly, 10-15 times
- [ ] Press `s` to enable thermal overlay
- [ ] Observe that heat has spread to adjacent floor tiles (warm colors radiating outward)
- [ ] Heat spreads at 5 units/turn to adjacent walkable tiles; smoke at 3 units/turn
- [ ] Walls and locked doors block heat/smoke spread
- [ ] If a tile the player is standing on reaches heat >= 80, the player is destroyed and the game ends with: `CONNECTION LOST. Bot destroyed.`

**WARNING:** Do not idle too long near the relay or the heat will kill the bot.

---

## 9. Game Over States

### Loss (heat death)
- [ ] Stand on or near the relay and wait many turns (press `.` ~20+ times)
- [ ] Once the player's tile heat reaches 80+, the game should end
- [ ] Log reads: `CONNECTION LOST. Bot destroyed.`
- [ ] UI actions line reads: `CONNECTION LOST -- Refresh to restart`
- [ ] All further key presses should be ignored (no turn increment)

### Win (data core -- cannot currently be triggered via keyboard)
- Due to the interact bug, the win condition cannot be reached through normal play. Once fixed:
  - [ ] Interact with relay `R` to unlock doors
  - [ ] Walk through the now-unlocked door (formerly `X`, now `+`)
  - [ ] Interact with data core `D`
  - [ ] Log reads: `MISSION COMPLETE. Data core recovered.`
  - [ ] UI actions line reads: `MISSION COMPLETE -- Refresh to restart`

---

## 10. Seed Reproducibility Test

- [ ] Refresh the page -- the exact same map layout and entity positions should appear
- [ ] Add `?seed=99999` to the URL and press Enter
- [ ] Verify a different map is generated
- [ ] Verify the UI panel shows **Seed: 99999**
- [ ] Remove the seed parameter and refresh -- verify it returns to seed 184201

---

## Bug Report Template

When reporting issues, copy and fill in this template:

```
**Summary:** [One-line description]

**Seed:** [e.g., 184201]
**Turn:** [Turn number when bug occurred]
**Player position:** [e.g., (12, 5)]

**Steps to reproduce:**
1. [Step 1]
2. [Step 2]
3. ...

**Expected behavior:** [What should happen]

**Actual behavior:** [What actually happened]

**Screenshot:** [If applicable, attach a screenshot]

**Browser / OS:** [e.g., Chrome 133 / Windows 11]
```

---

## Known Issues

1. **Interact (`i`) does not auto-target entities.** The browser input handler sends `{ type: "interact" }` without a `targetId`. The sim's `handleInteract` function returns immediately when `targetId` is undefined. This blocks all entity interactions (sensor pickup, relay activation, data core transmission, log terminal reading, service bot activation). The `getInteractableEntities` function in `step.ts` already exists to find nearby entities -- it just needs to be wired up to auto-select the nearest one when no explicit targetId is provided.

2. **Thermal overlay toggle works without the sensor.** The `s` key toggles the visual thermal overlay in the display regardless of whether the player has equipped the thermal sensor. The sim-side scan action correctly checks for the sensor, but the display toggle is independent.
