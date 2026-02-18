# SSR — Future Features

Ideas and planned features for post-MVP development.

## Periodic Ship Computer Announcements
The ship computer should periodically broadcast announcements about the overall station state:
- Station-wide system status summaries every N turns
- Dynamic warnings when conditions change (pressure dropping, heat rising)
- Ambient flavor text from the station AI ("Maintenance schedule overdue by 847 days")
- Could tie into the cleaning directive system and mystery phases
- Should feel like a low-bitrate telemetry feed — fragmented, delayed, atmospheric

## Sidebar/Nav Bar Polish
Clean up the sidebar navigation to be crisp and minimal:
- Highlight the legend of entity sigils that have been seen (not all — only discovered ones)
- Style inspired by ondras/rot.js demo aesthetic: clean, tight, no clutter
- Clean crisp narrative text styling — no verbose labels
- Entity legend should only show glyphs the player has encountered this run
- Minimal chrome — let the terminal aesthetic breathe

## Evidence Browser / Journal Viewer
A rich, scrollable evidence browser so the player can review all discovered evidence:
- Browse all collected journal entries, log transcripts, crew items, and trace evidence
- See the **full content** of each piece of evidence (not just the summary tag)
- Show **where** each piece of evidence was found (room name + coordinates)
- Filter/sort by category (crew logs, items, traces, terminal entries)
- Highlight which deductions each piece of evidence contributes to (tag connections)
- Accessible via a dedicated key (e.g., `j` for journal) or overlay panel
- Should work as a proper investigation board — the player needs to review clues to make deductions
- Priority: HIGH — core to the mystery/deduction gameplay loop

## Other Deferred Features
- Radiation/Structural/EM sensor systems (removed in Sprint 5, may revisit)
- Station integrity cascading failure system
- Combat-lite drone encounters
- Advanced deduction board with badge/timeline deductions
- Still frame camera evidence
- Crew NPC dialogue and cooperation puzzles
- Save/load to localStorage
- Controller/gamepad input (Steam Deck target)
- CI/GitHub Actions pipeline
- Sound/audio system
- Meta-progression between runs
