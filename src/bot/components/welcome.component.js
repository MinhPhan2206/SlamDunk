import { MessageFlags } from "discord.js";

import { createManualHelpPayload } from "../presenters/help.presenter.js";

export const welcomeComponent = Object.freeze({
  namespace: "welcome",
  componentInactivityTimeoutMs: 60_000,

  async execute(interaction) {
    const [, action, viewerDiscordUserId] = interaction.customId.split(":");
    if (action !== "guide" || !/^\d+$/.test(viewerDiscordUserId ?? "")) {
      throw new Error("Invalid Welcome interaction.");
    }
    if (interaction.user.id !== viewerDiscordUserId) {
      await interaction.reply({
        content: "Only the Player who received this welcome message can open its Guide.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.reply(createManualHelpPayload({
      viewerDiscordUserId,
    }));
  },
});
