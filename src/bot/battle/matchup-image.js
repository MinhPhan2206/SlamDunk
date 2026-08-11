import { createCardStripImage } from "../ui/card-strip-image.js";

export async function createMatchupImage(aiLineup) {
  if (!Array.isArray(aiLineup) || aiLineup.length !== 5) {
    throw new TypeError("AI matchup image requires exactly five players.");
  }
  return createCardStripImage(aiLineup.map((player) => ({
    ...player,
    playerName: player.playerName ?? player.cardName,
  })));
}
