# log_templates.yaml (schema sketch)

```yaml
log_templates:
  - id: door_access
    style: system
    text: "[{time}] ACCESS: badge={badge_id} door={door_id} result={result}"

  - id: personal_note
    style: personal
    text: "I can't shake the feeling {name} is lying about {topic}. If this goes wrong, check {location}."
    variables:
      topic: ["the artifact", "the shipment", "the clearance", "the test run"]
      location: ["med storage", "lab freezer", "cargo bay"]
```
