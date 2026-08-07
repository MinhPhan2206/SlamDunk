const TEAM_MARKERS = Object.freeze({ 1: "🔸", 2: "🔹" });
const MAKE_ICONS = Object.freeze(["💰", "✅", "🎯", "🔥", "🌧️"]);

function boxed(name) {
  return `\`${String(name).replaceAll("`", "")}\``;
}

function marker(teamNumber) {
  return TEAM_MARKERS[teamNumber] ?? "⬜";
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
  if (event.shotType === "THREE_POINT") {
    return `🎯 ${shooter} · attempts a ${contest} three-pointer`;
  }
  if (event.shotType === "MID_RANGE") {
    return `🪄 ${shooter} · rises for a ${contest} mid-range jumper`;
  }
  const finishes = [
    "driving layup",
    "reverse layup",
    "one-handed finish",
    "floater in the lane",
  ];
  return `🗡️ ${shooter} · tries a ${contest} ${finishes[event.possession % finishes.length]}`;
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

    addLine(
      lines, eventIndex, event, event.offenseTeam, setupText(event), false,
      previousScore,
    );
    const pass = passText(event);
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
