import { QuicksellError } from "../../modules/quicksell/index.js";
import {
  createQuicksellCancelledPayload,
  createQuicksellCompletedPayload,
} from "../presenters/quicksell.presenter.js";

export const quicksellComponent = Object.freeze({
  namespace: "quicksell",
  async execute(interaction, { services }) {
    const [, action, quicksellSessionId] = interaction.customId.split(":");
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });
    await interaction.deferUpdate();
    try {
      const result = action === "confirm"
        ? await services.quicksell.confirmPreview({
            playerId: player.playerId,
            quicksellSessionId,
          })
        : action === "cancel"
          ? await services.quicksell.cancelPreview({
              playerId: player.playerId,
              quicksellSessionId,
            })
          : null;
      if (!result) {
        throw new QuicksellError("INVALID_ACTION", "Invalid Quicksell action.");
      }
      await interaction.editReply(
        action === "confirm"
          ? createQuicksellCompletedPayload(result)
          : createQuicksellCancelledPayload(),
      );
    } catch (error) {
      if (error instanceof QuicksellError) {
        await interaction.followUp({ content: error.message, ephemeral: true });
        return;
      }
      throw error;
    }
  },
});
