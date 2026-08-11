const TEAM_MARKERS = Object.freeze({ 1: "🔸", 2: "🔹" });
const MAKE_ICONS = Object.freeze(["💰", "✅", "🎯", "🔥", "🌧️"]);
const PASSING_ACTIONS = new Set([
  "TIP_OFF",
  "CHECK_IN",
  "PASS",
  "DRIBBLE_HANDOFF",
  "EXTRA_PASS",
  "POST_KICK_OUT",
  "DRIVE_AND_KICK",
]);

function boxed(name) {
  return `\`${String(name).replaceAll("`", "")}\``;
}

function marker(teamNumber) {
  return TEAM_MARKERS[teamNumber] ?? "⬜";
}

function playerName(player, fallback = "the ball handler") {
  return boxed(player?.cardName ?? fallback);
}

function actionChainText(step, event) {
  const actor = playerName(step.actor ?? event.handler);
  const receiver = playerName(step.receiver, "a teammate");
  const screener = playerName(step.screener, "a teammate");
  const defender = playerName(
    step.defender ?? event.primaryDefender,
    "the defender",
  );
  const choices = {
    TIP_OFF: `🏁 ${actor} · wins the opening tip over ${defender}; ${receiver} controls the ball`,
    CHECK_IN: `🏁 ${receiver} · receives the check-in pass from ${actor}`,
    PASS: `🏀 ${actor} · moves the ball to ${receiver}`,
    CREATE_SEPARATION: `⛹️ ${actor} · shakes free from ${defender}`,
    CUT: `✂️ ${actor} · cuts through the open lane`,
    FAST_BREAK: `⚡ ${actor} · pushes the pace in transition`,
    SECOND_CHANCE: `🔁 ${actor} · keeps the possession alive`,
    RESET_OFFENSE: `🔄 ${actor} · pulls the ball out and resets the offense`,
    PICK_AND_POP: `🧱 ${actor} · uses ${screener}'s screen as ${screener} pops outside`,
    DRIBBLE_HANDOFF: `🤝 ${actor} · hands the ball to ${receiver}`,
    OFF_BALL_SCREEN: `🧱 ${screener} · screens away to free ${receiver}`,
    RELOCATE: `↗️ ${actor} · relocates into open space`,
    EXTRA_PASS: `🏀 ${actor} · swings the extra pass to ${receiver}`,
    POST_KICK_OUT: `📤 ${actor} · kicks the ball out of the post to ${receiver}`,
    THREE_POINT: `⛹️ ${actor} · creates space beyond the arc`,
    MID_RANGE: `⛹️ ${actor} · works into the mid-range`,
    DRIVE: `⛹️ ${actor} · attacks the lane off the dribble`,
    POST_UP: `💪 ${actor} · backs ${defender} toward the paint`,
    PICK_AND_ROLL: `🧱 ${actor} · runs a pick-and-roll with ${screener}`,
    DRIVE_AND_KICK: `🏀 ${actor} · draws help and kicks to ${receiver}`,
  };
  const fallbackAction = String(step.action ?? "action")
    .replaceAll("_", " ")
    .toLowerCase();
  return choices[step.action] ?? `⛹️ ${actor} · runs the ${fallbackAction}`;
}

function addActionChain(lines, eventIndex, event, previousScore) {
  if (!Array.isArray(event.actionChain) || event.actionChain.length === 0) {
    return false;
  }
  for (const step of event.actionChain) {
    addLine(
      lines,
      eventIndex,
      event,
      event.offenseTeam,
      actionChainText(step, event),
      false,
      previousScore,
    );
  }
  return true;
}

function actionChainIncludesPass(event) {
  return event.actionChain?.some((step) =>
    PASSING_ACTIONS.has(step.action) && step.receiver,
  ) ?? false;
}

function setupText(event) {
  const handler = boxed(event.handler.cardName);
  const defender = boxed(event.primaryDefender?.cardName ?? "the defender");
  const choices = {
    THREE_POINT: `${handler} · creates space with a sharp step-back`,
    MID_RANGE: `${handler} · uses a hesitation dribble near the elbow`,
    DRIVE: `${handler} · attacks the lane with a moving crossover`,
    POST_UP: `${handler} · backs ${defender} down toward the paint`,
    PICK_AND_ROLL: `${handler} · calls for a high pick-and-roll`,
    DRIVE_AND_KICK: `${handler} · breaks down the defense off the dribble`,
  };
  return `⛹️ ${choices[event.action] ?? `${handler} · sizes up the defense`}`;
}

function passText(event) {
  if (!event.assister || event.assister.cardName === event.shooter.cardName) {
    return null;
  }
  const variations = ["bounce-passes", "fires a chest pass", "dishes the ball"];
  const action = variations[event.possession % variations.length];
  return `🏀 ${boxed(event.assister.cardName)} · ${action} to ${boxed(event.shooter.cardName)}`;
}

function contestLabel(shotQuality) {
  const labels = {
    OPEN: "open",
    LIGHTLY_CONTESTED: "lightly contested",
    CONTESTED: "contested",
    HEAVILY_CONTESTED: "smothered",
  };
  return labels[shotQuality] ?? "contested";
}

function attemptText(event) {
  const shooter = boxed(event.shooter.cardName);
  const contest = contestLabel(event.shotQuality);
  const article = contest === "open" ? "an" : "a";
  if (event.shotType === "THREE_POINT") {
    return `🎯 ${shooter} · attempts ${article} ${contest} three-pointer`;
  }
  if (event.shotType === "MID_RANGE") {
    return `🪄 ${shooter} · rises for ${article} ${contest} mid-range jumper`;
  }
  const finishes = [
    "driving layup",
    "reverse layup",
    "one-handed finish",
    "floater in the lane",
  ];
  return `🗡️ ${shooter} · tries ${article} ${contest} ${finishes[event.possession % finishes.length]}`;
}

function resultText(event) {
  if (event.result === "MAKE") {
    const icon = MAKE_ICONS[event.possession % MAKE_ICONS.length];
    return `${icon} ${boxed(event.shooter.cardName)} · +${event.points} points`;
  }
  if (event.result === "BLOCK") {
    return `⛔ ${boxed(event.shotDefender.cardName)} · rejects ${boxed(event.shooter.cardName)}`;
  }
  return `🧱 ${boxed(event.shooter.cardName)} · misses the attempt`;
}

function addLine(
  lines,
  eventIndex,
  event,
  teamNumber,
  description,
  completesPossession,
  score = event.score,
) {
  lines.push({
    eventIndex,
    possession: event.possession,
    description: `${marker(teamNumber)} ${description}`,
    score,
    completesPossession,
  });
}

export function createBattleTimeline(playByPlay) {
  const lines = [];
  let previousScore = Object.freeze({ 1: 0, 2: 0 });

  playByPlay.forEach((event, eventIndex) => {
    if (!event.handler || (event.action !== "TURNOVER" && !event.shooter)) {
      addLine(lines, eventIndex, event, event.offenseTeam, event.description, true);
      previousScore = event.score;
      return;
    }
    const defenseTeam = event.offenseTeam === 1 ? 2 : 1;
    const hasActionChain = addActionChain(
      lines,
      eventIndex,
      event,
      previousScore,
    );
    if (event.action === "TURNOVER") {
      const description = event.stealBy
        ? `🖐️ ${boxed(event.stealBy.cardName)} · steals the ball from ${boxed(event.handler.cardName)}`
        : `🔄 ${boxed(event.handler.cardName)} · loses control of the ball`;
      addLine(
        lines,
        eventIndex,
        event,
        event.stealBy ? defenseTeam : event.offenseTeam,
        description,
        true,
      );
      previousScore = event.score;
      return;
    }

    if (!hasActionChain) {
      addLine(
        lines, eventIndex, event, event.offenseTeam, setupText(event), false,
        previousScore,
      );
    }
    const pass = actionChainIncludesPass(event) ? null : passText(event);
    if (pass) {
      addLine(
        lines, eventIndex, event, event.offenseTeam, pass, false,
        previousScore,
      );
    }
    addLine(
      lines, eventIndex, event, event.offenseTeam, attemptText(event), false,
      previousScore,
    );
    addLine(
      lines,
      eventIndex,
      event,
      event.result === "BLOCK" ? defenseTeam : event.offenseTeam,
      resultText(event),
      !event.rebounder,
    );
    if (event.rebounder) {
      const reboundType = event.reboundTeam === event.offenseTeam
        ? "offensive"
        : "defensive";
      addLine(
        lines,
        eventIndex,
        event,
        event.reboundTeam,
        `📍 ${boxed(event.rebounder.cardName)} · secures the ${reboundType} rebound`,
        true,
      );
    }
    previousScore = event.score;
  });

  return Object.freeze(lines.map((line, index) => Object.freeze({
    ...line,
    sequence: index + 1,
  })));
}
