import { SlashCommandBuilder } from "discord.js";

import { createRarityEmbed } from "../presenters/rarity.presenter.js";

export const rarityCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("rarity")
    .setDescription("List Card Templates in a rarity tier.")
    .addIntegerOption((option) =>
      option
        .setName("tier")
        .setDescription("Rarity Tier from 1 to 7 (Tier 7 is Hall of Fame).")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(7),
    ),

  async execute(interaction, { services }) {
    await interaction.deferReply();

    const rarityTier = interaction.options.getInteger("tier", true);
    const result = await services.cardTemplate.listTemplatesByRarity(
      rarityTier,
    );

    await interaction.editReply({
      embeds: [createRarityEmbed(result)],
    });
  },
});
