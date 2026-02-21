import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OutlineEffect } from "three/addons/effects/OutlineEffect.js";
import type { GameState, Entity, Room } from "../shared/types.js";
import { TileType, EntityType, AttachmentSlot, SensorType, ObjectivePhase } from "../shared/types.js";
import { GLYPHS, DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, HEAT_PAIN_THRESHOLD } from "../shared/constants.js";
import type { IGameDisplay, LogType, DisplayLogEntry } from "./displayInterface.js";
import { getObjective as getObjectiveShared, getDiscoveries, entityDisplayName, isEntityExhausted } from "../shared/ui.js";
import { getUnlockedDeductions } from "../sim/deduction.js";

// FBXLoader is not imported — Synty FBX files are pre-converted to GLTF at build time

// ── Toon shading gradient texture ──────────────────────────────
// Creates a 4-step toon gradient: dark shadow → mid shadow → lit → highlight
/** Create a procedural floor grid texture — subtle panel lines on top of base color.
 *  Uses a mid-gray base so instance color multiplication produces the right result,
 *  with slightly brighter lines creating a panel grid effect. */
function createFloorGridTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Mid-gray base — instance color multiplies through this
  ctx.fillStyle = "#aaaaaa";
  ctx.fillRect(0, 0, size, size);

  // Outer panel edge — slightly brighter
  ctx.strokeStyle = "#cccccc";
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, size - 2, size - 2);

  // Corner accents — blue-ish highlight
  ctx.strokeStyle = "#bbccdd";
  ctx.lineWidth = 2;
  const c = 8;
  ctx.beginPath();
  ctx.moveTo(0, c); ctx.lineTo(0, 0); ctx.lineTo(c, 0);
  ctx.moveTo(size - c, 0); ctx.lineTo(size, 0); ctx.lineTo(size, c);
  ctx.moveTo(size, size - c); ctx.lineTo(size, size); ctx.lineTo(size - c, size);
  ctx.moveTo(c, size); ctx.lineTo(0, size); ctx.lineTo(0, size - c);
  ctx.stroke();

  // Subtle inner seam
  ctx.strokeStyle = "#999999";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(size / 2, 3);
  ctx.lineTo(size / 2, size - 3);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Create a yellow/black diagonal caution stripe texture for hazard floor markings. */
function createCautionStripeTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Black base
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, size, size);

  // Diagonal yellow stripes
  ctx.strokeStyle = "#ddaa00";
  ctx.lineWidth = 8;
  for (let i = -size; i < size * 2; i += 16) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + size, size);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function createToonGradient(): THREE.DataTexture {
  const colors = new Uint8Array([
    40,   // very dark (deep shadow)
    120,  // mid shadow
    200,  // lit
    255,  // highlight
  ]);
  const tex = new THREE.DataTexture(colors, colors.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

/** Create a material with optional emissive glow.
 *  Currently uses MeshStandardMaterial for proper texture display.
 *  Switch to MeshToonMaterial + gradientMap for cel-shaded look. */
function makeToonMaterial(opts: {
  color: number;
  gradientMap?: THREE.DataTexture;
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  map?: THREE.Texture | null;
}): THREE.MeshStandardMaterial {
  const matOpts: THREE.MeshStandardMaterialParameters = {
    color: opts.color,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1.0,
    roughness: 0.7,
    metalness: 0.1,
  };
  // Only set map if it's an actual texture (avoids THREE.Material "undefined" warning)
  if (opts.map) matOpts.map = opts.map;
  return new THREE.MeshStandardMaterial(matOpts);
}

// ── Color constants ──────────────────────────────────────────────
const COLORS_3D = {
  floor: 0x777777,
  wall: 0x99aabb,
  door: 0xdd8844,
  lockedDoor: 0xff4444,
  corridor: 0x6a6a6a,
  background: 0x0a0a12,
  player: 0x00ff00,
  fogFull: 0x000000,
  fogMemory: 0x111111,
} as const;

// How many world-units tall the visible area is (zoom level)
const CAMERA_FRUSTUM_SIZE = 7; // zoomed in for detail visibility

const ENTITY_COLORS_3D: Record<string, number> = {
  [EntityType.Relay]: 0xffcc00,
  [EntityType.SensorPickup]: 0x00ffee,
  [EntityType.DataCore]: 0xff44ff,
  [EntityType.ServiceBot]: 0xffaa00,
  [EntityType.LogTerminal]: 0x66ccff,
  [EntityType.CrewItem]: 0xccaa88,
  [EntityType.Drone]: 0x88bb88,
  [EntityType.MedKit]: 0xff6666,
  [EntityType.RepairBot]: 0xffaa66,
  [EntityType.Breach]: 0xff4444,
  [EntityType.ClosedDoor]: 0xaa8866,
  [EntityType.SecurityTerminal]: 0x44aaff,
  [EntityType.PatrolDrone]: 0xff2222,
  [EntityType.PressureValve]: 0x44bbaa,
  [EntityType.FuseBox]: 0xdd8800,
  [EntityType.PowerCell]: 0xffdd44,
  [EntityType.EscapePod]: 0x44ffaa,
  [EntityType.CrewNPC]: 0xffcc88,
  [EntityType.Airlock]: 0x8888cc,
  [EntityType.ToolPickup]: 0xffaa00,
  [EntityType.UtilityPickup]: 0x88ddff,
  [EntityType.Console]: 0x66aaff,
  [EntityType.RepairCradle]: 0xaaff66,
};

// Room wall tints — stronger color identity per zone
const ROOM_WALL_TINTS_3D: Record<string, number> = {
  "Engineering Storage": 0xbb9955,   // warm industrial amber
  "Power Relay Junction": 0xccaa44,  // electric yellow
  "Engine Core": 0xcc7733,           // hot orange
  "Life Support": 0x55aacc,          // cool medical blue
  "Vent Control Room": 0x6699bb,     // duct steel blue
  "Communications Hub": 0x5577cc,    // comm blue
  "Research Lab": 0x55bb77,          // lab green
  "Med Bay": 0xcc6688,              // medical pink-red
  "Data Core": 0xaa55cc,            // data purple
  "Robotics Bay": 0x889999,         // metallic grey-teal
  "Bridge": 0x7788bb,              // command blue-grey
  "Observation Deck": 0x6699aa,     // sky viewport blue
  "Escape Pod Bay": 0x55cc88,       // emergency green
  "Auxiliary Power": 0xbbaa44,       // power amber
  "Signal Room": 0x5566cc,          // signal deep blue
  "Server Annex": 0x9955bb,         // server violet
  "Armory": 0xcc5555,              // danger red
  "Emergency Shelter": 0x66bb77,    // safe green
  "Cargo Hold": 0xbb8844,          // cargo warm brown
  "Crew Quarters": 0xbbaa66,        // residential warm gold
  "Arrival Bay": 0x66aa88,          // teal arrival
  "Maintenance Corridor": 0x889988, // utility grey-green
};

// Room ambient light colors — warm/cool per room function
const ROOM_LIGHT_COLORS: Record<string, number> = {
  "Engineering Storage": 0xffaa44,    // warm amber
  "Power Relay Junction": 0xffcc66,   // warm yellow
  "Life Support": 0x44aaff,           // cool blue
  "Vent Control Room": 0x6688cc,      // steel blue
  "Communications Hub": 0x4488ff,     // bright blue
  "Research Lab": 0x44ff88,           // green
  "Med Bay": 0xff6688,               // pink-red
  "Data Core": 0xaa44ff,             // purple
  "Robotics Bay": 0x88aacc,          // neutral blue
  "Arrival Bay": 0x88ccaa,           // teal
  "Observation Deck": 0x6688bb,      // sky blue
  "Escape Pod Bay": 0x44ffaa,        // emergency green
  "Auxiliary Power": 0xffaa33,       // amber
  "Signal Room": 0x4466ff,           // deep blue
  "Server Annex": 0x8844dd,          // violet
  "Armory": 0xcc4444,               // red
  "Emergency Shelter": 0x66cc88,     // calm green
  "Maintenance Corridor": 0x778899,  // grey-blue
  "Cargo Hold": 0xaa8844,           // warm brown
  "Crew Quarters": 0xddaa66,        // warm gold
  "Corridor": 0x667788,              // dim grey-blue
};

// ── UI rendering helpers (shared with 2D — duplicated for independence) ──
const LOG_TYPE_CLASSES: Record<string, string> = {
  system: "log log-system",
  narrative: "log log-narrative",
  warning: "log log-warning",
  critical: "log log-critical",
  milestone: "log log-milestone",
  sensor: "log log-sensor",
};

const ENTITY_NAMES: Record<string, string> = {
  [EntityType.Relay]: "Power Relay",
  [EntityType.SensorPickup]: "Sensor Module",
  [EntityType.DataCore]: "Data Core",
  [EntityType.ServiceBot]: "Service Bot",
  [EntityType.LogTerminal]: "Log Terminal",
  [EntityType.CrewItem]: "Crew Item",
  [EntityType.Drone]: "Maintenance Drone",
  [EntityType.MedKit]: "Med Kit",
  [EntityType.RepairBot]: "Repair Bot",
  [EntityType.Breach]: "Hull Breach",
  [EntityType.ClosedDoor]: "Sealed Door",
  [EntityType.SecurityTerminal]: "Security Terminal",
  [EntityType.PatrolDrone]: "Patrol Drone",
  [EntityType.PressureValve]: "Pressure Valve",
  [EntityType.FuseBox]: "Fuse Box",
  [EntityType.PowerCell]: "Power Cell",
  [EntityType.EscapePod]: "Escape Pod",
  [EntityType.CrewNPC]: "Crew Member",
  [EntityType.Airlock]: "Airlock",
  [EntityType.ToolPickup]: "Tool Module",
  [EntityType.UtilityPickup]: "Utility Module",
  [EntityType.Console]: "Console",
  [EntityType.RepairCradle]: "Repair Cradle",
};

const ENTITY_COLORS_CSS: Record<string, string> = {
  [EntityType.Relay]: "#ffcc00",
  [EntityType.SensorPickup]: "#00ffee",
  [EntityType.DataCore]: "#ff44ff",
  [EntityType.ServiceBot]: "#ffaa00",
  [EntityType.LogTerminal]: "#66ccff",
  [EntityType.CrewItem]: "#ccaa88",
  [EntityType.Drone]: "#88bb88",
  [EntityType.MedKit]: "#ff6666",
  [EntityType.RepairBot]: "#ffaa66",
  [EntityType.Breach]: "#ff4444",
  [EntityType.ClosedDoor]: "#aa8866",
  [EntityType.SecurityTerminal]: "#44aaff",
  [EntityType.PatrolDrone]: "#ff2222",
  [EntityType.PressureValve]: "#44bbaa",
  [EntityType.FuseBox]: "#dd8800",
  [EntityType.PowerCell]: "#ffdd44",
  [EntityType.EscapePod]: "#44ffaa",
  [EntityType.CrewNPC]: "#ffcc88",
  [EntityType.Airlock]: "#8888cc",
  [EntityType.ToolPickup]: "#ffaa00",
  [EntityType.UtilityPickup]: "#88ddff",
  [EntityType.Console]: "#66aaff",
  [EntityType.RepairCradle]: "#aaff66",
};

// ── GLTF Model paths ────────────────────────────────────────────
// Synty FBX files are converted to GLTF via convert-models script.
// Quaternius models are already GLTF.
// Tile model paths (Synty Space building pieces)
const WALL_MODEL_PATH = "models/synty-space-gltf/SM_Bld_Wall_01.glb";
const WALL_CORNER_MODEL_PATH = "models/synty-space-gltf/SM_Bld_Wall_03.glb";
const FLOOR_MODEL_PATH = "models/synty-space-gltf/SM_Bld_Floor_Small_01.glb";
const DOOR_MODEL_PATH = "models/synty-space-gltf/SM_Bld_Wall_Doorframe_01.glb";

const MODEL_PATHS: Partial<Record<string, string>> = {
  // Player bot (Sweepo cleaning robot)
  player: "models/synty-space-gltf/SM_Veh_Sweepo_01.glb",
  // Station systems
  [EntityType.Relay]: "models/synty-space-gltf/SM_Prop_Battery_01.glb",
  [EntityType.SensorPickup]: "models/synty-space-gltf/SM_Prop_Antenna_01.glb",
  [EntityType.DataCore]: "models/synty-space-gltf/SM_Prop_CenterTube_01.glb",
  [EntityType.ServiceBot]: "models/synty-space-gltf/SM_Veh_Drone_Attach_01.glb",
  [EntityType.LogTerminal]: "models/synty-space-gltf/SM_Bld_Crew_Desk_01.glb",
  [EntityType.SecurityTerminal]: "models/synty-space-gltf/SM_Bld_Bridge_Console_01.glb",
  [EntityType.MedKit]: "models/synty-space-gltf/SM_Prop_Crate_health_01.glb",
  [EntityType.CrewItem]: "models/synty-space-gltf/SM_Prop_Detail_Box_01.glb",
  [EntityType.ClosedDoor]: "models/synty-space-gltf/SM_Bld_Wall_Doorframe_01.glb",
  [EntityType.RepairBot]: "models/synty-space-gltf/SM_Veh_Drone_Repair_01.glb",
  [EntityType.Drone]: "models/synty-space-gltf/SM_Veh_Drone_Attach_01.glb",
  [EntityType.PatrolDrone]: "models/synty-space-gltf/SM_Veh_Drone_Attach_01.glb",
  [EntityType.EscapePod]: "models/synty-space-gltf/SM_Veh_EscapePod_Large_01.glb",
  [EntityType.CrewNPC]: "models/synty-space-gltf/SK_Chr_Crew_Male_01.glb",
  [EntityType.Airlock]: "models/synty-space-gltf/SM_Bld_Wall_Doorframe_02.glb",
  [EntityType.ToolPickup]: "models/synty-space-gltf/SM_Prop_Cart_01.glb",
  [EntityType.UtilityPickup]: "models/synty-space-gltf/SM_Prop_Oxygen_Tank_Small.glb",
  [EntityType.Console]: "models/synty-space-gltf/SM_Prop_ControlPanel_02.glb",
  [EntityType.RepairCradle]: "models/synty-space-gltf/SM_Prop_CryoBed_01.glb",
  [EntityType.PressureValve]: "models/synty-space-gltf/SM_Prop_AirVent_Small_01.glb",
  [EntityType.FuseBox]: "models/synty-space-gltf/SM_Prop_Panel_01.glb",
  [EntityType.PowerCell]: "models/synty-space-gltf/SM_Prop_Battery_02.glb",
  [EntityType.Breach]: "models/synty-space-gltf/SM_Prop_Wires_01.glb",
  // EvidenceTrace uses procedural ? mesh (no GLTF — more distinctive)
};

// ── BrowserDisplay3D ─────────────────────────────────────────────
export class BrowserDisplay3D implements IGameDisplay {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private mapWidth: number;
  private mapHeight: number;

  // Lighting
  private playerLight: THREE.PointLight;

  // Tile instanced meshes
  private floorMesh: THREE.InstancedMesh;
  private wallMesh: THREE.InstancedMesh;
  private wallCornerMesh: THREE.InstancedMesh;
  private doorMesh: THREE.InstancedMesh;
  private fogFullMesh: THREE.InstancedMesh;
  private fogMemoryMesh: THREE.InstancedMesh;

  // Entity meshes
  private entityMeshes: Map<string, THREE.Object3D> = new Map();
  private entityGroup: THREE.Group;

  // Interaction indicator — floating diamond above nearby interactable
  private interactionIndicator: THREE.Mesh | null = null;
  private interactionTargetId: string = "";

  // Player mesh
  private playerMesh: THREE.Group;

  // Model cache (key = entityType or "player")
  private gltfCache: Map<string, THREE.Object3D> = new Map();
  private gltfLoader: GLTFLoader;
  private modelsLoaded = false;

  // Wall/floor model meshes (loaded from GLB, used for instanced rendering)
  private wallModelGeo: THREE.BufferGeometry | null = null;
  private wallModelMat: THREE.Material | null = null;
  private wallCornerModelGeo: THREE.BufferGeometry | null = null;
  private wallCornerModelMat: THREE.Material | null = null;
  private floorModelGeo: THREE.BufferGeometry | null = null;
  private floorModelMat: THREE.Material | null = null;
  private doorModelGeo: THREE.BufferGeometry | null = null;
  private doorModelMat: THREE.Material | null = null;

  // Animation
  private animFrameId: number = 0;
  private clock: THREE.Clock;

  // Player facing direction (rotation on Y axis)
  private playerFacing: number = 0; // radians — 0 = facing camera (+Z)
  private lastPlayerX: number = -1;
  private lastPlayerY: number = -1;

  // Smooth movement interpolation
  private playerTargetX: number = 0;
  private playerTargetZ: number = 0;
  private playerCurrentX: number = 0;
  private playerCurrentZ: number = 0;
  private cameraTargetX: number = 0;
  private cameraTargetZ: number = 0;
  private cameraPosX: number = 0;
  private cameraPosZ: number = 0;
  private static readonly LERP_SPEED = 12; // units per second — snappy but smooth
  private _lastAnimTime: number | null = null;

  // Display state
  private sensorMode: SensorType | null = null;
  private logHistory: DisplayLogEntry[] = [];
  private static readonly MAX_LOG_ENTRIES = 16;
  private roomFlashMessage = "";
  private roomFlashTimer: ReturnType<typeof setTimeout> | null = null;
  private lastRoomId = "";
  private showTrail = false;
  private cameraZoomPulse: number = 0; // >0 = zooming out briefly on room transition

  // Room decoration props (placed once per room when explored)
  private decoratedRooms: Set<string> = new Set();
  private decorationGroup: THREE.Group = new THREE.Group();

  // Dummy objects for instance matrix computation
  private dummy = new THREE.Object3D();

  // Tile counts for instanced meshes
  private maxTiles: number;

  // Resize handler
  private resizeHandler: () => void;

  // Cel-shaded rendering
  private outlineEffect: OutlineEffect;
  private toonGradient: THREE.DataTexture;

  // Room lights (colored point lights at room centers)
  private roomLights: Map<string, THREE.PointLight> = new Map();
  private corridorLitTiles: Set<string> = new Set();
  private corridorDecorTiles: Set<string> = new Set();

  // Synty texture atlas (loaded at startup, applied to models that lack embedded textures)
  private syntyAtlas: THREE.Texture | null = null;

  // Particle systems
  private dustParticles: THREE.Points | null = null;
  private starfieldPoints: THREE.Points | null = null;

  // Hazard visual effects (sprites at hazardous tile positions)
  private hazardSprites: THREE.Group = new THREE.Group();
  private hazardSpriteKeys: Set<string> = new Set();

  // Door frame accent lights
  private doorLights: Map<string, THREE.PointLight> = new Map();

  // Floating room name labels
  private roomLabels3D: Map<string, THREE.Sprite> = new Map();

  // Entity name labels (shown when player is nearby)
  private entityLabels: Map<string, THREE.Sprite> = new Map();
  private entityLabelCanvas: Map<string, HTMLCanvasElement> = new Map();

  // Caution stripe floor markings near hazardous entities
  private cautionMarkedTiles: Set<string> = new Set();
  private cautionStripeGroup: THREE.Group = new THREE.Group();

  // Corridor overhead pipe runs
  private corridorPipeTiles: Set<string> = new Set();
  private pipeGroup: THREE.Group = new THREE.Group();

  // Player movement trail
  private trailPoints: THREE.Points | null = null;
  private trailPositions: Float32Array = new Float32Array(0);
  private trailOpacities: Float32Array = new Float32Array(0);
  private static readonly TRAIL_LENGTH = 12;

  constructor(container: HTMLElement, mapWidth?: number, mapHeight?: number) {
    this.container = container;
    this.mapWidth = mapWidth ?? DEFAULT_MAP_WIDTH;
    this.mapHeight = mapHeight ?? DEFAULT_MAP_HEIGHT;
    this.maxTiles = this.mapWidth * this.mapHeight;

    this.clock = new THREE.Clock();
    this.gltfLoader = new GLTFLoader();

    // ── Renderer ──
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setClearColor(COLORS_3D.background);
    container.appendChild(this.renderer.domElement);

    // Add mode-3d class to game container for CSS
    document.getElementById("game-container")?.classList.add("mode-3d");

    // ── Scene ──
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS_3D.background);
    // Atmospheric fog — subtle fade at the far edges only
    this.scene.fog = new THREE.Fog(COLORS_3D.background, 18, 35);

    // ── Camera (orthographic, zoomed-in, follows player) ──
    const aspect = this.getAspect();
    const frustumHeight = CAMERA_FRUSTUM_SIZE;
    const frustumWidth = frustumHeight * aspect;
    this.camera = new THREE.OrthographicCamera(
      -frustumWidth / 2, frustumWidth / 2,
      frustumHeight / 2, -frustumHeight / 2,
      0.1, 200
    );
    // Low-angle offset: camera sits behind and slightly above for drama
    // Will be repositioned each frame to follow the player
    this.camera.position.set(0, 8, 12);
    this.camera.lookAt(0, 0, 0);

    // ── Cel-shading: Outline Effect ──
    this.toonGradient = createToonGradient();
    this.outlineEffect = new OutlineEffect(this.renderer, {
      defaultThickness: 0.003,
      defaultColor: [0, 0, 0],
      defaultAlpha: 0.8,
    });

    // ── Lights (brighter for visibility, still atmospheric) ──
    const ambient = new THREE.AmbientLight(0x8899aa, 1.6);
    this.scene.add(ambient);

    // Strong key light — warm directional from upper-left
    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.8);
    dirLight.position.set(-8, 15, -5);
    this.scene.add(dirLight);

    // Cool fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0x4466aa, 0.8);
    fillLight.position.set(8, 10, 5);
    this.scene.add(fillLight);

    // Subtle rim light from behind for depth
    const rimLight = new THREE.DirectionalLight(0x8888ff, 0.4);
    rimLight.position.set(0, 5, 15);
    this.scene.add(rimLight);

    this.playerLight = new THREE.PointLight(0x44ff66, 2.5, 16);
    this.playerLight.position.set(0, 3, 0);
    this.scene.add(this.playerLight);

    // ── Instanced meshes for tiles ──
    // Material color is WHITE — instance colors control per-tile color directly
    // (Three.js multiplies material color * instance color, so white = passthrough)
    const floorGeo = new THREE.BoxGeometry(1, 0.08, 1);
    floorGeo.translate(0, -0.04, 0); // sit flush at y=0
    const floorGridTex = createFloorGridTexture();
    const floorMat = makeToonMaterial({ color: 0xffffff, gradientMap: this.toonGradient, map: floorGridTex });
    this.floorMesh = new THREE.InstancedMesh(floorGeo, floorMat, this.maxTiles);
    this.floorMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.floorMesh.frustumCulled = false; // instances span entire map
    this.floorMesh.count = 0;
    this.scene.add(this.floorMesh);

    const wallGeo = new THREE.BoxGeometry(1, 2.0, 1);
    const wallMat = makeToonMaterial({ color: 0xffffff, gradientMap: this.toonGradient });
    this.wallMesh = new THREE.InstancedMesh(wallGeo, wallMat, this.maxTiles);
    this.wallMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wallMesh.frustumCulled = false;
    this.wallMesh.count = 0;
    this.scene.add(this.wallMesh);

    // Corner walls (placeholder geo, replaced when model loads)
    const cornerGeo = new THREE.BoxGeometry(1, 2.0, 1);
    const cornerMat = makeToonMaterial({ color: 0xffffff, gradientMap: this.toonGradient });
    this.wallCornerMesh = new THREE.InstancedMesh(cornerGeo, cornerMat, this.maxTiles);
    this.wallCornerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wallCornerMesh.frustumCulled = false;
    this.wallCornerMesh.count = 0;
    this.scene.add(this.wallCornerMesh);

    const doorGeo = new THREE.BoxGeometry(0.85, 1.6, 0.15);
    const doorMat = makeToonMaterial({ color: 0xffffff, gradientMap: this.toonGradient });
    this.doorMesh = new THREE.InstancedMesh(doorGeo, doorMat, 200);
    this.doorMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.doorMesh.frustumCulled = false;
    this.doorMesh.count = 0;
    this.scene.add(this.doorMesh);

    // Fog-of-war overlays
    const fogGeo = new THREE.PlaneGeometry(1, 1);
    fogGeo.rotateX(-Math.PI / 2);
    const fogFullMat = new THREE.MeshBasicMaterial({
      color: COLORS_3D.fogFull,
    });
    this.fogFullMesh = new THREE.InstancedMesh(fogGeo, fogFullMat, this.maxTiles);
    this.fogFullMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fogFullMesh.frustumCulled = false;
    this.fogFullMesh.count = 0;
    this.scene.add(this.fogFullMesh);

    const fogMemGeo = new THREE.PlaneGeometry(1, 1);
    fogMemGeo.rotateX(-Math.PI / 2);
    const fogMemMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.5,
    });
    this.fogMemoryMesh = new THREE.InstancedMesh(fogMemGeo, fogMemMat, this.maxTiles);
    this.fogMemoryMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fogMemoryMesh.frustumCulled = false;
    this.fogMemoryMesh.count = 0;
    this.scene.add(this.fogMemoryMesh);

    // ── Entity group ──
    this.entityGroup = new THREE.Group();
    this.scene.add(this.entityGroup);

    // ── Interaction indicator (floating diamond above nearest interactable) ──
    const indicatorGeo = new THREE.OctahedronGeometry(0.18, 0);
    const indicatorMat = new THREE.MeshBasicMaterial({ color: 0x44ffaa, transparent: true, opacity: 0.9 });
    this.interactionIndicator = new THREE.Mesh(indicatorGeo, indicatorMat);
    this.interactionIndicator.visible = false;
    // Add glow ring beneath indicator
    const ringGeo = new THREE.RingGeometry(0.25, 0.38, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x44ffaa, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = -0.5; // below the diamond
    this.interactionIndicator.add(ring);
    this.scene.add(this.interactionIndicator);

    // ── Decoration group (room props) ──
    this.scene.add(this.decorationGroup);

    // ── Hazard visual effects group ──
    this.scene.add(this.hazardSprites);

    // ── Caution stripe markings and corridor pipes ──
    this.scene.add(this.cautionStripeGroup);
    this.scene.add(this.pipeGroup);

    // ── Starfield background (distant stars visible through station gaps) ──
    this.createStarfield();

    // ── Ambient dust particles (floating motes near the camera) ──
    this.createDustParticles();

    // ── Player movement trail ──
    this.createMovementTrail();

    // ── Player mesh (green cylinder + antenna box) ──
    this.playerMesh = this.createPlayerMesh();
    this.scene.add(this.playerMesh);

    // ── Resize ──
    this.resizeHandler = () => this.handleResize();
    window.addEventListener("resize", this.resizeHandler);
    this.handleResize();

    // ── Start animation loop ──
    this.animate();

    // ── Load Synty texture atlas, then GLTF models ──
    this.loadAtlasThenModels();
  }

  // ── Public interface ────────────────────────────────────────────

  get isThermalActive(): boolean {
    return this.sensorMode === SensorType.Thermal;
  }

  get isCleanlinessActive(): boolean {
    return this.sensorMode === SensorType.Cleanliness;
  }

  get activeSensorMode(): SensorType | null {
    return this.sensorMode;
  }

  toggleSensor(type: SensorType): void {
    const wasNull = this.sensorMode === null;
    this.sensorMode = this.sensorMode === type ? null : type;

    // Visual scan wave when activating a sensor
    if (this.sensorMode && wasNull !== (this.sensorMode === null)) {
      this.triggerScanWave();
    }
  }

  private triggerScanWave(): void {
    const sensorColors: Record<string, number> = {
      [SensorType.Thermal]: 0xff4422,
      [SensorType.Atmospheric]: 0x44aaff,
      [SensorType.Cleanliness]: 0x88cc44,
    };
    const waveColor = sensorColors[this.sensorMode ?? ""] ?? 0x44ff88;

    const ringGeo = new THREE.RingGeometry(0.1, 0.3, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: waveColor,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(this.playerCurrentX, 0.1, this.playerCurrentZ);
    this.scene.add(ring);

    const startTime = this.clock.getElapsedTime();
    const duration = 1.0;
    const animateWave = () => {
      const t = (this.clock.getElapsedTime() - startTime) / duration;
      if (t >= 1) {
        this.scene.remove(ring);
        ringGeo.dispose();
        ringMat.dispose();
        return;
      }
      const scale = 1 + t * 15;
      ring.scale.set(scale, 1, scale);
      ringMat.opacity = 0.6 * (1 - t * t); // quadratic fade
      requestAnimationFrame(animateWave);
    };
    requestAnimationFrame(animateWave);
  }

  addLog(msg: string, type: LogType = "system"): void {
    this.logHistory.push({ text: msg, type });
    if (this.logHistory.length > BrowserDisplay3D.MAX_LOG_ENTRIES) {
      this.logHistory.shift();
    }
  }

  getLogHistory(): DisplayLogEntry[] {
    return this.logHistory;
  }

  triggerTrail(): void {
    this.showTrail = true;
  }

  updateRoomFlash(state: GameState): void {
    const room = this.getPlayerRoom(state);
    const roomId = room ? room.id : "";
    if (roomId && roomId !== this.lastRoomId) {
      this.roomFlashMessage = room!.name;
      if (this.roomFlashTimer) clearTimeout(this.roomFlashTimer);

      // Trigger camera zoom pulse for room transition
      this.cameraZoomPulse = 1.0;

      // Show room name banner on the 3D viewport
      const banner = document.getElementById("room-banner");
      if (banner) {
        const zone = room?.zone ? `<span class="banner-zone">${room.zone} Sector</span>` : "";
        banner.innerHTML = room!.name + zone;
        banner.className = "active";
        setTimeout(() => { banner.className = "fade-out"; }, 1200);
        setTimeout(() => { banner.className = ""; banner.innerHTML = ""; }, 2200);
      }

      this.roomFlashTimer = setTimeout(() => {
        this.roomFlashMessage = "";
        this.roomFlashTimer = null;
      }, 2000);
    }
    this.lastRoomId = roomId;
  }

  flashTile(x: number, y: number, _color?: string): void {
    // 3D interaction flash: expanding glowing ring at the tile position
    const ringGeo = new THREE.TorusGeometry(0.2, 0.03, 6, 16);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x44ff88,
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(x, 0.1, y);
    this.scene.add(ring);

    // Animate: expand and fade over 600ms
    const startTime = this.clock.getElapsedTime();
    const duration = 0.6;
    const animateRing = () => {
      const t = (this.clock.getElapsedTime() - startTime) / duration;
      if (t >= 1) {
        this.scene.remove(ring);
        ringGeo.dispose();
        ringMat.dispose();
        return;
      }
      const scale = 1 + t * 3;
      ring.scale.set(scale, 1, scale);
      ringMat.opacity = 0.8 * (1 - t);
      requestAnimationFrame(animateRing);
    };
    requestAnimationFrame(animateRing);
  }

  // Camera shake state
  private cameraShakeIntensity: number = 0;
  private cameraShakeDecay: number = 0;

  triggerScreenFlash(type: "damage" | "milestone" | "stun"): void {
    const flash = document.getElementById("damage-flash");
    if (!flash) return;
    flash.className = `active ${type}`;
    setTimeout(() => { flash.className = ""; }, 200);

    // 3D camera shake on damage/stun
    if (type === "damage") {
      this.cameraShakeIntensity = 0.15;
      this.cameraShakeDecay = 3.0;
    } else if (type === "stun") {
      this.cameraShakeIntensity = 0.25;
      this.cameraShakeDecay = 2.0;
    }
  }

  showGameOverOverlay(state: GameState): void {
    const overlay = document.getElementById("gameover-overlay");
    if (!overlay) return;

    const isVictory = state.victory;
    const hpPercent = Math.round((state.player.hp / state.player.maxHp) * 100);
    const hpClass = hpPercent > 60 ? "good" : hpPercent > 30 ? "warn" : "bad";
    let relaysActivated = 0, totalRelays = 0;
    for (const [, e] of state.entities) {
      if (e.type === EntityType.Relay && e.props["locked"] !== true) {
        totalRelays++;
        if (e.props["activated"] === true) relaysActivated++;
      }
    }
    const breachesSealed = Array.from(state.entities.values()).filter(e =>
      e.type === EntityType.Breach && e.props["sealed"] === true
    ).length;
    const totalBreaches = Array.from(state.entities.values()).filter(e => e.type === EntityType.Breach).length;

    const title = isVictory ? "TRANSMISSION COMPLETE" : "CONNECTION LOST";
    const titleClass = isVictory ? "victory" : "defeat";
    const subtitle = isVictory
      ? "The crew's research data streams through the low-band relay.<br>Nine months of work, preserved."
      : "Sweepo signal lost. The data core remains sealed.<br>CORVUS-7 drifts on, silent.";

    // Deduction and evidence stats
    const deductions = state.mystery?.deductions ?? [];
    const deductionsCorrect = deductions.filter(d => d.answeredCorrectly).length;
    const evidenceCount = state.mystery?.journal.length ?? 0;
    const roomsExplored = state.rooms.filter(r => {
      for (let ry = r.y; ry < r.y + r.height; ry++) {
        for (let rx = r.x; rx < r.x + r.width; rx++) {
          if (ry >= 0 && ry < state.height && rx >= 0 && rx < state.width) {
            if (state.tiles[ry][rx].explored) return true;
          }
        }
      }
      return false;
    }).length;

    // Performance rating
    let score = 0;
    if (isVictory) score += 40;
    score += Math.min(20, deductionsCorrect * (20 / Math.max(deductions.length, 1)));
    score += Math.min(15, (roomsExplored / Math.max(state.rooms.length, 1)) * 15);
    score += Math.min(15, (hpPercent / 100) * 15);
    score += Math.min(10, isVictory && state.turn < 200 ? 10 : isVictory && state.turn < 350 ? 5 : 0);
    const rating = score >= 90 ? "S" : score >= 75 ? "A" : score >= 55 ? "B" : score >= 35 ? "C" : "D";
    const ratingColor = rating === "S" ? "#ff0" : rating === "A" ? "#0f0" : rating === "B" ? "#6cf" : rating === "C" ? "#fa0" : "#f44";

    // Crew evacuation
    const evac = state.mystery?.evacuation;
    const crewEvacuated = evac?.crewEvacuated.length || 0;
    const crewDead = evac?.crewDead.length || 0;
    let crewHtml = "";
    if (crewEvacuated > 0 || crewDead > 0) {
      crewHtml = `<div class="gameover-stat"><span class="stat-label">Crew Evacuated:</span> <span class="stat-value ${crewDead === 0 ? 'good' : 'warn'}">${crewEvacuated}/${crewEvacuated + crewDead}</span></div>`;
    }

    // Mystery choices
    const choices = state.mystery?.choices ?? [];
    const choicesMade = choices.filter(c => c.chosen).length;
    const choicesHtml = choicesMade > 0
      ? `<div class="gameover-stat"><span class="stat-label">Decisions Made:</span> <span class="stat-value">${choicesMade}/${choices.length}</span></div>`
      : "";

    overlay.innerHTML = `
      <div class="gameover-box ${titleClass}">
        <div class="gameover-title ${titleClass}">${title}</div>
        <div class="gameover-subtitle">${subtitle}</div>
        <div class="gameover-rating" style="text-align:center;margin:8px 0">
          <span style="color:${ratingColor};font-size:32px;font-weight:bold;text-shadow:0 0 10px ${ratingColor}">${rating}</span>
          <div style="color:#888;font-size:12px">PERFORMANCE RATING</div>
        </div>
        <div class="gameover-stats">
          <div class="gameover-stat"><span class="stat-label">Turns:</span> <span class="stat-value">${state.turn}</span></div>
          <div class="gameover-stat"><span class="stat-label">Hull Integrity:</span> <span class="stat-value ${hpClass}">${state.player.hp}/${state.player.maxHp} (${hpPercent}%)</span></div>
          <div class="gameover-stat"><span class="stat-label">Rooms Explored:</span> <span class="stat-value ${roomsExplored >= state.rooms.length ? 'good' : 'warn'}">${roomsExplored}/${state.rooms.length}</span></div>
          <div class="gameover-stat"><span class="stat-label">Relays Rerouted:</span> <span class="stat-value ${relaysActivated >= totalRelays ? 'good' : 'warn'}">${relaysActivated}/${totalRelays}</span></div>
          <div class="gameover-stat"><span class="stat-label">Breaches Sealed:</span> <span class="stat-value ${breachesSealed >= totalBreaches ? 'good' : 'warn'}">${breachesSealed}/${totalBreaches}</span></div>
          ${crewHtml}
          <div class="gameover-stat"><span class="stat-label">Evidence Collected:</span> <span class="stat-value">${evidenceCount}</span></div>
          <div class="gameover-stat"><span class="stat-label">Deductions:</span> <span class="stat-value ${deductionsCorrect === deductions.length ? 'good' : deductionsCorrect > 0 ? 'warn' : 'bad'}">${deductionsCorrect}/${deductions.length} correct</span></div>
          ${choicesHtml}
        </div>
        <div class="gameover-restart">Press [R] to restart</div>
      </div>`;
    overlay.classList.add("active");
  }

  async copyRunSummary(): Promise<boolean> {
    return false; // 3D renderer delegates to 2D for game-over
  }

  destroy(): void {
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener("resize", this.resizeHandler);
    if (this.roomFlashTimer) clearTimeout(this.roomFlashTimer);
    // Clean up overlays
    const overlay = document.getElementById("gameover-overlay");
    if (overlay) overlay.classList.remove("active");

    // Remove mode-3d class
    document.getElementById("game-container")?.classList.remove("mode-3d");

    // Hide minimap
    const minimap = document.getElementById("minimap-canvas");
    if (minimap) minimap.style.display = "none";

    // Dispose all geometries and materials
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m: THREE.Material) => m.dispose());
        } else if (obj.material) {
          obj.material.dispose();
        }
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }

  // ── Render game state into 3D scene ─────────────────────────────

  render(state: GameState): void {
    this.updateTiles(state);
    this.updateEntities(state);
    this.updatePlayer(state);
    this.updateFog(state);
    this.updateRoomLights(state);
    this.placeRoomDecorations(state);
    this.placeCautionMarkings(state);
    this.placeCorridorPipes(state);
    this.updateHazardVisuals(state);
    this.updateDoorLights(state);
    this.updateRoomLabels(state);
    this.updateEntityLabels(state);
    this.renderMinimap(state);
  }

  // ── Render sidebar UI (same HTML as 2D) ─────────────────────────

  renderUI(state: GameState, panel: HTMLElement, visitedRoomIds?: Set<string>): void {
    // This shares the same HTML-rendering logic as BrowserDisplay.
    // We duplicate the essential parts here so display3d.ts is self-contained.

    // Sensor mode tag
    const sensorNames: Record<string, string> = {
      [SensorType.Thermal]: "THERMAL",
      [SensorType.Cleanliness]: "CLEANLINESS",
      [SensorType.Atmospheric]: "ATMOSPHERIC",
    };
    const sensorTag = this.sensorMode
      ? ` <span class='thermal-active'>[${sensorNames[this.sensorMode] ?? this.sensorMode.toUpperCase()}]</span>`
      : "";

    // Objective with phase indicator
    const objective = this.getObjective(state);
    const phaseLabels: Record<string, { label: string; color: string }> = {
      [ObjectivePhase.Clean]: { label: "MAINTENANCE", color: "#4a4" },
      [ObjectivePhase.Investigate]: { label: "INVESTIGATION", color: "#fa0" },
      [ObjectivePhase.Recover]: { label: "RECOVERY", color: "#f44" },
      [ObjectivePhase.Evacuate]: { label: "EVACUATION", color: "#f0f" },
    };
    const phase = state.mystery?.objectivePhase ?? ObjectivePhase.Clean;
    const phaseInfo = phaseLabels[phase] ?? { label: "UNKNOWN", color: "#888" };
    const phaseTag = `<span style="color:${phaseInfo.color};font-weight:bold;font-size:11px;letter-spacing:1px">[${phaseInfo.label}]</span> `;
    const objectiveHtml = `<div class="objective-panel">` +
      `${phaseTag}<span class="objective-label">OBJECTIVE:</span> ` +
      `<span class="objective-text">${this.escapeHtml(objective.text)}</span>` +
      `<br><span class="objective-detail">${this.escapeHtml(objective.detail)}</span>` +
      `</div>`;

    // Interaction hint
    let interactHint = "";
    if (!state.gameOver) {
      const nearby = this.getAdjacentInteractables(state);
      if (nearby.length > 0) {
        const target = nearby[0];
        const name = entityDisplayName(target);
        interactHint = `<span class="interact-hint"> ▸ [i] ${this.escapeHtml(name)}</span>`;
      }
    }

    // Proximity
    let proximityHtml = "";
    if (!state.gameOver) {
      const nearbyEnts = this.getNearbyEntities(state, 3);
      if (nearbyEnts.length > 0) {
        const items = nearbyEnts.slice(0, 4).map(n => {
          const name = entityDisplayName(n.entity);
          const color = ENTITY_COLORS_CSS[n.entity.type] || "#aaa";
          return `<span style="color:${color}">${this.escapeHtml(name)}</span> <span class="label">(${n.dist} tile${n.dist > 1 ? "s" : ""} ${n.dir})</span>`;
        });
        proximityHtml = `<div class="proximity-bar"><span class="label">NEARBY:</span> ${items.join(" | ")}</div>`;
      }
    }

    // Status bar
    const room = this.getPlayerRoom(state);
    const zoneTag = room?.zone ? ` <span class="label">[${this.escapeHtml(room.zone)}]</span>` : "";
    const roomLabel = room
      ? ` | <span class="value">${this.escapeHtml(room.name)}</span>${zoneTag}`
      : "";

    const hpPercent = Math.round((state.player.hp / state.player.maxHp) * 100);
    const hpColor = hpPercent > 60 ? "#0f0" : hpPercent > 30 ? "#fa0" : "#f00";
    const hpBarWidth = 10;
    const filledBlocks = Math.round((state.player.hp / state.player.maxHp) * hpBarWidth);
    const emptyBlocks = hpBarWidth - filledBlocks;
    const hpBar = "\u2588".repeat(filledBlocks) + "\u2591".repeat(emptyBlocks);
    const hpCriticalClass = hpPercent <= 25 ? " hp-critical" : "";
    const hpWarning = hpPercent <= 25 ? " \u26a0 CRITICAL" : hpPercent <= 50 ? " \u26a0" : "";
    const hpTag = ` | <span class="label">HP:</span><span class="${hpCriticalClass}" style="color:${hpColor}">${hpBar} ${state.player.hp}/${state.player.maxHp}${hpWarning}</span>`;

    // Stun indicator
    const stunTag = state.player.stunTurns > 0
      ? ` | <span style="color:#44f; font-weight:bold">\u26a1 STUNNED (${state.player.stunTurns})</span>`
      : "";

    const unreadCount = state.logs.filter(l => l.read === false).length;
    const unreadTag = unreadCount > 0
      ? ` | <span style="color:#ca8">[${unreadCount} UNREAD]</span>`
      : "";

    // Discovery counter (shared utility)
    const disc = getDiscoveries(state);
    const discoveryTag = ` | <span class="label">Discoveries:</span> <span style="color:#ca8">${disc.discovered}/${disc.total}</span>`;

    // Evidence & deduction progress
    let evidenceTag = "";
    let deductionTag = "";
    if (state.mystery) {
      const jCount = state.mystery.journal.length;
      if (jCount > 0) {
        evidenceTag = ` | <span class="label">Evidence:</span> <span style="color:#6cf">${jCount}</span>`;
      }
      const deductions = state.mystery.deductions ?? [];
      const unlocked = getUnlockedDeductions(deductions, state.mystery.journal);
      if (deductions.length > 0) {
        const correct = deductions.filter(d => d.answeredCorrectly).length;
        const solved = deductions.filter(d => d.solved).length;
        deductionTag = ` | <span class="label">Deductions:</span> <span style="color:#fa0">${correct}/${solved}</span>`;
        if (unlocked.length > 0) {
          deductionTag += ` <span style="color:#ff0">[${unlocked.length} NEW]</span>`;
        }
      }
    }

    const statusHtml = `<div class="status-bar">` +
      `<span class="label">T:</span><span class="value">${state.turn}</span>` +
      roomLabel + sensorTag + stunTag +
      `<br>` + hpTag.replace(/ \| /, '') +
      `<br>` + discoveryTag.replace(/ \| /, '') + evidenceTag.replace(/ \| /, '') + deductionTag.replace(/ \| /, '') + unreadTag.replace(/ \| /g, '') +
      interactHint +
      `</div>`;

    // Room list
    const cameraRevealedRoomIds = new Set<string>();
    for (let ri = 0; ri < state.rooms.length; ri++) {
      const r = state.rooms[ri];
      if (visitedRoomIds && visitedRoomIds.has(r.id)) continue;
      let anyExplored = false;
      for (let ry = r.y; ry < r.y + r.height && !anyExplored; ry++) {
        for (let rx = r.x; rx < r.x + r.width && !anyExplored; rx++) {
          if (rx >= 0 && rx < state.width && ry >= 0 && ry < state.height) {
            if (state.tiles[ry][rx].explored) anyExplored = true;
          }
        }
      }
      if (anyExplored) cameraRevealedRoomIds.add(r.id);
    }

    let roomListHtml = "";
    if (state.rooms.length > 0 && visitedRoomIds) {
      const roomItems = state.rooms.map(r => {
        const visited = visitedRoomIds.has(r.id);
        const cameraRevealed = cameraRevealedRoomIds.has(r.id);
        const mark = visited
          ? `<span style="color:#0f0">\u2713</span>`
          : cameraRevealed
            ? `<span style="color:#4af">\u25cb</span>`
            : `<span class="label">\u00b7</span>`;
        const label = visited
          ? `<span style="color:#8b8">${this.escapeHtml(r.name)}</span>`
          : cameraRevealed
            ? `<span style="color:#4a8">${this.escapeHtml(r.name)}</span>`
            : `<span class="label">???</span>`;
        return `${mark} ${label}`;
      });
      const half = Math.ceil(roomItems.length / 2);
      const col1 = roomItems.slice(0, half);
      const col2 = roomItems.slice(half);
      let rows = "";
      for (let i = 0; i < half; i++) {
        const left = col1[i] || "";
        const right = col2[i] || "";
        rows += `<div class="room-row"><span class="room-col">${left}</span><span class="room-col">${right}</span></div>`;
      }
      roomListHtml = `<div class="room-list-panel"><span class="label">STATION MAP:</span>${rows}</div>`;
    }

    const controlsHtml = `<span class="label">Keys:</span> ` +
      `<span class="key">WASD</span> move ` +
      `<span class="key">i</span> interact ` +
      `<span class="key">t</span> sensor ` +
      `<span class="key">c</span> clean ` +
      `<span class="key">l</span> look ` +
      `<span class="key">F3</span> toggle 2D/3D ` +
      `<span class="key">Space</span> wait`;

    const infoHtml = `<div class="info-bar">${controlsHtml}</div>`;

    // Log panel
    const logEntries = this.logHistory.length > 0
      ? this.logHistory
          .map((entry) => {
            const cls = LOG_TYPE_CLASSES[entry.type] || "log";
            return `<span class="${cls}"><span class="log-prefix">&gt; </span>${this.escapeHtml(entry.text)}</span>`;
          })
          .join("")
      : '<span class="log log-system">-- awaiting telemetry --</span>';

    const logHtml = `<div class="log-panel">${logEntries}</div>`;

    const bottomHtml = `<div class="ui-bottom">${objectiveHtml}${statusHtml}${proximityHtml}${roomListHtml}${infoHtml}</div>`;
    panel.innerHTML = logHtml + bottomHtml;

    const logPanel = panel.querySelector(".log-panel");
    if (logPanel) {
      logPanel.scrollTop = logPanel.scrollHeight;
    }

    // ── Dynamic legend — entities visible in current room ────────
    this.renderLegend(state);
  }

  /** Populate the map-legend element with visible entity glyphs */
  private renderLegend(state: GameState): void {
    const mapLegendEl = document.getElementById("map-legend");
    if (!mapLegendEl) return;

    const currentRoom = this.getPlayerRoom(state);
    const visibleEntityTypes = new Set<string>();

    // Entities in current room
    if (currentRoom) {
      for (const [, entity] of state.entities) {
        if (entity.pos.x >= currentRoom.x && entity.pos.x < currentRoom.x + currentRoom.width &&
            entity.pos.y >= currentRoom.y && entity.pos.y < currentRoom.y + currentRoom.height) {
          visibleEntityTypes.add(entity.type);
        }
      }
    }

    // Entities within 3 tiles of the player
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;
    for (const [, entity] of state.entities) {
      const dist = Math.abs(entity.pos.x - px) + Math.abs(entity.pos.y - py);
      if (dist <= 3) visibleEntityTypes.add(entity.type);
    }

    // Legend items: use colored squares + entity names instead of glyphs (we're in 3D)
    const allLegendItems: { key: string; color: string; label: string }[] = [
      { key: EntityType.SensorPickup, color: "#0ff", label: "Sensor" },
      { key: EntityType.Relay, color: "#ff0", label: "Relay" },
      { key: EntityType.DataCore, color: "#f0f", label: "Data Core" },
      { key: EntityType.LogTerminal, color: "#6cf", label: "Terminal" },
      { key: EntityType.ServiceBot, color: "#fa0", label: "Service Bot" },
      { key: EntityType.CrewItem, color: "#ca8", label: "Crew Item" },
      { key: EntityType.Drone, color: "#8a8", label: "Drone" },
      { key: EntityType.MedKit, color: "#f88", label: "Med Kit" },
      { key: EntityType.RepairBot, color: "#fa8", label: "Repair Bot" },
      { key: EntityType.RepairCradle, color: "#4df", label: "Repair Cradle" },
      { key: EntityType.Breach, color: "#f44", label: "Breach" },
      { key: EntityType.SecurityTerminal, color: "#4af", label: "Security" },
      { key: EntityType.PatrolDrone, color: "#f22", label: "Patrol" },
      { key: EntityType.PressureValve, color: "#4ba", label: "Valve" },
      { key: EntityType.FuseBox, color: "#d80", label: "Fuse Box" },
      { key: EntityType.PowerCell, color: "#fd4", label: "Power Cell" },
      { key: EntityType.EscapePod, color: "#4fa", label: "Escape Pod" },
      { key: EntityType.CrewNPC, color: "#fe6", label: "Crew" },
      { key: EntityType.EvidenceTrace, color: "#ca8", label: "Evidence" },
      { key: EntityType.Console, color: "#6ac", label: "Console" },
      { key: EntityType.ToolPickup, color: "#fa4", label: "Tool" },
      { key: EntityType.UtilityPickup, color: "#4da", label: "Utility" },
      { key: EntityType.Airlock, color: "#88c", label: "Airlock" },
    ];

    const activeLegend = allLegendItems.filter(l => visibleEntityTypes.has(l.key));

    if (activeLegend.length > 0) {
      mapLegendEl.innerHTML = activeLegend.map(l => {
        // Check if all entities of this type in the room are exhausted
        let allExhausted = false;
        if (currentRoom) {
          const entitiesOfType: boolean[] = [];
          for (const [, e] of state.entities) {
            if (e.type !== l.key) continue;
            if (e.pos.x < currentRoom.x || e.pos.x >= currentRoom.x + currentRoom.width) continue;
            if (e.pos.y < currentRoom.y || e.pos.y >= currentRoom.y + currentRoom.height) continue;
            entitiesOfType.push(isEntityExhausted(e));
          }
          allExhausted = entitiesOfType.length > 0 && entitiesOfType.every(x => x);
        }
        const color = allExhausted ? "#555" : l.color;
        const labelStyle = allExhausted ? ' style="color:#555"' : "";
        return `<span class="legend-item"><span class="legend-glyph" style="color:${color}">\u25a0</span><span class="legend-label"${labelStyle}>${l.label}</span></span>`;
      }).join("");
    } else {
      mapLegendEl.innerHTML = `<span class="legend-label">No notable objects nearby.</span>`;
    }
  }

  // ── Private: animation loop ─────────────────────────────────────

  private animate = (): void => {
    this.animFrameId = requestAnimationFrame(this.animate);
    const elapsed = this.clock.getElapsedTime();
    const delta = Math.min(elapsed - (this._lastAnimTime ?? elapsed), 0.1); // cap at 100ms
    this._lastAnimTime = elapsed;

    // Smooth movement interpolation for player
    if (this.playerMesh) {
      const lerpFactor = Math.min(1, BrowserDisplay3D.LERP_SPEED * delta);
      this.playerCurrentX += (this.playerTargetX - this.playerCurrentX) * lerpFactor;
      this.playerCurrentZ += (this.playerTargetZ - this.playerCurrentZ) * lerpFactor;

      // Snap if very close to avoid endless micro-movement
      if (Math.abs(this.playerTargetX - this.playerCurrentX) < 0.01) this.playerCurrentX = this.playerTargetX;
      if (Math.abs(this.playerTargetZ - this.playerCurrentZ) < 0.01) this.playerCurrentZ = this.playerTargetZ;

      this.playerMesh.position.x = this.playerCurrentX;
      this.playerMesh.position.z = this.playerCurrentZ;
      this.playerMesh.position.y = 0.4 + Math.sin(elapsed * 2) * 0.05;

      // Smooth rotation towards facing direction
      let targetRot = this.playerFacing;
      let currentRot = this.playerMesh.rotation.y;
      // Shortest path rotation
      let diff = targetRot - currentRot;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.playerMesh.rotation.y += diff * Math.min(1, 10 * delta);

      // Smoothly move camera and light to follow
      this.cameraPosX += (this.cameraTargetX - this.cameraPosX) * lerpFactor;
      this.cameraPosZ += (this.cameraTargetZ - this.cameraPosZ) * lerpFactor;
      if (Math.abs(this.cameraTargetX - this.cameraPosX) < 0.01) this.cameraPosX = this.cameraTargetX;
      if (Math.abs(this.cameraTargetZ - this.cameraPosZ) < 0.01) this.cameraPosZ = this.cameraTargetZ;

      // Camera shake
      let shakeX = 0, shakeZ = 0;
      if (this.cameraShakeIntensity > 0.001) {
        shakeX = (Math.random() - 0.5) * 2 * this.cameraShakeIntensity;
        shakeZ = (Math.random() - 0.5) * 2 * this.cameraShakeIntensity;
        this.cameraShakeIntensity *= Math.max(0, 1 - this.cameraShakeDecay * delta);
      }

      // Camera zoom pulse on room transition (subtle pull-back and zoom-in)
      let zoomOffset = 0;
      if (this.cameraZoomPulse > 0) {
        // Smooth ease-out bump: brief zoom-out then return
        zoomOffset = Math.sin(this.cameraZoomPulse * Math.PI) * 1.5;
        this.cameraZoomPulse = Math.max(0, this.cameraZoomPulse - delta * 2.0);
        // Update orthographic camera frustum
        const aspect = this.container.clientWidth / this.container.clientHeight;
        const baseSize = CAMERA_FRUSTUM_SIZE + zoomOffset;
        this.camera.left = -baseSize * aspect;
        this.camera.right = baseSize * aspect;
        this.camera.top = baseSize;
        this.camera.bottom = -baseSize;
        this.camera.updateProjectionMatrix();
      }

      this.camera.position.set(this.cameraPosX + shakeX, 8 + zoomOffset * 0.5, this.cameraPosZ + 12 + shakeZ);
      this.camera.lookAt(this.cameraPosX, 0, this.cameraPosZ);
      this.playerLight.position.set(this.playerCurrentX, 3, this.playerCurrentZ);

      // Update movement trail
      this.updateTrail(this.playerCurrentX, this.playerCurrentZ, delta);
    }

    // Entity animations
    for (const [id, mesh] of this.entityMeshes) {
      const userData = mesh.userData as { entityType?: string };
      if (userData.entityType === EntityType.Relay) {
        mesh.rotation.y = elapsed * 0.5;
      } else if (userData.entityType === EntityType.DataCore) {
        mesh.rotation.y = elapsed * 0.8;
        mesh.position.y = 0.5 + Math.sin(elapsed * 1.5) * 0.1;
      } else if (userData.entityType === EntityType.Breach) {
        const scale = 1 + Math.sin(elapsed * 3) * 0.15;
        mesh.scale.set(scale, scale, scale);
      } else if (userData.entityType === EntityType.Drone) {
        mesh.position.y = 0.6 + Math.sin(elapsed * 2 + mesh.position.x) * 0.08;
      } else if (userData.entityType === EntityType.EscapePod) {
        // Slow pulsing glow
        const podScale = 1 + Math.sin(elapsed * 1.2) * 0.04;
        mesh.scale.set(podScale, podScale, podScale);
      } else if (userData.entityType === EntityType.CrewNPC) {
        // Subtle idle sway
        mesh.rotation.y = Math.sin(elapsed * 0.8 + mesh.position.x * 2) * 0.15;
      } else if (userData.entityType === EntityType.Console) {
        // Screen flicker: subtle Y-scale jitter on the group
        mesh.children.forEach(child => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
            child.material.opacity = 0.2 + Math.sin(elapsed * 8 + mesh.position.x) * 0.15;
          }
        });
      } else if (userData.entityType === EntityType.UtilityPickup) {
        // Gentle float
        const ud = mesh.userData as { baseY?: number };
        mesh.position.y = (ud.baseY ?? 0.1) + Math.sin(elapsed * 2.5 + mesh.position.z) * 0.06;
      } else if (userData.entityType === EntityType.SensorPickup) {
        // Hover and slow spin
        const ud = mesh.userData as { baseY?: number };
        mesh.position.y = (ud.baseY ?? 0.3) + Math.sin(elapsed * 1.8 + mesh.position.x * 3) * 0.05;
        mesh.rotation.y = elapsed * 0.3;
      } else if (userData.entityType === EntityType.ToolPickup) {
        // Gentle bob
        const ud = mesh.userData as { baseY?: number };
        mesh.position.y = (ud.baseY ?? 0.1) + Math.sin(elapsed * 2.0 + mesh.position.z * 2) * 0.04;
      } else if (userData.entityType === EntityType.MedKit) {
        // Pulse scale
        const s = 1 + Math.sin(elapsed * 2.5) * 0.03;
        mesh.scale.set(s, s, s);
      } else if (userData.entityType === EntityType.LogTerminal || userData.entityType === EntityType.SecurityTerminal) {
        // Subtle screen glow flicker via emissive
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissiveIntensity = 0.15 + Math.sin(elapsed * 4 + mesh.position.x * 2) * 0.1;
          }
        });
      } else if (userData.entityType === EntityType.PowerCell || userData.entityType === EntityType.FuseBox) {
        // Subtle electrical flicker
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissiveIntensity = 0.1 + Math.sin(elapsed * 6 + mesh.position.z) * 0.08;
          }
        });
      } else if (userData.entityType === EntityType.EvidenceTrace) {
        // Float and spin — attention-grabbing mystery marker
        const ud = mesh.userData as { baseY?: number };
        mesh.position.y = (ud.baseY ?? 0.15) + Math.sin(elapsed * 2.0) * 0.1;
        mesh.rotation.y = elapsed * 1.2;
      } else if (userData.entityType === EntityType.CrewItem) {
        // Gentle glow pulse
        const ud = mesh.userData as { baseY?: number };
        mesh.position.y = (ud.baseY ?? 0.1) + Math.sin(elapsed * 1.5 + mesh.position.x) * 0.03;
      } else if (userData.entityType === EntityType.RepairBot || userData.entityType === EntityType.ServiceBot) {
        // Hover and wobble
        mesh.position.y = 0.4 + Math.sin(elapsed * 1.8 + mesh.position.z) * 0.06;
        mesh.rotation.y = Math.sin(elapsed * 0.5) * 0.2;
      } else if (userData.entityType === EntityType.PatrolDrone) {
        // Patrol sweep motion
        mesh.position.y = 0.7 + Math.sin(elapsed * 2.5) * 0.1;
        mesh.rotation.y = elapsed * 1.5;
      }
    }

    // Player light subtle breathing pulse
    if (this.playerLight) {
      this.playerLight.intensity = 2.5 + Math.sin(elapsed * 1.5) * 0.3;
    }

    // Interaction indicator: bob, spin, and ring pulse
    if (this.interactionIndicator && this.interactionIndicator.visible) {
      this.interactionIndicator.position.y = 1.8 + Math.sin(elapsed * 3) * 0.12;
      this.interactionIndicator.rotation.y = elapsed * 2;
      // Pulse ring opacity
      const ring = this.interactionIndicator.children[0];
      if (ring instanceof THREE.Mesh) {
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.25 + Math.sin(elapsed * 4) * 0.2;
        const s = 1 + Math.sin(elapsed * 3) * 0.15;
        ring.scale.set(s, 1, s);
      }
    }

    // Room lights: emergency flicker for red/amber lights
    for (const [, light] of this.roomLights) {
      const c = light.color.getHex();
      if (c === 0xff2200) {
        // Red emergency strobe — fast harsh pulse
        light.intensity = 0.3 + Math.abs(Math.sin(elapsed * 4)) * 1.2;
      } else if (c === 0xff8800) {
        // Amber warning — slower gentle pulse
        light.intensity = 0.5 + Math.sin(elapsed * 2) * 0.4;
      }
    }

    // Hazard sprite animations
    for (const child of this.hazardSprites.children) {
      if (!(child instanceof THREE.Sprite)) continue;
      const ud = child.userData as { hazardType?: string; baseY?: number };
      if (ud.hazardType === "smoke") {
        // Drift upward and fade
        child.position.y += delta * 0.15;
        const mat = child.material as THREE.SpriteMaterial;
        mat.opacity = Math.max(0, mat.opacity - delta * 0.08);
        if (child.position.y > (ud.baseY ?? 0.5) + 1.5 || mat.opacity <= 0) {
          // Reset to base position
          child.position.y = ud.baseY ?? 0.3;
          mat.opacity = 0.4;
        }
      } else if (ud.hazardType === "heat") {
        // Pulsing glow
        const mat = child.material as THREE.SpriteMaterial;
        mat.opacity = 0.2 + Math.sin(elapsed * 3 + child.position.x * 2) * 0.2;
        const s = 0.25 + Math.sin(elapsed * 2 + child.position.z) * 0.08;
        child.scale.set(s, s, 1);
      } else if (ud.hazardType === "vacuum") {
        // Gentle sparkle/flutter
        const mat = child.material as THREE.SpriteMaterial;
        mat.opacity = 0.15 + Math.sin(elapsed * 5 + child.position.x * 3 + child.position.z * 7) * 0.15;
      }
    }

    // Door light animations: locked doors pulse red
    for (const [, light] of this.doorLights) {
      if (light.color.getHex() === 0xff3333) {
        light.intensity = 0.3 + Math.sin(elapsed * 2) * 0.3;
      }
    }

    // Particle animations
    this.animateParticles(elapsed, delta);

    // Use outline effect for cel-shaded rendering with dark outlines
    this.outlineEffect.render(this.scene, this.camera);
  };

  // ── Private: tile updates ───────────────────────────────────────

  private updateTiles(state: GameState): void {
    let floorIdx = 0;
    let wallIdx = 0;
    let doorIdx = 0;

    const tempColor = new THREE.Color();

    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const tile = state.tiles[y][x];

        // Skip unexplored tiles (fog covers them)
        if (!tile.explored) continue;

        // Determine base color with sensor overlays
        let baseColor: number = COLORS_3D.floor;
        let brightness = tile.visible ? 1.0 : 0.4;

        if (tile.type === TileType.Wall) {
          // Check which neighbors are non-wall (open space)
          const openN = y > 0 && state.tiles[y - 1][x].type !== TileType.Wall;
          const openS = y < state.height - 1 && state.tiles[y + 1][x].type !== TileType.Wall;
          const openE = x < state.width - 1 && state.tiles[y][x + 1].type !== TileType.Wall;
          const openW = x > 0 && state.tiles[y][x - 1].type !== TileType.Wall;

          // Skip internal walls (no open neighbors)
          if (!openN && !openS && !openE && !openW) continue;

          baseColor = this.getWallColor3D(state, x, y);
          tempColor.setHex(baseColor);
          if (!tile.visible) tempColor.multiplyScalar(0.4);

          this.dummy.position.set(x, 0, y);
          this.dummy.scale.set(1, 1, 1);

          // Rotate wall so its detailed face points toward open space:
          // Side walls (east/west open) rotate 90°
          // South-side walls (open to north) stay at 0°
          // North-side walls (open to south) flip 180°
          if ((openE || openW) && !openN && !openS) {
            this.dummy.rotation.set(0, Math.PI / 2, 0);
          } else if (openS && !openN) {
            this.dummy.rotation.set(0, Math.PI, 0);
          } else {
            this.dummy.rotation.set(0, 0, 0);
          }

          this.dummy.updateMatrix();
          this.wallMesh.setMatrixAt(wallIdx, this.dummy.matrix);
          this.wallMesh.setColorAt(wallIdx, tempColor);
          wallIdx++;
          continue;
        }

        if (tile.type === TileType.Door || tile.type === TileType.LockedDoor) {
          const doorColor = tile.type === TileType.LockedDoor ? COLORS_3D.lockedDoor : COLORS_3D.door;
          this.dummy.position.set(x, 0, y);
          this.dummy.scale.set(1, 1, 1);

          // Orient door to face corridor direction (check horizontal vs vertical)
          const openE = x < state.width - 1 && state.tiles[y][x + 1].walkable;
          const openW = x > 0 && state.tiles[y][x - 1].walkable;
          if (openE || openW) {
            this.dummy.rotation.set(0, Math.PI / 2, 0);
          } else {
            this.dummy.rotation.set(0, 0, 0);
          }

          this.dummy.updateMatrix();
          if (doorIdx < 200) {
            this.doorMesh.setMatrixAt(doorIdx, this.dummy.matrix);
            tempColor.setHex(doorColor);
            if (!tile.visible) tempColor.multiplyScalar(0.4);
            this.doorMesh.setColorAt(doorIdx, tempColor);
            doorIdx++;
          }
        }

        // Floor/corridor
        if (tile.walkable) {
          if (tile.type === TileType.Corridor) {
            // Corridor tiles: darker than rooms with subtle blue-green tint
            baseColor = COLORS_3D.corridor;
            // Check if corridor borders a room — blend tint from nearest room
            for (const room of state.rooms) {
              const dist = Math.max(
                Math.max(room.x - x, x - (room.x + room.width - 1), 0),
                Math.max(room.y - y, y - (room.y + room.height - 1), 0)
              );
              if (dist <= 2) {
                const tint = ROOM_WALL_TINTS_3D[room.name];
                if (tint) {
                  // Light blend from nearby room (15%)
                  const cr = ((COLORS_3D.corridor >> 16) & 0xff) * 0.85 + ((tint >> 16) & 0xff) * 0.15;
                  const cg = ((COLORS_3D.corridor >> 8) & 0xff) * 0.85 + ((tint >> 8) & 0xff) * 0.15;
                  const cb = (COLORS_3D.corridor & 0xff) * 0.85 + (tint & 0xff) * 0.15;
                  baseColor = (Math.round(cr) << 16) | (Math.round(cg) << 8) | Math.round(cb);
                }
                break;
              }
            }
          } else {
            // Room floors: subtle tint from room wall color
            baseColor = COLORS_3D.floor;
            for (const room of state.rooms) {
              if (x >= room.x && x < room.x + room.width &&
                  y >= room.y && y < room.y + room.height) {
                const tint = ROOM_WALL_TINTS_3D[room.name];
                if (tint) {
                  // Blend floor color with room tint (35% tint for distinct zone identity)
                  const r = ((COLORS_3D.floor >> 16) & 0xff) * 0.65 + ((tint >> 16) & 0xff) * 0.35;
                  const g = ((COLORS_3D.floor >> 8) & 0xff) * 0.65 + ((tint >> 8) & 0xff) * 0.35;
                  const b = (COLORS_3D.floor & 0xff) * 0.65 + (tint & 0xff) * 0.35;
                  baseColor = (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
                }
                break;
              }
            }
          }

          // Structural damage: per-tile breach cracking pattern (always visible)
          if (tile.pressure < 30) {
            // Depressurized tiles: dark crack pattern using position hash
            const crackHash = ((x * 13 + y * 37) & 0x7);
            const darkFactor = crackHash < 3 ? 0.5 : 0.7; // uneven darkening
            const r = ((baseColor >> 16) & 0xff);
            const g = ((baseColor >> 8) & 0xff);
            const b = (baseColor & 0xff);
            baseColor = (Math.round(r * darkFactor) << 16) |
                        (Math.round(g * darkFactor) << 8) |
                        Math.round(b * darkFactor);
          }

          // Ambient hazard floor tinting (always visible, subtle)
          if (tile.visible && this.sensorMode === SensorType.Cleanliness) {
            // Without a sensor overlay, show subtle hazard hints
            if (tile.heat >= HEAT_PAIN_THRESHOLD) {
              // Dangerous heat: warm red-orange tint
              const hf = Math.min(1, tile.heat / 100);
              const r = ((baseColor >> 16) & 0xff);
              const g = ((baseColor >> 8) & 0xff);
              const b = (baseColor & 0xff);
              baseColor = (Math.min(255, Math.round(r + hf * 80)) << 16) |
                          (Math.max(0, Math.round(g - hf * 20)) << 8) |
                          Math.max(0, Math.round(b - hf * 40));
            } else if (tile.pressure < 40) {
              // Vacuum: subtle blue tint
              const pf = Math.max(0, 1 - tile.pressure / 40);
              const r = ((baseColor >> 16) & 0xff);
              const g = ((baseColor >> 8) & 0xff);
              const b = (baseColor & 0xff);
              baseColor = (Math.max(0, Math.round(r - pf * 30)) << 16) |
                          (Math.max(0, Math.round(g - pf * 10)) << 8) |
                          Math.min(255, Math.round(b + pf * 50));
            }
          }

          // Sensor overlays on floor tiles
          if (tile.visible) {
            baseColor = this.applyFloorSensorColor(tile, baseColor);
          }

          this.dummy.position.set(x, 0, y);
          this.dummy.scale.set(1, 1, 1);
          this.dummy.updateMatrix();
          this.floorMesh.setMatrixAt(floorIdx, this.dummy.matrix);

          tempColor.setHex(baseColor);
          if (!tile.visible) tempColor.multiplyScalar(brightness);
          this.floorMesh.setColorAt(floorIdx, tempColor);
          floorIdx++;
        }
      }
    }

    // Set instance count to only render used instances
    this.floorMesh.count = floorIdx;
    this.wallMesh.count = wallIdx;
    this.wallCornerMesh.count = 0;
    this.doorMesh.count = doorIdx;

    this.floorMesh.instanceMatrix.needsUpdate = true;
    this.wallMesh.instanceMatrix.needsUpdate = true;
    this.wallCornerMesh.instanceMatrix.needsUpdate = true;
    this.doorMesh.instanceMatrix.needsUpdate = true;
    if (this.floorMesh.instanceColor) this.floorMesh.instanceColor.needsUpdate = true;
    if (this.wallMesh.instanceColor) this.wallMesh.instanceColor.needsUpdate = true;
    if (this.wallCornerMesh.instanceColor) this.wallCornerMesh.instanceColor.needsUpdate = true;
    if (this.doorMesh.instanceColor) this.doorMesh.instanceColor.needsUpdate = true;
  }

  private applyFloorSensorColor(tile: { heat: number; smoke: number; dirt: number; pressure: number; walkable: boolean }, baseColor: number): number {
    // Thermal overlay
    if (this.sensorMode === SensorType.Thermal && tile.walkable) {
      if (tile.heat > 0) {
        const t = Math.max(0, Math.min(1, tile.heat / 100));
        const r = Math.round(0x44 + t * (0xff - 0x44));
        const g = Math.round(0x44 + t * (0x22 - 0x44));
        const b = Math.round(0xff + t * (0x00 - 0xff));
        return (r << 16) | (g << 8) | b;
      }
      return 0x001020; // cool tint
    }

    // Atmospheric overlay
    if (this.sensorMode === SensorType.Atmospheric && tile.walkable) {
      if (tile.pressure < 30) return 0x882222;
      if (tile.pressure < 60) return 0x886622;
      if (tile.pressure < 90) return 0x224444;
      return 0x113322;
    }

    // Cleanliness overlay
    if (this.sensorMode === SensorType.Cleanliness && tile.walkable && tile.dirt > 0) {
      if (tile.dirt > 60) return 0x886644;
      if (tile.dirt > 30) return 0x665533;
      if (tile.dirt > 10) return 0x443322;
    }

    // Ambient heat visibility (no sensor)
    if (this.sensorMode !== SensorType.Thermal && tile.walkable && tile.heat > 0) {
      if (tile.heat >= HEAT_PAIN_THRESHOLD) {
        const t = Math.max(0, Math.min(1, tile.heat / 100));
        const r = Math.round(0x30 + t * 0x50);
        return (r << 16) | 0x0800;
      }
      if (tile.heat > 15) {
        return 0x221108;
      }
    }

    // Ambient smoke visibility (darker tiles in smoky areas)
    if (tile.walkable && tile.smoke > 20) {
      const smokeFactor = Math.min(1, tile.smoke / 80);
      const r = ((baseColor >> 16) & 0xff);
      const g = ((baseColor >> 8) & 0xff);
      const b = (baseColor & 0xff);
      const dr = Math.round(r * (1 - smokeFactor * 0.5));
      const dg = Math.round(g * (1 - smokeFactor * 0.6));
      const db = Math.round(b * (1 - smokeFactor * 0.4));
      return (dr << 16) | (dg << 8) | db;
    }

    // Ambient low-pressure visibility (subtle blue tint)
    if (this.sensorMode !== SensorType.Atmospheric && tile.walkable && tile.pressure < 60) {
      const pressFactor = Math.max(0, 1 - tile.pressure / 60);
      const blue = Math.round(0x30 + pressFactor * 0x30);
      return (0x10 << 16) | (0x15 << 8) | blue;
    }

    return baseColor;
  }

  // ── Private: fog-of-war updates ─────────────────────────────────

  private updateFog(state: GameState): void {
    let fogFullIdx = 0;
    let fogMemIdx = 0;

    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const tile = state.tiles[y][x];

        if (!tile.explored) {
          // Full fog — opaque black at y=2
          this.dummy.position.set(x, 2.0, y);
          this.dummy.scale.set(1, 1, 1);
          this.dummy.updateMatrix();
          this.fogFullMesh.setMatrixAt(fogFullIdx, this.dummy.matrix);
          fogFullIdx++;
        } else if (!tile.visible) {
          // Memory fog — semi-transparent at y=1.6
          this.dummy.position.set(x, 1.6, y);
          this.dummy.scale.set(1, 1, 1);
          this.dummy.updateMatrix();
          this.fogMemoryMesh.setMatrixAt(fogMemIdx, this.dummy.matrix);
          fogMemIdx++;
        }
      }
    }

    // Set instance count to only render used instances
    this.fogFullMesh.count = fogFullIdx;
    this.fogMemoryMesh.count = fogMemIdx;

    this.fogFullMesh.instanceMatrix.needsUpdate = true;
    this.fogMemoryMesh.instanceMatrix.needsUpdate = true;
  }

  // ── Private: room decorations ──────────────────────────────────

  // Decoration model paths per room type (placed at empty floor tiles)
  private static readonly ROOM_DECORATIONS: Record<string, string[]> = {
    "Med Bay": [
      "models/synty-space-gltf/SM_Prop_Bed_Medical_01.glb",
      "models/synty-space-gltf/SM_Prop_Oxygen_Tank.glb",
      "models/synty-space-gltf/SM_Prop_Decontamination_Shower_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_Small_01.glb",
      "models/synty-space-gltf/SM_Prop_Crate_health_02.glb",
    ],
    "Engineering Storage": [
      "models/synty-space-gltf/SM_Prop_Barrel_01.glb",
      "models/synty-space-gltf/SM_Prop_Detail_Box_02.glb",
      "models/synty-space-gltf/SM_Prop_Cart_01.glb",
      "models/synty-space-gltf/SM_Prop_Barrel_01.glb",
      "models/synty-space-gltf/SM_Prop_Detail_Box_01.glb",
    ],
    "Life Support": [
      "models/synty-space-gltf/SM_Prop_AirVent_Large_01.glb",
      "models/synty-space-gltf/SM_Prop_Oxygen_Tank.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_01.glb",
      "models/synty-space-gltf/SM_Prop_AirVent_Small_01.glb",
      "models/synty-space-gltf/SM_Prop_Oxygen_Tank_Small.glb",
    ],
    "Data Core": [
      "models/synty-space-gltf/SM_Prop_CenterTube_02.glb",
      "models/synty-space-gltf/SM_Prop_Screen_02.glb",
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_01.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_02.glb",
    ],
    "Robotics Bay": [
      "models/synty-space-gltf/SM_Prop_Desk_Small_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_Small_01.glb",
      "models/synty-space-gltf/SM_Prop_Cart_01.glb",
      "models/synty-space-gltf/SM_Prop_ControlPanel_02.glb",
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
    ],
    "Research Lab": [
      "models/synty-space-gltf/SM_Prop_Screen_02.glb",
      "models/synty-space-gltf/SM_Prop_Desk_Small_01.glb",
      "models/synty-space-gltf/SM_Prop_CryoBed_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_Small_01.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_01.glb",
    ],
    "Communications Hub": [
      "models/synty-space-gltf/SM_Prop_Satellite_Stand_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_01.glb",
      "models/synty-space-gltf/SM_Prop_Radar_Panel_01.glb",
      "models/synty-space-gltf/SM_Prop_Antenna_01.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_02.glb",
    ],
    "Power Relay Junction": [
      "models/synty-space-gltf/SM_Prop_Battery_03.glb",
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
      "models/synty-space-gltf/SM_Prop_ControlPanel_03.glb",
      "models/synty-space-gltf/SM_Prop_Battery_01.glb",
      "models/synty-space-gltf/SM_Prop_Panel_01.glb",
    ],
    "Bridge": [
      "models/synty-space-gltf/SM_Bld_Bridge_Chair_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_01.glb",
      "models/synty-space-gltf/SM_Prop_ControlPanel_01.glb",
      "models/synty-space-gltf/SM_Bld_Bridge_Chair_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_02.glb",
    ],
    "Engine Core": [
      "models/synty-space-gltf/SM_Prop_CenterTube_01.glb",
      "models/synty-space-gltf/SM_Prop_Battery_02.glb",
      "models/synty-space-gltf/SM_Prop_Panel_01.glb",
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
      "models/synty-space-gltf/SM_Prop_ControlPanel_03.glb",
    ],
    "Cargo Hold": [
      "models/synty-space-gltf/SM_Prop_Barrel_01.glb",
      "models/synty-space-gltf/SM_Prop_Detail_Box_01.glb",
      "models/synty-space-gltf/SM_Prop_Crate_health_01.glb",
      "models/synty-space-gltf/SM_Prop_Detail_Box_02.glb",
      "models/synty-space-gltf/SM_Prop_Barrel_01.glb",
    ],
    "Crew Quarters": [
      "models/synty-space-gltf/SM_Bld_Crew_Beds_01.glb",
      "models/synty-space-gltf/SM_Prop_Desk_Small_01.glb",
      "models/synty-space-gltf/SM_Prop_Oxygen_Tank_Small.glb",
      "models/synty-space-gltf/SM_Bld_Crew_Beds_01.glb",
      "models/synty-space-gltf/SM_Prop_Detail_Box_01.glb",
    ],
    "Observation Deck": [
      "models/synty-space-gltf/SM_Prop_Screen_02.glb",
      "models/synty-space-gltf/SM_Bld_Bridge_Chair_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_01.glb",
      "models/synty-space-gltf/SM_Bld_Bridge_Chair_01.glb",
    ],
    "Escape Pod Bay": [
      "models/synty-space-gltf/SM_Prop_EscapePod_Hatch_Small_01.glb",
      "models/synty-space-gltf/SM_Sign_AirLock_01.glb",
      "models/synty-space-gltf/SM_Prop_Crate_health_01.glb",
      "models/synty-space-gltf/SM_Prop_Oxygen_Tank.glb",
    ],
    "Auxiliary Power": [
      "models/synty-space-gltf/SM_Prop_Battery_01.glb",
      "models/synty-space-gltf/SM_Prop_Battery_02.glb",
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
      "models/synty-space-gltf/SM_Prop_Battery_03.glb",
      "models/synty-space-gltf/SM_Prop_Panel_01.glb",
    ],
    "Signal Room": [
      "models/synty-space-gltf/SM_Prop_Antenna_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_Small_01.glb",
      "models/synty-space-gltf/SM_Prop_Radar_Panel_01.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_01.glb",
    ],
    "Server Annex": [
      "models/synty-space-gltf/SM_Prop_Screen_02.glb",
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_02.glb",
      "models/synty-space-gltf/SM_Prop_Screen_01.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_01.glb",
    ],
    "Armory": [
      "models/synty-space-gltf/SM_Prop_Detail_Box_02.glb",
      "models/synty-space-gltf/SM_Prop_Crate_health_02.glb",
      "models/synty-space-gltf/SM_Prop_Barrel_01.glb",
      "models/synty-space-gltf/SM_Prop_Detail_Box_01.glb",
    ],
    "Arrival Bay": [
      "models/synty-space-gltf/SM_Prop_Cart_01.glb",
      "models/synty-space-gltf/SM_Prop_Detail_Box_01.glb",
      "models/synty-space-gltf/SM_Prop_Barrel_01.glb",
      "models/synty-space-gltf/SM_Prop_Crate_health_01.glb",
    ],
    "Emergency Shelter": [
      "models/synty-space-gltf/SM_Prop_Crate_health_01.glb",
      "models/synty-space-gltf/SM_Prop_Oxygen_Tank.glb",
      "models/synty-space-gltf/SM_Prop_Bed_Medical_01.glb",
      "models/synty-space-gltf/SM_Prop_Crate_health_02.glb",
    ],
    "Maintenance Corridor": [
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
      "models/synty-space-gltf/SM_Prop_Panel_01.glb",
      "models/synty-space-gltf/SM_Prop_Cart_01.glb",
    ],
    "Vent Control Room": [
      "models/synty-space-gltf/SM_Prop_AirVent_Large_01.glb",
      "models/synty-space-gltf/SM_Prop_AirVent_Small_01.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_01.glb",
      "models/synty-space-gltf/SM_Prop_Panel_01.glb",
    ],
  };

  // Wall-mounted props per room type — placed against inner walls, facing room center
  private static readonly WALL_PROPS: Record<string, string[]> = {
    "Bridge": [
      "models/synty-space-gltf/SM_Prop_Screen_01.glb",
      "models/synty-space-gltf/SM_Prop_ControlPanel_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_02.glb",
    ],
    "Data Core": [
      "models/synty-space-gltf/SM_Prop_Screen_02.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_02.glb",
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
    ],
    "Communications Hub": [
      "models/synty-space-gltf/SM_Prop_Radar_Panel_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_01.glb",
    ],
    "Engineering Storage": [
      "models/synty-space-gltf/SM_Prop_Panel_01.glb",
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
    ],
    "Power Relay Junction": [
      "models/synty-space-gltf/SM_Prop_ControlPanel_03.glb",
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
      "models/synty-space-gltf/SM_Prop_Panel_01.glb",
    ],
    "Life Support": [
      "models/synty-space-gltf/SM_Prop_AirVent_Small_01.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_01.glb",
    ],
    "Med Bay": [
      "models/synty-space-gltf/SM_Prop_Screen_Small_01.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_01.glb",
    ],
    "Research Lab": [
      "models/synty-space-gltf/SM_Prop_Screen_02.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_02.glb",
    ],
    "Robotics Bay": [
      "models/synty-space-gltf/SM_Prop_ControlPanel_02.glb",
      "models/synty-space-gltf/SM_Prop_Screen_Small_01.glb",
    ],
    "Server Annex": [
      "models/synty-space-gltf/SM_Prop_Screen_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_02.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_01.glb",
    ],
    "Signal Room": [
      "models/synty-space-gltf/SM_Prop_Antenna_01.glb",
      "models/synty-space-gltf/SM_Prop_Radar_Panel_01.glb",
    ],
    "Observation Deck": [
      "models/synty-space-gltf/SM_Prop_Screen_01.glb",
    ],
    "Armory": [
      "models/synty-space-gltf/SM_Prop_Panel_01.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_02.glb",
    ],
    "Escape Pod Bay": [
      "models/synty-space-gltf/SM_Sign_AirLock_01.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_01.glb",
    ],
    "Crew Quarters": [
      "models/synty-space-gltf/SM_Prop_Screen_Small_01.glb",
    ],
    "Vent Control Room": [
      "models/synty-space-gltf/SM_Prop_AirVent_Small_01.glb",
      "models/synty-space-gltf/SM_Prop_ControlPanel_02.glb",
    ],
    "Auxiliary Power": [
      "models/synty-space-gltf/SM_Prop_Panel_01.glb",
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
    ],
    "Engine Core": [
      "models/synty-space-gltf/SM_Prop_ControlPanel_03.glb",
      "models/synty-space-gltf/SM_Prop_Panel_01.glb",
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
    ],
  };

  private placeDebris(state: GameState, room: Room, hasBreach: boolean): void {
    // Find empty floor tiles in the room
    const entityPositions = new Set<string>();
    for (const [, e] of state.entities) {
      entityPositions.add(`${e.pos.x},${e.pos.y}`);
    }
    entityPositions.add(`${state.player.entity.pos.x},${state.player.entity.pos.y}`);

    const emptyFloors: { x: number; y: number }[] = [];
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) {
        if (y < 0 || y >= state.height || x < 0 || x >= state.width) continue;
        if (state.tiles[y][x].type !== TileType.Floor) continue;
        if (entityPositions.has(`${x},${y}`)) continue;
        emptyFloors.push({ x, y });
      }
    }

    // Deterministic shuffle
    const seed = room.x * 41 + room.y * 29;
    emptyFloors.sort((a, b) => ((a.x * 17 + a.y * 11 + seed) & 0xff) - ((b.x * 17 + b.y * 11 + seed) & 0xff));

    // Simple seeded PRNG for deterministic debris placement
    let rng = seed * 16807 + 1;
    const nextRng = () => { rng = (rng * 16807 + 1) & 0x7fffffff; return (rng & 0xffff) / 0xffff; };

    // Place 2-4 debris pieces
    const debrisCount = Math.min(hasBreach ? 4 : 2, emptyFloors.length);
    for (let i = 0; i < debrisCount; i++) {
      const pos = emptyFloors[i];
      // Procedural debris: small dark boxes at deterministic angles
      const debrisGeo = new THREE.BoxGeometry(
        0.15 + nextRng() * 0.15,
        0.08 + nextRng() * 0.08,
        0.15 + nextRng() * 0.15
      );
      const debrisMat = makeToonMaterial({
        color: hasBreach ? 0x443333 : 0x444433,
        gradientMap: this.toonGradient,
        emissive: hasBreach ? 0x220000 : 0x000000,
        emissiveIntensity: hasBreach ? 0.2 : 0,
      });
      const debris = new THREE.Mesh(debrisGeo, debrisMat);
      debris.position.set(
        pos.x + (nextRng() - 0.5) * 0.5,
        0.04,
        pos.y + (nextRng() - 0.5) * 0.5
      );
      debris.rotation.y = nextRng() * Math.PI * 2;
      debris.rotation.z = (nextRng() - 0.5) * 0.3;
      this.decorationGroup.add(debris);
    }
  }

  private placeRoomDecorations(state: GameState): void {
    for (const room of state.rooms) {
      if (this.decoratedRooms.has(room.id)) continue;

      // Check if room center is explored
      const cx = room.x + Math.floor(room.width / 2);
      const cy = room.y + Math.floor(room.height / 2);
      if (cy < 0 || cy >= state.height || cx < 0 || cx >= state.width) continue;
      if (!state.tiles[cy][cx].explored) continue;

      this.decoratedRooms.add(room.id);

      const decorModels = BrowserDisplay3D.ROOM_DECORATIONS[room.name];
      if (!decorModels || decorModels.length === 0) continue;

      // Find empty floor tiles in this room (no entity)
      const entityPositions = new Set<string>();
      for (const [, e] of state.entities) {
        entityPositions.add(`${e.pos.x},${e.pos.y}`);
      }
      // Player position
      entityPositions.add(`${state.player.entity.pos.x},${state.player.entity.pos.y}`);

      const emptyFloors: { x: number; y: number }[] = [];
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) {
          if (y < 0 || y >= state.height || x < 0 || x >= state.width) continue;
          const tile = state.tiles[y][x];
          if (tile.type !== TileType.Floor) continue;
          if (entityPositions.has(`${x},${y}`)) continue;
          emptyFloors.push({ x, y });
        }
      }

      // Place up to 5 decorations at deterministic positions (seeded by room id)
      const maxDecor = Math.min(5, emptyFloors.length);
      // Simple deterministic shuffle based on room position
      const seed = room.x * 31 + room.y * 17;
      emptyFloors.sort((a, b) => ((a.x * 13 + a.y * 7 + seed) & 0xff) - ((b.x * 13 + b.y * 7 + seed) & 0xff));

      for (let i = 0; i < maxDecor; i++) {
        const pos = emptyFloors[i];
        const modelPath = decorModels[i % decorModels.length];
        const modelKey = `decor_${room.id}_${i}`;

        // Check if we have this model cached
        const cached = this.gltfCache.get(modelPath);
        if (cached) {
          const clone = cached.clone();
          clone.position.set(pos.x, 0, pos.y);
          // Decorations at reasonable room-furniture scale
          clone.scale.multiplyScalar(0.75);
          this.decorationGroup.add(clone);
        } else {
          // Load model and place when ready
          const url = import.meta.env.BASE_URL + modelPath;
          this.gltfLoader.load(url, (gltf) => {
            try {
              const model = gltf.scene.clone();
              // Normalize size
              const box = new THREE.Box3().setFromObject(model);
              const size = new THREE.Vector3();
              box.getSize(size);
              const maxDim = Math.max(size.x, size.y, size.z);
              if (maxDim > 0) model.scale.multiplyScalar(0.65 / maxDim);

              // Center and sit on floor
              const b2 = new THREE.Box3().setFromObject(model);
              const c = new THREE.Vector3();
              b2.getCenter(c);
              model.position.set(pos.x - c.x, -b2.min.y, pos.y - c.z);

              // Apply toon material with atlas
              model.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                  const mats = Array.isArray(child.material) ? child.material : [child.material];
                  const oldMat = mats[0] as THREE.MeshStandardMaterial;
                  const hasUVs = !!(child.geometry?.attributes?.uv);
                  let tex = hasUVs && oldMat?.map ? oldMat.map : null;
                  if (!tex && hasUVs && this.syntyAtlas) tex = this.syntyAtlas;
                  child.material = makeToonMaterial({
                    color: tex ? 0xffffff : (oldMat?.color?.getHex() ?? 0x888888),
                    gradientMap: this.toonGradient,
                    map: tex,
                  });
                }
              });

              this.decorationGroup.add(model);
              this.gltfCache.set(modelPath, model); // cache for future rooms
            } catch (e) {
              console.warn(`Failed to load decoration ${modelPath}:`, e);
            }
          }, undefined, () => {});
        }
      }

      // ── Wall-mounted props: place against inner walls ──
      const wallProps = BrowserDisplay3D.WALL_PROPS[room.name];
      if (wallProps && wallProps.length > 0) {
        // Find wall tiles that border room interior
        type WallSlot = { x: number; y: number; rot: number }; // rot: facing direction into room
        const wallSlots: WallSlot[] = [];
        for (let y = room.y; y < room.y + room.height; y++) {
          for (let x = room.x; x < room.x + room.width; x++) {
            if (y < 0 || y >= state.height || x < 0 || x >= state.width) continue;
            const tile = state.tiles[y][x];
            if (tile.type !== TileType.Wall) continue;
            // Check if this wall borders a room floor tile
            const hasFloorN = y > 0 && state.tiles[y - 1][x].type === TileType.Floor;
            const hasFloorS = y < state.height - 1 && state.tiles[y + 1][x].type === TileType.Floor;
            const hasFloorE = x < state.width - 1 && state.tiles[y][x + 1].type === TileType.Floor;
            const hasFloorW = x > 0 && state.tiles[y][x - 1].type === TileType.Floor;
            if (hasFloorN) wallSlots.push({ x, y, rot: 0 }); // face north (toward floor)
            else if (hasFloorS) wallSlots.push({ x, y, rot: Math.PI }); // face south
            else if (hasFloorE) wallSlots.push({ x, y, rot: -Math.PI / 2 }); // face east
            else if (hasFloorW) wallSlots.push({ x, y, rot: Math.PI / 2 }); // face west
          }
        }

        // Deterministic selection of wall slots
        const wallSeed = room.x * 37 + room.y * 23;
        wallSlots.sort((a, b) => ((a.x * 19 + a.y * 11 + wallSeed) & 0xff) - ((b.x * 19 + b.y * 11 + wallSeed) & 0xff));
        const maxWallProps = Math.min(wallProps.length, wallSlots.length, 3);

        for (let i = 0; i < maxWallProps; i++) {
          const slot = wallSlots[i];
          const propPath = wallProps[i % wallProps.length];

          const loadAndPlace = (propModel: THREE.Object3D) => {
            const clone = propModel.clone();
            // Scale wall props small — they're mounted decorations
            const box = new THREE.Box3().setFromObject(clone);
            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 0) clone.scale.multiplyScalar(0.5 / maxDim);

            // Position against wall, raised up to wall-mount height
            clone.position.set(slot.x, 0.7, slot.y);
            clone.rotation.y = slot.rot;
            this.decorationGroup.add(clone);
          };

          const cached = this.gltfCache.get(propPath);
          if (cached) {
            loadAndPlace(cached);
          } else {
            const url = import.meta.env.BASE_URL + propPath;
            this.gltfLoader.load(url, (gltf) => {
              try {
                const model = gltf.scene.clone();
                model.traverse((child) => {
                  if (child instanceof THREE.Mesh) {
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    const oldMat = mats[0] as THREE.MeshStandardMaterial;
                    const hasUVs = !!(child.geometry?.attributes?.uv);
                    let tex = hasUVs && oldMat?.map ? oldMat.map : null;
                    if (!tex && hasUVs && this.syntyAtlas) tex = this.syntyAtlas;
                    child.material = makeToonMaterial({
                      color: tex ? 0xffffff : (oldMat?.color?.getHex() ?? 0x888888),
                      gradientMap: this.toonGradient,
                      map: tex,
                    });
                  }
                });
                this.gltfCache.set(propPath, model);
                loadAndPlace(model);
              } catch (e) {
                console.warn(`Failed to load wall prop ${propPath}:`, e);
              }
            }, undefined, () => {});
          }
        }
      }
    }
  }

  // ── Private: caution stripe floor markings ─────────────────────

  private cautionStripeTex: THREE.CanvasTexture | null = null;

  private placeCautionMarkings(state: GameState): void {
    // Place yellow/black caution stripes on floor tiles adjacent to dangerous entities
    const dangerTypes = new Set([
      EntityType.Breach, EntityType.Airlock, EntityType.EscapePod,
    ]);

    for (const [, entity] of state.entities) {
      if (!dangerTypes.has(entity.type as EntityType)) continue;
      const ex = entity.pos.x;
      const ey = entity.pos.y;

      // Mark a ring of floor tiles around the entity
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const tx = ex + dx;
          const ty = ey + dy;
          if (ty < 0 || ty >= state.height || tx < 0 || tx >= state.width) continue;
          const tile = state.tiles[ty][tx];
          if (!tile.explored) continue;
          if (tile.type !== TileType.Floor && tile.type !== TileType.Corridor) continue;

          const key = `${tx},${ty}`;
          if (this.cautionMarkedTiles.has(key)) continue;
          this.cautionMarkedTiles.add(key);

          // Create caution stripe overlay plane
          if (!this.cautionStripeTex) {
            this.cautionStripeTex = createCautionStripeTexture();
          }
          const planeGeo = new THREE.PlaneGeometry(0.9, 0.9);
          planeGeo.rotateX(-Math.PI / 2);
          const planeMat = new THREE.MeshBasicMaterial({
            map: this.cautionStripeTex,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
          });
          const plane = new THREE.Mesh(planeGeo, planeMat);
          plane.position.set(tx, 0.01, ty); // just above floor surface
          this.cautionStripeGroup.add(plane);
        }
      }
    }

    // Also mark floor tiles in rooms with active breaches
    for (const room of state.rooms) {
      const cx = room.x + Math.floor(room.width / 2);
      const cy = room.y + Math.floor(room.height / 2);
      if (cy < 0 || cy >= state.height || cx < 0 || cx >= state.width) continue;
      if (!state.tiles[cy][cx].explored) continue;

      // Check for breach tiles
      let hasBreach = false;
      for (let ry = room.y; ry < room.y + room.height && !hasBreach; ry++) {
        for (let rx = room.x; rx < room.x + room.width && !hasBreach; rx++) {
          if (ry >= 0 && ry < state.height && rx >= 0 && rx < state.width) {
            if (state.tiles[ry][rx].pressure < 30) hasBreach = true;
          }
        }
      }

      if (!hasBreach) continue;

      // Mark doorway tiles for this room with caution stripes
      for (let y = room.y - 1; y <= room.y + room.height; y++) {
        for (let x = room.x - 1; x <= room.x + room.width; x++) {
          if (y < 0 || y >= state.height || x < 0 || x >= state.width) continue;
          const tile = state.tiles[y][x];
          if (tile.type !== TileType.Door && tile.type !== TileType.LockedDoor) continue;
          if (!tile.explored) continue;

          const key = `${x},${y}`;
          if (this.cautionMarkedTiles.has(key)) continue;
          this.cautionMarkedTiles.add(key);

          if (!this.cautionStripeTex) {
            this.cautionStripeTex = createCautionStripeTexture();
          }
          const planeGeo = new THREE.PlaneGeometry(0.9, 0.9);
          planeGeo.rotateX(-Math.PI / 2);
          const planeMat = new THREE.MeshBasicMaterial({
            map: this.cautionStripeTex,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
          });
          const plane = new THREE.Mesh(planeGeo, planeMat);
          plane.position.set(x, 0.01, y);
          this.cautionStripeGroup.add(plane);
        }
      }
    }
  }

  // ── Private: corridor overhead pipe runs ──────────────────────

  private placeCorridorPipes(state: GameState): void {
    // Add overhead pipe/conduit meshes along explored corridors
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const tile = state.tiles[y][x];
        if (!tile.explored) continue;
        if (tile.type !== TileType.Corridor) continue;

        const key = `${x},${y}`;
        if (this.corridorPipeTiles.has(key)) continue;

        // Only place pipes every 2nd tile for performance
        if ((x + y) % 2 !== 0) continue;
        this.corridorPipeTiles.add(key);

        // Determine corridor direction (horizontal or vertical)
        const hasEW = (x > 0 && state.tiles[y][x - 1].type === TileType.Corridor) ||
                      (x < state.width - 1 && state.tiles[y][x + 1].type === TileType.Corridor);
        const hasNS = (y > 0 && state.tiles[y - 1][x].type === TileType.Corridor) ||
                      (y < state.height - 1 && state.tiles[y + 1][x].type === TileType.Corridor);

        // Pipe color varies with position hash
        const pipeHash = ((x * 7 + y * 13) & 0xf);
        const pipeColor = pipeHash < 5 ? 0x556677 : pipeHash < 10 ? 0x667788 : 0x778899;

        // Main overhead pipe (thin cylinder running along corridor axis)
        const pipeGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6);
        const pipeMat = makeToonMaterial({
          color: pipeColor,
          gradientMap: this.toonGradient,
        });

        const pipe = new THREE.Mesh(pipeGeo, pipeMat);
        pipe.position.set(x, 1.8, y);

        if (hasEW && !hasNS) {
          // Horizontal pipe runs east-west
          pipe.rotation.z = Math.PI / 2;
          pipe.position.x = x + 0.3; // offset from center
        } else if (hasNS) {
          // Vertical pipe runs north-south
          pipe.rotation.x = Math.PI / 2;
          pipe.position.z = y + 0.3;
        } else {
          // Junction: place diagonally
          pipe.rotation.z = Math.PI / 4;
        }

        this.pipeGroup.add(pipe);

        // Secondary thinner pipe offset to the side
        if (pipeHash > 7) {
          const pipe2Geo = new THREE.CylinderGeometry(0.025, 0.025, 1.0, 4);
          const pipe2 = new THREE.Mesh(pipe2Geo, pipeMat);
          pipe2.position.set(x, 1.6, y);

          if (hasEW && !hasNS) {
            pipe2.rotation.z = Math.PI / 2;
            pipe2.position.x = x - 0.2;
          } else {
            pipe2.rotation.x = Math.PI / 2;
            pipe2.position.z = y - 0.2;
          }
          this.pipeGroup.add(pipe2);
        }
      }
    }
  }

  // ── Private: room ambient lights ────────────────────────────────

  private updateRoomLights(state: GameState): void {
    for (const room of state.rooms) {
      // Check if any tile in the room is explored
      const centerX = room.x + Math.floor(room.width / 2);
      const centerY = room.y + Math.floor(room.height / 2);
      if (centerY < 0 || centerY >= state.height || centerX < 0 || centerX >= state.width) continue;
      if (!state.tiles[centerY][centerX].explored) continue;

      if (!this.roomLights.has(room.id)) {
        // Check if room has hazards (heat, smoke, low pressure, breaches)
        let maxHeat = 0;
        let maxSmoke = 0;
        let hasBreach = false;
        for (let ry = room.y; ry < room.y + room.height; ry++) {
          for (let rx = room.x; rx < room.x + room.width; rx++) {
            if (ry >= 0 && ry < state.height && rx >= 0 && rx < state.width) {
              const t = state.tiles[ry][rx];
              if (t.heat > maxHeat) maxHeat = t.heat;
              if (t.smoke > maxSmoke) maxSmoke = t.smoke;
            }
          }
        }
        for (const [, ent] of state.entities) {
          if (ent.type === EntityType.Breach &&
              ent.pos.x >= room.x && ent.pos.x < room.x + room.width &&
              ent.pos.y >= room.y && ent.pos.y < room.y + room.height) {
            hasBreach = true;
          }
        }

        // Distressed rooms get red/amber warning lights
        let lightColor: number;
        let intensity = 0.8;
        if (hasBreach || maxHeat > 40) {
          lightColor = 0xff2200; // red emergency
          intensity = 1.0;
        } else if (maxHeat > 20 || maxSmoke > 30) {
          lightColor = 0xff8800; // amber warning
          intensity = 0.9;
        } else {
          lightColor = ROOM_LIGHT_COLORS[room.name] ?? 0x667788;
        }

        const light = new THREE.PointLight(lightColor, intensity, room.width + room.height + 4);
        light.position.set(centerX, 2.5, centerY);
        this.scene.add(light);
        this.roomLights.set(room.id, light);

        // Place debris in hazardous rooms
        if (hasBreach || maxHeat > 40 || maxSmoke > 50) {
          this.placeDebris(state, room, hasBreach);
        }
      }
    }

    // Corridor lights: dim point lights every 3 tiles along explored corridors
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const key = `${x},${y}`;
        if (this.corridorLitTiles.has(key)) continue;
        const tile = state.tiles[y][x];
        if (tile.type !== TileType.Corridor || !tile.explored) continue;
        // Only every 3rd tile (checkerboard-ish pattern for performance)
        if ((x + y) % 3 !== 0) continue;
        this.corridorLitTiles.add(key);
        const corridorLight = new THREE.PointLight(0x5577aa, 0.5, 4);
        corridorLight.position.set(x, 1.5, y);
        this.scene.add(corridorLight);
      }
    }

    // Corridor wall decorations: pipes/wires along corridor walls
    const corridorPropModels = [
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
      "models/synty-space-gltf/SM_Prop_Panel_01.glb",
    ];
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const key = `${x},${y}`;
        if (this.corridorDecorTiles.has(key)) continue;
        const tile = state.tiles[y][x];
        if (tile.type !== TileType.Wall || !tile.explored) continue;
        // Only every 4th tile for performance
        if ((x * 7 + y * 13) % 4 !== 0) continue;
        // Must border a corridor tile
        const hasCorridorN = y > 0 && state.tiles[y - 1][x].type === TileType.Corridor;
        const hasCorridorS = y < state.height - 1 && state.tiles[y + 1][x].type === TileType.Corridor;
        const hasCorridorE = x < state.width - 1 && state.tiles[y][x + 1].type === TileType.Corridor;
        const hasCorridorW = x > 0 && state.tiles[y][x - 1].type === TileType.Corridor;
        if (!hasCorridorN && !hasCorridorS && !hasCorridorE && !hasCorridorW) continue;
        // Don't place near room walls (already have room wall props)
        let nearRoom = false;
        for (const room of state.rooms) {
          if (x >= room.x - 1 && x <= room.x + room.width &&
              y >= room.y - 1 && y <= room.y + room.height) {
            nearRoom = true;
            break;
          }
        }
        if (nearRoom) continue;

        this.corridorDecorTiles.add(key);
        const modelPath = corridorPropModels[(x + y) % corridorPropModels.length];
        let rot = 0;
        if (hasCorridorN) rot = 0;
        else if (hasCorridorS) rot = Math.PI;
        else if (hasCorridorE) rot = -Math.PI / 2;
        else if (hasCorridorW) rot = Math.PI / 2;

        const cached = this.gltfCache.get(modelPath);
        if (cached) {
          const clone = cached.clone();
          const box = new THREE.Box3().setFromObject(clone);
          const sz = new THREE.Vector3();
          box.getSize(sz);
          const maxDim = Math.max(sz.x, sz.y, sz.z);
          if (maxDim > 0) clone.scale.multiplyScalar(0.4 / maxDim);
          clone.position.set(x, 0.8, y);
          clone.rotation.y = rot;
          this.decorationGroup.add(clone);
        } else {
          const capturedX = x, capturedY = y, capturedRot = rot;
          const url = import.meta.env.BASE_URL + modelPath;
          this.gltfLoader.load(url, (gltf) => {
            try {
              const model = gltf.scene.clone();
              model.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                  const mats = Array.isArray(child.material) ? child.material : [child.material];
                  const oldMat = mats[0] as THREE.MeshStandardMaterial;
                  const hasUVs = !!(child.geometry?.attributes?.uv);
                  let tex = hasUVs && oldMat?.map ? oldMat.map : null;
                  if (!tex && hasUVs && this.syntyAtlas) tex = this.syntyAtlas;
                  child.material = makeToonMaterial({
                    color: tex ? 0xffffff : (oldMat?.color?.getHex() ?? 0x666677),
                    gradientMap: this.toonGradient,
                    map: tex,
                  });
                }
              });
              this.gltfCache.set(modelPath, model);
              const clone = model.clone();
              const box = new THREE.Box3().setFromObject(clone);
              const sz = new THREE.Vector3();
              box.getSize(sz);
              const maxDim = Math.max(sz.x, sz.y, sz.z);
              if (maxDim > 0) clone.scale.multiplyScalar(0.4 / maxDim);
              clone.position.set(capturedX, 0.8, capturedY);
              clone.rotation.y = capturedRot;
              this.decorationGroup.add(clone);
            } catch (e) { /* ignore load failure */ }
          }, undefined, () => {});
        }
      }
    }
  }

  // ── Private: hazard visual effects ─────────────────────────────

  private updateHazardVisuals(state: GameState): void {
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;
    const viewRange = 8; // only show hazard sprites near the player

    for (let y = Math.max(0, py - viewRange); y < Math.min(state.height, py + viewRange); y++) {
      for (let x = Math.max(0, px - viewRange); x < Math.min(state.width, px + viewRange); x++) {
        const tile = state.tiles[y][x];
        if (!tile.visible || !tile.walkable) continue;

        const key = `${x},${y}`;

        // Smoke wisps at smoky tiles
        if (tile.smoke > 30 && !this.hazardSpriteKeys.has(`smoke_${key}`)) {
          this.hazardSpriteKeys.add(`smoke_${key}`);
          const smokeSprite = this.createHazardSprite(0x888888, 0.4, Math.min(0.6, tile.smoke / 100));
          smokeSprite.position.set(x, 0.3 + Math.random() * 0.4, y);
          smokeSprite.userData = { hazardType: "smoke", baseY: smokeSprite.position.y };
          this.hazardSprites.add(smokeSprite);
        }

        // Heat glow at hot tiles
        if (tile.heat > HEAT_PAIN_THRESHOLD && !this.hazardSpriteKeys.has(`heat_${key}`)) {
          this.hazardSpriteKeys.add(`heat_${key}`);
          const heatSprite = this.createHazardSprite(0xff4400, 0.3, Math.min(0.5, tile.heat / 120));
          heatSprite.position.set(x, 0.05, y);
          heatSprite.userData = { hazardType: "heat", baseY: 0.05 };
          this.hazardSprites.add(heatSprite);
        }

        // Vacuum frost at depressurized tiles
        if (tile.pressure < 40 && !this.hazardSpriteKeys.has(`vacuum_${key}`)) {
          this.hazardSpriteKeys.add(`vacuum_${key}`);
          const frostSprite = this.createHazardSprite(0x4488ff, 0.35, 0.3);
          frostSprite.position.set(x + (Math.random() - 0.5) * 0.3, 0.1, y + (Math.random() - 0.5) * 0.3);
          frostSprite.userData = { hazardType: "vacuum", baseY: 0.1 };
          this.hazardSprites.add(frostSprite);
        }
      }
    }
  }

  private updateDoorLights(state: GameState): void {
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const tile = state.tiles[y][x];
        if ((tile.type !== TileType.Door && tile.type !== TileType.LockedDoor) || !tile.explored) continue;
        const key = `door_${x},${y}`;
        if (this.doorLights.has(key)) continue;

        const isLocked = tile.type === TileType.LockedDoor;
        const lightColor = isLocked ? 0xff3333 : 0x44cc66;
        const light = new THREE.PointLight(lightColor, isLocked ? 0.6 : 0.4, 3);
        light.position.set(x, 1.2, y);
        this.scene.add(light);
        this.doorLights.set(key, light);
      }
    }
  }

  private updateRoomLabels(state: GameState): void {
    for (const room of state.rooms) {
      if (this.roomLabels3D.has(room.id)) continue;
      const cx = room.x + Math.floor(room.width / 2);
      const cy = room.y + Math.floor(room.height / 2);
      if (cy < 0 || cy >= state.height || cx < 0 || cx >= state.width) continue;
      if (!state.tiles[cy][cx].explored) continue;

      // Create canvas-based text sprite for the room name
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;

      // Room zone color
      const tint = ROOM_WALL_TINTS_3D[room.name] ?? 0x778899;
      const r = (tint >> 16) & 0xff;
      const g = (tint >> 8) & 0xff;
      const b = tint & 0xff;

      // Semi-transparent background bar
      ctx.fillStyle = `rgba(${Math.round(r * 0.3)}, ${Math.round(g * 0.3)}, ${Math.round(b * 0.3)}, 0.5)`;
      ctx.fillRect(0, 10, 256, 44);

      // Text
      ctx.fillStyle = `rgb(${Math.min(255, r + 80)}, ${Math.min(255, g + 80)}, ${Math.min(255, b + 80)})`;
      ctx.font = "bold 22px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(room.name.toUpperCase(), 128, 32);

      // Accent line at bottom
      ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(20, 52);
      ctx.lineTo(236, 52);
      ctx.stroke();

      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.7, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(room.width * 0.8, room.width * 0.2, 1);
      sprite.position.set(cx, 2.5, cy);
      this.scene.add(sprite);
      this.roomLabels3D.set(room.id, sprite);
    }
  }

  private updateEntityLabels(state: GameState): void {
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;
    const labelRange = 4; // show labels within this distance

    // Hide all existing labels first
    for (const [, sprite] of this.entityLabels) {
      sprite.visible = false;
    }

    for (const [id, entity] of state.entities) {
      if (id === "player") continue;
      const dist = Math.max(Math.abs(entity.pos.x - px), Math.abs(entity.pos.y - py));
      if (dist > labelRange) continue;

      const tile = state.tiles[entity.pos.y]?.[entity.pos.x];
      if (!tile?.visible) continue;

      // Get or create label sprite
      let sprite = this.entityLabels.get(id);
      if (!sprite) {
        const name = entityDisplayName(entity);
        const color = ENTITY_COLORS_CSS[entity.type] ?? "#aaaaaa";
        sprite = this.createTextSprite(name, color);
        this.entityLabels.set(id, sprite);
        this.scene.add(sprite);
      }

      sprite.visible = true;
      sprite.position.set(entity.pos.x, 1.6, entity.pos.y);
      // Fade based on distance (closer = more opaque)
      const opacity = dist <= 1 ? 0.9 : 0.5 - (dist - 2) * 0.1;
      (sprite.material as THREE.SpriteMaterial).opacity = Math.max(0.2, opacity);
    }
  }

  private createTextSprite(text: string, color: string): THREE.Sprite {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 48;
    const ctx = canvas.getContext("2d")!;

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 8, 256, 32);

    // Text
    ctx.fillStyle = color;
    ctx.font = "bold 18px 'Courier New', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 24);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.8, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(1.5, 0.3, 1);
    return sprite;
  }

  private createHazardSprite(color: number, size: number, opacity: number): THREE.Sprite {
    const mat = new THREE.SpriteMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(size, size, 1);
    return sprite;
  }

  // ── Private: entity mesh management ─────────────────────────────

  private updateEntities(state: GameState): void {
    const activeIds = new Set<string>();

    for (const [id, entity] of state.entities) {
      if (id === "player") continue;

      // Hidden crew items
      if (entity.type === EntityType.CrewItem && entity.props["hidden"] === true) {
        if (this.sensorMode !== SensorType.Cleanliness) continue;
      }

      // Only show on visible tiles
      const tile = state.tiles[entity.pos.y]?.[entity.pos.x];
      if (!tile || !tile.visible) {
        // Hide entity if tile not visible
        const existing = this.entityMeshes.get(id);
        if (existing) existing.visible = false;
        activeIds.add(id);
        continue;
      }

      // Smoke blocking
      if (tile.smoke > 50) {
        const px = state.player.entity.pos.x;
        const py = state.player.entity.pos.y;
        const manhattan = Math.abs(entity.pos.x - px) + Math.abs(entity.pos.y - py);
        if (manhattan > 1) {
          const existing = this.entityMeshes.get(id);
          if (existing) existing.visible = false;
          activeIds.add(id);
          continue;
        }
      }

      activeIds.add(id);

      let mesh = this.entityMeshes.get(id);

      // Upgrade primitive → GLTF when model becomes available
      if (mesh && !mesh.userData.isGltf && this.gltfCache.has(entity.type)) {
        this.entityGroup.remove(mesh);
        if (mesh instanceof THREE.Mesh) mesh.geometry?.dispose();
        this.entityMeshes.delete(id);
        mesh = undefined;
      }

      if (!mesh) {
        mesh = this.createEntityMesh(entity);
        this.entityMeshes.set(id, mesh);
        this.entityGroup.add(mesh);
      }

      mesh.visible = true;
      mesh.position.x = entity.pos.x;
      mesh.position.z = entity.pos.y;
      if (entity.type !== EntityType.DataCore && entity.type !== EntityType.Drone) {
        mesh.position.y = mesh.userData.baseY ?? 0.3;
      }
    }

    // Remove stale entity meshes
    for (const [id, mesh] of this.entityMeshes) {
      if (!activeIds.has(id)) {
        this.entityGroup.remove(mesh);
        if (mesh instanceof THREE.Mesh) {
          mesh.geometry?.dispose();
        }
        this.entityMeshes.delete(id);
      }
    }

    // Update interaction indicator — show above nearest interactable entity
    if (this.interactionIndicator) {
      const px = state.player.entity.pos.x;
      const py = state.player.entity.pos.y;
      let bestId = "";
      let bestDist = Infinity;
      for (const [id, entity] of state.entities) {
        if (id === "player") continue;
        const dx = Math.abs(entity.pos.x - px);
        const dy = Math.abs(entity.pos.y - py);
        if (dx > 1 || dy > 1 || dx + dy > 1) continue; // cardinal adjacency + same tile
        const tile = state.tiles[entity.pos.y]?.[entity.pos.x];
        if (!tile?.visible) continue;
        const dist = dx + dy;
        if (dist < bestDist) {
          bestDist = dist;
          bestId = id;
        }
      }
      if (bestId) {
        const mesh = this.entityMeshes.get(bestId);
        if (mesh && mesh.visible) {
          this.interactionIndicator.visible = true;
          this.interactionIndicator.position.set(mesh.position.x, 1.8, mesh.position.z);
          this.interactionTargetId = bestId;
        } else {
          this.interactionIndicator.visible = false;
          this.interactionTargetId = "";
        }
      } else {
        this.interactionIndicator.visible = false;
        this.interactionTargetId = "";
      }
    }
  }

  // Entity types that get a small colored point light for visual emphasis
  private static readonly ENTITY_GLOW_LIGHTS: Partial<Record<string, { color: number; intensity: number; distance: number }>> = {
    [EntityType.DataCore]: { color: 0xff44ff, intensity: 2.0, distance: 8 },
    [EntityType.Relay]: { color: 0xffcc00, intensity: 1.4, distance: 6 },
    [EntityType.Breach]: { color: 0xff2200, intensity: 1.5, distance: 6 },
    [EntityType.SensorPickup]: { color: 0x00ffee, intensity: 1.0, distance: 5 },
    [EntityType.EscapePod]: { color: 0x44ffaa, intensity: 1.0, distance: 6 },
    [EntityType.MedKit]: { color: 0xff4444, intensity: 0.7, distance: 4 },
    [EntityType.EvidenceTrace]: { color: 0xffaa00, intensity: 1.2, distance: 5 },
    [EntityType.CrewNPC]: { color: 0xffcc88, intensity: 0.8, distance: 5 },
    [EntityType.LogTerminal]: { color: 0x66ccff, intensity: 0.7, distance: 4 },
    [EntityType.SecurityTerminal]: { color: 0x44aaff, intensity: 0.7, distance: 4 },
    [EntityType.Console]: { color: 0x66aaff, intensity: 0.6, distance: 4 },
    [EntityType.PowerCell]: { color: 0xffdd44, intensity: 0.7, distance: 4 },
    [EntityType.FuseBox]: { color: 0xdd8800, intensity: 0.6, distance: 3 },
    [EntityType.PressureValve]: { color: 0x44bbaa, intensity: 0.5, distance: 3 },
    [EntityType.RepairCradle]: { color: 0xaaff66, intensity: 0.5, distance: 4 },
  };

  private createEntityMesh(entity: Entity): THREE.Object3D {
    // Try to use a loaded GLTF model first
    const gltfModel = this.gltfCache.get(entity.type);
    if (gltfModel) {
      // Wrap in a Group so the model's internal centering offsets are preserved
      const group = new THREE.Group();
      const clone = gltfModel.clone();
      group.add(clone);
      const baseY = entity.type === EntityType.Drone ? 0.6 : 0.3;
      group.userData = { entityType: entity.type, baseY, isGltf: true };
      group.position.set(entity.pos.x, baseY, entity.pos.y);

      // Add glow light for emphasis entities
      const glowDef = BrowserDisplay3D.ENTITY_GLOW_LIGHTS[entity.type];
      if (glowDef) {
        const glow = new THREE.PointLight(glowDef.color, glowDef.intensity, glowDef.distance);
        glow.position.set(0, 0.5, 0);
        group.add(glow);
        // Apply emissive to the model itself for self-illumination
        clone.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissive = new THREE.Color(glowDef.color);
            child.material.emissiveIntensity = 0.15;
          }
        });
      }

      return group;
    }

    // Fallback: styled primitive geometry with emissive toon glow
    const color = ENTITY_COLORS_3D[entity.type] ?? 0xffffff;
    const glowMat = makeToonMaterial({ color, gradientMap: this.toonGradient, emissive: color, emissiveIntensity: 0.3 });
    const group = new THREE.Group();
    let baseY = 0.3;

    switch (entity.type) {
      case EntityType.Relay: {
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), glowMat);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.35, 0.03, 8, 24),
          makeToonMaterial({ color, gradientMap: this.toonGradient, emissive: color, emissiveIntensity: 0.5 })
        );
        ring.rotation.x = Math.PI / 2;
        group.add(core, ring);
        baseY = 0.6;
        break;
      }
      case EntityType.SensorPickup: {
        const dish = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.15, 12), glowMat);
        dish.rotation.x = Math.PI;
        dish.position.y = 0.15;
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 6), glowMat);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.2, 0.02, 6, 16),
          makeToonMaterial({ color, gradientMap: this.toonGradient, emissive: color, emissiveIntensity: 0.6 })
        );
        ring.position.y = 0.3;
        group.add(dish, base, ring);
        baseY = 0.3;
        break;
      }
      case EntityType.DataCore: {
        const inner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2), glowMat);
        const wireGeo = new THREE.IcosahedronGeometry(0.35);
        const wireMat = new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.6 });
        const cage = new THREE.Mesh(wireGeo, wireMat);
        group.add(inner, cage);
        baseY = 0.6;
        break;
      }
      case EntityType.ServiceBot: {
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.3), glowMat);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.2),
          makeToonMaterial({ color: 0xddaa44, gradientMap: this.toonGradient, emissive: 0x442200, emissiveIntensity: 0.3 }));
        head.position.y = 0.25;
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4),
          new THREE.MeshBasicMaterial({ color: 0xff4400 }));
        eye.position.set(0, 0.25, 0.11);
        group.add(body, head, eye);
        baseY = 0.25;
        break;
      }
      case EntityType.LogTerminal: {
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.3, 6), glowMat);
        const screen = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.04),
          makeToonMaterial({ color: 0x112233, gradientMap: this.toonGradient, emissive: color, emissiveIntensity: 0.5 }));
        screen.position.y = 0.32;
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.27),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 }));
        glow.position.set(0, 0.32, 0.025);
        group.add(stand, screen, glow);
        baseY = 0.2;
        break;
      }
      case EntityType.Drone: {
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), glowMat);
        const propRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.3, 0.02, 6, 16),
          makeToonMaterial({ color, gradientMap: this.toonGradient, emissive: color, emissiveIntensity: 0.4 })
        );
        propRing.rotation.x = Math.PI / 2;
        propRing.position.y = 0.1;
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4),
          new THREE.MeshBasicMaterial({ color: 0x44ff44 }));
        eye.position.set(0, 0, 0.18);
        group.add(body, propRing, eye);
        baseY = 0.6;
        break;
      }
      case EntityType.Breach: {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.35, 0.06, 6, 8),
          makeToonMaterial({ color, gradientMap: this.toonGradient, emissive: color, emissiveIntensity: 0.7 })
        );
        ring.rotation.x = -Math.PI / 2;
        const sparks = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.12),
          new THREE.MeshBasicMaterial({ color: 0xff8800, wireframe: true })
        );
        group.add(ring, sparks);
        baseY = 0.1;
        break;
      }
      case EntityType.MedKit: {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.25),
          makeToonMaterial({ color: 0xeeeeee, gradientMap: this.toonGradient }));
        const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.04),
          new THREE.MeshBasicMaterial({ color: 0xff2222 }));
        crossH.position.z = 0.13;
        const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.04),
          new THREE.MeshBasicMaterial({ color: 0xff2222 }));
        crossV.position.z = 0.13;
        crossV.rotation.z = Math.PI / 2;
        group.add(box, crossH, crossV);
        baseY = 0.12;
        break;
      }
      case EntityType.RepairBot: {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.35, 8), glowMat);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 0.06), glowMat);
        arm.position.set(0.25, 0.1, 0);
        arm.rotation.z = -0.4;
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4),
          new THREE.MeshBasicMaterial({ color: 0x44ffaa }));
        eye.position.set(0, 0.2, 0.15);
        group.add(body, arm, eye);
        baseY = 0.25;
        break;
      }
      case EntityType.ClosedDoor: {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.08),
          makeToonMaterial({ color: 0x664422, gradientMap: this.toonGradient }));
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.1),
          makeToonMaterial({ color, gradientMap: this.toonGradient, emissive: color, emissiveIntensity: 0.2 }));
        group.add(frame, panel);
        baseY = 0.6;
        break;
      }
      case EntityType.SecurityTerminal: {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6),
          makeToonMaterial({ color: 0x666666, gradientMap: this.toonGradient }));
        const cam = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.2), glowMat);
        cam.position.y = 0.35;
        const lens = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0xff0000 }));
        lens.position.set(0, 0.35, 0.12);
        group.add(pole, cam, lens);
        baseY = 0.3;
        break;
      }
      case EntityType.CrewItem: {
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.2), glowMat);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.02, 0.2), glowMat);
        lid.position.set(0, 0.1, 0.04);
        lid.rotation.x = -0.3;
        group.add(box, lid);
        baseY = 0.1;
        break;
      }
      case EntityType.EscapePod: {
        // Capsule shape: cylinder body + hemisphere ends
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.5, 8), glowMat);
        body.rotation.z = Math.PI / 2;
        const topCap = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
          glowMat);
        topCap.rotation.z = Math.PI / 2;
        topCap.position.x = 0.25;
        const bottomCap = new THREE.Mesh(new THREE.SphereGeometry(0.25, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
          glowMat);
        bottomCap.rotation.z = -Math.PI / 2;
        bottomCap.position.x = -0.25;
        const window = new THREE.Mesh(new THREE.CircleGeometry(0.12, 8),
          new THREE.MeshBasicMaterial({ color: 0x88ffcc, transparent: true, opacity: 0.6 }));
        window.position.set(0, 0.15, 0.2);
        group.add(body, topCap, bottomCap, window);
        baseY = 0.3;
        break;
      }
      case EntityType.CrewNPC: {
        // Humanoid silhouette: cylinder body + sphere head
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.4, 8), glowMat);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6),
          makeToonMaterial({ color, gradientMap: this.toonGradient, emissive: color, emissiveIntensity: 0.2 }));
        head.position.y = 0.3;
        const visor = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.04),
          new THREE.MeshBasicMaterial({ color: 0x44ccff }));
        visor.position.set(0, 0.3, 0.09);
        group.add(torso, head, visor);
        baseY = 0.25;
        break;
      }
      case EntityType.Airlock: {
        // Large door frame with warning stripes
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.1),
          makeToonMaterial({ color: 0x556688, gradientMap: this.toonGradient }));
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.12),
          makeToonMaterial({ color, gradientMap: this.toonGradient, emissive: color, emissiveIntensity: 0.3 }));
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.11),
          new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
        stripe.position.y = 0.5;
        group.add(frame, panel, stripe);
        baseY = 0.6;
        break;
      }
      case EntityType.ToolPickup: {
        // Small tool box
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.2), glowMat);
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.03),
          makeToonMaterial({ color: 0x888888, gradientMap: this.toonGradient }));
        handle.position.y = 0.09;
        const indicator = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4),
          new THREE.MeshBasicMaterial({ color }));
        indicator.position.set(0.1, 0.06, 0.11);
        group.add(box, handle, indicator);
        baseY = 0.1;
        break;
      }
      case EntityType.UtilityPickup: {
        // Glowing utility orb on a small stand
        const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.1, 6),
          makeToonMaterial({ color: 0x666666, gradientMap: this.toonGradient }));
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8),
          makeToonMaterial({ color, gradientMap: this.toonGradient, emissive: color, emissiveIntensity: 0.5, transparent: true, opacity: 0.8 }));
        orb.position.y = 0.2;
        group.add(stand, orb);
        baseY = 0.1;
        break;
      }
      case EntityType.Console: {
        // Angled screen on a stand
        const base = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.3),
          makeToonMaterial({ color: 0x444455, gradientMap: this.toonGradient }));
        const screen = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.03),
          makeToonMaterial({ color: 0x112233, gradientMap: this.toonGradient, emissive: color, emissiveIntensity: 0.5 }));
        screen.position.set(0, 0.25, 0.12);
        screen.rotation.x = -0.3;
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.22),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 }));
        glow.position.set(0, 0.25, 0.14);
        glow.rotation.x = -0.3;
        group.add(base, screen, glow);
        baseY = 0.2;
        break;
      }
      case EntityType.RepairCradle: {
        // Flat platform with mechanical arms
        const platform = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.5), glowMat);
        const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.04),
          makeToonMaterial({ color: 0x888888, gradientMap: this.toonGradient }));
        arm1.position.set(-0.25, 0.2, 0);
        const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.04),
          makeToonMaterial({ color: 0x888888, gradientMap: this.toonGradient }));
        arm2.position.set(0.25, 0.2, 0);
        const clamp1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.12),
          makeToonMaterial({ color, gradientMap: this.toonGradient }));
        clamp1.position.set(-0.25, 0.38, 0);
        const clamp2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.12),
          makeToonMaterial({ color, gradientMap: this.toonGradient }));
        clamp2.position.set(0.25, 0.38, 0);
        group.add(platform, arm1, arm2, clamp1, clamp2);
        baseY = 0.05;
        break;
      }
      case EntityType.EvidenceTrace: {
        // Floating "?" sprite — canvas-rendered text for crisp question mark
        const qCanvas = document.createElement("canvas");
        qCanvas.width = 128;
        qCanvas.height = 128;
        const qCtx = qCanvas.getContext("2d")!;
        // Outer glow
        qCtx.shadowColor = "#ffaa00";
        qCtx.shadowBlur = 20;
        qCtx.fillStyle = "#ffcc44";
        qCtx.font = "bold 100px Arial, sans-serif";
        qCtx.textAlign = "center";
        qCtx.textBaseline = "middle";
        qCtx.fillText("?", 64, 60);
        // Second pass for stronger center
        qCtx.shadowBlur = 0;
        qCtx.fillText("?", 64, 60);

        const qTex = new THREE.CanvasTexture(qCanvas);
        const qSpriteMat = new THREE.SpriteMaterial({
          map: qTex,
          transparent: true,
          depthWrite: false,
        });
        const qSprite = new THREE.Sprite(qSpriteMat);
        qSprite.scale.set(0.7, 0.7, 1);
        qSprite.position.y = 0.4;
        group.add(qSprite);

        // Glow ring on ground
        const glowRing = new THREE.Mesh(
          new THREE.RingGeometry(0.2, 0.35, 16),
          new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
        );
        glowRing.rotation.x = -Math.PI / 2;
        glowRing.position.y = 0.02;
        group.add(glowRing);
        baseY = 0.15;
        break;
      }
      case EntityType.CrewItem: {
        // Small personal item — box with a glowing tag
        const itemBox = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.15), glowMat);
        const tag = new THREE.Mesh(
          new THREE.BoxGeometry(0.08, 0.08, 0.02),
          new THREE.MeshBasicMaterial({ color })
        );
        tag.position.set(0, 0.1, 0.08);
        group.add(itemBox, tag);
        baseY = 0.1;
        break;
      }
      default: {
        const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        group.add(new THREE.Mesh(geo, glowMat));
        baseY = 0.2;
        break;
      }
    }

    group.userData = { entityType: entity.type, baseY, isGltf: false };
    group.position.set(entity.pos.x, baseY, entity.pos.y);

    // Add glow light for emphasis entities (fallback geometry)
    const glowDef = BrowserDisplay3D.ENTITY_GLOW_LIGHTS[entity.type];
    if (glowDef) {
      const glow = new THREE.PointLight(glowDef.color, glowDef.intensity, glowDef.distance);
      glow.position.set(0, 0.5, 0);
      group.add(glow);
    }

    return group;
  }

  // ── Private: player ─────────────────────────────────────────────

  private createPlayerMesh(): THREE.Group {
    const group = new THREE.Group();

    // Body: cylinder
    const bodyGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.5, 12);
    const bodyMat = makeToonMaterial({ color: COLORS_3D.player, gradientMap: this.toonGradient });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0;
    group.add(body);

    // Head / antenna box
    const headGeo = new THREE.BoxGeometry(0.15, 0.25, 0.15);
    const headMat = makeToonMaterial({ color: 0x00cc00, gradientMap: this.toonGradient });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.35;
    group.add(head);

    // Antenna
    const antennaGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 4);
    const antennaMat = makeToonMaterial({ color: 0x88ff88, gradientMap: this.toonGradient });
    const antenna = new THREE.Mesh(antennaGeo, antennaMat);
    antenna.position.y = 0.55;
    group.add(antenna);

    // Small tip sphere (antenna tip)
    const tipGeo = new THREE.SphereGeometry(0.04, 6, 4);
    const tip = new THREE.Mesh(tipGeo, makeToonMaterial({ color: 0x00ff44, gradientMap: this.toonGradient }));
    tip.position.y = 0.67;
    group.add(tip);

    // Ground glow circle under Sweepo
    const glowGeo = new THREE.CircleGeometry(0.5, 16);
    glowGeo.rotateX(-Math.PI / 2);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x22ff66,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    });
    const glowCircle = new THREE.Mesh(glowGeo, glowMat);
    glowCircle.position.y = -0.38; // just above floor
    group.add(glowCircle);

    return group;
  }

  private updatePlayer(state: GameState): void {
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;
    const isFirstRender = this.lastPlayerX < 0;

    // Track movement direction and update facing
    if (this.lastPlayerX >= 0 && this.lastPlayerY >= 0) {
      const dx = px - this.lastPlayerX;
      const dy = py - this.lastPlayerY;
      if (dx !== 0 || dy !== 0) {
        // GLTF models face -Z by default. In our coordinate system:
        // +x = east, +z (mapped from y) = south. We add π to flip 180°
        // so the model faces the movement direction, not away from it.
        this.playerFacing = Math.atan2(dx, -dy) + Math.PI;
      }
    }
    this.lastPlayerX = px;
    this.lastPlayerY = py;

    // Set targets for smooth interpolation (animate loop handles actual movement)
    this.playerTargetX = px;
    this.playerTargetZ = py;
    this.cameraTargetX = px;
    this.cameraTargetZ = py;
    // Rotation is smoothly interpolated in the animate loop

    // On first render, snap immediately (no lerp from origin)
    if (isFirstRender) {
      this.playerCurrentX = px;
      this.playerCurrentZ = py;
      this.cameraPosX = px;
      this.cameraPosZ = py;
      this.playerMesh.position.x = px;
      this.playerMesh.position.z = py;
      this.playerLight.position.set(px, 3, py);
      this.camera.position.set(px, 8, py + 12);
      this.camera.lookAt(px, 0, py);
    }

    // Tint player light to current room's zone color (subtle blend)
    const room = this.getPlayerRoom(state);
    if (room) {
      const roomLight = ROOM_LIGHT_COLORS[room.name];
      if (roomLight) {
        // Blend 70% green base + 30% room tint
        const gr = 0x44, gg = 0xff, gb = 0x66; // base green
        const rr = (roomLight >> 16) & 0xff;
        const rg = (roomLight >> 8) & 0xff;
        const rb = roomLight & 0xff;
        const fr = Math.round(gr * 0.7 + rr * 0.3);
        const fg = Math.round(gg * 0.7 + rg * 0.3);
        const fb = Math.round(gb * 0.7 + rb * 0.3);
        this.playerLight.color.setHex((fr << 16) | (fg << 8) | fb);
      } else {
        this.playerLight.color.setHex(0x44ff66); // default green
      }
    }
  }

  // ── Private: resize handling ────────────────────────────────────

  private getAspect(): number {
    const sidebarWidth = 340;
    const availW = window.innerWidth - sidebarWidth;
    const availH = window.innerHeight;
    return availW / availH;
  }

  private handleResize(): void {
    const sidebarWidth = 340;
    const availW = window.innerWidth - sidebarWidth;
    const availH = window.innerHeight;

    this.renderer.setSize(availW, availH);
    this.outlineEffect.setSize(availW, availH);

    const aspect = availW / availH;
    const frustumHeight = CAMERA_FRUSTUM_SIZE;
    const frustumWidth = frustumHeight * aspect;
    this.camera.left = -frustumWidth / 2;
    this.camera.right = frustumWidth / 2;
    this.camera.top = frustumHeight / 2;
    this.camera.bottom = -frustumHeight / 2;
    this.camera.updateProjectionMatrix();
  }

  // ── Private: model loading (GLTF + FBX) ─────────────────────────

  /** Load tile models (wall, floor) and swap instanced mesh geometry */
  private loadTileModels(): void {
    const base = import.meta.env.BASE_URL;

    // Load wall model
    this.gltfLoader.load(base + WALL_MODEL_PATH, (gltf) => {
      try {
        const { geometry, material } = this.extractFirstMeshGeo(gltf.scene, 1.0);
        if (geometry) {
          this.wallModelGeo = geometry;
          this.wallModelMat = material;
          this.rebuildWallMesh();
        }
      } catch (e) {
        console.warn("Failed to load wall model:", e);
      }
    }, undefined, () => {});

    // Load corner wall model
    this.gltfLoader.load(base + WALL_CORNER_MODEL_PATH, (gltf) => {
      try {
        const { geometry, material } = this.extractFirstMeshGeo(gltf.scene, 1.0);
        if (geometry) {
          this.wallCornerModelGeo = geometry;
          this.wallCornerModelMat = material;
          this.rebuildWallCornerMesh();
        }
      } catch (e) {
        console.warn("Failed to load corner wall model:", e);
      }
    }, undefined, () => {});

    // Load floor model
    this.gltfLoader.load(base + FLOOR_MODEL_PATH, (gltf) => {
      try {
        const { geometry, material } = this.extractFirstMeshGeo(gltf.scene, 1.0);
        if (geometry) {
          this.floorModelGeo = geometry;
          this.floorModelMat = material;
          this.rebuildFloorMesh();
        }
      } catch (e) {
        console.warn("Failed to load floor model:", e);
      }
    }, undefined, () => {});

    // Load door model
    this.gltfLoader.load(base + DOOR_MODEL_PATH, (gltf) => {
      try {
        const { geometry, material } = this.extractFirstMeshGeo(gltf.scene, 1.0);
        if (geometry) {
          this.doorModelGeo = geometry;
          this.doorModelMat = material;
          this.rebuildDoorMesh();
        }
      } catch (e) {
        console.warn("Failed to load door model:", e);
      }
    }, undefined, () => {});
  }

  /** Extract the first mesh's geometry from a GLTF scene, normalized to fit in a 1x1 tile */
  private extractFirstMeshGeo(scene: THREE.Object3D, targetSize: number): { geometry: THREE.BufferGeometry | null; material: THREE.Material | null } {
    let foundGeo: THREE.BufferGeometry | null = null;
    let foundMat: THREE.Material | null = null;

    scene.traverse((child) => {
      if (!foundGeo && child instanceof THREE.Mesh) {
        foundGeo = child.geometry.clone();
        const oldMat = Array.isArray(child.material) ? child.material[0] : child.material;
        const hasUVs = !!(child.geometry?.attributes?.uv);
        let tex = hasUVs && (oldMat as THREE.MeshStandardMaterial)?.map
          ? (oldMat as THREE.MeshStandardMaterial).map
          : null;
        // Apply Synty atlas if model has UVs but no embedded texture
        if (!tex && hasUVs && this.syntyAtlas) {
          tex = this.syntyAtlas;
        }
        foundMat = makeToonMaterial({
          color: tex ? 0xffffff : ((oldMat as THREE.MeshStandardMaterial)?.color?.getHex() ?? 0xaaaaaa),
          gradientMap: this.toonGradient,
          map: tex,
        });
      }
    });

    if (!foundGeo) return { geometry: null, material: null };

    // Normalize the geometry to fit in targetSize box
    const geo = foundGeo as THREE.BufferGeometry;
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scale = targetSize / maxDim;
      geo.scale(scale, scale, scale);
    }

    // Re-center horizontally, sit on y=0
    geo.computeBoundingBox();
    const box2 = geo.boundingBox!;
    const center = new THREE.Vector3();
    box2.getCenter(center);
    geo.translate(-center.x, -box2.min.y, -center.z);

    return { geometry: geo, material: foundMat };
  }

  /** Rebuild wall instanced mesh with loaded model geometry */
  private rebuildWallMesh(): void {
    if (!this.wallModelGeo) return;
    this.scene.remove(this.wallMesh);
    this.wallMesh.dispose();

    // Use the loaded material (with embedded texture) directly;
    // instance colors will multiply with texture color for per-room tinting
    const mat = this.wallModelMat ?? makeToonMaterial({ color: 0xffffff, gradientMap: this.toonGradient });

    this.wallMesh = new THREE.InstancedMesh(this.wallModelGeo, mat, this.maxTiles);
    this.wallMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wallMesh.frustumCulled = false;
    this.wallMesh.count = 0;
    this.scene.add(this.wallMesh);
  }

  /** Rebuild corner wall instanced mesh with loaded model geometry */
  private rebuildWallCornerMesh(): void {
    if (!this.wallCornerModelGeo) return;
    this.scene.remove(this.wallCornerMesh);
    this.wallCornerMesh.dispose();

    const mat = this.wallCornerModelMat ?? makeToonMaterial({ color: 0xffffff, gradientMap: this.toonGradient });

    this.wallCornerMesh = new THREE.InstancedMesh(this.wallCornerModelGeo, mat, this.maxTiles);
    this.wallCornerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wallCornerMesh.frustumCulled = false;
    this.wallCornerMesh.count = 0;
    this.scene.add(this.wallCornerMesh);
  }

  /** Rebuild floor instanced mesh with loaded model geometry */
  private rebuildFloorMesh(): void {
    if (!this.floorModelGeo) return;
    this.scene.remove(this.floorMesh);
    this.floorMesh.dispose();

    const mat = this.floorModelMat ?? makeToonMaterial({ color: 0xffffff, gradientMap: this.toonGradient });

    this.floorMesh = new THREE.InstancedMesh(this.floorModelGeo, mat, this.maxTiles);
    this.floorMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.floorMesh.frustumCulled = false;
    this.floorMesh.count = 0;
    this.scene.add(this.floorMesh);
  }

  /** Rebuild door instanced mesh with loaded model geometry */
  private rebuildDoorMesh(): void {
    if (!this.doorModelGeo) return;
    this.scene.remove(this.doorMesh);
    this.doorMesh.dispose();

    const mat = this.doorModelMat ?? makeToonMaterial({ color: 0xffffff, gradientMap: this.toonGradient });

    this.doorMesh = new THREE.InstancedMesh(this.doorModelGeo, mat, 200);
    this.doorMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.doorMesh.frustumCulled = false;
    this.doorMesh.count = 0;
    this.scene.add(this.doorMesh);
  }

  /** Post-process a loaded model: normalize scale, center, apply toon materials */
  private prepareModel(key: string, scene: THREE.Object3D): void {
    const model = scene;

    // Synty models are huge (~100 units); normalize to fit in ~0.7 unit box
    // Player gets slightly larger, small pickups get smaller
    const ENTITY_SCALE: Partial<Record<string, number>> = {
      player: 0.95,                          // Sweepo — prominent on screen
      [EntityType.Relay]: 0.9,               // important system
      [EntityType.DataCore]: 1.0,            // primary objective — largest
      [EntityType.LogTerminal]: 0.9,
      [EntityType.SecurityTerminal]: 0.9,
      [EntityType.Console]: 0.85,
      [EntityType.RepairCradle]: 0.85,
      [EntityType.ServiceBot]: 0.75,
      [EntityType.RepairBot]: 0.75,
      [EntityType.Drone]: 0.7,
      [EntityType.PatrolDrone]: 0.75,
      [EntityType.ToolPickup]: 0.7,          // bigger so pickups visible
      [EntityType.UtilityPickup]: 0.7,
      [EntityType.SensorPickup]: 0.75,
      [EntityType.MedKit]: 0.65,
      [EntityType.PowerCell]: 0.65,
      [EntityType.FuseBox]: 0.75,
      [EntityType.PressureValve]: 0.75,
      [EntityType.EvidenceTrace]: 0.55,
      [EntityType.EscapePod]: 1.05,          // large escape capsule
      [EntityType.CrewNPC]: 0.95,            // important NPC
      [EntityType.Breach]: 0.85,
      [EntityType.ClosedDoor]: 0.9,
      [EntityType.Airlock]: 0.95,
      [EntityType.CrewItem]: 0.6,
    };
    const targetSize = ENTITY_SCALE[key] ?? 0.8;

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const s = targetSize / maxDim;
      model.scale.multiplyScalar(s);
    }

    // Rotate to face camera (GLTF models typically face -Z)
    model.rotation.y = 0;

    // Re-measure after scaling, center horizontally, sit on floor
    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    scaledBox.getCenter(center);
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= scaledBox.min.y; // sit on y=0

    // Convert materials to toon-shaded, applying Synty atlas where models have UVs but no embedded texture
    const tintColor = key === "player" ? COLORS_3D.player : ENTITY_COLORS_3D[key];
    const isSyntyModel = MODEL_PATHS[key]?.includes("synty-space-gltf");
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        const oldMat = mats[0] as THREE.MeshStandardMaterial;
        const hasUVs = !!(child.geometry?.attributes?.uv);
        // Use embedded texture if available, otherwise apply Synty atlas for Synty models with UVs
        let tex = hasUVs && oldMat?.map ? oldMat.map : null;
        if (!tex && hasUVs && isSyntyModel && this.syntyAtlas) {
          tex = this.syntyAtlas;
        }

        child.material = makeToonMaterial({
          color: tex ? 0xffffff : (tintColor ?? oldMat?.color?.getHex() ?? 0xaaaaaa),
          gradientMap: this.toonGradient,
          map: tex,
          emissive: tintColor ? tintColor : 0x000000,
          emissiveIntensity: tex ? 0.05 : 0.15, // subtle glow for untextured pieces
        });

        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    this.gltfCache.set(key, model);
  }

  /** Load texture atlas first, then kick off both tile and entity model loading */
  private loadAtlasThenModels(): void {
    const atlasUrl = import.meta.env.BASE_URL + "models/synty-space-gltf/PolygonSciFiSpace_Texture_01_A.png";
    new THREE.TextureLoader().load(
      atlasUrl,
      (tex) => {
        tex.flipY = true; // FBX2glTF preserves FBX UV space which expects flipY=true
        tex.colorSpace = THREE.SRGBColorSpace;
        this.syntyAtlas = tex;
        console.log("Synty texture atlas loaded.");
        this.loadTileModels();
        this.loadModels();
      },
      undefined,
      () => {
        console.warn("Failed to load Synty texture atlas — models will use flat colors.");
        this.loadTileModels();
        this.loadModels();
      }
    );
  }

  private loadModels(): void {
    const entries = Object.entries(MODEL_PATHS).filter(([, p]) => !!p);
    if (entries.length === 0) return;
    let loaded = 0;

    const onDone = () => {
      loaded++;
      if (loaded >= entries.length) {
        this.modelsLoaded = true;
        this.addLog(`Loaded ${this.gltfCache.size}/${entries.length} 3D models.`, "system");
        this.swapPlayerModel();
        this.rebuildEntityMeshes();
      }
    };

    for (const [key, path] of entries) {
      if (!path) continue;
      const url = import.meta.env.BASE_URL + path;

      this.gltfLoader.load(
        url,
        (gltf) => {
          try {
            this.prepareModel(key, gltf.scene.clone());
          } catch (e) {
            console.warn(`Failed to prepare model ${path}:`, e);
          }
          onDone();
        },
        undefined,
        (error: unknown) => {
          this.addLog(`Model failed: ${path}`, "warning");
          console.warn(`Failed to load model ${path}:`, error);
          onDone();
        }
      );
    }
  }

  /** Replace the primitive player mesh with the loaded GLTF model */
  private swapPlayerModel(): void {
    const model = this.gltfCache.get("player");
    if (!model) return;
    while (this.playerMesh.children.length > 0) {
      const child = this.playerMesh.children[0];
      this.playerMesh.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
      }
    }
    const clone = model.clone();
    this.playerMesh.add(clone);
  }

  /** Rebuild all existing entity meshes now that GLTF models are loaded */
  private rebuildEntityMeshes(): void {
    for (const [id, oldMesh] of this.entityMeshes) {
      const entityType = (oldMesh.userData as { entityType?: string }).entityType;
      if (!entityType) continue;
      // Only rebuild if we now have a model for this type
      if (!this.gltfCache.has(entityType)) continue;

      const pos = oldMesh.position.clone();
      const visible = oldMesh.visible;

      // Remove old
      this.entityGroup.remove(oldMesh);
      if (oldMesh instanceof THREE.Mesh) {
        oldMesh.geometry?.dispose();
      }

      // Create new from GLTF
      const gltfModel = this.gltfCache.get(entityType)!;
      const clone = gltfModel.clone();
      const baseY = entityType === EntityType.Drone ? 0.6 : 0.3;
      clone.userData = { entityType, baseY };
      clone.position.copy(pos);
      clone.visible = visible;

      this.entityMeshes.set(id, clone);
      this.entityGroup.add(clone);
    }
  }

  // ── Private: wall color ─────────────────────────────────────────

  private getWallColor3D(state: GameState, x: number, y: number): number {
    for (const room of state.rooms) {
      if (x >= room.x - 1 && x <= room.x + room.width &&
          y >= room.y - 1 && y <= room.y + room.height) {
        let color = ROOM_WALL_TINTS_3D[room.name] ?? COLORS_3D.wall;

        // Damage tinting: darken and red-shift walls in hazardous rooms
        let maxHeat = 0, maxSmoke = 0, hasBreach = false;
        for (let ry = room.y; ry < room.y + room.height; ry++) {
          for (let rx = room.x; rx < room.x + room.width; rx++) {
            if (ry < 0 || ry >= state.height || rx < 0 || rx >= state.width) continue;
            const t = state.tiles[ry][rx];
            if (t.heat > maxHeat) maxHeat = t.heat;
            if (t.smoke > maxSmoke) maxSmoke = t.smoke;
            if (t.pressure < 30) hasBreach = true;
          }
        }

        if (hasBreach) {
          // Severe: dark with red burn marks
          const r = ((color >> 16) & 0xff);
          const g = ((color >> 8) & 0xff);
          const b = (color & 0xff);
          color = (Math.min(255, Math.round(r * 0.5 + 40)) << 16) |
                  (Math.round(g * 0.35) << 8) |
                  Math.round(b * 0.35);
        } else if (maxHeat > 40) {
          // Heat damage: warm orange-brown tint
          const hf = Math.min(1, (maxHeat - 40) / 60);
          const r = ((color >> 16) & 0xff);
          const g = ((color >> 8) & 0xff);
          const b = (color & 0xff);
          color = (Math.min(255, Math.round(r + hf * 30)) << 16) |
                  (Math.max(0, Math.round(g * (1 - hf * 0.3))) << 8) |
                  Math.max(0, Math.round(b * (1 - hf * 0.5)));
        } else if (maxSmoke > 30) {
          // Smoke staining: desaturate toward grey
          const sf = Math.min(1, (maxSmoke - 30) / 70);
          const r = ((color >> 16) & 0xff);
          const g = ((color >> 8) & 0xff);
          const b = (color & 0xff);
          const grey = Math.round(r * 0.3 + g * 0.59 + b * 0.11);
          color = (Math.round(r + (grey - r) * sf * 0.5) << 16) |
                  (Math.round(g + (grey - g) * sf * 0.5) << 8) |
                  Math.round(b + (grey - b) * sf * 0.5);
        }

        return color;
      }
    }
    const hash = ((x * 3) + (y * 7)) & 0xf;
    if (hash < 4) return 0x778899;
    if (hash > 11) return 0x99aabb;
    return COLORS_3D.wall;
  }

  // ── Private: helpers (duplicated from display.ts for independence) ──

  private getPlayerRoom(state: GameState): Room | null {
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;
    for (const room of state.rooms) {
      if (px >= room.x && px < room.x + room.width &&
          py >= room.y && py < room.y + room.height) {
        return room;
      }
    }
    return null;
  }

  private getAdjacentInteractables(state: GameState): Entity[] {
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;
    const results: Entity[] = [];
    const deltas = [
      { x: 0, y: -1 }, { x: 0, y: 1 },
      { x: 1, y: 0 }, { x: -1, y: 0 },
      { x: 0, y: 0 },
    ];
    for (const d of deltas) {
      for (const [id, entity] of state.entities) {
        if (id === "player") continue;
        if (entity.pos.x === px + d.x && entity.pos.y === py + d.y) {
          results.push(entity);
        }
      }
    }
    return results;
  }

  private getNearbyEntities(state: GameState, radius: number): { entity: Entity; dist: number; dir: string }[] {
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;
    const results: { entity: Entity; dist: number; dir: string }[] = [];
    for (const [id, entity] of state.entities) {
      if (id === "player") continue;
      const dx = entity.pos.x - px;
      const dy = entity.pos.y - py;
      const dist = Math.max(Math.abs(dx), Math.abs(dy));
      if (dist > 0 && dist <= radius) {
        let dir = "";
        if (dy < 0) dir += "N";
        if (dy > 0) dir += "S";
        if (dx > 0) dir += "E";
        if (dx < 0) dir += "W";
        if (!dir) dir = "here";
        results.push({ entity, dist, dir });
      }
    }
    results.sort((a, b) => a.dist - b.dist);
    return results;
  }

  private getObjective(state: GameState): { text: string; detail: string } {
    return getObjectiveShared(state);
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ── Minimap ────────────────────────────────────────────────

  private minimapCanvas: HTMLCanvasElement | null = null;
  private minimapCtx: CanvasRenderingContext2D | null = null;

  private renderMinimap(state: GameState): void {
    if (!this.minimapCanvas) {
      this.minimapCanvas = document.getElementById("minimap-canvas") as HTMLCanvasElement;
      if (this.minimapCanvas) {
        this.minimapCanvas.style.display = "block";
        this.minimapCtx = this.minimapCanvas.getContext("2d");
      }
    }
    if (!this.minimapCtx || !this.minimapCanvas) return;

    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    const scaleX = w / state.width;
    const scaleY = h / state.height;
    const scale = Math.min(scaleX, scaleY);

    ctx.clearRect(0, 0, w, h);

    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const tile = state.tiles[y][x];
        if (!tile.explored) continue;

        const px = Math.floor(x * scale);
        const py = Math.floor(y * scale);
        const pw = Math.max(1, Math.ceil(scale));
        const ph = Math.max(1, Math.ceil(scale));

        if (tile.type === TileType.Wall) {
          ctx.fillStyle = tile.visible ? "#556677" : "#334455";
        } else if (tile.type === TileType.Door || tile.type === TileType.LockedDoor) {
          ctx.fillStyle = tile.type === TileType.LockedDoor ? "#aa3333" : "#997744";
        } else if (tile.walkable) {
          if (tile.heat > 50) {
            ctx.fillStyle = "#aa3300"; // dangerous heat — bright red-orange
          } else if (tile.heat > 25) {
            ctx.fillStyle = "#774400"; // moderate heat — amber
          } else if (tile.smoke > 40) {
            ctx.fillStyle = "#444433"; // heavy smoke — murky
          } else if (tile.pressure < 40) {
            ctx.fillStyle = "#3344aa"; // vacuum — bright blue
          } else if (tile.pressure < 70) {
            ctx.fillStyle = "#223366"; // low pressure — dark blue
          } else {
            ctx.fillStyle = tile.visible ? "#445544" : "#223322";
          }
        } else {
          continue;
        }
        ctx.fillRect(px, py, pw, ph);
      }
    }

    // Entities as colored dots — larger for important types
    const now = performance.now() / 1000;
    for (const [id, entity] of state.entities) {
      if (id === "player") continue;
      const tx = state.tiles[entity.pos.y]?.[entity.pos.x];
      if (!tx?.explored) continue;
      const color = ENTITY_COLORS_CSS[entity.type] || "#888";
      const px = Math.floor(entity.pos.x * scale);
      const py = Math.floor(entity.pos.y * scale);

      // Breach entities pulse red as warning
      if (entity.type === EntityType.Breach) {
        const pulse = 0.5 + Math.sin(now * 4 + entity.pos.x) * 0.5;
        const r = Math.round(255 * pulse);
        ctx.fillStyle = `rgb(${r}, 30, 0)`;
        ctx.fillRect(px - 2, py - 2, 5, 5);
        continue;
      }

      // Important entities get bigger dots
      const isLarge = entity.type === EntityType.DataCore || entity.type === EntityType.EscapePod ||
                      entity.type === EntityType.CrewNPC;
      const dotSize = isLarge ? 4 : 3;
      const offset = Math.floor(dotSize / 2);
      ctx.fillStyle = color;
      ctx.fillRect(px - offset, py - offset, dotSize, dotSize);
    }

    // Room boundary outlines for readability
    for (const room of state.rooms) {
      const rcx = room.x + Math.floor(room.width / 2);
      const rcy = room.y + Math.floor(room.height / 2);
      if (rcy >= 0 && rcy < state.height && rcx >= 0 && rcx < state.width && state.tiles[rcy][rcx].explored) {
        const rx = Math.floor(room.x * scale);
        const ry = Math.floor(room.y * scale);
        const rw = Math.ceil(room.width * scale);
        const rh = Math.ceil(room.height * scale);
        const tint = ROOM_WALL_TINTS_3D[room.name];
        if (tint) {
          const tr = (tint >> 16) & 0xff;
          const tg = (tint >> 8) & 0xff;
          const tb = tint & 0xff;
          ctx.strokeStyle = `rgba(${tr}, ${tg}, ${tb}, 0.6)`;
        } else {
          ctx.strokeStyle = "rgba(100, 120, 140, 0.4)";
        }
        ctx.lineWidth = 1;
        ctx.strokeRect(rx, ry, rw, rh);
      }
    }

    // Player: bright green dot with white border, larger
    const ppx = Math.floor(state.player.entity.pos.x * scale);
    const ppy = Math.floor(state.player.entity.pos.y * scale);
    ctx.fillStyle = "#44ff88";
    ctx.fillRect(ppx - 3, ppy - 3, 7, 7);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(ppx - 3, ppy - 3, 7, 7);
  }

  // ── Starfield background ─────────────────────────────────────

  private createStarfield(): void {
    // Nebula backdrop: a large gradient plane below the station
    const nebulaGeo = new THREE.PlaneGeometry(120, 120);
    nebulaGeo.rotateX(-Math.PI / 2);
    const nebulaMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        void main() {
          // Dark space gradient with subtle color variation
          vec2 p = vUv - 0.5;
          float dist = length(p);
          // Deep blue to purple gradient
          vec3 col = mix(
            vec3(0.02, 0.03, 0.08),  // dark blue
            vec3(0.06, 0.02, 0.10),  // dark purple
            smoothstep(0.0, 0.7, dist)
          );
          // Subtle nebula swirl
          float swirl = sin(p.x * 3.0 + p.y * 2.0 + uTime * 0.1) * 0.015;
          col += vec3(swirl * 0.5, swirl * 0.3, swirl);
          float alpha = smoothstep(0.7, 0.0, dist) * 0.4;
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    const nebulaMesh = new THREE.Mesh(nebulaGeo, nebulaMat);
    nebulaMesh.position.y = -8;
    nebulaMesh.renderOrder = -2;
    this.scene.add(nebulaMesh);

    const starCount = 400;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      // Spread stars in a large dome below the station
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.5; // hemisphere below
      const radius = 40 + Math.random() * 60;
      positions[i * 3] = Math.cos(theta) * Math.sin(phi) * radius;
      positions[i * 3 + 1] = -5 - Math.random() * 30; // below the floor
      positions[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * radius;

      // Star colors: mostly white, some blue, some warm
      const temp = Math.random();
      if (temp < 0.7) {
        colors[i * 3] = 0.9; colors[i * 3 + 1] = 0.9; colors[i * 3 + 2] = 1.0;
      } else if (temp < 0.85) {
        colors[i * 3] = 0.6; colors[i * 3 + 1] = 0.7; colors[i * 3 + 2] = 1.0;
      } else {
        colors[i * 3] = 1.0; colors[i * 3 + 1] = 0.85; colors[i * 3 + 2] = 0.7;
      }

      sizes[i] = 0.05 + Math.random() * 0.15;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    starGeo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const starMat = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
      depthWrite: false,
    });

    this.starfieldPoints = new THREE.Points(starGeo, starMat);
    this.starfieldPoints.renderOrder = -1; // render behind everything
    this.scene.add(this.starfieldPoints);
  }

  // ── Ambient dust particles ───────────────────────────────────

  private createDustParticles(): void {
    const dustCount = 80;
    const positions = new Float32Array(dustCount * 3);

    for (let i = 0; i < dustCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = Math.random() * 3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }

    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const dustMat = new THREE.PointsMaterial({
      size: 0.04,
      color: 0xaabbcc,
      transparent: true,
      opacity: 0.3,
      sizeAttenuation: true,
      depthWrite: false,
    });

    this.dustParticles = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.dustParticles);
  }

  // ── Player movement trail ──────────────────────────────────

  private createMovementTrail(): void {
    const count = BrowserDisplay3D.TRAIL_LENGTH;
    this.trailPositions = new Float32Array(count * 3);
    this.trailOpacities = new Float32Array(count);

    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute("position", new THREE.BufferAttribute(this.trailPositions, 3));

    const trailMat = new THREE.PointsMaterial({
      size: 0.08,
      color: 0x44ff88,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
      depthWrite: false,
    });

    this.trailPoints = new THREE.Points(trailGeo, trailMat);
    this.trailPoints.renderOrder = 1;
    this.scene.add(this.trailPoints);
  }

  private lastTrailX: number = -999;
  private lastTrailZ: number = -999;
  private trailHead: number = 0;

  private updateTrail(px: number, pz: number, delta: number): void {
    if (!this.trailPoints) return;

    // Record a new trail point when player moves enough
    const dx = px - this.lastTrailX;
    const dz = pz - this.lastTrailZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist > 0.3) {
      this.lastTrailX = px;
      this.lastTrailZ = pz;

      const count = BrowserDisplay3D.TRAIL_LENGTH;
      const idx = this.trailHead % count;
      this.trailPositions[idx * 3] = px;
      this.trailPositions[idx * 3 + 1] = 0.05;
      this.trailPositions[idx * 3 + 2] = pz;
      this.trailOpacities[idx] = 1.0;
      this.trailHead++;
    }

    // Fade all trail points
    const count = BrowserDisplay3D.TRAIL_LENGTH;
    for (let i = 0; i < count; i++) {
      this.trailOpacities[i] = Math.max(0, this.trailOpacities[i] - delta * 0.5);
      // Move faded points below floor so they're invisible
      if (this.trailOpacities[i] <= 0) {
        this.trailPositions[i * 3 + 1] = -10;
      }
    }

    this.trailPoints.geometry.attributes.position.needsUpdate = true;
  }

  // ── Animate particles ────────────────────────────────────────

  private animateParticles(elapsed: number, delta: number): void {
    // Dust motes: slowly drift and follow camera center
    if (this.dustParticles) {
      const posArr = this.dustParticles.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < posArr.length; i += 3) {
        // Slow upward drift + gentle swirl
        posArr[i] += Math.sin(elapsed * 0.3 + i) * delta * 0.1;
        posArr[i + 1] += delta * 0.05;
        posArr[i + 2] += Math.cos(elapsed * 0.2 + i * 0.7) * delta * 0.1;

        // Wrap particles to stay near camera
        if (posArr[i + 1] > 3) posArr[i + 1] = 0;
      }
      this.dustParticles.geometry.attributes.position.needsUpdate = true;

      // Keep dust centered on camera target
      this.dustParticles.position.set(this.cameraPosX, 0, this.cameraPosZ);
    }

    // Starfield: subtle twinkle by varying opacity
    if (this.starfieldPoints) {
      const mat = this.starfieldPoints.material as THREE.PointsMaterial;
      mat.opacity = 0.4 + Math.sin(elapsed * 0.5) * 0.2;
      // Keep starfield centered on camera
      this.starfieldPoints.position.set(this.cameraPosX, 0, this.cameraPosZ);
    }
  }
}
