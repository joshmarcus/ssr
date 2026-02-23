# Mystery Gameplay Redesign — "Station Autopsy"

> **Status**: FINAL v2 — Integrated feedback from Game Design Lead, Mystery Writer, and UX Creative Designer. Ready for implementation.
>
> **Implementation progress**: See [`MYSTERY_GAMEPLAY_STATUS.md`](./MYSTERY_GAMEPLAY_STATUS.md) for sprint-by-sprint status. This document is the master design reference — edit intentionally, don't lose the vision.

## The Central Question

Every run asks one question: **"What really happened here?"**

The station's official records tell one story. The physical evidence tells another. The player's job is to walk through the wreckage, read the scenes, identify the people, and decide which story is true — or whether neither is.

This is not a quiz. It's a forensic investigation. The player earns the answer by doing the detective work, room by room, clue by clue, until the pieces click. The moment when two contradictory clues sit side by side and the player realizes someone is lying — that's the game.

Inspired by Return of the Obra Dinn, Alan Wake 2, Her Story, Disco Elysium, and Case of the Golden Idol.

---

## Part 1: Design Principles

### The Three Pillars

1. **Observe, don't read** — Evidence is physical observations requiring interpretation, not prose summaries telling you what happened
2. **The player connects, the system validates** — The "aha moment" comes from the player linking two clues, not from the game revealing an answer
3. **Two stories, one station** — Every mystery has an Official Story and a Real Story. The investigation is the journey between them

### Three Template Rules for Evidence Writing

Every piece of evidence text should follow one of these patterns:

1. **Interrupted Moment** — A scene frozen mid-action. "Maintenance terminal, screen still on. Request #147 — three pages of thermal data, handwritten annotations in the margins. The 'SUBMIT' confirmation timestamped 6 weeks ago. Below it, in a different font: 'DEFERRED — Okafor.'" The reader fills in what happened next.

2. **Unreliable Observer** — A record by someone who doesn't understand (or won't admit) what they saw. "Security incident report: 'Unusual activity in the hull crawlspace. Inspection found no anomalies. Logged and cleared.' But the timestamp says 02:17, and the badge scan shows three visits this week." Let the reader catch the lie.

3. **Physical Tell** — An object that betrays what someone felt or did. "Voltage tester, teeth marks on the handle. Still powered on." Don't explain the teeth marks. The player imagines the stressed engineer biting down during a long shift alone. That imaginative leap is the game.

### Bad vs. Good Evidence

**Bad** (tells you what happened):
> "{engineer} filed maintenance request #{num}. Status: pending for {weeks} weeks."

**Good** (shows you a frozen moment):
> "Maintenance terminal, screen still on. Request #{num} — three pages of thermal data, handwritten annotations in the margins. The 'SUBMIT' confirmation timestamped {weeks} weeks ago. Below it, in a different font: 'DEFERRED — {captain_last}.'"

---

## Part 2: The Three Pillars in Detail

### Pillar 1 — Room Scenes (Spatial Evidence)

Every room is a **crime scene** with a physical story to tell. When the player enters a room, they find 2-4 **physical clue objects** placed at specific positions — not generic "evidence trace" pickups, but specific items tied to what happened in that room.

#### Physical Clue Types

| Type | Example | What It Tells You |
|------|---------|-------------------|
| Badge | "SEC-VOLKOV-4417 — cracked, found near sealed door" | WHO was here |
| Personal Effect | "A child's drawing, taped inside a locker door" | WHO this person was |
| Damage Pattern | "Scorch marks radiating outward from junction V-4" | WHAT happened |
| Access Log | "Door panel: last 5 accesses — 3 from CMO override" | WHO went where |
| Terminal Log | "Draft message, half-deleted: 'They won't listen to—'" | WHY they acted |
| Tool/Equipment | "Voltage tester, teeth marks on handle. Still powered on" | WHAT they were doing |
| Residue | "Chemical residue on the floor — not standard cleaning solution" | Hidden context |
| Barricade | "Furniture pushed against the door from inside" | Fear/intent |
| Modified Equipment | "Coolant bypass rigged with non-standard connectors" | Deliberate action |
| Memory Echo | Ghost image from existing `crewItems.ts` — the terminal flickers, a translucent figure, then static | Emotional connection |

#### Sensor-Layered Evidence

All available sensor layers render simultaneously on first visit. No room revisiting required — the player sees everything their current sensor loadout can detect. Upgrading sensors reveals new layers in ALL rooms, including previously visited ones, but the primary incentive is forward exploration not backtracking.

- **Cleanliness (base)**: Surface observations — badges, visible damage, items on the floor, text on screens
- **Thermal**: Heat traces — handprints (recent presence), hot spots (overloaded equipment), cold spots (breaches). "Residual heat signature on the wall panel — hand-shaped, pressed hard. Sustained contact, not a brush."
- **Atmospheric**: Air composition — adrenaline metabolites, chemical traces, pressure differentials. "Trace adrenaline in the recycler intake. Someone was breathing hard nearby."

Higher sensors (Radiation, EM/Signal) are post-MVP.

#### Scene Processing — In the 3D World

Scene Processing happens **in the game world**, not in a menu overlay. The player walks through the room, examines glowing clue objects, and answers questions via HUD prompts.

**Flow:**

1. Player enters a room with unprocessed clues. Clue objects pulse with a subtle scan-ring glow.
2. Player walks to a clue object and presses **A/Interact** (costs 1 turn per clue). The clue text appears as a HUD card at the bottom of the screen, then gets added to the journal.
3. After examining at least 2 clues, the HUD offers: `PROCESS SCENE [X]`
4. Press X. Three HUD prompts appear sequentially at the bottom of the screen (not a menu overlay):
   - **WHO was here?** — D-pad scrolls through crew roster + "Unknown". Press A to confirm.
   - **WHAT were they doing?** — D-pad scrolls through activity list. Press A to confirm.
   - **WHAT HAPPENED?** — D-pad scrolls through outcome list. Press A to confirm.
5. Each answer is scored independently against ground truth. Processing costs 3 turns total. **No HP penalty for wrong answers.**
6. Feedback is **delayed until room exit** — no instant green/amber. When the player leaves the room, a brief result summary appears: "Scene processed: 2/3 correct. [Details added to Incident Board]"
7. All three correct = "SCENE SOLVED" — golden sweep on minimap, room permanently gold-bordered.

**Hazards remain live during scene processing.** If the room has active heat or pressure hazards, they tick while the player examines clues and answers questions. This creates genuine tension — do you rush the answers or take time to think while your HP drains?

**Wrong answers:** Unlimited retries with increasing turn cost. First attempt: 3 turns. Second attempt: 5 turns. Third attempt: 8 turns. No lockout. The player always gets another chance, but time is finite.

#### Scene Processing Answer Pools

```typescript
enum SceneWho {
  // Populated dynamically from discovered crew + "Unknown"
  // Player selects 0-2 crew members from roster
}

enum SceneActivity {
  EmergencyResponse = "emergency_response",
  Fleeing = "fleeing",
  Hiding = "hiding",
  Sabotage = "sabotage",
  MedicalTreatment = "medical_treatment",
  RoutineWork = "routine_work",
  Investigation = "investigation",
  EquipmentRepair = "equipment_repair",
  DataAccess = "data_access",
  Confrontation = "confrontation",
  Communication = "communication",
  Barricading = "barricading",
}

enum SceneOutcome {
  LeftNormally = "left_normally",
  LeftInHurry = "left_in_hurry",
  Injured = "injured",
  DiedHere = "died_here",
  StillHere = "still_here",
  Sealed = "sealed_inside",
  Unknown = "unknown",
}
```

### Pillar 2 — Crew Dossiers (The Identity Puzzle)

The player builds **Crew Dossiers** — a profile for each crew member pieced together from evidence found across the station.

#### How Identification Works

Early evidence refers to crew by **role or badge ID**, not by full name. The player connects fragments:

1. **Badge Discovery**: Finding a crew badge confirms name + role
2. **Cross-Referencing**: A log in Med Bay mentions "Volkov came in with burns." A badge in Engine Core reads "SEC-VOLKOV-4417." Connection: Security Chief Volkov was in Engineering during the thermal event, then went to Med Bay
3. **Relationship Mapping**: Personal logs mentioning two crew members together map social connections

#### Crew as Characters — Themed Triplet Pools

Each crew member gets three humanizing details, drawn from **themed triplet pools** rather than random combinatorial mixing. Each pool is a coherent character sketch:

**Themed Triplet Pools** (6 themes, 5+ variations each = 30+ unique profiles):

| Theme | Want | Habit | Contradiction |
|-------|------|-------|---------------|
| **Homesick Professional** | "counting down to rotation end — 6 weeks until Earth" | "kept a family photo taped inside their locker" | "volunteered for the overtime shifts that kept them here longer" |
| **Obsessive Expert** | "publishing the dataset that would make their career" | "annotated every manual, every report, every note" | "ignored their own safety protocols when the data was at stake" |
| **Quiet Loyalist** | "keeping the crew alive, no recognition needed" | "covered for colleagues at every shift change" | "never filed the report that would have saved everyone" |
| **Ambitious Outsider** | "proving they deserved the assignment over the candidate who had connections" | "arrived first, left last, ate alone" | "privately asked for a transfer two weeks before the incident" |
| **Reluctant Authority** | "getting through command rotation without anyone getting hurt" | "delegated everything they could, kept a flask in the desk" | "the one time they made a decisive call, it was the wrong one" |
| **Careful Paranoid** | "documenting everything, just in case" | "backed up every log to a personal drive every night" | "the one thing they didn't record was the conversation that mattered most" |

These appear in personal items (from `crewItems.ts`), logs, and other crew members' testimony. They create emotional investment. The player who knows Vasquez "was counting down to rotation, kept jasmine tea mugs everywhere, and filed safety complaints nobody listened to" will FEEL something when they discover Vasquez's fate.

#### Dossier Data Structure

```typescript
interface CrewDossier {
  crewId: string;
  confirmed: {
    name?: string;
    role?: CrewRole;
    badgeId?: string;
  };
  // Theories are AUTO-POPULATED from Scene Processing results.
  // When the player answers WHO in a room, the system proposes
  // a theory for that crew member's involvement.
  theories: {
    lastKnownRoom?: string;
    fate?: CrewFate;
    involvement?: 'victim' | 'bystander' | 'responder' | 'instigator' | 'unknown';
  };
  personalDetails: {
    want?: string;
    habit?: string;
    contradiction?: string;
  };
  linkedEvidence: string[];  // journal entry IDs
  roomsSeen: string[];       // rooms where this crew member was placed by Scene Processing
}
```

#### Memory Echoes

Existing `crewItems.ts` entries with `memoryEcho` fields serve as emotional delivery moments. When the player examines a crew personal item that has a memory echo, a brief ghost image plays — a translucent figure, a moment frozen in time. These don't advance the mystery mechanically but create the emotional investment that makes the answers matter.

### Pillar 3 — The Incident Board (Timeline Reconstruction)

The Incident Board replaces the multiple-choice deduction chain with a **system-proposed, player-confirmed** timeline.

```
[BEFORE] --> [TRIGGER] --> [ESCALATION] --> [COLLAPSE] --> [AFTERMATH]
```

#### How It Works — Automated with Player Confirmation

The system does NOT require the player to manually construct cards. Instead:

1. As the player processes room scenes and discovers evidence, the system **proposes Summary Cards** for timeline slots.
2. Each proposed card appears at the bottom HUD: "TIMELINE PROPOSAL: [TRIGGER] — Coolant pressure drops at junction V-4. [A] Confirm [B] Reject"
3. The player confirms or rejects with a single button press. Confirming locks the card. Rejecting dismisses it (the system may propose again later with more evidence).
4. Wrong confirmations cost 5 turns. Correct confirmations trigger revelation text + gameplay rewards.

This keeps the strategic decision ("is this the right placement?") while eliminating the tedious card construction.

#### Summary Card Contents

Each card is assembled from confirmed facts:
- **Event**: What system/event was central (from discovered evidence)
- **Key Actor**: Who was the key person (from crew roster)
- **Action**: What they did (from processed scene results)
- **Location**: Where it happened (from processed rooms)

#### Progressive Unlock — Narrative-Gated

Timeline slots unlock based on **narrative state**, not raw room count:

| Slot | Unlock Condition |
|------|-----------------|
| BEFORE | Available from start |
| TRIGGER | 2+ rooms processed AND 1+ crew identified |
| ESCALATION | 4+ rooms processed AND 1+ contradiction found |
| COLLAPSE | 6+ rooms processed AND 3+ crew identified |
| AFTERMATH | All prior slots filled |

#### Confirmation Cascade

Correct Summary Card placement triggers:
1. The card locks in with mechanical click + golden sweep
2. **Revelation text** plays — the detailed narrative paragraph from the existing revelation system (`revelations.ts`)
3. Gameplay rewards: room reveals, sensor hints, door clearances
4. Camera zoom pulse (existing `cameraZoomPulse` mechanism) for emphasis

---

## Part 3: The Two-Story Structure

### The Official Story vs. The Real Story

Every mystery has an Official Story (what the records claim) and a Real Story (what actually happened). The investigation is the journey from believing the first to discovering the second.

#### Evidence Accumulation Model

Rather than explicit Act 1/2/3 tags, evidence uses an **accumulation model** with three categories:

| Category | Description | Example |
|----------|-------------|---------|
| **Confirming** | Supports the Official Story | Captain's incident report: "material fatigue" |
| **Ambiguous** | Could support either story | Badge access logs at unusual hours |
| **Contradicting** | Undermines the Official Story | Recovered draft with deleted paragraphs |

Each piece of evidence is tagged as one of these three during procgen. The system tracks counts:

```typescript
interface EvidenceAccumulation {
  confirming_found: number;
  ambiguous_found: number;
  contradicting_found: number;
  crack_moment_fired: boolean;
}
```

#### The Crack Moment

The Crack Moment fires when a threshold is reached: **confirming_found >= 3 AND contradicting_found >= 1**. This ensures the player has first built confidence in the Official Story before the first crack appears.

Design: The player must first believe the wrong thing. If the first clue hints at foul play, there's no twist.

**Crack Moment UX Event:** The holographic wall glitches for 2 seconds. Official narrative text visually cracks with fracture texture. Wall color shifts from blue-green to amber-teal. Corridor lights flicker. A new layer — the Real Story — emerges. "NARRATIVE BREACH — Official account is inconsistent. Reconstruct true sequence."

**Contradiction detection is delayed.** When the player finds evidence that contradicts earlier evidence, the system does NOT immediately flag it. Instead, the contradiction notification appears **1-2 rooms later** — as if the bot is "processing" the discrepancy. This prevents the game from doing the thinking for the player.

#### Spatial Placement

Evidence placement uses a **distance-based weight** from the starting position, not explicit Act assignments:

```typescript
function evidenceWeight(distFromStart: number, maxDist: number): EvidenceCategory {
  const t = distFromStart / maxDist; // 0.0 near start, 1.0 at far end
  // Near start: heavily Confirming
  // Mid-distance: mix of Ambiguous + occasional Contradicting
  // Far: heavily Contradicting + hidden truths
  if (t < 0.3) return rng.getUniform() < 0.85 ? 'confirming' : 'ambiguous';
  if (t < 0.6) return rng.getUniform() < 0.4 ? 'ambiguous' :
               rng.getUniform() < 0.7 ? 'confirming' : 'contradicting';
  return rng.getUniform() < 0.5 ? 'contradicting' : 'ambiguous';
}
```

Behind hazards, locked doors, or requiring upgraded sensors = more likely Contradicting. The station layout IS the pacing mechanism.

### Contradictory Evidence Pairs

For each key deduction, the system generates a **pair of evidence items that directly contradict each other**, placed in different rooms.

Example (HullBreach archetype):
- **Evidence A** (Security report, near start): "Sealed compromised bulkheads. Breach geometry consistent with micro-meteorite impact."
- **Evidence B** (Engineering scan, behind hazard): "Fracture analysis: radial stress from interior surface. Tool marks along fracture edge. Impact direction: inside-out."

Neither alone solves anything. Together: "The security officer says meteorite, but the engineering scan says tool marks. Someone is lying."

Each archetype gets 2-3 contradiction pairs at different sensor tiers. The player must explore different rooms to find both halves.

### Red Herrings — "The Honest Lie"

Good red herrings are TRUE — they just mean something different than you think.

**Type 1 — Premature Conclusion**: Early evidence that genuinely supports the simpler explanation. The hull WAS fatiguing from thermal cycling — but that's not what caused the breach. Someone used the existing weakness.

**Type 2 — Wrong Suspect**: Evidence that implicates the wrong person for a reason that makes sense in retrospect. The engineer's badge accessed the relay junction at 2 AM — suspicious! But later: unauthorized diagnostics because the captain denied official access.

(Red Herring Type 3 "Parallel Stories" is CUT for MVP — not enough rooms to sustain a secondary narrative thread without diluting the primary mystery.)

---

## Part 4: The Investigation Hub UX

### The Dossier Wall — Overview Mode

The Investigation Hub is a **holographic wall** projected by the bot. The station remains dimly visible around the edges. Three horizontal bands at overview resolution:

```
+--------------------------------------------------------------+
|  CREW DOSSIERS (top strip, horizontally scrollable)          |
|  +------+ +------+ +------+ +------+ +------+ +------+      |
|  | ??   | | Dr.V | | ??   | | Eng. | | ??   | | ??   |      |
|  |      | | #### | |      | | Chen | |      | |      |      |
|  | ???  | | CMO  | | ???  | | ENG  | | ???  | | ???  |      |
|  |      | | *ACT | |      | | *MIS | |      | |      |      |
|  +------+ +------+ +------+ +------+ +------+ +------+      |
|--------------------------------------------------------------|
|  INCIDENT TIMELINE (middle band)                             |
|  BEFORE ---- TRIGGER ---- ESCALATION -- COLLAPSE -- AFTER   |
|  +------+   +------+     +------+                            |
|  |Normal|   |??????|     |Power |      [locked]   [locked]   |
|  |ops   |   |      |     |fail  |                            |
|  +------+   +------+     +------+                            |
|--------------------------------------------------------------|
|  ROOM SCENES (bottom strip, horizontally scrollable)         |
|  +------+ +------+ +------+ +------+                        |
|  |Bridge| |MedBay| | Lab  | |Power |   ...more rooms        |
|  | ***  | | **o  | | ooo  | | *oo  |                        |
|  |SOLVED| | 2/3  | | NEW  | | 1/3  |                        |
|  +------+ +------+ +------+ +------+                        |
|                                                              |
|  [LB] Region    [D-pad] Navigate   [A] Select    [B] Back   |
+--------------------------------------------------------------+
```

#### Navigation — Controller Modes

The game has two input modes:

| Mode | Active When | D-pad Does | A Does | B Does |
|------|-------------|------------|--------|--------|
| **Movement** | Default, walking around | Move player | Interact | Open Hub |
| **Hub** | Investigation Hub open | Navigate cards | Select/Confirm | Back/Close |

**Mode transitions:** B opens Hub (enters Hub mode). B again closes it (returns to Movement mode). No explicit "menu mode" toggle — the Hub IS the menu. Scene Processing happens in Movement mode with HUD prompts overlaid.

#### Detail Views — Full Screen Replacements

At 1280x800, detail views replace the overview entirely (not split-screen):

- **Crew Dossier detail**: Full-screen profile — confirmed info, theories (auto-populated from Scene Processing), personal details, linked evidence list, rooms seen
- **Timeline slot detail**: Full-screen card with revelation text, linked evidence, location map
- **Room Scene detail**: Full-screen scene recap — all clues found, processing results, crew placed here

Press B to return to overview from any detail view.

### Overlay Consolidation Plan

The following existing overlays are **replaced** by the unified Investigation Hub:

| Existing Overlay | Replaced By |
|-----------------|-------------|
| Evidence card overlay (V205) | Hub > Room Scenes > detail view |
| Investigation Hub 4-section (V200) | New 3-band Dossier Wall |
| Crew profiling panel | Hub > Crew Dossiers > detail view |
| "What We Know" narrative | Hub > Timeline > revelation text cascade |

The following overlays are **kept** as they serve different purposes:

| Overlay | Reason Kept |
|---------|-------------|
| Minimap | Always-on navigation aid |
| HP/sensor HUD bar | Always-on status |
| Subtitle queue | Transient feedback |
| Signal glitch/damage effects | Reactive screen-space effects |
| Scene Processing HUD prompts | In-world interaction (not a menu) |

### Evidence Constellation — DEFERRED

Manual player-drawn links between evidence pieces are CUT from MVP. The system auto-links evidence to crew members (by name mention) and to rooms (by discovery location). The constellation visualization is deferred to a later milestone — it's high-effort, low-impact compared to getting Room Scenes and the Incident Board right.

### Discovery Moments — UI Events

**Contradiction found** (delayed 1-2 rooms): Screen flickers with VHS-style tear for 1.2s. Both contradicting clues shown in split view. Bass rumble. "CONTRADICTION DETECTED"

**Timeline slot confirmed**: Card slides in with mechanical click. Adjacent filled slots draw connecting lines. All five filled = circuit-completion sweep.

**The Crack Moment**: Wall glitch, fracture texture on Official Story text, permanent color shift, corridor lights flicker. "NARRATIVE BREACH"

**Crew fate confirmed**: Dossier card resolves from static to clear. Border color locks (green=alive, red=deceased, blue=evacuated). Holographic seal stamps.

---

## Part 5: Procedural Generation Pipeline

### Room Scene Generation Algorithm

This is the hardest implementation challenge. The algorithm must deterministically produce solvable scenes from the existing crew paths and timeline data.

```
INPUTS:
  - crew: CrewMember[] (from crewGen.ts)
  - timeline: IncidentTimeline (from timeline.ts)
  - crewPaths: PathResult[] (from crewPaths.ts — who went where)
  - rooms: Room[] (from procgen)
  - playerStartRoom: Room

STEP 1: Assign timeline beats to rooms
  For each TimelinePhase, select a PRIMARY ROOM:
    NormalOps  -> duty station of the first central role
    Trigger    -> room where the triggering event logically occurs
    Escalation -> room adjacent to trigger (spreading damage)
    Collapse   -> room where the key response happens
    Aftermath  -> Cargo Hold or shelter room

STEP 2: Generate crew presence per room
  For each room R:
    crewPresent = []
    For each crew member C:
      If C's crewPath passes through R:
        phase = timeline phase when C would have been here
              (derived from path position: early=NormalOps, mid=Escalation, late=Collapse)
        activity = derive from C.role + phase + archetype
        crewPresent.push({ crewId: C.id, phase, activity })

    // Ensure story-critical rooms have their assigned crew
    If R is a PRIMARY ROOM for a timeline phase:
      Ensure the phase's central role crew member is in crewPresent

STEP 3: Generate physical clues per room
  For each room R:
    clues = []
    For each crew member in R.crewPresent:
      Add 1 clue based on their activity:
        EmergencyResponse -> damage pattern, deployed equipment
        Fleeing -> dropped personal item, scuff marks
        Hiding -> barricade, sealed door evidence
        RoutineWork -> access log, terminal in use
        Sabotage -> modified equipment, residue
        MedicalTreatment -> medical supplies, blood trace

    Add 1 environmental clue from room's hazard state:
      heat -> scorch marks, melted panels
      pressure -> frost patterns, cracked seals
      electrical -> burn marks, sparking conduits

    Cap at 4 clues per room. Prioritize story-critical clues.

STEP 4: Assign evidence categories (Confirming/Ambiguous/Contradicting)
  distFromStart = BFS distance from playerStartRoom to R
  maxDist = max BFS distance across all rooms
  For each clue in R:
    clue.evidenceCategory = evidenceWeight(distFromStart, maxDist)

STEP 5: Generate ground truth for scene processing
  For each room R:
    groundTruth = {
      who: R.crewPresent.map(c => c.crewId),
      what: primary activity of the most story-relevant crew member here,
      outcome: derived from crew fates + path outcomes for crew in this room
    }

STEP 6: Generate contradiction pairs
  For each archetype, 2-3 pairs:
    officialEvidence -> placed in a room near start (low distFromStart)
    realEvidence -> placed behind hazard or locked door (high distFromStart)
```

### Room Scene Data Structure

```typescript
interface RoomScene {
  roomId: string;
  roomName: string;
  crewPresent: {
    crewId: string;
    phase: TimelinePhase;
    activity: SceneActivity;
  }[];
  physicalClues: PhysicalClue[];
  environmentalState: {
    damageType: 'thermal' | 'pressure' | 'electrical' | 'biological' | 'none';
    damageLevel: 0 | 1 | 2 | 3;
    hasBarricade: boolean;
    sealState: 'open' | 'sealed_inside' | 'sealed_outside';
  };
  evidenceCategory: 'confirming' | 'ambiguous' | 'contradicting';
  processed: boolean;
  processAttempts: number;
  groundTruth: {
    who: string[];         // crew IDs
    what: SceneActivity;
    outcome: SceneOutcome;
  };
}

interface PhysicalClue {
  id: string;
  type: 'badge' | 'personal_effect' | 'damage_pattern' | 'access_log' |
        'terminal_log' | 'tool' | 'residue' | 'barricade' | 'modified_equipment' |
        'memory_echo';
  text: string;
  sensorRequired: SensorType | null;  // null = always visible
  crewLinked?: string;                 // crew ID if this clue names someone
  examined: boolean;
  pos: { x: number; y: number };      // position within the room
}
```

### Solvability Guarantee

The system remains solvable by the AI playtest bot because:
- Every scene has a deterministic ground truth from procgen
- Cross-referencing is mechanical (match badge IDs to manifest, names in logs to roster)
- Timeline placement is system-proposed (not free-text assembly)
- The bot can systematically process all rooms and examine all clues
- Scene Processing has unlimited retries (increasing turn cost, never locked out)

---

## Part 6: The Moral Dimension

### Beyond "Who Did It"

The first 4-5 deductions are forensic: What happened? Where? Who was involved? These have correct answers.

The **final deduction** is a genuine moral choice: given everything you've learned, what do you transmit in your report? The evidence supports multiple interpretations.

Examples from existing archetypes:
- **CoolantCascade**: The captain deferred maintenance because the resupply deadline was real and the crew's food was running low. The engineer filed three reports and was ignored. Both are true. Whose assessment do you send?
- **HullBreach**: The security officer sealed the bulkhead to save the majority. The people on the other side died. Was it murder or triage?
- **ReactorScram**: The data core triggered a SCRAM to prevent its own erasure. Is it alive? Do you report it as a malfunction or as emergence?

The scoring/ending reflects the **quality and completeness** of the investigation, not which moral choice the player makes. A fully-informed choice earns more than a guess.

### Moral Choice UX

The moral choice appears at the data core terminal (existing `DataCore` entity interaction). After the player has completed the forensic investigation chain:

1. HUD displays the moral question with 2-3 options
2. Each option includes a brief preview of what the report will say
3. Player selects with D-pad + A (same as Scene Processing)
4. Confirmation prompt: "This will be your final report. Confirm? [A] Yes [B] Reconsider"
5. The choice triggers the endgame sequence (existing evacuation system)

No timer, no penalty, no "correct" answer. The player sits with the evidence and decides.

---

## Part 7: Turn Budget Analysis

Current turn limits: Easy 1300, Normal 1000, Hard 700.

With the redesigned mystery system, a typical investigation run breaks down:

| Activity | Turns (Normal) | Notes |
|----------|----------------|-------|
| Exploration (10 rooms) | ~100-150 | Walking between rooms, corridor traversal |
| Hazard management | ~50-100 | Sealing breaches, avoiding heat, cleaning |
| Clue examination (3 clues x 10 rooms) | ~30 | 1 turn per clue |
| Scene Processing (10 rooms) | ~30-80 | 3 turns base, more on retries |
| Timeline confirmation (5 slots) | ~15-25 | 3-5 turns per proposal evaluation |
| Crew rescue/evacuation | ~50-100 | Escorting crew to pods |
| Puzzle solving (relays, doors) | ~50-100 | Existing puzzle mechanics |
| Idle/planning/journal review | ~50 | Free actions (0 turns for Hub) |
| **Total** | **375-635** | Well within 1000 turn budget |

The generous turn budget means the mystery can breathe. Players should feel like they have time to think, re-examine, and explore — not rush through scenes. The increasing retry cost on Scene Processing provides soft pressure without hard lockout.

---

## Part 8: Migration Plan

### Existing File Disposition

| File | Action | Notes |
|------|--------|-------|
| `src/sim/incidents.ts` | **KEEP** | 6 archetype templates are excellent. No changes needed. |
| `src/sim/crewGen.ts` | **EXTEND** | Add themed triplet pool assignment (want/habit/contradiction) during generation |
| `src/sim/crewPaths.ts` | **EXTEND** | Crew paths become the input for Room Scene generation. Add phase tagging to path segments. |
| `src/sim/timeline.ts` | **REFACTOR** | Add deterministic room assignment to timeline phases. Currently room assignment is random (`roomNames[Math.floor(ROT.RNG.getUniform() * roomNames.length)]`). Must be intentional. |
| `src/sim/deduction.ts` | **REPLACE** | Current 5-6 chained multiple-choice deductions replaced by Scene Processing + Incident Board. Deduction data structures change significantly. STORY_ROLES and revelation linkage kept. |
| `src/sim/threads.ts` | **KEEP** | Narrative threads still group evidence. Thread assignment logic unchanged. |
| `src/sim/mysteryChoices.ts` | **KEEP** | Moral choices at endgame. May extend with investigation-quality scoring. |
| `src/data/logTemplates.ts` | **EXTEND** | Add Physical Clue templates alongside existing log templates. Template variables unchanged. |
| `src/data/crewItems.ts` | **KEEP** | Memory echoes are now a formal pillar. May add themed triplet items. |
| `src/data/revelations.ts` | **KEEP** | Revelation text triggers on timeline slot confirmation. No changes needed. |
| `src/data/narrative.ts` | **KEEP** | Branched epilogues still drive endings. |
| `src/shared/types.ts` | **EXTEND** | Add RoomScene, PhysicalClue, CrewDossier, EvidenceAccumulation interfaces. Modify MysteryState. |

### What Gets Replaced
- Multiple-choice deduction chain (`Deduction` with options/answers) -> Scene Processing + Incident Board
- Evidence count thresholds (2/4/6/8/10/12) -> Room processing count + crew ID count + narrative gates
- Tag-based evidence linking (hidden) -> Spatial cross-referencing (player-driven)
- Generic EvidenceTrace entities -> PhysicalClue entities with sensor layers

### What Gets Kept
- Incident archetypes and timeline generation (all 6 stories)
- Crew generation with roles, relationships, secrets, fates
- Crew paths and breadcrumb placement (feeds room scene generation)
- Revelation text templates (triggered by timeline slot confirmation)
- Narrative threads
- Mystery choices affecting endings
- Sensor upgrade system (now narratively integrated)
- All existing log templates (extended, not replaced)
- Memory echoes from crewItems.ts
- Scene echoes (ghost silhouettes, damage marks)

### What Gets Added
- RoomScene generation during procgen (STEP 1-6 algorithm above)
- PhysicalClue entity type with sensor layers
- Scene Processing interaction (per-room WHO/WHAT/OUTCOME)
- Crew Dossier tracking with themed triplet biographies
- Incident Board with system-proposed timeline reconstruction
- Evidence accumulation tracking (confirming/ambiguous/contradicting)
- Contradiction pair generation (2-3 per archetype)
- Distance-based evidence category assignment
- Crack Moment with delayed contradiction detection
- Dossier Wall redesign (3-band overview + full-screen detail)
- Discovery moment UI events
- Moral choice UX at data core terminal
- Investigation quality score card

---

## Part 9: Implementation Roadmap

### Sprint 0 — Refactor Timeline Room Assignment
**Goal**: Make `timeline.ts` assign timeline beat locations deterministically based on room types and crew duty stations, not randomly.

- Refactor `generateTimeline()` to accept rooms with types, not just room name strings
- Map each TimelinePhase to a logical room: NormalOps -> crew duty station, Trigger -> archetype-appropriate room (Power Relay for CoolantCascade, Crew Quarters for HullBreach, etc.), Escalation -> adjacent room, Collapse -> response room, Aftermath -> Cargo Hold
- Add `phaseRoom: Record<TimelinePhase, string>` to `IncidentTimeline` interface
- Verify deterministic room assignment with golden seed test
- **Hard part**: Ensuring the selected rooms actually exist in the procgen layout. Fallback to closest match by room type.

### Sprint 1 — Room Scene Foundation
**Goal**: Every room has a generated scene with physical clues and ground truth.

- Add `RoomScene`, `PhysicalClue` interfaces to `types.ts`
- Create `src/sim/roomScenes.ts` implementing STEP 2-5 of the generation algorithm
- Replace generic `EvidenceTrace` entities with `PhysicalClue` entities
- Room entry descriptions based on scene state (environmental damage, clue count)
- Basic scene processing interaction (WHO/WHAT/OUTCOME) via HUD prompts
- Ground truth validation (unit tests for each archetype)
- Extend `MysteryState` with `roomScenes: Map<string, RoomScene>` and `dossiers: Map<string, CrewDossier>`

### Sprint 2 — Crew Dossiers & Identity
**Goal**: Crew members are tracked as investigation targets with auto-populating theories.

- Crew Dossier tracking from badge/log discovery
- Themed triplet pool generation in `crewGen.ts` (want/habit/contradiction)
- Auto-populate dossier theories from Scene Processing answers
- Cross-reference system (badge IDs <-> names <-> roles)
- Evidence auto-linking to crew members by keyword
- Dossier detail view in Investigation Hub

### Sprint 3 — Incident Board & Timeline
**Goal**: System-proposed timeline with player confirmation.

- Timeline reconstruction with 5 phase slots
- System-proposed Summary Cards from scene evidence
- Player confirm/reject interaction (HUD bottom prompt)
- Narrative-gated slot unlocking (not raw room count)
- Revelation text triggers on correct placement (from `revelations.ts`)
- Wrong confirmation penalty (5 turns)

### Sprint 4 — Two-Story Structure
**Goal**: The Official Story and the Real Story are distinct investigative layers.

- Evidence accumulation tracking (confirming/ambiguous/contradicting)
- Distance-based evidence category assignment during procgen
- Contradiction pair generation per archetype
- Delayed contradiction detection (1-2 rooms after finding contradicting evidence)
- Crack Moment UI event
- Official Story / Real Story visual split in Dossier Wall

### Sprint 5 — Investigation Hub Redesign
**Goal**: The 3-band Dossier Wall replaces the 4-section Investigation Hub.

- Overview mode with crew/timeline/rooms bands
- Full-screen detail views for each card type
- Controller navigation (LB/RB between bands, D-pad within)
- Overlay consolidation (remove replaced overlays)
- Discovery moment animations

### Sprint 6 — Moral Dimension & Endgame
**Goal**: The investigation concludes with a moral choice and quality assessment.

- Final moral deduction at data core (no single correct answer)
- Investigation quality scoring (scenes processed, crew identified, contradictions found, timeline accuracy)
- End-of-game investigation summary playback
- Score card display
- Integration with existing evacuation endgame

---

## Hardest Implementation Challenges

1. **Room Scene Generation (Sprint 1)**: The algorithm in Part 5 looks clean on paper but requires cross-referencing crew paths (which are spatial, based on BFS through the tile grid) with timeline phases (which are narrative, based on story beats). The mapping between "where along their path were they during the Escalation phase" is fuzzy and needs careful calibration per archetype.

2. **Deterministic Timeline Room Assignment (Sprint 0)**: The current `timeline.ts` assigns random rooms to timeline events. Making this deterministic requires knowing which room types exist in the procgen layout and mapping archetype logic to room types. The fallback behavior when a needed room type doesn't exist must be robust.

3. **Evidence Category Balance**: Too many Confirming clues = boring. Too many Contradicting clues early = no twist. The distance-based weight function needs playtesting across all 6 archetypes and multiple seeds to find the right curve.

4. **Scene Processing UX in 3D**: The "walk to clues, examine, answer at HUD" flow works in concept but must feel natural in the chase-cam 3D view. Clue objects need to be visually distinct from other room entities (glowing scan rings), and the HUD prompts need to be readable without obscuring the game world.

5. **Playtest Bot Adaptation**: The existing heuristic playtest bot (`playtest_bot.ts`) and Claude API driver (`claudeDriver.ts`) need updates to interact with Scene Processing and the Incident Board. The bot must be able to examine clues, process scenes, and confirm timeline proposals.
