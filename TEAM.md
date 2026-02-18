# SSR Development Team Design

Standard team composition for sprint-based development. Each role runs as a parallel agent with clear responsibilities and non-overlapping file ownership.

## Roles

### 1. Sim Engineer
**Owns:** `src/sim/`, `src/shared/types.ts`, `src/shared/constants.ts`
**Responsibilities:**
- Game simulation logic (step function, actions, hazards, objectives)
- Entity interactions, puzzle mechanics, win/loss conditions
- State management, procgen integration
- Sensor/attachment system mechanics

**Does NOT touch:** Rendering, browser input, harness, tests

### 2. Render Engineer
**Owns:** `src/render/`, `src/index.html`, `src/shared/ui.ts`
**Responsibilities:**
- ROT.js display rendering (2D and 3D)
- Viewport, overlays, sensor visualization
- Sidebar UI (status bars, legend, controls, objective display)
- CSS styling, responsive layout, game over screen
- Shared UI helpers that both display and harness consume

**Does NOT touch:** Simulation logic, browser input handling, test files

### 3. UX / Input Engineer
**Owns:** `src/browser.ts`
**Responsibilities:**
- Keyboard/controller input handling
- Player-facing feedback (logs, flash effects, audio cues)
- Mystery choice presentation, help overlay, map overlay
- Connecting player actions to sim step function
- Cleaning directive UX, sensor toggle cycling

**Does NOT touch:** Core sim logic, rendering internals, test files

### 4. Harness Engineer
**Owns:** `src/harness/`
**Responsibilities:**
- AI playtesting driver (claudeDriver.ts)
- Observation renderer (obsRenderer.ts)
- Harness types, action parsing
- Ensuring harness observations match sidebar information
- Running and analyzing AI playtests

**Does NOT touch:** Core sim, browser rendering, test files

### 5. QA Engineer
**Owns:** `tests/`
**Responsibilities:**
- Writing and updating test cases for all new features
- Running full test suite, diagnosing failures
- Edge case coverage, golden seed walkthrough validation
- Integration testing across sim + render boundaries

**Does NOT touch:** Production source files (reads only for test authoring)

### 6. Creative Director (advisory)
**No file ownership — advisory role only**
**Responsibilities:**
- Narrative content: crew names, log text, room descriptions, flavor
- Mystery system design: incident archetypes, evidence chains
- Puzzle design: new puzzle types, difficulty tuning
- Game feel feedback: pacing, progression, player guidance
- Provides text content and design specs consumed by other engineers

## Sprint Process

1. **Planning:** Identify 3-5 concrete deliverables for the sprint
2. **Parallel execution:** Launch engineers simultaneously with clear scope
3. **Integration:** QA runs full test suite after all engineers complete
4. **Commit + push:** Single commit per sprint with all changes
5. **Review:** At sprint end, collectively review state of play and identify new priority items
6. **Backlog:** Maintain `backlog.md` with prioritized future work — update after each sprint

## Design Priority

**The Game Design Lead has priority.** All technical decisions defer to game feel:
- The game should be fun, interesting, and innovative
- Technical elegance is secondary to player experience
- When in doubt about a feature, ask: "Does this make the game more engaging?"
- Backlog prioritization follows the design lead's vision

## File Ownership Rules

- Each production file has exactly ONE owner
- Shared files (`src/shared/`) are co-owned by Sim + Render engineers
- If a change requires touching another role's files, coordinate via shared types/interfaces
- Tests are QA-only; other roles describe expected behavior, QA writes assertions
- `CLAUDE.md`, `TEAM.md`, `STATUS.md` are updated by the lead (human or orchestrator)

## Scaling

For large sprints, roles can be split:
- Sim Engineer -> Sim Core + Sim Hazards
- Render Engineer -> Render 2D + Render UI
- Multiple QA engineers for parallel test suites

For small sprints, roles can be combined:
- Sim + UX for gameplay-focused changes
- Render + Harness for observation parity work
