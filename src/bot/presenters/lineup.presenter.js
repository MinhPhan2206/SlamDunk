import { EmbedBuilder } from "discord.js";
import { formatRarity } from "../../config/rarity-config.js";

const LINEUP_COLOR = 0xf28c28;

function formatSlot(slot) {
  if (!slot.cardInstanceId) {
    return `**${slot.slot}:** Empty`;
  }

  return [
    `**${slot.slot}: ${slot.playerName} - ${slot.edition}**`,
    `${formatRarity(slot.rarityTier)} | OVR ${slot.overall} | Level ${slot.cardLevel} | #${slot.serialNumber} | ID ${slot.cardInstanceId}`,
  ].join("\n");
}

export function createLineupEmbed(result) {
  return new EmbedBuilder()
    .setColor(LINEUP_COLOR)
    .setTitle("Active Lineup")
    .setDescription(result.slots.map(formatSlot).join("\n\n"))
    .setFooter({
      text: result.complete ? "Lineup complete: 5/5" : `${result.slots.filter((slot) => slot.cardInstanceId).length}/5 slots filled`,
    });
}
