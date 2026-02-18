import { generate } from "./src/sim/procgen.js";
import { GOLDEN_SEED } from "./src/shared/constants.js";

const s = generate(GOLDEN_SEED);
let logTerminals = 0, evidenceTraces = 0, crewItems = 0;
const logTerminalList: {id: string; x: number; y: number}[] = [];
const evidenceList: {id: string; x: number; y: number}[] = [];

for (const [id, e] of s.entities) {
  if (e.type === "log_terminal") {
    logTerminals++;
    logTerminalList.push({id, x: e.pos.x, y: e.pos.y});
  }
  if (e.type === "evidence_trace") {
    evidenceTraces++;
    evidenceList.push({id, x: e.pos.x, y: e.pos.y});
  }
  if (e.type === "crew_item" && e.props["hidden"] !== true) {
    crewItems++;
  }
}

console.error(`Log terminals: ${logTerminals}`);
console.error(`Evidence traces: ${evidenceTraces}`);
console.error(`Crew items (visible): ${crewItems}`);
console.error(`Evidence threshold: ${s.mystery?.evidenceThreshold}`);
console.error(`Phase: ${s.mystery?.objectivePhase}`);
console.error(`Journal length: ${s.mystery?.journal.length}`);
console.error(`\nLog terminals:`);
for (const lt of logTerminalList) {
  console.error(`  ${lt.id} at (${lt.x},${lt.y})`);
}
console.error(`\nEvidence traces:`);
for (const et of evidenceList) {
  console.error(`  ${et.id} at (${et.x},${et.y})`);
}
