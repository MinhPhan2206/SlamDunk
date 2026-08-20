import { SlashCommandBuilder } from "discord.js";

import { CardError } from "../../modules/card/index.js";
import { UpgradeError } from "../../modules/upgrade/index.js";
import {
  createFusionPlayerSelectionPayload,
  createLevelUpReviewPayload,
} from "../presenters/upgrade.presenter.js";

function cardOption(option, name, description) {
  return option.setName(name).setDescription(description).setRequired(true);
}

async function executeUpgrade(interaction, services, operation) {
  await interaction.deferReply();
  const player = await services.player.getOrCreatePlayer({
    discordUserId: interaction.user.id,
    usernameSnapshot: interaction.user.username,
  });
  const resolve = (optionName) =>
    services.collection.resolveOwnedCardReference({
      playerId: player.playerId,
      cardReference: interaction.options.getString(optionName, true),
    });
  try {
    await operation({ player, resolve });
  } catch (error) {
    if (error instanceof UpgradeError || error instanceof CardError) {
      await interaction.editReply({ content: error.message, embeds: [] });
      return;
    }
    throw error;
  }
}

export const upgradeCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("upgrade")
    .setDescription("Fuse matching Cards into a higher-level Card."),
  async execute(interaction, { services }) {
    await executeUpgrade(interaction, services, async ({ player }) => {
      const groups = await services.upgrade.listFusionOptions({
        playerId: player.playerId,
      });
      if (!groups.length) {
        throw new UpgradeError(
          "FUSION_MATERIAL_MISSING",
          "You do not have any Cards currently eligible for Fusion.",
        );
      }
      await interaction.editReply(
        createFusionPlayerSelectionPayload(groups, interaction.user.id),
      );
    });
  },
});

export const levelUpCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("level-up")
    .setDescription("Use one Level Up item on a Card.")
    .addStringOption((option) => cardOption(
      option,
      "card_id",
      "Public Card ID or collection number.",
    )),
  async execute(interaction, { services }) {
    await executeUpgrade(interaction, services, async ({ player, resolve }) => {
      const preview = await services.upgrade.previewLevelUp({
        playerId: player.playerId,
        cardInstanceId: await resolve("card_id"),
      });
      await interaction.editReply(
        createLevelUpReviewPayload(preview, interaction.user.id),
      );
    });
  },
});
