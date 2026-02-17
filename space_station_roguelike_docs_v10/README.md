# Space Station Terminal Roguelike — Build Pack (v10, TypeScript + ROT.js V0)

This folder contains **agent-ready markdown files** to build your game:
a procedural roguelike where you remotely control station robots over a low-bitrate terminal link,
restore systems, and uncover what happened.

## Decisions captured in v10
- **Start as a traditional terminal roguelike** (ASCII/glyph rendering).
- **Tech stack (V0)**: TypeScript + ROT.js + Vitest (browser-native, type-safe, fast iteration).
- **V0 visibility**: first rendered version is **fully visible** (no fog-of-war; ideal for debugging + agent play).
- **Turn-based / step-based sim** (one player action advances time); real-time can be layered later via tick auto-advance.
- **PC + Steam Deck** targets remain, but early focus is on a portable terminal renderer + headless harness.
- **Thermal is the MVP sensor upgrade** (first non-cleanliness sensor).
- **Visual style**: representational UI-first graphics (no bespoke art pipeline).
- Agent harness remains: text observations + action API + deterministic replays.

## How to use
1. Read `design/00_high_concept.md` → `design/01_game_loop.md`.
2. Read `design/18_tech_stack_rotjs_typescript.md` for the TypeScript + ROT.js V0 approach.
3. Read `tasks/00_repo_scaffold_typescript.md` for the repo layout.
4. Read `design/17_terminal_v0_prototype.md` for simulation rules and determinism.
5. Read `design/14_platform_pc_steam_deck.md` for Steam Deck constraints and Verified checklist.
6. For MVP, follow `tasks/mvp_spec.md`.
7. Implement the first integration test: `tasks/golden_seed_run_184201.md`.
8. Use `agents/*.md` as prompts for build agents.
9. Track progress in `tasks/backlog.md`.

---
Updated: 2026-02-16

- **MVP sensor upgrade**: Thermal is the first non-cleanliness sensor.
- **Visual style**: representational UI-first graphics (no bespoke art pipeline).
