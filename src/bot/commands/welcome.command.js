import { MessageFlags, SlashCommandBuilder } from "discord.js";

import { createWelcomePayload } from "../presenters/welcome.presenter.js";

export const welcomeCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Receive your one-time SlamDunk starter lineup and guide."),

  async execute(interaction, { services, communityInviteUrl }) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });
    const result = await services.onboarding.grantStarterLineup({
      playerId: player.playerId,
      interactionId: interaction.id,
    });
    const payload = createWelcomePayload({
      viewerDiscordUserId: interaction.user.id,
      displayName: interaction.user.globalName ?? interaction.user.username,
      botAvatarUrl: interaction.client.user.displayAvatarURL(),
      communityInviteUrl,
      result,
    });

    try {
      await interaction.user.send(payload);
    } catch {
      await interaction.editReply({
        content: "Your starter lineup is ready, but I could not send the welcome message. Enable Direct Messages for this server, then run `/welcome` again.",
      });
      return;
    }

    await interaction.editReply({
      content: communityInviteUrl
        ? "Welcome message sent to your Direct Messages."
        : "Welcome message sent to your Direct Messages. Community link is unavailable until `DISCORD_COMMUNITY_INVITE_URL` is configured.",
    });
  },
});
