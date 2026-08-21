import { SlashCommandBuilder } from "discord.js";
import { gameConfig } from "../../config/game-config.js";
import { BattleError } from "../../modules/battle/index.js";
import { createDuelInvitationPayload } from "../presenters/duel.presenter.js";
import { duelBetAccessError } from "../access/community-access.js";

export const duelCommand = Object.freeze({
  componentInactivityTimeoutMs: gameConfig.battle.duel.invitationSeconds * 1_000,

  data: new SlashCommandBuilder()
    .setName("duel")
    .setDescription("Challenge another Player to a friendly Battle.")
    .addUserOption((option) => option
      .setName("user")
      .setDescription("The Player you want to challenge.")
      .setRequired(true))
    .addIntegerOption((option) => option
      .setName("bet")
      .setDescription("Gold wager paid by each Player (Community channels only).")
      .setMinValue(1)
      .setMaxValue(gameConfig.battle.duel.maximumBetGold)
      .setRequired(false)),

  async execute(interaction, { services, communityAccess }) {
    await interaction.deferReply();
    const opponent = interaction.options.getUser("user", true);
    const betGold = interaction.options.getInteger("bet") ?? 0;
    try {
      if (betGold > 0) {
        const accessError = duelBetAccessError(interaction, communityAccess);
        if (accessError) {
          await interaction.editReply({
            content: accessError,
            embeds: [],
            components: [],
          });
          return;
        }
      }
      if (opponent.bot || opponent.id === interaction.user.id) {
        throw new BattleError(
          "DUEL_INVALID_OPPONENT",
          "Choose another non-bot Discord user.",
        );
      }
      const [challenger, challenged] = await Promise.all([
        services.player.getOrCreatePlayer({
          discordUserId: interaction.user.id,
          usernameSnapshot: interaction.user.username,
        }),
        services.player.getOrCreatePlayer({
          discordUserId: opponent.id,
          usernameSnapshot: opponent.username,
        }),
      ]);
      const [challengerLineup, challengedLineup] = await Promise.all([
        services.lineup.getLineup(challenger.playerId),
        services.lineup.getLineup(challenged.playerId),
      ]);
      const result = await services.battle.createDuelChallenge({
        challengerPlayerId: challenger.playerId,
        challengedPlayerId: challenged.playerId,
        interactionId: interaction.id,
        betGold,
      });
      await interaction.editReply(createDuelInvitationPayload({
        ...result,
        challengerLineup,
        challengedLineup,
      }));
    } catch (error) {
      if (error instanceof BattleError) {
        const content = error.code === "DUEL_COOLDOWN_ACTIVE"
          ? `${error.message} Try again <t:${Math.floor(error.details.availableAt.getTime() / 1_000)}:R>.`
          : error.message;
        await interaction.editReply({ content, embeds: [], components: [] });
        return;
      }
      throw error;
    }
  },
});
