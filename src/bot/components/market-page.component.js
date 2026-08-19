import { MessageFlags } from "discord.js";

import { createMarketBrowsePayload } from "../presenters/market.presenter.js";
import { requesterContextFromEmbed } from "../ui/presentation.js";

export const marketPageComponent = Object.freeze({
  namespace: "market-page",

  async execute(interaction, { services }) {
    const [, ownerDiscordUserId, pageValue] = interaction.customId.split(":");
    if (interaction.user.id !== ownerDiscordUserId) {
      await interaction.reply({
        content: "Only the original viewer can change this Market page.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();
    const result = await services.market.listActiveListings({
      page: Number(pageValue),
    });
    await interaction.editReply(
      createMarketBrowsePayload(result, {
        discordUserId: ownerDiscordUserId,
        ...requesterContextFromEmbed(interaction.message.embeds[0]),
      }),
    );
  },
});
