import { generate } from "./sim/procgen.js";
import { step } from "./sim/step.js";
import { BrowserDisplay } from "./render/display.js";
import type { LogType } from "./render/display.js";
import { InputHandler } from "./render/input.js";
import { AudioManager } from "./render/audio.js";
import { GOLDEN_SEED } from "./shared/constants.js";
import { OPENING_CRAWL, STATION_NAME, TAGLINE } from "./data/lore.js";
import {
  VICTORY_TITLE, VICTORY_TEXT, DEFEAT_TITLE, DEFEAT_TEXT,
  VICTORY_EPILOGUE_MINIMAL, VICTORY_EPILOGUE_PARTIAL, VICTORY_EPILOGUE_COMPLETE,
  ENDING_BY_DISCOVERY, SPECIFIC_DISCOVERIES,
  CLASSIFIED_DIRECTIVE_LOG_FRAGMENT, CLASSIFIED_DIRECTIVE_TEXT,
} from "./data/endgame.js";
import { ROOM_DESCRIPTIONS } from "./data/roomDescriptions.js";
import {
  BOT_INTROSPECTIONS, DRONE_STATUS_MESSAGES, FIRST_DRONE_ENCOUNTER,
  AMBIENT_HEAT_MESSAGES, AMBIENT_HEAT_DEFAULT, CLEANING_MESSAGES, DIRT_TRAIL_HINTS,
  DRONE_ENCOUNTER_LOGS, DRONE_CLEANING_MESSAGE,
} from "./data/narrative.js";
import type { Action } from "./shared/types.js";
import { ActionType, AttachmentSlot, SensorType, EntityType } from "./shared/types.js";

// ── Parse seed from URL params or use golden seed ───────────────
const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get("seed") || String(GOLDEN_SEED), 10);

// ── DOM elements ────────────────────────────────────────────────
const containerEl = document.getElementById("rot-display")!;
const uiPanel = document.getElementById("ui-panel")!;
const crawlOverlay = document.getElementById("crawl-overlay")!;

// ── Opening crawl ───────────────────────────────────────────────
let gameStarted = false;

function showOpeningCrawl(): void {
  crawlOverlay.style.display = "flex";

  const lines = [
    `> ${STATION_NAME}`,
    `> ${TAGLINE}`,
    "",
    ...OPENING_CRAWL,
    "",
    "Press any key to begin...",
  ];

  const fullText = lines.join("\n");
  const preEl = document.createElement("pre");
  preEl.className = "crawl-text";
  preEl.textContent = "";

  // SKIP prompt shown immediately
  const skipEl = document.createElement("div");
  skipEl.className = "crawl-skip";
  skipEl.textContent = "[ Press any key or click to SKIP ]";

  crawlOverlay.innerHTML = "";
  crawlOverlay.appendChild(preEl);
  crawlOverlay.appendChild(skipEl);

  // Typewriter effect: ~60 chars/second
  const CHARS_PER_SECOND = 60;
  const intervalMs = 1000 / CHARS_PER_SECOND;
  let charIndex = 0;
  let dismissed = false;

  const typewriterInterval = setInterval(() => {
    if (dismissed) return;
    if (charIndex < fullText.length) {
      preEl.textContent += fullText[charIndex];
      charIndex++;
      // Auto-scroll the crawl overlay to keep new text visible
      preEl.scrollIntoView({ block: "end" });
    } else {
      clearInterval(typewriterInterval);
    }
  }, intervalMs);

  const startGame = (e: Event) => {
    e.preventDefault();
    dismissed = true;
    clearInterval(typewriterInterval);
    crawlOverlay.style.display = "none";
    gameStarted = true;
    window.removeEventListener("keydown", startGame);
    crawlOverlay.removeEventListener("click", startGame);
    initGame();
  };

  window.addEventListener("keydown", startGame);
  crawlOverlay.addEventListener("click", startGame);
}

// ── Game initialization ─────────────────────────────────────────
let state = generate(seed);
let display: BrowserDisplay;
let inputHandler: InputHandler;
let lastPlayerRoomId = "";
const visitedRoomIds = new Set<string>();
const audio = new AudioManager();
let firstDroneEncounterShown = false;
const triggeredBotIntrospections = new Set<number>();
const droneEncounterSet = new Set<string>(); // Track which drones have triggered unique encounter logs
let cleanMsgIndex = 0;
let lastAmbientRoomId = "";

// ── Wait message variety ────────────────────────────────────────
const WAIT_MESSAGES_COOL = [
  "Holding position. Systems nominal.",
  "Standing by. Hull temperature within limits.",
  "Waiting. The station hums faintly around you.",
  "Holding. Emergency beacon pulses in the distance.",
  "Systems idle. Somewhere, a vent rattles.",
];
const WAIT_MESSAGES_HOT = [
  "Holding position. Heat building. Time is not on your side.",
  "Waiting in the heat. Hull sensors flash amber.",
  "Standing by. The air shimmers. Not ideal.",
  "Holding. Thermal warnings climbing. Move soon.",
];
let waitMsgIndex = 0;

/** Flicker the ROT.js canvas visibility before showing the game-over overlay. */
function flickerThenRender(): void {
  const canvas = containerEl.querySelector("canvas");
  if (!canvas) { renderAll(); return; }
  const flicks = 6; // toggle count (3 off + 3 on)
  const interval = 50; // ms per toggle  (300ms total)
  let count = 0;
  const id = setInterval(() => {
    canvas.style.visibility = count % 2 === 0 ? "hidden" : "visible";
    count++;
    if (count >= flicks) {
      clearInterval(id);
      canvas.style.visibility = "visible";
      renderAll();
    }
  }, interval);
}

/** Check if the player entered a new room and log its description. */
function checkRoomEntry(): void {
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;
  let currentRoom: { id: string; name: string; x: number; y: number; width: number; height: number } | null = null;
  for (const room of state.rooms) {
    if (px >= room.x && px < room.x + room.width &&
        py >= room.y && py < room.y + room.height) {
      currentRoom = room;
      break;
    }
  }
  if (currentRoom && currentRoom.id !== lastPlayerRoomId) {
    lastPlayerRoomId = currentRoom.id;
    if (!visitedRoomIds.has(currentRoom.id)) {
      visitedRoomIds.add(currentRoom.id);

      // Item 11: Environmental sound cues BEFORE room description
      emitRoomEntryCues(currentRoom);

      const desc = ROOM_DESCRIPTIONS[currentRoom.name];
      if (desc) {
        display.addLog(desc, "narrative");
      }
    }
  }
}

/** Item 11: Emit atmospheric text based on room conditions on first entry. */
function emitRoomEntryCues(room: { name: string; x: number; y: number; width: number; height: number }): void {
  // Check tile conditions across the entire room
  let hasHeat = false;
  let hasSmoke = false;
  for (let ry = room.y; ry < room.y + room.height; ry++) {
    for (let rx = room.x; rx < room.x + room.width; rx++) {
      if (ry >= 0 && ry < state.height && rx >= 0 && rx < state.width) {
        const tile = state.tiles[ry][rx];
        if (tile.heat > 30) hasHeat = true;
        if (tile.smoke > 20) hasSmoke = true;
      }
    }
  }

  // Check for relay entities in this room
  let hasRelay = false;
  for (const [, entity] of state.entities) {
    if (entity.type === EntityType.Relay && entity.props["locked"] !== true) {
      if (entity.pos.x >= room.x && entity.pos.x < room.x + room.width &&
          entity.pos.y >= room.y && entity.pos.y < room.y + room.height) {
        hasRelay = true;
        break;
      }
    }
  }

  // Emit cues in priority order (all applicable cues fire)
  if (hasHeat) {
    display.addLog("Metal expansion creaks echo through the bulkhead.", "warning");
  }
  if (hasSmoke) {
    display.addLog("The air is thick. Particulate sensors spike.", "warning");
  }
  if (hasRelay) {
    display.addLog("Something electrical hums behind the panels. It sounds wrong.", "sensor");
  }
  if (room.name === "Cargo Hold") {
    display.addLog("Emergency lighting casts long shadows across makeshift bedding.", "narrative");
  }
}

// ── Classify sim-generated log messages by source/content ────────
function classifySimLog(logText: string, logSource: string): LogType {
  // Critical warnings
  if (logText.includes("CRITICAL") || logText.includes("compromised") || logText.includes("failing")) {
    return "critical";
  }
  // Warnings
  if (logText.includes("WARNING") || logText.includes("CAUTION") || logText.includes("Heat exposure")) {
    return "warning";
  }
  // Milestone events (relay rerouted, data core, sensor equipped, door unlocked)
  if (logText.includes("rerouted") || logText.includes("UNLOCKED") ||
      logText.includes("transmitted") || logText.includes("Equipped") ||
      logText.includes("Mission complete")) {
    return "milestone";
  }
  // Log terminal content (narrative)
  if (logSource !== "system" && logSource !== "sensor") {
    return "narrative";
  }
  // Sensor output
  if (logSource === "sensor") {
    return "sensor";
  }
  return "system";
}

function initGame(): void {
  display = new BrowserDisplay(containerEl, state.width, state.height);

  // ── Dramatic link establishment sequence ────────────────────────
  display.addLog("ESTABLISHING LINK...", "system");
  display.addLog("Carrier signal acquired. Handshake with Rover A3... OK.", "system");
  display.addLog("LINK ACTIVE -- Low-bandwidth terminal feed. No video, no audio.", "milestone");
  display.addLog("Objective: Restore power to the Data Core. Transmit the research bundle.", "milestone");
  display.addLog("Step 1: Find the Thermal Sensor (cyan S) in a nearby room. Move with arrow keys, [i] to interact.", "system");

  checkRoomEntry();
  renderAll();

  inputHandler = new InputHandler(handleAction, handleScan);

  // Listen for restart key when game is over
  window.addEventListener("keydown", handleRestartKey);
}

// ── Render helper ───────────────────────────────────────────────
function renderAll(): void {
  display.updateRoomFlash(state);
  display.render(state);
  display.renderUI(state, uiPanel, visitedRoomIds);
}

// ── Restart handler ──────────────────────────────────────────────
function handleRestartKey(e: KeyboardEvent): void {
  if (!state.gameOver) return;
  if (e.key === "r" || e.key === "R") {
    e.preventDefault();
    // Reset game state
    state = generate(seed);
    lastPlayerRoomId = "";
    visitedRoomIds.clear();

    // Clear the display container and rebuild
    containerEl.innerHTML = "";
    display = new BrowserDisplay(containerEl, state.width, state.height);

    display.addLog("RESTARTING LINK...", "system");
    display.addLog("Rover A3 rebooted. All systems reset.", "milestone");
    display.addLog("Objective: Restore power to the Data Core. Transmit the research bundle.", "system");

    checkRoomEntry();
    renderAll();
  }
}

// ── Action handler ──────────────────────────────────────────────
function handleAction(action: Action): void {
  if (state.gameOver) return;

  // Trigger movement trail before stepping
  if (action.type === ActionType.Move) {
    display.triggerTrail();
  }

  const prevTurn = state.turn;
  const prevLogs = state.logs.length;
  state = step(state, action);

  // Show sim-generated log messages (from interactions) with proper classification
  if (state.logs.length > prevLogs) {
    for (let i = prevLogs; i < state.logs.length; i++) {
      const simLog = state.logs[i];
      const logType = classifySimLog(simLog.text, simLog.source);
      display.addLog(simLog.text, logType);
    }
    // Interaction produced logs -- play interact sound
    if (action.type === ActionType.Interact) {
      audio.playInteract();
    } else if (action.type === ActionType.Move) {
      audio.playMove();
    }
  } else if (state.turn !== prevTurn) {
    // Fallback messages for actions without sim logs
    switch (action.type) {
      case ActionType.Move: {
        audio.playMove();
        // Contextual feedback based on tile conditions
        const px = state.player.entity.pos.x;
        const py = state.player.entity.pos.y;
        const tile = state.tiles[py]?.[px];
        if (tile && tile.smoke > 15) {
          display.addLog("Thick smoke. Visibility near zero. Sensors struggling.", "warning");
        } else if (tile && tile.smoke > 5) {
          display.addLog("Haze in the air. Particulate count rising.", "sensor");
        } else if (tile && tile.heat > 20) {
          display.addLog("Ambient temperature elevated. Thermal warnings on hull sensors.", "warning");
        }
        break;
      }
      case ActionType.Wait: {
        const wpx = state.player.entity.pos.x;
        const wpy = state.player.entity.pos.y;
        const wtile = state.tiles[wpy]?.[wpx];
        if (wtile && wtile.heat > 15) {
          const msg = WAIT_MESSAGES_HOT[waitMsgIndex % WAIT_MESSAGES_HOT.length];
          display.addLog(msg, "warning");
        } else {
          const msg = WAIT_MESSAGES_COOL[waitMsgIndex % WAIT_MESSAGES_COOL.length];
          display.addLog(msg, "system");
        }
        waitMsgIndex++;
        break;
      }
    }
  } else {
    display.addLog("Path blocked -- bulkhead or sealed door. Find another route.", "system");
    audio.playError();
  }

  // Item 12: Cleaning narrative flavor
  if (action.type === ActionType.Clean && state.turn !== prevTurn) {
    const cleanMsg = CLEANING_MESSAGES[cleanMsgIndex % CLEANING_MESSAGES.length];
    display.addLog(cleanMsg, "narrative");
    cleanMsgIndex++;
  }

  // Item 1: Cleanliness sensor dirt trail hints
  if (action.type === ActionType.Move && state.turn !== prevTurn) {
    const sensor = state.player.attachments[AttachmentSlot.Sensor];
    const hasCleanliness = !sensor || sensor.sensorType === SensorType.Cleanliness;
    // Default sensor is cleanliness, or if no sensor equipped, it's the base sensor
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;
    const tile = state.tiles[py]?.[px];
    if (tile && tile.dirt > 50 && hasCleanliness && display.isCleanlinessActive) {
      // Show trail hints for high-dirt tiles when cleanliness overlay is active
      const hintIdx = (px * 7 + py * 13) % DIRT_TRAIL_HINTS.length;
      if (tile.dirt > 60 && state.turn % 5 === 0) {
        display.addLog(DIRT_TRAIL_HINTS[hintIdx], "sensor");
      }
    }
  }

  // Item 3 (Sprint 2): Per-drone unique encounter logs + general status messages
  if (state.turn !== prevTurn) {
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;
    for (const [, entity] of state.entities) {
      if (entity.type !== EntityType.Drone) continue;
      const dist = Math.abs(entity.pos.x - px) + Math.abs(entity.pos.y - py);
      if (dist <= 2) {
        // First-ever drone encounter
        if (!firstDroneEncounterShown) {
          firstDroneEncounterShown = true;
          display.addLog(FIRST_DRONE_ENCOUNTER, "narrative");
          droneEncounterSet.add(entity.id);
          break;
        }
        // Per-drone unique encounter (each drone triggers once)
        if (!droneEncounterSet.has(entity.id) && DRONE_ENCOUNTER_LOGS[entity.id]) {
          droneEncounterSet.add(entity.id);
          display.addLog(DRONE_ENCOUNTER_LOGS[entity.id], "narrative");
          break;
        }
        // Generic status messages (30% chance, adjacent only)
        if (dist <= 1) {
          const droneHash = (state.turn * 31 + entity.id.charCodeAt(entity.id.length - 1) * 7) % 10;
          if (droneHash < 3) {
            const msgIdx = (state.turn + entity.id.charCodeAt(entity.id.length - 1)) % DRONE_STATUS_MESSAGES.length;
            display.addLog(DRONE_STATUS_MESSAGES[msgIdx], "sensor");
          }
        }
        break; // only one drone message per turn
      }
    }

    // Item 14: Show drone cleaning message when player is nearby and drone cleans
    for (const [, entity] of state.entities) {
      if (entity.type !== EntityType.Drone) continue;
      const dist = Math.abs(entity.pos.x - px) + Math.abs(entity.pos.y - py);
      if (dist <= 3) {
        // Check if this drone cleaned last turn (deterministic check matching step.ts)
        const cleanHash = (state.turn * 13 + entity.id.charCodeAt(entity.id.length - 1) * 3) % 5;
        if (cleanHash < 2) {
          const droneMsgHash = (state.turn * 7 + entity.id.charCodeAt(entity.id.length - 1)) % 8;
          if (droneMsgHash === 0) { // Don't spam — only ~12.5% of the time when in range
            display.addLog(DRONE_CLEANING_MESSAGE, "sensor");
          }
          break;
        }
      }
    }
  }

  // Item 9: Bot introspection at turn milestones
  for (const intro of BOT_INTROSPECTIONS) {
    if (state.turn >= intro.turn && !triggeredBotIntrospections.has(intro.turn)) {
      triggeredBotIntrospections.add(intro.turn);
      display.addLog(intro.text, "narrative");
    }
  }

  // Item 11: Environmental ambient text when entering heated rooms
  checkRoomEntry();
  checkAmbientHeat();

  if (state.gameOver) {
    if (state.victory) {
      audio.playVictory();
      display.addLog("", "system");
      display.addLog("=== " + VICTORY_TITLE + " ===", "milestone");
      VICTORY_TEXT.forEach((line) => { if (line) display.addLog(line, "milestone"); });

      // Item 8: Tiered victory epilogue based on discoveries
      const discoveryCount = getDiscoveryCount();
      const totalDiscoverables = getTotalDiscoverables();
      const ratio = totalDiscoverables > 0 ? discoveryCount / totalDiscoverables : 0;
      let epilogue: string[];
      if (ratio >= 0.8) {
        epilogue = VICTORY_EPILOGUE_COMPLETE;
      } else if (ratio >= 0.4) {
        epilogue = VICTORY_EPILOGUE_PARTIAL;
      } else {
        epilogue = VICTORY_EPILOGUE_MINIMAL;
      }
      epilogue.forEach((line) => { if (line) display.addLog(line, "milestone"); });

      // Sprint 2 Item 9: Discovery-count-based ending text
      const endingEntry = ENDING_BY_DISCOVERY.find(e => discoveryCount >= e.min);
      if (endingEntry) {
        display.addLog("", "system");
        display.addLog(endingEntry.text, "narrative");
      }

      // Sprint 2 Item 10: Victory text references specific discoveries
      for (const sd of SPECIFIC_DISCOVERIES) {
        const entity = state.entities.get(sd.entityId);
        if (entity && entity.props["examined"] === true) {
          display.addLog(sd.text, "narrative");
        }
      }
      // Check if classified directive log was read
      const readClassified = state.logs.some(l =>
        l.text.toLowerCase().includes(CLASSIFIED_DIRECTIVE_LOG_FRAGMENT)
      );
      if (readClassified) {
        display.addLog(CLASSIFIED_DIRECTIVE_TEXT, "narrative");
      }
    } else {
      audio.playDefeat();
      display.addLog("", "system");
      display.addLog("=== " + DEFEAT_TITLE + " ===", "critical");
      DEFEAT_TEXT.forEach((line) => { if (line) display.addLog(line, "critical"); });
    }
    flickerThenRender();
    return;
  }

  renderAll();
}

/** Check for ambient heat messages when entering a heated room (Item 11). */
function checkAmbientHeat(): void {
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;
  let currentRoom: { id: string; name: string } | null = null;
  for (const room of state.rooms) {
    if (px >= room.x && px < room.x + room.width &&
        py >= room.y && py < room.y + room.height) {
      currentRoom = room;
      break;
    }
  }
  if (currentRoom && currentRoom.id !== lastAmbientRoomId) {
    lastAmbientRoomId = currentRoom.id;
    const tile = state.tiles[py]?.[px];
    if (tile && tile.heat > 30) {
      const msg = AMBIENT_HEAT_MESSAGES[currentRoom.name] || AMBIENT_HEAT_DEFAULT;
      display.addLog(msg, "narrative");
    }
  }
}

/** Count discovered items and terminals for victory epilogue (Item 8). */
function getDiscoveryCount(): number {
  let count = 0;
  for (const [, entity] of state.entities) {
    if (entity.type === EntityType.CrewItem && entity.props["examined"] === true) {
      count++;
    }
    if (entity.type === EntityType.LogTerminal) {
      if (state.logs.some(l => l.id === `log_terminal_${entity.id}`)) {
        count++;
      }
    }
  }
  return count;
}

function getTotalDiscoverables(): number {
  let count = 0;
  for (const [, entity] of state.entities) {
    if (entity.type === EntityType.CrewItem && entity.props["hidden"] !== true) {
      count++;
    }
    if (entity.type === EntityType.LogTerminal) {
      count++;
    }
  }
  return count;
}

// ── Scan callback (cycles through available sensor overlays) ──
function handleScan(): void {
  const sensor = state.player.attachments[AttachmentSlot.Sensor];
  const hasThermal = sensor?.sensorType === SensorType.Thermal;
  const hasAtmospheric = sensor?.sensorType === SensorType.Atmospheric;
  const currentMode = display.activeSensorMode;

  // Cycle: off -> cleanliness -> thermal (if equipped) -> atmospheric (if equipped) -> off
  let nextMode: SensorType | null;
  if (currentMode === null) {
    nextMode = SensorType.Cleanliness;
  } else if (currentMode === SensorType.Cleanliness && hasThermal) {
    nextMode = SensorType.Thermal;
  } else if (currentMode === SensorType.Cleanliness && hasAtmospheric) {
    nextMode = SensorType.Atmospheric;
  } else if (currentMode === SensorType.Thermal) {
    nextMode = null;
  } else if (currentMode === SensorType.Atmospheric) {
    nextMode = null;
  } else {
    nextMode = null;
  }

  // Apply the mode change via toggleSensor
  if (currentMode !== null) {
    display.toggleSensor(currentMode); // turn off current
  }
  if (nextMode !== null) {
    display.toggleSensor(nextMode); // turn on next
  }

  if (nextMode === null) {
    display.addLog("[SENSOR OVERLAY OFF]", "sensor");
  } else if (nextMode === SensorType.Thermal) {
    display.addLog("[THERMAL OVERLAY ON]", "sensor");
  } else if (nextMode === SensorType.Cleanliness) {
    display.addLog("[CLEANLINESS OVERLAY ON] — Dirt trails reveal crew movement patterns.", "sensor");
  } else if (nextMode === SensorType.Atmospheric) {
    display.addLog("[ATMOSPHERIC OVERLAY ON] — Pressure differentials visible. Breaches glow red.", "sensor");
  }

  audio.playScan();
  renderAll();
}

// ── Start with opening crawl ────────────────────────────────────
showOpeningCrawl();
