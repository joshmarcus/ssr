import type { GameState } from "../shared/types.js";
import { GLYPHS } from "../shared/constants.js";

/**
 * Render game state to a plain-text string (for headless/harness use).
 * Full ROT.js Display rendering will be added for browser play.
 */
export function renderToString(state: GameState): string {
  const lines: string[] = [];

  for (let y = 0; y < state.height; y++) {
    let row = "";
    for (let x = 0; x < state.width; x++) {
      if (state.player.entity.pos.x === x && state.player.entity.pos.y === y) {
        row += GLYPHS.player;
      } else {
        row += state.tiles[y][x].glyph;
      }
    }
    lines.push(row);
  }

  lines.push(`Turn: ${state.turn}  Pos: (${state.player.entity.pos.x},${state.player.entity.pos.y})`);
  return lines.join("\n");
}
