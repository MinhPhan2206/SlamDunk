import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { formatGold, formatShards } from "../ui/formatters.js";
import { UI_COLORS } from "../ui/theme.js";

function voteButton(voteUrl) {
  if (!voteUrl) return [];
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Vote on Top.gg")
      .setStyle(ButtonStyle.Link)
      .setURL(voteUrl),
  )];
}

function relative(date) {
  return `<t:${Math.floor(date.getTime() / 1_000)}:R>`;
}

export function createVotePayload(result) {
  const embed = new EmbedBuilder()
    .setColor(UI_COLORS.primary)
    .setTitle("VOTE FOR SLAMDUNK");
  if (!result.voted) {
    embed
      .setDescription(
        "Vote for SlamDunk on Top.gg, then run `/vote` again to claim your reward.",
      )
      .addFields({
        name: "REWARD PER VOTE",
        value: `${formatGold(result.baseRewardGold)} · ` +
          `${formatShards(result.baseRewardShards)}`,
      });
  } else if (result.replayed) {
    embed
      .setDescription("You already claimed the reward for this vote.")
      .addFields({
        name: "NEXT VOTE",
        value: `Available ${relative(result.expiresAt)}`,
      });
  } else {
    embed
      .setColor(UI_COLORS.success)
      .setDescription("Thanks for supporting SlamDunk!")
      .addFields(
        {
          name: "REWARD CLAIMED",
          value: `${formatGold(result.rewardGold)} · ${formatShards(result.rewardShards)}`,
        },
        {
          name: "NEXT VOTE",
          value: `Available ${relative(result.expiresAt)}`,
        },
      );
  }
  return { embeds: [embed], components: voteButton(result.voteUrl) };
}
