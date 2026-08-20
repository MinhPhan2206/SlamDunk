import { MessageFlags } from "discord.js";
import { scheduleComponentTimeout } from "../components/component-timeout.js";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function isUnknownInteraction(error) {
  return error?.code === 10_062 || error?.rawError?.code === 10_062;
}

async function respondEmptyAutocomplete(interaction, interactionLabel) {
  if (interaction.responded) return;
  try {
    await interaction.respond([]);
  } catch (error) {
    if (isUnknownInteraction(error)) {
      console.warn(`Discord ${interactionLabel} expired before it could respond.`);
      return;
    }
    console.error(
      `Failed to send autocomplete fallback: ${getErrorMessage(error)}`,
    );
  }
}

async function sendErrorResponse(interaction) {
  const message = {
    content: "Something went wrong while executing this command.",
  };

  if (interaction.deferred && interaction.isButton()) {
    await interaction.followUp({ ...message, flags: MessageFlags.Ephemeral });
    return;
  }

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

export function createInteractionCreateHandler(
  commands,
  context = {},
  componentHandlers = new Map(),
) {
  return async function handleInteractionCreate(interaction) {
    let handler;
    let interactionLabel;

    if (interaction.isAutocomplete?.()) {
      handler = commands.get(interaction.commandName);
      interactionLabel = `autocomplete /${interaction.commandName}`;
      if (!handler?.autocomplete) {
        console.warn(`Unknown Discord interaction received: ${interactionLabel}`);
        await respondEmptyAutocomplete(interaction, interactionLabel);
        return;
      }
      try {
        await handler.autocomplete(interaction, context);
      } catch (error) {
        if (isUnknownInteraction(error)) {
          console.warn(`Discord ${interactionLabel} expired before it could respond.`);
          return;
        }
        console.error(
          `Discord ${interactionLabel} failed: ${getErrorMessage(error)}`,
        );
        await respondEmptyAutocomplete(interaction, interactionLabel);
      }
      return;
    }

    if (interaction.isChatInputCommand()) {
      handler = commands.get(interaction.commandName);
      interactionLabel = `command /${interaction.commandName}`;
    } else if (
      interaction.isButton() ||
      interaction.isStringSelectMenu() ||
      interaction.isModalSubmit()
    ) {
      const namespace = interaction.customId.split(":", 1)[0];
      handler = componentHandlers.get(namespace);
      interactionLabel = `component ${namespace}`;
    } else {
      return;
    }

    if (!handler) {
      console.warn(`Unknown Discord interaction received: ${interactionLabel}`);
      return;
    }

    try {
      await handler.execute(interaction, context);
      if (handler.managesOwnComponentTimeout !== true) {
        await scheduleComponentTimeout(interaction, {
          ...(handler.componentInactivityTimeoutMs
            ? { timeoutMs: handler.componentInactivityTimeoutMs }
            : {}),
          preserveEmbeds: handler.preserveEmbedsOnTimeout === true,
        });
      }
    } catch (error) {
      console.error(
        `Discord ${interactionLabel} failed: ${getErrorMessage(error)}`,
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
