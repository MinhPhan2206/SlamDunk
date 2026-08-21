import { SlashCommandBuilder } from "discord.js";

import { gameConfig } from "../../config/game-config.js";
import { BattleError } from "../../modules/battle/index.js";
import { battleAccessError } from "../access/community-access.js";

function addOpponentBracketOption(option) {
  option
    .setName("opponent_bracket")
    .setDescription("Choose the AI difficulty and reward bracket.")
    .setRequired(true);
  for (const bracket of gameConfig.battle.opponentBrackets) {
    option.addChoices({ name: bracket.displayName, value: bracket.code });
  }
  return option;
}

function addPracticeBracketOption(option) {
  option
    .setName("opponent_bracket")
    .setDescription("Choose the AI Practice difficulty.")
    .setRequired(true);
  for (const bracket of gameConfig.battle.opponentBrackets) {
    option.addChoices({ name: bracket.displayName, value: bracket.code });
  }
  return option;
}

function ownerDisplayName(interaction) {
  return interaction.member?.displayName ??
    interaction.user.globalName ??
    interaction.user.username;
}

export const battleCommand = Object.freeze({
  componentInactivityTimeoutMs: 60_000,

  data: new SlashCommandBuilder()
    .setName("battle")
    .setDescription("Battle the SlamDunk AI with your active lineup.")
    .addStringOption(addOpponentBracketOption),

  async execute(interaction, { services, battlePlayback, communityAccess }) {
    await interaction.deferReply();
    const accessError = battleAccessError(interaction, communityAccess);
    if (accessError) {
      await interaction.editReply({ content: accessError, embeds: [], components: [] });
      return;
    }
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });

    try {
      const result = await services.battle.battle({
        playerId: player.playerId,
        interactionId: interaction.id,
        opponentBracket: interaction.options.getString(
          "opponent_bracket",
          true,
        ),
      });
      await battlePlayback.start({
        interaction,
        result,
        ownerDiscordUserId: interaction.user.id,
        ownerDisplayName: ownerDisplayName(interaction),
      });
    } catch (error) {
      if (error instanceof BattleError) {
        const content = error.code === "BATTLE_COOLDOWN_ACTIVE"
          ? `${error.message} Try again <t:${Math.floor(error.details.availableAt.getTime() / 1_000)}:R>.`
          : error.message;
        await interaction.editReply({ content, embeds: [] });
        return;
      }
      throw error;
    }
  },
});

export const practiceCommand = Object.freeze({
  componentInactivityTimeoutMs: 60_000,

  data: new SlashCommandBuilder()
    .setName("practice")
    .setDescription("Test your active lineup without rewards or record changes.")
    .addStringOption(addPracticeBracketOption),

  async execute(interaction, { services, battlePlayback }) {
    await interaction.deferReply();
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });

    try {
      const result = await services.battle.practice({
        playerId: player.playerId,
        interactionId: interaction.id,
        opponentBracket: interaction.options.getString(
          "opponent_bracket",
          true,
        ),
      });
      await battlePlayback.start({
        interaction,
        result,
        ownerDiscordUserId: interaction.user.id,
        ownerDisplayName: ownerDisplayName(interaction),
      });
    } catch (error) {
      if (error instanceof BattleError) {
        const content = error.code === "PRACTICE_COOLDOWN_ACTIVE"
          ? `${error.message} Try again <t:${Math.floor(error.details.availableAt.getTime() / 1_000)}:R>.`
          : error.message;
        await interaction.editReply({ content, embeds: [] });
        return;
      }
      throw error;
    }
  },
});
