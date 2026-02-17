/**
 * Console definitions for landmark rooms.
 * Each landmark room gets 2-3 interactable console scenery props
 * with flavor text and optional journal entries.
 */

export interface ConsoleDefinition {
  id: string;           // e.g. "bridge_nav_console"
  name: string;         // "Navigation Console"
  text: string;         // Flavor text shown on interact
  journal?: {           // Optional journal entry
    summary: string;
    detail: string;
    category: "log" | "item" | "trace";
  };
}

export const LANDMARK_CONSOLES: Record<string, ConsoleDefinition[]> = {
  "Bridge": [
    {
      id: "bridge_captain_log",
      name: "Captain's Chair Log",
      text: "The captain's personal log terminal. Last entry timestamped 14:58 — five minutes before the cascade. 'Vasquez is overreacting. The coolant loop variance is within spec. I've seen worse on Kepler-9.'",
      journal: {
        summary: "Captain's log: dismissed coolant warning at 14:58",
        detail: "Captain's personal log terminal. Last entry timestamped 14:58 — five minutes before the cascade. 'Vasquez is overreacting. The coolant loop variance is within spec. I've seen worse on Kepler-9.'",
        category: "log",
      },
    },
    {
      id: "bridge_nav_console",
      name: "Navigation Console",
      text: "Station trajectory display. CORVUS-7 orbits at 340km altitude, stable. Automated correction burns nominal. The station doesn't know anything is wrong.",
    },
    {
      id: "bridge_viewscreen",
      name: "Viewscreen",
      text: "The main viewscreen shows the planet below — cloud bands swirling over dark continents. The station's solar arrays track silently. From here, everything looks fine.",
    },
  ],

  "Engine Core": [
    {
      id: "engine_reactor_display",
      name: "Reactor Status Display",
      text: "Reactor output holding at 67% capacity. Three of eight fuel rod assemblies show amber warnings. The automated load balancer has been compensating, but the trend line slopes down.",
      journal: {
        summary: "Reactor at 67% — fuel rod degradation accelerating",
        detail: "Reactor output holding at 67% capacity. Three of eight fuel rod assemblies show amber warnings. The automated load balancer has been compensating, but the trend line slopes down.",
        category: "trace",
      },
    },
    {
      id: "engine_coolant_monitor",
      name: "Coolant Monitor",
      text: "Coolant loop temperatures displayed in real-time. Loop B reads 12 degrees above nominal — the same loop Vasquez flagged in her maintenance report. The warning was dismissed.",
    },
  ],

  "Observation Deck": [
    {
      id: "obs_viewport",
      name: "Viewport",
      text: "The observation viewport frames an unbroken view of deep space. Stars drift imperceptibly. The station rotates once every 94 minutes. Out here, human problems seem very small.",
    },
  ],

  "Crew Quarters": [
    {
      id: "quarters_locker",
      name: "Personal Locker",
      text: "A crew locker, door ajar. Inside: a pressed uniform, a photograph of two children, and a worn paperback with a bookmark at page 203. Someone expected to finish it.",
      journal: {
        summary: "Crew locker: family photo, personal effects left behind",
        detail: "A crew locker, door ajar. Inside: a pressed uniform, a photograph of two children, and a worn paperback with a bookmark at page 203. Someone expected to finish it.",
        category: "item",
      },
    },
    {
      id: "quarters_duty_roster",
      name: "Duty Roster Board",
      text: "The duty roster for the week of the incident. Several shifts have been swapped — handwritten annotations show growing tension over overtime assignments. Someone circled 'MANDATORY DOUBLE' in red.",
    },
  ],

  "Armory": [
    {
      id: "armory_manifest",
      name: "Equipment Manifest",
      text: "Station security equipment inventory. Most items accounted for. One entry highlighted: 'Emergency sealant charges — 4 of 6 remaining. Auth: Security Chief.' Two charges were used before the cascade.",
      journal: {
        summary: "Armory: 2 sealant charges used pre-incident",
        detail: "Station security equipment inventory. Two emergency sealant charges used before the cascade event. Authorization logged to the Security Chief. Purpose not recorded.",
        category: "trace",
      },
    },
    {
      id: "armory_security_log",
      name: "Security Log Terminal",
      text: "Security access log. Unusual entry at 02:17 — someone accessed the restricted equipment locker using an override code. The badge reader malfunctioned, no ID recorded.",
      journal: {
        summary: "Security log: unauthorized access at 02:17, no ID",
        detail: "Security access log shows unauthorized entry at 02:17 using an override code. Badge reader malfunction prevented ID capture. Equipment accessed: unknown.",
        category: "log",
      },
    },
  ],

  "Med Bay": [
    {
      id: "medbay_autodoc",
      name: "Autodoc Display",
      text: "The autodoc treatment log shows three patients treated in the final hour. Burns consistent with thermal exposure. The last patient left against medical advice at 15:08.",
    },
  ],

  "Research Lab": [
    {
      id: "lab_sample_display",
      name: "Sample Analysis Console",
      text: "Environmental sample analysis results. The last batch showed elevated particulate levels in corridor air samples — logged 6 hours before the cascade. The anomaly was flagged but not escalated.",
      journal: {
        summary: "Lab: elevated particulates detected 6hrs pre-incident",
        detail: "Environmental sample analysis showing elevated particulate levels in corridor air samples, logged 6 hours before the cascade. Flagged in the system but never escalated to command.",
        category: "trace",
      },
    },
  ],

  "Communications Hub": [
    {
      id: "comms_uplink_status",
      name: "Uplink Status Console",
      text: "Primary uplink: OFFLINE. Backup low-band beacon: ACTIVE (4-second pulse). Last successful transmission: 9 months, 3 days ago. Message queue: 847 unsent items.",
    },
  ],

  "Data Core": [
    {
      id: "datacore_archive_status",
      name: "Archive Status Display",
      text: "Data integrity check: 99.7% of research archive intact. Automated backup systems preserved nine months of work. The transmission buffer is loaded and ready.",
    },
  ],

  "Life Support": [
    {
      id: "lifesupport_atmo_display",
      name: "Atmospheric Control Display",
      text: "Atmosphere composition readout. O2 at 19.8% (nominal), CO2 slightly elevated. Air recyclers running at reduced capacity. Estimated breathable atmosphere remaining: 72 hours at current consumption.",
    },
  ],
};
