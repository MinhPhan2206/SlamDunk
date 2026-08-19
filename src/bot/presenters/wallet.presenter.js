import { formatGold } from "../ui/formatters.js";
import { createUiEmbed } from "../ui/presentation.js";
import { UI_COLORS } from "../ui/theme.js";

export function createWalletEmbed({ wallet, displayName, thumbnailUrl }) {
  const embed = createUiEmbed({ title: "WALLET", color: UI_COLORS.primary })
    .setAuthor({ name: displayName })
    .addFields({ name: "GOLD BALANCE", value: `**${formatGold(wallet.goldBalance)}**` });
  if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
  return embed;
}
