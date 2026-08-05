import { SlashCommandBuilder } from "discord.js";

import { collectionSortDefinitions } from "../../modules/collection/index.js";

const SORT_CHOICES = collectionSortDefinitions.map(({ key, label }) => ({
  name: label,
  value: key,
}));

export const sortCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("sort")
    .setDescription("Choose how /collection orders your cards.")
    .addStringOption((option) =>
      option
        .setName("sort_by")
        .setDescription("Defaults to Rarity.")
        .addChoices(...SORT_CHOICES),
    ),

  async execute(interaction, { services }) {
    await interaction.deferReply({ ephemeral: true });
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });
    const result = await services.collection.setSort({
      playerId: player.playerId,
      sortBy: interaction.options.getString("sort_by") ?? "RARITY",
    });
    await interaction.editReply(
      `Collection sorting set to **${result.label}**.`,
    );
  },
});
