import { SlashCommandBuilder } from "discord.js";

import { CardError } from "../../modules/card/index.js";
import { UpgradeError } from "../../modules/upgrade/index.js";
import {
  createFusionEmbed,
  createLevelUpEmbed,
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
    .setDescription("Fuse two Cards from the same Card Template.")
    .addStringOption((option) =>
      cardOption(option, "card_a", "First public Card ID or collection number."))
    .addStringOption((option) =>
      cardOption(option, "card_b", "Second public Card ID or collection number.")),
  async execute(interaction, { services }) {
    await executeUpgrade(interaction, services, async ({ player, resolve }) => {
      const result = await services.upgrade.fuseCards({
        playerId: player.playerId,
        sourceCardAId: await resolve("card_a"),
        sourceCardBId: await resolve("card_b"),
      });
      await interaction.editReply({ embeds: [createFusionEmbed(result)] });
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
      const result = await services.upgrade.useLevelUpItem({
        playerId: player.playerId,
        cardInstanceId: await resolve("card_id"),
      });
      await interaction.editReply({ embeds: [createLevelUpEmbed(result)] });
    });
  },
});
