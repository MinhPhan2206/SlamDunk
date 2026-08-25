import { scheduleComponentTimeout } from "../components/component-timeout.js";
import {
  PrefixCommandParseError,
  parsePrefixMessage,
} from "../prefix/prefix-command-parser.js";
import { PrefixMessageInteraction } from "../prefix/prefix-message-interaction.js";
import {
  AbuseGuardError,
  SecurityAccessError,
} from "../../modules/security/index.js";

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export function createMessageCreateHandler({ prefix, registry, context = {} }) {
  return async function handleMessageCreate(message) {
    if (!message.guild || message.author?.bot || message.webhookId) return;

    let parsed;
    try {
      parsed = await parsePrefixMessage(message, { prefix, registry });
    } catch (error) {
      if (!(error instanceof PrefixCommandParseError)) throw error;
      const usage = error.usage ? `\nUsage: \`${error.usage}\`` : "";
      await message.reply(`${error.message}${usage}`);
      return;
    }
    if (!parsed) return;

    const interaction = new PrefixMessageInteraction(message, parsed);
    let guardLease = null;
    try {
      const disabled = context.commandAvailability?.disabledCommands
        ?.includes?.(parsed.commandName);
      const maintenance = context.commandAvailability?.maintenanceMode === true &&
        !["help", "ping"].includes(parsed.commandName);
      if (disabled || maintenance) {
        await message.reply("This command is temporarily unavailable for maintenance.");
        return;
      }
      guardLease = context.abuseGuard?.acquire({
        userId: message.author?.id,
        guildId: message.guildId,
        channelId: message.channelId,
        commandName: parsed.commandName,
        kind: "prefix",
      });
      await parsed.command.execute(interaction, context);
      if (parsed.command.managesOwnComponentTimeout !== true) {
        await scheduleComponentTimeout(interaction, {
          ...(parsed.command.componentInactivityTimeoutMs
            ? { timeoutMs: parsed.command.componentInactivityTimeoutMs }
            : {}),
          preserveEmbeds: parsed.command.preserveEmbedsOnTimeout === true,
        });
      }
    } catch (error) {
      if (error instanceof SecurityAccessError) {
        await message.reply(error.message);
        return;
      }
      if (error instanceof AbuseGuardError) {
        await message.reply(context.abuseGuard.messageFor(error));
        return;
      }
      console.error(
        `Discord prefix command ${prefix} ${parsed.alias} failed: ${errorMessage(error)}`,
      );
      try {
        const payload = {
          content: "Something went wrong while executing this command.",
          embeds: [],
          components: [],
        };
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(payload);
        } else {
          await interaction.reply(payload);
        }
      } catch (responseError) {
        console.error(
          `Failed to send prefix command error response: ${errorMessage(responseError)}`,
        );
      }
    } finally {
      guardLease?.release();
    }
  };
}
