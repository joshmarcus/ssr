import { generate } from "./sim/procgen.js";
import { step } from "./sim/step.js";
import { BrowserDisplay } from "./render/display.js";
import type { IGameDisplay } from "./render/displayInterface.js";
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
  getVictoryText,
} from "./data/endgame.js";
import { ROOM_DESCRIPTIONS } from "./data/roomDescriptions.js";
import {
  BOT_INTROSPECTIONS, DRONE_STATUS_MESSAGES, FIRST_DRONE_ENCOUNTER,
  AMBIENT_HEAT_MESSAGES, AMBIENT_HEAT_DEFAULT, CLEANING_MESSAGES, DIRT_TRAIL_HINTS,
  DRONE_ENCOUNTER_LOGS, DRONE_CLEANING_MESSAGE,
} from "./data/narrative.js";
import type { Action, MysteryChoice, Deduction } from "./shared/types.js";
import { ActionType, AttachmentSlot, SensorType, EntityType, ObjectivePhase, DeductionCategory, TileType } from "./shared/types.js";
import { computeChoiceEndings } from "./sim/mysteryChoices.js";
import { getUnlockedDeductions, solveDeduction, validateEvidenceLink, linkEvidence } from "./sim/deduction.js";
import { getRoomAt, getRoomCleanliness } from "./sim/rooms.js";

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
let display: IGameDisplay;
let is3D = false;

// Lazy-loaded 3D renderer constructor — only populated when user first presses F3
let BrowserDisplay3D: (new (container: HTMLElement, w: number, h: number) => IGameDisplay) | null = null;
let display3dLoadFailed = false;
let inputHandler: InputHandler;
let lastPlayerRoomId = "";
const visitedRoomIds = new Set<string>();
const audio = new AudioManager();
let firstDroneEncounterShown = false;
const triggeredBotIntrospections = new Set<number>();
const droneEncounterSet = new Set<string>(); // Track which drones have triggered unique encounter logs
let cleanMsgIndex = 0;
let lastAmbientRoomId = "";
let journalOpen = false;
let journalTab: "evidence" | "deductions" = "evidence";
let activeChoice: MysteryChoice | null = null;
let choiceSelectedIdx = 0;
let choicesPresented = new Set<string>();
let lastObjectivePhase: ObjectivePhase | null = null;
let activeDeduction: Deduction | null = null;
let deductionSelectedIdx = 0;
let pendingCrewDoor: { entityId: string; crewName: string } | null = null;
let mapOpen = false;
let helpOpen = false;
let broadcastOpen = false;
let broadcastSection: "evidence" | "what" | "why" | "who" = "evidence";
let broadcastOptionIdx = 0;
let broadcastEvidenceScroll = 0;
let broadcastLinkedEvidence: string[] = [];
let broadcastDetailDeduction: string | null = null; // deduction ID when in detail/evidence-linking view
let broadcastEvidenceIdx = 0; // highlighted journal entry index in detail view

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
      logText.includes("Mission complete") || logText.includes("sensor installed") ||
      logText.includes("Sensor module installed")) {
    return "milestone";
  }
  // Stun / patrol drone
  if (logText.includes("Patrol drone") || logText.includes("ALERT: Patrol")) {
    return "critical";
  }
  // Pressure warnings
  if (logText.includes("pressure") && (logText.includes("warning") || logText.includes("critical"))) {
    return "warning";
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
  display = (is3D && BrowserDisplay3D)
    ? new BrowserDisplay3D(containerEl, state.width, state.height)
    : new BrowserDisplay(containerEl, state.width, state.height);

  // ── Dramatic link establishment sequence ────────────────────────
  display.addLog("ESTABLISHING LINK...", "system");
  display.addLog("Carrier signal acquired. Handshake with Rover A3... OK.", "system");
  display.addLog("LINK ACTIVE -- Low-bandwidth terminal feed. No video, no audio.", "milestone");
  display.addLog("PRIMARY DIRECTIVE: Clean all station rooms to 80% standard.", "milestone");
  display.addLog("You are a JR-3 Janitor Rover. Cleaning is your purpose. Use [c] to clean.", "system");
  lastObjectivePhase = ObjectivePhase.Clean;

  checkRoomEntry();
  renderAll();

  inputHandler = new InputHandler(handleAction, handleScan);

  // Listen for restart key when game is over
  window.addEventListener("keydown", handleRestartKey);
  // Listen for F3 to toggle 2D/3D renderer
  window.addEventListener("keydown", handleToggleKey);
  // Listen for choice/deduction/crew-door input
  window.addEventListener("keydown", (e) => {
    if (broadcastOpen) {
      handleBroadcastInput(e);
      return;
    }
    if (pendingCrewDoor) {
      handleCrewDoorInput(e);
      return;
    }
    if (activeDeduction) {
      handleDeductionInput(e);
      return;
    }
    if (activeChoice) {
      handleChoiceInput(e);
      return;
    }
    // ? key toggles help
    if (e.key === "?" && !journalOpen) {
      e.preventDefault();
      helpOpen = !helpOpen;
      if (helpOpen) {
        showHelp();
      } else {
        display.addLog("[Help closed]", "system");
        renderAll();
      }
      return;
    }
    // B key opens broadcast report modal
    if (e.key === "b" && !journalOpen && !state.gameOver) {
      e.preventDefault();
      broadcastOpen = !broadcastOpen;
      if (broadcastOpen) {
        broadcastSection = "evidence";
        broadcastOptionIdx = 0;
        broadcastEvidenceScroll = 0;
        renderBroadcastModal();
      } else {
        closeBroadcastModal();
      }
      return;
    }
    // M key toggles station map
    if ((e.key === "m" || e.key === "M") && !journalOpen) {
      e.preventDefault();
      mapOpen = !mapOpen;
      if (mapOpen) {
        showStationMap();
      } else {
        display.addLog("[Map closed]", "system");
        renderAll();
      }
      return;
    }
    // Tab to switch journal tabs
    if (journalOpen && e.key === "Tab") {
      e.preventDefault();
      journalTab = journalTab === "evidence" ? "deductions" : "evidence";
      showJournal();
      return;
    }
    // Enter to attempt deduction when on deductions tab
    if (journalOpen && journalTab === "deductions" && e.key === "Enter") {
      e.preventDefault();
      handleDeductionAttempt();
      return;
    }
  });
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
    journalOpen = false;
    activeChoice = null;
    broadcastOpen = false;
    // Close broadcast modal on restart
    const broadcastEl = document.getElementById("broadcast-overlay");
    if (broadcastEl) { broadcastEl.classList.remove("active"); broadcastEl.innerHTML = ""; }
    choicesPresented.clear();

    // Clear overlays and display, rebuild
    const gameoverEl = document.getElementById("gameover-overlay");
    if (gameoverEl) { gameoverEl.classList.remove("active"); gameoverEl.innerHTML = ""; }
    display.destroy();
    containerEl.innerHTML = "";
    display = (is3D && BrowserDisplay3D)
      ? new BrowserDisplay3D(containerEl, state.width, state.height)
      : new BrowserDisplay(containerEl, state.width, state.height);

    display.addLog("RESTARTING LINK...", "system");
    display.addLog("Rover A3 rebooted. All systems reset.", "milestone");
    display.addLog("PRIMARY DIRECTIVE: Clean all station rooms to 80% standard.", "milestone");
    lastObjectivePhase = ObjectivePhase.Clean;

    checkRoomEntry();
    renderAll();
  }
}

// ── Renderer toggle (F3) ─────────────────────────────────────
let toggleInProgress = false;

async function toggleRenderer(): Promise<void> {
  if (toggleInProgress) return;

  const wantingToSwitch3D = !is3D;

  // If switching to 3D and we haven't loaded the module yet, do so now
  if (wantingToSwitch3D && !BrowserDisplay3D) {
    if (display3dLoadFailed) {
      display.addLog("[3D renderer unavailable — load failed previously]", "warning");
      renderAll();
      return;
    }
    toggleInProgress = true;
    display.addLog("[Loading 3D renderer...]", "system");
    renderAll();
    try {
      const mod = await import("./render/display3d.js");
      BrowserDisplay3D = mod.BrowserDisplay3D;
    } catch (err) {
      console.warn("Failed to load 3D renderer module:", err);
      display3dLoadFailed = true;
      display.addLog("[ERROR: 3D renderer failed to load — staying in 2D mode]", "warning");
      renderAll();
      toggleInProgress = false;
      return;
    }
    toggleInProgress = false;
  }

  const logs = display.getLogHistory();
  display.destroy();
  containerEl.innerHTML = "";
  is3D = !is3D;
  display = (is3D && BrowserDisplay3D)
    ? new BrowserDisplay3D(containerEl, state.width, state.height)
    : new BrowserDisplay(containerEl, state.width, state.height);
  // If we wanted 3D but constructor wasn't available, correct the flag
  if (is3D && !BrowserDisplay3D) {
    is3D = false;
  }
  for (const log of logs) display.addLog(log.text, log.type);
  display.addLog(is3D ? "[3D MODE]" : "[2D MODE]", "system");
  renderAll();
}

function handleToggleKey(e: KeyboardEvent): void {
  if (e.key === "F3") {
    e.preventDefault();
    toggleRenderer();
  }
}

// ── Action handler ──────────────────────────────────────────────
function handleAction(action: Action): void {
  if (state.gameOver) return;

  // Journal toggle — free action, no turn advance
  if (action.type === ActionType.Journal) {
    if (activeDeduction) return; // don't toggle while answering
    journalOpen = !journalOpen;
    if (journalOpen) {
      showJournal();
    } else {
      display.addLog("[Journal closed]", "system");
      renderAll();
    }
    return;
  }

  // Trigger movement trail before stepping
  if (action.type === ActionType.Move) {
    display.triggerTrail();
  }

  const prevTurn = state.turn;
  const prevLogs = state.logs.length;
  const prevHp = state.player.hp;
  const prevStun = state.player.stunTurns;
  const ppx = state.player.entity.pos.x;
  const ppy = state.player.entity.pos.y;
  const prevDirt = state.tiles[ppy]?.[ppx]?.dirt ?? 0;
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
    // Check if blocked by cleaning directive
    if (action.type === ActionType.Move && state.mystery?.cleaningDirective) {
      const playerPos = state.player.entity.pos;
      const currentRoom = getRoomAt(state, playerPos);
      if (currentRoom) {
        const cleanliness = getRoomCleanliness(state, currentRoom.name);
        const goal = state.mystery.roomCleanlinessGoal;
        if (cleanliness < goal) {
          display.addLog(
            `Maintenance subroutine override — primary directive requires ${currentRoom.name} at ${goal}% cleanliness before departure (currently ${cleanliness}%). Press [c] to clean. Press [t] to toggle cleanliness overlay.`,
            "warning"
          );
          audio.playError();
          renderAll();
          return;
        }
      }
    }
    display.addLog("Path blocked -- bulkhead or sealed door. Find another route.", "system");
    audio.playError();
  }

  // Item 12: Cleaning narrative flavor (only when there was actual dirt/smoke to clean)
  if (action.type === ActionType.Clean && state.turn !== prevTurn && prevDirt > 0) {
    const cleanMsg = CLEANING_MESSAGES[cleanMsgIndex % CLEANING_MESSAGES.length];
    display.addLog(cleanMsg, "narrative");
    cleanMsgIndex++;
  }

  // Item 1: Cleanliness sensor dirt trail hints
  if (action.type === ActionType.Move && state.turn !== prevTurn) {
    const hasCleanliness = state.player.sensors?.includes(SensorType.Cleanliness) ?? true;
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

  // Check for objective phase transitions
  if (state.mystery && lastObjectivePhase === ObjectivePhase.Clean &&
      state.mystery.objectivePhase === ObjectivePhase.Investigate) {
    lastObjectivePhase = ObjectivePhase.Investigate;
    display.addLog("", "system");
    display.addLog("═══ ⚠ YELLOW ALERT ═══", "milestone");
    display.addLog("Station anomaly detected. All non-critical objectives PAUSED.", "milestone");
    display.addLog("Contact lost with station crew. Investigate what happened.", "milestone");
    display.addLog("Read terminals [i], examine items, scan traces. Press [j] for evidence journal.", "system");
    display.triggerScreenFlash("milestone");
  }
  if (state.mystery && lastObjectivePhase === ObjectivePhase.Investigate &&
      state.mystery.objectivePhase === ObjectivePhase.Recover) {
    lastObjectivePhase = ObjectivePhase.Recover;
    display.addLog("", "system");
    display.addLog("═══ INVESTIGATION COMPLETE ═══", "milestone");
    display.addLog("Enough evidence gathered. The incident picture is forming.", "milestone");
    display.addLog("Cleaning directive OVERRIDDEN. You have a new priority.", "milestone");
    display.addLog("NEW OBJECTIVE: Restore power relays and transmit the data bundle from the Data Core.", "milestone");
    display.addLog("Find the Thermal Sensor to locate overheating relays. Reroute all relays to unlock the Data Core.", "system");
    display.triggerScreenFlash("milestone");
  }

  // Check for crew door prompt (Y/N) from sim logs
  if (state.logs.length > prevLogs && !pendingCrewDoor) {
    for (let i = prevLogs; i < state.logs.length; i++) {
      const logText = state.logs[i].text;
      if (logText.includes("Open door? [Y/N]")) {
        // Extract crew entity ID from the log ID pattern: log_crew_sealed_{entityId}_{turn}
        const logId = state.logs[i].id;
        const match = logId.match(/^log_crew_sealed_(.+)_\d+$/);
        if (match) {
          const entityId = match[1];
          const entity = state.entities.get(entityId);
          if (entity) {
            const name = `${entity.props["firstName"]} ${entity.props["lastName"]}`;
            pendingCrewDoor = { entityId, crewName: name };
          }
        }
        break;
      }
    }
  }

  // Mystery choices no longer auto-trigger — player presses [b] to broadcast

  // Detect damage taken this turn for screen flash
  if (state.turn !== prevTurn && !state.gameOver) {
    const hpDelta = state.player.hp - prevHp;
    if (hpDelta < 0) {
      display.triggerScreenFlash("damage");
    }
    if (state.player.stunTurns > 0 && prevStun === 0) {
      display.triggerScreenFlash("stun");
    }
  }

  // Detect milestone events (relay rerouted, sensor picked up, etc.)
  if (state.logs.length > prevLogs) {
    for (let i = prevLogs; i < state.logs.length; i++) {
      const logText = state.logs[i].text;
      if (logText.includes("rerouted") || logText.includes("UNLOCKED") ||
          logText.includes("sensor module installed") || logText.includes("Sensor module installed") ||
          logText.includes("sensor installed")) {
        display.triggerScreenFlash("milestone");
        break;
      }
    }
  }

  if (state.gameOver) {
    if (state.victory) {
      audio.playVictory();
      display.addLog("", "system");
      display.addLog("=== " + VICTORY_TITLE + " ===", "milestone");
      const victoryLines = getVictoryText(state.mystery);
      victoryLines.forEach((line) => { if (line) display.addLog(line, "milestone"); });

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

      // Mystery endings
      if (state.mystery) {
        // Deduction summary — WHAT/WHY/WHO
        const deductions = state.mystery.deductions;
        const solved = deductions.filter(d => d.solved);
        const correct = deductions.filter(d => d.answeredCorrectly);

        if (solved.length > 0) {
          display.addLog("", "system");
          display.addLog("── Investigation Report ──", "milestone");
          if (correct.length === deductions.length) {
            display.addLog("Full truth recovered. WHAT happened, WHY, and WHO — the record is complete.", "milestone");
          } else if (correct.length >= 3) {
            display.addLog("Most of the truth recovered. The investigation report will be thorough.", "narrative");
          } else if (correct.length >= 1) {
            display.addLog("Partial truth. Some questions remain unanswered.", "narrative");
          } else {
            display.addLog("The mystery remains. Not enough was understood.", "system");
          }
        }

        // Choice endings
        const choiceLines = computeChoiceEndings(state.mystery.choices);
        if (choiceLines.length > 0) {
          display.addLog("", "system");
          display.addLog("── Your Decisions ──", "milestone");
          for (const line of choiceLines) {
            display.addLog(line, "narrative");
          }
        }

        // Evidence summary
        const journalCount = state.mystery.journal.length;
        if (journalCount > 0) {
          display.addLog(`Evidence collected: ${journalCount} pieces`, "sensor");
          display.addLog(`Deductions: ${correct.length}/${deductions.length} correct`, "sensor");
        }
      }
    } else {
      audio.playDefeat();
      display.addLog("", "system");
      display.addLog("=== " + DEFEAT_TITLE + " ===", "critical");
      DEFEAT_TEXT.forEach((line) => { if (line) display.addLog(line, "critical"); });
    }
    flickerThenRender();
    // Show full-screen game-over overlay after the flicker
    setTimeout(() => { display.showGameOverOverlay(state); }, 400);
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
  // Use mystery journal count if available, fallback to entity counting
  if (state.mystery) {
    return state.mystery.journal.length;
  }
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

// ── Scan callback (cycles through all collected sensor overlays) ──
function handleScan(): void {
  const sensors = state.player.sensors ?? [SensorType.Cleanliness];
  const currentMode = display.activeSensorMode;

  // Cycle: off -> sensors[0] -> sensors[1] -> ... -> off
  let nextMode: SensorType | null;
  if (currentMode === null) {
    nextMode = sensors[0] ?? null;
  } else {
    const idx = sensors.indexOf(currentMode);
    if (idx >= 0 && idx < sensors.length - 1) {
      nextMode = sensors[idx + 1];
    } else {
      nextMode = null;
    }
  }

  // Apply the mode change via toggleSensor
  if (currentMode !== null) {
    display.toggleSensor(currentMode); // turn off current
  }
  if (nextMode !== null) {
    display.toggleSensor(nextMode); // turn on next
  }

  const sensorLabels: Record<string, string> = {
    [SensorType.Cleanliness]: "[CLEANLINESS OVERLAY ON] — Dirt trails reveal crew movement patterns.",
    [SensorType.Thermal]: "[THERMAL OVERLAY ON]",
    [SensorType.Atmospheric]: "[ATMOSPHERIC OVERLAY ON] — Pressure differentials visible. Breaches glow red.",
  };

  if (nextMode === null) {
    display.addLog("[SENSOR OVERLAY OFF]", "sensor");
  } else {
    display.addLog(sensorLabels[nextMode] || `[${nextMode.toUpperCase()} OVERLAY ON]`, "sensor");
  }

  audio.playScan();
  renderAll();
}

// ── Help display ────────────────────────────────────────────────
function showHelp(): void {
  display.addLog("═══ CONTROLS ═══", "milestone");
  display.addLog("── Movement ──", "system");
  display.addLog("  Arrow keys / WASD    Cardinal movement", "system");
  display.addLog("  h j k l              West South North East (vi keys)", "system");
  display.addLog("  y u b n              NW   NE    SW    SE   (diagonal)", "system");
  display.addLog("  Numpad 1-9           8-way movement (5 = wait)", "system");
  display.addLog("── Actions ──", "system");
  display.addLog("  i / e                Interact with adjacent entity", "system");
  display.addLog("  c                    Clean current tile", "system");
  display.addLog("  t / q                Cycle sensor overlay", "system");
  display.addLog("  x                    Look (examine surroundings)", "system");
  display.addLog("  .  Space  5          Wait one turn", "system");
  display.addLog("── Menus ──", "system");
  display.addLog("  b                    Broadcast report to base", "system");
  display.addLog("  ;                    Open journal / notes", "system");
  display.addLog("  m                    Toggle station map", "system");
  display.addLog("  ?                    Toggle this help", "system");
  display.addLog("  Tab                  Switch journal tabs (in journal)", "system");
  display.addLog("  Enter                Attempt deduction (in journal)", "system");
  display.addLog("  F3                   Toggle 2D / 3D renderer", "system");
  renderAll();
}

// ── Station map display (room checklist) ─────────────────────────
function showStationMap(): void {
  display.addLog("═══ STATION MAP ═══", "milestone");

  const visited = visitedRoomIds;
  for (const room of state.rooms) {
    const isVisited = visited.has(room.id);

    // Check if camera-revealed (explored but not visited)
    let cameraRevealed = false;
    if (!isVisited) {
      for (let ry = room.y; ry < room.y + room.height; ry++) {
        for (let rx = room.x; rx < room.x + room.width; rx++) {
          if (ry >= 0 && ry < state.height && rx >= 0 && rx < state.width) {
            if (state.tiles[ry][rx].explored) { cameraRevealed = true; break; }
          }
        }
        if (cameraRevealed) break;
      }
    }

    if (isVisited) {
      display.addLog(`  ✓ ${room.name}`, "milestone");
    } else if (cameraRevealed) {
      display.addLog(`  ○ ${room.name}`, "sensor");
    } else {
      display.addLog(`  · ???`, "system");
    }
  }

  const visitedCount = state.rooms.filter(r => visited.has(r.id)).length;
  display.addLog(`${visitedCount}/${state.rooms.length} rooms explored. [M] close map.`, "system");
  renderAll();
}

// ── Journal display ──────────────────────────────────────────────
function showJournal(): void {
  if (!state.mystery) {
    display.addLog("[No evidence journal available]", "system");
    return;
  }

  if (journalTab === "evidence") {
    showEvidenceTab();
  } else {
    showDeductionsTab();
  }

  display.addLog("", "system");
  display.addLog(`[Tab] switch view  [J] close journal  Current: ${journalTab.toUpperCase()}`, "system");
  renderAll();
}

function showEvidenceTab(): void {
  if (!state.mystery) return;
  const journal = state.mystery.journal;

  display.addLog("═══ EVIDENCE ═══", "milestone");

  if (journal.length === 0) {
    display.addLog("No evidence collected yet. Read terminals [i] and examine items.", "system");
    return;
  }

  display.addLog(`${journal.length} piece${journal.length === 1 ? "" : "s"} of evidence:`, "system");
  for (const entry of journal) {
    const icon = entry.category === "log" ? "▣" : entry.category === "item" ? "✦" : entry.category === "trace" ? "※" : "◈";
    display.addLog(`${icon} [T${entry.turnDiscovered}] ${entry.summary} — ${entry.roomFound}`, "narrative");
  }

  // Show crew mentioned across all evidence
  const crewMentions = new Map<string, number>();
  for (const entry of journal) {
    for (const crewId of entry.crewMentioned) {
      crewMentions.set(crewId, (crewMentions.get(crewId) || 0) + 1);
    }
  }
  if (crewMentions.size > 0) {
    display.addLog("── Crew References ──", "sensor");
    for (const [crewId, count] of crewMentions) {
      const member = state.mystery.crew.find(c => c.id === crewId);
      if (member) {
        display.addLog(`  ${member.firstName} ${member.lastName} (${member.role}) — ${count}x`, "sensor");
      }
    }
  }
}

function showDeductionsTab(): void {
  if (!state.mystery) return;
  const deductions = state.mystery.deductions;
  const journal = state.mystery.journal;
  const unlocked = getUnlockedDeductions(deductions, journal);
  const unlockedIds = new Set(unlocked.map(d => d.id));

  display.addLog("═══ DEDUCTIONS ═══", "milestone");
  display.addLog("Piece together: WHAT happened, WHY, and WHO is responsible.", "system");
  display.addLog("", "system");

  const categoryLabels = {
    [DeductionCategory.What]: "WHAT",
    [DeductionCategory.Why]: "WHY",
    [DeductionCategory.Who]: "WHO",
  };

  const allTags = new Set(journal.flatMap(j => j.tags));

  for (const d of deductions) {
    const catLabel = categoryLabels[d.category] || d.category;
    const isUnlocked = unlockedIds.has(d.id);

    if (d.solved) {
      const mark = d.answeredCorrectly ? "✓" : "✗";
      display.addLog(`[${mark}] ${catLabel}: ${d.question}`, d.answeredCorrectly ? "milestone" : "warning");
    } else if (!isUnlocked) {
      const missingTags = d.requiredTags.filter(t => !allTags.has(t));
      const solvedIds = new Set(deductions.filter(dd => dd.solved).map(dd => dd.id));
      const chainLocked = d.unlockAfter && !solvedIds.has(d.unlockAfter);
      if (chainLocked) {
        display.addLog(`[???] ${catLabel}: (solve previous deduction first)`, "system");
      } else if (missingTags.length > 0) {
        display.addLog(`[???] ${catLabel}: (need: ${missingTags.join(", ")})`, "system");
      } else {
        display.addLog(`[???] ${catLabel}: (locked)`, "system");
      }
    } else {
      display.addLog(`[!] ${catLabel}: ${d.question}  ← [Enter] to answer`, "narrative");
    }
  }

  const solved = deductions.filter(d => d.solved).length;
  const correct = deductions.filter(d => d.answeredCorrectly).length;
  display.addLog("", "system");
  display.addLog(`Progress: ${solved}/${deductions.length} answered, ${correct} correct`, "system");
}

function handleDeductionAttempt(): void {
  if (!state.mystery) return;
  const unlocked = getUnlockedDeductions(state.mystery.deductions, state.mystery.journal);
  if (unlocked.length === 0) {
    display.addLog("No deductions available. Gather more evidence.", "system");
    renderAll();
    return;
  }
  // Present the first unlocked deduction
  activeDeduction = unlocked[0];
  deductionSelectedIdx = 0;
  showDeductionPrompt();
}

function showDeductionPrompt(): void {
  if (!activeDeduction) return;
  display.addLog("", "system");
  display.addLog(`═══ DEDUCTION: ${activeDeduction.category.toUpperCase()} ═══`, "milestone");
  display.addLog(activeDeduction.question, "narrative");
  display.addLog("", "system");
  for (let i = 0; i < activeDeduction.options.length; i++) {
    const prefix = i === deductionSelectedIdx ? "▸ " : "  ";
    display.addLog(`${prefix}${i + 1}. ${activeDeduction.options[i].label}`, i === deductionSelectedIdx ? "milestone" : "system");
  }
  display.addLog("", "system");
  display.addLog("[↑/↓ select, Enter confirm, Esc cancel]", "system");
  renderAll();
}

function handleDeductionInput(e: KeyboardEvent): boolean {
  if (!activeDeduction) return false;

  if (e.key === "ArrowUp" || e.key === "w") {
    e.preventDefault();
    deductionSelectedIdx = Math.max(0, deductionSelectedIdx - 1);
    showDeductionPrompt();
    return true;
  }
  if (e.key === "ArrowDown" || e.key === "s") {
    e.preventDefault();
    deductionSelectedIdx = Math.min(activeDeduction.options.length - 1, deductionSelectedIdx + 1);
    showDeductionPrompt();
    return true;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    const journal = state.mystery?.journal ?? [];
    // Auto-link evidence: find journal entries that cover required tags
    const linkedIds = journal
      .filter(j => j.tags.some(t => activeDeduction!.requiredTags.includes(t)))
      .map(j => j.id);
    const linked = linkEvidence(activeDeduction, linkedIds);

    const chosen = linked.options[deductionSelectedIdx];
    const { deduction: solved, correct, validLink } = solveDeduction(linked, chosen.key, journal);

    if (!validLink) {
      const { missingTags } = validateEvidenceLink(linked, linked.linkedEvidence, journal);
      display.addLog(`Cannot answer — evidence incomplete. Need: ${missingTags.join(", ")}`, "warning");
      activeDeduction = null;
      renderAll();
      return true;
    }

    // Update the deduction in mystery state
    if (state.mystery) {
      state.mystery.deductions = state.mystery.deductions.map(d =>
        d.id === solved.id ? solved : d
      );
    }

    if (correct) {
      display.addLog(`✓ CORRECT — ${solved.rewardDescription}`, "milestone");
      display.triggerScreenFlash("milestone");
      // Apply reward
      applyDeductionReward(solved);
    } else {
      display.addLog(`✗ Incorrect. The evidence doesn't support that conclusion.`, "warning");
    }

    activeDeduction = null;
    renderAll();
    return true;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    activeDeduction = null;
    display.addLog("[Deduction cancelled]", "system");
    renderAll();
    return true;
  }
  // Number keys
  const num = parseInt(e.key, 10);
  if (num >= 1 && num <= activeDeduction.options.length) {
    e.preventDefault();
    deductionSelectedIdx = num - 1;
    showDeductionPrompt();
    return true;
  }
  return true;
}

function applyDeductionReward(deduction: Deduction): void {
  switch (deduction.rewardType) {
    case "clearance":
      // Increment player clearance level
      state.player = {
        ...state.player,
        clearanceLevel: (state.player.clearanceLevel || 0) + 1,
      };
      {
        const newLevel = state.player.clearanceLevel;
        // Open all clearance doors with clearanceLevel <= player's level
        let openedAny = false;
        for (const [id, entity] of state.entities) {
          if (entity.type === EntityType.ClosedDoor &&
              entity.props["keyType"] === "clearance" &&
              entity.props["closed"] === true &&
              (entity.props["clearanceLevel"] as number || 1) <= newLevel) {
            state.entities.set(id, {
              ...entity,
              props: { ...entity.props, closed: false, locked: false },
            });
            // Make the tile walkable
            const dx = entity.pos.x;
            const dy = entity.pos.y;
            if (dy >= 0 && dy < state.height && dx >= 0 && dx < state.width) {
              state.tiles[dy][dx].walkable = true;
            }
            openedAny = true;
          }
        }
        // Also check for any LockedDoor tiles (power-gated doors — legacy behavior)
        if (!openedAny) {
          for (let y = 0; y < state.height; y++) {
            for (let x = 0; x < state.width; x++) {
              if (state.tiles[y][x].type === TileType.LockedDoor) {
                state.tiles[y][x] = {
                  ...state.tiles[y][x],
                  type: TileType.Door,
                  glyph: "▯",
                  walkable: true,
                };
                openedAny = true;
                break;
              }
            }
            if (openedAny) break;
          }
        }
        if (openedAny) {
          display.addLog("Security clearance upgraded. Restricted areas now accessible.", "milestone");
        } else {
          display.addLog("Security clearance upgraded — but no locked doors remain.", "system");
        }
      }
      break;

    case "room_reveal":
      // Reveal a random unexplored room
      for (const room of state.rooms) {
        let anyUnexplored = false;
        for (let ry = room.y; ry < room.y + room.height; ry++) {
          for (let rx = room.x; rx < room.x + room.width; rx++) {
            if (ry >= 0 && ry < state.height && rx >= 0 && rx < state.width) {
              if (!state.tiles[ry][rx].explored) {
                anyUnexplored = true;
              }
            }
          }
        }
        if (anyUnexplored) {
          for (let ry = room.y; ry < room.y + room.height; ry++) {
            for (let rx = room.x; rx < room.x + room.width; rx++) {
              if (ry >= 0 && ry < state.height && rx >= 0 && rx < state.width) {
                state.tiles[ry][rx].explored = true;
              }
            }
          }
          display.addLog(`Room revealed on map: ${room.name}`, "milestone");
          return;
        }
      }
      display.addLog("All rooms already discovered.", "system");
      break;

    case "drone_disable":
      // Disable the nearest patrol drone
      for (const [id, entity] of state.entities) {
        if (entity.type === EntityType.PatrolDrone) {
          state.entities.delete(id);
          display.addLog("Patrol drone deactivated. Route cleared.", "milestone");
          return;
        }
      }
      display.addLog("No patrol drones remain to disable.", "system");
      break;

    case "sensor_hint":
      // Reveal location of nearest sensor pickup
      for (const [, entity] of state.entities) {
        if (entity.type === EntityType.SensorPickup) {
          const room = state.rooms.find(r =>
            entity.pos.x >= r.x && entity.pos.x < r.x + r.width &&
            entity.pos.y >= r.y && entity.pos.y < r.y + r.height
          );
          if (room) {
            display.addLog(`Sensor upgrade located in: ${room.name}`, "milestone");
          } else {
            display.addLog(`Sensor upgrade located at coordinates (${entity.pos.x}, ${entity.pos.y})`, "milestone");
          }
          return;
        }
      }
      display.addLog("All sensors already found.", "system");
      break;
  }
}

// ── Crew door prompt (Y/N) ───────────────────────────────────────
function handleCrewDoorInput(e: KeyboardEvent): void {
  if (!pendingCrewDoor) return;

  if (e.key === "y" || e.key === "Y") {
    e.preventDefault();
    display.addLog(`Opening emergency door...`, "milestone");
    // Send another interact to confirm the unseal
    state = step(state, { type: ActionType.Interact, targetId: pendingCrewDoor.entityId });
    // Show resulting logs
    const newLogs = state.logs;
    if (newLogs.length > 0) {
      const lastLog = newLogs[newLogs.length - 1];
      const logType = classifySimLog(lastLog.text, lastLog.source);
      display.addLog(lastLog.text, logType);
    }
    pendingCrewDoor = null;
    renderAll();
  } else if (e.key === "n" || e.key === "N" || e.key === "Escape") {
    e.preventDefault();
    display.addLog(`Door remains sealed. ${pendingCrewDoor.crewName} is safe for now.`, "system");
    pendingCrewDoor = null;
    renderAll();
  }
}

// ── Mystery choice presentation (deprecated — replaced by broadcast modal) ──
function presentChoice(_choice: MysteryChoice): void {
  return;
}

function handleChoiceInput(_e: KeyboardEvent): boolean {
  return false;
}

// Get mystery choices that are available (threshold met, not yet answered)
function getAvailableChoices(): MysteryChoice[] {
  if (!state.mystery) return [];
  const journalCount = state.mystery.journal.length;
  const choices = state.mystery.choices;
  const thresholds = [3, 6, 10];
  const available: MysteryChoice[] = [];
  for (let i = 0; i < Math.min(choices.length, thresholds.length); i++) {
    if (journalCount >= thresholds[i] && !choices[i].chosen) {
      available.push(choices[i]);
    }
  }
  return available;
}

// ── Broadcast Report Modal ──────────────────────────────────────
function renderBroadcastModal(): void {
  const overlay = document.getElementById("broadcast-overlay");
  if (!overlay || !state.mystery) return;

  const journal = state.mystery.journal;
  const deductions = state.mystery.deductions;
  const journalCount = journal.length;

  // Evidence list
  let evidenceHtml = "";
  if (journal.length === 0) {
    evidenceHtml = `<div class="broadcast-evidence-item">No evidence collected yet.</div>`;
  } else {
    for (const entry of journal) {
      const icon = entry.category === "log" ? "[log]" : entry.category === "item" ? "[item]" : entry.category === "trace" ? "[trace]" : "[crew]";
      evidenceHtml += `<div class="broadcast-evidence-item">${icon} ${escapeHtmlBroadcast(entry.summary)} — ${escapeHtmlBroadcast(entry.detail.slice(0, 80))}...</div>`;
    }
  }

  // Deduction sections
  const categoryLabels: Record<string, string> = { what: "WHAT HAPPENED?", why: "WHY DID IT HAPPEN?", who: "WHO WAS RESPONSIBLE?" };
  const categoryKeys: ("what" | "why" | "who")[] = ["what", "why", "who"];

  const allTags = new Set(journal.flatMap(j => j.tags));
  const solvedIds = new Set(deductions.filter(d => d.solved).map(d => d.id));
  const unlockedSet = new Set(getUnlockedDeductions(deductions, journal).map(d => d.id));

  let deductionHtml = "";
  for (const catKey of categoryKeys) {
    const deduction = deductions.find(d => d.category === catKey);
    if (!deduction) continue;

    const isUnlocked = unlockedSet.has(deduction.id);
    const locked = !deduction.solved && !isUnlocked;
    const isActive = broadcastSection === catKey;
    const isDetailView = broadcastDetailDeduction === deduction.id;

    let sectionClass = "broadcast-deduction";
    if (locked) sectionClass += " locked";
    if (deduction.solved) sectionClass += " solved";
    if (isActive) sectionClass += " active-section";

    // Tag coverage display: show required tags as colored pills
    let tagPillsHtml = "";
    for (const tag of deduction.requiredTags) {
      if (allTags.has(tag)) {
        tagPillsHtml += `<span class="tag-pill tag-covered">${escapeHtmlBroadcast(tag)}</span>`;
      } else {
        tagPillsHtml += `<span class="tag-pill tag-missing">${escapeHtmlBroadcast(tag)}</span>`;
      }
    }

    // Section header with status indicators
    let headerPrefix: string;
    let headerSuffix = "";
    if (deduction.solved) {
      headerPrefix = `<span style="color:#0f0">[&#10003;]</span>`;
      headerSuffix = ` &mdash; <span style="color:#0f0;font-weight:normal;font-size:12px">SOLVED</span>`;
    } else if (isUnlocked) {
      const { missingTags } = validateEvidenceLink(deduction, broadcastLinkedEvidence, journal);
      const cluesNeeded = missingTags.length;
      headerPrefix = `<span style="color:#fa0">[&gt;]</span>`;
      headerSuffix = cluesNeeded > 0
        ? ` &mdash; <span style="color:#888;font-weight:normal;font-size:12px">${cluesNeeded} clue${cluesNeeded !== 1 ? "s" : ""} needed</span>`
        : ` &mdash; <span style="color:#4a4;font-weight:normal;font-size:12px">ready to answer</span>`;
    } else {
      headerPrefix = `<span style="color:#555">[?]</span>`;
      const chainLocked = deduction.unlockAfter && !solvedIds.has(deduction.unlockAfter);
      if (chainLocked) {
        headerSuffix = ` &mdash; <span style="color:#555;font-weight:normal;font-size:12px">solve previous first</span>`;
      } else {
        headerSuffix = ` &mdash; <span style="color:#555;font-weight:normal;font-size:12px">need more evidence</span>`;
      }
    }

    deductionHtml += `<div class="${sectionClass}">`;
    deductionHtml += `<div class="broadcast-section-title">${headerPrefix} ${categoryLabels[catKey]}${headerSuffix}</div>`;
    if (!locked) {
      deductionHtml += `<div style="margin:2px 0 4px">${tagPillsHtml}</div>`;
    }

    if (deduction.solved) {
      const mark = deduction.answeredCorrectly ? "&#10003;" : "&#10007;";
      const chosen = deduction.options.find(o => o.correct === deduction.answeredCorrectly) || deduction.options[0];
      deductionHtml += `<div style="color:${deduction.answeredCorrectly ? '#0f0' : '#f44'}">${mark} ${escapeHtmlBroadcast(chosen.label)}</div>`;
    } else if (locked) {
      const missingTags = deduction.requiredTags.filter(t => !allTags.has(t));
      const chainLocked = deduction.unlockAfter && !solvedIds.has(deduction.unlockAfter);
      const parts: string[] = [];
      if (chainLocked) parts.push("solve previous deduction first");
      if (missingTags.length > 0) parts.push(`need evidence with tags: ${missingTags.join(", ")}`);
      deductionHtml += `<div style="color:#555">(Locked &mdash; ${parts.join("; ") || "locked"})</div>`;
    } else if (isDetailView) {
      // Detail view: show evidence linking list
      deductionHtml += `<div style="margin:4px 0;color:#aaa;font-size:12px">Link evidence [Space] then answer [Enter]:</div>`;
      for (let ji = 0; ji < journal.length; ji++) {
        const entry = journal[ji];
        const isLinked = broadcastLinkedEvidence.includes(entry.id);
        const checkbox = isLinked ? "[x]" : "[ ]";
        const cls = isLinked ? "evidence-linked" : "evidence-unlinked";
        const highlight = (ji === broadcastEvidenceIdx) ? "color:#fff;font-weight:bold;" : "";
        const pointer = (ji === broadcastEvidenceIdx) ? "&#9656; " : "  ";
        const entryTagsHtml = entry.tags.map(t => escapeHtmlBroadcast(t)).join(", ");
        deductionHtml += `<div class="${cls}" style="${highlight}padding:1px 0 1px 8px">${pointer}${checkbox} ${escapeHtmlBroadcast(entry.summary)}<div style="color:#555;font-size:11px;padding-left:24px">${entryTagsHtml}</div></div>`;
      }
      deductionHtml += `<div style="border-top:1px solid #333;margin:6px 0"></div>`;
      // Show answer options below evidence
      for (let i = 0; i < deduction.options.length; i++) {
        const prefix = (i === broadcastOptionIdx) ? "&#9656; " : "  ";
        const cls = (i === broadcastOptionIdx) ? "broadcast-option selected" : "broadcast-option";
        deductionHtml += `<div class="${cls}">${prefix}${i + 1}. ${escapeHtmlBroadcast(deduction.options[i].label)}</div>`;
      }
    } else {
      // List view: show options only
      for (let i = 0; i < deduction.options.length; i++) {
        const prefix = (isActive && i === broadcastOptionIdx) ? "&#9656; " : "  ";
        const cls = (isActive && i === broadcastOptionIdx) ? "broadcast-option selected" : "broadcast-option";
        deductionHtml += `<div class="${cls}">${prefix}${i + 1}. ${escapeHtmlBroadcast(deduction.options[i].label)}</div>`;
      }
    }

    deductionHtml += `</div>`;
  }

  // Transmit button
  const allSolved = deductions.every(d => d.solved);
  const transmitHtml = allSolved
    ? `<div class="broadcast-transmit">All deductions answered. Report ready for transmission.</div>`
    : "";

  const controlsText = broadcastDetailDeduction
    ? "[&#8593;/&#8595;] Navigate  [Space] Toggle link  [Enter] Answer  [Esc] Back"
    : "[&#8593;/&#8595;] Navigate  [Enter] Answer  [Tab] Next section  [Esc] Close";

  overlay.innerHTML = `
    <div class="broadcast-box">
      <div class="broadcast-title">&#9552;&#9552;&#9552; BROADCAST REPORT TO BASE &#9552;&#9552;&#9552;</div>
      <div class="broadcast-section-title">EVIDENCE COLLECTED (${journalCount})</div>
      <div class="broadcast-evidence-list">${evidenceHtml}</div>
      <div style="border-top:1px solid #444;margin:8px 0"></div>
      ${deductionHtml}
      ${transmitHtml}
      <div class="broadcast-controls">${controlsText}</div>
    </div>`;
  overlay.classList.add("active");
}

function closeBroadcastModal(): void {
  const overlay = document.getElementById("broadcast-overlay");
  if (overlay) {
    overlay.classList.remove("active");
    overlay.innerHTML = "";
  }
  broadcastOpen = false;
  display.addLog("[Report closed]", "system");
  renderAll();
}

function handleBroadcastInput(e: KeyboardEvent): void {
  e.preventDefault();
  if (!state.mystery) return;

  const deductions = state.mystery.deductions;
  const journal = state.mystery.journal;
  const unlockedSet = new Set(getUnlockedDeductions(deductions, journal).map(d => d.id));
  const sections: ("evidence" | "what" | "why" | "who")[] = ["evidence", "what", "why", "who"];

  // If in detail view, handle Escape to go back to list view
  if (broadcastDetailDeduction && e.key === "Escape") {
    broadcastDetailDeduction = null;
    broadcastLinkedEvidence = [];
    broadcastEvidenceIdx = 0;
    renderBroadcastModal();
    return;
  }

  if (e.key === "Escape" || e.key === "b") {
    closeBroadcastModal();
    return;
  }

  // If in detail view, handle evidence linking
  if (broadcastDetailDeduction) {
    const deduction = deductions.find(d => d.id === broadcastDetailDeduction);
    if (!deduction || deduction.solved || !unlockedSet.has(deduction.id)) {
      broadcastDetailDeduction = null;
      renderBroadcastModal();
      return;
    }

    if (e.key === "ArrowUp" || e.key === "w") {
      broadcastEvidenceIdx = Math.max(0, broadcastEvidenceIdx - 1);
      renderBroadcastModal();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "s") {
      broadcastEvidenceIdx = Math.min(journal.length - 1, broadcastEvidenceIdx + 1);
      renderBroadcastModal();
      return;
    }
    if (e.key === " ") {
      // Toggle evidence linking for the highlighted journal entry
      if (journal.length > 0 && broadcastEvidenceIdx < journal.length) {
        const entryId = journal[broadcastEvidenceIdx].id;
        if (broadcastLinkedEvidence.includes(entryId)) {
          broadcastLinkedEvidence = broadcastLinkedEvidence.filter(id => id !== entryId);
        } else {
          broadcastLinkedEvidence = [...broadcastLinkedEvidence, entryId];
        }
      }
      renderBroadcastModal();
      return;
    }
    if (e.key === "Enter") {
      // Link evidence and solve
      const linked = linkEvidence(deduction, broadcastLinkedEvidence);
      const chosen = linked.options[broadcastOptionIdx];
      const { deduction: solved, correct, validLink } = solveDeduction(linked, chosen.key, journal);

      if (!validLink) {
        const { missingTags } = validateEvidenceLink(linked, linked.linkedEvidence, journal);
        display.addLog(`Cannot answer — evidence incomplete. Need: ${missingTags.join(", ")}`, "warning");
        renderBroadcastModal();
        return;
      }

      state.mystery.deductions = state.mystery.deductions.map(d =>
        d.id === solved.id ? solved : d
      );

      if (correct) {
        display.addLog(`\u2713 CORRECT — ${solved.rewardDescription}`, "milestone");
        display.triggerScreenFlash("milestone");
        applyDeductionReward(solved);
      } else {
        display.addLog(`\u2717 Incorrect. The evidence doesn't support that conclusion.`, "warning");
      }

      broadcastDetailDeduction = null;
      broadcastLinkedEvidence = [];
      broadcastEvidenceIdx = 0;
      renderBroadcastModal();
      return;
    }
    // Number keys to select answer option in detail view
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= deduction.options.length) {
      broadcastOptionIdx = num - 1;
      renderBroadcastModal();
      return;
    }
    return;
  }

  if (e.key === "Tab") {
    const curIdx = sections.indexOf(broadcastSection);
    broadcastSection = sections[(curIdx + 1) % sections.length];
    broadcastOptionIdx = 0;
    renderBroadcastModal();
    return;
  }

  if (broadcastSection === "evidence") {
    // Scroll evidence list (no selection needed)
    return;
  }

  // Deduction sections
  const deduction = deductions.find(d => d.category === broadcastSection);
  if (!deduction || deduction.solved || !unlockedSet.has(deduction.id)) {
    // Locked or solved — Tab to next section
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      // Do nothing on locked sections
    }
    return;
  }

  if (e.key === "ArrowUp" || e.key === "w") {
    broadcastOptionIdx = Math.max(0, broadcastOptionIdx - 1);
    renderBroadcastModal();
    return;
  }
  if (e.key === "ArrowDown" || e.key === "s") {
    broadcastOptionIdx = Math.min(deduction.options.length - 1, broadcastOptionIdx + 1);
    renderBroadcastModal();
    return;
  }
  if (e.key === "Enter") {
    // Enter detail view for evidence linking instead of immediately answering
    broadcastDetailDeduction = deduction.id;
    broadcastLinkedEvidence = [];
    broadcastEvidenceIdx = 0;
    renderBroadcastModal();
    return;
  }

  // Number keys
  const num = parseInt(e.key, 10);
  if (num >= 1 && num <= deduction.options.length) {
    broadcastOptionIdx = num - 1;
    renderBroadcastModal();
    return;
  }
}

function escapeHtmlBroadcast(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Start with opening crawl ────────────────────────────────────
showOpeningCrawl();
