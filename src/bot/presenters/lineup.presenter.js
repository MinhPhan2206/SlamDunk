import { EmbedBuilder } from "discord.js";
import { formatRarity } from "../../config/rarity-config.js";
import { createCardStripImage } from "../ui/card-strip-image.js";
import { UI_COLORS } from "../ui/theme.js";

const LINEUP_IMAGE_NAME = "lineup.png";
const STAT_GROUPS = Object.freeze([
  Object.freeze({
    name: "Offense Averages",
    stats: Object.freeze([
      ["3PT", "threePoint"], ["MID", "midRange"],
      ["FIN", "finishing"], ["PLAY", "playmaking"],
    ]),
  }),
  Object.freeze({
    name: "Defense & Physical Averages",
    stats: Object.freeze([
      ["PER D", "perimeterDefense"], ["INT D", "interiorDefense"],
      ["STR", "strength"],
    ]),
  }),
]);

function lineupLine(slot) {
  if (!slot.cardInstanceId) return `**${slot.slot}** • Empty`;
  return `**${slot.slot}** • ${slot.playerName} • ` +
    `${formatRarity(slot.rarityCode)} • Lv.${slot.cardLevel} • ` +
    `\`!${slot.publicCardId}\``;
}

function average(slots, field) {
  const values = slots
    .filter((slot) => slot.cardInstanceId)
    .map((slot) => slot.actualStats[field]);
  if (!values.length) return "—";
  return (values.reduce((sum, value) => sum + value, 0) / values.length)
    .toFixed(1);
}

function statBlock(slots, definitions) {
  return `\`\`\`text\n${definitions.map(([label, field]) =>
    `${label.padEnd(5)} ${String(average(slots, field)).padStart(5)}`
  ).join("\n")}\n\`\`\``;
}

function winRate(player) {
  const games = Number(player.gamesPlayed);
  return games > 0 ? ((Number(player.gamesWon) / games) * 100).toFixed(1) : "0.0";
}

export function createLineupEmbed(
  result,
  { title = "Active Lineup", player, hasImage = false } = {},
) {
  const filled = result.slots.filter((slot) => slot.cardInstanceId).length;
  const embed = new EmbedBuilder()
    .setColor(result.complete ? UI_COLORS.success : UI_COLORS.warning)
    .setTitle(title)
    .setDescription(result.slots.map(lineupLine).join("\n"));
  if (hasImage) embed.setImage(`attachment://${LINEUP_IMAGE_NAME}`);
  for (const group of STAT_GROUPS) {
    embed.addFields({
      name: group.name,
      value: statBlock(result.slots, group.stats),
      inline: true,
    });
  }
  embed.addFields({
    name: "Career Record",
    value: `**${player.gamesWon}-${player.gamesLost}** • ${winRate(player)}% Win Rate`,
  });
  return embed.setFooter({
    text: result.complete ? "5/5 Ready" : `${filled}/5 Slots Filled`,
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
