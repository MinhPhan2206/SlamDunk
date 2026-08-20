import { MessageFlags } from "discord.js";

import { CardError } from "../../modules/card/index.js";
import { compareSessionStore } from "../compare/compare-session-store.js";
import {
  createComparePayload,
  createCompareSearchPayload,
} from "../presenters/compare.presenter.js";

async function loadSide(services, mode, id) {
  return Object.freeze({
    mode,
    card: mode === "instance"
      ? await services.cardView.getInstance(id)
      : await services.cardView.getTemplate(id),
  });
}

function sameCard(a, b) {
  if (a.mode !== b.mode) return false;
  const key = a.mode === "instance" ? "cardInstanceId" : "cardTemplateId";
  return a.card[key] === b.card[key];
}

export const compareComponent = Object.freeze({
  namespace: "compare",
  preserveEmbedsOnTimeout: true,

  async execute(interaction, { services }) {
    const parts = interaction.customId.split(":");
    const viewerId = parts[1] === "pick" ? parts[2] : parts[1];
    if (interaction.user.id !== viewerId) {
      await interaction.reply({
        content: "Only the user who opened this comparison can use these controls.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await interaction.deferUpdate();

    try {
      if (parts[1] === "pick") {
        const [, , , sessionId, sideName] = parts;
        const session = compareSessionStore.select(
          sessionId,
          sideName,
          interaction.values?.[0],
        );
        if (!session) {
          throw new CardError("COMPARE_EXPIRED", "This comparison has expired.");
        }
        if (session.sides.a.mode === "search" || session.sides.b.mode === "search") {
          await interaction.editReply(createCompareSearchPayload({
            sessionId,
            viewerId,
            sides: session.sides,
          }));
          return;
        }
        if (sameCard(session.sides.a, session.sides.b)) {
          throw new CardError("COMPARE_SAME_CARD", "Choose two different Cards to compare.");
        }
        compareSessionStore.delete(sessionId);
        await interaction.editReply(await createComparePayload({
          a: session.sides.a,
          b: session.sides.b,
          viewerId,
        }));
        return;
      }

      const [, , modeA, idA, modeB, idB, selectedTab] = parts;
      if (
        !["instance", "template"].includes(modeA) ||
        !["instance", "template"].includes(modeB) ||
        !["stats", "traits", "image"].includes(selectedTab)
      ) {
        throw new CardError("COMPARE_INVALID", "This comparison control is invalid.");
      }
      const [a, b] = await Promise.all([
        loadSide(services, modeA, idA),
        loadSide(services, modeB, idB),
      ]);
      const [traitsA, traitsB] = selectedTab === "traits"
        ? await Promise.all([
            services.cardView.getTraits(a.card.cardTemplateId),
            services.cardView.getTraits(b.card.cardTemplateId),
          ])
        : [[], []];
      await interaction.editReply(await createComparePayload({
        a,
        b,
        viewerId,
        selectedTab,
        traitsA,
        traitsB,
      }));
    } catch (error) {
      if (error instanceof CardError) {
        await interaction.editReply({
          content: error.message,
          embeds: [],
          components: [],
          attachments: [],
        });
        return;
      }
      throw error;
    }
  },
});
