import { EmbedBuilder } from "discord.js";

const UPGRADE_COLOR = 0xf59e0b;

export function createFusionEmbed({ sourceCards, resultCard }) {
  const template = sourceCards[0];
  return new EmbedBuilder()
    .setColor(UPGRADE_COLOR)
    .setTitle("Fusion Complete")
    .setDescription(`**${template.playerName} - ${template.edition}**`)
    .addFields(
      {
        name: "Sources",
        value: sourceCards
          .map((card) => `#${card.serialNumber} Lv${card.cardLevel}`)
          .join(" + "),
      },
      {
        name: "Result",
        value: `Card ${resultCard.cardInstanceId} | #${resultCard.serialNumber} | Lv${resultCard.cardLevel}`,
      },
    );
}

export function createLevelUpEmbed({
  card,
  previousLevel,
  newLevel,
  itemName,
  remainingItems,
}) {
  return new EmbedBuilder()
    .setColor(UPGRADE_COLOR)
    .setTitle("Card Upgraded")
    .setDescription(`**${card.playerName} - ${card.edition}**`)
    .addFields(
      { name: "Level", value: `${previousLevel} → ${newLevel}`, inline: true },
      {
        name: itemName,
        value: `${remainingItems} remaining`,
        inline: true,
      },
    )
    .setFooter({ text: `Card Instance ${card.cardInstanceId}` });
}
