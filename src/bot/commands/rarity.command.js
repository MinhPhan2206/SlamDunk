import { SlashCommandBuilder } from "discord.js";

import { rarityDefinitions } from "../../config/rarity-config.js";
import { createRarityEmbed } from "../presenters/rarity.presenter.js";

const RARITY_CHOICES = rarityDefinitions.map(({ name, rarityCode }) => ({
  name,
  value: rarityCode,
}));

export const rarityCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("rarity")
    .setDescription("List Card Templates in a rarity.")
    .addStringOption((option) =>
      option
        .setName("rarity")
        .setDescription("Choose a Card rarity.")
        .setRequired(true)
        .addChoices(...RARITY_CHOICES),
    ),

  async execute(interaction, { services }) {
    await interaction.deferReply();

    const rarityCode = interaction.options.getString("rarity", true);
    const result = await services.cardTemplate.listTemplatesByRarity(
      rarityCode,
    );

    await interaction.editReply({
      embeds: [createRarityEmbed(result)],
    });
  },
});
