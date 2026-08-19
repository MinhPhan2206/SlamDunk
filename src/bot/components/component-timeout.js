export const COMPONENT_INACTIVITY_TIMEOUT_MS = 20_000;

const activeTimeouts = new Map();

export function cancelComponentTimeout(messageId) {
  const normalizedId = String(messageId ?? "");
  const timer = activeTimeouts.get(normalizedId);
  if (!timer) return false;
  clearTimeout(timer);
  activeTimeouts.delete(normalizedId);
  return true;
}

function componentData(component) {
  return typeof component.toJSON === "function"
    ? component.toJSON()
    : { ...(component.data ?? component) };
}

function disabledRows(rows) {
  return rows.map((row) => {
    const data = componentData(row);
    return {
      ...data,
      components: (row.components ?? data.components ?? []).map((component) => ({
        ...componentData(component),
        disabled: true,
      })),
    };
  });
}

function attachmentList(attachments) {
  if (!attachments) return [];
  if (Array.isArray(attachments)) return attachments;
  if (typeof attachments.values === "function") return [...attachments.values()];
  return Object.values(attachments);
}

function expiredEmbeds(embeds) {
  return embeds.map((embed, index) => {
    const data = typeof embed.toJSON === "function"
      ? embed.toJSON()
      : { ...(embed.data ?? embed) };
    const currentFooter = data.footer?.text?.trim();
    return index === embeds.length - 1
      ? {
        ...data,
        footer: {
          ...(data.footer ?? {}),
          text: currentFooter
            ? `${currentFooter}\nInteraction Expired`
            : "Interaction Expired",
        },
      }
      : data;
  });
}

async function resolveMessage(interaction) {
  if (typeof interaction.fetchReply === "function") {
    try {
      return await interaction.fetchReply();
    } catch {
      return interaction.message ?? null;
    }
  }
  return interaction.message ?? null;
}

function isUnknownMessage(error) {
  return error?.code === 10_008 || error?.rawError?.code === 10_008;
}

export async function scheduleComponentTimeout(
  interaction,
  {
    timeoutMs = COMPONENT_INACTIVITY_TIMEOUT_MS,
    preserveEmbeds = false,
  } = {},
) {
  const message = await resolveMessage(interaction);
  const editMessage = typeof interaction.editReply === "function"
    ? (payload) => interaction.editReply(payload)
    : typeof message?.edit === "function"
      ? (payload) => message.edit(payload)
      : null;
  if (!message?.id || !editMessage) return;

  const previous = activeTimeouts.get(String(message.id));
  if (previous) clearTimeout(previous);

  if (!Array.isArray(message.components) || message.components.length === 0) {
    activeTimeouts.delete(String(message.id));
    return;
  }

  const timer = setTimeout(async () => {
    if (activeTimeouts.get(String(message.id)) !== timer) return;
    activeTimeouts.delete(String(message.id));
    try {
      if (!message.components?.length) return;
      const update = { components: disabledRows(message.components) };
      const attachments = attachmentList(message.attachments);
      if (!preserveEmbeds && message.embeds?.length && attachments.length === 0) {
        update.embeds = expiredEmbeds(message.embeds);
      }
      await editMessage(update);
    } catch (error) {
      if (!isUnknownMessage(error)) {
        console.warn(`Component timeout update failed: ${error.message}`);
      }
    }
  }, timeoutMs);
  timer.unref?.();
  activeTimeouts.set(String(message.id), timer);
}
