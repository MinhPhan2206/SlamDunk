import { EmbedBuilder } from "discord.js";
import { formatRarity } from "../../config/rarity-config.js";

export function createPackOpeningPayload(result) {
  const { pack, template, instance } = result;
  return {
    embeds: [
      new EmbedBuilder()
        .setColor(0xf5c542)
        .setTitle(`${pack.displayName} Opened`)
        .setDescription([
          `**${template.playerName} - ${template.edition}**`,
          `${formatRarity(template.rarityCode)} | OVR ${template.overall}`,
          `Card Level: **${instance.cardLevel}**`,
          `Serial: **#${instance.serialNumber}**`,
          `Cost: **${pack.priceGold.toLocaleString("en-US")} Gold**`,
        ].join("\n")),
    ],
  };
}
