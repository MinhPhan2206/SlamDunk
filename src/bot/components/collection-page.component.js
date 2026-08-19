import { MessageFlags } from "discord.js";

import { createCollectionPayload } from "../presenters/collection.presenter.js";
import { requesterContextFromEmbed } from "../ui/presentation.js";

export const collectionPageComponent = Object.freeze({
  namespace: "collection-page",

  async execute(interaction, { services }) {
    const [, viewerDiscordUserId, playerId, pageValue] = interaction.customId.split(":");
    if (interaction.user.id !== viewerDiscordUserId) {
      await interaction.reply({
        content: "Only the user who opened this Collection can change its page.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();
    const result = await services.collection.listOwnedCards({
      playerId,
      page: Number(pageValue),
    });
    const currentEmbed = interaction.message?.embeds?.[0];
    const title = currentEmbed?.title ?? "YOUR COLLECTION";
    await interaction.editReply(
      createCollectionPayload(result, {
        discordUserId: viewerDiscordUserId,
        playerId,
        title,
        ...requesterContextFromEmbed(currentEmbed),
      }),
    );
  },
});
