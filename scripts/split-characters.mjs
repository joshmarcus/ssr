/**
 * Split SpaceSuit characters from Characters.glb into individual GLB files.
 * Each output file contains: one character mesh + shared skeleton + idle animation.
 *
 * Usage: node scripts/split-characters.mjs
 *
 * Input:  tmp-extract/Characters.glb (converted from Characters.fbx via fbx2gltf)
 * Output: public/models/synty-scifiworlds/SK_Chr_ScifiWorlds_SpaceSuit_*.glb
 */

import { NodeIO } from "@gltf-transform/core";
import { prune, dedup } from "@gltf-transform/functions";
import fs from "fs";
import path from "path";

const INPUT = "tmp-extract/Characters.glb";
const OUTPUT_DIR = "public/models/synty-scifiworlds";

// Characters to extract (mesh names inside Characters.glb)
const TARGETS = [
  "SM_Chr_ScifiWorlds_SpaceSuit_Male_01",
  "SM_Chr_ScifiWorlds_SpaceSuit_Male_02",
  "SM_Chr_ScifiWorlds_SpaceSuit_Female_01",
  "SM_Chr_ScifiWorlds_SpaceSuit_Female_02",
];

async function main() {
  const io = new NodeIO();

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const targetMesh of TARGETS) {
    console.log(`Extracting ${targetMesh}...`);

    // Re-read the full document each time (simpler than deep-cloning)
    const doc = await io.read(INPUT);
    const root = doc.getRoot();

    // Find mesh nodes to REMOVE (everything except our target)
    const meshNodesToRemove = [];
    for (const node of root.listNodes()) {
      const mesh = node.getMesh();
      if (mesh && mesh.getName() !== targetMesh) {
        meshNodesToRemove.push(node);
      }
    }

    // Remove unwanted mesh nodes (but keep skeleton nodes — they're shared)
    for (const node of meshNodesToRemove) {
      // Detach mesh and skin from this node, but don't remove the node itself
      // (it might be a skeleton joint referenced by remaining skins)
      node.setMesh(null);
      node.setSkin(null);
    }

    // Prune unreferenced resources (removes unused meshes, accessors, buffers)
    await doc.transform(prune(), dedup());

    // Verify we have the target mesh
    const remainingMeshes = root.listMeshes().map((m) => m.getName());
    console.log(`  Meshes remaining: ${remainingMeshes.join(", ")}`);

    // Verify animation survived
    const anims = root.listAnimations();
    console.log(`  Animations: ${anims.length}`);
    for (const anim of anims) {
      console.log(
        `    ${anim.getName()}: ${anim.listChannels().length} channels`
      );
    }

    // Write individual GLB
    const outName = `SK_Chr_${targetMesh.replace("SM_Chr_", "")}.glb`;
    const outPath = path.join(OUTPUT_DIR, outName);
    await io.write(outPath, doc);

    const stats = fs.statSync(outPath);
    console.log(`  Written: ${outPath} (${(stats.size / 1024).toFixed(0)}K)`);
  }

  console.log("\nDone! Characters extracted to", OUTPUT_DIR);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
