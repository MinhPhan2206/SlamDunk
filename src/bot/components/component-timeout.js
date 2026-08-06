export const COMPONENT_INACTIVITY_TIMEOUT_MS = 10_000;

const activeTimeouts = new Map();

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

export async function scheduleComponentTimeout(
  interaction,
  { timeoutMs = COMPONENT_INACTIVITY_TIMEOUT_MS } = {},
) {
  const message = await resolveMessage(interaction);
  if (!message?.id || typeof message.edit !== "function") return;

  const previous = activeTimeouts.get(message.id);
  if (previous) clearTimeout(previous);

  if (!Array.isArray(message.components) || message.components.length === 0) {
    activeTimeouts.delete(message.id);
    return;
  }

  const timer = setTimeout(async () => {
    if (activeTimeouts.get(message.id) !== timer) return;
    activeTimeouts.delete(message.id);
    try {
      const current = typeof message.fetch === "function"
        ? await message.fetch()
        : message;
      if (!current.components?.length) return;
      await current.edit({ components: disabledRows(current.components) });
    } catch (error) {
      console.warn(`Component timeout update failed: ${error.message}`);
    }
  }, timeoutMs);
  timer.unref?.();
  activeTimeouts.set(message.id, timer);
}
