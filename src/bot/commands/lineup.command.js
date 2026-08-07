import { SlashCommandBuilder } from "discord.js";

import { CardError } from "../../modules/card/index.js";
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
      subcommand
        .setName("view")
        .setDescription("View a user's active lineup.")
        .addUserOption((option) =>
          option
            .setName("user")
            .setDescription("User whose lineup you want to view."),
        ),
    )
    .addSubcommand((subcommand) =>
      addSlotOption(
        subcommand
          .setName("set")
          .setDescription("Assign an owned card to a lineup slot."),
      ).addStringOption((option) =>
        option
          .setName("card_id")
          .setDescription("Public Card ID or number in /collection.")
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
    const subcommand = interaction.options.getSubcommand();
    const targetUser = subcommand === "view"
      ? interaction.options.getUser("user") ?? interaction.user
      : interaction.user;
    const viewingSelf = targetUser.id === interaction.user.id;
    const player = viewingSelf
      ? await services.player.getOrCreatePlayer({
        discordUserId: interaction.user.id,
        usernameSnapshot: interaction.user.username,
      })
      : await services.player.getPlayer(targetUser.id);
    if (!player) {
      await interaction.editReply({
        content: `${targetUser.globalName ?? targetUser.username} does not have a SlamDunk profile yet.`,
      });
      return;
    }

    try {
      let result;
      if (subcommand === "set") {
        const cardInstanceId = await services.collection.resolveOwnedCardReference({
          playerId: player.playerId,
          cardReference: interaction.options.getString("card_id", true),
        });
        result = await services.lineup.setCard({
          playerId: player.playerId,
          slot: interaction.options.getString("slot", true),
          cardInstanceId,
        });
      } else if (subcommand === "remove") {
        result = await services.lineup.removeCard({
          playerId: player.playerId,
          slot: interaction.options.getString("slot", true),
        });
      } else {
        result = await services.lineup.getLineup(player.playerId);
      }

      await interaction.editReply({
        embeds: [createLineupEmbed(result, {
          title: viewingSelf
            ? "Active Lineup"
            : `${targetUser.globalName ?? targetUser.username}'s Active Lineup`,
        })],
      });
    } catch (error) {
      if (error instanceof LineupError || error instanceof CardError) {
        await interaction.editReply({ content: error.message, embeds: [] });
        return;
      }
      throw error;
    }
  },
});
