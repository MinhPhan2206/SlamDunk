import { EmbedBuilder } from "discord.js";

import { formatNumber } from "../ui/formatters.js";
import { UI_COLORS } from "../ui/theme.js";

export function createWalletEmbed({ wallet, displayName, thumbnailUrl }) {
  const embed = new EmbedBuilder()
    .setColor(UI_COLORS.primary)
    .setTitle(`${displayName}'s Wallet`)
    .setDescription(`**Gold**\n${formatNumber(wallet.goldBalance)}`);
  if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);
  return embed;
}
