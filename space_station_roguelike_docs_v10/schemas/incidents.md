# incident_archetypes.yaml (schema sketch)

```yaml
incidents:
  - id: reactor_scram_fire
    title: Reactor Scram + Fire Cascade
    tags: [fire, power_loss, evacuation]
    timeline_beats:
      - beat: normal_ops
      - beat: scram_triggered
      - beat: fire_spreads
      - beat: comms_lost
    required_zones: [reactor, hab, med]
    hazards: {fire: 0.8, smoke: 0.6}
    secrets:
      chance: 0.3
      options: [sabotage, coverup]
```
