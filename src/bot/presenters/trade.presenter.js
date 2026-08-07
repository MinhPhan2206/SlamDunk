import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { formatRarity } from "../../config/rarity-config.js";
import { formatNumber } from "../ui/formatters.js";
import { UI_COLORS } from "../ui/theme.js";

function gold(value) {
  return `${formatNumber(value)} Gold`;
}

function participantField(participant, cards) {
  const offeredCards = cards.filter((card) =>
    card.offeredByPlayerId === participant.playerId
  );
  const visibleCards = offeredCards.slice(0, 10).map((card) =>
    `${card.playerName} • ${formatRarity(card.rarityCode)} • ` +
    `Lv.${card.cardLevel} • \`!${card.publicCardId}\``
  );
  return {
    name: `${participant.username} • ${participant.confirmedAt ? "Confirmed" : "Editing"}`,
    value: [
      `Gold: **${gold(participant.goldOffered)}**`,
      visibleCards.length ? visibleCards.join("\n") : "Cards: None",
    ].join("\n"),
    inline: true,
  };
}

export function createTradeEmbed(result, title = "Direct Trade") {
  const open = result.trade.status === "OPEN";
  const expiry = open && result.trade.expiresAt
    ? ` • Expires <t:${Math.floor(new Date(result.trade.expiresAt).getTime() / 1_000)}:R>`
    : "";
  const embed = new EmbedBuilder()
    .setColor(open ? UI_COLORS.secondary : UI_COLORS.success)
    .setTitle(title)
    .setDescription(
      `Trade \`${result.trade.tradeId}\` • **${result.trade.status}**${expiry}`,
    );
  for (const participant of result.participants) {
    embed.addFields(participantField(participant, result.cards));
  }
  return embed.setFooter({
    text: open
      ? "Changing an offer clears both confirmations."
      : "Direct Trade is final.",
  });
}

export function createTradePayload(result, title = "Direct Trade") {
  const open = result.trade.status === "OPEN";
  const components = open
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
  return { embeds: [createTradeEmbed(result, title)], components };
}
