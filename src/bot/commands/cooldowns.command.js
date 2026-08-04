import { SlashCommandBuilder } from "discord.js";

import { createCooldownsMessage } from "../presenters/cooldowns.presenter.js";

export const cooldownsCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("cooldowns")
    .setDescription("Check your SlamDunk cooldowns."),

  async execute(interaction, { services }) {
    await interaction.deferReply();

    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });
    const claimCooldown = await services.reward.getClaimCooldown(
      player.playerId,
    );

    await interaction.editReply({
      content: createCooldownsMessage(claimCooldown),
    });
  },
});
