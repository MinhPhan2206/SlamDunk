import { SlashCommandBuilder } from "discord.js";

import { rarityDefinitions } from "../../config/rarity-config.js";
import { createRarityPayload } from "../presenters/rarity.presenter.js";
import { requesterLine } from "../ui/presentation.js";

const RARITY_CHOICES = rarityDefinitions.map(({ name, rarityCode }) => ({
  name,
  value: rarityCode,
}));
const POSITION_CHOICES = ["PG", "SG", "SF", "PF", "C"].map((position) => ({
  name: position,
  value: position,
}));
const SORT_CHOICES = [
  ["Alphabetical", "alphabet"],
  ["Finishing", "finishing"],
  ["Mid Range", "mid_range"],
  ["3 Point", "three_point"],
  ["Playmaking", "playmaking"],
  ["Interior Defense", "interior_defense"],
  ["Perimeter Defense", "perimeter_defense"],
  ["Strength", "strength"],
].map(([name, value]) => ({ name, value }));

export const rarityCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("rarity")
    .setDescription("List and sort Card Templates in a rarity.")
    .addStringOption((option) =>
      option
        .setName("rarity")
        .setDescription("Choose a Card rarity.")
        .setRequired(true)
        .addChoices(...RARITY_CHOICES),
    )
    .addStringOption((option) =>
      option
        .setName("position")
        .setDescription("Only show Cards eligible at this position.")
        .setRequired(false)
        .addChoices(...POSITION_CHOICES),
    )
    .addStringOption((option) =>
      option
        .setName("sort_by")
        .setDescription("Order Cards alphabetically or by a Stat.")
        .setRequired(false)
        .addChoices(...SORT_CHOICES),
    ),

  async execute(interaction, { services }) {
    await interaction.deferReply();

    const rarityCode = interaction.options.getString("rarity", true);
    const position = interaction.options.getString("position") ?? null;
    const sortBy = interaction.options.getString("sort_by") ?? "alphabet";
    const result = await services.cardTemplate.listTemplatesByRarity(
      rarityCode,
      { position, sortBy, page: 1 },
    );

    await interaction.editReply(
      createRarityPayload(result, {
        viewerDiscordUserId: interaction.user.id,
        requesterLine: requesterLine(interaction.user, interaction.member),
        requesterIconUrl: interaction.user.displayAvatarURL?.({ size: 64 }),
      }),
    );
  },
});
