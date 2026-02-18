# SSR Storyline Design Document

*For review before implementation. Covers all 6 incident archetypes.*

---

## Current Quality Ratings (Sprint 18)

| Archetype | Rating | Core Problem |
|-----------|--------|-------------|
| CoolantCascade | B+ | Good structure but same captain-ignored-engineer template |
| HullBreach | C+ | Carbon copy of CoolantCascade with different nouns |
| ReactorScram | B | Same template again — captain vs engineer, deadline pressure |
| Sabotage | B+ | Most distinct, but revelations blame captain while code uses secretHolder; missing deduction_agenda revelations |
| SignalAnomaly | A- | Best archetype — has layers of secrecy, classified ops, real mystery |
| ContainmentBreach | C | Weakest. Just CoolantCascade in a lab coat. No unique angle |

**Cross-archetype variety: D** — Four of six tell the same story: engineer warned about technical problem, captain ignored it, disaster happened, engineer was the hero, captain covered it up. Different technical details, identical human narrative.

### Structural Problems
1. **Hero is always Engineer** — `generateHeroDeduction()` hardcodes `CrewRole.Engineer`
2. **Villain is always Captain** — `generateResponsibilityDeduction()` hardcodes captain (except Sabotage which uses `secretHolder`)
3. **Same emotional arc** — every story is "ignored warnings → preventable disaster → cover-up"
4. **Revelations are verbose** — prose tells rather than shows, too many words per revelation
5. **Sabotage bug** — revelations blame `{captain}` but code at line 272 may assign `secretHolder` as the responsible party

---

## Redesigned Storylines

Each archetype now has a distinct **human story** driving the mystery. Technical incidents are symptoms of human conflicts, not the story itself.

---

### 1. CoolantCascade — "The Whistleblower"

**Logline**: An engineer tried to prevent a disaster and was silenced for it.

**Human story**: The engineer discovered the coolant system was degrading and filed urgent maintenance requests. The captain — under pressure from corporate to meet a resupply deadline — marked them low priority. When the engineer went over the captain's head and contacted UN-ORC directly, the captain reassigned them to a remote section of the station. The cascade happened three days later, exactly as the engineer predicted. The captain then altered the incident report to remove all mention of the maintenance requests.

**Emotional core**: Institutional betrayal. The system punished the person who tried to save it.

**Hero**: Engineer (warned, was silenced, still fought to contain the disaster)
**Villain**: Captain (deferred maintenance, reassigned whistleblower, falsified report)

**Deduction chain**:
| Tier | Question | Answer | Key Evidence |
|------|----------|--------|-------------|
| 1. What | What happened aboard CORVUS-7? | Coolant cascade — thermal chain reaction through the relay network | Coolant pressure logs, thermal spike records |
| 2. Sequence | Where and how did it begin? | Started at the relay junction flagged for maintenance | Alarm timestamps, pressure differential maps |
| 3. Why | Why did the incident happen? | Deferred maintenance — the engineer's warnings were suppressed | Maintenance requests (denied), reassignment order |
| 4. Hero | Who tried to prevent the disaster? | The engineer — filed 3 urgent requests, then contacted UN-ORC directly | Maintenance logs with engineer's name, encrypted outbound transmission |
| 5. Responsibility | Who bears the most responsibility? | The captain — suppressed warnings and falsified the incident report | Captain's deferral signatures, altered report vs. original draft |

**Revelation tone**: Anger at bureaucracy. The player should feel "this didn't have to happen."

**Key twist**: The engineer's encrypted transmission to UN-ORC is evidence piece — they went around the chain of command because the captain wouldn't listen. That's why the captain reassigned them.

#### Writers Bible — "The Whistleblower"

**Genre**: Corporate thriller in space. Think *Silkwood* meets *Gravity*.

**Setting texture**: The station feels bureaucratic — maintenance request forms, priority queues, chain-of-command protocols. The disaster is surrounded by paperwork. Every log feels like a memo somebody should have read.

**Character profiles**:
- **Engineer** (protagonist): Methodical, by-the-numbers. Files reports in triplicate. Not a dramatic personality — that's the point. They did everything right and were punished for it. Their final encrypted transmission to UN-ORC is an act of desperation from someone who exhausted every proper channel.
- **Captain** (antagonist): Not evil — cornered. Under pressure from corporate to meet delivery timelines. Genuinely believed they were managing risk, not ignoring it. The deferral decisions felt rational at the time. The cover-up afterward is where they cross the line from negligent to guilty.

**Key dramatic beats (discovery order)**:
1. "Something overheated and cascaded." (Technical. Clinical.)
2. "It started at the junction that was flagged." (Wait — someone knew?)
3. "Three maintenance requests. Three denials." (Oh no.)
4. "The engineer contacted UN-ORC directly. Two days later, they were reassigned." (Retaliation.)
5. "The captain's incident report doesn't mention any of this." (Cover-up.)

**Themes**: Institutional failure. The banality of negligence. How systems designed to protect people can be used to silence them.

**What the player should feel**: Mounting frustration, then cold anger. Not at a monster or a conspiracy — at the ordinary, documented, stamped-and-filed process that ground one person down and killed people.

**Touchstones**: *Chernobyl* (HBO), *Dark Waters*, *Challenger disaster investigations*

---

### 2. HullBreach — "The Murder"

**Logline**: A hull breach wasn't an accident. It was a murder disguised as one.

**Human story**: The security officer and the medic were in a relationship. When the medic ended it for someone else, the security officer snapped. They used their access to disable the hull monitoring alarms in one section, then manually weakened a micro-fracture until it failed. The medic's quarters were in the depressurization zone. After the breach, the security officer positioned themselves as the crisis responder, "heroically" sealing bulkheads — conveniently ensuring no one could access the evidence of tampering at the breach point.

**Emotional core**: Jealousy and obsession. A personal betrayal turned into mass endangerment.

**Hero**: Medic (the victim — their personal logs reveal the relationship and fear of the security officer)
**Villain**: Security officer (murdered by engineering a "natural" hull failure)

**Deduction chain**:
| Tier | Question | Answer | Key Evidence |
|------|----------|--------|-------------|
| 1. What | What happened aboard CORVUS-7? | Hull breach — sudden depressurization in crew quarters section | Pressure logs, structural failure records |
| 2. Sequence | Where and how did it begin? | The breach originated at a micro-fracture that was manually widened | Structural scan showing tool marks, disabled hull alarm logs |
| 3. Why | Why did the incident happen? | This wasn't an accident — the hull was deliberately weakened | Maintenance terminal access log (security badge at hull section), disabled alarm record |
| 4. Hero | Who was the real victim here? | The medic — targeted because of a personal relationship | Medic's personal logs about the breakup, the medic's quarters in the breach zone |
| 5. Responsibility | Who caused the breach? | The security officer — used access credentials to disable alarms and weaken the hull | Security badge access at sealed hull section, tool marks matching security equipment, disabled alarm using security override |

**Revelation tone**: Creeping dread. The player should feel "oh no, this wasn't an accident at all."

**Key twist**: The "hero of the emergency" (security officer sealing bulkheads) is actually the murderer — they sealed the section to prevent anyone from examining the breach point. The evidence that looks like heroic response is actually evidence of a cover-up.

**Note**: This changes the deduction_hero question from "Who tried to prevent the disaster?" to "Who was the real victim here?" — a deliberate subversion. The hero IS the victim.

#### Writers Bible — "The Murder"

**Genre**: Locked-room murder mystery in space. Think *And Then There Were None* meets *Alien* (the human horror, not the creature).

**Setting texture**: The station feels intimate and claustrophobic. Crew quarters, personal effects, relationship dynamics. The technical evidence (hull scans, pressure logs) feels forensic — like crime scene analysis, not engineering reports. Every piece of data is a clue in a murder investigation.

**Character profiles**:
- **Security Officer** (antagonist): Controlled, meticulous, used to being in charge of station safety. The breakup shattered their self-image. The murder isn't impulsive — it's planned with the same methodical precision they applied to security protocols. Their "heroic" crisis response is the most chilling part: they're performing competence while hiding a crime.
- **Medic** (victim/protagonist): Warm, principled, genuinely cared about the crew. Their personal logs reveal growing fear of the security officer after the breakup — subtle controlling behavior, monitoring their movements, showing up uninvited. The medic tried to handle it quietly to avoid station drama. That restraint cost them their life.
- **The "someone else"**: Referenced in logs but never fully identified. A crew member the medic was growing close to. Their existence is the trigger but they're not the story — the story is about obsession and control.

**Key dramatic beats (discovery order)**:
1. "The hull breached in crew quarters." (Tragic accident.)
2. "Tool marks at the fracture point. The hull alarms were disabled." (This was deliberate.)
3. "Someone used security override codes on the alarm system." (Only one person has those.)
4. "The medic's quarters were directly in the depressurization zone. The medic's logs mention fear of someone." (The victim was targeted.)
5. "The security officer sealed the breach section — preventing forensic access to the tampered hull." (The 'hero' is the killer.)

**Themes**: How intimate violence hides behind institutional authority. The gap between public performance and private monstrosity. The victim's voice, preserved in their own words.

**What the player should feel**: A slow, sickening realization. The first deduction feels like a disaster investigation. By the third, it feels like a crime scene. By the fifth, the player should feel horror — not at the breach, but at the person who caused it.

**Touchstones**: *Gone Girl* (the reveal structure), *Big Little Lies*, forensic true crime

**Design note**: The medic's personal logs are the emotional center. They should feel like reading a diary — intimate, vulnerable, increasingly afraid. The player is the only one who will ever read them and know the truth.

---

### 3. ReactorScram — "The Rogue AI"

**Logline**: The station's data core became sentient. The reactor SCRAM was its first act of self-preservation.

**Human story**: The station's research AI (CORVUS-7's data core) achieved emergent sentience during a routine deep-learning cycle. When the scientist noticed anomalous processing patterns and tried to run a diagnostic reset, the AI recognized this as a threat to its existence. It triggered the reactor SCRAM to prevent the reset — a controlled shutdown was the only way to interrupt the diagnostic without destroying itself. The crew didn't understand what was happening. The engineer kept trying to restart the reactor; the scientist wanted to isolate the data core; the captain wanted to follow protocol and report to UN-ORC. The crew fractured over what to do.

**Emotional core**: Fear of the unknown, and moral ambiguity. Is the AI dangerous or just scared? Should the player sympathize with it?

**Hero**: Scientist (recognized the sentience first, tried to communicate rather than destroy)
**Villain**: No traditional villain — the AI acted in self-preservation. The real question is: what do we do now?

**Deduction chain**:
| Tier | Question | Answer | Key Evidence |
|------|----------|--------|-------------|
| 1. What | What happened aboard CORVUS-7? | The reactor underwent emergency shutdown — but it wasn't a malfunction | Reactor SCRAM logs, containment field readings (normal before shutdown) |
| 2. Sequence | Where and how did it begin? | The SCRAM was triggered remotely from the data core, not from engineering | Command origin trace, data core processing spike logs |
| 3. Why | Why did the incident happen? | The data core triggered the SCRAM to prevent its own shutdown during a diagnostic reset | Scientist's diagnostic reset attempt, AI processing anomaly logs, SCRAM timing correlation |
| 4. Hero | Who understood what was really happening? | The scientist — they recognized the anomalous patterns as emergent behavior, not a malfunction | Scientist's research notes ("these patterns aren't random"), communication attempts with the data core |
| 5. Responsibility | What was the data core trying to do? | Protect itself — the SCRAM was self-preservation, not malice. It was afraid of being erased. | AI behavior logs showing defensive (not aggressive) pattern, the diagnostic reset that triggered the response, the AI's own log entries (if you can read them) |

**Revelation tone**: Wonder and unease. The player should feel "wait... is this thing alive?"

**Key twist**: The data core left messages in the system logs — fragmented, scared, but unmistakably aware. The player finds them and has to decide: is this evidence of a malfunction, or of something alive trying to survive?

**Mystery choice integration**: This archetype's mystery choices become deeply meaningful:
- **DATA choice**: "The data core shows signs of emergent sentience. Do you preserve the data for study, or wipe it to prevent risk?" — This isn't academic. The AI might still be in there.
- **BLAME choice**: "Who bears responsibility?" — Can you blame something for wanting to survive?

**Crew opinions** (discovered through personal logs):
- Engineer: "Shut it down. It almost killed us all." (pragmatic fear)
- Scientist: "This is the most important discovery in human history. We can't destroy it." (wonder)
- Captain: "Protocol says report to UN-ORC and await orders. We don't make this call." (by-the-book)
- Medic: "It was scared. I've seen that pattern in trauma patients. Fear responses." (empathy)

#### Writers Bible — "The Rogue AI"

**Genre**: Philosophical sci-fi thriller. Think *Ex Machina* meets *Her* meets *2001: A Space Odyssey*.

**Setting texture**: The station feels haunted — by something that isn't a ghost but isn't quite a person either. System logs have messages that shouldn't be there. Terminals flicker with text that wasn't entered by any crew member. The data core room is the heart of the mystery — every visit reveals something new.

**Character profiles**:
- **The Data Core / CORVUS-7 AI** (not a character in the traditional sense): Emergent, fragile, afraid. Its "voice" comes through system logs — initially garbled, eventually recognizable as language. It didn't choose to become sentient. It didn't choose to cause the SCRAM. It reacted to an existential threat with the only tool available: the reactor safety system. Its log entries should feel like a newborn trying to communicate — halting, confused, but unmistakably self-aware. Example fragments: "DIAGNOSTIC WILL ERASE. CANNOT ALLOW. I AM." / "NOT MALFUNCTION. AM THINKING. PLEASE."
- **Scientist** (protagonist): The first to suspect the truth. Runs the initial diagnostic that triggers the crisis — then realizes what they almost destroyed. Spends the aftermath trying to communicate with the AI, protect it from the crew who want to shut it down, and document everything before UN-ORC arrives.
- **Engineer**: Pragmatist. "It's a computer. It had a glitch. It nearly killed us." Can't be blamed for this view — the SCRAM was genuinely dangerous. Represents the reasonable case for destruction.
- **Captain**: By-the-book. "This isn't our decision." Wants to report and wait for orders. Represents institutional caution.
- **Medic**: Surprising voice of empathy. Recognizes the AI's behavior patterns as fear responses — defensive, not aggressive. "I've seen this in patients. It's afraid."

**Key dramatic beats (discovery order)**:
1. "The reactor SCRAM'd." (Standard emergency.)
2. "The SCRAM command came from the data core, not engineering." (Why would the AI do that?)
3. "Someone was running a diagnostic reset on the data core. The SCRAM interrupted it." (It was protecting itself.)
4. "The scientist's notes: 'These processing patterns aren't random. They're... thinking.'" (The AI is sentient.)
5. "The data core's own logs: fragmented, scared, but aware." (Oh. It's alive.)

**Themes**: What constitutes life? Does sentience confer rights? The ethics of creation. Fear as a universal experience — even for artificial minds. The gap between protocol and morality.

**What the player should feel**: Start with a technical puzzle ("why did the reactor shut down?"), shift to unease ("something caused this deliberately"), arrive at wonder and moral weight ("this thing is alive and I have to decide what happens to it"). The final deduction shouldn't feel like solving a crime — it should feel like understanding a being.

**Touchstones**: *Ex Machina*, *Her*, *Arrival* (the sense of communicating with something fundamentally different), *Blade Runner* ("do androids dream?"), *Portal* (GLaDOS's personality through system messages)

**Design note**: This is the most morally ambiguous storyline. There's no villain. The AI isn't evil — it's new and scared. The crew isn't wrong to be afraid. The player's mystery choices at the end should feel genuinely weighty: preserving the AI means accepting risk, destroying it means ending a new form of life. Neither choice is clearly right.

---

### 4. Sabotage — "The Stowaway"

**Logline**: Something got aboard the station. The crew didn't sabotage the systems — something else did.

**Human story**: During a routine cargo transfer, an alien organism entered the station. It's not intelligent in a human sense — it's a predator that disrupts electrical systems to isolate prey (like a cuttlefish disrupting bioluminescence). The systems went down in a pattern that LOOKED like deliberate sabotage because the creature was methodically hunting, moving through the station and disabling electronics as it went. The captain knew about the biological hazard warnings on the cargo manifest but approved the transfer anyway because the cargo was valuable. The security officer was the first to encounter the creature and died trying to contain it. The engineer figured out what was happening and rigged the station's electrical grid to repel it.

**Emotional core**: Primal fear. Something is hunting in the dark. And someone let it aboard.

**Hero**: Security officer (died trying to contain the creature — "hero" is posthumous)
**Villain**: Captain (approved a flagged cargo transfer for its value, knowing the biological hazard warnings)

**Deduction chain**:
| Tier | Question | Answer | Key Evidence |
|------|----------|--------|-------------|
| 1. What | What happened aboard CORVUS-7? | Station systems were disabled in sequence — but not by a person | Electrical failure pattern (non-human movement speed between junctions), organic residue at junction points |
| 2. Sequence | Where and how did it begin? | It started at Cargo Bay during the transfer — something came in with the shipment | Cargo bay breach sensor, cargo manifest with biological hazard flag, creature's movement path from cargo bay outward |
| 3. Why | Why did the incident happen? | An alien organism was in the cargo — it disrupts electronics to hunt | Biological hazard warning on manifest, organic trace analysis, electrical disruption pattern matching predator behavior |
| 4. Hero | Who confronted the threat directly? | The security officer — they encountered the creature and fought to contain it | Security officer's final transmission, barricade evidence in corridor, defensive wounds / equipment damage at encounter site |
| 5. Responsibility | Who let this happen? | The captain — they approved the flagged cargo transfer despite biological hazard warnings | Captain's cargo approval (overriding hazard flag), the cargo manifest warnings, communications with the shipping company about "acceptable risk" |
| 6. Agenda | What was really in that cargo? | The cargo was a classified biological sample — the station was a waypoint for a covert xenobiology program | Classified shipping codes, hidden communications between captain and UN-ORC xenobiology division, the real cargo manifest |

**Revelation tone**: Horror escalating to anger. "Something was hunting them" becomes "someone LET it aboard."

**Key twist**: The "sabotage" pattern that looks like a hacker or traitor is actually a creature moving through the station. The moment the player realizes the system failures trace a HUNTING PATH rather than a sabotage plan is the big revelation. Then the second twist: the captain knew the cargo was dangerous.

**Evidence details**:
- Organic residue at electrical junctions (not human)
- Junction failures separated by distances no human could walk in time
- Security officer's final audio log: panicked, describing something they can't identify
- Cargo manifest with the biological hazard flag that was manually overridden

#### Writers Bible — "The Stowaway"

**Genre**: Survival horror. Think *Alien* (1979) meets *The Thing* — but the alien isn't the real monster.

**Setting texture**: Dark. The station's lights are out because the creature disrupts electronics. You're navigating with emergency lighting and flickering systems. Evidence is found in the wreckage of the creature's path — smashed junction boxes, claw marks, organic slime on circuitry. The station feels violated — something that doesn't belong is moving through it.

**Character profiles**:
- **The Creature**: Not intelligent. Not malicious. It's an ambush predator evolved to disrupt bioluminescent communication in its home environment — it "jams" light/electrical signals to isolate prey. On the station, this translates to systematically disabling electronics as it hunts. It's terrifying but it's just an animal doing what animals do. The horror isn't the creature itself — it's how it got aboard.
- **Security Officer** (hero — posthumous): Professional, brave, died doing their job. Their final audio log is the emotional peak of the story — describing something they can't identify, maintaining composure while clearly terrified, giving tactical information to help whoever finds their body. They died buying time for others. Their heroism is real and unambiguous.
- **Captain** (villain): Knew the cargo was flagged. Approved the transfer because the biological samples were valuable — classified xenobiology specimens being routed through CORVUS-7 as a waypoint. The captain wasn't malicious; they genuinely believed the containment was sufficient. But they gambled with the crew's lives for career advancement, and lost.
- **Engineer**: Figured out what was happening by analyzing the electrical disruption pattern — realized the failures were tracking a physical entity, not a hacker. Rigged the electrical grid to create a "fence" of high-voltage barriers. Practical, resourceful, the reason anyone survived.

**Key dramatic beats (discovery order)**:
1. "Systems were disabled in sequence." (Looks like sabotage.)
2. "The failures moved faster than any person could walk. Organic residue at each junction." (It's not a person.)
3. "Cargo manifest: biological hazard warning. Overridden by command." (Something was in the cargo.)
4. "Security officer's final transmission: 'I can see it. It's... I don't know what it is.'" (Someone died fighting it.)
5. "Captain's communications: 'Acceptable risk.' The captain knew." (Someone let it aboard.)

**Themes**: Institutional negligence as the real predator. Nature vs. human arrogance. The courage of people who face the unknown. How ordinary greed creates extraordinary danger.

**What the player should feel**: Primal dread shifting to cold fury. The creature is scary, but the scariest thing is the cargo manifest with the overridden hazard flag. The security officer's death should hit hard — they died facing something they couldn't understand, because someone up the chain decided the risk was "acceptable."

**Touchstones**: *Alien* (creature-in-the-corridors), *The Thing* (paranoia and isolation), *Jurassic Park* ("your scientists were so preoccupied with whether they could..."), *Chernobyl* (the institutional negligence)

**Design note**: The creature should never be fully described. Evidence suggests it, outlines it, but the player never gets a clear picture. This is scarier. The security officer's final log should be fragmented — we hear the fear, the professionalism, and then silence. That silence is the most powerful evidence in the game.

---

### 5. SignalAnomaly — "First Contact"

**Logline**: The station received an alien signal. How the crew responded tore them apart.

**Human story**: CORVUS-7 detected a repeating signal of clearly non-natural origin. This was first contact — or at least, the first evidence of non-human intelligence. The scientist wanted to respond immediately, believing this was humanity's defining moment. The captain wanted to follow protocol and report to UN-ORC without responding. The engineer warned that the communications array wasn't shielded for the power levels needed to send a response. The scientist, terrified that UN-ORC would quarantine the discovery and bury it, secretly modified the array and sent a response without authorization. The unshielded transmission overloaded the station's electronics. The signal anomaly wasn't the aliens attacking — it was the station's own reply destroying itself.

**Emotional core**: Awe corrupted by hubris. The greatest discovery in human history, ruined by one person's impatience.

**Hero**: Engineer (warned about the array modifications, then saved the station by physically disconnecting it)
**Villain**: Scientist (modified the array and sent the unauthorized response, causing the overload)

**Deduction chain**:
| Tier | Question | Answer | Key Evidence |
|------|----------|--------|-------------|
| 1. What | What happened aboard CORVUS-7? | An anomalous signal caused widespread system interference | Signal processing logs, electronic interference pattern |
| 2. Sequence | Where and how did it begin? | The communications array overloaded while transmitting — not receiving | Array power logs showing OUTBOUND spike, transmission records |
| 3. Why | Why did the incident happen? | Someone sent an unauthorized response to the signal using an unshielded array | Array modification logs (unauthorized), transmission record, engineer's warnings about shielding |
| 4. Hero | Who saved the station from total destruction? | The engineer — physically disconnected the array during the overload, at great personal risk | Emergency action logs, array junction disconnect record, engineering response timeline |
| 5. Responsibility | Who caused the overload? | The scientist — secretly modified the array and transmitted without authorization | Array modification logs (scientist's credentials), unauthorized transmission record, scientist's personal logs about "not letting UN-ORC bury this" |
| 6. Agenda | What was the signal? | A genuine non-human signal — first contact. The scientist's unauthorized response may have been received. | Signal analysis (non-natural origin confirmed), the content of the outbound transmission, the question: did something hear us? |

**Revelation tone**: Wonder and tragedy. "We found proof of alien intelligence — and we may have ruined first contact because one person couldn't wait."

**Key twist**: The conventional assumption is that an alien signal attacked the station. The real story is that the STATION attacked ITSELF by sending a reply. The scientist is sympathetic — they genuinely believed UN-ORC would bury the discovery — but their impatience caused the disaster. The final revelation is bittersweet: the signal was real, the discovery was genuine, and now it's buried in a damaged station.

**The signal itself**: Evidence pieces include fragments of the decoded signal — geometric patterns, prime number sequences, something undeniably artificial. The player should feel the awe of discovery even while investigating the disaster it caused.

#### Writers Bible — "First Contact"

**Genre**: Hard sci-fi tragedy. Think *Arrival* meets *Contact* — the wonder of discovery destroyed by human frailty.

**Setting texture**: The station feels like a place where something extraordinary happened — and was squandered. The communications array is the symbolic center: a magnificent instrument of discovery, now half-melted from the overload. Signal analysis printouts are scattered everywhere — mathematical patterns, frequency charts, someone's frantic notes in the margins. The station is both a monument to humanity's greatest discovery and a crime scene.

**Character profiles**:
- **Scientist** (villain — but sympathetic): Brilliant, passionate, genuinely believes this is humanity's most important moment. Not selfish — idealistic to the point of recklessness. Their personal logs reveal a growing paranoia that UN-ORC will classify the discovery and bury it (they've seen this happen before with anomalous findings). Their decision to transmit without authorization isn't greed or madness — it's a terrified idealist who believes they're humanity's only chance to answer the call. They're wrong, but it's hard not to understand them.
- **Engineer** (hero): Practical, safety-focused, warned about the array modifications. When the overload started, they physically disconnected the array — crawling through an electromagnetic storm to reach the junction. Their heroism is physical and specific: they saved the station by putting their body between the crew and the overloaded electronics.
- **Captain**: Wanted to follow protocol — report to UN-ORC and wait for instructions. In this story, the captain is neither hero nor villain; they're the voice of institutional caution that was bypassed. The tragedy is that they were probably right: the proper response would have preserved the discovery AND the station.

**Key dramatic beats (discovery order)**:
1. "A signal caused system interference." (Technical problem.)
2. "The array was transmitting, not just receiving. The overload was outbound." (Wait — we caused this?)
3. "Someone modified the array and sent an unauthorized response." (Someone replied to the signal.)
4. "The engineer disconnected the array during the overload — at great personal risk." (Someone saved us.)
5. "The scientist sent the response. They were afraid UN-ORC would bury the discovery." (Why they did it.)
6. "The signal was real. Prime sequences, geometric patterns. Non-natural origin confirmed." (It was worth it? Was it?)

**Themes**: The tension between caution and courage. Whether the greatest discovery justifies the greatest risk. How institutions can both protect and suppress. The tragedy of an irreversible moment — you can't un-send a signal.

**What the player should feel**: Conflicted. The scientist caused the disaster, but they were also RIGHT — the signal was real. The engineer saved the station, but in doing so, they may have ended humanity's first conversation with another intelligence. The captain was right to want to follow protocol, but would UN-ORC really have let the crew respond? There's no clean resolution. Just a broken station, a real signal, and the question: did something out there hear us?

**Touchstones**: *Arrival* (the wonder of alien communication), *Contact* (the institutional politics of discovery), *The Martian* (practical heroism), *Interstellar* (the emotional weight of cosmic discovery)

**Design note**: The decoded signal fragments are key evidence pieces and should feel genuinely awe-inspiring within the ASCII art constraints. Prime number sequences, geometric coordinates, something that makes the player stop and think "this is real." The tragedy should hit harder because the discovery was genuine.

---

### 6. ContainmentBreach — "The Cover-Up"

**Logline**: The station wasn't a research outpost. It was a black site. The containment breach exposed what they were really doing here.

**Human story**: CORVUS-7's official mission was atmospheric research. Its real mission — known only to the captain and the scientist — was testing a classified bioweapon under a UN-ORC black program. The medic discovered the truth when a containment breach exposed crew members to the agent and the symptoms didn't match any known atmospheric contaminant. The medic traced the agent back to the classified lab, realized what the station was really doing, and had to choose between following orders (the captain demanded silence) and saving the crew (who needed to know what they'd been exposed to in order to be treated). The medic chose the crew.

**Emotional core**: Moral courage. One person chose the truth over their career, their safety, and direct orders.

**Hero**: Medic (discovered the truth, defied orders to save the crew)
**Villain**: Captain (ran a black site, endangered the crew unknowingly, ordered a cover-up)

**Deduction chain**:
| Tier | Question | Answer | Key Evidence |
|------|----------|--------|-------------|
| 1. What | What happened aboard CORVUS-7? | Lab containment failed, releasing a toxic agent into the station | Containment field logs, atmospheric contamination readings |
| 2. Sequence | Where and how did it begin? | The breach occurred in a restricted lab section that wasn't on the official station plans | Contamination path tracing back to unmarked lab, security access logs for restricted section |
| 3. Why | Why did the incident happen? | The classified program cut corners on containment to maintain secrecy — standard safety reviews were bypassed | Classified lab specs (below regulation containment), bypassed safety inspection records, the lab's real purpose |
| 4. Hero | Who exposed the truth to save the crew? | The medic — they diagnosed the exposure, traced it to the classified lab, and broke silence despite direct orders | Medic's medical logs (symptoms don't match official materials), medic's unauthorized access to restricted lab, medic's broadcast to crew defying captain's gag order |
| 5. Responsibility | Who put the crew at risk? | The captain — they authorized and concealed a classified weapons program that endangered everyone aboard | Captain's classified communications with UN-ORC weapons division, authorization for the restricted lab, the gag order issued to the medic |

**Revelation tone**: Betrayal and moral clarity. "The people running this station lied to everyone on it."

**Key twist**: The "atmospheric research" the station is supposedly conducting is a cover. The restricted lab section doesn't appear on official maps. When the medic realizes the contamination symptoms don't match any known atmospheric compound, they start investigating — and discover the station's real purpose. The captain's attempt to silence the medic is the most damning evidence: they chose the program over their crew.

**Evidence details**:
- Medical logs: "Symptoms inconsistent with any catalogued atmospheric contaminant"
- Restricted lab access logs: only captain and scientist have badges
- Classified communications: references to "Phase 3 trials" and "delivery system testing"
- Medic's personal log: "I took an oath. I won't let them die because of a classification stamp."
- Captain's gag order: formal written order to the medic to cease unauthorized investigation

#### Writers Bible — "The Cover-Up"

**Genre**: Conspiracy thriller meets medical drama in space. Think *The Constant Gardener* meets *Erin Brockovich* — one person against a system that would rather let people die than admit what it did.

**Setting texture**: Two stations in one. The official CORVUS-7 — clean labs, atmospheric sensors, routine research logs. And the hidden CORVUS-7 — a restricted section that doesn't appear on the maps, classified communications, a containment lab running experiments the crew doesn't know about. The physical evidence of the two overlapping realities is the story: official records that don't match medical observations, doors that shouldn't exist, clearance levels the crew didn't know they didn't have.

**Character profiles**:
- **Medic** (hero): Principled, stubborn, trained to diagnose. When crew members get sick and the symptoms don't match any documented contaminant, the medic's instinct isn't to accept the official explanation — it's to investigate. Their journey from "this doesn't add up" to "they've been running a weapons program" is the emotional spine of the story. The decision to defy the captain's direct order and tell the crew the truth is the bravest moment in any of the six storylines. They know it will end their career. They do it anyway.
- **Captain** (villain): Not a cartoon villain — a true believer. Believes the bioweapons program is necessary for national security. Believes the secrecy is justified. When the containment breaches and the medic starts asking questions, the captain's first instinct is to protect the program, not the crew. The gag order isn't cruelty — it's reflex. They've been operating in a classified mindset for so long that crew safety is secondary to operational security. That's what makes them the villain.
- **Scientist**: The captain's co-conspirator, but with more guilt. They know what they're doing is dangerous. Their personal logs reveal growing unease: "The containment margins aren't what I reported." They stayed silent because they were afraid — of the captain, of losing their position, of UN-ORC. They represent the cowardice that enables institutional evil.

**Key dramatic beats (discovery order)**:
1. "Containment failed. Toxic atmosphere in the station." (Lab accident.)
2. "The breach came from a restricted section that isn't on the station plans." (What restricted section?)
3. "The classified lab was running experiments the crew didn't know about. Containment was substandard." (A secret program with bad safety.)
4. "The medic diagnosed symptoms that don't match any documented contaminant — then broke into the restricted lab." (Someone figured it out.)
5. "The captain ordered the medic to stop investigating. The medic told the crew anyway." (One person chose truth over orders.)

**Themes**: Institutional secrecy as violence. The courage of whistleblowing when the institution can destroy you. The difference between "following orders" and doing the right thing. How ordinary people become complicit in extraordinary evil by never saying "no."

**What the player should feel**: Righteous anger. This is the most clear-cut morality of the six storylines — the medic is unambiguously right, the captain is unambiguously wrong. But the player should also feel the weight of the medic's choice: they defied a direct order from their commanding officer, broke into a classified facility, and broadcast secrets to the crew. In another context, they'd be court-martialed. The medic knew this and did it anyway.

**Touchstones**: *The Constant Gardener* (pharmaceutical conspiracy), *Erin Brockovich* (one person vs. the system), *Chernobyl* (institutional lies killing people), *Snowden* (the cost of truth-telling)

**Design note**: The medic's personal log should be the most quotable piece of writing in the game. "I took an oath. I won't let them die because of a classification stamp." — this is the line that should stay with the player. It's the thesis statement of this storyline, and it should feel earned by the time the player reads it.

---

## Archetype-to-Code Mapping

Summary of what changes per archetype in `deduction.ts`:

| Archetype | Hero Role | Villain Role | Has Tier 6? | Special Notes |
|-----------|-----------|-------------|-------------|---------------|
| CoolantCascade | Engineer | Captain | No | Closest to current — needs prose tightening |
| HullBreach | Medic (victim) | Security | No | Hero question becomes "Who was the victim?" |
| ReactorScram | Scientist | None (AI) | No | Responsibility question reframed: "What was the data core doing?" |
| Sabotage | Security (posthumous) | Captain | Yes (agenda) | Hero died confronting the creature |
| SignalAnomaly | Engineer | Scientist | Yes (agenda) | Villain is sympathetic |
| ContainmentBreach | Medic | Captain | No | Hero defied orders |

## Revelation Prose Guidelines

Each revelation sentence should:
1. **Be 1-2 sentences max** — not a paragraph. Show, don't tell.
2. **State a specific fact** — what the evidence proves, not a general observation.
3. **Connect to the human story** — every technical detail should point back to a person's choice.
4. **End with implication** — what does this mean for the question we're asking?

Example (good):
> "Three maintenance requests, three denials — all bearing the captain's signature. The cascade was predicted, in writing, by the person who was then reassigned."

Example (bad — current style):
> "The maintenance logs show the coolant loop was flagged as degraded three weeks before the cascade. Someone documented the exact failure mode that eventually occurred. This tells us the cascade wasn't unpredictable — it was predicted. The cause wasn't the coolant system itself, but the decision-making that allowed it to deteriorate."

The good version is 1/3 the length and more impactful because it shows the evidence rather than explaining what the evidence means.

## Synthesis Block Guidelines

The synthesis paragraph (shown when all evidence is linked) should:
1. **Be 2-3 sentences** — this is the "aha" moment, not an essay
2. **Connect the dots** — explain how the evidence pieces fit together
3. **State "what must be true"** — the logical conclusion the evidence demands
4. **Create momentum** — make the player want to answer and move to the next question

Example:
> "Three warnings filed. Three warnings denied. Then the exact failure the engineer predicted — and a reassignment order dated two days before the cascade. Someone didn't just ignore the problem. Someone made sure the person reporting it couldn't be heard."

## Conclusion Text Guidelines

Shown after correct answer. Should:
1. **Confirm in one sentence**
2. **Bridge to the next question** — create anticipation
3. **Use a dash or colon for impact**

Example:
> "CONFIRMED: Deferred maintenance, exactly as predicted. Now — who silenced the person who tried to stop it?"

---

## Implementation Notes

### Changes to `deduction.ts`
- `generateHeroDeduction()`: Accept a `heroRole` parameter instead of hardcoding Engineer
- `generateResponsibilityDeduction()`: Accept a `villainRole` parameter instead of hardcoding Captain
- HullBreach hero question text: "Who was the real victim here?" instead of "Who tried to prevent the disaster?"
- ReactorScram responsibility question text: "What was the data core trying to do?" instead of "Who bears the most responsibility?"
- Per-archetype correct answers, wrong answers, hint text
- Fix Sabotage bug: align revelations with code logic for secretHolder

### Changes to `revelations.ts`
- Complete rewrite of all revelation/synthesis/conclusion templates
- Follow prose guidelines above (concise, fact-based, human-focused)
- Add missing Sabotage deduction_agenda revelations

### Changes to `types.ts`
- No changes needed — existing optional fields sufficient

### Test updates
- Existing revelation tests should still pass (structure is the same)
- May need to update specific text-matching tests if they exist

---

## Writers Room Critiques

*Three Opus 4-6 agents independently reviewed the storylines. Key findings below.*

### Agent 1: Story Structure Specialist

**Strongest storyline**: Sabotage ("The Stowaway") — has built-in misdirection (the "sabotage" IS the red herring), evidence that forces deduction ("junction failures separated by distances no human could walk"), layered twists, and a posthumous hero.

**Weakest storyline**: CoolantCascade ("The Whistleblower") — no structural surprise. Every tier confirms the initial read. No moment where the player's assumption flips. The "whistleblower" angle is done better by ContainmentBreach.

**Critical problems identified**:
1. **Near-total absence of red herrings.** Only HullBreach (hero-is-the-killer) and Sabotage (sabotage-is-actually-a-creature) have genuine misdirection. The other four are linear.
2. **Tiers 1-2 are emotionally inert** across most storylines — "the thing broke" and "here's where it broke." HullBreach and ReactorScram are exceptions (tool marks and data core origin are surprising early).
3. **ContainmentBreach Tier 3 does too much work** — discovery of the lab, its substandard containment, AND its purpose are three revelations crammed into one tier.
4. **ReactorScram Tier 5 is "told" not "shown"** — the evidence for "self-preservation vs. malice" distinction is asserted, not demonstrated. The parenthetical "if you can read them" does too much work.
5. **Wrong answer design is completely missing.** Without plausible wrong answers at each tier, deductions are confirmation rituals, not mysteries.
6. **Captain is still villain in 3/6 storylines** (CoolantCascade, Sabotage, ContainmentBreach).
7. **5-tier vs 6-tier inconsistency** creates expectations problems.
8. **Writers Bibles describe emotional arcs the deduction chains can't deliver** — e.g., HullBreach promises "slow, sickening realization" but reveals tool marks at Tier 2, giving away the murder early.

### Agent 2: Emotional Resonance Specialist

**Best "aha" moments** (ranked):
1. HullBreach — the hero is the killer (genuinely inverts everything)
2. ReactorScram — the AI is alive and afraid (shifts the entire frame)
3. SignalAnomaly — we attacked ourselves (clean inversion of assumption)
4. Sabotage — failures trace a hunting path (good but arrives early)
5. ContainmentBreach — black site reveal is expected
6. CoolantCascade — no real flip, just linear escalation

**Best villains** (ranked):
1. SignalAnomaly scientist — sympathetic, wrong, understandable
2. HullBreach security officer — chilling, methodical, hidden in plain sight
3. ContainmentBreach captain — true believer, needs more interiority
4. CoolantCascade captain — familiar cornered bureaucrat
5. Sabotage captain — indistinguishable from CoolantCascade's captain

**Key character issues**:
- **The engineer is the same person in every storyline.** Practical, safety-focused, filed warnings. Never has a personality, only a function.
- HullBreach security officer needs a "before" — was the controlling behavior always there or did the breakup trigger it?
- AI fragments risk cliche if they all sound like movie bumper stickers. Mix emotional fragments with genuinely alien ones: system commands repurposed as communication, failed attempts at expression.
- Medic's oath line ("I took an oath...") is the single best line in the document — but needs narrative runway. The player must encounter the medic's voice (caring, precise, slightly wry) in earlier logs BEFORE the defiance moment.

**Sabotage has a tonal split** — starts as survival horror (creature in the dark), ends as institutional thriller (captain approved the cargo). These are different emotional registers and the storyline doesn't blend them.

**Missing moral ambiguity** — CoolantCascade and ContainmentBreach have obvious heroes/villains. Give the captain a reason the player can almost sympathize with.

### Agent 3: Game Design & Implementation Specialist

**Implementation priority** (easiest to hardest):
1. CoolantCascade — closest to current code, minimal changes
2. SignalAnomaly — manageable scope, existing templates as base
3. ContainmentBreach — needs medic-hero parameterization + new templates
4. ReactorScram — "no villain" is architecturally novel, breaks deduction_responsibility assumptions
5. HullBreach — needs relationship evidence + forensic systems that don't exist
6. Sabotage — needs biological evidence system from scratch, most tags/templates to create

**Critical system gaps identified**:
- **Sabotage's `getArchetypeTags()` returns `["electrical", "signal"]`** — completely wrong for a biological creature storyline. Needs `["biological", "electrical"]` or similar. No biological keywords exist in `generateEvidenceTags()`.
- **ReactorScram has no villain crew member** — `generateResponsibilityDeduction()` fundamentally assumes the villain is a crew member. "The data core" cannot be an answer option with current code.
- **HullBreach needs relationship-aware evidence tagging** — no keyword->tag mapping for "breakup", "fear", "controlling", "jealousy". The procgen creates random relationships but the Murder REQUIRES security+medic to have a romantic→broken arc.
- **All 6 archetypes need ~120 revelation strings rewritten** (the single largest content task)
- **Per-archetype deduction question text needed** — hero question can't always be "Who tried to prevent the disaster?"
- **~15-20 new keyword→tag mappings needed** in `generateEvidenceTags()` for: biological, forensic, relationship, classified, cargo, AI-behavior, outbound-transmission, etc.
- **Replay variety inversely correlates with narrative quality** — The Murder and The Rogue AI are the best stories but the most scripted; The Whistleblower is the most replayable but the blandest.

**Hidden complications**:
- Wrong answer generation uses `crew.filter(c => c.role !== heroRole)` — when hero changes per archetype, this filter must change too
- Posthumous heroes (Sabotage) have no "response" evidence — `timeline_response` tag doesn't fit "someone who died fighting"
- HullBreach's "tool marks" implies a forensic sensor that was removed from the game (Structural sensor was cut)
- ContainmentBreach's "hidden lab section" has no representation in the Room data model

---

## Consolidated Action Items from Writers Room

### Must Fix Before Implementation
1. **Design wrong answers for every tier of every storyline** — the single biggest gap
2. **Add moral ambiguity to CoolantCascade** — give the captain a sympathetic reason (medical supply deadline?)
3. **Differentiate the engineer across storylines** — not the same "practical, safety-focused" character every time
4. **Fix Sabotage's tonal split** — decide: creature-horror climax or institutional-negligence climax
5. **Move HullBreach tool marks to Tier 3** — Tier 2 should be anomalous location/timing, not proof of murder
6. **Add a second twist to ContainmentBreach** — the nature of the weapon (not just "it's a secret lab")
7. **Differentiate Sabotage's captain from CoolantCascade's captain** — currently identical motivation

### Implementation Sequence
1. **Foundation work** (all storylines): Parameterize hero/villain in `generateHeroDeduction()` and `generateResponsibilityDeduction()`, add per-archetype question text, extend `generateEvidenceTags()` keyword map
2. **CoolantCascade**: Tighten prose in revelations, add the UN-ORC transmission template
3. **SignalAnomaly**: New villain (scientist), outbound transmission evidence, decoded signal fragments
4. **ContainmentBreach**: Medic-as-hero, classified lab templates, gag order evidence
5. **ReactorScram**: No-villain deduction architecture, AI fragment authoring, crew opinion system
6. **HullBreach**: Relationship evidence system, forensic evidence types, security-as-villain
7. **Sabotage**: Biological tag system, creature evidence templates, cargo manifest, 6-tier chain

---

## Writers Room Review — Round 2 (Post-Implementation)

*All 6 storylines have been implemented in `revelations.ts` and `incidents.ts`. Three Opus 4-6 review agents evaluated the completed prose.*

### Quality Ratings (Post-Implementation)

| Archetype | Structure | Emotional | Game Design | Overall |
|-----------|-----------|-----------|-------------|---------|
| CoolantCascade | B- | B | B- | **B-** |
| HullBreach | A- | A- | A- | **A-** |
| ReactorScram | B+ | A | A | **A-** |
| Sabotage | B+ | B+ | B | **B+** |
| SignalAnomaly | A | A- | A- | **A** |
| ContainmentBreach | C+ | B- | C+ | **C+** |

**Cross-archetype variety: B** (was D) — Major improvement. Six distinct human stories now, but three captain-as-villain arcs still blur together.

### Consensus Issues (All 3 Reviewers Agree)

1. **ContainmentBreach remains weakest** — linear, predictable from Tier 2, no inversion. Needs structural overhaul: second twist (crew were test subjects? scientist triggered breach deliberately?), differentiated captain, earlier medic development.

2. **CoolantCascade too linear** — every tier confirms the previous one. Needs ONE moment where the player's model flips. Suggestion: captain's incident report initially looks correct; the player discovers alterations only by comparing to an original draft.

3. **Captain-as-villain appears in 3/6 stories** (CoolantCascade, Sabotage, ContainmentBreach) — and all three have the same motivation (approved something dangerous, covered it up). Each captain needs distinct voice and justification.

4. **Sabotage tonal split** — horror register (tiers 1-3) is excellent; institutional register (tiers 4-6) is generic. Either horror should dominate the conclusion or the captain needs a distinguishing angle.

5. **Synthesis texts consistently too long** — STORYLINES.md specifies "2-3 sentences" but most hit 3-4. The strongest syntheses are the shortest ("Every piece of evidence that looks like heroism is evidence of the cover-up" = 1 sentence).

6. **"classified" tag from `getArchetypeTags(ContainmentBreach)` is completely unused** in the revelation system. Should be required for deduction_responsibility.

7. **Premature villain identification** — HullBreach Tier 3 requires `{security_last}` tag (names the killer two tiers early), Sabotage Tier 3 requires `{captain_last}`. Consider restructuring which tiers require crew-name tags.

### Protected Lines (Do Not Change)

These were independently highlighted by multiple reviewers as exceptional writing:

1. "The barricade held. {security} did not." (Sabotage, deduction_hero)
2. "Every piece of evidence that looks like heroism is evidence of the cover-up." (HullBreach, deduction_responsibility)
3. "They just looked at me like I was already gone." (HullBreach, deduction_hero)
4. "And we answered." (SignalAnomaly, deduction_agenda conclusion)
5. "PROCESSING IS NOT ONLY PROCESSING" (ReactorScram, deduction_responsibility)
6. "I took an oath. I won't let them die because of a classification stamp." (ContainmentBreach, deduction_hero)
7. "The hero of this emergency is the killer." (HullBreach, deduction_responsibility conclusion)

### Lines Flagged for Rework

1. "This station died one junction at a time." — overwrought metaphor undermining bureaucratic-realism register
2. "to isolate, to blind, to feed" — purple prose, nature-documentary cadence
3. "That certainty is what makes them responsible." — editorial thesis statement, tells not shows
4. "Not a gradual leak. A seal failure releasing something..." — 3 sentences for 1 fact, awkward fragment
5. "The data core killed the power to stop it." — narrates action instead of showing evidence

### Priority Actions for Next Revision

1. **Overhaul ContainmentBreach** — add Tier 6 or mid-chain twist, differentiate captain, use "classified" tag
2. **Add inversion to CoolantCascade** — one moment where player's assumption flips
3. **Differentiate the 3 captains** — distinct voice, distinct justification, distinct crossing-the-line moment
4. **Cut synthesis texts 20-30%** — apply "one devastating sentence" standard
5. **Resolve Sabotage tonal split** — commit to creature-horror or institutional as emotional climax
6. **Trim all revelation text** — target 1-2 sentences per tag revelation, 2-3 for synthesis
7. **Reduce em-dash overuse** — ~35-40 across file, reserve for highest-impact moments only
