import { MessageFlags } from "discord.js";

import { createRarityPayload } from "../presenters/rarity.presenter.js";
import { requesterContextFromEmbed } from "../ui/presentation.js";

export const rarityPageComponent = Object.freeze({
  namespace: "rarity-page",

  async execute(interaction, { services }) {
    const [
      ,
      viewerDiscordUserId,
      rarityCode,
      positionValue,
      sortBy,
      pageValue,
    ] = interaction.customId.split(":");
    if (interaction.user.id !== viewerDiscordUserId) {
      await interaction.reply({
        content: "Only the user who opened this rarity list can change its page.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();
    const result = await services.cardTemplate.listTemplatesByRarity(
      rarityCode,
      {
        position: positionValue === "ALL" ? null : positionValue,
        sortBy,
        page: Number(pageValue),
      },
    );
    const requester = requesterContextFromEmbed(
      interaction.message?.embeds?.[0],
    );
    await interaction.editReply(
      createRarityPayload(result, {
        viewerDiscordUserId,
        ...requester,
      }),
    );
  },
});
