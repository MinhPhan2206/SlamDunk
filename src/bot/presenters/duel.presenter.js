import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { formatRarity } from "../../config/rarity-config.js";
import { UI_COLORS } from "../ui/theme.js";

function displayName(player) {
  return player?.usernameSnapshot ?? "Player";
}

function lineupText(lineup) {
  return lineup.slots.map((card) => card.cardInstanceId
    ? `**${card.slot}** · ${card.playerName} · ${formatRarity(card.rarityCode)} · Lv.${card.cardLevel}`
    : `**${card.slot}** · Empty`
  ).join("\n");
}

export function createDuelInvitationPayload(result) {
  const challengerName = displayName(result.challenger);
  const challengedName = displayName(result.challenged);
  const challengedDiscordId = result.challenged.discordUserId;
  const embed = new EmbedBuilder()
    .setColor(UI_COLORS.warning)
    .setTitle("DUEL INVITATION")
    .setDescription(
      `**${challengerName}** challenged **${challengedName}**.`,
    )
    .addFields(
      {
        name: `CHALLENGER · ${challengerName}`,
        value: lineupText(result.challengerLineup),
        inline: true,
      },
      {
        name: `OPPONENT · ${challengedName}`,
        value: lineupText(result.challengedLineup),
        inline: true,
      },
    )
    .setFooter({ text: "Friendly Duel · No Gold, XP, or Battle streak changes" });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`duel:accept:${result.challenge.publicDuelId}`)
      .setLabel("Accept")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`duel:decline:${result.challenge.publicDuelId}`)
      .setLabel("Decline")
      .setStyle(ButtonStyle.Danger),
  );
  return {
    content: `<@${challengedDiscordId}>, **${challengerName}** challenged you to a Duel!`,
    allowedMentions: { users: [challengedDiscordId] },
    embeds: [embed],
    components: [row],
  };
}

export function createDuelDeclinedPayload(result) {
  return {
    content: "",
    embeds: [new EmbedBuilder()
      .setColor(UI_COLORS.neutral)
      .setTitle("DUEL DECLINED")
      .setDescription(
        `**${displayName(result.challenged)}** declined the Duel with ` +
        `**${displayName(result.challenger)}**.`,
      )],
    components: [],
  };
}
