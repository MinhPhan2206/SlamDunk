import { MessageFlags } from "discord.js";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function sendErrorResponse(interaction) {
  const message = {
    content: "Something went wrong while executing this command.",
  };

  if (interaction.deferred) {
    await interaction.editReply({ ...message, embeds: [], components: [] });
    return;
  }

  if (interaction.replied) {
    await interaction.followUp({ ...message, flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({ ...message, flags: MessageFlags.Ephemeral });
}

export function createInteractionCreateHandler(commands, context = {}) {
  return async function handleInteractionCreate(interaction) {
    if (!interaction.isChatInputCommand()) {
      return;
    }

    const command = commands.get(interaction.commandName);

    if (!command) {
      console.warn(`Unknown command received: /${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction, context);
    } catch (error) {
      console.error(
        `Command /${interaction.commandName} failed: ${getErrorMessage(error)}`,
      );

      try {
        await sendErrorResponse(interaction);
      } catch (responseError) {
        console.error(
          `Failed to send command error response: ${getErrorMessage(responseError)}`,
        );
      }
    }
  };
}
