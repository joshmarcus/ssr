/**
 * "What We Know" — narrative summary generator.
 *
 * Pure function that generates prose paragraphs describing the
 * investigation so far, based on collected evidence and solved deductions.
 */
import type { MysteryState, WhatWeKnow, CrewMember, Relationship } from "../shared/types.js";
import { DeductionCategory, IncidentArchetype, TimelinePhase } from "../shared/types.js";

/**
 * Format a single crew relationship as prose.
 */
export function formatRelationship(
  member: CrewMember,
  relationship: Relationship,
  crew: CrewMember[],
): string {
  const target = crew.find(c => c.id === relationship.targetId);
  if (!target) return "";
  const targetLabel = `${target.firstName} ${target.lastName} (${formatRole(target.role)})`;
  switch (relationship.type) {
    case "ally": return `Allies with ${targetLabel}`;
    case "rival": return `Rivals with ${targetLabel}`;
    case "romantic": return `Close to ${targetLabel}`;
    case "blackmail": return `Compromised by ${targetLabel}`;
  }
}

/**
 * Get a display-friendly crew role label.
 */
function formatRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Get a display-friendly archetype label.
 */
function formatArchetype(archetype: IncidentArchetype): string {
  return archetype.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Format a crew member with role, fate, personality, and relationships.
 */
export function formatCrewMemberDetail(member: CrewMember, crew: CrewMember[]): string {
  const lines: string[] = [];
  lines.push(`${member.firstName} ${member.lastName} — ${formatRole(member.role)}`);
  lines.push(`  Personality: ${member.personality}`);
  lines.push(`  Fate: ${member.fate.replace(/_/g, " ")}`);
  if (member.relationships.length > 0) {
    for (const rel of member.relationships) {
      const relStr = formatRelationship(member, rel, crew);
      if (relStr) lines.push(`  ${relStr}`);
    }
  }
  return lines.join("\n");
}

/**
 * Generate a narrative summary of the investigation so far.
 * Pure function — no side effects.
 */
export function generateWhatWeKnow(mystery: MysteryState): WhatWeKnow {
  const paragraphs: string[] = [];
  const journal = mystery.journal;
  const deductions = mystery.deductions;
  const crew = mystery.crew;
  const timeline = mystery.timeline;

  if (journal.length === 0) {
    return {
      paragraphs: ["No evidence has been collected yet. Explore the station, read terminals, and examine items to begin piecing together what happened."],
      confidence: "none",
    };
  }

  // P1 — The incident
  const whatDeduction = deductions.find(d => d.id === "deduction_what");
  if (whatDeduction?.solved && whatDeduction.answeredCorrectly) {
    const correctOpt = whatDeduction.options.find(o => o.correct);
    paragraphs.push(`The investigation has determined what happened aboard CORVUS-7: ${correctOpt?.label || "unknown incident"}. The evidence collected so far supports this conclusion.`);
  } else if (whatDeduction?.solved) {
    paragraphs.push(`An initial assessment of the incident was made, but the conclusion may be incorrect. The true nature of what happened aboard CORVUS-7 remains uncertain.`);
  } else {
    const archLabel = formatArchetype(timeline.archetype);
    const systemTags = journal.flatMap(j => j.tags).filter(t =>
      ["coolant", "thermal", "reactor", "hull", "pressure", "signal", "electrical", "containment"].includes(t)
    );
    if (systemTags.length > 0) {
      const uniqueTags = [...new Set(systemTags)];
      paragraphs.push(`Evidence suggests a ${archLabel.toLowerCase()}-type incident. System indicators found so far: ${uniqueTags.join(", ")}. More evidence is needed to determine exactly what happened.`);
    } else {
      paragraphs.push(`Something catastrophic happened aboard CORVUS-7. The nature of the incident is not yet clear. Collect evidence from terminals and crew items to learn more.`);
    }
  }

  // P2 — The timeline
  const timelineEntries = journal.filter(j =>
    j.tags.some(t => t.startsWith("timeline_"))
  );
  if (timelineEntries.length > 0) {
    const phases: string[] = [];
    const earlyEntries = timelineEntries.filter(j => j.tags.includes("timeline_early"));
    const triggerEntries = timelineEntries.filter(j => j.tags.includes("timeline_trigger"));
    const responseEntries = timelineEntries.filter(j => j.tags.includes("timeline_response"));
    const aftermathEntries = timelineEntries.filter(j => j.tags.includes("timeline_aftermath"));

    if (earlyEntries.length > 0) phases.push("warning signs before the incident");
    if (triggerEntries.length > 0) phases.push("the triggering event");
    if (responseEntries.length > 0) phases.push("the crew's response");
    if (aftermathEntries.length > 0) phases.push("the aftermath");

    paragraphs.push(`The timeline is taking shape. Evidence covers: ${phases.join(", ")}. ${timelineEntries.length} piece${timelineEntries.length !== 1 ? "s" : ""} of evidence relate to the sequence of events.`);
  }

  // P3 — The crew
  const mentionedCrewIds = new Set(journal.flatMap(j => j.crewMentioned));
  if (mentionedCrewIds.size > 0) {
    const mentionedCrew = crew.filter(c => mentionedCrewIds.has(c.id));
    const crewSummaries: string[] = [];
    for (const member of mentionedCrew) {
      let summary = `${member.firstName} ${member.lastName} (${formatRole(member.role)}, ${member.fate.replace(/_/g, " ")})`;
      const rels = member.relationships
        .map(r => formatRelationship(member, r, crew))
        .filter(Boolean);
      if (rels.length > 0) {
        summary += ` — ${rels.join("; ")}`;
      }
      crewSummaries.push(summary);
    }
    paragraphs.push(`Crew members referenced in the evidence: ${crewSummaries.join(". ")}. ${crew.length - mentionedCrew.length} crew member${crew.length - mentionedCrew.length !== 1 ? "s" : ""} have not yet appeared in the evidence.`);
  }

  // P4 — The cause
  const whyDeduction = deductions.find(d => d.id === "deduction_why");
  if (whyDeduction?.solved && whyDeduction.answeredCorrectly) {
    const correctOpt = whyDeduction.options.find(o => o.correct);
    paragraphs.push(`The root cause has been identified: ${correctOpt?.label || "unknown cause"}.`);
  } else if (whyDeduction?.solved) {
    paragraphs.push(`An attempt was made to determine why the incident occurred, but the conclusion may be wrong. The true cause remains unclear.`);
  } else {
    const causeClues = journal.filter(j =>
      j.tags.some(t => ["engineer", "captain", "deferred", "sabotage", "containment_failure"].includes(t))
    );
    if (causeClues.length > 0) {
      paragraphs.push(`Some evidence points toward the cause of the incident, but a definitive conclusion has not yet been reached.`);
    }
  }

  // P5 — Responsibility
  const responsibilityDeduction = deductions.find(d => d.id === "deduction_responsibility");
  if (responsibilityDeduction?.solved && responsibilityDeduction.answeredCorrectly) {
    const correctOpt = responsibilityDeduction.options.find(o => o.correct);
    paragraphs.push(`Responsibility has been assigned: ${correctOpt?.label || "unknown"}.`);
  } else if (responsibilityDeduction?.solved) {
    paragraphs.push(`An attempt was made to assign responsibility, but the conclusion may be incorrect.`);
  }

  // P6 — Unanswered questions
  const unsolved = deductions.filter(d => !d.solved);
  if (unsolved.length > 0) {
    const questions = unsolved.map(d => {
      const catLabel = d.category === DeductionCategory.What ? "what happened" :
                       d.category === DeductionCategory.Why ? "why it happened" : "who is responsible";
      return catLabel;
    });
    const uniqueQuestions = [...new Set(questions)];
    paragraphs.push(`Questions remaining: ${uniqueQuestions.join(", ")}. ${unsolved.length} deduction${unsolved.length !== 1 ? "s" : ""} still unsolved.`);
  }

  // Calculate confidence
  const solved = deductions.filter(d => d.solved).length;
  const correct = deductions.filter(d => d.answeredCorrectly).length;
  const total = deductions.length;
  let confidence: WhatWeKnow["confidence"];
  if (correct === total && total > 0) {
    confidence = "complete";
  } else if (correct >= total * 0.6) {
    confidence = "high";
  } else if (solved >= total * 0.4) {
    confidence = "medium";
  } else if (journal.length >= 3) {
    confidence = "low";
  } else {
    confidence = "none";
  }

  return { paragraphs, confidence };
}

/**
 * Get all deductions that a given journal entry's tags contribute to.
 * Used by dev mode to show the "clue graph" for each evidence piece.
 */
export function getDeductionsForEntry(
  entryId: string,
  journal: { id: string; tags: string[] }[],
  deductions: { id: string; requiredTags: string[]; solved: boolean; category: string; question: string }[],
): { deductionId: string; category: string; question: string; contributingTags: string[]; missingTags: string[] }[] {
  const entry = journal.find(j => j.id === entryId);
  if (!entry) return [];

  const results: { deductionId: string; category: string; question: string; contributingTags: string[]; missingTags: string[] }[] = [];

  for (const d of deductions) {
    const contributingTags = d.requiredTags.filter(t => entry.tags.includes(t));
    if (contributingTags.length === 0) continue;

    // Calculate what's still missing across the full journal
    const allTags = new Set(journal.flatMap(j => j.tags));
    const missingTags = d.requiredTags.filter(t => !allTags.has(t));

    results.push({
      deductionId: d.id,
      category: d.category,
      question: d.question,
      contributingTags,
      missingTags,
    });
  }

  return results;
}
