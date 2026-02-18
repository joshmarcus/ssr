import type { GameState, Tile, TileType, Entity, EntityId, PlayerBot, Room, LogEntry, Attachment } from "../shared/types.js";
import { PLAYER_MAX_HP, GLYPHS } from "../shared/constants.js";
import { AttachmentSlot, SensorType } from "../shared/types.js";

export function createEmptyState(seed: number, width: number, height: number): GameState {
  const tiles: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = { type: "wall" as TileType, glyph: GLYPHS.wall, walkable: false, heat: 0, smoke: 0, dirt: 0, pressure: 100, explored: false, visible: false };
    }
  }

  const playerEntity: Entity = {
    id: "player",
    type: "player_bot" as any,
    pos: { x: 0, y: 0 },
    props: {},
  };

  // Player starts with a cleanliness sensor (base sensor for a janitor bot)
  const cleanlinessSensor: Attachment = {
    slot: AttachmentSlot.Sensor,
    name: "cleanliness sensor",
    sensorType: SensorType.Cleanliness,
  };

  const player: PlayerBot = {
    entity: playerEntity,
    attachments: { [AttachmentSlot.Sensor]: cleanlinessSensor },
    sensors: [SensorType.Cleanliness],
    alive: true,
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    stunTurns: 0,
    clearanceLevel: 0,
  };

  return {
    seed,
    turn: 0,
    width,
    height,
    tiles,
    entities: new Map<EntityId, Entity>([["player", playerEntity]]),
    player,
    rooms: [],
    logs: [],
    gameOver: false,
    victory: false,
  };
}
