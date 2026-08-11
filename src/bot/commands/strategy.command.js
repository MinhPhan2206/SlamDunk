import { MessageFlags, SlashCommandBuilder } from "discord.js";

import { createStrategyEditorPayload } from "../presenters/strategy.presenter.js";
import { STRATEGY_EDITOR_TIMEOUT_MS } from "../strategy/strategy-draft-store.js";

export const strategyCommand = Object.freeze({
  componentInactivityTimeoutMs: STRATEGY_EDITOR_TIMEOUT_MS,

  data: new SlashCommandBuilder()
    .setName("strategy")
    .setDescription("View or edit your active lineup strategy."),

  async execute(interaction, { services, strategyDrafts }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });
    const state = await services.lineup.getStrategy(player.playerId);
    const session = strategyDrafts.create({
      ownerDiscordUserId: interaction.user.id,
      playerId: player.playerId,
      lineupId: state.lineupId,
      strategy: state.strategy,
      strategyRevision: state.strategyRevision,
      players: state.players,
    });

    try {
      const message = await interaction.editReply(
        createStrategyEditorPayload(session),
      );
      strategyDrafts.bindMessage(session.sessionId, message);
    } catch (error) {
      strategyDrafts.remove(session.sessionId);
      throw error;
    }
  },
});
