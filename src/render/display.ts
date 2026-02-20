import * as ROT from "rot-js";
import type { GameState, Entity, Room } from "../shared/types.js";
import { TileType, EntityType, AttachmentSlot, SensorType, ObjectivePhase, IncidentArchetype } from "../shared/types.js";
import { GLYPHS, DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, VIEWPORT_WIDTH, VIEWPORT_HEIGHT, HEAT_PAIN_THRESHOLD, MAX_TURNS, TURN_WARNING_THRESHOLD } from "../shared/constants.js";
import { getObjective as getObjectiveShared, getRoomExits as getRoomExitsShared, getDiscoveries, entityDisplayName, isEntityExhausted } from "../shared/ui.js";
import { getUnlockedDeductions } from "../sim/deduction.js";
import { getRunHistory } from "../sim/saveLoad.js";
import type { IGameDisplay } from "./displayInterface.js";

// ── Archetype display names for game-over screen ────────────────
const ARCHETYPE_DISPLAY_NAMES: Record<IncidentArchetype, string> = {
  [IncidentArchetype.CoolantCascade]: "THE WHISTLEBLOWER",
  [IncidentArchetype.HullBreach]: "THE MURDER",
  [IncidentArchetype.ReactorScram]: "THE ROGUE AI",
  [IncidentArchetype.Sabotage]: "THE STOWAWAY",
  [IncidentArchetype.SignalAnomaly]: "FIRST CONTACT",
};

// ── Log entry types for color-coding ────────────────────────────
export type LogType = "system" | "narrative" | "warning" | "critical" | "milestone" | "sensor";

export interface DisplayLogEntry {
  text: string;
  type: LogType;
}

// ── Color scheme ────────────────────────────────────────────────
const COLORS = {
  // Tiles
  wall: "#556",
  wallLight: "#667",
  wallDark: "#445",
  floor: "#333",
  door: "#a52",
  lockedDoor: "#f00",
  corridor: "#2a2a2a",

  // Player
  player: "#0f0",

  // Entities
  relay: "#ff0",
  sensorPickup: "#0ff",
  dataCore: "#f0f",
  serviceBot: "#fa0",
  logTerminal: "#6cf",
  crewItem: "#ca8",

  // Thermal gradient endpoints
  thermalCool: [0x44, 0x44, 0xff] as [number, number, number],
  thermalHot: [0xff, 0x22, 0x00] as [number, number, number],

  // Smoke
  smoke: "#999",
  smokeBg: "#222",

  // Background
  background: "#0c0c0c",
} as const;

// ── Room color tints for walls ────────────────────────────────────
const ROOM_WALL_TINTS: Record<string, string> = {
  // Command zone — blue-grey tint
  "Bridge": "#505868",
  "Communications Hub": "#505866",
  "Signal Room": "#505060",
  // Engineering zone — warm amber/brown
  "Engine Core": "#665540",
  "Power Relay Junction": "#665540",
  "Auxiliary Power": "#605838",
  "Engineering Storage": "#665850",
  // Habitation zone — warmer, lived-in
  "Crew Quarters": "#605855",
  "Cargo Hold": "#585550",
  "Med Bay": "#605060",
  "Emergency Shelter": "#585858",
  // Research zone — cool green tint
  "Research Lab": "#506650",
  "Data Core": "#604868",
  "Robotics Bay": "#585858",
  "Server Annex": "#505860",
  // Infrastructure zone — neutral grey
  "Life Support": "#506066",
  "Arrival Bay": "#555858",
  "Observation Deck": "#484858",
  "Escape Pod Bay": "#505855",
  "Maintenance Corridor": "#555555",
  "Armory": "#585050",
};

// ── Box-drawing wall characters ──────────────────────────────────
// Bitfield: N=1, S=2, E=4, W=8 (which neighbors are also walls)
// Using heavy box-drawing characters (━/┃/┏/etc.) for better horizontal
// connectivity in square-ratio cells where thin ─ leaves gaps.
const WALL_GLYPHS: Record<number, string> = {
  0b0000: "■",    // isolated
  0b0001: "┃",    // N
  0b0010: "┃",    // S
  0b0011: "┃",    // N+S
  0b0100: "━",    // E
  0b1000: "━",    // W
  0b1100: "━",    // E+W
  0b0101: "┗",    // N+E
  0b1001: "┛",    // N+W
  0b0110: "┏",    // S+E
  0b1010: "┓",    // S+W
  0b0111: "┣",    // N+S+E
  0b1011: "┫",    // N+S+W
  0b1101: "┻",    // N+E+W
  0b1110: "┳",    // S+E+W
  0b1111: "╋",    // all four
};

// ── Floor glyph variation ────────────────────────────────────────
const FLOOR_GLYPHS = ["·", "·", "·", "∙", " ", "·", ".", "·"];
const CORRIDOR_GLYPHS = ["·", "∙", ".", " ", "·", "·"];

function floorGlyph(x: number, y: number, isCorridor: boolean): string {
  const hash = ((x * 7) + (y * 13) + (x ^ y)) & 0xff;
  if (isCorridor) return CORRIDOR_GLYPHS[hash % CORRIDOR_GLYPHS.length];
  return FLOOR_GLYPHS[hash % FLOOR_GLYPHS.length];
}

// ── Log type CSS classes ─────────────────────────────────────────
const LOG_TYPE_CLASSES: Record<LogType, string> = {
  system: "log log-system",
  narrative: "log log-narrative",
  warning: "log log-warning",
  critical: "log log-critical",
  milestone: "log log-milestone",
  sensor: "log log-sensor",
};

const ENTITY_COLORS: Record<string, string> = {
  [EntityType.Relay]: "#ffcc00",
  [EntityType.SensorPickup]: "#00ffee",
  [EntityType.DataCore]: "#ff44ff",
  [EntityType.ServiceBot]: "#ffaa00",
  [EntityType.LogTerminal]: "#66ccff",
  [EntityType.CrewItem]: "#ccaa88",
  [EntityType.Drone]: "#88bb88",
  [EntityType.MedKit]: "#ff6666",
  [EntityType.RepairBot]: "#ffaa66",
  [EntityType.Breach]: "#ff4444",
  [EntityType.ClosedDoor]: "#aa8866",
  [EntityType.SecurityTerminal]: "#44aaff",
  [EntityType.PatrolDrone]: "#ff2222",
  [EntityType.PressureValve]: "#44bbaa",
  [EntityType.FuseBox]: "#dd8800",
  [EntityType.PowerCell]: "#ffdd44",
  [EntityType.EscapePod]: "#44ffaa",
  [EntityType.CrewNPC]: "#ffee66",
  [EntityType.RepairCradle]: "#44ddff",
  [EntityType.Console]: "#66aacc",
  [EntityType.Airlock]: "#0ff",
  [EntityType.ToolPickup]: "#ffaa44",
};

// Blue background glow for interactable (non-exhausted) entities
const INTERACTABLE_BG = "#0a1a2a";

// Static entity types that should appear as dim memory on explored-but-not-visible tiles
const STATIC_ENTITY_TYPES = new Set<string>([
  EntityType.Relay, EntityType.SensorPickup, EntityType.DataCore,
  EntityType.LogTerminal, EntityType.CrewItem, EntityType.MedKit,
  EntityType.Breach, EntityType.ClosedDoor, EntityType.SecurityTerminal,
  EntityType.PressureValve, EntityType.FuseBox, EntityType.PowerCell,
  EntityType.EscapePod, EntityType.RepairCradle, EntityType.Airlock,
  EntityType.EvidenceTrace, EntityType.Console, EntityType.ToolPickup,
]);

// Entity background glow colors (subtle tint behind entities)
const ENTITY_BG_GLOW: Record<string, string> = {
  [EntityType.Relay]: "#1a1500",
  [EntityType.SensorPickup]: "#001a18",
  [EntityType.DataCore]: "#1a001a",
  [EntityType.ServiceBot]: "#1a1000",
  [EntityType.LogTerminal]: "#0a1520",
  [EntityType.MedKit]: "#1a0808",
  [EntityType.Breach]: "#200000",
  [EntityType.SecurityTerminal]: "#081520",
  [EntityType.PatrolDrone]: "#200808",
  [EntityType.PressureValve]: "#081a18",
  [EntityType.FuseBox]: "#1a1000",
  [EntityType.PowerCell]: "#1a1800",
  [EntityType.EscapePod]: "#081a10",
  [EntityType.CrewNPC]: "#1a1800",
  [EntityType.RepairCradle]: "#081820",
  [EntityType.Console]: "#0a1520",
  [EntityType.Airlock]: "#001a1a",
  [EntityType.ToolPickup]: "#1a1200",
};

const ENTITY_GLYPHS: Record<string, string> = {
  [EntityType.Relay]: "\u26a1",       // ⚡
  [EntityType.SensorPickup]: "\ud83d\udce1", // 📡
  [EntityType.DataCore]: "\ud83d\udc8e",     // 💎
  [EntityType.ServiceBot]: "\ud83d\udd0b",   // 🔋
  [EntityType.LogTerminal]: "\ud83d\udcbb",  // 💻
  [EntityType.CrewItem]: "\ud83d\uddc3\ufe0f", // 🗃️
  [EntityType.Drone]: "\ud83d\udd35",        // 🔵
  [EntityType.MedKit]: "\ud83d\udc8a",       // 💊
  [EntityType.RepairBot]: "\ud83d\udd27",    // 🔧
  [EntityType.Breach]: "\ud83d\udca8",       // 💨
  [EntityType.ClosedDoor]: "\ud83d\udeaa",   // 🚪
  [EntityType.SecurityTerminal]: "\ud83d\udcf7", // 📷
  [EntityType.PatrolDrone]: "\ud83d\udef8",     // 🛸
  [EntityType.PressureValve]: "\u2699\ufe0f", // ⚙️
  [EntityType.FuseBox]: "\ud83d\udd0c",       // 🔌
  [EntityType.PowerCell]: "\ud83d\udd0b",     // 🔋 (reuse battery glyph)
  [EntityType.EscapePod]: "\ud83d\ude80",     // 🚀
  [EntityType.CrewNPC]: "\ud83d\ude4b",       // 🙋
  [EntityType.RepairCradle]: "\u2695\ufe0f",  // ⚕️
  [EntityType.EvidenceTrace]: "\ud83d\udc63",  // 👣
  [EntityType.Console]: "\ud83d\udcbb",  // 💻 (terminal)
  [EntityType.ToolPickup]: "\ud83d\udd27",  // 🔧
  [EntityType.Airlock]: "\u229f",        // ⊟
};

// ── Thermal color interpolation ─────────────────────────────────
function heatToFgColor(heat: number): string {
  const t = Math.max(0, Math.min(1, heat / 100));
  const r = Math.round(COLORS.thermalCool[0] + t * (COLORS.thermalHot[0] - COLORS.thermalCool[0]));
  const g = Math.round(COLORS.thermalCool[1] + t * (COLORS.thermalHot[1] - COLORS.thermalCool[1]));
  const b = Math.round(COLORS.thermalCool[2] + t * (COLORS.thermalHot[2] - COLORS.thermalCool[2]));
  return `rgb(${r},${g},${b})`;
}

function heatToBgColor(heat: number): string {
  if (heat <= 0) return "#001020";
  const t = Math.max(0, Math.min(1, heat / 100));
  const r = Math.round(t * 80);
  const g = Math.round((1 - t) * 10);
  const b = Math.round((1 - t) * 50);
  return `rgb(${r},${g},${b})`;
}

// Entity names for interaction hints — delegate to shared module

// ── Smoke color interpolation ───────────────────────────────────
function smokeToFgColor(smoke: number): string {
  // Interpolate grey intensity: denser smoke = lighter grey glyph
  const t = Math.max(0, Math.min(1, smoke / 100));
  const v = Math.round(80 + t * 100); // 80..180
  return `rgb(${v},${v},${v})`;
}

function smokeToBgColor(smoke: number): string {
  const t = Math.max(0, Math.min(1, smoke / 100));
  const v = Math.round(0x11 + t * 40); // subtle darkening
  return `rgb(${v},${v},${v})`;
}

// ── Responsive font size calculation ────────────────────────────
const SIDEBAR_WIDTH_PX = 420; // reserve space for the sidebar panel (left side)

function computeFontSize(cellsW: number, cellsH: number): number {
  const availW = window.innerWidth - SIDEBAR_WIDTH_PX;
  const availH = window.innerHeight;

  const maxByWidth = Math.floor(availW / cellsW);
  const maxByHeight = Math.floor(availH / cellsH);
  const fontSize = Math.max(10, Math.min(maxByWidth, maxByHeight));
  return fontSize;
}

// ── ROT.js Display renderer ─────────────────────────────────────
export class BrowserDisplay implements IGameDisplay {
  private display: ROT.Display;
  private container: HTMLElement;
  private sensorMode: SensorType | null = null;
  private logHistory: DisplayLogEntry[] = [];
  private static readonly MAX_LOG_ENTRIES = 24;
  private roomFlashMessage = "";
  private roomFlashTimer: ReturnType<typeof setTimeout> | null = null;
  private lastRoomId = "";
  private mapWidth: number;
  private mapHeight: number;

  // Movement animation: track previous player position
  private prevPlayerPos: { x: number; y: number } | null = null;
  private showTrail = false;

  // Flash tile mechanism for interaction feedback
  private flashTiles: Set<string> = new Set();

  // Stored handler for cleanup
  private resizeHandler: () => void;

  constructor(container: HTMLElement, mapWidth?: number, mapHeight?: number) {
    this.container = container;
    this.mapWidth = mapWidth ?? DEFAULT_MAP_WIDTH;
    this.mapHeight = mapHeight ?? DEFAULT_MAP_HEIGHT;
    const vw = Math.min(VIEWPORT_WIDTH, this.mapWidth);
    const vh = Math.min(VIEWPORT_HEIGHT, this.mapHeight);
    const fontSize = computeFontSize(vw, vh);
    this.display = new ROT.Display({
      width: vw,
      height: vh,
      fontSize,
      fontFamily: "monospace",
      bg: COLORS.background,
      forceSquareRatio: true,
    });

    const canvas = this.display.getContainer();
    if (canvas) {
      container.appendChild(canvas);
    }

    // Listen for window resize to rescale
    this.resizeHandler = () => this.handleResize();
    window.addEventListener("resize", this.resizeHandler);
  }

  get isThermalActive(): boolean {
    return this.sensorMode === SensorType.Thermal;
  }

  get isCleanlinessActive(): boolean {
    return this.sensorMode === SensorType.Cleanliness;
  }

  get activeSensorMode(): SensorType | null {
    return this.sensorMode;
  }

  toggleThermal(): void {
    this.sensorMode = this.sensorMode === SensorType.Thermal ? null : SensorType.Thermal;
  }

  toggleSensor(type: SensorType): void {
    this.sensorMode = this.sensorMode === type ? null : type;
  }

  addLog(msg: string, type: LogType = "system"): void {
    this.logHistory.push({ text: msg, type });
    if (this.logHistory.length > BrowserDisplay.MAX_LOG_ENTRIES) {
      this.logHistory.shift();
    }
  }

  getLogHistory(): DisplayLogEntry[] {
    return this.logHistory;
  }

  triggerScreenFlash(type: "damage" | "milestone" | "stun"): void {
    const flash = document.getElementById("damage-flash");
    if (!flash) return;
    flash.className = `active ${type}`;
    setTimeout(() => { flash.className = ""; }, 200);
  }

  showGameOverOverlay(state: GameState): void {
    const overlay = document.getElementById("gameover-overlay");
    if (!overlay) return;

    const isVictory = state.victory;
    const logsFound = state.logs.filter(l => l.source !== "system" && l.source !== "sensor").length;
    const totalTerminals = Array.from(state.entities.values()).filter(e => e.type === EntityType.LogTerminal).length;
    const terminalsRead = Array.from(state.entities.values()).filter(e =>
      e.type === EntityType.LogTerminal && state.logs.some(l => l.id === `log_terminal_${e.id}`)
    ).length;
    let relaysActivated = 0;
    let totalRelays = 0;
    for (const [, e] of state.entities) {
      if (e.type === EntityType.Relay && e.props["locked"] !== true) {
        totalRelays++;
        if (e.props["activated"] === true) relaysActivated++;
      }
    }
    const breachesSealed = Array.from(state.entities.values()).filter(e =>
      e.type === EntityType.Breach && e.props["sealed"] === true
    ).length;
    const totalBreaches = Array.from(state.entities.values()).filter(e => e.type === EntityType.Breach).length;
    const hpPercent = Math.round((state.player.hp / state.player.maxHp) * 100);
    const hpClass = hpPercent > 60 ? "good" : hpPercent > 30 ? "warn" : "bad";

    const isTimeOut = !isVictory && state.turn >= (state.maxTurns ?? MAX_TURNS);
    const crewWereEvacuated = (state.mystery?.evacuation?.crewEvacuated.length || 0) > 0;
    const title = isVictory
      ? (crewWereEvacuated ? "CREW EVACUATED" : "TRANSMISSION COMPLETE")
      : isTimeOut ? "ORBIT DECAYED" : "CONNECTION LOST";
    const titleClass = isVictory ? "victory" : "defeat";
    const subtitle = isVictory
      ? (crewWereEvacuated
          ? "All survivors accounted for. The mystery of CORVUS-7 is solved."
          : "The crew is gone, but their research survives.<br>Nine months of work, transmitted through the relay.")
      : isTimeOut
        ? "Station orbit has decayed below recovery threshold.<br>Terminal link severed. CORVUS-7 falls silent."
        : "Rover A3 signal lost. The station drifts on, silent.";

    // Crew evacuation stats
    const evac = state.mystery?.evacuation;
    const crewEvacuated = evac?.crewEvacuated.length || 0;
    const crewDead = evac?.crewDead.length || 0;
    let totalCrewNPCs = 0;
    for (const [, e] of state.entities) {
      if (e.type === EntityType.CrewNPC) totalCrewNPCs++;
    }
    const crewStatHtml = totalCrewNPCs > 0 || crewEvacuated > 0 || crewDead > 0
      ? `<div class="gameover-stat"><span class="stat-label">Crew Evacuated:</span> <span class="stat-value ${crewEvacuated > 0 && crewDead === 0 ? 'good' : crewEvacuated > 0 ? 'warn' : 'bad'}">${crewEvacuated}/${crewEvacuated + crewDead + totalCrewNPCs}</span></div>`
      : "";

    // Deduction and evidence stats
    const deductions = state.mystery?.deductions ?? [];
    const deductionsSolved = deductions.filter(d => d.solved).length;
    const deductionsCorrect = deductions.filter(d => d.answeredCorrectly).length;
    const evidenceCount = state.mystery?.journal.length ?? 0;
    const roomsExplored = state.rooms.filter(r => {
      for (let ry = r.y; ry < r.y + r.height; ry++) {
        for (let rx = r.x; rx < r.x + r.width; rx++) {
          if (ry >= 0 && ry < state.height && rx >= 0 && rx < state.width) {
            if (state.tiles[ry][rx].explored) return true;
          }
        }
      }
      return false;
    }).length;

    // Performance rating based on composite score
    let score = 0;
    if (isVictory) score += 30;
    score += Math.min(20, deductionsCorrect * (20 / Math.max(deductions.length, 1)));
    // Crew evacuation bonus (up to 20 pts — biggest single factor after victory)
    const totalCrewForScore = crewEvacuated + crewDead + totalCrewNPCs;
    if (totalCrewForScore > 0) {
      score += Math.min(20, (crewEvacuated / totalCrewForScore) * 20);
    }
    score += Math.min(10, (roomsExplored / Math.max(state.rooms.length, 1)) * 10);
    score += Math.min(10, (hpPercent / 100) * 10);
    score += Math.min(10, isVictory && state.turn < 200 ? 10 : isVictory && state.turn < 350 ? 5 : 0);
    const rating = score >= 90 ? "S" : score >= 75 ? "A" : score >= 55 ? "B" : score >= 35 ? "C" : "D";
    const ratingColor = rating === "S" ? "#ff0" : rating === "A" ? "#0f0" : rating === "B" ? "#6cf" : rating === "C" ? "#fa0" : "#f44";

    // Mystery choices summary
    const choices = state.mystery?.choices ?? [];
    const choicesMade = choices.filter(c => c.chosen).length;
    let choicesHtml = "";
    if (choicesMade > 0) {
      const choiceLines = choices
        .filter(c => c.chosen)
        .map(c => {
          const opt = c.options.find(o => o.key === c.chosen);
          return opt ? opt.label : c.chosen;
        });
      choicesHtml = `<div class="gameover-stat"><span class="stat-label">Decisions Made:</span> <span class="stat-value">${choicesMade}/${choices.length}</span></div>`;
    }

    const epilogue = isVictory
      ? (crewEvacuated > 0 && crewDead === 0 && totalCrewNPCs === 0
        ? "Recovery teams en route. Every soul accounted for."
        : "Recovery teams en route. The record is preserved.")
      : "Another rover may reach the station. The data endures, waiting.";

    // ── Deduction retrospective ──
    let retrospectiveHtml = "";
    if (deductions.length > 0) {
      const retLines = deductions.map(d => {
        const correctOpt = d.options.find(o => o.correct);
        const correctLabel = correctOpt ? this.escapeHtml(correctOpt.label) : "???";
        if (!d.solved) {
          return `<div style="margin:3px 0;font-size:11px;font-family:monospace">` +
            `<span style="color:#888">\u25cb ${this.escapeHtml(d.question)}</span><br>` +
            `<span style="color:#555;margin-left:16px">Unanswered</span> ` +
            `<span style="color:#4af;margin-left:8px">\u2192 ${correctLabel}</span></div>`;
        }
        const icon = d.answeredCorrectly ? "\u2713" : "\u2717";
        const color = d.answeredCorrectly ? "#0f0" : "#f44";
        const statusText = d.answeredCorrectly
          ? `<span style="color:#0f0;margin-left:16px">${correctLabel}</span>`
          : `<span style="color:#f44;margin-left:16px">Incorrect</span> <span style="color:#4af;margin-left:8px">\u2192 ${correctLabel}</span>`;
        return `<div style="margin:3px 0;font-size:11px;font-family:monospace">` +
          `<span style="color:${color}">${icon}</span> <span style="color:#aaa">${this.escapeHtml(d.question)}</span><br>` +
          `${statusText}</div>`;
      });
      retrospectiveHtml = `
        <div style="margin:10px 0 4px;border-top:1px solid #333;padding-top:8px">
          <div style="color:#8ac;font-size:12px;font-weight:bold;text-align:center;margin-bottom:6px;letter-spacing:2px">
            \u25b8 DEDUCTION RETROSPECTIVE \u25c2
          </div>
          ${retLines.join("")}
        </div>`;
    }

    // ── Timeline reconstruction (victory only, if mystery data available) ──
    let timelineHtml = "";
    if (isVictory && state.mystery?.timeline) {
      const events = state.mystery.timeline.events;
      const crew = state.mystery.crew;
      const getCrewName = (id: string) => {
        const m = crew.find(c => c.id === id);
        return m ? m.lastName : id;
      };
      const phaseLabels: Record<string, string> = {
        normal_ops: "NORMAL OPS",
        trigger: "TRIGGER",
        escalation: "ESCALATION",
        collapse: "COLLAPSE",
        aftermath: "AFTERMATH",
      };
      const phaseColors: Record<string, string> = {
        normal_ops: "#6a8",
        trigger: "#ca8",
        escalation: "#fa0",
        collapse: "#f44",
        aftermath: "#88c",
      };
      const eventLines = events.map(e => {
        const phase = phaseLabels[e.phase] || e.phase.toUpperCase();
        const color = phaseColors[e.phase] || "#aaa";
        const actor = getCrewName(e.actorId);
        return `<div style="margin:2px 0;font-size:11px;font-family:monospace;color:#bbb">` +
          `<span style="color:${color};font-weight:bold;display:inline-block;width:80px">[${phase}]</span> ` +
          `<span style="color:#888">${e.timestamp}</span> ` +
          `<span style="color:#aac">${actor}</span> ` +
          `${e.action}` +
          `<span style="color:#666"> — ${e.location}</span>` +
          `</div>`;
      });
      timelineHtml = `
        <div style="margin:10px 0 4px;border-top:1px solid #333;padding-top:8px">
          <div style="color:#8ac;font-size:12px;font-weight:bold;text-align:center;margin-bottom:6px;letter-spacing:2px">
            ▸ INCIDENT RECONSTRUCTION ◂
          </div>
          <div style="max-height:180px;overflow-y:auto;padding:0 4px;scrollbar-width:thin;scrollbar-color:#444 #1a1a2e">
            ${eventLines.join("")}
          </div>
        </div>`;
    }

    overlay.innerHTML = `
      <div class="gameover-box ${titleClass}">
        <div class="gameover-title ${titleClass}">${title}</div>
        <div class="gameover-subtitle">${subtitle}</div>
        <div class="gameover-rating" style="text-align:center;margin:8px 0">
          <span style="color:${ratingColor};font-size:32px;font-weight:bold;text-shadow:0 0 10px ${ratingColor}">${rating}</span>
          <div style="color:#888;font-size:12px">PERFORMANCE RATING</div>
        </div>
        <div class="gameover-stats">
          <div class="gameover-stat"><span class="stat-label">Turns:</span> <span class="stat-value">${state.turn}</span></div>
          <div class="gameover-stat"><span class="stat-label">Hull Integrity:</span> <span class="stat-value ${hpClass}">${state.player.hp}/${state.player.maxHp} (${hpPercent}%)</span></div>
          <div class="gameover-stat"><span class="stat-label">Rooms Explored:</span> <span class="stat-value ${roomsExplored >= state.rooms.length ? 'good' : 'warn'}">${roomsExplored}/${state.rooms.length}</span></div>
          <div class="gameover-stat"><span class="stat-label">Relays Rerouted:</span> <span class="stat-value ${relaysActivated >= totalRelays ? 'good' : 'warn'}">${relaysActivated}/${totalRelays}</span></div>
          <div class="gameover-stat"><span class="stat-label">Breaches Sealed:</span> <span class="stat-value ${breachesSealed >= totalBreaches ? 'good' : 'warn'}">${breachesSealed}/${totalBreaches}</span></div>
          ${crewStatHtml}
          <div class="gameover-stat"><span class="stat-label">Terminals Read:</span> <span class="stat-value">${terminalsRead}/${totalTerminals}</span></div>
          <div class="gameover-stat"><span class="stat-label">Evidence Collected:</span> <span class="stat-value">${evidenceCount}</span></div>
          <div class="gameover-stat"><span class="stat-label">Deductions:</span> <span class="stat-value ${deductionsCorrect === deductions.length ? 'good' : deductionsCorrect > 0 ? 'warn' : 'bad'}">${deductionsCorrect}/${deductions.length} correct</span></div>
          ${choicesHtml}
        </div>
        ${retrospectiveHtml}
        ${timelineHtml}
        <div class="gameover-epilogue">${epilogue}</div>
        <div style="text-align:center;margin:6px 0;color:#556;font-size:11px;font-family:monospace">
          SEED ${state.seed} &middot; ${ARCHETYPE_DISPLAY_NAMES[state.mystery?.timeline.archetype as IncidentArchetype] ?? "UNKNOWN"}${state.difficulty && state.difficulty !== "normal" ? ` &middot; ${state.difficulty.toUpperCase()}` : ""}
        </div>
        ${this.renderRunHistory(state.seed)}
        <div class="gameover-restart">[R] Replay Seed ${state.seed} &nbsp;&nbsp;|&nbsp;&nbsp; [N] New Story</div>
      </div>`;
    overlay.classList.add("active");
  }

  destroy(): void {
    window.removeEventListener("resize", this.resizeHandler);
    if (this.roomFlashTimer) clearTimeout(this.roomFlashTimer);
    const canvas = this.display.getContainer();
    if (canvas && canvas.parentElement) {
      canvas.parentElement.removeChild(canvas);
    }
    // Clean up overlays
    const overlay = document.getElementById("gameover-overlay");
    if (overlay) overlay.classList.remove("active");
  }

  // ── Responsive resize ──────────────────────────────────────────
  private handleResize(): void {
    const vw = Math.min(VIEWPORT_WIDTH, this.mapWidth);
    const vh = Math.min(VIEWPORT_HEIGHT, this.mapHeight);
    const fontSize = computeFontSize(vw, vh);
    const opts = this.display.getOptions();
    if (opts.fontSize !== fontSize) {
      this.display.setOptions({ fontSize });
    }
  }

  /** Signal that the next render should show a movement trail. */
  triggerTrail(): void {
    this.showTrail = true;
  }

  /** Flash a tile white for 1 render frame (interaction feedback). */
  flashTile(x: number, y: number): void {
    this.flashTiles.add(`${x},${y}`);
  }

  // ── Find interactable entities within 3 tiles of player ────────
  private getNearbyEntities(state: GameState, radius: number): { entity: Entity; dist: number; dir: string }[] {
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;
    const results: { entity: Entity; dist: number; dir: string }[] = [];
    for (const [id, entity] of state.entities) {
      if (id === "player") continue;
      const dx = entity.pos.x - px;
      const dy = entity.pos.y - py;
      const dist = Math.max(Math.abs(dx), Math.abs(dy)); // Chebyshev distance
      if (dist > 0 && dist <= radius) {
        // Compute compass direction
        let dir = "";
        if (dy < 0) dir += "N";
        if (dy > 0) dir += "S";
        if (dx > 0) dir += "E";
        if (dx < 0) dir += "W";
        if (!dir) dir = "here";
        results.push({ entity, dist, dir });
      }
    }
    results.sort((a, b) => a.dist - b.dist);
    return results;
  }

  // ── Find interactable entities adjacent to player ──────────────
  private getAdjacentInteractables(state: GameState): Entity[] {
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;
    const results: Entity[] = [];
    const deltas = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 0 },
    ];
    for (const d of deltas) {
      for (const [id, entity] of state.entities) {
        if (id === "player") continue;
        if (entity.pos.x === px + d.x && entity.pos.y === py + d.y) {
          results.push(entity);
        }
      }
    }
    return results;
  }

  // ── Find which room the player is in ───────────────────────────
  private getPlayerRoom(state: GameState): Room | null {
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;
    for (const room of state.rooms) {
      if (
        px >= room.x &&
        px < room.x + room.width &&
        py >= room.y &&
        py < room.y + room.height
      ) {
        return room;
      }
    }
    return null;
  }

  private getRoomExits(state: GameState, room: Room): string[] {
    return getRoomExitsShared(state, room);
  }

  // ── Track room entry for flash message ─────────────────────────
  updateRoomFlash(state: GameState): void {
    const room = this.getPlayerRoom(state);
    const roomId = room ? room.id : "";
    if (roomId && roomId !== this.lastRoomId) {
      this.roomFlashMessage = room!.name;
      if (this.roomFlashTimer) clearTimeout(this.roomFlashTimer);
      this.roomFlashTimer = setTimeout(() => {
        this.roomFlashMessage = "";
        this.roomFlashTimer = null;
      }, 2000);
    }
    this.lastRoomId = roomId;
  }

  /** Compute the top-left corner of the viewport, centered on the player with edge clamping. */
  private getViewportOrigin(state: GameState): { vx: number; vy: number } {
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;
    const vw = Math.min(VIEWPORT_WIDTH, state.width);
    const vh = Math.min(VIEWPORT_HEIGHT, state.height);
    let vx = px - Math.floor(vw / 2);
    let vy = py - Math.floor(vh / 2);
    vx = Math.max(0, Math.min(state.width - vw, vx));
    vy = Math.max(0, Math.min(state.height - vh, vy));
    return { vx, vy };
  }

  render(state: GameState): void {
    this.display.clear();

    const curPos = { x: state.player.entity.pos.x, y: state.player.entity.pos.y };
    const { vx, vy } = this.getViewportOrigin(state);
    const vw = Math.min(VIEWPORT_WIDTH, state.width);
    const vh = Math.min(VIEWPORT_HEIGHT, state.height);

    // Determine if we should show a movement trail this frame
    let trailPos: { x: number; y: number } | null = null;
    if (this.showTrail && this.prevPlayerPos &&
        (this.prevPlayerPos.x !== curPos.x || this.prevPlayerPos.y !== curPos.y)) {
      trailPos = this.prevPlayerPos;
    }

    // Update previous position tracking after computing trail
    this.prevPlayerPos = { ...curPos };
    // Consume the trail flag (only show for 1 render cycle)
    const trailActive = this.showTrail;
    this.showTrail = false;

    // Build entity position lookup
    const entityAt = new Map<string, { glyph: string; color: string; bgGlow?: string; entity: Entity; exhausted: boolean }>();
    for (const [id, entity] of state.entities) {
      if (id === "player") continue;
      // Hidden crew items: only show if cleanliness sensor is active or item was revealed
      if (entity.type === EntityType.CrewItem && entity.props["hidden"] === true) {
        if (this.sensorMode !== SensorType.Cleanliness) continue;
      }
      // Don't render evacuated or dead crew NPCs
      if (entity.type === EntityType.CrewNPC &&
          (entity.props["evacuated"] === true || entity.props["dead"] === true)) {
        continue;
      }
      const key = `${entity.pos.x},${entity.pos.y}`;
      // Airlock: red when open, cyan when closed
      let entityColor = ENTITY_COLORS[entity.type] || "#fff";
      if (entity.type === EntityType.Airlock) {
        entityColor = entity.props["open"] === true ? "#f00" : "#0ff";
      }
      // Blue halo for interactable (non-exhausted) entities, default glow otherwise
      const exhausted = isEntityExhausted(entity);
      const bgGlow = exhausted ? ENTITY_BG_GLOW[entity.type] : INTERACTABLE_BG;
      entityAt.set(key, {
        glyph: ENTITY_GLYPHS[entity.type] || "?",
        color: entityColor,
        bgGlow,
        entity,
        exhausted,
      });
    }

    // Draw tiles, entities, and player (viewport only)
    for (let y = vy; y < vy + vh; y++) {
      for (let x = vx; x < vx + vw; x++) {
        const tile = state.tiles[y][x];
        const sx = x - vx; // screen x
        const sy = y - vy; // screen y

        // Fog-of-war: unexplored tiles are black
        if (!tile.explored) {
          this.display.draw(sx, sy, " ", "#000", "#000");
          continue;
        }

        // Fog-of-war: explored but not visible = dim grey memory
        if (!tile.visible) {
          let memFg = "#1a1a1a";
          let memGlyph = tile.glyph;
          let memBg = "#050505";
          if (tile.type === TileType.Wall) {
            memGlyph = this.getWallGlyph(state, x, y);
            memFg = "#282828";
          } else if (tile.type === TileType.Door || tile.type === TileType.LockedDoor) {
            memFg = "#332210";
          }
          // Show static entities as dim memory on explored tiles
          const posKey = `${x},${y}`;
          const memEnt = entityAt.get(posKey);
          if (memEnt && STATIC_ENTITY_TYPES.has(memEnt.entity.type)) {
            memGlyph = memEnt.glyph;
            memFg = "#333333";
            memBg = "#080808";
          }
          this.display.draw(sx, sy, memGlyph, memFg, memBg);
          continue;
        }

        // Determine base glyph based on tile type
        let glyph: string;
        let fg: string;
        if (tile.type === TileType.Wall) {
          glyph = this.getWallGlyph(state, x, y);
          fg = this.getWallColor(state, x, y);
        } else if (tile.type === TileType.Floor || tile.type === TileType.Corridor) {
          const inRoom = state.rooms.some(r =>
            x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height
          );
          glyph = floorGlyph(x, y, !inRoom);
          fg = inRoom ? COLORS.floor : COLORS.corridor;
        } else {
          glyph = tile.glyph;
          fg = this.getTileFg(tile);
        }
        let bg: string = COLORS.background;

        // Smoke rendering: tiles with smoke > 0 show smoke glyph with grey tint
        if (tile.smoke > 0 && tile.walkable) {
          glyph = GLYPHS.smoke;
          fg = smokeToFgColor(tile.smoke);
          bg = smokeToBgColor(tile.smoke);
        }

        // Ambient heat visibility (WITHOUT thermal sensor):
        // Dangerous heat zones show a warm background tint so players
        // never take invisible damage. Subtle below pain threshold,
        // more visible above it.
        if (this.sensorMode !== SensorType.Thermal && tile.walkable && tile.heat > 0) {
          const t = Math.max(0, Math.min(1, tile.heat / 100));
          if (tile.heat >= HEAT_PAIN_THRESHOLD) {
            // Dangerous: visible warm glow
            const r = Math.round(30 + t * 50);
            const g = Math.round(8 * (1 - t));
            const b = Math.round(8 * (1 - t));
            bg = `rgb(${r},${g},${b})`;
            if (tile.heat > 60) {
              glyph = GLYPHS.heat;
              fg = `rgb(${Math.round(180 + t * 75)},${Math.round(60 * (1 - t))},0)`;
            }
          } else if (tile.heat > 15) {
            // Subtle warmth hint
            const r = Math.round(0x11 + t * 25);
            bg = `rgb(${r},${0x0e},${0x08})`;
          }
        }

        // Full thermal overlay: detailed heat visualization (requires sensor)
        if (this.sensorMode === SensorType.Thermal && tile.walkable) {
          if (tile.heat > 0) {
            fg = heatToFgColor(tile.heat);
            bg = heatToBgColor(tile.heat);
            if (tile.heat > 50) {
              glyph = GLYPHS.heat;
            }
          } else if (tile.smoke <= 0) {
            // Cool tiles: subtle blue tint (only if no smoke)
            bg = "#001020";
          }
        }

        // Atmospheric overlay: pressure visualization (requires atmospheric sensor)
        if (this.sensorMode === SensorType.Atmospheric && tile.walkable) {
          if (tile.pressure < 30) {
            // Dangerous low pressure: red/orange
            glyph = "!";
            fg = "#f44";
            bg = "#300";
          } else if (tile.pressure < 60) {
            // Low pressure: orange warning
            fg = "#fa4";
            bg = "#210";
            // Show air flow arrows toward low-pressure areas
            const px = state.player.entity.pos.x;
            const py = state.player.entity.pos.y;
            const dist = Math.abs(x - px) + Math.abs(y - py);
            if (dist <= 10) {
              // Find adjacent tile with lowest pressure to show flow direction
              let lowestP = tile.pressure;
              let flowDir = "";
              const dirs = [
                { dx: 0, dy: -1, arrow: "\u2191" },
                { dx: 0, dy: 1, arrow: "\u2193" },
                { dx: 1, dy: 0, arrow: "\u2192" },
                { dx: -1, dy: 0, arrow: "\u2190" },
              ];
              for (const d of dirs) {
                const nx = x + d.dx;
                const ny = y + d.dy;
                if (nx >= 0 && nx < state.width && ny >= 0 && ny < state.height) {
                  if (state.tiles[ny][nx].walkable && state.tiles[ny][nx].pressure < lowestP) {
                    lowestP = state.tiles[ny][nx].pressure;
                    flowDir = d.arrow;
                  }
                }
              }
              if (flowDir) glyph = flowDir;
            }
          } else if (tile.pressure < 90) {
            // Slightly low: subtle blue-green
            bg = "#021a1a";
            fg = "#4a8";
          } else {
            // Normal pressure: subtle green-blue tint
            bg = "#001510";
            fg = "#3a6";
          }
        }

        // Cleanliness overlay: dirt visualization (requires cleanliness sensor)
        if (this.sensorMode === SensorType.Cleanliness && tile.walkable && tile.dirt > 0) {
          if (tile.dirt > 60) {
            glyph = ";";
            fg = "#a85"; // brown
          } else if (tile.dirt > 30) {
            glyph = ",";
            fg = "#865"; // tan
          } else if (tile.dirt > 10) {
            glyph = ".";
            fg = "#443"; // dim
          }
        }

        // Entity at this position (drawn on top of tile)
        // Only show entities on visible tiles.
        // Smoke blocks vision: entities on tiles with smoke > 50 are hidden
        // unless the player is within Manhattan distance 1.
        const posKey = `${x},${y}`;
        const ent = tile.visible ? entityAt.get(posKey) : undefined;
        if (ent) {
          const manhattan = Math.abs(x - curPos.x) + Math.abs(y - curPos.y);
          if (tile.smoke <= 50 || manhattan <= 1) {
            glyph = ent.glyph;
            fg = ent.color;
            // Subtle background glow behind entities
            const glowBg = ent.bgGlow;
            if (glowBg) bg = glowBg;
          }
        }

        // Movement trail: dim @ at previous position for 1 render cycle
        if (trailActive && trailPos && x === trailPos.x && y === trailPos.y && !ent) {
          glyph = GLYPHS.player;
          fg = "#0a4a0a"; // dim green ghost
        }

        // Flash tile: white flash for 1 render cycle (interaction feedback)
        if (this.flashTiles.has(posKey)) {
          bg = "#fff";
          fg = "#000";
        }

        // Player always on top
        if (state.player.entity.pos.x === x && state.player.entity.pos.y === y) {
          glyph = GLYPHS.player;
          fg = COLORS.player;
          bg = "#0a1a0a";
        }

        this.display.draw(sx, sy, glyph, fg, bg);
      }
    }

    // Clear flash tiles after rendering (1-frame effect)
    this.flashTiles.clear();

    // ── Game over overlay ──────────────────────────────────────────
    if (state.gameOver) {
      this.renderGameOverOverlay(state);
    }

    // ── Persistent room name header (row 0) with exits ─────────────
    if (!state.gameOver) {
      const currentRoom = this.getPlayerRoom(state);
      if (currentRoom) {
        const exits = this.getRoomExits(state, currentRoom);
        const exitStr = exits.length > 0 ? `  [exits: ${exits.join(" ")}]` : "";
        this.renderCenteredText(currentRoom.name + exitStr, 0, "#6cf", COLORS.background);
      } else {
        this.renderCenteredText("-- Corridor --", 0, "#456", COLORS.background);
      }
    }

    // ── Room flash label (first-visit animation, row 1) ───────────
    if (this.roomFlashMessage && !state.gameOver) {
      this.renderCenteredText(
        this.roomFlashMessage,
        1,
        "#6cf",
        COLORS.background
      );
    }
  }

  private renderGameOverOverlay(state: GameState): void {
    // Fill the center of the viewport with a dark box
    const vw = Math.min(VIEWPORT_WIDTH, state.width);
    const vh = Math.min(VIEWPORT_HEIGHT, state.height);
    const centerY = Math.floor(vh / 2);
    const boxTop = centerY - 5;
    const boxBottom = centerY + 5;
    const boxLeft = Math.floor(vw * 0.15);
    const boxRight = Math.floor(vw * 0.85);

    for (let y = boxTop; y <= boxBottom; y++) {
      for (let x = boxLeft; x <= boxRight; x++) {
        if (x >= 0 && x < vw && y >= 0 && y < vh) {
          const isBorder = y === boxTop || y === boxBottom || x === boxLeft || x === boxRight;
          const borderColor = state.victory ? "#0a4a0a" : "#4a0a0a";
          this.display.draw(x, y, isBorder ? "#" : " ", isBorder ? borderColor : "#000", "#000");
        }
      }
    }

    const crewEvac = (state.mystery?.evacuation?.crewEvacuated.length || 0) > 0;
    const msg = state.victory
      ? (crewEvac ? "=== CREW EVACUATED ===" : "=== TRANSMISSION COMPLETE ===")
      : "=== CONNECTION LOST ===";
    const color = state.victory ? "#0f0" : "#f00";
    this.renderCenteredText(msg, centerY - 3, color, "#000");

    if (state.victory) {
      const subtext = crewEvac ? "All survivors accounted for." : "The crew's work survives.";
      this.renderCenteredText(subtext, centerY - 1, "#8f8", "#000");
      this.renderCenteredText(`Mission completed in ${state.turn} turns.`, centerY + 0, "#888", "#000");

      // Count logs found
      const logsFound = state.logs.filter(l => l.source !== "system" && l.source !== "sensor").length;
      const hpRemaining = state.player.hp;
      this.renderCenteredText(`Logs recovered: ${logsFound}  |  Hull integrity: ${hpRemaining}%`, centerY + 1, "#666", "#000");
      this.renderCenteredText("The record is preserved. Recovery teams en route.", centerY + 3, "#4a8", "#000");
    } else {
      this.renderCenteredText("The data core remains sealed.", centerY - 1, "#f88", "#000");
      this.renderCenteredText(`Rover A3 lost at turn ${state.turn}.`, centerY + 0, "#888", "#000");
      this.renderCenteredText("CORVUS-7 drifts on, silent.", centerY + 2, "#666", "#000");
    }

    this.renderCenteredText("Press [R] to restart", centerY + 4, "#555", "#000");
  }

  private renderCenteredText(
    text: string,
    y: number,
    fg: string,
    bg: string
  ): void {
    const vw = Math.min(VIEWPORT_WIDTH, this.mapWidth);
    const startX = Math.floor((vw - text.length) / 2);
    for (let i = 0; i < text.length; i++) {
      const x = startX + i;
      if (x >= 0 && x < vw) {
        this.display.draw(x, y, text[i], fg, bg);
      }
    }
  }

  private getObjective(state: GameState): { text: string; detail: string } {
    return getObjectiveShared(state);
  }

  renderUI(state: GameState, panel: HTMLElement, visitedRoomIds?: Set<string>): void {
    // Sensor overlay indicator is now a dedicated line (see overlayLine below)

    // ── Objective with phase indicator ─────────────────────────
    const objective = this.getObjective(state);
    const phaseLabels: Record<string, { label: string; color: string }> = {
      [ObjectivePhase.Clean]: { label: "MAINTENANCE", color: "#4a4" },
      [ObjectivePhase.Investigate]: { label: "INVESTIGATION", color: "#fa0" },
      [ObjectivePhase.Recover]: { label: "RECOVERY", color: "#f44" },
      [ObjectivePhase.Evacuate]: { label: "EVACUATION", color: "#f0f" },
    };
    const phase = state.mystery?.objectivePhase ?? ObjectivePhase.Clean;
    const phaseInfo = phaseLabels[phase] ?? { label: "UNKNOWN", color: "#888" };
    const phaseTag = `<span style="color:${phaseInfo.color};font-weight:bold;font-size:11px;letter-spacing:1px">[${phaseInfo.label}]</span> `;
    const objectiveHtml = `<div class="objective-panel">` +
      `${phaseTag}<span class="objective-label">OBJECTIVE:</span> ` +
      `<span class="objective-text">${this.escapeHtml(objective.text)}</span>` +
      `<br><span class="objective-detail">${this.escapeHtml(objective.detail)}</span>` +
      `</div>`;

    // ── Interaction hint ──────────────────────────────────────────
    let interactHint = "";
    if (!state.gameOver) {
      const nearby = this.getAdjacentInteractables(state);
      if (nearby.length > 0) {
        const target = nearby[0];
        const name = entityDisplayName(target);
        interactHint = `<span class="interact-hint"> ▸ [i] ${this.escapeHtml(name)}</span>`;
      }
    }

    // ── Entity proximity feedback (within 3 tiles) ───────────────
    let proximityHtml = "";
    if (!state.gameOver) {
      const nearbyEnts = this.getNearbyEntities(state, 3);
      if (nearbyEnts.length > 0) {
        const items = nearbyEnts.slice(0, 4).map(n => {
          const name = entityDisplayName(n.entity);
          const color = ENTITY_COLORS[n.entity.type] || "#aaa";
          return `<span style="color:${color}">${this.escapeHtml(name)}</span> <span class="label">(${n.dist} tile${n.dist > 1 ? "s" : ""} ${n.dir})</span>`;
        });
        proximityHtml = `<div class="proximity-bar"><span class="label">NEARBY:</span> ${items.join(" | ")}</div>`;
      }
    }

    // ── Status bar ───────────────────────────────────────────────
    const room = this.getPlayerRoom(state);
    const zoneTag = room?.zone ? ` <span class="label">[${this.escapeHtml(room.zone)}]</span>` : "";
    const roomLabel = room
      ? ` | <span class="value">${this.escapeHtml(room.name)}</span>${zoneTag}`
      : "";

    // ── HP bar with visual blocks ─────────────────────────────────
    const hpPercent = Math.round((state.player.hp / state.player.maxHp) * 100);
    const hpColor = hpPercent > 60 ? "#0f0" : hpPercent > 30 ? "#fa0" : "#f00";
    const hpBarWidth = 10; // total block chars
    const filledBlocks = Math.round((state.player.hp / state.player.maxHp) * hpBarWidth);
    const emptyBlocks = hpBarWidth - filledBlocks;
    const hpBar = "\u2588".repeat(filledBlocks) + "\u2591".repeat(emptyBlocks);
    const hpCriticalClass = hpPercent <= 25 ? " hp-critical" : "";
    const hpWarning = hpPercent <= 25 ? " ⚠ CRITICAL" : hpPercent <= 50 ? " ⚠" : "";
    const hpTag = ` | <span class="label">HP:</span><span class="${hpCriticalClass}" style="color:${hpColor}; font-size:${hpPercent <= 25 ? '14px' : '13px'}">${hpBar} ${state.player.hp}/${state.player.maxHp}${hpWarning}</span>`;
    // Stun indicator
    const stunTag = state.player.stunTurns > 0
      ? ` | <span style="color:#44f; font-weight:bold">⚡ STUNNED (${state.player.stunTurns})</span>`
      : "";

    // ── Unread log count ─────────────────────────────────────────
    const unreadCount = state.logs.filter(l => l.read === false).length;
    const unreadTag = unreadCount > 0
      ? ` | <span style="color:#ca8">[${unreadCount} UNREAD]</span>`
      : "";

    // ── Discovery counter ──────────────────────────────────────
    const disc = getDiscoveries(state);
    const discoveryTag = ` | <span class="label">Discoveries:</span> <span style="color:#ca8">${disc.discovered}/${disc.total}</span>`;

    // ── Evidence & deduction progress ─────────────────────────
    let evidenceTag = "";
    let deductionTag = "";
    let reportTag = "";
    if (state.mystery) {
      const jCount = state.mystery.journal.length;
      if (jCount > 0) {
        evidenceTag = ` | <span class="label">Evidence:</span> <span style="color:#6cf">${jCount}</span>`;
      }
      const deds = state.mystery.deductions;
      const solved = deds.filter(d => d.solved).length;
      const correct = deds.filter(d => d.answeredCorrectly).length;
      if (deds.length > 0) {
        const dedColor = correct === deds.length ? "#0f0" : solved > 0 ? "#fa0" : "#888";
        deductionTag = ` | <span class="label">Deductions:</span> <span style="color:${dedColor}">${correct}/${deds.length}</span>`;
      }

      const unlocked = getUnlockedDeductions(deds, state.mystery.journal);
      if (unlocked.length > 0) {
        reportTag = ` | <span style="color:#ff0;font-weight:bold">[DEDUCTION READY]</span>`;
      }
    }

    // ── Overlay indicator line ─────────────────────────────────
    const overlayColors: Record<string, string> = {
      [SensorType.Thermal]: "#f44",
      [SensorType.Cleanliness]: "#4f4",
      [SensorType.Atmospheric]: "#4af",
    };
    let overlayLine = "";
    if (this.sensorMode) {
      const color = overlayColors[this.sensorMode] ?? "#aaa";
      const label = this.sensorMode.toUpperCase();
      overlayLine = `<div style="color:${color};font-weight:bold;padding:2px 0;border-bottom:1px solid #222">` +
        `OVERLAY: ${label}  <span style="color:#666;font-weight:normal">[t] cycle  [q] off</span></div>`;
    } else {
      overlayLine = `<div style="color:#555;padding:2px 0;border-bottom:1px solid #222">` +
        `OVERLAY: off  <span style="color:#666">[t] to activate</span></div>`;
    }

    // Turn counter with remaining turns warning
    const maxTurns = state.maxTurns ?? MAX_TURNS;
    const remaining = maxTurns - state.turn;
    const warnThreshold = Math.floor(maxTurns * 0.70);
    const turnWarning = state.turn >= warnThreshold
      ? ` <span style="color:${remaining <= 50 ? '#f44' : remaining <= 100 ? '#fa0' : '#ca8'};font-weight:bold">[${remaining} left]</span>`
      : "";

    // ── Objective compass — sensor-gated directional hints ──────
    let compassHtml = "";
    if (!state.gameOver) {
      const sensors = state.player.sensors ?? [];
      const hasThermal = sensors.includes(SensorType.Thermal);
      const hasAtmo = sensors.includes(SensorType.Atmospheric);
      const px = state.player.entity.pos.x;
      const py = state.player.entity.pos.y;

      interface CompassTarget { glyph: string; label: string; dist: number; dir: string; color: string; priority: number }
      const targets: CompassTarget[] = [];

      const dirLabel = (dx: number, dy: number): string => {
        const ns = dy < 0 ? "N" : dy > 0 ? "S" : "";
        const ew = dx < 0 ? "W" : dx > 0 ? "E" : "";
        return ns + ew || "here";
      };

      for (const [, ent] of state.entities) {
        const dx = ent.pos.x - px;
        const dy = ent.pos.y - py;
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist < 2) continue; // don't show things right next to you

        // Thermal sensor reveals relays and repair cradles
        if (hasThermal && ent.type === EntityType.Relay && ent.props["activated"] !== true && ent.props["locked"] !== true) {
          targets.push({ glyph: "⚡", label: "Relay", dist, dir: dirLabel(dx, dy), color: "#fa0", priority: 1 });
        }
        // Atmospheric sensor reveals crew NPCs and breaches
        if (hasAtmo && ent.type === EntityType.CrewNPC && ent.props["following"] !== true && ent.props["evacuated"] !== true) {
          targets.push({ glyph: "🙋", label: "Life Signs", dist, dir: dirLabel(dx, dy), color: "#f0f", priority: 0 });
        }
        if (hasAtmo && ent.type === EntityType.Breach && ent.props["sealed"] !== true) {
          targets.push({ glyph: "💨", label: "Breach", dist, dir: dirLabel(dx, dy), color: "#4af", priority: 2 });
        }
        // Always show escape pods during evacuation phase
        if (state.mystery?.objectivePhase === ObjectivePhase.Evacuate && ent.type === EntityType.EscapePod && ent.props["powered"] !== true) {
          targets.push({ glyph: "⬡", label: "Pod", dist, dir: dirLabel(dx, dy), color: "#8f8", priority: 0 });
        }
      }

      // Add nearest unexplored room as a low-priority compass target
      if (visitedRoomIds && state.rooms.length > 0) {
        let nearestUnexplored: { name: string; dist: number; dir: string } | null = null;
        for (const room of state.rooms) {
          if (visitedRoomIds.has(room.id)) continue;
          const cx = room.x + Math.floor(room.width / 2);
          const cy = room.y + Math.floor(room.height / 2);
          const dx = cx - px;
          const dy = cy - py;
          const dist = Math.abs(dx) + Math.abs(dy);
          if (!nearestUnexplored || dist < nearestUnexplored.dist) {
            nearestUnexplored = { name: room.name, dist, dir: dirLabel(dx, dy) };
          }
        }
        if (nearestUnexplored) {
          targets.push({ glyph: "?", label: nearestUnexplored.name, dist: nearestUnexplored.dist, dir: nearestUnexplored.dir, color: "#666", priority: 5 });
        }
      }

      // Sort by priority (lower = more important), then distance
      targets.sort((a, b) => a.priority - b.priority || a.dist - b.dist);
      const shown = targets.slice(0, 2);
      if (shown.length > 0) {
        const items = shown.map(t =>
          `<span style="color:${t.color}">${t.glyph} ${t.label}</span> <span class="label">${t.dist} ${t.dir}</span>`
        );
        compassHtml = `<div style="color:#8ac;font-size:11px;padding:2px 0;border-bottom:1px solid #222">` +
          `<span style="color:#556;font-weight:bold">SCANNER:</span> ${items.join(" &middot; ")}</div>`;
      }
    }

    // ── Rooms explored counter ──────────────────────────────────
    const roomsTotal = state.rooms.length;
    const roomsExplored = visitedRoomIds ? visitedRoomIds.size : 0;
    const roomsPct = roomsTotal > 0 ? Math.round((roomsExplored / roomsTotal) * 100) : 0;
    const roomsColor = roomsPct >= 75 ? "#0f0" : roomsPct >= 50 ? "#ca8" : "#888";
    const roomsTag = roomsTotal > 0
      ? ` | <span class="label">Rooms:</span> <span style="color:${roomsColor}">${roomsExplored}/${roomsTotal} (${roomsPct}%)</span>`
      : "";

    const statusHtml = `<div class="status-bar">` +
      `<span class="label">T:</span><span class="value">${state.turn}</span>${turnWarning}` +
      roomLabel + stunTag +
      `<br>` + hpTag.replace(/ \| /, '') +
      `<br>` + discoveryTag.replace(/ \| /, '') + evidenceTag.replace(/ \| /, '') + deductionTag.replace(/ \| /, '') +
      `<br>` + roomsTag.replace(/ \| /, '') +
      (state.player.attachments[AttachmentSlot.Tool] ? `<br><span class="label">TOOL:</span> <span style="color:#fa4">${this.escapeHtml(state.player.attachments[AttachmentSlot.Tool].name)}</span>` : '') +
      `<br>` + unreadTag.replace(/ \| /g, '').trim() + reportTag.replace(/ \| /, '') +
      interactHint +
      `</div>` + compassHtml + overlayLine;

    // Room list removed from main UI — available via [m] map command
    const roomListHtml = "";

    // ── Dynamic legend — only entities visible in current room ────
    const currentRoom = this.getPlayerRoom(state);
    const visibleEntityTypes = new Set<string>();
    if (currentRoom) {
      for (const [, entity] of state.entities) {
        if (entity.pos.x >= currentRoom.x && entity.pos.x < currentRoom.x + currentRoom.width &&
            entity.pos.y >= currentRoom.y && entity.pos.y < currentRoom.y + currentRoom.height) {
          visibleEntityTypes.add(entity.type);
        }
      }
      // Also check for tile-based features in the room
      for (let ry = currentRoom.y; ry < currentRoom.y + currentRoom.height; ry++) {
        for (let rx = currentRoom.x; rx < currentRoom.x + currentRoom.width; rx++) {
          if (ry >= 0 && ry < state.height && rx >= 0 && rx < state.width) {
            const t = state.tiles[ry][rx];
            if (t.heat > 20) visibleEntityTypes.add("_heat");
            if (t.type === TileType.LockedDoor) visibleEntityTypes.add("_locked");
            if (t.type === TileType.Door) visibleEntityTypes.add("_door");
          }
        }
      }
    }
    // Also include entities within 3 tiles of the player (corridor encounters)
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;
    for (const [, entity] of state.entities) {
      const dist = Math.abs(entity.pos.x - px) + Math.abs(entity.pos.y - py);
      if (dist <= 3) visibleEntityTypes.add(entity.type);
    }

    const allLegendItems: { key: string; glyph: string; color: string; label: string }[] = [
      { key: EntityType.SensorPickup, glyph: ENTITY_GLYPHS[EntityType.SensorPickup] || "◈", color: "#0ff", label: "Sensor" },
      { key: EntityType.Relay, glyph: ENTITY_GLYPHS[EntityType.Relay] || "⚡", color: "#ff0", label: "Relay" },
      { key: EntityType.DataCore, glyph: ENTITY_GLYPHS[EntityType.DataCore] || "◆", color: "#f0f", label: "Data Core" },
      { key: EntityType.LogTerminal, glyph: ENTITY_GLYPHS[EntityType.LogTerminal] || "▣", color: "#6cf", label: "Terminal" },
      { key: EntityType.ServiceBot, glyph: ENTITY_GLYPHS[EntityType.ServiceBot] || "♦", color: "#fa0", label: "Service Bot" },
      { key: EntityType.CrewItem, glyph: ENTITY_GLYPHS[EntityType.CrewItem] || "✦", color: "#ca8", label: "Crew Item" },
      { key: EntityType.Drone, glyph: ENTITY_GLYPHS[EntityType.Drone] || "○", color: "#8a8", label: "Drone" },
      { key: EntityType.MedKit, glyph: ENTITY_GLYPHS[EntityType.MedKit] || "✚", color: "#f88", label: "Med Kit" },
      { key: EntityType.RepairBot, glyph: ENTITY_GLYPHS[EntityType.RepairBot] || "◎", color: "#fa8", label: "Repair Bot" },
      { key: EntityType.RepairCradle, glyph: ENTITY_GLYPHS[EntityType.RepairCradle] || "⚕", color: "#4df", label: "Repair Cradle" },
      { key: EntityType.Breach, glyph: ENTITY_GLYPHS[EntityType.Breach] || "⊘", color: "#f44", label: "Breach" },
      { key: EntityType.SecurityTerminal, glyph: ENTITY_GLYPHS[EntityType.SecurityTerminal] || "◫", color: "#4af", label: "Security" },
      { key: EntityType.PatrolDrone, glyph: ENTITY_GLYPHS[EntityType.PatrolDrone] || "🛸", color: "#f22", label: "Patrol" },
      { key: EntityType.PressureValve, glyph: ENTITY_GLYPHS[EntityType.PressureValve] || "◉", color: "#4ba", label: "Valve" },
      { key: EntityType.FuseBox, glyph: ENTITY_GLYPHS[EntityType.FuseBox] || "▦", color: "#d80", label: "Fuse Box" },
      { key: EntityType.PowerCell, glyph: ENTITY_GLYPHS[EntityType.PowerCell] || "⬡", color: "#fd4", label: "Power Cell" },
      { key: EntityType.EscapePod, glyph: ENTITY_GLYPHS[EntityType.EscapePod] || "⬡", color: "#4fa", label: "Escape Pod" },
      { key: EntityType.CrewNPC, glyph: ENTITY_GLYPHS[EntityType.CrewNPC] || "☺", color: "#fe6", label: "Crew" },
      { key: EntityType.EvidenceTrace, glyph: ENTITY_GLYPHS[EntityType.EvidenceTrace] || "※", color: "#ca8", label: "Evidence" },
      { key: EntityType.Console, glyph: ENTITY_GLYPHS[EntityType.Console] || "💻", color: "#6ac", label: "Console" },
      { key: EntityType.ToolPickup, glyph: ENTITY_GLYPHS[EntityType.ToolPickup] || "🔧", color: "#fa4", label: "Tool" },
      { key: EntityType.Airlock, glyph: ENTITY_GLYPHS[EntityType.Airlock] || "⊟", color: "#0ff", label: "Airlock" },
      { key: "_heat", glyph: GLYPHS.heat, color: "#f42", label: "Heat" },
      { key: "_locked", glyph: GLYPHS.lockedDoor, color: "#f00", label: "Locked" },
      { key: "_door", glyph: GLYPHS.door, color: "#a52", label: "Door" },
    ];
    const activeLegend = allLegendItems.filter(l => visibleEntityTypes.has(l.key));

    // Render legend beneath the map (larger, more central)
    const mapLegendEl = document.getElementById("map-legend");
    if (mapLegendEl) {
      if (activeLegend.length > 0) {
        mapLegendEl.innerHTML = activeLegend.map(l =>
          `<span class="legend-item"><span class="legend-glyph" style="color:${l.color}">${this.escapeHtml(l.glyph)}</span><span class="legend-label">${l.label}</span></span>`
        ).join("");
      } else {
        mapLegendEl.innerHTML = `<span class="legend-label">No notable objects nearby.</span>`;
      }
    }

    const controlsHtml = `<span class="label">Keys:</span> ` +
      `<span class="key">hjkl</span>/<span class="key">yubn</span> move ` +
      `<span class="key">i</span> open/close doors &amp; interact ` +
      `<span class="key">t</span> sensor ` +
      `<span class="key">c</span> clean ` +
      `<span class="key">v</span> evidence ` +
      `<span class="key">r</span> report ` +
      `<span class="key">?</span> help`;

    const infoHtml = `<div class="info-bar">${controlsHtml}</div>`;

    // ── Mini-map (compact room layout) ───────────────────────────
    let miniMapHtml = "";
    if (state.rooms.length > 0 && visitedRoomIds && visitedRoomIds.size > 0) {
      // Scale the map to fit in ~30x8 character grid
      const mapW = 30;
      const mapH = 8;
      const scaleX = mapW / state.width;
      const scaleY = mapH / state.height;

      // Build a character grid
      const grid: string[][] = [];
      const colorGrid: string[][] = [];
      for (let y = 0; y < mapH; y++) {
        grid[y] = [];
        colorGrid[y] = [];
        for (let x = 0; x < mapW; x++) {
          grid[y][x] = " ";
          colorGrid[y][x] = "#222";
        }
      }

      // Draw rooms
      for (const room of state.rooms) {
        const rx1 = Math.floor(room.x * scaleX);
        const ry1 = Math.floor(room.y * scaleY);
        const rx2 = Math.min(mapW - 1, Math.floor((room.x + room.width) * scaleX));
        const ry2 = Math.min(mapH - 1, Math.floor((room.y + room.height) * scaleY));
        const visited = visitedRoomIds.has(room.id);

        for (let y = ry1; y <= ry2; y++) {
          for (let x = rx1; x <= rx2; x++) {
            if (y >= 0 && y < mapH && x >= 0 && x < mapW) {
              grid[y][x] = visited ? "\u2588" : "\u2591";
              colorGrid[y][x] = visited ? "#2a4a2a" : "#1a1a1a";
            }
          }
        }
      }

      // Highlight key rooms during evacuation
      if (state.mystery?.evacuation?.active) {
        for (const [, ent] of state.entities) {
          if (ent.type === EntityType.EscapePod) {
            const ex = Math.floor(ent.pos.x * scaleX);
            const ey = Math.floor(ent.pos.y * scaleY);
            if (ey >= 0 && ey < mapH && ex >= 0 && ex < mapW && grid[ey][ex] !== " ") {
              colorGrid[ey][ex] = "#0af"; // cyan for escape pods
            }
          }
          if (ent.type === EntityType.CrewNPC && ent.props["following"] === true &&
              ent.props["evacuated"] !== true && ent.props["dead"] !== true) {
            const ex = Math.floor(ent.pos.x * scaleX);
            const ey = Math.floor(ent.pos.y * scaleY);
            if (ey >= 0 && ey < mapH && ex >= 0 && ex < mapW) {
              grid[ey][ex] = "!";
              colorGrid[ey][ex] = "#ff0"; // yellow for following crew
            }
          }
        }
      }

      // Draw player position
      const ppx = Math.floor(state.player.entity.pos.x * scaleX);
      const ppy = Math.floor(state.player.entity.pos.y * scaleY);
      if (ppy >= 0 && ppy < mapH && ppx >= 0 && ppx < mapW) {
        grid[ppy][ppx] = "@";
        colorGrid[ppy][ppx] = "#0f0";
      }

      // Render to HTML
      let mapStr = "";
      for (let y = 0; y < mapH; y++) {
        for (let x = 0; x < mapW; x++) {
          mapStr += `<span style="color:${colorGrid[y][x]}">${grid[y][x]}</span>`;
        }
        mapStr += "\n";
      }
      miniMapHtml = `<div style="font-size:10px;line-height:1.1;padding:2px 0;border-bottom:1px solid #222;white-space:pre;font-family:monospace">${mapStr}</div>`;
    }

    // ── Hull integrity warning banner ──────────────────────────
    let hullBannerHtml = "";
    if (hpPercent <= 15) {
      hullBannerHtml = `<div style="color:#fff;background:#600;padding:3px 6px;border-bottom:2px solid #f00;font-size:13px;font-weight:bold;text-align:center;animation:blink 0.8s step-end infinite">⚠ HULL INTEGRITY CRITICAL — ${state.player.hp}/${state.player.maxHp} HP ⚠</div>`;
    } else if (hpPercent <= 30) {
      hullBannerHtml = `<div style="color:#f44;background:#1a0500;padding:2px 6px;border-bottom:1px solid #633;font-size:12px;font-weight:bold">HULL INTEGRITY LOW — ${state.player.hp}/${state.player.maxHp} HP — seek repair station</div>`;
    }

    // ── Pinned notification (persistent at top of log) ──────────
    let pinnedHtml = "";
    if (state.mystery) {
      const phaseLabel = phaseInfo.label;
      const unlocked = getUnlockedDeductions(state.mystery.deductions, state.mystery.journal);
      if (unlocked.length > 0) {
        pinnedHtml = `<div style="color:#ff0;background:#1a1500;padding:2px 6px;border-bottom:1px solid #443;font-size:12px;font-weight:bold">[${phaseLabel}] DEDUCTION READY — press [v] to open Investigation Hub</div>`;
      } else if (state.mystery.objectivePhase === ObjectivePhase.Recover) {
        const allDedsSolved = state.mystery.deductions.every(d => d.solved);
        if (!allDedsSolved) {
          pinnedHtml = `<div style="color:#f44;background:#1a0500;padding:2px 6px;border-bottom:1px solid #433;font-size:12px">[${phaseLabel}] Gather evidence and solve deductions to unlock the Data Core</div>`;
        }
      }
    }

    // ── Log panel (color-coded by type) ─────────────────────────
    const logEntries = this.logHistory.length > 0
      ? this.logHistory
          .map((entry) => {
            const cls = LOG_TYPE_CLASSES[entry.type] || "log";
            return `<span class="${cls}"><span class="log-prefix">&gt; </span>${this.escapeHtml(entry.text)}</span>`;
          })
          .join("")
      : '<span class="log log-system">-- awaiting telemetry --</span>';

    const logHtml = `<div class="log-panel">${hullBannerHtml}${pinnedHtml}${logEntries}</div>`;

    // ── Action bar — context-sensitive available actions ──────────
    let actionBarHtml = "";
    if (!state.gameOver) {
      const actions: { key: string; label: string; active: boolean }[] = [];
      // Move is always available unless stunned
      actions.push({ key: "hjkl", label: "Move", active: state.player.stunTurns === 0 });
      // Interact — show target name if available
      const nearby = this.getAdjacentInteractables(state);
      if (nearby.length > 0) {
        const name = entityDisplayName(nearby[0]);
        actions.push({ key: "i", label: `Interact: ${name}`, active: true });
      } else {
        actions.push({ key: "i", label: "Interact", active: false });
      }
      // Clean
      actions.push({ key: "c", label: "Clean", active: true });
      // Scan/Sensor toggle
      const sensorNames = (state.player.sensors ?? []).map(s => s.charAt(0).toUpperCase() + s.slice(1));
      const sensorLabel = sensorNames.length > 1 ? `Sensor (${sensorNames.join("/")})` : "Sensor";
      actions.push({ key: "t", label: sensorLabel, active: sensorNames.length > 0 });
      // Look
      actions.push({ key: "l", label: "Look", active: true });
      // Journal/Investigation Hub
      actions.push({ key: "v", label: "Evidence Hub", active: true });

      actionBarHtml = `<div style="padding:2px 0;border-bottom:1px solid #222;font-size:11px;color:#888">` +
        actions.map(a => {
          const color = a.active ? "#9ab" : "#444";
          const keyColor = a.active ? "#ce8" : "#555";
          return `<span style="color:${keyColor};font-weight:bold">[${a.key}]</span><span style="color:${color}"> ${this.escapeHtml(a.label)} </span>`;
        }).join("") + `</div>`;
    }

    const bottomHtml = `<div class="ui-bottom">${objectiveHtml}${statusHtml}${actionBarHtml}${proximityHtml}${miniMapHtml}${roomListHtml}${infoHtml}</div>`;
    panel.innerHTML = logHtml + bottomHtml;

    // Auto-scroll log panel to bottom
    const logPanel = panel.querySelector(".log-panel");
    if (logPanel) {
      logPanel.scrollTop = logPanel.scrollHeight;
    }
  }

  private getTileFg(tile: { type: string }): string {
    switch (tile.type) {
      case TileType.Wall:
        return COLORS.wall;
      case TileType.Floor:
      case TileType.Corridor:
        return COLORS.floor;
      case TileType.Door:
        return COLORS.door;
      case TileType.LockedDoor:
        return COLORS.lockedDoor;
      default:
        return "#888";
    }
  }

  /** Compute box-drawing glyph for a wall based on its neighbors. */
  private getWallGlyph(state: GameState, x: number, y: number): string {
    let bits = 0;
    // N
    if (y > 0 && !state.tiles[y - 1][x].walkable) bits |= 1;
    // S
    if (y < state.height - 1 && !state.tiles[y + 1][x].walkable) bits |= 2;
    // E
    if (x < state.width - 1 && !state.tiles[y][x + 1].walkable) bits |= 4;
    // W
    if (x > 0 && !state.tiles[y][x - 1].walkable) bits |= 8;
    return WALL_GLYPHS[bits] || "█";
  }

  /** Get wall color tinted by room proximity. */
  private getWallColor(state: GameState, x: number, y: number): string {
    // Check if this wall is adjacent to a room and tint accordingly
    for (const room of state.rooms) {
      if (x >= room.x - 1 && x <= room.x + room.width &&
          y >= room.y - 1 && y <= room.y + room.height) {
        const tint = ROOM_WALL_TINTS[room.name];
        if (tint) return tint;
      }
    }
    // Subtle variation based on position
    const hash = ((x * 3) + (y * 7)) & 0xf;
    if (hash < 4) return COLORS.wallDark;
    if (hash > 11) return COLORS.wallLight;
    return COLORS.wall;
  }

  private renderRunHistory(currentSeed: number): string {
    const history = getRunHistory();
    // Show up to 5 previous runs (excluding the current one which was just added)
    const pastRuns = history.filter(r => r.seed !== currentSeed || history.indexOf(r) > 0).slice(0, 5);
    if (pastRuns.length <= 1) return ""; // Don't show if only current run exists

    const archetypeShort: Record<string, string> = {
      coolant_cascade: "WHISTLEBLOWER",
      hull_breach: "MURDER",
      reactor_scram: "ROGUE AI",
      sabotage: "STOWAWAY",
      signal_anomaly: "FIRST CONTACT",
    };

    const rows = pastRuns.slice(1).map(r => {
      const result = r.victory
        ? `<span style="color:#0f0">WIN</span>`
        : `<span style="color:#f44">LOSS</span>`;
      const ratingColor = r.rating === "S" ? "#ff0" : r.rating === "A" ? "#0f0" : r.rating === "B" ? "#6cf" : r.rating === "C" ? "#fa0" : "#f44";
      const arch = archetypeShort[r.archetype] || r.archetype;
      return `<div style="font-size:10px;color:#888;font-family:monospace">` +
        `${result} <span style="color:${ratingColor}">${r.rating}</span> ` +
        `T${r.turns} · ${arch} · ${r.seed}` +
        `</div>`;
    });

    if (rows.length === 0) return "";

    return `<div style="margin:6px 0;border-top:1px solid #333;padding-top:6px">` +
      `<div style="color:#556;font-size:10px;text-align:center;margin-bottom:3px">PREVIOUS RUNS</div>` +
      rows.join("") + `</div>`;
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
