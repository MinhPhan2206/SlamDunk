import { MessageFlags } from "discord.js";

import {
  DEFAULT_LINEUP_STRATEGY,
  DEFENSE_PLAN_CODES,
  LineupError,
  MAIN_HANDLER_CODES,
  OFFENSE_STYLE_CODES,
  REBOUNDING_POLICY_CODES,
  TEMPO_CODES,
  getPlayerTendency,
  normalizeLineupStrategy,
  setPlayerTendency,
} from "../../modules/lineup/index.js";
import {
  CREATION_ROLE_TENDENCIES,
  DECISION_TENDENCIES,
  SHOT_PROFILE_TENDENCIES,
  USAGE_TENDENCIES,
} from "../../modules/tendency/index.js";
import { createStrategyEditorPayload } from "../presenters/strategy.presenter.js";
import { STRATEGY_EDITOR_TIMEOUT_MS } from "../strategy/strategy-draft-store.js";

const CUSTOM_ID_PATTERN = /^strategy:(player|handler|offense|tempo|defense|rebounding|decision|shotProfile|creationRole|usage|customize|tendencies|summary|save|reset|cancel):([0-9a-f]{32})$/;
const SELECT_ACTIONS = new Set([
  "player",
  "handler",
  "offense",
  "tempo",
  "defense",
  "rebounding",
  "decision",
  "shotProfile",
  "creationRole",
  "usage",
]);
const TENDENCY_ACTIONS = new Set(["decision", "shotProfile", "creationRole", "usage"]);
const FIELD_CODES = Object.freeze({
  handler: MAIN_HANDLER_CODES,
  offense: OFFENSE_STYLE_CODES,
  tempo: TEMPO_CODES,
  defense: DEFENSE_PLAN_CODES,
  rebounding: REBOUNDING_POLICY_CODES,
  decision: DECISION_TENDENCIES,
  shotProfile: SHOT_PROFILE_TENDENCIES,
  creationRole: CREATION_ROLE_TENDENCIES,
  usage: USAGE_TENDENCIES,
});
const FIELD_PROPERTIES = Object.freeze({
  handler: "mainHandler",
  offense: "offense",
  tempo: "tempo",
  defense: "defense",
  rebounding: "rebounding",
});

async function ephemeral(interaction, content) {
  await interaction.reply({ content, flags: MessageFlags.Ephemeral });
}

function validInteractionType(interaction, action) {
  return SELECT_ACTIONS.has(action)
    ? interaction.isStringSelectMenu?.() === true
    : interaction.isButton?.() === true;
}

function selectedValue(interaction) {
  return interaction.values?.length === 1 ? interaction.values[0] : null;
}

export const strategyComponent = Object.freeze({
  namespace: "strategy",
  componentInactivityTimeoutMs: STRATEGY_EDITOR_TIMEOUT_MS,
  managesOwnComponentTimeout: true,

  async execute(interaction, { services, strategyDrafts }) {
    const match = CUSTOM_ID_PATTERN.exec(interaction.customId);
    if (!match || !validInteractionType(interaction, match[1])) {
      await ephemeral(interaction, "This Strategy action is invalid.");
      return;
    }

    const [, action, sessionId] = match;
    let session = strategyDrafts.get(sessionId);
    if (!session) {
      await ephemeral(
        interaction,
        "This Strategy editor has expired. Run /strategy again.",
      );
      return;
    }
    if (interaction.user.id !== session.ownerDiscordUserId) {
      await ephemeral(
        interaction,
        "Only the user who opened this Strategy editor can use it.",
      );
      return;
    }
    if (
      session.messageId &&
      interaction.message?.id &&
      String(interaction.message.id) !== session.messageId
    ) {
      await ephemeral(interaction, "This Strategy action is invalid.");
      return;
    }

    let value = null;
    if (SELECT_ACTIONS.has(action)) {
      value = selectedValue(interaction);
      if (action === "player") {
        if (!value || !session.players.some((player) =>
          player.cardInstanceId === value)) {
          await ephemeral(interaction, "This lineup player is invalid.");
          return;
        }
      } else {
        if (!value || !FIELD_CODES[action].includes(value)) {
          await ephemeral(interaction, "This Strategy setting is invalid.");
          return;
        }
      }
    }

    strategyDrafts.touch(sessionId);
    await interaction.deferUpdate();
    const handled = await strategyDrafts.run(sessionId, async (current) => {
      if (action === "cancel") {
        strategyDrafts.remove(sessionId);
        await interaction.editReply({
          content: "Strategy editor closed. No unsaved changes were applied.",
          embeds: [],
          components: [],
        });
        return true;
      }

      if (["customize", "summary"].includes(action)) {
        session = strategyDrafts.setView(
          sessionId,
          action,
        );
      } else if (action === "tendencies") {
        session = strategyDrafts.setView(sessionId, "tendencyPlayers");
      } else if (action === "player") {
        session = strategyDrafts.selectTendencyPlayer(sessionId, value);
      } else if (action === "reset") {
        session = strategyDrafts.setDraft(sessionId, DEFAULT_LINEUP_STRATEGY);
      } else if (FIELD_CODES[action]) {
        session = strategyDrafts.setDraft(
          sessionId,
          normalizeLineupStrategy(TENDENCY_ACTIONS.has(action)
            ? setPlayerTendency(
                current.draftStrategy,
                current.selectedTendencyCardId,
                {
                  ...getPlayerTendency(
                    current.draftStrategy,
                    current.selectedTendencyCardId,
                  ),
                  [action]: value,
                },
              )
            : {
                ...current.draftStrategy,
                [FIELD_PROPERTIES[action]]: value,
              }),
        );
      } else if (action === "save" && current.dirty) {
        try {
          const saved = await services.lineup.saveStrategy({
            playerId: current.playerId,
            strategy: current.draftStrategy,
            expectedRevision: current.strategyRevision,
          });
          session = strategyDrafts.markSaved(sessionId, saved);
        } catch (error) {
          if (
            error instanceof LineupError &&
            error.code === "STRATEGY_REVISION_CONFLICT"
          ) {
            strategyDrafts.remove(sessionId);
            await interaction.editReply({
              content: error.message,
              embeds: [],
              components: [],
            });
            return true;
          }
          if (error instanceof LineupError) {
            await interaction.followUp({
              content: error.message,
              flags: MessageFlags.Ephemeral,
            });
            return true;
          }
          throw error;
        }
      }

      if (!session) return null;
      const message = await interaction.editReply(
        createStrategyEditorPayload(session),
      );
      strategyDrafts.bindMessage(
        sessionId,
        message,
        (payload) => interaction.editReply(payload),
      );
      return true;
    });

    if (handled === null) {
      await interaction.editReply({
        content: "This Strategy editor has expired. Run /strategy again.",
        embeds: [],
        components: [],
      });
    }
  },
});
