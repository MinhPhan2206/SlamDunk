import { SlashCommandBuilder } from "discord.js";

import { CardError } from "../../modules/card/index.js";
import { createCardPayload } from "../presenters/card.presenter.js";
import { truncateText } from "../ui/formatters.js";

const TEMPLATE_PREFIX = "template:";

async function resolveCard(input, interaction, services) {
  if (input.startsWith(TEMPLATE_PREFIX)) {
    const cardTemplateId = input.slice(TEMPLATE_PREFIX.length);
    return Object.freeze({
      mode: "template",
      card: await services.cardView.getTemplate(cardTemplateId),
    });
  }

  const numericReference = input.replace(/^!/, "");
  if (/^\d{9}$/.test(numericReference)) {
    return Object.freeze({
      mode: "instance",
      card: await services.cardView.getInstanceByPublicId(numericReference),
    });
  }

  if (/^\d+$/.test(numericReference)) {
    const player = await services.player.getOrCreatePlayer({
      discordUserId: interaction.user.id,
      usernameSnapshot: interaction.user.username,
    });
    const cardInstanceId = await services.collection.resolveOwnedCardReference({
      playerId: player.playerId,
      cardReference: numericReference,
    });
    return Object.freeze({
      mode: "instance",
      card: await services.cardView.getInstance(cardInstanceId),
    });
  }

  const templates = await services.cardView.findTemplatesByName(input);
  if (templates.length === 0) {
    throw new CardError("CARD_TEMPLATE_NOT_FOUND", "No Card Template matches that player name.");
  }
  if (templates.length > 1) {
    throw new CardError(
      "CARD_TEMPLATE_AMBIGUOUS",
      "Multiple versions match that player. Select one from autocomplete.",
    );
  }
  return Object.freeze({ mode: "template", card: templates[0] });
}

export const cardCommand = Object.freeze({
  preserveEmbedsOnTimeout: true,

  data: new SlashCommandBuilder()
    .setName("card")
    .setDescription("View a Card's Stats, Traits, and Battle Stats.")
    .addStringOption((option) =>
      option
        .setName("card")
        .setDescription("Public Card ID, collection number, or player name.")
        .setRequired(true)
        .setAutocomplete(true),
    ),

  async autocomplete(interaction, { services }) {
    const query = interaction.options.getFocused();
    if (/^!?\d*$/.test(query)) {
      await interaction.respond([]);
      return;
    }
    const templates = await services.cardView.searchTemplates(query);
    await interaction.respond(templates.map((template) => ({
      name: truncateText(`${template.playerName} — ${template.rarityName}`, 100),
      value: `${TEMPLATE_PREFIX}${template.cardTemplateId}`,
    })));
  },

  async execute(interaction, { services }) {
    await interaction.deferReply();
    try {
      const result = await resolveCard(
        interaction.options.getString("card", true).trim(),
        interaction,
        services,
      );
      await interaction.editReply(await createCardPayload(result.card, {
        viewerDiscordUserId: interaction.user.id,
        mode: result.mode,
      }));
    } catch (error) {
      if (error instanceof CardError) {
        await interaction.editReply({ content: error.message, embeds: [], components: [] });
        return;
      }
      throw error;
    }
  },
});
