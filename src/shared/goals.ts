/**
 * Goal & Subgoal System — Pure computation from GameState.
 *
 * Goals are derived views of existing game state, not new state to manage.
 * Each goal has discoverable subgoals that reveal as the player progresses.
 */

import type { GameState, Deduction, JournalEntry, Entity } from "./types.js";
import { ObjectivePhase, EntityType } from "./types.js";
import { getUnlockedDeductions } from "../sim/deduction.js";

/** Helper: convert entities Map to array for filtering */
function entityList(state: GameState): Entity[] {
  return Array.from(state.entities.values());
}

// ── Types ────────────────────────────────────────────────────

export interface Subgoal {
  id: string;
  title: string;
  completed: boolean;
  discovered: boolean;
  progressText?: string;   // e.g. "2/5 terminals read"
  hint?: string;           // actionable hint when focused
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  icon: string;            // single character icon
  color: string;           // accent color
  discovered: boolean;
  completed: boolean;
  progress: number;        // 0.0 - 1.0
  subgoals: Subgoal[];
  focusHint?: string;      // what to do next when this goal is focused
  priority: number;        // lower = higher priority for sorting
}

// ── Discovery conditions ─────────────────────────────────────
// Goals are discovered based on game state thresholds. Once discovered,
// they stay discovered (tracked by the caller via a Set<string>).

export function computeGoalDiscoveries(state: GameState): Set<string> {
  const ids = new Set<string>();

  // Always discovered
  ids.add("survey");

  // Investigate: discovered when first evidence is found
  if (state.mystery && state.mystery.journal.length > 0) {
    ids.add("investigate");
  }

  // Crime scenes: discovered when first room scene clue is examined
  if (state.mystery?.roomScenes?.some(s => s.physicalClues.some(c => c.examined))) {
    ids.add("scenes");
  }

  // Crew: discovered when any crew member is mentioned in evidence
  if (state.mystery && state.mystery.journal.some(j => j.crewMentioned.length > 0)) {
    ids.add("crew");
  }

  // Solve mystery: discovered when first deduction unlocks
  if (state.mystery) {
    const unlocked = getUnlockedDeductions(state.mystery.deductions, state.mystery.journal);
    if (unlocked.length > 0 || state.mystery.deductions.some(d => d.solved)) {
      ids.add("mystery");
    }
  }

  // Station repair: discovered when a relay or breach is found (first interaction)
  const hasRelay = entityList(state).some(e => e.type === EntityType.Relay);
  const hasBreach = entityList(state).some(e => e.type === EntityType.Breach);
  if (hasRelay || hasBreach) {
    ids.add("repair");
  }

  // Evacuate: discovered when evacuation phase begins
  if (state.mystery?.objectivePhase === ObjectivePhase.Evacuate) {
    ids.add("evacuate");
  }

  return ids;
}

// ── Goal computation ─────────────────────────────────────────

export interface GoalContext {
  visitedRoomIds: Set<string>;
}

export function computeGoals(state: GameState, discoveredGoalIds: Set<string>, ctx: GoalContext): Goal[] {
  const goals: Goal[] = [];

  goals.push(computeSurveyGoal(state, discoveredGoalIds, ctx));
  goals.push(computeInvestigateGoal(state, discoveredGoalIds));
  goals.push(computeScenesGoal(state, discoveredGoalIds));
  goals.push(computeCrewGoal(state, discoveredGoalIds));
  goals.push(computeMysteryGoal(state, discoveredGoalIds));
  goals.push(computeRepairGoal(state, discoveredGoalIds));
  goals.push(computeEvacuateGoal(state, discoveredGoalIds));

  // Sort by priority, discovered first
  return goals
    .filter(g => g.discovered)
    .sort((a, b) => {
      // Incomplete goals first, then by priority
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return a.priority - b.priority;
    });
}

// ── Individual goal computations ─────────────────────────────

function computeSurveyGoal(state: GameState, disc: Set<string>, ctx: GoalContext): Goal {
  const totalRooms = state.rooms.length;
  const visitedRooms = state.rooms.filter(r =>
    ctx.visitedRoomIds.has(r.id)
  ).length;
  const progress = totalRooms > 0 ? visitedRooms / totalRooms : 0;

  // Subgoals
  const subgoals: Subgoal[] = [];

  // Explore rooms
  subgoals.push({
    id: "survey_rooms",
    title: "Explore station rooms",
    completed: visitedRooms >= totalRooms,
    discovered: true,
    progressText: `${visitedRooms}/${totalRooms} rooms visited`,
    hint: "Move through corridors and enter unexplored rooms",
  });

  // Find sensors
  const sensorsOwned = state.player.sensors?.length ?? 0;
  const sensorPickups = entityList(state).filter(e => e.type === EntityType.SensorPickup && !e.props["exhausted"]);
  subgoals.push({
    id: "survey_sensors",
    title: "Collect sensor upgrades",
    completed: sensorPickups.length === 0 && sensorsOwned > 0,
    discovered: true,
    progressText: `${sensorsOwned} sensor${sensorsOwned !== 1 ? "s" : ""} equipped`,
    hint: sensorsOwned === 0 ? "Look for sensor pickups in nearby rooms" : "Scan rooms with [Q] to reveal hidden data",
  });

  // Read terminals
  const terminalsRead = state.logs.filter(l => l.id.startsWith("log_terminal_") && !l.id.includes("_reread_")).length;
  const totalTerminals = entityList(state).filter(e => e.type === EntityType.LogTerminal).length;
  subgoals.push({
    id: "survey_terminals",
    title: "Read station terminals",
    completed: terminalsRead >= totalTerminals && totalTerminals > 0,
    discovered: terminalsRead > 0 || totalTerminals > 0,
    progressText: `${terminalsRead}/${totalTerminals} terminals read`,
    hint: "Approach terminals and press [Enter] to read logs",
  });

  return {
    id: "survey",
    title: "Survey the Station",
    description: "Explore CORVUS-7, collect equipment, and map the station layout.",
    icon: "\u25C9",
    color: "#4cf",
    discovered: disc.has("survey"),
    completed: progress >= 0.8,
    progress,
    subgoals,
    focusHint: visitedRooms < totalRooms
      ? `Explore more rooms (${totalRooms - visitedRooms} remaining)`
      : "Station fully surveyed",
    priority: 1,
  };
}

function computeInvestigateGoal(state: GameState, disc: Set<string>): Goal {
  if (!state.mystery) {
    return makeHiddenGoal("investigate", "Investigate the Incident", 2);
  }

  const journal = state.mystery.journal;
  const evidenceCount = journal.length;
  const threshold = state.mystery.evidenceThreshold;
  const progress = threshold > 0 ? Math.min(evidenceCount / threshold, 1) : 0;

  const subgoals: Subgoal[] = [];

  // Gather evidence
  subgoals.push({
    id: "investigate_evidence",
    title: "Collect evidence",
    completed: evidenceCount >= threshold,
    discovered: true,
    progressText: `${evidenceCount}/${threshold} evidence pieces`,
    hint: "Read terminals, examine items, and interact with crew traces",
  });

  // Find evidence traces
  const tracesFound = journal.filter(j => j.category === "trace").length;
  const totalTraces = entityList(state).filter(e => e.type === EntityType.EvidenceTrace).length + tracesFound;
  if (totalTraces > 0) {
    subgoals.push({
      id: "investigate_traces",
      title: "Examine physical evidence",
      completed: tracesFound >= totalTraces,
      discovered: tracesFound > 0,
      progressText: `${tracesFound} trace${tracesFound !== 1 ? "s" : ""} found`,
      hint: "Look for evidence traces in rooms — they glow golden",
    });
  }

  // Evidence connections
  const connections = state.mystery.connections.filter(c => c.discovered);
  if (connections.length > 0 || evidenceCount >= 3) {
    subgoals.push({
      id: "investigate_connections",
      title: "Discover evidence connections",
      completed: connections.length >= 5,
      discovered: connections.length > 0 || evidenceCount >= 3,
      progressText: `${connections.length} connection${connections.length !== 1 ? "s" : ""} found`,
      hint: "Connections form automatically as you collect related evidence",
    });
  }

  return {
    id: "investigate",
    title: "Investigate the Incident",
    description: "Gather evidence about what happened aboard CORVUS-7. Read terminals, collect traces, and piece together the story.",
    icon: "\u2318",
    color: "#fa0",
    discovered: disc.has("investigate"),
    completed: evidenceCount >= threshold,
    progress,
    subgoals,
    focusHint: evidenceCount < threshold
      ? `Collect ${threshold - evidenceCount} more evidence (read terminals, examine traces)`
      : "Evidence threshold met — check the Investigation Hub [V]",
    priority: 2,
  };
}

function computeScenesGoal(state: GameState, disc: Set<string>): Goal {
  if (!state.mystery?.roomScenes) {
    return makeHiddenGoal("scenes", "Analyze Crime Scenes", 3);
  }

  const scenes = state.mystery.roomScenes;
  const totalScenes = scenes.length;
  const processedScenes = scenes.filter(s => s.processed).length;
  const readyScenes = scenes.filter(s => !s.processed && s.physicalClues.some(c => c.examined)).length;
  const progress = totalScenes > 0 ? processedScenes / totalScenes : 0;

  const subgoals: Subgoal[] = [];

  // Examine clues
  const totalClues = scenes.reduce((sum, s) => sum + s.physicalClues.length, 0);
  const examinedClues = scenes.reduce((sum, s) => sum + s.physicalClues.filter(c => c.examined).length, 0);
  subgoals.push({
    id: "scenes_examine",
    title: "Examine scene clues",
    completed: examinedClues >= totalClues,
    discovered: true,
    progressText: `${examinedClues}/${totalClues} clues examined`,
    hint: "Enter rooms and press [X] to examine physical clues",
  });

  // Process scenes
  subgoals.push({
    id: "scenes_process",
    title: "Process crime scenes",
    completed: processedScenes >= totalScenes,
    discovered: examinedClues > 0,
    progressText: `${processedScenes}/${totalScenes} scenes processed`,
    hint: readyScenes > 0
      ? `${readyScenes} scene${readyScenes !== 1 ? "s" : ""} ready — open SCENES tab in Investigation Hub [V]`
      : "Examine clues first, then process scenes in the Investigation Hub",
  });

  // High-accuracy assessments
  const perfectScenes = scenes.filter(s => s.processed && (s as any).score === 3).length;
  if (processedScenes > 0) {
    subgoals.push({
      id: "scenes_perfect",
      title: "Achieve perfect assessments",
      completed: perfectScenes >= totalScenes,
      discovered: processedScenes > 0,
      progressText: `${perfectScenes} perfect (3/3) assessment${perfectScenes !== 1 ? "s" : ""}`,
      hint: "Match WHO, WHAT, and OUTCOME correctly using clue evidence",
    });
  }

  return {
    id: "scenes",
    title: "Analyze Crime Scenes",
    description: "Examine physical clues in each room and reconstruct what happened there.",
    icon: "\u2620",
    color: "#ca8",
    discovered: disc.has("scenes"),
    completed: processedScenes >= totalScenes && totalScenes > 0,
    progress,
    subgoals,
    focusHint: examinedClues < totalClues
      ? `Examine clues in rooms (${totalClues - examinedClues} remaining) — press [X]`
      : readyScenes > 0
        ? `Process ${readyScenes} ready scene${readyScenes !== 1 ? "s" : ""} in Investigation Hub [V]`
        : processedScenes < totalScenes
          ? "Find and examine more clues to unlock scene processing"
          : "All scenes processed",
    priority: 3,
  };
}

function computeCrewGoal(state: GameState, disc: Set<string>): Goal {
  if (!state.mystery) {
    return makeHiddenGoal("crew", "Identify the Crew", 4);
  }

  const crew = state.mystery.crew;
  const dossiers = state.mystery.dossiers ?? [];
  const identified = dossiers.filter(d => d.confirmed.name).length;
  const totalCrew = crew.length;
  const progress = totalCrew > 0 ? identified / totalCrew : 0;

  const subgoals: Subgoal[] = [];

  // Identify crew
  subgoals.push({
    id: "crew_identify",
    title: "Identify crew members",
    completed: identified >= totalCrew,
    discovered: true,
    progressText: `${identified}/${totalCrew} crew identified`,
    hint: "Find crew badges and personal items to identify crew members",
  });

  // Build dossiers (2+ evidence mentions)
  const journal = state.mystery.journal;
  const crewWithProfiles = crew.filter(c =>
    journal.filter(j => j.crewMentioned.includes(c.id)).length >= 2
  ).length;
  if (identified > 0 || crewWithProfiles > 0) {
    subgoals.push({
      id: "crew_profiles",
      title: "Build crew profiles",
      completed: crewWithProfiles >= totalCrew,
      discovered: true,
      progressText: `${crewWithProfiles}/${totalCrew} profiles unlocked`,
      hint: "Collect 2+ evidence pieces mentioning a crew member to unlock their profile",
    });
  }

  // Determine fates
  const fatesKnown = dossiers.filter(d => d.theories.fate).length;
  if (fatesKnown > 0) {
    subgoals.push({
      id: "crew_fates",
      title: "Determine crew fates",
      completed: fatesKnown >= totalCrew,
      discovered: true,
      progressText: `${fatesKnown}/${totalCrew} fates determined`,
      hint: "Process crime scenes and read evidence to learn crew fates",
    });
  }

  return {
    id: "crew",
    title: "Identify the Crew",
    description: "Build dossiers on the station crew. Find out who they were and what happened to each of them.",
    icon: "\u263A",
    color: "#6cf",
    discovered: disc.has("crew"),
    completed: identified >= totalCrew && totalCrew > 0,
    progress,
    subgoals,
    focusHint: identified < totalCrew
      ? `Identify more crew (${totalCrew - identified} unknown) — find badges and personal items`
      : "All crew identified — review dossiers in CREW tab [V]",
    priority: 4,
  };
}

function computeMysteryGoal(state: GameState, disc: Set<string>): Goal {
  if (!state.mystery) {
    return makeHiddenGoal("mystery", "Solve the Mystery", 5);
  }

  const deductions = state.mystery.deductions;
  const journal = state.mystery.journal;
  const totalDeductions = deductions.length;
  const solvedDeductions = deductions.filter(d => d.solved).length;
  const correctDeductions = deductions.filter(d => d.answeredCorrectly).length;
  const unlocked = getUnlockedDeductions(deductions, journal);
  const progress = totalDeductions > 0 ? solvedDeductions / totalDeductions : 0;

  const subgoals: Subgoal[] = [];

  // Answer each deduction as a subgoal
  const tierLabels = ["What happened?", "Where did it start?", "Why did it happen?", "Who was the victim?", "Who bears responsibility?", "What was hidden?"];
  for (let i = 0; i < deductions.length; i++) {
    const d = deductions[i];
    const isUnlocked = unlocked.some(u => u.id === d.id);
    const label = tierLabels[i] ?? d.question;
    subgoals.push({
      id: `mystery_${d.id}`,
      title: d.solved ? `${d.answeredCorrectly ? "\u2713" : "\u2717"} ${label}` : label,
      completed: d.solved,
      discovered: d.solved || isUnlocked,
      progressText: d.solved
        ? (d.answeredCorrectly ? "Correct" : "Incorrect")
        : isUnlocked ? "Ready to answer" : "Locked",
      hint: isUnlocked
        ? "Open CONNECTIONS tab [V] and press [Enter] to answer"
        : d.solved ? undefined : "Collect more evidence to unlock",
    });
  }

  return {
    id: "mystery",
    title: "Solve the Mystery",
    description: "Answer the key deductions about what happened aboard CORVUS-7. Each answer builds on the last.",
    icon: "\u2736",
    color: "#f4a",
    discovered: disc.has("mystery"),
    completed: solvedDeductions >= totalDeductions && totalDeductions > 0,
    progress,
    subgoals,
    focusHint: unlocked.length > 0
      ? `Deduction ready: "${unlocked[0].question}" — open CONNECTIONS [V]`
      : solvedDeductions < totalDeductions
        ? `Collect more evidence to unlock the next deduction (${solvedDeductions}/${totalDeductions} solved)`
        : `Mystery solved (${correctDeductions}/${totalDeductions} correct)`,
    priority: 5,
  };
}

function computeRepairGoal(state: GameState, disc: Set<string>): Goal {
  const entities = entityList(state);
  const relays = entities.filter(e => e.type === EntityType.Relay);
  const breaches = entities.filter(e => e.type === EntityType.Breach);
  const totalRelays = relays.length;
  const activatedRelays = relays.filter(e => e.props["activated"] === true).length;
  const totalBreaches = breaches.length;
  const sealedBreaches = breaches.filter(e => e.props["sealed"] === true || e.props["exhausted"] === true).length;

  const totalTasks = totalRelays + totalBreaches;
  const completedTasks = activatedRelays + sealedBreaches;
  const progress = totalTasks > 0 ? completedTasks / totalTasks : 0;

  const subgoals: Subgoal[] = [];

  if (totalRelays > 0) {
    subgoals.push({
      id: "repair_relays",
      title: "Activate power relays",
      completed: activatedRelays >= totalRelays,
      discovered: true,
      progressText: `${activatedRelays}/${totalRelays} relays activated`,
      hint: "Find and activate relay consoles to restore station power",
    });
  }

  if (totalBreaches > 0) {
    subgoals.push({
      id: "repair_breaches",
      title: "Seal hull breaches",
      completed: sealedBreaches >= totalBreaches,
      discovered: true,
      progressText: `${sealedBreaches}/${totalBreaches} breaches sealed`,
      hint: "Approach breaches and interact to seal them (watch for vacuum damage)",
    });
  }

  // Pressure valves
  const valves = entities.filter(e => e.type === EntityType.PressureValve);
  const fixedValves = valves.filter(e => e.props["activated"] === true || e.props["exhausted"] === true).length;
  if (valves.length > 0) {
    subgoals.push({
      id: "repair_valves",
      title: "Fix pressure valves",
      completed: fixedValves >= valves.length,
      discovered: true,
      progressText: `${fixedValves}/${valves.length} valves fixed`,
      hint: "Interact with pressure valves to stabilize atmospheric pressure",
    });
  }

  return {
    id: "repair",
    title: "Restore Station Systems",
    description: "Repair critical station infrastructure — power relays, hull breaches, and pressure systems.",
    icon: "\u2692",
    color: "#ff8",
    discovered: disc.has("repair"),
    completed: completedTasks >= totalTasks && totalTasks > 0,
    progress,
    subgoals,
    focusHint: activatedRelays < totalRelays
      ? `Activate power relays (${totalRelays - activatedRelays} remaining)`
      : sealedBreaches < totalBreaches
        ? `Seal hull breaches (${totalBreaches - sealedBreaches} remaining)`
        : "Station systems restored",
    priority: 6,
  };
}

function computeEvacuateGoal(state: GameState, disc: Set<string>): Goal {
  const evac = state.mystery?.evacuation;
  if (!evac || !disc.has("evacuate")) {
    return makeHiddenGoal("evacuate", "Evacuate Survivors", 7);
  }

  const crewFound = evac.crewFound.length;
  const crewEvacuated = evac.crewEvacuated.length;
  const crewDead = evac.crewDead.length;
  const totalCrew = state.mystery?.crew.length ?? 0;
  const livingCrew = totalCrew - crewDead;
  const progress = livingCrew > 0 ? crewEvacuated / livingCrew : 1;

  const subgoals: Subgoal[] = [];

  subgoals.push({
    id: "evacuate_find",
    title: "Locate crew members",
    completed: crewFound >= livingCrew,
    discovered: true,
    progressText: `${crewFound} crew found`,
    hint: "Search rooms for surviving crew members",
  });

  subgoals.push({
    id: "evacuate_rescue",
    title: "Escort crew to escape pods",
    completed: crewEvacuated >= livingCrew,
    discovered: crewFound > 0,
    progressText: `${crewEvacuated}/${livingCrew} evacuated`,
    hint: "Lead crew members to powered escape pods",
  });

  const podsPowered = evac.podsPowered.length;
  const totalPods = entityList(state).filter(e => e.type === EntityType.EscapePod).length;
  if (totalPods > 0) {
    subgoals.push({
      id: "evacuate_pods",
      title: "Power escape pods",
      completed: podsPowered >= totalPods,
      discovered: true,
      progressText: `${podsPowered}/${totalPods} pods powered`,
      hint: "Activate relays near escape pods to power them",
    });
  }

  return {
    id: "evacuate",
    title: "Evacuate Survivors",
    description: "Find and rescue surviving crew. Guide them to powered escape pods before it's too late.",
    icon: "\u26A0",
    color: "#f44",
    discovered: disc.has("evacuate"),
    completed: crewEvacuated >= livingCrew && livingCrew > 0,
    progress,
    subgoals,
    focusHint: crewEvacuated < livingCrew
      ? `Evacuate crew to escape pods (${livingCrew - crewEvacuated} remaining)`
      : "All survivors evacuated",
    priority: 0, // Highest priority when active
  };
}

// ── Helpers ──────────────────────────────────────────────────

function makeHiddenGoal(id: string, title: string, priority: number): Goal {
  return {
    id,
    title,
    description: "",
    icon: "?",
    color: "#555",
    discovered: false,
    completed: false,
    progress: 0,
    subgoals: [],
    priority,
  };
}
