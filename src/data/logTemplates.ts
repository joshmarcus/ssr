/**
 * Parameterized log templates for the mystery engine.
 * Templates use {variable} placeholders filled by the timeline generator.
 *
 * Available variables:
 *   {engineer}, {captain}, {medic}, {security}, {scientist}, {comms},
 *   {robotics}, {life_support} — crew member "FirstName LastName"
 *   {engineer_last}, {captain_last}, etc. — last name only
 *   {engineer_badge}, {captain_badge}, etc. — badge ID
 *   {room}, {room2} — room names from the station
 *   {time} — timestamp string
 *   {num} — a number (request ID, etc.)
 *   {weeks} — time duration
 *   {door} — door identifier
 *   {result} — access result
 *   {procedure_hint} — gameplay hint text
 */

export interface LogTemplate {
  id: string;
  category: string;
  title: string;
  text: string;
  source: string; // template for source field: "{engineer_last}" or literal
}

export const LOG_TEMPLATES: LogTemplate[] = [
  // ── Maintenance / routine ─────────────────────────────────────
  {
    id: "maint_request",
    category: "maintenance",
    title: "Maintenance Request #{num}",
    text: "{engineer} filed maintenance request #{num}. Status: pending for {weeks} weeks. Priority was marked 'low' by {captain_last}.",
    source: "{engineer_last}",
  },
  {
    id: "maint_inspection",
    category: "maintenance",
    title: "Routine Inspection Report",
    text: "Coolant loop B inspection complete. Flow rate nominal but {engineer_last} notes micro-vibration in junction V-4. Recommends monitoring.",
    source: "{engineer_last}",
  },
  {
    id: "maint_diagnostic",
    category: "maintenance",
    title: "Morning Diagnostic Summary",
    text: "0600 diagnostic pass: All systems nominal. Relay P01-P04 within thermal limits. Note: {room} air handler cycling 12% faster than baseline.",
    source: "system",
  },
  {
    id: "maint_overdue",
    category: "maintenance",
    title: "Overdue Maintenance Alert",
    text: "AUTOMATED: 3 maintenance items past due date. Relay thermal paste replacement (req #{num}), ventilation filter swap, coolant pressure calibration. Assigned: {engineer_last}.",
    source: "system",
  },
  {
    id: "maint_tools",
    category: "maintenance",
    title: "Equipment Check",
    text: "Toolkit audit: all items accounted for. {engineer_last} signed out voltage tester at 14:30. {robotics_last} requisitioned servo calibrator.",
    source: "system",
  },

  // ── Warning / escalation ──────────────────────────────────────
  {
    id: "warn_thermal",
    category: "warning",
    title: "Thermal Warning: Relay Junction",
    text: "WARNING: Thermal reading in {room} exceeds baseline by 40%. {engineer_last} requested emergency priority. {captain_last} reviewing.",
    source: "system",
  },
  {
    id: "warn_pressure",
    category: "warning",
    title: "Pressure Differential Alert",
    text: "CAUTION: Pressure differential between {room} and {room2}. Atmospheric monitoring flagged by {life_support_last}. Investigating.",
    source: "system",
  },
  {
    id: "warn_dismissed",
    category: "warning",
    title: "Commander's Assessment",
    text: "{captain}'s log: {engineer_last}'s concerns are noted but the data doesn't support emergency priority. We have the transmission window in 48 hours. Everything else can wait.",
    source: "{captain_last}",
  },
  {
    id: "warn_radiation",
    category: "warning",
    title: "Radiation Monitor Alert",
    text: "Reactor sector dosimeter reading: elevated. {scientist_last} and {engineer_last} alerted. Containment field at 94% — within tolerance but declining.",
    source: "system",
  },
  {
    id: "warn_signal",
    category: "warning",
    title: "Anomalous Signal Detected",
    text: "{comms} flagged an unregistered signal on frequency band 7.4GHz. Pattern is non-random. {scientist_last} requesting dedicated analysis time.",
    source: "{comms_last}",
  },

  // ── Personal / crew logs ──────────────────────────────────────
  {
    id: "personal_worry",
    category: "personal",
    title: "Personal Log",
    text: "{engineer}: Something's wrong near {room}. I told {captain_last} but the response was 'we're on schedule.' I'm documenting this.",
    source: "{engineer_last}",
  },
  {
    id: "personal_hope",
    category: "personal",
    title: "Personal Log",
    text: "{scientist}: Tomorrow is transmission day. Nine months of work. I keep looking at the photo on my desk. Almost home — in a way.",
    source: "{scientist_last}",
  },
  {
    id: "personal_observation",
    category: "personal",
    title: "Observation",
    text: "{medic}: I smelled something burnt near {room}. Could be the air recyclers, could be worse. {engineer_last} looked worried when I mentioned it.",
    source: "{medic_last}",
  },
  {
    id: "personal_suspicion",
    category: "personal",
    title: "Private Note",
    text: "{security}: {room} access at 02:17 — no scheduled maintenance. Badge scan was {engineer_badge}. Checking with {captain_last} in the morning.",
    source: "{security_last}",
  },
  {
    id: "personal_regret",
    category: "personal",
    title: "Commander's Personal Log",
    text: "{captain}: {engineer_last} was right. I should have listened. Three requests, three denials. If we get through this, that changes.",
    source: "{captain_last}",
  },
  {
    id: "personal_quiet",
    category: "personal",
    title: "Crew Quarters Note",
    text: "Can't sleep. {medic_last} says the air's fine but it doesn't taste right. {life_support_last} is checking the scrubbers. Nobody says it but we all know something's coming.",
    source: "anonymous",
  },

  // ── Access / security logs ────────────────────────────────────
  {
    id: "access_normal",
    category: "access_log",
    title: "Door Access Log",
    text: "[{time}] ACCESS: badge={engineer_badge} door={door} result=GRANTED",
    source: "system",
  },
  {
    id: "access_denied",
    category: "access_log",
    title: "Access Denied",
    text: "[{time}] ACCESS DENIED: badge={security_badge} door=DATA-CORE-01 result=INSUFFICIENT_CLEARANCE. Override requested.",
    source: "system",
  },
  {
    id: "access_anomaly",
    category: "access_log",
    title: "Access Anomaly",
    text: "[{time}] ACCESS: badge=UNKNOWN door={door} result=GRANTED. Badge ID not in manifest. {security_last} flagged for review.",
    source: "system",
  },
  {
    id: "access_late",
    category: "security",
    title: "Night Shift Access Log",
    text: "{security}: Late-night access to {room} logged at {time}. Only {engineer_last} had a reason to be there. But the badge scan shows a different ID.",
    source: "{security_last}",
  },

  // ── Emergency / collapse ──────────────────────────────────────
  {
    id: "emergency_cascade",
    category: "emergency",
    title: "CRITICAL: Cascade Event",
    text: "CRITICAL OVERHEAT — Relay P03 thermal runaway. Adjacent relays compromised. {engineer_last} attempting emergency coolant bypass. All personnel evacuate affected sections.",
    source: "system",
  },
  {
    id: "emergency_breach",
    category: "emergency",
    title: "HULL BREACH ALERT",
    text: "EMERGENCY: Hull integrity failure in {room}. Automated seals engaged. Pressure dropping in adjacent sections. {life_support_last} rerouting atmosphere.",
    source: "system",
  },
  {
    id: "emergency_lockdown",
    category: "emergency",
    title: "Station Lockdown",
    text: "{captain} has ordered full station lockdown. All personnel proceed to designated shelter areas. Do not attempt to access sealed sections.",
    source: "{captain_last}",
  },
  {
    id: "emergency_medical",
    category: "medical",
    title: "Medical Emergency",
    text: "{medic}: Treating {engineer_last} for burns. Second-degree on both forearms. Wouldn't stay still — kept saying the data mattered more.",
    source: "{medic_last}",
  },

  // ── Aftermath ─────────────────────────────────────────────────
  {
    id: "aftermath_shelter",
    category: "aftermath",
    title: "Cargo Hold — Shelter Log",
    text: "{medic}: All crew accounted for in cargo hold. Minor injuries treated. {engineer_last} still trying to reach the relay junction. {captain_last} ordered rest.",
    source: "{medic_last}",
  },
  {
    id: "aftermath_procedure",
    category: "aftermath",
    title: "Emergency Procedure Note",
    text: "If anyone finds this: {procedure_hint}. —{engineer_last}",
    source: "{engineer_last}",
  },
  {
    id: "aftermath_final",
    category: "aftermath",
    title: "Final Entry",
    text: "{engineer}: Made it back to {room}. Burns are bad but the data can still be saved. Someone has to reach the core. The procedure works — I tested it.",
    source: "{engineer_last}",
  },
  {
    id: "aftermath_beacon",
    category: "aftermath",
    title: "Distress Beacon Log",
    text: "AUTOMATED DISTRESS: Station CORVUS-7. Crew sheltered. Systems critical. Data core intact but unpowered. External assistance required.",
    source: "system",
  },
  {
    id: "aftermath_wait",
    category: "aftermath",
    title: "Shelter Note",
    text: "We're all here. {captain_last} is finally listening. {engineer_last} wrote the procedure on the terminal — the service bot might be the last chance. If you're reading this, follow the steps.",
    source: "anonymous",
  },

  // ── Cover-up evidence (CoolantCascade) ─────────────────────────
  {
    id: "coverup_official_report",
    category: "aftermath",
    title: "Incident Report — Filed",
    text: "INCIDENT REPORT — {captain}: Unforeseeable thermal cascade in relay section. Equipment age consistent with failure mode. No prior indicators. Maintenance status: current. Cause: material fatigue. Recommendation: scheduled relay replacement at next resupply.",
    source: "{captain_last}",
  },
  {
    id: "coverup_original_draft",
    category: "aftermath",
    title: "Incident Report — Original Draft [RECOVERED]",
    text: "INCIDENT REPORT DRAFT — {captain}: Thermal cascade in relay section. [DELETED: 'Three maintenance requests filed by {engineer_last} over three weeks. All deferred — resupply deadline took priority.'] [DELETED: '{engineer_last} transmitted concerns to UN-ORC directly. Reassignment order issued.'] Cause: [OVERWRITTEN: was 'deferred maintenance at junction V-4'] material fatigue.",
    source: "system",
  },

  // ── Technical / comms ─────────────────────────────────────────
  {
    id: "tech_signal",
    category: "comms",
    title: "Signal Analysis",
    text: "{comms}: Frequency 7.4GHz signal is structured — not random interference. I've run the analysis three times. {scientist_last} agrees but {captain_last} won't authorize dedicated comms time.",
    source: "{comms_last}",
  },
  {
    id: "tech_classified",
    category: "technical",
    title: "Classified — Signal Analysis Directive",
    text: "RESTRICTED: Signal analysis directive from UN-ORC central. Research priority classification upgraded. Do not discuss findings outside cleared personnel. —Command",
    source: "command",
  },
  {
    id: "tech_systems",
    category: "technical",
    title: "Systems Status",
    text: "Reactor: nominal. Life support: {life_support_last} reports 98% efficiency. Comms: primary array online. Data core: standby for transmission window.",
    source: "system",
  },
  {
    id: "tech_contamination",
    category: "technical",
    title: "Atmospheric Analysis",
    text: "{life_support}: Atmospheric scrubbers showing elevated particulate count in {room}. Could be dust from construction, could be something else. Running detailed analysis.",
    source: "{life_support_last}",
  },

  // ── Confrontation (sabotage archetype) ────────────────────────
  {
    id: "confront_evidence",
    category: "confrontation",
    title: "Security Investigation",
    text: "{security}: Badge access pattern doesn't match crew schedules. Someone is moving through the station outside their assigned areas. Compiling evidence for {captain_last}.",
    source: "{security_last}",
  },
  {
    id: "confront_accusation",
    category: "confrontation",
    title: "Incident Report",
    text: "{captain}: I confronted the crew about the unauthorized access. {security_last} presented the evidence. Denials all around. Someone is lying.",
    source: "{captain_last}",
  },
  {
    id: "confront_defense",
    category: "confrontation",
    title: "Response to Allegations",
    text: "I was in {room} because I heard something wrong with the ventilation. I reported it. Check the maintenance log. I'm not the one hiding things. —{engineer_last}",
    source: "{engineer_last}",
  },

  // ── Medical ───────────────────────────────────────────────────
  {
    id: "medical_supplies",
    category: "medical",
    title: "Medical Supply Log",
    text: "{medic}: Burn treatment supplies running low. Used 60% of dermal patches on {engineer_last}. Requesting priority resupply if comms are restored.",
    source: "{medic_last}",
  },
  {
    id: "medical_concern",
    category: "medical",
    title: "Medical Note",
    text: "{medic}: Strange atmospheric readings from {room}. Several crew reporting headaches. Running blood work. Could be nothing. Could be contamination.",
    source: "{medic_last}",
  },

  // ── Hull breach archetype ───────────────────────────────────────
  {
    id: "hull_inspection",
    category: "hull_breach",
    title: "Structural Inspection Report",
    text: "{engineer}: Hull plating in section {room} showing micro-fracture patterns consistent with long-term fatigue. Recommended immediate reinforcement. Priority: HIGH.",
    source: "{engineer_last}",
  },
  {
    id: "hull_pressure_monitor",
    category: "hull_breach",
    title: "Pressure Monitoring Log",
    text: "AUTOMATED: Pressure differential detected between {room} and {room2}. Delta: 4.7 kPa. {life_support_last} notified. Seal integrity at 87%.",
    source: "system",
  },
  {
    id: "hull_seal_status",
    category: "hull_breach",
    title: "Emergency Seal Status",
    text: "Bulkhead seal {door} test results: DEGRADED. Polymer gasket compression below specification. {engineer_last}: 'We need replacement seals. These won't hold if there's a real breach.'",
    source: "{engineer_last}",
  },
  {
    id: "hull_crew_accounting",
    category: "hull_breach",
    title: "Post-Breach Crew Accounting",
    text: "{security}: Head count after emergency seal activation. {room} sealed — crew status unknown. {medic_last} treating pressure injuries in cargo hold.",
    source: "{security_last}",
  },
  {
    id: "hull_personal",
    category: "hull_breach",
    title: "Personal Log — Before the Breach",
    text: "{engineer}: I can hear the hull flexing at night. Thermal cycling. {captain_last} says it's normal for stations this age. It's not. I've filed the report.",
    source: "{engineer_last}",
  },

  // ── Reactor scram archetype ─────────────────────────────────────
  {
    id: "reactor_containment",
    category: "reactor_scram",
    title: "Containment Field Reading",
    text: "Reactor containment field strength: 91.3% (threshold: 95%). Degradation rate: 0.4%/hour. {scientist_last} and {engineer_last} monitoring. Automatic SCRAM at 85%.",
    source: "system",
  },
  {
    id: "reactor_dosimetry",
    category: "reactor_scram",
    title: "Radiation Dosimetry Report",
    text: "{medic}: Crew dosimetry badges reviewed. {engineer_last} approaching quarterly limit — recommend reduced reactor-area shifts. {scientist_last} also elevated.",
    source: "{medic_last}",
  },
  {
    id: "reactor_restart",
    category: "reactor_scram",
    title: "Restart Procedure Notes",
    text: "{engineer}: Post-SCRAM restart checklist: 1) Verify containment above 95%. 2) Coolant circulation confirmed. 3) Command authorization from {captain_last}. Estimated restart: 6-8 hours.",
    source: "{engineer_last}",
  },
  {
    id: "reactor_research",
    category: "reactor_scram",
    title: "Research Impact Assessment",
    text: "{scientist}: Power loss means we lose the analysis window. Nine months of data collection — we can't afford another delay. {captain_last} promised the transmission deadline holds.",
    source: "{scientist_last}",
  },
  {
    id: "reactor_diagnostics",
    category: "reactor_scram",
    title: "Reactor Diagnostics Summary",
    text: "Pre-SCRAM diagnostics: neutron flux fluctuation at 3.2% (nominal <1%). Control rod response time degraded. {engineer_last} recommends full shutdown for inspection.",
    source: "system",
  },

  // ── Signal anomaly archetype ────────────────────────────────────
  {
    id: "signal_pattern",
    category: "signal_anomaly",
    title: "Signal Pattern Analysis",
    text: "{comms}: The 7.4GHz signal has a 47-second repeating structure. Not any known protocol. {scientist_last} thinks it's artificial. I think we should stop listening.",
    source: "{comms_last}",
  },
  {
    id: "signal_paranoia",
    category: "signal_anomaly",
    title: "Personal Log — Growing Unease",
    text: "{security}: Equipment glitches started three days after the signal appeared. Doors cycling, lights flickering. {comms_last} says it's coincidence. Nobody believes that.",
    source: "{security_last}",
  },
  {
    id: "signal_malfunction",
    category: "signal_anomaly",
    title: "Electronics Malfunction Report",
    text: "AUTOMATED: Multiple system anomalies detected. Nav computer: intermittent resets. Medical monitors: phantom readings. Environmental controls: {room} temperature spike unexplained.",
    source: "system",
  },
  {
    id: "signal_decoded",
    category: "signal_anomaly",
    title: "Signal Decoding Fragment",
    text: "{scientist}: Partial decode of the 7.4GHz signal. Binary header matches UN-ORC deep-space probe format, but the payload is... wrong. Like a reply to something we sent decades ago.",
    source: "{scientist_last}",
  },
  {
    id: "signal_jamming",
    category: "signal_anomaly",
    title: "Jamming Authorization Request",
    text: "{comms}: Requesting authorization to jam the anomalous signal. It's interfering with critical systems. {captain_last} says we need to keep recording — orders from above. This is going to end badly.",
    source: "{comms_last}",
  },

  // ── Breadcrumb logs (archetype-specific deduction keywords) ──────
  // Each archetype gets 3 templates containing 1-2 keywords from the correct
  // deduction_what answer. Players need 2-3 of these to assemble the full picture.

  // CoolantCascade: "coolant system failure", "thermal cascade", "relay network"
  {
    id: "breadcrumb_coolant_1",
    category: "maintenance",
    title: "Coolant Diagnostic Summary",
    text: "DIAGNOSTIC: Coolant system failure detected in loop B. Flow rate dropped to zero before junction P03 tripped. {engineer_last} flagged this weeks ago.",
    source: "system",
  },
  {
    id: "breadcrumb_coolant_2",
    category: "warning",
    title: "Thermal Cascade Propagation",
    text: "{engineer}: The thermal cascade has reached junctions P02 through P05. Each failed relay feeds heat to the next. This was preventable.",
    source: "{engineer_last}",
  },
  {
    id: "breadcrumb_coolant_3",
    category: "emergency",
    title: "Relay Network Status",
    text: "AUTOMATED: Relay network thermal tolerance exceeded across 4 junctions. Coolant loop B offline. Cascade propagation continues unchecked.",
    source: "system",
  },

  // HullBreach: "hull integrity", "depressurization", "multiple sections"
  {
    id: "breadcrumb_hull_1",
    category: "hull_breach",
    title: "Hull Integrity Assessment",
    text: "{engineer}: Hull integrity in section 4 has fallen below critical threshold. Micro-fracture propagation accelerating. We need emergency reinforcement NOW.",
    source: "{engineer_last}",
  },
  {
    id: "breadcrumb_hull_2",
    category: "hull_breach",
    title: "Depressurization Event Log",
    text: "EMERGENCY: Rapid depressurization detected. Atmospheric pressure dropping at 8 kPa/min. Emergency bulkheads deploying — some failing to seal.",
    source: "system",
  },
  {
    id: "breadcrumb_hull_3",
    category: "hull_breach",
    title: "Multi-Section Pressure Loss",
    text: "{life_support}: Pressure loss spreading to multiple sections. The breach wavefront is outpacing the bulkhead response. We're losing atmosphere in three zones simultaneously.",
    source: "{life_support_last}",
  },

  // ReactorScram: "emergency shutdown", "containment failure", "reactor"
  {
    id: "breadcrumb_reactor_1",
    category: "reactor_scram",
    title: "Emergency Shutdown Sequence",
    text: "AUTOMATED: Reactor emergency shutdown initiated. SCRAM sequence completed in 4.7 seconds. All control rods inserted. Core temperature dropping.",
    source: "system",
  },
  {
    id: "breadcrumb_reactor_2",
    category: "reactor_scram",
    title: "Containment Failure Analysis",
    text: "{scientist}: Containment failure was not gradual — the field dropped from 91% to 73% in under a minute. The reactor's own diagnostic triggered the response.",
    source: "{scientist_last}",
  },
  {
    id: "breadcrumb_reactor_3",
    category: "reactor_scram",
    title: "Reactor Status — Post-SCRAM",
    text: "{engineer}: Reactor core is stable at subcritical levels. The containment field degradation preceded the emergency shutdown. The core protected itself.",
    source: "{engineer_last}",
  },

  // Sabotage: "deliberately sabotaged", "systematic", "someone aboard"
  {
    id: "breadcrumb_sabotage_1",
    category: "confrontation",
    title: "Junction Damage Assessment",
    text: "{engineer}: These junctions weren't just damaged — they were deliberately sabotaged. The wiring was cut in a specific sequence to maximize disruption.",
    source: "{engineer_last}",
  },
  {
    id: "breadcrumb_sabotage_2",
    category: "confrontation",
    title: "Pattern Analysis",
    text: "{security}: The failures are systematic — each junction disabled in order, radiating from cargo bay 3. This isn't random. This is methodical.",
    source: "{security_last}",
  },
  {
    id: "breadcrumb_sabotage_3",
    category: "confrontation",
    title: "Internal Threat Assessment",
    text: "{security}: No external access points were breached. Whatever did this is someone — or something — aboard this station. The threat is inside.",
    source: "{security_last}",
  },

  // SignalAnomaly: "anomalous signal", "external signal", "system interference"
  {
    id: "breadcrumb_signal_1",
    category: "signal_anomaly",
    title: "Anomalous Signal Report",
    text: "{comms}: The anomalous signal on 7.4GHz has been active for 72 hours. Structured, repeating, definitely not natural background noise.",
    source: "{comms_last}",
  },
  {
    id: "breadcrumb_signal_2",
    category: "signal_anomaly",
    title: "External Signal Source Analysis",
    text: "{scientist}: Triangulation confirms the signal originates from an external source — beyond the station, beyond the local debris field. Something out there is transmitting.",
    source: "{scientist_last}",
  },
  {
    id: "breadcrumb_signal_3",
    category: "signal_anomaly",
    title: "System Interference Report",
    text: "AUTOMATED: System interference escalating across all subsystems. Navigation, medical, environmental — every networked system showing anomalous behavior correlated with the signal.",
    source: "system",
  },

  // Mutiny: "factions", "disabled life support", "contested sections"
  {
    id: "breadcrumb_mutiny_1",
    category: "aftermath",
    title: "Crew Division Report",
    text: "{medic}: The crew has split into factions. Research team on one side, security detail on the other. The barricades went up within an hour of the transmission.",
    source: "{medic_last}",
  },
  {
    id: "breadcrumb_mutiny_2",
    category: "aftermath",
    title: "Life Support Override Log",
    text: "ALERT: Life support disabled in research wing via security terminal override. Manual restart attempted from inside — blocked by remote lockout. Someone is using air as a weapon.",
    source: "system",
  },
  {
    id: "breadcrumb_mutiny_3",
    category: "aftermath",
    title: "Contested Sections Status",
    text: "{captain}: Three contested sections — research wing, bridge, and cargo hold. Neither faction controls all of them. Crew are trapped between barricades in the corridors.",
    source: "{captain_last}",
  },

  // ── Relationship-revealing logs ─────────────────────────────────
  {
    id: "rel_ally_support",
    category: "relationship",
    title: "Private Message",
    text: "{engineer}: {medic_last} covered for me at the staff meeting again. Told {captain_last} the maintenance backlog was a shared problem, not just mine. I owe them.",
    source: "{engineer_last}",
  },
  {
    id: "rel_rivalry",
    category: "relationship",
    title: "Crew Friction Log",
    text: "{security}: {scientist_last} and {engineer_last} had another argument in the mess hall about priorities. {scientist_last} says research comes first. {engineer_last} says the station falls apart without maintenance. {captain_last} stayed silent.",
    source: "{security_last}",
  },
  {
    id: "rel_romantic",
    category: "relationship",
    title: "Personal Message Fragment",
    text: "...after this rotation, let's put in for the same assignment. Somewhere quieter. I know we said we'd keep things professional but I don't want to do another nine months apart. — unsigned",
    source: "anonymous",
  },
  {
    id: "rel_blackmail",
    category: "relationship",
    title: "Encrypted Note Fragment",
    text: "I know what you did with the supply manifests. The numbers don't add up and I have the original logs. We can discuss this privately, or I can discuss it with {captain_last}. Your choice.",
    source: "anonymous",
  },
  {
    id: "rel_conflict",
    category: "relationship",
    title: "Crew Morale Assessment",
    text: "{captain}: Crew tensions elevated. The isolation is getting to everyone. {medic_last} reports increased sick bay visits — mostly stress. I need to address the {engineer_last}/{scientist_last} situation before it affects operations.",
    source: "{captain_last}",
  },
  // ── Predictive / foreshadowing ("manuscript page" style) ──────
  {
    id: "predict_sounds",
    category: "foreshadowing",
    title: "Personal Audio Log",
    text: "Something's wrong in {room}. I keep hearing sounds through the bulkhead — rhythmic, metallic. Like someone tapping from the other side. I asked {engineer_last} but they won't go near it. Nobody will.",
    source: "{security_last}",
  },
  {
    id: "predict_locked",
    category: "foreshadowing",
    title: "Access Denied — Note",
    text: "They've sealed {room}. Official reason: 'scheduled maintenance.' But I saw {scientist_last} coming out of there at 0300, and the maintenance logs show nothing scheduled. What are they hiding?",
    source: "{comms_last}",
  },
  {
    id: "predict_readings",
    category: "foreshadowing",
    title: "Anomalous Sensor Data",
    text: "Automated telemetry from {room} is off the charts. Thermal fluctuations, pressure instability, and something the sensors can't identify. {engineer_last} says it's probably a calibration error. I don't think so.",
    source: "{scientist_last}",
  },
  {
    id: "predict_last_seen",
    category: "foreshadowing",
    title: "Crew Location Update",
    text: "Last confirmed sighting of {medic} was heading toward {room}. That was {weeks} ago. I've pinged their comm badge six times. No response. {captain_last} says not to worry.",
    source: "{security_last}",
  },
  {
    id: "predict_warning",
    category: "foreshadowing",
    title: "Handwritten Note",
    text: "DO NOT enter {room} under any circumstances. I don't care what {captain_last} says. I've seen what's in there and it's not safe. If you're reading this, turn around. — {engineer}",
    source: "{engineer_last}",
  },
  {
    id: "predict_evidence",
    category: "foreshadowing",
    title: "Investigation Notes",
    text: "There's evidence in {room} that contradicts the official report. {scientist_last} knows. Check the secondary console — the logs haven't been wiped from the local backup. Someone was sloppy.",
    source: "{security_last}",
  },
  {
    id: "predict_contamination",
    category: "foreshadowing",
    title: "Environmental Alert — Filed",
    text: "{room}: atmospheric readings show contamination levels rising. Recommend sealing the section until decon team can assess. Filed three requests with {captain_last}. All denied. Logging for the record.",
    source: "{life_support_last}",
  },
  {
    id: "predict_secret",
    category: "foreshadowing",
    title: "Encrypted Personal Log",
    text: "If anything happens to me, check {room}. I left everything there — the recordings, the manifests, all of it. {comms_last} helped me set up a dead drop. The truth has to come out.",
    source: "{scientist_last}",
  },
];

/**
 * Get templates matching a set of categories.
 */
export function getTemplatesByCategories(categories: string[]): LogTemplate[] {
  return LOG_TEMPLATES.filter(t => categories.includes(t.category));
}
