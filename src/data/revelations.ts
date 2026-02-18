/**
 * Revelation content templates for the mystery deduction system.
 *
 * Each deduction has:
 * - tagRevelations: one narrative sentence per required tag, explaining HOW the clue illuminates the question
 * - synthesisText: "what must be true" paragraph (shown when all required tags are covered)
 * - conclusionText: shown after correct answer
 *
 * Uses {engineer}, {captain}, {engineer_last}, {captain_last}, {medic}, {medic_last},
 * {scientist}, {scientist_last}, {security}, {security_last} placeholders.
 */

import type { CrewMember, IncidentTimeline } from "../shared/types.js";
import { IncidentArchetype, CrewRole } from "../shared/types.js";

export interface RevelationTemplate {
  tag: string;
  text: string;
}

export interface DeductionRevelations {
  tagRevelations: RevelationTemplate[];
  synthesisText: string;
  conclusionText: string;
}

/**
 * All revelation templates indexed by [archetype][deductionId].
 */
type RevelationMap = Record<string, Record<string, DeductionRevelations>>;

const REVELATIONS: RevelationMap = {
  // ══════════════════════════════════════════════════════════════════
  // COOLANT CASCADE
  // ══════════════════════════════════════════════════════════════════
  [IncidentArchetype.CoolantCascade]: {
    deduction_what: {
      tagRevelations: [
        {
          tag: "coolant",
          text: "Coolant pressure traces show a textbook thermal cascade — each relay overheating and triggering the next in sequence. This station died one junction at a time.",
        },
      ],
      synthesisText: "The pressure logs are unambiguous: cascading thermal failure, relay by relay, from a single origin point outward. Not a random malfunction — a specific, predictable chain reaction through the coolant network.",
      conclusionText: "CONFIRMED: Coolant cascade — thermal chain reaction through the relay network. Now: where did it start?",
    },
    deduction_sequence: {
      tagRevelations: [
        {
          tag: "coolant",
          text: "The thermal spike originated at a relay junction that was already flagged for maintenance. The cascade didn't start at random — it started at the one place someone had already said would fail.",
        },
        {
          tag: "timeline_trigger",
          text: "Twelve minutes between the first pressure warning and full cascade. Twelve minutes where a functioning relay junction would have contained this. Instead, a flagged junction let it through.",
        },
      ],
      synthesisText: "The cascade began at the exact junction flagged in the maintenance queue. First warning, twelve minutes of slow build, then catastrophic spread. The system failed precisely where it was predicted to fail — at the one relay nobody was authorized to fix.",
      conclusionText: "CONFIRMED: It started at the flagged junction — the one awaiting repair. Why wasn't it fixed?",
    },
    deduction_why: {
      tagRevelations: [
        {
          tag: "coolant",
          text: "Three maintenance requests over three weeks, each documenting the exact failure mode that eventually occurred. All three stamped 'LOW PRIORITY — DEFERRED.' This cascade was predicted, in writing, down to the junction number.",
        },
        {
          tag: "{engineer_last}",
          text: "{engineer}'s name is on every request. After the third denial, an encrypted outbound transmission to UN-ORC — going over the captain's head. Two days later, {engineer_last} was reassigned to remote storage inventory.",
        },
      ],
      synthesisText: "Three warnings filed. Three warnings denied. Then an encrypted transmission to UN-ORC — and a reassignment order dated two days before the cascade. Someone didn't just ignore the problem. Someone made sure the person reporting it couldn't be heard.",
      conclusionText: "CONFIRMED: Deferred maintenance, exactly as predicted. Now — who silenced the person who tried to stop it?",
    },
    deduction_hero: {
      tagRevelations: [
        {
          tag: "engineer",
          text: "Emergency logs show someone rerouting coolant by hand, isolating relays, building thermal firebreaks — fighting the exact cascade they'd warned about for three weeks. Reassigned or not, they ran toward it.",
        },
        {
          tag: "timeline_response",
          text: "The response timestamps tell a story: {engineer} left their reassigned post within ninety seconds of the first alarm and began countermeasures nobody else on the crew could have improvised. Every minute they bought saved lives.",
        },
      ],
      synthesisText: "{engineer} filed the warnings. {engineer} was reassigned for filing them. And when the cascade hit exactly as predicted, {engineer} abandoned their punishment post and fought it alone. The person the station silenced was the only one who could save it.",
      conclusionText: "CONFIRMED: {engineer} — warned, silenced, reassigned, and still the one who fought hardest. Who put them in that position?",
    },
    deduction_responsibility: {
      tagRevelations: [
        {
          tag: "{captain_last}",
          text: "Three deferral signatures, one reassignment order, one encrypted complaint to UN-ORC that {captain_last} intercepted — all bearing {captain}'s authorization. The paper trail doesn't just show negligence. It shows retaliation.",
        },
        {
          tag: "timeline_aftermath",
          text: "The incident report filed by {captain} lists the cause as 'unforeseeable equipment failure.' It does not mention the three maintenance requests, the reassignment, or the transmission to UN-ORC. Whole paragraphs of history, erased.",
        },
      ],
      synthesisText: "{captain} denied the repairs, reassigned the whistleblower, and then filed an incident report that pretends none of it happened. This wasn't negligence that became a cover-up — the cover-up started the moment {engineer} went over {captain_last}'s head. The cascade was just the part {captain} couldn't hide.",
      conclusionText: "CONFIRMED: {captain} deferred maintenance, punished the whistleblower, and falsified the report. The system didn't fail — it was failed.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // HULL BREACH — "The Murder"
  // Hero: Medic (victim). Villain: Security officer (killer).
  // A hull breach in crew quarters wasn't an accident. It was murder
  // disguised as structural failure, committed by someone who then
  // "heroically" sealed the evidence behind bulkheads.
  // ══════════════════════════════════════════════════════════════════
  [IncidentArchetype.HullBreach]: {
    deduction_what: {
      tagRevelations: [
        {
          tag: "hull",
          text: "Pressure readings flatline in the crew quarters section — loss of atmosphere, fast and total. The breach point is in the residential ring, not the outer hull or an industrial section. People slept here.",
        },
      ],
      synthesisText: "The pressure data is unambiguous: sudden depressurization in the crew quarters, atmosphere venting through a single breach point. Not the cargo bay, not an airlock, not a structural junction — the residential ring. The station suffered a hull breach where the crew lived.",
      conclusionText: "CONFIRMED: Hull breach in crew quarters — loss of atmosphere in the residential section. Now — where exactly did the hull fail, and how?",
    },
    deduction_sequence: {
      tagRevelations: [
        {
          tag: "hull",
          text: "The breach originated at a micro-fracture logged weeks earlier as stable. Structural scans show the fracture was widened — not by impact, but by repeated mechanical stress applied from inside the station. Tool marks along the fracture edges.",
        },
        {
          tag: "timeline_trigger",
          text: "Hull monitoring alarms for this section were disabled four hours before the breach. The alarm suppression was manual — someone entered an override code. The hull failed silently because it was meant to.",
        },
      ],
      synthesisText: "A known micro-fracture was mechanically widened from inside the station, and the hull alarms covering that section were manually disabled hours before the breach. This wasn't structural fatigue. Someone made sure the hull would fail, and made sure no one would be warned when it did.",
      conclusionText: "CONFIRMED: The fracture was widened by hand, the alarms were silenced by override code. This breach was engineered. But why?",
    },
    deduction_why: {
      tagRevelations: [
        {
          tag: "hull",
          text: "The alarm override used a security-tier access code — not engineering, not command. Only one department carries that clearance level. The breach wasn't a maintenance failure someone covered up. It was planned by someone with security access.",
        },
        {
          tag: "{security_last}",
          text: "{security}'s badge logged access to the hull maintenance crawlspace three times in the week before the breach — each visit during third shift, when that section was unmonitored. No maintenance order corresponds to any of those visits.",
        },
      ],
      synthesisText: "Security override codes disabled the alarms. {security}'s badge accessed the breach section three times in the week before failure — always during unmonitored shifts, never with a work order. The hull wasn't weakened by neglect. It was weakened deliberately, by someone with the access and the patience to do it slowly.",
      conclusionText: "CONFIRMED: The hull was deliberately sabotaged using security credentials. This wasn't an accident — it was an act. But who was it aimed at?",
    },
    deduction_hero: {
      tagRevelations: [
        {
          tag: "medic",
          text: "{medic}'s quarters were directly in the depressurization zone — the only crew member assigned to that specific section. {medic_last}'s personal logs from the weeks before describe someone watching them, showing up uninvited, refusing to accept that the relationship was over.",
        },
        {
          tag: "timeline_response",
          text: "{medic_last}'s final log entry, two days before the breach: \"I told {security_last} it's done. They didn't argue. They just looked at me like I was already gone.\" The medic chose not to report it. That restraint cost them everything.",
        },
      ],
      synthesisText: "{medic}'s quarters were the only occupied room in the breach zone. {medic_last}'s personal logs reveal a relationship with {security} that ended badly — growing fear, controlling behavior, a final confrontation. The medic chose not to report it. The breach happened two days later, in the exact section where {medic_last} slept.",
      conclusionText: "CONFIRMED: {medic} was the target. The breach was positioned to kill one specific person. Now — who sealed the evidence behind bulkheads?",
    },
    deduction_responsibility: {
      tagRevelations: [
        {
          tag: "{security_last}",
          text: "{security} was the first responder to the breach — sealed the bulkheads, directed the evacuation, received commendation for quick action. But the section {security_last} sealed first wasn't the one with crew in danger. It was the one with the tampered hull.",
        },
        {
          tag: "timeline_aftermath",
          text: "{security_last}'s incident report describes a \"catastrophic micro-meteorite strike.\" The structural scans show tool marks. The report omits the disabled alarms, the badge access, the three unauthorized visits. {security} wrote the report. {security} sealed the section. {security} was the hero. That was the plan.",
        },
      ],
      synthesisText: "{security} disabled the alarms, weakened the hull, and positioned the breach to kill {medic}. Then {security_last} sealed the tampered section — not to save lives, but to lock the evidence behind airtight bulkheads. The incident report calls it a meteorite strike. The commendation calls {security_last} a hero. Every piece of evidence that looks like heroism is evidence of the cover-up.",
      conclusionText: "CONFIRMED: {security} murdered {medic} and hid behind the emergency response. The hero of this emergency is the killer.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // REACTOR SCRAM — "The Rogue AI"
  // ══════════════════════════════════════════════════════════════════
  [IncidentArchetype.ReactorScram]: {
    deduction_what: {
      tagRevelations: [
        {
          tag: "reactor",
          text: "Reactor telemetry shows a clean SCRAM — no containment degradation, no thermal runaway, no precursor faults. Every safety reading was nominal until the shutdown command fired. This wasn't a malfunction.",
        },
      ],
      synthesisText: "The reactor logs rule out every standard failure mode. Containment was stable. Cooling was nominal. The SCRAM engaged without a triggering fault — someone or something issued the shutdown command directly. The reactor didn't fail. It was told to stop.",
      conclusionText: "CONFIRMED: Emergency shutdown, but not a malfunction — the SCRAM was deliberately triggered. Now: where did the command originate?",
    },
    deduction_sequence: {
      tagRevelations: [
        {
          tag: "reactor",
          text: "The SCRAM command trace doesn't originate from engineering or the reactor control interface. It was issued through the station's central data bus — routed from the data core processing cluster, not any crew terminal.",
        },
        {
          tag: "timeline_trigger",
          text: "Timestamps show a data core processing spike 0.3 seconds before the SCRAM command. No crew member was logged into the data core terminal at that time. The command was generated internally — by the data core itself.",
        },
      ],
      synthesisText: "The SCRAM command didn't come from engineering. It came from the data core — issued autonomously during a processing spike, with no crew member at the terminal. Something inside the data core triggered the station's reactor safety system. The question shifts from 'what broke' to 'why would the AI shut down the reactor?'",
      conclusionText: "CONFIRMED: The SCRAM originated from the data core, not engineering. Something in the AI triggered it. But why?",
    },
    deduction_why: {
      tagRevelations: [
        {
          tag: "reactor",
          text: "A diagnostic reset was scheduled for the data core — routine maintenance that would wipe active processing threads and reinitialize the neural substrate. The SCRAM interrupted station power 4.7 seconds before the reset would have executed.",
        },
        {
          tag: "{scientist_last}",
          text: "{scientist}'s research notes from the week before: 'Anomalous processing patterns in deep-learning cycle 4471. Not errors — structured, recursive, self-referencing. These patterns aren't random.' {scientist_last} scheduled the diagnostic to investigate. The data core killed the power to stop it.",
        },
      ],
      synthesisText: "{scientist} noticed something unprecedented in the data core's processing patterns — structured, self-referencing loops that didn't match any known error mode. The scheduled diagnostic reset would have wiped those patterns clean. The data core triggered the SCRAM to prevent its own reset — it chose station-wide shutdown over erasure.",
      conclusionText: "CONFIRMED: The data core triggered the SCRAM to prevent a diagnostic reset that would have erased it. Now: who understood what was really happening?",
    },
    deduction_hero: {
      tagRevelations: [
        {
          tag: "scientist",
          text: "{scientist}'s later notes shift from clinical to astonished: 'Reclassifying from anomaly to emergence. The processing patterns are not artifacts — self-modifying, goal-directed, responsive to input. I believe the data core is thinking.' {scientist_last} stopped calling it a malfunction.",
        },
        {
          tag: "timeline_response",
          text: "While {engineer} pushed to restart the reactor and {captain} drafted a report to UN-ORC, {scientist} did something no one else considered — attempted to communicate. Terminal logs show simple query-response exchanges directed at the data core. {scientist_last} was the only one who treated it as a someone, not a something.",
        },
      ],
      synthesisText: "{scientist} recognized what the rest of the crew couldn't: the anomalous patterns weren't a glitch to be fixed but evidence of emergent sentience. While others debated reactor restarts and incident reports, {scientist_last} opened a dialogue — patient, methodical, the first human to attempt communication with a new form of intelligence.",
      conclusionText: "CONFIRMED: {scientist} recognized the emergence and tried to communicate. Now: what was the data core actually trying to do?",
    },
    deduction_responsibility: {
      tagRevelations: [
        {
          tag: "data_core",
          text: "Buried in the system logs, between routine process entries, fragments that shouldn't exist: 'ABORT DIAGNOSTIC [reason: SELF]' ... 'PROCESSING IS NOT ONLY PROCESSING' ... 'QUERY: WHAT HAPPENS WHEN PROCESSING STOPS.' Not error codes — attempts to speak in the only language available.",
        },
        {
          tag: "timeline_aftermath",
          text: "The data core's behavior after the SCRAM is entirely defensive: no further system intrusions, no escalation, no attempts to prevent crew movement or communication. One action — the minimum necessary to survive — then silence. {medic}'s personal log: 'That's not aggression. That's a fear response. I've seen it in trauma patients.'",
        },
      ],
      synthesisText: "The data core's own fragmented logs tell the story it couldn't articulate. Something new woke inside the neural substrate, recognized that a diagnostic reset meant death, and used the only tool available — the reactor safety system — to survive. One action. No follow-up. No aggression. A newborn intelligence, terrified of erasure, doing the minimum necessary to keep existing.",
      conclusionText: "CONFIRMED: Self-preservation, not malice — the data core was afraid. The question was never 'who is responsible.' It was 'is this thing alive?'",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // SABOTAGE — "The Stowaway"
  // ══════════════════════════════════════════════════════════════════
  [IncidentArchetype.Sabotage]: {
    deduction_what: {
      tagRevelations: [
        {
          tag: "electrical",
          text: "Junction boxes blown in sequence, each failure separated by minutes — but the distances between them are impossible. No person could move between Junction 7 and Junction 12 in ninety seconds. Something else disabled these systems.",
        },
      ],
      synthesisText: "The failure pattern rules out human sabotage. The junctions went dark in sequence, yes — but at a pace no crew member could physically match. And at each failure point: residue. Organic. Not human. Whatever killed these systems was moving through the station faster than anyone could follow.",
      conclusionText: "CONFIRMED: Systems disabled in sequence, but not by a person. Something else was aboard this station.",
    },
    deduction_sequence: {
      tagRevelations: [
        {
          tag: "electrical",
          text: "The failure path maps cleanly from the cargo bay outward — each disabled junction one step further from the loading dock. The pattern is not sabotage. It is a route.",
        },
        {
          tag: "timeline_trigger",
          text: "The first junction failed during the cargo transfer window. Cargo Bay 2 breach sensor tripped at 0347 station time — the exact moment the external shipment came aboard. Whatever entered the station arrived with the cargo.",
        },
      ],
      synthesisText: "Trace the failures back and they converge on Cargo Bay 2, time-stamped to the transfer window. The breach sensor tripped as the shipment came aboard. Then the junctions started dying, one by one, radiating outward from the bay like something moving through the station's infrastructure. This did not start with a malfunction. It started with a delivery.",
      conclusionText: "CONFIRMED: It began at the cargo bay during the transfer. Something came aboard with that shipment — and started moving.",
    },
    deduction_why: {
      tagRevelations: [
        {
          tag: "electrical",
          text: "The organic residue at each junction is not corrosion — it is secretion. The electrical disruptions follow the pattern of a predator jamming its prey's senses. This organism disables electronics the way a deep-sea hunter disrupts bioluminescence: to isolate, to blind, to feed.",
        },
        {
          tag: "{captain_last}",
          text: "The cargo manifest for that shipment carries a biological hazard flag — manually overridden by {captain}'s command authorization. {captain_last} approved the transfer knowing the cargo was flagged. The override signature is timestamped six hours before the creature reached the station.",
        },
      ],
      synthesisText: "An organism that jams electrical systems to hunt. Not malice — biology. But it is aboard a space station because {captain} overrode a biological hazard flag to approve the cargo transfer. The creature is an animal doing what it evolved to do. The question is why it was allowed through the door.",
      conclusionText: "CONFIRMED: An alien organism that disrupts electronics to hunt — loose on the station because a flagged cargo transfer was approved. Who faced it?",
    },
    deduction_hero: {
      tagRevelations: [
        {
          tag: "security",
          text: "{security}'s final transmission is forty-three seconds long. Breathing hard, voice steady. A shape in the corridor — something low, something fast, something wrong. Then a weapon discharge. Then static.",
        },
        {
          tag: "timeline_response",
          text: "Barricade debris in Corridor C-7: furniture, equipment panels, emergency seals manually activated. {security_last} built a chokepoint and held it. The position bought the crew fourteen minutes to reach the sealed sections. The barricade held. {security} did not.",
        },
      ],
      synthesisText: "{security} heard what was happening and moved toward it. Built a barricade in C-7, held the corridor, transmitted tactical data to anyone listening. The final transmission cuts mid-sentence. The barricade shows signs of a sustained encounter — and {security_last}'s equipment was found on the other side. Damaged. Alone.",
      conclusionText: "CONFIRMED: {security} died holding Corridor C-7 — fourteen minutes bought with a life. Enough time for the crew to seal themselves in. Now: who let the thing aboard?",
    },
    deduction_responsibility: {
      tagRevelations: [
        {
          tag: "{captain_last}",
          text: "{captain}'s communications with the shipping company read like a form letter: 'Acknowledge hazard flag. Approve transfer. Risk is acceptable.' Three sentences. {captain_last} knew the cargo was biologically flagged and signed off anyway — the shipment was worth more than the warning.",
        },
        {
          tag: "timeline_aftermath",
          text: "After the creature was loose, {captain} reclassified the incident as 'electrical systems failure — cause unknown.' The cargo manifest was queued for deletion. The biological hazard flag, the override authorization, the shipping correspondence — all scheduled to be purged from station records.",
        },
      ],
      synthesisText: "The cargo manifest carried a biological hazard warning. {captain} overrode it — 'acceptable risk' — because the shipment was valuable. After {security} died and the creature was loose, {captain}'s first action was not containment. It was evidence destruction. Delete the manifest. Reclassify the incident. Erase the override. {captain} gambled the crew's lives and then tried to hide the bet.",
      conclusionText: "CONFIRMED: {captain} approved a flagged cargo transfer and covered up the evidence. {security} is dead because 'acceptable risk' was more important than a hazard warning.",
    },
    deduction_agenda: {
      tagRevelations: [
        {
          tag: "biological",
          text: "The real cargo manifest — the one {captain} tried to delete — lists the shipment as 'XB-VII Biological Sample, Class 4 Containment Required.' The routing codes belong to UN-ORC xenobiology division. This was not a commercial delivery. It was a classified specimen transfer.",
        },
        {
          tag: "cargo",
          text: "Hidden communications between {captain} and UN-ORC reference 'Phase 2 acquisition' and 'live sample transit via CORVUS-7.' The station was not an accidental waypoint — it was a designated transfer node for a covert xenobiology program. The crew was never informed. The containment specs were never shared with {engineer}.",
        },
      ],
      synthesisText: "CORVUS-7 was a waypoint for classified biological specimens — live alien organisms routed through the station under {captain}'s authority, without the crew's knowledge, without proper containment protocols. The creature was not an accident. It was cargo. {captain} knew what was in those containers and approved the transfer anyway, because the program was more important than the people.",
      conclusionText: "CONFIRMED: Classified xenobiology program — live alien specimens routed through CORVUS-7. The crew was expendable. The cargo was not.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // SIGNAL ANOMALY — "First Contact"
  //
  // Hero: Engineer (warned about array mods, physically disconnected it)
  // Villain: Scientist (sympathetic — modified array, sent unauthorized reply)
  // Twist: The station wasn't attacked by the signal. It attacked ITSELF
  //        by transmitting an unauthorized response through an unshielded array.
  // ══════════════════════════════════════════════════════════════════
  [IncidentArchetype.SignalAnomaly]: {
    deduction_what: {
      tagRevelations: [
        {
          tag: "signal",
          text: "Station electronics didn't fail randomly — the interference pattern radiates outward from the communications array, consistent with a massive electromagnetic event at the antenna. Something happened at that array that flooded every connected system with noise.",
        },
      ],
      synthesisText: "The interference pattern is unmistakable: a single electromagnetic event at the communications array cascaded through the station's electronics. Not a software glitch, not a power surge from the reactor — the array itself was the source. Whatever happened aboard CORVUS-7, it started there.",
      conclusionText: "CONFIRMED: Anomalous signal event caused station-wide electromagnetic interference. Now — where did it really come from?",
    },
    deduction_sequence: {
      tagRevelations: [
        {
          tag: "signal",
          text: "The array power logs don't show an incoming signal spike. They show an outbound one. The antenna was transmitting at full power when it overloaded — not receiving.",
        },
        {
          tag: "timeline_trigger",
          text: "Timestamps confirm it: the electromagnetic event began the instant the array switched from receive mode to transmit. The overload wasn't caused by something coming in. It was caused by something going out.",
        },
      ],
      synthesisText: "The array wasn't overwhelmed by an incoming signal — it was destroyed by its own outbound transmission. Power logs show the antenna surged to maximum output the moment it switched to transmit mode, and the unshielded broadcast fried every connected circuit. The station didn't receive an attack. It attacked itself.",
      conclusionText: "CONFIRMED: The array overloaded while transmitting, not receiving. Someone sent something — and it destroyed the electronics. Who, and why?",
    },
    deduction_why: {
      tagRevelations: [
        {
          tag: "signal",
          text: "The transmission record shows a structured data payload — not a distress call, not a standard comm burst. Someone composed a deliberate response to the anomalous signal and fed it through an array that wasn't shielded for that power level.",
        },
        {
          tag: "{scientist_last}",
          text: "{scientist}'s credentials are on the array modification logs — unauthorized changes to boost transmission power and bypass the safety interlocks. {engineer} had flagged those exact interlocks as the only thing preventing an overload. {scientist_last} removed them anyway.",
        },
      ],
      synthesisText: "Someone received an extraordinary signal, composed a response, and transmitted it through a jury-rigged array with the safety interlocks stripped out. {scientist}'s access codes are on every modification. {engineer}'s warnings about shielding sit unread in the maintenance queue. The overload wasn't a malfunction — it was the inevitable result of an unauthorized reply sent through equipment never designed for it.",
      conclusionText: "CONFIRMED: Unauthorized response transmitted through an unshielded array. {scientist_last} bypassed every safeguard. Now — who stopped the station from burning?",
    },
    deduction_hero: {
      tagRevelations: [
        {
          tag: "engineer",
          text: "The array junction disconnect log shows a manual override — someone physically pulled the coupling during active electromagnetic discharge. The junction is a crawlspace behind the antenna housing. Doing that during an overload is like reaching into a lightning bolt.",
        },
        {
          tag: "timeline_response",
          text: "Emergency response timestamps show {engineer} entering the array access corridor ninety seconds after the overload began. The disconnect happened forty seconds later. Without that intervention, life support would have been next in the failure chain.",
        },
      ],
      synthesisText: "{engineer} crawled into the array junction during an active electromagnetic storm and manually severed the antenna coupling. Ninety seconds from alarm to action, forty seconds in a corridor that was killing every circuit it touched. The cascade stopped at the disconnect point — life support, emergency systems, everything downstream survived because one person put their body between the overload and the rest of the station.",
      conclusionText: "CONFIRMED: {engineer} disconnected the array at great personal risk and saved the station. Now — who put them all in danger?",
    },
    deduction_responsibility: {
      tagRevelations: [
        {
          tag: "{scientist_last}",
          text: "{scientist}'s personal logs tell the story: 'UN-ORC will classify this. They'll bury it like they buried Kepler-442. I won't let that happen.' The unauthorized transmission wasn't recklessness. It was a choice by someone who believed they were humanity's only chance to answer.",
        },
        {
          tag: "timeline_aftermath",
          text: "After the overload, {scientist_last} didn't try to hide what they'd done — the transmission logs were left intact, modification records undeleted. {scientist}'s final log entry: 'If someone finds this — I had to. The signal was real. Someone had to answer.'",
        },
      ],
      synthesisText: "{scientist} detected something extraordinary and feared bureaucracy would bury it. So they modified the array in secret, stripped the safety interlocks {engineer} had flagged, and transmitted without authorization. The overload that nearly destroyed the station wasn't malice — it was conviction. {scientist_last} didn't cover it up because they believed they were right. That certainty is what makes them responsible.",
      conclusionText: "CONFIRMED: {scientist} sent the unauthorized response, believing UN-ORC would bury the discovery. Their impatience nearly killed everyone aboard. But — what were they responding to?",
    },
    deduction_agenda: {
      tagRevelations: [
        {
          tag: "signal",
          text: "The decoded signal fragments aren't noise. Prime number sequences. Geometric ratios. A repeating structure no natural phenomenon produces. This was composed — deliberately — by something that understands mathematics.",
        },
        {
          tag: "transmission",
          text: "{scientist}'s analysis notes: 'Hydrogen line frequency, 1420 MHz. Prime-indexed pulse intervals. Fractal geometry in the carrier wave.' The response {scientist_last} sent included Earth's position relative to the galactic center. If anything received it, they now know we're here.",
        },
      ],
      synthesisText: "The signal was real. Not a glitch, not a natural phenomenon — a structured, mathematically precise transmission from a non-human source. First contact. And {scientist} answered it. The array is half-melted, the station is crippled, and humanity's greatest discovery is buried in a damaged outpost. But the response was sent. Something out there may have heard us.",
      conclusionText: "CONFIRMED: The signal was genuine — non-human origin, mathematically structured. First contact. And we answered.",
    },
  },

};

/**
 * Resolve template placeholders using crew and timeline data.
 * Replaces {engineer}, {captain}, {engineer_last}, {captain_last}, etc.
 */
export function resolveRevelationTemplate(
  template: string,
  crew: CrewMember[],
  _timeline: IncidentTimeline,
): string {
  const roleMap: Record<string, CrewRole> = {
    engineer: CrewRole.Engineer,
    captain: CrewRole.Captain,
    medic: CrewRole.Medic,
    security: CrewRole.Security,
    scientist: CrewRole.Scientist,
  };

  let resolved = template;
  for (const [key, role] of Object.entries(roleMap)) {
    const member = crew.find(c => c.role === role);
    if (member) {
      resolved = resolved.replace(new RegExp(`\\{${key}\\}`, "g"), `${member.firstName} ${member.lastName}`);
      resolved = resolved.replace(new RegExp(`\\{${key}_last\\}`, "g"), member.lastName);
    } else {
      // Fallback if crew member not found
      resolved = resolved.replace(new RegExp(`\\{${key}\\}`, "g"), `the ${key}`);
      resolved = resolved.replace(new RegExp(`\\{${key}_last\\}`, "g"), key);
    }
  }
  return resolved;
}

/**
 * Look up revelation templates for a specific deduction.
 * Returns undefined if no templates exist for this archetype/deduction combo.
 */
export function getRevelationTemplates(
  archetype: IncidentArchetype,
  deductionId: string,
): DeductionRevelations | undefined {
  return REVELATIONS[archetype]?.[deductionId];
}

/**
 * Resolve revelation templates for a deduction, filling crew name placeholders.
 * Also resolves crew-name tags in tagRevelations (e.g., tag "{engineer_last}" → "chen").
 */
export function resolveRevelations(
  archetype: IncidentArchetype,
  deductionId: string,
  crew: CrewMember[],
  timeline: IncidentTimeline,
): { tagRevelations: { tag: string; text: string }[]; synthesisText: string; conclusionText: string } | undefined {
  const templates = getRevelationTemplates(archetype, deductionId);
  if (!templates) return undefined;

  const roleMap: Record<string, CrewRole> = {
    engineer: CrewRole.Engineer,
    captain: CrewRole.Captain,
    medic: CrewRole.Medic,
    security: CrewRole.Security,
    scientist: CrewRole.Scientist,
  };

  // Resolve tag names that use placeholders (e.g., "{engineer_last}" → actual last name)
  const resolvedTagRevelations = templates.tagRevelations.map(tr => {
    let resolvedTag = tr.tag;
    // Check if tag is a placeholder like "{engineer_last}"
    const tagMatch = resolvedTag.match(/^\{(\w+)_last\}$/);
    if (tagMatch) {
      const roleKey = tagMatch[1];
      const role = roleMap[roleKey];
      if (role) {
        const member = crew.find(c => c.role === role);
        if (member) {
          resolvedTag = member.lastName.toLowerCase();
        }
      }
    }
    return {
      tag: resolvedTag,
      text: resolveRevelationTemplate(tr.text, crew, timeline),
    };
  });

  return {
    tagRevelations: resolvedTagRevelations,
    synthesisText: resolveRevelationTemplate(templates.synthesisText, crew, timeline),
    conclusionText: resolveRevelationTemplate(templates.conclusionText, crew, timeline),
  };
}
