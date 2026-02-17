# Content Pipeline & Data Formats

## Goals
- Most content should live in data files for easy iteration.
- Deterministic generation: seed + content data → same station.
- Support modding later (optional): keep formats readable.

## Suggested data files
- `systems.yaml`: station subsystems and dependencies
- `bots.yaml`: robot chassis and base stats/slots
- `attachments.yaml`: upgrades
- `incident_archetypes.yaml`: “what happened” templates
- `log_templates.yaml`: parameterized evidence text blocks
- `puzzle_templates.yaml`: puzzle definitions

## Authoring workflow
1. Add/adjust data entries.
2. Run a “station generator” preview that outputs:
   - station map image (for dev)
   - seed
   - generated incident timeline
   - evidence list
3. Playtest a short run.
4. Tune weights/constraints.

## YAML schema sketches (keep simple)
See `/schemas/*.md` for starter structures.


## No-art narrative visuals
- Rooms carry **tags** (e.g., `med_bay`, `burned`, `frost`, `tool_scatter`).
- Still frames and descriptions are generated from tags + incident beats.
- This produces variety without any image assets.
