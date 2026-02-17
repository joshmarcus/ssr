# attachments.yaml (schema sketch)

```yaml
attachments:
  - id: gripper_arm
    slot: tool
    verbs: [grab, lift, drag]
    requirements: {power: 2}
    rarity: common

  - id: thermal_sensor
    slot: sensor
    verbs: [sense_thermal]
    reveals: [heatmap]
    rarity: common

  - id: signal_relay
    slot: utility
    verbs: [deploy_relay]
    effects:
      network_radius_bonus: 8
    rarity: uncommon
```
