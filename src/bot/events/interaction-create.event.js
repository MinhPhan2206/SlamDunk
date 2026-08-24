import { MessageFlags } from "discord.js";
import { scheduleComponentTimeout } from "../components/component-timeout.js";
import { AbuseGuardError } from "../../modules/security/index.js";

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

function commandUnavailable(commandName, config) {
  const disabled = Array.isArray(config?.disabledCommands)
    ? config.disabledCommands.includes(commandName)
    : false;
  const maintenance = config?.maintenanceMode === true &&
    !["help", "ping"].includes(commandName);
  return disabled || maintenance;
}

export function createInteractionCreateHandler(
  commands,
  context = {},
  componentHandlers = new Map(),
) {
  return async function handleInteractionCreate(interaction) {
    let handler;
    let interactionLabel;
    let guardLease = null;

    if (interaction.isAutocomplete?.()) {
      handler = commands.get(interaction.commandName);
      interactionLabel = `autocomplete /${interaction.commandName}`;
      if (!handler?.autocomplete) {
        console.warn(`Unknown Discord interaction received: ${interactionLabel}`);
        await respondEmptyAutocomplete(interaction, interactionLabel);
        return;
      }
      try {
        guardLease = context.abuseGuard?.acquire({
          userId: interaction.user?.id,
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          commandName: interaction.commandName,
          kind: "autocomplete",
        });
        await handler.autocomplete(interaction, context);
      } catch (error) {
        if (error instanceof AbuseGuardError) {
          await respondEmptyAutocomplete(interaction, interactionLabel);
          return;
        }
        if (isUnknownInteraction(error)) {
          console.warn(`Discord ${interactionLabel} expired before it could respond.`);
          return;
        }
        console.error(
          `Discord ${interactionLabel} failed: ${getErrorMessage(error)}`,
        );
        await respondEmptyAutocomplete(interaction, interactionLabel);
      } finally {
        guardLease?.release();
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
      if (
        interaction.isChatInputCommand() &&
        commandUnavailable(interaction.commandName, context.commandAvailability)
      ) {
        await interaction.reply({
          content: "This command is temporarily unavailable for maintenance.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      guardLease = context.abuseGuard?.acquire({
        userId: interaction.user?.id,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        commandName: interaction.isChatInputCommand()
          ? interaction.commandName
          : interaction.customId.split(":", 1)[0],
        kind: interaction.isChatInputCommand() ? "command" : "component",
      });
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
      if (error instanceof AbuseGuardError) {
        const content = context.abuseGuard.messageFor(error);
        try {
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
          } else {
            await interaction.reply({ content, flags: MessageFlags.Ephemeral });
          }
        } catch (responseError) {
          console.warn(`Rate-limit response failed: ${getErrorMessage(responseError)}`);
        }
        return;
      }
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
    } finally {
      guardLease?.release();
    }
  };
}
