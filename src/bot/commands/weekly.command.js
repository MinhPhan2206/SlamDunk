import { SlashCommandBuilder } from "discord.js";
import { RewardError } from "../../modules/reward/index.js";
import {
  createWeeklyCooldownPayload,
  createWeeklySuccessPayload,
} from "../presenters/weekly.presenter.js";

export const weeklyCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("weekly")
    .setDescription("Claim your weekly Gold and Shards."),

  async execute(interaction, { services }) {
    await interaction.deferReply();
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });
    try {
      const result = await services.reward.weeklyReward({
        playerId: player.playerId,
        interactionId: interaction.id,
      });
      await interaction.editReply(createWeeklySuccessPayload(result));
    } catch (error) {
      if (
        error instanceof RewardError &&
        error.code === "WEEKLY_COOLDOWN_ACTIVE"
      ) {
        await interaction.editReply(
          createWeeklyCooldownPayload(error.details.availableAt),
        );
        return;
      }
      throw error;
    }
  },
});
