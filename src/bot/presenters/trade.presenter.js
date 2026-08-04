import { EmbedBuilder } from "discord.js";

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
      `${card.playerName} - ${card.edition} | Lv${card.cardLevel} | #${card.serialNumber} | Card ${card.cardInstanceId}`,
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
