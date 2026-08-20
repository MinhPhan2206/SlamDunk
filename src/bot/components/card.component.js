import { MessageFlags } from "discord.js";

import { CardError } from "../../modules/card/index.js";
import { createCardPayload } from "../presenters/card.presenter.js";

export const cardComponent = Object.freeze({
  namespace: "card",
  preserveEmbedsOnTimeout: true,

  async execute(interaction, { services }) {
    const parts = interaction.customId.split(":");
    if (parts[1] === "search") {
      const viewerDiscordUserId = parts[2];
      if (interaction.user.id !== viewerDiscordUserId) {
        await interaction.reply({
          content: "Only the user who searched for this Card can select it.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const cardTemplateId = interaction.values?.[0];
      if (!/^\d+$/.test(String(cardTemplateId ?? ""))) {
        await interaction.reply({
          content: "This Card selection is invalid.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await interaction.deferUpdate();
      try {
        const card = await services.cardView.getTemplate(cardTemplateId);
        await interaction.editReply(await createCardPayload(card, {
          viewerDiscordUserId,
          mode: "template",
        }));
      } catch (error) {
        if (error instanceof CardError) {
          await interaction.editReply({ content: error.message, embeds: [], components: [] });
          return;
        }
        throw error;
      }
      return;
    }

    const [, viewerDiscordUserId, mode, entityId, selectedTab] =
      parts;
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
