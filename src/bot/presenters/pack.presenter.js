import { EmbedBuilder } from "discord.js";
import { formatRarity } from "../../config/rarity-config.js";
import { createCardStripImage } from "../ui/card-strip-image.js";
import { formatNumber, formatPositions } from "../ui/formatters.js";
import { rarityColor } from "../ui/theme.js";

const PACK_IMAGE_NAME = "pack-result.png";

export async function createPackOpeningPayload(result) {
  const { pack, template, instance } = result;
  const image = await createCardStripImage([template]);
  return {
    embeds: [new EmbedBuilder()
      .setColor(rarityColor(template.rarityCode))
      .setTitle(`${pack.displayName} Result`)
      .setDescription(
        `**${template.playerName}** • ${formatRarity(template.rarityCode)} • ` +
        `${formatPositions(template)} • Lv.${instance.cardLevel} • ` +
        `\`!${instance.publicCardId}\``,
      )
      .setImage(`attachment://${PACK_IMAGE_NAME}`)
      .setFooter({ text: `Cost: ${formatNumber(pack.priceGold)} Gold` })],
    files: [{ attachment: image, name: PACK_IMAGE_NAME }],
  };
}
