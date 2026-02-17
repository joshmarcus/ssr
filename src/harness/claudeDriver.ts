/**
 * Claude AI Driver for SSR — Autonomous game-playing via the Anthropic Messages API.
 *
 * This module connects the game simulation directly to Claude, allowing the AI
 * to play the roguelike autonomously for playtesting purposes.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... tsx src/harness/claudeDriver.ts [--seed N] [--max-turns N] [--verbose] [--model MODEL]
 */

import { generate } from "../sim/procgen.js";
import { step } from "../sim/step.js";
import { isValidAction } from "../sim/actions.js";
import { GOLDEN_SEED } from "../shared/constants.js";
import type {
  GameState, Action, Entity, Room, Position,
} from "../shared/types.js";
import {
  ActionType, Direction, EntityType, AttachmentSlot, SensorType,
} from "../shared/types.js";
import type { HarnessObservation, PoiEntry, ValidAction } from "./types.js";

// ── Configuration ────────────────────────────────────────────

const DEFAULT_MODEL = "claude-sonnet-4-5-20250929";
const DEFAULT_MAX_TURNS = 200;
const API_ENDPOINT = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const MAX_TOKENS = 200;
const CONVERSATION_WINDOW = 5; // keep last N turns of context
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

// ── Result types ─────────────────────────────────────────────

interface GameResult {
  victory: boolean;
  turns: number;
  finalHp: number;
  roomsVisited: number;
  actions: Array<{ turn: number; observation: string; action: string }>;
  error?: string;
}

// ── Observation builder (inline fallback) ────────────────────
// If obsRenderer.js exists, you can swap these out for the real implementations.

function getRoomAt(state: GameState, pos: Position): Room | null {
  for (const room of state.rooms) {
    if (
      pos.x >= room.x && pos.x < room.x + room.width &&
      pos.y >= room.y && pos.y < room.y + room.height
    ) {
      return room;
    }
  }
  return null;
}

function manhattan(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function entityDisplayName(entity: Entity): string {
  const names: Record<string, string> = {
    [EntityType.Relay]: "Power Relay",
    [EntityType.SensorPickup]: "Sensor Pickup",
    [EntityType.DataCore]: "Data Core",
    [EntityType.ServiceBot]: "Service Bot",
    [EntityType.LogTerminal]: "Log Terminal",
    [EntityType.CrewItem]: "Crew Item",
    [EntityType.Drone]: "Drone",
    [EntityType.MedKit]: "Med Kit",
    [EntityType.RepairBot]: "Repair Bot",
    [EntityType.Breach]: "Hull Breach",
    [EntityType.ClosedDoor]: "Closed Door",
    [EntityType.SecurityTerminal]: "Security Terminal",
    [EntityType.PatrolDrone]: "Patrol Drone",
    [EntityType.PressureValve]: "Pressure Valve",
    [EntityType.FuseBox]: "Fuse Box",
    [EntityType.PowerCell]: "Power Cell",
    [EntityType.EvidenceTrace]: "Evidence Trace",
    [EntityType.RadiationSource]: "Radiation Source",
    [EntityType.ShieldGenerator]: "Shield Generator",
    [EntityType.ReinforcementPanel]: "Reinforcement Panel",
    [EntityType.SignalBooster]: "Signal Booster",
    [EntityType.HiddenDevice]: "Hidden Device",
    [EntityType.EscapePod]: "Escape Pod",
    [EntityType.CrewNPC]: "Crew NPC",
    [EntityType.RepairCradle]: "Repair Cradle",
    [EntityType.Rubble]: "Rubble",
  };
  return names[entity.type] ?? entity.type;
}

function isEntityExhaustedSimple(entity: Entity): boolean {
  switch (entity.type) {
    case EntityType.Breach:
      return entity.props["sealed"] === true;
    case EntityType.MedKit:
      return entity.props["used"] === true;
    case EntityType.Relay:
      return entity.props["activated"] === true || entity.props["locked"] === true;
    case EntityType.ClosedDoor:
      return entity.props["closed"] === false;
    case EntityType.CrewItem:
      return entity.props["examined"] === true || entity.props["hidden"] === true;
    case EntityType.PressureValve:
      return entity.props["turned"] === true;
    case EntityType.FuseBox:
      return entity.props["powered"] === true;
    case EntityType.PowerCell:
      return entity.props["collected"] === true;
    case EntityType.PatrolDrone:
    case EntityType.Drone:
    case EntityType.RepairBot:
      return true;
    default:
      return false;
  }
}

function buildObservation(state: GameState, _visibility: "full" | "player" = "full"): HarnessObservation {
  const px = state.player.entity.pos.x;
  const py = state.player.entity.pos.y;
  const playerPos = { x: px, y: py };

  // Current room
  const room = getRoomAt(state, playerPos);
  const currentRoom = room ? room.name : "Corridor";

  // Sensors
  const sensors: string[] = [];
  let activeSensor: string | null = null;
  for (const slot of Object.values(AttachmentSlot)) {
    const att = state.player.attachments[slot];
    if (att?.sensorType) {
      sensors.push(att.sensorType);
      activeSensor = activeSensor ?? att.sensorType;
    }
  }

  // Map rendering — centered on player, 21x15 viewport
  const viewW = 21;
  const viewH = 15;
  const halfW = Math.floor(viewW / 2);
  const halfH = Math.floor(viewH / 2);
  const mapLines: string[] = [];
  for (let dy = -halfH; dy <= halfH; dy++) {
    let row = "";
    for (let dx = -halfW; dx <= halfW; dx++) {
      const mx = px + dx;
      const my = py + dy;
      if (dx === 0 && dy === 0) {
        row += "@";
      } else if (mx < 0 || mx >= state.width || my < 0 || my >= state.height) {
        row += " ";
      } else {
        // Check for entities at this position
        let entityGlyph: string | null = null;
        for (const [, entity] of state.entities) {
          if (entity.pos.x === mx && entity.pos.y === my && entity.id !== "player") {
            entityGlyph = entity.props["glyph"] as string ?? glyphForType(entity.type);
            break;
          }
        }
        row += entityGlyph ?? state.tiles[my][mx].glyph;
      }
    }
    mapLines.push(row);
  }
  const mapText = mapLines.join("\n");

  // Visible entities (points of interest)
  const poi: PoiEntry[] = [];
  for (const [, entity] of state.entities) {
    if (entity.id === "player") continue;
    const dist = manhattan(playerPos, entity.pos);
    if (dist > 12) continue; // only nearby entities
    const interactable = dist <= 1 && !isEntityExhaustedSimple(entity);
    const attrs: Record<string, unknown> = {};
    if (entity.props["activated"] !== undefined) attrs["activated"] = entity.props["activated"];
    if (entity.props["sealed"] !== undefined) attrs["sealed"] = entity.props["sealed"];
    if (entity.props["used"] !== undefined) attrs["used"] = entity.props["used"];
    if (entity.props["closed"] !== undefined) attrs["closed"] = entity.props["closed"];
    if (entity.props["locked"] !== undefined) attrs["locked"] = entity.props["locked"];
    if (entity.props["powered"] !== undefined) attrs["powered"] = entity.props["powered"];
    if (entity.props["sensorType"] !== undefined) attrs["sensorType"] = entity.props["sensorType"];
    poi.push({
      id: entity.id,
      type: entity.type,
      name: entityDisplayName(entity),
      pos: { x: entity.pos.x, y: entity.pos.y },
      distance: dist,
      interactable,
      attrs,
    });
  }
  poi.sort((a, b) => a.distance - b.distance);

  // Valid actions
  const validActions: ValidAction[] = [];

  // Movement directions
  const dirs: Array<{ dir: Direction; label: string }> = [
    { dir: Direction.North, label: "N" },
    { dir: Direction.South, label: "S" },
    { dir: Direction.East, label: "E" },
    { dir: Direction.West, label: "W" },
    { dir: Direction.NorthEast, label: "NE" },
    { dir: Direction.NorthWest, label: "NW" },
    { dir: Direction.SouthEast, label: "SE" },
    { dir: Direction.SouthWest, label: "SW" },
  ];
  for (const { dir, label } of dirs) {
    const moveAction: Action = { type: ActionType.Move, direction: dir };
    if (isValidAction(state, moveAction)) {
      validActions.push({
        type: "MOVE",
        params: { dir: label },
        description: `Move ${label}`,
      });
    }
  }

  // Interact with nearby entities
  for (const p of poi) {
    if (p.interactable) {
      validActions.push({
        type: "INTERACT",
        params: { target: p.id },
        description: `Interact with ${p.name} (${p.id})`,
      });
    }
  }

  // Always-available actions
  validActions.push({ type: "SCAN", description: "Scan surroundings with active sensor" });
  validActions.push({ type: "CLEAN", description: "Clean the current tile" });
  validActions.push({ type: "WAIT", description: "Wait one turn" });

  // Recent logs
  const recentLogs = state.logs.slice(-5).map(l => l.text);

  // Alerts
  const alerts: string[] = [];
  const tile = state.tiles[py][px];
  if (tile.heat > 30) alerts.push(`WARNING: High heat (${tile.heat}) at your position!`);
  if (tile.smoke > 30) alerts.push(`WARNING: Smoke detected (${tile.smoke}) at your position!`);
  if (tile.pressure < 60) alerts.push(`WARNING: Low pressure (${tile.pressure}) at your position!`);
  if (tile.radiation > 40) alerts.push(`WARNING: Radiation detected (${tile.radiation}) at your position!`);
  if (tile.stress > 60) alerts.push(`WARNING: Structural stress (${tile.stress}) at your position!`);
  if (state.player.hp < 30) alerts.push(`CRITICAL: Low HP (${state.player.hp}/${state.player.maxHp})!`);
  if (state.stationIntegrity < 40) alerts.push(`ALERT: Station integrity at ${state.stationIntegrity}%!`);

  return {
    turn: state.turn,
    seed: state.seed,
    gameOver: state.gameOver,
    victory: state.victory,
    hp: state.player.hp,
    maxHp: state.player.maxHp,
    pos: playerPos,
    currentRoom,
    sensors,
    activeSensor,
    stationIntegrity: Math.round(state.stationIntegrity),
    objectivePhase: state.mystery?.objectivePhase ?? "clean",
    mapText,
    poi,
    validActions,
    recentLogs,
    alerts,
  };
}

function glyphForType(type: EntityType): string {
  const map: Partial<Record<EntityType, string>> = {
    [EntityType.Relay]: "R",
    [EntityType.SensorPickup]: "S",
    [EntityType.DataCore]: "D",
    [EntityType.ServiceBot]: "B",
    [EntityType.LogTerminal]: "T",
    [EntityType.CrewItem]: "*",
    [EntityType.Drone]: "d",
    [EntityType.MedKit]: "+",
    [EntityType.RepairBot]: "r",
    [EntityType.Breach]: "O",
    [EntityType.ClosedDoor]: "|",
    [EntityType.SecurityTerminal]: "C",
    [EntityType.PatrolDrone]: "P",
    [EntityType.PressureValve]: "V",
    [EntityType.FuseBox]: "F",
    [EntityType.PowerCell]: "H",
    [EntityType.EvidenceTrace]: "?",
    [EntityType.RadiationSource]: "!",
    [EntityType.ShieldGenerator]: "G",
    [EntityType.ReinforcementPanel]: "#",
    [EntityType.SignalBooster]: "~",
    [EntityType.HiddenDevice]: "h",
    [EntityType.EscapePod]: "E",
    [EntityType.CrewNPC]: "N",
    [EntityType.RepairCradle]: "c",
    [EntityType.Rubble]: "%",
  };
  return map[type] ?? "?";
}

function renderObservationAsText(obs: HarnessObservation): string {
  const lines: string[] = [];

  lines.push(`=== TURN ${obs.turn} ===`);
  lines.push(`Location: ${obs.currentRoom} | Position: (${obs.pos.x}, ${obs.pos.y})`);
  lines.push(`HP: ${obs.hp}/${obs.maxHp} | Station Integrity: ${obs.stationIntegrity}%`);
  lines.push(`Objective: ${obs.objectivePhase}`);
  if (obs.sensors.length > 0) {
    lines.push(`Sensors: ${obs.sensors.join(", ")}`);
  }

  if (obs.alerts.length > 0) {
    lines.push("");
    for (const alert of obs.alerts) {
      lines.push(alert);
    }
  }

  lines.push("");
  lines.push("--- MAP (@ = you) ---");
  lines.push(obs.mapText);

  if (obs.poi.length > 0) {
    lines.push("");
    lines.push("--- NEARBY ENTITIES ---");
    for (const p of obs.poi.slice(0, 15)) {
      const inter = p.interactable ? " [INTERACTABLE]" : "";
      const attrStr = Object.keys(p.attrs).length > 0
        ? ` (${Object.entries(p.attrs).map(([k, v]) => `${k}=${v}`).join(", ")})`
        : "";
      lines.push(`  ${p.name} (${p.id}) @ (${p.pos.x},${p.pos.y}) dist=${p.distance}${inter}${attrStr}`);
    }
  }

  lines.push("");
  lines.push("--- VALID ACTIONS ---");
  for (const a of obs.validActions) {
    const paramStr = a.params ? ` ${JSON.stringify(a.params)}` : "";
    lines.push(`  ${a.type}${paramStr} — ${a.description}`);
  }

  if (obs.recentLogs.length > 0) {
    lines.push("");
    lines.push("--- RECENT LOGS ---");
    for (const log of obs.recentLogs) {
      lines.push(`  ${log}`);
    }
  }

  return lines.join("\n");
}

// ── Action parser ────────────────────────────────────────────

const DIR_MAP: Record<string, Direction> = {
  N: Direction.North,
  S: Direction.South,
  E: Direction.East,
  W: Direction.West,
  NE: Direction.NorthEast,
  NW: Direction.NorthWest,
  SE: Direction.SouthEast,
  SW: Direction.SouthWest,
  NORTH: Direction.North,
  SOUTH: Direction.South,
  EAST: Direction.East,
  WEST: Direction.West,
  NORTHEAST: Direction.NorthEast,
  NORTHWEST: Direction.NorthWest,
  SOUTHEAST: Direction.SouthEast,
  SOUTHWEST: Direction.SouthWest,
};

function parseAction(responseText: string): Action | null {
  // Extract JSON from response — handle markdown code blocks, extra text
  let jsonStr = responseText.trim();

  // Try extracting from markdown code block first
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  } else {
    // Try extracting the first JSON object from the text
    const jsonMatch = jsonStr.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const actionStr = (parsed.action ?? parsed.type ?? "").toString().toUpperCase();
    const params = parsed.params ?? parsed;

    switch (actionStr) {
      case "MOVE": {
        const dirStr = (params.dir ?? params.direction ?? "").toString().toUpperCase();
        const direction = DIR_MAP[dirStr];
        if (!direction) return null;
        return { type: ActionType.Move, direction };
      }
      case "INTERACT": {
        const target = (params.target ?? params.targetId ?? "").toString();
        if (!target) return null;
        return { type: ActionType.Interact, targetId: target };
      }
      case "SCAN":
        return { type: ActionType.Scan };
      case "CLEAN":
        return { type: ActionType.Clean };
      case "WAIT":
        return { type: ActionType.Wait };
      case "LOOK":
        return { type: ActionType.Look };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// ── System prompt ────────────────────────────────────────────

const SYSTEM_PROMPT = `You are playing a roguelike game as a maintenance robot (Janitor Rover) exploring a silent research station. You receive text-based observations each turn and must respond with a single action.

GOAL: Explore the station, solve puzzles, restore power systems, and transmit data from the Data Core to win.

GAME MECHANICS:
- Turn-based: each action = one turn.
- You have HP. Taking damage from hazards (heat, low pressure, radiation, patrol drones) reduces HP. At 0 HP you lose.
- Station Integrity degrades over time. Restoring power relays slows degradation.
- Rooms may contain hazards (heat, smoke, low pressure, radiation, structural stress). Use sensors to detect them.

OBSERVATIONS:
- Each turn you see: a map viewport (@ = you), nearby entities with IDs, valid actions, and alerts.
- Entities marked [INTERACTABLE] can be interacted with this turn (you must be adjacent).

AVAILABLE ACTIONS:
- MOVE: Move in a direction. Params: {"dir": "N"} (N, S, E, W, NE, NW, SE, SW)
- INTERACT: Interact with an adjacent entity. Params: {"target": "entity_id"}
- SCAN: Scan surroundings with your active sensor.
- CLEAN: Clean the current tile (reduces dirt).
- WAIT: Do nothing for one turn.

STRATEGY TIPS:
1. Explore rooms systematically. Move toward unexplored areas.
2. INTERACT with Power Relays to restore power and unlock doors.
3. INTERACT with Sensor Pickups to upgrade your sensors (thermal, atmospheric, etc.).
4. INTERACT with Med Kits to heal when HP is low.
5. INTERACT with Hull Breaches to seal them (reduces pressure loss).
6. Avoid high-heat and low-pressure areas when possible, or pass through quickly.
7. Watch out for Patrol Drones — they damage you on contact.
8. INTERACT with the Data Core to transmit data and win the game.
9. INTERACT with Log Terminals and Crew Items to gather evidence.
10. If HP is critical, prioritize finding Med Kits or Repair Cradles.
11. Clean dirty rooms when the objective phase is "clean".
12. INTERACT with Closed Doors to open them for further exploration.

RESPONSE FORMAT:
Respond with ONLY a valid JSON object. No explanation, no markdown, no extra text.
Example responses:
{"action":"MOVE","params":{"dir":"E"}}
{"action":"INTERACT","params":{"target":"relay_01"}}
{"action":"SCAN"}
{"action":"CLEAN"}
{"action":"WAIT"}`;

// ── Claude API caller ────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  content: string;
}

async function callClaude(
  messages: Message[],
  apiKey: string,
  model: string,
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": API_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
          messages,
        }),
      });

      if (response.status === 429 || response.status >= 500) {
        // Rate limited or server error — retry with backoff
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        process.stderr.write(
          `[claudeDriver] API ${response.status}, retrying in ${backoff}ms...\n`,
        );
        await sleep(backoff);
        lastError = new Error(`API returned ${response.status}: ${response.statusText}`);
        continue;
      }

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`API error ${response.status}: ${body}`);
      }

      const data = await response.json() as {
        content: Array<{ type: string; text?: string }>;
      };

      const textBlock = data.content.find(b => b.type === "text");
      return textBlock?.text ?? "";
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES - 1) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        process.stderr.write(
          `[claudeDriver] Error: ${lastError.message}, retrying in ${backoff}ms...\n`,
        );
        await sleep(backoff);
      }
    }
  }

  throw lastError ?? new Error("API call failed after retries");
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Main game loop ───────────────────────────────────────────

export async function playGame(options: {
  seed?: number;
  maxTurns?: number;
  visibility?: "full" | "player";
  apiKey?: string;
  model?: string;
  verbose?: boolean;
}): Promise<GameResult> {
  const seed = options.seed ?? GOLDEN_SEED;
  const maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
  const visibility = options.visibility ?? "full";
  const model = options.model ?? DEFAULT_MODEL;
  const verbose = options.verbose ?? false;

  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      victory: false,
      turns: 0,
      finalHp: 0,
      roomsVisited: 0,
      actions: [],
      error: "No API key. Set ANTHROPIC_API_KEY env var or pass apiKey option.",
    };
  }

  let state = generate(seed);

  // Track visited rooms
  const visitedRooms = new Set<string>();
  const initialRoom = getRoomAt(state, state.player.entity.pos);
  if (initialRoom) visitedRooms.add(initialRoom.id);

  // Conversation history — sliding window
  const conversation: Message[] = [];
  const actionLog: Array<{ turn: number; observation: string; action: string }> = [];

  if (verbose) {
    process.stderr.write(`[claudeDriver] Starting game — seed=${seed}, maxTurns=${maxTurns}, model=${model}\n`);
  }

  for (let turn = 0; turn < maxTurns; turn++) {
    if (state.gameOver) break;

    // Build observation
    const obs = buildObservation(state, visibility);
    const obsText = renderObservationAsText(obs);

    // Sliding window: keep only last CONVERSATION_WINDOW turns (each turn = 2 messages)
    while (conversation.length > CONVERSATION_WINDOW * 2) {
      conversation.shift(); // remove oldest user message
      conversation.shift(); // remove oldest assistant message
    }

    // Add current observation
    conversation.push({ role: "user", content: obsText });

    // Call Claude
    let responseText: string;
    try {
      responseText = await callClaude(conversation, apiKey, model);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[claudeDriver] API error on turn ${turn}: ${msg}\n`);
      // Fall back to WAIT
      responseText = '{"action":"WAIT"}';
    }

    // Parse action
    let action = parseAction(responseText);

    if (!action || !isValidAction(state, action)) {
      // Retry once with an error message
      if (verbose) {
        process.stderr.write(
          `[claudeDriver] Turn ${turn}: Invalid action "${responseText.slice(0, 100)}", requesting correction...\n`,
        );
      }

      const errorMsg = action
        ? `Your action ${JSON.stringify(action)} is not valid this turn. Choose from the VALID ACTIONS list. Respond with ONLY a JSON object.`
        : `Could not parse your response as a valid action. Respond with ONLY a JSON object like {"action":"MOVE","params":{"dir":"E"}}. Valid action types: MOVE, INTERACT, SCAN, CLEAN, WAIT.`;

      conversation.push({ role: "assistant", content: responseText });
      conversation.push({ role: "user", content: errorMsg });

      try {
        responseText = await callClaude(conversation, apiKey, model);
        action = parseAction(responseText);
      } catch {
        // Give up, default to WAIT
        action = null;
      }

      // If still invalid, default to WAIT
      if (!action || !isValidAction(state, action)) {
        if (verbose) {
          process.stderr.write(`[claudeDriver] Turn ${turn}: Still invalid, defaulting to WAIT\n`);
        }
        action = { type: ActionType.Wait };
        responseText = '{"action":"WAIT"}';
      }

      // Remove the error correction messages from the window
      // Keep only the final valid response
      conversation.pop(); // remove error prompt
      conversation.pop(); // remove invalid response
    }

    // Record assistant message
    conversation.push({ role: "assistant", content: responseText });

    // Log
    const actionStr = formatAction(action);
    actionLog.push({ turn: state.turn, observation: obsText, action: actionStr });

    if (verbose) {
      process.stderr.write(
        `[claudeDriver] Turn ${state.turn}: ${obs.currentRoom} | HP ${obs.hp}/${obs.maxHp} | ${actionStr}\n`,
      );
    }

    // Execute action
    state = step(state, action);

    // Track visited rooms
    const currentRoom = getRoomAt(state, state.player.entity.pos);
    if (currentRoom) visitedRooms.add(currentRoom.id);
  }

  return {
    victory: state.victory,
    turns: state.turn,
    finalHp: state.player.hp,
    roomsVisited: visitedRooms.size,
    actions: actionLog,
    error: undefined,
  };
}

function formatAction(action: Action): string {
  switch (action.type) {
    case ActionType.Move:
      return `MOVE ${action.direction ?? "?"}`;
    case ActionType.Interact:
      return `INTERACT ${action.targetId ?? "?"}`;
    case ActionType.Scan:
      return "SCAN";
    case ActionType.Clean:
      return "CLEAN";
    case ActionType.Wait:
      return "WAIT";
    case ActionType.Look:
      return "LOOK";
    case ActionType.Journal:
      return "JOURNAL";
    default:
      return String(action.type);
  }
}

// ── CLI entry point ──────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  function getArg(name: string): string | undefined {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  }

  function hasFlag(name: string): boolean {
    return args.includes(`--${name}`);
  }

  const seed = getArg("seed") ? parseInt(getArg("seed")!, 10) : GOLDEN_SEED;
  const maxTurns = getArg("max-turns") ? parseInt(getArg("max-turns")!, 10) : DEFAULT_MAX_TURNS;
  const model = getArg("model") ?? DEFAULT_MODEL;
  const verbose = hasFlag("verbose");

  process.stderr.write(`\n[claudeDriver] SSR AI Playtester\n`);
  process.stderr.write(`[claudeDriver] Seed: ${seed} | Max turns: ${maxTurns} | Model: ${model}\n`);
  process.stderr.write(`[claudeDriver] Verbose: ${verbose}\n\n`);

  const result = await playGame({
    seed,
    maxTurns,
    verbose: true, // always verbose in CLI mode for stderr
    model,
  });

  // Final result to stdout
  console.log("\n=== GAME RESULT ===");
  console.log(`Result: ${result.victory ? "VICTORY" : "DEFEAT"}`);
  console.log(`Turns: ${result.turns}`);
  console.log(`Final HP: ${result.finalHp}`);
  console.log(`Rooms visited: ${result.roomsVisited}`);
  console.log(`Actions taken: ${result.actions.length}`);
  if (result.error) {
    console.log(`Error: ${result.error}`);
  }

  // Exit with appropriate code
  process.exit(result.victory ? 0 : 1);
}

// Run if executed directly
const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith("claudeDriver.ts") ||
   process.argv[1].endsWith("claudeDriver.js"));

if (isMainModule) {
  main().catch(err => {
    process.stderr.write(`[claudeDriver] Fatal error: ${err}\n`);
    process.exit(2);
  });
}
