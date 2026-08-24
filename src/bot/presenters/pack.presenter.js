import {
  formatRarity,
  getRarityDefinition,
} from "../../config/rarity-config.js";
import { createCardStripImage } from "../ui/card-strip-image.js";
import {
  formatCurrency,
  formatNumber,
  formatPositions,
} from "../ui/formatters.js";
import { createUiEmbed } from "../ui/presentation.js";
import { rarityColor } from "../ui/theme.js";

const PACK_IMAGE_NAME = "pack-result.png";

function cardLine({ template, instance }, index = null) {
  const prefix = index == null ? "•" : `**${index}.`;
  const suffix = index == null ? "" : "**";
  return `${prefix} ${template.playerName}${suffix} · ` +
    `${formatRarity(template.rarityCode)} · ${formatPositions(template)} · ` +
    `Lv.${instance.cardLevel} · \`!${instance.publicCardId}\``;
}

function sortBestPulls(cards) {
  return [...cards].sort((left, right) =>
    getRarityDefinition(right.template.rarityCode).rank -
      getRarityDefinition(left.template.rarityCode).rank ||
    right.instance.cardLevel - left.instance.cardLevel ||
    left.template.playerName.localeCompare(right.template.playerName)
  );
}

function batchDescription(cards, packQuantity) {
  const rarityCounts = new Map();
  for (const card of cards) {
    rarityCounts.set(
      card.template.rarityCode,
      (rarityCounts.get(card.template.rarityCode) ?? 0) + 1,
    );
  }
  const summary = [...rarityCounts.entries()]
    .sort((left, right) =>
      getRarityDefinition(right[0]).rank - getRarityDefinition(left[0]).rank
    )
    .map(([rarityCode, count]) =>
      `${formatRarity(rarityCode).padEnd(11)} ${String(count).padStart(4)}`
    )
    .join("\n");
  const bestPulls = sortBestPulls(cards).slice(0, 5);
  return Object.freeze({
    bestPulls,
    description:
      `**${formatNumber(packQuantity)} Packs · ${formatNumber(cards.length)} Cards**\n\n` +
      `\`\`\`text\n${summary}\n\`\`\`\n` +
      `**Best Pulls**\n${bestPulls.map((card) => cardLine(card)).join("\n")}`,
  });
}

export async function createPackOpeningPayload(result) {
  const { pack } = result;
  const cards = result.cards ?? [Object.freeze({
    template: result.template,
    instance: result.instance,
  })];
  const highestRarityCard = sortBestPulls(cards)[0];
  const packQuantity = result.packQuantity ?? result.opening?.packQuantity ?? 1;
  const recordedPrice = Number(result.opening?.priceAmount);
  const totalPrice = result.totalPrice ??
    (Number.isFinite(recordedPrice) && recordedPrice > 0
      ? recordedPrice
      : pack.priceAmount * packQuantity);
  const batch = packQuantity > 1 ? batchDescription(cards, packQuantity) : null;
  const displayedCards = batch?.bestPulls ?? cards;
  const image = await createCardStripImage(
    displayedCards.map((card) => card.template),
  );
  const description = batch?.description ??
    cards.map((card, index) => cardLine(card, index + 1)).join("\n");

  return {
    embeds: [createUiEmbed({
      title: "PACK OPENED",
      color: rarityColor(highestRarityCard.template.rarityCode),
    })
      .setAuthor({ name: pack.displayName })
      .setDescription(
        `${description}\n\n**Cost** · ${formatCurrency(pack.priceCurrency, totalPrice)}`,
      )
      .setImage(`attachment://${PACK_IMAGE_NAME}`)],
    files: [{ attachment: image, name: PACK_IMAGE_NAME }],
  };
}
