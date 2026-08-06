import { MessageFlags } from "discord.js";

import { createCollectionPayload } from "../presenters/collection.presenter.js";

export const collectionPageComponent = Object.freeze({
  namespace: "collection-page",

  async execute(interaction, { services }) {
    const [, ownerDiscordUserId, playerId, pageValue] = interaction.customId.split(":");
    if (interaction.user.id !== ownerDiscordUserId) {
      await interaction.reply({
        content: "Only the Collection owner can change this page.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();
    const result = await services.collection.listOwnedCards({
      playerId,
      page: Number(pageValue),
    });
    await interaction.editReply(
      createCollectionPayload(result, {
        discordUserId: ownerDiscordUserId,
        playerId,
      }),
    );
  },
});
