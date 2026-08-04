import { MessageFlags } from "discord.js";

import { PackError } from "../../modules/pack/index.js";
import { createPackSelectionPayload } from "../presenters/pack.presenter.js";

const CUSTOM_ID_PATTERN = /^pack:select:(\d+):(\d+)$/;

export const packSelectionComponent = Object.freeze({
  namespace: "pack",

  async execute(interaction, { services }) {
    const match = CUSTOM_ID_PATTERN.exec(interaction.customId);

    if (!match) {
      throw new PackError(
        "INVALID_PACK_SELECTION",
        "The Pack selection button is invalid.",
      );
    }

    await interaction.deferUpdate();

    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });

    try {
      const result = await services.pack.confirmFreeDropSelection({
        playerId: player.playerId,
        packSessionId: match[1],
        candidatePosition: Number(match[2]),
      });

      await interaction.editReply(createPackSelectionPayload(result));
    } catch (error) {
      if (
        error instanceof PackError &&
        [
          "PACK_SESSION_NOT_FOUND",
          "PACK_CANDIDATE_NOT_FOUND",
          "PACK_ALREADY_COMPLETED",
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
