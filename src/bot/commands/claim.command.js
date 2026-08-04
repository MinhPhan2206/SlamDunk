import { SlashCommandBuilder } from "discord.js";

import { RewardError } from "../../modules/reward/index.js";
import {
  createClaimCooldownMessage,
  createClaimSuccessMessage,
} from "../presenters/claim.presenter.js";

export const claimCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("claim")
    .setDescription("Claim a Gold reward every 30 minutes."),

  async execute(interaction, { services }) {
    await interaction.deferReply();

    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });

    try {
      const claim = await services.reward.claimReward({
        playerId: player.playerId,
        interactionId: interaction.id,
      });

      await interaction.editReply({ content: createClaimSuccessMessage(claim) });
    } catch (error) {
      if (
        error instanceof RewardError &&
        error.code === "CLAIM_COOLDOWN_ACTIVE"
      ) {
        await interaction.editReply({
          content: createClaimCooldownMessage(error.details.availableAt),
        });
        return;
      }

      throw error;
    }
  },
});
