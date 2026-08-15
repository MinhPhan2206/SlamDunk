import { EmbedBuilder } from "discord.js";

import { formatGold } from "../ui/formatters.js";
import { UI_COLORS } from "../ui/theme.js";

export function createWalletEmbed({ wallet, displayName, thumbnailUrl }) {
  const embed = new EmbedBuilder()
    .setColor(UI_COLORS.primary)
    .setTitle(`${displayName}'s Wallet`)
    .setDescription(`**${formatGold(wallet.goldBalance)}**`);
  if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
  return embed;
}
