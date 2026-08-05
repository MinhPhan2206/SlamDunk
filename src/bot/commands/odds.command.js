import { SlashCommandBuilder } from "discord.js";

import { PackError } from "../../modules/pack/index.js";
import { createOddsEmbed } from "../presenters/odds.presenter.js";

export const oddsCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("odds")
    .setDescription("View configured Drop or Pack rarity odds.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("drop")
        .setDescription("View the per-candidate Free Drop odds."),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("pack")
        .setDescription("View odds for a configured Pack.")
        .addStringOption((option) =>
          option
            .setName("pack_code")
            .setDescription("Pack code; omit to use the default Pack.")
            .setRequired(false),
        ),
    ),

  async execute(interaction, { services }) {
    await interaction.deferReply();
    const subcommand = interaction.options.getSubcommand();

    try {
      const result =
        subcommand === "drop"
          ? services.drop.getOdds()
          : services.pack.getOdds(
              interaction.options.getString("pack_code") ?? undefined,
            );
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
