const ACTIONS = Object.freeze({
  THREE_POINT: "THREE_POINT",
  MID_RANGE: "MID_RANGE",
  DRIVE: "DRIVE",
  POST_UP: "POST_UP",
  PICK_AND_ROLL: "PICK_AND_ROLL",
  DRIVE_AND_KICK: "DRIVE_AND_KICK",
});

const QUALITY_ORDER = Object.freeze([
  "HEAVILY_CONTESTED",
  "CONTESTED",
  "LIGHTLY_CONTESTED",
  "OPEN",
]);

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function weightedChoice(items, weightFor, random) {
  const weighted = items.map((item) => ({
    item,
    weight: Math.max(0.0001, weightFor(item)),
  }));
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll <= 0) return entry.item;
  }
  return weighted.at(-1).item;
}

function heightRating(heightCm) {
  return clamp(50 + ((heightCm ?? 198) - 180) * 1.5, 40, 99);
}

function rating(player, field, config) {
  const base = field === "height"
    ? heightRating(player.stats.heightCm)
    : player.stats[field];
  return clamp(
    base + (player.cardLevel - 1) * config.levelRatingBonus,
    0,
    99,
  );
}

function boxPlayer(player) {
  return {
    ...player,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
  };
}

function directDefender(player, defenders) {
  return defenders.find((defender) => defender.slot === player.slot) ?? defenders[0];
}

function strongest(players, score) {
  return [...players].sort((left, right) => score(right) - score(left))[0];
}

function selectInitiator(players, random, config) {
  return weightedChoice(
    players,
    (player) =>
      rating(player, "playmaking", config) * 1.4 +
      Math.max(
        rating(player, "finishing", config),
        rating(player, "midRange", config),
        rating(player, "threePoint", config),
      ),
    random,
  );
}

function softmaxWeight(score) {
  return Math.exp(clamp((score - 75) / 14, -4, 4));
}

function selectAction(handler, offense, defense, random, config) {
  const primary = directDefender(handler, defense);
  const help = strongest(defense, (player) =>
    rating(player, "interiorDefense", config) + rating(player, "height", config),
  );
  const screener = strongest(
    offense.filter((player) => player !== handler),
    (player) => rating(player, "strength", config) + rating(player, "height", config),
  );
  const kickShooter = strongest(
    offense.filter((player) => player !== handler),
    (player) => rating(player, "threePoint", config),
  );
  const options = [
    {
      action: ACTIONS.THREE_POINT,
      score:
        rating(handler, "threePoint", config) -
        rating(primary, "perimeterDefense", config) + 78,
    },
    {
      action: ACTIONS.MID_RANGE,
      score:
        rating(handler, "midRange", config) -
        rating(primary, "perimeterDefense", config) + 75,
    },
    {
      action: ACTIONS.DRIVE,
      score:
        0.55 * rating(handler, "playmaking", config) +
        0.45 * rating(handler, "finishing", config) -
        0.7 * rating(primary, "perimeterDefense", config) -
        0.3 * rating(help, "interiorDefense", config) + 75,
    },
    {
      action: ACTIONS.POST_UP,
      score:
        (rating(handler, "finishing", config) +
          rating(handler, "strength", config) +
          rating(handler, "height", config)) /
          3 -
        (rating(primary, "interiorDefense", config) +
          rating(primary, "strength", config) +
          rating(primary, "height", config)) /
          3 + 75,
    },
    {
      action: ACTIONS.PICK_AND_ROLL,
      score:
        0.6 * rating(handler, "playmaking", config) +
        0.25 * rating(screener, "strength", config) +
        0.15 * rating(screener, "height", config) -
        0.45 * rating(primary, "perimeterDefense", config) -
        0.25 * rating(help, "interiorDefense", config) + 65,
      screener,
    },
    {
      action: ACTIONS.DRIVE_AND_KICK,
      score:
        0.55 * rating(handler, "playmaking", config) +
        0.45 * rating(kickShooter, "threePoint", config) -
        0.5 * rating(primary, "perimeterDefense", config) -
        0.25 * rating(directDefender(kickShooter, defense), "perimeterDefense", config) +
        55,
      kickShooter,
    },
  ];
  return weightedChoice(options, (option) => softmaxWeight(option.score), random);
}

function qualityFromScore(score) {
  if (score >= 14) return "OPEN";
  if (score >= 2) return "LIGHTLY_CONTESTED";
  if (score >= -10) return "CONTESTED";
  return "HEAVILY_CONTESTED";
}

function qualityModifier(quality, config) {
  return config.shotQualityModifiers[quality];
}

function traitModifier(resolveTraitModifier, stage, context) {
  const value = resolveTraitModifier?.(stage, context) ?? 0;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError("Trait modifier must be a finite number.");
  }
  return clamp(value, -0.25, 0.25);
}

function resolveShotPlan(actionOption, handler, offense, defense, random, config) {
  const primary = directDefender(handler, defense);
  const help = strongest(defense, (player) =>
    rating(player, "interiorDefense", config) + rating(player, "height", config),
  );
  if (actionOption.action === ACTIONS.DRIVE_AND_KICK) {
    return {
      shooter: actionOption.kickShooter,
      defender: directDefender(actionOption.kickShooter, defense),
      assister: handler,
      shotType: "THREE_POINT",
      points: 3,
    };
  }
  if (actionOption.action === ACTIONS.PICK_AND_ROLL) {
    const roll = random();
    if (roll < 0.45) {
      return {
        shooter: actionOption.screener,
        defender: help,
        assister: handler,
        shotType: "FINISHING",
        points: 2,
      };
    }
    if (roll < 0.7) {
      return {
        shooter: handler,
        defender: primary,
        assister: null,
        shotType: "THREE_POINT",
        points: 3,
      };
    }
    return {
      shooter: handler,
      defender: help,
      assister: null,
      shotType: "FINISHING",
      points: 2,
    };
  }
  if (actionOption.action === ACTIONS.THREE_POINT) {
    return { shooter: handler, defender: primary, assister: null, shotType: "THREE_POINT", points: 3 };
  }
  if (actionOption.action === ACTIONS.MID_RANGE) {
    return { shooter: handler, defender: primary, assister: null, shotType: "MID_RANGE", points: 2 };
  }
  return {
    shooter: handler,
    defender: actionOption.action === ACTIONS.DRIVE ? help : primary,
    assister: null,
    shotType: "FINISHING",
    points: 2,
  };
}

function shotCreationScore(plan, action, config, random) {
  let offense;
  let defense;
  if (plan.shotType === "THREE_POINT") {
    offense = 0.6 * rating(plan.shooter, "playmaking", config) +
      0.4 * rating(plan.shooter, "threePoint", config);
    defense = rating(plan.defender, "perimeterDefense", config);
  } else if (plan.shotType === "MID_RANGE") {
    offense = 0.55 * rating(plan.shooter, "playmaking", config) +
      0.45 * rating(plan.shooter, "midRange", config);
    defense = 0.85 * rating(plan.defender, "perimeterDefense", config) +
      0.15 * rating(plan.defender, "interiorDefense", config);
  } else {
    offense = 0.5 * rating(plan.shooter, "finishing", config) +
      0.3 * rating(plan.shooter, "strength", config) +
      0.2 * rating(plan.shooter, "height", config);
    defense = 0.55 * rating(plan.defender, "interiorDefense", config) +
      0.25 * rating(plan.defender, "strength", config) +
      0.2 * rating(plan.defender, "height", config);
  }
  const actionBonus = action === ACTIONS.DRIVE_AND_KICK ? 6 : 0;
  return offense - defense + actionBonus + (random() * 24 - 12);
}

function shotProbability(plan, quality, config, resolveTraitModifier) {
  let probability;
  if (plan.shotType === "THREE_POINT") {
    probability = config.threePointBaseProbability +
      config.ratingProbabilityScale * (rating(plan.shooter, "threePoint", config) - 75) +
      qualityModifier(quality, config);
  } else if (plan.shotType === "MID_RANGE") {
    probability = config.midRangeBaseProbability +
      config.ratingProbabilityScale * (rating(plan.shooter, "midRange", config) - 75) +
      qualityModifier(quality, config);
  } else {
    const finishScore = rating(plan.shooter, "finishing", config) +
      0.25 * (rating(plan.shooter, "strength", config) - 75) +
      0.2 * (rating(plan.shooter, "height", config) - 75);
    const rimDefense = rating(plan.defender, "interiorDefense", config) +
      0.2 * (rating(plan.defender, "strength", config) - 75) +
      0.2 * (rating(plan.defender, "height", config) - 75);
    probability = config.finishingBaseProbability +
      config.ratingProbabilityScale * (finishScore - rimDefense) +
      qualityModifier(quality, config) * 0.5;
  }
  probability += traitModifier(resolveTraitModifier, "SHOT_MAKE", {
    shooter: plan.shooter,
    defender: plan.defender,
    shotType: plan.shotType,
    quality,
  });
  return clamp(probability, config.minimumShotProbability, config.maximumShotProbability);
}

function reboundScore(player, config) {
  return 0.55 * rating(player, "height", config) +
    0.35 * rating(player, "strength", config) +
    0.1 * rating(player, "interiorDefense", config);
}

function resolveRebound(offense, defense, random, config, resolveTraitModifier) {
  const offenseAverage = offense.reduce((sum, player) => sum + reboundScore(player, config), 0) / offense.length;
  const defenseAverage = defense.reduce((sum, player) => sum + reboundScore(player, config), 0) / defense.length;
  let offensiveProbability = config.offensiveReboundBaseProbability +
    0.003 * (offenseAverage - defenseAverage);
  offensiveProbability += traitModifier(resolveTraitModifier, "REBOUND", {
    offense,
    defense,
  });
  const offensive = random() < clamp(offensiveProbability, 0.12, 0.42);
  const team = offensive ? offense : defense;
  const rebounder = weightedChoice(team, (player) => reboundScore(player, config), random);
  rebounder.rebounds += 1;
  return { offensive, rebounder };
}

function frozenPlayer(player) {
  return Object.freeze({ ...player });
}

function eventPlayer(player) {
  if (!player) return null;
  return Object.freeze({
    slot: player.slot,
    cardName: player.cardName,
    cardInstanceId: player.cardInstanceId,
    cardTemplateId: player.cardTemplateId,
  });
}

function eventDescription({ action, handler, plan, made, quality, blocked, rebound }) {
  if (action === "TURNOVER") {
    return `${handler.cardName} turns the ball over.`;
  }
  const actionLabel = action.replaceAll("_", " ").toLowerCase();
  const shotLabel = plan.shotType === "THREE_POINT"
    ? "three"
    : plan.shotType === "MID_RANGE" ? "mid-range shot" : "finish at the rim";
  const result = made ? `makes the ${shotLabel}` : blocked
    ? `has the ${shotLabel} blocked`
    : `misses the ${shotLabel}`;
  const reboundText = rebound
    ? ` ${rebound.rebounder.cardName} secures the ${rebound.offensive ? "offensive" : "defensive"} rebound.`
    : "";
  return `${handler.cardName} runs ${actionLabel}; ${plan.shooter.cardName} ${result} (${quality}).${reboundText}`;
}

export function simulateBattle({
  playerTeam,
  aiTeam,
  seed,
  config,
  resolveTraitModifier = () => 0,
}) {
  const random = createSeededRandom(seed);
  const teams = {
    1: playerTeam.map(boxPlayer),
    2: aiTeam.map(boxPlayer),
  };
  const scores = { 1: 0, 2: 0 };
  const events = [];
  let offenseTeam = random() < 0.5 ? 1 : 2;
  let possessionCount = 0;

  while (
    scores[1] < config.targetScore &&
    scores[2] < config.targetScore &&
    possessionCount < config.maximumPossessions
  ) {
    possessionCount += 1;
    const actingTeam = offenseTeam;
    const defenseTeam = offenseTeam === 1 ? 2 : 1;
    const offense = teams[offenseTeam];
    const defense = teams[defenseTeam];
    const handler = selectInitiator(offense, random, config);
    const primary = directDefender(handler, defense);
    let turnoverProbability = config.turnoverBaseProbability +
      config.turnoverRatingScale *
        (rating(primary, "perimeterDefense", config) - rating(handler, "playmaking", config));
    turnoverProbability += traitModifier(resolveTraitModifier, "TURNOVER", {
      handler,
      defender: primary,
    });

    if (random() < clamp(turnoverProbability, 0.03, 0.18)) {
      handler.turnovers += 1;
      const stealBy = random() < 0.75 ? primary : null;
      if (stealBy) stealBy.steals += 1;
      events.push(Object.freeze({
        sequence: events.length + 1,
        possession: possessionCount,
        offenseTeam,
        action: "TURNOVER",
        result: "TURNOVER",
        handler: eventPlayer(handler),
        primaryDefender: eventPlayer(primary),
        stealBy: eventPlayer(stealBy),
        score: Object.freeze({ ...scores }),
        description: eventDescription({ action: "TURNOVER", handler }),
      }));
      offenseTeam = defenseTeam;
      continue;
    }

    const actionOption = selectAction(handler, offense, defense, random, config);
    const plan = resolveShotPlan(actionOption, handler, offense, defense, random, config);
    const quality = qualityFromScore(
      shotCreationScore(plan, actionOption.action, config, random),
    );
    const probability = shotProbability(plan, quality, config, resolveTraitModifier);
    plan.shooter.fieldGoalsAttempted += 1;
    if (plan.shotType === "THREE_POINT") plan.shooter.threePointersAttempted += 1;
    const made = random() < probability;
    let blocked = false;
    let rebound = null;

    if (made) {
      plan.shooter.fieldGoalsMade += 1;
      plan.shooter.points += plan.points;
      if (plan.shotType === "THREE_POINT") plan.shooter.threePointersMade += 1;
      if (plan.assister && plan.assister !== plan.shooter) plan.assister.assists += 1;
      scores[offenseTeam] += plan.points;
      offenseTeam = defenseTeam;
    } else {
      if (plan.shotType === "FINISHING") {
        const blockProbability = clamp(
          0.03 + 0.002 *
            (rating(plan.defender, "interiorDefense", config) +
              rating(plan.defender, "height", config) -
              rating(plan.shooter, "finishing", config) - 75),
          0.01,
          0.2,
        );
        blocked = random() < blockProbability;
        if (blocked) plan.defender.blocks += 1;
      }
      rebound = resolveRebound(offense, defense, random, config, resolveTraitModifier);
      if (!rebound.offensive) offenseTeam = defenseTeam;
    }

    events.push(Object.freeze({
      sequence: events.length + 1,
      possession: possessionCount,
      offenseTeam: actingTeam,
      action: actionOption.action,
      shotType: plan.shotType,
      shotQuality: quality,
      result: made ? "MAKE" : blocked ? "BLOCK" : "MISS",
      points: made ? plan.points : 0,
      handler: eventPlayer(handler),
      shooter: eventPlayer(plan.shooter),
      primaryDefender: eventPlayer(primary),
      shotDefender: eventPlayer(plan.defender),
      assister: eventPlayer(plan.assister),
      rebounder: eventPlayer(rebound?.rebounder),
      reboundTeam: rebound
        ? rebound.offensive ? actingTeam : defenseTeam
        : null,
      score: Object.freeze({ ...scores }),
      description: eventDescription({
        action: actionOption.action,
        handler,
        plan,
        made,
        quality,
        blocked,
        rebound,
      }),
    }));
  }

  if (scores[1] < config.targetScore && scores[2] < config.targetScore) {
    throw new Error("Battle exceeded the maximum possession safety limit.");
  }

  return Object.freeze({
    engineVersion: config.engineVersion,
    rulesetVersion: config.rulesetVersion,
    configVersion: config.configVersion,
    winnerTeam: scores[1] >= config.targetScore ? 1 : 2,
    playerScore: scores[1],
    aiScore: scores[2],
    possessionCount,
    playByPlay: Object.freeze(events),
    playerTeam: Object.freeze(teams[1].map(frozenPlayer)),
    aiTeam: Object.freeze(teams[2].map(frozenPlayer)),
  });
}

export { ACTIONS, QUALITY_ORDER };
