import { SlashCommandBuilder } from "discord.js";

import { gameConfig } from "../../config/game-config.js";
import { PackError } from "../../modules/pack/index.js";
import { createPackOpeningPayload } from "../presenters/pack.presenter.js";

const packTypeOption = (option) => {
  option
    .setName("pack_type")
    .setDescription("Pack product to open.")
    .setRequired(true);
  for (const pack of gameConfig.packs) {
    option.addChoices({ name: `${pack.displayName} (${pack.priceGold} Gold)`, value: pack.packCode });
  }
  return option;
};

export const packCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("pack")
    .setDescription("Buy and immediately open a Card Pack.")
    .addStringOption(packTypeOption),

  async execute(interaction, { services }) {
    await interaction.deferReply();
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });
    try {
      const result = await services.pack.openPack({
        playerId: player.playerId,
        packCode: interaction.options.getString("pack_type", true),
        interactionId: interaction.id,
      });
      await interaction.editReply(createPackOpeningPayload(result));
    } catch (error) {
      if (error instanceof PackError) {
        await interaction.editReply({ content: error.message, embeds: [] });
        return;
      }
      throw error;
    }
  },
});
