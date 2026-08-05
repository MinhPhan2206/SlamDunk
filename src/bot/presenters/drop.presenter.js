import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { formatRarity } from "../../config/rarity-config.js";

const DROP_COLOR = 0xf28c28;

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
    `${formatRarity(template.rarityTier)} | OVR ${template.overall} | ${positions}`,
  ].join("\n");
}

function selectionCustomId(dropSessionId, candidatePosition) {
  return `drop:select:${dropSessionId}:${candidatePosition}`;
}

export function createDropOfferPayload({ session, candidates }) {
  const embed = new EmbedBuilder()
    .setColor(DROP_COLOR)
    .setTitle("Free Drop")
    .setDescription(candidates.map(candidateLine).join("\n\n"))
    .setFooter({ text: "Choose one card. Only your selection will be minted." });
  const row = new ActionRowBuilder().addComponents(
    candidates.map((candidate) =>
      new ButtonBuilder()
        .setCustomId(
          selectionCustomId(
            session.dropSessionId,
            candidate.candidatePosition,
          ),
        )
        .setLabel(`Choose ${candidate.candidatePosition}`)
        .setStyle(ButtonStyle.Primary),
    ),
  );

  return { embeds: [embed], components: [row] };
}

export function createDropSelectionPayload(result) {
  const selectedCandidate = result.candidates.find(
    (candidate) =>
      candidate.cardTemplateId === result.session.selectedTemplateId,
  );
  const template = selectedCandidate.template;
  const instance = result.resultInstance;
  const embed = new EmbedBuilder()
    .setColor(DROP_COLOR)
    .setTitle("Free Drop Selected")
    .setDescription(
      [
        `**${templateName(template)}**`,
        `${formatRarity(template.rarityTier)} | OVR ${template.overall}`,
        `Card Level: **${instance.cardLevel}**`,
        `Serial: **#${instance.serialNumber}**`,
      ].join("\n"),
    );

  return { embeds: [embed], components: [] };
}

export function createDropCooldownMessage(availableAt) {
  const timestamp = Math.floor(availableAt.getTime() / 1_000);
  return `Your Free Drop is on cooldown. Available <t:${timestamp}:R>.`;
}

export function createDropCatalogMessage({ required, available }) {
  return [
    "Free Drop cannot be opened yet because the Card catalog is too small.",
    `Required packable templates: ${required}. Available: ${available}.`,
  ].join("\n");
}
