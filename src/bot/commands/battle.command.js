import { SlashCommandBuilder } from "discord.js";

import { BattleError } from "../../modules/battle/index.js";
import { createBattleEmbed } from "../presenters/battle.presenter.js";

export const battleCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("battle")
    .setDescription("Battle the SlamDunk AI with your active lineup."),

  async execute(interaction, { services }) {
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
      await interaction.editReply({ embeds: [createBattleEmbed(result)] });
    } catch (error) {
      if (error instanceof BattleError) {
        await interaction.editReply({ content: error.message, embeds: [] });
        return;
      }
      throw error;
    }
  },
});
