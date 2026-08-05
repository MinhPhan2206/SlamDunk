import { EmbedBuilder } from "discord.js";
import { formatRarity } from "../../config/rarity-config.js";

const RARITY_COLOR = 0xf28c28;

function singleLine(value) {
  return value.replace(/\s+/g, " ").trim();
}

function formatTemplate(template) {
  const identity = singleLine(
    `${template.playerName} — ${template.edition}${
      template.season ? ` (${template.season})` : ""
    }`,
  ).slice(0, 150);
  const positions = [template.primaryPosition, template.secondaryPosition]
    .filter(Boolean)
    .join("/");

  return `• **${identity}** — OVR ${template.overall}, ${positions}`;
}

export function createRarityEmbed({ rarityTier, templates, total }) {
  const embed = new EmbedBuilder()
    .setColor(RARITY_COLOR)
    .setTitle(`${formatRarity(rarityTier)} Card Templates`);

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
