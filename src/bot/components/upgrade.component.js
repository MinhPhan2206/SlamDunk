import { MessageFlags } from "discord.js";

import { UpgradeError } from "../../modules/upgrade/index.js";
import {
  createFusionEmbed,
  createFusionMaterialSelectionPayload,
  createFusionPlayerSelectionPayload,
  createFusionReviewPayload,
  createLevelUpEmbed,
  createUpgradeCancelledPayload,
} from "../presenters/upgrade.presenter.js";
import { fusionSessionStore } from "../upgrade/fusion-session-store.js";

async function getPlayer(interaction, services) {
  return services.player.getOrCreatePlayer({
    discordUserId: interaction.user.id,
    usernameSnapshot: interaction.user.username,
  });
}

function selectedCards(preview, sourceCardIds) {
  const selectedIds = new Set(sourceCardIds.map(String));
  const cards = preview.cards.filter((card) => selectedIds.has(card.cardInstanceId));
  if (cards.length !== selectedIds.size || cards.length < 2 || cards.length > 5) {
    throw new UpgradeError(
      "FUSION_SELECTION_INVALID",
      "Select between two and five currently eligible Cards.",
    );
  }
  return cards;
}

export const upgradeComponent = Object.freeze({
  namespace: "upgrade",

  async execute(interaction, { services }) {
    const parts = interaction.customId.split(":");
    const [, action, viewerId] = parts;
    if (interaction.user.id !== viewerId) {
      await interaction.reply({
        content: "Only the user who started this upgrade can use these controls.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();
    if (action === "cancel") {
      await interaction.editReply(createUpgradeCancelledPayload());
      return;
    }

    try {
      const player = await getPlayer(interaction, services);
      if (action === "level_confirm") {
        const result = await services.upgrade.useLevelUpItem({
          playerId: player.playerId,
          cardInstanceId: parts[3],
        });
        await interaction.editReply({ embeds: [createLevelUpEmbed(result)], components: [] });
        return;
      }

      if (["players", "player_page"].includes(action)) {
        const groups = await services.upgrade.listFusionOptions({ playerId: player.playerId });
        if (!groups.length) {
          throw new UpgradeError(
            "FUSION_MATERIAL_MISSING",
            "You do not have any Cards currently eligible for Fusion.",
          );
        }
        await interaction.editReply(createFusionPlayerSelectionPayload(
          groups,
          viewerId,
          action === "player_page" ? Number(parts[3]) : 1,
        ));
        return;
      }

      if (action === "player_select") {
        const preview = await services.upgrade.previewFusionMaterials({
          playerId: player.playerId,
          cardTemplateId: interaction.values?.[0],
        });
        await interaction.editReply(createFusionMaterialSelectionPayload(preview, viewerId));
        return;
      }

      if (action === "materials_select") {
        const preview = await services.upgrade.previewFusionMaterials({
          playerId: player.playerId,
          cardTemplateId: parts[3],
        });
        const cards = selectedCards(preview, interaction.values ?? []);
        const sessionId = fusionSessionStore.create({
          viewerId,
          cardTemplateId: preview.group.cardTemplateId,
          sourceCardIds: cards.map((card) => card.cardInstanceId),
        });
        await interaction.editReply(createFusionReviewPayload({
          group: preview.group,
          cards,
          resultLevel: Math.min(cards.reduce((sum, card) => sum + card.cardLevel, 0), 5),
          sessionId,
        }, viewerId));
        return;
      }

      if (["fusion_change", "fusion_confirm"].includes(action)) {
        const sessionId = parts[3];
        const session = fusionSessionStore.get(sessionId);
        if (!session || session.viewerId !== viewerId) {
          throw new UpgradeError("FUSION_EXPIRED", "This Fusion review has expired.");
        }
        if (action === "fusion_change") {
          const preview = await services.upgrade.previewFusionMaterials({
            playerId: player.playerId,
            cardTemplateId: session.cardTemplateId,
          });
          await interaction.editReply(createFusionMaterialSelectionPayload(
            preview,
            viewerId,
            session.sourceCardIds,
          ));
          return;
        }
        const result = await services.upgrade.fuseCards({
          playerId: player.playerId,
          sourceCardIds: session.sourceCardIds,
        });
        fusionSessionStore.delete(sessionId);
        await interaction.editReply({ embeds: [createFusionEmbed(result)], components: [] });
        return;
      }

      throw new UpgradeError("INVALID_ACTION", "Invalid Upgrade action.");
    } catch (error) {
      if (error instanceof UpgradeError) {
        await interaction.editReply({
          content: error.message,
          embeds: [],
          components: [],
        });
        return;
      }
      throw error;
    }
  },
});
