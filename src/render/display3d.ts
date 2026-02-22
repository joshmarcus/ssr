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

  // Bright base — instance color multiplies through this, so lighter = brighter floors
  ctx.fillStyle = "#eeeeee";
  ctx.fillRect(0, 0, size, size);

  // Outer panel edge — white highlight
  ctx.strokeStyle = "#f4f4f4";
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, size - 2, size - 2);

  // Corner accents — subtle blue highlight
  ctx.strokeStyle = "#ddeeff";
  ctx.lineWidth = 2;
  const c = 8;
  ctx.beginPath();
  ctx.moveTo(0, c); ctx.lineTo(0, 0); ctx.lineTo(c, 0);
  ctx.moveTo(size - c, 0); ctx.lineTo(size, 0); ctx.lineTo(size, c);
  ctx.moveTo(size, size - c); ctx.lineTo(size, size); ctx.lineTo(size - c, size);
  ctx.moveTo(c, size); ctx.lineTo(0, size); ctx.lineTo(0, size - c);
  ctx.stroke();

  // Subtle inner seam
  ctx.strokeStyle = "#cccccc";
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

/** Create a wall panel texture — vertical panels with rivets and horizontal seam */
function createWallPanelTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size * 2; // taller for walls (2:1 ratio)
  const ctx = canvas.getContext("2d")!;

  // Light base
  ctx.fillStyle = "#e8e8e8";
  ctx.fillRect(0, 0, size, size * 2);

  // Vertical panel groove
  ctx.strokeStyle = "#cccccc";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(size / 2, 2);
  ctx.lineTo(size / 2, size * 2 - 2);
  ctx.stroke();

  // Horizontal seam at 1/3 height
  ctx.strokeStyle = "#cccccc";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(2, Math.floor(size * 2 / 3));
  ctx.lineTo(size - 2, Math.floor(size * 2 / 3));
  ctx.stroke();

  // Top/bottom border trim
  ctx.strokeStyle = "#d0d8e0";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, size, size * 2);

  // Corner rivets
  ctx.fillStyle = "#aabbcc";
  const offsets = [[4, 4], [size - 5, 4], [4, size * 2 - 5], [size - 5, size * 2 - 5]];
  for (const [rx, ry] of offsets) {
    ctx.beginPath();
    ctx.arc(rx, ry, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle ventilation slits in upper panel
  ctx.strokeStyle = "#bbbbbb";
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const sy = 12 + i * 8;
    ctx.beginPath();
    ctx.moveTo(size * 0.2, sy);
    ctx.lineTo(size * 0.45, sy);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Create a corridor grate texture — metal grid pattern distinct from room floors */
function createCorridorGrateTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  // Slightly darker base for corridors
  ctx.fillStyle = "#d8d8d8";
  ctx.fillRect(0, 0, size, size);

  // Grate cross pattern
  ctx.strokeStyle = "#bbbbbb";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y = 8 + i * 16;
    ctx.beginPath();
    ctx.moveTo(2, y);
    ctx.lineTo(size - 2, y);
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    const x = 8 + i * 16;
    ctx.beginPath();
    ctx.moveTo(x, 2);
    ctx.lineTo(x, size - 2);
    ctx.stroke();
  }

  // Outer border
  ctx.strokeStyle = "#c0c0c0";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, size, size);

  // Center drain dot
  ctx.fillStyle = "#999999";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 3, 0, Math.PI * 2);
  ctx.fill();

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
    60,   // shadow (brighter for cel-shaded look)
    150,  // mid shadow
    220,  // lit
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
  floor: 0xcccccc,     // bright cel-shaded floor
  wall: 0xddeeee,      // bright walls
  door: 0xeeaa55,
  lockedDoor: 0xff5555,
  corridor: 0xbbbbbb,   // bright corridors
  background: 0x060610,
  player: 0x00ff00,
  fogFull: 0x0a0a1a,    // dark navy instead of pure black
  fogMemory: 0x2a2a44,  // visible blue-grey memory tint
} as const;

// How many world-units tall the visible area is (zoom level)
const CAMERA_FRUSTUM_SIZE_DEFAULT = 3.0; // start zoomed in close for detail
const CAMERA_FRUSTUM_SIZE_MIN = 1.5;    // max zoom in (very close detail view)
const CAMERA_FRUSTUM_SIZE_MAX = 12;     // max zoom out

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

// Room wall tints — vibrant cel-shaded color identity per zone (bright!)
const ROOM_WALL_TINTS_3D: Record<string, number> = {
  "Engineering Storage": 0xeedd99,   // warm industrial amber
  "Power Relay Junction": 0xffee88,  // electric yellow
  "Engine Core": 0xffbb66,           // hot orange
  "Life Support": 0x99ddff,          // cool medical blue
  "Vent Control Room": 0xaaccee,     // duct steel blue
  "Communications Hub": 0x99bbff,    // comm blue
  "Research Lab": 0x99eebb,          // lab green
  "Med Bay": 0xffaacc,              // medical pink-red
  "Data Core": 0xdd99ff,            // data purple
  "Robotics Bay": 0xccdddd,         // metallic grey-teal
  "Bridge": 0xbbccee,              // command blue-grey
  "Observation Deck": 0xaaddee,     // sky viewport blue
  "Escape Pod Bay": 0x99ffcc,       // emergency green
  "Auxiliary Power": 0xeedd88,       // power amber
  "Signal Room": 0x99aaff,          // signal deep blue
  "Server Annex": 0xdd99ff,         // server violet
  "Armory": 0xff9999,              // danger red
  "Emergency Shelter": 0xaaeebb,    // safe green
  "Cargo Hold": 0xeecc88,          // cargo warm brown
  "Crew Quarters": 0xeeddaa,        // residential warm gold
  "Arrival Bay": 0xaaddcc,          // teal arrival
  "Maintenance Corridor": 0xccddcc, // utility grey-green
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
  [EntityType.MedKit]: "models/Items/GLTF/Pickup_Health.gltf",
  [EntityType.CrewItem]: "models/synty-space-gltf/SM_Prop_Detail_Box_01.glb",
  [EntityType.ClosedDoor]: "models/synty-space-gltf/SM_Bld_Wall_Doorframe_01.glb",
  [EntityType.RepairBot]: "models/synty-space-gltf/SM_Veh_Drone_Repair_01.glb",
  [EntityType.Drone]: "models/synty-space-gltf/SM_Veh_Drone_Attach_01.glb",
  [EntityType.PatrolDrone]: "models/Characters/GLTF/Enemy_ExtraSmall.gltf",
  [EntityType.EscapePod]: "models/synty-space-gltf/SM_Veh_EscapePod_Large_01.glb",
  [EntityType.CrewNPC]: "models/synty-space-gltf/SK_Chr_Crew_Male_01.glb",
  [EntityType.Airlock]: "models/kenney-space/gate-door.glb",
  [EntityType.ToolPickup]: "models/Items/GLTF/Pickup_Crate.gltf",
  [EntityType.UtilityPickup]: "models/Items/GLTF/Pickup_Thunder.gltf",
  [EntityType.Console]: "models/synty-space-gltf/SM_Bld_Bridge_Console_01.glb",
  [EntityType.RepairCradle]: "models/synty-space-gltf/SM_Prop_CryoBed_01.glb",
  [EntityType.PressureValve]: "models/synty-space-gltf/SM_Prop_AirVent_Small_01.glb",
  [EntityType.FuseBox]: "models/synty-space-gltf/SM_Prop_Panel_01.glb",
  [EntityType.PowerCell]: "models/synty-space-gltf/SM_Prop_Battery_02.glb",
  [EntityType.Breach]: "models/synty-space-gltf/SM_Prop_Wires_01.glb",
  // EvidenceTrace uses procedural ? mesh (no GLTF — more distinctive)
};

// Crew NPC model variants — different models for visual variety
const CREW_MODEL_VARIANTS = [
  "models/synty-space-gltf/SK_Chr_Crew_Male_01.glb",
  "models/synty-space-gltf/SK_Chr_Crew_Female_01.glb",
  "models/synty-space-gltf/SK_Chr_CrewCaptain_Male_01.glb",
  "models/synty-space-gltf/SK_Chr_CrewCaptain_Female_01.glb",
  "models/synty-space-gltf/SK_Chr_Medic_Male_01.glb",
];

// ── BrowserDisplay3D ─────────────────────────────────────────────
export class BrowserDisplay3D implements IGameDisplay {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera | THREE.PerspectiveCamera;
  private orthoCamera: THREE.OrthographicCamera;
  private chaseCamera: THREE.PerspectiveCamera;
  private chaseCamActive: boolean = true; // default to chase cam
  private chaseCamPosX: number = 0;
  private chaseCamPosY: number = 1.8;
  private chaseCamPosZ: number = 0;
  private chaseCamLookX: number = 0;
  private chaseCamLookZ: number = 0;
  private mapWidth: number;
  private mapHeight: number;

  // Lighting
  private playerLight: THREE.PointLight;
  private _fillLight!: THREE.PointLight;
  private headlight: THREE.SpotLight | null = null;
  private headlightTarget: THREE.Object3D | null = null;

  // Tile instanced meshes
  private floorMesh: THREE.InstancedMesh;      // room floors
  private corridorFloorMesh: THREE.InstancedMesh; // corridor floors (grate texture)
  private wallMesh: THREE.InstancedMesh;
  private wallCornerMesh: THREE.InstancedMesh;
  private doorMesh: THREE.InstancedMesh;
  private ceilingMesh: THREE.InstancedMesh;    // ceiling panels above explored tiles
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
  // Player damage state for visual effects
  private _playerHpPercent: number = 1.0; // 0-1 range
  private _playerStunned: boolean = false;

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
  private roomLightBoost: number = 0; // >0 = room entry light boost (decays over time)

  // Room-focused rendering: only show current room + connecting corridors
  private _visibleRoomIds: Set<string> = new Set();
  private _currentRoom: Room | null = null;
  private _roomTransitionFade: number = 0; // 1.0 = full black, fades to 0
  private static readonly CORRIDOR_VIEW_RANGE = 5; // tiles of corridor visible from player
  private _corridorDimFactor: number = 1.0; // ambient light dimming (1.0 = full, 0.35 = corridor)
  private _roomCenterGlow: THREE.PointLight | null = null; // warm glow at current room center
  private cameraFrustumSize: number = CAMERA_FRUSTUM_SIZE_DEFAULT; // current zoom level (mouse wheel adjustable)
  private cameraElevation: number = 0.5; // 0 = top-down, 1 = side-on. Default = mid-angle

  // Room decoration props (placed once per room when explored)
  private decoratedRooms: Set<string> = new Set();
  private decorationGroup: THREE.Group = new THREE.Group();

  // Dummy objects for instance matrix computation
  private dummy = new THREE.Object3D();

  // Tile counts for instanced meshes
  private maxTiles: number;

  // Resize handler
  private resizeHandler: () => void;
  // Mouse wheel zoom handler
  private boundWheelHandler: (e: WheelEvent) => void;
  // F2 chase cam toggle handler
  private boundKeyHandler: (e: KeyboardEvent) => void;

  // Cel-shaded rendering
  private outlineEffect: OutlineEffect;
  private toonGradient: THREE.DataTexture;

  // Room lights (colored point lights at room centers)
  private roomLights: Map<string, THREE.PointLight> = new Map();
  private corridorLitTiles: Set<string> = new Set();
  private corridorDecorTiles: Set<string> = new Set();
  // Corridor lights for flicker animation
  private corridorLightList: THREE.PointLight[] = [];
  // Relay power lines (visible energy beams between activated relays)
  private relayPowerLines: THREE.Line[] = [];
  private relayPowerLineCount: number = 0;
  // Energy dots traveling along relay power lines
  private _relayEnergyDots: { sprite: THREE.Sprite; curve: THREE.QuadraticBezierCurve3; t: number }[] = [];
  // Global scene lights for phase-reactive lighting
  private ambientLight: THREE.AmbientLight | null = null;
  private keyLight: THREE.DirectionalLight | null = null;
  private currentPhase: string = "";
  // 3D waypoint indicator
  private waypointSprite: THREE.Sprite | null = null;
  private waypointTargetX: number = 0;
  private waypointTargetZ: number = 0;
  private waypointVisible: boolean = false;

  // Synty texture atlas (loaded at startup, applied to models that lack embedded textures)
  private syntyAtlas: THREE.Texture | null = null;

  // Particle systems
  private dustParticles: THREE.Points | null = null;
  // Corridor steam vent sprites (pooled)
  private _steamVentSprites: THREE.Sprite[] = [];
  private _steamVentTimer: number = 0;
  // Corridor light shaft meshes (volumetric beams under corridor ceiling lights)
  private _lightShaftMeshes: THREE.Mesh[] = [];
  private _lightShaftTiles: Set<string> = new Set();
  // Floor light pools under corridor lights
  private _floorPoolMeshes: THREE.Mesh[] = [];
  // Footstep dust kick sprites
  private _dustKickSprites: THREE.Sprite[] = [];
  private _dustKickTimer: number = 0;
  // Headlight ground spot (elliptical glow ahead of Sweepo)
  private _headlightSpot: THREE.Mesh | null = null;
  // Corridor breath puff (cold air visualization)
  private _breathPuffSprites: THREE.Sprite[] = [];
  private _breathPuffTimer: number = 0;
  // Vacuum wind particles (drift toward nearest breach)
  private _vacuumWindSprites: THREE.Sprite[] = [];
  private _vacuumWindTimer: number = 0;
  private _playerTilePressure: number = 100;
  private _nearestBreachDir: { x: number; z: number } = { x: 0, z: 0 };
  // Heat shimmer sprites (rising on hot tiles)
  private _heatShimmerSprites: THREE.Sprite[] = [];
  private _heatShimmerTimer: number = 0;
  private _playerTileHeat: number = 0;
  private _playerTileDirt: number = 0;
  private _playerTileSmoke: number = 0;
  // Cleaning sparkle sprites (green sparkles when moving over dirty tiles)
  private _cleanSparkleTimer: number = 0;
  // Smoke wisp sprites (drifting grey wisps on smoky tiles)
  private _smokeWispTimer: number = 0;
  // Damage spark timer (orange sparks shooting from body at low HP)
  private _damageSparkTimer: number = 0;
  // Headlight damage flicker ratio (1.0 = normal, <1.0 when flickering)
  private _headlightFlickerRatio: number = 1.0;
  // Pipe steam leak sprites (small puffs from corridor pipes)
  private _pipeLeakSprites: THREE.Sprite[] = [];
  private _pipeLeakTimer: number = 0;
  // Sweepo eye emotion: widen timer on discovery/interaction
  private _eyeWidenTimer: number = 0;
  // Floating interact indicator sprite
  private _interactIndicator: THREE.Sprite | null = null;
  // DataCore holographic ring
  private _dataCoreHoloRing: THREE.Mesh | null = null;
  // Discovery sparkle: rooms visited this session for first-entry effects
  private _visitedRooms3D: Set<string> = new Set();
  private _discoverySparkles: THREE.Sprite[] = [];
  private starfieldPoints: THREE.Points | null = null;

  // Hazard visual effects (sprites at hazardous tile positions)
  private hazardSprites: THREE.Group = new THREE.Group();
  private hazardSpriteKeys: Set<string> = new Set();

  // Door frame accent lights
  private doorLights: Map<string, THREE.PointLight> = new Map();

  // Door slide animation state (key → slide amount 0..0.9)
  private _doorSlideState: Map<string, number> = new Map();

  // Floating room name labels
  private roomLabels3D: Map<string, THREE.Sprite> = new Map();

  // Entity name labels (shown when player is nearby)
  private entityLabels: Map<string, THREE.Sprite> = new Map();
  private entityLabelCanvas: Map<string, HTMLCanvasElement> = new Map();

  // Caution stripe floor markings near hazardous entities
  private cautionMarkedTiles: Set<string> = new Set();
  private trimGroup: THREE.Group = new THREE.Group();
  private trimmedRooms: Set<string> = new Set();
  private cautionStripeGroup: THREE.Group = new THREE.Group();

  // Corridor overhead pipe runs
  private corridorPipeTiles: Set<string> = new Set();
  private pipeGroup: THREE.Group = new THREE.Group();

  // Ceiling beam structure (cross-beams spanning rooms)
  private ceilingGroup: THREE.Group = new THREE.Group();
  private ceilingRooms: Set<string> = new Set();
  // Room atmospheric haze (colored fog planes per room)
  private hazeRooms: Set<string> = new Set();
  private roomHazeMeshes: Map<string, THREE.Mesh> = new Map();
  // Corridor floor strip lights
  private corridorStripTiles: Set<string> = new Set();
  private static _stripLightGeo: THREE.BoxGeometry | null = null;
  // Corridor arch supports
  private corridorArchTiles: Set<string> = new Set();
  // Shared ceiling geometries
  private static _beamGeoH: THREE.BoxGeometry | null = null;
  private static _beamGeoV: THREE.BoxGeometry | null = null;
  private static _archPostGeo: THREE.BoxGeometry | null = null;
  private static _archSpanGeo: THREE.BoxGeometry | null = null;

  // Distance culling: per-room sub-groups for trim, decorations, ceiling
  private roomTrimGroups: Map<string, THREE.Group> = new Map();
  private roomDecoGroups: Map<string, THREE.Group> = new Map();
  private roomCeilGroups: Map<string, THREE.Group> = new Map();
  // Room center positions for distance culling lookups
  private roomCenters: Map<string, { x: number; z: number }> = new Map();
  // Spatial buckets for corridor elements (pipes, arches, strip lights)
  private corridorBuckets: Map<string, THREE.Group> = new Map();
  private static readonly CULL_DISTANCE = 12; // manhattan distance in tiles
  private static readonly CORRIDOR_BUCKET_SIZE = 6; // tiles per bucket
  private _cullFrame: number = 0;
  // Outline effect toggle
  private outlineEnabled: boolean = true;

  // InstancedMesh for trim elements (baseboard, edge glow, top rail)
  private trimBBInstanced: THREE.InstancedMesh | null = null;
  private trimGlowInstanced: THREE.InstancedMesh | null = null;
  private trimRailInstanced: THREE.InstancedMesh | null = null;
  private trimInstanceIdx: number = 0;
  // InstancedMesh for corridor strip lights (bright / dim)
  private stripBrightInstanced: THREE.InstancedMesh | null = null;
  private stripDimInstanced: THREE.InstancedMesh | null = null;
  private stripBrightIdx: number = 0;
  private stripDimIdx: number = 0;
  private static readonly MAX_TRIM_INSTANCES = 2000;
  private static readonly MAX_STRIP_INSTANCES = 600;
  // InstancedMesh for emergency wall light strips (red/amber near hazards)
  private emergencyStripInstanced: THREE.InstancedMesh | null = null;
  private emergencyStripIdx: number = 0;
  private static readonly MAX_EMERGENCY_STRIPS = 400;
  private emergencyStripTiles: Set<string> = new Set();

  // Player movement trail
  private trailPoints: THREE.Points | null = null;
  private trailPositions: Float32Array = new Float32Array(0);
  private trailOpacities: Float32Array = new Float32Array(0);
  private static readonly TRAIL_LENGTH = 12;

  // Cached tile walkability for chase cam wall avoidance (updated each render)
  private _tileWalkable: boolean[][] = [];
  private _tileWidth: number = 0;
  private _tileHeight: number = 0;

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
    // Enable shadow maps for dramatic headlight shadows
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Add mode-3d class to game container for CSS
    document.getElementById("game-container")?.classList.add("mode-3d");

    // ── Scene ──
    this.scene = new THREE.Scene();
    this.scene.background = this.createStarfieldTexture();
    // Atmospheric fog — subtle fade at the far edges only
    this.scene.fog = new THREE.Fog(COLORS_3D.background, 20, 40);

    // ── Camera (orthographic, zoomed-in, follows player) ──
    const aspect = this.getAspect();
    const frustumHeight = this.cameraFrustumSize;
    const frustumWidth = frustumHeight * aspect;
    this.orthoCamera = new THREE.OrthographicCamera(
      -frustumWidth / 2, frustumWidth / 2,
      frustumHeight / 2, -frustumHeight / 2,
      0.1, 200
    );
    // Low-angle offset: camera sits behind and slightly above for drama
    // Will be repositioned each frame to follow the player
    this.orthoCamera.position.set(0, 8, 12);
    this.orthoCamera.lookAt(0, 0, 0);

    // ── Chase camera (3rd person, behind Sweepo) ──
    this.chaseCamera = new THREE.PerspectiveCamera(60, aspect, 0.1, 100);
    this.chaseCamera.position.set(0, 2, 3);
    this.chaseCamera.lookAt(0, 0, 0);

    // Default to chase cam (F2 toggles)
    this.camera = this.chaseCamera;

    // ── Cel-shading: Outline Effect ──
    this.toonGradient = createToonGradient();
    this.outlineEffect = new OutlineEffect(this.renderer, {
      defaultThickness: 0.003,
      defaultColor: [0, 0, 0],
      defaultAlpha: 0.8,
    });

    // ── Lights (cel-shaded bright — vibrant toon look, well-lit scene) ──
    const ambient = new THREE.AmbientLight(0xccddff, 3.2);
    this.scene.add(ambient);
    this.ambientLight = ambient;

    // Strong key light — warm directional from upper-left
    const dirLight = new THREE.DirectionalLight(0xffeedd, 2.8);
    dirLight.position.set(-8, 15, -5);
    this.scene.add(dirLight);
    this.keyLight = dirLight;

    // Cool fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0x88aadd, 1.6);
    fillLight.position.set(8, 10, 5);
    this.scene.add(fillLight);

    // Rim light from behind for depth — strong cel-shaded pop
    const rimLight = new THREE.DirectionalLight(0xbbbbff, 1.0);
    rimLight.position.set(0, 5, 15);
    this.scene.add(rimLight);

    // Hemisphere light for natural sky/ground fill
    const hemiLight = new THREE.HemisphereLight(0xccddff, 0x446688, 0.6);
    this.scene.add(hemiLight);

    this.playerLight = new THREE.PointLight(0x44ff66, 3.0, 22);
    this.playerLight.position.set(0, 3, 0);
    this.scene.add(this.playerLight);

    // Secondary fill light at lower height for chase cam corridor illumination
    this._fillLight = new THREE.PointLight(0xffffff, 0.8, 10);
    this._fillLight.position.set(0, 1.2, 0);
    this.scene.add(this._fillLight);

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
    this.floorMesh.receiveShadow = true;
    this.floorMesh.count = 0;
    this.scene.add(this.floorMesh);

    // Corridor floors: different grate texture for visual distinction
    const corridorFloorGeo = new THREE.BoxGeometry(1, 0.08, 1);
    corridorFloorGeo.translate(0, -0.04, 0);
    const corridorGrateTex = createCorridorGrateTexture();
    const corridorFloorMat = makeToonMaterial({ color: 0xffffff, gradientMap: this.toonGradient, map: corridorGrateTex });
    this.corridorFloorMesh = new THREE.InstancedMesh(corridorFloorGeo, corridorFloorMat, this.maxTiles);
    this.corridorFloorMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.corridorFloorMesh.frustumCulled = false;
    this.corridorFloorMesh.receiveShadow = true;
    this.corridorFloorMesh.count = 0;
    this.scene.add(this.corridorFloorMesh);

    const wallGeo = new THREE.BoxGeometry(1, 2.0, 1);
    const wallPanelTex = createWallPanelTexture();
    const wallMat = makeToonMaterial({ color: 0xffffff, gradientMap: this.toonGradient, map: wallPanelTex });
    this.wallMesh = new THREE.InstancedMesh(wallGeo, wallMat, this.maxTiles);
    this.wallMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wallMesh.frustumCulled = false;
    this.wallMesh.receiveShadow = true;
    this.wallMesh.castShadow = true;
    this.wallMesh.count = 0;
    this.scene.add(this.wallMesh);

    // Corner walls (placeholder geo, replaced when model loads)
    const cornerGeo = new THREE.BoxGeometry(1, 2.0, 1);
    const cornerMat = makeToonMaterial({ color: 0xffffff, gradientMap: this.toonGradient });
    this.wallCornerMesh = new THREE.InstancedMesh(cornerGeo, cornerMat, this.maxTiles);
    this.wallCornerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wallCornerMesh.frustumCulled = false;
    this.wallCornerMesh.castShadow = true;
    this.wallCornerMesh.receiveShadow = true;
    this.wallCornerMesh.count = 0;
    this.scene.add(this.wallCornerMesh);

    const doorGeo = new THREE.BoxGeometry(0.42, 2.0, 0.15); // half-width panel — two halves per door
    const doorMat = makeToonMaterial({ color: 0xffffff, gradientMap: this.toonGradient });
    this.doorMesh = new THREE.InstancedMesh(doorGeo, doorMat, 400); // 2 halves per door
    this.doorMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.doorMesh.frustumCulled = false;
    this.doorMesh.castShadow = true;
    this.doorMesh.receiveShadow = true;
    this.doorMesh.count = 0;
    this.scene.add(this.doorMesh);

    // Ceiling panels — dark metallic planes at wall-top height above explored floor/corridor tiles
    const ceilGeo = new THREE.PlaneGeometry(1.0, 1.0);
    ceilGeo.rotateX(Math.PI / 2); // face downward
    const ceilMat = makeToonMaterial({
      color: 0x334455,
      gradientMap: this.toonGradient,
    });
    this.ceilingMesh = new THREE.InstancedMesh(ceilGeo, ceilMat, this.maxTiles);
    this.ceilingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ceilingMesh.frustumCulled = false;
    this.ceilingMesh.receiveShadow = true;
    this.ceilingMesh.count = 0;
    this.scene.add(this.ceilingMesh);
    this.ceilingMesh.visible = this.chaseCamActive; // only show ceiling in chase cam

    // Fog-of-war overlays — dark navy with slight translucency
    const fogGeo = new THREE.PlaneGeometry(1, 1);
    fogGeo.rotateX(-Math.PI / 2);
    const fogFullMat = new THREE.MeshBasicMaterial({
      color: COLORS_3D.fogFull,
      transparent: true,
      opacity: 0.92,
    });
    this.fogFullMesh = new THREE.InstancedMesh(fogGeo, fogFullMat, this.maxTiles);
    this.fogFullMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fogFullMesh.frustumCulled = false;
    this.fogFullMesh.count = 0;
    this.scene.add(this.fogFullMesh);

    const fogMemGeo = new THREE.PlaneGeometry(1, 1);
    fogMemGeo.rotateX(-Math.PI / 2);
    const fogMemMat = new THREE.MeshBasicMaterial({
      color: COLORS_3D.fogMemory,
      transparent: true,
      opacity: 0.45,
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

    // ── Architectural trim group (baseboards, door frames) ──
    this.scene.add(this.trimGroup);

    // ── Hazard visual effects group ──
    this.scene.add(this.hazardSprites);

    // ── Caution stripe markings and corridor pipes ──
    this.scene.add(this.cautionStripeGroup);
    this.scene.add(this.pipeGroup);

    // ── Ceiling beam structure (cross-beams + light fixtures) ──
    this.scene.add(this.ceilingGroup);

    // ── InstancedMesh for trim and strip lights (massive draw call reduction) ──
    this.initTrimInstances();
    this.initStripInstances();

    // ── Starfield background (distant stars visible through station gaps) ──
    this.createStarfield();

    // ── Ambient dust particles (floating motes near the camera) ──
    this.createDustParticles();

    // ── Player movement trail ──
    this.createMovementTrail();

    // ── 3D waypoint indicator (floating arrow pointing to objective) ──
    this.createWaypointIndicator();

    // ── Player mesh (green cylinder + antenna box) ──
    this.playerMesh = this.createPlayerMesh();
    // Sweepo casts shadows from directional/room lights
    this.playerMesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    this.scene.add(this.playerMesh);

    // ── Resize ──
    this.resizeHandler = () => this.handleResize();
    window.addEventListener("resize", this.resizeHandler);
    this.handleResize();

    // ── Mouse wheel zoom ──
    this.boundWheelHandler = this.handleWheel.bind(this);
    this.container.addEventListener("wheel", this.boundWheelHandler, { passive: false });

    // ── F2 chase cam toggle ──
    this.boundKeyHandler = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        this.chaseCamActive = !this.chaseCamActive;
        this.camera = this.chaseCamActive ? this.chaseCamera : this.orthoCamera;
        this.ceilingMesh.visible = this.chaseCamActive;
        if (this.chaseCamActive) {
          // Initialize chase cam position to current player position to avoid snap
          const facing = this.playerFacing;
          this.chaseCamPosX = this.playerCurrentX - Math.sin(facing) * 2.5;
          this.chaseCamPosZ = this.playerCurrentZ - Math.cos(facing) * 2.5;
          this.chaseCamPosY = 1.8;
          this.chaseCamLookX = this.playerCurrentX + Math.sin(facing) * 2.0;
          this.chaseCamLookZ = this.playerCurrentZ + Math.cos(facing) * 2.0;
        }
        this.handleResize();
      } else if (e.key === "F4") {
        e.preventDefault();
        this.outlineEnabled = !this.outlineEnabled;
      }
    };
    window.addEventListener("keydown", this.boundKeyHandler);

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
    const px = this.playerCurrentX, pz = this.playerCurrentZ;

    // Primary scan ring
    const ringGeo = new THREE.RingGeometry(0.1, 0.3, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: waveColor, transparent: true, opacity: 0.6,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(px, 0.1, pz);
    this.scene.add(ring);

    // Secondary trailing ring (thinner, delayed)
    const ring2Geo = new THREE.RingGeometry(0.05, 0.15, 32);
    ring2Geo.rotateX(-Math.PI / 2);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: waveColor, transparent: true, opacity: 0.4,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.position.set(px, 0.15, pz);
    this.scene.add(ring2);

    // Vertical column flash at player position
    const colGeo = new THREE.CylinderGeometry(0.15, 0.15, 2.5, 8, 1, true);
    const colMat = new THREE.MeshBasicMaterial({
      color: waveColor, transparent: true, opacity: 0.3,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const col = new THREE.Mesh(colGeo, colMat);
    col.position.set(px, 1.25, pz);
    this.scene.add(col);

    // Scan grid ripple — glowing grid squares appear in scan wave's wake
    const gridSquares: THREE.Mesh[] = [];
    const scanRadius = 6;
    for (let gx = -scanRadius; gx <= scanRadius; gx++) {
      for (let gz = -scanRadius; gz <= scanRadius; gz++) {
        const dist = Math.abs(gx) + Math.abs(gz);
        if (dist > scanRadius || dist < 1) continue;
        // Only place on ~40% of tiles for variety
        if (((Math.floor(px) + gx) * 17 + (Math.floor(pz) + gz) * 31) % 5 > 1) continue;
        const sqGeo = new THREE.PlaneGeometry(0.7, 0.7);
        sqGeo.rotateX(-Math.PI / 2);
        const sqMat = new THREE.MeshBasicMaterial({
          color: waveColor, transparent: true, opacity: 0,
          depthWrite: false, blending: THREE.AdditiveBlending,
        });
        const sq = new THREE.Mesh(sqGeo, sqMat);
        sq.position.set(Math.floor(px) + gx + 0.5, 0.02, Math.floor(pz) + gz + 0.5);
        (sq as any)._dist = dist;
        this.scene.add(sq);
        gridSquares.push(sq);
      }
    }

    const startTime = this.clock.getElapsedTime();
    const duration = 1.5;
    const animateWave = () => {
      const t = (this.clock.getElapsedTime() - startTime) / duration;
      if (t >= 1) {
        this.scene.remove(ring);
        this.scene.remove(ring2);
        this.scene.remove(col);
        ringGeo.dispose(); ringMat.dispose();
        ring2Geo.dispose(); ring2Mat.dispose();
        colGeo.dispose(); colMat.dispose();
        for (const sq of gridSquares) {
          this.scene.remove(sq);
          (sq.geometry as THREE.BufferGeometry).dispose();
          (sq.material as THREE.MeshBasicMaterial).dispose();
        }
        return;
      }
      // Primary ring expands fast
      const scale1 = 1 + t * 15;
      ring.scale.set(scale1, 1, scale1);
      ringMat.opacity = 0.6 * (1 - t * t);

      // Secondary ring trails behind (delayed by 0.15)
      const t2 = Math.max(0, t - 0.15);
      const scale2 = 1 + t2 * 12;
      ring2.scale.set(scale2, 1, scale2);
      ring2Mat.opacity = 0.4 * (1 - t2 * t2);

      // Column fades out quickly
      colMat.opacity = 0.3 * Math.max(0, 1 - t * 3);

      // Grid squares: appear as wave passes, then fade
      for (const sq of gridSquares) {
        const sqDist = (sq as any)._dist as number;
        const wavePos = t * (scanRadius + 2); // wave front position
        const sqT = wavePos - sqDist; // time since wave passed this tile
        if (sqT < 0) {
          (sq.material as THREE.MeshBasicMaterial).opacity = 0;
        } else if (sqT < 0.5) {
          // Appear: quick flash
          (sq.material as THREE.MeshBasicMaterial).opacity = 0.2 * (1 - sqT * 2);
        } else {
          (sq.material as THREE.MeshBasicMaterial).opacity = 0;
        }
      }

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

    // Update room-focused rendering state
    this._currentRoom = room;
    this.computeVisibleRooms(state);

    if (roomId && roomId !== this.lastRoomId) {
      this.roomFlashMessage = room!.name;
      if (this.roomFlashTimer) clearTimeout(this.roomFlashTimer);

      // Trigger camera zoom pulse for room transition
      this.cameraZoomPulse = 1.0;
      // Room light boost — "lights come on" effect
      this.roomLightBoost = 1.5;
      // Room transition fade — brief darken then brighten
      this._roomTransitionFade = 0.6;

      // Room-type visual signature: brief tinted flash on entry
      this.triggerRoomSignature(room!.name);

      // Discovery sparkle: first-time room entry spawns sparkle particles
      if (!this._visitedRooms3D.has(roomId)) {
        this._visitedRooms3D.add(roomId);
        const cx = room!.x + room!.width / 2;
        const cy = room!.y + room!.height / 2;
        const tint = ROOM_WALL_TINTS_3D[room!.name] ?? 0xeeffff;
        for (let si = 0; si < 12; si++) {
          const angle = (si / 12) * Math.PI * 2;
          const radius = 0.5 + Math.random() * (Math.min(room!.width, room!.height) / 2);
          const sx = cx + Math.cos(angle) * radius;
          const sz = cy + Math.sin(angle) * radius;
          const sparkMat = new THREE.SpriteMaterial({
            color: tint, transparent: true, opacity: 0.6,
            depthWrite: false, blending: THREE.AdditiveBlending,
          });
          const spark = new THREE.Sprite(sparkMat);
          spark.scale.set(0.08, 0.08, 1);
          spark.position.set(sx, 0.3 + Math.random() * 0.8, sz);
          (spark as any)._life = 0;
          (spark as any)._maxLife = 0.6 + Math.random() * 0.6;
          (spark as any)._driftY = 0.3 + Math.random() * 0.5;
          this.scene.add(spark);
          this._discoverySparkles.push(spark);
        }
      }

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
    } else if (!roomId && this.lastRoomId) {
      // Room → corridor exit: brief darkness pulse as "lights left behind"
      this._roomTransitionFade = 0.35;
      // Quick corridor FOV tighten — zoom pulse inward
      this.cameraZoomPulse = -0.5; // negative = zoom in slightly
    }
    this.lastRoomId = roomId;
  }

  flashTile(x: number, y: number, _color?: string): void {
    // Sweepo eye widen on interaction
    this._eyeWidenTimer = 0.5;
    // 3D interaction flash: expanding ring + particle burst
    // Determine ring color from entity at this position (if any)
    let flashColor = 0x44ff88; // default green
    let particleColor = 0x66ffaa;
    for (const [, mesh] of this.entityMeshes) {
      if (Math.abs(mesh.position.x - x) < 0.5 && Math.abs(mesh.position.z - y) < 0.5) {
        const entType = mesh.userData.entityType;
        if (entType && ENTITY_COLORS_3D[entType as EntityType]) {
          flashColor = ENTITY_COLORS_3D[entType as EntityType];
          // Brighten for particle color
          const pr = Math.min(255, ((flashColor >> 16) & 0xff) + 60);
          const pg = Math.min(255, ((flashColor >> 8) & 0xff) + 60);
          const pb = Math.min(255, (flashColor & 0xff) + 60);
          particleColor = (pr << 16) | (pg << 8) | pb;
        }
        break;
      }
    }
    const ringGeo = new THREE.TorusGeometry(0.2, 0.03, 6, 16);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: flashColor,
      transparent: true,
      opacity: 0.8,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(x, 0.1, y);
    this.scene.add(ring);

    // Spawn particle burst: 10 small bright dots shooting outward
    const particles: THREE.Mesh[] = [];
    const particleVelocities: { vx: number; vz: number; vy: number }[] = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 1.5 + Math.random() * 1.5;
      const pGeo = new THREE.SphereGeometry(0.03, 4, 4);
      const pMat = new THREE.MeshBasicMaterial({
        color: particleColor,
        transparent: true,
        opacity: 1.0,
      });
      const p = new THREE.Mesh(pGeo, pMat);
      p.position.set(x, 0.15, y);
      this.scene.add(p);
      particles.push(p);
      particleVelocities.push({
        vx: Math.cos(angle) * speed,
        vz: Math.sin(angle) * speed,
        vy: 0.5 + Math.random() * 1.0,
      });
    }

    // Animate: expand ring and scatter particles over 700ms
    const startTime = this.clock.getElapsedTime();
    const duration = 0.7;
    const animateRing = () => {
      const t = (this.clock.getElapsedTime() - startTime) / duration;
      if (t >= 1) {
        this.scene.remove(ring);
        ringGeo.dispose();
        ringMat.dispose();
        for (const p of particles) {
          this.scene.remove(p);
          (p.geometry as THREE.BufferGeometry).dispose();
          (p.material as THREE.MeshBasicMaterial).dispose();
        }
        return;
      }
      // Ring expansion
      const scale = 1 + t * 3;
      ring.scale.set(scale, 1, scale);
      ringMat.opacity = 0.8 * (1 - t);

      // Particle scatter with gravity
      const dt = 0.016; // ~60fps step
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const v = particleVelocities[i];
        p.position.x += v.vx * dt;
        p.position.z += v.vz * dt;
        p.position.y += v.vy * dt;
        v.vy -= 3.0 * dt; // gravity
        (p.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      }

      requestAnimationFrame(animateRing);
    };
    requestAnimationFrame(animateRing);

    // Entity reaction: pulse scale + brightness on the entity at this tile
    for (const [, mesh] of this.entityMeshes) {
      if (Math.abs(mesh.position.x - x) < 0.5 && Math.abs(mesh.position.z - y) < 0.5) {
        (mesh as any)._interactPulse = 1.0;
        break;
      }
    }
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
      // Chromatic aberration effect via CSS
      this.triggerChromaticAberration(0.3);
    } else if (type === "stun") {
      this.cameraShakeIntensity = 0.25;
      this.cameraShakeDecay = 2.0;
      this.triggerChromaticAberration(0.5);
    }
  }

  /** Brief chromatic aberration effect using CSS text-shadow-like overlay */
  private triggerChromaticAberration(duration: number): void {
    let aberration = document.getElementById("chromatic-aberration");
    if (!aberration) {
      aberration = document.createElement("div");
      aberration.id = "chromatic-aberration";
      aberration.style.cssText =
        "position:fixed;inset:0;pointer-events:none;z-index:91;" +
        "mix-blend-mode:screen;opacity:0;transition:opacity 0.1s;";
      document.body.appendChild(aberration);
    }
    // Red and blue offset shadows create chromatic aberration look
    aberration.style.boxShadow =
      "inset 3px 0 10px rgba(255,0,0,0.15), inset -3px 0 10px rgba(0,0,255,0.15)";
    aberration.style.opacity = "1";
    setTimeout(() => {
      aberration!.style.opacity = "0";
    }, duration * 1000);
  }

  /** Brief tinted screen flash on room entry — each room type gets a distinct visual feel */
  private triggerRoomSignature(roomName: string): void {
    // Map room names to signature colors/styles
    const signatures: Record<string, { color: string; intensity: number; duration: number }> = {
      "Data Core": { color: "rgba(140,60,255,0.12)", intensity: 1, duration: 400 },
      "Med Bay": { color: "rgba(255,255,255,0.1)", intensity: 1, duration: 300 },
      "Armory": { color: "rgba(200,40,40,0.08)", intensity: 1, duration: 350 },
      "Research Lab": { color: "rgba(40,255,120,0.08)", intensity: 1, duration: 350 },
      "Escape Pod Bay": { color: "rgba(40,255,160,0.1)", intensity: 1, duration: 400 },
      "Auxiliary Power": { color: "rgba(255,160,40,0.08)", intensity: 1, duration: 300 },
      "Power Relay Junction": { color: "rgba(255,200,80,0.08)", intensity: 1, duration: 300 },
      "Life Support": { color: "rgba(40,140,255,0.08)", intensity: 1, duration: 400 },
      "Communications Hub": { color: "rgba(40,100,255,0.1)", intensity: 1, duration: 350 },
      "Robotics Bay": { color: "rgba(100,160,200,0.06)", intensity: 1, duration: 300 },
      "Cargo Hold": { color: "rgba(160,120,60,0.06)", intensity: 1, duration: 300 },
      "Crew Quarters": { color: "rgba(200,160,80,0.06)", intensity: 1, duration: 350 },
      "Server Annex": { color: "rgba(120,60,200,0.1)", intensity: 1, duration: 400 },
    };
    const sig = signatures[roomName];
    if (!sig) return;

    let overlay = document.getElementById("room-signature-flash");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "room-signature-flash";
      overlay.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:89;opacity:0;transition:none;";
      document.body.appendChild(overlay);
    }
    overlay.style.background = sig.color;
    overlay.style.opacity = "1";
    // Fade out over duration
    requestAnimationFrame(() => {
      overlay!.style.transition = `opacity ${sig.duration}ms ease-out`;
      overlay!.style.opacity = "0";
    });
    // Reset transition for next use
    setTimeout(() => {
      overlay!.style.transition = "none";
    }, sig.duration + 50);
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
    window.removeEventListener("keydown", this.boundKeyHandler);
    this.container.removeEventListener("wheel", this.boundWheelHandler);
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
    // Cache tile walkability for chase cam wall collision
    this._tileWidth = state.width;
    this._tileHeight = state.height;
    if (this._tileWalkable.length !== state.height) {
      this._tileWalkable = [];
      for (let y = 0; y < state.height; y++) {
        this._tileWalkable[y] = [];
        for (let x = 0; x < state.width; x++) {
          this._tileWalkable[y][x] = state.tiles[y][x].walkable;
        }
      }
    } else {
      for (let y = 0; y < state.height; y++) {
        for (let x = 0; x < state.width; x++) {
          this._tileWalkable[y][x] = state.tiles[y][x].walkable;
        }
      }
    }

    this.updateTiles(state);
    this.updateEntities(state);
    this.updatePlayer(state);

    // Phase-reactive global lighting
    const phase = state.mystery?.objectivePhase ?? ObjectivePhase.Clean;
    if (phase !== this.currentPhase) {
      const prevPhase = this.currentPhase;
      this.currentPhase = phase;

      // Phase transition flash: dramatic full-screen color pulse
      if (prevPhase !== "") {
        const flashColors: Record<string, string> = {
          [ObjectivePhase.Investigate]: "rgba(255,170,0,0.15)",
          [ObjectivePhase.Recover]: "rgba(255,80,40,0.18)",
          [ObjectivePhase.Evacuate]: "rgba(255,0,50,0.25)",
        };
        const flashColor = flashColors[phase];
        if (flashColor) {
          const flashDiv = document.createElement("div");
          flashDiv.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:${flashColor};pointer-events:none;z-index:100;transition:opacity 0.8s ease-out;`;
          document.body.appendChild(flashDiv);
          requestAnimationFrame(() => { flashDiv.style.opacity = "0"; });
          setTimeout(() => { flashDiv.remove(); }, 900);
        }
      }

      if (phase === ObjectivePhase.Evacuate && this.ambientLight && this.keyLight) {
        // RED ALERT: shift ambient and key light to emergency red
        this.ambientLight.color.setHex(0xff8888);
        this.ambientLight.intensity = 2.0;
        this.keyLight.color.setHex(0xff6644);
        this.keyLight.intensity = 2.0;
        // Tighten fog for urgency
        const fog = this.scene.fog as THREE.Fog;
        if (fog) { fog.color.setHex(0x1a0505); }
        // Player light turns red-tinged
        this.playerLight.color.setHex(0xff6644);
      } else if (phase === ObjectivePhase.Recover && this.ambientLight) {
        // RECOVERY: slight amber tint for tension
        this.ambientLight.color.setHex(0xddc8a0);
        this.ambientLight.intensity = 2.8;
      } else if (this.ambientLight && this.keyLight) {
        // Normal phases: standard lighting
        this.ambientLight.color.setHex(0xccddff);
        this.ambientLight.intensity = 3.2;
        this.keyLight.color.setHex(0xffeedd);
        this.keyLight.intensity = 2.8;
        this.playerLight.color.setHex(0x44ff66);
      }
    }
    this.updateFog(state);
    this.updateRoomLights(state);
    this.placeRoomDecorations(state);
    this.placeRoomTrim(state);
    this.placeRoomCeiling(state);
    this.placeRoomHaze(state);
    this.placeCautionMarkings(state);
    this.placeCorridorPipes(state);
    this.placeCorridorArches(state);
    this.placeCorridorStripLights(state);
    this.placeCorridorWallProps(state);
    this.placeEmergencyWallStrips(state);
    this.placeCorridorFixtures(state);
    this.placeCorridorGuideStrips(state);
    this.updateHazardVisuals(state);
    this.updateDoorLights(state);
    this.updateRoomLabels(state);
    this.updateWaypoint(state, this.clock.getElapsedTime());
    this.renderMinimap(state);

    // Room transition fade overlay
    let fadeOverlay = document.getElementById("room-transition-fade");
    if (!fadeOverlay) {
      fadeOverlay = document.createElement("div");
      fadeOverlay.id = "room-transition-fade";
      fadeOverlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:#000;pointer-events:none;z-index:90;transition:none;";
      document.body.appendChild(fadeOverlay);
    }
    fadeOverlay.style.opacity = String(this._roomTransitionFade);

    // Hazard screen border: colored edge glow when player is in danger
    const hazBorder = document.getElementById("hazard-border");
    if (hazBorder) {
      const currentPhase = state.mystery?.objectivePhase ?? ObjectivePhase.Clean;
      if (currentPhase === ObjectivePhase.Evacuate) {
        // Evacuation: persistent red alert border (always visible)
        hazBorder.className = "active";
      } else {
        const px = state.player.entity.pos.x;
        const py = state.player.entity.pos.y;
        const playerTile = state.tiles[py]?.[px];
        if (playerTile) {
          const heatDanger = playerTile.heat > 30;
          const smokeDanger = playerTile.smoke > 40;
          const vacuumDanger = playerTile.pressure < 40;
          const heatWarning = playerTile.heat > 15;
          const smokeWarning = playerTile.smoke > 20;
          const vacuumWarning = playerTile.pressure < 60;

          if (heatDanger || smokeDanger) {
            hazBorder.className = "active"; // red glow for heat/smoke
          } else if (vacuumDanger) {
            hazBorder.className = "active frost"; // blue glow for vacuum
          } else if (heatWarning || smokeWarning) {
            hazBorder.className = "active amber";
          } else if (vacuumWarning) {
            hazBorder.className = "active frost";
          } else {
            hazBorder.className = "";
          }
        }
      }
    }
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
      `<span class="key">F2</span> chase cam ` +
      `<span class="key">F3</span> toggle 2D/3D ` +
      `<span class="key">F4</span> outlines ` +
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

      // Movement velocity for animation
      const velX = this.playerTargetX - this.playerCurrentX;
      const velZ = this.playerTargetZ - this.playerCurrentZ;
      const speed = Math.sqrt(velX * velX + velZ * velZ);
      const isMoving = speed > 0.05;

      this.playerMesh.position.x = this.playerCurrentX;
      this.playerMesh.position.z = this.playerCurrentZ;
      // Floor-level with subtle breathing + bounce on arrival
      const breathe = Math.sin(elapsed * 2) * 0.01;
      const moveBob = isMoving ? Math.abs(Math.sin(elapsed * 8)) * 0.015 : 0;
      this.playerMesh.position.y = 0.02 + breathe + moveBob;

      // Smooth rotation towards facing direction
      let targetRot = this.playerFacing;
      let currentRot = this.playerMesh.rotation.y;
      // Shortest path rotation
      let diff = targetRot - currentRot;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.playerMesh.rotation.y += diff * Math.min(1, 10 * delta);

      // Movement tilt: lean forward when moving, sideways when turning
      const forwardTilt = isMoving ? -0.08 : 0; // slight forward lean
      const turnLean = diff * -0.15; // lean into turns
      const targetTiltX = forwardTilt;
      const targetTiltZ = Math.max(-0.12, Math.min(0.12, turnLean));
      // Smooth tilt
      this.playerMesh.rotation.x += (targetTiltX - this.playerMesh.rotation.x) * 0.15;
      this.playerMesh.rotation.z += (targetTiltZ - this.playerMesh.rotation.z) * 0.15;

      // Cleaning brush spin (children 6 & 7) — spin when moving
      const brushL = this.playerMesh.children[6];
      const brushR = this.playerMesh.children[7];
      if (brushL && brushR) {
        const brushSpeed = isMoving ? elapsed * 15 : elapsed * 0.5; // fast when moving, slow idle
        brushL.rotation.z = brushSpeed;
        brushR.rotation.z = -brushSpeed; // counter-rotate
      }

      // Damage state visualization on Sweepo model
      if (this._playerHpPercent < 1.0) {
        // Antenna droop when damaged (child 2 = antenna cylinder)
        const antenna = this.playerMesh.children[2];
        if (antenna) {
          const droopAngle = (1 - this._playerHpPercent) * 0.5; // max 0.5 rad droop at 0 HP
          antenna.rotation.z = droopAngle + Math.sin(elapsed * 3) * droopAngle * 0.3;
        }
        // Ground glow flickers/dims when low HP (child 4 = glow circle)
        const groundGlow = this.playerMesh.children[4];
        if (groundGlow instanceof THREE.Mesh) {
          const glowMat = groundGlow.material as THREE.MeshBasicMaterial;
          if (this._playerHpPercent < 0.3) {
            // Critical: red glow, flicker
            glowMat.color.setHex(0xff2222);
            glowMat.opacity = 0.1 + Math.random() * 0.08; // unstable flicker
          } else if (this._playerHpPercent < 0.6) {
            // Damaged: amber glow
            glowMat.color.setHex(0xffaa22);
            glowMat.opacity = 0.12;
          } else {
            glowMat.color.setHex(0x22ff66); // healthy green
            glowMat.opacity = 0.15;
          }
        }
        // Body emissive flash at low HP — sparking effect
        if (this._playerHpPercent < 0.4) {
          const body = this.playerMesh.children[0];
          if (body instanceof THREE.Mesh && body.material instanceof THREE.MeshStandardMaterial) {
            const spark = Math.sin(elapsed * 12) > 0.7 ? 0.3 : 0;
            body.material.emissiveIntensity = spark;
            body.material.emissive = body.material.emissive || new THREE.Color(0xff4400);
            if (spark > 0) body.material.emissive.setHex(0xff4400);
          }
          // Actual spark sprites shooting from body when critically damaged
          this._damageSparkTimer -= delta;
          if (this._damageSparkTimer <= 0) {
            const severity = 1 - this._playerHpPercent / 0.4;
            this._damageSparkTimer = 0.3 - severity * 0.2; // more frequent at lower HP
            const dsMat = new THREE.SpriteMaterial({
              color: 0xffaa22, transparent: true, opacity: 0.7,
              depthWrite: false, blending: THREE.AdditiveBlending,
            });
            const ds = new THREE.Sprite(dsMat);
            ds.scale.set(0.04, 0.04, 1);
            ds.position.set(
              this.playerCurrentX + (Math.random() - 0.5) * 0.3,
              0.15 + Math.random() * 0.3,
              this.playerCurrentZ + (Math.random() - 0.5) * 0.3,
            );
            (ds as any)._life = 0;
            (ds as any)._maxLife = 0.15 + Math.random() * 0.15;
            (ds as any)._driftY = 1.0 + Math.random() * 1.5;
            this.scene.add(ds);
            this._discoverySparkles.push(ds);
          }
        }
      } else {
        // Healthy: idle antenna sway (gentle scanning motion)
        const antenna = this.playerMesh.children[2];
        if (antenna) {
          const sway = isMoving ? 0 : Math.sin(elapsed * 1.2) * 0.12 + Math.sin(elapsed * 0.7) * 0.05;
          antenna.rotation.z = sway;
        }
        const groundGlow = this.playerMesh.children[4];
        if (groundGlow instanceof THREE.Mesh) {
          const glowMat = groundGlow.material as THREE.MeshBasicMaterial;
          glowMat.color.setHex(0x22ff66);
          glowMat.opacity = 0.15;
        }
      }
      // Stun jitter: rapid random rotation wobble + screen static overlay
      if (this._playerStunned) {
        this.playerMesh.rotation.x += (Math.random() - 0.5) * 0.06;
        this.playerMesh.rotation.z += (Math.random() - 0.5) * 0.06;
        // Screen static noise overlay
        let stunOverlay = document.getElementById("stun-static-overlay");
        if (!stunOverlay) {
          stunOverlay = document.createElement("div");
          stunOverlay.id = "stun-static-overlay";
          stunOverlay.style.cssText =
            "position:fixed;inset:0;pointer-events:none;z-index:88;opacity:0.12;mix-blend-mode:screen;";
          document.body.appendChild(stunOverlay);
        }
        stunOverlay.style.display = "block";
        // Randomize background position for noise effect each frame
        const rx = Math.random() * 200;
        const ry = Math.random() * 200;
        stunOverlay.style.backgroundImage =
          `repeating-linear-gradient(${Math.random()*360}deg,rgba(255,255,255,${0.1+Math.random()*0.3}) 0px,transparent 1px,transparent 2px)`;
        stunOverlay.style.backgroundPosition = `${rx}px ${ry}px`;
        stunOverlay.style.backgroundSize = "3px 3px";
      } else {
        const stunOverlay = document.getElementById("stun-static-overlay");
        if (stunOverlay) stunOverlay.style.display = "none";
      }

      // Eye glow: state-reactive color + gentle pulse + emotion (child 5)
      const sweepoEye = this.playerMesh.children[5];
      if (sweepoEye instanceof THREE.Mesh) {
        const eyeMat = sweepoEye.material as THREE.MeshBasicMaterial;
        const pulse = 0.7 + Math.sin(elapsed * 3) * 0.15;
        if (this._playerStunned) {
          eyeMat.color.setHex(0xff2222); // red when stunned
          eyeMat.opacity = 0.4 + Math.random() * 0.5; // erratic
        } else if (this._playerHpPercent < 0.4) {
          eyeMat.color.setHex(0xff6622); // orange when critical
          eyeMat.opacity = pulse * 0.6;
        } else if (this._playerHpPercent < 0.8) {
          eyeMat.color.setHex(0xffcc44); // amber when damaged
          eyeMat.opacity = pulse * 0.8;
        } else {
          eyeMat.color.setHex(0x44ff88); // green when healthy
          eyeMat.opacity = pulse;
        }
        // Eye blink: periodic squint (scale Y down briefly)
        const blinkCycle = (elapsed + 1.7) % 4.0; // blink every ~4s
        const blinkT = blinkCycle < 0.12 ? 1 - blinkCycle / 0.06 : blinkCycle < 0.24 ? (blinkCycle - 0.12) / 0.06 - 1 : 0;
        const blinkScale = 1 - Math.max(0, blinkT) * 0.8; // squish to 20% height at peak
        // Emotion: widen on discovery (flash tile boost), squint when damaged
        const emotionScale = this._playerHpPercent < 0.4 ? 0.7 : this._eyeWidenTimer > 0 ? 1.3 : 1.0;
        sweepoEye.scale.set(emotionScale, blinkScale * emotionScale, emotionScale);
        if (this._eyeWidenTimer > 0) this._eyeWidenTimer -= delta;
      }

      // Antenna signal pulse: tip glows when near unexhausted interactive entities (child 3)
      const antennaTip = this.playerMesh.children[3];
      if (antennaTip instanceof THREE.Mesh) {
        const atMat = antennaTip.material as THREE.MeshBasicMaterial;
        // Find nearest unexhausted entity distance
        let nearestDist = 999;
        for (const [, emesh] of this.entityMeshes) {
          if (emesh.userData._exhausted) continue;
          const adx = emesh.position.x - this.playerCurrentX;
          const adz = emesh.position.z - this.playerCurrentZ;
          const adist = Math.abs(adx) + Math.abs(adz);
          if (adist < nearestDist) nearestDist = adist;
        }
        if (nearestDist < 6) {
          // Signal strength: 1.0 at distance 0, fading to 0 at distance 6
          const signal = 1 - nearestDist / 6;
          // Pulse rate increases with proximity (2Hz far → 8Hz close)
          const rate = 2 + signal * 6;
          const pulse = 0.3 + signal * 0.7 * (0.5 + Math.sin(elapsed * rate) * 0.5);
          atMat.color.setHex(nearestDist < 2 ? 0xffff44 : 0x44ff88);
          atMat.opacity = pulse;
          antennaTip.scale.setScalar(1 + signal * 0.5);
        } else {
          // Idle: dim green
          atMat.color.setHex(0x00ff44);
          atMat.opacity = 0.3 + Math.sin(elapsed * 1.5) * 0.1;
          antennaTip.scale.setScalar(1);
        }
      }

      // Low HP warning vignette: pulsing red screen edges when damaged
      {
        let hpVig = document.getElementById("hp-warning-vignette");
        if (this._playerHpPercent < 0.4 && !this._playerStunned) {
          if (!hpVig) {
            hpVig = document.createElement("div");
            hpVig.id = "hp-warning-vignette";
            hpVig.style.cssText =
              "position:fixed;inset:0;pointer-events:none;z-index:87;";
            document.body.appendChild(hpVig);
          }
          const severity = 1 - this._playerHpPercent / 0.4; // 0 at 40%, 1 at 0%
          const pulse = 0.5 + Math.sin(elapsed * 2.5) * 0.5;
          const alpha = (0.08 + severity * 0.12) * (0.6 + pulse * 0.4);
          hpVig.style.display = "block";
          hpVig.style.boxShadow = `inset 0 0 ${60 + severity * 40}px ${20 + severity * 20}px rgba(255,30,0,${alpha.toFixed(3)})`;
        } else if (hpVig) {
          hpVig.style.display = "none";
        }
      }

      // Sensor mode visor tint: subtle full-screen color wash while sensor overlay is active
      {
        let sensorTint = document.getElementById("sensor-visor-tint");
        if (this.sensorMode) {
          if (!sensorTint) {
            sensorTint = document.createElement("div");
            sensorTint.id = "sensor-visor-tint";
            sensorTint.style.cssText =
              "position:fixed;inset:0;pointer-events:none;z-index:86;mix-blend-mode:multiply;";
            document.body.appendChild(sensorTint);
          }
          const sensorTints: Record<string, string> = {
            [SensorType.Thermal]: "rgba(255,200,180,0.06)",
            [SensorType.Atmospheric]: "rgba(180,220,255,0.06)",
            [SensorType.Cleanliness]: "rgba(200,255,180,0.06)",
          };
          sensorTint.style.display = "block";
          sensorTint.style.backgroundColor = sensorTints[this.sensorMode] ?? "transparent";
          // Subtle breathing at sensor-specific rate
          const breathe = 0.8 + Math.sin(elapsed * 1.5) * 0.2;
          sensorTint.style.opacity = breathe.toFixed(2);
        } else if (sensorTint) {
          sensorTint.style.display = "none";
        }
      }

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

      // Camera zoom pulse on room transition (positive = zoom out, negative = zoom in)
      let zoomOffset = 0;
      if (Math.abs(this.cameraZoomPulse) > 0.01) {
        const sign = this.cameraZoomPulse > 0 ? 1 : -1;
        const mag = Math.abs(this.cameraZoomPulse);
        // Smooth ease-out bump: brief zoom then return
        zoomOffset = Math.sin(mag * Math.PI) * 1.5 * sign;
        // Decay toward zero
        if (this.cameraZoomPulse > 0) {
          this.cameraZoomPulse = Math.max(0, this.cameraZoomPulse - delta * 2.0);
        } else {
          this.cameraZoomPulse = Math.min(0, this.cameraZoomPulse + delta * 2.5);
        }
        if (!this.chaseCamActive) {
          // Update orthographic camera frustum
          const aspect = this.container.clientWidth / this.container.clientHeight;
          const baseSize = this.cameraFrustumSize + zoomOffset;
          this.orthoCamera.left = -baseSize * aspect;
          this.orthoCamera.right = baseSize * aspect;
          this.orthoCamera.top = baseSize;
          this.orthoCamera.bottom = -baseSize;
          this.orthoCamera.updateProjectionMatrix();
        }
      }

      if (this.chaseCamActive) {
        // 3rd-person chase cam: behind and above Sweepo, smoothly following
        const facing = this.playerMesh.rotation.y;

        // Context-aware camera: wider/higher in rooms, tighter/lower in corridors
        const inRoom = this.lastRoomId !== "";
        const chaseDist = inRoom ? 3.0 : 2.2;        // further back in rooms, closer in corridors
        const chaseHeight = inRoom ? 1.2 : 0.7;      // higher in rooms, lower in corridors
        const lookDist = inRoom ? 2.5 : 1.8;          // look further ahead in rooms

        // Target positions
        let targetCamX = this.playerCurrentX - Math.sin(facing) * chaseDist;
        let targetCamZ = this.playerCurrentZ - Math.cos(facing) * chaseDist;
        const targetLookX = this.playerCurrentX + Math.sin(facing) * lookDist;
        const targetLookZ = this.playerCurrentZ + Math.cos(facing) * lookDist;

        // Wall collision avoidance: step back toward player if camera lands in a wall
        if (this._tileWalkable.length > 0) {
          const tx = Math.round(targetCamX);
          const tz = Math.round(targetCamZ);
          if (tx >= 0 && tx < this._tileWidth && tz >= 0 && tz < this._tileHeight &&
              !this._tileWalkable[tz][tx]) {
            // Pull camera closer to player (50% of distance) to avoid wall
            targetCamX = this.playerCurrentX + (targetCamX - this.playerCurrentX) * 0.35;
            targetCamZ = this.playerCurrentZ + (targetCamZ - this.playerCurrentZ) * 0.35;
          }
        }

        // Smooth interpolation (slower than player movement for cinematic lag)
        const camLerp = Math.min(1, 5 * delta);
        this.chaseCamPosX += (targetCamX - this.chaseCamPosX) * camLerp;
        this.chaseCamPosZ += (targetCamZ - this.chaseCamPosZ) * camLerp;
        this.chaseCamPosY += (chaseHeight - this.chaseCamPosY) * camLerp;
        this.chaseCamLookX += (targetLookX - this.chaseCamLookX) * camLerp;
        this.chaseCamLookZ += (targetLookZ - this.chaseCamLookZ) * camLerp;

        // Head-bob when moving, gentle sway when idle
        const moveSpeed = Math.abs(this.playerTargetX - this.playerCurrentX) +
                          Math.abs(this.playerTargetZ - this.playerCurrentZ);
        const isIdle = moveSpeed < 0.01;
        const headBob = isIdle
          ? Math.sin(elapsed * 0.7) * 0.015  // gentle idle sway
          : Math.sin(elapsed * 8) * 0.03;    // active head-bob

        // FOV breathing: context-aware base + movement widening
        const baseFov = inRoom ? 65 : 55;  // wider in rooms, tighter in corridors
        const fovBreath = moveSpeed > 0.01 ? 3.0 : 0;
        const targetFov = baseFov + fovBreath + zoomOffset * 2;
        this.chaseCamera.fov += (targetFov - this.chaseCamera.fov) * camLerp;
        this.chaseCamera.updateProjectionMatrix();

        // Look-at height: slightly higher in rooms to see more of the space
        const lookY = inRoom ? 0.3 : 0.1;

        // Idle lateral sway for subtle breathing camera
        const idleSwayX = isIdle ? Math.sin(elapsed * 0.5) * 0.04 : 0;
        const idleSwayZ = isIdle ? Math.cos(elapsed * 0.37) * 0.03 : 0;

        this.chaseCamera.position.set(
          this.chaseCamPosX + shakeX + idleSwayX,
          this.chaseCamPosY + headBob,
          this.chaseCamPosZ + shakeZ + idleSwayZ
        );
        this.chaseCamera.lookAt(this.chaseCamLookX, lookY, this.chaseCamLookZ);
      } else {
        // Orthographic top-down/isometric camera
        const camY = 4 + (1 - this.cameraElevation) * 12; // 4-16 range
        const camZOffset = 2 + this.cameraElevation * 16;  // 2-18 range
        this.orthoCamera.position.set(this.cameraPosX + shakeX, camY + zoomOffset * 0.5, this.cameraPosZ + camZOffset + shakeZ);
        this.orthoCamera.lookAt(this.cameraPosX, 0, this.cameraPosZ);
      }
      this.playerLight.position.set(this.playerCurrentX, 3, this.playerCurrentZ);
      this._fillLight.position.set(this.playerCurrentX, 1.2, this.playerCurrentZ);
      // Fill light only active in chase cam (in ortho, the overhead light is sufficient)
      this._fillLight.intensity = this.chaseCamActive ? 0.8 : 0;

      // Adjust fog based on camera mode + room vs corridor
      const fog = this.scene.fog as THREE.Fog;
      if (fog) {
        const inRoom = this._currentRoom !== null;
        let targetNear: number, targetFar: number;
        if (!this.chaseCamActive) {
          targetNear = 20; targetFar = 40;
        } else if (inRoom) {
          targetNear = 4; targetFar = 16; // open room — wider view
        } else {
          targetNear = 2; targetFar = 10; // corridor — claustrophobic darkness
        }
        fog.near += (targetNear - fog.near) * 0.08;
        fog.far += (targetFar - fog.far) * 0.08;
      }

      // Corridor dimming: reduce ambient light in corridors for headlight-only feel
      if (this.ambientLight && this.chaseCamActive) {
        const inRoom = this._currentRoom !== null;
        const targetDim = inRoom ? 1.0 : 0.35; // corridors get 35% ambient
        this._corridorDimFactor += (targetDim - this._corridorDimFactor) * 0.08;
        // Determine base intensity from phase
        const phase = this.currentPhase;
        let baseIntensity = 3.2;
        if (phase === ObjectivePhase.Evacuate) baseIntensity = 2.0;
        else if (phase === ObjectivePhase.Recover) baseIntensity = 2.8;
        this.ambientLight.intensity = baseIntensity * this._corridorDimFactor;

        // Evacuation phase: pulsing red ambient for emergency klaxon feel
        if (phase === ObjectivePhase.Evacuate) {
          const klaxon = 0.5 + Math.abs(Math.sin(elapsed * 3)) * 0.5; // slow heavy pulse
          this.ambientLight.intensity *= (0.7 + klaxon * 0.3);
          // Ceiling panels tinted red during evacuation
          if (this.ceilingMesh.visible) {
            const ceilMat = this.ceilingMesh.material as THREE.MeshStandardMaterial;
            ceilMat.emissive = ceilMat.emissive || new THREE.Color();
            ceilMat.emissive.setHex(0xff1100);
            ceilMat.emissiveIntensity = klaxon * 0.15;
          }
        } else if (this.ceilingMesh.visible) {
          // Non-evacuation: ensure ceiling emissive is off
          const ceilMat = this.ceilingMesh.material as THREE.MeshStandardMaterial;
          if (ceilMat.emissiveIntensity > 0) ceilMat.emissiveIntensity = 0;
        }
      }

      // Update movement trail
      this.updateTrail(this.playerCurrentX, this.playerCurrentZ, delta);

      // Footstep dust kicks: small puffs when Sweepo moves
      if (isMoving) {
        this._dustKickTimer -= delta;
        if (this._dustKickTimer <= 0) {
          this._dustKickTimer = 0.08; // frequent small puffs
          // Spawn behind player (opposite of movement direction)
          const backX = this.playerCurrentX - velX * 0.5 + (Math.random() - 0.5) * 0.2;
          const backZ = this.playerCurrentZ - velZ * 0.5 + (Math.random() - 0.5) * 0.2;
          const dustMat = new THREE.SpriteMaterial({
            color: 0xaa9977, transparent: true, opacity: 0.2,
            depthWrite: false, blending: THREE.AdditiveBlending,
          });
          const dust = new THREE.Sprite(dustMat);
          dust.scale.set(0.06, 0.06, 1);
          dust.position.set(backX, 0.04, backZ);
          (dust as any)._life = 0;
          (dust as any)._maxLife = 0.4 + Math.random() * 0.3;
          this.scene.add(dust);
          this._dustKickSprites.push(dust);
        }
      }

      // Cleaning sparkles: green sparkles when moving over dirty tiles
      if (isMoving && this._playerTileDirt > 30 && this.chaseCamActive) {
        this._cleanSparkleTimer -= delta;
        if (this._cleanSparkleTimer <= 0) {
          this._cleanSparkleTimer = 0.12;
          const intensity = Math.min(1, this._playerTileDirt / 80);
          const csMat = new THREE.SpriteMaterial({
            color: 0x44ff88, transparent: true, opacity: 0.3 + intensity * 0.3,
            depthWrite: false, blending: THREE.AdditiveBlending,
          });
          const cs = new THREE.Sprite(csMat);
          cs.scale.set(0.07, 0.07, 1);
          cs.position.set(
            this.playerCurrentX + (Math.random() - 0.5) * 0.4,
            0.05 + Math.random() * 0.15,
            this.playerCurrentZ + (Math.random() - 0.5) * 0.4,
          );
          (cs as any)._life = 0;
          (cs as any)._maxLife = 0.5 + Math.random() * 0.3;
          (cs as any)._driftY = 0.4 + Math.random() * 0.3;
          this.scene.add(cs);
          this._discoverySparkles.push(cs);
        }
      }

      // Corridor breath puff: periodic cold air visualization
      if (this.chaseCamActive && !this._currentRoom) {
        this._breathPuffTimer -= delta;
        if (this._breathPuffTimer <= 0) {
          this._breathPuffTimer = 2.0 + Math.random() * 1.0;
          const facing = this.playerMesh ? this.playerMesh.rotation.y : this.playerFacing;
          const puffX = this.playerCurrentX + Math.sin(facing) * 0.35;
          const puffZ = this.playerCurrentZ + Math.cos(facing) * 0.35;
          const puffMat = new THREE.SpriteMaterial({
            color: 0xccddee, transparent: true, opacity: 0.15,
            depthWrite: false, blending: THREE.AdditiveBlending,
          });
          const puff = new THREE.Sprite(puffMat);
          puff.scale.set(0.05, 0.05, 1);
          puff.position.set(puffX, 0.15, puffZ);
          (puff as any)._life = 0;
          (puff as any)._maxLife = 0.6;
          (puff as any)._dirX = Math.sin(facing) * 0.3;
          (puff as any)._dirZ = Math.cos(facing) * 0.3;
          this.scene.add(puff);
          this._breathPuffSprites.push(puff);
        }
      }
    }

    // Vacuum wind particles: drift toward nearest breach on low-pressure tiles
    if (this._playerTilePressure < 60 && this.chaseCamActive) {
      this._vacuumWindTimer -= delta;
      if (this._vacuumWindTimer <= 0) {
        this._vacuumWindTimer = 0.15 + Math.random() * 0.2;
        const windMat = new THREE.SpriteMaterial({
          color: 0x6688cc, transparent: true, opacity: 0.12,
          depthWrite: false, blending: THREE.AdditiveBlending,
        });
        const wind = new THREE.Sprite(windMat);
        wind.scale.set(0.04, 0.04, 1);
        // Spawn around player
        const angle = Math.random() * Math.PI * 2;
        const dist = 0.3 + Math.random() * 1.5;
        wind.position.set(
          this.playerCurrentX + Math.cos(angle) * dist,
          0.1 + Math.random() * 0.6,
          this.playerCurrentZ + Math.sin(angle) * dist
        );
        (wind as any)._life = 0;
        (wind as any)._maxLife = 0.5 + Math.random() * 0.4;
        (wind as any)._dirX = this._nearestBreachDir.x * 2;
        (wind as any)._dirZ = this._nearestBreachDir.z * 2;
        this.scene.add(wind);
        this._vacuumWindSprites.push(wind);
      }
    }
    // Animate vacuum wind particles
    for (let i = this._vacuumWindSprites.length - 1; i >= 0; i--) {
      const vw = this._vacuumWindSprites[i];
      (vw as any)._life += delta;
      const life = (vw as any)._life;
      const maxLife = (vw as any)._maxLife;
      if (life >= maxLife) {
        this.scene.remove(vw);
        (vw.material as THREE.SpriteMaterial).dispose();
        this._vacuumWindSprites.splice(i, 1);
        continue;
      }
      const t = life / maxLife;
      vw.position.x += (vw as any)._dirX * delta;
      vw.position.z += (vw as any)._dirZ * delta;
      // Accelerate toward breach
      (vw as any)._dirX *= 1.02;
      (vw as any)._dirZ *= 1.02;
      (vw.material as THREE.SpriteMaterial).opacity = 0.12 * (1 - t);
      const s = 0.04 + t * 0.06;
      vw.scale.set(s, s, 1);
    }

    // Heat shimmer: rising wavering particles on hot tiles
    if (this._playerTileHeat > 25 && this.chaseCamActive) {
      this._heatShimmerTimer -= delta;
      if (this._heatShimmerTimer <= 0) {
        const intensity = Math.min(1, this._playerTileHeat / 80);
        this._heatShimmerTimer = 0.1 + (1 - intensity) * 0.2;
        const shimMat = new THREE.SpriteMaterial({
          color: 0xff6622, transparent: true, opacity: 0.06 + intensity * 0.06,
          depthWrite: false, blending: THREE.AdditiveBlending,
        });
        const shim = new THREE.Sprite(shimMat);
        shim.scale.set(0.15, 0.03, 1); // wide and thin (heat wave)
        const angle = Math.random() * Math.PI * 2;
        const dist = 0.5 + Math.random() * 2;
        shim.position.set(
          this.playerCurrentX + Math.cos(angle) * dist,
          0.05,
          this.playerCurrentZ + Math.sin(angle) * dist
        );
        (shim as any)._life = 0;
        (shim as any)._maxLife = 0.4 + Math.random() * 0.3;
        (shim as any)._wavePhase = Math.random() * Math.PI * 2;
        this.scene.add(shim);
        this._heatShimmerSprites.push(shim);
      }
    }
    // Animate heat shimmer
    for (let i = this._heatShimmerSprites.length - 1; i >= 0; i--) {
      const hs = this._heatShimmerSprites[i];
      (hs as any)._life += delta;
      const life = (hs as any)._life;
      const maxLife = (hs as any)._maxLife;
      if (life >= maxLife) {
        this.scene.remove(hs);
        (hs.material as THREE.SpriteMaterial).dispose();
        this._heatShimmerSprites.splice(i, 1);
        continue;
      }
      const t = life / maxLife;
      hs.position.y += delta * 0.8; // rise fast
      // Horizontal wave distortion
      hs.position.x += Math.sin((hs as any)._wavePhase + life * 12) * delta * 0.3;
      (hs.material as THREE.SpriteMaterial).opacity *= (1 - t * 0.5);
      const sx = 0.15 + t * 0.1;
      hs.scale.set(sx, 0.03 + t * 0.02, 1);
    }

    // Smoke wisps: drifting grey sprites on smoky tiles near player
    if (this._playerTileSmoke > 25 && this.chaseCamActive) {
      this._smokeWispTimer -= delta;
      if (this._smokeWispTimer <= 0) {
        const smokeIntensity = Math.min(1, this._playerTileSmoke / 80);
        this._smokeWispTimer = 0.3 - smokeIntensity * 0.2;
        const swMat = new THREE.SpriteMaterial({
          color: 0x888899, transparent: true, opacity: 0.08 + smokeIntensity * 0.06,
          depthWrite: false, blending: THREE.AdditiveBlending,
        });
        const sw = new THREE.Sprite(swMat);
        sw.scale.set(0.2 + Math.random() * 0.15, 0.1 + Math.random() * 0.08, 1);
        const angle = Math.random() * Math.PI * 2;
        const dist = 0.3 + Math.random() * 1.5;
        sw.position.set(
          this.playerCurrentX + Math.cos(angle) * dist,
          0.2 + Math.random() * 0.8,
          this.playerCurrentZ + Math.sin(angle) * dist,
        );
        (sw as any)._life = 0;
        (sw as any)._maxLife = 1.0 + Math.random() * 1.0;
        (sw as any)._driftY = 0.15 + Math.random() * 0.1;
        this.scene.add(sw);
        this._discoverySparkles.push(sw);
      }
    }

    // Entity animations
    for (const [id, mesh] of this.entityMeshes) {
      const userData = mesh.userData as { entityType?: string; _activated?: boolean; _following?: boolean };
      if (userData.entityType === EntityType.Relay) {
        // Activated relays spin faster and glow brighter
        const activated = userData._activated;
        mesh.rotation.y = elapsed * (activated ? 1.5 : 0.5);
        if (activated) {
          mesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
              child.material.emissiveIntensity = 0.5 + Math.sin(elapsed * 3) * 0.2;
            }
          });
        }
      } else if (userData.entityType === EntityType.DataCore) {
        mesh.rotation.y = elapsed * 0.8;
        mesh.position.y = 0.5 + Math.sin(elapsed * 1.5) * 0.1;
        // Wireframe cage orbits in counter-direction (child 1 = wireframe cage)
        const cage = mesh.children[1];
        if (cage) cage.rotation.y = -elapsed * 0.4;
        // Holographic orbit ring around the DataCore
        if (!this._dataCoreHoloRing) {
          const ringGeo = new THREE.TorusGeometry(0.6, 0.02, 8, 32);
          const ringMat = new THREE.MeshBasicMaterial({
            color: 0xff44ff, transparent: true, opacity: 0.3,
            depthWrite: false, blending: THREE.AdditiveBlending,
          });
          this._dataCoreHoloRing = new THREE.Mesh(ringGeo, ringMat);
          this.scene.add(this._dataCoreHoloRing);
        }
        this._dataCoreHoloRing.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
        this._dataCoreHoloRing.rotation.x = Math.PI / 4 + Math.sin(elapsed * 0.5) * 0.2;
        this._dataCoreHoloRing.rotation.y = elapsed * 1.2;
        const ringMat = this._dataCoreHoloRing.material as THREE.MeshBasicMaterial;
        ringMat.opacity = 0.2 + Math.sin(elapsed * 2) * 0.1;
        // Energy arcs: periodic magenta sparks radiating outward
        const arcPhase = (elapsed * 1.5 + mesh.position.x * 7) % 2.5;
        if (arcPhase < 0.05 && !mesh.userData._arcSpawned) {
          mesh.userData._arcSpawned = true;
          for (let ai = 0; ai < 3; ai++) {
            const angle = Math.random() * Math.PI * 2;
            const arcMat = new THREE.SpriteMaterial({
              color: 0xff66ff, transparent: true, opacity: 0.8,
              depthWrite: false, blending: THREE.AdditiveBlending,
            });
            const arc = new THREE.Sprite(arcMat);
            arc.scale.set(0.06, 0.12, 1);
            arc.position.set(
              mesh.position.x + Math.cos(angle) * 0.3,
              mesh.position.y + (Math.random() - 0.5) * 0.3,
              mesh.position.z + Math.sin(angle) * 0.3,
            );
            (arc as any)._life = 0;
            (arc as any)._maxLife = 0.2 + Math.random() * 0.15;
            (arc as any)._driftY = 0.5 + Math.random() * 0.5;
            this.scene.add(arc);
            this._discoverySparkles.push(arc);
          }
        } else if (arcPhase >= 0.05) {
          mesh.userData._arcSpawned = false;
        }
      } else if (userData.entityType === EntityType.Breach) {
        const scale = 1 + Math.sin(elapsed * 3) * 0.15;
        mesh.scale.set(scale, scale, scale);
        // Unsealed breaches: pulsing red danger ring on floor
        if (!mesh.userData._sealed) {
          if (!mesh.userData._dangerRing) {
            const drGeo = new THREE.RingGeometry(0.5, 0.65, 24);
            drGeo.rotateX(-Math.PI / 2);
            const drMat = new THREE.MeshBasicMaterial({
              color: 0xff2200, transparent: true, opacity: 0.3,
              depthWrite: false, blending: THREE.AdditiveBlending,
            });
            const dr = new THREE.Mesh(drGeo, drMat);
            dr.position.set(mesh.position.x, 0.03, mesh.position.z);
            this.scene.add(dr);
            mesh.userData._dangerRing = dr;
          }
          const dr = mesh.userData._dangerRing as THREE.Mesh;
          const ringPulse = 0.5 + Math.sin(elapsed * 4) * 0.5;
          (dr.material as THREE.MeshBasicMaterial).opacity = 0.15 + ringPulse * 0.2;
          const rScale = 1 + ringPulse * 0.3;
          dr.scale.set(rScale, 1, rScale);
        } else if (mesh.userData._dangerRing) {
          this.scene.remove(mesh.userData._dangerRing as THREE.Mesh);
          mesh.userData._dangerRing = null;
        }
      } else if (userData.entityType === EntityType.Drone) {
        mesh.position.y = 0.6 + Math.sin(elapsed * 2 + mesh.position.x) * 0.08;
        // Spin propeller ring (child index 1 = torus ring)
        const propRing = mesh.children[1];
        if (propRing) propRing.rotation.z = elapsed * 12;
        // Eye tracks player direction (child index 2 = eye sphere)
        const droneEye = mesh.children[2];
        if (droneEye) {
          const edx = this.playerCurrentX - mesh.position.x;
          const edz = this.playerCurrentZ - mesh.position.z;
          const eDist = Math.sqrt(edx * edx + edz * edz);
          if (eDist < 5 && eDist > 0.1) {
            droneEye.position.x = (edx / eDist) * 0.08;
            droneEye.position.z = (edz / eDist) * 0.08;
          }
        }
        // Propwash: spinning ring on floor beneath drone
        if (!mesh.userData._propwash) {
          const pwGeo = new THREE.RingGeometry(0.15, 0.3, 16);
          pwGeo.rotateX(-Math.PI / 2);
          const pwMat = new THREE.MeshBasicMaterial({
            color: 0xaaccff, transparent: true, opacity: 0.08,
            depthWrite: false, blending: THREE.AdditiveBlending,
          });
          const pw = new THREE.Mesh(pwGeo, pwMat);
          pw.position.set(mesh.position.x, 0.02, mesh.position.z);
          this.scene.add(pw);
          mesh.userData._propwash = pw;
        }
        const pw = mesh.userData._propwash as THREE.Mesh;
        pw.rotation.y = elapsed * 6;
        pw.position.set(mesh.position.x, 0.02, mesh.position.z);
        const pwPulse = 0.06 + Math.sin(elapsed * 4) * 0.03;
        (pw.material as THREE.MeshBasicMaterial).opacity = pwPulse;
      } else if (userData.entityType === EntityType.EscapePod) {
        // Slow pulsing glow + emergency beacon flash
        const podScale = 1 + Math.sin(elapsed * 1.2) * 0.04;
        mesh.scale.set(podScale, podScale, podScale);
        // Beacon: brief bright flash every ~3 seconds
        const beaconPhase = (elapsed * 1.0 + mesh.position.x) % 3.0;
        const beaconFlash = beaconPhase < 0.15 ? 1.0 : 0;
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissiveIntensity = 0.15 + beaconFlash * 0.8;
          }
          if (child instanceof THREE.PointLight) {
            child.intensity = (child.userData._baseIntensity ?? child.intensity) + beaconFlash * 3.0;
            if (!child.userData._baseIntensity) child.userData._baseIntensity = child.intensity;
          }
        });
      } else if (userData.entityType === EntityType.CrewNPC) {
        // Face player when nearby, idle sway when far
        const cdx = this.playerCurrentX - mesh.position.x;
        const cdz = this.playerCurrentZ - mesh.position.z;
        const crewDist = Math.abs(cdx) + Math.abs(cdz);
        if (crewDist < 4 && this.chaseCamActive) {
          // Turn to face player
          const faceAngle = -Math.atan2(cdz, cdx) + Math.PI / 2;
          let crewDiff = faceAngle - mesh.rotation.y;
          while (crewDiff > Math.PI) crewDiff -= Math.PI * 2;
          while (crewDiff < -Math.PI) crewDiff += Math.PI * 2;
          mesh.rotation.y += crewDiff * 0.08; // smooth turn toward player
        } else {
          mesh.rotation.y = Math.sin(elapsed * 0.8 + mesh.position.x * 2) * 0.15;
        }
        // Breathing: subtle Y-scale oscillation with unique phase per crew
        const breathPhase = elapsed * 1.0 + mesh.position.x * 3.7 + mesh.position.z * 5.3;
        const breathScale = 1 + Math.sin(breathPhase) * 0.015;
        mesh.scale.set(1, breathScale, 1);
        // Weight shift: slight lateral lean when idle (not facing player)
        if (crewDist >= 4) {
          mesh.rotation.z = Math.sin(elapsed * 0.4 + mesh.position.z * 2) * 0.03;
        } else {
          mesh.rotation.z = 0;
        }
        // Following crew: green glow aura emissive boost
        if (userData._following) {
          mesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
              child.material.emissive = child.material.emissive || new THREE.Color();
              child.material.emissive.setHex(0x22ff66);
              child.material.emissiveIntensity = 0.2 + Math.sin(elapsed * 2) * 0.1;
            }
          });
        }
      } else if (userData.entityType === EntityType.Console) {
        // Screen flicker + proximity brighten + glow projection pulse
        const conDx = this.playerCurrentX - mesh.position.x;
        const conDz = this.playerCurrentZ - mesh.position.z;
        const conDist = Math.sqrt(conDx * conDx + conDz * conDz);
        const proximityBoost = conDist < 2 ? 0.4 : conDist < 4 ? 0.15 : 0;
        const screenFlicker = Math.sin(elapsed * 8 + mesh.position.x) * 0.15;
        mesh.children.forEach(child => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial) {
            child.material.opacity = 0.2 + proximityBoost + screenFlicker;
          }
          // Pulse screen glow light intensity in sync
          if (child instanceof THREE.PointLight) {
            child.intensity = 0.8 + proximityBoost * 1.5 + screenFlicker * 0.5;
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
        // Heartbeat pulse: double-beat rhythm on cross
        const heartbeat = Math.pow(Math.abs(Math.sin(elapsed * 2.5)), 8) + Math.pow(Math.abs(Math.sin(elapsed * 2.5 + 0.3)), 12) * 0.6;
        const s = 1 + heartbeat * 0.05;
        mesh.scale.set(s, s, s);
        // Pulse red cross glow (children 1,2 are the cross meshes)
        for (let ci = 1; ci <= 2; ci++) {
          const cross = mesh.children[ci];
          if (cross instanceof THREE.Mesh && cross.material instanceof THREE.MeshBasicMaterial) {
            cross.material.color.setRGB(1.0, 0.13 + heartbeat * 0.2, 0.13 + heartbeat * 0.2);
          }
        }
        // Heartbeat PointLight: casts red glow on surroundings
        if (!mesh.userData._heartbeatLight) {
          const hbLight = new THREE.PointLight(0xff2244, 0, 3);
          hbLight.position.set(0, 0.3, 0);
          mesh.add(hbLight);
          mesh.userData._heartbeatLight = hbLight;
        }
        (mesh.userData._heartbeatLight as THREE.PointLight).intensity = heartbeat * 1.2;
      } else if (userData.entityType === EntityType.LogTerminal) {
        // Screen glow flicker + proximity activation + light pulse
        const termDx = this.playerCurrentX - mesh.position.x;
        const termDz = this.playerCurrentZ - mesh.position.z;
        const termDist = Math.sqrt(termDx * termDx + termDz * termDz);
        const termBoost = termDist < 2 ? 0.35 : termDist < 3.5 ? 0.15 : 0;
        const termFlicker = Math.sin(elapsed * 4 + mesh.position.x * 2) * 0.1;
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissiveIntensity = 0.15 + termBoost + termFlicker;
          }
          if (child instanceof THREE.PointLight) {
            child.intensity = 0.5 + termBoost * 0.8 + termFlicker * 0.3;
          }
        });
      } else if (userData.entityType === EntityType.SecurityTerminal) {
        // Surveillance camera: screen flicker + lens tracking + awareness pulse
        const secDx = this.playerCurrentX - mesh.position.x;
        const secDz = this.playerCurrentZ - mesh.position.z;
        const secDist = Math.sqrt(secDx * secDx + secDz * secDz);
        const secBoost = secDist < 2 ? 0.4 : secDist < 3.5 ? 0.15 : 0;
        const secFlicker = Math.sin(elapsed * 8 + mesh.position.x * 3) * 0.08;
        // Lens tracking: point toward player when within range
        const lens = mesh.children[2];
        if (lens && secDist < 5) {
          const trackAngle = Math.atan2(secDx, secDz);
          lens.rotation.y = trackAngle;
          // Lens pulse — faster when closer (surveillance awareness)
          const lensRate = secDist < 2 ? 3.0 : 1.5;
          if (lens instanceof THREE.Mesh && lens.material instanceof THREE.MeshBasicMaterial) {
            const lensPulse = 0.4 + Math.sin(elapsed * lensRate) * 0.3;
            lens.material.opacity = lensPulse;
            lens.material.transparent = true;
            lens.material.color.setHex(secDist < 2 ? 0xff2200 : 0xff4400);
          }
          lens.scale.setScalar(1 + secBoost * 0.3);
        } else if (lens) {
          // Idle sweep
          lens.rotation.y = Math.sin(elapsed * 0.5) * 0.8;
          if (lens instanceof THREE.Mesh && lens.material instanceof THREE.MeshBasicMaterial) {
            lens.material.opacity = 0.5 + Math.sin(elapsed * 1.0) * 0.15;
            lens.material.transparent = true;
            lens.material.color.setHex(0xff0000);
          }
          lens.scale.setScalar(1);
        }
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissiveIntensity = 0.15 + secBoost + secFlicker;
          }
          if (child instanceof THREE.PointLight) {
            child.intensity = 0.3 + secBoost * 0.8 + secFlicker * 0.3;
          }
        });
      } else if (userData.entityType === EntityType.PowerCell || userData.entityType === EntityType.FuseBox) {
        // Electrical flicker with intermittent spark
        const sparkPhase = (elapsed * 2.0 + mesh.position.x * 7 + mesh.position.z * 13) % 4.0;
        const isSparking = sparkPhase < 0.1; // brief spark every ~4 seconds
        const baseEmissive = 0.1 + Math.sin(elapsed * 6 + mesh.position.z) * 0.08;
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissiveIntensity = baseEmissive + (isSparking ? 0.6 : 0);
            if (isSparking) child.material.emissive.setHex(0xffee44);
          }
        });
        // Spawn spark particles during spark phase (once per cycle)
        if (isSparking && !mesh.userData._sparkSpawned) {
          mesh.userData._sparkSpawned = true;
          for (let sp = 0; sp < 4; sp++) {
            const sMat = new THREE.SpriteMaterial({
              color: 0xffee44, transparent: true, opacity: 0.8,
              depthWrite: false, blending: THREE.AdditiveBlending,
            });
            const sSpr = new THREE.Sprite(sMat);
            sSpr.scale.set(0.05, 0.05, 1);
            sSpr.position.set(
              mesh.position.x + (Math.random() - 0.5) * 0.3,
              (mesh.userData.baseY as number ?? 0.3) + Math.random() * 0.2,
              mesh.position.z + (Math.random() - 0.5) * 0.3,
            );
            (sSpr as any)._life = 0;
            (sSpr as any)._maxLife = 0.2 + Math.random() * 0.2;
            (sSpr as any)._driftY = 0.5 + Math.random() * 1.0;
            this.scene.add(sSpr);
            this._discoverySparkles.push(sSpr);
          }
        } else if (!isSparking) {
          mesh.userData._sparkSpawned = false;
        }
      } else if (userData.entityType === EntityType.EvidenceTrace) {
        // Float and spin — attention-grabbing mystery marker with variable speed
        const ud = mesh.userData as { baseY?: number };
        mesh.position.y = (ud.baseY ?? 0.15) + Math.sin(elapsed * 2.0) * 0.1 + Math.sin(elapsed * 0.7) * 0.05;
        mesh.rotation.y = elapsed * 1.2;
        // Scale pulse — "calling out" effect
        const tracePulse = 1 + Math.sin(elapsed * 3 + mesh.position.x) * 0.08;
        mesh.scale.set(tracePulse, tracePulse, tracePulse);
      } else if (userData.entityType === EntityType.CrewItem) {
        // Gentle glow pulse
        const ud = mesh.userData as { baseY?: number };
        mesh.position.y = (ud.baseY ?? 0.1) + Math.sin(elapsed * 1.5 + mesh.position.x) * 0.03;
      } else if (userData.entityType === EntityType.RepairBot) {
        // Hover and wobble
        mesh.position.y = 0.4 + Math.sin(elapsed * 1.8 + mesh.position.z) * 0.06;
        const rbDx = this.playerCurrentX - mesh.position.x;
        const rbDz = this.playerCurrentZ - mesh.position.z;
        const rbDist = Math.abs(rbDx) + Math.abs(rbDz);
        if (rbDist < 3 && this.chaseCamActive) {
          // Face player and extend arm (repair gesture)
          const rbAngle = -Math.atan2(rbDz, rbDx) + Math.PI / 2;
          let rbDiff = rbAngle - mesh.rotation.y;
          while (rbDiff > Math.PI) rbDiff -= Math.PI * 2;
          while (rbDiff < -Math.PI) rbDiff += Math.PI * 2;
          mesh.rotation.y += rbDiff * 0.06;
          const arm = mesh.children[1];
          if (arm) arm.rotation.z = -0.6 + Math.sin(elapsed * 2) * 0.1; // extended
        } else {
          mesh.rotation.y = Math.sin(elapsed * 0.5) * 0.2;
          const arm = mesh.children[1];
          if (arm) arm.rotation.z = -0.4 + Math.sin(elapsed * 1.2 + mesh.position.x) * 0.2;
        }
      } else if (userData.entityType === EntityType.ServiceBot) {
        // Hover and wobble
        mesh.position.y = 0.4 + Math.sin(elapsed * 1.8 + mesh.position.z) * 0.06;
        const sbDx = this.playerCurrentX - mesh.position.x;
        const sbDz = this.playerCurrentZ - mesh.position.z;
        const sbDist = Math.abs(sbDx) + Math.abs(sbDz);
        if (sbDist < 4 && this.chaseCamActive) {
          // Turn body toward player
          const sbAngle = -Math.atan2(sbDz, sbDx) + Math.PI / 2;
          let sbDiff = sbAngle - mesh.rotation.y;
          while (sbDiff > Math.PI) sbDiff -= Math.PI * 2;
          while (sbDiff < -Math.PI) sbDiff += Math.PI * 2;
          mesh.rotation.y += sbDiff * 0.05;
          // Head tracks player more eagerly
          const head = mesh.children[1];
          if (head) {
            let headDiff = sbAngle - (mesh.rotation.y + (head.rotation.y || 0));
            while (headDiff > Math.PI) headDiff -= Math.PI * 2;
            while (headDiff < -Math.PI) headDiff += Math.PI * 2;
            head.rotation.y += headDiff * 0.1;
          }
        } else {
          mesh.rotation.y = Math.sin(elapsed * 0.5) * 0.2;
          const head = mesh.children[1];
          if (head) head.rotation.y = Math.sin(elapsed * 0.7 + mesh.position.z * 3) * 0.4;
        }
      } else if (userData.entityType === EntityType.PatrolDrone) {
        // Patrol sweep motion + propeller spin
        mesh.position.y = 0.7 + Math.sin(elapsed * 2.5) * 0.1;
        mesh.rotation.y = elapsed * 1.5;
        // If GLTF model loaded, spin any child that looks like a rotor
        // For procedural fallback, spin torus ring (child 1)
        const rotor = mesh.children[1];
        if (rotor && (rotor as THREE.Mesh).geometry instanceof THREE.TorusGeometry) {
          rotor.rotation.z = elapsed * 15;
        }
        // Propwash: spinning ring on floor beneath patrol drone
        if (!mesh.userData._propwash) {
          const pwGeo = new THREE.RingGeometry(0.2, 0.4, 16);
          pwGeo.rotateX(-Math.PI / 2);
          const pwMat = new THREE.MeshBasicMaterial({
            color: 0xffaa88, transparent: true, opacity: 0.06,
            depthWrite: false, blending: THREE.AdditiveBlending,
          });
          const pw = new THREE.Mesh(pwGeo, pwMat);
          pw.position.set(mesh.position.x, 0.02, mesh.position.z);
          this.scene.add(pw);
          mesh.userData._propwash = pw;
        }
        const pdPw = mesh.userData._propwash as THREE.Mesh;
        pdPw.rotation.y = elapsed * 8;
        pdPw.position.set(mesh.position.x, 0.02, mesh.position.z);
        const pdPulse = 0.05 + Math.sin(elapsed * 5) * 0.03;
        (pdPw.material as THREE.MeshBasicMaterial).opacity = pdPulse;
      } else if (userData.entityType === EntityType.PressureValve) {
        // Slow valve wheel rotation + pressure-reactive glow
        mesh.rotation.y = elapsed * 0.3;
        // Use stored tile pressure from updateEntities
        const vPressure = (mesh.userData._tilePressure as number) ?? 100;
        const vCritical = vPressure < 40;
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            if (vCritical) {
              child.material.emissive.setHex(0xff4422);
              child.material.emissiveIntensity = 0.3 + Math.sin(elapsed * 4) * 0.2;
            } else {
              child.material.emissive.setHex(0x44bbaa);
              child.material.emissiveIntensity = 0.05 + Math.sin(elapsed * 1.2) * 0.03;
            }
          }
        });
      } else if (userData.entityType === EntityType.RepairCradle) {
        // Mechanical arm oscillation — gentle clamping motion
        const arm1 = mesh.children[1];
        const arm2 = mesh.children[2];
        if (arm1) arm1.rotation.z = -0.3 + Math.sin(elapsed * 0.8) * 0.15;
        if (arm2) arm2.rotation.z = 0.3 - Math.sin(elapsed * 0.8 + 1.0) * 0.15;
        // Subtle platform hum glow
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissive.setHex(0xaaff66);
            child.material.emissiveIntensity = 0.04 + Math.sin(elapsed * 2.0) * 0.02;
          }
        });
      } else if (userData.entityType === EntityType.ClosedDoor) {
        // Locked door tremor when player is near
        const cdDx = this.playerCurrentX - mesh.position.x;
        const cdDz = this.playerCurrentZ - mesh.position.z;
        const cdDist = Math.abs(cdDx) + Math.abs(cdDz);
        if (cdDist < 3 && this.chaseCamActive) {
          mesh.rotation.z = (Math.random() - 0.5) * 0.01;
          mesh.rotation.x = (Math.random() - 0.5) * 0.01;
        } else {
          mesh.rotation.z = 0;
          mesh.rotation.x = 0;
        }
      } else if (userData.entityType === EntityType.Airlock) {
        // Airlock status light sweep — subtle pulsing teal glow
        const alDx = this.playerCurrentX - mesh.position.x;
        const alDz = this.playerCurrentZ - mesh.position.z;
        const alDist = Math.abs(alDx) + Math.abs(alDz);
        const alProx = alDist < 3 ? 0.3 : alDist < 5 ? 0.1 : 0;
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissive.setHex(0x8888cc);
            child.material.emissiveIntensity = 0.05 + alProx + Math.sin(elapsed * 1.5) * 0.03;
          }
        });
      }
    }

    // Proximity entity highlight: boost emissive + pulse ground ring for nearby entities
    if (this.chaseCamActive && this.playerMesh) {
      for (const [, mesh] of this.entityMeshes) {
        const dx = mesh.position.x - this.playerCurrentX;
        const dz = mesh.position.z - this.playerCurrentZ;
        const dist = Math.abs(dx) + Math.abs(dz);
        const boost = dist < 2 ? 0.5 : dist < 4 ? 0.2 : 0;
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            if (boost > 0) {
              child.material.emissiveIntensity = Math.max(child.material.emissiveIntensity, boost);
            }
          }
          // Pulse ground ring opacity when player is nearby
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicMaterial &&
              child.rotation.x === -Math.PI / 2 && child.material.transparent) {
            if (dist < 2) {
              // Close: bright pulsing ring
              child.material.opacity = 0.4 + Math.sin(elapsed * 4) * 0.2;
              child.scale.set(1.2, 1.2, 1.2); // slightly larger
            } else if (dist < 4) {
              child.material.opacity = 0.15 + Math.sin(elapsed * 2) * 0.05;
              child.scale.set(1, 1, 1);
            } else {
              child.material.opacity = 0.1;
              child.scale.set(1, 1, 1);
            }
          }
        });
      }
    }

    // Entity interaction pulse: scale bump + brightness on interact
    for (const [, mesh] of this.entityMeshes) {
      const pulse = (mesh as any)._interactPulse;
      if (pulse > 0.01) {
        const bump = Math.sin(pulse * Math.PI) * 0.15;
        mesh.scale.set(1 + bump, 1 + bump, 1 + bump);
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissiveIntensity = Math.max(child.material.emissiveIntensity, pulse * 0.8);
          }
        });
        (mesh as any)._interactPulse = pulse - delta * 3; // decay over ~0.3s
      } else if (pulse !== undefined && pulse <= 0.01) {
        mesh.scale.set(1, 1, 1);
        (mesh as any)._interactPulse = 0;
      }
    }

    // Floating interact indicator: bobbing arrow above nearest interactable entity
    if (this.chaseCamActive) {
      let nearestInteractMesh: THREE.Object3D | null = null;
      let nearestInteractDist = 999;
      for (const [, mesh] of this.entityMeshes) {
        if (mesh.userData._exhausted) continue;
        const dx = mesh.position.x - this.playerCurrentX;
        const dz = mesh.position.z - this.playerCurrentZ;
        const dist = Math.abs(dx) + Math.abs(dz);
        if (dist < 1.8 && dist < nearestInteractDist) {
          nearestInteractDist = dist;
          nearestInteractMesh = mesh;
        }
      }
      if (nearestInteractMesh) {
        if (!this._interactIndicator) {
          const indMat = new THREE.SpriteMaterial({
            color: 0x88ffcc, transparent: true, opacity: 0.7,
            depthWrite: false, blending: THREE.AdditiveBlending,
          });
          this._interactIndicator = new THREE.Sprite(indMat);
          this._interactIndicator.scale.set(0.15, 0.15, 1);
          this.scene.add(this._interactIndicator);
        }
        this._interactIndicator.visible = true;
        const bob = Math.sin(elapsed * 3) * 0.08;
        const entityHeight = (nearestInteractMesh.userData.baseY as number ?? 0.3) + 0.5;
        this._interactIndicator.position.set(
          nearestInteractMesh.position.x,
          entityHeight + 0.3 + bob,
          nearestInteractMesh.position.z,
        );
        const indMat = this._interactIndicator.material as THREE.SpriteMaterial;
        indMat.opacity = 0.5 + Math.sin(elapsed * 4) * 0.2;
      } else if (this._interactIndicator) {
        this._interactIndicator.visible = false;
      }
    } else if (this._interactIndicator) {
      this._interactIndicator.visible = false;
    }

    // Player light: breathing pulse + room entry bloom
    if (this.playerLight) {
      const baseIntensity = 2.5 + Math.sin(elapsed * 1.5) * 0.3;
      // Room entry bloom: briefly flash brighter when entering a room
      const bloom = this.roomLightBoost > 0.1 ? this.roomLightBoost * 2.0 : 0;
      this.playerLight.intensity = baseIntensity + bloom;
    }

    // Headlight: intensity flutter, hazard-reactive color, corridor brightness, damage flicker
    if (this.headlight) {
      const inRoom = this._currentRoom !== null;
      const baseIntensity = inRoom ? 1.8 : 2.8;
      let headlightIntensity = baseIntensity + Math.sin(elapsed * 3.7) * 0.2 + Math.sin(elapsed * 7.3) * 0.1;
      // Damage flicker: headlight flickers when HP is low
      if (this._playerHpPercent < 0.6) {
        const flickerSeverity = 1 - this._playerHpPercent / 0.6; // 0 at 60%, 1 at 0%
        // Multi-frequency flicker for irregular pattern
        const flick1 = Math.sin(elapsed * 13.7 + 2.1) > (0.4 + flickerSeverity * 0.4) ? 0 : 1;
        const flick2 = Math.sin(elapsed * 7.3 + 0.5) > (0.6 + flickerSeverity * 0.2) ? 0 : 1;
        const flickerMult = 0.3 + 0.7 * Math.min(flick1, flick2);
        headlightIntensity *= (1 - flickerSeverity * 0.6) + flickerSeverity * 0.6 * flickerMult;
      }
      this.headlight.intensity = headlightIntensity;
      this._headlightFlickerRatio = headlightIntensity / baseIntensity;

      // Headlight color reacts to room hazards
      if (this._currentRoom) {
        const hazeMesh = this.roomHazeMeshes.get(this._currentRoom.id);
        const hazeColor = hazeMesh ? (hazeMesh.material as THREE.MeshBasicMaterial).color.getHex() : 0;
        if (hazeColor === 0xff3300) {
          this.headlight.color.setHex(0xffcc88); // warm orange in hot rooms
        } else if (hazeColor === 0x4488cc) {
          this.headlight.color.setHex(0x88ccff); // cold blue in vacuum
        } else {
          this.headlight.color.setHex(0xeeffff); // default cool white
        }
      } else {
        this.headlight.color.setHex(0xeeffff);
      }

      // Volumetric cone visibility: brighter in corridors (dusty), dimmer in rooms
      // Syncs with damage flicker via stored flicker ratio
      if (this.playerMesh) {
        this.playerMesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.userData?.isHeadlightCone) {
            const targetOpacity = (inRoom ? 0.015 : 0.045) * this._headlightFlickerRatio;
            const mat = child.material as THREE.MeshBasicMaterial;
            mat.opacity += (targetOpacity - mat.opacity) * 0.1; // faster tracking for flicker
            mat.color.copy(this.headlight!.color); // match headlight color
          }
        });
      }
    }

    // Headlight ground spot: positioned 2-3 tiles ahead of player in facing direction
    if (this._headlightSpot && this.chaseCamActive) {
      const facing = this.playerMesh ? this.playerMesh.rotation.y : this.playerFacing;
      const spotDist = 2.5; // tiles ahead
      const spotX = this.playerCurrentX + Math.sin(facing) * spotDist;
      const spotZ = this.playerCurrentZ + Math.cos(facing) * spotDist;
      this._headlightSpot.position.set(spotX, 0.015, spotZ);
      this._headlightSpot.rotation.z = -facing; // align elongation with facing
      const spotMat = this._headlightSpot.material as THREE.MeshBasicMaterial;
      const inRoom = this._currentRoom !== null;
      const targetOpacity = (inRoom ? 0.03 : 0.08) * this._headlightFlickerRatio;
      spotMat.opacity += (targetOpacity - spotMat.opacity) * 0.1;
      // Match headlight color
      if (this.headlight) spotMat.color.copy(this.headlight.color);
      this._headlightSpot.visible = true;
    } else if (this._headlightSpot) {
      this._headlightSpot.visible = false;
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

    // Emergency wall strip pulse: slow red throb
    if (this.emergencyStripInstanced && this.emergencyStripInstanced.count > 0) {
      const mat = this.emergencyStripInstanced.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.3 + Math.abs(Math.sin(elapsed * 2.5)) * 0.5;
    }

    // Room entry light boost: decay over time
    if (this.roomLightBoost > 0.01) {
      this.roomLightBoost *= Math.max(0, 1 - delta * 2.5); // fade over ~0.4s
    } else {
      this.roomLightBoost = 0;
    }

    // Room transition fade: decay from black to clear
    if (this._roomTransitionFade > 0.01) {
      this._roomTransitionFade *= Math.max(0, 1 - delta * 3.0); // fade over ~0.3s
    } else {
      this._roomTransitionFade = 0;
    }

    // Room center glow: warm light, hazard-reactive
    if (this._currentRoom) {
      if (!this._roomCenterGlow) {
        this._roomCenterGlow = new THREE.PointLight(0xffeedd, 0, 10);
        this._roomCenterGlow.position.set(0, 1.5, 0);
        this.scene.add(this._roomCenterGlow);
      }
      const cx = this._currentRoom.x + this._currentRoom.width / 2;
      const cz = this._currentRoom.y + this._currentRoom.height / 2;

      // Check room hazard state for dramatic lighting
      const hazeMesh = this.roomHazeMeshes.get(this._currentRoom.id);
      const hazeColor = hazeMesh ? (hazeMesh.material as THREE.MeshBasicMaterial).color.getHex() : 0;
      let glowColor: number;
      let glowIntensity: number;

      if (hazeColor === 0xff3300) {
        // Hot room: pulsing red-orange glow, brighter
        glowColor = 0xff4400;
        glowIntensity = 1.5 + Math.sin(elapsed * 2.0) * 0.5;
      } else if (hazeColor === 0x444444) {
        // Smoky room: dim, flickering amber
        glowColor = 0xaa6600;
        glowIntensity = 0.6 + Math.random() * 0.3; // unstable flicker
      } else if (hazeColor === 0x4488cc) {
        // Vacuum room: cold blue, steady but dim
        glowColor = 0x4488cc;
        glowIntensity = 0.8;
      } else {
        // Normal room: warm room-tinted glow
        glowColor = ROOM_LIGHT_COLORS[this._currentRoom.name] ?? 0xffeedd;
        glowIntensity = 1.2;
      }

      this._roomCenterGlow.color.setHex(glowColor);
      const targetIntensity = glowIntensity + this.roomLightBoost * 0.5;
      this._roomCenterGlow.intensity += (targetIntensity - this._roomCenterGlow.intensity) * 0.1;
      this._roomCenterGlow.position.set(cx, 1.5, cz);
      this._roomCenterGlow.visible = true;
    } else if (this._roomCenterGlow) {
      // In corridor — fade out room glow
      this._roomCenterGlow.intensity *= 0.9;
      if (this._roomCenterGlow.intensity < 0.05) this._roomCenterGlow.visible = false;
    }

    // Room lights: emergency flicker for red/amber lights, + room entry boost
    // Also hide lights for rooms not in view
    for (const [roomId, light] of this.roomLights) {
      if (!this._visibleRoomIds.has(roomId)) {
        light.visible = false;
        continue;
      }
      light.visible = true;
      const c = light.color.getHex();
      if (c === 0xff2200) {
        // Red emergency strobe — fast harsh pulse
        light.intensity = 0.3 + Math.abs(Math.sin(elapsed * 4)) * 1.2;
      } else if (c === 0xff8800) {
        // Amber warning — slower gentle pulse
        light.intensity = 0.5 + Math.sin(elapsed * 2) * 0.4;
      } else if (this.roomLightBoost > 0.01 && roomId === this.lastRoomId) {
        // Room entry boost: temporarily brighten the current room's light
        light.intensity = 1.2 + this.roomLightBoost;
      }
    }

    // Corridor light flicker: subtle atmospheric pulsing
    for (let i = 0; i < this.corridorLightList.length; i++) {
      const cl = this.corridorLightList[i];
      const base = (cl as any)._baseIntensity ?? 0.6;
      const isHazard = (cl as any)._isHazard;
      // Each light gets a unique phase offset from its position
      const phase = elapsed * (isHazard ? 3.5 : 1.2) + cl.position.x * 7.3 + cl.position.z * 11.7;
      if (isHazard) {
        // Hazardous corridors: aggressive flicker with occasional dropout
        const flicker = Math.sin(phase) * Math.sin(phase * 2.7);
        cl.intensity = flicker > 0.3 ? base * (0.4 + Math.random() * 0.6) : base * 0.1;
      } else {
        // Normal corridors: gentle subtle breathing
        cl.intensity = base * (0.85 + Math.sin(phase) * 0.15);
      }
    }

    // Light shaft animation: pulse opacity, distance-based visibility
    for (let i = 0; i < this._lightShaftMeshes.length; i++) {
      const shaft = this._lightShaftMeshes[i];
      const dx = shaft.position.x - this.playerCurrentX;
      const dz = shaft.position.z - this.playerCurrentZ;
      const dist = Math.abs(dx) + Math.abs(dz);
      // Only visible when nearby (within corridor view range + some margin)
      if (dist > 8) {
        shaft.visible = false;
        continue;
      }
      shaft.visible = true;
      const mat = shaft.material as THREE.MeshBasicMaterial;
      const phase = elapsed * 1.0 + shaft.position.x * 5.3 + shaft.position.z * 7.1;
      const isHazard = shaft.userData.isHazard;
      if (isHazard) {
        // Hazard shafts: erratic flicker, occasionally drop out
        const flick = Math.sin(phase * 3.5) * Math.sin(phase * 2.7);
        mat.opacity = flick > 0.2 ? 0.06 : 0.01;
      } else {
        // Normal: gentle breathing
        mat.opacity = 0.03 + Math.sin(phase) * 0.015;
      }
      // Distance fade: dimmer further from player
      const distFade = 1 - (dist / 8);
      mat.opacity *= distFade;
    }

    // Floor light pool animation: subtle pulse synced with shafts
    for (let i = 0; i < this._floorPoolMeshes.length; i++) {
      const pool = this._floorPoolMeshes[i];
      const dx = pool.position.x - this.playerCurrentX;
      const dz = pool.position.z - this.playerCurrentZ;
      const dist = Math.abs(dx) + Math.abs(dz);
      if (dist > 8) { pool.visible = false; continue; }
      pool.visible = true;
      const mat = pool.material as THREE.MeshBasicMaterial;
      const phase = elapsed * 1.0 + pool.position.x * 5.3 + pool.position.z * 7.1;
      const isHazard = pool.userData.isHazard;
      if (isHazard) {
        mat.opacity = Math.sin(phase * 3.5) > 0.2 ? 0.1 : 0.02;
      } else {
        mat.opacity = 0.06 + Math.sin(phase) * 0.02;
      }
      mat.opacity *= (1 - dist / 8);
    }

    // Wall status LED blink animation
    for (let i = 0; i < this._wallLEDs.length; i++) {
      const led = this._wallLEDs[i];
      if (!led.parent?.visible) continue; // skip if in culled room group
      const phase = (led as any)._ledPhase;
      // Slow blink with occasional rapid flash
      const blinkCycle = (elapsed + phase) % 4.0;
      let opacity = 0.1; // dim baseline
      if (blinkCycle < 0.15) opacity = 0.6; // brief bright flash
      else if (blinkCycle > 2.0 && blinkCycle < 2.1) opacity = 0.4; // secondary blink
      (led.material as THREE.SpriteMaterial).opacity = opacity;
    }

    // Room hazard fog pulse animation
    for (const [, hazeMesh] of this.roomHazeMeshes) {
      const mat = hazeMesh.material as THREE.MeshBasicMaterial;
      const c = mat.color.getHex();
      if (c === 0xff3300) {
        // Heat fog: slow throb
        mat.opacity *= 0.85 + Math.sin(elapsed * 1.5 + hazeMesh.position.x * 2) * 0.15;
      } else if (c === 0x444444) {
        // Smoke fog: gentle swirl via Y-position drift
        hazeMesh.position.y = 0.4 + Math.sin(elapsed * 0.8 + hazeMesh.position.z) * 0.05;
      } else if (c === 0x4488cc) {
        // Frost: subtle shimmer
        mat.opacity *= 0.9 + Math.sin(elapsed * 2.5 + hazeMesh.position.x * 3) * 0.1;
      }
    }

    // Hazard sprite animations
    for (const child of this.hazardSprites.children) {
      if (!(child instanceof THREE.Sprite)) continue;
      const ud = child.userData as { hazardType?: string; baseY?: number; baseX?: number; baseZ?: number };
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
      } else if (ud.hazardType === "spark") {
        // Electric sparks: rapid random flicker + jitter
        const mat = child.material as THREE.SpriteMaterial;
        const phase = elapsed * 12 + (ud.baseX ?? 0) * 7 + (ud.baseZ ?? 0) * 11;
        const flicker = Math.sin(phase) * Math.sin(phase * 2.3) > 0.2;
        mat.opacity = flicker ? 0.7 + Math.random() * 0.3 : 0.05;
        const jitter = 0.04;
        child.position.x = (ud.baseX ?? 0) + (Math.random() - 0.5) * jitter;
        child.position.z = (ud.baseZ ?? 0) + (Math.random() - 0.5) * jitter;
        const s = flicker ? 0.08 + Math.random() * 0.1 : 0.04;
        child.scale.set(s, s, 1);
      } else if (ud.hazardType === "drip") {
        // Dripping condensation: fall down, reset at top
        child.position.y -= delta * 0.8;
        const mat = child.material as THREE.SpriteMaterial;
        const fallDist = (ud.baseY ?? 1.5) - child.position.y;
        mat.opacity = Math.max(0, 0.5 - fallDist * 0.3);
        if (child.position.y < 0.05) {
          // Reset to ceiling with slight random offset
          child.position.y = ud.baseY ?? 1.5;
          child.position.x = (ud.baseX ?? 0) + (Math.random() - 0.5) * 0.1;
          mat.opacity = 0.5;
        }
      }
    }

    // Door light animations: locked doors pulse red, unlocked brighten on approach
    for (const [key, light] of this.doorLights) {
      // Parse position from key "door_x,y"
      const parts = key.replace("door_", "").split(",");
      const dx = parseInt(parts[0]), dy = parseInt(parts[1]);
      const dist = Math.abs(this.playerCurrentX - dx) + Math.abs(this.playerCurrentZ - dy);
      light.visible = dist <= BrowserDisplay3D.CORRIDOR_VIEW_RANGE + 3;
      if (light.color.getHex() === 0xff3333) {
        // Locked: pulsing red warning
        light.intensity = 0.3 + Math.sin(elapsed * 2) * 0.3;
      } else {
        // Unlocked: brightens as player approaches (motion sensor effect)
        const proximityBoost = dist < 2 ? 0.8 : dist < 4 ? 0.3 : 0;
        light.intensity = 0.4 + proximityBoost + Math.sin(elapsed * 1.5) * 0.05;
      }
    }

    // Edge glow strip pulse: subtle breathing for sci-fi atmosphere
    if (this.trimGlowInstanced) {
      const mat = this.trimGlowInstanced.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.45 + Math.sin(elapsed * 0.8) * 0.15;
    }

    // Room lights: subtle generator hum oscillation for non-emergency rooms
    for (const [roomId, light] of this.roomLights) {
      const c = light.color.getHex();
      if (c !== 0xff2200 && c !== 0xff8800 && roomId !== this.lastRoomId) {
        // Normal rooms get subtle brightness oscillation (generator hum)
        light.intensity = 1.2 + Math.sin(elapsed * 1.0 + light.position.x * 2.3 + light.position.z * 3.7) * 0.1;
      }
    }

    // Relay power line pulse animation
    for (let i = 0; i < this.relayPowerLines.length; i++) {
      const line = this.relayPowerLines[i];
      const mat = line.material as THREE.LineBasicMaterial;
      const phase = elapsed * 2 + i * 1.5;
      mat.opacity = 0.25 + Math.sin(phase) * 0.15;
    }

    // Energy dots: travel along relay power line curves
    for (let i = 0; i < this._relayEnergyDots.length; i++) {
      const ed = this._relayEnergyDots[i];
      ed.t = (ed.t + delta * 0.4) % 1.0; // travel speed
      const pos = ed.curve.getPoint(ed.t);
      ed.sprite.position.copy(pos);
      // Pulse brightness as it travels
      const pulse = 0.6 + Math.sin(ed.t * Math.PI * 2) * 0.3;
      (ed.sprite.material as THREE.SpriteMaterial).opacity = pulse;
    }

    // Particle animations
    this.animateParticles(elapsed, delta);

    // Corridor steam vent puffs — atmospheric detail near player
    if (this.chaseCamActive && !this._currentRoom) {
      this._steamVentTimer -= delta;
      if (this._steamVentTimer <= 0) {
        this._steamVentTimer = 1.5 + Math.random() * 3.0; // every 1.5-4.5 seconds
        // Spawn a small steam puff near the player
        const angle = Math.random() * Math.PI * 2;
        const dist = 1.5 + Math.random() * 2;
        const sx = this.playerCurrentX + Math.cos(angle) * dist;
        const sz = this.playerCurrentZ + Math.sin(angle) * dist;
        const mat = new THREE.SpriteMaterial({
          color: 0xaabbcc, transparent: true, opacity: 0.3,
          depthWrite: false, blending: THREE.AdditiveBlending,
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(0.12, 0.12, 1);
        sprite.position.set(sx, 0.3, sz);
        (sprite as any)._life = 0;
        (sprite as any)._maxLife = 0.8 + Math.random() * 0.5;
        this.scene.add(sprite);
        this._steamVentSprites.push(sprite);
      }
    }
    // Animate active steam puffs
    for (let i = this._steamVentSprites.length - 1; i >= 0; i--) {
      const s = this._steamVentSprites[i];
      (s as any)._life += delta;
      const life = (s as any)._life;
      const maxLife = (s as any)._maxLife;
      if (life >= maxLife) {
        this.scene.remove(s);
        (s.material as THREE.SpriteMaterial).dispose();
        this._steamVentSprites.splice(i, 1);
        continue;
      }
      const t = life / maxLife;
      s.position.y += delta * 0.4; // drift upward
      s.scale.set(0.12 + t * 0.2, 0.12 + t * 0.2, 1); // expand
      (s.material as THREE.SpriteMaterial).opacity = 0.3 * (1 - t); // fade
    }

    // Pipe steam leaks — small drips from overhead corridor pipes
    if (this.chaseCamActive && !this._currentRoom) {
      this._pipeLeakTimer -= delta;
      if (this._pipeLeakTimer <= 0) {
        this._pipeLeakTimer = 3.0 + Math.random() * 5.0; // every 3-8 seconds
        // Find a nearby pipe tile to leak from
        const px = Math.round(this.playerCurrentX);
        const pz = Math.round(this.playerCurrentZ);
        let bestKey = "";
        let bestDist = 999;
        for (const key of this.corridorPipeTiles) {
          const [kx, ky] = key.split(",").map(Number);
          const d = Math.abs(kx - px) + Math.abs(ky - pz);
          if (d < bestDist && d > 0 && d < 6) {
            bestDist = d;
            bestKey = key;
          }
        }
        if (bestKey) {
          const [lx, ly] = bestKey.split(",").map(Number);
          const leakMat = new THREE.SpriteMaterial({
            color: 0x99bbdd, transparent: true, opacity: 0.25,
            depthWrite: false, blending: THREE.AdditiveBlending,
          });
          const leak = new THREE.Sprite(leakMat);
          leak.scale.set(0.06, 0.06, 1);
          leak.position.set(lx + (Math.random() - 0.5) * 0.3, 1.7, ly + (Math.random() - 0.5) * 0.3);
          (leak as any)._life = 0;
          (leak as any)._maxLife = 0.6 + Math.random() * 0.4;
          (leak as any)._driftX = (Math.random() - 0.5) * 0.3;
          (leak as any)._driftZ = (Math.random() - 0.5) * 0.3;
          this.scene.add(leak);
          this._pipeLeakSprites.push(leak);
        }
      }
    }
    // Animate pipe leak sprites
    for (let i = this._pipeLeakSprites.length - 1; i >= 0; i--) {
      const lk = this._pipeLeakSprites[i];
      (lk as any)._life += delta;
      const life = (lk as any)._life;
      const maxLife = (lk as any)._maxLife;
      if (life >= maxLife) {
        this.scene.remove(lk);
        (lk.material as THREE.SpriteMaterial).dispose();
        this._pipeLeakSprites.splice(i, 1);
        continue;
      }
      const t = life / maxLife;
      lk.position.y -= delta * 1.2; // fall downward
      lk.position.x += (lk as any)._driftX * delta;
      lk.position.z += (lk as any)._driftZ * delta;
      lk.scale.set(0.06 + t * 0.08, 0.06 + t * 0.15, 1); // stretch vertically as it falls
      (lk.material as THREE.SpriteMaterial).opacity = 0.25 * (1 - t * t); // quadratic fade
    }

    // Animate discovery sparkles
    for (let i = this._discoverySparkles.length - 1; i >= 0; i--) {
      const sp = this._discoverySparkles[i];
      (sp as any)._life += delta;
      const life = (sp as any)._life;
      const maxLife = (sp as any)._maxLife;
      if (life >= maxLife) {
        this.scene.remove(sp);
        (sp.material as THREE.SpriteMaterial).dispose();
        this._discoverySparkles.splice(i, 1);
        continue;
      }
      const t = life / maxLife;
      sp.position.y += delta * (sp as any)._driftY;
      // Twinkle: rapid opacity oscillation that fades out
      const twinkle = Math.sin(life * 15) * 0.5 + 0.5;
      (sp.material as THREE.SpriteMaterial).opacity = 0.6 * (1 - t) * twinkle;
      const s = 0.08 + t * 0.04;
      sp.scale.set(s, s, 1);
    }

    // Animate footstep dust kicks
    for (let i = this._dustKickSprites.length - 1; i >= 0; i--) {
      const d = this._dustKickSprites[i];
      (d as any)._life += delta;
      const life = (d as any)._life;
      const maxLife = (d as any)._maxLife;
      if (life >= maxLife) {
        this.scene.remove(d);
        (d.material as THREE.SpriteMaterial).dispose();
        this._dustKickSprites.splice(i, 1);
        continue;
      }
      const t = life / maxLife;
      d.position.y += delta * 0.15; // gentle rise
      const s = 0.06 + t * 0.12; // expand from 0.06 to 0.18
      d.scale.set(s, s, 1);
      (d.material as THREE.SpriteMaterial).opacity = 0.2 * (1 - t * t); // quadratic fade
    }

    // Animate corridor breath puffs
    for (let i = this._breathPuffSprites.length - 1; i >= 0; i--) {
      const bp = this._breathPuffSprites[i];
      (bp as any)._life += delta;
      const life = (bp as any)._life;
      const maxLife = (bp as any)._maxLife;
      if (life >= maxLife) {
        this.scene.remove(bp);
        (bp.material as THREE.SpriteMaterial).dispose();
        this._breathPuffSprites.splice(i, 1);
        continue;
      }
      const t = life / maxLife;
      bp.position.x += (bp as any)._dirX * delta;
      bp.position.z += (bp as any)._dirZ * delta;
      bp.position.y += delta * 0.1;
      const s = 0.05 + t * 0.15; // expand
      bp.scale.set(s, s, 1);
      (bp.material as THREE.SpriteMaterial).opacity = 0.15 * (1 - t); // linear fade
    }

    // Distance culling: update every 5 frames to amortize cost
    this._cullFrame++;
    if (this._cullFrame % 5 === 0) {
      this.updateDistanceCulling();
    }

    // Render: use outline effect or plain renderer
    if (this.outlineEnabled) {
      this.outlineEffect.render(this.scene, this.camera);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  };

  // ── Private: tile updates ───────────────────────────────────────

  private updateTiles(state: GameState): void {
    let floorIdx = 0;
    let corridorIdx = 0;
    let wallIdx = 0;
    let doorIdx = 0;
    let ceilIdx = 0;

    const tempColor = new THREE.Color();

    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const tile = state.tiles[y][x];

        // Skip unexplored tiles (fog covers them)
        if (!tile.explored) continue;

        // Room-focused rendering: skip tiles outside current view
        if (!this.isTileInView(x, y, state)) continue;

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
          const isLocked = tile.type === TileType.LockedDoor;

          // Orient door to face corridor direction (check horizontal vs vertical)
          const openE = x < state.width - 1 && state.tiles[y][x + 1].walkable;
          const openW = x > 0 && state.tiles[y][x - 1].walkable;
          const isHorizontal = openE || openW;

          // Sliding door: unlocked doors slide open when player is within 1 tile
          const px = state.player.entity.pos.x;
          const py = state.player.entity.pos.y;
          const playerDist = Math.abs(x - px) + Math.abs(y - py);
          const shouldOpen = !isLocked && playerDist <= 1;

          // Smooth slide: track door open state
          const doorKey = `${x},${y}`;
          const prevSlide = this._doorSlideState.get(doorKey) ?? 0;
          const targetSlide = shouldOpen ? 0.45 : 0; // each half slides 0.45 units
          const slideAmount = prevSlide + (targetSlide - prevSlide) * 0.15; // smooth lerp
          this._doorSlideState.set(doorKey, slideAmount);

          // Door hiss effect: spawn particles when door begins opening
          if (prevSlide < 0.02 && slideAmount > 0.02) {
            this.spawnDoorHissParticles(x, y, isHorizontal);
          }

          tempColor.setHex(doorColor);
          if (!tile.visible) tempColor.multiplyScalar(0.4);

          // Split door: two half-panels that slide apart
          for (let half = 0; half < 2; half++) {
            const sign = half === 0 ? -1 : 1; // left half slides negative, right positive
            const halfOffset = sign * (0.21 + slideAmount); // 0.21 = half of 0.42 panel width

            if (isHorizontal) {
              this.dummy.position.set(x, 1.0, y + halfOffset);
              this.dummy.rotation.set(0, Math.PI / 2, 0);
            } else {
              this.dummy.position.set(x + halfOffset, 1.0, y);
              this.dummy.rotation.set(0, 0, 0);
            }
            this.dummy.scale.set(1, 1, 1);
            this.dummy.updateMatrix();
            if (doorIdx < 400) {
              this.doorMesh.setMatrixAt(doorIdx, this.dummy.matrix);
              this.doorMesh.setColorAt(doorIdx, tempColor);
              doorIdx++;
            }
          }
          // Ceiling above door (flush with walls — no gap)
          this.dummy.position.set(x, 2.0, y);
          this.dummy.rotation.set(0, 0, 0);
          this.dummy.scale.set(1, 1, 1);
          this.dummy.updateMatrix();
          this.ceilingMesh.setMatrixAt(ceilIdx, this.dummy.matrix);
          tempColor.setRGB(0.12, 0.15, 0.18);
          if (!tile.visible) tempColor.multiplyScalar(0.5);
          this.ceilingMesh.setColorAt(ceilIdx, tempColor);
          ceilIdx++;
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
                  // Blend from nearby room color (25%)
                  const cr = ((COLORS_3D.corridor >> 16) & 0xff) * 0.75 + ((tint >> 16) & 0xff) * 0.25;
                  const cg = ((COLORS_3D.corridor >> 8) & 0xff) * 0.75 + ((tint >> 8) & 0xff) * 0.25;
                  const cb = (COLORS_3D.corridor & 0xff) * 0.75 + (tint & 0xff) * 0.25;
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
                  // Blend floor color with room tint (45% tint for strong zone identity)
                  const r = ((COLORS_3D.floor >> 16) & 0xff) * 0.55 + ((tint >> 16) & 0xff) * 0.45;
                  const g = ((COLORS_3D.floor >> 8) & 0xff) * 0.55 + ((tint >> 8) & 0xff) * 0.45;
                  const b = (COLORS_3D.floor & 0xff) * 0.55 + (tint & 0xff) * 0.45;
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

          // Subtle checkerboard floor pattern for visual texture
          if (tile.type !== TileType.Corridor && (x + y) % 2 === 0) {
            const cr = Math.max(0, ((baseColor >> 16) & 0xff) - 8);
            const cg = Math.max(0, ((baseColor >> 8) & 0xff) - 8);
            const cb = Math.max(0, (baseColor & 0xff) - 8);
            baseColor = (cr << 16) | (cg << 8) | cb;
          }

          // Simulated ambient occlusion: darken floor tiles adjacent to walls
          if (tile.visible) {
            let wallAdj = 0;
            if (y > 0 && state.tiles[y - 1][x].type === TileType.Wall) wallAdj++;
            if (y < state.height - 1 && state.tiles[y + 1][x].type === TileType.Wall) wallAdj++;
            if (x > 0 && state.tiles[y][x - 1].type === TileType.Wall) wallAdj++;
            if (x < state.width - 1 && state.tiles[y][x + 1].type === TileType.Wall) wallAdj++;
            if (wallAdj > 0) {
              // Darken proportionally — 1 wall = 12%, 2 walls = 20%, 3+ = 28%
              const aoFactor = wallAdj === 1 ? 0.88 : wallAdj === 2 ? 0.80 : 0.72;
              const ar = Math.round(((baseColor >> 16) & 0xff) * aoFactor);
              const ag = Math.round(((baseColor >> 8) & 0xff) * aoFactor);
              const ab = Math.round((baseColor & 0xff) * aoFactor);
              baseColor = (ar << 16) | (ag << 8) | ab;
            }
          }

          // Room floors sit slightly higher, corridors lower — creates depth contrast
          const floorY = tile.type === TileType.Corridor ? -0.06 : 0;
          this.dummy.position.set(x, floorY, y);
          this.dummy.scale.set(1, 1, 1);
          this.dummy.updateMatrix();

          tempColor.setHex(baseColor);
          if (!tile.visible) tempColor.multiplyScalar(brightness);

          // Route to corridor or room floor mesh
          if (tile.type === TileType.Corridor) {
            this.corridorFloorMesh.setMatrixAt(corridorIdx, this.dummy.matrix);
            this.corridorFloorMesh.setColorAt(corridorIdx, tempColor);
            corridorIdx++;
          } else {
            this.floorMesh.setMatrixAt(floorIdx, this.dummy.matrix);
            this.floorMesh.setColorAt(floorIdx, tempColor);
            floorIdx++;
          }

          // Ceiling panel above this walkable tile
          this.dummy.position.set(x, 2.05, y);
          this.dummy.updateMatrix();
          this.ceilingMesh.setMatrixAt(ceilIdx, this.dummy.matrix);
          // Ceiling color: slightly darker version of floor for consistency
          const ceilR = Math.max(0, ((baseColor >> 16) & 0xff) >> 2);
          const ceilG = Math.max(0, ((baseColor >> 8) & 0xff) >> 2);
          const ceilB = Math.max(0, (baseColor & 0xff) >> 2);
          tempColor.setRGB(ceilR / 255, ceilG / 255, ceilB / 255);
          if (!tile.visible) tempColor.multiplyScalar(0.5);
          this.ceilingMesh.setColorAt(ceilIdx, tempColor);
          ceilIdx++;
        }
      }
    }

    // Set instance count to only render used instances
    this.floorMesh.count = floorIdx;
    this.corridorFloorMesh.count = corridorIdx;
    this.wallMesh.count = wallIdx;
    this.wallCornerMesh.count = 0;
    this.doorMesh.count = doorIdx;
    this.ceilingMesh.count = ceilIdx;

    this.floorMesh.instanceMatrix.needsUpdate = true;
    this.corridorFloorMesh.instanceMatrix.needsUpdate = true;
    this.wallMesh.instanceMatrix.needsUpdate = true;
    this.wallCornerMesh.instanceMatrix.needsUpdate = true;
    this.ceilingMesh.instanceMatrix.needsUpdate = true;
    this.doorMesh.instanceMatrix.needsUpdate = true;
    if (this.floorMesh.instanceColor) this.floorMesh.instanceColor.needsUpdate = true;
    if (this.corridorFloorMesh.instanceColor) this.corridorFloorMesh.instanceColor.needsUpdate = true;
    if (this.wallMesh.instanceColor) this.wallMesh.instanceColor.needsUpdate = true;
    if (this.wallCornerMesh.instanceColor) this.wallCornerMesh.instanceColor.needsUpdate = true;
    if (this.doorMesh.instanceColor) this.doorMesh.instanceColor.needsUpdate = true;
    if (this.ceilingMesh.instanceColor) this.ceilingMesh.instanceColor.needsUpdate = true;
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
      "models/synty-gltf/SM_X-ray.glb",
      "models/synty-gltf/SM_First-aid_Kit.glb",
      "models/synty-gltf/SM_Syringe.glb",
    ],
    "Engineering Storage": [
      "models/synty-space-gltf/SM_Prop_Barrel_01.glb",
      "models/synty-space-gltf/SM_Prop_Detail_Box_02.glb",
      "models/synty-space-gltf/SM_Prop_Cart_01.glb",
      "models/synty-space-gltf/SM_Prop_Detail_Box_01.glb",
      "models/synty-gltf/SM_Barrel_Oxygen.glb",
      "models/synty-gltf/SM_Canister.glb",
      "models/synty-gltf/SM_Floor_Locker_01.glb",
      "models/synty-gltf/SM_Fuel_Tank.glb",
    ],
    "Life Support": [
      "models/synty-space-gltf/SM_Prop_AirVent_Large_01.glb",
      "models/synty-space-gltf/SM_Prop_Oxygen_Tank.glb",
      "models/synty-space-gltf/SM_Prop_AirVent_Small_01.glb",
      "models/synty-space-gltf/SM_Prop_Oxygen_Tank_Small.glb",
      "models/synty-gltf/SM_Ventilation.glb",
      "models/synty-gltf/SM_Water_Tank.glb",
      "models/synty-gltf/SM_Water_boiler.glb",
      "models/synty-gltf/SM_Valve.glb",
    ],
    "Data Core": [
      "models/synty-space-gltf/SM_Prop_CenterTube_02.glb",
      "models/synty-space-gltf/SM_Prop_Screen_02.glb",
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_01.glb",
      "models/synty-gltf/SM_Computer.glb",
      "models/synty-gltf/SM_Screen.glb",
      "models/synty-gltf/SM_Floor_Locker_01.glb",
      "models/synty-gltf/SM_Device_01.glb",
    ],
    "Robotics Bay": [
      "models/synty-space-gltf/SM_Prop_Desk_Small_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_Small_01.glb",
      "models/synty-space-gltf/SM_Prop_Cart_01.glb",
      "models/synty-space-gltf/SM_Prop_ControlPanel_02.glb",
      "models/synty-gltf/SM_Device_03.glb",
      "models/synty-gltf/SM_Treatment_Gun.glb",
      "models/synty-gltf/SM_Canister_Holder_1.glb",
      "models/synty-gltf/SM_Laboratory_Table.glb",
    ],
    "Research Lab": [
      "models/synty-space-gltf/SM_Prop_Screen_02.glb",
      "models/synty-space-gltf/SM_Prop_Desk_Small_01.glb",
      "models/synty-space-gltf/SM_Prop_CryoBed_01.glb",
      "models/synty-gltf/SM_Microscope.glb",
      "models/synty-gltf/SM_Lab_Computer.glb",
      "models/synty-gltf/SM__Flask_01.glb",
      "models/synty-gltf/SM__Flask_02.glb",
      "models/synty-gltf/SM_Laboratory_Table.glb",
    ],
    "Communications Hub": [
      "models/synty-space-gltf/SM_Prop_Satellite_Stand_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_01.glb",
      "models/synty-space-gltf/SM_Prop_Radar_Panel_01.glb",
      "models/synty-space-gltf/SM_Prop_Antenna_01.glb",
      "models/synty-gltf/SM_Screen.glb",
      "models/synty-gltf/SM_Desktop.glb",
      "models/synty-gltf/SM_Device_02.glb",
    ],
    "Power Relay Junction": [
      "models/synty-space-gltf/SM_Prop_Battery_03.glb",
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
      "models/synty-space-gltf/SM_Prop_ControlPanel_03.glb",
      "models/synty-space-gltf/SM_Prop_Battery_01.glb",
      "models/synty-gltf/SM_Electric_Generator_For_Type_01.glb",
      "models/synty-gltf/SM_Uranium_cell.glb",
      "models/synty-gltf/SM_Box_for_energy_cells.glb",
      "models/synty-gltf/SM_Electric_pipe.glb",
    ],
    "Bridge": [
      "models/synty-space-gltf/SM_Bld_Bridge_Chair_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_01.glb",
      "models/synty-space-gltf/SM_Prop_ControlPanel_01.glb",
      "models/synty-space-gltf/SM_Bld_Bridge_Chair_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_02.glb",
      "models/synty-gltf/SM_Desktop_01.glb",
      "models/synty-gltf/SM_Chair.glb",
    ],
    "Engine Core": [
      "models/synty-space-gltf/SM_Prop_CenterTube_01.glb",
      "models/synty-space-gltf/SM_Prop_Battery_02.glb",
      "models/synty-space-gltf/SM_Prop_Panel_01.glb",
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
      "models/synty-gltf/SM_Turbine_platform.glb",
      "models/synty-gltf/SM_Boiler.glb",
      "models/synty-gltf/SM_Pipe.glb",
      "models/synty-gltf/SM_Foundry.glb",
    ],
    "Cargo Hold": [
      "models/synty-space-gltf/SM_Prop_Barrel_01.glb",
      "models/synty-space-gltf/SM_Prop_Detail_Box_01.glb",
      "models/synty-space-gltf/SM_Prop_Crate_health_01.glb",
      "models/synty-space-gltf/SM_Prop_Detail_Box_02.glb",
      "models/synty-gltf/SM_Container.glb",
      "models/synty-gltf/SM_Barrel_Gas.glb",
      "models/synty-gltf/SM_Barrel_Water.glb",
      "models/synty-gltf/SM_Canister_Holder_2.glb",
    ],
    "Crew Quarters": [
      "models/synty-space-gltf/SM_Bld_Crew_Beds_01.glb",
      "models/synty-space-gltf/SM_Prop_Desk_Small_01.glb",
      "models/synty-space-gltf/SM_Bld_Crew_Beds_01.glb",
      "models/synty-gltf/SM_Sofa.glb",
      "models/synty-gltf/SM_Chair_Indoor.glb",
      "models/synty-gltf/SM_Fridge.glb",
      "models/synty-gltf/SM_Wall_Shelf.glb",
      "models/synty-gltf/SM_Coffee_Table.glb",
    ],
    "Observation Deck": [
      "models/synty-space-gltf/SM_Prop_Screen_02.glb",
      "models/synty-space-gltf/SM_Bld_Bridge_Chair_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_01.glb",
      "models/synty-space-gltf/SM_Bld_Bridge_Chair_01.glb",
      "models/synty-gltf/SM_Window_For_Type_01.glb",
      "models/synty-gltf/SM_Chair.glb",
    ],
    "Escape Pod Bay": [
      "models/synty-space-gltf/SM_Prop_EscapePod_Hatch_Small_01.glb",
      "models/synty-space-gltf/SM_Sign_AirLock_01.glb",
      "models/synty-space-gltf/SM_Prop_Crate_health_01.glb",
      "models/synty-space-gltf/SM_Prop_Oxygen_Tank.glb",
      "models/synty-space-gltf/SM_Bld_Wall_EscPod_Hatch_01.glb",
      "models/synty-space-gltf/SM_Veh_EscapePod_Small_01.glb",
    ],
    "Auxiliary Power": [
      "models/synty-space-gltf/SM_Prop_Battery_01.glb",
      "models/synty-space-gltf/SM_Prop_Battery_02.glb",
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
      "models/synty-space-gltf/SM_Prop_Battery_03.glb",
      "models/synty-gltf/SM_Electric_Generator_02_For_Type_01.glb",
      "models/synty-gltf/SM_Uranium_cell.glb",
      "models/synty-gltf/SM_Fuel_Tank.glb",
    ],
    "Signal Room": [
      "models/synty-space-gltf/SM_Prop_Antenna_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_Small_01.glb",
      "models/synty-space-gltf/SM_Prop_Radar_Panel_01.glb",
      "models/synty-gltf/SM_Detector.glb",
      "models/synty-gltf/SM_Device_04.glb",
      "models/synty-gltf/SM_Screen.glb",
    ],
    "Server Annex": [
      "models/synty-space-gltf/SM_Prop_Screen_02.glb",
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_01.glb",
      "models/synty-gltf/SM_Computer.glb",
      "models/synty-gltf/SM_Floor_Locker_01.glb",
      "models/synty-gltf/SM_Device_05.glb",
      "models/synty-gltf/SM_Lab_Computer.glb",
    ],
    "Armory": [
      "models/synty-space-gltf/SM_Prop_Detail_Box_02.glb",
      "models/synty-space-gltf/SM_Prop_Crate_health_02.glb",
      "models/synty-space-gltf/SM_Prop_Barrel_01.glb",
      "models/synty-gltf/SM_Wall_Locker_01.glb",
      "models/synty-gltf/SM_Wall_Locker_02.glb",
      "models/synty-gltf/SM_Floor_Locker_01.glb",
    ],
    "Arrival Bay": [
      "models/synty-space-gltf/SM_Prop_Cart_01.glb",
      "models/synty-space-gltf/SM_Prop_Detail_Box_01.glb",
      "models/synty-space-gltf/SM_Prop_Barrel_01.glb",
      "models/synty-space-gltf/SM_Prop_Crate_health_01.glb",
      "models/synty-gltf/SM_Container.glb",
      "models/synty-gltf/SM_Canister.glb",
    ],
    "Emergency Shelter": [
      "models/synty-space-gltf/SM_Prop_Crate_health_01.glb",
      "models/synty-space-gltf/SM_Prop_Oxygen_Tank.glb",
      "models/synty-space-gltf/SM_Prop_Bed_Medical_01.glb",
      "models/synty-gltf/SM_First-aid_Kit.glb",
      "models/synty-gltf/SM_Water_Tank.glb",
      "models/synty-gltf/SM_Cryochamber.glb",
    ],
    "Maintenance Corridor": [
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
      "models/synty-space-gltf/SM_Prop_Panel_01.glb",
      "models/synty-space-gltf/SM_Prop_Cart_01.glb",
      "models/synty-gltf/SM_Valve.glb",
      "models/synty-gltf/SM_Pipe.glb",
    ],
    "Vent Control Room": [
      "models/synty-space-gltf/SM_Prop_AirVent_Large_01.glb",
      "models/synty-space-gltf/SM_Prop_AirVent_Small_01.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_01.glb",
      "models/synty-gltf/SM_Ventilation.glb",
      "models/synty-gltf/SM_Roof_ventilation.glb",
      "models/synty-gltf/SM_Control_Panel.glb",
    ],
  };

  // Wall-mounted props per room type — placed against inner walls, facing room center
  private static readonly WALL_PROPS: Record<string, string[]> = {
    "Bridge": [
      "models/synty-space-gltf/SM_Prop_Screen_01.glb",
      "models/synty-space-gltf/SM_Prop_ControlPanel_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_02.glb",
      "models/synty-gltf/SM_Screen.glb",
      "models/synty-gltf/SM_Wall_remote_control.glb",
    ],
    "Data Core": [
      "models/synty-space-gltf/SM_Prop_Screen_02.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_02.glb",
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
      "models/synty-gltf/SM_Screen.glb",
      "models/synty-gltf/SM_Wall_remote_control.glb",
    ],
    "Communications Hub": [
      "models/synty-space-gltf/SM_Prop_Radar_Panel_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_01.glb",
      "models/synty-gltf/SM_Screen.glb",
      "models/synty-gltf/SM_Camera.glb",
    ],
    "Engineering Storage": [
      "models/synty-space-gltf/SM_Prop_Panel_01.glb",
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
      "models/synty-gltf/SM_Wall_Locker_01.glb",
      "models/synty-gltf/SM_Lantern_1.glb",
    ],
    "Power Relay Junction": [
      "models/synty-space-gltf/SM_Prop_ControlPanel_03.glb",
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
      "models/synty-space-gltf/SM_Prop_Panel_01.glb",
      "models/synty-gltf/SM_Wall_remote_control.glb",
      "models/synty-gltf/SM_Electric_pipe.glb",
    ],
    "Life Support": [
      "models/synty-space-gltf/SM_Prop_AirVent_Small_01.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_01.glb",
      "models/synty-gltf/SM_Wall_ventilation.glb",
      "models/synty-gltf/SM_Valve.glb",
    ],
    "Med Bay": [
      "models/synty-space-gltf/SM_Prop_Screen_Small_01.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_01.glb",
      "models/synty-gltf/SM_Fisrt-aid_Kit_On_Wall.glb",
      "models/synty-gltf/SM_Screen.glb",
    ],
    "Research Lab": [
      "models/synty-space-gltf/SM_Prop_Screen_02.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_02.glb",
      "models/synty-gltf/SM_Screen.glb",
      "models/synty-gltf/SM_Camera.glb",
    ],
    "Robotics Bay": [
      "models/synty-space-gltf/SM_Prop_ControlPanel_02.glb",
      "models/synty-space-gltf/SM_Prop_Screen_Small_01.glb",
      "models/synty-gltf/SM_Wall_remote_control.glb",
      "models/synty-gltf/SM_Lantern_1.glb",
    ],
    "Server Annex": [
      "models/synty-space-gltf/SM_Prop_Screen_01.glb",
      "models/synty-space-gltf/SM_Prop_Screen_02.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_01.glb",
      "models/synty-gltf/SM_Screen.glb",
      "models/synty-gltf/SM_Camera.glb",
    ],
    "Signal Room": [
      "models/synty-space-gltf/SM_Prop_Antenna_01.glb",
      "models/synty-space-gltf/SM_Prop_Radar_Panel_01.glb",
      "models/synty-gltf/SM_Detector.glb",
      "models/synty-gltf/SM_Screen.glb",
    ],
    "Observation Deck": [
      "models/synty-space-gltf/SM_Prop_Screen_01.glb",
      "models/synty-gltf/SM_Window_For_Type_01.glb",
      "models/synty-gltf/SM_Camera.glb",
    ],
    "Armory": [
      "models/synty-space-gltf/SM_Prop_Panel_01.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_02.glb",
      "models/synty-gltf/SM_Wall_Locker_01.glb",
      "models/synty-gltf/SM_Wall_Locker_02.glb",
    ],
    "Escape Pod Bay": [
      "models/synty-space-gltf/SM_Sign_AirLock_01.glb",
      "models/synty-space-gltf/SM_Prop_Buttons_01.glb",
      "models/synty-gltf/SM_Fisrt-aid_Kit_On_Wall.glb",
      "models/synty-gltf/SM_Lantern_1.glb",
    ],
    "Crew Quarters": [
      "models/synty-space-gltf/SM_Prop_Screen_Small_01.glb",
      "models/synty-gltf/SM_Wall_Shelf.glb",
      "models/synty-gltf/SM_Lantern_1.glb",
    ],
    "Vent Control Room": [
      "models/synty-space-gltf/SM_Prop_AirVent_Small_01.glb",
      "models/synty-space-gltf/SM_Prop_ControlPanel_02.glb",
      "models/synty-gltf/SM_Wall_ventilation.glb",
      "models/synty-gltf/SM_Roof_ventilation.glb",
    ],
    "Auxiliary Power": [
      "models/synty-space-gltf/SM_Prop_Panel_01.glb",
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
      "models/synty-gltf/SM_Wall_remote_control.glb",
      "models/synty-gltf/SM_Electric_pipe.glb",
    ],
    "Engine Core": [
      "models/synty-space-gltf/SM_Prop_ControlPanel_03.glb",
      "models/synty-space-gltf/SM_Prop_Panel_01.glb",
      "models/synty-space-gltf/SM_Prop_Wires_01.glb",
      "models/synty-gltf/SM_Valve.glb",
      "models/synty-gltf/SM_Pipe.glb",
    ],
    "Emergency Shelter": [
      "models/synty-space-gltf/SM_Prop_Buttons_01.glb",
      "models/synty-gltf/SM_Fisrt-aid_Kit_On_Wall.glb",
      "models/synty-gltf/SM_Lantern_1.glb",
    ],
    "Maintenance Corridor": [
      "models/synty-space-gltf/SM_Prop_Panel_01.glb",
      "models/synty-gltf/SM_Valve.glb",
      "models/synty-gltf/SM_Pipe.glb",
    ],
    "Cargo Hold": [
      "models/synty-space-gltf/SM_Prop_Panel_01.glb",
      "models/synty-gltf/SM_Wall_Locker_01.glb",
      "models/synty-gltf/SM_Lantern_1.glb",
    ],
    "Arrival Bay": [
      "models/synty-space-gltf/SM_Prop_Buttons_01.glb",
      "models/synty-space-gltf/SM_Sign_AirLock_01.glb",
      "models/synty-gltf/SM_Camera.glb",
    ],
  };

  /** Initialize InstancedMesh for room trim elements (baseboard, edge glow, top rail) */
  private initTrimInstances(): void {
    // Ensure shared geometries exist
    if (!BrowserDisplay3D._bbGeo) {
      BrowserDisplay3D._bbGeo = new THREE.BoxGeometry(1.02, 0.06, 0.08);
      BrowserDisplay3D._railGeo = new THREE.BoxGeometry(1.02, 0.04, 0.06);
      BrowserDisplay3D._pillarGeo = new THREE.BoxGeometry(0.08, 2.1, 0.08);
      BrowserDisplay3D._edgeGlowGeo = new THREE.BoxGeometry(1.0, 0.02, 0.02);
    }
    const max = BrowserDisplay3D.MAX_TRIM_INSTANCES;

    // Baseboard: white material, per-instance color multiplied in
    const bbMat = makeToonMaterial({
      color: 0xffffff,
      gradientMap: this.toonGradient,
      emissive: 0x888888,
      emissiveIntensity: 0.15,
    });
    this.trimBBInstanced = new THREE.InstancedMesh(BrowserDisplay3D._bbGeo!, bbMat, max);
    this.trimBBInstanced.count = 0;
    this.trimBBInstanced.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(max * 3), 3
    );
    this.scene.add(this.trimBBInstanced);

    // Edge glow: bright emissive
    const glowMat = makeToonMaterial({
      color: 0xffffff,
      gradientMap: this.toonGradient,
      emissive: 0xaaaaaa,
      emissiveIntensity: 0.6,
    });
    this.trimGlowInstanced = new THREE.InstancedMesh(BrowserDisplay3D._edgeGlowGeo!, glowMat, max);
    this.trimGlowInstanced.count = 0;
    this.trimGlowInstanced.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(max * 3), 3
    );
    this.scene.add(this.trimGlowInstanced);

    // Top rail: same style as baseboard
    const railMat = makeToonMaterial({
      color: 0xffffff,
      gradientMap: this.toonGradient,
      emissive: 0x888888,
      emissiveIntensity: 0.15,
    });
    this.trimRailInstanced = new THREE.InstancedMesh(BrowserDisplay3D._railGeo!, railMat, max);
    this.trimRailInstanced.count = 0;
    this.trimRailInstanced.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(max * 3), 3
    );
    this.scene.add(this.trimRailInstanced);
  }

  /** Initialize InstancedMesh for corridor strip lights (bright + dim) */
  private initStripInstances(): void {
    if (!BrowserDisplay3D._stripLightGeo) {
      BrowserDisplay3D._stripLightGeo = new THREE.BoxGeometry(0.8, 0.01, 0.04);
    }
    const max = BrowserDisplay3D.MAX_STRIP_INSTANCES;

    const brightMat = makeToonMaterial({
      color: 0x44ddff,
      gradientMap: this.toonGradient,
      emissive: 0x44ddff,
      emissiveIntensity: 0.5,
    });
    this.stripBrightInstanced = new THREE.InstancedMesh(BrowserDisplay3D._stripLightGeo!, brightMat, max);
    this.stripBrightInstanced.count = 0;
    this.scene.add(this.stripBrightInstanced);

    const dimMat = makeToonMaterial({
      color: 0x225588,
      gradientMap: this.toonGradient,
      emissive: 0x225588,
      emissiveIntensity: 0.3,
    });
    this.stripDimInstanced = new THREE.InstancedMesh(BrowserDisplay3D._stripLightGeo!, dimMat, max);
    this.stripDimInstanced.count = 0;
    this.scene.add(this.stripDimInstanced);

    // Emergency wall light strips — red emissive for hazardous areas
    const emergGeo = new THREE.BoxGeometry(0.06, 0.8, 0.02); // vertical strip on wall
    const emergMat = makeToonMaterial({
      color: 0xff2200,
      gradientMap: this.toonGradient,
      emissive: 0xff2200,
      emissiveIntensity: 0.7,
    });
    this.emergencyStripInstanced = new THREE.InstancedMesh(emergGeo, emergMat, BrowserDisplay3D.MAX_EMERGENCY_STRIPS);
    this.emergencyStripInstanced.count = 0;
    this.emergencyStripInstanced.frustumCulled = false;
    this.scene.add(this.emergencyStripInstanced);
  }

  /** Get or create a per-room sub-group within a parent group for distance culling */
  private getRoomSubGroup(
    parent: THREE.Group,
    registry: Map<string, THREE.Group>,
    room: Room,
  ): THREE.Group {
    let g = registry.get(room.id);
    if (!g) {
      g = new THREE.Group();
      g.userData.roomCX = room.x + room.width / 2;
      g.userData.roomCZ = room.y + room.height / 2;
      parent.add(g);
      registry.set(room.id, g);
      // Cache room center for culling
      if (!this.roomCenters.has(room.id)) {
        this.roomCenters.set(room.id, {
          x: room.x + room.width / 2,
          z: room.y + room.height / 2,
        });
      }
    }
    return g;
  }

  /** Get or create a spatial bucket group for corridor elements */
  private getCorridorBucket(parent: THREE.Group, x: number, y: number): THREE.Group {
    const bs = BrowserDisplay3D.CORRIDOR_BUCKET_SIZE;
    const bx = Math.floor(x / bs);
    const by = Math.floor(y / bs);
    const key = `${parent.uuid}_${bx},${by}`;
    let g = this.corridorBuckets.get(key);
    if (!g) {
      g = new THREE.Group();
      g.userData.bucketCX = (bx + 0.5) * bs;
      g.userData.bucketCZ = (by + 0.5) * bs;
      parent.add(g);
      this.corridorBuckets.set(key, g);
    }
    return g;
  }

  /** Room-focused culling: only show current room + nearby corridor elements */
  private updateDistanceCulling(): void {
    const px = this.playerCurrentX;
    const pz = this.playerCurrentZ;
    const corridorRange = BrowserDisplay3D.CORRIDOR_VIEW_RANGE + 2;

    // Cull room-based groups — only show rooms in visible set
    const roomMaps = [this.roomTrimGroups, this.roomDecoGroups, this.roomCeilGroups];
    for (const map of roomMaps) {
      for (const [roomId, group] of map) {
        group.visible = this._visibleRoomIds.has(roomId);
      }
    }

    // Cull corridor buckets — only show those near player
    for (const [, group] of this.corridorBuckets) {
      const cx = group.userData.bucketCX as number;
      const cz = group.userData.bucketCZ as number;
      const dist = Math.abs(px - cx) + Math.abs(pz - cz);
      group.visible = dist <= corridorRange;
    }
  }

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
      this.getRoomSubGroup(this.decorationGroup, this.roomDecoGroups, room).add(debris);
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
      const decoGroup = this.getRoomSubGroup(this.decorationGroup, this.roomDecoGroups, room);

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

      // Place up to 7 decorations at deterministic positions (seeded by room id)
      // Larger rooms get more props for visual density at ground level
      const roomArea = room.width * room.height;
      const maxDecor = Math.min(roomArea >= 20 ? 9 : roomArea >= 12 ? 7 : 5, emptyFloors.length);
      // Simple deterministic shuffle based on room position
      const seed = room.x * 31 + room.y * 17;
      emptyFloors.sort((a, b) => ((a.x * 13 + a.y * 7 + seed) & 0xff) - ((b.x * 13 + b.y * 7 + seed) & 0xff));

      for (let i = 0; i < maxDecor; i++) {
        const pos = emptyFloors[i];
        const modelPath = decorModels[i % decorModels.length];
        const modelKey = `decor_${room.id}_${i}`;

        // Check if we have this model cached
        // First 2 decorations in larger rooms get 1.5x scale (spanning multiple tiles)
        const isLargeDecor = i < 2 && room.width >= 4 && room.height >= 4;
        const decorScale = isLargeDecor ? 1.15 : 0.75;
        const cached = this.gltfCache.get(modelPath);
        if (cached) {
          const clone = cached.clone();
          clone.position.set(pos.x, 0, pos.y);
          clone.scale.multiplyScalar(decorScale);
          decoGroup.add(clone);
        } else {
          // Load model and place when ready
          const url = import.meta.env.BASE_URL + modelPath;
          this.gltfLoader.load(url, (gltf) => {
            try {
              const model = gltf.scene.clone();
              // Normalize size — larger for first decorations in big rooms
              const box = new THREE.Box3().setFromObject(model);
              const size = new THREE.Vector3();
              box.getSize(size);
              const maxDim = Math.max(size.x, size.y, size.z);
              const baseScale = isLargeDecor ? 1.0 : 0.65;
              if (maxDim > 0) model.scale.multiplyScalar(baseScale / maxDim);

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

              decoGroup.add(model);
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
        const maxWallProps = Math.min(wallProps.length, wallSlots.length, 5); // room-focused = more budget

        // Wall status LEDs: place small blinking dots on unused wall slots
        const ledStartIdx = Math.min(maxWallProps, wallSlots.length);
        const maxLeds = Math.min(4, wallSlots.length - ledStartIdx);
        for (let li = 0; li < maxLeds; li++) {
          const lSlot = wallSlots[ledStartIdx + li];
          const ledColor = ROOM_WALL_TINTS_3D[room.name] ?? 0x44ff88;
          const ledMat = new THREE.SpriteMaterial({
            color: ledColor, transparent: true, opacity: 0.5,
            depthWrite: false, blending: THREE.AdditiveBlending,
          });
          const led = new THREE.Sprite(ledMat);
          led.scale.set(0.04, 0.04, 1);
          // Place at mid-wall height, slight offset toward room interior
          const offX = Math.sin(lSlot.rot) * 0.05;
          const offZ = Math.cos(lSlot.rot) * 0.05;
          led.position.set(lSlot.x + offX, 0.9 + (li % 3) * 0.2, lSlot.y + offZ);
          (led as any)._ledPhase = lSlot.x * 3.7 + lSlot.y * 5.3 + li * 1.1;
          decoGroup.add(led);
          this._wallLEDs.push(led);
        }

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
            decoGroup.add(clone);
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

  // Wall status LED sprites (animated in animate loop)
  private _wallLEDs: THREE.Sprite[] = [];

  // ── Private: caution stripe floor markings ─────────────────────

  private cautionStripeTex: THREE.CanvasTexture | null = null;

  /** Place architectural trim: baseboards along room walls, door frame pillars */
  // Shared trim geometries (created once, reused)
  private static _bbGeo: THREE.BoxGeometry | null = null;
  private static _railGeo: THREE.BoxGeometry | null = null;
  private static _pillarGeo: THREE.BoxGeometry | null = null;
  private static _edgeGlowGeo: THREE.BoxGeometry | null = null;

  private placeRoomTrim(state: GameState): void {
    const dummy = this.dummy;
    const tempColor = new THREE.Color();

    for (const room of state.rooms) {
      if (this.trimmedRooms.has(room.id)) continue;
      // Check if room is explored
      const cx = room.x + Math.floor(room.width / 2);
      const cy = room.y + Math.floor(room.height / 2);
      if (cy < 0 || cy >= state.height || cx < 0 || cx >= state.width) continue;
      if (!state.tiles[cy][cx].explored) continue;
      this.trimmedRooms.add(room.id);
      const trimSubGroup = this.getRoomSubGroup(this.trimGroup, this.roomTrimGroups, room);

      const tint = ROOM_WALL_TINTS_3D[room.name] ?? COLORS_3D.wall;
      // Brighter accent color for trim
      const tr = Math.min(255, ((tint >> 16) & 0xff) + 40);
      const tg = Math.min(255, ((tint >> 8) & 0xff) + 40);
      const tb = Math.min(255, (tint & 0xff) + 40);
      const trimColor = (tr << 16) | (tg << 8) | tb;
      const glowColor = tint;

      // Scan room perimeter for wall tiles adjacent to floor
      for (let y = room.y - 1; y <= room.y + room.height; y++) {
        for (let x = room.x - 1; x <= room.x + room.width; x++) {
          if (y < 0 || y >= state.height || x < 0 || x >= state.width) continue;
          const tile = state.tiles[y][x];
          if (tile.type !== TileType.Wall) continue;

          // Check which direction(s) face into the room
          const inN = y > 0 && state.tiles[y - 1][x].type === TileType.Floor;
          const inS = y < state.height - 1 && state.tiles[y + 1][x].type === TileType.Floor;
          const inE = x < state.width - 1 && state.tiles[y][x + 1].type === TileType.Floor;
          const inW = x > 0 && state.tiles[y][x - 1].type === TileType.Floor;
          if (!inN && !inS && !inE && !inW) continue;

          if (this.trimInstanceIdx >= BrowserDisplay3D.MAX_TRIM_INSTANCES) continue;

          // Compute position and rotation for this wall edge
          let px = 0, py = 0, pz = 0, ry = 0;
          if (inN) { px = x; py = 0.03; pz = y - 0.47; ry = 0; }
          else if (inS) { px = x; py = 0.03; pz = y + 0.47; ry = 0; }
          else if (inE) { px = x + 0.47; py = 0.03; pz = y; ry = Math.PI / 2; }
          else if (inW) { px = x - 0.47; py = 0.03; pz = y; ry = Math.PI / 2; }

          const idx = this.trimInstanceIdx;

          // Baseboard instance
          dummy.position.set(px, py, pz);
          dummy.rotation.set(0, ry, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          this.trimBBInstanced!.setMatrixAt(idx, dummy.matrix);
          tempColor.setHex(trimColor);
          this.trimBBInstanced!.setColorAt(idx, tempColor);

          // Edge glow instance (same pos, lower Y)
          dummy.position.y = 0.01;
          dummy.updateMatrix();
          this.trimGlowInstanced!.setMatrixAt(idx, dummy.matrix);
          tempColor.setHex(glowColor);
          this.trimGlowInstanced!.setColorAt(idx, tempColor);

          // Top rail instance (same pos, high Y)
          dummy.position.y = 1.98;
          dummy.updateMatrix();
          this.trimRailInstanced!.setMatrixAt(idx, dummy.matrix);
          tempColor.setHex(trimColor);
          this.trimRailInstanced!.setColorAt(idx, tempColor);

          this.trimInstanceIdx++;
        }
      }

      // Update instance counts and mark for GPU upload
      this.trimBBInstanced!.count = this.trimInstanceIdx;
      this.trimBBInstanced!.instanceMatrix.needsUpdate = true;
      this.trimBBInstanced!.instanceColor!.needsUpdate = true;
      this.trimGlowInstanced!.count = this.trimInstanceIdx;
      this.trimGlowInstanced!.instanceMatrix.needsUpdate = true;
      this.trimGlowInstanced!.instanceColor!.needsUpdate = true;
      this.trimRailInstanced!.count = this.trimInstanceIdx;
      this.trimRailInstanced!.instanceMatrix.needsUpdate = true;
      this.trimRailInstanced!.instanceColor!.needsUpdate = true;

      // Door frames: vertical pillars on each side of door tiles in this room
      for (let y = room.y - 1; y <= room.y + room.height; y++) {
        for (let x = room.x - 1; x <= room.x + room.width; x++) {
          if (y < 0 || y >= state.height || x < 0 || x >= state.width) continue;
          const tile = state.tiles[y][x];
          if (tile.type !== TileType.Door && tile.type !== TileType.LockedDoor) continue;

          const isLocked = tile.type === TileType.LockedDoor;
          const frameColor = isLocked ? 0xff6666 : 0xeedd88;
          const frameEmissive = isLocked ? 0xff2222 : 0xccaa44;
          const frameMat = makeToonMaterial({
            color: frameColor,
            gradientMap: this.toonGradient,
            emissive: frameEmissive,
            emissiveIntensity: 0.3,
          });

          // Determine door orientation (horizontal or vertical)
          const openE = x < state.width - 1 && state.tiles[y][x + 1].walkable;
          const openW = x > 0 && state.tiles[y][x - 1].walkable;
          const isHorizontal = openE || openW;

          // Two pillars on each side of the door (shared geo)
          const pillar1 = new THREE.Mesh(BrowserDisplay3D._pillarGeo!, frameMat);
          const pillar2 = new THREE.Mesh(BrowserDisplay3D._pillarGeo!, frameMat);

          if (isHorizontal) {
            pillar1.position.set(x, 1.05, y - 0.46);
            pillar2.position.set(x, 1.05, y + 0.46);
          } else {
            pillar1.position.set(x - 0.46, 1.05, y);
            pillar2.position.set(x + 0.46, 1.05, y);
          }
          trimSubGroup.add(pillar1, pillar2);

          // Top lintel across the door
          const lintelGeo = new THREE.BoxGeometry(
            isHorizontal ? 0.12 : 1.0,
            0.1,
            isHorizontal ? 1.0 : 0.12
          );
          const lintel = new THREE.Mesh(lintelGeo, frameMat);
          lintel.position.set(x, 2.05, y);
          trimSubGroup.add(lintel);

          // Floor threshold glow strip — bright line at door base
          const thresholdMat = makeToonMaterial({
            color: frameColor,
            gradientMap: this.toonGradient,
            emissive: frameEmissive,
            emissiveIntensity: 0.7,
          });
          const threshGeo = new THREE.BoxGeometry(
            isHorizontal ? 0.06 : 0.85,
            0.015,
            isHorizontal ? 0.85 : 0.06
          );
          const threshold = new THREE.Mesh(threshGeo, thresholdMat);
          threshold.position.set(x, 0.008, y);
          trimSubGroup.add(threshold);
        }
      }
    }
  }

  /** Place ceiling beams, cross-supports, and overhead light fixtures per room */
  private placeRoomCeiling(state: GameState): void {
    // Create shared geometries once
    if (!BrowserDisplay3D._beamGeoH) {
      BrowserDisplay3D._beamGeoH = new THREE.BoxGeometry(1.04, 0.06, 0.08); // horizontal beam (X-axis)
      BrowserDisplay3D._beamGeoV = new THREE.BoxGeometry(0.08, 0.06, 1.04); // vertical beam (Z-axis)
    }

    const ceilingY = 2.0; // ceiling height (matches wall top)
    const beamY = ceilingY - 0.04; // beams hang just below ceiling

    for (const room of state.rooms) {
      if (this.ceilingRooms.has(room.id)) continue;

      // Check if room is explored
      const cx = room.x + Math.floor(room.width / 2);
      const cy = room.y + Math.floor(room.height / 2);
      if (cy < 0 || cy >= state.height || cx < 0 || cx >= state.width) continue;
      if (!state.tiles[cy][cx].explored) continue;
      this.ceilingRooms.add(room.id);
      const ceilSubGroup = this.getRoomSubGroup(this.ceilingGroup, this.roomCeilGroups, room);

      const tint = ROOM_WALL_TINTS_3D[room.name] ?? COLORS_3D.wall;
      // Beams: dark metallic grey with subtle room color influence (industrial look)
      const br = Math.min(0x80, Math.round(((tint >> 16) & 0xff) * 0.25 + 0x40));
      const bg = Math.min(0x80, Math.round(((tint >> 8) & 0xff) * 0.25 + 0x40));
      const bb = Math.min(0x80, Math.round((tint & 0xff) * 0.25 + 0x48));
      const beamColor = (br << 16) | (bg << 8) | bb;
      const beamMat = makeToonMaterial({
        color: beamColor,
        gradientMap: this.toonGradient,
      });

      // Place horizontal beams (running east-west) every 3 tiles
      for (let ry = room.y; ry < room.y + room.height; ry++) {
        if ((ry - room.y) % 3 !== 0) continue; // every 3rd row
        for (let rx = room.x; rx < room.x + room.width; rx++) {
          if (ry < 0 || ry >= state.height || rx < 0 || rx >= state.width) continue;
          if (state.tiles[ry][rx].type !== TileType.Floor) continue;
          const beam = new THREE.Mesh(BrowserDisplay3D._beamGeoH!, beamMat);
          beam.position.set(rx, beamY, ry);
          ceilSubGroup.add(beam);
        }
      }

      // Place vertical beams (running north-south) every 3 tiles for cross-bracing
      for (let rx = room.x; rx < room.x + room.width; rx++) {
        if ((rx - room.x) % 3 !== 0) continue; // every 3rd column
        for (let ry = room.y; ry < room.y + room.height; ry++) {
          if (ry < 0 || ry >= state.height || rx < 0 || rx >= state.width) continue;
          if (state.tiles[ry][rx].type !== TileType.Floor) continue;
          const beam = new THREE.Mesh(BrowserDisplay3D._beamGeoV!, beamMat);
          beam.position.set(rx, beamY - 0.04, ry); // slightly below H-beams
          ceilSubGroup.add(beam);
        }
      }

      // (Ceiling light fixtures removed — they obscured the camera view)
    }
  }

  /** Place a subtle colored haze plane per room — dynamically colored by hazard state */
  private placeRoomHaze(state: GameState): void {
    for (const room of state.rooms) {
      const cx = room.x + Math.floor(room.width / 2);
      const cy = room.y + Math.floor(room.height / 2);
      if (cy < 0 || cy >= state.height || cx < 0 || cx >= state.width) continue;
      if (!state.tiles[cy][cx].explored) continue;

      if (!this.hazeRooms.has(room.id)) {
        // First time: create haze plane
        this.hazeRooms.add(room.id);

        const hazeGeo = new THREE.PlaneGeometry(room.width * 0.9, room.height * 0.9);
        hazeGeo.rotateX(-Math.PI / 2);
        const hazeMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.04,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
        const haze = new THREE.Mesh(hazeGeo, hazeMat);
        haze.position.set(
          room.x + room.width / 2 - 0.5,
          0.3,
          room.y + room.height / 2 - 0.5
        );
        haze.userData = { roomId: room.id };
        this.getRoomSubGroup(this.ceilingGroup, this.roomCeilGroups, room).add(haze);
        this.roomHazeMeshes.set(room.id, haze);
      }

      // Update haze color/opacity based on current hazard state
      const hazeMesh = this.roomHazeMeshes.get(room.id);
      if (!hazeMesh) continue;
      const mat = hazeMesh.material as THREE.MeshBasicMaterial;

      // Measure room hazards
      let maxHeat = 0, maxSmoke = 0, minPressure = 100;
      for (let ry = room.y; ry < room.y + room.height; ry++) {
        for (let rx = room.x; rx < room.x + room.width; rx++) {
          if (ry < 0 || ry >= state.height || rx < 0 || rx >= state.width) continue;
          const t = state.tiles[ry][rx];
          if (t.heat > maxHeat) maxHeat = t.heat;
          if (t.smoke > maxSmoke) maxSmoke = t.smoke;
          if (t.pressure < minPressure) minPressure = t.pressure;
        }
      }

      const tint = ROOM_WALL_TINTS_3D[room.name] ?? COLORS_3D.wall;
      if (maxHeat > 40) {
        // Hot room: red-orange fog, opacity scales with heat
        mat.color.setHex(0xff3300);
        mat.opacity = Math.min(0.25, 0.06 + (maxHeat - 40) * 0.003);
        hazeMesh.position.y = 0.25; // lower — heat sinks
      } else if (maxSmoke > 30) {
        // Smoky room: dark grey fog
        mat.color.setHex(0x444444);
        mat.opacity = Math.min(0.2, 0.05 + (maxSmoke - 30) * 0.003);
        hazeMesh.position.y = 0.4; // higher — smoke rises
      } else if (minPressure < 40) {
        // Low pressure: blue frost mist
        mat.color.setHex(0x4488cc);
        mat.opacity = Math.min(0.15, 0.04 + (40 - minPressure) * 0.002);
        hazeMesh.position.y = 0.15; // floor level — frost
      } else {
        // Normal room: subtle room-colored haze
        mat.color.setHex(tint);
        mat.opacity = 0.04;
        hazeMesh.position.y = 0.3;
      }
    }
  }

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
          this.getCorridorBucket(this.cautionStripeGroup, tx, ty).add(plane);
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
          this.getCorridorBucket(this.cautionStripeGroup, x, y).add(plane);
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

        // Only place pipes every 4th tile for performance
        if ((x + y) % 4 !== 0) continue;
        this.corridorPipeTiles.add(key);

        // Determine corridor direction (horizontal or vertical)
        const hasEW = (x > 0 && state.tiles[y][x - 1].type === TileType.Corridor) ||
                      (x < state.width - 1 && state.tiles[y][x + 1].type === TileType.Corridor);
        const hasNS = (y > 0 && state.tiles[y - 1][x].type === TileType.Corridor) ||
                      (y < state.height - 1 && state.tiles[y + 1][x].type === TileType.Corridor);

        // Pipe color varies with position hash
        const pipeHash = ((x * 7 + y * 13) & 0xf);
        const pipeColor = pipeHash < 5 ? 0x7788aa : pipeHash < 10 ? 0x8899bb : 0x99aacc;

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

        const pipeBucket = this.getCorridorBucket(this.pipeGroup, x, y);
        pipeBucket.add(pipe);

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
          pipeBucket.add(pipe2);
        }
      }
    }
  }

  // ── Private: corridor arch supports ────────────────────────────

  private static readonly CORRIDOR_ARCH_MODEL = "models/synty-space-gltf/SM_Bld_Corridor_Single_Arch_01.glb";

  private placeCorridorArches(state: GameState): void {
    // Create shared fallback geometry once
    if (!BrowserDisplay3D._archPostGeo) {
      BrowserDisplay3D._archPostGeo = new THREE.BoxGeometry(0.06, 1.6, 0.06);
      BrowserDisplay3D._archSpanGeo = new THREE.BoxGeometry(1.1, 0.06, 0.06);
    }

    const archMat = makeToonMaterial({
      color: 0x667788,
      gradientMap: this.toonGradient,
    });

    // Try to use the Synty arch model if loaded
    const archModel = this.gltfCache.get(BrowserDisplay3D.CORRIDOR_ARCH_MODEL);

    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const tile = state.tiles[y][x];
        if (!tile.explored || tile.type !== TileType.Corridor) continue;

        const key = `arch_${x},${y}`;
        if (this.corridorArchTiles.has(key)) continue;

        // Place arches every 3rd corridor tile
        if ((x + y * 3) % 3 !== 0) continue;
        this.corridorArchTiles.add(key);

        // Determine corridor direction
        const hasE = x < state.width - 1 && state.tiles[y][x + 1].type === TileType.Corridor;
        const hasW = x > 0 && state.tiles[y][x - 1].type === TileType.Corridor;
        const hasN = y > 0 && state.tiles[y - 1][x].type === TileType.Corridor;
        const hasS = y < state.height - 1 && state.tiles[y + 1][x].type === TileType.Corridor;
        const isHorizontal = (hasE || hasW) && !hasN && !hasS;
        const isVertical = (hasN || hasS) && !hasE && !hasW;

        if (!isHorizontal && !isVertical) continue;

        if (archModel) {
          // Use Synty arch GLTF model
          const clone = archModel.clone();
          clone.position.set(x, 0, y);
          if (isHorizontal) {
            clone.rotation.y = Math.PI / 2;
          }
          this.getCorridorBucket(this.ceilingGroup, x, y).add(clone);
        } else {
          // Fallback: procedural posts + span
          const post1 = new THREE.Mesh(BrowserDisplay3D._archPostGeo!, archMat);
          const post2 = new THREE.Mesh(BrowserDisplay3D._archPostGeo!, archMat);
          const span = new THREE.Mesh(BrowserDisplay3D._archSpanGeo!, archMat);

          if (isHorizontal) {
            post1.position.set(x, 0.8, y - 0.47);
            post2.position.set(x, 0.8, y + 0.47);
            span.position.set(x, 1.62, y);
            span.rotation.y = Math.PI / 2;
            span.scale.x = 0.86;
          } else {
            post1.position.set(x - 0.47, 0.8, y);
            post2.position.set(x + 0.47, 0.8, y);
            span.position.set(x, 1.62, y);
          }

          const archBucket = this.getCorridorBucket(this.ceilingGroup, x, y);
          archBucket.add(post1, post2, span);
        }
      }
    }
  }

  // ── Private: corridor floor strip lights ───────────────────────

  private placeCorridorStripLights(state: GameState): void {
    const dummy = this.dummy;
    let changed = false;

    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const tile = state.tiles[y][x];
        if (!tile.explored || tile.type !== TileType.Corridor) continue;

        const key = `strip_${x},${y}`;
        if (this.corridorStripTiles.has(key)) continue;

        // Place every 2nd corridor tile for density
        if ((x + y) % 2 !== 0) continue;
        this.corridorStripTiles.add(key);

        // Find which side has a wall to place the strip against
        const wallN = y > 0 && state.tiles[y - 1][x].type === TileType.Wall;
        const wallS = y < state.height - 1 && state.tiles[y + 1][x].type === TileType.Wall;
        const wallE = x < state.width - 1 && state.tiles[y][x + 1].type === TileType.Wall;
        const wallW = x > 0 && state.tiles[y][x - 1].type === TileType.Wall;

        // Alternate bright/dim based on position hash
        const isBright = ((x * 3 + y * 7) & 0x3) < 2;

        const addStripInstance = (px: number, pz: number, rotated: boolean) => {
          const instanced = isBright ? this.stripBrightInstanced! : this.stripDimInstanced!;
          const idx = isBright ? this.stripBrightIdx : this.stripDimIdx;
          if (idx >= BrowserDisplay3D.MAX_STRIP_INSTANCES) return;

          dummy.position.set(px, -0.05, pz);
          dummy.rotation.set(0, rotated ? Math.PI / 2 : 0, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          instanced.setMatrixAt(idx, dummy.matrix);

          if (isBright) this.stripBrightIdx++;
          else this.stripDimIdx++;
          changed = true;
        };

        if (wallN) addStripInstance(x, y - 0.46, false);
        if (wallS) addStripInstance(x, y + 0.46, false);
        if (wallE) addStripInstance(x + 0.46, y, true);
        if (wallW) addStripInstance(x - 0.46, y, true);
      }
    }

    if (changed) {
      this.stripBrightInstanced!.count = this.stripBrightIdx;
      this.stripBrightInstanced!.instanceMatrix.needsUpdate = true;
      this.stripDimInstanced!.count = this.stripDimIdx;
      this.stripDimInstanced!.instanceMatrix.needsUpdate = true;
    }
  }

  // ── Private: emergency wall light strips (red/amber near hazards) ──

  private placeEmergencyWallStrips(state: GameState): void {
    const dummy = this.dummy;
    let changed = false;

    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const tile = state.tiles[y][x];
        if (!tile.explored || tile.type !== TileType.Corridor) continue;

        const key = `emg_${x},${y}`;
        if (this.emergencyStripTiles.has(key)) continue;

        // Only place near hazards: check nearby tiles for heat, smoke, or low pressure
        let maxHeat = 0, maxSmoke = 0, lowPressure = false;
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny < 0 || ny >= state.height || nx < 0 || nx >= state.width) continue;
            const t = state.tiles[ny][nx];
            if (t.heat > maxHeat) maxHeat = t.heat;
            if (t.smoke > maxSmoke) maxSmoke = t.smoke;
            if (t.pressure < 40) lowPressure = true;
          }
        }

        // Only place strips in hazardous corridors
        if (maxHeat < 15 && maxSmoke < 20 && !lowPressure) continue;

        // Place every other qualifying tile
        if ((x + y) % 2 !== 0) continue;
        this.emergencyStripTiles.add(key);

        // Find adjacent walls to mount strips on
        const wallN = y > 0 && state.tiles[y - 1][x].type === TileType.Wall;
        const wallS = y < state.height - 1 && state.tiles[y + 1][x].type === TileType.Wall;
        const wallE = x < state.width - 1 && state.tiles[y][x + 1].type === TileType.Wall;
        const wallW = x > 0 && state.tiles[y][x - 1].type === TileType.Wall;

        const addEmergStrip = (px: number, pz: number, rotY: number) => {
          if (this.emergencyStripIdx >= BrowserDisplay3D.MAX_EMERGENCY_STRIPS) return;
          dummy.position.set(px, 0.6, pz);
          dummy.rotation.set(0, rotY, 0);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          this.emergencyStripInstanced!.setMatrixAt(this.emergencyStripIdx, dummy.matrix);
          this.emergencyStripIdx++;
          changed = true;
        };

        if (wallN) addEmergStrip(x, y - 0.48, 0);
        if (wallS) addEmergStrip(x, y + 0.48, 0);
        if (wallE) addEmergStrip(x + 0.48, y, Math.PI / 2);
        if (wallW) addEmergStrip(x - 0.48, y, Math.PI / 2);
      }
    }

    if (changed) {
      this.emergencyStripInstanced!.count = this.emergencyStripIdx;
      this.emergencyStripInstanced!.instanceMatrix.needsUpdate = true;
    }
  }

  // ── Private: corridor wall-mounted GLTF props ──────────────────

  private corridorWallPropTiles: Set<string> = new Set();

  // Models placed against corridor walls for variety
  private static readonly CORRIDOR_WALL_MODELS = [
    "models/synty-space-gltf/SM_Prop_Panel_01.glb",
    "models/synty-space-gltf/SM_Prop_Buttons_01.glb",
    "models/synty-space-gltf/SM_Prop_Screen_Small_01.glb",
    "models/synty-space-gltf/SM_Prop_AirVent_Small_01.glb",
    "models/synty-space-gltf/SM_Prop_Wires_01.glb",
    "models/synty-space-gltf/SM_Prop_Oxygen_Tank_Small.glb",
    "models/synty-gltf/SM_Valve.glb",
    "models/synty-gltf/SM_Pipe.glb",
    "models/synty-gltf/SM_Camera.glb",
    "models/synty-gltf/SM_Detector.glb",
    "models/synty-gltf/SM_Lantern_1.glb",
    "models/synty-gltf/SM_Wall_remote_control.glb",
    "models/kenney-space/cables.glb",
  ];

  private placeCorridorWallProps(state: GameState): void {
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const tile = state.tiles[y][x];
        if (tile.type !== TileType.Wall || !tile.explored) continue;

        const key = `cw_${x},${y}`;
        if (this.corridorWallPropTiles.has(key)) continue;

        // Only walls adjacent to corridor tiles get props
        const adjN = y > 0 && state.tiles[y - 1][x].type === TileType.Corridor;
        const adjS = y < state.height - 1 && state.tiles[y + 1][x].type === TileType.Corridor;
        const adjE = x < state.width - 1 && state.tiles[y][x + 1].type === TileType.Corridor;
        const adjW = x > 0 && state.tiles[y][x - 1].type === TileType.Corridor;
        if (!adjN && !adjS && !adjE && !adjW) continue;

        // Place prop on qualifying walls (~20% chance — room-focused rendering limits visible count)
        const hash = (x * 23 + y * 47) & 0xff;
        if (hash > 51) continue; // ~20% chance
        this.corridorWallPropTiles.add(key);

        // Pick model deterministically
        const modelIdx = hash % BrowserDisplay3D.CORRIDOR_WALL_MODELS.length;
        const modelPath = BrowserDisplay3D.CORRIDOR_WALL_MODELS[modelIdx];

        // Determine facing direction (toward corridor)
        let rot = 0;
        if (adjN) rot = Math.PI;       // face south toward corridor
        else if (adjS) rot = 0;        // face north
        else if (adjE) rot = Math.PI / 2;  // face west
        else if (adjW) rot = -Math.PI / 2; // face east

        const placeModel = (model: THREE.Object3D) => {
          const clone = model.clone();
          const box = new THREE.Box3().setFromObject(clone);
          const size = new THREE.Vector3();
          box.getSize(size);
          const maxDim = Math.max(size.x, size.y, size.z);
          if (maxDim > 0) clone.scale.multiplyScalar(0.45 / maxDim);

          // Position against wall, slightly elevated
          clone.position.set(x, 0.6, y);
          clone.rotation.y = rot;
          this.getCorridorBucket(this.decorationGroup, x, y).add(clone);
        };

        const cached = this.gltfCache.get(modelPath);
        if (cached) {
          placeModel(cached);
        } else {
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
                    color: tex ? 0xffffff : (oldMat?.color?.getHex() ?? 0x999999),
                    gradientMap: this.toonGradient,
                    map: tex,
                  });
                }
              });
              this.gltfCache.set(modelPath, model);
              placeModel(model);
            } catch (e) {
              console.warn(`Failed to load corridor wall prop ${modelPath}:`, e);
            }
          }, undefined, () => {});
        }
      }
    }
  }

  // ── Private: wall-mounted light fixtures at eye level ──────────

  private corridorFixtureTiles: Set<string> = new Set();

  private placeCorridorFixtures(state: GameState): void {
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const tile = state.tiles[y][x];
        if (!tile.explored || tile.type !== TileType.Corridor) continue;

        const key = `fix_${x},${y}`;
        if (this.corridorFixtureTiles.has(key)) continue;

        // Place every 6th corridor tile (sparse for performance)
        if ((x * 5 + y * 11) % 6 !== 0) continue;
        this.corridorFixtureTiles.add(key);

        // Find adjacent walls to mount fixtures on
        const wallN = y > 0 && state.tiles[y - 1][x].type === TileType.Wall;
        const wallS = y < state.height - 1 && state.tiles[y + 1][x].type === TileType.Wall;
        const wallE = x < state.width - 1 && state.tiles[y][x + 1].type === TileType.Wall;
        const wallW = x > 0 && state.tiles[y][x - 1].type === TileType.Wall;

        if (!wallN && !wallS && !wallE && !wallW) continue;

        // Create a small emissive fixture (procedural — warm light box)
        const fixtureGeo = new THREE.BoxGeometry(0.12, 0.06, 0.04);
        const fixtureMat = makeToonMaterial({
          color: 0xffeedd,
          gradientMap: this.toonGradient,
          emissive: 0xffddaa,
          emissiveIntensity: 0.8,
        });
        const fixture = new THREE.Mesh(fixtureGeo, fixtureMat);

        // Position on the first available wall at eye level
        if (wallN) {
          fixture.position.set(x, 0.5, y - 0.48);
        } else if (wallS) {
          fixture.position.set(x, 0.5, y + 0.48);
        } else if (wallE) {
          fixture.position.set(x + 0.48, 0.5, y);
          fixture.rotation.y = Math.PI / 2;
        } else {
          fixture.position.set(x - 0.48, 0.5, y);
          fixture.rotation.y = Math.PI / 2;
        }

        const bucket = this.getCorridorBucket(this.decorationGroup, x, y);
        bucket.add(fixture);

        // Add a dim warm point light at the fixture
        const fixtureLight = new THREE.PointLight(0xffddaa, 0.6, 3);
        fixtureLight.position.copy(fixture.position);
        bucket.add(fixtureLight);
      }
    }
  }

  // ── Private: floor center guide strips ────────────────────────

  private corridorGuideTiles: Set<string> = new Set();

  private placeCorridorGuideStrips(state: GameState): void {
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const tile = state.tiles[y][x];
        if (!tile.explored || tile.type !== TileType.Corridor) continue;

        const key = `guide_${x},${y}`;
        if (this.corridorGuideTiles.has(key)) continue;
        this.corridorGuideTiles.add(key);

        // Determine corridor direction
        const hasE = x < state.width - 1 && (state.tiles[y][x + 1].type === TileType.Corridor || state.tiles[y][x + 1].walkable);
        const hasW = x > 0 && (state.tiles[y][x - 1].type === TileType.Corridor || state.tiles[y][x - 1].walkable);
        const hasN = y > 0 && (state.tiles[y - 1][x].type === TileType.Corridor || state.tiles[y - 1][x].walkable);
        const hasS = y < state.height - 1 && (state.tiles[y + 1][x].type === TileType.Corridor || state.tiles[y + 1][x].walkable);

        const isHorizontal = (hasE || hasW) && !hasN && !hasS;
        const isVertical = (hasN || hasS) && !hasE && !hasW;

        // Thin green guide strip on the floor center
        const stripGeo = new THREE.BoxGeometry(
          isVertical ? 0.03 : 0.9,
          0.005,
          isHorizontal ? 0.03 : 0.9
        );
        const stripMat = new THREE.MeshBasicMaterial({
          color: 0x22ff66,
          transparent: true,
          opacity: 0.25,
        });
        const strip = new THREE.Mesh(stripGeo, stripMat);
        strip.position.set(x, 0.01, y);

        const bucket = this.getCorridorBucket(this.decorationGroup, x, y);
        bucket.add(strip);
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

        // Distressed rooms get red/amber warning lights; others get atmospheric room color
        let lightColor: number;
        let intensity = 1.2;
        if (hasBreach || maxHeat > 40) {
          lightColor = 0xff2200; // red emergency
          intensity = 1.5;
        } else if (maxHeat > 20 || maxSmoke > 30) {
          lightColor = 0xff8800; // amber warning
          intensity = 1.3;
        } else {
          lightColor = ROOM_LIGHT_COLORS[room.name] ?? 0x667788;
        }

        const light = new THREE.PointLight(lightColor, intensity, room.width + room.height + 6);
        light.position.set(centerX, 2.5, centerY);
        this.scene.add(light);
        this.roomLights.set(room.id, light);

        // Place debris in hazardous rooms
        if (hasBreach || maxHeat > 40 || maxSmoke > 50) {
          this.placeDebris(state, room, hasBreach);
        }
      }
    }

    // Corridor lights: dim point lights every 7 tiles along explored corridors
    // Hazard-reactive: red near heat, amber near smoke, blue near low pressure
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const key = `${x},${y}`;
        if (this.corridorLitTiles.has(key)) continue;
        const tile = state.tiles[y][x];
        if (tile.type !== TileType.Corridor || !tile.explored) continue;
        // Only every 7th tile (sparser — headlight provides primary illumination)
        if ((x + y) % 7 !== 0) continue;
        this.corridorLitTiles.add(key);

        // Check nearby tiles for hazards to tint corridor lights
        let lightColor = 0x8899bb; // default cool blue
        let lightIntensity = 0.6;
        if (tile.heat > 40) {
          lightColor = 0xff3300; lightIntensity = 0.9; // red for heat
        } else if (tile.heat > 20 || tile.smoke > 30) {
          lightColor = 0xff8844; lightIntensity = 0.7; // amber for moderate hazards
        } else if (tile.pressure < 40) {
          lightColor = 0x4466cc; lightIntensity = 0.5; // dim blue for low pressure
        }

        const corridorLight = new THREE.PointLight(lightColor, lightIntensity, 4);
        corridorLight.position.set(x, 1.5, y);
        (corridorLight as any)._baseIntensity = lightIntensity;
        (corridorLight as any)._isHazard = tile.heat > 20 || tile.smoke > 30 || tile.pressure < 40;
        this.scene.add(corridorLight);
        this.corridorLightList.push(corridorLight);

        // Light shaft: volumetric beam from ceiling light to floor
        const shaftKey = `shaft_${x},${y}`;
        if (!this._lightShaftTiles.has(shaftKey)) {
          this._lightShaftTiles.add(shaftKey);
          const shaftHeight = 1.8;
          const shaftGeo = new THREE.CylinderGeometry(0.15, 0.35, shaftHeight, 8, 1, true);
          const shaftMat = new THREE.MeshBasicMaterial({
            color: lightColor, transparent: true, opacity: 0.04,
            side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
          });
          const shaft = new THREE.Mesh(shaftGeo, shaftMat);
          shaft.position.set(x, 0.9, y);
          shaft.userData = { isLightShaft: true, baseColor: lightColor, isHazard: (corridorLight as any)._isHazard };
          this.scene.add(shaft);
          this._lightShaftMeshes.push(shaft);

          // Floor light pool: glowing disc where the light hits the floor
          const poolGeo = new THREE.CircleGeometry(0.5, 12);
          const poolMat = new THREE.MeshBasicMaterial({
            color: lightColor, transparent: true, opacity: 0.08,
            depthWrite: false, blending: THREE.AdditiveBlending,
          });
          const pool = new THREE.Mesh(poolGeo, poolMat);
          pool.rotation.x = -Math.PI / 2;
          pool.position.set(x, 0.02, y);
          pool.userData = { isFloorPool: true, baseColor: lightColor, isHazard: (corridorLight as any)._isHazard };
          this.scene.add(pool);
          this._floorPoolMeshes.push(pool);
        }
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
          this.getCorridorBucket(this.decorationGroup, x, y).add(clone);
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
              this.getCorridorBucket(this.decorationGroup, capturedX, capturedY).add(clone);
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

    // Spark particles near breach entities
    for (const [id, ent] of state.entities) {
      if (ent.type !== EntityType.Breach) continue;
      const bx = ent.pos.x, by = ent.pos.y;
      if (Math.abs(bx - px) > viewRange || Math.abs(by - py) > viewRange) continue;
      // Add 2-3 spark sprites per breach
      for (let i = 0; i < 3; i++) {
        const sparkKey = `spark_${id}_${i}`;
        if (this.hazardSpriteKeys.has(sparkKey)) continue;
        this.hazardSpriteKeys.add(sparkKey);
        const spark = this.createHazardSprite(0xffaa22, 0.12, 0.8);
        spark.position.set(
          bx + (Math.random() - 0.5) * 0.6,
          0.2 + Math.random() * 0.8,
          by + (Math.random() - 0.5) * 0.6
        );
        spark.userData = { hazardType: "spark", baseY: spark.position.y, baseX: spark.position.x, baseZ: spark.position.z };
        this.hazardSprites.add(spark);
      }
    }

    // Floor scorch marks near high-heat tiles
    for (let y = Math.max(0, py - viewRange); y < Math.min(state.height, py + viewRange); y++) {
      for (let x = Math.max(0, px - viewRange); x < Math.min(state.width, px + viewRange); x++) {
        const tile = state.tiles[y][x];
        if (!tile.visible || !tile.walkable) continue;
        if (tile.heat < 30) continue;

        const scorchKey = `scorch_${x},${y}`;
        if (this.hazardSpriteKeys.has(scorchKey)) continue;
        this.hazardSpriteKeys.add(scorchKey);

        // Dark scorch mark decal on the floor
        const scorchGeo = new THREE.CircleGeometry(0.3 + (tile.heat / 200), 8);
        scorchGeo.rotateX(-Math.PI / 2);
        const scorchMat = new THREE.MeshBasicMaterial({
          color: 0x221100,
          transparent: true,
          opacity: Math.min(0.6, tile.heat / 100),
          depthWrite: false,
        });
        const scorch = new THREE.Mesh(scorchGeo, scorchMat);
        scorch.position.set(x, 0.02, y);
        this.hazardSprites.add(scorch);
      }
    }

    // Drip particles near low-pressure areas (condensation/leaking)
    for (let y = Math.max(0, py - viewRange); y < Math.min(state.height, py + viewRange); y++) {
      for (let x = Math.max(0, px - viewRange); x < Math.min(state.width, px + viewRange); x++) {
        const tile = state.tiles[y][x];
        if (!tile.visible || !tile.walkable) continue;
        if (tile.pressure >= 50) continue;

        const dripKey = `drip_${x},${y}`;
        if (this.hazardSpriteKeys.has(dripKey)) continue;
        // Only every other qualifying tile
        if ((x + y) % 2 !== 0) continue;
        this.hazardSpriteKeys.add(dripKey);

        const drip = this.createHazardSprite(0x6688cc, 0.06, 0.5);
        drip.position.set(
          x + (Math.random() - 0.5) * 0.3,
          1.5 + Math.random() * 0.5,
          y + (Math.random() - 0.5) * 0.3
        );
        drip.userData = { hazardType: "drip", baseY: drip.position.y, baseX: drip.position.x, baseZ: drip.position.z };
        this.hazardSprites.add(drip);
      }
    }
  }

  // Track previous door lock state for unlock effect triggering
  private doorLockState: Map<string, boolean> = new Map();

  private updateDoorLights(state: GameState): void {
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const tile = state.tiles[y][x];
        if ((tile.type !== TileType.Door && tile.type !== TileType.LockedDoor) || !tile.explored) continue;
        const key = `door_${x},${y}`;
        const isLocked = tile.type === TileType.LockedDoor;
        const wasLocked = this.doorLockState.get(key);

        if (!this.doorLights.has(key)) {
          // First placement
          const lightColor = isLocked ? 0xff3333 : 0x44cc66;
          const light = new THREE.PointLight(lightColor, isLocked ? 0.6 : 0.4, 3);
          light.position.set(x, 1.2, y);
          this.scene.add(light);
          this.doorLights.set(key, light);
          this.doorLockState.set(key, isLocked);
        } else if (wasLocked === true && !isLocked) {
          // Door just unlocked! Update light color and trigger effect
          const light = this.doorLights.get(key)!;
          light.color.setHex(0x44cc66);
          light.intensity = 1.5; // bright flash then fades
          this.doorLockState.set(key, false);
          this.triggerDoorUnlockEffect(x, y);

          // Fade intensity back to normal over time
          const startTime = this.clock.getElapsedTime();
          const fadeLight = () => {
            const t = this.clock.getElapsedTime() - startTime;
            if (t > 1.5) { light.intensity = 0.4; return; }
            light.intensity = 0.4 + 1.1 * Math.max(0, 1 - t / 1.5);
            requestAnimationFrame(fadeLight);
          };
          requestAnimationFrame(fadeLight);
        }
      }
    }
  }

  /** Visual effect when a locked door unlocks: green energy burst */
  private triggerDoorUnlockEffect(x: number, y: number): void {
    // Vertical green energy column
    const colGeo = new THREE.CylinderGeometry(0.2, 0.2, 2.5, 8, 1, true);
    const colMat = new THREE.MeshBasicMaterial({
      color: 0x44ff88, transparent: true, opacity: 0.5,
      side: THREE.DoubleSide, depthWrite: false,
    });
    const col = new THREE.Mesh(colGeo, colMat);
    col.position.set(x, 1.25, y);
    this.scene.add(col);

    // Expanding ground ring
    const ringGeo = new THREE.TorusGeometry(0.3, 0.04, 6, 16);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x44ff88, transparent: true, opacity: 0.9,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(x, 0.05, y);
    this.scene.add(ring);

    // 6 upward sparks
    const sparks: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const sGeo = new THREE.SphereGeometry(0.025, 4, 4);
      const sMat = new THREE.MeshBasicMaterial({
        color: 0x88ffcc, transparent: true, opacity: 1.0,
      });
      const spark = new THREE.Mesh(sGeo, sMat);
      spark.position.set(x + Math.cos(angle) * 0.2, 0.3, y + Math.sin(angle) * 0.2);
      (spark as any)._vx = Math.cos(angle) * 0.5;
      (spark as any)._vz = Math.sin(angle) * 0.5;
      (spark as any)._vy = 2.0 + Math.random();
      this.scene.add(spark);
      sparks.push(spark);
    }

    const startTime = this.clock.getElapsedTime();
    const duration = 1.0;
    const animate = () => {
      const t = (this.clock.getElapsedTime() - startTime) / duration;
      if (t >= 1) {
        this.scene.remove(col); colGeo.dispose(); colMat.dispose();
        this.scene.remove(ring); ringGeo.dispose(); ringMat.dispose();
        for (const s of sparks) {
          this.scene.remove(s);
          (s.geometry as THREE.BufferGeometry).dispose();
          (s.material as THREE.MeshBasicMaterial).dispose();
        }
        return;
      }
      // Column fades
      colMat.opacity = 0.5 * Math.max(0, 1 - t * 2);
      // Ring expands
      const rScale = 1 + t * 4;
      ring.scale.set(rScale, 1, rScale);
      ringMat.opacity = 0.9 * (1 - t);
      // Sparks rise and fade
      const dt = 0.016;
      for (const s of sparks) {
        s.position.x += (s as any)._vx * dt;
        s.position.z += (s as any)._vz * dt;
        s.position.y += (s as any)._vy * dt;
        (s as any)._vy -= 2.0 * dt;
        (s.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      }
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  /** Door hiss: small steam/air particles when door opens */
  private spawnDoorHissParticles(x: number, y: number, isHorizontal: boolean): void {
    const particles: THREE.Sprite[] = [];
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.SpriteMaterial({
        color: 0xccddee, transparent: true, opacity: 0.6,
        depthWrite: false, blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.08, 0.08, 1);
      // Spread along door seam
      const spread = (Math.random() - 0.5) * 0.3;
      const height = 0.2 + Math.random() * 1.6;
      if (isHorizontal) {
        sprite.position.set(x + spread, height, y);
      } else {
        sprite.position.set(x, height, y + spread);
      }
      // Velocity: outward from door seam
      const vel = (Math.random() * 0.3 + 0.1) * (Math.random() > 0.5 ? 1 : -1);
      (sprite as any)._vx = isHorizontal ? vel : 0;
      (sprite as any)._vz = isHorizontal ? 0 : vel;
      (sprite as any)._vy = (Math.random() - 0.3) * 0.2;
      this.scene.add(sprite);
      particles.push(sprite);
    }

    const startTime = this.clock.getElapsedTime();
    const animate = () => {
      const t = this.clock.getElapsedTime() - startTime;
      if (t > 0.6) {
        for (const p of particles) {
          this.scene.remove(p);
          (p.material as THREE.SpriteMaterial).dispose();
        }
        return;
      }
      for (const p of particles) {
        p.position.x += (p as any)._vx * 0.016;
        p.position.z += (p as any)._vz * 0.016;
        p.position.y += (p as any)._vy * 0.016;
        const mat = p.material as THREE.SpriteMaterial;
        mat.opacity = 0.6 * (1 - t / 0.6);
        const s = 0.08 + t * 0.15; // expand slightly as they dissipate
        p.scale.set(s, s, 1);
      }
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  /** Draw glowing energy lines between activated relays */
  private updateRelayPowerLines(state: GameState): void {
    // Collect activated relay positions
    const activatedPositions: { x: number; z: number }[] = [];
    for (const [, entity] of state.entities) {
      if (entity.type === EntityType.Relay && entity.props["activated"] === true) {
        activatedPositions.push({ x: entity.pos.x, z: entity.pos.y });
      }
    }

    // Only redraw if count changed
    if (activatedPositions.length === this.relayPowerLineCount) return;
    this.relayPowerLineCount = activatedPositions.length;

    // Remove old lines and energy dots
    for (const line of this.relayPowerLines) {
      this.scene.remove(line);
      line.geometry.dispose();
      (line.material as THREE.LineBasicMaterial).dispose();
    }
    this.relayPowerLines = [];
    for (const dot of this._relayEnergyDots) {
      this.scene.remove(dot.sprite);
      (dot.sprite.material as THREE.SpriteMaterial).dispose();
    }
    this._relayEnergyDots = [];

    if (activatedPositions.length < 2) return;

    // Connect each pair of adjacent activated relays (within 15 tiles)
    for (let i = 0; i < activatedPositions.length; i++) {
      for (let j = i + 1; j < activatedPositions.length; j++) {
        const a = activatedPositions[i];
        const b = activatedPositions[j];
        const dist = Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
        if (dist > 15) continue; // only nearby relays

        // Create a curved energy line (3 points: start, midpoint raised, end)
        const midX = (a.x + b.x) / 2;
        const midZ = (a.z + b.z) / 2;
        const midY = 1.5 + dist * 0.05; // arc height scales with distance
        const points = [
          new THREE.Vector3(a.x, 0.6, a.z),
          new THREE.Vector3(midX, midY, midZ),
          new THREE.Vector3(b.x, 0.6, b.z),
        ];
        const curve = new THREE.QuadraticBezierCurve3(points[0], points[1], points[2]);
        const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(16));
        const mat = new THREE.LineBasicMaterial({
          color: 0xffcc00,
          transparent: true,
          opacity: 0.4,
          linewidth: 1,
        });
        const line = new THREE.Line(geo, mat);
        this.scene.add(line);
        this.relayPowerLines.push(line);

        // Energy dot: small bright sprite traveling along the curve
        const dotMat = new THREE.SpriteMaterial({
          color: 0xffee44, transparent: true, opacity: 0.8,
          depthWrite: false, blending: THREE.AdditiveBlending,
        });
        const dot = new THREE.Sprite(dotMat);
        dot.scale.set(0.1, 0.1, 1);
        this.scene.add(dot);
        this._relayEnergyDots.push({ sprite: dot, curve, t: Math.random() });
      }
    }
  }

  private updateRoomLabels(state: GameState): void {
    // Hide/show labels based on room-focused visibility
    for (const [roomId, sprite] of this.roomLabels3D) {
      sprite.visible = this._visibleRoomIds.has(roomId);
    }

    for (const room of state.rooms) {
      if (this.roomLabels3D.has(room.id)) continue;
      const cx = room.x + Math.floor(room.width / 2);
      const cy = room.y + Math.floor(room.height / 2);
      if (cy < 0 || cy >= state.height || cx < 0 || cx >= state.width) continue;
      if (!state.tiles[cy][cx].explored) continue;

      // Clean map-style label — no background box, just text with drop shadow
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 64;
      const ctx = canvas.getContext("2d")!;

      const label = room.name.toUpperCase();
      ctx.font = "bold 26px 'Courier New', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Strong dark drop shadow for readability
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillText(label, 257, 34);
      ctx.fillText(label, 258, 35); // double shadow for thickness

      // Main text — crisp white with slight warm tint
      ctx.fillStyle = "#ffe8cc";
      ctx.fillText(label, 256, 32);

      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.85, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      // Scale proportional to room width but with wider canvas
      const labelWidth = Math.max(room.width * 0.7, 2.5);
      sprite.scale.set(labelWidth, labelWidth * (64 / 512), 1);
      sprite.position.set(cx, 2.3, cy);
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

      // Room-focused rendering: skip entities outside current view
      if (!this.isTileInView(entity.pos.x, entity.pos.y, state)) {
        const existing = this.entityMeshes.get(id);
        if (existing) existing.visible = false;
        activeIds.add(id);
        continue;
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
        // Enable shadow casting on entity meshes for headlight shadows
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        this.entityMeshes.set(id, mesh);
        this.entityGroup.add(mesh);
      }

      mesh.visible = true;
      mesh.position.x = entity.pos.x;
      mesh.position.z = entity.pos.y;
      if (entity.type !== EntityType.DataCore && entity.type !== EntityType.Drone) {
        mesh.position.y = mesh.userData.baseY ?? 0.3;
      }

      // Exhaustion dimming: entities that have been fully interacted with appear greyed out
      const exhausted = isEntityExhausted(entity);
      const wasExhausted = mesh.userData._exhausted;
      if (exhausted && !wasExhausted) {
        mesh.userData._exhausted = true;
        mesh.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.color.multiplyScalar(0.5);
            child.material.emissive.setHex(0x000000);
            child.material.emissiveIntensity = 0;
            child.material.opacity = 0.7;
            child.material.transparent = true;
          }
        });
      }

      // Track crew following state for visual indicator
      if (entity.type === EntityType.CrewNPC) {
        mesh.userData._following = entity.props["following"] === true;
      }

      // Track relay activation state for animation
      if (entity.type === EntityType.Relay) {
        const activated = entity.props["activated"] === true;
        const wasActivated = mesh.userData._activated;
        mesh.userData._activated = activated;
        if (activated && !wasActivated) {
          // Just activated — boost emissive to bright yellow
          mesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
              child.material.emissive.setHex(0xffcc00);
              child.material.emissiveIntensity = 0.6;
            }
          });
          // Trigger activation flash at relay position
          this.flashTile(entity.pos.x, entity.pos.y);
          // Golden sparks shooting upward: celebration burst
          for (let si = 0; si < 8; si++) {
            const sparkMat = new THREE.SpriteMaterial({
              color: 0xffdd44, transparent: true, opacity: 0.9,
              depthWrite: false, blending: THREE.AdditiveBlending,
            });
            const spark = new THREE.Sprite(sparkMat);
            spark.scale.set(0.08, 0.08, 1);
            spark.position.set(
              entity.pos.x + (Math.random() - 0.5) * 0.4,
              0.5 + Math.random() * 0.3,
              entity.pos.y + (Math.random() - 0.5) * 0.4,
            );
            (spark as any)._life = 0;
            (spark as any)._maxLife = 0.6 + Math.random() * 0.4;
            (spark as any)._driftY = 2.0 + Math.random() * 1.5; // fast upward
            this.scene.add(spark);
            this._discoverySparkles.push(spark); // shares sparkle animation pool
          }
        }
      }

      // Track PressureValve tile pressure for animation
      if (entity.type === EntityType.PressureValve) {
        const pvTile = state.tiles[entity.pos.y]?.[entity.pos.x];
        mesh.userData._tilePressure = pvTile?.pressure ?? 100;
      }

      // Track breach sealed state
      if (entity.type === EntityType.Breach && entity.props["sealed"] === true) {
        if (!mesh.userData._sealed) {
          mesh.userData._sealed = true;
          mesh.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
              child.material.emissive.setHex(0x448866);
              child.material.emissiveIntensity = 0.2;
              child.material.color.multiplyScalar(0.6);
            }
          });
        }
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

    // Update relay power lines: visible energy connections between activated relays
    this.updateRelayPowerLines(state);

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
  // Key entities only (max ~8 lights active at a time for performance)
  private static readonly ENTITY_GLOW_LIGHTS: Partial<Record<string, { color: number; intensity: number; distance: number }>> = {
    [EntityType.DataCore]: { color: 0xff44ff, intensity: 2.5, distance: 8 },
    [EntityType.Breach]: { color: 0xff2200, intensity: 2.0, distance: 7 },
    [EntityType.EscapePod]: { color: 0x44ffaa, intensity: 1.5, distance: 6 },
    [EntityType.EvidenceTrace]: { color: 0xffaa00, intensity: 1.5, distance: 5 },
    [EntityType.Relay]: { color: 0xffcc00, intensity: 1.5, distance: 6 },
    [EntityType.SensorPickup]: { color: 0x00ffee, intensity: 1.2, distance: 5 },
    [EntityType.CrewNPC]: { color: 0xffcc88, intensity: 1.0, distance: 5 },
    [EntityType.LogTerminal]: { color: 0x66ccff, intensity: 0.8, distance: 4 },
  };

  private createEntityMesh(entity: Entity): THREE.Object3D {
    // Try to use a loaded GLTF model first
    // For CrewNPC, pick a variant based on position hash for visual variety
    let gltfModel = this.gltfCache.get(entity.type);
    if (entity.type === EntityType.CrewNPC) {
      const hash = Math.abs(entity.pos.x * 31 + entity.pos.y * 17) % CREW_MODEL_VARIANTS.length;
      const variantModel = this.gltfCache.get(`CrewNPC_${hash}`);
      if (variantModel) gltfModel = variantModel;
    }
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
            child.material.emissiveIntensity = 0.3;
          }
        });
      } else {
        // Non-glow entities still get a subtle emissive tint from their entity color
        const entityColor = ENTITY_COLORS_3D[entity.type];
        if (entityColor) {
          clone.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
              child.material.emissive = new THREE.Color(entityColor);
              child.material.emissiveIntensity = 0.08;
            }
          });
        }
      }

      // Shadow disc — dark translucent circle for ground shadow
      const shadowDisc = new THREE.Mesh(
        new THREE.CircleGeometry(0.3, 12),
        new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15, depthWrite: false })
      );
      shadowDisc.rotation.x = -Math.PI / 2;
      shadowDisc.position.y = -baseY + 0.01;
      group.add(shadowDisc);

      // Ground ring — glowing circle on the floor beneath the entity
      const ringColor = ENTITY_COLORS_3D[entity.type] ?? 0xffffff;
      const groundRing = new THREE.Mesh(
        new THREE.RingGeometry(0.28, 0.38, 20),
        new THREE.MeshBasicMaterial({ color: ringColor, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })
      );
      groundRing.rotation.x = -Math.PI / 2;
      groundRing.position.y = -baseY + 0.02; // sit at floor level
      group.add(groundRing);

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
        // Screen glow projection — casts light forward onto the floor
        const screenLight = new THREE.PointLight(color, 0.6, 3);
        screenLight.position.set(0, 0.3, 0.15);
        // Floor glow disc from screen light
        const floorGlow = new THREE.Mesh(
          new THREE.CircleGeometry(0.4, 12),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthWrite: false })
        );
        floorGlow.rotation.x = -Math.PI / 2;
        floorGlow.position.set(0, -0.18, 0.3); // just above floor level
        group.add(stand, screen, glow, screenLight, floorGlow);
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
        // Red LED surveillance glow
        const secLight = new THREE.PointLight(0xff2200, 0.4, 2.5);
        secLight.position.set(0, 0.35, 0.2);
        group.add(pole, cam, lens, secLight);
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
        // Large multi-cell bridge console — wide U-shaped desk with multiple screens
        const deskMat = makeToonMaterial({ color: 0x444455, gradientMap: this.toonGradient });
        const screenMat = makeToonMaterial({ color: 0x112233, gradientMap: this.toonGradient, emissive: color, emissiveIntensity: 0.5 });
        const glowMesh = (w: number, h: number, px: number, py: number, pz: number, rx: number) => {
          const g = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
            new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3 }));
          g.position.set(px, py, pz);
          g.rotation.x = rx;
          return g;
        };
        // Center desk section
        const centerDesk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.5), deskMat);
        centerDesk.position.set(0, 0.2, 0);
        // Left wing
        const leftWing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.8), deskMat);
        leftWing.position.set(-0.85, 0.2, -0.3);
        // Right wing
        const rightWing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.8), deskMat);
        rightWing.position.set(0.85, 0.2, -0.3);
        // Center screens (3 monitors)
        for (let si = -1; si <= 1; si++) {
          const scr = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.03), screenMat);
          scr.position.set(si * 0.45, 0.55, 0.18);
          scr.rotation.x = -0.25;
          group.add(scr, glowMesh(0.35, 0.22, si * 0.45, 0.55, 0.20, -0.25));
        }
        // Side screens (angled inward)
        const leftScr = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.03), screenMat);
        leftScr.position.set(-0.85, 0.5, -0.1);
        leftScr.rotation.y = 0.5;
        leftScr.rotation.x = -0.2;
        const rightScr = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.03), screenMat);
        rightScr.position.set(0.85, 0.5, -0.1);
        rightScr.rotation.y = -0.5;
        rightScr.rotation.x = -0.2;
        // Multi-screen glow projection — casts blue light in a pool on the floor
        const consoleScreenLight = new THREE.PointLight(color, 1.0, 4);
        consoleScreenLight.position.set(0, 0.5, 0.5);
        group.add(centerDesk, leftWing, rightWing, leftScr, rightScr, consoleScreenLight);
        baseY = 0.05;
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
    const glowDefFb = BrowserDisplay3D.ENTITY_GLOW_LIGHTS[entity.type];
    if (glowDefFb) {
      const glow = new THREE.PointLight(glowDefFb.color, glowDefFb.intensity, glowDefFb.distance);
      glow.position.set(0, 0.5, 0);
      group.add(glow);
    }

    // Shadow disc — dark translucent circle for ground shadow
    const shadowDiscFb = new THREE.Mesh(
      new THREE.CircleGeometry(0.3, 12),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15, depthWrite: false })
    );
    shadowDiscFb.rotation.x = -Math.PI / 2;
    shadowDiscFb.position.y = -baseY + 0.01;
    group.add(shadowDiscFb);

    // Ground ring — glowing circle on the floor beneath the entity
    const groundRing = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.38, 20),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })
    );
    groundRing.rotation.x = -Math.PI / 2;
    groundRing.position.y = -baseY + 0.02; // sit at floor level
    group.add(groundRing);

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

    // Small tip sphere (antenna tip) — MeshBasicMaterial for proximity signal glow
    const tipGeo = new THREE.SphereGeometry(0.04, 6, 4);
    const tipMat = new THREE.MeshBasicMaterial({
      color: 0x00ff44, transparent: true, opacity: 0.6,
    });
    const tip = new THREE.Mesh(tipGeo, tipMat);
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
    glowCircle.position.y = -0.01; // just above floor
    group.add(glowCircle);

    // Eye light: small emissive sphere on front of body (child 5)
    const eyeGeo = new THREE.SphereGeometry(0.04, 6, 4);
    const eyeMat = new THREE.MeshBasicMaterial({
      color: 0x44ff88, transparent: true, opacity: 0.9,
    });
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(0, 0.1, 0.27); // front of body
    group.add(eye);

    // Cleaning brushes: two small cylinders on the underside (child 6 & 7)
    const brushGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.2, 8);
    const brushMat = makeToonMaterial({ color: 0x666699, gradientMap: this.toonGradient });
    const brushL = new THREE.Mesh(brushGeo, brushMat);
    brushL.position.set(-0.15, -0.22, 0.15);
    brushL.rotation.x = Math.PI / 2; // orient horizontally
    group.add(brushL);
    const brushR = new THREE.Mesh(brushGeo, brushMat);
    brushR.position.set(0.15, -0.22, 0.15);
    brushR.rotation.x = Math.PI / 2;
    group.add(brushR);

    // Headlight: forward-facing spotlight for corridor exploration
    this.headlightTarget = new THREE.Object3D();
    this.headlightTarget.position.set(0, 0.1, 2); // 2 units ahead
    group.add(this.headlightTarget);

    this.headlight = new THREE.SpotLight(0xeeffff, 2.0, 8, Math.PI / 5, 0.4, 1.5);
    this.headlight.position.set(0, 0.15, 0.2); // front of Sweepo
    this.headlight.target = this.headlightTarget;
    this.headlight.castShadow = true;
    this.headlight.shadow.mapSize.width = 512;
    this.headlight.shadow.mapSize.height = 512;
    this.headlight.shadow.camera.near = 0.2;
    this.headlight.shadow.camera.far = 8;
    group.add(this.headlight);

    // Volumetric headlight cone — visible light beam in dusty corridors
    const coneLength = 4.0; // length of the visible beam
    const coneRadius = Math.tan(Math.PI / 5) * coneLength; // match SpotLight angle
    const coneGeo = new THREE.ConeGeometry(coneRadius, coneLength, 16, 1, true);
    // Rotate cone to point forward (+Z direction in group space)
    coneGeo.rotateX(Math.PI / 2);
    coneGeo.translate(0, 0, coneLength / 2 + 0.2); // start from headlight pos
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xeeffff,
      transparent: true,
      opacity: 0.03,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const coneMesh = new THREE.Mesh(coneGeo, coneMat);
    coneMesh.position.y = 0.15; // match headlight Y
    coneMesh.renderOrder = 999; // render after opaque
    coneMesh.userData = { isHeadlightCone: true };
    group.add(coneMesh);

    // Headlight ground spot: elliptical glow on floor ahead of Sweepo
    const spotGeo = new THREE.CircleGeometry(0.6, 16);
    const spotMat = new THREE.MeshBasicMaterial({
      color: 0xeeffff, transparent: true, opacity: 0.06,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this._headlightSpot = new THREE.Mesh(spotGeo, spotMat);
    this._headlightSpot.rotation.x = -Math.PI / 2;
    this._headlightSpot.scale.set(0.8, 1.4, 1); // elongated ellipse
    this._headlightSpot.renderOrder = 1;
    this.scene.add(this._headlightSpot);

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
        // Synty Sweepo model needs +PI/2 correction (flipped 180° from previous -PI/2).
        this.playerFacing = -Math.atan2(dy, dx) + Math.PI / 2;
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

    // Track damage state for visual effects in animate loop
    this._playerHpPercent = state.player.hp / state.player.maxHp;
    this._playerStunned = state.player.stunTurns > 0;

    // Track tile hazards for visual effects in animate loop
    const playerTile = state.tiles[py]?.[px];
    this._playerTilePressure = playerTile?.pressure ?? 100;
    this._playerTileHeat = playerTile?.heat ?? 0;
    this._playerTileDirt = playerTile?.dirt ?? 0;
    this._playerTileSmoke = playerTile?.smoke ?? 0;
    if (this._playerTilePressure < 60) {
      // Find nearest breach entity for wind direction
      let bestDist = Infinity;
      for (const [, entity] of state.entities) {
        if (entity.type !== EntityType.Breach) continue;
        const bd = Math.abs(entity.pos.x - px) + Math.abs(entity.pos.y - py);
        if (bd < bestDist) {
          bestDist = bd;
          const dx = entity.pos.x - px;
          const dy = entity.pos.y - py;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          this._nearestBreachDir = { x: dx / len, z: dy / len };
        }
      }
    }

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

  /** Create a procedural starfield background texture for the scene */
  private createStarfieldTexture(): THREE.CanvasTexture {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // Deep space gradient background
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.7);
    grad.addColorStop(0, "#0c0c1a");
    grad.addColorStop(0.5, "#080814");
    grad.addColorStop(1, "#04040c");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Scatter stars — use seeded positions
    let rng = 42;
    const nextRng = () => { rng = (rng * 16807 + 1) & 0x7fffffff; return (rng & 0xffff) / 0xffff; };
    for (let i = 0; i < 200; i++) {
      const x = nextRng() * size;
      const y = nextRng() * size;
      const brightness = 0.3 + nextRng() * 0.7;
      const radius = 0.3 + nextRng() * 1.2;
      const r = Math.floor(200 + nextRng() * 55);
      const g = Math.floor(200 + nextRng() * 55);
      const b = Math.floor(220 + nextRng() * 35);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${brightness})`;
      ctx.fill();
    }

    // A few brighter prominent stars
    for (let i = 0; i < 15; i++) {
      const x = nextRng() * size;
      const y = nextRng() * size;
      const r = 1 + nextRng() * 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,240,${0.6 + nextRng() * 0.4})`;
      ctx.fill();
      // Glow halo
      const haloGrad = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      haloGrad.addColorStop(0, "rgba(200,220,255,0.15)");
      haloGrad.addColorStop(1, "rgba(200,220,255,0)");
      ctx.beginPath();
      ctx.arc(x, y, r * 3, 0, Math.PI * 2);
      ctx.fillStyle = haloGrad;
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

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
    this.updateCameraFrustum();
  }

  private updateCameraFrustum(): void {
    const sidebarWidth = 340;
    const availW = window.innerWidth - sidebarWidth;
    const availH = window.innerHeight;
    const aspect = availW / availH;

    // Update ortho camera frustum
    const fh = this.cameraFrustumSize;
    const fw = fh * aspect;
    this.orthoCamera.left = -fw;
    this.orthoCamera.right = fw;
    this.orthoCamera.top = fh;
    this.orthoCamera.bottom = -fh;
    this.orthoCamera.updateProjectionMatrix();

    // Update chase camera aspect
    this.chaseCamera.aspect = aspect;
    this.chaseCamera.updateProjectionMatrix();
  }

  private handleWheel(e: WheelEvent): void {
    e.preventDefault();
    if (e.shiftKey) {
      // Shift + scroll: change camera elevation angle
      const angleStep = 0.05;
      if (e.deltaY > 0) {
        this.cameraElevation = Math.min(0.9, this.cameraElevation + angleStep);
      } else if (e.deltaY < 0) {
        this.cameraElevation = Math.max(0.05, this.cameraElevation - angleStep);
      }
    } else {
      // Scroll up (negative deltaY) = zoom in (decrease frustum), scroll down = zoom out
      const zoomStep = 0.3;
      if (e.deltaY > 0) {
        this.cameraFrustumSize = Math.min(CAMERA_FRUSTUM_SIZE_MAX, this.cameraFrustumSize + zoomStep);
      } else if (e.deltaY < 0) {
        this.cameraFrustumSize = Math.max(CAMERA_FRUSTUM_SIZE_MIN, this.cameraFrustumSize - zoomStep);
      }
      this.updateCameraFrustum();
    }
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

    this.doorMesh = new THREE.InstancedMesh(this.doorModelGeo, mat, 400);
    this.doorMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.doorMesh.frustumCulled = false;
    this.doorMesh.count = 0;
    this.scene.add(this.doorMesh);
  }

  /** Post-process a loaded model: normalize scale, center, apply toon materials */
  private prepareModel(key: string, scene: THREE.Object3D): void {
    const model = scene;

    // Synty models are huge (~100 units); normalize to fit in ~0.7 unit box
    // Realistic proportions: Sweepo is a small cleaning bot, furniture is larger
    const ENTITY_SCALE: Partial<Record<string, number>> = {
      player: 0.45,                          // Sweepo — small cleaning robot
      [EntityType.Relay]: 0.55,              // wall-mounted relay box
      [EntityType.DataCore]: 0.7,            // large server rack
      [EntityType.LogTerminal]: 0.55,        // desk terminal
      [EntityType.SecurityTerminal]: 0.55,   // wall panel
      [EntityType.Console]: 1.8,             // large bridge console — spans ~2-3 cells
      [EntityType.RepairCradle]: 0.65,       // work bench
      [EntityType.ServiceBot]: 0.4,          // small bot
      [EntityType.RepairBot]: 0.45,          // medium bot
      [EntityType.Drone]: 0.3,              // small flying drone
      [EntityType.PatrolDrone]: 0.35,        // slightly larger drone
      [EntityType.ToolPickup]: 0.3,          // hand-held tool
      [EntityType.UtilityPickup]: 0.3,       // hand-held item
      [EntityType.SensorPickup]: 0.3,        // hand-held sensor
      [EntityType.MedKit]: 0.25,             // small med pack
      [EntityType.PowerCell]: 0.3,           // battery pack
      [EntityType.FuseBox]: 0.45,            // wall junction box
      [EntityType.PressureValve]: 0.45,      // pipe valve
      [EntityType.EvidenceTrace]: 0.2,       // small clue marker
      [EntityType.EscapePod]: 0.75,          // large escape capsule
      [EntityType.CrewNPC]: 0.55,            // humanoid crew member
      [EntityType.Breach]: 0.5,              // hull damage area
      [EntityType.ClosedDoor]: 0.6,          // door panel
      [EntityType.Airlock]: 0.65,            // large airlock
      [EntityType.CrewItem]: 0.2,            // small personal item
    };
    // Crew variant keys (CrewNPC_0..4) share CrewNPC scale
    const isCrewVariant = key.startsWith("CrewNPC_");
    const lookupKey = isCrewVariant ? EntityType.CrewNPC : key;
    const targetSize = ENTITY_SCALE[lookupKey] ?? 0.4;

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const s = targetSize / maxDim;
      model.scale.multiplyScalar(s);
    }

    // Reset rotation — facing direction is handled at runtime by playerFacing
    model.rotation.y = 0;

    // Re-measure after scaling, center horizontally, sit on floor
    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    scaledBox.getCenter(center);
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= scaledBox.min.y; // sit on y=0

    // Convert materials to toon-shaded, applying Synty atlas where models have UVs but no embedded texture
    const tintColor = key === "player" ? COLORS_3D.player : ENTITY_COLORS_3D[lookupKey];
    const isSyntyModel = isCrewVariant || MODEL_PATHS[key]?.includes("synty-space-gltf");
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
    // Also load crew model variants for visual variety
    const crewVariantEntries: [string, string][] = CREW_MODEL_VARIANTS.map((path, i) => [`CrewNPC_${i}`, path]);
    const allEntries = [...entries, ...crewVariantEntries];
    if (allEntries.length === 0) return;
    let loaded = 0;

    const onDone = () => {
      loaded++;
      if (loaded >= allEntries.length) {
        this.modelsLoaded = true;
        this.addLog(`Loaded ${this.gltfCache.size}/${allEntries.length} 3D models.`, "system");
        this.swapPlayerModel();
        this.rebuildEntityMeshes();
        // Preload decoration models in the background to prevent frame hitches
        this.preloadDecorationModels();
      }
    };

    for (const [key, path] of allEntries) {
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

  /** Preload all decoration/prop models so they're cached before rooms are explored.
   *  This prevents frame hitches when entering new rooms. */
  private preloadDecorationModels(): void {
    // Collect all unique decoration model paths
    const allPaths = new Set<string>();
    for (const paths of Object.values(BrowserDisplay3D.ROOM_DECORATIONS)) {
      for (const p of paths) allPaths.add(p);
    }
    for (const paths of Object.values(BrowserDisplay3D.WALL_PROPS)) {
      for (const p of paths) allPaths.add(p);
    }
    for (const p of BrowserDisplay3D.CORRIDOR_WALL_MODELS) {
      allPaths.add(p);
    }
    allPaths.add(BrowserDisplay3D.CORRIDOR_ARCH_MODEL);

    // Filter out already-cached models
    const toLoad = [...allPaths].filter(p => !this.gltfCache.has(p));
    if (toLoad.length === 0) return;

    let loaded = 0;
    const base = import.meta.env.BASE_URL;

    for (const modelPath of toLoad) {
      const url = base + modelPath;
      this.gltfLoader.load(
        url,
        (gltf) => {
          try {
            const model = gltf.scene.clone();
            // Normalize to decoration scale
            const box = new THREE.Box3().setFromObject(model);
            const size = new THREE.Vector3();
            box.getSize(size);
            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 0) model.scale.multiplyScalar(0.65 / maxDim);

            // Apply toon materials with Synty atlas
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

            this.gltfCache.set(modelPath, model);
          } catch (e) {
            // Silently skip failed decoration models
          }
          loaded++;
          if (loaded >= toLoad.length) {
            console.log(`Preloaded ${loaded} decoration models.`);
          }
        },
        undefined,
        () => { loaded++; } // skip failed loads
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

      // Create new from GLTF — use crew variant if available
      let gltfModel = this.gltfCache.get(entityType)!;
      if (entityType === EntityType.CrewNPC) {
        const hash = Math.abs(Math.round(pos.x) * 31 + Math.round(pos.z) * 17) % CREW_MODEL_VARIANTS.length;
        const variant = this.gltfCache.get(`CrewNPC_${hash}`);
        if (variant) gltfModel = variant;
      }
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

  /** Compute which rooms should be rendered (current room + rooms visible through doors) */
  private computeVisibleRooms(state: GameState): void {
    this._visibleRoomIds.clear();
    const currentRoom = this._currentRoom;
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;

    if (currentRoom) {
      this._visibleRoomIds.add(currentRoom.id);

      // Find rooms connected via doors within a few tiles of current room boundary
      for (const room of state.rooms) {
        if (room.id === currentRoom.id) continue;
        const gapX = Math.max(0, Math.max(room.x - (currentRoom.x + currentRoom.width),
                                           currentRoom.x - (room.x + room.width)));
        const gapY = Math.max(0, Math.max(room.y - (currentRoom.y + currentRoom.height),
                                           currentRoom.y - (room.y + room.height)));
        if (gapX + gapY <= 4) {
          this._visibleRoomIds.add(room.id);
        }
      }
    } else {
      // Player in corridor — show rooms whose boundary is within corridor view range
      for (const room of state.rooms) {
        const nearestX = Math.max(room.x, Math.min(px, room.x + room.width - 1));
        const nearestY = Math.max(room.y, Math.min(py, room.y + room.height - 1));
        const dist = Math.abs(px - nearestX) + Math.abs(py - nearestY);
        if (dist <= BrowserDisplay3D.CORRIDOR_VIEW_RANGE) {
          this._visibleRoomIds.add(room.id);
        }
      }
    }
  }

  /** Check if a tile should be rendered in room-focused mode */
  private isTileInView(x: number, y: number, state: GameState): boolean {
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;

    // Always show tiles within corridor view range of player
    const dist = Math.abs(x - px) + Math.abs(y - py);
    if (dist <= BrowserDisplay3D.CORRIDOR_VIEW_RANGE) return true;

    // Show tiles in visible rooms
    for (const room of state.rooms) {
      if (!this._visibleRoomIds.has(room.id)) continue;
      if (x >= room.x && x < room.x + room.width &&
          y >= room.y && y < room.y + room.height) return true;
      // Also show walls bordering visible rooms (1 tile outside)
      if (x >= room.x - 1 && x <= room.x + room.width &&
          y >= room.y - 1 && y <= room.y + room.height) return true;
    }

    return false;
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
  private compassCanvas: HTMLCanvasElement | null = null;
  private compassCtx: CanvasRenderingContext2D | null = null;

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

        // Determine if tile is in current view (for minimap emphasis)
        const inView = this.isTileInView(x, y, state);
        const dimFactor = inView ? 1.0 : 0.5; // non-view tiles appear dimmer

        if (tile.type === TileType.Wall) {
          const base = tile.visible ? [0x55, 0x66, 0x77] : [0x33, 0x44, 0x55];
          ctx.fillStyle = `rgb(${Math.round(base[0] * dimFactor)}, ${Math.round(base[1] * dimFactor)}, ${Math.round(base[2] * dimFactor)})`;
        } else if (tile.type === TileType.Door || tile.type === TileType.LockedDoor) {
          ctx.fillStyle = tile.type === TileType.LockedDoor ? "#aa3333" : "#997744";
        } else if (tile.walkable) {
          if (tile.heat > 50) {
            ctx.fillStyle = "#aa3300";
          } else if (tile.heat > 25) {
            ctx.fillStyle = "#774400";
          } else if (tile.smoke > 40) {
            ctx.fillStyle = "#444433";
          } else if (tile.pressure < 40) {
            ctx.fillStyle = "#3344aa";
          } else if (tile.pressure < 70) {
            ctx.fillStyle = "#223366";
          } else {
            const base = tile.visible ? [0x44, 0x55, 0x44] : [0x22, 0x33, 0x22];
            ctx.fillStyle = `rgb(${Math.round(base[0] * dimFactor)}, ${Math.round(base[1] * dimFactor)}, ${Math.round(base[2] * dimFactor)})`;
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

      // Pulse ring for key unexhausted entities
      const isKey = entity.type === EntityType.DataCore || entity.type === EntityType.EscapePod || entity.type === EntityType.CrewNPC;
      if (isKey && !isEntityExhausted(entity)) {
        const pulse = 0.3 + Math.sin(now * 2.5 + entity.pos.x * 3) * 0.3;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.arc(px, py, 5 + Math.sin(now * 2) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Distinct shapes per entity type for minimap readability
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      if (entity.type === EntityType.DataCore) {
        // Diamond shape
        ctx.beginPath();
        ctx.moveTo(px, py - 3);
        ctx.lineTo(px + 3, py);
        ctx.lineTo(px, py + 3);
        ctx.lineTo(px - 3, py);
        ctx.closePath();
        ctx.fill();
      } else if (entity.type === EntityType.EscapePod) {
        // Circle
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (entity.type === EntityType.CrewNPC) {
        // Triangle (person)
        ctx.beginPath();
        ctx.moveTo(px, py - 3);
        ctx.lineTo(px + 2.5, py + 2);
        ctx.lineTo(px - 2.5, py + 2);
        ctx.closePath();
        ctx.fill();
      } else if (entity.type === EntityType.Relay) {
        // Plus sign
        ctx.fillRect(px - 1, py - 3, 2, 6);
        ctx.fillRect(px - 3, py - 1, 6, 2);
      } else {
        // Default: small square dot
        const isLarge = entity.type === EntityType.LogTerminal || entity.type === EntityType.Console;
        const dotSize = isLarge ? 3 : 2;
        const offset = Math.floor(dotSize / 2);
        ctx.fillRect(px - offset, py - offset, dotSize, dotSize);
      }
    }

    // Room boundary outlines — highlight current room, dim others
    for (const room of state.rooms) {
      const rcx = room.x + Math.floor(room.width / 2);
      const rcy = room.y + Math.floor(room.height / 2);
      if (rcy >= 0 && rcy < state.height && rcx >= 0 && rcx < state.width && state.tiles[rcy][rcx].explored) {
        const rx = Math.floor(room.x * scale);
        const ry = Math.floor(room.y * scale);
        const rw = Math.ceil(room.width * scale);
        const rh = Math.ceil(room.height * scale);
        const isCurrent = this._currentRoom?.id === room.id;
        const tint = ROOM_WALL_TINTS_3D[room.name];
        if (isCurrent) {
          // Current room: bright glow outline
          ctx.strokeStyle = "#44ff88";
          ctx.lineWidth = 2;
          ctx.shadowColor = "#44ff88";
          ctx.shadowBlur = 4;
        } else if (tint) {
          const tr = (tint >> 16) & 0xff;
          const tg = (tint >> 8) & 0xff;
          const tb = tint & 0xff;
          ctx.strokeStyle = `rgba(${tr}, ${tg}, ${tb}, 0.4)`;
          ctx.lineWidth = 1;
          ctx.shadowBlur = 0;
        } else {
          ctx.strokeStyle = "rgba(100, 120, 140, 0.3)";
          ctx.lineWidth = 1;
          ctx.shadowBlur = 0;
        }
        ctx.strokeRect(rx, ry, rw, rh);
        ctx.shadowBlur = 0;
      }
    }

    // Room name labels on minimap — tiny text at room centers
    ctx.font = "bold 7px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const room of state.rooms) {
      const rcx = room.x + Math.floor(room.width / 2);
      const rcy = room.y + Math.floor(room.height / 2);
      if (rcy >= 0 && rcy < state.height && rcx >= 0 && rcx < state.width && state.tiles[rcy][rcx].explored) {
        const lx = Math.floor((room.x + room.width / 2) * scale);
        const ly = Math.floor((room.y + room.height / 2) * scale);
        const isCurrent = this._currentRoom?.id === room.id;
        // Abbreviate room name: take first word, max 8 chars
        const abbr = room.name.split(/[\s-]/)[0].slice(0, 8);
        ctx.fillStyle = isCurrent ? "rgba(68,255,136,0.8)" : "rgba(180,200,220,0.45)";
        ctx.fillText(abbr, lx, ly);
      }
    }

    // Room cleared checkmarks: small tick for rooms with all entities exhausted
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    for (const room of state.rooms) {
      const rcx = room.x + Math.floor(room.width / 2);
      const rcy = room.y + Math.floor(room.height / 2);
      if (!(rcy >= 0 && rcy < state.height && rcx >= 0 && rcx < state.width && state.tiles[rcy][rcx].explored)) continue;
      // Count entities in this room
      let total = 0;
      let exhausted = 0;
      for (const [eid, ent] of state.entities) {
        if (eid === "player") continue;
        if (ent.pos.x >= room.x && ent.pos.x < room.x + room.width &&
            ent.pos.y >= room.y && ent.pos.y < room.y + room.height) {
          total++;
          if (isEntityExhausted(ent)) exhausted++;
        }
      }
      if (total > 0 && exhausted === total) {
        const rx = Math.floor((room.x + room.width) * scale) - 2;
        const ry = Math.floor(room.y * scale) + 1;
        ctx.fillStyle = "rgba(68,255,100,0.7)";
        ctx.fillText("\u2713", rx, ry); // checkmark
      }
    }

    // Room hazard warning icons on minimap
    ctx.font = "bold 8px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (const room of state.rooms) {
      const rcx = room.x + Math.floor(room.width / 2);
      const rcy = room.y + Math.floor(room.height / 2);
      if (!(rcy >= 0 && rcy < state.height && rcx >= 0 && rcx < state.width && state.tiles[rcy][rcx].explored)) continue;
      // Sample center tile for hazard levels
      const centerTile = state.tiles[rcy]?.[rcx];
      if (!centerTile) continue;
      const rx = Math.floor(room.x * scale) + 1;
      const ry = Math.floor((room.y + room.height) * scale) - 9;
      const hazards: string[] = [];
      if (centerTile.heat > 30) hazards.push("\u2622"); // radiation/heat symbol
      if (centerTile.pressure < 60) hazards.push("\u25b3"); // triangle for vacuum
      if (centerTile.smoke > 30) hazards.push("\u2601"); // cloud for smoke
      if (hazards.length > 0) {
        ctx.fillStyle = centerTile.heat > 50 ? "rgba(255,80,20,0.8)" :
                        centerTile.pressure < 40 ? "rgba(60,120,255,0.8)" :
                        "rgba(180,180,100,0.7)";
        ctx.fillText(hazards.join(""), rx, ry);
      }
    }

    // Player: bright green dot with facing direction arrow
    const ppx = Math.floor(state.player.entity.pos.x * scale);
    const ppy = Math.floor(state.player.entity.pos.y * scale);
    ctx.fillStyle = "#44ff88";
    ctx.fillRect(ppx - 3, ppy - 3, 7, 7);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(ppx - 3, ppy - 3, 7, 7);

    // Facing direction arrow on minimap
    const facing = this.playerFacing;
    const arrowLen = 6;
    // playerFacing: 0 = +Z (down on minimap), PI/2 = -X (left), etc.
    const adx = Math.sin(facing) * arrowLen;
    const ady = Math.cos(facing) * arrowLen;
    ctx.strokeStyle = "#88ffaa";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ppx, ppy);
    ctx.lineTo(ppx + adx, ppy + ady);
    ctx.stroke();
    // Arrowhead
    const headLen = 3;
    const headAngle = 0.5;
    ctx.beginPath();
    ctx.moveTo(ppx + adx, ppy + ady);
    ctx.lineTo(ppx + adx - Math.sin(facing + headAngle) * headLen, ppy + ady - Math.cos(facing + headAngle) * headLen);
    ctx.moveTo(ppx + adx, ppy + ady);
    ctx.lineTo(ppx + adx - Math.sin(facing - headAngle) * headLen, ppy + ady - Math.cos(facing - headAngle) * headLen);
    ctx.stroke();

    // Exploration percentage indicator at bottom of minimap
    let walkableCount = 0;
    let exploredCount = 0;
    for (let my = 0; my < state.height; my++) {
      for (let mx = 0; mx < state.width; mx++) {
        if (state.tiles[my][mx].walkable) {
          walkableCount++;
          if (state.tiles[my][mx].explored) exploredCount++;
        }
      }
    }
    if (walkableCount > 0) {
      const pct = Math.round((exploredCount / walkableCount) * 100);
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = pct >= 100 ? "rgba(68,255,136,0.9)" : "rgba(180,200,220,0.6)";
      ctx.fillText(`${pct}%`, w / 2, h - 2);
    }

    // Render compass
    this.renderCompass();
  }

  private renderCompass(): void {
    if (!this.compassCanvas) {
      this.compassCanvas = document.getElementById("compass-canvas") as HTMLCanvasElement;
      if (this.compassCanvas) {
        this.compassCanvas.style.display = this.chaseCamActive ? "block" : "none";
        this.compassCtx = this.compassCanvas.getContext("2d");
      }
    }
    if (!this.compassCtx || !this.compassCanvas || !this.chaseCamActive) {
      if (this.compassCanvas) this.compassCanvas.style.display = "none";
      return;
    }
    this.compassCanvas.style.display = "block";

    const ctx = this.compassCtx;
    const w = this.compassCanvas.width;
    const h = this.compassCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(cx, cy) - 4;

    ctx.clearRect(0, 0, w, h);

    // Outer ring
    ctx.strokeStyle = "rgba(68, 255, 136, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Cardinal direction labels
    // Player facing: 0 = +Z (south in typical game coords), need to map to compass
    const facing = this.playerFacing;
    const dirs = [
      { label: "N", angle: 0 },
      { label: "E", angle: Math.PI / 2 },
      { label: "S", angle: Math.PI },
      { label: "W", angle: -Math.PI / 2 },
    ];

    ctx.font = "bold 9px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (const d of dirs) {
      // Rotate direction by player facing so compass rotates with view
      const a = d.angle - facing + Math.PI; // offset so N is "up" when facing north
      const lx = cx + Math.sin(a) * (r - 8);
      const ly = cy - Math.cos(a) * (r - 8);

      // Highlight the direction the player is facing
      const angleDiff = Math.abs(d.angle - (facing % (Math.PI * 2)));
      const isActive = angleDiff < 0.5 || angleDiff > Math.PI * 2 - 0.5;
      ctx.fillStyle = isActive ? "#44ff88" : "rgba(68, 255, 136, 0.4)";
      ctx.fillText(d.label, lx, ly);
    }

    // Forward pointer (small triangle)
    ctx.fillStyle = "#44ff88";
    ctx.beginPath();
    ctx.moveTo(cx, cy - r + 2);
    ctx.lineTo(cx - 3, cy - r + 8);
    ctx.lineTo(cx + 3, cy - r + 8);
    ctx.closePath();
    ctx.fill();
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
    const dustCount = 120;
    const positions = new Float32Array(dustCount * 3);

    for (let i = 0; i < dustCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 20;
      positions[i * 3 + 1] = Math.random() * 3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }

    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const dustMat = new THREE.PointsMaterial({
      size: 0.06,
      color: 0xccddee,
      transparent: true,
      opacity: 0.45,
      sizeAttenuation: true,
      depthWrite: false,
    });

    this.dustParticles = new THREE.Points(dustGeo, dustMat);
    this.scene.add(this.dustParticles);
  }

  // ── 3D Waypoint indicator ──────────────────────────────────

  private createWaypointIndicator(): void {
    // Diamond-shaped sprite that points toward objectives
    const canvas = document.createElement("canvas");
    canvas.width = 64; canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    // Draw arrow/diamond
    ctx.fillStyle = "#44ffaa";
    ctx.beginPath();
    ctx.moveTo(32, 4);   // top
    ctx.lineTo(52, 32);  // right
    ctx.lineTo(32, 56);  // bottom
    ctx.lineTo(12, 32);  // left
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, opacity: 0.7,
      depthWrite: false,
    });
    this.waypointSprite = new THREE.Sprite(mat);
    this.waypointSprite.scale.set(0.4, 0.4, 1);
    this.waypointSprite.visible = false;
    this.scene.add(this.waypointSprite);
  }

  private updateWaypoint(state: GameState, elapsed: number): void {
    if (!this.waypointSprite || !this.chaseCamActive) {
      if (this.waypointSprite) this.waypointSprite.visible = false;
      return;
    }

    const sensors = state.player.sensors ?? [];
    const hasThermal = sensors.includes(SensorType.Thermal);
    const hasAtmo = sensors.includes(SensorType.Atmospheric);
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;
    const phase = state.mystery?.objectivePhase ?? ObjectivePhase.Clean;

    // Find best waypoint target
    let bestDist = Infinity;
    let targetX = 0, targetZ = 0;
    let found = false;

    for (const [, ent] of state.entities) {
      const dx = ent.pos.x - px;
      const dy = ent.pos.y - py;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist < 3) continue; // too close, no need for waypoint

      let isTarget = false;
      if (hasThermal && ent.type === EntityType.Relay && ent.props["activated"] !== true && ent.props["locked"] !== true) {
        isTarget = true;
      }
      if (hasAtmo && ent.type === EntityType.CrewNPC && ent.props["following"] !== true && ent.props["evacuated"] !== true) {
        isTarget = true;
      }
      if (phase === ObjectivePhase.Evacuate && ent.type === EntityType.EscapePod) {
        isTarget = true;
      }
      if (ent.type === EntityType.DataCore && ent.props["transmitted"] !== true) {
        isTarget = true;
      }

      if (isTarget && dist < bestDist) {
        bestDist = dist;
        targetX = ent.pos.x;
        targetZ = ent.pos.y;
        found = true;
      }
    }

    if (!found) {
      this.waypointSprite.visible = false;
      return;
    }

    this.waypointSprite.visible = true;

    // Position waypoint 2 units ahead of player in the direction of target
    const dx = targetX - px;
    const dz = targetZ - py;
    const angle = Math.atan2(dx, dz);
    const dist = 2.5;
    const wx = px + Math.sin(angle) * dist;
    const wz = py + Math.cos(angle) * dist;

    this.waypointSprite.position.set(wx, 1.0 + Math.sin(elapsed * 2) * 0.1, wz);

    // Pulse opacity based on distance (closer target = brighter)
    const mat = this.waypointSprite.material as THREE.SpriteMaterial;
    mat.opacity = bestDist > 15 ? 0.3 : bestDist > 8 ? 0.5 : 0.7;

    // Color based on target type
    if (phase === ObjectivePhase.Evacuate) {
      mat.color.setHex(0xff44ff); // magenta for evacuation
    } else {
      mat.color.setHex(0x44ffaa); // green for normal objectives
    }
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
      const inRoom = this._currentRoom !== null;
      const driftSpeed = inRoom ? 0.08 : 0.15; // faster in corridors (turbulence)
      const spreadRadius = inRoom ? 12 : 6; // tighter in corridors

      for (let i = 0; i < posArr.length; i += 3) {
        // Slow upward drift + gentle swirl
        posArr[i] += Math.sin(elapsed * 0.3 + i) * delta * driftSpeed;
        posArr[i + 1] += delta * 0.05;
        posArr[i + 2] += Math.cos(elapsed * 0.2 + i * 0.7) * delta * driftSpeed;

        // Wrap particles to stay near camera, constrain to spread radius
        if (posArr[i + 1] > 3) posArr[i + 1] = 0;
        if (Math.abs(posArr[i]) > spreadRadius) posArr[i] *= 0.5;
        if (Math.abs(posArr[i + 2]) > spreadRadius) posArr[i + 2] *= 0.5;
      }
      this.dustParticles.geometry.attributes.position.needsUpdate = true;

      // Keep dust centered on camera target
      this.dustParticles.position.set(this.cameraPosX, 0, this.cameraPosZ);

      // Tint dust particles to match current room color
      const dustMat = this.dustParticles.material as THREE.PointsMaterial;
      if (this._currentRoom) {
        const roomTint = ROOM_WALL_TINTS_3D[this._currentRoom.name] ?? 0xccddee;
        // Blend white-ish dust with room tint (30%)
        const tr = ((roomTint >> 16) & 0xff);
        const tg = ((roomTint >> 8) & 0xff);
        const tb = (roomTint & 0xff);
        const r = Math.round(0xcc * 0.7 + tr * 0.3);
        const g = Math.round(0xdd * 0.7 + tg * 0.3);
        const b = Math.round(0xee * 0.7 + tb * 0.3);
        dustMat.color.setRGB(r / 255, g / 255, b / 255);
        dustMat.opacity = 0.5; // more visible in lit rooms
      } else {
        dustMat.color.setHex(0x889999); // dimmer, greyer in corridors
        dustMat.opacity = 0.3; // less visible in dark corridors
      }
    }

    // Starfield: dynamic twinkle with individual star variation
    if (this.starfieldPoints) {
      const mat = this.starfieldPoints.material as THREE.PointsMaterial;
      mat.opacity = 0.4 + Math.sin(elapsed * 0.5) * 0.2;
      mat.size = 0.12 + Math.sin(elapsed * 0.3) * 0.02; // subtle size breathing
      // Keep starfield centered on camera
      this.starfieldPoints.position.set(this.cameraPosX, 0, this.cameraPosZ);
      // Slow rotation for cosmic drift
      this.starfieldPoints.rotation.y = elapsed * 0.01;
    }
  }
}
