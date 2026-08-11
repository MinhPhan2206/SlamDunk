import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from "discord.js";

import {
  DEFAULT_LINEUP_STRATEGY,
  DEFENSE_PLAN_CODES,
  getPlayerTendency,
  MAIN_HANDLER_CODES,
  OFFENSE_STYLE_CODES,
  REBOUNDING_POLICY_CODES,
  TEMPO_CODES,
} from "../../modules/lineup/index.js";
import {
  CREATION_ROLE_TENDENCIES,
  DECISION_TENDENCIES,
  SHOT_PROFILE_TENDENCIES,
  USAGE_TENDENCIES,
} from "../../modules/tendency/index.js";
import { UI_COLORS } from "../ui/theme.js";

const LABELS = Object.freeze({
  handler: Object.freeze({
    PG: "PG · Point Guard", SG: "SG · Shooting Guard",
    SF: "SF · Small Forward", PF: "PF · Power Forward", C: "C · Center",
  }),
  offense: Object.freeze({
    BALANCED: "Balanced", PACE_SPACE: "Pace & Space", MOTION: "Motion Offense",
    PICK_GAME: "Pick Game", ISO_CREATOR: "Isolation Creator",
    RIM_PRESSURE: "Rim Pressure", POST_HUB: "Post Hub", TRANSITION: "Run & Gun",
  }),
  tempo: Object.freeze({ PATIENT: "Patient", STANDARD: "Standard", QUICK: "Quick" }),
  defense: Object.freeze({
    BALANCED: "Balanced", SWITCH: "Switch", DROP: "Drop Coverage",
    BLITZ: "Blitz Ball Handler", GO_UNDER: "Go Under", STAY_HOME: "Stay Home",
    PACK_PAINT: "Pack Paint",
  }),
  rebounding: Object.freeze({
    BALANCED: "Balanced", CRASH_GLASS: "Crash the Glass", GET_BACK: "Get Back",
  }),
  decision: Object.freeze({
    BALANCED: "Balanced", PASS_FIRST: "Pass First", SCORE_FIRST: "Score First",
  }),
  shotProfile: Object.freeze({
    BALANCED: "Balanced", RIM_PRESSURE: "Rim Pressure",
    PERIMETER: "Perimeter Heavy", MID_RANGE: "Mid-Range Heavy", POST: "Post Heavy",
  }),
  creationRole: Object.freeze({
    BALANCED: "Balanced", PICK_ROLL_HANDLER: "Pick & Roll", OFF_BALL: "Off-Ball Heavy",
  }),
  usage: Object.freeze({ NORMAL: "Normal", LOW: "Low Usage" }),
});

function customId(action, sessionId) {
  return `strategy:${action}:${sessionId}`;
}

function label(group, code) {
  return LABELS[group][code] ?? code;
}

function selectedPlayer(session) {
  return session.players.find((player) =>
    player.cardInstanceId === session.selectedTendencyCardId) ?? null;
}

function strategyDescription(session) {
  const strategy = session.draftStrategy;
  const lines = [
    `Main Handler · **${label("handler", strategy.mainHandler)}**`,
    `Offense · **${label("offense", strategy.offense)}**`,
    `Tempo · **${label("tempo", strategy.tempo)}**`,
    `Defense · **${label("defense", strategy.defense)}**`,
    `Rebounding · **${label("rebounding", strategy.rebounding)}**`,
  ];
  if (["tendencyPlayers", "tendencyPlayer"].includes(session.view)) {
    lines.push("", "**Player Tendencies**");
    if (!session.players.length) lines.push("Complete your lineup to configure players.");
    for (const player of session.players) {
      const profile = getPlayerTendency(strategy, player.cardInstanceId);
      const marker = player.cardInstanceId === session.selectedTendencyCardId ? "› " : "";
      lines.push(
        `${marker}**${player.slot} · ${player.playerName}** — ` +
        `${label("decision", profile.decision)} · ` +
        `${label("shotProfile", profile.shotProfile)} · ` +
        `${label("creationRole", profile.creationRole)} · ` +
        `${label("usage", profile.usage)}`,
      );
    }
  }
  lines.push("", session.dirty
    ? "Changes are not saved yet."
    : "This strategy is saved for future Battles.");
  return lines.join("\n");
}

function selectRow({ sessionId, action, placeholder, codes, selectedCode }) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId(action, sessionId))
    .setPlaceholder(placeholder)
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(codes.map((code) => ({
      label: label(action, code), value: code, default: code === selectedCode,
    })));
  return new ActionRowBuilder().addComponents(menu);
}

function playerRow(session) {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId("player", session.sessionId))
    .setPlaceholder(session.players.length ? "Select a lineup player" : "No lineup players")
    .setMinValues(1)
    .setMaxValues(1)
    .setDisabled(!session.players.length);
  if (session.players.length) {
    menu.addOptions(session.players.map((player) => ({
      label: `${player.slot} · ${player.playerName}`.slice(0, 100),
      value: player.cardInstanceId,
      default: player.cardInstanceId === session.selectedTendencyCardId,
    })));
  } else {
    menu.addOptions({ label: "No players available", value: "none" });
  }
  return new ActionRowBuilder().addComponents(menu);
}

function button(action, sessionId, text, style, emoji, disabled = false) {
  return new ButtonBuilder()
    .setCustomId(customId(action, sessionId))
    .setLabel(text)
    .setEmoji(emoji)
    .setStyle(style)
    .setDisabled(disabled);
}

function actionRow(session, backAction = null) {
  const buttons = [];
  if (backAction) {
    buttons.push(button(backAction, session.sessionId,
      backAction === "tendencies" ? "Players" : "Back",
      ButtonStyle.Secondary, "↩️"));
  } else {
    buttons.push(
      button("customize", session.sessionId, "Team", ButtonStyle.Primary, "⚙️"),
      button("tendencies", session.sessionId, "Players", ButtonStyle.Secondary, "👤"),
    );
  }
  const isDefault = JSON.stringify(session.draftStrategy) ===
    JSON.stringify(DEFAULT_LINEUP_STRATEGY);
  buttons.push(
    button("save", session.sessionId, "Save", ButtonStyle.Success, "💾", !session.dirty),
    button("reset", session.sessionId, "Reset", ButtonStyle.Secondary, "🔄", isDefault),
    button("cancel", session.sessionId, "Cancel", ButtonStyle.Danger, "✖️"),
  );
  return new ActionRowBuilder().addComponents(...buttons);
}

function tendencyRows(session) {
  const player = selectedPlayer(session);
  const profile = player
    ? getPlayerTendency(session.draftStrategy, player.cardInstanceId)
    : getPlayerTendency(session.draftStrategy, null);
  return [
    selectRow({ sessionId: session.sessionId, action: "decision",
      placeholder: "Decision Tendency", codes: DECISION_TENDENCIES,
      selectedCode: profile.decision }),
    selectRow({ sessionId: session.sessionId, action: "shotProfile",
      placeholder: "Shot Profile", codes: SHOT_PROFILE_TENDENCIES,
      selectedCode: profile.shotProfile }),
    selectRow({ sessionId: session.sessionId, action: "creationRole",
      placeholder: "Creation Role", codes: CREATION_ROLE_TENDENCIES,
      selectedCode: profile.creationRole }),
    selectRow({ sessionId: session.sessionId, action: "usage",
      placeholder: "Usage", codes: USAGE_TENDENCIES,
      selectedCode: profile.usage }),
    actionRow(session, "tendencies"),
  ];
}

function components(session) {
  if (session.view === "tendencyPlayer") return tendencyRows(session);
  if (session.view === "tendencyPlayers") {
    return [playerRow(session), actionRow(session, "summary")];
  }
  if (session.view === "customize") {
    return [
      selectRow({ sessionId: session.sessionId, action: "offense",
        placeholder: "Offense Style", codes: OFFENSE_STYLE_CODES,
        selectedCode: session.draftStrategy.offense }),
      selectRow({ sessionId: session.sessionId, action: "tempo",
        placeholder: "Tempo", codes: TEMPO_CODES,
        selectedCode: session.draftStrategy.tempo }),
      selectRow({ sessionId: session.sessionId, action: "defense",
        placeholder: "Defense Plan", codes: DEFENSE_PLAN_CODES,
        selectedCode: session.draftStrategy.defense }),
      selectRow({ sessionId: session.sessionId, action: "rebounding",
        placeholder: "Rebounding Policy", codes: REBOUNDING_POLICY_CODES,
        selectedCode: session.draftStrategy.rebounding }),
      actionRow(session, "summary"),
    ];
  }
  return [
    selectRow({ sessionId: session.sessionId, action: "handler",
      placeholder: "Main Handler", codes: MAIN_HANDLER_CODES,
      selectedCode: session.draftStrategy.mainHandler }),
    actionRow(session),
  ];
}

export function createStrategyEditorPayload(session) {
  const player = selectedPlayer(session);
  const title = session.view === "customize"
    ? "Team Strategy · Tactics"
    : session.view === "tendencyPlayers"
      ? "Team Strategy · Player Tendencies"
      : session.view === "tendencyPlayer"
        ? `Player Tendencies · ${player?.playerName ?? "Player"}`
        : "Team Strategy";
  const embed = new EmbedBuilder()
    .setColor(session.dirty ? UI_COLORS.warning : UI_COLORS.primary)
    .setTitle(title)
    .setDescription(strategyDescription(session))
    .setFooter({ text: session.dirty
      ? "Unsaved Changes · Save to apply"
      : "Saved · Applies to future Battles" });
  return { embeds: [embed], components: components(session) };
}
