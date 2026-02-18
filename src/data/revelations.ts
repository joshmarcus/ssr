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
          text: "These coolant readings show a textbook cascade pattern — each relay overheating triggers the next in sequence. That's not random system failure. That's a specific, identifiable chain reaction: a thermal cascade through the coolant network. It tells us exactly what type of incident hit this station.",
        },
      ],
      synthesisText: "The evidence answers the question clearly. The coolant pressure traces show a cascading thermal failure — each relay in the network overheating and triggering the next. The station didn't suffer a generic malfunction. It experienced a specific, well-documented type of disaster: a coolant cascade. The relay network overheated in sequence, and the station's cooling infrastructure collapsed like dominoes.",
      conclusionText: "CONFIRMED: Coolant cascade failure — a thermal chain reaction through the relay network. Now the question becomes: where did it start?",
    },
    deduction_sequence: {
      tagRevelations: [
        {
          tag: "coolant",
          text: "The coolant pressure data pinpoints where the thermal readings first spiked. The cascade didn't happen everywhere at once — it originated in a specific section where the relay junction had been flagged for maintenance. This narrows down the origin point.",
        },
        {
          tag: "timeline_trigger",
          text: "The alarm sequence timestamps tell a clear story — there's a gap between the first warning and the cascade going critical. The triggering event was localized and initially slow-building before it spread through the relay network. This confirms the incident had a single point of origin.",
        },
      ],
      synthesisText: "The timeline is clear now. The coolant pressure drop began at a single junction — the exact one that had been flagged for maintenance. The first relay overheated, sending excess thermal load to its neighbors, and within minutes the entire coolant network was in cascade failure. The alarms trace the path of destruction from origin to collapse.",
      conclusionText: "CONFIRMED: The cascade originated at the flagged relay junction. The system failed exactly where it was predicted to fail. Now the question is: why wasn't it fixed?",
    },
    deduction_why: {
      tagRevelations: [
        {
          tag: "coolant",
          text: "The maintenance logs show the coolant loop was flagged as degraded three weeks before the cascade. Someone documented the exact failure mode that eventually occurred. This tells us the cascade wasn't unpredictable — it was predicted. The cause wasn't the coolant system itself, but the decision-making that allowed it to deteriorate.",
        },
        {
          tag: "{engineer_last}",
          text: "{engineer}'s name appears on every maintenance request — three filed over three weeks, each more urgent than the last. All three were marked 'low priority' by command. This connects the engineer directly to the question of why: {engineer} identified the problem, proposed the fix, and was overruled. The cause of the incident runs through that chain of denied requests.",
        },
      ],
      synthesisText: "Now the full picture emerges. {engineer} documented the failing coolant system, filed urgent repair requests, and was denied each time. The cascade wasn't a surprise — it was the exact failure the engineer predicted. The answer to 'why' isn't technical. It's organizational: deferred maintenance. Someone in command chose to deprioritize a critical repair, and the system failed exactly as warned. This was a preventable disaster.",
      conclusionText: "CONFIRMED: Deferred maintenance — {engineer}'s warnings were ignored by command, and the system failed exactly as predicted. Now: who tried to stop it?",
    },
    deduction_hero: {
      tagRevelations: [
        {
          tag: "engineer",
          text: "The response logs show someone working against the clock to isolate failing relay sections — rerouting coolant manually, shutting down non-essential systems, trying to create firebreaks in the cascade. The technical knowledge required points to engineering staff. Someone fought hard to contain this.",
        },
        {
          tag: "timeline_response",
          text: "The emergency action timestamps reveal a pattern of increasingly desperate interventions. Whoever was responding didn't give up even as the cascade spread — they kept trying new approaches to slow it down, buying time for evacuation. The response log reads like a one-person war against the failing systems.",
        },
      ],
      synthesisText: "The evidence paints a clear picture of heroism. While the cascade was spreading, one crew member was systematically working through every possible countermeasure — isolating relays, rerouting coolant, manually venting thermal buildup. The engineering expertise and the personal investment (they'd warned about exactly this failure) point to one person who gave everything to contain the disaster they tried to prevent.",
      conclusionText: "CONFIRMED: The engineer who warned about the failure was the same one who fought hardest to contain it. Now: who let it happen?",
    },
    deduction_responsibility: {
      tagRevelations: [
        {
          tag: "{captain_last}",
          text: "{captain}'s authorization appears on the maintenance deferral orders. Three separate requests, three separate denials — all bearing the same command signature. The chain of responsibility leads directly to whoever signed those orders. The decision to defer maintenance was a command decision.",
        },
        {
          tag: "timeline_aftermath",
          text: "The aftermath logs reveal attempts to reclassify the incident as 'unforeseeable equipment failure.' But the paper trail shows otherwise — the failure was not only foreseeable, it was foreseen. Someone in command is trying to rewrite the narrative, which tells us they know where the responsibility lies.",
        },
      ],
      synthesisText: "The responsibility is clear and documented. {captain} signed the deferral orders. {captain} overruled the engineer's warnings. And after the cascade, {captain}'s name appears on the incident report that omits the maintenance history. The chain of command had the authority to authorize repairs, chose not to, and then attempted to obscure that choice. This wasn't just negligence — it was negligence followed by a cover-up.",
      conclusionText: "CONFIRMED: Command ignored warnings and deferred critical maintenance. The responsibility rests with {captain}, who had the authority to act and chose not to.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // HULL BREACH
  // ══════════════════════════════════════════════════════════════════
  [IncidentArchetype.HullBreach]: {
    deduction_what: {
      tagRevelations: [
        {
          tag: "hull",
          text: "The structural integrity readings show a catastrophic pressure differential — one side of the hull registering vacuum while the other maintains atmosphere. This isn't gradual wear. The hull failed suddenly, venting entire sections to space. The evidence points to a hull breach as the primary incident.",
        },
      ],
      synthesisText: "The hull integrity data tells the story. Structural sensors recorded a sudden pressure drop cascading through multiple sections — bulkhead seals triggered in sequence as atmosphere vented through the breach point. The station suffered a hull breach that caused rapid depressurization across connected sections.",
      conclusionText: "CONFIRMED: Hull breach — sudden structural failure causing depressurization in multiple sections. Where did it start?",
    },
    deduction_sequence: {
      tagRevelations: [
        {
          tag: "hull",
          text: "The pressure differential data maps the exact progression — one section lost pressure first, then adjacent sections followed as emergency bulkheads failed to contain the breach. The origin point is where the pressure dropped fastest.",
        },
        {
          tag: "timeline_trigger",
          text: "The emergency seal timestamps show a clear propagation pattern from a single point outward. The triggering event was localized — one section breached, and the emergency systems couldn't contain the cascade of depressurization that followed.",
        },
      ],
      synthesisText: "The breach originated at a specific structural junction — pressure dropped there first, and the emergency bulkheads in adjacent sections couldn't seal fast enough. The depressurization spread outward from a single failure point, following the path of least structural resistance. The station's compartmentalization was supposed to prevent exactly this kind of cascading failure.",
      conclusionText: "CONFIRMED: The breach started at a weakened structural junction and cascaded outward. Why was the hull compromised?",
    },
    deduction_why: {
      tagRevelations: [
        {
          tag: "hull",
          text: "Archived inspection reports reveal a pattern of micro-impacts accumulating at the breach point over months. Each individual impact was below the damage threshold, but together they weakened the hull below structural tolerances. The breach was the cumulative result of unaddressed wear.",
        },
        {
          tag: "{engineer_last}",
          text: "{engineer}'s inspection notes flagged the micro-impact accumulation months before the breach. The reports recommended hull patching during the next maintenance cycle — a cycle that was repeatedly postponed. {engineer} saw this coming but couldn't get the resources to fix it.",
        },
      ],
      synthesisText: "The hull didn't fail without warning. {engineer} documented the accumulating micro-impact damage and requested hull patching multiple times. The maintenance window kept getting pushed back. The breach was the inevitable result of months of accumulated damage at a point that had been flagged and ignored. This was a failure of maintenance prioritization, not engineering.",
      conclusionText: "CONFIRMED: Accumulated micro-impact damage, documented but unpatched. The hull failed exactly where {engineer} predicted. Who bears the responsibility?",
    },
    deduction_hero: {
      tagRevelations: [
        {
          tag: "engineer",
          text: "Emergency response logs show someone manually sealing bulkheads and rerouting atmosphere distribution during the breach — technical work that required structural engineering knowledge. Someone was buying time for evacuation by hand-sealing the compartments the automated systems couldn't reach.",
        },
        {
          tag: "timeline_response",
          text: "The response timeline shows continuous damage-control actions from the moment of breach through evacuation. Whoever was responding moved methodically through the depressurization zones, prioritizing crew safety over system preservation. Their actions saved lives.",
        },
      ],
      synthesisText: "One crew member's response stands out in the emergency logs — systematically sealing compartments, rerouting atmosphere, creating safe paths for evacuation. The structural knowledge required for this kind of rapid damage control points to the same person who'd been documenting the hull deterioration. They knew the station's weak points because they'd been trying to get them fixed.",
      conclusionText: "CONFIRMED: The engineer who flagged the damage became the one who managed the emergency response. Their knowledge of the weak points helped minimize casualties.",
    },
    deduction_responsibility: {
      tagRevelations: [
        {
          tag: "{captain_last}",
          text: "{captain}'s authorization controlled the maintenance schedule. The hull patching requests were marked 'deferred' under {captain_last}'s signature — not rejected, just endlessly postponed. The authority to prioritize repairs rested with command.",
        },
        {
          tag: "timeline_aftermath",
          text: "Post-incident reports attempt to categorize the breach as 'unforeseen micro-meteorite damage.' But the inspection history tells a different story — the damage was documented, the risk was known, and the repairs were deferred. The aftermath narrative contradicts the maintenance record.",
        },
      ],
      synthesisText: "{captain} controlled the maintenance priorities and chose to defer hull repairs that {engineer} had flagged as critical. The post-incident report's claim of 'unforeseen damage' is contradicted by months of documented inspection findings. Command had the information, had the authority, and chose to postpone. The breach was a foreseeable consequence of that choice.",
      conclusionText: "CONFIRMED: {captain} deferred critical hull repairs despite documented warnings. The breach was preventable.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // REACTOR SCRAM
  // ══════════════════════════════════════════════════════════════════
  [IncidentArchetype.ReactorScram]: {
    deduction_what: {
      tagRevelations: [
        {
          tag: "reactor",
          text: "The reactor telemetry shows a containment field collapse followed by an automatic emergency shutdown — a SCRAM. The containment readings degraded over hours before the safety systems forced a shutdown. This was a reactor emergency, not a power outage.",
        },
      ],
      synthesisText: "The reactor data tells the story: containment field integrity dropped below critical threshold, triggering an automatic SCRAM. The shutdown was violent — emergency cooling engaged, radiation barriers sealed, and the station lost primary power. This was a containment failure that forced an emergency reactor shutdown.",
      conclusionText: "CONFIRMED: Reactor SCRAM — containment field collapsed, forcing emergency shutdown. Now: where and when did containment start failing?",
    },
    deduction_sequence: {
      tagRevelations: [
        {
          tag: "reactor",
          text: "The containment field logs show a gradual degradation starting well before the SCRAM. The field strength dropped in stages — each drop correlating with increased reactor output. Someone was pushing the reactor harder even as containment weakened.",
        },
        {
          tag: "timeline_trigger",
          text: "The SCRAM triggered at a specific moment when containment dropped below the safety threshold. But the triggering event wasn't the reactor itself — it was an external demand on reactor output that pushed containment past its limits. Something was drawing more power than the reactor could safely provide.",
        },
      ],
      synthesisText: "The sequence is clear: containment was already degrading when an increase in power demand pushed the reactor past its safety margin. The containment field couldn't maintain integrity at the higher output level, and the automatic safety systems triggered a SCRAM. The question isn't what failed — it's what was demanding so much power and why the crew didn't reduce output before containment collapsed.",
      conclusionText: "CONFIRMED: Containment degraded under excessive power demands, triggering the SCRAM. Why was the reactor being pushed so hard?",
    },
    deduction_why: {
      tagRevelations: [
        {
          tag: "reactor",
          text: "Operations logs reveal a deadline — a transmission window that required sustained high-power output from the station's communications array. The reactor was pushed to support this transmission even as containment readings deteriorated. The deadline took priority over reactor safety.",
        },
        {
          tag: "{engineer_last}",
          text: "{engineer} raised concerns about containment field degradation during the power-up for the transmission. The logs show {engineer_last} recommended reducing output and delaying the transmission. The recommendation was overridden — the deadline was deemed non-negotiable.",
        },
      ],
      synthesisText: "The cause wasn't a technical failure — it was a scheduling failure. The station had a transmission deadline that required sustained high power, and the crew pushed the reactor to meet it despite {engineer}'s warnings about containment degradation. The deadline was prioritized over safety margins, and the containment field collapsed under the sustained load. This was a preventable disaster driven by deadline pressure.",
      conclusionText: "CONFIRMED: Deadline pressure — containment field degraded while the crew focused on the transmission window. {engineer}'s warnings were overridden.",
    },
    deduction_hero: {
      tagRevelations: [
        {
          tag: "engineer",
          text: "Post-SCRAM logs show someone manually managing the reactor cooldown sequence — a technically demanding process that prevented a full meltdown. The person who managed the shutdown had intimate knowledge of the reactor systems and worked continuously through dangerous radiation levels.",
        },
        {
          tag: "timeline_response",
          text: "The emergency response timeline shows a calculated, methodical approach to reactor stabilization. Whoever managed the post-SCRAM procedures didn't panic — they followed emergency protocols precisely, even improvising when automated systems failed. Their steady response prevented a catastrophic outcome.",
        },
      ],
      synthesisText: "After the SCRAM, someone stayed at the reactor controls managing the cooldown sequence while radiation levels climbed. Their technical expertise and composure prevented what could have been a full meltdown. The same person who warned about pushing containment too hard was the one who managed the emergency when those warnings went unheeded.",
      conclusionText: "CONFIRMED: The engineer who warned about containment managed the post-SCRAM cooldown, preventing a far worse outcome.",
    },
    deduction_responsibility: {
      tagRevelations: [
        {
          tag: "{captain_last}",
          text: "{captain} authorized the power increase for the transmission window despite engineering concerns. The order to maintain reactor output came from command — specifically, from someone who valued the transmission deadline over containment safety margins.",
        },
        {
          tag: "timeline_aftermath",
          text: "The incident report frames the SCRAM as 'unexpected containment degradation.' But the engineering logs show the degradation was not only expected — it was actively reported during the power-up. The aftermath narrative omits the command decision that caused the incident.",
        },
      ],
      synthesisText: "{captain} ordered the reactor to maintain output for the transmission deadline despite {engineer}'s containment warnings. The post-incident report omits this command decision, framing the SCRAM as an unexpected equipment failure. But the record is clear: command was informed of the risk, chose to accept it, and then attempted to obscure that choice in the aftermath.",
      conclusionText: "CONFIRMED: {captain} prioritized the transmission deadline over reactor safety, overriding engineering warnings. The SCRAM was a direct consequence of that decision.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // SABOTAGE
  // ══════════════════════════════════════════════════════════════════
  [IncidentArchetype.Sabotage]: {
    deduction_what: {
      tagRevelations: [
        {
          tag: "electrical",
          text: "The electrical system logs show a pattern that doesn't match any natural failure mode — systems went offline in a specific sequence that suggests deliberate targeting. Critical systems failed first, followed by the safety backups. This wasn't random; someone knew exactly which systems to hit and in what order.",
        },
      ],
      synthesisText: "The system failure pattern is too precise to be accidental. Critical systems disabled first, safety backups neutralized second, then monitoring systems taken offline to hide the evidence. This is deliberate sabotage — someone with detailed knowledge of station systems took them down in a calculated sequence designed to cause maximum disruption while minimizing immediate detection.",
      conclusionText: "CONFIRMED: Deliberate sabotage — station systems were targeted and disabled in a calculated sequence. Who had the knowledge and access?",
    },
    deduction_sequence: {
      tagRevelations: [
        {
          tag: "electrical",
          text: "The electrical fault logs reveal the precise order of system failures — access control first, then surveillance, then environmental monitoring. Each system's failure was separated by exactly the time needed to physically reach the next control junction. Someone walked a path through the station, disabling systems as they went.",
        },
        {
          tag: "timeline_trigger",
          text: "The first system failure coincides exactly with a badge access event at a restricted junction. Someone was physically present at the point of origin when the sabotage began. The triggering event was a person, not a malfunction.",
        },
      ],
      synthesisText: "The sabotage followed a physical path through the station — the time between each system failure matches the walking distance between control junctions. It began at a restricted access point where badge records show someone was present. The saboteur moved through the station with purpose, disabling systems in a sequence that required detailed knowledge of station infrastructure.",
      conclusionText: "CONFIRMED: The sabotage followed a physical path starting from a restricted junction. Someone walked through the station disabling systems deliberately. Why?",
    },
    deduction_why: {
      tagRevelations: [
        {
          tag: "electrical",
          text: "The specific systems targeted tell a story — they weren't random. The saboteur disabled exactly the systems that would prevent the station from sending or receiving communications, followed by the systems that would record what happened. This wasn't destruction for its own sake; this was an attempt to isolate the station and erase the evidence.",
        },
        {
          tag: "{engineer_last}",
          text: "Cross-referencing system access logs reveals that the expertise needed to disable these systems in this sequence belongs to someone with deep engineering knowledge. {engineer}'s technical reports show familiarity with every system that was targeted. But the question is motive — who had a reason to want the station isolated?",
        },
      ],
      synthesisText: "The sabotage was precise and purposeful: communications disabled, surveillance neutralized, records erased. Someone wanted the station isolated and their actions hidden. The technical expertise required narrows the suspects, but the motive — isolating the station from outside contact — points to someone hiding something. This wasn't anger or madness; this was a calculated operation by someone with both the skill and the reason to cut the station off.",
      conclusionText: "CONFIRMED: Deliberate interference to isolate the station and destroy evidence. Someone aboard had a hidden agenda that required the station to go dark.",
    },
    deduction_hero: {
      tagRevelations: [
        {
          tag: "engineer",
          text: "While systems were being disabled, someone was working to restore them — rerouting power, bypassing disabled junctions, jury-rigging backup communications. The restoration work shows the same level of technical knowledge as the sabotage itself, suggesting the person fighting to save the station understood exactly what was being done to it.",
        },
        {
          tag: "timeline_response",
          text: "The response logs show a cat-and-mouse pattern — systems being restored almost as quickly as they were disabled. Someone recognized the sabotage for what it was and began countermeasures immediately, working against the saboteur in real time. Their efforts limited the damage and preserved critical evidence.",
        },
      ],
      synthesisText: "One crew member recognized the sabotage pattern and began fighting it in real time — restoring disabled systems, rerouting around damaged junctions, and preserving critical data the saboteur was trying to destroy. Their technical knowledge matched the saboteur's, and their quick response prevented complete station isolation. The evidence we have exists because someone fought to preserve it.",
      conclusionText: "CONFIRMED: The engineer recognized the sabotage and fought to counter it, preserving evidence and preventing total station isolation.",
    },
    deduction_responsibility: {
      tagRevelations: [
        {
          tag: "{captain_last}",
          text: "Badge access records place {captain} at restricted junctions during the timeline that matches the sabotage sequence. {captain_last}'s access authorizations were used to bypass security at each disabled system. The evidence trail leads to command.",
        },
        {
          tag: "timeline_aftermath",
          text: "After the sabotage was partially contained, someone attempted to purge the access logs — but the restored backup systems had already captured the data. The cover-up attempt tells us the responsible party knew the evidence pointed to them and tried to destroy it after the fact.",
        },
      ],
      synthesisText: "The access records are damning. {captain}'s badge was used at each sabotaged junction in sequence. The cover-up attempt — trying to purge access logs after the engineer restored the backup systems — confirms awareness of guilt. {captain} had the access, the authorization, and subsequently attempted to destroy the evidence. The sabotage was an inside job from the highest level of station command.",
      conclusionText: "CONFIRMED: {captain} used command-level access to sabotage station systems. The motive — whatever it was — required silencing the station.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // SIGNAL ANOMALY
  // ══════════════════════════════════════════════════════════════════
  [IncidentArchetype.SignalAnomaly]: {
    deduction_what: {
      tagRevelations: [
        {
          tag: "signal",
          text: "The communications array logs show an incoming signal of extraordinary power and complexity — far beyond normal transmission parameters. When the station's receivers attempted to process it, the signal cascaded through interconnected electronics, causing widespread system interference. This was an external event, not an internal failure.",
        },
      ],
      synthesisText: "The station was hit by an anomalous external signal of unprecedented power. The communications array received and amplified it, and the signal propagated through the station's interconnected electronics, disrupting system after system. This wasn't a malfunction or sabotage — something from outside overwhelmed the station's ability to handle it. The question is: what was the signal, and was the station supposed to be listening for it?",
      conclusionText: "CONFIRMED: An anomalous external signal caused widespread system interference through the communications array. What was the station really doing out here?",
    },
    deduction_sequence: {
      tagRevelations: [
        {
          tag: "signal",
          text: "The signal processing logs show the exact moment the anomaly was received — and the propagation path as it spread through the station's electronics. The communications array was the entry point, and the signal followed the data bus architecture outward into every connected system.",
        },
        {
          tag: "timeline_trigger",
          text: "The triggering event was the activation of a specialized receiver configuration — someone had modified the communications array to listen on a non-standard frequency. The anomalous signal arrived on exactly that frequency, at exactly the time the modified receiver was active. This was not coincidence.",
        },
      ],
      synthesisText: "The picture becomes clearer: someone modified the communications array to listen on a specific, non-standard frequency. The anomalous signal arrived on that exact frequency, suggesting the station was actively searching for this type of signal. The receiver modifications amplified the incoming signal instead of filtering it, and the resulting overload cascaded through the station's electronics. The station was looking for something — and found more than it could handle.",
      conclusionText: "CONFIRMED: The station's modified receivers were actively scanning for the signal that overwhelmed them. This was a listening operation that went wrong.",
    },
    deduction_why: {
      tagRevelations: [
        {
          tag: "signal",
          text: "Classified project files reveal the station was tasked with monitoring a specific signal source — something the crew wasn't fully briefed on. The receiver modifications were part of a classified research protocol. The station's official mission was a cover for a signals intelligence operation.",
        },
        {
          tag: "{engineer_last}",
          text: "{engineer} raised concerns about the receiver modifications' lack of proper shielding and signal filtering. The modifications were rushed to meet a monitoring deadline, bypassing standard safety protocols. {engineer_last}'s objections were noted but classified and filed without action.",
        },
      ],
      synthesisText: "The station was operating under a classified research protocol — monitoring an anomalous signal source that command considered a priority. The receiver modifications that {engineer} warned about were part of this classified operation, rushed into service without proper safety margins. When the signal arrived at unexpected intensity, the unshielded receivers amplified it into the station's electronics. Nobody predicted the signal's power because nobody fully understood what they were listening to.",
      conclusionText: "CONFIRMED: A classified monitoring operation with inadequate safety precautions. The crew was exposed to a signal they weren't prepared to handle because the mission parameters were hidden from them.",
    },
    deduction_hero: {
      tagRevelations: [
        {
          tag: "engineer",
          text: "During the signal interference, someone physically disconnected the communications array from the station's data bus — a drastic measure that cut off the signal's propagation path. This required going to the array junction during active electromagnetic interference, which would have been extremely dangerous.",
        },
        {
          tag: "timeline_response",
          text: "The response logs show someone working methodically to isolate affected systems, shut down the compromised receiver, and restore station electronics in a safe sequence. Their response prioritized crew safety and system preservation over the classified monitoring operation.",
        },
      ],
      synthesisText: "One crew member cut the signal's propagation path by physically disconnecting the communications array — a dangerous act during active electromagnetic interference that required going to the array junction. Their quick, technically precise response stopped the cascade and prevented further damage. They chose crew safety over the classified mission, effectively ending the monitoring operation to save the station.",
      conclusionText: "CONFIRMED: The engineer physically severed the signal path at great personal risk, stopping the cascade. Their intervention saved the station.",
    },
    deduction_responsibility: {
      tagRevelations: [
        {
          tag: "{captain_last}",
          text: "{captain} authorized the classified monitoring protocol and the receiver modifications, despite {engineer}'s safety concerns. Command accepted the risk of inadequate signal filtering because the monitoring deadline was considered a priority over standard safety margins.",
        },
        {
          tag: "timeline_aftermath",
          text: "Post-incident, attempts were made to reclassify the event as 'natural electromagnetic interference.' The classified project files were queued for deletion. Someone in command was trying to erase evidence of the monitoring operation rather than document what went wrong.",
        },
      ],
      synthesisText: "{captain} authorized a classified operation that put the station at risk — monitoring an unknown signal source with inadequately shielded equipment. When {engineer} raised safety concerns, they were overridden in the name of the mission deadline. And after the incident, {captain} moved to destroy evidence of the classified operation rather than document the failure. The crew was endangered by a mission they weren't fully briefed on, led by someone who prioritized secrecy over safety.",
      conclusionText: "CONFIRMED: {captain} authorized a dangerous classified operation and attempted to cover up the evidence afterward. The crew paid the price for a mission they didn't know they were on.",
    },
    deduction_agenda: {
      tagRevelations: [
        {
          tag: "signal",
          text: "The classified project files reveal layers of secrecy — the signal monitoring was part of a program the crew was never meant to know about. The station's research mission was genuine, but it was also a cover for something else entirely. The signal they detected was something command had been searching for across multiple stations.",
        },
        {
          tag: "scientist",
          text: "Hidden communications show {scientist} was the only crew member partially briefed on the real mission — tasked with analyzing signal data and reporting directly to command, bypassing normal channels. {scientist_last} knew the research mission was a front, but even they weren't told the full scope of what they were looking for.",
        },
      ],
      synthesisText: "CORVUS-7 wasn't just a research station — it was a listening post. The legitimate research was real but served as cover for a classified signal monitoring program. {scientist} was the designated analyst, reporting outside normal channels, but even they weren't told what the signal actually was. The entire crew was unknowingly participating in a classified operation that put them in danger. The station's true purpose was hidden behind layers of compartmentalized secrecy.",
      conclusionText: "CONFIRMED: The station was secretly monitoring an anomalous signal — classified research the crew wasn't fully briefed on. The truth was hidden in plain sight.",
    },
  },

  // ══════════════════════════════════════════════════════════════════
  // CONTAINMENT BREACH
  // ══════════════════════════════════════════════════════════════════
  [IncidentArchetype.ContainmentBreach]: {
    deduction_what: {
      tagRevelations: [
        {
          tag: "containment",
          text: "The lab containment field readings show a sudden collapse — the atmospheric barrier that kept experimental materials isolated failed completely. Toxic atmosphere flooded from the containment zone into connected sections. This was a containment breach, not a general system failure.",
        },
      ],
      synthesisText: "The containment field data is unambiguous: the lab's atmospheric isolation barrier collapsed, releasing whatever was being contained into the station's ventilation network. Environmental sensors tracked the toxic atmosphere spreading through connected sections. The station suffered a containment breach — the lab's isolation failed, and the station's environment was contaminated.",
      conclusionText: "CONFIRMED: Lab containment breach — the atmospheric barrier failed, releasing toxic materials into the station. Where did containment break down?",
    },
    deduction_sequence: {
      tagRevelations: [
        {
          tag: "containment",
          text: "The containment field strength logs show the exact failure point — a specific field emitter that lost power, creating a gap in the containment barrier. The breach propagated from that gap as atmospheric pressure equalized between the contained and uncontained zones.",
        },
        {
          tag: "timeline_trigger",
          text: "The trigger wasn't a sudden catastrophe — the field emitter had been running at reduced capacity for hours. The triggering event was an experiment that increased atmospheric pressure inside containment beyond what the weakened field could hold. The breach happened when the pressure differential exceeded the field's remaining capacity.",
        },
      ],
      synthesisText: "The breach followed a predictable path: a weakened field emitter failed during an experiment that increased internal pressure beyond the field's remaining capacity. The containment barrier broke at its weakest point, and toxic atmosphere rushed through the gap into the station's ventilation system. The experiment should never have been run with a compromised containment field, but someone decided the experiment couldn't wait.",
      conclusionText: "CONFIRMED: A weakened field emitter failed during an experiment that should have been postponed. Who decided to proceed?",
    },
    deduction_why: {
      tagRevelations: [
        {
          tag: "containment",
          text: "The experiment protocols specify minimum containment field strength for the procedure that was underway. The actual field strength at the time of the experiment was below that minimum. Someone authorized the experiment to proceed despite not meeting the safety requirements. The protocols were clear — and were violated.",
        },
        {
          tag: "{engineer_last}",
          text: "{engineer} filed a containment field maintenance request the day before the breach, noting the emitter degradation and recommending the experiment be postponed until repairs were complete. The request was acknowledged but the experiment proceeded on schedule. {engineer_last}'s assessment was correct — the field wasn't safe for the planned procedure.",
        },
      ],
      synthesisText: "The protocols were clear: minimum containment field strength for the experiment was specified, and the actual field strength was below that threshold. {engineer} documented this and recommended postponement. The experiment proceeded anyway, violating its own safety protocols. The containment breach wasn't a failure of the equipment — it was a failure to respect the equipment's limitations. Someone chose schedule over safety.",
      conclusionText: "CONFIRMED: Safety protocols were violated — the experiment ran with inadequate containment despite {engineer}'s warnings. The breach was preventable.",
    },
    deduction_hero: {
      tagRevelations: [
        {
          tag: "engineer",
          text: "After the breach, someone initiated emergency containment procedures — manually activating backup field emitters, sealing ventilation connections, and directing atmospheric scrubbing to limit toxic exposure. The response required detailed knowledge of both the containment systems and the toxic materials involved.",
        },
        {
          tag: "timeline_response",
          text: "The response timeline shows someone working continuously through toxic atmosphere exposure to contain the breach and restore isolation. They prioritized sealing crew areas before addressing the lab, accepting personal risk to protect others. Their actions prevented the contamination from reaching the entire station.",
        },
      ],
      synthesisText: "One crew member's emergency response prevented a station-wide contamination event. Working through toxic exposure, they manually restored partial containment, sealed crew areas, and directed atmospheric scrubbing to critical zones. Their knowledge of both the containment systems and the materials involved was essential — without their intervention, the entire station would have been contaminated.",
      conclusionText: "CONFIRMED: The engineer's emergency response contained the breach and prevented station-wide contamination, at personal cost.",
    },
    deduction_responsibility: {
      tagRevelations: [
        {
          tag: "{captain_last}",
          text: "{captain} authorized the experiment to proceed on schedule despite the containment field maintenance flag. The authorization overrode the safety protocol that would have required postponement. Command made the call to prioritize the research timeline over containment safety.",
        },
        {
          tag: "timeline_aftermath",
          text: "Post-incident documentation attempts to attribute the breach to 'unexpected equipment failure.' But the maintenance logs, the safety protocol violations, and the authorization chain tell a different story. The aftermath narrative is a rewrite designed to obscure the decision that led to the breach.",
        },
      ],
      synthesisText: "{captain} authorized an experiment that violated its own safety protocols, overriding {engineer}'s maintenance flag and the containment field strength requirements. After the predictable breach occurred, the incident report was crafted to omit the protocol violations and the command decision to proceed. The responsibility is clear: command chose to run an unsafe experiment on schedule and then attempted to hide that choice.",
      conclusionText: "CONFIRMED: {captain} authorized a protocol-violating experiment and covered up the decision. The containment breach was a direct result of that authorization.",
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
