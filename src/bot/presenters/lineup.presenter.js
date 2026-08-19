import { createCardStripImage } from "../ui/card-strip-image.js";
import { createUiEmbed } from "../ui/presentation.js";
import { UI_COLORS } from "../ui/theme.js";

const LINEUP_IMAGE_NAME = "lineup.png";
const STAT_GROUPS = Object.freeze([
  Object.freeze({
    name: "⚔️ Offense",
    stats: Object.freeze([
      ["3PT", "threePoint"], ["MID", "midRange"],
      ["FIN", "finishing"], ["PLAY", "playmaking"],
    ]),
  }),
  Object.freeze({
    name: "🛡️ Defense & Physical",
    stats: Object.freeze([
      ["PER D", "perimeterDefense"], ["INT D", "interiorDefense"],
      ["STR", "strength"], ["HEIGHT", "heightCm"],
    ]),
  }),
]);

function average(slots, field) {
  const values = slots
    .filter((slot) => slot.cardInstanceId)
    .map((slot) => slot.actualStats[field]);
  if (!values.length) return "—";
  return (values.reduce((sum, value) => sum + value, 0) / values.length)
    .toFixed(1);
}

function averageHeight(slots) {
  const heights = slots
    .filter((slot) => slot.cardInstanceId && Number(slot.heightCm) > 0)
    .map((slot) => Number(slot.heightCm));
  if (!heights.length) return "—";
  const averageCm = heights.reduce((sum, value) => sum + value, 0) / heights.length;
  const totalInches = Math.round(averageCm / 2.54);
  return `${Math.floor(totalInches / 12)}'${totalInches % 12}\"`;
}

function statValue(slots, field) {
  return field === "heightCm" ? averageHeight(slots) : average(slots, field);
}

function statBlock(slots, definitions) {
  return `\`\`\`text\n${definitions.map(([label, field]) =>
    `${label.padEnd(7)} ${String(statValue(slots, field)).padStart(6)}`
  ).join("\n")}\n\`\`\``;
}

function winRate(player) {
  const games = Number(player.gamesPlayed);
  return games > 0 ? ((Number(player.gamesWon) / games) * 100).toFixed(1) : "0.0";
}

export function createLineupEmbed(
  result,
  {
    title = "Active Lineup",
    player,
    hasImage = false,
  } = {},
) {
  const filled = result.slots.filter((slot) => slot.cardInstanceId).length;
  const missingSlots = result.slots
    .filter((slot) => !slot.cardInstanceId)
    .map((slot) => slot.slot);
  const embed = createUiEmbed({
    title: title.toUpperCase(),
    color: result.complete ? UI_COLORS.primary : UI_COLORS.warning,
  });
  if (hasImage) embed.setImage(`attachment://${LINEUP_IMAGE_NAME}`);
  for (const group of STAT_GROUPS) {
    embed.addFields({
      name: group.name,
      value: statBlock(result.slots, group.stats),
      inline: true,
    });
  }
  embed.addFields({
    name: "🏆 Record",
    value: `**${player.gamesWon}W – ${player.gamesLost}L** · ` +
      `**${winRate(player)}%** Win Rate · ` +
      `🔥 **${player.currentWinStreak ?? 0}** Streak`,
  });
  return embed.setFooter({
    text: result.complete
      ? "5/5 · Ready for Battle"
      : `${filled}/5 · Missing ${missingSlots.join(", ")}`,
  });
}

export async function createLineupPayload(result, options = {}) {
  const cards = result.slots.map((slot) => slot.cardInstanceId
    ? slot
    : { playerName: "Unknown Player", rarityCode: "BASE" }
  );
  const image = await createCardStripImage(cards);
  return {
    embeds: [createLineupEmbed(result, { ...options, hasImage: true })],
    files: [{ attachment: image, name: LINEUP_IMAGE_NAME }],
  };
}
