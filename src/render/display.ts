import * as ROT from "rot-js";
import type { GameState, Entity, Room } from "../shared/types.js";
import { TileType, EntityType, AttachmentSlot, SensorType } from "../shared/types.js";
import { GLYPHS, DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, HEAT_PAIN_THRESHOLD } from "../shared/constants.js";

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
  "Engineering Storage": "#665850",
  "Power Relay Junction": "#665540",
  "Life Support": "#506066",
  "Vent Control Room": "#505866",
  "Communications Hub": "#505866",
  "Research Lab": "#506650",
  "Med Bay": "#605060",
  "Data Core": "#604868",
  "Robotics Bay": "#585858",
};

// ── Box-drawing wall characters ──────────────────────────────────
// Bitfield: N=1, S=2, E=4, W=8 (which neighbors are also walls)
const WALL_GLYPHS: Record<number, string> = {
  0b0000: "o",    // isolated
  0b0001: "│",    // N
  0b0010: "│",    // S
  0b0011: "│",    // N+S
  0b0100: "─",    // E
  0b1000: "─",    // W
  0b1100: "─",    // E+W
  0b0101: "└",    // N+E
  0b1001: "┘",    // N+W
  0b0110: "┌",    // S+E
  0b1010: "┐",    // S+W
  0b0111: "├",    // N+S+E
  0b1011: "┤",    // N+S+W
  0b1101: "┴",    // N+E+W
  0b1110: "┬",    // S+E+W
  0b1111: "┼",    // all four
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
};

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
};

const ENTITY_GLYPHS: Record<string, string> = {
  [EntityType.Relay]: "\u26a1",       // ⚡
  [EntityType.SensorPickup]: "\ud83d\udce1", // 📡
  [EntityType.DataCore]: "\ud83d\udc8e",     // 💎
  [EntityType.ServiceBot]: "\ud83d\udd0b",   // 🔋
  [EntityType.LogTerminal]: "\ud83d\udcbb",  // 💻
  [EntityType.CrewItem]: "\ud83d\udce6",     // 📦
  [EntityType.Drone]: "\ud83d\udd35",        // 🔵
  [EntityType.MedKit]: "\ud83d\udc8a",       // 💊
  [EntityType.RepairBot]: "\ud83d\udd27",    // 🔧
  [EntityType.Breach]: "\u26a0\ufe0f",       // ⚠️
  [EntityType.ClosedDoor]: "\ud83d\udeaa",   // 🚪
  [EntityType.SecurityTerminal]: "\ud83d\udcf7", // 📷
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

// ── Friendly entity names for interaction hints ─────────────────
const ENTITY_NAMES: Record<string, string> = {
  [EntityType.Relay]: "Power Relay",
  [EntityType.SensorPickup]: "Sensor Module",
  [EntityType.DataCore]: "Data Core",
  [EntityType.ServiceBot]: "Service Bot",
  [EntityType.LogTerminal]: "Log Terminal",
  [EntityType.CrewItem]: "Crew Item",
  [EntityType.Drone]: "Maintenance Drone",
  [EntityType.MedKit]: "Med Kit",
  [EntityType.RepairBot]: "Repair Bot",
  [EntityType.Breach]: "Hull Breach",
  [EntityType.ClosedDoor]: "Sealed Door",
  [EntityType.SecurityTerminal]: "Security Terminal",
};

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
const SIDEBAR_WIDTH_PX = 340; // reserve space for the sidebar panel

function computeFontSize(cellsW: number, cellsH: number): number {
  const availW = window.innerWidth - SIDEBAR_WIDTH_PX;
  const availH = window.innerHeight;

  const maxByWidth = Math.floor(availW / cellsW);
  const maxByHeight = Math.floor(availH / cellsH);
  const fontSize = Math.max(10, Math.min(maxByWidth, maxByHeight));
  return fontSize;
}

// ── ROT.js Display renderer ─────────────────────────────────────
export class BrowserDisplay {
  private display: ROT.Display;
  private container: HTMLElement;
  private sensorMode: SensorType | null = null;
  private logHistory: DisplayLogEntry[] = [];
  private static readonly MAX_LOG_ENTRIES = 16;
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

  constructor(container: HTMLElement, mapWidth?: number, mapHeight?: number) {
    this.container = container;
    this.mapWidth = mapWidth ?? DEFAULT_MAP_WIDTH;
    this.mapHeight = mapHeight ?? DEFAULT_MAP_HEIGHT;
    const fontSize = computeFontSize(this.mapWidth, this.mapHeight);
    this.display = new ROT.Display({
      width: this.mapWidth,
      height: this.mapHeight,
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
    window.addEventListener("resize", () => this.handleResize());
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

  // ── Responsive resize ──────────────────────────────────────────
  private handleResize(): void {
    const fontSize = computeFontSize(this.mapWidth, this.mapHeight);
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

  render(state: GameState): void {
    this.display.clear();

    const curPos = { x: state.player.entity.pos.x, y: state.player.entity.pos.y };

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
    const entityAt = new Map<string, { glyph: string; color: string; bgGlow?: string }>();
    for (const [id, entity] of state.entities) {
      if (id === "player") continue;
      // Hidden crew items: only show if cleanliness sensor is active or item was revealed
      if (entity.type === EntityType.CrewItem && entity.props["hidden"] === true) {
        if (this.sensorMode !== SensorType.Cleanliness) continue;
      }
      const key = `${entity.pos.x},${entity.pos.y}`;
      entityAt.set(key, {
        glyph: ENTITY_GLYPHS[entity.type] || "?",
        color: ENTITY_COLORS[entity.type] || "#fff",
        bgGlow: ENTITY_BG_GLOW[entity.type],
      });
    }

    // Draw tiles, entities, and player
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const tile = state.tiles[y][x];

        // Fog-of-war: unexplored tiles are black
        if (!tile.explored) {
          this.display.draw(x, y, " ", "#000", "#000");
          continue;
        }

        // Fog-of-war: explored but not visible = dim grey memory
        if (!tile.visible) {
          let memFg = "#1a1a1a";
          let memGlyph = tile.glyph;
          if (tile.type === TileType.Wall) {
            memGlyph = this.getWallGlyph(state, x, y);
            memFg = "#282828";
          } else if (tile.type === TileType.Door || tile.type === TileType.LockedDoor) {
            memFg = "#332210";
          }
          this.display.draw(x, y, memGlyph, memFg, "#050505");
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
          glyph = "\ud83e\udd16"; // 🤖
          fg = COLORS.player;
          bg = "#0a1a0a";
        }

        this.display.draw(x, y, glyph, fg, bg);
      }
    }

    // Clear flash tiles after rendering (1-frame effect)
    this.flashTiles.clear();

    // ── Game over overlay ──────────────────────────────────────────
    if (state.gameOver) {
      this.renderGameOverOverlay(state);
    }

    // ── Persistent room name header (row 0) ────────────────────────
    if (!state.gameOver) {
      const currentRoom = this.getPlayerRoom(state);
      if (currentRoom) {
        this.renderCenteredText(currentRoom.name, 0, "#6cf", COLORS.background);
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
    // Fill the center of the screen with a dark box
    const centerY = Math.floor(state.height / 2);
    const boxTop = centerY - 5;
    const boxBottom = centerY + 5;
    const boxLeft = Math.floor(this.mapWidth * 0.15);
    const boxRight = Math.floor(this.mapWidth * 0.85);

    for (let y = boxTop; y <= boxBottom; y++) {
      for (let x = boxLeft; x <= boxRight; x++) {
        if (x >= 0 && x < this.mapWidth && y >= 0 && y < state.height) {
          const isBorder = y === boxTop || y === boxBottom || x === boxLeft || x === boxRight;
          const borderColor = state.victory ? "#0a4a0a" : "#4a0a0a";
          this.display.draw(x, y, isBorder ? "#" : " ", isBorder ? borderColor : "#000", "#000");
        }
      }
    }

    const msg = state.victory ? "=== TRANSMISSION COMPLETE ===" : "=== CONNECTION LOST ===";
    const color = state.victory ? "#0f0" : "#f00";
    this.renderCenteredText(msg, centerY - 3, color, "#000");

    if (state.victory) {
      this.renderCenteredText("The crew's work survives.", centerY - 1, "#8f8", "#000");
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
    const startX = Math.floor((this.mapWidth - text.length) / 2);
    for (let i = 0; i < text.length; i++) {
      const x = startX + i;
      if (x >= 0 && x < this.mapWidth) {
        this.display.draw(x, y, text[i], fg, bg);
      }
    }
  }

  // ── Compute current objective based on game state ─────────────
  private getObjective(state: GameState): { text: string; detail: string } {
    if (state.gameOver) {
      return state.victory
        ? { text: "MISSION COMPLETE", detail: "Transmission sent. The crew's work survives." }
        : { text: "CONNECTION LOST", detail: "Refresh to try again." };
    }

    const hasThermal = state.player.attachments[AttachmentSlot.Sensor]?.sensorType === SensorType.Thermal;
    const sensorExists = Array.from(state.entities.values()).some(e => e.type === EntityType.SensorPickup);

    // Count relay status
    let totalRelays = 0;
    let activatedRelays = 0;
    for (const [, e] of state.entities) {
      if (e.type === EntityType.Relay && e.props["locked"] !== true) {
        totalRelays++;
        if (e.props["activated"] === true) activatedRelays++;
      }
    }
    const remaining = totalRelays - activatedRelays;
    const hasLockedDoor = state.tiles.some(row => row.some(t => t.type === TileType.LockedDoor));

    // Phase 1: Get the thermal sensor
    if (!hasThermal && sensorExists) {
      return {
        text: "Step 1: Find the Thermal Sensor",
        detail: "Explore rooms until you find the cyan S glyph. Walk next to it and press [i] to equip it.",
      };
    }
    if (!hasThermal && !sensorExists) {
      return { text: "Explore the station", detail: "Search rooms for useful equipment." };
    }

    // Phase 2: Activate all relays
    if (remaining > 0) {
      return {
        text: `Step 2: Reroute ${remaining} overheating relay${remaining > 1 ? "s" : ""}`,
        detail: `Press [t] to toggle thermal vision — hot zones glow red. Find the yellow R relays and press [i] next to each one. ${activatedRelays}/${totalRelays} done.`,
      };
    }

    // Phase 3: Reach data core
    if (hasLockedDoor) {
      return {
        text: "Step 3: Reach the Data Core",
        detail: "All relays rerouted but door is still locked. Look for another way in.",
      };
    }

    return {
      text: "Step 3: Transmit from the Data Core",
      detail: "The locked door (X) is now open. Find the magenta D and press [i] to transmit the research data.",
    };
  }

  renderUI(state: GameState, panel: HTMLElement, visitedRoomIds?: Set<string>): void {
    let sensorTag = "";
    if (this.sensorMode === SensorType.Thermal) {
      sensorTag = " <span class='thermal-active'>[THERMAL]</span>";
    } else if (this.sensorMode === SensorType.Cleanliness) {
      sensorTag = " <span class='thermal-active'>[CLEANLINESS]</span>";
    } else if (this.sensorMode === SensorType.Atmospheric) {
      sensorTag = " <span class='thermal-active'>[ATMOSPHERIC]</span>";
    }

    // ── Objective ────────────────────────────────────────────────
    const objective = this.getObjective(state);
    const objectiveHtml = `<div class="objective-panel">` +
      `<span class="objective-label">OBJECTIVE:</span> ` +
      `<span class="objective-text">${this.escapeHtml(objective.text)}</span>` +
      `<br><span class="objective-detail">${this.escapeHtml(objective.detail)}</span>` +
      `</div>`;

    // ── Interaction hint ──────────────────────────────────────────
    let interactHint = "";
    if (!state.gameOver) {
      const nearby = this.getAdjacentInteractables(state);
      if (nearby.length > 0) {
        const target = nearby[0];
        const name = ENTITY_NAMES[target.type] || target.type;
        interactHint = `<span class="interact-hint"> ▸ [i] ${this.escapeHtml(name)}</span>`;
      }
    }

    // ── Entity proximity feedback (within 3 tiles) ───────────────
    let proximityHtml = "";
    if (!state.gameOver) {
      const nearbyEnts = this.getNearbyEntities(state, 3);
      if (nearbyEnts.length > 0) {
        const items = nearbyEnts.slice(0, 4).map(n => {
          const name = ENTITY_NAMES[n.entity.type] || n.entity.type;
          const color = ENTITY_COLORS[n.entity.type] || "#aaa";
          return `<span style="color:${color}">${this.escapeHtml(name)}</span> <span class="label">(${n.dist} tile${n.dist > 1 ? "s" : ""} ${n.dir})</span>`;
        });
        proximityHtml = `<div class="proximity-bar"><span class="label">NEARBY:</span> ${items.join(" | ")}</div>`;
      }
    }

    // ── Status bar ───────────────────────────────────────────────
    const room = this.getPlayerRoom(state);
    const roomLabel = room
      ? ` | <span class="value">${this.escapeHtml(room.name)}</span>`
      : "";

    // ── HP bar with visual blocks ─────────────────────────────────
    const hpPercent = Math.round((state.player.hp / state.player.maxHp) * 100);
    const hpColor = hpPercent > 60 ? "#0f0" : hpPercent > 30 ? "#fa0" : "#f00";
    const hpBarWidth = 10; // total block chars
    const filledBlocks = Math.round((state.player.hp / state.player.maxHp) * hpBarWidth);
    const emptyBlocks = hpBarWidth - filledBlocks;
    const hpBar = "\u2588".repeat(filledBlocks) + "\u2591".repeat(emptyBlocks);
    const hpTag = ` | <span class="label">HP:</span><span style="color:${hpColor}">${hpBar} ${state.player.hp}/${state.player.maxHp}</span>`;

    // ── Unread log count ─────────────────────────────────────────
    const unreadCount = state.logs.filter(l => l.read === false).length;
    const unreadTag = unreadCount > 0
      ? ` | <span style="color:#ca8">[${unreadCount} UNREAD]</span>`
      : "";

    // ── Discovery counter (Item 13) ─────────────────────────────
    let totalDiscoverables = 0;
    let discovered = 0;
    for (const [, entity] of state.entities) {
      if (entity.type === EntityType.CrewItem && entity.props["hidden"] !== true) {
        totalDiscoverables++;
        if (entity.props["examined"] === true) discovered++;
      }
      if (entity.type === EntityType.LogTerminal) {
        totalDiscoverables++;
        if (state.logs.some(l => l.id === `log_terminal_${entity.id}`)) discovered++;
      }
    }
    // Also count already-examined hidden items that were revealed
    for (const [, entity] of state.entities) {
      if (entity.type === EntityType.CrewItem && entity.props["hidden"] === true) {
        // Only count as discoverable if it has been revealed (cleaned)
        if (entity.props["revealed"] === true) {
          totalDiscoverables++;
          if (entity.props["examined"] === true) discovered++;
        }
      }
    }
    const discoveryTag = ` | <span class="label">Discoveries:</span> <span style="color:#ca8">${discovered}/${totalDiscoverables}</span>`;

    const statusHtml = `<div class="status-bar">` +
      `<span class="label">T:</span><span class="value">${state.turn}</span>` +
      roomLabel + sensorTag +
      `<br>` + hpTag.replace(/ \| /, '') +
      `<br>` + discoveryTag.replace(/ \| /, '') + unreadTag.replace(/ \| /g, '') +
      interactHint +
      `</div>`;

    // ── Room list (minimap) ──────────────────────────────────────
    // Build set of camera-revealed room indices (explored but not visited)
    const cameraRevealedRoomIds = new Set<string>();
    for (let ri = 0; ri < state.rooms.length; ri++) {
      const room = state.rooms[ri];
      if (visitedRoomIds && visitedRoomIds.has(room.id)) continue;
      // Check if any tile in the room is explored (camera reveal)
      let anyExplored = false;
      for (let ry = room.y; ry < room.y + room.height && !anyExplored; ry++) {
        for (let rx = room.x; rx < room.x + room.width && !anyExplored; rx++) {
          if (rx >= 0 && rx < state.width && ry >= 0 && ry < state.height) {
            if (state.tiles[ry][rx].explored) anyExplored = true;
          }
        }
      }
      if (anyExplored) cameraRevealedRoomIds.add(room.id);
    }

    let roomListHtml = "";
    if (state.rooms.length > 0 && visitedRoomIds) {
      const roomItems = state.rooms.map(r => {
        const visited = visitedRoomIds.has(r.id);
        const cameraRevealed = cameraRevealedRoomIds.has(r.id);
        const mark = visited
          ? `<span style="color:#0f0">\u2713</span>`
          : cameraRevealed
            ? `<span style="color:#4af">\u25cb</span>`
            : `<span class="label">\u00b7</span>`;
        const label = visited
          ? `<span style="color:#8b8">${this.escapeHtml(r.name)}</span>`
          : cameraRevealed
            ? `<span style="color:#4a8">${this.escapeHtml(r.name)}</span>`
            : `<span class="label">???</span>`;
        return `${mark} ${label}`;
      });
      // Lay out in 2 columns
      const half = Math.ceil(roomItems.length / 2);
      const col1 = roomItems.slice(0, half);
      const col2 = roomItems.slice(half);
      let rows = "";
      for (let i = 0; i < half; i++) {
        const left = col1[i] || "";
        const right = col2[i] || "";
        rows += `<div class="room-row"><span class="room-col">${left}</span><span class="room-col">${right}</span></div>`;
      }
      roomListHtml = `<div class="room-list-panel"><span class="label">STATION MAP:</span>${rows}</div>`;
    }

    // ── Legend + Controls (side by side) ──────────────────────────
    const legendItems = [
      { glyph: "\ud83e\udd16", color: "#0f0", label: "You" },
      { glyph: "\ud83d\udce1", color: "#0ff", label: "Sensor" },
      { glyph: "\u26a1", color: "#ff0", label: "Relay" },
      { glyph: "\ud83d\udc8e", color: "#f0f", label: "Core" },
      { glyph: "\ud83d\udcbb", color: "#6cf", label: "Terminal" },
      { glyph: "\ud83d\udd0b", color: "#fa0", label: "SvcBot" },
      { glyph: "\ud83d\udce6", color: "#ca8", label: "Item" },
      { glyph: "\ud83d\udd35", color: "#8a8", label: "Drone" },
      { glyph: "\ud83d\udc8a", color: "#f88", label: "MedKit" },
      { glyph: "\ud83d\udd27", color: "#fa8", label: "Repair" },
      { glyph: GLYPHS.lockedDoor, color: "#f00", label: "Locked" },
      { glyph: GLYPHS.door, color: "#a52", label: "Door" },
      { glyph: GLYPHS.heat, color: "#f42", label: "Heat" },
      { glyph: "\u26a0\ufe0f", color: "#f44", label: "Breach" },
      { glyph: "\ud83d\udcf7", color: "#4af", label: "Camera" },
    ];
    const legendHtml = legendItems
      .map(l => `<span class="legend-glyph" style="color:${l.color}">${this.escapeHtml(l.glyph)}</span><span class="legend-name">${l.label}</span>`)
      .join(" ");

    const controlsHtml = `<span class="label">Keys:</span> ` +
      `<span class="key">WASD</span> move ` +
      `<span class="key">i</span> interact ` +
      `<span class="key">t</span> sensor ` +
      `<span class="key">c</span> clean ` +
      `<span class="key">l</span> look ` +
      `<span class="key">Space</span> wait`;

    const infoHtml = `<div class="info-bar">` +
      `${legendHtml}<br>${controlsHtml}</div>`;

    // ── Log panel (color-coded by type) ─────────────────────────
    const logEntries = this.logHistory.length > 0
      ? this.logHistory
          .map((entry) => {
            const cls = LOG_TYPE_CLASSES[entry.type] || "log";
            return `<span class="${cls}"><span class="log-prefix">&gt; </span>${this.escapeHtml(entry.text)}</span>`;
          })
          .join("")
      : '<span class="log log-system">-- awaiting telemetry --</span>';

    const logHtml = `<div class="log-panel">${logEntries}</div>`;

    const bottomHtml = `<div class="ui-bottom">${objectiveHtml}${statusHtml}${proximityHtml}${roomListHtml}${infoHtml}</div>`;
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

  private escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
