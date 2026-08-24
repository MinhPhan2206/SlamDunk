import { SlashCommandBuilder } from "discord.js";

import { gameConfig } from "../../config/game-config.js";
import { PackError } from "../../modules/pack/index.js";
import { createPackOpeningPayload } from "../presenters/pack.presenter.js";
import { formatNumber } from "../ui/formatters.js";

const packTypeOption = (option) => {
  option
    .setName("pack_type")
    .setDescription("Pack product to open.")
    .setRequired(true);
  for (const pack of gameConfig.packs) {
    const currency = pack.priceCurrency === "GOLD" ? "Gold" : "Shards";
    option.addChoices({
      name: `${pack.displayName} (${formatNumber(pack.priceAmount)} ${currency})`,
      value: pack.packCode,
    });
  }
  return option;
};

export const packCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("pack")
    .setDescription("Buy and immediately open a Card Pack.")
    .addStringOption(packTypeOption)
    .addIntegerOption((option) => option
      .setName("quantity")
      .setDescription("Number of Packs to open in one batch (1-100).")
      .setMinValue(1)
      .setMaxValue(100)),

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
        quantity: interaction.options.getInteger("quantity") ?? 1,
        interactionId: interaction.id,
      });
      await interaction.editReply(await createPackOpeningPayload(result));
    } catch (error) {
      if (error instanceof PackError) {
        await interaction.editReply({ content: error.message, embeds: [] });
        return;
      }
      throw error;
    }
  },
});
