import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { GameState, Entity, Room } from "../shared/types.js";
import { TileType, EntityType, AttachmentSlot, SensorType } from "../shared/types.js";
import { GLYPHS, DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT, HEAT_PAIN_THRESHOLD } from "../shared/constants.js";
import type { IGameDisplay, LogType, DisplayLogEntry } from "./displayInterface.js";

// FBXLoader is not imported — Synty FBX files are pre-converted to GLTF at build time

// ── Color constants ──────────────────────────────────────────────
const COLORS_3D = {
  floor: 0x555555,
  wall: 0x8899aa,
  door: 0xcc7733,
  lockedDoor: 0xff3333,
  corridor: 0x444444,
  background: 0x111118,
  player: 0x00ff00,
  fogFull: 0x000000,
  fogMemory: 0x111111,
} as const;

// How many world-units tall the visible area is (zoom level)
const CAMERA_FRUSTUM_SIZE = 12;

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
};

// Room wall tints (hex versions — brighter for 3D)
const ROOM_WALL_TINTS_3D: Record<string, number> = {
  "Engineering Storage": 0x998870,
  "Power Relay Junction": 0x998860,
  "Life Support": 0x708899,
  "Vent Control Room": 0x707899,
  "Communications Hub": 0x707899,
  "Research Lab": 0x709970,
  "Med Bay": 0x907080,
  "Data Core": 0x906898,
  "Robotics Bay": 0x888888,
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
};

// ── GLTF Model paths ────────────────────────────────────────────
// Synty FBX files are converted to GLTF via convert-models script.
// Quaternius models are already GLTF.
const WALL_MODEL_PATH = "models/kenney-space/template-wall.glb";
const WALL_CORNER_MODEL_PATH = "models/kenney-space/template-wall-corner.glb";
const FLOOR_MODEL_PATH = "models/kenney-space/template-floor.glb";

const MODEL_PATHS: Partial<Record<string, string>> = {
  player: "models/Vehicles/GLTF/Rover_Round.gltf",
  [EntityType.Relay]: "models/synty-gltf/SM_Electric_Generator_For_Type_01.glb",
  [EntityType.SensorPickup]: "models/synty-gltf/SM_Detector.glb",
  [EntityType.DataCore]: "models/synty-gltf/SM_Lab_Computer.glb",
  [EntityType.ServiceBot]: "models/quaternius-robot/Robot.glb",
  [EntityType.LogTerminal]: "models/synty-gltf/SM_Lab_Computer.glb",
  [EntityType.SecurityTerminal]: "models/synty-gltf/SM_Camera.glb",
  [EntityType.MedKit]: "models/synty-gltf/SM_Box_for_energy_cells.glb",
  [EntityType.CrewItem]: "models/synty-gltf/SM_Floor_Locker_01.glb",
  [EntityType.ClosedDoor]: "models/synty-gltf/SM_Door_For_Type_01.glb",
  [EntityType.RepairBot]: "models/Characters/GLTF/Mech_FinnTheFrog.gltf",
  [EntityType.Drone]: "models/Characters/GLTF/Mech_BarbaraTheBee.gltf",
  [EntityType.PatrolDrone]: "models/Characters/GLTF/Mech_BarbaraTheBee.gltf",
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


  // Animation
  private animFrameId: number = 0;
  private clock: THREE.Clock;

  // Player facing direction (rotation on Y axis)
  private playerFacing: number = 0; // radians — 0 = facing camera (+Z)
  private lastPlayerX: number = -1;
  private lastPlayerY: number = -1;

  // Display state
  private sensorMode: SensorType | null = null;
  private logHistory: DisplayLogEntry[] = [];
  private static readonly MAX_LOG_ENTRIES = 16;
  private roomFlashMessage = "";
  private roomFlashTimer: ReturnType<typeof setTimeout> | null = null;
  private lastRoomId = "";
  private showTrail = false;

  // Dummy objects for instance matrix computation
  private dummy = new THREE.Object3D();

  // Tile counts for instanced meshes
  private maxTiles: number;

  // Resize handler
  private resizeHandler: () => void;

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

    // ── Camera (orthographic, zoomed-in, follows player) ──
    const aspect = this.getAspect();
    const frustumHeight = CAMERA_FRUSTUM_SIZE;
    const frustumWidth = frustumHeight * aspect;
    this.camera = new THREE.OrthographicCamera(
      -frustumWidth / 2, frustumWidth / 2,
      frustumHeight / 2, -frustumHeight / 2,
      0.1, 200
    );
    // Isometric-ish offset: camera sits above+behind the target
    // Will be repositioned each frame to follow the player
    this.camera.position.set(0, 20, 12);
    this.camera.lookAt(0, 0, 0);

    // ── Lights ──
    const ambient = new THREE.AmbientLight(0x888888, 1.2);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(-8, 15, -5);
    this.scene.add(dirLight);

    // Softer fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0x6688aa, 0.4);
    fillLight.position.set(8, 10, 5);
    this.scene.add(fillLight);

    this.playerLight = new THREE.PointLight(0x44ff66, 1.5, 12);
    this.playerLight.position.set(0, 3, 0);
    this.scene.add(this.playerLight);

    // ── Instanced meshes for tiles ──
    // Material color is WHITE — instance colors control per-tile color directly
    // (Three.js multiplies material color * instance color, so white = passthrough)
    const floorGeo = new THREE.PlaneGeometry(1, 1);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.floorMesh = new THREE.InstancedMesh(floorGeo, floorMat, this.maxTiles);
    this.floorMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.floorMesh.frustumCulled = false; // instances span entire map
    this.floorMesh.count = 0;
    this.scene.add(this.floorMesh);

    const wallGeo = new THREE.BoxGeometry(1, 1.5, 1);
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.wallMesh = new THREE.InstancedMesh(wallGeo, wallMat, this.maxTiles);
    this.wallMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wallMesh.frustumCulled = false;
    this.wallMesh.count = 0;
    this.scene.add(this.wallMesh);

    // Corner walls (placeholder geo, replaced when model loads)
    const cornerGeo = new THREE.BoxGeometry(1, 1.5, 1);
    const cornerMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.wallCornerMesh = new THREE.InstancedMesh(cornerGeo, cornerMat, this.maxTiles);
    this.wallCornerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.wallCornerMesh.frustumCulled = false;
    this.wallCornerMesh.count = 0;
    this.scene.add(this.wallCornerMesh);

    const doorGeo = new THREE.BoxGeometry(0.8, 1.0, 0.15);
    const doorMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
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
      opacity: 0.7,
    });
    this.fogMemoryMesh = new THREE.InstancedMesh(fogMemGeo, fogMemMat, this.maxTiles);
    this.fogMemoryMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.fogMemoryMesh.frustumCulled = false;
    this.fogMemoryMesh.count = 0;
    this.scene.add(this.fogMemoryMesh);

    // ── Entity group ──
    this.entityGroup = new THREE.Group();
    this.scene.add(this.entityGroup);

    // ── Player mesh (green cylinder + antenna box) ──
    this.playerMesh = this.createPlayerMesh();
    this.scene.add(this.playerMesh);

    // ── Resize ──
    this.resizeHandler = () => this.handleResize();
    window.addEventListener("resize", this.resizeHandler);
    this.handleResize();

    // ── Start animation loop ──
    this.animate();

    // ── Load GLTF models ──
    this.loadTileModels();
    this.loadModels();
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
    this.sensorMode = this.sensorMode === type ? null : type;
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
      this.roomFlashTimer = setTimeout(() => {
        this.roomFlashMessage = "";
        this.roomFlashTimer = null;
      }, 2000);
    }
    this.lastRoomId = roomId;
  }

  triggerScreenFlash(type: "damage" | "milestone" | "stun"): void {
    const flash = document.getElementById("damage-flash");
    if (!flash) return;
    flash.className = `active ${type}`;
    setTimeout(() => { flash.className = ""; }, 200);
  }

  showGameOverOverlay(state: GameState): void {
    // Delegate to the same DOM overlay as 2D — import the logic from display.ts would be ideal
    // but for now just trigger the overlay directly
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
    const title = isVictory ? "TRANSMISSION COMPLETE" : "CONNECTION LOST";
    const titleClass = isVictory ? "victory" : "defeat";
    const subtitle = isVictory
      ? "The crew's research data streams through the low-band relay."
      : "Rover A3 signal lost. CORVUS-7 drifts on, silent.";

    overlay.innerHTML = `
      <div class="gameover-box ${titleClass}">
        <div class="gameover-title ${titleClass}">${title}</div>
        <div class="gameover-subtitle">${subtitle}</div>
        <div class="gameover-stats">
          <div class="gameover-stat"><span class="stat-label">Turns:</span> <span class="stat-value">${state.turn}</span></div>
          <div class="gameover-stat"><span class="stat-label">Hull:</span> <span class="stat-value ${hpClass}">${state.player.hp}/${state.player.maxHp}</span></div>
          <div class="gameover-stat"><span class="stat-label">Relays:</span> <span class="stat-value">${relaysActivated}/${totalRelays}</span></div>
        </div>
        <div class="gameover-restart">Press [R] to restart</div>
      </div>`;
    overlay.classList.add("active");
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
  }

  // ── Render sidebar UI (same HTML as 2D) ─────────────────────────

  renderUI(state: GameState, panel: HTMLElement, visitedRoomIds?: Set<string>): void {
    // This shares the same HTML-rendering logic as BrowserDisplay.
    // We duplicate the essential parts here so display3d.ts is self-contained.

    let sensorTag = "";
    if (this.sensorMode === SensorType.Thermal) {
      sensorTag = " <span class='thermal-active'>[THERMAL]</span>";
    } else if (this.sensorMode === SensorType.Cleanliness) {
      sensorTag = " <span class='thermal-active'>[CLEANLINESS]</span>";
    } else if (this.sensorMode === SensorType.Atmospheric) {
      sensorTag = " <span class='thermal-active'>[ATMOSPHERIC]</span>";
    }

    // Objective
    const objective = this.getObjective(state);
    const objectiveHtml = `<div class="objective-panel">` +
      `<span class="objective-label">OBJECTIVE:</span> ` +
      `<span class="objective-text">${this.escapeHtml(objective.text)}</span>` +
      `<br><span class="objective-detail">${this.escapeHtml(objective.detail)}</span>` +
      `</div>`;

    // Interaction hint
    let interactHint = "";
    if (!state.gameOver) {
      const nearby = this.getAdjacentInteractables(state);
      if (nearby.length > 0) {
        const target = nearby[0];
        const name = ENTITY_NAMES[target.type] || target.type;
        interactHint = `<span class="interact-hint"> ▸ [i] ${this.escapeHtml(name)}</span>`;
      }
    }

    // Proximity
    let proximityHtml = "";
    if (!state.gameOver) {
      const nearbyEnts = this.getNearbyEntities(state, 3);
      if (nearbyEnts.length > 0) {
        const items = nearbyEnts.slice(0, 4).map(n => {
          const name = ENTITY_NAMES[n.entity.type] || n.entity.type;
          const color = ENTITY_COLORS_CSS[n.entity.type] || "#aaa";
          return `<span style="color:${color}">${this.escapeHtml(name)}</span> <span class="label">(${n.dist} tile${n.dist > 1 ? "s" : ""} ${n.dir})</span>`;
        });
        proximityHtml = `<div class="proximity-bar"><span class="label">NEARBY:</span> ${items.join(" | ")}</div>`;
      }
    }

    // Status bar
    const room = this.getPlayerRoom(state);
    const roomLabel = room
      ? ` | <span class="value">${this.escapeHtml(room.name)}</span>`
      : "";

    const hpPercent = Math.round((state.player.hp / state.player.maxHp) * 100);
    const hpColor = hpPercent > 60 ? "#0f0" : hpPercent > 30 ? "#fa0" : "#f00";
    const hpBarWidth = 10;
    const filledBlocks = Math.round((state.player.hp / state.player.maxHp) * hpBarWidth);
    const emptyBlocks = hpBarWidth - filledBlocks;
    const hpBar = "\u2588".repeat(filledBlocks) + "\u2591".repeat(emptyBlocks);
    const hpTag = ` | <span class="label">HP:</span><span style="color:${hpColor}">${hpBar} ${state.player.hp}/${state.player.maxHp}</span>`;

    const unreadCount = state.logs.filter(l => l.read === false).length;
    const unreadTag = unreadCount > 0
      ? ` | <span style="color:#ca8">[${unreadCount} UNREAD]</span>`
      : "";

    // Discovery counter
    let totalDiscoverables = 0;
    let discovered = 0;
    for (const [, entity] of state.entities) {
      if (entity.type === EntityType.CrewItem && entity.props["hidden"] !== true) {
        totalDiscoverables++;
        if (entity.props["examined"] === true) discovered++;
      }
      if (entity.type === EntityType.LogTerminal) {
        totalDiscoverables++;
        if (state.logs.some(l => l.id === `log_terminal_${entity.id}`)) discovered++;
      }
    }
    for (const [, entity] of state.entities) {
      if (entity.type === EntityType.CrewItem && entity.props["hidden"] === true) {
        if (entity.props["revealed"] === true) {
          totalDiscoverables++;
          if (entity.props["examined"] === true) discovered++;
        }
      }
    }
    const discoveryTag = ` | <span class="label">Discoveries:</span> <span style="color:#ca8">${discovered}/${totalDiscoverables}</span>`;

    const statusHtml = `<div class="status-bar">` +
      `<span class="label">T:</span><span class="value">${state.turn}</span>` +
      roomLabel + sensorTag +
      `<br>` + hpTag.replace(/ \| /, '') +
      `<br>` + discoveryTag.replace(/ \| /, '') + unreadTag.replace(/ \| /g, '') +
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
  }

  // ── Private: animation loop ─────────────────────────────────────

  private animate = (): void => {
    this.animFrameId = requestAnimationFrame(this.animate);
    const elapsed = this.clock.getElapsedTime();

    // Player bob
    if (this.playerMesh) {
      this.playerMesh.position.y = 0.4 + Math.sin(elapsed * 2) * 0.05;
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
      }
    }

    this.renderer.render(this.scene, this.camera);
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
        let brightness = tile.visible ? 1.0 : 0.25;

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
          if (!tile.visible) tempColor.multiplyScalar(0.25);

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
          this.dummy.position.set(x, 0.5, y);
          this.dummy.scale.set(1, 1, 1);
          this.dummy.updateMatrix();
          if (doorIdx < 200) {
            this.doorMesh.setMatrixAt(doorIdx, this.dummy.matrix);
            tempColor.setHex(doorColor);
            if (!tile.visible) tempColor.multiplyScalar(0.25);
            this.doorMesh.setColorAt(doorIdx, tempColor);
            doorIdx++;
          }
        }

        // Floor/corridor
        if (tile.walkable) {
          baseColor = tile.type === TileType.Corridor ? COLORS_3D.corridor : COLORS_3D.floor;

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
  }

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
      return group;
    }

    // Fallback: styled primitive geometry with emissive toon glow
    const color = ENTITY_COLORS_3D[entity.type] ?? 0xffffff;
    const glowMat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
    const group = new THREE.Group();
    let baseY = 0.3;

    switch (entity.type) {
      case EntityType.Relay: {
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.25), glowMat);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.35, 0.03, 8, 24),
          new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.5 })
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
          new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.6 })
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
          new THREE.MeshLambertMaterial({ color: 0xddaa44, emissive: 0x442200, emissiveIntensity: 0.3 }));
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
          new THREE.MeshLambertMaterial({ color: 0x112233, emissive: color, emissiveIntensity: 0.5 }));
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
          new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.4 })
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
          new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.7 })
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
          new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
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
          new THREE.MeshLambertMaterial({ color: 0x664422 }));
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.1),
          new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.2 }));
        group.add(frame, panel);
        baseY = 0.6;
        break;
      }
      case EntityType.SecurityTerminal: {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6),
          new THREE.MeshLambertMaterial({ color: 0x666666 }));
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
      default: {
        const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        group.add(new THREE.Mesh(geo, glowMat));
        baseY = 0.2;
        break;
      }
    }

    group.userData = { entityType: entity.type, baseY, isGltf: false };
    group.position.set(entity.pos.x, baseY, entity.pos.y);
    return group;
  }

  // ── Private: player ─────────────────────────────────────────────

  private createPlayerMesh(): THREE.Group {
    const group = new THREE.Group();

    // Body: cylinder
    const bodyGeo = new THREE.CylinderGeometry(0.25, 0.3, 0.5, 12);
    const bodyMat = new THREE.MeshLambertMaterial({ color: COLORS_3D.player });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0;
    group.add(body);

    // Head / antenna box
    const headGeo = new THREE.BoxGeometry(0.15, 0.25, 0.15);
    const headMat = new THREE.MeshLambertMaterial({ color: 0x00cc00 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.35;
    group.add(head);

    // Antenna
    const antennaGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 4);
    const antennaMat = new THREE.MeshLambertMaterial({ color: 0x88ff88 });
    const antenna = new THREE.Mesh(antennaGeo, antennaMat);
    antenna.position.y = 0.55;
    group.add(antenna);

    // Small tip sphere
    const tipGeo = new THREE.SphereGeometry(0.04, 6, 4);
    const tip = new THREE.Mesh(tipGeo, new THREE.MeshLambertMaterial({ color: 0x00ff44 }));
    tip.position.y = 0.67;
    group.add(tip);

    return group;
  }

  private updatePlayer(state: GameState): void {
    const px = state.player.entity.pos.x;
    const py = state.player.entity.pos.y;

    // Track movement direction and update facing
    if (this.lastPlayerX >= 0 && this.lastPlayerY >= 0) {
      const dx = px - this.lastPlayerX;
      const dy = py - this.lastPlayerY;
      if (dx !== 0 || dy !== 0) {
        // atan2 gives angle from +Z axis: dx=0,dy=-1 (up/north)=0, dx=1,dy=0 (right/east)=π/2
        // In our coordinate system: +x = east, +y(z) = south
        // We want facing direction: Math.atan2(dx, -dy) gives angle from north
        this.playerFacing = Math.atan2(-dx, -dy);
      }
    }
    this.lastPlayerX = px;
    this.lastPlayerY = py;

    this.playerMesh.position.x = px;
    this.playerMesh.position.z = py;
    this.playerMesh.rotation.y = this.playerFacing;
    // Y is handled by animation loop (bob)

    // Update player light
    this.playerLight.position.set(px, 3, py);

    // Camera follows player (isometric offset)
    this.camera.position.set(px, 20, py + 12);
    this.camera.lookAt(px, 0, py);
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
        const tex = hasUVs && (oldMat as THREE.MeshStandardMaterial)?.map
          ? (oldMat as THREE.MeshStandardMaterial).map
          : null;
        foundMat = new THREE.MeshLambertMaterial({
          color: tex ? 0xffffff : ((oldMat as THREE.MeshStandardMaterial)?.color?.getHex() ?? 0xaaaaaa),
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
    const mat = this.wallModelMat ?? new THREE.MeshLambertMaterial({ color: 0xffffff });

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

    const mat = this.wallCornerModelMat ?? new THREE.MeshLambertMaterial({ color: 0xffffff });

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

    const mat = this.floorModelMat ?? new THREE.MeshLambertMaterial({ color: 0xffffff });

    this.floorMesh = new THREE.InstancedMesh(this.floorModelGeo, mat, this.maxTiles);
    this.floorMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.floorMesh.frustumCulled = false;
    this.floorMesh.count = 0;
    this.scene.add(this.floorMesh);
  }

  /** Post-process a loaded model: normalize scale, center, apply materials */
  private prepareModel(key: string, scene: THREE.Object3D): void {
    const model = scene;

    // Normalize scale to fit in a ~0.6–0.8 unit box
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = key === "player" ? 1.0 : 1.0;
    if (maxDim > 0) {
      const s = targetSize / maxDim;
      model.scale.multiplyScalar(s);
    }

    // Rotate models to face toward the camera. Camera looks from (px, 20, py+12) at (px, 0, py).
    // Player rotation is controlled dynamically based on movement direction.
    // Entities face +Z (toward camera) at 0° — GLTF models typically face -Z by default.
    model.rotation.y = 0;

    // Re-measure after scaling + rotation, center horizontally, sit on floor
    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    scaledBox.getCenter(center);
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= scaledBox.min.y; // sit on y=0

    // Convert materials to Lambert, keeping textures where available
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        const oldMat = mats[0] as THREE.MeshStandardMaterial;
        const hasUVs = !!(child.geometry?.attributes?.uv);
        const tex = hasUVs && oldMat?.map ? oldMat.map : null;
        child.material = new THREE.MeshLambertMaterial({
          color: tex ? 0xffffff : (oldMat?.color?.getHex() ?? 0xaaaaaa),
          map: tex,
        });
      }
    });

    // For models without textures, tint with game color
    const tintColor = key === "player" ? COLORS_3D.player : ENTITY_COLORS_3D[key];
    if (tintColor !== undefined) {
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const mat = child.material as THREE.MeshLambertMaterial;
          if (!mat.map) {
            mat.color.setHex(tintColor);
          }
        }
      });
    }

    this.gltfCache.set(key, model);
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
        const tint = ROOM_WALL_TINTS_3D[room.name];
        if (tint) return tint;
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
    if (state.gameOver) {
      return state.victory
        ? { text: "MISSION COMPLETE", detail: "Transmission sent. The crew's work survives." }
        : { text: "CONNECTION LOST", detail: "Refresh to try again." };
    }

    const hasThermal = state.player.attachments[AttachmentSlot.Sensor]?.sensorType === SensorType.Thermal;
    const sensorExists = Array.from(state.entities.values()).some(e => e.type === EntityType.SensorPickup);

    let totalRelays = 0;
    let activatedRelays = 0;
    for (const [, e] of state.entities) {
      if (e.type === EntityType.Relay && e.props["locked"] !== true) {
        totalRelays++;
        if (e.props["activated"] === true) activatedRelays++;
      }
    }
    const remaining = totalRelays - activatedRelays;
    const hasLockedDoor = state.tiles.some(row => row.some(t => t.type === TileType.LockedDoor));

    if (!hasThermal && sensorExists) {
      return {
        text: "Step 1: Find the Thermal Sensor",
        detail: "Explore rooms until you find the cyan S glyph. Walk next to it and press [i] to equip it.",
      };
    }
    if (!hasThermal && !sensorExists) {
      return { text: "Explore the station", detail: "Search rooms for useful equipment." };
    }

    if (remaining > 0) {
      return {
        text: `Step 2: Reroute ${remaining} overheating relay${remaining > 1 ? "s" : ""}`,
        detail: `Press [t] to toggle thermal vision — hot zones glow red. Find the yellow R relays and press [i] next to each one. ${activatedRelays}/${totalRelays} done.`,
      };
    }

    if (hasLockedDoor) {
      return {
        text: "Step 3: Reach the Data Core",
        detail: "All relays rerouted but door is still locked. Look for another way in.",
      };
    }

    return {
      text: "Step 3: Transmit from the Data Core",
      detail: "The locked door (X) is now open. Find the magenta D and press [i] to transmit the research data.",
    };
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
