# puzzle_templates.yaml (schema sketch)

```yaml
puzzle_templates:
  - id: power_route_basic
    category: power
    inputs: {start_node: reactor, target_node: lab_branch}
    constraints:
      max_throughput: 30
      locked_nodes: [relay_a]
    success_predicate: "power(target_node) >= required_power"
    rewards:
      - unlock: {door_tag: lab_access}
      - evidence: {log_template: system_restored}

  - id: leak_seal
    category: atmosphere
    inputs: {leak_room_tag: hull_breach_zone}
    requires:
      sensors: [atmospheric]
      tools: [seal_patch]
    success_predicate: "pressure_delta <= 0.1"
    rewards:
      - item: oxygen_filter
```
