import { SlashCommandBuilder } from "discord.js";

import { LevelRewardError } from "../../modules/level-reward/index.js";
import { createLevelRewardPayload } from "../presenters/level-reward.presenter.js";

export const levelRewardCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("level-rewards")
    .setDescription("View and claim your Player Level milestone rewards."),

  async execute(interaction, { services }) {
    await interaction.deferReply();
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });
    try {
      const result = await services.levelReward.claimAvailable({
        playerId: player.playerId,
      });
      await interaction.editReply(createLevelRewardPayload(result));
    } catch (error) {
      if (error instanceof LevelRewardError) {
        await interaction.editReply({ content: error.message, embeds: [] });
        return;
      }
      throw error;
    }
  },
});
