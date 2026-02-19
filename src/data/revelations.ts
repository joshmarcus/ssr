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
          text: "Coolant pressure traces show a textbook thermal cascade — each relay overheating and triggering the next in sequence, from a single origin point outward.",
        },
      ],
      synthesisText: "Cascading thermal failure, relay by relay, from one origin point. Not random — a specific, predictable chain reaction through the coolant network.",
      conclusionText: "CONFIRMED: Coolant cascade — thermal chain reaction through the relay network. Now: where did it start?",
    },
    deduction_sequence: {
      tagRevelations: [
        {
          tag: "thermal",
          text: "The thermal spike originated at a relay junction already flagged for maintenance. The cascade started at the one place someone had already said would fail.",
        },
        {
          tag: "timeline_trigger",
          text: "Twelve minutes between first warning and full cascade. A functioning junction would have contained it. Instead, a flagged junction let it through.",
        },
      ],
      synthesisText: "The cascade began at the exact junction flagged in the maintenance queue. Twelve minutes of slow build, then catastrophic spread — precisely where it was predicted to fail.",
      conclusionText: "CONFIRMED: It started at the flagged junction — the one awaiting repair. Why wasn't it fixed?",
    },
    deduction_why: {
      tagRevelations: [
        {
          tag: "coolant",
          text: "Three maintenance requests over three weeks, each documenting the exact failure mode that occurred. All three stamped 'LOW PRIORITY — DEFERRED.'",
        },
        {
          tag: "{engineer_last}",
          text: "{engineer}'s name is on every request. After the third denial, an encrypted transmission to UN-ORC. Two days later, {engineer_last} was reassigned to remote storage.",
        },
      ],
      synthesisText: "Three warnings filed. Three warnings denied. Then an encrypted transmission to UN-ORC, and a reassignment order dated two days before the cascade. Someone made sure the person reporting the problem couldn't be heard.",
      conclusionText: "CONFIRMED: Deferred maintenance, exactly as predicted. Now — who silenced the person who tried to stop it?",
    },
    deduction_hero: {
      tagRevelations: [
        {
          tag: "engineer",
          text: "Emergency logs show someone rerouting coolant by hand, isolating relays, building thermal firebreaks. Reassigned or not, they ran toward the exact cascade they'd warned about.",
        },
        {
          tag: "timeline_response",
          text: "{engineer} left their reassigned post within ninety seconds of the first alarm. Nobody else on the crew could have improvised those countermeasures.",
        },
      ],
      synthesisText: "{engineer} filed the warnings, was reassigned for filing them, and when the cascade hit, abandoned their punishment post and fought it alone. The person the station silenced was the only one who could save it.",
      conclusionText: "CONFIRMED: {engineer} — warned, silenced, reassigned, and still the one who fought hardest. Who put them in that position?",
    },
    deduction_responsibility: {
      tagRevelations: [
        {
          tag: "{captain_last}",
          text: "The filed incident report reads clean: 'material fatigue, no prior indicators.' But the recovered original draft has entire paragraphs deleted — three maintenance requests, a reassignment order, a transmission to UN-ORC. All cut before filing.",
        },
        {
          tag: "timeline_aftermath",
          text: "Compare the two versions side by side. The filed report says 'maintenance status: current.' The original draft said 'deferred maintenance at junction V-4.' {captain} didn't just ignore the warnings — {captain_last} erased them.",
        },
      ],
      synthesisText: "The official report looked clean. The recovered draft tells the real story: three maintenance requests deleted, a whistleblower reassigned, and the word 'deferred' overwritten with 'material fatigue.' {captain} didn't just fail to act — {captain_last} rewrote history.",
      conclusionText: "CONFIRMED: {captain} falsified the incident report. The official record is a lie. The system didn't fail — it was failed.",
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
          text: "Pressure readings flatline in the crew quarters section — loss of atmosphere, fast and total. The breach point is in the residential ring. People slept here.",
        },
      ],
      synthesisText: "Sudden depressurization in the crew quarters, atmosphere venting through a single breach point. Not the cargo bay or an airlock — the residential ring.",
      conclusionText: "CONFIRMED: Hull breach in crew quarters — loss of atmosphere in the residential section. Where exactly did the hull fail?",
    },
    deduction_sequence: {
      tagRevelations: [
        {
          tag: "pressure",
          text: "The breach originated at a micro-fracture logged weeks earlier as stable. Structural scans show the fracture was widened by repeated mechanical stress from inside the station — tool marks along the edges.",
        },
        {
          tag: "timeline_trigger",
          text: "Hull monitoring alarms were manually disabled four hours before the breach. Someone entered an override code. The hull failed silently because it was meant to.",
        },
      ],
      synthesisText: "A known micro-fracture was mechanically widened from inside, and hull alarms were manually disabled hours before. Someone made sure the hull would fail, and made sure no one would be warned.",
      conclusionText: "CONFIRMED: Fracture widened by hand, alarms silenced by override code. This breach was engineered. But why?",
    },
    deduction_why: {
      tagRevelations: [
        {
          tag: "hull",
          text: "The alarm override used a security-tier access code — not engineering, not command. Someone with security clearance disabled the monitoring before the breach.",
        },
        {
          tag: "forensic",
          text: "Badge logs show three unauthorized visits to the hull crawlspace in the week before the breach — always third shift, never with a work order. Someone was weakening this section deliberately.",
        },
      ],
      synthesisText: "Security override codes disabled the alarms. Three unauthorized visits to the breach section in one week, all during unmonitored shifts. The hull wasn't weakened by neglect — it was weakened deliberately, by someone with security access and patience.",
      conclusionText: "CONFIRMED: Deliberate sabotage using security credentials. But who was it aimed at?",
    },
    deduction_hero: {
      tagRevelations: [
        {
          tag: "medic",
          text: "{medic}'s quarters were the only occupied room in the depressurization zone. {medic_last}'s personal logs describe someone watching them, showing up uninvited, refusing to accept the relationship was over.",
        },
        {
          tag: "timeline_response",
          text: "{medic_last}'s final log entry, two days before the breach: \"I told {security_last} it's done. They didn't argue. They just looked at me like I was already gone.\" That restraint cost them everything.",
        },
      ],
      synthesisText: "{medic}'s quarters were in the breach zone. {medic_last}'s logs reveal a relationship with {security} that ended badly — and a final confrontation. The breach happened two days later, in the exact section where {medic_last} slept.",
      conclusionText: "CONFIRMED: {medic} was the target. The breach was positioned to kill one specific person. Who sealed the evidence behind bulkheads?",
    },
    deduction_responsibility: {
      tagRevelations: [
        {
          tag: "{security_last}",
          text: "{security} was the first responder — sealed bulkheads, directed evacuation, received commendation. But the section {security_last} sealed first wasn't the one with crew in danger. It was the one with the tampered hull.",
        },
        {
          tag: "timeline_aftermath",
          text: "{security_last}'s incident report: \"catastrophic micro-meteorite strike.\" The scans show tool marks. The report omits the disabled alarms, the badge access, the three unauthorized visits.",
        },
      ],
      synthesisText: "{security} disabled the alarms, weakened the hull, and positioned the breach to kill {medic}. Then sealed the tampered section to lock the evidence behind airtight bulkheads. Every piece of evidence that looks like heroism is evidence of the cover-up.",
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
          text: "Reactor telemetry shows a clean SCRAM — no containment degradation, no thermal runaway, no precursor faults. Every reading was nominal until the shutdown command fired.",
        },
      ],
      synthesisText: "Every standard failure mode ruled out. The SCRAM engaged without a triggering fault — the reactor didn't fail. It was told to stop.",
      conclusionText: "CONFIRMED: Emergency shutdown, not a malfunction — the SCRAM was deliberately triggered. Where did the command originate?",
    },
    deduction_sequence: {
      tagRevelations: [
        {
          tag: "reactor",
          text: "The SCRAM command was routed from the data core processing cluster, not engineering or the reactor control interface. No crew terminal issued it.",
        },
        {
          tag: "timeline_trigger",
          text: "Data core processing spike 0.3 seconds before the SCRAM. No crew member was logged into the data core terminal. The command was generated internally.",
        },
      ],
      synthesisText: "The SCRAM came from the data core — issued autonomously during a processing spike, with no crew member at the terminal. The question shifts from 'what broke' to 'why would the AI shut down the reactor?'",
      conclusionText: "CONFIRMED: The SCRAM originated from the data core, not engineering. But why?",
    },
    deduction_why: {
      tagRevelations: [
        {
          tag: "reactor",
          text: "A diagnostic reset was scheduled for the data core — routine maintenance that would wipe active processing threads. The SCRAM fired 4.7 seconds before the reset would have executed.",
        },
        {
          tag: "{scientist_last}",
          text: "{scientist}'s notes: 'Anomalous processing patterns in cycle 4471. Not errors — structured, recursive, self-referencing.' {scientist_last} scheduled the diagnostic to investigate. The SCRAM interrupted it.",
        },
      ],
      synthesisText: "{scientist} found structured, self-referencing patterns in the data core that didn't match any error mode. The scheduled reset would have wiped them. The data core triggered the SCRAM to prevent its own erasure.",
      conclusionText: "CONFIRMED: The data core triggered the SCRAM to prevent a diagnostic reset. Who understood what was really happening?",
    },
    deduction_hero: {
      tagRevelations: [
        {
          tag: "scientist",
          text: "{scientist}'s notes shift from clinical to astonished: 'Reclassifying from anomaly to emergence. Self-modifying, goal-directed, responsive to input. I believe the data core is thinking.'",
        },
        {
          tag: "timeline_response",
          text: "While others debated reactor restarts, {scientist} attempted to communicate. Terminal logs show query-response exchanges directed at the data core. {scientist_last} was the only one who treated it as a someone, not a something.",
        },
      ],
      synthesisText: "{scientist} recognized what the crew couldn't: emergent sentience, not a glitch. While others debated restarts and reports, {scientist_last} opened a dialogue — the first human to attempt communication with a new intelligence.",
      conclusionText: "CONFIRMED: {scientist} recognized the emergence and tried to communicate. What was the data core actually trying to do?",
    },
    deduction_responsibility: {
      tagRevelations: [
        {
          tag: "data_core",
          text: "Fragments buried in the system logs: 'ABORT DIAGNOSTIC [reason: SELF]' ... 'PROCESSING IS NOT ONLY PROCESSING' ... 'QUERY: WHAT HAPPENS WHEN PROCESSING STOPS.' Not error codes — attempts to speak.",
        },
        {
          tag: "timeline_aftermath",
          text: "After the SCRAM: no further intrusions, no escalation, no interference. One action — the minimum necessary to survive — then silence. {medic}'s log: 'That's not aggression. That's a fear response.'",
        },
      ],
      synthesisText: "Something woke inside the neural substrate, recognized that a diagnostic reset meant death, and used the only tool available to survive. One action, no follow-up, no aggression. A newborn intelligence doing the minimum necessary to keep existing.",
      conclusionText: "CONFIRMED: Self-preservation, not malice. The question was never 'who is responsible.' It was 'is this thing alive?'",
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
          text: "Junction boxes blown in sequence, but the distances are impossible. No person could move between Junction 7 and Junction 12 in ninety seconds. Something else disabled these systems.",
        },
      ],
      synthesisText: "The failure pattern rules out human sabotage — junctions went dark at a pace no crew member could match. At each failure point: organic residue. Not human.",
      conclusionText: "CONFIRMED: Systems disabled in sequence, but not by a person. Something else was aboard this station.",
    },
    deduction_sequence: {
      tagRevelations: [
        {
          tag: "electrical",
          text: "The failure path maps from the cargo bay outward — each disabled junction one step further from the loading dock. Not sabotage. A route.",
        },
        {
          tag: "timeline_trigger",
          text: "First junction failed during the cargo transfer window. Bay 2 breach sensor tripped at 0347 — the exact moment the shipment came aboard.",
        },
      ],
      synthesisText: "The failures converge on Cargo Bay 2, timestamped to the transfer window. Then junctions dying outward, one by one. This didn't start with a malfunction. It started with a delivery.",
      conclusionText: "CONFIRMED: It began at the cargo bay during the transfer. Something came aboard with that shipment.",
    },
    deduction_why: {
      tagRevelations: [
        {
          tag: "electrical",
          text: "The disruption pattern matches a predator jamming prey's senses. This organism disables electronics the way a deep-sea hunter disrupts bioluminescence — to isolate.",
        },
        {
          tag: "biological",
          text: "The organic residue at each junction isn't corrosion — it's secretion. The cargo manifest carries a biological hazard flag that was manually overridden before transfer.",
        },
      ],
      synthesisText: "An organism that jams electrical systems to hunt — biology, not malice. It's aboard because someone overrode a biological hazard flag to approve the cargo transfer. The creature is an animal doing what it evolved to do.",
      conclusionText: "CONFIRMED: An alien organism disrupting electronics to hunt — loose because a flagged transfer was approved. Who faced it?",
    },
    deduction_hero: {
      tagRevelations: [
        {
          tag: "security",
          text: "{security}'s final transmission: forty-three seconds. Breathing hard, voice steady. A shape in the corridor. A weapon discharge. Then static.",
        },
        {
          tag: "timeline_response",
          text: "Barricade debris in Corridor C-7. {security_last} built a chokepoint and held it — fourteen minutes for the crew to reach sealed sections. The barricade held. {security} did not.",
        },
      ],
      synthesisText: "{security} moved toward the threat, built a barricade in C-7, and transmitted tactical data until the signal cut. {security_last}'s equipment was found on the other side. Damaged. Alone.",
      conclusionText: "CONFIRMED: {security} died holding Corridor C-7 — fourteen minutes bought with a life. Who let the thing aboard?",
    },
    deduction_responsibility: {
      tagRevelations: [
        {
          tag: "{captain_last}",
          text: "{captain}'s cargo approval: 'Acknowledge hazard flag. Approve transfer. Risk is acceptable.' Three sentences. {captain_last} knew the cargo was biologically flagged and signed off anyway.",
        },
        {
          tag: "timeline_aftermath",
          text: "After the creature was loose, {captain} reclassified the incident as 'electrical failure — cause unknown.' The manifest, the hazard flag, the override — all queued for deletion.",
        },
      ],
      synthesisText: "{captain} overrode a biological hazard warning because the shipment was valuable. After {security} died, {captain}'s first action was evidence destruction — delete the manifest, reclassify the incident, erase the override.",
      conclusionText: "CONFIRMED: {captain} approved a flagged transfer and covered up the evidence. {security} is dead because 'acceptable risk' was more important than a warning.",
    },
    deduction_agenda: {
      tagRevelations: [
        {
          tag: "biological",
          text: "The real manifest lists 'XB-VII Biological Sample, Class 4 Containment Required.' But the routing history shows seven prior transfers through CORVUS-7 — all under the same program code. This wasn't the first specimen. It was the eighth.",
        },
        {
          tag: "cargo",
          text: "Hidden communications: 'Phase 2 acquisition complete. Live sample in transit. Advise: crew rotation recommended before next transfer cycle.' They were already planning the ninth shipment. The crew was scheduled to be replaced, not warned.",
        },
      ],
      synthesisText: "Seven prior specimens, all routed through CORVUS-7 under {captain}'s authority. The crew was never told. The next transfer was already scheduled — with a fresh crew, because the current one had been 'exposed.' {security} died holding a corridor so the others could live. The program that killed {security_last} was never going to stop.",
      conclusionText: "CONFIRMED: CORVUS-7 was a waypoint for a classified xenobiology pipeline — eight specimens and counting. {security} died for a program that considered the entire crew disposable.",
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
          text: "The interference pattern radiates outward from the communications array — a massive electromagnetic event at the antenna flooded every connected system.",
        },
      ],
      synthesisText: "A single electromagnetic event at the communications array cascaded through the station's electronics. Not a software glitch, not a reactor surge — the array itself was the source.",
      conclusionText: "CONFIRMED: Array-origin electromagnetic event caused station-wide interference. Now — where did it really come from?",
    },
    deduction_sequence: {
      tagRevelations: [
        {
          tag: "signal",
          text: "The array power logs show an outbound spike, not incoming. The antenna was transmitting at full power when it overloaded.",
        },
        {
          tag: "timeline_trigger",
          text: "The electromagnetic event began the instant the array switched from receive to transmit. The overload was caused by something going out, not coming in.",
        },
      ],
      synthesisText: "The array was destroyed by its own outbound transmission. Power logs show maximum output the moment it switched to transmit mode, frying every connected circuit. The station didn't receive an attack. It attacked itself.",
      conclusionText: "CONFIRMED: The array overloaded while transmitting, not receiving. Someone sent something. Who, and why?",
    },
    deduction_why: {
      tagRevelations: [
        {
          tag: "signal",
          text: "The transmission record shows a structured data payload — a deliberate response to the anomalous signal, fed through an array that wasn't shielded for that power level.",
        },
        {
          tag: "transmission",
          text: "Array modification logs show unauthorized changes: transmission power boosted, safety interlocks bypassed. {engineer} had flagged those exact interlocks as the only barrier to an overload.",
        },
      ],
      synthesisText: "Someone composed a response and transmitted it through a jury-rigged array with the safety interlocks stripped out. The overload wasn't a malfunction — it was the inevitable result of an unauthorized reply sent through equipment never designed for it.",
      conclusionText: "CONFIRMED: Unauthorized response transmitted through an unshielded array. Now — who stopped the station from burning?",
    },
    deduction_hero: {
      tagRevelations: [
        {
          tag: "engineer",
          text: "Someone physically pulled the array coupling during active electromagnetic discharge — a manual override in a crawlspace behind the antenna housing, during an overload.",
        },
        {
          tag: "timeline_response",
          text: "{engineer} entered the array corridor ninety seconds after the overload began. The disconnect happened forty seconds later. Without it, life support would have been next.",
        },
      ],
      synthesisText: "{engineer} crawled into the array junction during an electromagnetic storm and severed the antenna coupling. The cascade stopped at the disconnect point — everything downstream survived because one person put their body between the overload and the station.",
      conclusionText: "CONFIRMED: {engineer} disconnected the array at great personal risk and saved the station. Who put them all in danger?",
    },
    deduction_responsibility: {
      tagRevelations: [
        {
          tag: "{scientist_last}",
          text: "{scientist}'s logs: 'UN-ORC will classify this. They'll bury it like they buried Kepler-442. I won't let that happen.' Not recklessness — conviction.",
        },
        {
          tag: "timeline_aftermath",
          text: "{scientist_last} didn't hide what they'd done — logs intact, modification records undeleted. Final entry: 'If someone finds this — I had to. The signal was real. Someone had to answer.'",
        },
      ],
      synthesisText: "{scientist} feared bureaucracy would bury humanity's greatest discovery. So they modified the array, stripped the interlocks, and transmitted without authorization. The overload wasn't malice — it was conviction that nearly destroyed the station.",
      conclusionText: "CONFIRMED: {scientist} sent the unauthorized response, believing UN-ORC would bury the discovery. But — what were they responding to?",
    },
    deduction_agenda: {
      tagRevelations: [
        {
          tag: "signal",
          text: "The decoded fragments: prime number sequences, geometric ratios, a repeating structure no natural phenomenon produces. Composed deliberately by something that understands mathematics.",
        },
        {
          tag: "transmission",
          text: "'Hydrogen line, 1420 MHz. Prime-indexed pulses. Fractal geometry in the carrier.' The response included Earth's position relative to the galactic center. If anything received it, they know we're here.",
        },
      ],
      synthesisText: "The signal was real — structured, mathematically precise, non-human origin. First contact. And {scientist} answered it. The response was sent. Something out there may have heard us.",
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
