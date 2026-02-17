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
];

/**
 * Get templates matching a set of categories.
 */
export function getTemplatesByCategories(categories: string[]): LogTemplate[] {
  return LOG_TEMPLATES.filter(t => categories.includes(t.category));
}
