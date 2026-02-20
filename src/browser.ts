import { generate } from "./sim/procgen.js";
import { step, applyDeductionReward as applyDeductionRewardSim } from "./sim/step.js";
import { BrowserDisplay } from "./render/display.js";
import type { IGameDisplay } from "./render/displayInterface.js";
import type { LogType } from "./render/display.js";
import { InputHandler } from "./render/input.js";
import { AudioManager } from "./render/audio.js";
import { GOLDEN_SEED } from "./shared/constants.js";
import { getOpeningCrawl, STATION_NAME, STATION_SUBTITLE, TAGLINE } from "./data/lore.js";
import {
  VICTORY_TITLE, DEFEAT_TITLE, DEFEAT_TEXT,
  DEFEAT_RELAY_TITLE, DEFEAT_RELAY_TEXT,
  VICTORY_EPILOGUE_MINIMAL, VICTORY_EPILOGUE_PARTIAL, VICTORY_EPILOGUE_COMPLETE,
  ENDING_BY_DISCOVERY, SPECIFIC_DISCOVERIES,
  CLASSIFIED_DIRECTIVE_LOG_FRAGMENT, CLASSIFIED_DIRECTIVE_TEXT,
  getVictoryText,
} from "./data/endgame.js";
import { getRoomDescription } from "./data/roomDescriptions.js";
import {
  BOT_INTROSPECTIONS, DRONE_STATUS_MESSAGES, FIRST_DRONE_ENCOUNTER,
  AMBIENT_HEAT_MESSAGES, AMBIENT_HEAT_DEFAULT, CLEANING_MESSAGES, DIRT_TRAIL_HINTS,
  DRONE_ENCOUNTER_LOGS, DRONE_CLEANING_MESSAGE,
  TUTORIAL_HINTS_EARLY, TUTORIAL_HINT_FIRST_EVIDENCE, TUTORIAL_HINT_FIRST_DEDUCTION,
  TUTORIAL_HINT_INVESTIGATION,
} from "./data/narrative.js";
import type { Action, MysteryChoice, Deduction } from "./shared/types.js";
import { ActionType, SensorType, EntityType, ObjectivePhase, DeductionCategory, Direction } from "./shared/types.js";
import { computeChoiceEndings } from "./sim/mysteryChoices.js";
import { getUnlockedDeductions, solveDeduction, validateEvidenceLink, linkEvidence, getTagExplanation } from "./sim/deduction.js";
import { getRoomAt, getRoomCleanliness } from "./sim/rooms.js";
import { saveGame, loadGame, hasSave, deleteSave } from "./sim/saveLoad.js";
import { generateWhatWeKnow, formatRelationship, formatCrewMemberDetail, getDeductionsForEntry } from "./sim/whatWeKnow.js";

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

  // Use the archetype from generated state for per-storyline opening text
  const archetype = state.mystery?.timeline?.archetype;
  const crawlLines = archetype ? getOpeningCrawl(archetype) : getOpeningCrawl("coolant_cascade" as any);

  const lines = [
    `> ${STATION_NAME} — ${STATION_SUBTITLE}`,
    `> ${TAGLINE}`,
    "",
    ...crawlLines,
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

  // Typewriter effect: ~120 chars/second
  const CHARS_PER_SECOND = 120;
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
    window.removeEventListener("keydown", startGame);
    crawlOverlay.removeEventListener("click", startGame);

    // Boot sequence: typed-out messages before player control
    crawlOverlay.innerHTML = "";
    const bootPre = document.createElement("pre");
    bootPre.className = "crawl-text";
    bootPre.textContent = "";
    crawlOverlay.appendChild(bootPre);

    const bootMessages = [
      { text: "SIGNAL ACQUIRED...", delay: 0 },
      { text: "TERMINAL SYNC...", delay: 600 },
      { text: "LINK ESTABLISHED", delay: 1200 },
    ];

    for (const msg of bootMessages) {
      setTimeout(() => {
        bootPre.textContent += (bootPre.textContent ? "\n" : "") + "> " + msg.text;
      }, msg.delay);
    }

    // After boot sequence completes, start the game
    setTimeout(() => {
      crawlOverlay.style.display = "none";
      gameStarted = true;
      initGame();
    }, 1800);
  };

  window.addEventListener("keydown", startGame);
  crawlOverlay.addEventListener("click", startGame);
}

// ── Game initialization ─────────────────────────────────────────
let state = generate(seed);
let display: IGameDisplay = undefined!; // assigned in initGame()
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
const triggeredTutorialHints = new Set<string>(); // Track which tutorial hints have been shown
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
let confirmingDeduction = false; // Y/N confirmation before locking in deduction answer
let mapOpen = false;
let helpOpen = false;
// ── Investigation Hub state ──────────────────────────────────────
let investigationHubOpen = false;
let hubSection: "evidence" | "connections" | "whatweknow" | "decisions" = "evidence";
let hubIdx = 0;                       // selected item index within current section
let hubOptionIdx = 0;                 // selected option within a deduction/choice
let hubLinkedEvidence: string[] = [];  // evidence IDs linked to a deduction
let hubDetailDeduction: string | null = null; // deduction ID in evidence-linking mode
let hubEvidenceIdx = 0;               // evidence entry index in linking mode
let hubConfirming = false;            // Y/N confirmation for deduction answer
let hubLinkFeedback = "";             // feedback message after toggling evidence
let hubChoiceConfirming = false;      // Y/N confirmation for mystery choice
let hubDecisionDetailIdx: number | null = null; // which decision is expanded (null = list view)
let hubFocusRegion: "evidence" | "answers" = "evidence"; // focus region in connection detail view
let hubRevelationOverlay = false; // showing post-answer revelation overlay
let devModeEnabled = new URLSearchParams(window.location.search).get("dev") === "1";

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

// ── Auto-explore state ─────────────────────────────────────────
let autoExploring = false;
let autoExploreTimer: ReturnType<typeof setTimeout> | null = null;
const AUTO_EXPLORE_DELAY = 80; // ms between auto-steps

/** Stop auto-explore mode. */
function stopAutoExplore(): void {
  autoExploring = false;
  if (autoExploreTimer) {
    clearTimeout(autoExploreTimer);
    autoExploreTimer = null;
  }
}

/** BFS to find direction toward nearest unexplored walkable tile. */
function autoExploreBFS(): Direction | null {
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;
  const key = (x: number, y: number) => `${x},${y}`;

  // BFS from player position
  const visited = new Set<string>();
  const queue: { x: number; y: number; firstDir: Direction }[] = [];

  const dirs: { dx: number; dy: number; dir: Direction }[] = [
    { dx: 0, dy: -1, dir: Direction.North },
    { dx: 0, dy: 1, dir: Direction.South },
    { dx: -1, dy: 0, dir: Direction.West },
    { dx: 1, dy: 0, dir: Direction.East },
    { dx: -1, dy: -1, dir: Direction.NorthWest },
    { dx: 1, dy: -1, dir: Direction.NorthEast },
    { dx: -1, dy: 1, dir: Direction.SouthWest },
    { dx: 1, dy: 1, dir: Direction.SouthEast },
  ];

  visited.add(key(px, py));
  for (const { dx, dy, dir } of dirs) {
    const nx = px + dx;
    const ny = py + dy;
    if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
    if (!state.tiles[ny][nx].walkable) continue;
    visited.add(key(nx, ny));
    queue.push({ x: nx, y: ny, firstDir: dir });
  }

  let head = 0;
  while (head < queue.length) {
    const { x, y, firstDir } = queue[head++];
    const tile = state.tiles[y][x];

    // Goal: an unexplored walkable tile
    if (!tile.explored) {
      return firstDir;
    }

    for (const { dx, dy } of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
      const k = key(nx, ny);
      if (visited.has(k)) continue;
      if (!state.tiles[ny][nx].walkable) continue;
      visited.add(k);
      queue.push({ x: nx, y: ny, firstDir });
    }
  }

  return null; // no unexplored tiles reachable
}

/** Check if there are non-exhausted interactable entities adjacent to player. */
function hasAdjacentInteractable(): boolean {
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;
  const deltas = [
    { x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 },
    { x: -1, y: 0 }, { x: 1, y: 0 },
  ];
  for (const [id, ent] of state.entities) {
    if (id === "player") continue;
    for (const d of deltas) {
      if (ent.pos.x === px + d.x && ent.pos.y === py + d.y) {
        // Check if not exhausted using simple heuristics
        if (ent.type === EntityType.SensorPickup && ent.props["collected"] !== true) return true;
        if (ent.type === EntityType.Relay && ent.props["activated"] !== true && ent.props["locked"] !== true) return true;
        if (ent.type === EntityType.LogTerminal && !state.logs.some(l => l.id === `log_terminal_${ent.id}`)) return true;
        if (ent.type === EntityType.DataCore) return true;
        if (ent.type === EntityType.CrewNPC && ent.props["evacuated"] !== true && ent.props["dead"] !== true) return true;
        if (ent.type === EntityType.EscapePod) return true;
        if (ent.type === EntityType.MedKit && ent.props["used"] !== true) return true;
        if (ent.type === EntityType.EvidenceTrace && ent.props["discovered"] !== true && ent.props["scanHidden"] !== true) return true;
        if (ent.type === EntityType.CrewItem && ent.props["examined"] !== true && ent.props["hidden"] !== true) return true;
        if (ent.type === EntityType.Console && ent.props["read"] !== true) return true;
      }
    }
  }
  return false;
}

/** Execute one auto-explore step. */
function autoExploreStep(): void {
  if (!autoExploring || state.gameOver) {
    stopAutoExplore();
    return;
  }

  const prevHp = state.player.hp;
  const dir = autoExploreBFS();

  if (!dir) {
    display.addLog("No unexplored areas reachable.", "system");
    stopAutoExplore();
    renderAll();
    return;
  }

  // Execute the move
  handleAction({ type: ActionType.Move, direction: dir });

  // Check stopping conditions
  if (state.player.hp < prevHp) {
    display.addLog("Auto-explore stopped: taking damage.", "warning");
    stopAutoExplore();
    renderAll();
    return;
  }

  if (hasAdjacentInteractable()) {
    display.addLog("Auto-explore stopped: something nearby.", "system");
    stopAutoExplore();
    renderAll();
    return;
  }

  if (state.gameOver) {
    stopAutoExplore();
    return;
  }

  // Schedule next step
  autoExploreTimer = setTimeout(autoExploreStep, AUTO_EXPLORE_DELAY);
}

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

      const desc = getRoomDescription(currentRoom.name, state.seed);
      if (desc) {
        display.addLog(desc, "narrative");
      }

      // List notable entities in the room
      const roomEntities: string[] = [];
      for (const [id, ent] of state.entities) {
        if (id === "player") continue;
        if (ent.pos.x >= currentRoom.x && ent.pos.x < currentRoom.x + currentRoom.width &&
            ent.pos.y >= currentRoom.y && ent.pos.y < currentRoom.y + currentRoom.height) {
          const name = entityLabel(ent);
          if (name) roomEntities.push(name);
        }
      }
      if (roomEntities.length > 0) {
        const unique = [...new Set(roomEntities)];
        display.addLog(`You detect: ${unique.join(", ")}`, "sensor");
      }
    }
  }
}

/** Get a short label for an entity visible on room entry (null = skip). */
function entityLabel(ent: { type: string; props: Record<string, unknown> }): string | null {
  switch (ent.type) {
    case EntityType.Relay:
      if (ent.props["locked"] === true) return null;
      return ent.props["activated"] ? null : "Power Relay";
    case EntityType.SensorPickup: return ent.props["collected"] ? null : "Sensor Upgrade";
    case EntityType.DataCore: return "Data Core";
    case EntityType.LogTerminal: return "Log Terminal";
    case EntityType.CrewItem:
      if (ent.props["hidden"] === true || ent.props["examined"] === true) return null;
      return "Crew Item";
    case EntityType.MedKit: return ent.props["used"] ? null : "Med Kit";
    case EntityType.RepairCradle: return "Repair Cradle";
    case EntityType.Breach: return ent.props["sealed"] ? null : "Hull Breach";
    case EntityType.EvidenceTrace:
      if (ent.props["discovered"] === true || ent.props["scanHidden"] === true) return null;
      return "Evidence Trace";
    case EntityType.CrewNPC:
      if (ent.props["evacuated"] === true || ent.props["dead"] === true) return null;
      return ent.props["found"] ? `${ent.props["firstName"]} ${ent.props["lastName"]}` : "Life Signs Detected";
    case EntityType.EscapePod: return "Escape Pod";
    case EntityType.Console: return ent.props["read"] ? null : "Console";
    case EntityType.SecurityTerminal: return "Security Terminal";
    case EntityType.ServiceBot: return ent.props["activated"] ? null : "Service Bot";
    case EntityType.FuseBox: return ent.props["powered"] ? null : "Fuse Box";
    case EntityType.PressureValve: return ent.props["turned"] ? null : "Pressure Valve";
    case EntityType.ClosedDoor: return ent.props["locked"] ? null : "Sealed Door";
    case EntityType.PatrolDrone: return ent.props["disabled"] ? null : "Patrol Drone";
    default: return null;
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
  // PA system announcements
  if (logText.startsWith("CORVUS-7 CENTRAL:")) {
    if (logText.includes("WARNING") || logText.includes("ALERT") || logText.includes("CAUTION")) return "warning";
    return "system";
  }
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
  display.addLog("LINK ACTIVE — Low-bandwidth terminal feed. No video, no audio.", "milestone");
  display.addLog("Rover A3 responds. Battery 98%. Cleanliness sensor online.", "system");
  display.addLog("The station is quiet. What happened here?", "narrative");
  display.addLog("MAINTENANCE SUBROUTINE: Clean rooms to 80% standard. Use [c] to clean.", "system");
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
    // Any non-Tab key stops auto-explore
    if (autoExploring && e.key !== "Tab") {
      stopAutoExplore();
      display.addLog("Auto-explore stopped.", "system");
      renderAll();
    }
    if (helpOpen) {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        helpOpen = false;
        closeHelpOverlay();
      }
      return; // swallow all input while help is open
    }
    if (mapOpen) {
      if (e.key === "Escape" || e.key === "m" || e.key === "M") {
        e.preventDefault();
        mapOpen = false;
        closeMapOverlay();
      }
      return; // swallow all input while map is open
    }
    if (investigationHubOpen) {
      handleHubInput(e);
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
    // Mystery choices are handled via the Investigation Hub now
    // V key opens Investigation Hub directly to EVIDENCE section
    if (e.key === "v" && !journalOpen && !state.gameOver) {
      e.preventDefault();
      investigationHubOpen = true;
      hubSection = "evidence";
      hubIdx = 0;
      renderInvestigationHub();
      return;
    }
    // ? key toggles help
    if (e.key === "?" && !journalOpen) {
      e.preventDefault();
      helpOpen = true;
      showHelp();
      return;
    }
    // R opens Investigation Hub (last-visited section)
    if (e.key === "r" && !journalOpen && !state.gameOver) {
      e.preventDefault();
      investigationHubOpen = true;
      hubIdx = 0;
      renderInvestigationHub();
      return;
    }
    // M key toggles station map (uses overlay, doesn't destroy log)
    if ((e.key === "m" || e.key === "M") && !journalOpen && !investigationHubOpen) {
      e.preventDefault();
      mapOpen = !mapOpen;
      if (mapOpen) {
        showStationMap();
      } else {
        closeMapOverlay();
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
    deleteSave();
    state = generate(seed);
    lastPlayerRoomId = "";
    visitedRoomIds.clear();
    journalOpen = false;
    activeChoice = null;
    investigationHubOpen = false;
    // Close overlays on restart
    const broadcastEl = document.getElementById("broadcast-overlay");
    if (broadcastEl) { broadcastEl.classList.remove("active"); broadcastEl.innerHTML = ""; }
    const journalEl = document.getElementById("journal-overlay");
    if (journalEl) { journalEl.classList.remove("active"); journalEl.innerHTML = ""; }
    choicesPresented.clear();

    // Reset per-run narrative/tutorial state
    firstDroneEncounterShown = false;
    droneEncounterSet.clear();
    triggeredBotIntrospections.clear();
    triggeredTutorialHints.clear();
    cleanMsgIndex = 0;
    waitMsgIndex = 0;
    lastAmbientRoomId = "";
    mapOpen = false;
    helpOpen = false;
    activeDeduction = null;
    deductionSelectedIdx = 0;
    confirmingDeduction = false;
    hubSection = "evidence";
    hubOptionIdx = 0;
    hubLinkedEvidence = [];
    hubDetailDeduction = null;
    hubEvidenceIdx = 0;
    hubConfirming = false;
    hubLinkFeedback = "";
    hubChoiceConfirming = false;
    hubDecisionDetailIdx = null;
    hubIdx = 0;
    pendingCrewDoor = null;
    journalTab = "evidence";
    choiceSelectedIdx = 0;

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
    display.addLog("MAINTENANCE SUBROUTINE: Clean rooms to 80% standard. Use [c] to clean.", "system");
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

  // Any non-auto-explore action stops auto-explore
  if (autoExploring && action.type !== ActionType.AutoExplore && action.type !== ActionType.Move) {
    stopAutoExplore();
  }

  // Auto-explore: start walking toward nearest unexplored tile
  if (action.type === ActionType.AutoExplore) {
    if (autoExploring) {
      // Toggle off
      stopAutoExplore();
      display.addLog("Auto-explore cancelled.", "system");
      renderAll();
      return;
    }
    autoExploring = true;
    display.addLog("Auto-exploring... (press Tab or any key to stop)", "system");
    renderAll();
    autoExploreTimer = setTimeout(autoExploreStep, AUTO_EXPLORE_DELAY);
    return;
  }

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
    let hasPA = false;
    for (let i = prevLogs; i < state.logs.length; i++) {
      const simLog = state.logs[i];
      const logType = classifySimLog(simLog.text, simLog.source);
      display.addLog(simLog.text, logType);
      if (simLog.text.startsWith("CORVUS-7 CENTRAL:")) hasPA = true;
    }
    if (hasPA) audio.playPA();
    // Interaction produced logs -- play interact sound + tile flash
    if (action.type === ActionType.Interact) {
      audio.playInteract();
      // Flash the interacted entity's tile for visual feedback
      if (action.targetId) {
        const target = state.entities.get(action.targetId);
        if (target) {
          display.flashTile(target.pos.x, target.pos.y);
        }
      } else {
        // No specific target — flash adjacent interactable entities
        const px = state.player.entity.pos.x;
        const py = state.player.entity.pos.y;
        const deltas = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 0 }];
        for (const d of deltas) {
          for (const [id, ent] of state.entities) {
            if (id === "player") continue;
            if (ent.pos.x === px + d.x && ent.pos.y === py + d.y) {
              display.flashTile(ent.pos.x, ent.pos.y);
            }
          }
        }
      }
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

  // Tutorial hints for new players (fire once at early turns)
  for (const hint of TUTORIAL_HINTS_EARLY) {
    if (state.turn >= hint.turn && !triggeredTutorialHints.has(hint.id)) {
      triggeredTutorialHints.add(hint.id);
      display.addLog(hint.text, "system");
    }
  }

  // Event-based tutorial hints
  if (state.mystery) {
    // First evidence collected
    if (state.mystery.journal.length > 0 && !triggeredTutorialHints.has("first_evidence")) {
      triggeredTutorialHints.add("first_evidence");
      display.addLog(TUTORIAL_HINT_FIRST_EVIDENCE, "system");
    }
    // First deduction ready
    const unlocked = getUnlockedDeductions(state.mystery.deductions, state.mystery.journal);
    if (unlocked.length > 0 && !triggeredTutorialHints.has("first_deduction")) {
      triggeredTutorialHints.add("first_deduction");
      display.addLog(TUTORIAL_HINT_FIRST_DEDUCTION, "system");
      audio.playDeductionReady();
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
    display.addLog(TUTORIAL_HINT_INVESTIGATION, "system");
    display.triggerScreenFlash("milestone");
    audio.playPhaseTransition();
  }
  if (state.mystery && lastObjectivePhase === ObjectivePhase.Investigate &&
      state.mystery.objectivePhase === ObjectivePhase.Recover) {
    lastObjectivePhase = ObjectivePhase.Recover;
    display.addLog("", "system");
    display.addLog("═══ INVESTIGATION COMPLETE ═══", "milestone");
    display.addLog("Enough evidence gathered. The incident picture is forming.", "milestone");
    display.addLog("Cleaning directive OVERRIDDEN. You have a new priority.", "milestone");
    display.addLog("NEW OBJECTIVE: Restore power relays and transmit the data bundle from the Data Core.", "milestone");
    audio.playPhaseTransition();
    display.addLog("Find the Thermal Sensor to locate overheating relays. Reroute all relays to unlock the Data Core.", "system");
    display.triggerScreenFlash("milestone");
  }
  if (state.mystery && lastObjectivePhase !== ObjectivePhase.Evacuate &&
      state.mystery.objectivePhase === ObjectivePhase.Evacuate) {
    lastObjectivePhase = ObjectivePhase.Evacuate;
    display.addLog("", "system");
    display.addLog("═══ ⚡ RED ALERT ═══", "milestone");
    display.addLog("CREW SURVIVORS DETECTED. Evacuation protocol activated.", "milestone");
    display.addLog("Lead crew to Escape Pods. Interact [i] with crew to have them follow you.", "milestone");
    display.addLog("Find powered Escape Pods and interact [i] to board crew.", "system");
    display.addLog("TIP: Check the station map [m] to locate the Escape Pod Bay.", "system");
    display.triggerScreenFlash("milestone");
    audio.playEvacuation();
  }

  // Detect crew boarding events for audio
  if (state.logs.length > prevLogs) {
    for (let i = prevLogs; i < state.logs.length; i++) {
      if (state.logs[i].text.includes("boards escape")) {
        audio.playCrewBoard();
        break;
      }
    }
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

  // Mystery choices no longer auto-trigger — player presses [r] to broadcast

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

  // Auto-save after each action (unless game is over)
  if (!state.gameOver && state.turn % 5 === 0) {
    saveGame(state);
  }

  if (state.gameOver) {
    deleteSave(); // Clear save on game end
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
      // Check if the defeat was heat/relay related
      const px = state.player.entity.pos.x;
      const py = state.player.entity.pos.y;
      const deathTile = state.tiles[py]?.[px];
      const isHeatDeath = deathTile && deathTile.heat >= 30;
      if (isHeatDeath) {
        display.addLog("=== " + DEFEAT_RELAY_TITLE + " ===", "critical");
        DEFEAT_RELAY_TEXT.forEach((line) => { if (line) display.addLog(line, "critical"); });
      } else {
        display.addLog("=== " + DEFEAT_TITLE + " ===", "critical");
        DEFEAT_TEXT.forEach((line) => { if (line) display.addLog(line, "critical"); });
      }
    }
    flickerThenRender();
    // Show full-screen game-over overlay after the flicker
    setTimeout(() => { display.showGameOverOverlay(state); }, 400);
    return;
  }

  // Show interaction preview for adjacent entities after move
  if (action.type === ActionType.Move && !autoExploring) {
    showInteractionPreview();
  }

  renderAll();
}

/** Show a brief interaction hint for adjacent interactable entities. */
function showInteractionPreview(): void {
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;
  const deltas = [
    { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 },
  ];

  const hints: string[] = [];
  for (const [id, ent] of state.entities) {
    if (id === "player") continue;
    let adjacent = false;
    for (const d of deltas) {
      if (ent.pos.x === px + d.x && ent.pos.y === py + d.y) { adjacent = true; break; }
    }
    if (!adjacent) continue;

    const hint = getInteractionHint(ent);
    if (hint) hints.push(hint);
  }

  if (hints.length > 0) {
    display.addLog(`Nearby: ${hints.join(" | ")}`, "sensor");
  }
}

/** Get a short hint for an adjacent interactable entity (null = skip). */
function getInteractionHint(ent: { type: string; props: Record<string, unknown> }): string | null {
  switch (ent.type) {
    case EntityType.Relay:
      if (ent.props["locked"] === true) return null;
      return ent.props["activated"] ? null : "[i] Reroute Relay";
    case EntityType.SensorPickup:
      return ent.props["collected"] ? null : "[i] Sensor Upgrade";
    case EntityType.DataCore:
      return "[i] Data Core";
    case EntityType.LogTerminal:
      return "[i] Read Terminal";
    case EntityType.CrewItem:
      if (ent.props["hidden"] === true || ent.props["examined"] === true) return null;
      return "[i] Examine";
    case EntityType.MedKit:
      return ent.props["used"] ? null : "[i] Med Kit";
    case EntityType.RepairCradle:
      return "[i] Repair Cradle";
    case EntityType.Breach:
      return ent.props["sealed"] ? null : "[i] Seal Breach";
    case EntityType.EvidenceTrace:
      if (ent.props["discovered"] === true || ent.props["scanHidden"] === true) return null;
      return "[i] Evidence";
    case EntityType.CrewNPC:
      if (ent.props["evacuated"] === true || ent.props["dead"] === true) return null;
      if (ent.props["following"] === true) return null;
      return ent.props["found"] ? `[i] ${ent.props["firstName"]}` : "[i] Life Signs";
    case EntityType.EscapePod:
      return "[i] Escape Pod";
    case EntityType.Console:
      return ent.props["read"] ? null : "[i] Console";
    case EntityType.SecurityTerminal:
      return "[i] Security Terminal";
    case EntityType.ServiceBot:
      return ent.props["activated"] ? null : "[i] Service Bot";
    case EntityType.ClosedDoor:
      return ent.props["locked"] ? null : "[i] Open Door";
    case EntityType.Airlock:
      return "[i] Airlock";
    default:
      return null;
  }
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
  const overlay = document.getElementById("journal-overlay");
  if (!overlay) return;

  overlay.innerHTML = `
    <div class="journal-container" style="padding:20px;overflow-y:auto;color:#ccc">
      <div style="text-align:center;margin-bottom:12px">
        <span style="color:#ff0;font-size:18px;font-weight:bold">═══ CONTROLS ═══</span>
        <div style="color:#888;font-size:12px">Press [?] or [Esc] to close</div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px 24px;max-width:700px;margin:0 auto">
        <div>
          <div style="color:#4af;font-weight:bold;margin-bottom:6px">── Movement ──</div>
          <div><span style="color:#fff">Arrow keys / WASD</span>  Cardinal movement</div>
          <div><span style="color:#fff">h j k l</span>  West South North East (vi)</div>
          <div><span style="color:#fff">y u b n</span>  NW NE SW SE (diagonal)</div>
          <div><span style="color:#fff">Numpad 1-9</span>  8-way movement (5 = wait)</div>
        </div>

        <div>
          <div style="color:#4af;font-weight:bold;margin-bottom:6px">── Actions ──</div>
          <div><span style="color:#fff">[i]</span>  Interact with adjacent objects</div>
          <div style="color:#888;margin-left:20px">Terminals, doors, airlocks, relays,</div>
          <div style="color:#888;margin-left:20px">repair cradles, crew NPCs, escape pods</div>
          <div><span style="color:#fff">[c]</span>  Clean current tile</div>
          <div><span style="color:#fff">[t] / [q]</span>  Cycle sensor overlay</div>
          <div><span style="color:#fff">[x]</span>  Look (examine surroundings)</div>
          <div><span style="color:#fff">[.] [Space] [5]</span>  Wait one turn</div>
        </div>

        <div>
          <div style="color:#4af;font-weight:bold;margin-bottom:6px">── Menus & Info ──</div>
          <div><span style="color:#fff">[r]</span>  Investigation Hub (evidence, deductions, narrative)</div>
          <div><span style="color:#fff">[v]</span>  Investigation Hub → Evidence</div>
          <div><span style="color:#fff">[j] / [;]</span>  Quick journal toggle</div>
          <div><span style="color:#fff">[m]</span>  Station map overlay</div>
          <div><span style="color:#fff">[?]</span>  This help screen</div>
        </div>

        <div>
          <div style="color:#4af;font-weight:bold;margin-bottom:6px">── In Menus ──</div>
          <div><span style="color:#fff">[Tab]</span>  Switch sections / tabs</div>
          <div><span style="color:#fff">[Enter]</span>  Submit deduction answer</div>
          <div><span style="color:#fff">[Y] / [N]</span>  Confirm or cancel prompts</div>
          <div><span style="color:#fff">[Esc]</span>  Close any overlay</div>
          <div><span style="color:#fff">[R]</span>  Restart (game over screen)</div>
        </div>
      </div>

      <div style="margin-top:16px;border-top:1px solid #333;padding-top:12px;max-width:700px;margin-left:auto;margin-right:auto">
        <div style="color:#4af;font-weight:bold;margin-bottom:6px">── Game Phases ──</div>
        <div><span style="color:#4a4">MAINTENANCE</span>  Clean rooms to 80% to progress</div>
        <div><span style="color:#fa0">INVESTIGATION</span>  Read terminals, collect evidence, solve deductions</div>
        <div><span style="color:#f44">RECOVERY</span>  Reroute relays, transmit data from Data Core</div>
        <div><span style="color:#f0f">EVACUATION</span>  Lead crew survivors to powered Escape Pods</div>
      </div>
    </div>`;
  overlay.classList.add("active");
}

function closeHelpOverlay(): void {
  const overlay = document.getElementById("journal-overlay");
  if (overlay) {
    overlay.innerHTML = "";
    overlay.classList.remove("active");
  }
}

// ── Station map display (HTML overlay — no longer destroys log panel) ──
function showStationMap(): void {
  const overlay = document.getElementById("journal-overlay");
  if (!overlay) return;

  const visited = visitedRoomIds;
  let roomsHtml = "";
  for (const room of state.rooms) {
    const isVisited = visited.has(room.id);

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
      roomsHtml += `<div style="padding:3px 8px;color:#0f0">\u2713 ${esc(room.name)}</div>`;
    } else if (cameraRevealed) {
      roomsHtml += `<div style="padding:3px 8px;color:#6cf">\u25cb ${esc(room.name)}</div>`;
    } else {
      roomsHtml += `<div style="padding:3px 8px;color:#555">\u00b7 ???</div>`;
    }
  }

  const visitedCount = state.rooms.filter(r => visited.has(r.id)).length;
  overlay.innerHTML = `
    <div class="journal-container">
      <div class="journal-header">\u2550\u2550\u2550 STATION MAP \u2550\u2550\u2550</div>
      <div class="journal-body" style="flex-direction:column;padding:8px">
        ${roomsHtml}
        <div style="padding:8px;color:#888;border-top:1px solid #333;margin-top:8px">${visitedCount}/${state.rooms.length} rooms explored</div>
      </div>
      <div class="journal-controls">[Esc/m] Close</div>
    </div>`;
  overlay.classList.add("active");
}

function closeMapOverlay(): void {
  const overlay = document.getElementById("journal-overlay");
  if (overlay) {
    overlay.classList.remove("active");
    overlay.innerHTML = "";
  }
  mapOpen = false;
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

  // Confirmation step: Y/N before locking in
  if (confirmingDeduction) {
    e.preventDefault();
    if (e.key === "y" || e.key === "Y") {
      confirmingDeduction = false;
      commitDeductionAnswer();
      return true;
    }
    if (e.key === "n" || e.key === "N" || e.key === "Escape") {
      confirmingDeduction = false;
      showDeductionPrompt();
      return true;
    }
    return true; // swallow other keys during confirm
  }

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
    // Show confirmation prompt instead of immediately solving
    confirmingDeduction = true;
    display.addLog("", "system");
    display.addLog(`═══ CONFIRM DEDUCTION ═══`, "milestone");
    display.addLog(`Your answer: ${activeDeduction.options[deductionSelectedIdx].label}`, "narrative");
    display.addLog("This answer is permanent. Are you sure? [Y/N]", "warning");
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

/** Actually commit the deduction answer after confirmation. */
function commitDeductionAnswer(): void {
  if (!activeDeduction) return;
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
    return;
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
    audio.playDeductionCorrect();
    // Apply reward
    applyDeductionReward(solved);
  } else {
    display.addLog(`✗ Incorrect. The evidence doesn't support that conclusion.`, "warning");
    audio.playDeductionWrong();
  }

  activeDeduction = null;
  renderAll();
}

function applyDeductionReward(deduction: Deduction): void {
  // Delegate to the pure sim-side implementation and adopt the returned state
  const prevLogCount = state.logs.length;
  state = applyDeductionRewardSim(state, deduction);
  // Show any new logs the sim generated
  for (let i = prevLogCount; i < state.logs.length; i++) {
    const logType = classifySimLog(state.logs[i].text, state.logs[i].source);
    display.addLog(state.logs[i].text, logType);
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

// ── Investigation Hub ────────────────────────────────────────────

type EvidenceEntry = { id: string; icon: string; summary: string; detail: string; room: string; turn: number; tags: string[]; category: string; thread?: string; crewMentioned: string[] };

function getEvidenceEntries(): { entries: EvidenceEntry[]; threads: Map<string, string[]> } {
  if (!state.mystery) return { entries: [], threads: new Map() };
  const journal = state.mystery.journal;
  const entries = journal.map(j => ({
    id: j.id,
    icon: j.category === "log" ? "\u25a3" : j.category === "item" ? "\u2726" : j.category === "trace" ? "\u203b" : j.category === "crew" ? "\u2660" : "\u25c8",
    summary: j.summary,
    detail: j.detail,
    room: j.roomFound,
    turn: j.turnDiscovered,
    tags: j.tags,
    category: j.category,
    thread: j.thread,
    crewMentioned: j.crewMentioned,
  }));

  const threads = new Map<string, string[]>();
  for (const e of entries) {
    const t = e.thread || "Uncategorized";
    if (!threads.has(t)) threads.set(t, []);
    threads.get(t)!.push(e.id);
  }

  return { entries, threads };
}

/** Render the unified Investigation Hub with 4 tab-sections. */
function renderInvestigationHub(): void {
  const overlay = document.getElementById("broadcast-overlay");
  if (!overlay || !state.mystery) return;

  const { entries } = getEvidenceEntries();
  const deductions = state.mystery.deductions;
  const journal = state.mystery.journal;

  // Tab bar
  const tabs: Array<"evidence" | "connections" | "whatweknow" | "decisions"> = ["evidence", "connections", "whatweknow", "decisions"];
  const tabLabels: Record<string, string> = {
    evidence: `EVIDENCE (${entries.length})`,
    connections: `CONNECTIONS (${deductions.filter(d => d.solved).length}/${deductions.length})`,
    whatweknow: "WHAT WE KNOW",
    decisions: "DECISIONS",
  };
  let tabsHtml = "";
  for (const t of tabs) {
    const cls = t === hubSection ? "journal-tab active" : "journal-tab";
    tabsHtml += `<div class="${cls}">${tabLabels[t]}</div>`;
  }

  let bodyHtml = "";

  if (hubSection === "evidence") {
    bodyHtml = renderHubEvidence(entries);
  } else if (hubSection === "connections") {
    bodyHtml = renderHubConnections(deductions, journal);
  } else if (hubSection === "whatweknow") {
    bodyHtml = renderHubWhatWeKnow();
  } else if (hubSection === "decisions") {
    bodyHtml = renderHubDecisions();
  }

  const controlsText = hubDetailDeduction
    ? "[&uarr;/&darr;] Navigate  [Space] Toggle link  [Enter] Answer  [Esc] Back"
    : "[&uarr;/&darr;] Navigate  [Tab] Next section  [Enter] Select  [Esc] Close";

  overlay.innerHTML = `
    <div class="broadcast-box">
      <div class="broadcast-title">\u2550\u2550\u2550 INVESTIGATION HUB \u2550\u2550\u2550${devModeEnabled ? ' <span style="color:#f0f;font-size:11px">[DEV]</span>' : ''}</div>
      <div class="journal-tabs" style="display:flex;gap:4px;padding:4px 8px;border-bottom:1px solid #333">${tabsHtml}</div>
      ${bodyHtml}
      <div class="broadcast-controls">${controlsText}</div>
    </div>`;
  overlay.classList.add("active");
}

/** EVIDENCE section — two-panel: entry list (left) + full detail (right). */
function renderHubEvidence(entries: EvidenceEntry[]): string {
  if (entries.length === 0) {
    return `<div class="journal-body"><div class="journal-list"><div class="journal-empty">No evidence collected yet.<br>Read terminals [i] and examine items.</div></div><div class="journal-detail"><div class="journal-empty">Explore the station to gather clues.</div></div></div>`;
  }

  let listHtml = "";
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const cls = i === hubIdx ? "journal-entry selected" : "journal-entry";
    listHtml += `<div class="${cls}">
      <span class="journal-entry-icon">${esc(e.icon)}</span>
      ${esc(e.summary)}
      <div><span class="journal-entry-turn">T${e.turn}</span> <span class="journal-entry-room">${esc(e.room)}</span></div>
    </div>`;
  }

  let detailHtml = "";
  if (entries[hubIdx]) {
    detailHtml = renderHubEvidenceDetail(entries[hubIdx]);
  }

  return `<div class="journal-body"><div class="journal-list">${listHtml}</div><div class="journal-detail">${detailHtml || '<div class="journal-empty">Select an entry to view details.</div>'}</div></div>`;
}

/** Render the full detail panel for a selected evidence entry. */
function renderHubEvidenceDetail(entry: EvidenceEntry): string {
  const deductions = state.mystery?.deductions ?? [];
  const journal = state.mystery?.journal ?? [];
  const crew = state.mystery?.crew ?? [];

  let tagsHtml = "";
  for (const tag of entry.tags) {
    tagsHtml += `<span class="tag-pill tag-covered">${esc(tag)}</span>`;
  }

  // Linked deductions
  const linkedDeductions = deductions.filter(d =>
    d.requiredTags.some(t => entry.tags.includes(t))
  );
  let deductionLinks = "";
  if (linkedDeductions.length > 0) {
    deductionLinks = `<div class="journal-detail-deductions">Relevant to: ${linkedDeductions.map(d => esc(d.category.toUpperCase())).join(", ")}</div>`;
  }

  // Crew with relationships (Deliverable 3)
  let crewHtml = "";
  if (entry.crewMentioned.length > 0) {
    crewHtml = `<div style="color:#6cf;font-size:12px;margin-top:8px;border-top:1px solid #222;padding-top:6px"><div style="font-weight:bold;margin-bottom:4px">CREW MENTIONED</div>`;
    for (const crewId of entry.crewMentioned) {
      const member = crew.find(c => c.id === crewId);
      if (!member) continue;
      crewHtml += `<div style="margin:4px 0"><span style="color:#fff">${esc(member.firstName)} ${esc(member.lastName)}</span> — ${esc(fmtRole(member.role))}`;
      crewHtml += `<div style="color:#888;font-size:11px;padding-left:8px">Personality: ${esc(member.personality)} | Fate: ${esc(member.fate.replace(/_/g, " "))}</div>`;
      if (member.relationships.length > 0) {
        for (const rel of member.relationships) {
          const relStr = formatRelationship(member, rel, crew);
          if (relStr) {
            crewHtml += `<div style="color:#ca8;font-size:11px;padding-left:8px">${esc(relStr)}</div>`;
          }
        }
      }
      crewHtml += `</div>`;
    }
    crewHtml += `</div>`;
  }

  // Minimap (Deliverable 6)
  const minimapHtml = renderEvidenceMinimap(entry.room);

  // Dev mode: clue graph (Deliverable 4)
  let devHtml = "";
  if (devModeEnabled) {
    const clueGraph = getDeductionsForEntry(entry.id, journal, deductions);
    if (clueGraph.length > 0) {
      devHtml = `<div style="border-top:1px solid #f0f;margin-top:8px;padding-top:6px;color:#f0f;font-size:11px">
        <div style="font-weight:bold">CLUE GRAPH (DEV)</div>`;
      for (const cg of clueGraph) {
        const missingStr = cg.missingTags.length > 0 ? ` | Missing: ${cg.missingTags.join(", ")}` : " | COMPLETE";
        devHtml += `<div style="margin:2px 0">\u2192 ${esc(cg.category.toUpperCase())}: ${esc(cg.question.slice(0, 60))}... [tags: ${cg.contributingTags.join(", ")}${missingStr}]</div>`;
      }
      devHtml += `</div>`;
    }
  }

  return `
    <div class="journal-detail-title">${esc(entry.summary)}</div>
    <div class="journal-detail-meta">
      ${esc(entry.category.toUpperCase())} | Turn ${entry.turn} | ${esc(entry.room)}
      ${entry.thread ? ` | Thread: ${esc(entry.thread)}` : ""}
    </div>
    <div class="journal-detail-content">${esc(entry.detail)}</div>
    ${crewHtml}
    <div class="journal-detail-tags">${tagsHtml}</div>
    ${deductionLinks}
    ${minimapHtml}
    ${devHtml}`;
}

/** CONNECTIONS section — deduction list with evidence-linking. */
function renderHubConnections(deductions: import("./shared/types.js").Deduction[], journal: import("./shared/types.js").JournalEntry[]): string {
  const allTags = new Set(journal.flatMap(j => j.tags));
  const solvedIds = new Set(deductions.filter(d => d.solved).map(d => d.id));
  const unlockedSet = new Set(getUnlockedDeductions(deductions, journal).map(d => d.id));
  const categoryLabels: Record<string, string> = { what: "WHAT HAPPENED?", why: "WHY DID IT HAPPEN?", who: "WHO WAS RESPONSIBLE?" };

  // If in detail/evidence-linking view for a specific deduction
  if (hubDetailDeduction) {
    const deduction = deductions.find(d => d.id === hubDetailDeduction);
    if (deduction && !deduction.solved && unlockedSet.has(deduction.id)) {
      return renderHubConnectionDetail(deduction, journal, allTags);
    }
    hubDetailDeduction = null;
  }

  let listHtml = "";
  for (let di = 0; di < deductions.length; di++) {
    const d = deductions[di];
    const isUnlocked = unlockedSet.has(d.id);
    const locked = !d.solved && !isUnlocked;
    const isActive = di === hubIdx;

    const catLabel = categoryLabels[d.category] || d.category.toUpperCase();
    let statusIcon: string;
    let statusColor: string;

    if (d.solved) {
      statusIcon = d.answeredCorrectly ? "\u2713" : "\u2717";
      statusColor = d.answeredCorrectly ? "#0f0" : "#f44";
    } else if (isUnlocked) {
      statusIcon = "!";
      statusColor = "#fa0";
    } else {
      statusIcon = "?";
      statusColor = "#555";
    }

    let sectionClass = "broadcast-deduction";
    if (locked) sectionClass += " locked";
    if (d.solved) sectionClass += " solved";
    if (isActive) sectionClass += " active-section";

    listHtml += `<div class="${sectionClass}">`;
    listHtml += `<div class="broadcast-section-title"><span style="color:${statusColor}">[${statusIcon}]</span> ${catLabel}</div>`;

    if (d.solved) {
      const answer = d.options.find(o => o.correct === d.answeredCorrectly) || d.options[0];
      listHtml += `<div style="color:${statusColor};padding:2px 8px">${esc(answer.label)}</div>`;
    } else if (locked) {
      const chainLocked = d.unlockAfter && !solvedIds.has(d.unlockAfter);
      listHtml += `<div style="color:#555;padding:2px 8px">${chainLocked ? "Solve previous deduction first" : "Need more evidence"}</div>`;
    } else {
      listHtml += `<div style="color:#aaa;padding:2px 8px;font-size:12px">${esc(d.question)}</div>`;
      if (d.hintText) {
        listHtml += `<div style="color:#6cf;padding:2px 8px;font-size:11px;font-style:italic">\u2139 ${esc(d.hintText)}</div>`;
      }
    }

    // Tag pills
    if (!locked) {
      let tagPillsHtml = "";
      for (const tag of d.requiredTags) {
        tagPillsHtml += allTags.has(tag)
          ? `<span class="tag-pill tag-covered">${esc(tag)}</span>`
          : `<span class="tag-pill tag-missing">${esc(tag)}</span>`;
      }
      listHtml += `<div style="margin:2px 8px">${tagPillsHtml}</div>`;
    }

    // Dev mode: show full tag requirements for locked deductions
    if (devModeEnabled && locked) {
      let devTags = "";
      for (const tag of d.requiredTags) {
        devTags += allTags.has(tag)
          ? `<span class="tag-pill tag-covered">${esc(tag)}</span>`
          : `<span class="tag-pill tag-missing">${esc(tag)}</span>`;
      }
      listHtml += `<div style="margin:2px 8px;border-top:1px solid #f0f;padding-top:2px"><span style="color:#f0f;font-size:10px">DEV:</span> ${devTags}</div>`;
      const partials = journal.filter(j => j.tags.some(t => d.requiredTags.includes(t)));
      if (partials.length > 0) {
        for (const p of partials.slice(0, 3)) {
          listHtml += `<div style="color:#f0f;font-size:10px;padding:0 8px">\u2192 ${esc(p.summary)} [${p.tags.filter(t => d.requiredTags.includes(t)).join(", ")}]</div>`;
        }
      }
    }

    if (isActive && isUnlocked && !d.solved) {
      listHtml += `<div style="color:#fa0;padding:4px 8px;font-size:11px">[Enter] Link evidence &amp; answer</div>`;
    }

    listHtml += `</div>`;
  }

  return `<div style="overflow-y:auto;max-height:calc(100% - 80px);padding:4px 8px">${listHtml}</div>`;
}

/** Detail view for evidence-linking within CONNECTIONS section — split-pane + revelation board. */
function renderHubConnectionDetail(deduction: import("./shared/types.js").Deduction, journal: import("./shared/types.js").JournalEntry[], _allTags: Set<string>): string {
  const crew = state.mystery?.crew ?? [];

  // Compute real-time tag coverage from linked evidence
  const { coveredTags, missingTags } = validateEvidenceLink(deduction, hubLinkedEvidence, journal);
  const allCovered = missingTags.length === 0;

  // ── Header: question + hint + tag coverage ──
  let html = `<div style="overflow-y:auto;max-height:calc(100% - 80px);padding:4px 8px">`;
  html += `<div style="color:#fa0;font-weight:bold;font-size:14px;margin-bottom:4px">${esc(deduction.question)}</div>`;
  if (deduction.hintText) {
    html += `<div style="color:#6cf;font-size:11px;font-style:italic;margin-bottom:4px">\u2139 ${esc(deduction.hintText)}</div>`;
  }

  // Tag coverage bar
  html += `<div style="margin:2px 0 4px 0;padding:3px 6px;background:#0a0a0a;border:1px solid ${allCovered ? '#443' : '#222'};border-radius:3px">`;
  html += `<span style="color:#888;font-size:10px">Tags: </span>`;
  for (const tag of deduction.requiredTags) {
    const isCovered = coveredTags.includes(tag);
    const pillColor = isCovered ? "#0a2a0a" : "#2a0a0a";
    const pillBorder = isCovered ? "#0f0" : "#f44";
    const pillFg = isCovered ? "#0f0" : "#f44";
    const icon = isCovered ? "\u2713" : "\u2717";
    html += `<span style="display:inline-block;margin:1px 3px;padding:1px 6px;background:${pillColor};border:1px solid ${pillBorder};border-radius:8px;color:${pillFg};font-size:10px">${icon} ${esc(tag)}</span>`;
  }
  html += `</div>`;

  // ── Split pane: evidence list (left 40%) | evidence detail (right 60%) ──
  html += `<div class="journal-body" style="height:auto;max-height:220px;min-height:120px">`;

  // Left pane: evidence list with checkboxes
  const inEvidenceFocus = hubFocusRegion === "evidence";
  html += `<div class="journal-list" style="width:40%;font-size:11px;${inEvidenceFocus ? 'border-right:1px solid #fa0' : 'border-right:1px solid #222'}">`;
  html += `<div style="color:${inEvidenceFocus ? '#fa0' : '#666'};font-size:10px;font-weight:bold;padding:2px 0;border-bottom:1px solid #222">EVIDENCE${inEvidenceFocus ? ' [Space]' : ''}</div>`;
  for (let ji = 0; ji < journal.length; ji++) {
    const entry = journal[ji];
    const isLinked = hubLinkedEvidence.includes(entry.id);
    const checkbox = isLinked ? "[x]" : "[ ]";
    const isSelected = ji === hubEvidenceIdx;
    const highlight = isSelected && inEvidenceFocus ? "color:#fff;font-weight:bold;background:#1a1a2a;" : isSelected ? "color:#ccc;background:#111;" : "";
    const pointer = isSelected ? "\u25b6 " : "  ";

    // Show matching tags inline
    const matchingTags = entry.tags.filter(t => deduction.requiredTags.includes(t));
    let matchBadge = "";
    if (matchingTags.length > 0) {
      matchBadge = matchingTags.map(t => `<span style="color:#0f0;font-size:9px">${esc(t)}</span>`).join(" ");
    }

    html += `<div style="${highlight}padding:1px 2px;border-bottom:1px solid #111;cursor:default">${pointer}${checkbox} ${esc(entry.summary.slice(0, 35))}${entry.summary.length > 35 ? '...' : ''}<div style="padding-left:18px">${matchBadge}</div></div>`;
  }
  html += `</div>`;

  // Right pane: evidence detail for currently highlighted entry
  html += `<div class="journal-detail" style="width:60%;font-size:12px">`;
  if (journal.length > 0 && hubEvidenceIdx < journal.length) {
    const entry = journal[hubEvidenceIdx];
    html += `<div class="journal-detail-title" style="font-size:12px">${esc(entry.summary)}</div>`;
    html += `<div class="journal-detail-meta">${esc(entry.category.toUpperCase())} | Turn ${entry.turnDiscovered} | ${esc(entry.roomFound)}</div>`;
    html += `<div class="journal-detail-content" style="font-size:12px;max-height:100px;overflow-y:auto">${esc(entry.detail)}</div>`;

    // Tags
    let tagsLine = "";
    for (const tag of entry.tags) {
      const isRequired = deduction.requiredTags.includes(tag);
      tagsLine += isRequired
        ? `<span class="tag-pill tag-covered">${esc(tag)}</span>`
        : `<span class="tag-pill tag-missing">${esc(tag)}</span>`;
    }
    html += `<div style="margin-top:4px">${tagsLine}</div>`;

    // Crew mentioned
    if (entry.crewMentioned.length > 0) {
      const crewNames = entry.crewMentioned.map(id => {
        const member = crew.find(c => c.id === id);
        return member ? `${member.firstName} ${member.lastName} (${member.role})` : id;
      });
      html += `<div style="color:#6cf;font-size:10px;margin-top:4px">Crew: ${crewNames.map(n => esc(n)).join(", ")}</div>`;
    }
  } else {
    html += `<div class="journal-empty" style="font-size:11px">No evidence collected yet.</div>`;
  }
  html += `</div></div>`; // close split pane

  // ── Revelation Board ──
  if (deduction.tagRevelations && deduction.tagRevelations.length > 0) {
    const activeRevelations = deduction.tagRevelations.filter(tr => coveredTags.includes(tr.tag));
    if (activeRevelations.length > 0) {
      html += `<div class="revelation-board">`;
      html += `<div style="color:#886;font-size:10px;font-weight:bold;margin-bottom:4px">REVELATIONS</div>`;
      for (const rev of activeRevelations) {
        html += `<div class="revelation-line"><span class="revelation-tag">${esc(rev.tag.toUpperCase())}:</span> ${esc(rev.text)}</div>`;
      }
      html += `</div>`;
    }
  }

  // ── Synthesis block (shown when all tags covered) ──
  if (allCovered && deduction.synthesisText) {
    html += `<div class="synthesis-block">\u2605 SYNTHESIS: ${esc(deduction.synthesisText)}</div>`;
  }

  // ── Answer section ──
  const inAnswerFocus = hubFocusRegion === "answers";
  const answersClass = inAnswerFocus ? "answers-active" : (allCovered ? "answers-active" : "answers-dimmed");
  html += `<div class="${answersClass}" style="border-top:1px solid ${allCovered ? '#443' : '#222'};margin:4px 0;padding-top:4px">`;
  html += `<div style="color:${inAnswerFocus ? '#fa0' : '#888'};font-size:11px;font-weight:bold;margin-bottom:3px">${allCovered ? '\u2605 SELECT ANSWER' : 'ANSWERS'} ${inAnswerFocus ? '[Enter]' : '[Tab]'}</div>`;
  for (let i = 0; i < deduction.options.length; i++) {
    const isSelected = i === hubOptionIdx && inAnswerFocus;
    const prefix = isSelected ? "\u25b6 " : "  ";
    const cls = isSelected ? "broadcast-option selected" : "broadcast-option";
    html += `<div class="${cls}" style="font-size:12px">${prefix}${i + 1}. ${esc(deduction.options[i].label)}</div>`;
  }
  html += `</div>`;

  // Controls hint
  html += `<div style="color:#555;font-size:10px;text-align:center;margin-top:4px">[Tab] Switch focus | [Space] Link evidence | [Enter] Confirm answer | [Esc] Back</div>`;
  html += `</div>`;

  return html;
}

/** WHAT WE KNOW section — auto-generated narrative prose. */
function renderHubWhatWeKnow(): string {
  if (!state.mystery) return `<div style="padding:16px;color:#888">No mystery data available.</div>`;

  const wwk = generateWhatWeKnow(state.mystery);
  const confidenceColors: Record<string, string> = {
    none: "#555", low: "#ca8", medium: "#fa0", high: "#4a4", complete: "#0f0",
  };
  const confidenceColor = confidenceColors[wwk.confidence] || "#888";

  let html = `<div style="overflow-y:auto;max-height:calc(100% - 80px);padding:12px 16px">`;
  html += `<div style="color:${confidenceColor};font-weight:bold;margin-bottom:12px">CONFIDENCE: ${wwk.confidence.toUpperCase()}</div>`;

  for (const para of wwk.paragraphs) {
    html += `<div style="color:#ccc;margin-bottom:10px;line-height:1.5">${esc(para)}</div>`;
  }

  // Dev mode: show correct answers alongside narrative
  if (devModeEnabled) {
    const deductions = state.mystery.deductions;
    html += `<div style="border-top:1px solid #f0f;margin-top:12px;padding-top:8px;color:#f0f;font-size:11px">`;
    html += `<div style="font-weight:bold;margin-bottom:4px">DEV: CORRECT ANSWERS</div>`;
    for (const d of deductions) {
      const correct = d.options.find(o => o.correct);
      const statusMark = d.solved ? (d.answeredCorrectly ? "\u2713" : "\u2717") : "?";
      html += `<div>[${statusMark}] ${esc(d.category.toUpperCase())}: ${esc(correct?.label ?? "N/A")}</div>`;
    }
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

/** DECISIONS section — mystery choices with spoiler protection. */
function renderHubDecisions(): string {
  if (!state.mystery) return `<div style="padding:16px;color:#888">No decisions available.</div>`;

  const choices = state.mystery.choices;
  const journalCount = state.mystery.journal.length;
  const thresholds = [3, 6, 10];

  // If viewing a specific decision's detail
  if (hubDecisionDetailIdx !== null) {
    const ci = hubDecisionDetailIdx;
    const choice = choices[ci];
    if (choice && !choice.chosen && journalCount >= (thresholds[ci] ?? Infinity)) {
      return renderHubDecisionDetail(choice, ci);
    }
    hubDecisionDetailIdx = null;
  }

  let html = `<div style="overflow-y:auto;max-height:calc(100% - 80px);padding:8px">`;

  for (let ci = 0; ci < choices.length && ci < thresholds.length; ci++) {
    const choice = choices[ci];
    const available = journalCount >= thresholds[ci];
    const isActive = ci === hubIdx;

    let sectionClass = "broadcast-deduction";
    if (!available) sectionClass += " locked";
    if (choice.chosen) sectionClass += " solved";
    if (isActive) sectionClass += " active-section";

    html += `<div class="${sectionClass}">`;

    if (choice.chosen) {
      const chosenOption = choice.options.find(o => o.key === choice.chosen);
      html += `<div class="broadcast-section-title"><span style="color:#0f0">[\u2713]</span> DECISION ${ci + 1}</div>`;
      html += `<div style="color:#0f0;padding:2px 8px">\u2713 ${esc(chosenOption?.label ?? choice.chosen)}</div>`;
    } else if (!available) {
      html += `<div class="broadcast-section-title"><span style="color:#555">[?]</span> DECISION ${ci + 1}</div>`;
      html += `<div style="color:#555;padding:2px 8px">Gather more evidence (need ${thresholds[ci]}, have ${journalCount})</div>`;
    } else {
      html += `<div class="broadcast-section-title"><span style="color:#fa0">[!]</span> DECISION ${ci + 1}</div>`;
      html += `<div style="color:#aaa;padding:2px 8px;font-size:12px">A decision is available. [Enter] to review.</div>`;
    }

    html += `</div>`;
  }

  // Evacuation status
  if (state.mystery.evacuation?.active) {
    const evac = state.mystery.evacuation;
    html += `<div style="border-top:1px solid #444;margin:8px 0;padding-top:8px">`;
    html += `<div class="broadcast-section-title" style="color:#f0f">EVACUATION STATUS</div>`;
    html += `<div style="padding:4px 8px;color:#ccc">`;
    html += `<div>Crew found: <span style="color:#fff">${evac.crewFound.length}</span></div>`;
    html += `<div>Evacuated: <span style="color:#4a4">${evac.crewEvacuated.length}</span></div>`;
    if (evac.crewDead.length > 0) html += `<div>Lost: <span style="color:#f44">${evac.crewDead.length}</span></div>`;
    const remaining = evac.crewFound.length - evac.crewEvacuated.length - evac.crewDead.length;
    if (remaining > 0) html += `<div>Still need rescue: <span style="color:#fa0">${remaining}</span></div>`;
    html += `<div>Escape pods powered: <span style="color:#4af">${evac.podsPowered.length}</span></div>`;
    html += `</div></div>`;
  }

  html += `</div>`;
  return html;
}

/** Detail view for a single decision — prompt text + options revealed here. */
function renderHubDecisionDetail(choice: import("./shared/types.js").MysteryChoice, ci: number): string {
  let html = `<div style="overflow-y:auto;max-height:calc(100% - 80px);padding:12px 16px">`;
  html += `<div style="color:#ca8;font-weight:bold;font-size:14px;margin-bottom:8px">DECISION ${ci + 1}</div>`;
  html += `<div style="color:#fff;font-size:13px;margin-bottom:12px;line-height:1.4">${esc(choice.prompt)}</div>`;

  for (let i = 0; i < choice.options.length; i++) {
    const prefix = (i === hubOptionIdx) ? "\u25b6 " : "  ";
    const cls = (i === hubOptionIdx) ? "broadcast-option selected" : "broadcast-option";
    html += `<div class="${cls}">${prefix}${i + 1}. ${esc(choice.options[i].label)}</div>`;
  }

  html += `<div style="color:#888;font-size:12px;margin-top:12px">[&uarr;/&darr;] Select  [Enter] Confirm  [Esc] Back to list</div>`;
  html += `</div>`;
  return html;
}

/** Render a proportional ASCII minimap showing where evidence was found. */
function renderEvidenceMinimap(roomName: string): string {
  if (!state.rooms || state.rooms.length === 0) return "";

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const room of state.rooms) {
    minX = Math.min(minX, room.x);
    minY = Math.min(minY, room.y);
    maxX = Math.max(maxX, room.x + room.width);
    maxY = Math.max(maxY, room.y + room.height);
  }
  const mapW = 24;
  const mapH = 8;
  const scaleX = (maxX - minX) || 1;
  const scaleY = (maxY - minY) || 1;

  const grid: string[][] = [];
  for (let y = 0; y < mapH; y++) {
    grid.push(new Array(mapW).fill(" "));
  }

  for (const room of state.rooms) {
    const isVisited = visitedRoomIds.has(room.id);
    const cx = Math.floor(((room.x + room.width / 2 - minX) / scaleX) * (mapW - 1));
    const cy = Math.floor(((room.y + room.height / 2 - minY) / scaleY) * (mapH - 1));
    const gx = Math.max(0, Math.min(mapW - 1, cx));
    const gy = Math.max(0, Math.min(mapH - 1, cy));

    if (!isVisited) {
      if (grid[gy][gx] === " ") grid[gy][gx] = ".";
    } else {
      grid[gy][gx] = room.name.charAt(0).toUpperCase();
    }
  }

  const discoveryRoom = state.rooms.find(r => r.name === roomName);
  let discoveryMark = "";
  if (discoveryRoom) {
    const cx = Math.floor(((discoveryRoom.x + discoveryRoom.width / 2 - minX) / scaleX) * (mapW - 1));
    const cy = Math.floor(((discoveryRoom.y + discoveryRoom.height / 2 - minY) / scaleY) * (mapH - 1));
    const gx = Math.max(0, Math.min(mapW - 1, cx));
    const gy = Math.max(0, Math.min(mapH - 1, cy));
    grid[gy][gx] = "*";
    discoveryMark = ` (* = ${esc(roomName)})`;
  }

  const gridStr = grid.map(row => row.join("")).join("\n");
  return `<div style="border-top:1px solid #222;margin-top:8px;padding-top:6px">
    <div style="color:#ca8;font-size:11px;font-weight:bold">FOUND IN: ${esc(roomName)}${discoveryMark}</div>
    <pre style="color:#4a4;font-size:10px;line-height:1.2;margin:4px 0;font-family:monospace">${gridStr}</pre>
  </div>`;
}

function fmtRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function closeInvestigationHub(): void {
  const overlay = document.getElementById("broadcast-overlay");
  if (overlay) {
    overlay.classList.remove("active");
    overlay.innerHTML = "";
  }
  investigationHubOpen = false;
  hubDetailDeduction = null;
  hubDecisionDetailIdx = null;
  display.addLog("[Investigation Hub closed]", "system");
  renderAll();
}

/** Handle all keyboard input while the Investigation Hub is open. */
function handleHubInput(e: KeyboardEvent): void {
  e.preventDefault();
  if (!state.mystery) return;

  // F5 toggles dev mode
  if (e.key === "F5") {
    devModeEnabled = !devModeEnabled;
    renderInvestigationHub();
    return;
  }

  // Revelation overlay: any key dismisses
  if (hubRevelationOverlay) {
    hubRevelationOverlay = false;
    hubDetailDeduction = null;
    hubLinkedEvidence = [];
    hubEvidenceIdx = 0;
    hubFocusRegion = "evidence";
    const overlay = document.getElementById("broadcast-overlay");
    if (overlay) {
      overlay.classList.remove("active");
      overlay.innerHTML = "";
    }
    renderInvestigationHub();
    return;
  }

  // Confirmation step: Y/N for deduction or choice
  if (hubConfirming || hubChoiceConfirming) {
    if (e.key === "y" || e.key === "Y") {
      if (hubConfirming) {
        hubConfirming = false;
        commitHubDeductionAnswer();
      } else {
        hubChoiceConfirming = false;
        commitHubChoiceAnswer();
      }
      return;
    }
    if (e.key === "n" || e.key === "N" || e.key === "Escape") {
      hubConfirming = false;
      hubChoiceConfirming = false;
      renderInvestigationHub();
      return;
    }
    return;
  }

  // Escape from detail views first
  if (hubDetailDeduction && e.key === "Escape") {
    // Persist linked evidence back to deduction state before leaving
    if (state.mystery) {
      state.mystery.deductions = state.mystery.deductions.map(d =>
        d.id === hubDetailDeduction ? { ...d, linkedEvidence: [...hubLinkedEvidence] } : d
      );
    }
    hubDetailDeduction = null;
    hubLinkedEvidence = [];
    hubEvidenceIdx = 0;
    hubFocusRegion = "evidence";
    renderInvestigationHub();
    return;
  }
  if (hubDecisionDetailIdx !== null && e.key === "Escape") {
    hubDecisionDetailIdx = null;
    hubOptionIdx = 0;
    renderInvestigationHub();
    return;
  }

  // Close hub
  if (e.key === "Escape" || (e.key === "r" && !hubDetailDeduction && hubDecisionDetailIdx === null) || (e.key === "v" && hubSection === "evidence" && !hubDetailDeduction)) {
    closeInvestigationHub();
    return;
  }

  // Tab cycles sections
  if (e.key === "Tab" && !hubDetailDeduction && hubDecisionDetailIdx === null) {
    const tabs: Array<"evidence" | "connections" | "whatweknow" | "decisions"> = ["evidence", "connections", "whatweknow", "decisions"];
    const curIdx = tabs.indexOf(hubSection);
    hubSection = tabs[(curIdx + 1) % tabs.length];
    hubIdx = 0;
    hubOptionIdx = 0;
    renderInvestigationHub();
    return;
  }

  // Section-specific input handling
  if (hubSection === "evidence") {
    handleHubEvidenceInput(e);
  } else if (hubSection === "connections") {
    handleHubConnectionsInput(e);
  } else if (hubSection === "whatweknow") {
    // No interactive elements in What We Know
    return;
  } else if (hubSection === "decisions") {
    handleHubDecisionsInput(e);
  }
}

function handleHubEvidenceInput(e: KeyboardEvent): void {
  const { entries } = getEvidenceEntries();
  const maxIdx = entries.length - 1;

  if (e.key === "ArrowUp" || e.key === "w" || e.key === "k") {
    hubIdx = Math.max(0, hubIdx - 1);
    renderInvestigationHub();
    return;
  }
  if (e.key === "ArrowDown" || e.key === "s" || e.key === "j") {
    hubIdx = Math.min(maxIdx, hubIdx + 1);
    renderInvestigationHub();
    return;
  }
}

function handleHubConnectionsInput(e: KeyboardEvent): void {
  const deductions = state.mystery?.deductions ?? [];
  const journal = state.mystery?.journal ?? [];
  const unlockedSet = new Set(getUnlockedDeductions(deductions, journal).map(d => d.id));

  // If in detail/evidence-linking view
  if (hubDetailDeduction) {
    const deduction = deductions.find(d => d.id === hubDetailDeduction);
    if (!deduction || deduction.solved || !unlockedSet.has(deduction.id)) {
      hubDetailDeduction = null;
      renderInvestigationHub();
      return;
    }

    // Tab toggles focus between evidence list and answer options
    if (e.key === "Tab") {
      e.preventDefault();
      hubFocusRegion = hubFocusRegion === "evidence" ? "answers" : "evidence";
      renderInvestigationHub();
      return;
    }

    // ── Evidence focus region ──
    if (hubFocusRegion === "evidence") {
      if (e.key === "ArrowUp" || e.key === "w") {
        hubEvidenceIdx = Math.max(0, hubEvidenceIdx - 1);
        renderInvestigationHub();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "s") {
        hubEvidenceIdx = Math.min(journal.length - 1, hubEvidenceIdx + 1);
        renderInvestigationHub();
        return;
      }
      if (e.key === " ") {
        if (journal.length > 0 && hubEvidenceIdx < journal.length) {
          const entryId = journal[hubEvidenceIdx].id;

          // Compute coverage before toggle
          const coverageBefore = validateEvidenceLink(deduction, hubLinkedEvidence, journal);

          if (hubLinkedEvidence.includes(entryId)) {
            hubLinkedEvidence = hubLinkedEvidence.filter(id => id !== entryId);
            hubLinkFeedback = "";
          } else {
            hubLinkedEvidence = [...hubLinkedEvidence, entryId];

            // Compute coverage after adding this evidence
            const coverageAfter = validateEvidenceLink(deduction, hubLinkedEvidence, journal);
            const newTags = coverageAfter.coveredTags.filter(t => !coverageBefore.coveredTags.includes(t));

            if (coverageAfter.missingTags.length === 0) {
              hubLinkFeedback = "All evidence requirements met! Press Tab to select your answer.";
              audio.playDeductionReady();
            } else if (newTags.length > 0) {
              // Show revelation text for the new tag if available
              const revelation = deduction.tagRevelations?.find(tr => newTags.includes(tr.tag));
              if (revelation) {
                hubLinkFeedback = ""; // revelation shown in revelation board
              } else {
                hubLinkFeedback = "";
              }
              audio.playDeductionReady();
            } else {
              hubLinkFeedback = "This evidence doesn't add new insight to this question.";
            }
          }

          // Update linked evidence on deduction state immediately
          if (state.mystery) {
            state.mystery.deductions = state.mystery.deductions.map(d =>
              d.id === hubDetailDeduction ? { ...d, linkedEvidence: [...hubLinkedEvidence] } : d
            );
          }
        }
        renderInvestigationHub();
        return;
      }
      return;
    }

    // ── Answers focus region ──
    if (hubFocusRegion === "answers") {
      if (e.key === "ArrowUp" || e.key === "w") {
        hubOptionIdx = Math.max(0, hubOptionIdx - 1);
        renderInvestigationHub();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "s") {
        hubOptionIdx = Math.min(deduction.options.length - 1, hubOptionIdx + 1);
        renderInvestigationHub();
        return;
      }
      if (e.key === "Enter") {
        // Only allow answer submission if synthesis is revealed (all tags covered)
        const { missingTags: currentMissing } = validateEvidenceLink(deduction, hubLinkedEvidence, journal);
        if (currentMissing.length > 0) {
          hubLinkFeedback = "Link more evidence before answering — not all required tags covered.";
          renderInvestigationHub();
          return;
        }
        const chosenOption = deduction.options[hubOptionIdx];
        hubConfirming = true;
        const overlay = document.getElementById("broadcast-overlay");
        if (overlay) {
          overlay.innerHTML = `
            <div class="broadcast-box">
              <div class="broadcast-title">\u2550\u2550\u2550 CONFIRM DEDUCTION \u2550\u2550\u2550</div>
              <div style="padding:20px;text-align:center">
                <div style="color:#fa0;font-size:16px;margin-bottom:12px">${esc(deduction.question)}</div>
                <div style="color:#fff;font-size:14px;margin-bottom:16px">Your answer: <span style="color:#6cf">${esc(chosenOption.label)}</span></div>
                <div style="color:#f44;font-size:13px;margin-bottom:8px">This answer is permanent.</div>
                <div style="color:#aaa;font-size:14px">Are you sure? [Y] Confirm  [N] Go back</div>
              </div>
            </div>`;
        }
        return;
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= deduction.options.length) {
        hubOptionIdx = num - 1;
        renderInvestigationHub();
        return;
      }
      return;
    }
    return;
  }

  // List view navigation
  if (e.key === "ArrowUp" || e.key === "w") {
    hubIdx = Math.max(0, hubIdx - 1);
    renderInvestigationHub();
    return;
  }
  if (e.key === "ArrowDown" || e.key === "s") {
    hubIdx = Math.min(deductions.length - 1, hubIdx + 1);
    renderInvestigationHub();
    return;
  }
  if (e.key === "Enter") {
    const d = deductions[hubIdx];
    if (d && !d.solved && unlockedSet.has(d.id)) {
      hubDetailDeduction = d.id;
      hubLinkedEvidence = [...d.linkedEvidence];  // restore from state, not reset
      hubEvidenceIdx = 0;
      hubOptionIdx = 0;
      hubFocusRegion = "evidence";
      hubLinkFeedback = "";
      renderInvestigationHub();
    }
    return;
  }
}

function handleHubDecisionsInput(e: KeyboardEvent): void {
  const choices = state.mystery?.choices ?? [];
  const journalCount = state.mystery?.journal.length ?? 0;
  const thresholds = [3, 6, 10];

  // If viewing a decision detail
  if (hubDecisionDetailIdx !== null) {
    const choice = choices[hubDecisionDetailIdx];
    if (!choice || choice.chosen) {
      hubDecisionDetailIdx = null;
      renderInvestigationHub();
      return;
    }

    if (e.key === "ArrowUp" || e.key === "w") {
      hubOptionIdx = Math.max(0, hubOptionIdx - 1);
      renderInvestigationHub();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "s") {
      hubOptionIdx = Math.min(choice.options.length - 1, hubOptionIdx + 1);
      renderInvestigationHub();
      return;
    }
    if (e.key === "Enter") {
      const chosenOption = choice.options[hubOptionIdx];
      hubChoiceConfirming = true;
      const overlay = document.getElementById("broadcast-overlay");
      if (overlay) {
        overlay.innerHTML = `
          <div class="broadcast-box">
            <div class="broadcast-title">\u2550\u2550\u2550 CONFIRM DECISION \u2550\u2550\u2550</div>
            <div style="padding:20px;text-align:center">
              <div style="color:#ca8;font-size:14px;margin-bottom:12px">${esc(choice.prompt.slice(0, 120))}${choice.prompt.length > 120 ? "..." : ""}</div>
              <div style="color:#fff;font-size:14px;margin-bottom:16px">Your decision: <span style="color:#6cf">${esc(chosenOption.label)}</span></div>
              <div style="color:#fa0;font-size:13px;margin-bottom:8px">This will be included in your report.</div>
              <div style="color:#aaa;font-size:14px">Confirm? [Y] Yes  [N] Go back</div>
            </div>
          </div>`;
      }
      return;
    }
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= choice.options.length) {
      hubOptionIdx = num - 1;
      renderInvestigationHub();
      return;
    }
    return;
  }

  // List view
  const maxIdx = Math.min(choices.length, thresholds.length) - 1;
  if (e.key === "ArrowUp" || e.key === "w") {
    hubIdx = Math.max(0, hubIdx - 1);
    renderInvestigationHub();
    return;
  }
  if (e.key === "ArrowDown" || e.key === "s") {
    hubIdx = Math.min(maxIdx, hubIdx + 1);
    renderInvestigationHub();
    return;
  }
  if (e.key === "Enter") {
    const ci = hubIdx;
    const choice = choices[ci];
    if (choice && !choice.chosen && journalCount >= (thresholds[ci] ?? Infinity)) {
      hubDecisionDetailIdx = ci;
      hubOptionIdx = 0;
      renderInvestigationHub();
    }
    return;
  }
}

/** Commit deduction answer after Y/N confirmation. Shows revelation overlay. */
function commitHubDeductionAnswer(): void {
  if (!state.mystery || !hubDetailDeduction) return;
  const deductions = state.mystery.deductions;
  const journal = state.mystery.journal;
  const deduction = deductions.find(d => d.id === hubDetailDeduction);
  if (!deduction) return;

  const linked = linkEvidence(deduction, hubLinkedEvidence);
  const chosen = linked.options[hubOptionIdx];
  const { deduction: solved, correct, validLink } = solveDeduction(linked, chosen.key, journal);

  if (!validLink) {
    const { missingTags } = validateEvidenceLink(linked, linked.linkedEvidence, journal);
    display.addLog(`Cannot answer — evidence incomplete. Need: ${missingTags.join(", ")}`, "warning");
    renderInvestigationHub();
    return;
  }

  state.mystery.deductions = state.mystery.deductions.map(d =>
    d.id === solved.id ? solved : d
  );

  // Show narrative revelation overlay
  const overlay = document.getElementById("broadcast-overlay");
  if (correct) {
    display.addLog(`\u2713 CORRECT — ${solved.rewardDescription}`, "milestone");
    display.triggerScreenFlash("milestone");
    audio.playDeductionCorrect();
    applyDeductionReward(solved);

    // Find next unlocked deduction for "UNLOCKED" line
    const nextDeduction = deductions.find(d => d.unlockAfter === solved.id && !d.solved);
    const nextLine = nextDeduction ? `<div style="color:#6cf;margin-top:8px">UNLOCKED: ${esc(nextDeduction.question)}</div>` : "";

    if (overlay) {
      overlay.classList.add("active");
      overlay.innerHTML = `
        <div class="revelation-overlay-box correct">
          <div style="color:#fa0;font-size:18px;font-weight:bold;letter-spacing:3px;margin-bottom:12px">\u2605 REVELATION \u2605</div>
          <div style="color:#fa0;font-size:14px;margin-bottom:12px">${esc(solved.question)}</div>
          <div style="color:#0f0;font-size:13px;margin-bottom:12px">\u2713 ${esc(chosen.label)}</div>
          ${solved.conclusionText ? `<div style="color:#ca8;font-size:13px;line-height:1.6;margin:12px 0;padding:8px 12px;border-left:2px solid #553;text-align:left">${esc(solved.conclusionText)}</div>` : ""}
          <div style="color:#4a8;font-size:12px;margin-top:8px">REWARD: ${esc(solved.rewardDescription)}</div>
          ${nextLine}
          <div style="color:#555;font-size:12px;margin-top:16px;animation:crawl-skip-pulse 1.5s ease-in-out infinite">[Press any key to continue]</div>
        </div>`;
      hubRevelationOverlay = true;
    }

    if (devModeEnabled) {
      display.addLog(`[DEV] Deduction ${solved.id} solved correctly`, "system");
    }
  } else {
    display.addLog(`\u2717 Incorrect. The evidence doesn't support that conclusion.`, "warning");
    audio.playDeductionWrong();

    if (overlay) {
      overlay.classList.add("active");
      overlay.innerHTML = `
        <div class="revelation-overlay-box incorrect">
          <div style="color:#f44;font-size:18px;font-weight:bold;letter-spacing:3px;margin-bottom:12px">\u2717 INCONCLUSIVE</div>
          <div style="color:#888;font-size:13px;line-height:1.6;margin:12px 0">The evidence doesn't support that conclusion.<br>Review the revelations and reconsider.</div>
          <div style="color:#555;font-size:12px;margin-top:16px;animation:crawl-skip-pulse 1.5s ease-in-out infinite">[Press any key to continue]</div>
        </div>`;
      hubRevelationOverlay = true;
    }
  }

  if (!hubRevelationOverlay) {
    // Fallback if no overlay shown
    hubDetailDeduction = null;
    hubLinkedEvidence = [];
    hubEvidenceIdx = 0;
    renderInvestigationHub();
  }
}

/** Commit mystery choice after Y/N confirmation. */
function commitHubChoiceAnswer(): void {
  if (!state.mystery || hubDecisionDetailIdx === null) return;
  const ci = hubDecisionDetailIdx;
  const choice = state.mystery.choices[ci];
  if (!choice || choice.chosen) return;

  const chosenOption = choice.options[hubOptionIdx];
  state.mystery.choices[ci] = {
    ...choice,
    chosen: chosenOption.key,
    turnPresented: state.turn,
  };
  display.addLog(`Decision recorded: ${chosenOption.label}`, "milestone");
  display.triggerScreenFlash("milestone");
  audio.playChoice();
  hubDecisionDetailIdx = null;
  hubOptionIdx = 0;
  renderInvestigationHub();
}

/** HTML-escape helper. */
function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Start: check for save or show opening crawl ─────────────────
const savedState = hasSave() ? loadGame() : null;
if (savedState) {
  state = savedState;
  gameStarted = true;
  initGame();
  // display is now assigned by initGame
  display.addLog("[Save loaded — resuming session]", "milestone");
  renderAll();
} else {
  showOpeningCrawl();
}
