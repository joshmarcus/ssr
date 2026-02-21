import { generate } from "./sim/procgen.js";
import { step, applyDeductionReward as applyDeductionRewardSim } from "./sim/step.js";
import { STORY_ROLES } from "./sim/deduction.js";
import { BrowserDisplay } from "./render/display.js";
import type { IGameDisplay } from "./render/displayInterface.js";
import type { LogType } from "./render/display.js";
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
import type { Action, MysteryChoice, Deduction, CrewMember } from "./shared/types.js";
import { ActionType, SensorType, EntityType, ObjectivePhase, DeductionCategory, Direction, Difficulty, IncidentArchetype, CrewRole, CrewFate } from "./shared/types.js";
import { computeChoiceEndings, computeBranchedEpilogue } from "./sim/mysteryChoices.js";
import { getUnlockedDeductions, solveDeduction, validateEvidenceLink, linkEvidence, getTagExplanation } from "./sim/deduction.js";
import { getRoomAt, getRoomCleanliness } from "./sim/rooms.js";
import { saveGame, loadGame, hasSave, deleteSave, recordRun } from "./sim/saveLoad.js";
import { isEntityExhausted } from "./shared/ui.js";
import { generateWhatWeKnow, formatRelationship, formatCrewMemberDetail, getDeductionsForEntry } from "./sim/whatWeKnow.js";

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
const difficulty: Difficulty = difficultyParam === "easy" ? Difficulty.Easy
  : difficultyParam === "hard" ? Difficulty.Hard
  : Difficulty.Normal;

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
// Persist initial seed for next-game sequencing
try { localStorage.setItem(LAST_SEED_KEY, String(seed)); } catch { /* ignore */ }
let state = generate(seed, difficulty);
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
let crewDistressHintShown = false;
let breachProximityHintShown = false;
let cleanMsgIndex = 0;
let lastAmbientRoomId = "";
let currentRoomTurns = 0; // turns spent in current room (for ambient events)
let lastRoomIdForAmbient = ""; // track room changes for ambient counter
const escortArcSteps = new Map<string, number>(); // track escort dialogue arc step per crew NPC
const corridorAmbientFired = new Set<string>(); // track corridor segments that have triggered ambient text
let lastCorridorAmbientTurn = 0; // cooldown: don't fire corridor ambient more than once per 20 turns
let lastJournalLength = 0; // track journal size for insight notifications
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
let incidentCardOpen = false;
// ── Investigation Hub state ──────────────────────────────────────
let investigationHubOpen = false;
let hubSection: "evidence" | "connections" | "whatweknow" = "evidence";
let hubIdx = 0;                       // selected item index within current section
let hubOptionIdx = 0;                 // selected option within a deduction/choice
let hubLinkedEvidence: string[] = [];  // evidence IDs linked to a deduction
let hubDetailDeduction: string | null = null; // deduction ID in evidence-linking mode
let hubEvidenceIdx = 0;               // evidence entry index in linking mode
let hubConfirming = false;            // Y/N confirmation for deduction answer
let hubLinkFeedback = "";             // feedback message after toggling evidence
let hubFocusRegion: "evidence" | "answers" = "evidence"; // focus region in connection detail view
let hubRevelationOverlay = false; // showing post-answer revelation overlay
let pendingCeremonyDeduction: { id: string; correct: boolean } | null = null; // for post-overlay CORVUS-7 commentary
let lastWwkJournalCount = 0; // journal count when WHAT WE KNOW was last viewed
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
    display.addLog("All accessible areas explored. Time to investigate — press [r] for Investigation Hub.", "milestone");
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

    // Tension-based room entry flavor — fires on every room change (not just first visit)
    // Only after turn 100, escalating frequency with turn count
    if (state.turn >= 100) {
      const tensionMsg = getTensionFlavor(state.turn, currentRoom.name);
      if (tensionMsg) display.addLog(tensionMsg, "narrative");
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
  display = (is3D && BrowserDisplay3D)
    ? new BrowserDisplay3D(containerEl, state.width, state.height)
    : new BrowserDisplay(containerEl, state.width, state.height);

  // ── Dramatic link establishment sequence (compact) ──────────────
  display.addLog("LINK ACTIVE — Low-bandwidth terminal feed. Rover A3 online.", "milestone");
  display.addLog(MOOD_FLAVOR[stationMood], "narrative");
  display.addLog(CORVUS_GREETING[corvusPersonality], "narrative");

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
    if (incidentCardOpen) {
      if (e.key === "Escape" || e.key === "g") {
        e.preventDefault();
        incidentCardOpen = false;
        const overlay = document.getElementById("journal-overlay");
        if (overlay) { overlay.classList.remove("active"); overlay.innerHTML = ""; }
      }
      return; // swallow all input while incident card is open
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
    // Escape: restart confirmation (two-press)
    if (e.key === "Escape" && !state.gameOver) {
      e.preventDefault();
      if (restartPending) {
        // Second Escape — restart with next seed
        restartPending = false;
        const newSeed = (seed + 1) % 1000000;
        resetGameState(newSeed);
        gameStarted = false;
        showOpeningCrawl();
        return;
      }
      restartPending = true;
      display.addLog("Press Escape again for New Game, or any other key to cancel.", "warning");
      renderAll();
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
    // Any non-Escape key cancels restart prompt
    if (restartPending) {
      restartPending = false;
      display.addLog("Restart cancelled.", "system");
      renderAll();
      // Don't return — let the key do its normal action too
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
    // G key toggles incident summary card
    if (e.key === "g" && !journalOpen && !investigationHubOpen && !state.gameOver) {
      e.preventDefault();
      incidentCardOpen = !incidentCardOpen;
      if (incidentCardOpen) {
        showIncidentCard();
      } else {
        const overlay = document.getElementById("journal-overlay");
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
  display.renderUI(state, uiPanel, visitedRoomIds);
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
  lastPlayerRoomId = "";
  visitedRoomIds.clear();
  journalOpen = false;
  activeChoice = null;
  investigationHubOpen = false;
  restartPending = false;
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
  currentRoomTurns = 0;
  lastRoomIdForAmbient = "";
  escortArcSteps.clear();
  corridorAmbientFired.clear();
  lastCorridorAmbientTurn = 0;
  lastJournalLength = 0;
  mapOpen = false;
  helpOpen = false;
  incidentCardOpen = false;
  activeDeduction = null;
  deductionSelectedIdx = 0;
  confirmingDeduction = false;
  pendingCeremonyDeduction = null;
  hubSection = "evidence";
  hubOptionIdx = 0;
  hubLinkedEvidence = [];
  hubDetailDeduction = null;
  hubEvidenceIdx = 0;
  hubConfirming = false;
  hubLinkFeedback = "";
  hubIdx = 0;
  lastWwkJournalCount = 0;
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
  display = (is3D && BrowserDisplay3D)
    ? new BrowserDisplay3D(containerEl, state.width, state.height)
    : new BrowserDisplay(containerEl, state.width, state.height);
}

function handleRestartKey(e: KeyboardEvent): void {
  if (!state.gameOver) return;
  if (e.key === "r" || e.key === "R") {
    e.preventDefault();
    resetGameState(seed);
    display.addLog("RESTARTING LINK...", "system");
    display.addLog("Rover A3 rebooted. All systems reset.", "milestone");
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
    const newSeed = (seed + 1) % 1000000;
    resetGameState(newSeed);
    // Show full opening crawl for the new storyline
    gameStarted = false;
    showOpeningCrawl();
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

  const prevTurn = state.turn;
  const prevLogs = state.logs.length;
  const prevHp = state.player.hp;
  const prevStun = state.player.stunTurns;
  const ppx = state.player.entity.pos.x;
  const ppy = state.player.entity.pos.y;
  const prevDirt = state.tiles[ppy]?.[ppx]?.dirt ?? 0;
  const hadEvacFarewell = state.milestones.has("corvus_evac_farewell");
  state = step(state, action);

  // Start background music on first player interaction
  audio.startBgMusic();

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
  if (state.logs.length > prevLogs) {
    let hasPA = false;
    for (let i = prevLogs; i < state.logs.length; i++) {
      const simLog = state.logs[i];
      const logType = classifySimLog(simLog.text, simLog.source);
      display.addLog(simLog.text, logType);
      if (simLog.text.startsWith("CORVUS-7 CENTRAL:")) hasPA = true;
      // Feed to TTS if enabled
      audio.speak(simLog.text);
    }
    if (hasPA) audio.playPA();
    // Interaction produced logs -- play interact sound + colored tile flash
    if (action.type === ActionType.Interact) {
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
      if (action.targetId) {
        const target = state.entities.get(action.targetId);
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
    if (action.type === ActionType.Interact || action.type === ActionType.Scan) {
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
    // Evidence insight notification: fire when new journal entry contributes tags to an unlocked deduction
    if (state.mystery.journal.length > lastJournalLength) {
      const journal = state.mystery.journal;
      const newEntries = journal.slice(lastJournalLength);
      const newTags = new Set(newEntries.flatMap(j => j.tags));
      lastJournalLength = journal.length;
      // Check if any unsolved deduction gained new tag coverage
      const solvedIds = new Set(state.mystery.deductions.filter(d => d.solved).map(d => d.id));
      let insightFired = false;
      for (const d of state.mystery.deductions) {
        if (d.solved) continue;
        if (d.unlockAfter && !solvedIds.has(d.unlockAfter)) continue;
        const relevantNewTags = d.requiredTags.filter(t => newTags.has(t));
        if (relevantNewTags.length > 0) {
          const allTags = new Set(journal.flatMap(j => j.tags));
          const covered = d.requiredTags.filter(t => allTags.has(t)).length;
          const total = d.requiredTags.length;
          if (covered === total && !insightFired) {
            display.addLog(`CORVUS-7 CENTRAL: Evidence cross-referenced. All data assembled for a deduction. Open CONNECTIONS [v].`, "milestone");
            audio.playDeductionReady();
            insightFired = true;
          } else if (!insightFired) {
            display.addLog(`CORVUS-7 CENTRAL: New evidence cross-referenced — ${covered}/${total} data points for active investigation.`, "system");
            insightFired = true;
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
    for (let ci = 0; ci < state.mystery.choices.length && ci < choiceThresholds.length; ci++) {
      const choice = state.mystery.choices[ci];
      if (choice.chosen) continue;
      if (state.mystery.journal.length >= choiceThresholds[ci] && !choicesPresented.has(choice.id)) {
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
    audio.stopBgMusic(); // Stop background music

    // Record run in history
    const deds = state.mystery?.deductions ?? [];
    const evac = state.mystery?.evacuation;
    const hpPct = Math.round((state.player.hp / state.player.maxHp) * 100);
    const dedsCorrect = deds.filter(d => d.answeredCorrectly).length;
    const crewEvac = evac?.crewEvacuated.length ?? 0;
    const crewDead = evac?.crewDead.length ?? 0;
    let crewTotal = crewEvac + crewDead;
    for (const [, e] of state.entities) { if (e.type === EntityType.CrewNPC) crewTotal++; }
    // Scoring matches display.ts showGameOverOverlay — keep in sync
    let sc = 0;
    if (state.victory) sc += 30;
    sc += Math.min(20, dedsCorrect * (20 / Math.max(deds.length, 1)));
    if (crewTotal > 0) sc += Math.min(20, (crewEvac / crewTotal) * 20);
    sc += Math.min(10, (visitedRoomIds.size / Math.max(state.rooms.length, 1)) * 10);
    sc += Math.min(10, (hpPct / 100) * 10);
    sc += Math.min(10, state.victory && state.turn < 200 ? 10 : state.victory && state.turn < 350 ? 5 : 0);
    const runRating = sc >= 90 ? "S" : sc >= 75 ? "A" : sc >= 55 ? "B" : sc >= 35 ? "C" : "D";
    recordRun(state, runRating);

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
          <div><span style="color:#fff">[Tab]</span>  Auto-explore (any key to stop)</div>
        </div>

        <div>
          <div style="color:#4af;font-weight:bold;margin-bottom:6px">── Menus & Info ──</div>
          <div><span style="color:#fff">[r]</span>  Investigation Hub (evidence, deductions, narrative)</div>
          <div><span style="color:#fff">[v]</span>  Investigation Hub → Evidence</div>
          <div><span style="color:#fff">[;]</span>  Quick journal toggle</div>
          <div><span style="color:#fff">[g]</span>  Incident summary card</div>
          <div><span style="color:#fff">[m]</span>  Station map overlay</div>
          <div><span style="color:#fff">[?]</span>  This help screen</div>
        </div>

        <div>
          <div style="color:#4af;font-weight:bold;margin-bottom:6px">── In Menus ──</div>
          <div><span style="color:#fff">[Tab]</span>  Switch sections / tabs</div>
          <div><span style="color:#fff">[Enter]</span>  Submit deduction answer</div>
          <div><span style="color:#fff">[Y] / [N]</span>  Confirm or cancel prompts</div>
          <div><span style="color:#fff">[Esc]</span>  Close overlay / New Game (press twice)</div>
          <div><span style="color:#fff">[R]</span>  Replay same seed (game over)</div>
          <div><span style="color:#fff">[N]</span>  New Game (game over)</div>
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
  const tabs: Array<"evidence" | "connections" | "whatweknow"> = ["evidence", "connections", "whatweknow"];
  const newEvidenceCount = entries.length - lastEvidenceViewCount;
  const newBadge = newEvidenceCount > 0 && hubSection !== "evidence"
    ? ` <span style="color:#0f0;font-size:10px">+${newEvidenceCount} new</span>` : "";
  const tabLabels: Record<string, string> = {
    evidence: `EVIDENCE (${entries.length})${newBadge}`,
    connections: `CONNECTIONS (${deductions.filter(d => d.solved).length}/${deductions.length})`,
    whatweknow: "WHAT WE KNOW",
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
  } else if (hubSection === "connections") {
    bodyHtml = renderHubConnections(deductions, journal);
  } else if (hubSection === "whatweknow") {
    bodyHtml = renderHubWhatWeKnow();
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

  // Progress summary
  const solvedCount = deductions.filter(d => d.solved).length;
  const correctCount = deductions.filter(d => d.answeredCorrectly).length;
  const progressColor = solvedCount === deductions.length ? "#0f0" : solvedCount > 0 ? "#fa0" : "#888";
  let listHtml = `<div style="color:${progressColor};padding:4px 8px;font-size:12px;border-bottom:1px solid #333;margin-bottom:4px">DEDUCTIONS: ${solvedCount}/${deductions.length} solved${correctCount > 0 ? ` (${correctCount} correct)` : ""}</div>`;

  for (let di = 0; di < deductions.length; di++) {
    const d = deductions[di];
    const isUnlocked = unlockedSet.has(d.id);
    const locked = !d.solved && !isUnlocked;
    const isActive = di === hubIdx;

    const tierLabel = `Tier ${di + 1}`;
    const catLabel = categoryLabels[d.category] || d.category.toUpperCase();
    let statusIcon: string;
    let statusColor: string;

    if (d.solved) {
      statusIcon = d.answeredCorrectly ? "\u2713" : "\u2717";
      statusColor = d.answeredCorrectly ? "#0f0" : "#f44";
    } else if (isUnlocked) {
      statusIcon = "\u25c7"; // diamond
      statusColor = "#fa0";
    } else {
      statusIcon = "\u25cb"; // circle
      statusColor = "#555";
    }

    let sectionClass = "broadcast-deduction";
    if (locked) sectionClass += " locked";
    if (d.solved) sectionClass += " solved";
    if (isActive) sectionClass += " active-section";

    listHtml += `<div class="${sectionClass}">`;
    listHtml += `<div class="broadcast-section-title"><span style="color:${statusColor}">[${statusIcon}]</span> <span style="color:#888;font-size:11px">${tierLabel}</span> ${catLabel}</div>`;

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

    // Tag pills + "all met" prompt
    if (!locked) {
      let tagPillsHtml = "";
      let allMet = true;
      for (const tag of d.requiredTags) {
        if (allTags.has(tag)) {
          tagPillsHtml += `<span class="tag-pill tag-covered">${esc(tag)}</span>`;
        } else {
          tagPillsHtml += `<span class="tag-pill tag-missing">${esc(tag)}</span>`;
          allMet = false;
        }
      }
      listHtml += `<div style="margin:2px 8px">${tagPillsHtml}</div>`;
      if (allMet && isUnlocked && !d.solved) {
        listHtml += `<div style="color:#fd0;padding:2px 8px;font-size:11px;font-weight:bold">ALL EVIDENCE GATHERED — ready to submit answer</div>`;
      } else if (!allMet && isUnlocked && !d.solved) {
        const missing = d.requiredTags.filter(t => !allTags.has(t));
        listHtml += `<div style="color:#888;padding:2px 8px;font-size:10px">Still needed: ${missing.map(t => esc(t)).join(", ")}</div>`;
      }
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

  // Contextual guidance based on tag coverage
  if (!allCovered && missingTags.length > 0 && hubLinkedEvidence.length > 0) {
    const missingCategories = missingTags.map(t => {
      const explanation = getTagExplanation(t, state.mystery?.timeline.archetype);
      return explanation ? `${t}` : t;
    });
    html += `<div style="color:#886;font-size:10px;margin-bottom:4px;padding:3px 6px;background:#1a1800;border-left:2px solid #886">\u26a0 Missing evidence categories: <span style="color:#fa0">${missingCategories.map(c => esc(c)).join(", ")}</span></div>`;
  } else if (allCovered && !deduction.solved) {
    html += `<div style="color:#4a4;font-size:10px;margin-bottom:4px;padding:3px 6px;background:#0a1a0a;border-left:2px solid #0f0">\u2713 All evidence requirements met. Press [Tab] to switch to answers and submit.</div>`;
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
    const checkbox = isLinked ? `<span style="color:#0f0">[+]</span>` : `<span style="color:#555">[ ]</span>`;
    const isSelected = ji === hubEvidenceIdx;
    const linkedStyle = isLinked && !isSelected ? "color:#8c8;" : "";
    const highlight = isSelected && inEvidenceFocus ? "color:#fff;font-weight:bold;background:#1a1a2a;" : isSelected ? "color:#ccc;background:#111;" : linkedStyle;
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
  const confidenceLabels: Record<string, string> = {
    none: "INSUFFICIENT DATA", low: "PRELIMINARY", medium: "DEVELOPING", high: "SUBSTANTIAL", complete: "CONCLUSIVE",
  };
  const confidenceColor = confidenceColors[wwk.confidence] || "#888";
  const confidenceLabel = confidenceLabels[wwk.confidence] || wwk.confidence.toUpperCase();

  // Track new evidence since last visit
  const currentJournalCount = state.mystery.journal.length;
  const newEntries = currentJournalCount - lastWwkJournalCount;
  lastWwkJournalCount = currentJournalCount;
  const updateBadge = newEntries > 0
    ? ` <span style="color:#4af;font-size:11px;margin-left:8px">+${newEntries} new evidence since last analysis</span>`
    : "";

  let html = `<div style="overflow-y:auto;max-height:calc(100% - 80px);padding:12px 16px">`;
  html += `<div style="margin-bottom:12px"><span style="color:${confidenceColor};font-weight:bold;font-size:14px">\u25C9 ${confidenceLabel}</span>${updateBadge}</div>`;

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
  // Close hub
  if (e.key === "Escape" || (e.key === "r" && !hubDetailDeduction) || (e.key === "v" && hubSection === "evidence" && !hubDetailDeduction)) {
    closeInvestigationHub();
    return;
  }

  // Tab cycles sections
  if (e.key === "Tab" && !hubDetailDeduction) {
    const tabs: Array<"evidence" | "connections" | "whatweknow"> = ["evidence", "connections", "whatweknow"];
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

              // CORVUS-7 witness commentary on evidence linking
              const witnessArchetype = state.mystery?.timeline?.archetype;
              if (witnessArchetype) {
                const deductionPrefix = deduction.id.replace(/_[0-9]+$/, ""); // e.g. "deduction_what"
                const pool = CORVUS_WITNESS_COMMENTARY[witnessArchetype]?.[deductionPrefix];
                if (pool && pool.length > 0) {
                  const linkedCount = hubLinkedEvidence.length;
                  const line = pool[(linkedCount - 1) % pool.length];
                  display.addLog(line, "narrative");
                }
              }
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

    pendingCeremonyDeduction = { id: solved.id, correct: true };
    if (devModeEnabled) {
      display.addLog(`[DEV] Deduction ${solved.id} solved correctly`, "system");
    }
  } else {
    display.addLog(`\u2717 Incorrect. The evidence doesn't support that conclusion.`, "warning");
    audio.playDeductionWrong();
    pendingCeremonyDeduction = { id: solved.id, correct: false };

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


/** HTML-escape helper. */
function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ── Start: check for save or show opening crawl ─────────────────
let savedState: ReturnType<typeof loadGame> = null;
try {
  savedState = hasSave() ? loadGame() : null;
} catch {
  // Corrupt save — delete it and start fresh
  console.warn("[browser] Save load crashed — starting fresh game");
  deleteSave();
  savedState = null;
}

if (savedState) {
  try {
    state = savedState;
    gameStarted = true;
    initGame();
    // display is now assigned by initGame
    display.addLog("[Save loaded — resuming session]", "milestone");
    renderAll();
  } catch (err) {
    // State loaded but is structurally broken — start fresh
    console.warn("[browser] Loaded save caused crash — starting fresh game:", err);
    deleteSave();
    state = generate(seed, difficulty);
    initGame(); // Re-init display for the fresh state
    showOpeningCrawl();
  }
} else {
  showOpeningCrawl();
}
