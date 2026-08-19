import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { formatRarity } from "../../config/rarity-config.js";
import { createCardStripImage } from "../ui/card-strip-image.js";
import { formatPositions } from "../ui/formatters.js";
import { createUiEmbed } from "../ui/presentation.js";
import { rarityColor, UI_COLORS } from "../ui/theme.js";

const DROP_IMAGE_NAME = "drop-candidates.png";
const REVEAL_IMAGE_NAME = "drop-result.png";

function selectionCustomId(dropSessionId, candidatePosition) {
  return `drop:select:${dropSessionId}:${candidatePosition}`;
}

export async function createDropOfferPayload({ session, candidates }) {
  const image = await createCardStripImage(
    candidates.map((candidate) => candidate.template),
    { labels: candidates.map((candidate) => candidate.candidatePosition) },
  );
  const embed = createUiEmbed({ title: "FREE DROP", color: UI_COLORS.primary })
    .setDescription("Choose your card.")
    .setImage(`attachment://${DROP_IMAGE_NAME}`)
    .setFooter({
      text: "Choose within 20 seconds · Card 1 is selected on timeout",
    });
  const row = new ActionRowBuilder().addComponents(
    candidates.map((candidate) =>
      new ButtonBuilder()
        .setCustomId(selectionCustomId(
          session.dropSessionId,
          candidate.candidatePosition,
        ))
        .setLabel(String(candidate.candidatePosition))
        .setStyle(ButtonStyle.Primary),
    ),
  );
  return {
    embeds: [embed],
    components: [row],
    files: [{ attachment: image, name: DROP_IMAGE_NAME }],
  };
}

export async function createDropSelectionPayload(result) {
  const selectedCandidate = result.candidates.find((candidate) =>
    candidate.cardTemplateId === result.session.selectedTemplateId
  );
  const template = selectedCandidate.template;
  const instance = result.resultInstance;
  const image = await createCardStripImage([template]);
  const embed = createUiEmbed({
    title: "CARD ACQUIRED",
    color: rarityColor(template.rarityCode),
  })
    .setDescription(
      `**${template.playerName}** • ${formatRarity(template.rarityCode)} • ` +
      `${formatPositions(template)} • Lv.${instance.cardLevel} • ` +
      `\`!${instance.publicCardId}\``,
    )
    .setImage(`attachment://${REVEAL_IMAGE_NAME}`);
  return {
    embeds: [embed],
    components: [],
    attachments: [],
    files: [{ attachment: image, name: REVEAL_IMAGE_NAME }],
  };
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
