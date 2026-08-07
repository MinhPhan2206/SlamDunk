import { SlashCommandBuilder } from "discord.js";

import { gameConfig } from "../../config/game-config.js";
import { PackError } from "../../modules/pack/index.js";
import { createOddsEmbed } from "../presenters/odds.presenter.js";

function addPackTypeOption(option) {
  option
    .setName("pack_type")
    .setDescription("Drop or Pack odds to view.")
    .setRequired(false)
    .addChoices({ name: "Free Drop", value: "drop" });
  for (const pack of gameConfig.packs) {
    option.addChoices({ name: pack.displayName, value: pack.packCode });
  }
  return option;
}

export const oddsCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("odds")
    .setDescription("View configured Drop or Pack rarity odds.")
    .addStringOption(addPackTypeOption),

  async execute(interaction, { services }) {
    await interaction.deferReply();
    const packType = interaction.options.getString("pack_type") ?? "drop";

    try {
      const result = packType === "drop"
        ? services.drop.getOdds()
        : services.pack.getOdds(packType);
      await interaction.editReply({ embeds: [createOddsEmbed(result)] });
    } catch (error) {
      if (error instanceof PackError) {
        await interaction.editReply({ content: error.message, embeds: [] });
        return;
      }
      throw error;
    }
  },
});
