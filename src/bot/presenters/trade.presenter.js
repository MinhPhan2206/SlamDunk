import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { formatRarity } from "../../config/rarity-config.js";
import { formatGold } from "../ui/formatters.js";
import { UI_EMOJIS } from "../ui/emojis.js";
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

function participantStatus(participant, trade) {
  if (
    participant.finalAcceptedAt &&
    participant.finalAcceptedRevision === trade.offerRevision
  ) return "✅ FINAL ACCEPTED";
  if (
    participant.readyAt &&
    participant.readyRevision === trade.offerRevision
  ) return trade.reviewStartedAt ? "🔒 REVIEWING" : "🔒 READY";
  return "✏️ EDITING";
}

function participantField(participant, cards, trade) {
  const offeredCards = cards.filter((card) =>
    card.offeredByPlayerId === participant.playerId
  );
  return {
    name: `${participant.username} GIVES`,
    value: [
      `**${participantStatus(participant, trade)}**`,
      `**${formatGold(participant.goldOffered)}**`,
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
  const reviewing = open && Boolean(result.trade.reviewStartedAt);
  const color = result.trade.status === "COMPLETED"
    ? UI_COLORS.success
    : open ? UI_COLORS.secondary : UI_COLORS.neutral;
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(reviewing ? "Final Trade Review" : open ? "Direct Trade" : `Trade ${result.trade.status}`)
    .setDescription(open
      ? reviewing
        ? `Offers are frozen. Check exactly what each Player gives, then select **Final Accept**.\n` +
          `Either Player may return to Editing or cancel before completion.\n` +
          `Expires <t:${expiryTimestamp(result.trade)}:R>.`
        : `Edit your offer, then select **Ready**. A changed offer clears both Ready states.\n` +
          `You can use **Undo Ready** before Final Accept.\n` +
          `Expires <t:${expiryTimestamp(result.trade)}:R>.`
      : "This Direct Trade is closed.");
  for (const participant of result.participants) {
    embed.addFields(participantField(participant, result.cards, result.trade));
  }
  return embed.setFooter({
    text: `Trade #${result.trade.tradeId} • Offer version ${result.trade.offerRevision}`,
  });
}

export function createTradePayload(result) {
  const pending = invitationPending(result);
  const open = result.trade.status === "OPEN";
  const reviewing = open && Boolean(result.trade.reviewStartedAt);
  const revision = result.trade.offerRevision ?? 0;
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
    : reviewing
      ? [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`trade:final:${result.trade.tradeId}:${revision}`)
          .setLabel("Final Accept").setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`trade:undo:${result.trade.tradeId}:${revision}`)
          .setLabel("Back to Editing").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`trade:cancel:${result.trade.tradeId}:${revision}`)
          .setLabel("Cancel Trade").setStyle(ButtonStyle.Danger),
      )]
      : open
        ? [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`trade:cards:${result.trade.tradeId}:${revision}`)
          .setLabel("Cards").setEmoji("🃏").setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`trade:gold:${result.trade.tradeId}:${revision}`)
          .setLabel("Gold").setEmoji(UI_EMOJIS.gold.component).setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`trade:ready:${result.trade.tradeId}:${revision}`)
          .setLabel("Ready").setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`trade:undo:${result.trade.tradeId}:${revision}`)
          .setLabel("Undo Ready").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`trade:cancel:${result.trade.tradeId}:${revision}`)
          .setLabel("Cancel Trade").setStyle(ButtonStyle.Danger),
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
