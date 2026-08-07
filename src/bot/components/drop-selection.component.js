import { MessageFlags } from "discord.js";

import { DropError } from "../../modules/drop/index.js";
import { createDropSelectionPayload } from "../presenters/drop.presenter.js";

const CUSTOM_ID_PATTERN = /^drop:select:(\d+):(\d+)$/;

export const dropSelectionComponent = Object.freeze({
  namespace: "drop",

  async execute(interaction, { services }) {
    const match = CUSTOM_ID_PATTERN.exec(interaction.customId);

    if (!match) {
      throw new DropError(
        "INVALID_DROP_SELECTION",
        "The Drop selection button is invalid.",
      );
    }

    await interaction.deferUpdate();

    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });

    try {
      const result = await services.drop.confirmSelection({
        playerId: player.playerId,
        dropSessionId: match[1],
        candidatePosition: Number(match[2]),
      });

      await interaction.editReply(await createDropSelectionPayload(result));
    } catch (error) {
      if (
        error instanceof DropError &&
        [
          "DROP_SESSION_NOT_FOUND",
          "DROP_CANDIDATE_NOT_FOUND",
          "DROP_ALREADY_COMPLETED",
        ].includes(error.code)
      ) {
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
