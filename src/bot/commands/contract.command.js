import { SlashCommandBuilder } from "discord.js";

import { gameConfig } from "../../config/game-config.js";
import { ContractError } from "../../modules/contract/index.js";
import { createContractOpeningPayload } from "../presenters/contract.presenter.js";

const contractTypeOption = (option) => {
  option
    .setName("contract_type")
    .setDescription("Player Contract to use.")
    .setRequired(false);
  for (const contract of gameConfig.contracts) {
    option.addChoices({ name: contract.displayName, value: contract.contractCode });
  }
  return option;
};

export const contractCommand = Object.freeze({
  data: new SlashCommandBuilder()
    .setName("contract")
    .setDescription("Use a Player Contract to sign a random Card.")
    .addStringOption(contractTypeOption),

  async execute(interaction, { services }) {
    await interaction.deferReply();
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });
    try {
      const result = await services.contract.openContract({
        playerId: player.playerId,
        contractCode: interaction.options.getString("contract_type") ?? "alpha",
        interactionId: interaction.id,
      });
      await interaction.editReply(await createContractOpeningPayload(result));
    } catch (error) {
      if (error instanceof ContractError) {
        await interaction.editReply({ content: error.message, embeds: [] });
        return;
      }
      throw error;
    }
  },
});
