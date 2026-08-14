import { MessageFlags } from "discord.js";

import { createHelpTopicPayload } from "../presenters/help.presenter.js";

const HELP_TOPICS = new Set(["manual", "strategy", "traits"]);

export const helpComponent = Object.freeze({
  namespace: "help",
  componentInactivityTimeoutMs: 60_000,

  async execute(interaction) {
    const [, topic, viewerDiscordUserId, selectedTab] =
      interaction.customId.split(":");
    if (
      !HELP_TOPICS.has(topic) ||
      !selectedTab ||
      !/^\d+$/.test(viewerDiscordUserId ?? "")
    ) {
      throw new Error("Invalid Help tab interaction.");
    }
    if (interaction.user.id !== viewerDiscordUserId) {
      await interaction.reply({
        content: "Only the user who opened this Help message can change its tab.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.update(createHelpTopicPayload({
      topic,
      viewerDiscordUserId,
      selectedTab,
    }));
  },
});
