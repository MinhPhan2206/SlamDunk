import { SlashCommandBuilder } from "discord.js";

import { CardError } from "../../modules/card/index.js";
import { compareSessionStore } from "../compare/compare-session-store.js";
import { resolveCard, TEMPLATE_PREFIX } from "./card.command.js";
import {
  createComparePayload,
  createCompareSearchPayload,
} from "../presenters/compare.presenter.js";
import { truncateText } from "../ui/formatters.js";

function cardOption(option, name, description) {
  return option
    .setName(name)
    .setDescription(description)
    .setRequired(true)
    .setAutocomplete(true);
}

function sameCard(a, b) {
  if (a.mode === "search" || b.mode === "search" || a.mode !== b.mode) return false;
  const key = a.mode === "instance" ? "cardInstanceId" : "cardTemplateId";
  return a.card[key] === b.card[key];
}

export const compareCommand = Object.freeze({
  preserveEmbedsOnTimeout: true,

  data: new SlashCommandBuilder()
    .setName("compare")
    .setDescription("Compare the Stats and Traits of two Cards.")
    .addStringOption((option) => cardOption(
      option,
      "card_a",
      "First public Card ID, collection number, or player name.",
    ))
    .addStringOption((option) => cardOption(
      option,
      "card_b",
      "Second public Card ID, collection number, or player name.",
    )),

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
      const [a, b] = await Promise.all([
        resolveCard(
          interaction.options.getString("card_a", true).trim(),
          interaction,
          services,
        ),
        resolveCard(
          interaction.options.getString("card_b", true).trim(),
          interaction,
          services,
        ),
      ]);
      if (sameCard(a, b)) {
        throw new CardError("COMPARE_SAME_CARD", "Choose two different Cards to compare.");
      }
      if (a.mode === "search" || b.mode === "search") {
        const sessionId = compareSessionStore.create({
          viewerId: interaction.user.id,
          sides: { a, b },
        });
        await interaction.editReply(createCompareSearchPayload({
          sessionId,
          viewerId: interaction.user.id,
          sides: { a, b },
        }));
        return;
      }
      await interaction.editReply(await createComparePayload({
        a,
        b,
        viewerId: interaction.user.id,
      }));
    } catch (error) {
      if (error instanceof CardError) {
        await interaction.editReply({
          content: error.message,
          embeds: [],
          components: [],
        });
        return;
      }
      throw error;
    }
  },
});
