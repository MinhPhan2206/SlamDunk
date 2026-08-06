import { SlashCommandBuilder } from "discord.js";

import { CardError } from "../../modules/card/index.js";

export const unlockCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Remove Quicksell protection from a card.")
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
      const card = await services.cardInstance.unlockOwnedCard({
        ownerPlayerId: player.playerId,
        cardInstanceId,
      });
      await interaction.editReply(
        `Card **!${card.publicCardId}** is unlocked and can be quicksold.`,
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
