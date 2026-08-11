import { MessageFlags } from "discord.js";

import { CardError } from "../../modules/card/index.js";
import { createCardPayload } from "../presenters/card.presenter.js";

export const cardComponent = Object.freeze({
  namespace: "card",
  preserveEmbedsOnTimeout: true,

  async execute(interaction, { services }) {
    const [, viewerDiscordUserId, mode, entityId, selectedTab] =
      interaction.customId.split(":");
    if (interaction.user.id !== viewerDiscordUserId) {
      await interaction.reply({
        content: "Only the user who opened this Card can change its tab.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!(["instance", "template"].includes(mode)) ||
        !(["image", "stats", "traits", "battle"].includes(selectedTab)) ||
        (mode === "template" && selectedTab === "battle")) {
      throw new Error("Invalid Card tab interaction.");
    }

    await interaction.deferUpdate();
    try {
      const card = mode === "instance"
        ? await services.cardView.getInstance(entityId)
        : await services.cardView.getTemplate(entityId);
      const traits = selectedTab === "traits"
        ? await services.cardView.getTraits(card.cardTemplateId)
        : [];
      const battleStats = selectedTab === "battle"
        ? await services.cardView.getBattleStats(card.cardInstanceId)
        : null;
      await interaction.editReply(await createCardPayload(card, {
        viewerDiscordUserId,
        mode,
        selectedTab,
        traits,
        battleStats,
      }));
    } catch (error) {
      if (error instanceof CardError) {
        await interaction.editReply({ content: error.message, embeds: [], components: [] });
        return;
      }
      throw error;
    }
  },
});
