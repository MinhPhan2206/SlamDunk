import { EmbedBuilder } from "discord.js";

export function createQuicksellEmbed({ card, shardReward, shardBalance }) {
  return new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle("Card Quicksold")
    .setDescription(`**${card.playerName} - ${card.edition}**`)
    .addFields(
      { name: "Received", value: `${shardReward} Shards`, inline: true },
      { name: "Shard Balance", value: shardBalance, inline: true },
    )
    .setFooter({ text: `Card !${card.publicCardId} was destroyed.` });
}
