import { createUiEmbed } from "../ui/presentation.js";
import { UI_COLORS } from "../ui/theme.js";

export function createFusionEmbed({ sourceCards, resultCard }) {
  const template = sourceCards[0];
  return createUiEmbed({ title: "FUSION COMPLETE", color: UI_COLORS.success })
    .setDescription(`**${template.playerName}**`)
    .addFields(
      {
        name: "Sources",
        value: sourceCards
          .map((card) => `\`!${card.publicCardId}\` Lv.${card.cardLevel}`)
          .join(" + "),
      },
      {
        name: "Result",
        value: `Card \`!${resultCard.publicCardId}\` • Lv.${resultCard.cardLevel}`,
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
  return createUiEmbed({ title: "UPGRADE COMPLETE", color: UI_COLORS.success })
    .setDescription(`**${card.playerName}**`)
    .addFields(
      { name: "Level", value: `${previousLevel} → ${newLevel}`, inline: true },
      {
        name: itemName,
        value: `${remainingItems} remaining`,
        inline: true,
      },
    )
    .setFooter({ text: `Card !${card.publicCardId}` });
}
