import { EmbedBuilder } from "discord.js";
import {
  formatRarity,
  getRarityDefinition,
} from "../../config/rarity-config.js";
import { createCardStripImage } from "../ui/card-strip-image.js";
import { formatCurrency, formatPositions } from "../ui/formatters.js";
import { rarityColor } from "../ui/theme.js";

const PACK_IMAGE_NAME = "pack-result.png";

export async function createPackOpeningPayload(result) {
  const { pack } = result;
  const cards = result.cards ?? [Object.freeze({
    template: result.template,
    instance: result.instance,
  })];
  const highestRarityCard = cards.reduce((highest, card) =>
    getRarityDefinition(card.template.rarityCode).rank >
      getRarityDefinition(highest.template.rarityCode).rank
      ? card
      : highest
  );
  const image = await createCardStripImage(
    cards.map((card) => card.template),
  );
  return {
    embeds: [new EmbedBuilder()
      .setColor(rarityColor(highestRarityCard.template.rarityCode))
      .setTitle(`${pack.displayName} Result`)
      .setDescription(
        cards.map(({ template, instance }, index) =>
          `**${index + 1}. ${template.playerName}** • ${formatRarity(template.rarityCode)} • ` +
          `${formatPositions(template)} • Lv.${instance.cardLevel} • ` +
          `\`!${instance.publicCardId}\``
        ).join("\n") + `\n\n**Cost** · ${formatCurrency(pack.priceCurrency, pack.priceAmount)}`,
      )
      .setImage(`attachment://${PACK_IMAGE_NAME}`)],
    files: [{ attachment: image, name: PACK_IMAGE_NAME }],
  };
}
