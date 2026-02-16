import type { GameState, Tile, TileType, Entity, EntityId, PlayerBot, Room, LogEntry } from "../shared/types.js";

export function createEmptyState(seed: number, width: number, height: number): GameState {
  const tiles: Tile[][] = [];
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      tiles[y][x] = { type: "wall" as TileType, glyph: "#", walkable: false, heat: 0, smoke: 0 };
    }
  }

  const playerEntity: Entity = {
    id: "player",
    type: "player_bot" as any,
    pos: { x: 0, y: 0 },
    props: {},
  };

  const player: PlayerBot = {
    entity: playerEntity,
    attachments: {},
    alive: true,
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
