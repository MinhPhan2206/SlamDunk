import { SlashCommandBuilder } from "discord.js";
import { RewardError } from "../../modules/reward/index.js";
import {
  createDailyCooldownPayload,
  createDailySuccessPayload,
} from "../presenters/daily.presenter.js";

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
      await interaction.editReply(createDailySuccessPayload(result));
    } catch (error) {
      if (error instanceof RewardError && error.code === "DAILY_COOLDOWN_ACTIVE") {
        await interaction.editReply(
          createDailyCooldownPayload(error.details.availableAt),
        );
        return;
      }
      throw error;
    }
  },
});
