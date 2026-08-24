function ids(config, property) {
  return Array.isArray(config?.[property]) ? config[property].map(String) : [];
}

function channelList(channelIds) {
  return channelIds.length > 0
    ? channelIds.map((id) => `<#${id}>`).join(", ")
    : "No allowed channels have been configured.";
}

function location(interaction) {
  return {
    guildId: String(interaction.guildId ?? interaction.guild?.id ?? ""),
    channelId: String(interaction.channelId ?? interaction.channel?.id ?? ""),
  };
}

function duelChannels(config) {
  const configured = ids(config, "duelChannelIds");
  return configured.length > 0 ? configured : ids(config, "duelBetChannelIds");
}

export function tradeAccessError(interaction, config) {
  const guildId = String(config?.guildId ?? "");
  const allowed = ids(config, "tradeChannelIds");
  const current = location(interaction);
  if (!guildId || current.guildId !== guildId || !allowed.includes(current.channelId)) {
    return `Trade is only available in the Community Server trade channels. ${channelList(allowed)}`;
  }
  return null;
}

export function battleAccessError(interaction, config) {
  const guildId = String(config?.guildId ?? "");
  const current = location(interaction);
  if (!guildId || current.guildId !== guildId) return null;
  const allowed = ids(config, "battleChannelIds");
  if (!allowed.includes(current.channelId)) {
    return `Battle is only available in these Community Server channels: ${channelList(allowed)}`;
  }
  return null;
}

export function duelAccessError(interaction, config) {
  const guildId = String(config?.guildId ?? "");
  const current = location(interaction);
  if (!guildId || current.guildId !== guildId) return null;
  const allowed = duelChannels(config);
  if (!allowed.includes(current.channelId)) {
    return `Duel is only available in these Community Server channels: ${channelList(allowed)}`;
  }
  return null;
}

export function duelBetAccessError(interaction, config) {
  const guildId = String(config?.guildId ?? "");
  const allowed = duelChannels(config);
  const current = location(interaction);
  if (!guildId || current.guildId !== guildId || !allowed.includes(current.channelId)) {
    return `Wagered Duels are only available in the Community Server Duel channels. ${channelList(allowed)}`;
  }
  return null;
}
