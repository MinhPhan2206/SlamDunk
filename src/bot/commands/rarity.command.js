import { SlashCommandBuilder } from "discord.js";

import { rarityDefinitions } from "../../config/rarity-config.js";
import { createRarityEmbed } from "../presenters/rarity.presenter.js";

const RARITY_CHOICES = rarityDefinitions.map(({ name, rarityTier }) => ({
  name: `${name} (Tier ${rarityTier})`,
  value: rarityTier,
}));

export const rarityCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("rarity")
    .setDescription("List Card Templates in a rarity tier.")
    .addIntegerOption((option) =>
      option
        .setName("tier")
        .setDescription("Choose a Card rarity.")
        .setRequired(true)
        .addChoices(...RARITY_CHOICES),
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
