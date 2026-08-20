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

const TENDENCY_EDITOR = Object.freeze({
  decision: Object.freeze({
    action: "decision", buttonAction: "editDecision", buttonLabel: "Decision",
    emoji: "🧠", placeholder: "Decision Tendency", codes: DECISION_TENDENCIES,
  }),
  shotProfile: Object.freeze({
    action: "shotProfile", buttonAction: "editShot", buttonLabel: "Shot",
    emoji: "🎯", placeholder: "Shot Profile", codes: SHOT_PROFILE_TENDENCIES,
  }),
  creationRole: Object.freeze({
    action: "creationRole", buttonAction: "editCreation", buttonLabel: "Creation",
    emoji: "🏀", placeholder: "Creation Role", codes: CREATION_ROLE_TENDENCIES,
  }),
  usage: Object.freeze({
    action: "usage", buttonAction: "editUsage", buttonLabel: "Usage",
    emoji: "📊", placeholder: "Usage", codes: USAGE_TENDENCIES,
  }),
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
  const player = selectedPlayer(session);

  if (session.view === "tendencyPlayer" && player) {
    const profile = getPlayerTendency(strategy, player.cardInstanceId);
    return [
      `**${player.slot} · ${player.playerName}**`,
      "",
      `Decision · **${label("decision", profile.decision)}**`,
      `Shot Profile · **${label("shotProfile", profile.shotProfile)}**`,
      `Creation Role · **${label("creationRole", profile.creationRole)}**`,
      `Usage · **${label("usage", profile.usage)}**`,
    ].join("\n");
  }

  const lines = [
    "**TEAM PLAN**",
    `Main Handler · **${label("handler", strategy.mainHandler)}**`,
    `Offense · **${label("offense", strategy.offense)}**`,
    `Tempo · **${label("tempo", strategy.tempo)}**`,
    `Defense · **${label("defense", strategy.defense)}**`,
    `Rebounding · **${label("rebounding", strategy.rebounding)}**`,
  ];
  if (session.view !== "customize") {
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
    button("reset", session.sessionId, "Reset All", ButtonStyle.Secondary, "🔄", isDefault),
    button("cancel", session.sessionId, "Close", ButtonStyle.Danger, "✖️"),
  );
  return new ActionRowBuilder().addComponents(...buttons);
}

function tendencyCategoryRow(session) {
  return new ActionRowBuilder().addComponents(
    ...Object.entries(TENDENCY_EDITOR).map(([field, config]) =>
      button(
        config.buttonAction,
        session.sessionId,
        config.buttonLabel,
        session.selectedTendencyField === field
          ? ButtonStyle.Primary
          : ButtonStyle.Secondary,
        config.emoji,
      )),
  );
}

function playerActionRow(session, player, profile) {
  const defaultProfile = getPlayerTendency(
    DEFAULT_LINEUP_STRATEGY,
    player?.cardInstanceId,
  );
  const isDefault = JSON.stringify(profile) === JSON.stringify(defaultProfile);
  return new ActionRowBuilder().addComponents(
    button("summary", session.sessionId, "Back", ButtonStyle.Secondary, "↩️"),
    button("save", session.sessionId, "Save", ButtonStyle.Success, "💾", !session.dirty),
    button("resetPlayer", session.sessionId, "Reset Player", ButtonStyle.Secondary, "🔄", isDefault),
    button("cancel", session.sessionId, "Close", ButtonStyle.Danger, "✖️"),
  );
}

function tendencyRows(session) {
  const player = selectedPlayer(session);
  const profile = player
    ? getPlayerTendency(session.draftStrategy, player.cardInstanceId)
    : getPlayerTendency(session.draftStrategy, null);
  const active = TENDENCY_EDITOR[session.selectedTendencyField] ??
    TENDENCY_EDITOR.decision;
  return [
    playerRow(session),
    tendencyCategoryRow(session),
    selectRow({
      sessionId: session.sessionId,
      action: active.action,
      placeholder: active.placeholder,
      codes: active.codes,
      selectedCode: profile[active.action],
    }),
    playerActionRow(session, player, profile),
  ];
}

function components(session) {
  if (session.view === "tendencyPlayer") return tendencyRows(session);
  if (session.view === "tendencyPlayers") {
    return tendencyRows(session);
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
    : ["tendencyPlayers", "tendencyPlayer"].includes(session.view)
        ? `Player Tendencies · ${player?.playerName ?? "Player"}`
        : "Team Strategy";
  const embed = new EmbedBuilder()
    .setColor(session.dirty ? UI_COLORS.warning : UI_COLORS.primary)
    .setTitle(title.toUpperCase())
    .setDescription(strategyDescription(session))
    .setFooter({ text: session.dirty
      ? "Unsaved Changes · Save to apply"
      : "Saved · Applies to future Battles" });
  return { embeds: [embed], components: components(session) };
}
