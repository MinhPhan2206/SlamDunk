import { SlashCommandBuilder } from "discord.js";

export const pingCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Check whether SlamDunk is online."),

  async execute(interaction) {
    await interaction.reply("Pong!");
  },
});
