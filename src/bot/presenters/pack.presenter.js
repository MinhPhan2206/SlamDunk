import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

const PACK_COLOR = 0xf28c28;

function rarityName(rarityTier) {
  return rarityTier === 7 ? "Tier 7 - Hall of Fame" : `Tier ${rarityTier}`;
}

function templateName(template) {
  return `${template.playerName} - ${template.edition}`;
}

function candidateLine(candidate) {
  const { template } = candidate;
  const positions = [template.primaryPosition, template.secondaryPosition]
    .filter(Boolean)
    .join("/");

  return [
    `**${candidate.candidatePosition}. ${templateName(template)}**`,
    `${rarityName(template.rarityTier)} | OVR ${template.overall} | ${positions}`,
  ].join("\n");
}

function selectionCustomId(packSessionId, candidatePosition) {
  return `pack:select:${packSessionId}:${candidatePosition}`;
}

export function createPackOfferPayload({ session, candidates }) {
  const embed = new EmbedBuilder()
    .setColor(PACK_COLOR)
    .setTitle("Free Drop")
    .setDescription(candidates.map(candidateLine).join("\n\n"))
    .setFooter({ text: "Choose one card. Only your selection will be minted." });
  const row = new ActionRowBuilder().addComponents(
    candidates.map((candidate) =>
      new ButtonBuilder()
        .setCustomId(
          selectionCustomId(
            session.packSessionId,
            candidate.candidatePosition,
          ),
        )
        .setLabel(`Choose ${candidate.candidatePosition}`)
        .setStyle(ButtonStyle.Primary),
    ),
  );

  return { embeds: [embed], components: [row] };
}

export function createPackSelectionPayload(result) {
  const selectedCandidate = result.candidates.find(
    (candidate) =>
      candidate.cardTemplateId === result.session.selectedTemplateId,
  );
  const template = selectedCandidate.template;
  const instance = result.resultInstance;
  const embed = new EmbedBuilder()
    .setColor(PACK_COLOR)
    .setTitle("Free Drop Selected")
    .setDescription(
      [
        `**${templateName(template)}**`,
        `${rarityName(template.rarityTier)} | OVR ${template.overall}`,
        `Card Level: **${instance.cardLevel}**`,
        `Serial: **#${instance.serialNumber}**`,
      ].join("\n"),
    );

  return { embeds: [embed], components: [] };
}

export function createPackCooldownMessage(availableAt) {
  const timestamp = Math.floor(availableAt.getTime() / 1_000);
  return `Your Free Drop is on cooldown. Available <t:${timestamp}:R>.`;
}

export function createPackCatalogMessage({ required, available }) {
  return [
    "Free Drop cannot be opened yet because the Card catalog is too small.",
    `Required packable templates: ${required}. Available: ${available}.`,
  ].join("\n");
}
