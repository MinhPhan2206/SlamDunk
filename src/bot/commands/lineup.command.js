import { SlashCommandBuilder } from "discord.js";

import { LineupError } from "../../modules/lineup/index.js";
import { createLineupEmbed } from "../presenters/lineup.presenter.js";

const SLOT_CHOICES = ["PG", "SG", "SF", "PF", "C"].map((slot) => ({
  name: slot,
  value: slot,
}));

function addSlotOption(subcommand) {
  return subcommand.addStringOption((option) =>
    option
      .setName("slot")
      .setDescription("Lineup position.")
      .setRequired(true)
      .addChoices(...SLOT_CHOICES),
  );
}

export const lineupCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("lineup")
    .setDescription("View or edit your active lineup.")
    .addSubcommand((subcommand) =>
      subcommand.setName("view").setDescription("View your active lineup."),
    )
    .addSubcommand((subcommand) =>
      addSlotOption(
        subcommand
          .setName("set")
          .setDescription("Assign an owned card to a lineup slot."),
      ).addStringOption((option) =>
        option
          .setName("card_id")
          .setDescription("Card Instance ID shown in /collection.")
          .setRequired(true),
      ),
    )
    .addSubcommand((subcommand) =>
      addSlotOption(
        subcommand
          .setName("remove")
          .setDescription("Remove the card from a lineup slot."),
      ),
    ),

  async execute(interaction, { services }) {
    await interaction.deferReply();
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });
    const subcommand = interaction.options.getSubcommand();

    try {
      let result;
      if (subcommand === "set") {
        result = await services.lineup.setCard({
          playerId: player.playerId,
          slot: interaction.options.getString("slot", true),
          cardInstanceId: interaction.options.getString("card_id", true),
        });
      } else if (subcommand === "remove") {
        result = await services.lineup.removeCard({
          playerId: player.playerId,
          slot: interaction.options.getString("slot", true),
        });
      } else {
        result = await services.lineup.getLineup(player.playerId);
      }

      await interaction.editReply({ embeds: [createLineupEmbed(result)] });
    } catch (error) {
      if (error instanceof LineupError) {
        await interaction.editReply({ content: error.message, embeds: [] });
        return;
      }
      throw error;
    }
  },
});
