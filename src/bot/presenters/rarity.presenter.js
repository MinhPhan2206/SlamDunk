import { EmbedBuilder } from "discord.js";
import { formatRarity } from "../../config/rarity-config.js";
import { rarityColor } from "../ui/theme.js";

function singleLine(value) {
  return value.replace(/\s+/g, " ").trim();
}

function formatTemplate(template) {
  const identity = singleLine(template.playerName).slice(0, 150);
  const positions = [template.primaryPosition, template.secondaryPosition]
    .filter(Boolean)
    .join("/");

  return `• **${identity}** • ${positions}`;
}

export function createRarityEmbed({ rarityCode, templates, total }) {
  const embed = new EmbedBuilder()
    .setColor(rarityColor(rarityCode))
    .setTitle(`${formatRarity(rarityCode)} Card Templates`);

  if (templates.length === 0) {
    return embed.setDescription("No Card Templates exist in this rarity yet.");
  }

  embed.setDescription(templates.map(formatTemplate).join("\n"));

  if (BigInt(total) > BigInt(templates.length)) {
    embed.setFooter({
      text: `Showing ${templates.length} of ${total} Card Templates.`,
    });
  }

  return embed;
}
