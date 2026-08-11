import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { formatRarity } from "../../config/rarity-config.js";
import { formatNumber } from "../ui/formatters.js";
import { UI_COLORS } from "../ui/theme.js";

const MAX_TRADE_CARDS = 10;

function invitationPending(result) {
  return result.trade.status === "OPEN" &&
    !result.participants.every((participant) => participant.acceptedAt);
}

function expiryTimestamp(trade) {
  return Math.floor(new Date(trade.expiresAt).getTime() / 1_000);
}

function invitationEmbed(result) {
  const [initiator, invited] = result.participants;
  const embed = new EmbedBuilder()
    .setColor(UI_COLORS.warning)
    .setTitle("Trade Invitation")
    .setDescription(
      `**${initiator.username}** invited **${invited.username}** to a Direct Trade.\n` +
      `Both Players must accept before offers can be edited.\n\n` +
      `Expires <t:${expiryTimestamp(result.trade)}:R>.`,
    );
  for (const participant of result.participants) {
    embed.addFields({
      name: participant.username,
      value: participant.acceptedAt ? "✅ Accepted" : "⏳ Waiting",
      inline: true,
    });
  }
  return embed.setFooter({ text: `Trade #${result.trade.tradeId}` });
}

function offeredCardLine(card) {
  return `• **${card.playerName}** · ${formatRarity(card.rarityCode)} · ` +
    `Lv.${card.cardLevel} · \`!${card.publicCardId}\``;
}

function participantField(participant, cards) {
  const offeredCards = cards.filter((card) =>
    card.offeredByPlayerId === participant.playerId
  );
  return {
    name: `${participant.confirmedAt ? "✅" : "✏️"} ${participant.username}`,
    value: [
      `🪙 **${formatNumber(participant.goldOffered)} Gold**`,
      `🃏 **Cards ${offeredCards.length}/${MAX_TRADE_CARDS}**`,
      offeredCards.length
        ? offeredCards.map(offeredCardLine).join("\n")
        : "• None",
    ].join("\n"),
    inline: true,
  };
}

function tradeEmbed(result) {
  const open = result.trade.status === "OPEN";
  const color = result.trade.status === "COMPLETED"
    ? UI_COLORS.success
    : open ? UI_COLORS.secondary : UI_COLORS.neutral;
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(open ? "Direct Trade" : `Trade ${result.trade.status}`)
    .setDescription(open
      ? `Edit your offer, then confirm it. Any change clears both confirmations.\n` +
        `Expires <t:${expiryTimestamp(result.trade)}:R>.`
      : "This Direct Trade is closed.");
  for (const participant of result.participants) {
    embed.addFields(participantField(participant, result.cards));
  }
  return embed.setFooter({ text: `Trade #${result.trade.tradeId}` });
}

export function createTradePayload(result) {
  const pending = invitationPending(result);
  const open = result.trade.status === "OPEN";
  const components = pending
    ? [new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`trade:accept:${result.trade.tradeId}`)
        .setLabel("Accept")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`trade:decline:${result.trade.tradeId}`)
        .setLabel("Decline")
        .setStyle(ButtonStyle.Danger),
    )]
    : open
      ? [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`trade:cards:${result.trade.tradeId}`)
          .setLabel("Cards").setEmoji("🃏").setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`trade:gold:${result.trade.tradeId}`)
          .setLabel("Gold").setEmoji("🪙").setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`trade:confirm:${result.trade.tradeId}`)
          .setLabel("Confirm").setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`trade:cancel:${result.trade.tradeId}`)
          .setLabel("Cancel").setStyle(ButtonStyle.Danger),
      )]
      : [];
  const discordUserIds = result.participants
    .map((participant) => participant.discordUserId)
    .filter(Boolean);
  const mentions = pending
    ? discordUserIds.map((discordUserId) => `<@${discordUserId}>`)
    : [];
  return {
    content: mentions.join(" "),
    allowedMentions: { users: discordUserIds },
    embeds: [pending ? invitationEmbed(result) : tradeEmbed(result)],
    components,
  };
}
