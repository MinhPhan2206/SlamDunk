import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { formatRarity } from "../../config/rarity-config.js";

const MAX_VISIBLE_CARDS = 20;

function cardLine(card) {
  return `**${card.playerName}** | !${card.publicCardId} | ${formatRarity(card.rarityCode)} | ${card.shardReward} Shards`;
}

export function createQuicksellPreviewPayload({ session, cards }) {
  const visible = cards.slice(0, MAX_VISIBLE_CARDS).map(cardLine);
  if (cards.length > visible.length) {
    visible.push(`…and ${cards.length - visible.length} more card(s).`);
  }
  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle("Removal / Quicksell List")
    .setDescription([
      `Permanently destroy **${cards.length} card(s)** for **${session.totalShards} Shards**?`,
      "Locked, listed, traded, and lineup cards are excluded.",
      "This action cannot be undone.",
      "",
      ...visible,
    ].join("\n"));
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`quicksell:confirm:${session.quicksellSessionId}`)
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`quicksell:cancel:${session.quicksellSessionId}`)
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger),
  );
  return { embeds: [embed], components: [buttons] };
}

export function createQuicksellCompletedPayload({ session, cards }) {
  return {
    embeds: [new EmbedBuilder()
      .setColor(0x22c55e)
      .setTitle("Quicksell Completed")
      .setDescription(
        `Destroyed **${cards.length} card(s)** for **${session.totalShards} Shards**.\nShard balance: **${session.shardBalanceAfter}**`,
      )],
    components: [],
  };
}

export function createQuicksellCancelledPayload() {
  return {
    embeds: [new EmbedBuilder()
      .setColor(0x6b7280)
      .setTitle("Quicksell Cancelled")
      .setDescription("No cards were destroyed.")],
    components: [],
  };
}

export function createQuicksellEmbed({ card, shardReward, shardBalance }) {
  return new EmbedBuilder()
    .setColor(0x8b5cf6)
    .setTitle("Card Quicksold")
    .setDescription(`**${card.playerName}**`)
    .addFields(
      { name: "Received", value: `${shardReward} Shards`, inline: true },
      { name: "Shard Balance", value: shardBalance, inline: true },
    )
    .setFooter({ text: `Card !${card.publicCardId} was destroyed.` });
}
