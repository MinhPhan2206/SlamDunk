import { formatRarity } from "../../config/rarity-config.js";
import { createCardStripImage } from "../ui/card-strip-image.js";
import { formatPositions } from "../ui/formatters.js";
import { UI_EMOJIS } from "../ui/emojis.js";
import { createUiEmbed } from "../ui/presentation.js";
import { rarityColor } from "../ui/theme.js";

const CONTRACT_IMAGE_NAME = "contract-result.webp";

const CONTRACT_EMOJIS = Object.freeze({
  ALPHA_CONTRACT: UI_EMOJIS.alphaContract.mention,
  ALL_STAR_CONTRACT: UI_EMOJIS.allStarContract.mention,
});

export async function createContractOpeningPayload(result) {
  const image = await createCardStripImage([result.template]);
  return {
    embeds: [createUiEmbed({
      title: "CONTRACT SIGNED",
      color: rarityColor(result.template.rarityCode),
    })
      .setAuthor({ name: result.contract.displayName })
      .setDescription(
        `${CONTRACT_EMOJIS[result.contract.itemType] ?? "📜"} ` +
        `**${result.template.playerName}** · ${formatRarity(result.template.rarityCode)} · ` +
        `${formatPositions(result.template)} · Lv.${result.instance.cardLevel} · ` +
        `\`!${result.instance.publicCardId}\``,
      )
      .setImage(`attachment://${CONTRACT_IMAGE_NAME}`)],
    files: [{ attachment: image, name: CONTRACT_IMAGE_NAME }],
  };
}
