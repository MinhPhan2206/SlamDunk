import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";

import { UI_COLORS } from "../ui/theme.js";
import { createUiEmbed } from "../ui/presentation.js";

function starterLineupText(cards) {
  return cards.map((card) =>
    `**${card.slot}** · ${card.playerName} · ${card.rarityName} · Lv.${card.cardLevel} · \`!${card.publicCardId}\``)
    .join("\n");
}

export function createWelcomePayload({
  viewerDiscordUserId,
  displayName,
  botAvatarUrl,
  communityInviteUrl,
  result,
}) {
  const embed = createUiEmbed({ title: "WELCOME TO SLAMDUNK", color: UI_COLORS.primary })
    .setAuthor({ name: displayName })
    .setDescription(result.alreadyGranted
      ? "Your Base starter lineup has already been claimed. Here is your quick-start guide again."
      : "Your SlamDunk journey starts now. We prepared a complete Base starter lineup so you can battle immediately.")
    .addFields(
      ...(result.cards.length > 0 ? [{
        name: "🏀 Your Starter Lineup",
        value: starterLineupText(result.cards),
      }] : []),
      {
        name: "NEXT STEPS",
        value: [
          "👥 View your team with `/lineup view`.",
          "🧠 Customize how it plays with `/strategy`.",
          "⚔️ Start your first game with `/battle`.",
          "🎁 Collect more Cards with `/claim`, `/drop`, and `/daily`.",
        ].join("\n"),
      },
    )
    .setFooter({ text: "Good luck building your dream team!" });
  if (botAvatarUrl) embed.setThumbnail(botAvatarUrl);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`welcome:guide:${viewerDiscordUserId}`)
      .setLabel("Guide")
      .setEmoji("📚")
      .setStyle(ButtonStyle.Primary),
  );
  if (communityInviteUrl) {
    row.addComponents(new ButtonBuilder()
      .setLabel("Join Our Server")
      .setEmoji("🏀")
      .setStyle(ButtonStyle.Link)
      .setURL(communityInviteUrl));
  }

  return { embeds: [embed], components: [row] };
}
