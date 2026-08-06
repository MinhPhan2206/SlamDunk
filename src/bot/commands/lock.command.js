import { SlashCommandBuilder } from "discord.js";

import { CardError } from "../../modules/card/index.js";

export const lockCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Protect a card from Quicksell.")
    .addStringOption((option) =>
      option
        .setName("card_id")
        .setDescription("Public Card ID or number in /collection.")
        .setRequired(true),
    ),

  async execute(interaction, { services }) {
    await interaction.deferReply({ ephemeral: true });
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });
    try {
      const cardInstanceId = await services.collection.resolveOwnedCardReference({
        playerId: player.playerId,
        cardReference: interaction.options.getString("card_id", true),
      });
      const card = await services.cardInstance.lockOwnedCard({
        ownerPlayerId: player.playerId,
        cardInstanceId,
      });
      await interaction.editReply(
        `Card **!${card.publicCardId}** is locked and cannot be quicksold.`,
      );
    } catch (error) {
      if (error instanceof CardError) {
        await interaction.editReply(error.message);
        return;
      }
      throw error;
    }
  },
});
