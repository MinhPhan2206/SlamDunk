import { MessageFlags } from "discord.js";
import { BattleError } from "../../modules/battle/index.js";
import { createDuelDeclinedPayload } from "../presenters/duel.presenter.js";
import { cancelComponentTimeout } from "./component-timeout.js";

export const duelComponent = Object.freeze({
  namespace: "duel",
  managesOwnComponentTimeout: true,

  async execute(interaction, { services, battlePlayback }) {
    const [, action, reference] = interaction.customId.split(":");
    if (!["accept", "decline", "simulate"].includes(action)) {
      await interaction.reply({
        content: "This Duel action is invalid.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });
    await interaction.deferUpdate();
    try {
      if (action === "decline") {
        const result = await services.battle.declineDuelChallenge({
          publicDuelId: reference,
          playerId: player.playerId,
        });
        cancelComponentTimeout(interaction.message?.id);
        await interaction.editReply(createDuelDeclinedPayload(result));
        return;
      }
      if (action === "simulate") {
        const vote = await battlePlayback.voteToSimulate(interaction, {
          matchId: reference,
          voterDiscordUserId: interaction.user.id,
        });
        if (!vote.accepted) {
          await interaction.followUp({
            content: vote.reason,
            flags: MessageFlags.Ephemeral,
          });
        }
        return;
      }
      const duel = await services.battle.acceptDuelChallenge({
        publicDuelId: reference,
        playerId: player.playerId,
      });
      cancelComponentTimeout(interaction.message?.id);
      await battlePlayback.start({
        interaction,
        result: duel.result,
        ownerDiscordUserId: duel.challenger.discordUserId,
        ownerDisplayName: duel.challenger.usernameSnapshot,
        opponentDisplayName: duel.challenged.usernameSnapshot,
        simulateVoterDiscordUserIds: [
          duel.challenger.discordUserId,
          duel.challenged.discordUserId,
        ],
        componentNamespace: "duel",
      });
    } catch (error) {
      if (error instanceof BattleError) {
        await interaction.followUp({
          content: error.message,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      throw error;
    }
  },
});
