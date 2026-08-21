import { SlashCommandBuilder } from "discord.js";
import { VoteError } from "../../modules/vote/index.js";
import { createVotePayload } from "../presenters/vote.presenter.js";

export const voteCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("vote")
    .setDescription("Vote for SlamDunk on Top.gg and claim your reward."),

  async execute(interaction, { services }) {
    await interaction.deferReply();
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });
    try {
      const result = await services.vote.claimVote({
        playerId: player.playerId,
        discordUserId: interaction.user.id,
      });
      await interaction.editReply(createVotePayload(result));
    } catch (error) {
      if (error instanceof VoteError) {
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
