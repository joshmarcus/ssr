# systems.yaml (schema sketch)

```yaml
systems:
  - id: power_grid
    name: Power Grid
    nodes:
      - id: reactor
        type: source
        max_output: 100
      - id: relay_a
        type: relay
        max_throughput: 30
      - id: lab_branch
        type: sink
        required_power: 10
    dependencies:
      - security  # e.g., requires security to open access panels
    failure_modes:
      - overload
      - short
    ui:
      screen: power_routing
```

Notes:
- Keep IDs stable; use them in puzzles, logs, and room tags.
