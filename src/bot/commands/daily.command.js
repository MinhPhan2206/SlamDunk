import { SlashCommandBuilder } from "discord.js";
import { RewardError } from "../../modules/reward/index.js";

const relative = (date) => `<t:${Math.floor(date.getTime() / 1_000)}:R>`;

export const dailyCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("daily")
    .setDescription("Claim your daily Gold and Shards."),
  async execute(interaction, { services }) {
    await interaction.deferReply();
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });
    try {
      const result = await services.reward.dailyReward({ playerId: player.playerId, interactionId: interaction.id });
      await interaction.editReply({ content: [
        `You received **${result.rewardGold} Gold** and **${result.rewardShards} Shards**!`,
        `Balances: **${result.goldBalanceAfter} Gold**, **${result.shardBalanceAfter} Shards**.`,
        `Next daily available ${relative(result.availableAt)}.`,
      ].join("\n") });
    } catch (error) {
      if (error instanceof RewardError && error.code === "DAILY_COOLDOWN_ACTIVE") {
        await interaction.editReply({ content: `Your \`/daily\` is on cooldown. Try again ${relative(error.details.availableAt)}.` });
        return;
      }
      throw error;
    }
  },
});
