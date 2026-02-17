# bots.yaml (schema sketch)

```yaml
bots:
  - id: janitor_rover
    name: Janitor Rover
    base_speed: 4
    battery_max: 20
    slots:
      tool: 1
      sensor: 1
      utility: 1
    base_sensors: [cleanliness]
    starting_verbs: [move, clean, bump]

  - id: maintenance_spider
    name: Maintenance Spider
    base_speed: 5
    traits: [vent_travel]
    slots:
      tool: 1
      sensor: 1
      utility: 0
    base_sensors: [obstacle, em_field]
```
