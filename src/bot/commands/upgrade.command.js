import { SlashCommandBuilder } from "discord.js";

import { UpgradeError } from "../../modules/upgrade/index.js";
import {
  createFusionEmbed,
  createLevelUpEmbed,
} from "../presenters/upgrade.presenter.js";

function cardOption(option, name, description) {
  return option.setName(name).setDescription(description).setRequired(true);
}

export const upgradeCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("upgrade")
    .setDescription("Upgrade cards through Fusion or a Level Up item.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("fusion")
        .setDescription("Fuse two cards from the same Card Template.")
        .addStringOption((option) =>
          cardOption(option, "card_a", "First Card Instance ID."),
        )
        .addStringOption((option) =>
          cardOption(option, "card_b", "Second Card Instance ID."),
        ),
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("item")
        .setDescription("Use one Level Up item on a card.")
        .addStringOption((option) =>
          cardOption(option, "card_id", "Card Instance ID to upgrade."),
        ),
    ),

  async execute(interaction, { services }) {
    await interaction.deferReply();
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });

    try {
      const subcommand = interaction.options.getSubcommand();
      const result =
        subcommand === "fusion"
          ? await services.upgrade.fuseCards({
              playerId: player.playerId,
              sourceCardAId: interaction.options.getString("card_a", true),
              sourceCardBId: interaction.options.getString("card_b", true),
            })
          : await services.upgrade.useLevelUpItem({
              playerId: player.playerId,
              cardInstanceId: interaction.options.getString("card_id", true),
            });
      const embed =
        subcommand === "fusion"
          ? createFusionEmbed(result)
          : createLevelUpEmbed(result);
      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      if (error instanceof UpgradeError) {
        await interaction.editReply({ content: error.message, embeds: [] });
        return;
      }
      throw error;
    }
  },
});
