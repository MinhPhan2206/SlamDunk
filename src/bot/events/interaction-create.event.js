import { MessageFlags } from "discord.js";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function sendErrorResponse(interaction) {
  const response = {
    content: "Something went wrong while executing this command.",
    flags: MessageFlags.Ephemeral,
  };

  if (interaction.replied || interaction.deferred) {
    await interaction.followUp(response);
    return;
  }

  await interaction.reply(response);
}

export function createInteractionCreateHandler(commands) {
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
      await command.execute(interaction);
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
