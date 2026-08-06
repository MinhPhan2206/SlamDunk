import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";

const TRADE_COLOR = 0x3b82f6;

function gold(value) {
  return `${BigInt(value).toLocaleString("en-US")} Gold`;
}

function participantField(participant, cards) {
  const offeredCards = cards.filter(
    (card) => card.offeredByPlayerId === participant.playerId,
  );
  const visibleCards = offeredCards.slice(0, 8).map(
    (card) =>
      `${card.playerName} | Lv${card.cardLevel} | #${card.serialNumber} | ID !${card.publicCardId}`,
  );
  if (offeredCards.length > visibleCards.length) {
    visibleCards.push(`…and ${offeredCards.length - visibleCards.length} more card(s)`);
  }
  return {
    name: `${participant.username} ${participant.confirmedAt ? "✅" : "⏳"}`,
    value: [
      `Gold: ${gold(participant.goldOffered)}`,
      visibleCards.length ? visibleCards.join("\n") : "Cards: None",
    ].join("\n"),
  };
}

export function createTradeEmbed(result, title = "Direct Trade") {
  const embed = new EmbedBuilder()
    .setColor(TRADE_COLOR)
    .setTitle(title)
    .setDescription(
      `Trade ${result.trade.tradeId} | Status: **${result.trade.status}**`,
    );

  for (const participant of result.participants) {
    embed.addFields(participantField(participant, result.cards));
  }

  return embed.setFooter({
    text:
      result.trade.status === "OPEN"
        ? "Any offer change clears both confirmations."
        : "Direct Trade is final.",
  });
}

export function createTradePayload(result, title = "Direct Trade") {
  const open = result.trade.status === "OPEN";
  const components = open
    ? [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`trade:cards:${result.trade.tradeId}`).setLabel("Edit Cards").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`trade:gold:${result.trade.tradeId}`).setLabel("Edit Gold").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`trade:confirm:${result.trade.tradeId}`).setLabel("Confirm").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`trade:cancel:${result.trade.tradeId}`).setLabel("Cancel").setStyle(ButtonStyle.Danger),
      )]
    : [];
  return { embeds: [createTradeEmbed(result, title)], components };
}
