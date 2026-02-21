/**
 * Convert Synty POLYGON Sci-Fi Space FBX models to GLB for Three.js.
 *
 * Usage: npx tsx convert-space-models.ts
 *
 * Requires: fbx2gltf (already in devDependencies)
 * Input: /tmp/synty-space/SourceFiles/FBX/*.fbx
 * Output: dist/models/synty-space-gltf/*.glb
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// On Windows, Git Bash /tmp/ maps to %LOCALAPPDATA%/Temp — use os.tmpdir() for portability
import os from "os";
const SYNTY_ROOT = path.join(os.tmpdir(), "synty-space");
const FBX_DIR = path.join(SYNTY_ROOT, "SourceFiles", "FBX");
const CHAR_DIR = path.join(SYNTY_ROOT, "SourceFiles", "Characters");
const OUT_DIR = path.resolve("dist/models/synty-space-gltf");
const PUBLIC_OUT = path.resolve("public/models/synty-space-gltf");

// Models we need for entity mapping (curated selection)
const MODELS_TO_CONVERT = [
  // Props
  "SM_Prop_ControlPanel_01",
  "SM_Prop_ControlPanel_02",
  "SM_Prop_ControlPanel_03",
  "SM_Prop_Screen_01",
  "SM_Prop_Screen_02",
  "SM_Prop_Screen_Small_01",
  "SM_Prop_Radar_Panel_01",
  "SM_Prop_Battery_01",
  "SM_Prop_Battery_02",
  "SM_Prop_Battery_03",
  "SM_Prop_Antenna_01",
  "SM_Prop_Crate_health_01",
  "SM_Prop_Crate_health_02",
  "SM_Prop_CenterTube_01",
  "SM_Prop_CenterTube_02",
  "SM_Prop_CryoBed_01",
  "SM_Prop_AirVent_Small_01",
  "SM_Prop_AirVent_Large_01",
  "SM_Prop_Panel_01",
  "SM_Prop_Oxygen_Tank",
  "SM_Prop_Oxygen_Tank_Small",
  "SM_Prop_Bed_Medical_01",
  "SM_Prop_Decontamination_Shower_01",
  "SM_Prop_EscapePod_Hatch_Large_01",
  "SM_Prop_EscapePod_Hatch_Small_01",
  "SM_Prop_Detail_Box_01",
  "SM_Prop_Detail_Box_02",
  "SM_Prop_Barrel_01",
  "SM_Prop_Satellite_Stand_01",
  "SM_Prop_Buttons_01",
  "SM_Prop_Buttons_02",
  "SM_Prop_Cart_01",
  "SM_Prop_Desk_Small_01",
  "SM_Prop_Wires_01",
  // Building pieces
  "SM_Bld_Wall_Doorframe_01",
  "SM_Bld_Wall_Doorframe_02",
  "SM_Bld_Wall_EscPod_Hatch_01",
  "SM_Bld_Floor_01",
  "SM_Bld_Floor_Small_01",
  "SM_Bld_Floor_Small_Hatch_01",
  "SM_Bld_Wall_01",
  "SM_Bld_Wall_02",
  "SM_Bld_Wall_03",
  "SM_Bld_Ceiling_01",
  "SM_Bld_Bridge_Console_01",
  "SM_Bld_Bridge_Chair_01",
  "SM_Bld_Crew_Beds_01",
  "SM_Bld_Crew_Desk_01",
  "SM_Bld_Corridor_Single_Arch_01",
  // Vehicles
  "SM_Veh_EscapePod_Large_01",
  "SM_Veh_EscapePod_Small_01",
  "SM_Veh_Drone_Repair_01",
  "SM_Veh_Drone_Attach_01",
  "SM_Veh_Sweepo_01",
  "SM_Veh_Beacon_01",
  // Signs
  "SM_Sign_AirLock_01",
  // Weapons (for tool pickup)
  "SM_Wep_Pistol_01",
];

// Character models (in different directory)
const CHAR_MODELS = [
  "SK_Chr_Crew_Male_01",
  "SK_Chr_Crew_Female_01",
  "SK_Chr_CrewCaptain_Male_01",
  "SK_Chr_CrewCaptain_Female_01",
  "SK_Chr_Medic_Male_01",
  "SK_Chr_BR_War_Robot_01",
  "SK_Chr_RobotFemale_01",
  "SK_Chr_BR_EVA_Suit_01",
];

// Ensure output dirs exist
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(PUBLIC_OUT, { recursive: true });

// Find fbx2gltf binary
let fbx2gltfBin = "fbx2gltf";
const winBin = path.resolve("node_modules/fbx2gltf/bin/Windows_NT/FBX2glTF.exe");
const localBin = path.resolve("node_modules/.bin/FBX2glTF");
if (fs.existsSync(winBin)) {
  fbx2gltfBin = winBin;
} else if (fs.existsSync(localBin) || fs.existsSync(localBin + ".exe")) {
  fbx2gltfBin = localBin;
}

let converted = 0;
let failed = 0;

function convert(fbxPath: string, outName: string) {
  const outPath = path.join(OUT_DIR, outName + ".glb");
  if (fs.existsSync(outPath)) {
    console.log(`  [skip] ${outName}.glb already exists`);
    converted++;
    return;
  }

  try {
    // fbx2gltf outputs to <input>_out/<input>.glb by default
    // Use --binary flag for GLB output
    execSync(`"${fbx2gltfBin}" --binary --input "${fbxPath}" --output "${outPath}"`, {
      timeout: 30000,
      stdio: "pipe",
    });
    console.log(`  [ok] ${outName}.glb`);
    converted++;
  } catch (err) {
    console.warn(`  [FAIL] ${outName}: ${(err as Error).message?.slice(0, 100)}`);
    failed++;
  }
}

console.log("Converting Synty Sci-Fi Space models (FBX → GLB)...\n");

// Convert static mesh models
console.log("=== Static Meshes ===");
for (const name of MODELS_TO_CONVERT) {
  const fbxPath = path.join(FBX_DIR, name + ".fbx");
  if (!fs.existsSync(fbxPath)) {
    // Try FX_Meshes subdirectory
    const fxPath = path.join(FBX_DIR, "FX_Meshes", name + ".fbx");
    if (fs.existsSync(fxPath)) {
      convert(fxPath, name);
    } else {
      console.warn(`  [MISSING] ${name}.fbx not found`);
      failed++;
    }
    continue;
  }
  convert(fbxPath, name);
}

// Convert character models
console.log("\n=== Characters ===");
for (const name of CHAR_MODELS) {
  const fbxPath = path.join(CHAR_DIR, name + ".fbx");
  if (!fs.existsSync(fbxPath)) {
    console.warn(`  [MISSING] ${name}.fbx not found`);
    failed++;
    continue;
  }
  convert(fbxPath, name);
}

// Copy to public dir for Vite dev server
console.log("\nCopying to public/models/synty-space-gltf/...");
const glbFiles = fs.readdirSync(OUT_DIR).filter(f => f.endsWith(".glb"));
for (const f of glbFiles) {
  fs.copyFileSync(path.join(OUT_DIR, f), path.join(PUBLIC_OUT, f));
}

// Also copy texture atlas
const texSrc = path.join(SYNTY_ROOT, "SourceFiles", "Textures", "PolygonSciFiSpace_Texture_01_A.png");
if (fs.existsSync(texSrc)) {
  fs.copyFileSync(texSrc, path.join(OUT_DIR, "PolygonSciFiSpace_Texture_01_A.png"));
  fs.copyFileSync(texSrc, path.join(PUBLIC_OUT, "PolygonSciFiSpace_Texture_01_A.png"));
  console.log("Copied texture atlas.");
}

console.log(`\nDone: ${converted} converted, ${failed} failed, ${glbFiles.length} GLB files in output.`);
