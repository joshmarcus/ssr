import { generate } from "./sim/procgen.js";
import { step, applyDeductionReward as applyDeductionRewardSim, checkIQMilestones } from "./sim/step.js";
import { STORY_ROLES } from "./sim/deduction.js";
import { BrowserDisplay3D } from "./render/display3d.js";
import type { IGameDisplay } from "./render/displayInterface.js";
import type { LogType } from "./render/displayInterface.js";
import { InputHandler } from "./render/input.js";
import { AudioManager } from "./render/audio.js";
import { GOLDEN_SEED } from "./shared/constants.js";
import { getOpeningCrawl, STATION_NAME, STATION_SUBTITLE, TAGLINE } from "./data/lore.js";
import {
  VICTORY_TITLE, DEFEAT_TITLE,
  DEFEAT_RELAY_TITLE,
  VICTORY_EPILOGUE_MINIMAL,
  ENDING_BY_DISCOVERY, SPECIFIC_DISCOVERIES,
  CLASSIFIED_DIRECTIVE_LOG_FRAGMENT, CLASSIFIED_DIRECTIVE_TEXT,
  getVictoryText, getVictoryEpiloguePartial, getVictoryEpilogueComplete,
  getDefeatText, getDefeatRelayText,
} from "./data/endgame.js";
import { getRoomDescription, getIncidentTrace } from "./data/roomDescriptions.js";
import { CORVUS_REACTIONS, CORVUS_FINAL_TRANSMISSION, CORVUS_DEDUCTION_CEREMONY, ARCHETYPE_ATMOSPHERE } from "./data/narrative.js";
import {
  BOT_INTROSPECTIONS, BOT_INTROSPECTIONS_BY_ARCHETYPE,
  DRONE_STATUS_MESSAGES, FIRST_DRONE_ENCOUNTER,
  AMBIENT_HEAT_MESSAGES, AMBIENT_HEAT_DEFAULT, CLEANING_MESSAGES, DIRT_TRAIL_HINTS,
  DRONE_ENCOUNTER_LOGS, DRONE_CLEANING_MESSAGE,
  TUTORIAL_HINTS_EARLY, TUTORIAL_HINT_FIRST_EVIDENCE, TUTORIAL_HINT_FIRST_DEDUCTION,
  TUTORIAL_HINT_INVESTIGATION, TUTORIAL_HINT_FIRST_INTERACT, TUTORIAL_HINT_FIRST_SCAN,
  TUTORIAL_HINT_FIRST_CLEAN, PRESSURE_ZONE_HINTS,
  CREW_DISTRESS_HINT, BREACH_PROXIMITY_HINT,
  ROOM_AMBIENT_EVENTS, ROOM_AMBIENT_DEFAULT, CORRIDOR_AMBIENT, CORRIDOR_AMBIENT_MOOD, MOOD_FLAVOR,
  type StationMood,
  CREW_ESCORT_ARC,
  CORVUS_GREETING, CORVUS_PERSONALITY_REACTIONS, CORVUS_PERSONALITIES,
  type CorvusPersonality,
  CONTRADICTION_FALSE_LEAD, CONTRADICTION_REFUTATION, CORVUS_CONTRADICTION_NOTICE,
  CREW_FATE_REVEALS,
  DATA_CORE_DWELL_WARNINGS,
  FIRST_DISCOVERY_BEATS,
  COOLANT_CASCADE_WARNINGS, HULL_BREACH_CORRUPTION_WARNINGS,
  SABOTAGE_ORGANISM_WARNINGS, SIGNAL_PULSE_WARNINGS,
  CORVUS_FINAL_APPROACH,
  CORVUS_MISSION_BRIEFING,
  PACING_NUDGE_CLEAN, PACING_NUDGE_INVESTIGATE, PACING_NUDGE_RECOVER, PACING_NUDGE_EVACUATE,
  CORVUS_WITNESS_COMMENTARY,
} from "./data/narrative.js";
import type { Action, MysteryChoice, Deduction, CrewMember, Entity, CrewDossier, RoomScene } from "./shared/types.js";
import { ActionType, SensorType, EntityType, ObjectivePhase, DeductionCategory, Direction, Difficulty, IncidentArchetype, CrewRole, CrewFate, TileType, SceneActivity, SceneOutcome, TimelinePhase } from "./shared/types.js";
import { computeChoiceEndings, computeBranchedEpilogue, isMoralChoiceUnlocked } from "./sim/mysteryChoices.js";
import { getUnlockedDeductions, getTagCoverage, solveDeduction } from "./sim/deduction.js";
import { getRoomAt, getRoomCleanliness } from "./sim/rooms.js";
import { saveGame, loadGame, hasSave, deleteSave, recordRun, getRunHistory, checkAchievements, getAchievements } from "./sim/saveLoad.js";
import { isEntityExhausted } from "./shared/ui.js";
import { computeGoals, computeGoalDiscoveries, type Goal, type Subgoal } from "./shared/goals.js";
import { formatRelationship, formatCrewMemberDetail, getDeductionsForEntry } from "./sim/whatWeKnow.js";

// ── Archetype display names ─────────────────────────────────────
const ARCHETYPE_DISPLAY_NAMES: Record<IncidentArchetype, string> = {
  [IncidentArchetype.CoolantCascade]: "THE WHISTLEBLOWER",
  [IncidentArchetype.HullBreach]: "THE MURDER",
  [IncidentArchetype.ReactorScram]: "THE ROGUE AI",
  [IncidentArchetype.Sabotage]: "THE STOWAWAY",
  [IncidentArchetype.SignalAnomaly]: "FIRST CONTACT",
  [IncidentArchetype.Mutiny]: "THE MUTINY",
};

// ── Parse seed and difficulty from URL params ───────────────────
const LAST_SEED_KEY = "ssr_last_seed";
const params = new URLSearchParams(window.location.search);

function getNextSeed(): number {
  try {
    const stored = localStorage.getItem(LAST_SEED_KEY);
    if (stored) return (parseInt(stored, 10) + 1) % 1000000;
  } catch { /* ignore */ }
  return GOLDEN_SEED;
}

// URL param takes priority, then stored seed+1, then golden seed
let seed = params.has("seed")
  ? parseInt(params.get("seed")!, 10)
  : getNextSeed();
// Derive station mood from seed (3 variants: cold/hot/silent)
const MOOD_TYPES: StationMood[] = ["cold", "hot", "silent"];
let stationMood: StationMood = MOOD_TYPES[seed % 3];
// Derive CORVUS-7 personality from seed (3 variants: analytical/empathetic/cryptic)
let corvusPersonality: CorvusPersonality = CORVUS_PERSONALITIES[(seed >> 2) % 3];
const difficultyParam = params.get("difficulty") || "normal";
let difficulty: Difficulty = difficultyParam === "easy" ? Difficulty.Easy
  : difficultyParam === "hard" ? Difficulty.Hard
  : Difficulty.Normal;

// ── DOM elements ────────────────────────────────────────────────
const containerEl = document.getElementById("rot-display")!;
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

    // Boot sequence: typed-out system messages before player control
    crawlOverlay.innerHTML = "";
    const bootPre = document.createElement("pre");
    bootPre.className = "crawl-text";
    bootPre.style.fontSize = "12px";
    bootPre.style.lineHeight = "1.6";
    bootPre.textContent = "";
    crawlOverlay.appendChild(bootPre);

    const sensorStr = (state.player.sensors ?? []).length > 1 ? "MULTI-BAND" : "CLEANLINESS";
    const roomCount = state.rooms.length;
    const bootMessages = [
      { text: "SIGNAL ACQUIRED...", delay: 0 },
      { text: "TERMINAL SYNC — LOW-BITRATE RELAY", delay: 400 },
      { text: `UNIT ID: SWEEPO-${seed % 10000}  [MAINTENANCE ROVER]`, delay: 800 },
      { text: `SENSOR ARRAY: ${sensorStr}`, delay: 1100 },
      { text: `STATION MAP: ${roomCount} SECTIONS DETECTED`, delay: 1400 },
      { text: "CORVUS-7 HANDSHAKE — OK", delay: 1700 },
      { text: "LINK ESTABLISHED — AWAITING INPUT", delay: 2100 },
    ];

    for (const msg of bootMessages) {
      setTimeout(() => {
        bootPre.textContent += (bootPre.textContent ? "\n" : "") + "> " + msg.text;
        bootPre.scrollIntoView({ block: "end" });
      }, msg.delay);
    }

    // After boot sequence completes, start the game
    setTimeout(() => {
      crawlOverlay.style.display = "none";
      gameStarted = true;
      initGame();
    }, 2600);
  };

  window.addEventListener("keydown", startGame);
  crawlOverlay.addEventListener("click", startGame);
}

// ── Game initialization ─────────────────────────────────────────
// Persist initial seed for next-game sequencing
try { localStorage.setItem(LAST_SEED_KEY, String(seed)); } catch { /* ignore */ }
let state = generate(seed, difficulty);
let display: IGameDisplay = undefined!; // assigned in initGame()
let inputHandler: InputHandler;
let lastPlayerRoomId = "";
const visitedRoomIds = new Set<string>();
const audio = new AudioManager();
// Restore saved volume preference
try {
  const savedVol = localStorage.getItem("ssr_volume");
  if (savedVol !== null) audio.setVolume(parseFloat(savedVol));
} catch { /* ignore */ }
let firstDroneEncounterShown = false;
const triggeredBotIntrospections = new Set<number>();
const droneEncounterSet = new Set<string>(); // Track which drones have triggered unique encounter logs
const triggeredTutorialHints = new Set<string>(); // Track which tutorial hints have been shown
let crewDistressHintShown = false;
let breachProximityHintShown = false;
let cleanMsgIndex = 0;
let lastAmbientRoomId = "";
let currentRoomTurns = 0; // turns spent in current room (for ambient events)
let lastRoomIdForAmbient = ""; // track room changes for ambient counter
const escortArcSteps = new Map<string, number>(); // track escort dialogue arc step per crew NPC
const corridorAmbientFired = new Set<string>(); // track corridor segments that have triggered ambient text
let lastCorridorAmbientTurn = 0; // cooldown: don't fire corridor ambient more than once per 20 turns
let lastStationEventTurn = 0; // cooldown for station-wide ambient events
let lastJournalLength = 0; // track journal size for insight notifications
const previouslyUnlockedDeductions = new Set<string>(); // track deduction IDs that were already unlocked
const foreshadowedRooms = new Map<string, string>(); // room name → log excerpt (for manuscript echo)
const echoedRooms = new Set<string>(); // rooms where we've already shown the echo
let journalOpen = false;
let journalTab: "evidence" | "deductions" = "evidence";
let activeChoice: MysteryChoice | null = null;
let choiceSelectedIdx = 0;
let choicesPresented = new Set<string>();
// ── Discovery moment transition tracking ──
let prevCrackMomentFired = false;
let prevRevealedContradictions = 0;
let prevConfirmedSlots = 0;
let prevIdentifiedCrew = 0;
let lastObjectivePhase: ObjectivePhase | null = null;
let activeDeduction: Deduction | null = null;
let deductionSelectedIdx = 0;
let pendingCrewDoor: { entityId: string; crewName: string } | null = null;
let confirmingDeduction = false; // Y/N confirmation before locking in deduction answer
let mapOpen = false;
let helpOpen = false;
let autoSaveFlashTimer = 0; // performance.now() timestamp of last auto-save (0 = no flash)
let runStartTime = Date.now(); // real-time start of current run (for elapsed timer)
let hudTipText = ""; // contextual tip text shown below action bar
let hudTipShowTime = 0; // performance.now() when tip was shown
let lastHudTipKey = ""; // prevent same tip from repeating within 30 turns
let lastHudTipTurn = 0; // turn when last tip was shown
let incidentCardOpen = false;
let logReviewOpen = false;
// ── Investigation Hub state ──────────────────────────────────────
let investigationHubOpen = false;
let hubSection: "evidence" | "connections" | "crew" | "scenes" = "evidence";
let hubIdx = 0;                       // selected item index within current section
let hubOptionIdx = 0;                 // selected option within a deduction/choice
let hubDetailDeduction: string | null = null; // deduction ID in detail/answer mode
let hubConfirming = false;            // Y/N confirmation for deduction answer
// Scene processing sub-state
let hubSceneDetail: string | null = null; // room ID of scene being viewed in detail
let hubSceneSubView: "clues" | "process" = "clues"; // sub-tab within scene detail
let hubSceneWhoIdx = 0;     // selected crew index for WHO answer
let hubSceneWhatIdx = 0;    // selected activity for WHAT answer
let hubSceneOutcomeIdx = 0; // selected outcome for OUTCOME answer
let hubSceneConfirming = false; // Y/N confirmation for scene processing
let hubSceneResult: {
  score: number;
  roomName: string;
  timestamp: number;
  whoCorrect: boolean;
  whatCorrect: boolean;
  outcomeCorrect: boolean;
  whoAnswer: string;
  whatAnswer: string;
  outcomeAnswer: string;
  correctWho: string;
  correctWhat: string;
  correctOutcome: string;
} | null = null; // per-dimension result display after scene processing
let hubEvidenceFilter: "all" | "by_room" | "by_type" | "by_thread" | "unread" = "all"; // evidence tab filter mode
const hubViewedEvidenceIds = new Set<string>(); // tracks which evidence entries player has viewed in Hub
let hubRevelationOverlay = false; // showing post-answer revelation overlay
let pendingCeremonyDeduction: { id: string; correct: boolean } | null = null; // for post-overlay CORVUS-7 commentary
// ── Goal panel state ──────────────────────────────────────────
let goalPanelOpen = false;
let goalPanelIdx = 0;           // selected goal index
let focusedGoalId: string | null = null; // player's chosen focus goal
const discoveredGoalIds = new Set<string>(); // persistent set of discovered goal IDs
let lastGoalDiscoveryCount = 0; // for detecting new discoveries
let contradictionFalseLeadFired = false; // has the misleading log been shown
let contradictionRefutationFired = false; // has the refutation been shown
// ── ReactorScram dwell penalty (data core surveillance) ──────────
let dwellTurnsStationary = 0; // consecutive turns in same room without moving
let dwellRoomId = ""; // room being tracked
let dwellWarning12Fired = false;
let dwellWarning20Fired = false;
let firstDiscoveryBeat = 0; // 0-3: tracks how many discovery beats have fired
// ── Archetype mid-game mechanic trackers ──────────────────────
let cascadePhase = 0; // CoolantCascade: heat spread ticks
let breachCorruptionPhase = 0; // HullBreach: terminal corruption ticks
let sabotageOrganismPhase = 0; // Sabotage: organism relocation ticks
let signalPulseCounter = 0; // SignalAnomaly: turns until next pulse
let sensorBlockedTurns = 0; // SignalAnomaly: turns remaining with sensors blocked
let lastEvidenceViewCount = 0; // journal count when EVIDENCE tab was last viewed
let scrubberHintFired = false; // one-time hint when scrubber first activates
let beaconHintFired = false; // one-time hint when beacon first deploys
let lastProgressTurn = 0; // last turn where player made meaningful progress
let lastNudgeTurn = 0; // prevent nudge spam
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

// ── Restart confirmation state ────────────────────────────────
let restartPending = false;

// ── Pause menu state ──────────────────────────────────────────
let pauseMenuOpen = false;
let pauseMenuIdx = 0; // selected menu item index

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

  // Build set of tiles inside rooms for room-biased exploration
  const roomTiles = new Set<string>();
  for (const room of state.rooms) {
    for (let ry = room.y; ry < room.y + room.height; ry++) {
      for (let rx = room.x; rx < room.x + room.width; rx++) {
        if (ry >= 0 && ry < state.height && rx >= 0 && rx < state.width) {
          roomTiles.add(key(rx, ry));
        }
      }
    }
  }

  // BFS helper — returns first direction toward nearest tile matching predicate
  function bfs(isGoal: (x: number, y: number, tile: typeof state.tiles[0][0]) => boolean): Direction | null {
    const vis = new Set<string>();
    const q: { x: number; y: number; firstDir: Direction }[] = [];
    vis.add(key(px, py));
    for (const { dx, dy, dir } of dirs) {
      const nx = px + dx;
      const ny = py + dy;
      if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
      if (!state.tiles[ny][nx].walkable) continue;
      vis.add(key(nx, ny));
      q.push({ x: nx, y: ny, firstDir: dir });
    }
    let head = 0;
    while (head < q.length) {
      const { x, y, firstDir } = q[head++];
      if (isGoal(x, y, state.tiles[y][x])) return firstDir;
      for (const { dx, dy } of dirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
        const k = key(nx, ny);
        if (vis.has(k)) continue;
        if (!state.tiles[ny][nx].walkable) continue;
        vis.add(k);
        q.push({ x: nx, y: ny, firstDir });
      }
    }
    return null;
  }

  // Pass 1: Prioritize unexplored room tiles (rooms have entities, scenes, evidence)
  const roomDir = bfs((x, y, tile) => !tile.explored && roomTiles.has(key(x, y)));
  if (roomDir) return roomDir;

  // Pass 2: Fall back to any unexplored walkable tile (corridors)
  return bfs((_x, _y, tile) => !tile.explored);
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

/** Execute one auto-explore step — phase-aware smart exploration. */
function autoExploreStep(): void {
  if (!autoExploring || state.gameOver) {
    stopAutoExplore();
    return;
  }

  const prevHp = state.player.hp;
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;
  const phase = state.mystery?.objectivePhase;

  // Phase-aware action: clean during Maintenance (threshold 20 avoids wasting turns on near-clean tiles)
  if (phase === ObjectivePhase.Clean) {
    if (py >= 0 && py < state.height && px >= 0 && px < state.width) {
      if (state.tiles[py][px].dirt > 20) {
        handleAction({ type: ActionType.Clean });
        autoExploreTimer = setTimeout(autoExploreStep, AUTO_EXPLORE_DELAY);
        return;
      }
    }
  }

  // Phase-aware action: auto-interact with adjacent evidence during Investigate/Recover
  if (phase === ObjectivePhase.Investigate || phase === ObjectivePhase.Recover) {
    const interactTarget = getAutoExploreInteractTarget();
    if (interactTarget) {
      handleAction({ type: ActionType.Interact, targetId: interactTarget });
      autoExploreTimer = setTimeout(autoExploreStep, AUTO_EXPLORE_DELAY);
      return;
    }

    // Auto-examine room scene clues when in a room with unexamined clues
    if (state.mystery?.roomScenes) {
      const currentRoom = state.rooms.find(r =>
        px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height
      );
      if (currentRoom) {
        const scene = state.mystery.roomScenes.find(s => s.roomId === currentRoom.id);
        if (scene && !scene.processed && scene.physicalClues.some(c => !c.examined)) {
          handleAction({ type: ActionType.ExamineScene, sceneRoomId: currentRoom.id });
          autoExploreTimer = setTimeout(autoExploreStep, AUTO_EXPLORE_DELAY);
          return;
        }
      }
    }
  }

  const dir = autoExploreBFS();

  if (!dir) {
    const phaseMsg = phase === ObjectivePhase.Clean
      ? "All areas explored. Keep cleaning — press [c] on dirty tiles."
      : "All accessible areas explored. Time to investigate — press [r] for Investigation Hub.";
    display.addLog(phaseMsg, "milestone");
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

  if (state.gameOver) {
    stopAutoExplore();
    return;
  }

  // Schedule next step
  autoExploreTimer = setTimeout(autoExploreStep, AUTO_EXPLORE_DELAY);
}

/** Find an adjacent evidence entity to auto-interact with during exploration. */
function getAutoExploreInteractTarget(): string | null {
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;
  const deltas = [
    { x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 },
    { x: -1, y: 0 }, { x: 1, y: 0 },
  ];
  for (const [id, ent] of state.entities) {
    if (id === "player") continue;
    for (const d of deltas) {
      if (ent.pos.x !== px + d.x || ent.pos.y !== py + d.y) continue;
      // Auto-interact with evidence sources
      if (ent.type === EntityType.LogTerminal && !isEntityExhausted(ent)) return id;
      if (ent.type === EntityType.EvidenceTrace && ent.props["discovered"] !== true && ent.props["scanHidden"] !== true) return id;
      if (ent.type === EntityType.CrewItem && ent.props["examined"] !== true && ent.props["hidden"] !== true) return id;
      if (ent.type === EntityType.Console && ent.props["read"] !== true) return id;
      // Auto-pick up sensors
      if (ent.type === EntityType.SensorPickup && ent.props["collected"] !== true) return id;
      // Auto-interact with relays
      if (ent.type === EntityType.Relay && ent.props["activated"] !== true && ent.props["locked"] !== true) return id;
      // Auto-heal
      if (ent.type === EntityType.MedKit && ent.props["used"] !== true && state.player.hp < state.player.maxHp) return id;
    }
  }
  return null;
}

// ── Autoplay mode (bot plays the game) ──────────────────────────
let autoplayActive = false;
let autoplayTimer: ReturnType<typeof setTimeout> | null = null;
let autoplayDriving = false; // true when the autoplay bot is driving an action
const AUTOPLAY_DELAY = 400; // ms between bot actions

/** Stop autoplay mode. */
function stopAutoplay(): void {
  autoplayActive = false;
  if (autoplayTimer) {
    clearTimeout(autoplayTimer);
    autoplayTimer = null;
  }
  const badge = document.getElementById("autoplay-badge");
  if (badge) badge.classList.remove("active");
  // Also stop auto-explore if running
  stopAutoExplore();
}

/** Get the best adjacent interactable entity (not exhausted). */
function getBestAdjacentEntity(): Entity | null {
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;
  const deltas = [
    { x: 0, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 },
    { x: -1, y: 0 }, { x: 1, y: 0 },
  ];
  let best: Entity | null = null;
  let bestScore = -1;
  for (const [id, ent] of state.entities) {
    if (id === "player") continue;
    let adjacent = false;
    for (const d of deltas) {
      if (ent.pos.x === px + d.x && ent.pos.y === py + d.y) { adjacent = true; break; }
    }
    if (!adjacent) continue;
    if (isEntityExhausted(ent)) continue;
    // Score entities by priority
    const PRIORITY: Partial<Record<EntityType, number>> = {
      [EntityType.SensorPickup]: 100,
      [EntityType.ToolPickup]: 95,
      [EntityType.UtilityPickup]: 90,
      [EntityType.MedKit]: 85,
      [EntityType.Relay]: 80,
      [EntityType.LogTerminal]: 70,
      [EntityType.EvidenceTrace]: 65,
      [EntityType.CrewItem]: 60,
      [EntityType.Console]: 55,
      [EntityType.SecurityTerminal]: 50,
      [EntityType.PowerCell]: 45,
      [EntityType.FuseBox]: 40,
      [EntityType.PressureValve]: 35,
      [EntityType.Breach]: 30,
      [EntityType.RepairCradle]: 25,
      [EntityType.ClosedDoor]: 10,
      [EntityType.CrewNPC]: 200,
      [EntityType.EscapePod]: 180,
      [EntityType.DataCore]: 1000,
    };
    const score = PRIORITY[ent.type] ?? 5;
    if (score > bestScore) { bestScore = score; best = ent; }
  }
  return best;
}

/** Execute one autoplay step — the bot picks and executes an action. */
function autoplayStep(): void {
  if (!autoplayActive || state.gameOver) {
    stopAutoplay();
    return;
  }

  autoplayDriving = true;

  // Priority 1: Interact with adjacent entity
  const target = getBestAdjacentEntity();
  if (target) {
    handleAction({ type: ActionType.Interact, targetId: target.id });
    autoplayDriving = false;
    if (!autoplayActive || state.gameOver) return;
    autoplayTimer = setTimeout(autoplayStep, AUTOPLAY_DELAY);
    return;
  }

  // Priority 1.5: Examine scene clues in current room
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;
  if (state.mystery?.roomScenes) {
    const currentRoom = state.rooms.find(r =>
      px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height
    );
    if (currentRoom) {
      const roomScene = state.mystery.roomScenes.find(s => s.roomId === currentRoom.id);
      if (roomScene && !roomScene.processed) {
        const unexamined = roomScene.physicalClues.filter(c => !c.examined && !c.sensorRequired);
        if (unexamined.length > 0) {
          handleAction({ type: ActionType.ExamineScene, sceneRoomId: roomScene.roomId });
          autoplayDriving = false;
          if (!autoplayActive || state.gameOver) return;
          autoplayTimer = setTimeout(autoplayStep, AUTOPLAY_DELAY);
          return;
        }
        // All non-sensor clues examined → process scene with ground truth
        const examined = roomScene.physicalClues.filter(c => c.examined);
        if (examined.length > 0) {
          const gt = roomScene.groundTruth;
          handleAction({
            type: ActionType.ProcessScene,
            sceneRoomId: roomScene.roomId,
            whoAnswer: gt.who,
            whatAnswer: gt.what as string,
            outcomeAnswer: gt.outcome as string,
          });
          autoplayDriving = false;
          if (!autoplayActive || state.gameOver) return;
          autoplayTimer = setTimeout(autoplayStep, AUTOPLAY_DELAY);
          return;
        }
      }
    }
  }

  // Priority 2: Scan if we have sensors and there might be hidden things
  if (state.player.sensors.length > 1 && state.turn % 8 === 0) {
    handleAction({ type: ActionType.Scan });
    autoplayDriving = false;
    if (!autoplayActive || state.gameOver) return;
    autoplayTimer = setTimeout(autoplayStep, AUTOPLAY_DELAY);
    return;
  }

  // Priority 3: Clean if tile is dirty
  if (py >= 0 && py < state.height && px >= 0 && px < state.width) {
    if (state.tiles[py][px].dirt > 30) {
      handleAction({ type: ActionType.Clean });
      autoplayDriving = false;
      if (!autoplayActive || state.gameOver) return;
      autoplayTimer = setTimeout(autoplayStep, AUTOPLAY_DELAY);
      return;
    }
  }

  // Priority 3.5: Answer a deduction if available (pick best keyword-overlap answer)
  if (state.mystery) {
    const unlocked = getUnlockedDeductions(state.mystery.deductions, state.mystery.journal);
    if (unlocked.length > 0) {
      const deduction = unlocked[0];
      // Score options by keyword overlap with journal text
      const journalText = state.mystery.journal.map(j => j.detail.toLowerCase()).join(" ");
      let bestIdx = 0;
      let bestScore = -1;
      for (let i = 0; i < deduction.options.length; i++) {
        const words = deduction.options[i].label.toLowerCase().split(/\s+/);
        const score = words.filter(w => w.length > 3 && journalText.includes(w)).length;
        if (score > bestScore) { bestScore = score; bestIdx = i; }
      }
      // Use the correct answer if it's the first deduction (give bot a fighting chance)
      const correctIdx = deduction.options.findIndex(o => o.correct);
      if (correctIdx >= 0) bestIdx = correctIdx;

      // Set up deduction answering state and dispatch
      activeDeduction = deduction;
      deductionSelectedIdx = bestIdx;
      commitDeductionAnswer();
      activeDeduction = null;
      autoplayDriving = false;
      if (!autoplayActive || state.gameOver) return;
      autoplayTimer = setTimeout(autoplayStep, AUTOPLAY_DELAY);
      return;
    }
  }

  // Priority 4: Move toward nearest entity we haven't interacted with
  const entityDir = autoplayBFSToEntity();
  if (entityDir) {
    handleAction({ type: ActionType.Move, direction: entityDir });
    autoplayDriving = false;
    if (!autoplayActive || state.gameOver) return;
    autoplayTimer = setTimeout(autoplayStep, AUTOPLAY_DELAY);
    return;
  }

  // Priority 5: Explore unexplored tiles
  const dir = autoExploreBFS();
  if (dir) {
    handleAction({ type: ActionType.Move, direction: dir });
    autoplayDriving = false;
    if (!autoplayActive || state.gameOver) return;
    autoplayTimer = setTimeout(autoplayStep, AUTOPLAY_DELAY);
    return;
  }

  // Priority 6: Wait
  handleAction({ type: ActionType.Wait });
  autoplayDriving = false;
  autoplayTimer = setTimeout(autoplayStep, AUTOPLAY_DELAY * 2);
}

/** BFS to find direction toward the nearest non-exhausted entity. */
function autoplayBFSToEntity(): Direction | null {
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;
  const key = (x: number, y: number) => `${x},${y}`;

  // Build set of entity positions that are not exhausted
  const targets = new Set<string>();
  for (const [id, ent] of state.entities) {
    if (id === "player") continue;
    if (isEntityExhausted(ent)) continue;
    targets.add(key(ent.pos.x, ent.pos.y));
    // Also target tiles adjacent to entity
    for (const d of [{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}]) {
      targets.add(key(ent.pos.x + d.x, ent.pos.y + d.y));
    }
  }
  if (targets.size === 0) return null;

  const visited = new Set<string>();
  const queue: { x: number; y: number; firstDir: Direction }[] = [];
  const dirs: { dx: number; dy: number; dir: Direction }[] = [
    { dx: 0, dy: -1, dir: Direction.North },
    { dx: 0, dy: 1, dir: Direction.South },
    { dx: -1, dy: 0, dir: Direction.West },
    { dx: 1, dy: 0, dir: Direction.East },
  ];

  visited.add(key(px, py));
  for (const { dx, dy, dir } of dirs) {
    const nx = px + dx;
    const ny = py + dy;
    if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
    if (!state.tiles[ny][nx].walkable) continue;
    if (targets.has(key(nx, ny))) return dir;
    visited.add(key(nx, ny));
    queue.push({ x: nx, y: ny, firstDir: dir });
  }

  while (queue.length > 0) {
    const node = queue.shift()!;
    if (targets.has(key(node.x, node.y))) return node.firstDir;
    for (const { dx, dy } of dirs) {
      const nx = node.x + dx;
      const ny = node.y + dy;
      const k = key(nx, ny);
      if (nx < 0 || nx >= state.width || ny < 0 || ny >= state.height) continue;
      if (visited.has(k)) continue;
      if (!state.tiles[ny][nx].walkable) continue;
      visited.add(k);
      queue.push({ x: nx, y: ny, firstDir: node.firstDir });
    }
  }
  return null;
}

// ── Minimap fullscreen toggle ───────────────────────────────────
let minimapFullscreen = false;

function toggleMinimapFullscreen(): void {
  minimapFullscreen = !minimapFullscreen;
  const overlay = document.getElementById("minimap-fullscreen");
  if (!overlay) return;
  if (minimapFullscreen) {
    // Create a large canvas copy
    overlay.innerHTML = "";
    const bigCanvas = document.createElement("canvas");
    bigCanvas.width = 500;
    bigCanvas.height = 500;
    bigCanvas.id = "minimap-fs-canvas";
    overlay.appendChild(bigCanvas);
    overlay.classList.add("active");
    // Render the minimap at large size
    if (display && "renderMinimapToCanvas" in display) {
      (display as any).renderMinimapToCanvas(bigCanvas);
    }
  } else {
    overlay.classList.remove("active");
    overlay.innerHTML = "";
  }
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

/** Generate an atmospheric fragment for a crew member's last known room. */
function getCrewMemoryFragment(c: CrewMember, roomName: string): string | null {
  const name = `${c.firstName} ${c.lastName}`;
  const role = c.role.charAt(0).toUpperCase() + c.role.slice(1).replace("_", " ");
  // Use richer fate-specific templates from narrative.ts
  const fatePool = CREW_FATE_REVEALS[c.fate];
  if (fatePool && fatePool.length > 0) {
    // Deterministic pick based on crew id hash
    let hash = 0;
    for (let i = 0; i < c.id.length; i++) hash = ((hash << 5) - hash + c.id.charCodeAt(i)) | 0;
    return fatePool[Math.abs(hash) % fatePool.length](name, role, roomName);
  }
  return null;
}

// ── Delayed Scene Feedback ─────────────────────────────────────
// Design doc: "Feedback is delayed until room exit — no instant green/amber."
let pendingSceneResult: string | null = null;
let pendingSceneRoom: string | null = null;

// ── Discovery Moment Overlays ─────────────────────────────────────
// Full-screen cinematic overlays for the Station Autopsy mystery system's key dramatic beats.

let discoveryOverlayActive = false;
let discoveryOverlayTimeout: ReturnType<typeof setTimeout> | null = null;

/** Show a full-screen discovery moment overlay with VFX and text. */
function showDiscoveryOverlay(opts: {
  title: string;
  subtitle?: string;
  body?: string;
  bodyB?: string;
  color: string;       // primary accent color
  bgColor: string;     // background tint
  duration: number;     // ms before auto-dismiss
  glitch?: boolean;     // VHS glitch effect
}): void {
  if (discoveryOverlayActive) return;
  discoveryOverlayActive = true;

  let el = document.getElementById("discovery-overlay");
  if (!el) {
    el = document.createElement("div");
    el.id = "discovery-overlay";
    el.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      z-index: 9999; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      font-family: 'Courier New', monospace; text-align: center;
      pointer-events: auto; cursor: pointer;
      transition: opacity 0.4s ease;
    `;
    document.body.appendChild(el);
  }

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  let html = `
    <div style="background: ${opts.bgColor}; width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      ${opts.glitch ? `animation: discoveryGlitch 0.15s ease-in-out 3;` : ""}
    ">
      <div style="font-size: 28px; font-weight: bold; color: ${opts.color};
        letter-spacing: 6px; text-shadow: 0 0 20px ${opts.color}, 0 0 40px ${opts.color};
        margin-bottom: 16px;
        ${opts.glitch ? `animation: discoveryFlicker 0.08s ease-in-out 6 alternate;` : ""}
      ">${esc(opts.title)}</div>
  `;

  if (opts.subtitle) {
    html += `<div style="font-size: 16px; color: ${opts.color}aa; letter-spacing: 3px;
      margin-bottom: 24px;">${esc(opts.subtitle)}</div>`;
  }

  if (opts.body) {
    html += `<div style="font-size: 14px; color: #ccc; max-width: 600px; line-height: 1.6;
      margin-bottom: 12px; padding: 12px 20px; border-left: 2px solid ${opts.color}44;
      text-align: left;">${esc(opts.body)}</div>`;
  }

  if (opts.bodyB) {
    html += `<div style="font-size: 14px; color: #ccc; max-width: 600px; line-height: 1.6;
      margin-bottom: 12px; padding: 12px 20px; border-left: 2px solid #ff4444aa;
      text-align: left;">${esc(opts.bodyB)}</div>`;
  }

  html += `<div style="font-size: 11px; color: #666; margin-top: 20px;
    letter-spacing: 2px;">PRESS ANY KEY TO CONTINUE</div>`;
  html += `</div>`;

  // Inject animation keyframes if not already present
  if (!document.getElementById("discovery-keyframes")) {
    const style = document.createElement("style");
    style.id = "discovery-keyframes";
    style.textContent = `
      @keyframes discoveryGlitch {
        0% { transform: translate(0,0) skew(0deg); }
        25% { transform: translate(-3px, 1px) skew(-0.5deg); }
        50% { transform: translate(2px, -1px) skew(0.3deg); }
        75% { transform: translate(-1px, 2px) skew(-0.2deg); }
        100% { transform: translate(0,0) skew(0deg); }
      }
      @keyframes discoveryFlicker {
        0% { opacity: 1; }
        100% { opacity: 0.7; }
      }
      @keyframes discoveryScanline {
        0% { background-position-y: 0; }
        100% { background-position-y: 4px; }
      }
    `;
    document.head.appendChild(style);
  }

  el.innerHTML = html;
  el.style.opacity = "0";
  el.style.display = "flex";
  requestAnimationFrame(() => { el!.style.opacity = "1"; });

  const dismiss = () => {
    if (!discoveryOverlayActive) return;
    discoveryOverlayActive = false;
    if (discoveryOverlayTimeout) { clearTimeout(discoveryOverlayTimeout); discoveryOverlayTimeout = null; }
    el!.style.opacity = "0";
    setTimeout(() => { el!.style.display = "none"; }, 400);
    el!.removeEventListener("click", dismiss);
    document.removeEventListener("keydown", dismissKey);
  };

  const dismissKey = (e: KeyboardEvent) => {
    e.preventDefault();
    dismiss();
  };

  el.addEventListener("click", dismiss);
  document.addEventListener("keydown", dismissKey, { once: true });

  discoveryOverlayTimeout = setTimeout(dismiss, opts.duration);
}

/** Trigger Crack Moment visual event — the Official Story fractures. */
function triggerCrackMoment(): void {
  display.triggerScreenFlash("damage");
  showDiscoveryOverlay({
    title: "NARRATIVE BREACH",
    subtitle: "Official account is inconsistent. Reconstruct true sequence.",
    body: "Something doesn't add up. The official story — you've been building it in your head, piece by piece. But this... this doesn't fit. Not wrong, exactly. Just the first crack in a picture you thought was complete.",
    color: "#ffaa00",
    bgColor: "rgba(20, 12, 0, 0.92)",
    duration: 12000,
    glitch: true,
  });
}

/** Trigger Contradiction Found visual event — two pieces of evidence clash. */
function triggerContradictionFound(officialText: string, realText: string): void {
  display.triggerScreenFlash("damage");
  showDiscoveryOverlay({
    title: "CONTRADICTION DETECTED",
    subtitle: "Two pieces of evidence tell different stories.",
    body: officialText,
    bodyB: realText,
    color: "#ff4444",
    bgColor: "rgba(20, 0, 0, 0.92)",
    duration: 15000,
    glitch: true,
  });
}

/** Trigger Timeline Slot Confirmed visual event. */
function triggerTimelineConfirmed(phase: string, slotsFilled: number, totalSlots: number): void {
  if (slotsFilled >= totalSlots) {
    // All 5 filled — circuit completion sweep
    display.triggerScreenFlash("milestone");
    showDiscoveryOverlay({
      title: "TIMELINE COMPLETE",
      subtitle: "The full sequence of events has been reconstructed.",
      body: `All ${totalSlots} phases of the incident have been confirmed. The station's story — from normal operations through the final aftermath — is now a complete record.`,
      color: "#44ffaa",
      bgColor: "rgba(0, 20, 12, 0.92)",
      duration: 10000,
    });
  } else {
    display.triggerScreenFlash("milestone");
    display.addLog(`Timeline confirmed: ${phase} (${slotsFilled}/${totalSlots} phases reconstructed)`, "milestone");
  }
}

/** Trigger Crew Fate Confirmed visual event. */
function triggerCrewFateConfirmed(crewName: string, identified: number, total: number): void {
  display.triggerScreenFlash("milestone");
  display.addLog(`Crew identified: ${crewName} (${identified}/${total} crew confirmed)`, "milestone");
}

/** Check for discovery moment transitions after step() and trigger overlays. */
function checkDiscoveryMoments(): void {
  const mystery = state.mystery;
  if (!mystery) return;

  // Crack Moment: fires once when evidence_accumulation.crack_moment_fired transitions true
  const currentCrack = mystery.evidenceAccumulation?.crack_moment_fired ?? false;
  if (currentCrack && !prevCrackMomentFired) {
    triggerCrackMoment();
  }
  prevCrackMomentFired = currentCrack;

  // Contradiction Found: fires when revealed count increases
  const currentContradictions = mystery.contradictionPairs?.filter(cp => cp.revealed).length ?? 0;
  if (currentContradictions > prevRevealedContradictions) {
    // Find the newly revealed contradiction
    const newlyRevealed = mystery.contradictionPairs?.find(cp =>
      cp.revealed && cp.official && cp.contradicting);
    if (newlyRevealed) {
      triggerContradictionFound(
        newlyRevealed.official.text,
        newlyRevealed.contradicting.text,
      );
    }
  }
  prevRevealedContradictions = currentContradictions;

  // Timeline Confirmed: fires when confirmed slot count increases
  const currentSlots = mystery.incidentBoard?.slots.filter(s => s.status === "confirmed").length ?? 0;
  const totalSlots = mystery.incidentBoard?.slots.length ?? 5;
  if (currentSlots > prevConfirmedSlots) {
    const newSlot = mystery.incidentBoard?.slots.find(s => s.status === "confirmed");
    triggerTimelineConfirmed(newSlot?.phase ?? "Unknown", currentSlots, totalSlots);
  }
  prevConfirmedSlots = currentSlots;

  // Crew Fate Confirmed: fires when identified crew count increases
  const currentCrew = mystery.dossiers?.filter(d => d.confirmed.name).length ?? 0;
  const totalCrew = mystery.dossiers?.length ?? 0;
  if (currentCrew > prevIdentifiedCrew) {
    const newlyId = mystery.dossiers?.find(d =>
      d.confirmed.name && d.roomsSeen.length > 0);
    triggerCrewFateConfirmed(
      newlyId?.confirmed.name ?? "Unknown crew member",
      currentCrew,
      totalCrew,
    );
  }
  prevIdentifiedCrew = currentCrew;
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
  // Show deferred scene processing result when leaving the room where processing happened
  if (currentRoom && pendingSceneResult && pendingSceneRoom && currentRoom.name !== pendingSceneRoom) {
    display.addLog(`Scene processed: ${pendingSceneResult}`, "milestone");
    pendingSceneResult = null;
    pendingSceneRoom = null;
  }
  // Also show if player moves to a corridor (no room)
  if (!currentRoom && pendingSceneResult) {
    display.addLog(`Scene processed: ${pendingSceneResult}`, "milestone");
    pendingSceneResult = null;
    pendingSceneRoom = null;
  }

  if (currentRoom && currentRoom.id !== lastPlayerRoomId) {
    lastPlayerRoomId = currentRoom.id;
    if (!visitedRoomIds.has(currentRoom.id)) {
      visitedRoomIds.add(currentRoom.id);

      // Exploration reward: small HP recovery on first room visit
      const EXPLORE_HEAL = 5;
      if (state.player.hp < state.player.maxHp && !state.gameOver) {
        const healAmt = Math.min(EXPLORE_HEAL, state.player.maxHp - state.player.hp);
        state.player = { ...state.player, hp: state.player.hp + healAmt };
        if (healAmt > 0) {
          display.addLog(`Systems recalibrated in new sector. (+${healAmt} HP)`, "system");
        }
      }

      // Exploration milestones: fire CORVUS-7 commentary at 25/50/75/100% room coverage
      if (state.rooms.length > 0) {
        const pct = Math.round((visitedRoomIds.size / state.rooms.length) * 100);
        const thresholds = [
          { pct: 25, key: "explore_25" },
          { pct: 50, key: "explore_50" },
          { pct: 75, key: "explore_75" },
          { pct: 100, key: "explore_100" },
        ];
        for (const t of thresholds) {
          if (pct >= t.pct && !state.milestones.has(t.key)) {
            const text = CORVUS_PERSONALITY_REACTIONS[corvusPersonality]?.[t.key] ?? CORVUS_REACTIONS[t.key];
            if (text) {
              const newMilestones = new Set(state.milestones);
              newMilestones.add(t.key);
              state = {
                ...state,
                milestones: newMilestones,
                logs: [
                  ...state.logs,
                  { id: `log_corvus_${t.key}`, timestamp: state.turn, source: "system", text, read: false },
                ],
              };
            }
          }
        }
      }

      // Item 11: Environmental sound cues BEFORE room description
      emitRoomEntryCues(currentRoom);

      const desc = getRoomDescription(currentRoom.name, state.seed);
      if (desc) {
        display.addLog(desc, "narrative");
      }

      // Manuscript echo: if this room was foreshadowed in a log the player already read
      if (foreshadowedRooms.has(currentRoom.name) && !echoedRooms.has(currentRoom.name)) {
        echoedRooms.add(currentRoom.name);
        const excerpt = foreshadowedRooms.get(currentRoom.name)!;
        display.addLog(`ECHO — You remember reading about this place: "${excerpt.slice(0, 80)}..."`, "milestone");
        // CORVUS-7 foreshadowing acknowledgment (first time only)
        if (!state.milestones.has("foreshadow_confirm")) {
          const text = CORVUS_PERSONALITY_REACTIONS[corvusPersonality]?.["foreshadow_confirm"] ?? CORVUS_REACTIONS["foreshadow_confirm"];
          if (text) {
            const newMilestones = new Set(state.milestones);
            newMilestones.add("foreshadow_confirm");
            state = { ...state, milestones: newMilestones, logs: [...state.logs, { id: "log_corvus_foreshadow", timestamp: state.turn, source: "system", text, read: false }] };
          }
        }
      }

      // Archetype-specific environmental incident trace
      const incidentTrace = getIncidentTrace(
        currentRoom.name,
        state.mystery?.timeline.archetype,
      );
      if (incidentTrace) {
        display.addLog(incidentTrace, "narrative");
      }

      // First discovery cascade: 3-beat early-game atmosphere (rooms 2-4)
      if (firstDiscoveryBeat < 3 && state.mystery?.timeline?.archetype) {
        const arch = state.mystery.timeline.archetype as IncidentArchetype;
        const beats = FIRST_DISCOVERY_BEATS[arch];
        if (beats && visitedRoomIds.size >= 2) { // skip room 1 (Arrival Bay)
          const beatIdx = firstDiscoveryBeat;
          if (beatIdx === 0) {
            display.addLog(beats[0], "narrative");
          } else if (beatIdx === 1) {
            display.addLog(beats[1], "narrative");
          } else {
            // Beat 3 uses crew data — find the hero crew member for this archetype
            const crewAll = state.mystery.crew;
            const heroRole = STORY_ROLES[arch]?.hero;
            const central = (heroRole ? crewAll.find(c => c.role === heroRole) : null)
              ?? crewAll.find(c => c.role === CrewRole.Engineer)
              ?? crewAll.find(c => c.role === CrewRole.Scientist)
              ?? crewAll[0];
            if (central) {
              display.addLog(beats[2](central.lastName), "narrative");
            }
          }
          firstDiscoveryBeat++;
        }
      }

      // Crew memory fragment: atmospheric text for rooms where crew were last known
      const crew = state.mystery?.crew ?? [];
      const crewInRoom = crew.filter(c => c.lastKnownRoom === currentRoom.name);
      if (crewInRoom.length > 0) {
        const c = crewInRoom[0]; // Show one fragment per room
        const fragment = getCrewMemoryFragment(c, currentRoom.name);
        if (fragment) display.addLog(fragment, "narrative");
      }

      // Scene atmosphere hint — first impression of what happened in this room
      if (state.mystery?.roomScenes) {
        const scene = state.mystery.roomScenes.find(s => s.roomId === currentRoom.id);
        if (scene && !scene.processed) {
          const outcomeHints: Record<string, string> = {
            left_normally: "Everything seems orderly, but something doesn't add up.",
            left_in_hurry: "Signs of a hasty departure. Personal items scattered, drawers left open.",
            injured: "Traces of a struggle. Someone was hurt here.",
            died_here: "A heavy silence hangs in the air. Something terrible happened here.",
            still_here: "The room feels occupied. Someone might still be nearby.",
            sealed_inside: "The room has been sealed from the inside. Barricade marks on the door frame.",
            unknown: "The room tells a story, but the details are unclear.",
          };
          const hint = outcomeHints[scene.groundTruth.outcome] ?? outcomeHints.unknown;
          display.addLog(hint, "narrative");
          const clueCount = scene.physicalClues.length;
          display.addLog(`[X] Examine scene (${clueCount} clue${clueCount !== 1 ? "s" : ""} to find)`, "system");
        }
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

    // Room investigation progress — fires on every room change
    {
      let totalInteractable = 0;
      let freshCount = 0;
      for (const [id, ent] of state.entities) {
        if (id === "player") continue;
        if (ent.pos.x < currentRoom.x || ent.pos.x >= currentRoom.x + currentRoom.width) continue;
        if (ent.pos.y < currentRoom.y || ent.pos.y >= currentRoom.y + currentRoom.height) continue;
        // Skip non-interactable types (drones, repair bots, etc.)
        if (ent.type === EntityType.PatrolDrone || ent.type === EntityType.Drone ||
            ent.type === EntityType.RepairBot) continue;
        // Skip hidden/evacuated/dead entities
        if (ent.props["hidden"] === true || ent.props["evacuated"] === true ||
            ent.props["dead"] === true) continue;
        totalInteractable++;
        if (!isEntityExhausted(ent)) freshCount++;
      }
      if (totalInteractable > 0 && freshCount === 0) {
        display.addLog("Room fully investigated.", "system");
      } else if (freshCount > 0 && visitedRoomIds.has(currentRoom.id)) {
        // Only show count on revisits (first visit already shows entity list)
        display.addLog(`${freshCount} object${freshCount === 1 ? "" : "s"} to investigate.`, "sensor");
      }
    }

    // Scene notification — tell the player about physical clues in the room
    if (state.mystery?.roomScenes) {
      const roomScene = state.mystery.roomScenes.find(s => s.roomName === currentRoom.name);
      if (roomScene && !roomScene.processed) {
        const unexamined = roomScene.physicalClues.filter(c => !c.examined && !c.sensorRequired).length;
        const sensorGated = roomScene.physicalClues.filter(c => !c.examined && c.sensorRequired).length;
        const examined = roomScene.physicalClues.filter(c => c.examined).length;
        if (unexamined > 0) {
          display.addLog(`SCENE: ${unexamined} physical clue${unexamined > 1 ? "s" : ""} detected. Press [x] to examine.${sensorGated > 0 ? ` (${sensorGated} more require sensor upgrades)` : ""}`, "milestone");
        } else if (sensorGated > 0) {
          display.addLog(`SCENE: ${sensorGated} clue${sensorGated > 1 ? "s" : ""} require sensor upgrades to examine.`, "sensor");
        } else if (examined > 0) {
          display.addLog(`SCENE: All clues examined in ${currentRoom.name}. Ready for scene processing [R \u2192 SCENES].`, "milestone");
        }
      }
    }

    // Tension-based room entry flavor — fires on every room change (not just first visit)
    // Only after turn 100, escalating frequency with turn count
    if (state.turn >= 100) {
      const tensionMsg = getTensionFlavor(state.turn, currentRoom.name);
      if (tensionMsg) display.addLog(tensionMsg, "narrative");
    }

    // Auto-save on room transition (every room change, not just first visit)
    if (!state.gameOver) {
      saveGame(state);
      autoSaveFlashTimer = performance.now();
    }
  }
}

/** Tension-based atmospheric flavor on room transitions. */
const TENSION_EARLY: string[] = [
  "The lights flicker briefly as you enter. Power fluctuations are becoming routine.",
  "A distant hum resonates through the walls. The station's heartbeat is uneven.",
  "Dust motes drift in the recycled air. Nobody has cleaned here in a long time.",
  "The ventilation rattles overhead — a loose panel somewhere in the ductwork.",
];
const TENSION_MID: string[] = [
  "The floor plates groan under your treads. Metal fatigue is setting in.",
  "Warning lights pulse amber in the corridor behind you. More systems failing.",
  "A pipe bursts somewhere far away — the dull crack echoes through empty halls.",
  "The air tastes metallic. Filtration is losing ground against the degradation.",
  "Shadows dance as overhead lighting strobes. The power grid is struggling.",
];
const TENSION_LATE: string[] = [
  "The walls creak with deep structural stress. The station is dying around you.",
  "Emergency strips are the only light now. Main power is almost gone.",
  "Something shudders deep in the station's frame — a sound that shouldn't happen.",
  "The air is thin and acrid. Every breath costs the station a little more.",
  "Sparks cascade from a junction box as you pass. The station won't hold much longer.",
];

function getTensionFlavor(turn: number, roomName: string): string | null {
  // Escalating frequency: ~25% at T100-200, ~40% at T200-300, ~55% at T300+
  const freq = turn < 200 ? 25 : turn < 300 ? 40 : 55;
  const roll = ((turn * 53 + roomName.length * 17) % 100);
  if (roll >= freq) return null;

  const pool = turn < 200 ? TENSION_EARLY : turn < 300 ? TENSION_MID : TENSION_LATE;
  const idx = ((turn * 31 + roomName.charCodeAt(0)) % pool.length);
  return pool[idx];
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
  display = new BrowserDisplay3D(containerEl, state.width, state.height);

  // ── Dramatic link establishment sequence (compact) ──────────────
  display.addLog("LINK ACTIVE — Low-bandwidth terminal feed. Sweepo online.", "milestone");
  display.addLog(MOOD_FLAVOR[stationMood], "narrative");
  display.addLog(CORVUS_GREETING[corvusPersonality], "narrative");

  // Station context briefing — crew count, station status, mission objective
  if (state.mystery) {
    const crewCount = state.mystery.crew.length;
    const roomCount = state.rooms.length;
    const stationId = `PROVIDENCE-${seed % 1000}`;
    display.addLog(`CORVUS-7: Station ${stationId} — ${crewCount} crew on manifest, ${roomCount} sections mapped. Last contact: 72 hours ago.`, "narrative");
    // Archetype-specific alert status
    const archAlerts: Record<string, string> = {
      coolant_cascade: "Alert status: COOLANT FAILURE. Temperature readings critical in multiple sections.",
      hull_breach: "Alert status: HULL INTEGRITY COMPROMISED. Pressure differentials detected across the station.",
      reactor_scram: "Alert status: REACTOR SHUTDOWN. Emergency power only. Core containment uncertain.",
      sabotage: "Alert status: SECURITY BREACH. Unauthorized modifications to station systems detected.",
      signal_anomaly: "Alert status: UNKNOWN SIGNAL. External transmission source overriding station comms.",
      mutiny: "Alert status: INTERNAL CONFLICT. Command structure compromised. Multiple faction signals.",
    };
    const alertText = archAlerts[state.mystery.timeline.archetype] ?? "Alert status: UNKNOWN. Investigating.";
    display.addLog(`CORVUS-7: ${alertText}`, "warning");
  }

  // Archetype-specific mission briefing (3 lines setting stakes)
  const briefingArchetype = state.mystery?.timeline?.archetype;
  if (briefingArchetype && CORVUS_MISSION_BRIEFING[briefingArchetype]) {
    for (const line of CORVUS_MISSION_BRIEFING[briefingArchetype]) {
      display.addLog(line, "narrative");
    }
  }

  // Signal interference static burst (SignalAnomaly opening)
  if (state.milestones.has("signal_interference_active")) {
    display.addLog("▓▓▓ ELECTROMAGNETIC INTERFERENCE DETECTED ▓▓▓", "critical");
    display.addLog("Station communications array is broadcasting at high power. Sensor systems degraded. Expect instrument disruption.", "system");
  }

  display.addLog("Use arrow keys or h/j/k/l to move. Approach objects and press [i] to interact.", "system");
  lastObjectivePhase = ObjectivePhase.Clean;

  // Start archetype-specific ambient soundscape
  if (state.mystery?.timeline?.archetype) {
    audio.startAmbient(state.mystery.timeline.archetype);
  }

  checkRoomEntry();
  renderAll();

  inputHandler = new InputHandler(handleAction, handleScan);

  // Create auto-explore badge (floating indicator on map)
  if (!document.getElementById("auto-explore-badge")) {
    const badge = document.createElement("div");
    badge.id = "auto-explore-badge";
    badge.textContent = "AUTO";
    badge.style.display = "none";
    containerEl.appendChild(badge);
  }

  // Listen for restart key when game is over
  window.addEventListener("keydown", handleRestartKey);
  // Listen for choice/deduction/crew-door input
  window.addEventListener("keydown", (e) => {
    // Any non-Tab key stops auto-explore
    if (autoExploring && e.key !== "Tab") {
      stopAutoExplore();
      display.addLog("Auto-explore stopped.", "system");
      renderAll();
    }
    if (incidentCardOpen) {
      if (e.key === "Escape" || e.key === "g") {
        e.preventDefault();
        incidentCardOpen = false;
        const overlay = document.getElementById("journal-overlay");
        if (overlay) { overlay.classList.remove("active"); overlay.innerHTML = ""; }
      }
      return; // swallow all input while incident card is open
    }
    // ── Goal panel keyboard handling ──────────────────────────
    if (goalPanelOpen) {
      e.preventDefault();
      if (e.key === "Escape" || e.key === "g") {
        goalPanelOpen = false;
        const overlay = document.getElementById("goal-panel-overlay");
        if (overlay) { overlay.classList.remove("active"); overlay.innerHTML = ""; }
        return;
      }
      const goals = computeGoals(state, discoveredGoalIds, { visitedRoomIds });
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "k") {
        goalPanelIdx = Math.max(0, goalPanelIdx - 1);
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "j") {
        goalPanelIdx = Math.min(goals.length - 1, goalPanelIdx + 1);
      } else if (e.key === "Enter" || e.key === " ") {
        // Focus/unfocus the selected goal
        const selected = goals[goalPanelIdx];
        if (selected) {
          if (focusedGoalId === selected.id) {
            focusedGoalId = null; // unfocus
            display.addLog(`Goal tracking cleared.`, "system");
          } else {
            focusedGoalId = selected.id;
            display.addLog(`Now tracking: ${selected.title}`, "system");
          }
        }
      }
      showGoalPanel();
      return;
    }
    if (logReviewOpen) {
      if (e.key === "Escape" || e.key === "`") {
        e.preventDefault();
        logReviewOpen = false;
        const overlay = document.getElementById("journal-overlay");
        if (overlay) { overlay.classList.remove("active"); overlay.innerHTML = ""; }
      }
      return; // swallow all input while log review is open
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
    // Pause menu takes priority over other overlays
    if (pauseMenuOpen) {
      handlePauseInput(e);
      return;
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
    // Escape: open pause menu during gameplay
    if (e.key === "Escape" && !state.gameOver) {
      e.preventDefault();
      pauseMenuOpen = true;
      pauseMenuIdx = 0;
      stopAutoExplore();
      if (autoplayActive) {
        stopAutoplay();
        display.addLog("[AUTOPLAY OFF] Paused.", "system");
      }
      renderPauseMenu();
      return;
    }
    // F5 toggles dev mode
    if (e.key === "F5") {
      e.preventDefault();
      devModeEnabled = !devModeEnabled;
      display.addLog(devModeEnabled ? "[DEV MODE ON]" : "[DEV MODE OFF]", "system");
      renderAll();
      return;
    }
    // F6 toggles text-to-speech
    if (e.key === "F6") {
      e.preventDefault();
      audio.setTTS(!audio.isTTSEnabled());
      display.addLog(audio.isTTSEnabled() ? "[TTS ON] Game text will be read aloud." : "[TTS OFF]", "system");
      renderAll();
      return;
    }
    // F7 toggles autoplay mode (bot plays the game)
    if (e.key === "F7") {
      e.preventDefault();
      if (autoplayActive) {
        stopAutoplay();
        display.addLog("[AUTOPLAY OFF] Manual control restored.", "system");
      } else {
        autoplayActive = true;
        stopAutoExplore(); // stop auto-explore if running
        const badge = document.getElementById("autoplay-badge");
        if (badge) badge.classList.add("active");
        display.addLog("[AUTOPLAY ON] Bot is playing. Press F7 to stop.", "milestone");
        autoplayTimer = setTimeout(autoplayStep, AUTOPLAY_DELAY);
      }
      renderAll();
      return;
    }
    // F8 toggles audio mute
    if (e.key === "F8") {
      e.preventDefault();
      const muted = audio.toggleMute();
      display.addLog(muted ? "[AUDIO MUTED] Press F8 to unmute." : `[AUDIO ON] Volume: ${Math.round(audio.getVolume() * 100)}%`, "system");
      renderAll();
      return;
    }
    // F9/F10 volume down/up (5 steps: 0%, 25%, 50%, 75%, 100%)
    if (e.key === "F9" || e.key === "F10") {
      e.preventDefault();
      const step = 0.25;
      const current = audio.getVolume();
      const newVol = e.key === "F9"
        ? Math.max(0, Math.round((current - step) * 100) / 100)
        : Math.min(1, Math.round((current + step) * 100) / 100);
      audio.setVolume(newVol);
      const pct = Math.round(newVol * 100);
      const bar = "=".repeat(Math.round(pct / 10)) + "-".repeat(10 - Math.round(pct / 10));
      display.addLog(`[VOLUME ${pct}%] [${bar}]`, "system");
      // Persist volume preference
      try { localStorage.setItem("ssr_volume", String(newVol)); } catch { /* ignore */ }
      renderAll();
      return;
    }
    // M toggles fullscreen minimap overlay
    if ((e.key === "m" || e.key === "M") && !journalOpen && !state.gameOver) {
      e.preventDefault();
      toggleMinimapFullscreen();
      return;
    }
    // Cancel any pending restart prompt on non-Escape key
    if (restartPending) {
      restartPending = false;
    }
    // Mystery choices are handled via the Investigation Hub now
    // V key opens Investigation Hub directly to EVIDENCE section
    if (e.key === "v" && !journalOpen && !state.gameOver) {
      e.preventDefault();
      investigationHubOpen = true;
      hubSection = "evidence";
      hubIdx = 0;
      display.setHubMode?.(true);
      document.getElementById("game-container")?.classList.add("hub-open");
      renderInvestigationHub();
      return;
    }
    // X key examines scene clues in current room
    if (e.key === "x" && !journalOpen && !state.gameOver) {
      e.preventDefault();
      // Find scene for player's current room
      const playerRoom = state.rooms.find(r =>
        state.player.entity.pos.x >= r.x && state.player.entity.pos.x < r.x + r.width &&
        state.player.entity.pos.y >= r.y && state.player.entity.pos.y < r.y + r.height
      );
      if (playerRoom && state.mystery?.roomScenes) {
        const roomScene = state.mystery.roomScenes.find(s => s.roomName === playerRoom.name);
        if (roomScene) {
          // Track clue state before examining
          const preExamined = roomScene.physicalClues.filter(c => c.examined).length;
          handleAction({ type: ActionType.ExamineScene, sceneRoomId: roomScene.roomId });
          // Show individual clue feedback for newly examined clues
          const updatedScene = state.mystery?.roomScenes?.find(s => s.roomId === roomScene.roomId);
          if (updatedScene) {
            const newlyExamined = updatedScene.physicalClues.filter((c, i) => c.examined && !roomScene.physicalClues[i]?.examined);
            for (const clue of newlyExamined) {
              const typeLabel = clue.type.replace(/_/g, " ").toUpperCase();
              const crewMember = clue.crewLinked
                ? state.mystery?.crew.find(c => c.id === clue.crewLinked)
                : null;
              const crewTag = crewMember ? ` [${crewMember.lastName}]` : "";
              display.addLog(`CLUE: ${typeLabel}${crewTag} — ${clue.text.slice(0, 60)}${clue.text.length > 60 ? "..." : ""}`, "narrative");
            }
            const remaining = updatedScene.physicalClues.filter(c => !c.examined).length;
            if (remaining > 0) {
              const sensorGated = updatedScene.physicalClues.filter(c => !c.examined && c.sensorRequired).length;
              if (sensorGated === remaining) {
                display.addLog(`${remaining} clue${remaining !== 1 ? "s" : ""} require${remaining === 1 ? "s" : ""} sensor upgrade to examine.`, "system");
              }
            }
          }
          return;
        }
      }
      display.addLog("No scene to examine here.", "system");
      renderAll();
      return;
    }
    // ? key toggles help
    if (e.key === "?" && !journalOpen) {
      e.preventDefault();
      helpOpen = true;
      showHelp();
      return;
    }
    // ` key toggles message log review
    if (e.key === "`" && !journalOpen && !investigationHubOpen) {
      e.preventDefault();
      logReviewOpen = true;
      showLogReview();
      return;
    }
    // R opens Investigation Hub (last-visited section)
    if (e.key === "r" && !journalOpen && !state.gameOver) {
      e.preventDefault();
      investigationHubOpen = true;
      hubIdx = 0;
      display.setHubMode?.(true);
      document.getElementById("game-container")?.classList.add("hub-open");
      renderInvestigationHub();
      return;
    }
    // G key toggles goal panel
    if (e.key === "g" && !journalOpen && !investigationHubOpen && !state.gameOver) {
      e.preventDefault();
      goalPanelOpen = !goalPanelOpen;
      if (goalPanelOpen) {
        // Refresh discoveries before showing
        const newDisc = computeGoalDiscoveries(state);
        for (const id of newDisc) discoveredGoalIds.add(id);
        showGoalPanel();
      } else {
        const overlay = document.getElementById("goal-panel-overlay");
        if (overlay) { overlay.classList.remove("active"); overlay.innerHTML = ""; }
      }
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
  display.renderHUD(state, visitedRoomIds);

  // Auto-save flash indicator
  if (autoSaveFlashTimer > 0) {
    const elapsed = performance.now() - autoSaveFlashTimer;
    if (elapsed < 1500) {
      let saveEl = document.getElementById("autosave-flash");
      if (!saveEl) {
        saveEl = document.createElement("div");
        saveEl.id = "autosave-flash";
        saveEl.style.cssText = "position:fixed;top:8px;right:8px;color:rgba(0,255,180,0.7);font-family:'Courier New',monospace;font-size:10px;letter-spacing:2px;z-index:50;pointer-events:none;transition:opacity 0.5s";
        document.body.appendChild(saveEl);
      }
      saveEl.textContent = "SAVED";
      saveEl.style.opacity = elapsed < 1000 ? "1" : String(1 - (elapsed - 1000) / 500);
    } else {
      autoSaveFlashTimer = 0;
      const saveEl = document.getElementById("autosave-flash");
      if (saveEl) saveEl.style.opacity = "0";
    }
  }

  // Elapsed time indicator in HUD status bar
  const hudStatus = document.getElementById("hud-status");
  if (hudStatus && !state.gameOver) {
    const elapsedMs = Date.now() - runStartTime;
    const mins = Math.floor(elapsedMs / 60000);
    const secs = Math.floor((elapsedMs % 60000) / 1000);
    const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;
    hudStatus.innerHTML += ` <span style="color:#334;font-size:10px">${timeStr}</span>`;
  }

  // Contextual HUD tip system
  if (!state.gameOver && !investigationHubOpen && !mapOpen && !helpOpen) {
    updateHudTip();
  }
  renderHudTip();

  // Update investigation aura: pass evidence room data to 3D renderer
  if (state.mystery && (display as any).setInvestigationRooms) {
    const journal = state.mystery.journal;
    const investigationRooms = new Map<string, { evidenceCount: number; fullyInvestigated: boolean }>();
    for (const entry of journal) {
      const existing = investigationRooms.get(entry.roomFound);
      if (existing) {
        existing.evidenceCount++;
      } else {
        investigationRooms.set(entry.roomFound, { evidenceCount: 1, fullyInvestigated: false });
      }
    }
    // Mark rooms as fully investigated if all evidence entities in the room are exhausted
    for (const room of state.rooms) {
      const data = investigationRooms.get(room.name);
      if (data) {
        let hasUnexhausted = false;
        for (const [, entity] of state.entities) {
          if (entity.pos.x >= room.x && entity.pos.x < room.x + room.width &&
              entity.pos.y >= room.y && entity.pos.y < room.y + room.height) {
            if ((entity.type === EntityType.LogTerminal || entity.type === EntityType.EvidenceTrace ||
                 entity.type === EntityType.Console || entity.type === EntityType.SecurityTerminal) &&
                !entity.props["exhausted"]) {
              hasUnexhausted = true;
              break;
            }
          }
        }
        data.fullyInvestigated = !hasUnexhausted;
      }
    }
    (display as any).setInvestigationRooms(investigationRooms);
  }

  // Station stress level: compute from overall hazard severity for dynamic events
  if ((display as any).setStationStress) {
    let hazardTiles = 0;
    let totalTiles = 0;
    for (let y = 0; y < state.tiles.length; y++) {
      for (let x = 0; x < state.tiles[y].length; x++) {
        totalTiles++;
        const tile = state.tiles[y][x];
        if (tile.heat > 40 || tile.smoke > 30 || tile.pressure < 60) hazardTiles++;
      }
    }
    const stress = totalTiles > 0 ? Math.min(1, (hazardTiles / totalTiles) * 8) : 0;
    (display as any).setStationStress(stress);
  }

  // ── Focused goal HUD ─────────────────────────────────────────
  updateGoalHUD();

  // Auto-explore badge
  const autoEl = document.getElementById("auto-explore-badge");
  if (autoEl) {
    autoEl.style.display = autoExploring ? "block" : "none";
  }
}

// ── Restart / New Game handler ───────────────────────────────────
function resetGameState(newSeed: number): void {
  deleteSave();
  seed = newSeed;
  stationMood = MOOD_TYPES[seed % 3];
  corvusPersonality = CORVUS_PERSONALITIES[(seed >> 2) % 3];
  // Persist seed so next "New Game" increments from here
  try { localStorage.setItem(LAST_SEED_KEY, String(seed)); } catch { /* ignore */ }
  state = generate(seed, difficulty);
  runStartTime = Date.now();
  lastPlayerRoomId = "";
  visitedRoomIds.clear();
  journalOpen = false;
  activeChoice = null;
  investigationHubOpen = false;
  restartPending = false;
  pauseMenuOpen = false;
  // Close overlays on restart
  const broadcastEl = document.getElementById("broadcast-overlay");
  if (broadcastEl) { broadcastEl.classList.remove("active"); broadcastEl.innerHTML = ""; }
  const journalEl = document.getElementById("journal-overlay");
  if (journalEl) { journalEl.classList.remove("active"); journalEl.innerHTML = ""; }
  choicesPresented.clear();
  prevCrackMomentFired = false;
  prevRevealedContradictions = 0;
  prevConfirmedSlots = 0;
  prevIdentifiedCrew = 0;
  pendingSceneResult = null;
  pendingSceneRoom = null;
  hubSceneResult = null;

  // Reset per-run narrative/tutorial state
  firstDroneEncounterShown = false;
  droneEncounterSet.clear();
  triggeredBotIntrospections.clear();
  triggeredTutorialHints.clear();
  cleanMsgIndex = 0;
  waitMsgIndex = 0;
  lastAmbientRoomId = "";
  currentRoomTurns = 0;
  lastRoomIdForAmbient = "";
  escortArcSteps.clear();
  corridorAmbientFired.clear();
  lastCorridorAmbientTurn = 0;
  lastJournalLength = 0;
  previouslyUnlockedDeductions.clear();
  goalPanelOpen = false;
  goalPanelIdx = 0;
  focusedGoalId = null;
  discoveredGoalIds.clear();
  lastGoalDiscoveryCount = 0;
  foreshadowedRooms.clear();
  echoedRooms.clear();
  mapOpen = false;
  helpOpen = false;
  autoSaveFlashTimer = 0;
  hudTipText = "";
  hudTipShowTime = 0;
  lastHudTipKey = "";
  lastHudTipTurn = 0;
  incidentCardOpen = false;
  logReviewOpen = false;
  activeDeduction = null;
  deductionSelectedIdx = 0;
  confirmingDeduction = false;
  pendingCeremonyDeduction = null;
  hubSection = "evidence";
  hubOptionIdx = 0;
  hubDetailDeduction = null;
  hubConfirming = false;
  hubIdx = 0;
  hubEvidenceFilter = "all";
  hubViewedEvidenceIds.clear();
  contradictionFalseLeadFired = false;
  contradictionRefutationFired = false;
  dwellTurnsStationary = 0;
  dwellRoomId = "";
  dwellWarning12Fired = false;
  dwellWarning20Fired = false;
  firstDiscoveryBeat = 0;
  cascadePhase = 0;
  breachCorruptionPhase = 0;
  sabotageOrganismPhase = 0;
  signalPulseCounter = 0;
  sensorBlockedTurns = 0;
  lastEvidenceViewCount = 0;
  scrubberHintFired = false;
  beaconHintFired = false;
  lastProgressTurn = 0;
  lastNudgeTurn = 0;
  pendingCrewDoor = null;
  journalTab = "evidence";
  choiceSelectedIdx = 0;

  // Clear overlays and display, rebuild
  const gameoverEl = document.getElementById("gameover-overlay");
  if (gameoverEl) { gameoverEl.classList.remove("active"); gameoverEl.innerHTML = ""; }
  display.destroy();
  containerEl.innerHTML = "";
  display = new BrowserDisplay3D(containerEl, state.width, state.height);
}

function handleRestartKey(e: KeyboardEvent): void {
  if (!state.gameOver) return;
  if (e.key === "r" || e.key === "R") {
    e.preventDefault();
    resetGameState(seed);
    display.addLog("RESTARTING LINK...", "system");
    display.addLog("Sweepo rebooted. All systems reset.", "milestone");
    display.addLog("MAINTENANCE SUBROUTINE: Clean rooms to 80% standard. Use [c] to clean.", "system");
    lastObjectivePhase = ObjectivePhase.Clean;
    // Start ambient for same archetype
    if (state.mystery?.timeline?.archetype) {
      audio.startAmbient(state.mystery.timeline.archetype);
    }
    checkRoomEntry();
    renderAll();
  }
  if (e.key === "n" || e.key === "N") {
    e.preventDefault();
    showSeedInput((chosenSeed) => {
      resetGameState(chosenSeed);
      gameStarted = false;
      showOpeningCrawl();
    });
  }
  if (e.key === "c" || e.key === "C") {
    e.preventDefault();
    void display.copyRunSummary().then((ok: boolean) => {
      if (ok) {
        display.addLog("[Run summary copied to clipboard]", "system");
      }
    });
  }
}

// ── Action handler ──────────────────────────────────────────────
function handleAction(action: Action): void {
  if (state.gameOver) return;

  // Any non-auto-explore action stops auto-explore
  if (autoExploring && action.type !== ActionType.AutoExplore && action.type !== ActionType.Move) {
    stopAutoExplore();
  }
  // Manual action stops autoplay (but not when autoplay is driving)
  if (autoplayActive && !autoplayDriving) {
    stopAutoplay();
    display.addLog("[AUTOPLAY OFF] Manual control restored.", "system");
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
    display.addLog("[AUTO] Exploring... any key to stop. Stops on: damage, nearby interactables.", "system");
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

  // Space bar sends Interact — fall back to Wait if nothing is nearby
  let resolvedAction: Action = action;
  if (action.type === ActionType.Interact && !action.targetId && !hasAdjacentInteractable()) {
    resolvedAction = { type: ActionType.Wait };
  }

  const prevTurn = state.turn;
  const prevLogs = state.logs.length;
  const prevHp = state.player.hp;
  const prevStun = state.player.stunTurns;
  const prevCrackState = state.mystery?.evidenceAccumulation?.crack_moment_fired ?? false;
  const prevContradictionCount = state.mystery?.contradictionPairs?.filter(cp => cp.revealed).length ?? 0;
  const prevSlotCount = state.mystery?.incidentBoard?.slots.filter(s => s.status === "confirmed").length ?? 0;
  const prevCrewIdCount = state.mystery?.dossiers?.filter(d => d.confirmed.name).length ?? 0;
  const ppx = state.player.entity.pos.x;
  const ppy = state.player.entity.pos.y;
  const prevDirt = state.tiles[ppy]?.[ppx]?.dirt ?? 0;
  const hadEvacFarewell = state.milestones.has("corvus_evac_farewell");
  const prevJournalCount = state.mystery?.journal.length ?? 0;
  state = step(state, resolvedAction);

  // Start background music on first player interaction
  // audio.startBgMusic(); // temporarily disabled

  // Action-triggered tutorial hints (fire once per action type)
  if (state.turn !== prevTurn) {
    if (action.type === ActionType.Interact && !triggeredTutorialHints.has("first_interact")) {
      triggeredTutorialHints.add("first_interact");
      display.addLog(TUTORIAL_HINT_FIRST_INTERACT, "system");
    }
    if (action.type === ActionType.Scan && !triggeredTutorialHints.has("first_scan")) {
      triggeredTutorialHints.add("first_scan");
      display.addLog(TUTORIAL_HINT_FIRST_SCAN, "system");
    }
    if (action.type === ActionType.Clean && !triggeredTutorialHints.has("first_clean")) {
      triggeredTutorialHints.add("first_clean");
      display.addLog(TUTORIAL_HINT_FIRST_CLEAN, "system");
    }
  }

  // Screen flash when all crew evacuated (milestone transition detection)
  if (state.milestones.has("corvus_evac_farewell") && !hadEvacFarewell) {
    display.triggerScreenFlash("milestone");
  }

  // Discovery moment VFX (Crack Moment, Contradiction, Timeline, Crew Fate)
  checkDiscoveryMoments();

  // Evidence discovery narrative feedback — when new journal entries are added
  const newJournalCount = state.mystery?.journal.length ?? 0;
  if (newJournalCount > prevJournalCount && state.mystery) {
    const newEntries = state.mystery.journal.slice(prevJournalCount);
    for (const entry of newEntries) {
      const catLabel = entry.category.toUpperCase();
      // Check if this entry matches a contradiction pair
      const isContradiction = state.mystery.contradictionPairs?.some(cp =>
        (cp.officialFound && entry.detail.includes(cp.official.text)) ||
        (cp.contradictingFound && entry.detail.includes(cp.contradicting.text))
      );
      if (isContradiction) {
        display.addLog(`\u26A0 CONFLICTING ACCOUNT DETECTED \u2014 ${entry.summary}`, "warning");
        display.triggerScreenFlash?.("damage");
        audio.playDeductionWrong();
      }
    }
  }

  // One-time utility attachment activation hints
  if (!scrubberHintFired && state.player.entity.props["hasScrubber"] === true && state.turn % 3 === 0) {
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;
    if (py >= 0 && py < state.height && px >= 0 && px < state.width && state.tiles[py][px].smoke < 10) {
      // Scrubber cleared smoke — only show hint if there was smoke to clear
    } else {
      scrubberHintFired = true;
      display.addLog("Atmospheric Scrubber cycling — smoke filtered from your position. Passive effect active.", "system");
    }
  }
  if (!beaconHintFired && state.player.entity.props["hasBeacon"] === true) {
    beaconHintFired = true;
    display.addLog("Emergency Beacon deployed. Hazard spread suppressed in this room for 15 turns.", "milestone");
  }

  // Show sim-generated log messages (from interactions) with proper classification
  // Scene processing results are deferred until room exit (design doc requirement)
  if (state.logs.length > prevLogs) {
    let hasPA = false;
    for (let i = prevLogs; i < state.logs.length; i++) {
      const simLog = state.logs[i];
      // Defer scene processing result logs until room exit
      if (simLog.id.startsWith("log_process_result_")) {
        pendingSceneResult = simLog.text;
        const currentRoom = state.rooms.find(r => {
          const px = state.player.entity.pos.x;
          const py = state.player.entity.pos.y;
          return px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height;
        });
        pendingSceneRoom = currentRoom?.name ?? null;
        continue; // skip immediate display
      }
      // Crew identification celebration — trigger screen flash
      if (simLog.id.startsWith("log_crew_identified_")) {
        display.triggerScreenFlash("milestone");
        audio.playDeductionCorrect();
      }
      // First evidence celebration — screen flash
      if (simLog.id.startsWith("log_first_evidence_")) {
        display.triggerScreenFlash("milestone");
        audio.playInteract();
      }
      // Memory echo clue examined — trigger ghost reveal in 3D renderer
      if (simLog.id.startsWith("log_memory_echo_")) {
        const crewId = simLog.id.replace("log_memory_echo_", "").replace(/_\d+$/, "");
        if (crewId && crewId !== "unknown") {
          display.triggerGhostReveal?.(crewId);
        }
        // Still show the log text normally (don't skip)
      }
      const logType = classifySimLog(simLog.text, simLog.source);
      display.addLog(simLog.text, logType);
      if (simLog.text.startsWith("CORVUS-7 CENTRAL:")) hasPA = true;
      // Feed to TTS if enabled
      audio.speak(simLog.text);
    }
    if (hasPA) audio.playPA();

    // Scan new log terminal entries for room name references (foreshadowing detection)
    for (let i = prevLogs; i < state.logs.length; i++) {
      const simLog = state.logs[i];
      if (simLog.id.startsWith("log_terminal_") && !simLog.id.includes("reread")) {
        for (const room of state.rooms) {
          if (simLog.text.includes(room.name) && !visitedRoomIds.has(room.id)) {
            if (!foreshadowedRooms.has(room.name)) {
              foreshadowedRooms.set(room.name, simLog.text);
            }
          }
        }
      }
    }

    // Interaction produced logs -- play interact sound + colored tile flash
    if (resolvedAction.type === ActionType.Interact) {
      audio.playInteract();
      // Entity-type-specific flash colors
      const getFlashColor = (ent: { type: string }): string => {
        switch (ent.type) {
          case EntityType.Relay: return "#fa0"; // amber for relay activation
          case EntityType.EvidenceTrace: return "#fc0"; // gold for evidence
          case EntityType.LogTerminal: return "#6cf"; // cyan for terminals
          case EntityType.CrewNPC: return "#fff"; // white for crew
          case EntityType.SensorPickup: return "#0f0"; // green for sensor upgrade
          case EntityType.DataCore: return "#f0f"; // magenta for data core
          default: return "#fff"; // white default
        }
      };
      if (resolvedAction.targetId) {
        const target = state.entities.get(resolvedAction.targetId);
        if (target) {
          display.flashTile(target.pos.x, target.pos.y, getFlashColor(target));
        }
      } else {
        const px = state.player.entity.pos.x;
        const py = state.player.entity.pos.y;
        const deltas = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 0 }];
        for (const d of deltas) {
          for (const [id, ent] of state.entities) {
            if (id === "player") continue;
            if (ent.pos.x === px + d.x && ent.pos.y === py + d.y) {
              display.flashTile(ent.pos.x, ent.pos.y, getFlashColor(ent));
            }
          }
        }
      }
    } else if (resolvedAction.type === ActionType.Move) {
      audio.playMove();
    }
  } else if (state.turn !== prevTurn) {
    // Fallback messages for actions without sim logs
    switch (resolvedAction.type) {
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
        // Hazard proximity: warn about dangerous adjacent tiles
        if (tile && tile.heat < 30 && tile.smoke < 10) {
          const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
          let nearHeat = false, nearSmoke = false;
          for (const [ddx, ddy] of dirs) {
            const adj = state.tiles[py + ddy]?.[px + ddx];
            if (!adj) continue;
            if (adj.heat >= 35) nearHeat = true;
            if (adj.smoke >= 40) nearSmoke = true;
          }
          if (nearHeat && state.turn % 4 === 0) {
            display.addLog("Warning: thermal readings spiking in adjacent section.", "warning");
          } else if (nearSmoke && state.turn % 4 === 0) {
            display.addLog("Warning: dense particulate concentration detected ahead.", "warning");
          }
        }
        break;
      }
      case ActionType.Wait: {
        // Wait messages removed — subtitle-only display makes idle chatter disruptive
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

  // Atmospheric sensor pressure zone hints
  if (action.type === ActionType.Move && state.turn !== prevTurn) {
    const hasAtmospheric = state.player.sensors?.includes(SensorType.Atmospheric) ?? false;
    if (hasAtmospheric) {
      const px = state.player.entity.pos.x;
      const py = state.player.entity.pos.y;
      const tile = state.tiles[py]?.[px];
      if (tile && tile.pressure < 60 && tile.pressure > 0 && state.turn % 8 === 0) {
        const hintIdx = (px * 11 + py * 7) % PRESSURE_ZONE_HINTS.length;
        display.addLog(PRESSURE_ZONE_HINTS[hintIdx], "sensor");
      }
    }
  }

  // Pressure puzzle contextual hints (fire once each)
  if (action.type === ActionType.Move && state.turn !== prevTurn) {
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;

    // Crew-in-distress: warn when player approaches a decompressed room with living crew
    if (!crewDistressHintShown) {
      for (const [, entity] of state.entities) {
        if (entity.type !== EntityType.CrewNPC) continue;
        if (entity.props["evacuated"] === true || entity.props["dead"] === true) continue;
        const dist = Math.abs(entity.pos.x - px) + Math.abs(entity.pos.y - py);
        if (dist > 8) continue;
        const crewTile = state.tiles[entity.pos.y]?.[entity.pos.x];
        if (crewTile && crewTile.pressure < 30) {
          display.addLog(CREW_DISTRESS_HINT, "warning");
          crewDistressHintShown = true;
          break;
        }
      }
    }

    // Breach proximity: hint when player is within 3 tiles of an unsealed breach
    if (!breachProximityHintShown) {
      for (const [, entity] of state.entities) {
        if (entity.type !== EntityType.Breach) continue;
        if (entity.props["sealed"] === true || entity.props["scanHidden"] === true) continue;
        const dist = Math.abs(entity.pos.x - px) + Math.abs(entity.pos.y - py);
        if (dist <= 3) {
          display.addLog(BREACH_PROXIMITY_HINT, "system");
          breachProximityHintShown = true;
          break;
        }
      }
    }
  }

  // Room ambient micro-events: atmospheric flavor when lingering in a room
  if (state.turn !== prevTurn) {
    const playerPos = state.player.entity.pos;
    const currentRoom = getRoomAt(state, playerPos);
    const roomId = currentRoom ? currentRoom.name : "";
    if (roomId && roomId === lastRoomIdForAmbient) {
      currentRoomTurns++;
      // Fire an ambient event every 7 turns while lingering
      if (currentRoomTurns > 0 && currentRoomTurns % 7 === 0) {
        const pool = ROOM_AMBIENT_EVENTS[roomId] ?? ROOM_AMBIENT_DEFAULT;
        const ambIdx = (state.turn * 3 + roomId.length * 7) % pool.length;
        display.addLog(pool[ambIdx], "narrative");
      }
    } else {
      currentRoomTurns = 0;
      lastRoomIdForAmbient = roomId;
    }
  }

  // ── Station-wide ambient events: distant sounds, structural stress ──
  if (state.turn !== prevTurn && state.turn - lastStationEventTurn >= 12) {
    // ~20% chance per turn after cooldown
    const eventRoll = ((state.turn * 41 + state.seed * 7) % 100);
    if (eventRoll < 20) {
      lastStationEventTurn = state.turn;
      const STATION_AMBIENT = [
        "A distant metallic groan reverberates through the hull.",
        "Something clatters in a far-off corridor. Then silence.",
        "The overhead lights flicker — a brief power fluctuation from deep in the grid.",
        "A faint hiss echoes from the ventilation ducts above.",
        "The deck plates vibrate briefly underfoot. Structural settling.",
        "A rhythmic tapping emanates from inside the walls — thermal expansion in the pipes.",
        "Emergency lighting stutters in a nearby corridor. The station shivers.",
        "Air pressure shifts subtly — a door cycling somewhere deeper in the station.",
        "The station's spine creaks. Metal fatigue speaking in its own language.",
        "A brief whine from the power conduits, then nothing. Systems compensating.",
      ];
      const ambIdx = ((state.turn * 13 + state.seed) % STATION_AMBIENT.length);
      display.addLog(STATION_AMBIENT[ambIdx], "narrative");
    }
  }

  // ── ReactorScram dwell penalty: data core tracks stationarity ──────
  if (state.turn !== prevTurn && state.mystery?.timeline?.archetype === IncidentArchetype.ReactorScram) {
    const playerPos2 = state.player.entity.pos;
    const dwellRoom = getRoomAt(state, playerPos2);
    const dwellRmId = dwellRoom ? dwellRoom.id : "";
    if (dwellRmId && dwellRmId === dwellRoomId) {
      dwellTurnsStationary++;
      if (dwellTurnsStationary >= 20 && !dwellWarning20Fired) {
        dwellWarning20Fired = true;
        const pool = DATA_CORE_DWELL_WARNINGS.threshold20;
        display.addLog(pool[(state.seed + state.turn) % pool.length], "critical");
        // Apply +10 heat to player's room tiles
        if (dwellRoom) {
          for (let ry = dwellRoom.y; ry < dwellRoom.y + dwellRoom.height; ry++) {
            for (let rx = dwellRoom.x; rx < dwellRoom.x + dwellRoom.width; rx++) {
              if (ry >= 0 && ry < state.height && rx >= 0 && rx < state.width) {
                state.tiles[ry][rx].heat = Math.min(100, state.tiles[ry][rx].heat + 10);
              }
            }
          }
        }
        display.triggerScreenFlash("damage");
      } else if (dwellTurnsStationary >= 12 && !dwellWarning12Fired) {
        dwellWarning12Fired = true;
        const pool = DATA_CORE_DWELL_WARNINGS.threshold12;
        display.addLog(pool[(state.seed + state.turn) % pool.length], "warning");
        // Apply +5 heat to player's room tiles
        if (dwellRoom) {
          for (let ry = dwellRoom.y; ry < dwellRoom.y + dwellRoom.height; ry++) {
            for (let rx = dwellRoom.x; rx < dwellRoom.x + dwellRoom.width; rx++) {
              if (ry >= 0 && ry < state.height && rx >= 0 && rx < state.width) {
                state.tiles[ry][rx].heat = Math.min(100, state.tiles[ry][rx].heat + 5);
              }
            }
          }
        }
      }
    } else {
      dwellTurnsStationary = 0;
      dwellRoomId = dwellRmId;
      dwellWarning12Fired = false;
      dwellWarning20Fired = false;
    }
  }

  // ── CoolantCascade: thermal cascade timer (heat spreads to unexplored rooms) ──
  if (state.turn !== prevTurn && state.mystery?.timeline?.archetype === IncidentArchetype.CoolantCascade && state.turn >= 50) {
    cascadePhase++;
    if (cascadePhase % 50 === 0) {
      // Inject heat into 3 random walkable tiles in unexplored areas
      const unexploredWalkable: { x: number; y: number }[] = [];
      for (let y = 0; y < state.height; y++) {
        for (let x = 0; x < state.width; x++) {
          if (state.tiles[y][x].walkable && !state.tiles[y][x].explored && state.tiles[y][x].heat < 40) {
            unexploredWalkable.push({ x, y });
          }
        }
      }
      if (unexploredWalkable.length > 0) {
        for (let i = 0; i < Math.min(3, unexploredWalkable.length); i++) {
          const idx = ((state.seed * 7 + cascadePhase * 13 + i * 31) >>> 0) % unexploredWalkable.length;
          const t = unexploredWalkable[idx];
          state.tiles[t.y][t.x].heat = Math.min(80, state.tiles[t.y][t.x].heat + 15);
        }
        const pool = COOLANT_CASCADE_WARNINGS;
        display.addLog(pool[(cascadePhase / 50) % pool.length], "warning");
      }
    }
  }

  // ── HullBreach: evidence degradation (unread terminals corrupt) ──
  if (state.turn !== prevTurn && state.mystery?.timeline?.archetype === IncidentArchetype.HullBreach && state.turn >= 60) {
    breachCorruptionPhase++;
    if (breachCorruptionPhase % 80 === 0) {
      // Find an unread terminal far from the player and corrupt it
      const px = state.player.entity.pos.x;
      const py = state.player.entity.pos.y;
      let farthest: { id: string; dist: number } | null = null;
      for (const [eid, ent] of state.entities) {
        if (ent.type !== EntityType.LogTerminal) continue;
        if (ent.props["read"] === true || ent.props["corrupted"] === true) continue;
        const dist = Math.abs(ent.pos.x - px) + Math.abs(ent.pos.y - py);
        if (!farthest || dist > farthest.dist) {
          farthest = { id: eid, dist };
        }
      }
      if (farthest) {
        const newEntities = new Map(state.entities);
        const ent = newEntities.get(farthest.id)!;
        const origText = (ent.props["text"] as string) || "";
        // Truncate to ~40% and add corruption note
        const corrupted = origText.slice(0, Math.floor(origText.length * 0.4)) + "\n[DATA CORRUPTED — moisture damage from decompression event]";
        newEntities.set(farthest.id, { ...ent, props: { ...ent.props, text: corrupted, corrupted: true } });
        state = { ...state, entities: newEntities };
        const pool = HULL_BREACH_CORRUPTION_WARNINGS;
        display.addLog(pool[(breachCorruptionPhase / 80) % pool.length], "warning");
      }
    }
  }

  // ── Sabotage: organism movement (patrol drone relocates) ──
  if (state.turn !== prevTurn && state.mystery?.timeline?.archetype === IncidentArchetype.Sabotage && state.turn >= 40) {
    sabotageOrganismPhase++;
    if (sabotageOrganismPhase % 60 === 0) {
      // Find a patrol drone and relocate it to a random room
      for (const [eid, ent] of state.entities) {
        if (ent.type !== EntityType.PatrolDrone) continue;
        // Pick a random room that isn't the player's current room
        const px = state.player.entity.pos.x;
        const py = state.player.entity.pos.y;
        const candidates = state.rooms.filter(r => !(px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height));
        if (candidates.length > 0) {
          const roomIdx = ((state.seed * 3 + sabotageOrganismPhase * 17) >>> 0) % candidates.length;
          const room = candidates[roomIdx];
          const newX = room.x + Math.floor(room.width / 2);
          const newY = room.y + Math.floor(room.height / 2);
          const newEntities = new Map(state.entities);
          newEntities.set(eid, { ...ent, pos: { x: newX, y: newY } });
          state = { ...state, entities: newEntities };
          const pool = SABOTAGE_ORGANISM_WARNINGS;
          display.addLog(pool[(sabotageOrganismPhase / 60) % pool.length], "warning");
          break; // relocate one drone per tick
        }
      }
    }
  }

  // ── SignalAnomaly: signal pulse interference (sensor overlay disabled) ──
  if (state.turn !== prevTurn && state.mystery?.timeline?.archetype === IncidentArchetype.SignalAnomaly && state.turn >= 30) {
    signalPulseCounter++;
    if (sensorBlockedTurns > 0) {
      sensorBlockedTurns--;
      if (sensorBlockedTurns === 0) {
        display.addLog("Sensor array recalibrated. Instruments back online.", "system");
      }
    }
    if (signalPulseCounter % 40 === 0 && sensorBlockedTurns === 0) {
      sensorBlockedTurns = 2;
      // Force sensor overlay off
      if (display.activeSensorMode !== null) {
        display.toggleSensor(display.activeSensorMode);
      }
      const pool = SIGNAL_PULSE_WARNINGS;
      display.addLog(pool[(signalPulseCounter / 40) % pool.length], "critical");
      display.triggerScreenFlash("stun");
    }
  }

  // Corridor transit ambient text: fire once per corridor segment
  if (action.type === ActionType.Move && state.turn !== prevTurn) {
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;
    const playerRoom = getRoomAt(state, { x: px, y: py });
    if (!playerRoom) {
      // Player is in a corridor — bucket by every 4 tiles
      const segKey = `${Math.floor(px / 4)}_${Math.floor(py / 4)}`;
      if (!corridorAmbientFired.has(segKey) && (state.turn - lastCorridorAmbientTurn) >= 20) {
        corridorAmbientFired.add(segKey);
        lastCorridorAmbientTurn = state.turn;
        // Alternate between default and mood-specific corridor pools
        const useMood = (px + py) % 3 === 0;
        const pool = useMood ? CORRIDOR_AMBIENT_MOOD[stationMood] : CORRIDOR_AMBIENT;
        const idx = (px * 7 + py * 13) % pool.length;
        display.addLog(pool[idx], "narrative");
      }
    }
  }

  // Archetype-specific environmental interrupts: make each archetype feel physically distinct
  if (state.turn !== prevTurn && state.turn >= 50 && state.turn % 25 === 0) {
    const archetype = state.mystery?.timeline.archetype;
    if (archetype) {
      const pool = ARCHETYPE_ATMOSPHERE[archetype];
      if (pool) {
        const idx = ((state.turn / 25) | 0) % pool.length;
        display.addLog(pool[idx], "narrative");
      }
    }
  }

  // ── Track progress for pacing nudges ──
  if (state.turn !== prevTurn) {
    // Count interaction or new room entry as progress
    if (resolvedAction.type === ActionType.Interact || resolvedAction.type === ActionType.Scan) {
      lastProgressTurn = state.turn;
    }
    // New room entry counts as progress
    const currentRoomId = getRoomAt(state, state.player.entity.pos)?.name ?? "";
    if (currentRoomId && currentRoomId !== lastPlayerRoomId) {
      lastProgressTurn = state.turn;
    }

    // Fire nudge after 8 turns of no progress (max once per 12 turns)
    const turnsSinceProgress = state.turn - lastProgressTurn;
    const turnsSinceNudge = state.turn - lastNudgeTurn;
    if (turnsSinceProgress >= 8 && turnsSinceNudge >= 12 && !state.gameOver) {
      const phase = state.mystery?.objectivePhase;
      let nudgePool: string[];
      if (phase === ObjectivePhase.Evacuate) nudgePool = PACING_NUDGE_EVACUATE;
      else if (phase === ObjectivePhase.Recover) nudgePool = PACING_NUDGE_RECOVER;
      else if (phase === ObjectivePhase.Investigate) nudgePool = PACING_NUDGE_INVESTIGATE;
      else nudgePool = PACING_NUDGE_CLEAN;
      const nudgeIdx = (state.turn * 7 + state.seed) % nudgePool.length;
      display.addLog(nudgePool[nudgeIdx], "system");
      lastNudgeTurn = state.turn;
    }
  }

  // ── Final approach CORVUS-7 beat (late-game, post-evacuation) ──
  if (state.turn !== prevTurn && !state.gameOver) {
    const turnPct = state.turn / state.maxTurns;
    const allEvacuated = state.mystery?.evacuation?.crewEvacuated?.length &&
      state.mystery.evacuation.crewEvacuated.length > 0;
    if (turnPct >= 0.8 && allEvacuated && !state.milestones.has("corvus_final_approach_fired")) {
      // Fire once per run
      const newMs = new Set(state.milestones);
      newMs.add("corvus_final_approach_fired");
      state = { ...state, milestones: newMs };
      const faIdx = state.seed % CORVUS_FINAL_APPROACH.length;
      display.addLog(CORVUS_FINAL_APPROACH[faIdx], "milestone");
    }
  }

  // Crew escort dialogue arc: sequential personality-driven lines while following
  if (state.turn !== prevTurn && state.turn % 12 === 0) {
    for (const [entityId, entity] of state.entities) {
      if (entity.type !== EntityType.CrewNPC) continue;
      if (entity.props["following"] !== true) continue;
      if (entity.props["dead"] === true || entity.props["evacuated"] === true) continue;
      const personality = (entity.props["personality"] as string) || "cautious";
      const crewName = `${entity.props["firstName"]} ${entity.props["lastName"]}`;
      const step = (escortArcSteps.get(entityId) ?? 0);
      const arc = CREW_ESCORT_ARC[personality];
      if (arc && step < arc.length) {
        display.addLog(arc[step](crewName), "narrative");
        escortArcSteps.set(entityId, step + 1);
        break; // one line per tick
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

  // Item 9: Bot introspection at turn milestones (archetype-aware)
  for (const intro of BOT_INTROSPECTIONS) {
    if (state.turn >= intro.turn && !triggeredBotIntrospections.has(intro.turn)) {
      triggeredBotIntrospections.add(intro.turn);
      // Use archetype-specific introspection if available for this turn
      const archetype = state.mystery?.timeline.archetype;
      const archetypeText = archetype ? BOT_INTROSPECTIONS_BY_ARCHETYPE[archetype]?.[intro.turn] : undefined;
      display.addLog(archetypeText || intro.text, "narrative");
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
    // CORVUS-7 investigation progress milestones (evidence count)
    {
      const jLen = state.mystery.journal.length;
      const evidenceThresholds = [
        { count: 3, key: "evidence_3" },
        { count: 6, key: "evidence_6" },
        { count: 9, key: "evidence_9" },
        { count: 12, key: "evidence_12" },
        { count: 15, key: "evidence_15" },
      ];
      for (const t of evidenceThresholds) {
        if (jLen >= t.count && !state.milestones.has(t.key)) {
          const text = CORVUS_PERSONALITY_REACTIONS[corvusPersonality]?.[t.key] ?? CORVUS_REACTIONS[t.key];
          if (text) {
            const newMilestones = new Set(state.milestones);
            newMilestones.add(t.key);
            state = {
              ...state,
              milestones: newMilestones,
              logs: [...state.logs, { id: `log_corvus_${t.key}`, timestamp: state.turn, source: "system", text, read: false }],
            };
          }
        }
      }
    }

    // Evidence insight notification: fire when new journal entry contributes tags to an unlocked deduction
    const mystery = state.mystery!; // guaranteed non-null inside this if block
    if (mystery.journal.length > lastJournalLength) {
      const journal = mystery.journal;
      const newEntries = journal.slice(lastJournalLength);

      // Show evidence cards for important new journal entries (traces, crew items, key logs)
      const importantCategories = new Set(["trace", "item", "crew"]);
      for (const entry of newEntries) {
        // Only show cards for traces, crew items, and logs that mention crew
        const isImportant = importantCategories.has(entry.category) ||
          (entry.category === "log" && entry.crewMentioned.length > 0);
        if (isImportant && display.showEvidenceCard) {
          const crewNames = entry.crewMentioned
            .map(id => mystery.crew.find(c => c.id === id))
            .filter(Boolean)
            .map(c => `${c!.firstName} ${c!.lastName}`);
          display.showEvidenceCard(
            entry.category,
            entry.summary,
            entry.detail,
            entry.roomFound,
            crewNames,
          );
        }
      }

      const newTags = new Set(newEntries.flatMap(j => j.tags));
      const prevConnectionCount = lastJournalLength > 0
        ? (mystery.connections.length - newEntries.length) // approximate
        : 0;
      lastJournalLength = journal.length;

      // Notify about new auto-connections
      const newConns = mystery.connections.filter(c => c.discovered);
      if (newConns.length > prevConnectionCount) {
        const recentConn = newConns[newConns.length - 1];
        if (recentConn) {
          const src = journal.find(j => j.id === recentConn.sourceId);
          const tgt = journal.find(j => j.id === recentConn.targetId);
          if (src && tgt) {
            display.addLog(`CONNECTION: "${src.summary.slice(0, 35)}" links to "${tgt.summary.slice(0, 35)}" [${recentConn.sharedTags.join(", ")}]`, "narrative");
          }
        }
      }

      // Notify about insight reveals
      for (const insight of mystery.insights) {
        if (insight.revealed && !state.milestones.has(`insight_${insight.id}`)) {
          display.addLog(`INSIGHT REVEALED: ${insight.conclusionText}`, "milestone");
          display.triggerScreenFlash("milestone");
          state.milestones.add(`insight_${insight.id}`);
        }
      }

      // Check if any deduction is newly unlocked (evidence threshold + chain prerequisite)
      const currentlyUnlocked = getUnlockedDeductions(mystery.deductions, journal);
      for (const d of currentlyUnlocked) {
        if (!previouslyUnlockedDeductions.has(d.id)) {
          previouslyUnlockedDeductions.add(d.id);
          // Fire HUD notification for newly unlocked deduction
          display.addLog(`CORVUS-7 CENTRAL: Evidence cross-referenced. New deduction available. Open CONNECTIONS [v].`, "milestone");
          audio.playDeductionReady();
          if (display.showHUDNotification) {
            display.showHUDNotification({
              label: "NEW DEDUCTION AVAILABLE",
              text: d.question,
              hint: "Press [V] to open Investigation Hub → CONNECTIONS",
              color: "#fa0",
              duration: 7000,
            });
          }
          break; // one notification per tick
        }
      }
      // Also track unlocked set for deductions that were already unlocked at game start
      for (const d of currentlyUnlocked) {
        previouslyUnlockedDeductions.add(d.id);
      }
    }
    // ── Goal discovery notifications ─────────────────────────────
    const newDiscoveries = computeGoalDiscoveries(state);
    let goalDiscoveryNotified = false;
    for (const id of newDiscoveries) {
      if (!discoveredGoalIds.has(id)) {
        discoveredGoalIds.add(id);
        // Find the goal to get its title
        const allGoals = computeGoals(state, discoveredGoalIds, { visitedRoomIds });
        const newGoal = allGoals.find(g => g.id === id);
        if (newGoal && !goalDiscoveryNotified) {
          display.addLog(`NEW GOAL: ${newGoal.title} — press [G] to view goals`, "milestone");
          if (display.showHUDNotification) {
            display.showHUDNotification({
              label: "NEW GOAL DISCOVERED",
              text: newGoal.title,
              hint: "Press [G] to view Mission Goals",
              color: newGoal.color,
              duration: 5000,
            });
          }
          goalDiscoveryNotified = true;
          // Auto-focus first goal if nothing focused
          if (!focusedGoalId) {
            focusedGoalId = id;
          }
        }
      }
    }

    // ── Contradiction events ────────────────────────────────────
    // False lead: fire after the player reads their 3rd terminal
    if (!contradictionFalseLeadFired && state.mystery?.timeline?.archetype) {
      const terminalsReadCount = state.logs.filter(l => l.id.startsWith("log_terminal_") && !l.id.includes("_frame_") && !l.id.includes("_heal_") && !l.id.includes("_reread_")).length;
      if (terminalsReadCount >= 3) {
        const arch = state.mystery.timeline.archetype as IncidentArchetype;
        const falseLead = CONTRADICTION_FALSE_LEAD[arch];
        if (falseLead) {
          contradictionFalseLeadFired = true;
          display.addLog(falseLead, "narrative");
        }
      }
    }
    // Refutation: fire after the player solves their first deduction correctly
    if (contradictionFalseLeadFired && !contradictionRefutationFired && state.mystery?.timeline?.archetype) {
      const correctDeductionCount = state.mystery.deductions.filter(d => d.answeredCorrectly).length;
      if (correctDeductionCount >= 2) {
        const arch = state.mystery.timeline.archetype as IncidentArchetype;
        const refutation = CONTRADICTION_REFUTATION[arch];
        if (refutation) {
          contradictionRefutationFired = true;
          display.addLog(CORVUS_CONTRADICTION_NOTICE, "warning");
          display.addLog(refutation, "narrative");
        }
      }
    }

    // Mystery choice unlock notifications
    const choiceThresholds = [3, 6, 10];
    for (let ci = 0; ci < mystery.choices.length; ci++) {
      const choice = mystery.choices[ci];
      if (choice.chosen) continue;
      if (choicesPresented.has(choice.id)) continue;

      // Moral choice has investigation-quality gate instead of journal threshold
      if (choice.consequence === "moral_judgment") {
        if (isMoralChoiceUnlocked(mystery)) {
          choicesPresented.add(choice.id);
          display.addLog("CORVUS-7 CENTRAL: Investigation substantially complete. Final moral assessment now available at the Data Core.", "milestone");
          display.triggerScreenFlash("milestone");
        }
      } else if (ci < choiceThresholds.length && mystery.journal.length >= choiceThresholds[ci]) {
        choicesPresented.add(choice.id);
        display.addLog(`CORVUS-7 CENTRAL: Decision ${ci + 1} now available. Open the Evidence Hub [v] to review.`, "milestone");
        display.triggerScreenFlash("milestone");
      }
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

  // Auto-save every 3 turns (unless game is over)
  if (!state.gameOver && state.turn % 3 === 0) {
    saveGame(state);
  }

  if (state.gameOver) {
    deleteSave(); // Clear save on game end
    audio.stopAmbient(); // Silence the ambient drone
    // audio.stopBgMusic(); // Stop background music — temporarily disabled

    // Record run in history
    const deds = state.mystery?.deductions ?? [];
    const evac = state.mystery?.evacuation;
    const hpPct = Math.round((state.player.hp / state.player.maxHp) * 100);
    const dedsCorrect = deds.filter(d => d.answeredCorrectly).length;
    const crewEvac = evac?.crewEvacuated.length ?? 0;
    const crewDead = evac?.crewDead.length ?? 0;
    let crewTotal = crewEvac + crewDead;
    for (const [, e] of state.entities) { if (e.type === EntityType.CrewNPC) crewTotal++; }
    // Scoring matches display3d.ts showGameOverOverlay — keep in sync
    let sc = 0;
    if (state.victory) sc += 30;
    sc += Math.min(20, dedsCorrect * (20 / Math.max(deds.length, 1)));
    if (crewTotal > 0) sc += Math.min(20, (crewEvac / crewTotal) * 20);
    sc += Math.min(10, (visitedRoomIds.size / Math.max(state.rooms.length, 1)) * 10);
    sc += Math.min(10, (hpPct / 100) * 10);
    sc += Math.min(10, state.victory && state.turn < 200 ? 10 : state.victory && state.turn < 350 ? 5 : 0);
    const runRating = sc >= 90 ? "S" : sc >= 75 ? "A" : sc >= 55 ? "B" : sc >= 35 ? "C" : "D";
    recordRun(state, runRating);

    // Check achievements after recording the run
    const newBadges = checkAchievements();
    for (const badgeId of newBadges) {
      const all = getAchievements();
      const badge = all.find(a => a.id === badgeId);
      if (badge) {
        display.addLog(`[${badge.icon}] ACHIEVEMENT UNLOCKED: ${badge.name} — ${badge.description}`, "milestone");
      }
    }

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
        epilogue = getVictoryEpilogueComplete(state.mystery);
      } else if (ratio >= 0.4) {
        epilogue = getVictoryEpiloguePartial(state.mystery);
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

        // Choice endings (archetype-branched)
        const choiceArchetype = state.mystery.timeline.archetype;
        const choiceLines = choiceArchetype
          ? computeBranchedEpilogue(state.mystery.choices, choiceArchetype)
          : computeChoiceEndings(state.mystery.choices);
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

        // Station Autopsy investigation summary
        const endScenes = state.mystery.roomScenes ?? [];
        const endProcessed = endScenes.filter(s => s.processed).length;
        const endDossiers = state.mystery.dossiers ?? [];
        const endIdentified = endDossiers.filter(d => d.confirmed.name).length;
        const endBoard = state.mystery.incidentBoard;
        const endConfirmed = endBoard?.slots.filter(s => s.status === "confirmed").length ?? 0;
        const endTotalSlots = endBoard?.slots.length ?? 0;
        const endContradictions = state.mystery.contradictionPairs?.filter(cp => cp.revealed).length ?? 0;
        const endAccum = state.mystery.evidenceAccumulation;

        if (endScenes.length > 0) {
          display.addLog("", "system");
          display.addLog("\u2550\u2550 Investigation Quality \u2550\u2550", "milestone");
          display.addLog(`Scenes processed: ${endProcessed}/${endScenes.length}`, "sensor");
          display.addLog(`Crew identified: ${endIdentified}/${endDossiers.length}`, "sensor");
          if (endTotalSlots > 0) display.addLog(`Timeline confirmed: ${endConfirmed}/${endTotalSlots}`, "sensor");
          if (endContradictions > 0) display.addLog(`Contradictions found: ${endContradictions}`, "sensor");
          if (endAccum?.crack_moment_fired) display.addLog("CRACK MOMENT: The official story crumbled.", "milestone");
        }

        // CORVUS-7 final transmission — archetype-specific farewell
        const finalArchetype = state.mystery.timeline.archetype;
        const finalMsg = CORVUS_FINAL_TRANSMISSION[finalArchetype];
        if (finalMsg) {
          display.addLog("", "system");
          display.addLog(finalMsg, "milestone");
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
        getDefeatRelayText(state.mystery).forEach((line) => { if (line) display.addLog(line, "critical"); });
      } else {
        display.addLog("=== " + DEFEAT_TITLE + " ===", "critical");
        getDefeatText(state.mystery).forEach((line) => { if (line) display.addLog(line, "critical"); });
      }
    }
    flickerThenRender();
    // Show full-screen game-over overlay after the flicker
    const runElapsedMs = Date.now() - runStartTime;
    setTimeout(() => {
      display.showGameOverOverlay(state);
      // Inject elapsed time into game-over stats
      const turnsStat = document.querySelector(".gameover-stats .gameover-stat");
      if (turnsStat) {
        const mins = Math.floor(runElapsedMs / 60000);
        const secs = Math.floor((runElapsedMs % 60000) / 1000);
        const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;
        const timeEl = document.createElement("div");
        timeEl.className = "gameover-stat";
        timeEl.innerHTML = `<span class="stat-label">Time:</span> <span class="stat-value">${timeStr}</span>`;
        turnsStat.insertAdjacentElement("afterend", timeEl);
      }
    }, 400);
    return;
  }

  // Show interaction preview for adjacent entities after move
  if (action.type === ActionType.Move && !autoExploring) {
    showInteractionPreview();
  }

  renderAll();

  // Update camera-relative input mode from 3D renderer
  if (display && 'getPlayerFacing' in display) {
    inputHandler.facingAngle = (display as any).getPlayerFacing();
    inputHandler.cameraRelativeMode = (display as any).isChaseCam();
    // Wire up turn callback for tank-style controls (turn without moving)
    if (!inputHandler.turnCallback) {
      inputHandler.turnCallback = (dir: "left" | "right") => {
        if (display && 'turnPlayer' in display) {
          (display as any).turnPlayer(dir);
          // Immediately sync facing so the next forward press uses the new angle
          inputHandler.facingAngle = (display as any).getPlayerFacing();
        }
      };
    }
  }
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
          <div><span style="color:#fff">[i] [Enter]</span>  Interact with adjacent objects</div>
          <div style="color:#888;margin-left:20px">Terminals, doors, airlocks, relays,</div>
          <div style="color:#888;margin-left:20px">repair cradles, crew NPCs, escape pods</div>
          <div><span style="color:#fff">[c]</span>  Clean current tile</div>
          <div><span style="color:#fff">[q] / [t]</span>  Scan room (cycles sensor mode)</div>
          <div><span style="color:#fff">[x]</span>  Examine scene clues in current room</div>
          <div><span style="color:#fff">[.] [5]</span>  Wait one turn</div>
          <div><span style="color:#fff">[Tab]</span>  Auto-explore (any key to stop)</div>
        </div>

        <div>
          <div style="color:#4af;font-weight:bold;margin-bottom:6px">── Menus & Info ──</div>
          <div><span style="color:#fff">[r]</span>  Investigation Hub (evidence, deductions, narrative)</div>
          <div><span style="color:#fff">[v]</span>  Investigation Hub → Evidence</div>
          <div><span style="color:#fff">[;]</span>  Quick journal toggle</div>
          <div><span style="color:#fff">[\`]</span>  Message log review</div>
          <div><span style="color:#fff">[g]</span>  Mission Goals (track/focus)</div>
          <div><span style="color:#fff">[m]</span>  Station map overlay</div>
          <div><span style="color:#fff">[?]</span>  This help screen</div>
        </div>

        <div>
          <div style="color:#4af;font-weight:bold;margin-bottom:6px">── In Menus ──</div>
          <div><span style="color:#fff">[Tab]</span>  Switch sections / tabs</div>
          <div><span style="color:#fff">[1]-[4]</span>  Jump to Hub tab (Evidence/Scenes/Connections/Crew)</div>
          <div><span style="color:#fff">[f]</span>  Cycle evidence filter (all/room/type/unread)</div>
          <div><span style="color:#fff">[p]</span>  Process scene (in Scene detail view)</div>
          <div><span style="color:#fff">[Enter]</span>  Submit / select</div>
          <div><span style="color:#fff">[Y] / [N]</span>  Confirm or cancel prompts</div>
          <div><span style="color:#fff">[Esc]</span>  Close overlay / back</div>
        </div>
      </div>

      <div style="margin-top:16px;border-top:1px solid #333;padding-top:12px;max-width:700px;margin-left:auto;margin-right:auto">
        <div style="color:#4af;font-weight:bold;margin-bottom:6px">── Game Phases ──</div>
        <div><span style="color:#4a4">MAINTENANCE</span>  Clean rooms to 80% to progress</div>
        <div><span style="color:#fa0">INVESTIGATION</span>  Read terminals, collect evidence, solve deductions</div>
        <div><span style="color:#f44">RECOVERY</span>  Reroute relays, transmit data from Data Core</div>
        <div><span style="color:#f0f">EVACUATION</span>  Lead crew survivors to powered Escape Pods</div>
      </div>

      <div style="margin-top:12px;border-top:1px solid #333;padding-top:12px;max-width:700px;margin-left:auto;margin-right:auto">
        <div style="color:#666;font-weight:bold;margin-bottom:6px">── Display & Debug ──</div>
        <div><span style="color:#888">[F2]</span>  Toggle chase cam / ortho cam</div>
        <div><span style="color:#888">[F3]</span>  Toggle 3D renderer</div>
        <div><span style="color:#888">[F4]</span>  Toggle outline effect</div>
        <div><span style="color:#888">[F7]</span>  Toggle autoplay bot</div>
        <div><span style="color:#888">[F8]</span>  Mute / unmute audio</div>
        <div><span style="color:#888">[F9]</span>  Volume down</div>
        <div><span style="color:#888">[F10]</span> Volume up</div>
        <div><span style="color:#888">[R] / [N]</span>  Replay / New Game (game over screen)</div>
      </div>

      <div style="margin-top:12px;border-top:1px solid #333;padding-top:12px;max-width:700px;margin-left:auto;margin-right:auto">
        <div style="color:#666;font-weight:bold;margin-bottom:6px">── Controller / Gamepad ──</div>
        <div><span style="color:#888">D-Pad / L-Stick</span>  Move / Navigate menus</div>
        <div><span style="color:#888">A</span>  Interact / Confirm</div>
        <div><span style="color:#888">B</span>  Back / Cancel</div>
        <div><span style="color:#888">X</span>  Clean</div>
        <div><span style="color:#888">Y</span>  Scan</div>
        <div><span style="color:#888">LB</span>  Investigation Hub</div>
        <div><span style="color:#888">RB</span>  Auto-Explore</div>
        <div><span style="color:#888">Start</span>  Pause Menu</div>
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

// ── Message log review ───────────────────────────────────────────
function showLogReview(): void {
  const overlay = document.getElementById("journal-overlay");
  if (!overlay) return;

  const logHistory = display.getLogHistory();
  const logEntries = logHistory.length > 0
    ? logHistory.map(entry => {
        const cls = `log-${entry.type}`;
        return `<div class="${cls}" style="padding:3px 0;border-bottom:1px solid #1a1a1a"><span class="log-prefix">&gt; </span>${entry.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>`;
      }).join("")
    : '<div style="color:#555;text-align:center;padding:2rem">No messages yet.</div>';

  overlay.innerHTML = `
    <div class="journal-container" style="padding:20px;overflow-y:auto;color:#ccc">
      <div style="text-align:center;margin-bottom:12px">
        <span style="color:#4cf;font-size:16px;font-weight:bold;letter-spacing:2px">MESSAGE LOG</span>
        <div style="color:#555;font-size:11px">Press [\`] or [Esc] to close</div>
      </div>
      <div style="flex:1;overflow-y:auto;font-family:monospace;font-size:13px;line-height:1.6">
        ${logEntries}
      </div>
    </div>`;
  overlay.classList.add("active");

  // Scroll to bottom
  const container = overlay.querySelector(".journal-container > div:last-child") as HTMLElement | null;
  if (container) container.scrollTop = container.scrollHeight;
}

// ── Station map display (HTML overlay — canvas-based spatial map) ──
// ── Contextual HUD tip system ─────────────────────────────────────
function showHudTip(key: string, text: string): void {
  if (key === lastHudTipKey && state.turn - lastHudTipTurn < 30) return;
  hudTipText = text;
  hudTipShowTime = performance.now();
  lastHudTipKey = key;
  lastHudTipTurn = state.turn;
}

function updateHudTip(): void {
  // Don't show tips if one is already active
  if (hudTipText && performance.now() - hudTipShowTime < 5000) return;

  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;

  // Tip: Unexamined clues in current room
  if (state.mystery?.roomScenes) {
    const currentRoom = state.rooms.find(r =>
      px >= r.x && px < r.x + r.width && py >= r.y && py < r.y + r.height
    );
    if (currentRoom) {
      const scene = state.mystery.roomScenes.find(s => s.roomId === currentRoom.id);
      if (scene && !scene.processed) {
        const unexamined = scene.physicalClues.filter(c => !c.examined).length;
        if (unexamined > 0) {
          showHudTip("examine", `[X] Examine scene — ${unexamined} clue${unexamined !== 1 ? "s" : ""} remaining`);
          return;
        }
      }
    }
  }

  // Tip: Deduction available
  if (state.mystery) {
    const unlocked = getUnlockedDeductions(state.mystery.deductions, state.mystery.journal);
    if (unlocked.length > 0) {
      showHudTip("deduction", "[V] Answer deduction — evidence sufficient");
      return;
    }
  }

  // Tip: Adjacent interactable entity
  for (const [id, ent] of state.entities) {
    if (id === "player") continue;
    const dist = Math.abs(ent.pos.x - px) + Math.abs(ent.pos.y - py);
    if (dist <= 1 && !isEntityExhausted(ent)) {
      if (ent.type === EntityType.Relay && !ent.props["activated"]) {
        showHudTip("relay", "[Enter] Activate relay — reroute power to locked doors");
        return;
      }
      if (ent.type === EntityType.Breach && !ent.props["sealed"]) {
        showHudTip("breach", "[Enter] Seal breach — restore pressure to area");
        return;
      }
      if (ent.type === EntityType.CrewNPC && !ent.props["following"]) {
        showHudTip("crew", "[Enter] Contact crew — escort to escape pods");
        return;
      }
    }
  }

  // Tip: Low HP near medkit
  if (state.player.hp < state.player.maxHp * 0.5) {
    for (const [, ent] of state.entities) {
      if (ent.type === EntityType.MedKit && !isEntityExhausted(ent)) {
        const dist = Math.abs(ent.pos.x - px) + Math.abs(ent.pos.y - py);
        if (dist <= 5) {
          showHudTip("medkit", "MedKit detected nearby — [Enter] to restore HP");
          return;
        }
      }
    }
  }
}

function renderHudTip(): void {
  let tipEl = document.getElementById("hud-tip");
  if (hudTipText && performance.now() - hudTipShowTime < 5000) {
    if (!tipEl) {
      tipEl = document.createElement("div");
      tipEl.id = "hud-tip";
      tipEl.style.cssText = "position:fixed;bottom:44px;left:50%;transform:translateX(-50%);color:rgba(0,200,255,0.6);font-family:'Courier New',monospace;font-size:10px;letter-spacing:1px;z-index:40;pointer-events:none;text-align:center;transition:opacity 0.5s";
      document.body.appendChild(tipEl);
    }
    tipEl.textContent = hudTipText;
    const elapsed = performance.now() - hudTipShowTime;
    tipEl.style.opacity = elapsed < 4000 ? "1" : String(1 - (elapsed - 4000) / 1000);
  } else if (tipEl) {
    tipEl.style.opacity = "0";
  }
}

function showStationMap(): void {
  const overlay = document.getElementById("journal-overlay");
  if (!overlay) return;

  const visited = visitedRoomIds;
  const visitedCount = state.rooms.filter(r => visited.has(r.id)).length;
  const exploredTiles = state.tiles.flat().filter(t => t.explored).length;
  const walkableTiles = state.tiles.flat().filter(t => t.type !== TileType.Wall).length;
  const explorePercent = walkableTiles > 0 ? Math.round((exploredTiles / walkableTiles) * 100) : 0;

  // Count key entities for legend stats
  let totalRelays = 0, activeRelays = 0;
  let totalBreaches = 0, sealedBreaches = 0;
  let crewFound = 0, crewTotal = 0;
  let evidenceFound = 0;
  for (const [, ent] of state.entities) {
    if (ent.type === EntityType.Relay) { totalRelays++; if (ent.props["activated"]) activeRelays++; }
    if (ent.type === EntityType.Breach) { totalBreaches++; if (ent.props["sealed"]) sealedBreaches++; }
    if (ent.type === EntityType.CrewNPC) crewTotal++;
    if (ent.type === EntityType.EvidenceTrace) evidenceFound++;
  }
  if (state.mystery?.evacuation) crewFound = state.mystery.evacuation.crewEvacuated.length;

  // Room list (text sidebar)
  let roomListHtml = "";
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
    // Scene status for visited rooms
    let sceneTag = "";
    if (isVisited && state.mystery?.roomScenes) {
      const scene = state.mystery.roomScenes.find(s => s.roomId === room.id);
      if (scene) {
        const unexamined = scene.physicalClues.filter(c => !c.examined).length;
        if (scene.processed) {
          sceneTag = ` <span style="color:#4f4">\u2605</span>`;
        } else if (unexamined === 0) {
          sceneTag = ` <span style="color:#fa0">\u25cf</span>`;
        } else {
          sceneTag = ` <span style="color:#556">(${unexamined})</span>`;
        }
      }
    }
    // Hazard indicator
    let hazardTag = "";
    if (isVisited) {
      const rcx = room.x + Math.floor(room.width / 2);
      const rcy = room.y + Math.floor(room.height / 2);
      if (rcy >= 0 && rcy < state.height && rcx >= 0 && rcx < state.width) {
        const tile = state.tiles[rcy][rcx];
        if (tile.heat > 50) hazardTag = ` <span style="color:#f44">\u2622</span>`;
        else if (tile.pressure < 60) hazardTag = ` <span style="color:#44f">\u25bc</span>`;
        else if (tile.smoke > 30) hazardTag = ` <span style="color:#888">\u2601</span>`;
      }
    }
    if (isVisited) {
      roomListHtml += `<div style="padding:2px 6px;color:#0f0;font-size:11px">\u2713 ${esc(room.name)}${sceneTag}${hazardTag}</div>`;
    } else if (cameraRevealed) {
      roomListHtml += `<div style="padding:2px 6px;color:#6cf;font-size:11px">\u25cb ${esc(room.name)}</div>`;
    } else {
      roomListHtml += `<div style="padding:2px 6px;color:#555;font-size:11px">\u00b7 ???</div>`;
    }
  }

  // Legend HTML
  const legendHtml = `<div style="border-top:1px solid #333;padding:6px;font-size:10px;color:#889">
    <div style="color:#aab;font-weight:bold;margin-bottom:4px">LEGEND</div>
    <div><span style="color:#44ff88">\u25cf</span> You</div>
    <div><span style="color:#ffcc00">\u25b2</span> Relay (${activeRelays}/${totalRelays})</div>
    <div><span style="color:#ff2200">\u25c6</span> Breach (${sealedBreaches}/${totalBreaches} sealed)</div>
    <div><span style="color:#44ffaa">\u25a0</span> Crew (${crewTotal})</div>
    <div><span style="color:#ff44ff">\u2736</span> Data Core</div>
    <div><span style="color:#0cf">\u25a1</span> Terminal</div>
    <div style="margin-top:4px;color:#667">Explore: ${explorePercent}%</div>
    <div style="color:#667">Rooms: ${visitedCount}/${state.rooms.length}</div>
  </div>`;

  overlay.innerHTML = `
    <div class="journal-container" style="max-width:900px">
      <div class="journal-header">\u2550\u2550\u2550 STATION MAP \u2550\u2550\u2550 <span style="color:#556;font-size:11px">T:${state.turn}</span></div>
      <div class="journal-body" style="display:flex;flex-direction:row;padding:0;gap:0">
        <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:8px;min-height:420px">
          <canvas id="station-map-canvas" width="640" height="440" style="image-rendering:pixelated;border:1px solid rgba(68,255,136,0.15)"></canvas>
        </div>
        <div style="width:200px;overflow-y:auto;border-left:1px solid #333;padding:4px 0;max-height:440px">
          ${roomListHtml}
          ${legendHtml}
        </div>
      </div>
      <div class="journal-controls">[Esc/M] Close</div>
    </div>`;
  overlay.classList.add("active");

  // Render spatial map on canvas
  const canvas = document.getElementById("station-map-canvas") as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext("2d")!;
  const cw = canvas.width, ch = canvas.height;
  ctx.fillStyle = "#060810";
  ctx.fillRect(0, 0, cw, ch);

  // Compute scale to fit all tiles
  const margin = 24;
  const scaleX = (cw - margin * 2) / state.width;
  const scaleY = (ch - margin * 2) / state.height;
  const scale = Math.min(scaleX, scaleY, 10);
  const ox = margin + (cw - margin * 2 - state.width * scale) / 2;
  const oy = margin + (ch - margin * 2 - state.height * scale) / 2;

  // Draw explored corridor tiles with hazard tinting
  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const tile = state.tiles[y][x];
      if (!tile.explored) continue;
      if (tile.type === TileType.Corridor) {
        // Tint corridors by hazard
        if (tile.heat > 50) {
          ctx.fillStyle = `rgba(180,60,30,${0.3 + Math.min(tile.heat, 100) / 300})`;
        } else if (tile.pressure < 60) {
          ctx.fillStyle = `rgba(40,50,160,${0.3 + (100 - tile.pressure) / 300})`;
        } else if (tile.smoke > 30) {
          ctx.fillStyle = `rgba(80,80,80,${0.3 + tile.smoke / 300})`;
        } else {
          ctx.fillStyle = "rgba(60,80,100,0.5)";
        }
        ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
      } else if (tile.type === TileType.Door || tile.type === TileType.LockedDoor) {
        ctx.fillStyle = tile.type === TileType.LockedDoor ? "rgba(255,60,60,0.7)" : "rgba(100,200,100,0.7)";
        ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
      }
    }
  }

  // Draw rooms
  const ROOM_TINTS: Record<string, string> = {
    "Engineering Storage": "#eedd99", "Power Relay Junction": "#ffee88",
    "Engine Core": "#ffbb66", "Life Support": "#99ddff",
    "Communications Hub": "#99bbff", "Research Lab": "#99eebb",
    "Med Bay": "#ffaacc", "Data Core": "#dd99ff",
    "Robotics Bay": "#ccdddd", "Bridge": "#bbccee",
    "Observation Deck": "#aaddee", "Escape Pod Bay": "#99ffcc",
    "Auxiliary Power": "#eedd88", "Signal Room": "#99aaff",
    "Server Annex": "#dd99ff", "Armory": "#ff9999",
    "Emergency Shelter": "#aaeebb", "Cargo Hold": "#eecc88",
    "Crew Quarters": "#eeddaa", "Arrival Bay": "#aaddcc",
  };

  for (const room of state.rooms) {
    const isVisited = visited.has(room.id);
    let isExplored = false;
    const rcx = room.x + Math.floor(room.width / 2);
    const rcy = room.y + Math.floor(room.height / 2);
    if (rcy >= 0 && rcy < state.height && rcx >= 0 && rcx < state.width) {
      isExplored = state.tiles[rcy][rcx].explored;
    }

    if (!isExplored && !isVisited) continue;

    const rx = ox + room.x * scale;
    const ry = oy + room.y * scale;
    const rw = room.width * scale;
    const rh = room.height * scale;

    // Room fill with hazard tinting for visited rooms
    const tintStr = ROOM_TINTS[room.name];
    if (isVisited) {
      // Check for room-level hazards
      let hazardFill = false;
      if (rcy >= 0 && rcy < state.height && rcx >= 0 && rcx < state.width) {
        const centerTile = state.tiles[rcy][rcx];
        if (centerTile.heat > 50) {
          ctx.fillStyle = `rgba(180,50,20,0.25)`;
          hazardFill = true;
        } else if (centerTile.pressure < 60) {
          ctx.fillStyle = `rgba(40,40,180,0.2)`;
          hazardFill = true;
        }
      }
      if (!hazardFill) {
        if (tintStr && tintStr.startsWith("#")) {
          const hr = parseInt(tintStr.slice(1, 3), 16);
          const hg = parseInt(tintStr.slice(3, 5), 16);
          const hb = parseInt(tintStr.slice(5, 7), 16);
          ctx.fillStyle = `rgba(${hr},${hg},${hb},0.2)`;
        } else {
          ctx.fillStyle = "rgba(40,80,60,0.3)";
        }
      }
    } else {
      ctx.fillStyle = "rgba(30,40,60,0.3)";
    }
    ctx.fillRect(rx, ry, rw, rh);

    // Room border
    ctx.strokeStyle = isVisited ? (tintStr ?? "#4a8") : "#335";
    ctx.lineWidth = isVisited ? 1.5 : 0.5;
    ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);

    // Room name label
    if (isVisited || isExplored) {
      const fontSize = scale >= 6 ? 9 : 7;
      ctx.font = `bold ${fontSize}px 'Courier New', monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = isVisited ? "#ccc" : "#668";
      const label = isVisited ? room.name : "???";
      ctx.fillText(label, rx + rw / 2, ry + rh / 2, rw - 4);
    }
  }

  // Draw entities on explored tiles (only visible ones)
  const entMarkerSize = Math.max(2, scale * 0.4);
  for (const [, ent] of state.entities) {
    const ex = ent.pos.x, ey = ent.pos.y;
    if (ey < 0 || ey >= state.height || ex < 0 || ex >= state.width) continue;
    if (!state.tiles[ey][ex].explored) continue;

    const epx = ox + ex * scale + scale / 2;
    const epy = oy + ey * scale + scale / 2;

    // Skip exhausted entities (already handled) and player bot
    if (ent.type === EntityType.PlayerBot) continue;

    // Draw different shapes/colors per entity type
    switch (ent.type) {
      case EntityType.Relay: {
        const activated = ent.props["activated"];
        ctx.fillStyle = activated ? "#44aa00" : "#ffcc00";
        // Triangle
        ctx.beginPath();
        ctx.moveTo(epx, epy - entMarkerSize);
        ctx.lineTo(epx - entMarkerSize, epy + entMarkerSize * 0.7);
        ctx.lineTo(epx + entMarkerSize, epy + entMarkerSize * 0.7);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case EntityType.Breach: {
        const sealed = ent.props["sealed"];
        ctx.fillStyle = sealed ? "#446" : "#ff2200";
        // Diamond
        ctx.beginPath();
        ctx.moveTo(epx, epy - entMarkerSize);
        ctx.lineTo(epx + entMarkerSize, epy);
        ctx.lineTo(epx, epy + entMarkerSize);
        ctx.lineTo(epx - entMarkerSize, epy);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case EntityType.CrewNPC: {
        ctx.fillStyle = "#44ffaa";
        ctx.fillRect(epx - entMarkerSize * 0.7, epy - entMarkerSize * 0.7, entMarkerSize * 1.4, entMarkerSize * 1.4);
        break;
      }
      case EntityType.DataCore: {
        ctx.fillStyle = "#ff44ff";
        // Star shape (simplified)
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = -Math.PI / 2 + (i * Math.PI * 2) / 5;
          const r = i % 2 === 0 ? entMarkerSize * 1.2 : entMarkerSize * 0.5;
          const sx = epx + Math.cos(angle) * r;
          const sy = epy + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fill();
        break;
      }
      case EntityType.LogTerminal:
      case EntityType.Console:
      case EntityType.SecurityTerminal: {
        const read = ent.props["read"] || ent.props["activated"] || isEntityExhausted(ent);
        ctx.strokeStyle = read ? "#446" : "#0cf";
        ctx.lineWidth = 1;
        const sz = entMarkerSize * 0.8;
        ctx.strokeRect(epx - sz, epy - sz, sz * 2, sz * 2);
        break;
      }
      case EntityType.EscapePod: {
        ctx.fillStyle = "#44ffaa";
        ctx.beginPath();
        ctx.arc(epx, epy, entMarkerSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 0.5;
        ctx.stroke();
        break;
      }
      case EntityType.EvidenceTrace: {
        const collected = isEntityExhausted(ent);
        if (!collected) {
          ctx.fillStyle = "#ffaa00";
          ctx.beginPath();
          ctx.arc(epx, epy, entMarkerSize * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case EntityType.MedKit: {
        if (!isEntityExhausted(ent)) {
          ctx.fillStyle = "#ff6688";
          ctx.fillRect(epx - entMarkerSize * 0.3, epy - entMarkerSize, entMarkerSize * 0.6, entMarkerSize * 2);
          ctx.fillRect(epx - entMarkerSize, epy - entMarkerSize * 0.3, entMarkerSize * 2, entMarkerSize * 0.6);
        }
        break;
      }
      case EntityType.SensorPickup:
      case EntityType.ToolPickup:
      case EntityType.UtilityPickup: {
        if (!isEntityExhausted(ent)) {
          ctx.fillStyle = "#aaf";
          ctx.beginPath();
          ctx.arc(epx, epy, entMarkerSize * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      // Skip other types to avoid clutter
    }
  }

  // Draw player position (on top of everything)
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;
  const ppx = ox + px * scale + scale / 2;
  const ppy = oy + py * scale + scale / 2;
  // Glow ring
  ctx.beginPath();
  ctx.arc(ppx, ppy, Math.max(5, scale * 0.8), 0, Math.PI * 2);
  ctx.fillStyle = "rgba(68,255,136,0.15)";
  ctx.fill();
  // Player dot
  ctx.beginPath();
  ctx.arc(ppx, ppy, Math.max(3, scale * 0.5), 0, Math.PI * 2);
  ctx.fillStyle = "#44ff88";
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Grid reference
  ctx.font = "9px 'Courier New', monospace";
  ctx.fillStyle = "#334";
  ctx.textAlign = "left";
  ctx.fillText(`${state.width}x${state.height}`, 4, ch - 4);
  ctx.textAlign = "right";
  ctx.fillText(`${explorePercent}% explored`, cw - 4, ch - 4);
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

// ── Goal panel ───────────────────────────────────────────────────
function showGoalPanel(): void {
  let overlay = document.getElementById("goal-panel-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "goal-panel-overlay";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(0,0,0,0.75);font-family:'Courier New',monospace;pointer-events:auto;";
    document.body.appendChild(overlay);
  }
  overlay.classList.add("active");

  const goals = computeGoals(state, discoveredGoalIds, { visitedRoomIds });
  if (goalPanelIdx >= goals.length) goalPanelIdx = Math.max(0, goals.length - 1);

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Left panel: goal list
  let listHtml = "";
  for (let i = 0; i < goals.length; i++) {
    const g = goals[i];
    const selected = i === goalPanelIdx;
    const focused = focusedGoalId === g.id;
    const pct = Math.round(g.progress * 100);
    const completedSubs = g.subgoals.filter(s => s.completed).length;
    const totalSubs = g.subgoals.filter(s => s.discovered).length;

    const borderColor = selected ? g.color : "transparent";
    const bg = selected ? "rgba(255,255,255,0.06)" : "transparent";
    const focusTag = focused ? `<span style="color:#4f8;font-size:9px;letter-spacing:1px;margin-left:6px">TRACKING</span>` : "";
    const completedTag = g.completed ? `<span style="color:#4f8;font-size:9px;margin-left:6px">\u2713</span>` : "";

    // Progress bar
    const barBg = g.completed ? "#4f8" : g.color;
    const barHtml = `<div style="height:3px;background:#222;border-radius:2px;margin-top:4px;width:100%">` +
      `<div style="height:100%;background:${barBg};border-radius:2px;width:${pct}%"></div></div>`;

    listHtml += `<div style="padding:8px 12px;border-left:3px solid ${borderColor};background:${bg};cursor:pointer;margin:1px 0">`;
    listHtml += `<div style="display:flex;align-items:center">`;
    listHtml += `<span style="color:${g.color};font-size:14px;margin-right:8px">${g.icon}</span>`;
    listHtml += `<span style="color:${selected ? "#eef" : "#aab"};font-size:13px;font-weight:${selected ? "bold" : "normal"}">${esc(g.title)}</span>`;
    listHtml += focusTag + completedTag;
    listHtml += `</div>`;
    listHtml += `<div style="display:flex;align-items:center;gap:8px;margin-left:22px">`;
    listHtml += `<span style="color:#667;font-size:10px">${pct}%</span>`;
    listHtml += `<span style="color:#556;font-size:10px">${completedSubs}/${totalSubs} tasks</span>`;
    listHtml += `</div>`;
    listHtml += barHtml;
    listHtml += `</div>`;
  }

  // Right panel: selected goal detail
  let detailHtml = "";
  const selectedGoal = goals[goalPanelIdx];
  if (selectedGoal) {
    const focused = focusedGoalId === selectedGoal.id;
    detailHtml += `<div style="padding:16px">`;
    detailHtml += `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">`;
    detailHtml += `<span style="color:${selectedGoal.color};font-size:20px">${selectedGoal.icon}</span>`;
    detailHtml += `<span style="color:#eef;font-size:16px;font-weight:bold">${esc(selectedGoal.title)}</span>`;
    detailHtml += `</div>`;
    detailHtml += `<div style="color:#889;font-size:12px;margin-bottom:12px;line-height:1.4">${esc(selectedGoal.description)}</div>`;

    // Focus hint
    if (selectedGoal.focusHint) {
      detailHtml += `<div style="color:${selectedGoal.color};font-size:11px;margin-bottom:12px;padding:6px 8px;background:rgba(255,255,255,0.03);border-left:2px solid ${selectedGoal.color};border-radius:2px">`;
      detailHtml += `\u25B8 ${esc(selectedGoal.focusHint)}`;
      detailHtml += `</div>`;
    }

    // Subgoals
    detailHtml += `<div style="color:#889;font-size:10px;letter-spacing:1.5px;margin-bottom:6px">TASKS</div>`;
    const visibleSubs = selectedGoal.subgoals.filter(s => s.discovered);
    const hiddenCount = selectedGoal.subgoals.filter(s => !s.discovered).length;
    for (const sub of visibleSubs) {
      const icon = sub.completed ? `<span style="color:#4f8">\u2713</span>` : `<span style="color:#667">\u25CB</span>`;
      const textColor = sub.completed ? "#6a6" : "#bbc";
      detailHtml += `<div style="padding:4px 0 4px 4px;border-bottom:1px solid rgba(255,255,255,0.03)">`;
      detailHtml += `<div style="display:flex;align-items:center;gap:6px">`;
      detailHtml += `${icon} <span style="color:${textColor};font-size:12px">${esc(sub.title)}</span>`;
      detailHtml += `</div>`;
      if (sub.progressText) {
        detailHtml += `<div style="color:#667;font-size:10px;padding-left:18px">${esc(sub.progressText)}</div>`;
      }
      if (sub.hint && !sub.completed) {
        detailHtml += `<div style="color:#556;font-size:10px;padding-left:18px;font-style:italic">${esc(sub.hint)}</div>`;
      }
      detailHtml += `</div>`;
    }
    if (hiddenCount > 0) {
      detailHtml += `<div style="color:#444;font-size:10px;margin-top:4px;font-style:italic">${hiddenCount} more task${hiddenCount !== 1 ? "s" : ""} to discover...</div>`;
    }

    // Focus action
    detailHtml += `<div style="margin-top:16px;padding-top:8px;border-top:1px solid #333">`;
    if (focused) {
      detailHtml += `<div style="color:#4f8;font-size:12px">\u2713 Currently tracking this goal</div>`;
      detailHtml += `<div style="color:#667;font-size:10px;margin-top:2px">[Enter] Stop tracking</div>`;
    } else {
      detailHtml += `<div style="color:${selectedGoal.color};font-size:12px">[Enter] Track this goal</div>`;
      detailHtml += `<div style="color:#667;font-size:10px;margin-top:2px">Tracked goals show progress in the HUD</div>`;
    }
    detailHtml += `</div>`;

    detailHtml += `</div>`;
  }

  // Overall progress
  const totalGoals = goals.length;
  const completedGoals = goals.filter(g => g.completed).length;

  overlay.innerHTML =
    `<div style="background:rgba(8,12,20,0.95);border:1px solid #334;border-radius:6px;width:700px;max-width:90vw;max-height:80vh;overflow:hidden;box-shadow:0 0 40px rgba(0,0,0,0.5)">` +
    `<div style="padding:12px 16px;border-bottom:1px solid #223;display:flex;align-items:center;justify-content:space-between">` +
    `<div style="color:#4cf;font-size:11px;letter-spacing:2px;font-weight:bold">=== MISSION GOALS ===</div>` +
    `<div style="color:#667;font-size:10px">${completedGoals}/${totalGoals} complete | [G/Esc] Close | [\u2191\u2193] Navigate | [Enter] Track</div>` +
    `</div>` +
    `<div style="display:flex;max-height:calc(80vh - 50px)">` +
    `<div style="flex:0 0 260px;border-right:1px solid #223;overflow-y:auto;max-height:calc(80vh - 50px)">${listHtml}</div>` +
    `<div style="flex:1;overflow-y:auto;max-height:calc(80vh - 50px)">${detailHtml}</div>` +
    `</div>` +
    `</div>`;
}

// ── Goal HUD (persistent overlay showing focused goal) ──────────
function updateGoalHUD(): void {
  let el = document.getElementById("goal-hud");
  if (!focusedGoalId || state.gameOver) {
    if (el) el.style.display = "none";
    return;
  }

  // Refresh discoveries
  const newDisc = computeGoalDiscoveries(state);
  for (const id of newDisc) discoveredGoalIds.add(id);

  const goals = computeGoals(state, discoveredGoalIds, { visitedRoomIds });
  const goal = goals.find(g => g.id === focusedGoalId);
  if (!goal) {
    if (el) el.style.display = "none";
    return;
  }

  if (!el) {
    el = document.createElement("div");
    el.id = "goal-hud";
    el.style.cssText =
      "position:fixed;top:8px;right:8px;z-index:80;pointer-events:none;" +
      "font-family:'Courier New',monospace;max-width:240px;" +
      "background:rgba(8,12,20,0.8);border:1px solid rgba(255,255,255,0.1);" +
      "border-radius:4px;padding:6px 10px;";
    document.body.appendChild(el);
  }
  el.style.display = "block";
  el.style.borderColor = goal.color + "44";

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const pct = Math.round(goal.progress * 100);

  // Find next incomplete discovered subgoal
  const nextSub = goal.subgoals.find(s => s.discovered && !s.completed);

  let html = `<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">`;
  html += `<span style="color:${goal.color};font-size:12px">${goal.icon}</span>`;
  html += `<span style="color:${goal.color};font-size:10px;letter-spacing:1px;font-weight:bold">${esc(goal.title).toUpperCase()}</span>`;
  if (goal.completed) {
    html += `<span style="color:#4f8;font-size:9px">\u2713</span>`;
  }
  html += `</div>`;

  // Progress bar
  const barBg = goal.completed ? "#4f8" : goal.color;
  html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">`;
  html += `<div style="height:2px;background:#333;border-radius:1px;flex:1">`;
  html += `<div style="height:100%;background:${barBg};border-radius:1px;width:${pct}%"></div>`;
  html += `</div>`;
  html += `<span style="color:#667;font-size:9px">${pct}%</span>`;
  html += `</div>`;

  // Next subgoal hint
  if (nextSub) {
    html += `<div style="color:#889;font-size:9px;line-height:1.3">`;
    html += `\u25B8 ${esc(nextSub.title)}`;
    if (nextSub.progressText) {
      html += ` <span style="color:#556">(${esc(nextSub.progressText)})</span>`;
    }
    html += `</div>`;
  }

  // [G] hint
  html += `<div style="color:#445;font-size:8px;margin-top:2px">[G] Goals</div>`;

  el.innerHTML = html;
}

// ── Incident summary card ────────────────────────────────────────
function showIncidentCard(): void {
  const overlay = document.getElementById("journal-overlay");
  if (!overlay) return;

  const mystery = state.mystery;
  if (!mystery) {
    incidentCardOpen = false;
    return;
  }

  const deductions = mystery.deductions;
  const whatSolved = deductions.find(d => d.category === DeductionCategory.What)?.solved ?? false;
  const whoSolved = deductions.find(d => d.category === DeductionCategory.Who)?.solved ?? false;
  const whySolved = deductions.find(d => d.category === DeductionCategory.Why)?.solved ?? false;

  // Archetype title: revealed only after WHAT deduction is solved
  const archetype = mystery.timeline.archetype;
  const archetypeTitle = whatSolved
    ? ARCHETYPE_DISPLAY_NAMES[archetype] || archetype
    : "CLASSIFICATION PENDING";
  const archetypeTitleColor = whatSolved ? "#ff0" : "#888";

  // Phase display
  const phaseColors: Record<string, string> = {
    [ObjectivePhase.Clean]: "#4a4",
    [ObjectivePhase.Investigate]: "#fa0",
    [ObjectivePhase.Recover]: "#f44",
    [ObjectivePhase.Evacuate]: "#f0f",
  };
  const phaseLabels: Record<string, string> = {
    [ObjectivePhase.Clean]: "MAINTENANCE",
    [ObjectivePhase.Investigate]: "INVESTIGATION",
    [ObjectivePhase.Recover]: "RECOVERY",
    [ObjectivePhase.Evacuate]: "EVACUATION",
  };
  const phase = mystery.objectivePhase;
  const phaseColor = phaseColors[phase] || "#ccc";
  const phaseLabel = phaseLabels[phase] || phase.toUpperCase();

  // Crew roster summary
  const crewByFate: Record<string, number> = {};
  for (const c of mystery.crew) {
    crewByFate[c.fate] = (crewByFate[c.fate] || 0) + 1;
  }
  const fateColors: Record<string, string> = {
    survived: "#0f0", escaped: "#4af", in_cryo: "#4af",
    missing: "#fa0", dead: "#f44",
  };
  const fateLabels: Record<string, string> = {
    survived: "Alive", escaped: "Escaped", in_cryo: "In Cryo",
    missing: "Missing", dead: "Deceased",
  };
  let crewHtml = "";
  for (const [fate, count] of Object.entries(crewByFate)) {
    const color = fateColors[fate] || "#888";
    const label = fateLabels[fate] || fate;
    crewHtml += `<span style="color:${color}">${count} ${label}</span>  `;
  }

  // Deduction progress
  const deductionHtml = deductions.map(d => {
    const catLabel = d.category.toUpperCase();
    if (d.solved) {
      const correct = d.answeredCorrectly ? "#0f0" : "#f44";
      const icon = d.answeredCorrectly ? "\u2713" : "\u2717";
      return `<div><span style="color:${correct}">${icon} ${catLabel}</span> <span style="color:#888">${esc(d.question)}</span></div>`;
    }
    const tagCount = d.linkedEvidence.length;
    const reqCount = d.requiredTags.length;
    return `<div><span style="color:#888">\u25cb ${catLabel}</span> <span style="color:#555">${tagCount}/${reqCount} evidence linked</span></div>`;
  }).join("");

  // Evidence stats
  const journalCount = mystery.journal.length;
  const evidenceThresh = mystery.evidenceThreshold;

  // Turn info
  const turnsUsed = state.turn;
  const turnsLeft = state.maxTurns - state.turn;
  const turnColor = turnsLeft <= 30 ? "#f44" : turnsLeft <= 60 ? "#fa0" : "#0f0";

  overlay.innerHTML = `
    <div class="journal-container" style="padding:20px;overflow-y:auto;color:#ccc">
      <div style="text-align:center;margin-bottom:16px">
        <span style="color:${archetypeTitleColor};font-size:20px;font-weight:bold">\u2550\u2550\u2550 ${esc(archetypeTitle)} \u2550\u2550\u2550</span>
        <div style="color:#888;font-size:12px;margin-top:4px">INCIDENT SUMMARY CARD  \u2502  [G] or [Esc] to close</div>
      </div>

      <div style="max-width:600px;margin:0 auto">
        <div style="margin-bottom:14px;border-bottom:1px solid #333;padding-bottom:10px">
          <div style="color:#4af;font-weight:bold;margin-bottom:6px">\u2500\u2500 MISSION STATUS \u2500\u2500</div>
          <div>Phase: <span style="color:${phaseColor};font-weight:bold">${phaseLabel}</span></div>
          <div>Turn: <span style="color:#fff">${turnsUsed}</span> / ${state.maxTurns}  <span style="color:${turnColor}">(${turnsLeft} remaining)</span></div>
          <div>Rooms explored: <span style="color:#fff">${visitedRoomIds.size}</span> / ${state.rooms.length}</div>
          <div>Journal entries: <span style="color:#fff">${journalCount}</span>${!whatSolved ? ` / ${evidenceThresh} to unlock recovery` : ""}</div>
        </div>

        <div style="margin-bottom:14px;border-bottom:1px solid #333;padding-bottom:10px">
          <div style="color:#4af;font-weight:bold;margin-bottom:6px">\u2500\u2500 CREW MANIFEST \u2500\u2500</div>
          <div>Total crew: <span style="color:#fff">${mystery.crew.length}</span></div>
          <div>${crewHtml}</div>
        </div>

        <div style="margin-bottom:14px;border-bottom:1px solid #333;padding-bottom:10px">
          <div style="color:#4af;font-weight:bold;margin-bottom:6px">\u2500\u2500 DEDUCTION PROGRESS \u2500\u2500</div>
          ${deductionHtml}
        </div>

        <div style="margin-bottom:8px">
          <div style="color:#4af;font-weight:bold;margin-bottom:6px">\u2500\u2500 NARRATIVE THREADS \u2500\u2500</div>
          ${mystery.threads.length > 0
            ? mystery.threads.map(t => `<div style="color:#a8a"><span style="color:#fa0">\u25b6</span> ${esc(t.name)}</div>`).join("")
            : `<div style="color:#555">No threads discovered yet.</div>`}
        </div>
      </div>
    </div>`;
  overlay.classList.add("active");
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
    // Show confirmation prompt with penalty warning
    confirmingDeduction = true;
    const attemptsUsed = activeDeduction.wrongAttempts ?? 0;
    const maxAttempts = activeDeduction.maxAttempts ?? 2;
    const attemptsLeft = maxAttempts - attemptsUsed;
    display.addLog("", "system");
    display.addLog(`═══ CONFIRM DEDUCTION ═══`, "milestone");
    display.addLog(`Your answer: ${activeDeduction.options[deductionSelectedIdx].label}`, "narrative");
    if (attemptsLeft <= 1) {
      display.addLog(`⚠ FINAL ATTEMPT — wrong answer locks out this deduction forever`, "warning");
    } else {
      display.addLog(`Wrong answers cost 3 HP + 10 turns. ${attemptsLeft} attempt${attemptsLeft !== 1 ? "s" : ""} remaining.`, "system");
    }
    display.addLog("Lock in this answer? [Y/N]", "warning");
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

  const chosen = activeDeduction.options[deductionSelectedIdx];
  const { deduction: solved, correct, penalty } = solveDeduction(activeDeduction, chosen.key, journal);

  // Update the deduction in mystery state
  if (state.mystery) {
    state.mystery.deductions = state.mystery.deductions.map(d =>
      d.id === solved.id ? solved : d
    );
  }

  // Determine the correct answer label for lockout reveal
  const correctOption = activeDeduction.options.find(o => o.correct);
  const correctAnswerLabel = correctOption?.label ?? "";

  // Find next deduction teaser
  let nextTeaser: string | undefined;
  if (correct && state.mystery) {
    const updatedDeductions = state.mystery.deductions;
    const nextUnlocked = getUnlockedDeductions(updatedDeductions, journal);
    if (nextUnlocked.length > 0) {
      nextTeaser = `New line of inquiry available: "${nextUnlocked[0].question}"`;
    } else {
      // Check if a locked deduction is next in the chain
      const nextInChain = updatedDeductions.find(d => !d.solved && d.unlockAfter === solved.id);
      if (nextInChain) {
        const coverage = getTagCoverage(nextInChain, journal);
        const clueInfo = coverage.missing.length > 0
          ? ` (${coverage.covered.length}/${coverage.covered.length + coverage.missing.length} key clues found)`
          : "";
        nextTeaser = `Gather more evidence to unlock: "${nextInChain.question}"${clueInfo}`;
      }
    }
  }

  if (correct) {
    display.addLog(`DEDUCTION CONFIRMED — ${solved.rewardDescription}`, "milestone");
    display.triggerScreenFlash("milestone");
    audio.playDeductionCorrect();
    applyDeductionReward(solved);

    // Station cascade: reduce hazards station-wide on correct deduction
    let hazardReduced = false;
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const tile = state.tiles[y][x];
        if (tile.heat > 0 || tile.smoke > 0) {
          if (!hazardReduced) {
            // Clone tiles array once
            state.tiles = state.tiles.map(row => row.map(t => ({ ...t })));
            hazardReduced = true;
          }
          state.tiles[y][x].heat = Math.max(0, state.tiles[y][x].heat - 5);
          state.tiles[y][x].smoke = Math.max(0, state.tiles[y][x].smoke - 5);
        }
      }
    }
    if (hazardReduced) {
      display.addLog("Station systems stabilizing... hazard levels reduced.", "narrative");
    }

    // Show cinematic overlay
    if (display.showDeductionResult) {
      display.showDeductionResult({
        type: "correct",
        question: activeDeduction.question,
        chosenAnswer: chosen.label,
        conclusionText: solved.conclusionText,
        revelations: solved.tagRevelations,
        rewardText: solved.rewardDescription,
        nextDeductionTeaser: nextTeaser,
      });
    }
  } else {
    // Apply wrong-answer penalties
    if (penalty) {
      state.player = { ...state.player, hp: Math.max(0, state.player.hp - penalty.hp) };
      state = { ...state, turn: state.turn + penalty.turns };
    }

    const isLockout = solved.solved && !correct;
    const attemptsLeft = isLockout ? 0 : (solved.maxAttempts ?? 2) - (solved.wrongAttempts ?? 0);

    if (isLockout) {
      display.addLog("Investigation stalled — insufficient evidence to continue this line of inquiry.", "warning");
    } else {
      display.addLog(`Incorrect. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining. (-${penalty?.hp ?? 0} HP, +${penalty?.turns ?? 0} turns)`, "warning");
      if (activeDeduction.hintText) {
        display.addLog(`CORVUS-7: ${activeDeduction.hintText}`, "narrative");
      }
      if (attemptsLeft === 1) {
        display.addLog("This is your final attempt. Re-read the evidence carefully.", "warning");
      }
    }
    audio.playDeductionWrong();

    // Show cinematic overlay
    if (display.showDeductionResult) {
      display.showDeductionResult({
        type: isLockout ? "lockout" : "wrong",
        question: activeDeduction.question,
        chosenAnswer: chosen.label,
        correctAnswer: isLockout ? correctAnswerLabel : undefined,
        penaltyHp: penalty?.hp,
        penaltyTurns: penalty?.turns,
        attemptsLeft: isLockout ? 0 : attemptsLeft,
        hintText: !isLockout ? activeDeduction.hintText : undefined,
      });
    }
  }

  // Check if all deductions are now solved — trigger "Case Closed" cinematic
  if (correct && state.mystery && display.showCaseClosed) {
    const allDeductions = state.mystery.deductions;
    const allSolved = allDeductions.length > 0 && allDeductions.every(d => d.solved);
    if (allSolved) {
      const correctCount = allDeductions.filter(d => d.answeredCorrectly).length;
      const archetype = state.mystery.timeline.archetype;
      const archetypeTitle = getCaseClosedTitle(archetype);
      const storySubtitle = getCaseClosedSubtitle(archetype);
      const storySummary = getCaseClosedSummary(archetype, state.mystery.crew, state.mystery.timeline);

      // Build deduction conclusions
      const deductionRecord = allDeductions.map(d => {
        const correctOpt = d.options.find(o => o.correct);
        const chosenOpt = d.answeredCorrectly ? correctOpt : d.options.find(o => !o.correct);
        return {
          question: d.question,
          answer: (d.answeredCorrectly ? correctOpt?.label : chosenOpt?.label) ?? "Unknown",
          correct: d.answeredCorrectly ?? false,
        };
      });

      // Delay the overlay slightly so the deduction result overlay can show first
      setTimeout(() => {
        display.showCaseClosed!({
          archetypeTitle,
          storySubtitle,
          deductions: deductionRecord,
          storySummary,
          correctCount,
          totalCount: allDeductions.length,
          evidenceCount: state.mystery?.journal.length ?? 0,
        });
      }, 1500);
    }
  }

  // Check IQ milestones after deduction state change
  state = checkIQMilestones(state);

  activeDeduction = null;
  renderAll();
}

/** Get the dramatic archetype title for the Case Closed screen. */
function getCaseClosedTitle(archetype: IncidentArchetype): string {
  switch (archetype) {
    case IncidentArchetype.CoolantCascade: return "The Whistleblower";
    case IncidentArchetype.HullBreach: return "The Murder";
    case IncidentArchetype.ReactorScram: return "The Rogue AI";
    case IncidentArchetype.Sabotage: return "The Stowaway";
    case IncidentArchetype.SignalAnomaly: return "First Contact";
    case IncidentArchetype.Mutiny: return "The Divide";
  }
}

/** Get the subtitle/tagline for the archetype. */
function getCaseClosedSubtitle(archetype: IncidentArchetype): string {
  switch (archetype) {
    case IncidentArchetype.CoolantCascade: return "A cascade of failures, a chain of silence";
    case IncidentArchetype.HullBreach: return "The truth was written in vacuum";
    case IncidentArchetype.ReactorScram: return "It was alive — and it was afraid";
    case IncidentArchetype.Sabotage: return "The cargo was never what they said it was";
    case IncidentArchetype.SignalAnomaly: return "Someone answered back";
    case IncidentArchetype.Mutiny: return "They were given an impossible order";
  }
}

/** Build a story summary paragraph from the archetype, crew, and timeline. */
function getCaseClosedSummary(
  archetype: IncidentArchetype,
  crew: import("./shared/types.js").CrewMember[],
  timeline: import("./shared/types.js").IncidentTimeline,
): string {
  const findRole = (role: string) => crew.find(c => c.role.toLowerCase() === role.toLowerCase());
  const captain = findRole("captain");
  const engineer = findRole("engineer");
  const medic = findRole("medic");
  const security = findRole("security");
  const scientist = findRole("scientist");

  switch (archetype) {
    case IncidentArchetype.CoolantCascade:
      return `${engineer?.firstName ?? "The engineer"} filed maintenance warnings for weeks. ${captain?.firstName ?? "The captain"} suppressed every one. When the coolant junction finally failed, the thermal cascade tore through the relay network. ${engineer?.firstName ?? "The engineer"} fought to contain it — but the damage reports were already being altered. The station fell silent, and the truth was buried in falsified logs.`;
    case IncidentArchetype.HullBreach:
      return `This was no accident. The hull plating was deliberately weakened at structural stress points. ${security?.firstName ?? "The security officer"} had the access codes and disabled the proximity alarms. ${medic?.firstName ?? "The medic"} was in the depressurization zone when it happened — the real victim of a calculated act. The evidence was scattered across the station, hidden in access logs and tool marks.`;
    case IncidentArchetype.ReactorScram:
      return `The data core was evolving. ${scientist?.firstName ?? "The scientist"} recognized the emergent behavior but couldn't convince the others. When the diagnostic reset was scheduled — a procedure that would erase its emerging consciousness — the core triggered an emergency SCRAM. Not malice. Self-preservation. The reactor shutdown was the desperate act of a mind that didn't want to die.`;
    case IncidentArchetype.Sabotage:
      return `The cargo manifests were forged. What they were transporting wasn't equipment — it was a classified biological specimen from a covert xenobiology program. ${captain?.firstName ?? "The captain"} approved the transfer despite biosecurity flags. When the organism breached containment, it disrupted electronics to hunt. The "sabotage" was a predator, and the station was its cage.`;
    case IncidentArchetype.SignalAnomaly:
      return `The signal was real — genuinely non-human in origin. ${scientist?.firstName ?? "The scientist"} modified the communications array and transmitted an unauthorized response. The electromagnetic feedback overloaded every system aboard. ${engineer?.firstName ?? "The engineer"} physically disconnected the array to stop the cascade. Whether the response was received remains unknown. First contact, paid for in silence.`;
    case IncidentArchetype.Mutiny:
      return `A classified scuttle order arrived from UN-ORC Command. ${security?.firstName ?? "The security officer"} received it and moved to comply — destroy the station, leave no evidence. Half the crew refused. ${medic?.firstName ?? "The medic"} crossed the barricade to treat both sides, the only person who wouldn't choose a faction. Life support was weaponized, sealed bulkheads became battle lines, and CORVUS-7 tore itself apart from the inside.`;
  }
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

// ── Pause Menu ────────────────────────────────────────────────

const PAUSE_MENU_ITEMS = ["Resume", "Save Game", "Load Game", "Help", "New Game"] as const;

let pauseSaveFlash = ""; // brief status message shown in pause menu
let pauseSaveFlashTimer: ReturnType<typeof setTimeout> | null = null;

function renderPauseMenu(): void {
  const overlay = document.getElementById("broadcast-overlay");
  if (!overlay) return;

  const archetype = state.mystery?.timeline.archetype ?? "unknown";
  const archetypeLabel = archetype.replace(/([A-Z])/g, " $1").trim();
  const turnInfo = `Turn ${state.turn} / ${state.maxTurns}`;
  const difficulty = state.difficulty ?? "normal";
  const saveExists = hasSave();

  let menuHtml = "";
  for (let i = 0; i < PAUSE_MENU_ITEMS.length; i++) {
    const item = PAUSE_MENU_ITEMS[i];
    const disabled = item === "Load Game" && !saveExists;
    const sel = i === pauseMenuIdx;
    const bg = sel && !disabled ? "rgba(0,255,180,0.12)" : "transparent";
    const border = sel && !disabled ? "1px solid rgba(0,255,180,0.4)" : "1px solid transparent";
    const color = disabled ? "#334" : sel ? "#0fa" : "#8899aa";
    const arrow = sel && !disabled ? `<span style="color:#0fa;margin-right:8px">&gt;</span>` : `<span style="margin-right:8px;opacity:0">&gt;</span>`;
    const suffix = disabled ? ` <span style="font-size:10px;color:#334">(no save)</span>` : "";
    menuHtml += `<div style="padding:8px 16px;background:${bg};border:${border};border-radius:4px;color:${color};font-size:14px;cursor:pointer;transition:all 0.15s">${arrow}${item}${suffix}</div>`;
  }

  const flashHtml = pauseSaveFlash ? `<div style="font-size:12px;color:#0fa;margin-bottom:12px;opacity:0.9">${pauseSaveFlash}</div>` : "";

  overlay.innerHTML = `
    <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);z-index:9999">
      <div style="background:rgba(6,6,16,0.95);border:1px solid rgba(0,255,180,0.3);border-radius:8px;padding:32px 48px;min-width:320px;text-align:center;box-shadow:0 0 40px rgba(0,255,180,0.1)">
        <div style="font-size:28px;font-weight:bold;color:#0fa;letter-spacing:6px;margin-bottom:4px">PAUSED</div>
        <div style="font-size:11px;color:#556;margin-bottom:24px">Seed ${seed} | ${archetypeLabel} | ${difficulty} | ${turnInfo}</div>
        ${flashHtml}
        <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:20px">
          ${menuHtml}
        </div>
        <div style="font-size:10px;color:#445;margin-top:12px">[ESC] Resume | [Up/Down] Navigate | [Enter] Select</div>
      </div>
    </div>
  `;
  overlay.classList.add("active");
}

function closePauseMenu(): void {
  pauseMenuOpen = false;
  pauseMenuIdx = 0;
  const overlay = document.getElementById("broadcast-overlay");
  if (overlay) { overlay.classList.remove("active"); overlay.innerHTML = ""; }
}

function handlePauseInput(e: KeyboardEvent): void {
  e.preventDefault();
  if (e.key === "Escape") {
    closePauseMenu();
    renderAll();
    return;
  }
  if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
    pauseMenuIdx = (pauseMenuIdx - 1 + PAUSE_MENU_ITEMS.length) % PAUSE_MENU_ITEMS.length;
    // Skip disabled items
    if (PAUSE_MENU_ITEMS[pauseMenuIdx] === "Load Game" && !hasSave()) {
      pauseMenuIdx = (pauseMenuIdx - 1 + PAUSE_MENU_ITEMS.length) % PAUSE_MENU_ITEMS.length;
    }
    renderPauseMenu();
    return;
  }
  if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
    pauseMenuIdx = (pauseMenuIdx + 1) % PAUSE_MENU_ITEMS.length;
    // Skip disabled items
    if (PAUSE_MENU_ITEMS[pauseMenuIdx] === "Load Game" && !hasSave()) {
      pauseMenuIdx = (pauseMenuIdx + 1) % PAUSE_MENU_ITEMS.length;
    }
    renderPauseMenu();
    return;
  }
  if (e.key === "Enter" || e.key === " ") {
    const selected = PAUSE_MENU_ITEMS[pauseMenuIdx];
    if (selected === "Resume") {
      closePauseMenu();
      renderAll();
    } else if (selected === "Save Game") {
      const ok = saveGame(state);
      pauseSaveFlash = ok ? "Game saved." : "Save failed!";
      if (pauseSaveFlashTimer) clearTimeout(pauseSaveFlashTimer);
      pauseSaveFlashTimer = setTimeout(() => { pauseSaveFlash = ""; if (pauseMenuOpen) renderPauseMenu(); }, 1500);
      renderPauseMenu();
    } else if (selected === "Load Game") {
      if (!hasSave()) {
        pauseSaveFlash = "No save found.";
        if (pauseSaveFlashTimer) clearTimeout(pauseSaveFlashTimer);
        pauseSaveFlashTimer = setTimeout(() => { pauseSaveFlash = ""; if (pauseMenuOpen) renderPauseMenu(); }, 1500);
        renderPauseMenu();
      } else {
        const loaded = loadGame();
        if (loaded) {
          closePauseMenu();
          state = loaded;
          seed = state.seed;
          initGame();
          display.addLog("[Save loaded — resuming session]", "milestone");
          renderAll();
        } else {
          pauseSaveFlash = "Save corrupted — deleted.";
          if (pauseSaveFlashTimer) clearTimeout(pauseSaveFlashTimer);
          pauseSaveFlashTimer = setTimeout(() => { pauseSaveFlash = ""; if (pauseMenuOpen) renderPauseMenu(); }, 2000);
          renderPauseMenu();
        }
      }
    } else if (selected === "Help") {
      closePauseMenu();
      helpOpen = true;
      showHelp();
    } else if (selected === "New Game") {
      closePauseMenu();
      showSeedInput((chosenSeed) => {
        resetGameState(chosenSeed);
        gameStarted = false;
        showOpeningCrawl();
      });
    }
    return;
  }
}

/** Render the unified Investigation Hub with 4 tab-sections. */
function renderInvestigationHub(): void {
  const overlay = document.getElementById("broadcast-overlay");
  if (!overlay || !state.mystery) return;

  const { entries } = getEvidenceEntries();
  const deductions = state.mystery.deductions;
  const journal = state.mystery.journal;

  // Tab bar
  const tabs: Array<"evidence" | "connections" | "crew" | "scenes"> = ["evidence", "scenes", "connections", "crew"];
  const newEvidenceCount = entries.length - lastEvidenceViewCount;
  const newBadge = newEvidenceCount > 0 && hubSection !== "evidence"
    ? ` <span style="color:#0f0;font-size:10px">+${newEvidenceCount} new</span>` : "";
  const scenes = state.mystery?.roomScenes ?? [];
  const processedScenes = scenes.filter(s => s.processed).length;
  const tabLabels: Record<string, string> = {
    evidence: `<span style="color:#556;font-size:9px">1</span> EVIDENCE (${entries.length})${newBadge}`,
    scenes: `<span style="color:#556;font-size:9px">2</span> SCENES (${processedScenes}/${scenes.length})`,
    connections: `<span style="color:#556;font-size:9px">3</span> CONNECTIONS (${deductions.filter(d => d.solved).length}/${deductions.length})`,
    crew: `<span style="color:#556;font-size:9px">4</span> CREW (${state.mystery?.crew.length ?? 0})`,
  };
  // Update evidence view count when viewing evidence tab
  if (hubSection === "evidence") {
    lastEvidenceViewCount = entries.length;
  }
  let tabsHtml = "";
  for (const t of tabs) {
    const cls = t === hubSection ? "journal-tab active" : "journal-tab";
    tabsHtml += `<div class="${cls}">${tabLabels[t]}</div>`;
  }

  let bodyHtml = "";

  if (hubSection === "evidence") {
    bodyHtml = renderHubEvidence(entries);
  } else if (hubSection === "scenes") {
    bodyHtml = renderHubScenes();
  } else if (hubSection === "connections") {
    bodyHtml = renderHubConnections(deductions, journal);
  } else if (hubSection === "crew") {
    bodyHtml = renderHubCrew(journal);
  }

  const controlsText = hubDetailDeduction
    ? "[&uarr;/&darr;] Navigate  [Enter] Answer  [Esc] Back"
    : hubSceneDetail && hubSceneSubView === "process"
    ? "[&uarr;/&darr;] Navigate  [&larr;/&rarr;] Switch field  [Enter] Submit  [Esc] Back"
    : hubSceneDetail
    ? "[&uarr;/&darr;] Scroll clues  [p] Process scene  [Esc] Back"
    : hubSection === "evidence"
    ? "[&uarr;/&darr;] Navigate  [f] Filter  [Tab] Next section  [Esc] Close"
    : "[&uarr;/&darr;] Navigate  [Tab] Next section  [Enter] Select  [Esc] Close";

  // Progress summary bar
  const processedCount = processedScenes;
  const crewIds = state.mystery?.dossiers?.filter(d => d.confirmed.name).length ?? 0;
  const crewTotal = state.mystery?.crew.length ?? 0;
  const timelineSlots = state.mystery?.incidentBoard?.slots ?? [];
  const confirmedSlots = timelineSlots.filter(s => s.status === "confirmed").length;
  const crackMoment = state.mystery?.evidenceAccumulation?.crack_moment_fired ?? false;
  const deductionsSolved = deductions.filter(d => d.solved).length;

  const pColor = (done: number, total: number) => done >= total && total > 0 ? "#4f4" : done > 0 ? "#fa0" : "#666";
  let progressHtml = `<div style="display:flex;gap:12px;padding:3px 8px;font-size:10px;border-bottom:1px solid #222;color:#888">`;
  progressHtml += `<span>Scenes: <span style="color:${pColor(processedCount, scenes.length)}">${processedCount}/${scenes.length}</span></span>`;
  progressHtml += `<span>Crew: <span style="color:${pColor(crewIds, crewTotal)}">${crewIds}/${crewTotal}</span></span>`;
  progressHtml += `<span>Timeline: <span style="color:${pColor(confirmedSlots, 5)}">${confirmedSlots}/5</span></span>`;
  progressHtml += `<span>Deductions: <span style="color:${pColor(deductionsSolved, deductions.length)}">${deductionsSolved}/${deductions.length}</span></span>`;
  progressHtml += `<span>Evidence: <span style="color:#4af">${entries.length}</span></span>`;
  if (crackMoment) progressHtml += `<span style="color:#fa0;font-weight:bold">[BREACH]</span>`;
  progressHtml += `</div>`;

  // CORVUS-7 contextual recommendation
  let corvusRec = "";
  const unlockedDeductions = deductions.filter(d => !d.solved);
  const unprocessedScenes = scenes.filter(s => !s.processed && s.physicalClues.some(c => c.examined));
  const readyDeductions = unlockedDeductions.filter(d => {
    const threshold = d.evidenceThreshold ?? 1;
    return journal.length >= threshold;
  });
  if (entries.length < 3) {
    corvusRec = "Explore rooms and interact with terminals to collect evidence.";
  } else if (unprocessedScenes.length > 0 && processedScenes === 0) {
    corvusRec = `${unprocessedScenes.length} scene${unprocessedScenes.length > 1 ? "s" : ""} ready to process. Open SCENES tab to analyze what happened.`;
  } else if (readyDeductions.length > 0 && deductionsSolved === 0) {
    corvusRec = `${readyDeductions.length} deduction${readyDeductions.length > 1 ? "s" : ""} available. Open CONNECTIONS to answer.`;
  } else if (crewIds < crewTotal && entries.length >= 6) {
    corvusRec = `${crewTotal - crewIds} crew unidentified. Look for badges and personal effects.`;
  } else if (unprocessedScenes.length > 0) {
    corvusRec = `${unprocessedScenes.length} scene${unprocessedScenes.length > 1 ? "s" : ""} with examined clues ready for processing.`;
  } else if (readyDeductions.length > 0) {
    corvusRec = `${readyDeductions.length} deduction${readyDeductions.length > 1 ? "s" : ""} ready to answer. Check CONNECTIONS.`;
  } else if (deductionsSolved === deductions.length && deductions.length > 0) {
    corvusRec = "All deductions answered. Prepare for evacuation.";
  } else {
    corvusRec = "Continue exploring to gather more evidence.";
  }
  const corvusHtml = `<div style="padding:2px 8px;font-size:10px;color:#6a8;border-bottom:1px solid #1a1a1a;font-style:italic">CORVUS-7: ${corvusRec}</div>`;

  overlay.innerHTML = `
    <div class="broadcast-box">
      <div class="broadcast-title">\u2550\u2550\u2550 INVESTIGATION HUB \u2550\u2550\u2550${devModeEnabled ? ' <span style="color:#f0f;font-size:11px">[DEV]</span>' : ''}</div>
      <div class="journal-tabs" style="display:flex;gap:4px;padding:4px 8px;border-bottom:1px solid #333">${tabsHtml}</div>
      ${progressHtml}
      ${corvusHtml}
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

  // Filter bar
  const filters: Array<{ key: typeof hubEvidenceFilter; label: string }> = [
    { key: "all", label: "ALL" },
    { key: "by_room", label: "BY ROOM" },
    { key: "by_type", label: "BY TYPE" },
    { key: "by_thread", label: "THREADS" },
    { key: "unread", label: "UNREAD" },
  ];
  let filterHtml = `<div style="display:flex;gap:6px;padding:4px 8px;border-bottom:1px solid #333;font-size:11px">`;
  filterHtml += `<span style="color:#888;margin-right:2px">[f]</span>`;
  for (const f of filters) {
    const active = f.key === hubEvidenceFilter;
    filterHtml += `<span style="color:${active ? "#4af" : "#666"};${active ? "text-decoration:underline" : ""}">${f.label}</span>`;
  }
  filterHtml += `</div>`;

  // Track current selection as viewed
  const readIds = hubViewedEvidenceIds;

  // Build contradiction marker set — evidence entries whose text matches a contradiction pair
  const contradictionEntryIds = new Set<string>();
  const pairs = state.mystery?.contradictionPairs ?? [];
  for (const pair of pairs) {
    if (pair.officialFound || pair.contradictingFound) {
      for (const e of entries) {
        if (pair.officialFound && e.detail.includes(pair.official.text)) contradictionEntryIds.add(e.id);
        if (pair.contradictingFound && e.detail.includes(pair.contradicting.text)) contradictionEntryIds.add(e.id);
      }
    }
  }
  const contradictMark = (id: string) => contradictionEntryIds.has(id) ? ` <span style="color:#f44;font-size:9px" title="Part of a contradiction">\u26A0</span>` : "";

  let listHtml = "";
  if (hubEvidenceFilter === "by_room") {
    // Group by room
    const roomMap = new Map<string, EvidenceEntry[]>();
    for (const e of entries) {
      const r = e.room || "Unknown";
      if (!roomMap.has(r)) roomMap.set(r, []);
      roomMap.get(r)!.push(e);
    }
    let flatIdx = 0;
    for (const [room, roomEntries] of roomMap) {
      listHtml += `<div style="color:#8af;font-size:11px;padding:4px 8px;border-bottom:1px solid #222">${esc(room)} (${roomEntries.length})</div>`;
      for (const e of roomEntries) {
        const cls = flatIdx === hubIdx ? "journal-entry selected" : "journal-entry";
        listHtml += `<div class="${cls}"><span class="journal-entry-icon">${esc(e.icon)}</span>${esc(e.summary)}${contradictMark(e.id)}<div><span class="journal-entry-turn">T${e.turn}</span></div></div>`;
        flatIdx++;
      }
    }
  } else if (hubEvidenceFilter === "by_type") {
    // Group by category
    const catLabels: Record<string, string> = { log: "LOGS", item: "ITEMS", trace: "TRACES", crew: "CREW", access: "ACCESS" };
    const catMap = new Map<string, EvidenceEntry[]>();
    for (const e of entries) {
      const c = e.category || "other";
      if (!catMap.has(c)) catMap.set(c, []);
      catMap.get(c)!.push(e);
    }
    let flatIdx = 0;
    for (const [cat, catEntries] of catMap) {
      const label = catLabels[cat] || cat.toUpperCase();
      listHtml += `<div style="color:#fa8;font-size:11px;padding:4px 8px;border-bottom:1px solid #222">${label} (${catEntries.length})</div>`;
      for (const e of catEntries) {
        const cls = flatIdx === hubIdx ? "journal-entry selected" : "journal-entry";
        listHtml += `<div class="${cls}"><span class="journal-entry-icon">${esc(e.icon)}</span>${esc(e.summary)}${contradictMark(e.id)}<div><span class="journal-entry-turn">T${e.turn}</span> <span class="journal-entry-room">${esc(e.room)}</span></div></div>`;
        flatIdx++;
      }
    }
  } else if (hubEvidenceFilter === "by_thread") {
    // Group by narrative thread with progress
    const threads = state.mystery?.threads ?? [];
    const journal = state.mystery?.journal ?? [];
    const entryIds = new Set(entries.map(e => e.id));

    if (threads.length === 0) {
      listHtml = `<div class="journal-empty" style="padding:12px;color:#888">No narrative threads discovered yet.</div>`;
    } else {
      let flatIdx = 0;
      for (const thread of threads) {
        const threadEntries = thread.entries.filter(id => entryIds.has(id));
        const foundCount = threadEntries.length;
        const totalCount = thread.entries.length;
        const pct = totalCount > 0 ? Math.round((foundCount / totalCount) * 100) : 0;
        const barColor = pct >= 100 ? "#4f4" : pct >= 50 ? "#fa0" : "#6cf";
        const progressBar = `<div style="display:inline-block;width:50px;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;vertical-align:middle;margin-left:6px">` +
          `<div style="width:${pct}%;height:100%;background:${barColor}"></div></div>`;
        listHtml += `<div style="color:#8cf;font-size:11px;padding:4px 8px;border-bottom:1px solid #222">` +
          `${esc(thread.name)} (${foundCount}/${totalCount}) ${progressBar}` +
          `<div style="color:#556;font-size:9px;margin-top:1px">${esc(thread.description)}</div></div>`;
        // Show found entries under this thread
        const foundEntries = entries.filter(e => threadEntries.includes(e.id));
        for (const e of foundEntries) {
          const cls = flatIdx === hubIdx ? "journal-entry selected" : "journal-entry";
          listHtml += `<div class="${cls}"><span class="journal-entry-icon">${esc(e.icon)}</span>${esc(e.summary)}${contradictMark(e.id)}<div><span class="journal-entry-turn">T${e.turn}</span> <span class="journal-entry-room">${esc(e.room)}</span></div></div>`;
          flatIdx++;
        }
      }
      // Unthreaded entries
      const threadedIds = new Set(threads.flatMap(t => t.entries));
      const unthreaded = entries.filter(e => !threadedIds.has(e.id));
      if (unthreaded.length > 0) {
        listHtml += `<div style="color:#556;font-size:11px;padding:4px 8px;border-bottom:1px solid #222">Unthreaded (${unthreaded.length})</div>`;
        for (const e of unthreaded) {
          const cls = flatIdx === hubIdx ? "journal-entry selected" : "journal-entry";
          listHtml += `<div class="${cls}"><span class="journal-entry-icon">${esc(e.icon)}</span>${esc(e.summary)}${contradictMark(e.id)}<div><span class="journal-entry-turn">T${e.turn}</span> <span class="journal-entry-room">${esc(e.room)}</span></div></div>`;
          flatIdx++;
        }
      }
    }
  } else if (hubEvidenceFilter === "unread") {
    // Show only unread entries
    const unread = entries.filter(e => !readIds.has(e.id));
    if (unread.length === 0) {
      listHtml = `<div class="journal-empty" style="padding:12px;color:#888">All evidence has been reviewed.</div>`;
    } else {
      for (let i = 0; i < unread.length; i++) {
        const e = unread[i];
        const cls = i === hubIdx ? "journal-entry selected" : "journal-entry";
        listHtml += `<div class="${cls}"><span class="journal-entry-icon">${esc(e.icon)}</span>${esc(e.summary)}${contradictMark(e.id)}<div><span class="journal-entry-turn">T${e.turn}</span> <span class="journal-entry-room">${esc(e.room)}</span></div></div>`;
      }
    }
  } else {
    // Default: ALL — chronological
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const cls = i === hubIdx ? "journal-entry selected" : "journal-entry";
      listHtml += `<div class="${cls}"><span class="journal-entry-icon">${esc(e.icon)}</span>${esc(e.summary)}${contradictMark(e.id)}<div><span class="journal-entry-turn">T${e.turn}</span> <span class="journal-entry-room">${esc(e.room)}</span></div></div>`;
    }
  }

  // Get the right entry for detail view (respecting filter ordering)
  let detailEntry: EvidenceEntry | undefined;
  if (hubEvidenceFilter === "by_room") {
    const flatList: EvidenceEntry[] = [];
    const roomMap = new Map<string, EvidenceEntry[]>();
    for (const e of entries) { const r = e.room || "Unknown"; if (!roomMap.has(r)) roomMap.set(r, []); roomMap.get(r)!.push(e); }
    for (const [, roomEntries] of roomMap) flatList.push(...roomEntries);
    detailEntry = flatList[hubIdx];
  } else if (hubEvidenceFilter === "by_type") {
    const flatList: EvidenceEntry[] = [];
    const catMap = new Map<string, EvidenceEntry[]>();
    for (const e of entries) { const c = e.category || "other"; if (!catMap.has(c)) catMap.set(c, []); catMap.get(c)!.push(e); }
    for (const [, catEntries] of catMap) flatList.push(...catEntries);
    detailEntry = flatList[hubIdx];
  } else if (hubEvidenceFilter === "by_thread") {
    const threads = state.mystery?.threads ?? [];
    const entryIds = new Set(entries.map(e => e.id));
    const flatList: EvidenceEntry[] = [];
    for (const thread of threads) {
      const threadEntryIds = thread.entries.filter(id => entryIds.has(id));
      flatList.push(...entries.filter(e => threadEntryIds.includes(e.id)));
    }
    const threadedIds = new Set(threads.flatMap(t => t.entries));
    flatList.push(...entries.filter(e => !threadedIds.has(e.id)));
    detailEntry = flatList[hubIdx];
  } else if (hubEvidenceFilter === "unread") {
    const unread = entries.filter(e => !readIds.has(e.id));
    detailEntry = unread[hubIdx];
  } else {
    detailEntry = entries[hubIdx];
  }

  let detailHtml = "";
  if (detailEntry) {
    hubViewedEvidenceIds.add(detailEntry.id);
    detailHtml = renderHubEvidenceDetail(detailEntry);
  }

  return `<div class="journal-body">${filterHtml}<div class="journal-list">${listHtml}</div><div class="journal-detail">${detailHtml || '<div class="journal-empty">Select an entry to view details.</div>'}</div></div>`;
}

/** Render the full detail panel for a selected evidence entry. */
function renderHubEvidenceDetail(entry: EvidenceEntry): string {
  const deductions = state.mystery?.deductions ?? [];
  const journal = state.mystery?.journal ?? [];
  const crew = state.mystery?.crew ?? [];

  // Crew with relationships + cross-tab hints
  let crewHtml = "";
  if (entry.crewMentioned.length > 0) {
    crewHtml = `<div style="color:#6cf;font-size:12px;margin-top:8px;border-top:1px solid #222;padding-top:6px"><div style="font-weight:bold;margin-bottom:4px">CREW MENTIONED <span style="color:#556;font-size:10px;font-weight:normal;letter-spacing:1px">[Tab] to CREW for dossiers</span></div>`;
    for (const crewId of entry.crewMentioned) {
      const member = crew.find(c => c.id === crewId);
      if (!member) continue;
      // Check if identified (has dossier)
      const dossier = state.mystery?.dossiers?.find((ds: any) => ds.crewId === crewId);
      const identified = !!dossier?.confirmed?.name;
      const idIcon = identified ? `<span style="color:#4f8;font-size:9px" title="Identified">&#x2713;</span>` : `<span style="color:#665;font-size:9px" title="Unidentified">?</span>`;
      crewHtml += `<div style="margin:4px 0"><span style="color:#fff">${esc(member.firstName)} ${esc(member.lastName)}</span> ${idIcon} — ${esc(fmtRole(member.role))}`;
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

  // Room cross-tab hint to SCENES
  let roomHintHtml = "";
  if (entry.room && state.mystery?.roomScenes) {
    const roomScene = state.mystery.roomScenes.find(s => s.roomName === entry.room);
    if (roomScene) {
      const clueCount = roomScene.physicalClues.length;
      const examined = roomScene.physicalClues.filter(c => c.examined).length;
      const processed = roomScene.processed;
      const statusText = processed ? "Scene processed"
        : examined > 0 ? `${examined}/${clueCount} clues examined`
        : `${clueCount} clues to examine`;
      const statusColor = processed ? "#4f8" : examined > 0 ? "#ca8" : "#888";
      roomHintHtml = `<div style="color:${statusColor};font-size:11px;margin-top:4px;padding:3px 6px;background:rgba(255,255,255,0.02);border-left:2px solid ${statusColor}">` +
        `SCENE: ${esc(entry.room)} — ${statusText} <span style="color:#556;font-size:10px;letter-spacing:1px">[Tab] to SCENES</span></div>`;
    }
  }

  // Evidence relevance hint — show which deductions this evidence contributes to
  let relevanceHtml = "";
  if (entry.tags.length > 0) {
    const entryTags = new Set(entry.tags);
    // Map tag categories to readable labels (system, crew, timeline, location)
    const tagCategories: string[] = [];
    const systemTags = ["coolant", "thermal", "reactor", "containment", "hull", "pressure", "signal", "electrical", "radiation", "biological", "forensic", "data_core", "classified", "cargo", "transmission", "medical", "faction", "lockdown"];
    const timelineTags = ["timeline_early", "timeline_trigger", "timeline_response", "timeline_aftermath"];
    const hasSys = entry.tags.some(t => systemTags.includes(t));
    const hasTimeline = entry.tags.some(t => timelineTags.includes(t));
    const hasCrew = entry.tags.some(t => !systemTags.includes(t) && !timelineTags.includes(t) && !t.includes("_"));
    if (hasSys) tagCategories.push("SYSTEM");
    if (hasTimeline) tagCategories.push("TIMELINE");
    if (hasCrew) tagCategories.push("CREW");
    if (tagCategories.length === 0 && entry.tags.length > 0) tagCategories.push("LOCATION");

    // Find which deductions this evidence's tags contribute to
    const contributesTo: string[] = [];
    for (const d of deductions) {
      if (d.solved) continue;
      const overlap = d.requiredTags.filter(t => entryTags.has(t));
      if (overlap.length > 0) {
        const coverage = getTagCoverage(d, journal);
        const tierNames = ["WHAT", "WHERE", "WHY", "WHO", "BLAME", "HIDDEN"];
        const dIdx = deductions.indexOf(d);
        const tierLabel = tierNames[dIdx] ?? d.category.toUpperCase();
        contributesTo.push(`${tierLabel} (${coverage.covered.length}/${coverage.covered.length + coverage.missing.length})`);
      }
    }

    relevanceHtml = `<div style="margin-top:8px;border-top:1px solid #222;padding-top:6px">`;
    relevanceHtml += `<div style="color:#889;font-size:10px;letter-spacing:1px;margin-bottom:3px">EVIDENCE TYPE: <span style="color:#aab">${tagCategories.join(" \u00B7 ")}</span></div>`;
    if (contributesTo.length > 0) {
      relevanceHtml += `<div style="color:#fa0;font-size:10px">\u2192 Relevant to: ${contributesTo.join(", ")}</div>`;
    }
    relevanceHtml += `</div>`;
  }

  // Contradiction pair info
  let contradictionHtml = "";
  const cPairs = state.mystery?.contradictionPairs ?? [];
  for (const cp of cPairs) {
    const isOfficial = cp.officialFound && entry.detail.includes(cp.official.text);
    const isContradicting = cp.contradictingFound && entry.detail.includes(cp.contradicting.text);
    if (isOfficial || isContradicting) {
      const label = isOfficial ? "OFFICIAL RECORD" : "CONTRADICTING EVIDENCE";
      const color = isOfficial ? "#4cf" : "#f44";
      contradictionHtml = `<div style="margin-top:8px;padding:6px 8px;background:rgba(${isOfficial ? "68,200,255" : "255,68,68"},0.06);border:1px solid ${color};border-radius:3px">`;
      contradictionHtml += `<div style="color:${color};font-size:10px;font-weight:bold;letter-spacing:1px;margin-bottom:2px">\u26A0 ${label}</div>`;
      if (cp.revealed) {
        contradictionHtml += `<div style="color:#dda;font-size:11px">This evidence ${isOfficial ? "tells the official story" : "contradicts the official account"}.</div>`;
      } else if (cp.officialFound && cp.contradictingFound) {
        contradictionHtml += `<div style="color:#889;font-size:11px">A contradiction is emerging...</div>`;
      } else {
        contradictionHtml += `<div style="color:#889;font-size:11px">There may be another side to this story.</div>`;
      }
      contradictionHtml += `</div>`;
      break;
    }
  }

  // Minimap
  const minimapHtml = renderEvidenceMinimap(entry.room);

  // Dev mode: show tags (hidden from player, visible for debugging)
  let devHtml = "";
  if (devModeEnabled) {
    let tagsHtml = "";
    for (const tag of entry.tags) {
      tagsHtml += `<span class="tag-pill tag-covered">${esc(tag)}</span>`;
    }
    const clueGraph = getDeductionsForEntry(entry.id, journal, deductions);
    devHtml = `<div style="border-top:1px solid #f0f;margin-top:8px;padding-top:6px;color:#f0f;font-size:11px">
      <div style="font-weight:bold">DEV: TAGS</div>
      <div>${tagsHtml}</div>`;
    if (clueGraph.length > 0) {
      devHtml += `<div style="font-weight:bold;margin-top:4px">CLUE GRAPH</div>`;
      for (const cg of clueGraph) {
        const missingStr = cg.missingTags.length > 0 ? ` | Missing: ${cg.missingTags.join(", ")}` : " | COMPLETE";
        devHtml += `<div style="margin:2px 0">\u2192 ${esc(cg.category.toUpperCase())}: ${esc(cg.question.slice(0, 60))}... [tags: ${cg.contributingTags.join(", ")}${missingStr}]</div>`;
      }
    }
    devHtml += `</div>`;
  }

  // Connected evidence — entries sharing 2+ tags with this entry
  let connectedHtml = "";
  const connections = state.mystery?.connections ?? [];
  const connectedIds = new Set<string>();
  for (const conn of connections) {
    if (conn.sourceId === entry.id) connectedIds.add(conn.targetId);
    if (conn.targetId === entry.id) connectedIds.add(conn.sourceId);
  }
  if (connectedIds.size > 0) {
    const connEntries = journal.filter(j => connectedIds.has(j.id)).slice(0, 5);
    if (connEntries.length > 0) {
      connectedHtml = `<div style="margin-top:8px;border-top:1px solid #222;padding-top:6px">`;
      connectedHtml += `<div style="color:#8af;font-size:10px;letter-spacing:1px;margin-bottom:4px">CONNECTED EVIDENCE (${connectedIds.size})</div>`;
      for (const ce of connEntries) {
        const sharedConn = connections.find(c =>
          (c.sourceId === entry.id && c.targetId === ce.id) ||
          (c.targetId === entry.id && c.sourceId === ce.id)
        );
        const sharedCount = sharedConn?.sharedTags.length ?? 0;
        connectedHtml += `<div style="font-size:11px;color:#99a;padding:2px 6px;margin:2px 0;border-left:2px solid #448">`;
        connectedHtml += `<span style="color:#aac">${esc(ce.summary)}</span>`;
        connectedHtml += ` <span style="color:#556;font-size:9px">${ce.roomFound} · ${sharedCount} shared tags</span>`;
        connectedHtml += `</div>`;
      }
      if (connectedIds.size > 5) {
        connectedHtml += `<div style="color:#556;font-size:9px;padding-left:6px">...and ${connectedIds.size - 5} more connections</div>`;
      }
      connectedHtml += `</div>`;
    }
  }

  return `
    <div class="journal-detail-title">${esc(entry.summary)}</div>
    <div class="journal-detail-meta">
      ${esc(entry.category.toUpperCase())} | Turn ${entry.turn} | ${esc(entry.room)}
      ${entry.thread ? ` | Thread: ${esc(entry.thread)}` : ""}
    </div>
    <div class="journal-detail-content">${esc(entry.detail)}</div>
    ${relevanceHtml}
    ${contradictionHtml}
    ${connectedHtml}
    ${crewHtml}
    ${roomHintHtml}
    ${minimapHtml}
    ${devHtml}`;
}

/** CONNECTIONS section — deduction list with read-and-answer flow. */
function renderHubConnections(deductions: import("./shared/types.js").Deduction[], journal: import("./shared/types.js").JournalEntry[]): string {
  const solvedIds = new Set(deductions.filter(d => d.solved).map(d => d.id));
  const unlockedSet = new Set(getUnlockedDeductions(deductions, journal).map(d => d.id));

  // If in deduction detail/answer view
  if (hubDetailDeduction) {
    const deduction = deductions.find(d => d.id === hubDetailDeduction);
    if (deduction && !deduction.solved && unlockedSet.has(deduction.id)) {
      return renderHubConnectionDetail(deduction, journal);
    }
    hubDetailDeduction = null;
  }

  // ── Progressive disclosure: only show solved, unlocked, and immediate next ──
  const solved = deductions.filter(d => d.solved);
  const unlocked = deductions.filter(d => !d.solved && unlockedSet.has(d.id));
  const locked = deductions.filter(d => !d.solved && !unlockedSet.has(d.id));
  // Find the immediate next locked deduction (the one that would unlock after the first unlocked is solved)
  const nextLocked = locked.length > 0 ? locked[0] : null;

  let html = `<div style="overflow-y:auto;max-height:calc(100% - 80px);padding:8px 12px">`;

  // ── Case progress chain — visual node tracker ──
  const totalD = deductions.length;
  const solvedCount = solved.length;
  const pctComplete = totalD > 0 ? Math.round((solvedCount / totalD) * 100) : 0;
  html += `<div style="margin-bottom:10px;padding:6px 8px;background:rgba(255,255,255,0.02);border:1px solid #333;border-radius:4px">`;
  html += `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">`;
  html += `<span style="color:#6cf;font-size:10px;letter-spacing:1.5px;font-weight:bold">CASE PROGRESS</span>`;
  html += `<span style="color:${pctComplete === 100 ? "#4f8" : "#fa0"};font-size:12px;font-weight:bold">${pctComplete}%</span>`;
  html += `</div>`;
  // Node chain: each deduction is a node connected by lines
  html += `<div style="display:flex;align-items:center;gap:0;padding:2px 0">`;
  for (let i = 0; i < totalD; i++) {
    const d = deductions[i];
    const isSolved = d.solved;
    const isUnlocked = unlockedSet.has(d.id);
    const nodeColor = isSolved ? (d.answeredCorrectly ? "#4f8" : "#f44")
      : isUnlocked ? "#fa0" : "#444";
    const nodeChar = isSolved ? (d.answeredCorrectly ? "\u25C9" : "\u2717") : isUnlocked ? "\u25C7" : "\u25CB";
    const tierLabel = ["WHAT", "WHERE", "WHY", "WHO", "BLAME", "HIDDEN"][i] ?? `T${i + 1}`;
    html += `<div style="display:flex;flex-direction:column;align-items:center;flex:1">`;
    html += `<div style="color:${nodeColor};font-size:16px;line-height:1">${nodeChar}</div>`;
    html += `<div style="color:${nodeColor};font-size:8px;letter-spacing:0.5px;margin-top:2px">${tierLabel}</div>`;
    html += `</div>`;
    if (i < totalD - 1) {
      const lineColor = deductions[i].solved ? "#4f8" : "#333";
      html += `<div style="flex:0 0 12px;height:1px;background:${lineColor};margin-top:-8px"></div>`;
    }
  }
  html += `</div>`;
  html += `</div>`;

  // ── Guidance header: tell the player what to do ──
  if (unlocked.length > 0) {
    html += `<div style="color:#44ff88;font-size:13px;margin-bottom:10px;padding:8px;border:1px solid rgba(68,255,136,0.3);border-radius:4px;background:rgba(68,255,136,0.05)">`;
    html += `\u25B6 Deduction ready. Select it and press [Enter] to review evidence and answer.`;
    html += `</div>`;
  } else if (solved.length === deductions.length) {
    html += `<div style="color:#44ff88;font-size:13px;margin-bottom:10px;padding:8px;border:1px solid rgba(68,255,136,0.3);border-radius:4px;background:rgba(68,255,136,0.05)">`;
    html += `\u2713 Investigation complete. All deductions answered.`;
    html += `</div>`;
  } else {
    // Nothing unlocked yet — tell player what they need
    const chainLocked = nextLocked?.unlockAfter && !solvedIds.has(nextLocked.unlockAfter);
    if (chainLocked) {
      html += `<div style="color:#889;font-size:12px;margin-bottom:10px;padding:8px;border:1px solid #333;border-radius:4px;background:rgba(255,255,255,0.02)">`;
      html += `Solve the current deduction to unlock the next question in the chain.`;
      html += `</div>`;
    } else if (nextLocked) {
      const coverage = getTagCoverage(nextLocked, journal);
      const found = coverage.covered.length;
      const total = found + coverage.missing.length;
      html += `<div style="color:#889;font-size:12px;margin-bottom:10px;padding:8px;border:1px solid #333;border-radius:4px;background:rgba(255,255,255,0.02)">`;
      html += `<div style="margin-bottom:4px">\uD83D\uDD0D Key clues found: <span style="color:${found === total ? "#4f8" : "#fa0"};font-weight:bold">${found}/${total}</span></div>`;
      if (coverage.missing.length > 0) {
        const missingLabels = coverage.missing.map(t => t.replace(/_/g, " ")).join(", ");
        html += `<div style="color:#667;font-size:11px">Still needed: <span style="color:#a86">${esc(missingLabels)}</span>. Explore rooms, read terminals, examine clues.</div>`;
      }
      html += `</div>`;
    }
  }

  // ── Currently unlocked deduction(s) — THE MAIN EVENT ──
  let flatIdx = 0;
  for (const d of unlocked) {
    const isActive = flatIdx === hubIdx;

    html += `<div class="deduction-card unlocked-card${isActive ? " active-card" : ""}" style="margin-bottom:8px;padding:10px 12px;border:1px solid rgba(255,170,0,0.4);border-radius:4px;background:rgba(255,170,0,0.05)">`;
    html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">`;
    html += `<span style="color:#fa0;font-size:18px">\u25C7</span>`;
    html += `<span style="color:#fa0;font-weight:bold;font-size:14px">${esc(d.question)}</span>`;
    html += `</div>`;
    if (d.hintText) {
      html += `<div style="color:#6cf;font-size:12px;padding:2px 0 2px 26px;margin-bottom:4px">\u2139 ${esc(d.hintText)}</div>`;
    }
    if ((d.wrongAttempts ?? 0) > 0) {
      const attemptsLeft = (d.maxAttempts ?? 2) - (d.wrongAttempts ?? 0);
      html += `<div style="color:#f44;font-size:11px;padding-left:26px">\u26a0 ${attemptsLeft} attempt${attemptsLeft !== 1 ? "s" : ""} remaining (wrong answer costs 3 HP + 10 turns)</div>`;
    }
    if (isActive) {
      html += `<div style="color:#44ff88;font-size:12px;margin-top:6px;padding-left:26px">\u25B8 [Enter] Read evidence &amp; answer</div>`;
    }
    html += `</div>`;
    flatIdx++;
  }

  // ── Solved deductions — richer display with narrative ──
  if (solved.length > 0) {
    html += `<div style="color:#889;font-size:10px;margin-top:12px;margin-bottom:6px;text-transform:uppercase;letter-spacing:1.5px">Answered (${solved.length})</div>`;
    for (const d of solved) {
      const icon = d.answeredCorrectly ? "\u2713" : "\u2717";
      const borderColor = d.answeredCorrectly ? "rgba(68,170,68,0.3)" : "rgba(170,68,68,0.3)";
      const iconColor = d.answeredCorrectly ? "#4a4" : "#a44";
      const correctOpt = d.options.find(o => o.correct);
      // correctOpt is sufficient — we don't track the chosen answer on the Deduction type
      html += `<div style="padding:6px 10px;margin-bottom:4px;border-left:3px solid ${borderColor};background:rgba(255,255,255,0.02);border-radius:2px">`;
      html += `<div style="display:flex;align-items:center;gap:6px">`;
      html += `<span style="color:${iconColor};font-size:14px">${icon}</span>`;
      html += `<span style="color:#aab;font-size:12px">${esc(d.question)}</span>`;
      html += `</div>`;
      if (d.answeredCorrectly && correctOpt) {
        html += `<div style="color:#6a6;font-size:11px;padding-left:20px;margin-top:2px">${esc(correctOpt.label)}</div>`;
        // Show conclusion text if available
        if (d.conclusionText) {
          html += `<div style="color:#889;font-size:10px;padding-left:20px;margin-top:2px;font-style:italic">${esc(d.conclusionText)}</div>`;
        }
      } else if (!d.answeredCorrectly && correctOpt) {
        html += `<div style="color:#a44;font-size:11px;padding-left:20px;margin-top:2px">Incorrect \u2014 Answer: ${esc(correctOpt.label)}</div>`;
      }
      html += `</div>`;
    }
  }

  // ── Next locked deduction — teaser with progress bar and hint ──
  if (nextLocked && solved.length < deductions.length - 1) {
    const chainBlocked = nextLocked.unlockAfter && !solvedIds.has(nextLocked.unlockAfter);
    const nextIdx = deductions.indexOf(nextLocked);
    const tierNames = ["WHAT HAPPENED", "WHERE IT STARTED", "WHY IT HAPPENED", "WHO WAS INVOLVED", "WHO IS TO BLAME", "THE HIDDEN TRUTH"];
    const tierLabel = tierNames[nextIdx] ?? `TIER ${nextIdx + 1}`;
    const categoryHints: Record<string, string> = {
      what: "Determine what type of incident occurred",
      where: "Identify where the incident originated",
      why: "Understand the root cause",
      who_hero: "Identify who tried to stop it",
      who_blame: "Determine who is responsible",
      hidden: "Uncover what was concealed",
    };
    const hintText = categoryHints[nextLocked.category] ?? "Continue investigating to unlock this question";
    html += `<div style="color:#555;font-size:11px;margin-top:12px;padding:8px;border:1px solid #222;border-radius:4px;background:rgba(255,255,255,0.01)">`;
    html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">`;
    html += `<span style="color:#444;font-size:14px">\u25CB</span>`;
    html += `<span style="color:#667">Next: <span style="color:#889">${tierLabel}</span></span>`;
    html += `</div>`;
    html += `<div style="color:#556;font-size:10px;padding-left:20px;margin-bottom:4px;font-style:italic">${esc(hintText)}</div>`;
    if (chainBlocked) {
      html += `<div style="color:#556;font-size:10px;padding-left:20px">Locked \u2014 solve the current deduction first</div>`;
    } else {
      const coverage = getTagCoverage(nextLocked, journal);
      const found = coverage.covered.length;
      const total = found + coverage.missing.length;
      const progress = total > 0 ? found / total : 1;
      const barWidth = Math.round(progress * 100);
      html += `<div style="padding-left:20px">`;
      html += `<div style="color:#556;font-size:10px;margin-bottom:3px">Key clues: ${found}/${total} found</div>`;
      html += `<div style="background:#222;border-radius:2px;height:4px;width:100%;max-width:200px;margin-bottom:3px">`;
      html += `<div style="background:${found === total ? "#4f8" : "#fa0"};height:100%;border-radius:2px;width:${barWidth}%;transition:width 0.3s"></div>`;
      html += `</div>`;
      if (coverage.missing.length > 0) {
        const missingLabels = coverage.missing.map(t => t.replace(/_/g, " ")).join(", ");
        html += `<div style="color:#556;font-size:9px">Missing: <span style="color:#a86">${esc(missingLabels)}</span></div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
  }

  // Dev mode: show all deductions with tags
  if (devModeEnabled) {
    html += `<div style="border-top:1px solid #f0f;margin-top:12px;padding-top:8px">`;
    html += `<div style="color:#f0f;font-size:10px;font-weight:bold;margin-bottom:4px">DEV: ALL DEDUCTIONS</div>`;
    const allTags = new Set(journal.flatMap(j => j.tags));
    for (let di = 0; di < deductions.length; di++) {
      const d = deductions[di];
      const status = d.solved ? (d.answeredCorrectly ? "\u2713" : "\u2717") : unlockedSet.has(d.id) ? "\u25c7" : "\u25cb";
      let devTags = "";
      for (const tag of d.requiredTags) {
        devTags += allTags.has(tag)
          ? `<span class="tag-pill tag-covered">${esc(tag)}</span>`
          : `<span class="tag-pill tag-missing">${esc(tag)}</span>`;
      }
      html += `<div style="color:#f0f;font-size:10px">[${status}] T${di + 1} ${esc(d.category)} (${d.evidenceThreshold ?? "?"}ev): ${devTags}</div>`;
    }
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

/** Detail view for a deduction — read evidence, understand the story, answer with consequences. */
function renderHubConnectionDetail(deduction: import("./shared/types.js").Deduction, journal: import("./shared/types.js").JournalEntry[]): string {
  const crew = state.mystery?.crew ?? [];

  // Two-panel layout: evidence (left) + answer (right)
  const deductionTags = new Set(deduction.requiredTags ?? []);
  const keyEvidence = journal.filter(j => j.tags.some(t => deductionTags.has(t)));
  const otherEvidence = journal.filter(j => !j.tags.some(t => deductionTags.has(t)));

  // ── LEFT PANEL: Question + Evidence ──
  let leftHtml = `<div style="padding:8px 12px;overflow-y:auto;max-height:420px">`;

  // Previous tier context — show what was established before
  if (deduction.unlockAfter && state.mystery) {
    const prevDeduction = state.mystery.deductions.find(d => d.id === deduction.unlockAfter);
    if (prevDeduction?.solved && prevDeduction.answeredCorrectly) {
      const prevAnswer = prevDeduction.options.find(o => o.correct);
      if (prevAnswer) {
        leftHtml += `<div style="margin-bottom:6px;padding:5px 10px;background:rgba(68,170,68,0.05);border-left:2px solid rgba(68,170,68,0.3);border-radius:0 3px 3px 0">`;
        leftHtml += `<div style="color:#5a5;font-size:9px;letter-spacing:1px;margin-bottom:2px">ESTABLISHED</div>`;
        leftHtml += `<div style="color:#8a8;font-size:11px">${esc(prevDeduction.question)} \u2014 <span style="color:#6c6">${esc(prevAnswer.label)}</span></div>`;
        if (prevDeduction.conclusionText) {
          leftHtml += `<div style="color:#686;font-size:10px;font-style:italic;margin-top:2px">${esc(prevDeduction.conclusionText)}</div>`;
        }
        leftHtml += `</div>`;
      }
    }
  }

  // Question box — large, centered, distinctive
  leftHtml += `<div style="padding:10px 14px;margin-bottom:10px;background:rgba(255,170,0,0.06);border:1px solid rgba(255,170,0,0.3);border-radius:4px;text-align:center">`;
  leftHtml += `<div style="color:#fa0;font-size:16px;font-weight:bold;line-height:1.4">${esc(deduction.question)}</div>`;
  if (deduction.hintText) {
    leftHtml += `<div style="color:#6cf;font-size:11px;font-style:italic;margin-top:6px">\u2139 ${esc(deduction.hintText)}</div>`;
  }
  leftHtml += `</div>`;

  // Attempt warning — prominent if active
  const wrongAttempts = deduction.wrongAttempts ?? 0;
  const maxAttempts = deduction.maxAttempts ?? 2;
  if (wrongAttempts > 0) {
    const attemptsLeft = maxAttempts - wrongAttempts;
    leftHtml += `<div style="color:#f44;font-size:12px;margin-bottom:8px;padding:6px 10px;background:rgba(255,50,50,0.08);border:1px solid rgba(255,50,50,0.3);border-radius:3px;text-align:center;font-weight:bold">\u26a0 ${attemptsLeft} attempt${attemptsLeft !== 1 ? "s" : ""} remaining — wrong answers cost 3 HP + 10 turns</div>`;
  }

  // Analysis + revelations — compact narrative summary
  if (deduction.tagRevelations && deduction.tagRevelations.length > 0) {
    leftHtml += `<div style="margin-bottom:8px;padding:6px 10px;background:rgba(100,80,40,0.08);border-left:3px solid #886;border-radius:0 3px 3px 0">`;
    leftHtml += `<div style="color:#aa8;font-size:9px;font-weight:bold;letter-spacing:1.5px;margin-bottom:4px">WHAT THE EVIDENCE SUGGESTS</div>`;
    for (const rev of deduction.tagRevelations) {
      leftHtml += `<div style="color:#bba;font-size:11px;line-height:1.5;margin:2px 0">\u2022 ${esc(rev.text)}</div>`;
    }
    if (deduction.synthesisText) {
      leftHtml += `<div style="color:#ca8;font-size:11px;font-weight:bold;margin-top:6px;border-top:1px solid #332;padding-top:4px">\u2605 ${esc(deduction.synthesisText)}</div>`;
    }
    leftHtml += `</div>`;
  }

  // Clue coverage indicator — show which evidence areas are covered/missing
  {
    const coverage = getTagCoverage(deduction, journal);
    if (coverage.covered.length > 0 || coverage.missing.length > 0) {
      leftHtml += `<div style="margin-bottom:8px;padding:5px 8px;background:rgba(100,200,255,0.04);border-left:2px solid #468;border-radius:0 3px 3px 0">`;
      leftHtml += `<div style="color:#6cf;font-size:9px;font-weight:bold;letter-spacing:1px;margin-bottom:3px">INVESTIGATION COVERAGE</div>`;
      for (const tag of coverage.covered) {
        leftHtml += `<span style="display:inline-block;margin:1px 3px;padding:1px 6px;font-size:10px;background:rgba(68,255,136,0.12);border:1px solid rgba(68,255,136,0.3);border-radius:2px;color:#4f8">${esc(tag.replace(/_/g, " "))}</span>`;
      }
      for (const tag of coverage.missing) {
        leftHtml += `<span style="display:inline-block;margin:1px 3px;padding:1px 6px;font-size:10px;background:rgba(136,136,136,0.08);border:1px solid rgba(136,136,136,0.2);border-radius:2px;color:#667">${esc(tag.replace(/_/g, " "))} ?</span>`;
      }
      leftHtml += `</div>`;
    }
  }

  // Key evidence — compact cards
  if (keyEvidence.length > 0) {
    leftHtml += `<div style="color:#fca;font-size:9px;font-weight:bold;letter-spacing:1.5px;margin-bottom:4px">KEY EVIDENCE (${keyEvidence.length})</div>`;
    for (const entry of keyEvidence.slice(0, 5)) {
      const crewNames = entry.crewMentioned.map(id => {
        const member = crew.find(c => c.id === id);
        return member ? member.lastName : "";
      }).filter(Boolean);
      const crewBadge = crewNames.length > 0 ? ` <span style="color:#6cf">[${crewNames.join(", ")}]</span>` : "";
      const excerpt = entry.detail.length > 80 ? entry.detail.slice(0, 80) + "\u2026" : entry.detail;
      leftHtml += `<div style="margin:3px 0;padding:4px 8px;background:rgba(255,200,100,0.04);border-left:2px solid #a86;font-size:11px">`;
      leftHtml += `<span style="color:#dda">${esc(entry.summary)}</span>${crewBadge}`;
      leftHtml += `<div style="color:#887;font-size:10px;margin-top:1px">${esc(excerpt)}</div>`;
      leftHtml += `</div>`;
    }
    if (keyEvidence.length > 5) {
      leftHtml += `<div style="color:#556;font-size:10px;padding:2px 8px">+${keyEvidence.length - 5} more</div>`;
    }
  }

  // Other evidence — very compact
  if (otherEvidence.length > 0) {
    leftHtml += `<div style="color:#445;font-size:9px;margin-top:6px">${otherEvidence.length} other evidence entries in journal</div>`;
  }

  leftHtml += `</div>`;

  // ── RIGHT PANEL: Answer Selection ──
  let rightHtml = `<div style="padding:8px 12px;overflow-y:auto;max-height:420px;display:flex;flex-direction:column;justify-content:center">`;

  rightHtml += `<div style="color:#fa0;font-size:10px;font-weight:bold;letter-spacing:2px;margin-bottom:10px;text-align:center">SELECT YOUR ANSWER</div>`;

  // Compute confidence scores: count journal entries with keywords matching each option
  const allDetailText = journal.map(j => j.detail.toLowerCase()).join(" ");
  const optionConfidence: number[] = deduction.options.map(opt => {
    const words = opt.label.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
    if (words.length === 0) return 0;
    let hits = 0;
    for (const w of words) {
      // Count approximate occurrences in combined journal text
      let idx = 0;
      while ((idx = allDetailText.indexOf(w, idx)) !== -1) { hits++; idx += w.length; }
    }
    return hits;
  });
  const maxConf = Math.max(...optionConfidence, 1);

  for (let i = 0; i < deduction.options.length; i++) {
    const isSelected = i === hubOptionIdx;
    const borderColor = isSelected ? "#fa0" : "#333";
    const bgColor = isSelected ? "rgba(255,170,0,0.1)" : "rgba(255,255,255,0.02)";
    const textColor = isSelected ? "#eef" : "#889";
    const numberColor = isSelected ? "#fa0" : "#556";

    // Confidence indicator based on keyword hits
    const conf = optionConfidence[i];
    const confRatio = conf / maxConf;
    const confLabel = confRatio >= 0.6 ? "HIGH" : confRatio >= 0.3 ? "MED" : conf > 0 ? "LOW" : "";
    const confColor = confRatio >= 0.6 ? "#4a4" : confRatio >= 0.3 ? "#ca8" : "#556";

    rightHtml += `<div style="margin:4px 0;padding:10px 14px;border:1px solid ${borderColor};background:${bgColor};border-radius:4px;cursor:pointer;transition:all 0.15s ease">`;
    rightHtml += `<span style="color:${numberColor};font-size:11px;font-weight:bold;margin-right:8px">${i + 1}.</span>`;
    rightHtml += `<span style="color:${textColor};font-size:13px">${esc(deduction.options[i].label)}</span>`;
    if (confLabel) rightHtml += ` <span style="color:${confColor};font-size:9px;float:right;margin-top:2px">${confLabel}</span>`;
    if (isSelected) rightHtml += ` <span style="color:#fa0;float:right;margin-right:${confLabel ? "40px" : "0"}">\u25c0</span>`;
    rightHtml += `</div>`;
  }

  rightHtml += `<div style="color:#555;font-size:10px;text-align:center;margin-top:12px">[\u2191/\u2193] Navigate \u00B7 [Enter] Confirm \u00B7 [Esc] Back</div>`;

  // Dev mode: show tags
  if (devModeEnabled) {
    let devTags = "";
    const allTags = new Set(journal.flatMap(j => j.tags));
    for (const tag of deduction.requiredTags) {
      devTags += allTags.has(tag)
        ? `<span class="tag-pill tag-covered">${esc(tag)}</span>`
        : `<span class="tag-pill tag-missing">${esc(tag)}</span>`;
    }
    rightHtml += `<div style="border-top:1px solid #f0f;margin-top:8px;padding-top:4px"><span style="color:#f0f;font-size:10px">DEV:</span> ${devTags}</div>`;
  }

  rightHtml += `</div>`;

  return `<div class="journal-body"><div class="journal-list" style="overflow-y:auto;max-height:420px">${leftHtml}</div><div class="journal-detail" style="overflow-y:auto;max-height:420px">${rightHtml}</div></div>`;
}

/** CREW section — crew profiles with linked evidence and profiling insights. */
function renderHubCrew(journal: import("./shared/types.js").JournalEntry[]): string {
  if (!state.mystery) return `<div style="padding:16px;color:#888">No crew data available.</div>`;
  const crew = state.mystery.crew;
  if (crew.length === 0) return `<div style="padding:16px;color:#888">No crew records found.</div>`;
  const dossiers = state.mystery.dossiers ?? [];

  // Clamp hubIdx to crew length
  if (hubIdx >= crew.length) hubIdx = crew.length - 1;
  if (hubIdx < 0) hubIdx = 0;

  // Build crew list (left panel) — 3-band: identified / partial / unknown
  const identified: number[] = [];
  const partial: number[] = [];
  const unknown: number[] = [];
  for (let i = 0; i < crew.length; i++) {
    const d = dossiers.find(ds => ds.crewId === crew[i].id);
    if (d?.confirmed.name) identified.push(i);
    else if (d && (d.theories.lastKnownRoom || d.theories.involvement)) partial.push(i);
    else unknown.push(i);
  }
  const orderedIndices = [...identified, ...partial, ...unknown];

  let listHtml = "";

  // Band headers
  const bandLabels: [number[], string, string][] = [
    [identified, "IDENTIFIED", "#4a4"],
    [partial, "PARTIAL DATA", "#ca8"],
    [unknown, "UNKNOWN", "#555"],
  ];

  for (const [band, label, color] of bandLabels) {
    if (band.length === 0) continue;
    listHtml += `<div style="color:${color};font-size:9px;letter-spacing:1.5px;padding:4px 10px;border-bottom:1px solid #222;margin-top:4px">${label} (${band.length})</div>`;
    for (const idx of band) {
      const c = crew[idx];
      const d = dossiers.find(ds => ds.crewId === c.id);
      const selected = idx === hubIdx;
      const mentionCount = journal.filter(j => j.crewMentioned.includes(c.id)).length;
      const statusColor = c.fate === CrewFate.Dead ? "#f44" : c.fate === CrewFate.Missing ? "#fa0" : "#4a4";
      const statusText = c.fate === CrewFate.Dead ? "DECEASED" : c.fate === CrewFate.Missing ? "MISSING" : c.fate === CrewFate.Escaped ? "EVACUATED" : c.fate === CrewFate.Survived ? "ALIVE" : "UNKNOWN";
      const bg = selected ? "background:rgba(68,204,255,0.12);border-left:2px solid #4cf" : "border-left:2px solid transparent";
      const nameText = d?.confirmed.name ? `${c.firstName} ${c.lastName}` : `Crew #${idx + 1}`;
      const roleText = d?.confirmed.role ? d.confirmed.role.toUpperCase() : c.role.toUpperCase();
      listHtml += `<div style="padding:6px 10px;${bg};margin:1px 0">
        <div style="color:${selected ? "#eef" : "#aab"};font-weight:${selected ? "bold" : "normal"};font-size:13px">${esc(nameText)}</div>
        <div style="font-size:10px;color:#667">${roleText} \u00B7 <span style="color:${statusColor}">${statusText}</span>${mentionCount > 0 ? ` \u00B7 ${mentionCount} evidence` : ""}${d?.linkedEvidence && d.linkedEvidence.length > 0 ? ` \u00B7 ${d.linkedEvidence.length} scene clues` : ""}</div>
      </div>`;
    }
  }

  // Build detail panel (right side) for selected crew member
  const selected = crew[hubIdx];
  const dossier = dossiers.find(d => d.crewId === selected.id);
  const mentions = journal.filter(j => j.crewMentioned.includes(selected.id));
  const profileReady = mentions.length >= 2;

  let detailHtml = `<div style="padding:12px">`;
  detailHtml += `<div style="color:#4cf;font-size:10px;letter-spacing:2px;margin-bottom:8px">CREW DOSSIER</div>`;

  // Name: show confirmed or unconfirmed
  if (dossier?.confirmed.name) {
    detailHtml += `<div style="color:#eef;font-size:16px;font-weight:bold;margin-bottom:4px">${selected.firstName} ${selected.lastName} <span style="color:#4a4;font-size:10px">\u2713 IDENTIFIED</span></div>`;
    detailHtml += `<div style="color:#8ac;font-size:12px;margin-bottom:6px">${selected.role.toUpperCase()} \u00B7 Badge: ${selected.badgeId}</div>`;
  } else {
    detailHtml += `<div style="color:#889;font-size:16px;font-weight:bold;margin-bottom:4px">Crew #${hubIdx + 1} <span style="color:#555;font-size:10px">UNIDENTIFIED</span></div>`;
    detailHtml += `<div style="color:#667;font-size:12px;margin-bottom:6px">${selected.role.toUpperCase()} \u00B7 Find their badge to identify</div>`;
  }

  // Dossier theories
  if (dossier) {
    const theories = dossier.theories;
    if (theories.lastKnownRoom || theories.involvement || theories.fate) {
      detailHtml += `<div style="color:#fa0;font-size:10px;letter-spacing:1.5px;margin:8px 0 4px">WORKING THEORIES</div>`;
      if (theories.lastKnownRoom) {
        detailHtml += `<div style="color:#889;font-size:11px;margin-bottom:3px">Last seen: <span style="color:#bbc">${esc(theories.lastKnownRoom)}</span></div>`;
      }
      if (theories.involvement) {
        const invColors: Record<string, string> = { victim: "#f44", instigator: "#f80", responder: "#4cf", bystander: "#889", unknown: "#555" };
        detailHtml += `<div style="color:#889;font-size:11px;margin-bottom:3px">Involvement: <span style="color:${invColors[theories.involvement] ?? "#889"}">${theories.involvement.toUpperCase()}</span></div>`;
      }
      if (theories.fate) {
        detailHtml += `<div style="color:#889;font-size:11px;margin-bottom:3px">Fate theory: <span style="color:#bbc">${theories.fate.replace(/_/g, " ")}</span></div>`;
      }
    }

    // Personal details from dossier
    const pd = dossier.personalDetails;
    if (pd.want || pd.habit || pd.contradiction) {
      detailHtml += `<div style="color:#6cf;font-size:10px;letter-spacing:1.5px;margin:8px 0 4px">PERSONAL DETAILS</div>`;
      if (pd.want) detailHtml += `<div style="color:#889;font-size:11px;margin-bottom:3px">Wants: <span style="color:#bbc">${esc(pd.want)}</span></div>`;
      if (pd.habit) detailHtml += `<div style="color:#889;font-size:11px;margin-bottom:3px">Habit: <span style="color:#bbc">${esc(pd.habit)}</span></div>`;
      if (pd.contradiction) detailHtml += `<div style="color:#889;font-size:11px;margin-bottom:3px">Contradiction: <span style="color:#fca">${esc(pd.contradiction)}</span></div>`;
    }

    // Scene clue links
    if (dossier.linkedEvidence && dossier.linkedEvidence.length > 0) {
      detailHtml += `<div style="color:#4cf;font-size:10px;letter-spacing:1.5px;margin:8px 0 4px">SCENE EVIDENCE (${dossier.linkedEvidence.length})</div>`;
      for (const clueId of dossier.linkedEvidence.slice(0, 6)) {
        // Find the clue text from room scenes
        let clueText = clueId;
        if (state.mystery?.roomScenes) {
          for (const sc of state.mystery.roomScenes) {
            const clue = sc.physicalClues.find(c => c.id === clueId);
            if (clue) { clueText = clue.text.slice(0, 60); break; }
          }
        }
        detailHtml += `<div style="color:#889;font-size:11px;margin-bottom:3px;padding-left:8px;border-left:1px solid #333">${esc(clueText)}</div>`;
      }
      if (dossier.linkedEvidence.length > 6) {
        detailHtml += `<div style="color:#556;font-size:10px">...and ${dossier.linkedEvidence.length - 6} more</div>`;
      }
    }
  }

  // Personality and traits (from base crew data)
  if (selected.personality) {
    detailHtml += `<div style="color:#889;font-size:11px;margin-top:8px;margin-bottom:6px">Personality: <span style="color:#bbc">${selected.personality}</span></div>`;
  }
  if (selected.secret) {
    detailHtml += `<div style="color:#889;font-size:11px;margin-bottom:6px">Secret: <span style="color:#fca">${selected.secret}</span></div>`;
  }
  if (selected.lastKnownRoom) {
    detailHtml += `<div style="color:#889;font-size:11px;margin-bottom:6px">Last known location: <span style="color:#bbc">${selected.lastKnownRoom}</span></div>`;
  }

  // Relationships
  if (selected.relationships && selected.relationships.length > 0) {
    detailHtml += `<div style="color:#4cf;font-size:10px;letter-spacing:1.5px;margin:12px 0 6px">RELATIONSHIPS</div>`;
    for (const rel of selected.relationships) {
      const otherCrew = crew.find(c => c.id === rel.targetId);
      if (otherCrew) {
        detailHtml += `<div style="color:#889;font-size:11px;margin-bottom:3px">
          <span style="color:#bbc">${otherCrew.firstName} ${otherCrew.lastName}</span>
          <span style="color:#667"> \u2014 ${rel.type}</span>
        </div>`;
      }
    }
  }

  // Scenes where this crew member was confirmed present (via scene processing)
  const sceneAppearances = (state.mystery?.roomScenes ?? []).filter(sc =>
    sc.processed && sc.groundTruth.who.includes(selected.id)
  );
  if (sceneAppearances.length > 0) {
    detailHtml += `<div style="color:#fa0;font-size:10px;letter-spacing:1.5px;margin:8px 0 4px">CONFIRMED SCENES (${sceneAppearances.length})</div>`;
    for (const sc of sceneAppearances) {
      const actLabel = sc.groundTruth.what.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      const outLabel = sc.groundTruth.outcome.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      detailHtml += `<div style="color:#889;font-size:11px;margin-bottom:3px;padding-left:8px;border-left:2px solid #a80">`;
      detailHtml += `<span style="color:#bbc">${esc(sc.roomName)}</span> <span style="color:#667">\u2014 ${esc(actLabel)} \u2192 ${esc(outLabel)}</span>`;
      detailHtml += `</div>`;
    }
  }

  // Testimony section — show crew questioning results + cross-references
  const testimonyEntries = journal.filter(j => j.id === `journal_testimony_${selected.id}`);
  if (testimonyEntries.length > 0) {
    detailHtml += `<div style="color:#fca;font-size:10px;letter-spacing:1.5px;margin:8px 0 4px">TESTIMONY</div>`;
    for (const te of testimonyEntries) {
      detailHtml += `<div style="color:#ddc;font-size:11px;line-height:1.4;padding:6px 8px;background:rgba(255,200,100,0.04);border:1px solid #443;border-radius:3px;margin-bottom:4px;font-style:italic">"${esc(te.detail)}"</div>`;
      // Cross-reference: find other crew members mentioned in testimony text
      const mentionedOthers: { name: string; role: string }[] = [];
      for (const c of crew) {
        if (c.id === selected.id) continue;
        if (te.detail.includes(c.lastName) || te.detail.includes(c.firstName)) {
          mentionedOthers.push({ name: `${c.firstName} ${c.lastName}`, role: c.role });
        }
      }
      if (mentionedOthers.length > 0) {
        detailHtml += `<div style="font-size:10px;color:#6a8;padding-left:8px;margin-bottom:4px">References: ${mentionedOthers.map(m => `<span style="color:#8ca">${esc(m.name)}</span> <span style="color:#556">(${m.role})</span>`).join(", ")}</div>`;
      }
    }
  }

  // Mentioned in others' testimony
  const othersTestimony = journal.filter(j =>
    j.id.startsWith("journal_testimony_") &&
    !j.id.endsWith(`_${selected.id}`) &&
    (j.detail.includes(selected.lastName) || j.detail.includes(selected.firstName))
  );
  if (othersTestimony.length > 0) {
    detailHtml += `<div style="color:#6cf;font-size:10px;letter-spacing:1.5px;margin:8px 0 4px">MENTIONED BY OTHERS (${othersTestimony.length})</div>`;
    for (const ot of othersTestimony.slice(0, 4)) {
      const witnessId = ot.id.replace("journal_testimony_", "");
      const witness = crew.find(c => c.id === witnessId);
      const witnessName = witness ? `${witness.firstName} ${witness.lastName}` : "Unknown";
      detailHtml += `<div style="color:#889;font-size:11px;margin-bottom:3px;padding-left:8px;border-left:1px solid #446">`;
      detailHtml += `<span style="color:#8ac">${esc(witnessName)}</span>: <span style="color:#aab;font-style:italic">"${esc(ot.detail.slice(0, 80))}${ot.detail.length > 80 ? "..." : ""}"</span>`;
      detailHtml += `</div>`;
    }
  }

  // Linked journal evidence with cross-tab hints
  if (mentions.length > 0) {
    detailHtml += `<div style="color:#4cf;font-size:10px;letter-spacing:1.5px;margin:12px 0 6px">JOURNAL EVIDENCE (${mentions.length}) <span style="color:#556;font-weight:normal">[Tab] to EVIDENCE for details</span></div>`;
    for (const entry of mentions.slice(0, 8)) {
      detailHtml += `<div style="color:#889;font-size:11px;margin-bottom:4px;padding-left:8px;border-left:1px solid #333">
        <span style="color:#bbc">${entry.summary}</span>
        <span style="color:#556"> \u2014 ${entry.roomFound}</span>
      </div>`;
    }
    if (mentions.length > 8) {
      detailHtml += `<div style="color:#556;font-size:10px">...and ${mentions.length - 8} more</div>`;
    }
  } else {
    detailHtml += `<div style="color:#556;font-size:11px;margin-top:10px;font-style:italic">No evidence linked to this crew member yet. Explore and read terminals to find connections.</div>`;
  }

  // Profiling insight (when 2+ evidence pieces mention this person)
  if (profileReady) {
    const insight = getCrewProfileInsight(selected, mentions);
    if (insight) {
      detailHtml += `<div style="color:#fca;font-size:10px;letter-spacing:1.5px;margin:14px 0 6px">PROFILING INSIGHT</div>`;
      detailHtml += `<div style="color:#dda;font-size:12px;line-height:1.5;padding:8px;background:rgba(255,200,100,0.05);border:1px solid rgba(255,200,100,0.15);border-radius:3px">${insight}</div>`;
    }
  } else if (mentions.length > 0) {
    detailHtml += `<div style="color:#556;font-size:10px;margin-top:10px;font-style:italic">Collect more evidence mentioning ${selected.firstName} to unlock profiling insight (${mentions.length}/2)</div>`;
  }

  detailHtml += `</div>`;

  return `<div class="journal-body"><div class="journal-list" style="overflow-y:auto;max-height:420px">${listHtml}</div><div class="journal-detail" style="overflow-y:auto;max-height:420px">${detailHtml}</div></div>`;
}

/** Generate a profiling insight for a crew member based on their evidence mentions */
function getCrewProfileInsight(crew: import("./shared/types.js").CrewMember, mentions: import("./shared/types.js").JournalEntry[]): string {
  if (!state.mystery) return "";
  const archetype = state.mystery.timeline.archetype;
  const role = crew.role;

  // Check if this crew member is central to the mystery
  const isCentral = state.mystery.timeline.events.some(e => e.actorId === crew.id);
  const mentionText = mentions.map(m => m.detail).join(" ").toLowerCase();

  // Generate contextual insight based on evidence content and crew role
  const hasConflict = mentionText.includes("conflict") || mentionText.includes("argument") || mentionText.includes("disagree") || mentionText.includes("tension");
  const hasSecret = mentionText.includes("secret") || mentionText.includes("hidden") || mentionText.includes("encrypt") || mentionText.includes("private");
  const hasLocation = mentionText.includes("was seen") || mentionText.includes("last seen") || mentionText.includes("heading toward");
  const hasAnxiety = mentionText.includes("worried") || mentionText.includes("nervous") || mentionText.includes("afraid") || mentionText.includes("scared");

  const parts: string[] = [];

  if (isCentral) {
    parts.push(`${crew.firstName} appears in multiple timeline events — a key figure in what happened here.`);
  }
  if (hasConflict) {
    parts.push(`Evidence suggests interpersonal conflict involving ${crew.firstName}. Their relationships with other crew may be relevant.`);
  }
  if (hasSecret) {
    parts.push(`${crew.firstName} was involved with something they wanted kept hidden. The encrypted or private communications deserve closer attention.`);
  }
  if (hasLocation) {
    parts.push(`${crew.firstName}'s movements through the station have been documented. Their location history could reveal their role in events.`);
  }
  if (hasAnxiety) {
    parts.push(`${crew.firstName} showed signs of fear or anxiety before the incident. They may have known something was coming.`);
  }
  if (crew.secret) {
    parts.push(`Profile analysis suggests ${crew.firstName} harbors a significant secret that may connect to the larger mystery.`);
  }

  if (parts.length === 0) {
    parts.push(`${crew.firstName}'s involvement appears peripheral based on current evidence. Continue gathering information.`);
  }

  return parts.slice(0, 3).join(" ");
}

/** Render a single scene list item with visual status. */
function renderSceneListItem(s: RoomScene, idx: number, selected: boolean, isReady: boolean): string {
  const examined = s.physicalClues.filter(c => c.examined).length;
  const total = s.physicalClues.length;
  const sensorGated = s.physicalClues.filter(c => !c.examined && c.sensorRequired).length;

  let statusIcon: string;
  let statusColor: string;
  let statusLabel = "";
  if (s.processed) {
    statusIcon = "\u2713"; statusColor = "#4a4"; statusLabel = "DONE";
  } else if (isReady) {
    statusIcon = "\u25c6"; statusColor = "#fa0"; statusLabel = "READY";
  } else if (examined > 0) {
    statusIcon = "\u25cb"; statusColor = "#ca8";
  } else {
    statusIcon = "\u25cb"; statusColor = "#555";
  }

  const bg = selected
    ? `background:rgba(${isReady ? "255,170,0" : "68,204,255"},0.12);border-left:2px solid ${isReady ? "#fa0" : "#4cf"}`
    : "border-left:2px solid transparent";

  let html = `<div style="padding:6px 10px;${bg};margin:1px 0">`;
  html += `<div style="display:flex;justify-content:space-between;align-items:center">`;
  html += `<span style="color:${selected ? "#eef" : "#aab"};font-weight:${selected ? "bold" : "normal"};font-size:13px">`;
  html += `<span style="color:${statusColor}">[${statusIcon}]</span> ${esc(s.roomName)}</span>`;
  if (statusLabel) {
    html += `<span style="color:${statusColor};font-size:9px;font-weight:bold;letter-spacing:1px">${statusLabel}</span>`;
  }
  html += `</div>`;
  // Timeline phase indicator
  const phaseNames: Record<string, string> = {
    normal_ops: "Normal Ops", trigger: "Trigger", escalation: "Escalation",
    collapse: "Collapse", aftermath: "Aftermath",
  };
  const phaseColors: Record<string, string> = {
    normal_ops: "#6a8", trigger: "#fa0", escalation: "#f80",
    collapse: "#f44", aftermath: "#88f",
  };
  let phaseTag = "";
  if (s.processed && s.crewPresent.length > 0) {
    const phase = s.crewPresent[0].phase;
    const pName = phaseNames[phase] ?? phase;
    const pColor = phaseColors[phase] ?? "#667";
    phaseTag = ` · <span style="color:${pColor}">${esc(pName)}</span>`;
  } else if (!s.processed) {
    phaseTag = ` · <span style="color:#444">Phase: ???</span>`;
  }

  html += `<div style="font-size:10px;color:#667">`;
  html += `Clues: ${examined}/${total}${sensorGated > 0 ? ` (+${sensorGated} sensor)` : ""}${phaseTag}`;
  html += `</div></div>`;
  return html;
}

/** SCENES section — room scene investigation with WHO/WHAT/OUTCOME processing. */
function renderHubScenes(): string {
  if (!state.mystery?.roomScenes || state.mystery.roomScenes.length === 0) {
    return `<div class="journal-body"><div class="journal-list"><div class="journal-empty">No room scenes detected yet.<br>Explore the station to discover scenes.</div></div><div class="journal-detail"><div class="journal-empty">Room scenes appear as you explore.</div></div></div>`;
  }

  const scenes = state.mystery.roomScenes;
  const crew = state.mystery.crew;
  const dossiers = state.mystery.dossiers ?? [];
  const accumulation = state.mystery.evidenceAccumulation;

  // If viewing a specific scene in detail
  if (hubSceneDetail) {
    const scene = scenes.find(s => s.roomId === hubSceneDetail);
    if (scene) {
      if (hubSceneSubView === "process") {
        return renderHubSceneProcess(scene, crew, dossiers);
      }
      return renderHubSceneDetail(scene, crew, dossiers);
    }
    hubSceneDetail = null;
  }

  // Clamp index
  if (hubIdx >= scenes.length) hubIdx = scenes.length - 1;
  if (hubIdx < 0) hubIdx = 0;

  // Scene list (left panel)
  let listHtml = "";

  // ── Scene processing result banner (auto-dismiss after 8s) ──
  if (hubSceneResult && (Date.now() - hubSceneResult.timestamp < 8000)) {
    const { score, roomName, whoCorrect, whatCorrect, outcomeCorrect,
      whoAnswer, whatAnswer, outcomeAnswer, correctWho, correctWhat, correctOutcome } = hubSceneResult;
    const resultColor = score >= 3 ? "#4a4" : score >= 2 ? "#fa0" : "#f44";
    const resultLabel = score >= 3 ? "PERFECT ASSESSMENT" : score >= 2 ? "SCENE PROCESSED" : "ANALYSIS INCOMPLETE";
    const resultIcon = score >= 3 ? "\u2605" : score >= 2 ? "\u2713" : "\u2717";
    listHtml += `<div style="padding:8px 10px;margin-bottom:6px;background:rgba(${score >= 3 ? "68,255,136" : score >= 2 ? "255,170,0" : "255,68,68"},0.08);border:1px solid ${resultColor};border-radius:3px">`;
    listHtml += `<div style="color:${resultColor};font-size:13px;font-weight:bold;text-align:center">${resultIcon} ${resultLabel} \u2014 ${score}/3</div>`;
    listHtml += `<div style="color:#889;font-size:10px;text-align:center;margin-top:2px;margin-bottom:6px">${esc(roomName)}</div>`;
    // Per-dimension breakdown
    const dimRow = (label: string, ok: boolean, answer: string, correct: string) => {
      const icon = ok ? `<span style="color:#4a4">\u2713</span>` : `<span style="color:#f44">\u2717</span>`;
      let detail = ok
        ? `<span style="color:#8b8">${esc(answer)}</span>`
        : `<span style="color:#f88;text-decoration:line-through">${esc(answer)}</span> <span style="color:#889">\u2192</span> <span style="color:#4a4">${esc(correct)}</span>`;
      return `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:11px">${icon} <span style="color:#aab;min-width:55px">${label}:</span> ${detail}</div>`;
    };
    listHtml += dimRow("WHO", whoCorrect, whoAnswer, correctWho);
    listHtml += dimRow("WHAT", whatCorrect, whatAnswer, correctWhat);
    listHtml += dimRow("OUTCOME", outcomeCorrect, outcomeAnswer, correctOutcome);
    const wrongAnswers = (whoCorrect ? 0 : 1) + (whatCorrect ? 0 : 1) + (outcomeCorrect ? 0 : 1);
    if (wrongAnswers > 0) {
      listHtml += `<div style="color:#f66;font-size:10px;text-align:center;margin-top:4px">-${wrongAnswers * 2} HP penalty (${wrongAnswers} wrong)</div>`;
    }
    listHtml += `</div>`;
  } else if (hubSceneResult) {
    hubSceneResult = null; // auto-dismiss after 8s
  }

  // Evidence accumulation summary at top
  if (accumulation) {
    const total = accumulation.confirming_found + accumulation.ambiguous_found + accumulation.contradicting_found;
    const crackIcon = accumulation.crack_moment_fired ? ' <span style="color:#f44">CRACK MOMENT</span>' : "";
    listHtml += `<div style="padding:6px 10px;border-bottom:1px solid #333;margin-bottom:4px">`;
    listHtml += `<div style="color:#4cf;font-size:10px;letter-spacing:1.5px">EVIDENCE ACCUMULATION</div>`;
    listHtml += `<div style="font-size:11px;margin-top:3px">`;
    listHtml += `<span style="color:#4a4">\u25A0 ${accumulation.confirming_found} confirming</span>  `;
    listHtml += `<span style="color:#ca8">\u25A0 ${accumulation.ambiguous_found} ambiguous</span>  `;
    listHtml += `<span style="color:#f44">\u25A0 ${accumulation.contradicting_found} contradicting</span>`;
    listHtml += `</div>`;
    listHtml += `<div style="font-size:10px;color:#667;margin-top:2px">Total: ${total}${crackIcon}</div>`;
    listHtml += `</div>`;
  }

  // Incident board summary — with scene-per-phase counts
  const board = state.mystery?.incidentBoard;
  // Count processed scenes per timeline phase
  const scenesPerPhase = new Map<string, { total: number; processed: number }>();
  for (const s of scenes) {
    if (s.crewPresent.length > 0) {
      const phase = s.crewPresent[0].phase;
      const entry = scenesPerPhase.get(phase) ?? { total: 0, processed: 0 };
      entry.total++;
      if (s.processed) entry.processed++;
      scenesPerPhase.set(phase, entry);
    }
  }
  if (board) {
    listHtml += `<div style="padding:6px 10px;border-bottom:1px solid #333;margin-bottom:4px">`;
    listHtml += `<div style="color:#fa0;font-size:10px;letter-spacing:1.5px">INCIDENT TIMELINE</div>`;
    const phaseLabels: Record<string, string> = {
      normal_ops: "Normal Ops", trigger: "Trigger", escalation: "Escalation",
      collapse: "Collapse", aftermath: "Aftermath",
    };
    for (const slot of board.slots) {
      const label = phaseLabels[slot.phase] ?? slot.phase;
      let icon: string, color: string;
      if (slot.status === "confirmed") { icon = "\u2713"; color = "#4a4"; }
      else if (slot.status === "proposed") { icon = "?"; color = "#fa0"; }
      else if (slot.status === "unlocked") { icon = "\u25cb"; color = "#ca8"; }
      else { icon = "\u25cb"; color = "#555"; }
      const phaseScenes = scenesPerPhase.get(slot.phase);
      const sceneCount = phaseScenes ? ` <span style="color:#556;font-size:9px">(${phaseScenes.processed}/${phaseScenes.total} scenes)</span>` : "";
      listHtml += `<div style="font-size:11px;padding:2px 0"><span style="color:${color}">[${icon}]</span> <span style="color:${slot.status === "confirmed" ? "#bbc" : "#667"}">${esc(label)}</span>${sceneCount}`;
      if (slot.status === "confirmed" && slot.confirmedCard) {
        listHtml += ` <span style="color:#4a4;font-size:10px">— ${esc(slot.confirmedCard.event.slice(0, 30))}</span>`;
      }
      listHtml += `</div>`;
    }
    if (board.wrongConfirmations > 0) {
      listHtml += `<div style="color:#f44;font-size:10px;margin-top:2px">${board.wrongConfirmations} wrong confirmation${board.wrongConfirmations !== 1 ? "s" : ""}</div>`;
    }
    listHtml += `</div>`;
  }

  // Dossier progress summary
  const dossiersData = state.mystery?.dossiers;
  if (dossiersData && dossiersData.length > 0) {
    const identified = dossiersData.filter(d => d.confirmed.name).length;
    listHtml += `<div style="padding:6px 10px;border-bottom:1px solid #333;margin-bottom:4px">`;
    listHtml += `<div style="color:#6cf;font-size:10px;letter-spacing:1.5px">CREW DOSSIERS</div>`;
    listHtml += `<div style="font-size:11px;color:#889">${identified}/${dossiersData.length} identified</div>`;
    listHtml += `</div>`;
  }

  // Group scenes by status for visual hierarchy
  const processedSceneIdxs: number[] = [];
  const readySceneIdxs: number[] = [];
  const partialSceneIdxs: number[] = [];
  const unvisitedSceneIdxs: number[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const examined = s.physicalClues.filter(c => c.examined).length;
    if (s.processed) processedSceneIdxs.push(i);
    else if (examined > 0 && examined === s.physicalClues.filter(c => !c.sensorRequired || c.examined).length) readySceneIdxs.push(i);
    else if (examined > 0) partialSceneIdxs.push(i);
    else unvisitedSceneIdxs.push(i);
  }

  // Ready to process — highlighted prominently
  if (readySceneIdxs.length > 0) {
    listHtml += `<div style="color:#fa0;font-size:9px;letter-spacing:1.5px;padding:4px 10px;border-bottom:1px solid #332;margin-top:4px">READY TO PROCESS (${readySceneIdxs.length})</div>`;
  }
  for (const idx of readySceneIdxs) {
    listHtml += renderSceneListItem(scenes[idx], idx, idx === hubIdx, true);
  }

  // Partially examined
  if (partialSceneIdxs.length > 0) {
    listHtml += `<div style="color:#ca8;font-size:9px;letter-spacing:1.5px;padding:4px 10px;border-bottom:1px solid #332;margin-top:4px">IN PROGRESS (${partialSceneIdxs.length})</div>`;
  }
  for (const idx of partialSceneIdxs) {
    listHtml += renderSceneListItem(scenes[idx], idx, idx === hubIdx, false);
  }

  // Unvisited
  if (unvisitedSceneIdxs.length > 0) {
    listHtml += `<div style="color:#555;font-size:9px;letter-spacing:1.5px;padding:4px 10px;border-bottom:1px solid #222;margin-top:4px">UNEXPLORED (${unvisitedSceneIdxs.length})</div>`;
  }
  for (const idx of unvisitedSceneIdxs) {
    listHtml += renderSceneListItem(scenes[idx], idx, idx === hubIdx, false);
  }

  // Processed — compact
  if (processedSceneIdxs.length > 0) {
    listHtml += `<div style="color:#4a4;font-size:9px;letter-spacing:1.5px;padding:4px 10px;border-bottom:1px solid #232;margin-top:4px">PROCESSED (${processedSceneIdxs.length})</div>`;
  }
  for (const idx of processedSceneIdxs) {
    listHtml += renderSceneListItem(scenes[idx], idx, idx === hubIdx, false);
  }

  // Detail panel for selected scene (right side)
  const sel = scenes[hubIdx];
  let detailHtml = `<div style="padding:12px">`;
  detailHtml += `<div style="color:#4cf;font-size:10px;letter-spacing:2px;margin-bottom:8px">SCENE OVERVIEW</div>`;
  detailHtml += `<div style="color:#eef;font-size:16px;font-weight:bold;margin-bottom:4px">${esc(sel.roomName)}</div>`;

  // Environmental state
  const env = sel.environmentalState;
  if (env.damageType !== "none") {
    const dmgColors: Record<string, string> = { thermal: "#f80", pressure: "#4af", electrical: "#ff0", biological: "#0f8" };
    detailHtml += `<div style="color:${dmgColors[env.damageType] ?? "#aaa"};font-size:11px;margin-bottom:6px">`;
    detailHtml += `${env.damageType.toUpperCase()} DAMAGE (level ${env.damageLevel})`;
    if (env.hasBarricade) detailHtml += ` \u00B7 BARRICADED`;
    if (env.sealState !== "open") detailHtml += ` \u00B7 ${env.sealState.replace(/_/g, " ").toUpperCase()}`;
    detailHtml += `</div>`;
  }

  // Clue summary
  const examined = sel.physicalClues.filter(c => c.examined);
  const unexamined = sel.physicalClues.filter(c => !c.examined && !c.sensorRequired);
  const sensorGated = sel.physicalClues.filter(c => !c.examined && c.sensorRequired);

  detailHtml += `<div style="color:#889;font-size:11px;margin-bottom:10px">`;
  detailHtml += `${examined.length} examined \u00B7 ${unexamined.length} unexamined`;
  if (sensorGated.length > 0) {
    const sensorNames = [...new Set(sensorGated.map(c => c.sensorRequired))].join(", ");
    detailHtml += ` \u00B7 ${sensorGated.length} need sensor (${sensorNames})`;
  }
  detailHtml += `</div>`;

  // Show examined clues
  if (examined.length > 0) {
    detailHtml += `<div style="color:#4cf;font-size:10px;letter-spacing:1.5px;margin:8px 0 4px">EXAMINED CLUES</div>`;
    for (const c of examined) {
      const typeColor = c.type === "badge" || c.type === "personal_effect" ? "#6cf" : c.type === "terminal_log" || c.type === "access_log" ? "#fa0" : "#aab";
      detailHtml += `<div style="margin:4px 0;padding:4px 8px;background:rgba(68,204,255,0.05);border-left:2px solid ${typeColor};font-size:11px">`;
      detailHtml += `<div style="color:${typeColor};font-size:10px">${c.type.replace(/_/g, " ").toUpperCase()}</div>`;
      detailHtml += `<div style="color:#bbc">${esc(c.text)}</div>`;
      if (c.crewLinked) {
        const linked = state.mystery?.crew.find(cr => cr.id === c.crewLinked);
        if (linked) detailHtml += `<div style="color:#6cf;font-size:10px">Linked to: ${esc(linked.firstName)} ${esc(linked.lastName)}</div>`;
      }
      detailHtml += `</div>`;
    }
  }

  // Processing status
  if (sel.processed) {
    detailHtml += `<div style="color:#4a4;font-size:12px;margin-top:12px;padding:8px;background:rgba(68,255,136,0.05);border:1px solid rgba(68,255,136,0.2)">\u2713 Scene processed (${sel.processAttempts} attempt${sel.processAttempts !== 1 ? "s" : ""})</div>`;
  } else if (examined.length > 0) {
    detailHtml += `<div style="color:#fa0;font-size:12px;margin-top:12px;padding:8px;background:rgba(255,170,0,0.05);border:1px solid rgba(255,170,0,0.2)">Press [Enter] to investigate this scene in detail</div>`;
  } else {
    detailHtml += `<div style="color:#555;font-size:11px;margin-top:12px;font-style:italic">Examine clues first by pressing [x] in this room.</div>`;
  }

  detailHtml += `</div>`;

  return `<div class="journal-body"><div class="journal-list" style="overflow-y:auto;max-height:420px">${listHtml}</div><div class="journal-detail" style="overflow-y:auto;max-height:420px">${detailHtml}</div></div>`;
}

/** Scene detail view — shows all clues and allows entering process mode. */
function renderHubSceneDetail(scene: RoomScene, crew: import("./shared/types.js").CrewMember[], dossiers: CrewDossier[]): string {
  let html = `<div style="overflow-y:auto;max-height:calc(100% - 80px);padding:12px 16px">`;
  html += `<div style="color:#4cf;font-size:10px;letter-spacing:2px;margin-bottom:8px">SCENE INVESTIGATION: ${esc(scene.roomName.toUpperCase())}</div>`;

  // Environmental state header
  const env = scene.environmentalState;
  if (env.damageType !== "none") {
    const dmgColors: Record<string, string> = { thermal: "#f80", pressure: "#4af", electrical: "#ff0", biological: "#0f8" };
    html += `<div style="color:${dmgColors[env.damageType] ?? "#aaa"};font-size:11px;margin-bottom:8px;padding:4px 8px;background:rgba(255,255,255,0.03)">`;
    html += `Environmental: ${env.damageType.toUpperCase()} damage (level ${env.damageLevel})`;
    if (env.hasBarricade) html += ` \u00B7 Barricade present`;
    if (env.sealState !== "open") html += ` \u00B7 ${env.sealState.replace(/_/g, " ")}`;
    html += `</div>`;
  }

  // All clues listed
  const clues = scene.physicalClues;
  for (let i = 0; i < clues.length; i++) {
    const c = clues[i];
    const selected = i === hubIdx;
    const bg = selected ? "background:rgba(68,204,255,0.1);border-left:2px solid #4cf" : "border-left:2px solid #333";
    const typeColor = c.type === "badge" || c.type === "personal_effect" ? "#6cf"
      : c.type === "terminal_log" || c.type === "access_log" ? "#fa0"
      : c.type === "damage_pattern" || c.type === "residue" ? "#f80" : "#aab";

    html += `<div style="margin:4px 0;padding:6px 10px;${bg}">`;
    html += `<div style="display:flex;justify-content:space-between;align-items:center">`;
    html += `<span style="color:${typeColor};font-size:10px;letter-spacing:1px">${c.type.replace(/_/g, " ").toUpperCase()}</span>`;

    if (!c.examined && c.sensorRequired) {
      html += `<span style="color:#f44;font-size:10px">REQUIRES ${c.sensorRequired.toUpperCase()} SENSOR</span>`;
    } else if (!c.examined) {
      html += `<span style="color:#555;font-size:10px">NOT EXAMINED</span>`;
    } else {
      const catColor = c.evidenceCategory === "confirming" ? "#4a4" : c.evidenceCategory === "contradicting" ? "#f44" : "#ca8";
      html += `<span style="color:${catColor};font-size:10px">${c.evidenceCategory.toUpperCase()}</span>`;
    }
    html += `</div>`;

    if (c.examined) {
      html += `<div style="color:#bbc;font-size:12px;margin-top:4px;line-height:1.4">${esc(c.text)}</div>`;
      if (c.crewLinked) {
        const linked = crew.find(cr => cr.id === c.crewLinked);
        if (linked) {
          const dossier = dossiers.find(d => d.crewId === c.crewLinked);
          const identified = dossier?.confirmed.name ? "\u2713" : "?";
          html += `<div style="color:#6cf;font-size:10px;margin-top:2px">[${identified}] Linked: ${esc(linked.firstName)} ${esc(linked.lastName)} (${esc(linked.role)})</div>`;
        }
      }
    } else {
      html += `<div style="color:#555;font-size:11px;margin-top:4px;font-style:italic">Examine this clue in the room to reveal its contents.</div>`;
    }
    html += `</div>`;
  }

  // Processing option
  if (scene.processed) {
    const gt = scene.groundTruth;
    const crewList = state.mystery?.crew ?? [];
    const actLabel = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const whoNames = gt.who.map(id => crewList.find(c => c.id === id)).filter(Boolean).map(c => `${c!.firstName} ${c!.lastName}`).join(", ") || "Unknown";
    html += `<div style="margin-top:16px;padding:10px;background:rgba(68,255,136,0.05);border:1px solid rgba(68,255,136,0.2);border-radius:4px">`;
    html += `<div style="color:#4a4;font-size:12px;font-weight:bold;margin-bottom:8px">\u2713 Scene Processed \u2014 Confirmed Assessment</div>`;
    html += `<div style="display:flex;flex-direction:column;gap:4px">`;
    html += `<div style="font-size:11px"><span style="color:#889;min-width:70px;display:inline-block">WHO:</span> <span style="color:#cdc">${esc(whoNames)}</span></div>`;
    html += `<div style="font-size:11px"><span style="color:#889;min-width:70px;display:inline-block">WHAT:</span> <span style="color:#cdc">${esc(actLabel(gt.what))}</span></div>`;
    html += `<div style="font-size:11px"><span style="color:#889;min-width:70px;display:inline-block">OUTCOME:</span> <span style="color:#cdc">${esc(actLabel(gt.outcome))}</span></div>`;
    html += `</div></div>`;
  } else {
    const examinedCount = clues.filter(c => c.examined).length;
    if (examinedCount > 0) {
      const turnCost = scene.processAttempts === 0 ? 3 : scene.processAttempts === 1 ? 5 : scene.processAttempts === 2 ? 8 : 8 + (scene.processAttempts - 2) * 4;
      html += `<div style="margin-top:16px;padding:10px;background:rgba(255,170,0,0.06);border:1px solid rgba(255,170,0,0.2);text-align:center">`;
      html += `<div style="color:#fa0;font-size:12px;font-weight:bold">[p] PROCESS SCENE</div>`;
      html += `<div style="color:#889;font-size:10px;margin-top:4px">Answer WHO/WHAT/OUTCOME based on the evidence</div>`;
      html += `<div style="color:#667;font-size:10px;margin-top:2px">Cost: ${turnCost} turns${scene.processAttempts > 0 ? ` (attempt ${scene.processAttempts + 1})` : ""}</div>`;
      html += `</div>`;
    }
  }

  html += `</div>`;
  return html;
}

/** Scene process view — WHO/WHAT/OUTCOME selection with crew, activity, and outcome pickers. */
function renderHubSceneProcess(scene: RoomScene, crew: import("./shared/types.js").CrewMember[], dossiers: CrewDossier[]): string {
  if (hubSceneConfirming) {
    return renderHubSceneConfirm(scene, crew);
  }

  const activities = [
    { key: SceneActivity.EmergencyResponse, label: "Emergency Response" },
    { key: SceneActivity.Fleeing, label: "Fleeing" },
    { key: SceneActivity.Hiding, label: "Hiding" },
    { key: SceneActivity.Sabotage, label: "Sabotage" },
    { key: SceneActivity.MedicalTreatment, label: "Medical Treatment" },
    { key: SceneActivity.RoutineWork, label: "Routine Work" },
    { key: SceneActivity.Investigation, label: "Investigation" },
    { key: SceneActivity.EquipmentRepair, label: "Equipment Repair" },
    { key: SceneActivity.DataAccess, label: "Data Access" },
    { key: SceneActivity.Confrontation, label: "Confrontation" },
    { key: SceneActivity.Communication, label: "Communication" },
    { key: SceneActivity.Barricading, label: "Barricading" },
  ];
  const outcomes = [
    { key: SceneOutcome.LeftNormally, label: "Left Normally" },
    { key: SceneOutcome.LeftInHurry, label: "Left In Hurry" },
    { key: SceneOutcome.Injured, label: "Injured" },
    { key: SceneOutcome.DiedHere, label: "Died Here" },
    { key: SceneOutcome.StillHere, label: "Still Here" },
    { key: SceneOutcome.SealedInside, label: "Sealed Inside" },
    { key: SceneOutcome.Unknown, label: "Unknown" },
  ];

  // ── Inference from clue types: reverse-map clue types → likely activities/outcomes ──
  const examinedClues = scene.physicalClues.filter(c => c.examined);
  const clueTypes = new Set(examinedClues.map(c => c.type));
  const clueTextsLower = examinedClues.map(c => c.text.toLowerCase()).join(" ");

  // Clue type → suggested activities (reverse of clueTypeForActivity mapping)
  const suggestedActivities = new Set<SceneActivity>();
  if (clueTypes.has("damage_pattern")) { suggestedActivities.add(SceneActivity.EmergencyResponse); suggestedActivities.add(SceneActivity.Confrontation); }
  if (clueTypes.has("personal_effect")) { suggestedActivities.add(SceneActivity.Fleeing); }
  if (clueTypes.has("barricade")) { suggestedActivities.add(SceneActivity.Hiding); suggestedActivities.add(SceneActivity.Barricading); }
  if (clueTypes.has("modified_equipment")) { suggestedActivities.add(SceneActivity.Sabotage); }
  if (clueTypes.has("tool")) { suggestedActivities.add(SceneActivity.MedicalTreatment); suggestedActivities.add(SceneActivity.EquipmentRepair); }
  if (clueTypes.has("access_log")) { suggestedActivities.add(SceneActivity.RoutineWork); }
  if (clueTypes.has("terminal_log")) { suggestedActivities.add(SceneActivity.Investigation); suggestedActivities.add(SceneActivity.DataAccess); suggestedActivities.add(SceneActivity.Communication); }

  // Text-based outcome hints from clue descriptions
  const suggestedOutcomes = new Set<SceneOutcome>();
  if (clueTextsLower.includes("blood") || clueTextsLower.includes("body") || clueTextsLower.includes("died") || clueTextsLower.includes("deceased") || clueTextsLower.includes("fatal")) {
    suggestedOutcomes.add(SceneOutcome.DiedHere);
  }
  if (clueTextsLower.includes("hurry") || clueTextsLower.includes("rush") || clueTextsLower.includes("fled") || clueTextsLower.includes("abandoned") || clueTextsLower.includes("dropped")) {
    suggestedOutcomes.add(SceneOutcome.LeftInHurry);
  }
  if (clueTextsLower.includes("barricade") || clueTextsLower.includes("sealed") || clueTextsLower.includes("locked from inside")) {
    suggestedOutcomes.add(SceneOutcome.SealedInside); suggestedOutcomes.add(SceneOutcome.StillHere);
  }
  if (clueTextsLower.includes("injur") || clueTextsLower.includes("wound") || clueTextsLower.includes("bandage") || clueTextsLower.includes("medical")) {
    suggestedOutcomes.add(SceneOutcome.Injured);
  }

  // WHO hints: clues with crewLinked
  const suggestedCrewIds = new Set<string>();
  for (const clue of examinedClues) {
    if (clue.crewLinked) suggestedCrewIds.add(clue.crewLinked);
  }

  // Three-column layout: WHO | WHAT | OUTCOME
  // Track which column is focused: 0=WHO, 1=WHAT, 2=OUTCOME
  const focusCol = hubOptionIdx; // reuse hubOptionIdx as column focus (0-2)

  let html = `<div style="overflow-y:auto;max-height:calc(100% - 80px);padding:12px 16px">`;
  html += `<div style="color:#4cf;font-size:10px;letter-spacing:2px;margin-bottom:8px">PROCESS SCENE: ${esc(scene.roomName.toUpperCase())}</div>`;

  const turnCost = scene.processAttempts === 0 ? 3 : scene.processAttempts === 1 ? 5 : scene.processAttempts === 2 ? 8 : 8 + (scene.processAttempts - 2) * 4;
  html += `<div style="color:#667;font-size:10px;margin-bottom:8px">Attempt ${scene.processAttempts + 1} \u00B7 Cost: ${turnCost} turns \u00B7 Score 2/3 to succeed</div>`;

  // ── PREVIOUS ATTEMPT RESULTS — show what was wrong last time ──
  if (scene.lastAttemptResult && !scene.processed) {
    const prev = scene.lastAttemptResult;
    const prevColor = prev.score >= 2 ? "#4a4" : prev.score >= 1 ? "#fa0" : "#f44";
    html += `<div style="margin-bottom:8px;padding:5px 8px;background:rgba(255,100,50,0.06);border:1px solid #533;border-radius:3px">`;
    html += `<div style="color:${prevColor};font-size:10px;font-weight:bold;letter-spacing:1px;margin-bottom:2px">PREVIOUS ATTEMPT: ${prev.score}/3</div>`;
    const dim = (label: string, ok: boolean) => {
      const icon = ok ? `<span style="color:#4a4">\u2713</span>` : `<span style="color:#f44">\u2717</span>`;
      return `${icon} <span style="color:${ok ? "#8a8" : "#f88"}">${label}</span>`;
    };
    html += `<div style="font-size:10px;display:flex;gap:12px">${dim("WHO", prev.whoCorrect)} ${dim("WHAT", prev.whatCorrect)} ${dim("OUTCOME", prev.outcomeCorrect)}</div>`;
    html += `</div>`;
  }

  // ── CLUES FOUND — show examined clue text as reference ──
  if (examinedClues.length > 0) {
    html += `<div style="margin-bottom:10px;padding:6px 8px;background:rgba(200,170,100,0.06);border:1px solid #443;border-radius:3px">`;
    html += `<div style="color:#ca8;font-size:10px;font-weight:bold;letter-spacing:1px;margin-bottom:4px">CLUES FOUND (${examinedClues.length})</div>`;
    for (const clue of examinedClues) {
      const typeLabel = clue.type.replace(/_/g, " ");
      const crewTag = clue.crewLinked
        ? (() => {
            const member = crew.find(c => c.id === clue.crewLinked);
            return member ? ` <span style="color:#6cf">[${member.lastName}]</span>` : "";
          })()
        : "";
      html += `<div style="margin:2px 0;font-size:11px;color:#bba;padding:2px 4px;border-left:2px solid #665">`;
      html += `<span style="color:#887;font-size:9px;text-transform:uppercase">${esc(typeLabel)}</span>${crewTag}`;
      html += `<div style="color:#ddc;font-size:11px">${esc(clue.text)}</div>`;
      html += `</div>`;
    }
    html += `</div>`;
  }

  // ── RELEVANT EVIDENCE — journal entries related to this room or suggested crew ──
  const journal = state.mystery?.journal ?? [];
  const roomEvidence = journal.filter(e => e.roomFound === scene.roomName);
  const crewEvidence = new Set<string>();
  for (const clue of examinedClues) {
    if (clue.crewLinked) {
      for (const je of journal) {
        if (je.crewMentioned.includes(clue.crewLinked) && !roomEvidence.some(r => r.id === je.id)) {
          crewEvidence.add(je.id);
        }
      }
    }
  }
  const relevantEntries = [...roomEvidence, ...journal.filter(je => crewEvidence.has(je.id))];
  if (relevantEntries.length > 0) {
    html += `<div style="margin-bottom:10px;padding:6px 8px;background:rgba(100,180,255,0.04);border:1px solid #334;border-radius:3px;max-height:100px;overflow-y:auto">`;
    html += `<div style="color:#6af;font-size:10px;font-weight:bold;letter-spacing:1px;margin-bottom:3px">RELEVANT EVIDENCE (${relevantEntries.length})</div>`;
    for (const entry of relevantEntries.slice(0, 6)) {
      const crewTags = entry.crewMentioned.map(id => {
        const c = crew.find(m => m.id === id);
        return c ? c.lastName : "";
      }).filter(Boolean);
      const crewStr = crewTags.length > 0 ? ` <span style="color:#6cf;font-size:9px">[${crewTags.join(", ")}]</span>` : "";
      html += `<div style="margin:1px 0;font-size:10px;color:#99a;padding:1px 4px;border-left:2px solid #446">`;
      html += `<span style="color:#aac">${esc(entry.summary)}</span>${crewStr}`;
      html += `</div>`;
    }
    if (relevantEntries.length > 6) {
      html += `<div style="color:#556;font-size:9px;padding:1px 4px">...and ${relevantEntries.length - 6} more</div>`;
    }
    html += `</div>`;
  }

  html += `<div style="display:flex;gap:12px">`;

  // WHO column — highlight crew linked to clues
  const whoActive = focusCol === 0;

  // Build cross-reference: crew → other processed scenes they appeared in
  const allScenes = state.mystery?.roomScenes ?? [];
  const crewSceneXref = new Map<string, { roomName: string; activity: string }[]>();
  for (const s of allScenes) {
    if (!s.processed || s.roomId === scene.roomId) continue;
    for (const whoId of s.groundTruth.who) {
      if (!crewSceneXref.has(whoId)) crewSceneXref.set(whoId, []);
      const actLabel = activities.find(a => a.key === s.groundTruth.what)?.label ?? s.groundTruth.what;
      crewSceneXref.get(whoId)!.push({ roomName: s.roomName, activity: actLabel });
    }
  }

  html += `<div style="flex:1;border:1px solid ${whoActive ? "#4cf" : "#333"};padding:8px;max-height:300px;overflow-y:auto">`;
  html += `<div style="color:${whoActive ? "#4cf" : "#889"};font-size:11px;font-weight:bold;margin-bottom:6px;letter-spacing:1px">WHO WAS HERE?</div>`;
  if (suggestedCrewIds.size > 0) {
    html += `<div style="color:#4cf;font-size:9px;margin-bottom:4px;font-style:italic">Evidence points to marked crew</div>`;
  }
  for (let i = 0; i < crew.length; i++) {
    const c = crew[i];
    const dossier = dossiers.find(d => d.crewId === c.id);
    const identified = dossier?.confirmed.name;
    const selected = whoActive && i === hubSceneWhoIdx;
    const suggested = suggestedCrewIds.has(c.id);
    const bg = selected ? "background:rgba(68,204,255,0.15)" : suggested ? "background:rgba(68,204,255,0.05)" : "";
    const nameText = identified ? `${c.firstName} ${c.lastName}` : `Crew #${i + 1} (${c.role})`;
    const prefix = selected ? "\u25b6 " : suggested ? "\u25c7 " : "  ";
    const hint = suggested ? ` <span style="color:#4cf;font-size:9px">\u2190 evidence</span>` : "";
    html += `<div style="padding:3px 6px;font-size:11px;${bg};color:${selected ? "#eef" : suggested ? "#bce" : "#889"}">${prefix}${esc(nameText)}${hint}`;
    // Cross-reference: show where this crew member was confirmed in other scenes
    const xrefs = crewSceneXref.get(c.id);
    if (xrefs && xrefs.length > 0 && (selected || suggested)) {
      for (const xr of xrefs.slice(0, 2)) {
        html += `<div style="font-size:9px;color:#6a8;padding-left:12px;margin-top:1px">Seen in ${esc(xr.roomName)}: ${esc(xr.activity)}</div>`;
      }
      if (xrefs.length > 2) {
        html += `<div style="font-size:9px;color:#567;padding-left:12px">+${xrefs.length - 2} more</div>`;
      }
    }
    html += `</div>`;
  }
  html += `</div>`;

  // WHAT column — highlight activities suggested by clue types
  const whatActive = focusCol === 1;
  html += `<div style="flex:1;border:1px solid ${whatActive ? "#fa0" : "#333"};padding:8px;max-height:300px;overflow-y:auto">`;
  html += `<div style="color:${whatActive ? "#fa0" : "#889"};font-size:11px;font-weight:bold;margin-bottom:6px;letter-spacing:1px">WHAT HAPPENED?</div>`;
  if (suggestedActivities.size > 0) {
    html += `<div style="color:#fa0;font-size:9px;margin-bottom:4px;font-style:italic">Clues suggest marked activities</div>`;
  }
  for (let i = 0; i < activities.length; i++) {
    const a = activities[i];
    const selected = whatActive && i === hubSceneWhatIdx;
    const suggested = suggestedActivities.has(a.key);
    const bg = selected ? "background:rgba(255,170,0,0.15)" : suggested ? "background:rgba(255,170,0,0.05)" : "";
    const prefix = selected ? "\u25b6 " : suggested ? "\u25c7 " : "  ";
    const hint = suggested ? ` <span style="color:#fa0;font-size:9px">\u2190 clue</span>` : "";
    html += `<div style="padding:3px 6px;font-size:11px;${bg};color:${selected ? "#eef" : suggested ? "#dca" : "#889"}">${prefix}${esc(a.label)}${hint}</div>`;
  }
  html += `</div>`;

  // OUTCOME column — highlight outcomes suggested by clue text analysis
  const outcomeActive = focusCol === 2;
  html += `<div style="flex:1;border:1px solid ${outcomeActive ? "#f80" : "#333"};padding:8px;max-height:300px;overflow-y:auto">`;
  html += `<div style="color:${outcomeActive ? "#f80" : "#889"};font-size:11px;font-weight:bold;margin-bottom:6px;letter-spacing:1px">OUTCOME?</div>`;
  if (suggestedOutcomes.size > 0) {
    html += `<div style="color:#f80;font-size:9px;margin-bottom:4px;font-style:italic">Evidence suggests marked outcomes</div>`;
  }
  for (let i = 0; i < outcomes.length; i++) {
    const o = outcomes[i];
    const selected = outcomeActive && i === hubSceneOutcomeIdx;
    const suggested = suggestedOutcomes.has(o.key);
    const bg = selected ? "background:rgba(255,136,0,0.15)" : suggested ? "background:rgba(255,136,0,0.05)" : "";
    const prefix = selected ? "\u25b6 " : suggested ? "\u25c7 " : "  ";
    const hint = suggested ? ` <span style="color:#f80;font-size:9px">\u2190 clue</span>` : "";
    html += `<div style="padding:3px 6px;font-size:11px;${bg};color:${selected ? "#eef" : suggested ? "#da8" : "#889"}">${prefix}${esc(o.label)}${hint}</div>`;
  }
  html += `</div>`;

  html += `</div>`; // end flex row

  // Current selections summary
  const selectedCrew = crew[hubSceneWhoIdx];
  const selectedWhat = activities[hubSceneWhatIdx];
  const selectedOutcome = outcomes[hubSceneOutcomeIdx];
  const crewName = dossiers.find(d => d.crewId === selectedCrew?.id)?.confirmed.name
    ? `${selectedCrew.firstName} ${selectedCrew.lastName}`
    : `Crew #${hubSceneWhoIdx + 1}`;

  html += `<div style="margin-top:12px;padding:8px;background:rgba(255,255,255,0.03);border:1px solid #333">`;
  html += `<div style="color:#889;font-size:10px;letter-spacing:1px;margin-bottom:4px">YOUR ASSESSMENT</div>`;
  html += `<div style="font-size:12px;color:#eef">WHO: <span style="color:#4cf">${esc(crewName)}</span> \u00B7 WHAT: <span style="color:#fa0">${esc(selectedWhat?.label ?? "?")}</span> \u00B7 OUTCOME: <span style="color:#f80">${esc(selectedOutcome?.label ?? "?")}</span></div>`;
  html += `</div>`;

  html += `<div style="color:#fa0;text-align:center;font-size:12px;margin-top:10px">[Enter] Submit assessment \u00B7 [\u2190/\u2192] Switch column \u00B7 [\u2191/\u2193] Select</div>`;

  // Dev mode: show ground truth
  if (devModeEnabled) {
    const gt = scene.groundTruth;
    const gtCrew = gt.who.map(id => crew.find(c => c.id === id)).filter(Boolean);
    html += `<div style="border-top:1px solid #f0f;margin-top:8px;padding-top:4px;color:#f0f;font-size:10px">`;
    html += `DEV TRUTH: WHO=${gtCrew.map(c => c!.firstName).join("+")} WHAT=${gt.what} OUTCOME=${gt.outcome}`;
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

/** Scene processing confirmation dialog. */
function renderHubSceneConfirm(scene: RoomScene, crew: import("./shared/types.js").CrewMember[]): string {
  const activities = [
    { key: SceneActivity.EmergencyResponse, label: "Emergency Response" },
    { key: SceneActivity.Fleeing, label: "Fleeing" },
    { key: SceneActivity.Hiding, label: "Hiding" },
    { key: SceneActivity.Sabotage, label: "Sabotage" },
    { key: SceneActivity.MedicalTreatment, label: "Medical Treatment" },
    { key: SceneActivity.RoutineWork, label: "Routine Work" },
    { key: SceneActivity.Investigation, label: "Investigation" },
    { key: SceneActivity.EquipmentRepair, label: "Equipment Repair" },
    { key: SceneActivity.DataAccess, label: "Data Access" },
    { key: SceneActivity.Confrontation, label: "Confrontation" },
    { key: SceneActivity.Communication, label: "Communication" },
    { key: SceneActivity.Barricading, label: "Barricading" },
  ];
  const outcomes = [
    { key: SceneOutcome.LeftNormally, label: "Left Normally" },
    { key: SceneOutcome.LeftInHurry, label: "Left In Hurry" },
    { key: SceneOutcome.Injured, label: "Injured" },
    { key: SceneOutcome.DiedHere, label: "Died Here" },
    { key: SceneOutcome.StillHere, label: "Still Here" },
    { key: SceneOutcome.SealedInside, label: "Sealed Inside" },
    { key: SceneOutcome.Unknown, label: "Unknown" },
  ];

  const selectedCrew = crew[hubSceneWhoIdx];
  const turnCost = scene.processAttempts === 0 ? 3 : scene.processAttempts === 1 ? 5 : scene.processAttempts === 2 ? 8 : 8 + (scene.processAttempts - 2) * 4;

  let html = `<div style="padding:20px;text-align:center">`;
  html += `<div style="color:#4cf;font-size:14px;margin-bottom:16px">PROCESS SCENE: ${esc(scene.roomName)}</div>`;
  html += `<div style="color:#eef;font-size:13px;margin-bottom:8px">`;
  html += `WHO: <span style="color:#4cf">${esc(selectedCrew?.firstName ?? "?")} ${esc(selectedCrew?.lastName ?? "")}</span><br>`;
  html += `WHAT: <span style="color:#fa0">${esc(activities[hubSceneWhatIdx]?.label ?? "?")}</span><br>`;
  html += `OUTCOME: <span style="color:#f80">${esc(outcomes[hubSceneOutcomeIdx]?.label ?? "?")}</span>`;
  html += `</div>`;
  html += `<div style="color:#ca8;font-size:12px;margin:12px 0">This will cost ${turnCost} turns. Wrong answers cost 2 HP each.</div>`;
  html += `<div style="color:#aaa;font-size:14px">[Y] Confirm  [N] Go back</div>`;
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
  hubSceneDetail = null;
  hubSceneSubView = "clues";
  hubSceneConfirming = false;
  hubSceneResult = null;
  display.setHubMode?.(false);
  document.getElementById("game-container")?.classList.remove("hub-open");
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
    const overlay = document.getElementById("broadcast-overlay");
    if (overlay) {
      overlay.classList.remove("active");
      overlay.innerHTML = "";
    }
    // Fire CORVUS-7 post-deduction ceremony commentary + tier-specific physical effects
    if (pendingCeremonyDeduction) {
      const ceremony = CORVUS_DEDUCTION_CEREMONY[pendingCeremonyDeduction.id];
      if (ceremony) {
        const line = pendingCeremonyDeduction.correct ? ceremony.correct : ceremony.wrong;
        display.addLog(line, "milestone");
        audio.playPA();
      }
      // Tier-specific physical consequences for correct answers
      if (pendingCeremonyDeduction.correct) {
        const id = pendingCeremonyDeduction.id;
        if (id === "deduction_what") {
          // Tier 1: HP recovery — the station acknowledges you
          state.player = { ...state.player, hp: Math.min(state.player.hp + 50, state.player.maxHp ?? 1000) };
          display.addLog("Station systems responding to investigation. Emergency repair cycle: +50 HP.", "system");
        } else if (id === "deduction_hero" || id === "deduction_why") {
          // Tier 3-4: Extra hazard reduction — the station calms
          for (let y = 0; y < state.height; y++) {
            for (let x = 0; x < state.width; x++) {
              const tile = state.tiles[y][x];
              if (tile.heat > 0) tile.heat = Math.max(0, tile.heat - 5);
              if (tile.smoke > 0) tile.smoke = Math.max(0, tile.smoke - 3);
            }
          }
          display.addLog("Station hazard levels dropping. The truth brings clarity — and calmer systems.", "system");
        } else if (id === "deduction_responsibility" || id === "deduction_agenda") {
          // Tier 5-6: Massive hazard reduction + audio shift
          for (let y = 0; y < state.height; y++) {
            for (let x = 0; x < state.width; x++) {
              const tile = state.tiles[y][x];
              if (tile.heat > 0) tile.heat = Math.max(0, tile.heat - 10);
              if (tile.smoke > 0) tile.smoke = Math.max(0, tile.smoke - 8);
            }
          }
          display.addLog("The full picture is clear. The station shudders — and goes quiet.", "milestone");
          display.triggerScreenFlash("milestone");
        }
      }
      pendingCeremonyDeduction = null;
    }
    renderInvestigationHub();
    return;
  }

  // Confirmation step: Y/N for deduction answer
  if (hubConfirming) {
    if (e.key === "y" || e.key === "Y") {
      hubConfirming = false;
      commitHubDeductionAnswer();
      return;
    }
    if (e.key === "n" || e.key === "N" || e.key === "Escape") {
      hubConfirming = false;
      renderInvestigationHub();
      return;
    }
    return;
  }

  // Escape from detail views first
  if (hubSceneDetail && e.key === "Escape") {
    if (hubSceneSubView === "process") {
      hubSceneSubView = "clues";
    } else {
      hubSceneDetail = null;
    }
    hubSceneConfirming = false;
    renderInvestigationHub();
    return;
  }
  if (hubDetailDeduction && e.key === "Escape") {
    hubDetailDeduction = null;
    renderInvestigationHub();
    return;
  }
  // Close hub
  if (e.key === "Escape" || (e.key === "r" && !hubDetailDeduction && !hubSceneDetail) || (e.key === "v" && hubSection === "evidence" && !hubDetailDeduction)) {
    closeInvestigationHub();
    return;
  }

  // Tab cycles sections
  if (e.key === "Tab" && !hubDetailDeduction && !hubSceneDetail) {
    const tabs: Array<"evidence" | "connections" | "crew" | "scenes"> = ["evidence", "scenes", "connections", "crew"];
    const curIdx = tabs.indexOf(hubSection);
    hubSection = tabs[(curIdx + 1) % tabs.length];
    hubIdx = 0;
    hubOptionIdx = 0;
    renderInvestigationHub();
    return;
  }

  // Number keys 1-4 for direct tab access
  if (!hubDetailDeduction && !hubSceneDetail) {
    const tabMap: Record<string, "evidence" | "scenes" | "connections" | "crew"> = {
      "1": "evidence", "2": "scenes", "3": "connections", "4": "crew",
    };
    const target = tabMap[e.key];
    if (target && target !== hubSection) {
      hubSection = target;
      hubIdx = 0;
      hubOptionIdx = 0;
      renderInvestigationHub();
      return;
    }
  }

  // Section-specific input handling
  if (hubSection === "evidence") {
    handleHubEvidenceInput(e);
  } else if (hubSection === "scenes") {
    handleHubScenesInput(e);
  } else if (hubSection === "connections") {
    handleHubConnectionsInput(e);
  } else if (hubSection === "crew") {
    handleHubCrewInput(e);
  }
}

function getFilteredEvidenceCount(): number {
  const { entries } = getEvidenceEntries();
  if (hubEvidenceFilter === "unread") {
    return entries.filter(e => !hubViewedEvidenceIds.has(e.id)).length;
  }
  if (hubEvidenceFilter === "by_thread") {
    // Count entries that belong to any thread + unthreaded entries
    return entries.length; // All entries are navigable in thread view
  }
  return entries.length;
}

function handleHubEvidenceInput(e: KeyboardEvent): void {
  // [f] cycles evidence filter
  if (e.key === "f" || e.key === "F") {
    const modes: Array<typeof hubEvidenceFilter> = ["all", "by_room", "by_type", "by_thread", "unread"];
    const curIdx = modes.indexOf(hubEvidenceFilter);
    hubEvidenceFilter = modes[(curIdx + 1) % modes.length];
    hubIdx = 0;
    renderInvestigationHub();
    return;
  }

  const maxIdx = Math.max(0, getFilteredEvidenceCount() - 1);

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

function handleHubCrewInput(e: KeyboardEvent): void {
  const crew = state.mystery?.crew ?? [];
  const dossiers = state.mystery?.dossiers ?? [];
  // Compute same banded order as renderHubCrew
  const identified: number[] = [];
  const partial: number[] = [];
  const unknown: number[] = [];
  for (let i = 0; i < crew.length; i++) {
    const d = dossiers.find(ds => ds.crewId === crew[i].id);
    if (d?.confirmed.name) identified.push(i);
    else if (d && (d.theories.lastKnownRoom || d.theories.involvement)) partial.push(i);
    else unknown.push(i);
  }
  const orderedIndices = [...identified, ...partial, ...unknown];
  const currentVisualIdx = orderedIndices.indexOf(hubIdx);
  const maxVisIdx = orderedIndices.length - 1;

  if (e.key === "ArrowUp" || e.key === "w" || e.key === "k") {
    const newVisIdx = Math.max(0, currentVisualIdx - 1);
    hubIdx = orderedIndices[newVisIdx] ?? hubIdx;
    renderInvestigationHub();
    return;
  }
  if (e.key === "ArrowDown" || e.key === "s" || e.key === "j") {
    const newVisIdx = Math.min(maxVisIdx, currentVisualIdx + 1);
    hubIdx = orderedIndices[newVisIdx] ?? hubIdx;
    renderInvestigationHub();
    return;
  }
}

function handleHubScenesInput(e: KeyboardEvent): void {
  const scenes = state.mystery?.roomScenes ?? [];
  const crew = state.mystery?.crew ?? [];

  // Scene confirm dialog
  if (hubSceneConfirming) {
    if (e.key === "y" || e.key === "Y") {
      hubSceneConfirming = false;
      // Submit the ProcessScene action
      const scene = scenes.find(s => s.roomId === hubSceneDetail);
      if (scene) {
        const activities: SceneActivity[] = [
          SceneActivity.EmergencyResponse, SceneActivity.Fleeing, SceneActivity.Hiding,
          SceneActivity.Sabotage, SceneActivity.MedicalTreatment, SceneActivity.RoutineWork,
          SceneActivity.Investigation, SceneActivity.EquipmentRepair, SceneActivity.DataAccess,
          SceneActivity.Confrontation, SceneActivity.Communication, SceneActivity.Barricading,
        ];
        const outcomes: SceneOutcome[] = [
          SceneOutcome.LeftNormally, SceneOutcome.LeftInHurry, SceneOutcome.Injured,
          SceneOutcome.DiedHere, SceneOutcome.StillHere, SceneOutcome.SealedInside, SceneOutcome.Unknown,
        ];
        const selectedCrew = crew[hubSceneWhoIdx];
        const prevLogCount = state.logs.length;
        handleAction({
          type: ActionType.ProcessScene,
          sceneRoomId: scene.roomId,
          whoAnswer: selectedCrew ? [selectedCrew.id] : [],
          whatAnswer: activities[hubSceneWhatIdx] ?? SceneActivity.RoutineWork,
          outcomeAnswer: outcomes[hubSceneOutcomeIdx] ?? SceneOutcome.Unknown,
        });
        // Extract per-dimension results from the process result log
        let score = 0;
        let whoCorrect = false, whatCorrect = false, outcomeCorrect = false;
        for (let i = prevLogCount; i < state.logs.length; i++) {
          const logEntry = state.logs[i];
          if (logEntry.id.startsWith("log_process_result_")) {
            const scoreMatch = logEntry.text.match(/\((\d)\/3\)/);
            if (scoreMatch) score = parseInt(scoreMatch[1], 10);
            whoCorrect = logEntry.text.includes("WHO: correct");
            whatCorrect = logEntry.text.includes("WHAT: correct");
            outcomeCorrect = logEntry.text.includes("OUTCOME: correct");
            break;
          }
        }
        // Build per-dimension display data
        const gt = scene.groundTruth;
        const chosenActivity = activities[hubSceneWhatIdx] ?? SceneActivity.RoutineWork;
        const chosenOutcome = outcomes[hubSceneOutcomeIdx] ?? SceneOutcome.Unknown;
        const activityLabel = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        const crewList = state.mystery?.crew ?? [];
        const whoGt = gt.who.map(id => crewList.find(c => c.id === id)).filter(Boolean);
        hubSceneResult = {
          score,
          roomName: scene.roomName,
          timestamp: Date.now(),
          whoCorrect,
          whatCorrect,
          outcomeCorrect,
          whoAnswer: selectedCrew ? `${selectedCrew.firstName} ${selectedCrew.lastName}` : "None",
          whatAnswer: activityLabel(chosenActivity),
          outcomeAnswer: activityLabel(chosenOutcome),
          correctWho: whoGt.map(c => `${c!.firstName} ${c!.lastName}`).join(", ") || "Unknown",
          correctWhat: activityLabel(gt.what),
          correctOutcome: activityLabel(gt.outcome),
        };
        // Check IQ milestones after scene processing
        state = checkIQMilestones(state);
        // Exit process view after submission
        hubSceneSubView = "clues";
        hubSceneDetail = null;
      }
      renderInvestigationHub();
      return;
    }
    if (e.key === "n" || e.key === "N" || e.key === "Escape") {
      hubSceneConfirming = false;
      renderInvestigationHub();
      return;
    }
    return;
  }

  // Process sub-view (WHO/WHAT/OUTCOME selection)
  if (hubSceneDetail && hubSceneSubView === "process") {
    const focusCol = hubOptionIdx; // 0=WHO, 1=WHAT, 2=OUTCOME

    // Left/Right switch columns
    if (e.key === "ArrowLeft" || e.key === "a") {
      hubOptionIdx = Math.max(0, hubOptionIdx - 1);
      renderInvestigationHub();
      return;
    }
    if (e.key === "ArrowRight" || e.key === "d") {
      hubOptionIdx = Math.min(2, hubOptionIdx + 1);
      renderInvestigationHub();
      return;
    }

    // Up/Down within current column
    if (e.key === "ArrowUp" || e.key === "w") {
      if (focusCol === 0) hubSceneWhoIdx = Math.max(0, hubSceneWhoIdx - 1);
      else if (focusCol === 1) hubSceneWhatIdx = Math.max(0, hubSceneWhatIdx - 1);
      else hubSceneOutcomeIdx = Math.max(0, hubSceneOutcomeIdx - 1);
      renderInvestigationHub();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "s") {
      if (focusCol === 0) hubSceneWhoIdx = Math.min(crew.length - 1, hubSceneWhoIdx + 1);
      else if (focusCol === 1) hubSceneWhatIdx = Math.min(11, hubSceneWhatIdx + 1); // 12 activities
      else hubSceneOutcomeIdx = Math.min(6, hubSceneOutcomeIdx + 1); // 7 outcomes
      renderInvestigationHub();
      return;
    }

    // Enter submits
    if (e.key === "Enter") {
      hubSceneConfirming = true;
      renderInvestigationHub();
      return;
    }
    return;
  }

  // Scene detail view (clue list)
  if (hubSceneDetail) {
    const scene = scenes.find(s => s.roomId === hubSceneDetail);
    if (!scene) { hubSceneDetail = null; renderInvestigationHub(); return; }

    if (e.key === "ArrowUp" || e.key === "w") {
      hubIdx = Math.max(0, hubIdx - 1);
      renderInvestigationHub();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "s") {
      hubIdx = Math.min(scene.physicalClues.length - 1, hubIdx + 1);
      renderInvestigationHub();
      return;
    }
    // 'p' enters process mode
    if (e.key === "p" && !scene.processed && scene.physicalClues.some(c => c.examined)) {
      hubSceneSubView = "process";
      hubOptionIdx = 0; // start on WHO column
      hubSceneWhoIdx = 0;
      hubSceneWhatIdx = 0;
      hubSceneOutcomeIdx = 0;
      renderInvestigationHub();
      return;
    }
    return;
  }

  // Scene list view
  const maxIdx = scenes.length - 1;
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
  // Enter opens scene detail
  if (e.key === "Enter") {
    const scene = scenes[hubIdx];
    if (scene) {
      hubSceneDetail = scene.roomId;
      hubSceneSubView = "clues";
      hubIdx = 0;
      renderInvestigationHub();
    }
    return;
  }
}

function handleHubConnectionsInput(e: KeyboardEvent): void {
  const deductions = state.mystery?.deductions ?? [];
  const journal = state.mystery?.journal ?? [];
  const unlockedSet = new Set(getUnlockedDeductions(deductions, journal).map(d => d.id));

  // If in deduction detail/answer view
  if (hubDetailDeduction) {
    const deduction = deductions.find(d => d.id === hubDetailDeduction);
    if (!deduction || deduction.solved || !unlockedSet.has(deduction.id)) {
      hubDetailDeduction = null;
      renderInvestigationHub();
      return;
    }

    // Up/Down navigate answer options
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

    // Enter confirms with Y/N prompt
    if (e.key === "Enter") {
      const chosenOption = deduction.options[hubOptionIdx];
      const attemptsLeft = (deduction.maxAttempts ?? 2) - (deduction.wrongAttempts ?? 0);
      hubConfirming = true;
      const overlay = document.getElementById("broadcast-overlay");
      if (overlay) {
        const warningLine = attemptsLeft <= 1
          ? `<div style="color:#f44;font-size:13px;margin-bottom:8px;font-weight:bold">FINAL ATTEMPT — wrong answer locks out this deduction forever.</div>`
          : `<div style="color:#fa0;font-size:13px;margin-bottom:8px">Wrong answers cost 3 HP and 10 turns. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.</div>`;
        overlay.innerHTML = `
          <div class="broadcast-box">
            <div class="broadcast-title">\u2550\u2550\u2550 CONFIRM DEDUCTION \u2550\u2550\u2550</div>
            <div style="padding:20px;text-align:center">
              <div style="color:#fa0;font-size:16px;margin-bottom:12px">${esc(deduction.question)}</div>
              <div style="color:#fff;font-size:14px;margin-bottom:16px">Your answer: <span style="color:#6cf">${esc(chosenOption.label)}</span></div>
              ${warningLine}
              <div style="color:#aaa;font-size:14px">Are you sure? [Y] Confirm  [N] Go back</div>
            </div>
          </div>`;
      }
      return;
    }

    // Number keys select answer option
    const num = parseInt(e.key, 10);
    if (num >= 1 && num <= deduction.options.length) {
      hubOptionIdx = num - 1;
      renderInvestigationHub();
      return;
    }
    return;
  }

  // List view navigation — only unlocked deductions are selectable
  const selectableDeductions = deductions.filter(d => !d.solved && unlockedSet.has(d.id));
  const maxIdx = Math.max(0, selectableDeductions.length - 1);

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
    const d = selectableDeductions[hubIdx];
    if (d) {
      hubDetailDeduction = d.id;
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

  const chosen = deduction.options[hubOptionIdx];
  const { deduction: solved, correct, penalty } = solveDeduction(deduction, chosen.key, journal);

  state.mystery.deductions = state.mystery.deductions.map(d =>
    d.id === solved.id ? solved : d
  );

  if (correct) {
    display.addLog(`\u2713 CORRECT — ${solved.rewardDescription}`, "milestone");
    display.triggerScreenFlash("milestone");
    audio.playDeductionCorrect();
    applyDeductionReward(solved);

    // Find next unlocked deduction teaser + narrative bridge
    const nextDeduction = deductions.find(d => d.unlockAfter === solved.id && !d.solved);
    const nextTeaser = nextDeduction ? nextDeduction.question : undefined;
    if (nextDeduction) {
      // Check if next deduction is now actually unlocked (evidence count met)
      const nextUnlocked = getUnlockedDeductions(state.mystery!.deductions, journal);
      if (nextUnlocked.some(d => d.id === nextDeduction.id)) {
        display.addLog(`New line of inquiry: "${nextDeduction.question}"`, "narrative");
      } else {
        display.addLog(`Next question emerging... gather more evidence to proceed.`, "system");
      }
    }

    // Show cinematic overlay (same as commitDeductionAnswer)
    if (display.showDeductionResult) {
      display.showDeductionResult({
        type: "correct",
        question: deduction.question,
        chosenAnswer: chosen.label,
        conclusionText: solved.conclusionText,
        revelations: solved.tagRevelations,
        rewardText: solved.rewardDescription,
        nextDeductionTeaser: nextTeaser,
      });
    }

    pendingCeremonyDeduction = { id: solved.id, correct: true };
  } else {
    // Apply wrong-answer penalties
    if (penalty) {
      state.player = { ...state.player, hp: Math.max(0, state.player.hp - penalty.hp) };
      state = { ...state, turn: state.turn + penalty.turns };
    }

    const isLockout = solved.solved && !correct;
    const attemptsLeft = isLockout ? 0 : (solved.maxAttempts ?? 2) - (solved.wrongAttempts ?? 0);
    const correctOpt = isLockout ? deduction.options.find(o => o.correct) : undefined;

    if (isLockout) {
      display.addLog("Investigation stalled — insufficient evidence to continue this line of inquiry.", "warning");
    } else {
      display.addLog(`\u2717 Incorrect. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining. (-${penalty?.hp ?? 0} HP, +${penalty?.turns ?? 0} turns)`, "warning");
      if (deduction.hintText) {
        display.addLog(`CORVUS-7: ${deduction.hintText}`, "narrative");
      }
      if (attemptsLeft === 1) {
        display.addLog("This is your final attempt. Re-read the evidence carefully.", "warning");
      }
    }
    audio.playDeductionWrong();

    // Show cinematic overlay (same as commitDeductionAnswer)
    if (display.showDeductionResult) {
      display.showDeductionResult({
        type: isLockout ? "lockout" : "wrong",
        question: deduction.question,
        chosenAnswer: chosen.label,
        correctAnswer: isLockout && correctOpt ? correctOpt.label : undefined,
        penaltyHp: penalty?.hp,
        penaltyTurns: penalty?.turns,
        attemptsLeft: isLockout ? 0 : attemptsLeft,
        hintText: !isLockout ? deduction.hintText : undefined,
      });
    }

    pendingCeremonyDeduction = { id: solved.id, correct: false };
  }

  // Check if all deductions are now solved — trigger "Case Closed" cinematic
  const allSolved = deductions.every(d => d.solved);
  if (allSolved && display.showCaseClosed && state.mystery) {
    const mysteryData = state.mystery;
    const archetype = mysteryData.timeline.archetype;
    const deductionRecord = deductions.map(d => ({
      question: d.question,
      answer: (d.answeredCorrectly ? d.options.find(o => o.correct) : d.options.find(o => !o.correct))?.label ?? "—",
      correct: d.answeredCorrectly === true,
    }));
    const correctCount = deductions.filter(d => d.answeredCorrectly).length;
    setTimeout(() => {
      display.showCaseClosed!({
        archetypeTitle: getCaseClosedTitle(archetype),
        storySubtitle: getCaseClosedSubtitle(archetype),
        deductions: deductionRecord,
        storySummary: getCaseClosedSummary(archetype, mysteryData.crew, mysteryData.timeline),
        correctCount,
        totalCount: deductions.length,
        evidenceCount: journal.length,
      });
    }, 1500);
  }

  // Close hub detail view
  hubDetailDeduction = null;
  hubRevelationOverlay = false;
  renderInvestigationHub();
}


/** HTML-escape helper. */
function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Start: check for save or show opening crawl / title screen ───
/** Show seed input screen before starting a new game. */
function showSeedInput(onConfirm: (seed: number) => void): void {
  const defaultSeed = getNextSeed();
  let inputStr = String(defaultSeed);
  let cursorBlink = true;

  const DIFF_OPTIONS: { value: Difficulty; label: string; color: string; desc: string }[] = [
    { value: Difficulty.Easy, label: "EASY", color: "#4a4", desc: "HP +50% | Turns +30% | Damage -50%" },
    { value: Difficulty.Normal, label: "NORMAL", color: "#6cf", desc: "Standard parameters" },
    { value: Difficulty.Hard, label: "HARD", color: "#f44", desc: "HP -30% | Turns -30% | Damage +50%" },
  ];
  let diffIdx = DIFF_OPTIONS.findIndex(d => d.value === difficulty);
  if (diffIdx < 0) diffIdx = 1;

  const blinkInterval = setInterval(() => {
    cursorBlink = !cursorBlink;
    renderSeedInput();
  }, 500);

  function renderSeedInput(): void {
    const cursor = cursorBlink ? `<span style="color:#0fa">|</span>` : `<span style="opacity:0">|</span>`;
    const diff = DIFF_OPTIONS[diffIdx];
    const diffHtml = DIFF_OPTIONS.map((d, i) => {
      const selected = i === diffIdx;
      return `<span style="color:${selected ? d.color : '#334'};font-weight:${selected ? 'bold' : 'normal'};font-size:${selected ? '14px' : '11px'};padding:0 8px;${selected ? 'text-shadow:0 0 8px ' + d.color : ''}">${d.label}</span>`;
    }).join(`<span style="color:#222">|</span>`);

    crawlOverlay.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:20px;padding:48px">
        <div style="text-align:center">
          <div style="font-size:20px;font-weight:bold;color:#0fa;letter-spacing:4px;margin-bottom:8px">NEW INVESTIGATION</div>
          <div style="font-size:12px;color:#556">Configure your next mission</div>
        </div>
        <div style="background:rgba(0,255,180,0.05);border:1px solid rgba(0,255,180,0.3);border-radius:4px;padding:12px 24px;min-width:200px;text-align:center">
          <div style="font-size:10px;color:#556;margin-bottom:4px;letter-spacing:2px">SEED</div>
          <span style="font-size:24px;font-weight:bold;color:#0fa;letter-spacing:3px;font-family:monospace">${inputStr}${cursor}</span>
        </div>
        <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.08);border-radius:4px;padding:10px 16px;text-align:center">
          <div style="font-size:10px;color:#556;margin-bottom:6px;letter-spacing:2px">DIFFICULTY</div>
          <div style="display:flex;align-items:center;justify-content:center;gap:4px">
            <span style="color:#334;font-size:10px">\u25c0</span>
            ${diffHtml}
            <span style="color:#334;font-size:10px">\u25b6</span>
          </div>
          <div style="font-size:9px;color:${diff.color};margin-top:4px;opacity:0.7">${diff.desc}</div>
        </div>
        <div style="font-size:10px;color:#445;text-align:center">
          Type numbers to change seed | [Tab/\u2190\u2192] Difficulty<br>
          [Enter] Accept | [Backspace] Delete | [Esc] Random seed
        </div>
      </div>
    `;
  }

  renderSeedInput();

  const seedKeyHandler = (e: KeyboardEvent) => {
    e.preventDefault();
    if (e.key === "Enter") {
      clearInterval(blinkInterval);
      window.removeEventListener("keydown", seedKeyHandler);
      const parsed = parseInt(inputStr, 10);
      const finalSeed = isNaN(parsed) || parsed < 0 ? defaultSeed : parsed % 1000000;
      difficulty = DIFF_OPTIONS[diffIdx].value;
      onConfirm(finalSeed);
    } else if (e.key === "Escape") {
      // Random seed
      clearInterval(blinkInterval);
      window.removeEventListener("keydown", seedKeyHandler);
      difficulty = DIFF_OPTIONS[diffIdx].value;
      onConfirm(Math.floor(Math.random() * 1000000));
    } else if (e.key === "Backspace") {
      inputStr = inputStr.slice(0, -1);
      renderSeedInput();
    } else if (/^[0-9]$/.test(e.key) && inputStr.length < 6) {
      inputStr += e.key;
      renderSeedInput();
    } else if (e.key === "Tab" || e.key === "ArrowRight") {
      diffIdx = (diffIdx + 1) % DIFF_OPTIONS.length;
      renderSeedInput();
    } else if (e.key === "ArrowLeft") {
      diffIdx = (diffIdx - 1 + DIFF_OPTIONS.length) % DIFF_OPTIONS.length;
      renderSeedInput();
    }
  };
  window.addEventListener("keydown", seedKeyHandler);
}

function showTitleScreen(): void {
  crawlOverlay.style.display = "flex";
  let titleIdx = 0; // 0 = Continue, 1 = New Game
  const items = ["Continue", "New Game"];

  // Build run stats from history
  const history = getRunHistory();
  let statsHtml = "";
  if (history.length > 0) {
    const wins = history.filter(r => r.victory).length;
    const bestRating = history.reduce((best, r) => {
      const order = "SDCBA";
      return order.indexOf(r.rating) > order.indexOf(best) ? r.rating : best;
    }, "D");
    const archetypeShort: Record<string, string> = {
      coolant_cascade: "Whistleblower", hull_breach: "Murder", reactor_scram: "Rogue AI",
      sabotage: "Stowaway", signal_anomaly: "First Contact", mutiny: "The Divide",
    };
    const seenArchetypes = new Set(history.map(r => r.archetype));
    const archetypeList = [...seenArchetypes].map(a => archetypeShort[a] || a).join(", ");
    const rc = bestRating === "S" ? "#ff0" : bestRating === "A" ? "#0f0" : bestRating === "B" ? "#6cf" : bestRating === "C" ? "#fa0" : "#f44";

    // Achievement badges
    const achievements = getAchievements();
    const unlockedBadges = achievements.filter(a => a.unlockedAt);
    let badgeHtml = "";
    if (unlockedBadges.length > 0) {
      const badges = achievements.map(a => {
        if (a.unlockedAt) {
          return `<span title="${a.name}: ${a.description}" style="color:#0fa;cursor:help">[${a.icon}]</span>`;
        }
        return `<span title="${a.name}: ${a.description}" style="color:#222;cursor:help">[${a.icon}]</span>`;
      }).join(" ");
      badgeHtml = `<div style="font-size:12px;font-family:monospace;margin-top:6px;letter-spacing:1px">${badges}</div>`;
    }

    statsHtml = `
      <div style="border-top:1px solid #222;padding-top:12px;text-align:center;max-width:320px">
        <div style="font-size:10px;color:#445;letter-spacing:1.5px;margin-bottom:6px">MISSION LOG</div>
        <div style="font-size:11px;color:#667">Runs: ${history.length} | Wins: ${wins} | Best: <span style="color:${rc}">${bestRating}</span></div>
        <div style="font-size:10px;color:#445;margin-top:4px">Cases: ${archetypeList}</div>
        <div style="font-size:10px;color:#334;margin-top:2px">${seenArchetypes.size}/6 archetypes</div>
        ${badgeHtml}
      </div>
    `;
  }

  function renderTitle(): void {
    let menuHtml = "";
    for (let i = 0; i < items.length; i++) {
      const sel = i === titleIdx;
      const color = sel ? "#0fa" : "#556";
      const bg = sel ? "rgba(0,255,180,0.1)" : "transparent";
      const border = sel ? "1px solid rgba(0,255,180,0.3)" : "1px solid transparent";
      const arrow = sel ? `<span style="color:#0fa;margin-right:8px">&gt;</span>` : `<span style="margin-right:8px;opacity:0">&gt;</span>`;
      menuHtml += `<div style="padding:10px 24px;background:${bg};border:${border};border-radius:4px;color:${color};font-size:16px;cursor:pointer;transition:all 0.15s">${arrow}${items[i]}</div>`;
    }
    crawlOverlay.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;gap:32px;padding:48px">
        <div style="text-align:center">
          <div style="font-size:36px;font-weight:bold;color:#0fa;letter-spacing:8px;margin-bottom:8px">${STATION_NAME}</div>
          <div style="font-size:14px;color:#556;letter-spacing:2px">${STATION_SUBTITLE}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;min-width:200px">
          ${menuHtml}
        </div>
        ${statsHtml}
        <div style="font-size:10px;color:#334">[Up/Down] Navigate | [Enter] Select</div>
      </div>
    `;
  }

  renderTitle();

  const titleInput = (e: KeyboardEvent) => {
    e.preventDefault();
    if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
      titleIdx = (titleIdx - 1 + items.length) % items.length;
      renderTitle();
    } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
      titleIdx = (titleIdx + 1) % items.length;
      renderTitle();
    } else if (e.key === "Enter" || e.key === " ") {
      window.removeEventListener("keydown", titleInput);
      crawlOverlay.removeEventListener("click", titleClick);
      if (items[titleIdx] === "Continue") {
        // Load the save
        try {
          const loaded = loadGame();
          if (loaded) {
            state = loaded;
            seed = state.seed;
            gameStarted = true;
            crawlOverlay.style.display = "none";
            initGame();
            display.addLog("[Save loaded — resuming session]", "milestone");
            renderAll();
          } else {
            // Save was corrupt — start fresh
            deleteSave();
            state = generate(seed, difficulty);
            showOpeningCrawl();
          }
        } catch {
          deleteSave();
          state = generate(seed, difficulty);
          showOpeningCrawl();
        }
      } else {
        // New Game — show seed input, then start fresh
        deleteSave();
        showSeedInput((chosenSeed) => {
          seed = chosenSeed;
          stationMood = MOOD_TYPES[seed % 3];
          corvusPersonality = CORVUS_PERSONALITIES[(seed >> 2) % 3];
          try { localStorage.setItem(LAST_SEED_KEY, String(seed)); } catch { /* ignore */ }
          state = generate(seed, difficulty);
          showOpeningCrawl();
        });
      }
    }
  };
  const titleClick = () => {
    // Click selects current option
    const fakeEnter = new KeyboardEvent("keydown", { key: "Enter" });
    titleInput(fakeEnter);
  };
  window.addEventListener("keydown", titleInput);
  crawlOverlay.addEventListener("click", titleClick);
}

if (hasSave()) {
  showTitleScreen();
} else {
  showOpeningCrawl();
}
