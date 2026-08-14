import { SlashCommandBuilder } from "discord.js";

import {
  createHelpTopicPayload,
} from "../presenters/help.presenter.js";

export const helpCommand = Object.freeze({
  componentInactivityTimeoutMs: 60_000,
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Learn how SlamDunk game systems work.")
    .addStringOption((option) => option
      .setName("topic")
      .setDescription("Select the game system you want to learn about.")
      .setRequired(true)
      .addChoices(
        { name: "Manual", value: "manual" },
        { name: "Strategy", value: "strategy" },
        { name: "Traits", value: "traits" },
      )),

  async execute(interaction) {
    const topic = interaction.options.getString("topic", true);
    await interaction.reply(createHelpTopicPayload({
      topic,
      viewerDiscordUserId: interaction.user.id,
    }));
  },
});
