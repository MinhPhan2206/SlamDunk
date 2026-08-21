import { formatRarity } from "../../config/rarity-config.js";
import { formatGold, formatNumber, formatShards } from "../ui/formatters.js";
import { UI_EMOJIS } from "../ui/emojis.js";
import { createUiEmbed } from "../ui/presentation.js";
import { UI_COLORS } from "../ui/theme.js";

const ITEM_EMOJIS = Object.freeze({
  LEVEL_UP: UI_EMOJIS.levelUp.mention,
  ALPHA_CONTRACT: UI_EMOJIS.alphaContract.mention,
  ALL_STAR_CONTRACT: UI_EMOJIS.allStarContract.mention,
});

function itemEmoji(itemType) {
  return ITEM_EMOJIS[itemType] ?? "📦";
}

function rewardParts(reward) {
  return [
    reward.gold ? formatGold(reward.gold) : null,
    reward.shards ? formatShards(reward.shards) : null,
    ...(reward.items ?? []).map((item) =>
      `${itemEmoji(item.itemType)} ` +
      `${formatNumber(item.quantity)} ${item.itemName}`
    ),
    ...(reward.cards ?? []).map((card) =>
      `🎴 ${card.playerName} · ${formatRarity(card.rarityCode)} · Lv.${card.cardLevel}`
    ),
  ].filter(Boolean);
}

function milestoneParts(milestone) {
  return [
    milestone.gold ? formatGold(milestone.gold) : null,
    milestone.shards ? formatShards(milestone.shards) : null,
    ...milestone.items.map((item) =>
      `${itemEmoji(item.itemType)} ` +
      `${item.quantity} ${item.itemName}`
    ),
    ...milestone.cards.map((card) =>
      `🎴 ${card.quantity}× random ${formatRarity(card.rarityCode)} Card Lv.${card.cardLevel}`
    ),
  ].filter(Boolean);
}

export function createLevelRewardPayload(result) {
  const newlyClaimed = result.newClaims.flatMap((claim) => [
    `**Level ${claim.milestoneLevel}**`,
    ...rewardParts(claim.rewardSnapshot).map((part) => `└ ${part}`),
  ]);
  const milestones = result.milestones.map((milestone) => {
    const status = milestone.claimed ? "✅" : milestone.eligible ? "🟡" : "🔒";
    return `${status} **Lv.${milestone.level}** · ${milestoneParts(milestone).join(" · ")}`;
  });
  const embed = createUiEmbed({ title: "LEVEL REWARDS", color: UI_COLORS.primary })
    .setDescription(`Current Level · **${result.playerLevel}**`)
    .addFields({
      name: result.newClaims.length ? "CLAIMED NOW" : "CLAIM STATUS",
      value: newlyClaimed.length
        ? newlyClaimed.join("\n")
        : "No new milestone rewards are available.",
    }, {
      name: "MILESTONES",
      value: milestones.join("\n"),
    })
    .setFooter({ text: "Run /level-rewards after reaching a new milestone." });
  return { embeds: [embed] };
}
