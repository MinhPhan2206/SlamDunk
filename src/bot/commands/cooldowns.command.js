import { SlashCommandBuilder } from "discord.js";

import { createCooldownsPayload } from "../presenters/cooldowns.presenter.js";

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
    const [claimCooldown, dailyCooldown, freeDropCooldown] = await Promise.all([
      services.reward.getClaimCooldown(player.playerId),
      services.reward.getDailyCooldown(player.playerId),
      services.drop.getCooldown(player.playerId),
    ]);

    await interaction.editReply(
      createCooldownsPayload(claimCooldown, dailyCooldown, freeDropCooldown),
    );
  },
});
