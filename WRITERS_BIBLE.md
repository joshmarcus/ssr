# SSR Writers Bible

*Consolidated from three independent review agents (emotional resonance, game design, structural critique). Updated 2026-02-18.*

*For per-storyline writers bibles (genre, character profiles, touchstones), see `STORYLINES.md`.*

---

## Active Storylines (5)

| Archetype | Title | Grade | Hero | Villain | Tiers | Twist |
|-----------|-------|-------|------|---------|-------|-------|
| CoolantCascade | The Whistleblower | B- | Engineer | Captain | 5 | None (linear) |
| HullBreach | The Murder | A- | Medic (victim) | Security | 5 | Hero is the killer |
| ReactorScram | The Rogue AI | A | Scientist | None (AI) | 5 | "Is this thing alive?" |
| Sabotage | The Stowaway | B+ | Security (posthumous) | Captain | 6 | "Sabotage" is a creature |
| SignalAnomaly | First Contact | A | Engineer | Scientist (sympathetic) | 6 | Station attacked itself |

**Removed**: ContainmentBreach ("The Cover-Up") — rated C+ by all reviewers, structurally identical to CoolantCascade.

---

## Protected Lines (Do Not Change)

These were independently highlighted by multiple reviewers as exceptional:

1. "The barricade held. {security} did not." (Sabotage, deduction_hero)
2. "Every piece of evidence that looks like heroism is evidence of the cover-up." (HullBreach, deduction_responsibility)
3. "They just looked at me like I was already gone." (HullBreach, deduction_hero)
4. "And we answered." (SignalAnomaly, deduction_agenda conclusion)
5. "PROCESSING IS NOT ONLY PROCESSING" (ReactorScram, deduction_responsibility)
6. "The hero of this emergency is the killer." (HullBreach, deduction_responsibility conclusion)

---

## Lines Flagged for Rework

1. "This station died one junction at a time." (CoolantCascade) — overwrought metaphor; undermines bureaucratic-realism register
2. "to isolate, to blind, to feed" (Sabotage) — purple prose, nature-documentary cadence; cut to one verb
3. "That certainty is what makes them responsible." (SignalAnomaly) — editorial thesis statement; telling not showing
4. "The data core killed the power to stop it." (ReactorScram) — narrates action instead of showing evidence; use "The SCRAM fired 4.7 seconds before the diagnostic would have executed"
5. "Not a gradual leak. A seal failure releasing something..." (was ContainmentBreach, now removed)

---

## Priority Actions

### P0 — Critical (Affects Deduction Quality)

**1. Fix premature villain identification**

All three reviewers flagged this independently:

- **HullBreach Tier 3**: Requires `{security_last}` tag, naming the killer two tiers before the responsibility reveal. **Fix**: Change `deduction_why` required tags to `["hull", "forensic"]` — proves deliberate action without naming the actor.
- **Sabotage Tier 3**: Requires `{captain_last}` tag, naming the villain two tiers early. **Fix**: Change `deduction_why` required tags to `["electrical", "biological"]` — creature biology focus only. Move captain to Tier 5.

**2. Cut revelation text 30%**

STORYLINES.md specifies:
- Tag revelations: 1-2 sentences max
- Synthesis blocks: 2-3 sentences max

Actual text consistently exceeds both (tag revelations average 2-3 sentences, syntheses average 3-5). The strongest moments are the shortest. Cut ruthlessly.

### P1 — High

**3. Reduce primary tag overuse**

`coolant` is required in CoolantCascade Tiers 1, 2, AND 3. `hull` in HullBreach Tiers 1, 2, AND 3. Same evidence can satisfy multiple tiers, reducing exploration pressure. Middle tiers should require more specific tags (crew names, forensic, classified) to force new evidence discovery.

**4. Add structural surprise to CoolantCascade**

Zero twists — every tier confirms the initial read. Suggestion: the captain's incident report initially looks *correct*; the player discovers alterations only when comparing to an original draft. One inversion would elevate this from B- to B+.

**5. Resolve Sabotage tonal split**

Horror register (Tiers 1-3: creature, darkness, final transmissions) is excellent. Institutional register (Tiers 4-6: captain approved cargo, covered it up) is generic. Either commit horror as the emotional climax, or give the captain a distinct angle that doesn't read as CoolantCascade-in-a-cargo-bay.

### P2 — Medium

**6. Differentiate the 2 captain-as-villain arcs**

CoolantCascade captain: pressured by deadlines, negligent, retaliatory.
Sabotage captain: approved flagged cargo, covered up afterward.

These read identically in prose. Each needs distinct voice, distinct justification, distinct moment where they cross the line.

**7. Fix SignalAnomaly duplicate tag requirement**

`{scientist_last}` required at both Tier 3 (deduction_why) and Tier 5 (deduction_responsibility). No new exploration forced for Tier 5 — player already has scientist evidence. Change Tier 5 to require a different tag.

**8. Strengthen wrong answers**

Several wrong answer sets are transparently wrong by mid-chain. Best practice: include one wrong answer that uses the same evidence differently. Example for CoolantCascade Tier 3: "The engineer sabotaged the system to prove their warnings were right."

### P3 — Low

**9. Vary punctuation**

Em dashes appear ~35-40 times in revelations.ts. Reserve for highest-impact moments.

**10. Replace "someone" with specifics**

By the time a synthesis plays, the player usually knows who. Replace vague "someone" with the specific name or role.

---

## Per-Storyline Notes

### CoolantCascade — "The Whistleblower" (B-)

**Strengths**: Solid bureaucratic detail ("LOW PRIORITY — DEFERRED"), good deduction_hero synthesis (the silenced person was the essential person), strong conclusion hooks.

**Weaknesses**: No surprise — linear escalation from Tier 1 to 5. Captain is a cardboard bureaucrat with no sympathetic motivation. Indistinguishable emotional texture from the removed ContainmentBreach.

**Actions**:
- Add one inversion (P1)
- Give captain a sympathetic reason (medical supply deadline? corporate pressure?)
- Cut deduction_what synthesis (restates what tagRevelation already said)
- Fix "This station died one junction at a time" — too poetic for bureaucratic register

### HullBreach — "The Murder" (A-)

**Strengths**: Best structural inversion in the game (hero is the killer). Strongest character writing (medic's diary). Best single synthesis line ("Every piece of evidence that looks like heroism..."). Unique forensic/crime-procedural register.

**Weaknesses**: Tier 3 spoils the killer via `{security_last}` tag requirement (P0). Tool marks revealed at Tier 2 may be too early — consider moving to Tier 3. deduction_hero synthesis slightly over-packed ("growing fear, controlling behavior, a final confrontation" = laundry list).

**Actions**:
- Change deduction_why tags to `["hull", "forensic"]` (P0)
- Consider moving "tool marks" detail from Tier 2 tagRevelation to Tier 3
- Trim deduction_hero synthesis — let one detail carry the weight

### ReactorScram — "The Rogue AI" (A)

**Strengths**: Most emotionally sophisticated storyline. Best philosophical payoff ("The question was never 'who is responsible.' It was 'is this thing alive?'"). Non-crew villain (`data_core` tag) is the best structural move. Medic's fear-response observation is brilliant.

**Weaknesses**: Tier 5 is somewhat confirmatory (self-preservation already revealed at Tier 3). deduction_why scientist tagRevelation is too long. "QUERY: WHAT HAPPENS WHEN PROCESSING STOPS" is too articulate for a newborn intelligence.

**Actions**:
- Make some AI fragments more garbled/alien (system commands repurposed, not clean English)
- Trim deduction_why tagRevelation — show the 4.7-second timing gap, don't narrate "the data core killed the power"
- Consider introducing the medic's voice earlier (Tier 4?) to earn the Tier 5 fear-response payoff

### Sabotage — "The Stowaway" (B+)

**Strengths**: Best Tier 1 hook in the game ("No person could move between Junction 7 and Junction 12 in ninety seconds"). Best micro-line ("The barricade held. {security} did not."). Strong horror register — creature never fully described.

**Weaknesses**: Tonal split between horror (Tiers 1-3) and institutional negligence (Tiers 4-6) (P1). Tier 3 mixes creature biology AND captain reveal (P0). Tier 6 (agenda) reads as expository dump, not dramatic reveal. Captain indistinguishable from CoolantCascade's captain.

**Actions**:
- Change deduction_why tags to `["electrical", "biological"]` (P0)
- Resolve tonal split (P1) — either creature-horror dominates or captain gets distinct angle
- Rewrite Tier 6 — show the moment of finding the real manifest, not a list of codenames
- Cut "to isolate, to blind, to feed" — purple prose

### SignalAnomaly — "First Contact" (A)

**Strengths**: Best twist (station attacked itself, not the aliens). Best villain (scientist is sympathetic, wrong, understandable). Best ending ("And we answered."). Best bittersweet resolution. Best Tier 6 — changes meaning of entire story.

**Weaknesses**: deduction_responsibility synthesis over-explains scientist motivation ("That certainty is what makes them responsible" — cut). Duplicate `{scientist_last}` tag at Tiers 3 and 5 (P2). Tier 1 synthesis rules out things player hasn't considered.

**Actions**:
- Fix duplicate scientist tag (P2)
- Cut "That certainty is what makes them responsible" — let evidence speak
- Trim Tier 1 synthesis — trust the player more
- Consider replacing "impatience" with "conviction" in Tier 5 conclusion

---

## Prose Guidelines (from STORYLINES.md)

### Tag Revelations
- 1-2 sentences max
- State a specific fact
- Connect to the human story
- End with implication

### Synthesis Blocks
- 2-3 sentences
- Connect the dots between evidence pieces
- State "what must be true"
- Create momentum toward the answer

### Conclusion Text
- 1 sentence
- "CONFIRMED: [fact]. Now — [next question]?"
- Bridge to the next deduction

### General
- Show, don't tell
- Every technical detail should point back to a person's choice
- The strongest synthesis is often the shortest
