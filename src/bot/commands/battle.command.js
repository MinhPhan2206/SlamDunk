import { SlashCommandBuilder } from "discord.js";

import { BattleError } from "../../modules/battle/index.js";

export const battleCommand = Object.freeze({
  componentInactivityTimeoutMs: 60_000,

  data: new SlashCommandBuilder()
    .setName("battle")
    .setDescription("Battle the SlamDunk AI with your active lineup."),

  async execute(interaction, { services, battlePlayback }) {
    await interaction.deferReply();
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });

    try {
      const result = await services.battle.battle({
        playerId: player.playerId,
        interactionId: interaction.id,
      });
      await battlePlayback.start({
        interaction,
        result,
        ownerDiscordUserId: interaction.user.id,
        ownerDisplayName:
          interaction.member?.displayName ??
          interaction.user.globalName ??
          interaction.user.username,
      });
    } catch (error) {
      if (error instanceof BattleError) {
        await interaction.editReply({ content: error.message, embeds: [] });
        return;
      }
      throw error;
    }
  },
});
