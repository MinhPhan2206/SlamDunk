import { MessageFlags } from "discord.js";

export const battleComponent = Object.freeze({
  namespace: "battle",
  componentInactivityTimeoutMs: 60_000,

  async execute(interaction, { battlePlayback }) {
    const [, action, matchId, ownerDiscordUserId] = interaction.customId.split(":");
    if (action !== "simulate" || !/^[0-9a-f]{32}$/.test(matchId ?? "")) {
      await interaction.reply({
        content: "This Battle action is invalid.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (interaction.user.id !== ownerDiscordUserId) {
      await interaction.reply({
        content: "Only the Battle owner can simulate this match.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferUpdate();
    const completed = await battlePlayback.simulate(interaction, {
      matchId,
      ownerDiscordUserId,
    });
    if (!completed) {
      await interaction.followUp({
        content: "This Battle playback has already ended or is no longer active.",
        flags: MessageFlags.Ephemeral,
      });
    }
  },
});
