import { getActualCardStat } from "../card/card-stats.js";
import { getPlayerTendency } from "../lineup/lineup-strategy.js";
import {
  BATTLE_STRATEGY_RESOLVER_VERSION,
  coverageWeightsFor,
  getStrategyActionMultiplier,
  getStrategyFastBreakDelta,
  getStrategyOffensiveReboundDelta,
  getStrategyTurnoverDelta,
  resolveBattleStrategy,
} from "./battle-strategy.js";
import {
  BATTLE_TRAIT_RESOLVER_VERSION,
  resolveBattleTraitModifiers,
} from "./battle-trait-resolver.js";
import {
  BATTLE_TENDENCY_RESOLVER_VERSION,
  getTendencyActionMultiplier,
} from "./battle-tendency.js";

const ACTIONS = Object.freeze({
  TIP_OFF: "TIP_OFF",
  CHECK_IN: "CHECK_IN",
  THREE_POINT: "THREE_POINT",
  MID_RANGE: "MID_RANGE",
  DRIVE: "DRIVE",
  POST_UP: "POST_UP",
  PICK_AND_ROLL: "PICK_AND_ROLL",
  DRIVE_AND_KICK: "DRIVE_AND_KICK",
  PASS: "PASS",
  CREATE_SEPARATION: "CREATE_SEPARATION",
  CUT: "CUT",
  FAST_BREAK: "FAST_BREAK",
  SECOND_CHANCE: "SECOND_CHANCE",
  RESET_OFFENSE: "RESET_OFFENSE",
  PICK_AND_POP: "PICK_AND_POP",
  DRIBBLE_HANDOFF: "DRIBBLE_HANDOFF",
  OFF_BALL_SCREEN: "OFF_BALL_SCREEN",
  RELOCATE: "RELOCATE",
  EXTRA_PASS: "EXTRA_PASS",
  POST_KICK_OUT: "POST_KICK_OUT",
});

const PHASES = Object.freeze({
  HALF_COURT: "HALF_COURT",
  TRANSITION: "TRANSITION",
  SECOND_CHANCE: "SECOND_CHANCE",
});

const QUALITY_ORDER = Object.freeze([
  "HEAVILY_CONTESTED",
  "CONTESTED",
  "LIGHTLY_CONTESTED",
  "OPEN",
]);

const SCREEN_ACTIONS = new Set([
  ACTIONS.PICK_AND_ROLL,
  ACTIONS.PICK_AND_POP,
  ACTIONS.DRIBBLE_HANDOFF,
  ACTIONS.OFF_BALL_SCREEN,
]);

const PASS_ACTIONS = new Set([
  ACTIONS.PASS,
  ACTIONS.CUT,
  ACTIONS.DRIVE_AND_KICK,
  ACTIONS.PICK_AND_ROLL,
  ACTIONS.PICK_AND_POP,
  ACTIONS.DRIBBLE_HANDOFF,
  ACTIONS.OFF_BALL_SCREEN,
  ACTIONS.RELOCATE,
  ACTIONS.EXTRA_PASS,
  ACTIONS.POST_KICK_OUT,
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

function rating(player, field) {
  if (field === "height") return heightRating(player.stats.heightCm);
  return clamp(getActualCardStat(player.stats[field], player.cardLevel), 0, 99);
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

function bestScorer(players) {
  return strongest(players, (player) => Math.max(
    rating(player, "threePoint"),
    rating(player, "midRange"),
    rating(player, "finishing"),
  ));
}

function selectInitiator(players, random) {
  return weightedChoice(
    players,
    (player) => rating(player, "playmaking") * 1.4 + Math.max(
      rating(player, "finishing"),
      rating(player, "midRange"),
      rating(player, "threePoint"),
    ),
    random,
  );
}

function mainHandler(players, strategy) {
  return players.find((player) => player.slot === strategy.mainHandler) ??
    players.find((player) => player.slot === "PG") ??
    strongest(players, (player) => rating(player, "playmaking"));
}

function inbounder(players, receiver) {
  return players.find((player) => player.slot === "C" && player !== receiver) ??
    players.find((player) => player !== receiver) ??
    receiver;
}

function resolveTipOff(teams, strategies, random) {
  const centers = {
    1: teams[1].find((player) => player.slot === "C") ?? teams[1].at(-1),
    2: teams[2].find((player) => player.slot === "C") ?? teams[2].at(-1),
  };
  const jumpScore = (player) =>
    0.65 * rating(player, "height") + 0.35 * rating(player, "strength");
  const teamOneProbability = clamp(
    0.5 + (jumpScore(centers[1]) - jumpScore(centers[2])) * 0.01,
    0.2,
    0.8,
  );
  const offenseTeam = random() < teamOneProbability ? 1 : 2;
  const defenseTeam = offenseTeam === 1 ? 2 : 1;
  return {
    offenseTeam,
    restart: {
      action: ACTIONS.TIP_OFF,
      actor: centers[offenseTeam],
      receiver: mainHandler(teams[offenseTeam], strategies[offenseTeam]),
      defender: centers[defenseTeam],
    },
  };
}

function softmaxWeight(score, config) {
  const temperature = config.actionSelectionTemperature ?? 14;
  return Math.exp(clamp((score - 75) / temperature, -4, 4));
}

function repetitionMultiplier(history, action, config) {
  const threshold = config.repetitionPenaltyAfter ?? 3;
  for (let index = history.length - threshold; index >= 0; index -= 1) {
    if (!history.slice(index, index + threshold).every((entry) => entry === action)) {
      continue;
    }
    const differentActionsAfterRead = history
      .slice(index + threshold)
      .filter((entry) => entry !== action).length;
    if (differentActionsAfterRead < 2) {
      return config.repetitionPenaltyMultiplier ?? 0.65;
    }
    break;
  }
  return 1;
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

function traitActivationKey(activation) {
  return [
    activation.traitCode,
    activation.hook,
    activation.channel,
    activation.player.cardTemplateId,
  ].join(":");
}

function uniqueActivations(...groups) {
  const seen = new Set();
  const result = [];
  for (const activation of groups.flat()) {
    const key = traitActivationKey(activation);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(activation);
    }
  }
  return Object.freeze(result);
}

function supportingPlayers(handler, offense) {
  const others = offense.filter((player) => player !== handler);
  const screener = strongest(
    others,
    (player) => rating(player, "strength") + rating(player, "height"),
  );
  const shooter = strongest(others, (player) => rating(player, "threePoint"));
  const cutter = strongest(
    others,
    (player) => rating(player, "finishing") + 0.35 * rating(player, "playmaking"),
  );
  const receiver = bestScorer(others);
  const connector = strongest(
    others.filter((player) => player !== shooter),
    (player) => rating(player, "playmaking"),
  ) ?? receiver;
  return { screener, shooter, cutter, receiver, connector };
}

function baseActionOptions(handler, offense, defense, phase, phasePlayer) {
  const primary = directDefender(handler, defense);
  const help = strongest(
    defense,
    (player) => rating(player, "interiorDefense") + rating(player, "height"),
  );
  const support = supportingPlayers(handler, offense);
  if (phase === PHASES.TRANSITION) {
    const finisher = strongest(
      offense,
      (player) => rating(player, "finishing") + 0.4 * rating(player, "playmaking"),
    );
    return [{ action: ACTIONS.FAST_BREAK, score: 88, beneficiary: finisher, ...support }];
  }
  if (phase === PHASES.SECOND_CHANCE) {
    return [{
      action: ACTIONS.SECOND_CHANCE,
      score: 86,
      beneficiary: phasePlayer ?? support.cutter,
      rebounder: phasePlayer,
      ...support,
    }];
  }

  const perimeterPressure = rating(primary, "perimeterDefense");
  const rimPressure = rating(help, "interiorDefense");
  const passPressure = strongest(defense, (player) => rating(player, "perimeterDefense"));
  return [
    {
      action: ACTIONS.THREE_POINT,
      score: rating(handler, "threePoint") - perimeterPressure + 78,
      beneficiary: handler,
      ...support,
    },
    {
      action: ACTIONS.MID_RANGE,
      score: rating(handler, "midRange") - perimeterPressure + 75,
      beneficiary: handler,
      ...support,
    },
    {
      action: ACTIONS.DRIVE,
      score: 0.55 * rating(handler, "playmaking") +
        0.45 * rating(handler, "finishing") -
        0.7 * perimeterPressure - 0.3 * rimPressure + 75,
      beneficiary: handler,
      ...support,
    },
    {
      action: ACTIONS.POST_UP,
      score: (rating(handler, "finishing") + rating(handler, "strength") +
        rating(handler, "height")) / 3 -
        (rating(primary, "interiorDefense") + rating(primary, "strength") +
          rating(primary, "height")) / 3 + 75,
      beneficiary: handler,
      ...support,
    },
    {
      action: ACTIONS.PICK_AND_ROLL,
      score: 0.6 * rating(handler, "playmaking") +
        0.25 * rating(support.screener, "strength") +
        0.15 * rating(support.screener, "height") -
        0.45 * perimeterPressure - 0.25 * rimPressure + 65,
      beneficiary: support.screener,
      ...support,
    },
    {
      action: ACTIONS.DRIVE_AND_KICK,
      score: 0.55 * rating(handler, "playmaking") +
        0.45 * rating(support.shooter, "threePoint") -
        0.5 * perimeterPressure -
        0.25 * rating(directDefender(support.shooter, defense), "perimeterDefense") + 55,
      beneficiary: support.shooter,
      ...support,
    },
    {
      action: ACTIONS.PASS,
      score: 0.55 * rating(handler, "playmaking") +
        0.45 * Math.max(
          rating(support.receiver, "threePoint"),
          rating(support.receiver, "midRange"),
          rating(support.receiver, "finishing"),
        ) - 0.4 * rating(passPressure, "perimeterDefense") + 43,
      beneficiary: support.receiver,
      ...support,
    },
    {
      action: ACTIONS.CREATE_SEPARATION,
      score: 0.6 * rating(handler, "playmaking") + 0.4 * Math.max(
        rating(handler, "threePoint"), rating(handler, "midRange"), rating(handler, "finishing"),
      ) - perimeterPressure + 75,
      beneficiary: handler,
      ...support,
    },
    {
      action: ACTIONS.CUT,
      score: 0.45 * rating(handler, "playmaking") +
        0.55 * rating(support.cutter, "finishing") -
        0.55 * rating(directDefender(support.cutter, defense), "perimeterDefense") -
        0.25 * rimPressure + 60,
      beneficiary: support.cutter,
      ...support,
    },
    {
      action: ACTIONS.PICK_AND_POP,
      score: 0.5 * rating(handler, "playmaking") +
        0.35 * Math.max(
          rating(support.screener, "threePoint"), rating(support.screener, "midRange"),
        ) + 0.15 * rating(support.screener, "strength") -
        0.45 * perimeterPressure + 39,
      beneficiary: support.screener,
      ...support,
    },
    {
      action: ACTIONS.DRIBBLE_HANDOFF,
      score: 0.45 * rating(handler, "playmaking") +
        0.55 * Math.max(
          rating(support.receiver, "threePoint"), rating(support.receiver, "finishing"),
        ) - 0.55 * rating(directDefender(support.receiver, defense), "perimeterDefense") + 48,
      beneficiary: support.receiver,
      ...support,
    },
    {
      action: ACTIONS.OFF_BALL_SCREEN,
      score: 0.45 * rating(support.shooter, "threePoint") +
        0.25 * rating(support.screener, "strength") +
        0.3 * rating(handler, "playmaking") -
        0.5 * rating(directDefender(support.shooter, defense), "perimeterDefense") + 38,
      beneficiary: support.shooter,
      ...support,
    },
    {
      action: ACTIONS.RELOCATE,
      score: 0.55 * rating(support.shooter, "threePoint") +
        0.45 * rating(handler, "playmaking") -
        0.55 * rating(directDefender(support.shooter, defense), "perimeterDefense") + 39,
      beneficiary: support.shooter,
      ...support,
    },
    {
      action: ACTIONS.EXTRA_PASS,
      score: 0.4 * rating(handler, "playmaking") +
        0.25 * rating(support.connector, "playmaking") +
        0.35 * rating(support.shooter, "threePoint") -
        0.55 * rating(passPressure, "perimeterDefense") + 39,
      beneficiary: support.connector,
      ...support,
    },
    {
      action: ACTIONS.POST_KICK_OUT,
      score: 0.45 * rating(handler, "playmaking") +
        0.3 * rating(handler, "strength") +
        0.25 * rating(support.shooter, "threePoint") -
        0.45 * rating(primary, "interiorDefense") + 37,
      beneficiary: support.shooter,
      ...support,
    },
    {
      action: ACTIONS.RESET_OFFENSE,
      score: 0.75 * rating(handler, "playmaking") +
        0.25 * Math.max(
          rating(support.receiver, "threePoint"), rating(support.receiver, "finishing"),
        ) - 2,
      beneficiary: support.receiver,
      ...support,
    },
  ];
}

function selectAction({
  handler,
  offense,
  defense,
  phase,
  phasePlayer,
  strategy,
  history,
  random,
  config,
}) {
  const options = baseActionOptions(handler, offense, defense, phase, phasePlayer)
    .map((option) => {
      const traits = resolveBattleTraitModifiers("ACTION_SELECTION", {
        action: option.action,
        phase,
        offense,
        defense,
        handler,
        beneficiary: option.beneficiary,
      });
      const strategyMultiplier = getStrategyActionMultiplier(strategy, option.action);
      const tendencyMultiplier = getTendencyActionMultiplier({
        handlerProfile: getPlayerTendency(strategy, handler.cardInstanceId),
        beneficiaryProfile: getPlayerTendency(
          strategy,
          option.beneficiary?.cardInstanceId,
        ),
        action: option.action,
        handlerIsBeneficiary: option.beneficiary === handler,
      });
      const repeated = repetitionMultiplier(history, option.action, config);
      return {
        ...option,
        selectionTraits: traits,
        weight: softmaxWeight(option.score + traits.scoreDelta, config) *
          traits.weightMultiplier * strategyMultiplier * tendencyMultiplier * repeated,
      };
    });
  return weightedChoice(options, (option) => option.weight, random);
}

function selectCoverage(strategy, action, random) {
  const weights = coverageWeightsFor(strategy, action);
  return weightedChoice(
    Object.entries(weights).map(([coverage, weight]) => ({ coverage, weight })),
    (entry) => entry.weight,
    random,
  ).coverage;
}

function preferredShotType(
  player,
  allowed = ["THREE_POINT", "MID_RANGE", "FINISHING"],
  strategy = null,
) {
  const stat = { THREE_POINT: "threePoint", MID_RANGE: "midRange", FINISHING: "finishing" };
  const preference = {
    THREE_POINT: strategy?.offense === "PACE_SPACE" ? 8 : 0,
    MID_RANGE: strategy?.offense === "ISO_CREATOR" ? 3 : 0,
    FINISHING: ["RIM_PRESSURE", "POST_HUB", "TRANSITION"].includes(strategy?.offense)
      ? 7
      : 0,
  };
  return [...allowed].sort((left, right) =>
    rating(player, stat[right]) + preference[right] -
      rating(player, stat[left]) - preference[left]
  )[0];
}

function planForShot(shooter, defender, assister, shotType, extra = {}) {
  return {
    shooter,
    defender,
    assister,
    shotType,
    points: shotType === "THREE_POINT" ? 3 : 2,
    catchAndShoot: false,
    deepRange: false,
    contact: shotType === "FINISHING",
    ...extra,
  };
}

function applyCoverageDefender(plan, option, handler, defense, coverage) {
  const primary = directDefender(handler, defense);
  const helper = strongest(
    defense,
    (player) => rating(player, "interiorDefense") + rating(player, "height"),
  );
  if (coverage === "SWITCH" && SCREEN_ACTIONS.has(option.action)) {
    plan.defender = plan.shooter === option.screener
      ? primary
      : directDefender(option.screener, defense);
  } else if (plan.shotType === "FINISHING" &&
      ["DROP", "HELP_RIM", "PACK_PAINT", "DOUBLE_POST"].includes(coverage)) {
    plan.defender = helper;
  }
  return { plan, primary, helper };
}

function resolveShotPlan(
  option,
  handler,
  offense,
  defense,
  phasePlayer,
  coverage,
  strategy,
  random,
) {
  const primary = directDefender(handler, defense);
  const help = strongest(
    defense,
    (player) => rating(player, "interiorDefense") + rating(player, "height"),
  );
  let plan;
  if (option.action === ACTIONS.DRIVE_AND_KICK || option.action === ACTIONS.POST_KICK_OUT) {
    plan = planForShot(
      option.shooter,
      directDefender(option.shooter, defense),
      handler,
      "THREE_POINT",
      { catchAndShoot: true },
    );
  } else if (option.action === ACTIONS.PICK_AND_ROLL) {
    const roll = random();
    if (roll < 0.45) {
      plan = planForShot(option.screener, help, handler, "FINISHING", { contact: true });
    } else if (roll < 0.70) {
      plan = planForShot(handler, primary, null, "THREE_POINT");
    } else {
      plan = planForShot(handler, help, null, "FINISHING", { contact: true });
    }
  } else if (option.action === ACTIONS.PICK_AND_POP) {
    const shotType = preferredShotType(
      option.screener,
      ["THREE_POINT", "MID_RANGE"],
      strategy,
    );
    plan = planForShot(
      option.screener,
      directDefender(option.screener, defense),
      handler,
      shotType,
      { catchAndShoot: true },
    );
  } else if (option.action === ACTIONS.CUT) {
    plan = planForShot(option.cutter, help, handler, "FINISHING", { contact: true });
  } else if (option.action === ACTIONS.DRIBBLE_HANDOFF) {
    const shotType = preferredShotType(
      option.receiver,
      ["THREE_POINT", "FINISHING"],
      strategy,
    );
    plan = planForShot(
      option.receiver,
      directDefender(option.receiver, defense),
      handler,
      shotType,
      { catchAndShoot: shotType === "THREE_POINT" },
    );
  } else if ([ACTIONS.OFF_BALL_SCREEN, ACTIONS.RELOCATE].includes(option.action)) {
    const shotType = preferredShotType(
      option.shooter,
      ["THREE_POINT", "MID_RANGE"],
      strategy,
    );
    plan = planForShot(
      option.shooter,
      directDefender(option.shooter, defense),
      handler,
      shotType,
      { catchAndShoot: true },
    );
  } else if (option.action === ACTIONS.EXTRA_PASS) {
    plan = planForShot(
      option.shooter,
      directDefender(option.shooter, defense),
      option.connector,
      "THREE_POINT",
      { catchAndShoot: true },
    );
  } else if (option.action === ACTIONS.PASS) {
    const shotType = preferredShotType(option.receiver, undefined, strategy);
    plan = planForShot(
      option.receiver,
      shotType === "FINISHING" ? help : directDefender(option.receiver, defense),
      handler,
      shotType,
      { catchAndShoot: shotType !== "FINISHING" },
    );
  } else if (option.action === ACTIONS.CREATE_SEPARATION) {
    const shotType = preferredShotType(handler, undefined, strategy);
    plan = planForShot(handler, shotType === "FINISHING" ? help : primary, null, shotType);
  } else if (option.action === ACTIONS.FAST_BREAK) {
    const shooter = option.beneficiary;
    const takeThree = rating(shooter, "threePoint") > rating(shooter, "finishing") + 5 && random() < 0.3;
    plan = planForShot(
      shooter,
      takeThree ? directDefender(shooter, defense) : help,
      shooter === handler ? null : handler,
      takeThree ? "THREE_POINT" : "FINISHING",
      { catchAndShoot: takeThree, contact: !takeThree && random() < 0.45 },
    );
  } else if (option.action === ACTIONS.SECOND_CHANCE) {
    const rebounder = phasePlayer ?? option.rebounder ?? handler;
    if (random() < 0.68) {
      plan = planForShot(rebounder, help, null, "FINISHING", { contact: true });
    } else {
      plan = planForShot(
        option.shooter,
        directDefender(option.shooter, defense),
        rebounder,
        "THREE_POINT",
        { catchAndShoot: true },
      );
    }
  } else if (option.action === ACTIONS.RESET_OFFENSE) {
    const shooter = bestScorer(offense);
    const shotType = preferredShotType(shooter, undefined, strategy);
    plan = planForShot(
      shooter,
      shotType === "FINISHING" ? help : directDefender(shooter, defense),
      shooter === handler ? null : handler,
      shotType,
      { catchAndShoot: shooter !== handler && shotType !== "FINISHING" },
    );
  } else if (option.action === ACTIONS.THREE_POINT) {
    plan = planForShot(handler, primary, null, "THREE_POINT", {
      deepRange: random() < 0.22,
    });
  } else if (option.action === ACTIONS.MID_RANGE) {
    plan = planForShot(handler, primary, null, "MID_RANGE");
  } else {
    plan = planForShot(
      handler,
      option.action === ACTIONS.DRIVE ? help : primary,
      null,
      "FINISHING",
      { contact: random() < 0.75 },
    );
  }
  return applyCoverageDefender(plan, option, handler, defense, coverage);
}

function terminalShotAction(plan) {
  if (plan.shotType === "THREE_POINT") return ACTIONS.THREE_POINT;
  if (plan.shotType === "MID_RANGE") return ACTIONS.MID_RANGE;
  return ACTIONS.DRIVE;
}

function rawStep(action, actor, receiver = null, screener = null, defender = null) {
  return { action, actor, receiver, screener, defender };
}

function buildActionChain(option, handler, plan, coverageState, config) {
  const steps = [];
  const add = (action, actor, receiver, screener, defender = coverageState.primary) => {
    steps.push(rawStep(action, actor, receiver, screener, defender));
  };
  const shotAction = terminalShotAction(plan);
  if (option.action === ACTIONS.DRIVE_AND_KICK) {
    add(ACTIONS.DRIVE, handler, null, null);
    add(ACTIONS.DRIVE_AND_KICK, handler, plan.shooter, null);
  } else if (option.action === ACTIONS.POST_KICK_OUT) {
    add(ACTIONS.POST_UP, handler, null, null);
    add(ACTIONS.POST_KICK_OUT, handler, plan.shooter, null);
  } else if (option.action === ACTIONS.PICK_AND_ROLL) {
    add(ACTIONS.PICK_AND_ROLL, handler, option.screener, option.screener);
    if (plan.assister) add(ACTIONS.PASS, plan.assister, plan.shooter, option.screener);
  } else if (option.action === ACTIONS.PICK_AND_POP) {
    add(ACTIONS.PICK_AND_POP, handler, option.screener, option.screener);
    add(ACTIONS.PASS, handler, plan.shooter, option.screener);
  } else if (option.action === ACTIONS.CUT) {
    add(ACTIONS.CUT, plan.shooter, null, null, directDefender(plan.shooter, [coverageState.primary, coverageState.helper]));
    add(ACTIONS.PASS, handler, plan.shooter, null);
  } else if (option.action === ACTIONS.DRIBBLE_HANDOFF) {
    add(ACTIONS.DRIBBLE_HANDOFF, handler, plan.shooter, option.screener);
  } else if (option.action === ACTIONS.OFF_BALL_SCREEN) {
    add(ACTIONS.OFF_BALL_SCREEN, plan.shooter, null, option.screener);
    add(ACTIONS.PASS, handler, plan.shooter, option.screener);
  } else if (option.action === ACTIONS.RELOCATE) {
    add(ACTIONS.RELOCATE, plan.shooter, null, null);
    add(ACTIONS.PASS, handler, plan.shooter, null);
  } else if (option.action === ACTIONS.EXTRA_PASS) {
    add(ACTIONS.PASS, handler, option.connector, null);
    add(ACTIONS.EXTRA_PASS, option.connector, plan.shooter, null);
  } else if (option.action === ACTIONS.PASS) {
    add(ACTIONS.PASS, handler, plan.shooter, null);
  } else if (option.action === ACTIONS.CREATE_SEPARATION) {
    add(ACTIONS.CREATE_SEPARATION, handler, null, null);
  } else if (option.action === ACTIONS.FAST_BREAK) {
    add(ACTIONS.FAST_BREAK, handler, plan.shooter, null);
    if (plan.assister) add(ACTIONS.PASS, plan.assister, plan.shooter, null);
  } else if (option.action === ACTIONS.SECOND_CHANCE) {
    add(ACTIONS.SECOND_CHANCE, option.rebounder ?? plan.shooter, plan.shooter, null);
    if (plan.assister) add(ACTIONS.PASS, plan.assister, plan.shooter, null);
  } else if (option.action === ACTIONS.RESET_OFFENSE) {
    add(ACTIONS.RESET_OFFENSE, handler, plan.shooter, null);
    if (plan.assister) add(ACTIONS.PASS, plan.assister, plan.shooter, null);
  } else {
    add(option.action, handler, plan.shooter, option.screener);
  }
  if (steps.at(-1)?.action !== shotAction) {
    add(shotAction, plan.shooter, null, null, plan.defender);
  }

  const maximum = Math.max(2, config.maximumActionChainLength ?? 5);
  const bounded = steps.length > maximum
    ? [...steps.slice(0, maximum - 1), steps.at(-1)]
    : steps;
  return Object.freeze(bounded.map((step, index) => Object.freeze({
    sequence: index + 1,
    action: step.action,
    actor: eventPlayer(step.actor),
    receiver: eventPlayer(step.receiver),
    screener: eventPlayer(step.screener),
    defender: eventPlayer(step.defender),
  })));
}

function prependRestartAction(actionChain, restart, config) {
  if (!restart) return actionChain;
  const restartStep = {
    action: restart.action,
    actor: eventPlayer(restart.actor),
    receiver: eventPlayer(restart.receiver),
    screener: null,
    defender: eventPlayer(restart.defender),
  };
  const maximum = Math.max(2, config.maximumActionChainLength ?? 5);
  const combined = [restartStep, ...actionChain];
  const bounded = combined.length > maximum
    ? [restartStep, ...combined.slice(1, maximum - 1), combined.at(-1)]
    : combined;
  return Object.freeze(bounded.map((step, index) => Object.freeze({
    ...step,
    sequence: index + 1,
  })));
}

function coverageCreationDelta(coverage, option, plan) {
  const rim = plan.shotType === "FINISHING";
  const perimeter = plan.shotType === "THREE_POINT";
  if (coverage === "SWITCH") return SCREEN_ACTIONS.has(option.action) ? -3 : 0;
  if (coverage === "DROP") return rim ? -6 : perimeter ? 6 : 4;
  if (coverage === "BLITZ") return plan.assister ? 7 : -5;
  if (coverage === "GO_UNDER") return rim ? -5 : perimeter ? 6 : 2;
  if (coverage === "STAY_HOME") return plan.assister ? -4 : rim ? 4 : 0;
  if (coverage === "HELP_RIM") return rim ? -6 : plan.assister ? 6 : 0;
  if (coverage === "DOUBLE_POST") return option.action === ACTIONS.POST_UP
    ? -7
    : option.action === ACTIONS.POST_KICK_OUT ? 7 : 0;
  if (coverage === "FIGHT_OVER") return SCREEN_ACTIONS.has(option.action) ? -3 : 0;
  if (coverage === "HEDGE") return plan.assister ? 4 : -4;
  if (coverage === "ROTATE") return plan.assister ? -2 : rim ? -3 : 0;
  if (coverage === "RECOVER") return perimeter ? -3 : 0;
  return 0;
}

function mismatchCreationDelta(plan, coverageState, defensiveTraits) {
  if (coverageState.coverage !== "SWITCH") return 0;
  const rawMismatch = Math.max(
    0,
    (rating(plan.shooter, "strength") + rating(plan.shooter, "height") -
      rating(plan.defender, "strength") - rating(plan.defender, "height")) / 5,
  );
  return Math.max(0, rawMismatch - defensiveTraits.mismatchPenaltyReduction);
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

function legacyTraitModifier(resolveTraitModifier, stage, context) {
  const value = resolveTraitModifier?.(stage, context) ?? 0;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError("Legacy Trait modifier must be a finite number.");
  }
  return clamp(value, -0.25, 0.25);
}

function shotCreationScore(plan, action, random) {
  let offense;
  let defense;
  if (plan.shotType === "THREE_POINT") {
    offense = 0.6 * rating(plan.shooter, "playmaking") +
      0.4 * rating(plan.shooter, "threePoint");
    defense = rating(plan.defender, "perimeterDefense");
  } else if (plan.shotType === "MID_RANGE") {
    offense = 0.55 * rating(plan.shooter, "playmaking") +
      0.45 * rating(plan.shooter, "midRange");
    defense = 0.85 * rating(plan.defender, "perimeterDefense") +
      0.15 * rating(plan.defender, "interiorDefense");
  } else {
    offense = 0.5 * rating(plan.shooter, "finishing") +
      0.3 * rating(plan.shooter, "strength") +
      0.2 * rating(plan.shooter, "height");
    defense = 0.55 * rating(plan.defender, "interiorDefense") +
      0.25 * rating(plan.defender, "strength") +
      0.2 * rating(plan.defender, "height");
  }
  const actionBonus = {
    [ACTIONS.DRIVE_AND_KICK]: 6,
    [ACTIONS.CUT]: 4,
    [ACTIONS.FAST_BREAK]: 8,
    [ACTIONS.CREATE_SEPARATION]: 4,
    [ACTIONS.SECOND_CHANCE]: -2,
  }[action] ?? 0;
  const contactPenalty = plan.contact ? -3 : 0;
  const distancePenalty = plan.deepRange ? -6 : 0;
  return offense - defense + actionBonus + contactPenalty + distancePenalty +
    (random() * 24 - 12);
}

function shotProbability(
  plan,
  quality,
  config,
  resolveTraitModifier,
  traitProbabilityDelta = 0,
) {
  let probability;
  if (plan.shotType === "THREE_POINT") {
    probability = config.threePointBaseProbability +
      config.ratingProbabilityScale * (rating(plan.shooter, "threePoint") - 75) +
      qualityModifier(quality, config);
  } else if (plan.shotType === "MID_RANGE") {
    probability = config.midRangeBaseProbability +
      config.ratingProbabilityScale * (rating(plan.shooter, "midRange") - 75) +
      qualityModifier(quality, config);
  } else {
    const finishScore = rating(plan.shooter, "finishing") +
      0.25 * (rating(plan.shooter, "strength") - 75) +
      0.2 * (rating(plan.shooter, "height") - 75);
    const rimDefense = rating(plan.defender, "interiorDefense") +
      0.2 * (rating(plan.defender, "strength") - 75) +
      0.2 * (rating(plan.defender, "height") - 75);
    probability = config.finishingBaseProbability +
      config.ratingProbabilityScale * (finishScore - rimDefense) +
      qualityModifier(quality, config) * 0.5;
  }
  probability += legacyTraitModifier(resolveTraitModifier, "SHOT_MAKE", {
    shooter: plan.shooter,
    defender: plan.defender,
    shotType: plan.shotType,
    quality,
  });
  probability += traitProbabilityDelta;
  return clamp(probability, config.minimumShotProbability, config.maximumShotProbability);
}

function situationalState(scores, actingTeam, targetScore) {
  const defenseTeam = actingTeam === 1 ? 2 : 1;
  const offenseScore = scores[actingTeam];
  const defenseScore = scores[defenseTeam];
  return Object.freeze({
    offenseScore,
    defenseScore,
    scoreMargin: offenseScore - defenseScore,
    isClutch: Math.max(offenseScore, defenseScore) >= targetScore - 4 &&
      Math.abs(offenseScore - defenseScore) <= 4,
    isComeback: defenseScore - offenseScore >= 6,
  });
}

const EMPTY_MOMENTUM = Object.freeze({ slot: null, streak: 0 });

function scoringStreakFor(momentum, player) {
  return momentum.slot === player.slot ? momentum.streak : 0;
}

function recordScoringPossession(momentum, player) {
  return Object.freeze({
    slot: player.slot,
    streak: momentum.slot === player.slot ? momentum.streak + 1 : 1,
  });
}

function reboundScore(player) {
  return 0.55 * rating(player, "height") +
    0.35 * rating(player, "strength") +
    0.1 * rating(player, "interiorDefense");
}

function reboundCandidate(player) {
  const traits = resolveBattleTraitModifiers("REBOUND", { rebounder: player });
  return {
    player,
    traits,
    score: reboundScore(player) + traits.probabilityDelta * 100,
  };
}

function resolveRebound(
  offense,
  defense,
  offenseStrategy,
  random,
  config,
  resolveTraitModifier,
) {
  const offensiveCandidates = offense.map(reboundCandidate);
  const defensiveCandidates = defense.map(reboundCandidate);
  const offenseAverage = offensiveCandidates.reduce((sum, entry) => sum + entry.score, 0) /
    offensiveCandidates.length;
  const defenseAverage = defensiveCandidates.reduce((sum, entry) => sum + entry.score, 0) /
    defensiveCandidates.length;
  let offensiveProbability = config.offensiveReboundBaseProbability +
    0.003 * (offenseAverage - defenseAverage) +
    getStrategyOffensiveReboundDelta(offenseStrategy);
  offensiveProbability += legacyTraitModifier(resolveTraitModifier, "REBOUND", {
    offense,
    defense,
  });
  const offensive = random() < clamp(offensiveProbability, 0.10, 0.44);
  const candidates = offensive ? offensiveCandidates : defensiveCandidates;
  const selected = weightedChoice(candidates, (candidate) => candidate.score, random);
  selected.player.rebounds += 1;
  return {
    offensive,
    rebounder: selected.player,
    traitActivations: selected.traits.activations,
  };
}

function turnoverType(action) {
  if (PASS_ACTIONS.has(action)) return "PASS";
  if ([ACTIONS.POST_UP, ACTIONS.POST_KICK_OUT].includes(action)) return "POST";
  return "HANDLE";
}

function resolvePossessionPhase(
  pending,
  offense,
  offenseStrategy,
  defenseStrategy,
  random,
  config,
) {
  if (pending.phase === PHASES.SECOND_CHANCE) {
    const traits = resolveBattleTraitModifiers("POSSESSION_TRANSITION", {
      action: ACTIONS.SECOND_CHANCE,
      offense,
      rebounder: pending.player,
    });
    return { phase: PHASES.SECOND_CHANCE, player: pending.player, traits };
  }
  if (pending.phase !== PHASES.TRANSITION) {
    return { phase: PHASES.HALF_COURT, player: null, traits: null };
  }
  const traits = resolveBattleTraitModifiers("POSSESSION_TRANSITION", {
    action: ACTIONS.FAST_BREAK,
    offense,
  });
  const probability = (config.fastBreakBaseProbability ?? 0.48) +
    getStrategyFastBreakDelta(offenseStrategy, defenseStrategy) +
    traits.probabilityDelta;
  if (random() < clamp(probability, 0.12, 0.82)) {
    return { phase: PHASES.TRANSITION, player: pending.player, traits };
  }
  return { phase: PHASES.HALF_COURT, player: null, traits: null };
}

function frozenPlayer(player) {
  return Object.freeze({ ...player });
}

function eventDescription({ action, handler, plan, made, quality, blocked, rebound }) {
  if (action === "TURNOVER") return `${handler.cardName} turns the ball over.`;
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
  playerStrategy,
  aiStrategy,
  seed,
  config,
  resolveTraitModifier = () => 0,
}) {
  const random = createSeededRandom(seed);
  const strategies = {
    1: resolveBattleStrategy(playerStrategy),
    2: resolveBattleStrategy(aiStrategy),
  };
  const teams = {
    1: playerTeam.map(boxPlayer),
    2: aiTeam.map(boxPlayer),
  };
  const scores = { 1: 0, 2: 0 };
  const events = [];
  const actionHistory = { 1: [], 2: [] };
  const scoringMomentum = { 1: EMPTY_MOMENTUM, 2: EMPTY_MOMENTUM };
  const opening = resolveTipOff(teams, strategies, random);
  let offenseTeam = opening.offenseTeam;
  let pending = {
    phase: PHASES.HALF_COURT,
    player: null,
    restart: opening.restart,
  };
  let possessionCount = 0;

  while (
    scores[1] < config.targetScore &&
    scores[2] < config.targetScore &&
    possessionCount < config.maximumPossessions
  ) {
    possessionCount += 1;
    const actingTeam = offenseTeam;
    const defenseTeam = actingTeam === 1 ? 2 : 1;
    const offense = teams[actingTeam];
    const defense = teams[defenseTeam];
    const strategy = strategies[actingTeam];
    const defenseStrategy = strategies[defenseTeam];
    const situation = situationalState(scores, actingTeam, config.targetScore);
    const phaseState = resolvePossessionPhase(
      pending,
      offense,
      strategy,
      defenseStrategy,
      random,
      config,
    );
    const handler = pending.restart?.receiver ??
      (phaseState.phase === PHASES.SECOND_CHANCE && phaseState.player
        ? phaseState.player
        : selectInitiator(offense, random));
    const primary = directDefender(handler, defense);
    const option = selectAction({
      handler,
      offense,
      defense,
      phase: phaseState.phase,
      phasePlayer: phaseState.player,
      strategy,
      history: actionHistory[actingTeam],
      random,
      config,
    });
    actionHistory[actingTeam].push(option.action);
    if (actionHistory[actingTeam].length > (config.actionHistoryLimit ?? 6)) {
      actionHistory[actingTeam].shift();
    }

    const coverage = selectCoverage(defenseStrategy, option.action, random);
    const coverageState = resolveShotPlan(
      option,
      handler,
      offense,
      defense,
      phaseState.player,
      coverage,
      strategy,
      random,
    );
    coverageState.coverage = coverage;
    const plan = coverageState.plan;
    const actionChain = prependRestartAction(
      buildActionChain(option, handler, plan, coverageState, config),
      pending.restart,
      config,
    );
    const advantageTraits = resolveBattleTraitModifiers("ADVANTAGE_CREATION", {
      action: option.action,
      phase: phaseState.phase,
      offense,
      defense,
      handler,
      beneficiary: option.beneficiary,
      screener: option.screener,
      defender: primary,
    });
    const defensiveTraits = resolveBattleTraitModifiers("DEFENSIVE_RESPONSE", {
      action: option.action,
      coverage,
      defender: plan.defender,
      onBallDefender: primary,
      screener: option.screener,
    });
    const passTraits = plan.assister
      ? resolveBattleTraitModifiers("PASS_RESOLUTION", {
          action: option.action,
          passer: plan.assister,
          receiver: plan.shooter,
          difficultPass: option.action !== ACTIONS.PASS,
        })
      : resolveBattleTraitModifiers("PASS_RESOLUTION", {});
    const type = turnoverType(option.action);
    const turnoverDefender = type === "PASS"
      ? strongest(defense, (player) => rating(player, "perimeterDefense"))
      : primary;
    const turnoverTraits = resolveBattleTraitModifiers("TURNOVER", {
      action: option.action,
      phase: phaseState.phase,
      turnoverType: type,
      offense,
      handler,
      defender: turnoverDefender,
      isClutch: situation.isClutch,
    });
    let turnoverProbability = config.turnoverBaseProbability +
      config.turnoverRatingScale *
        (rating(primary, "perimeterDefense") - rating(handler, "playmaking")) +
      getStrategyTurnoverDelta(strategy, phaseState.phase) +
      turnoverTraits.probabilityDelta - passTraits.probabilityDelta;
    if (coverage === "BLITZ") turnoverProbability += 0.025;
    turnoverProbability += legacyTraitModifier(resolveTraitModifier, "TURNOVER", {
      handler,
      defender: turnoverDefender,
      action: option.action,
      turnoverType: type,
    });

    if (random() < clamp(
      turnoverProbability,
      config.minimumTurnoverProbability ?? 0.03,
      config.maximumTurnoverProbability ?? 0.20,
    )) {
      handler.turnovers += 1;
      scoringMomentum[actingTeam] = EMPTY_MOMENTUM;
      const stealBy = random() < 0.75 ? turnoverDefender : null;
      if (stealBy) stealBy.steals += 1;
      const traitActivations = uniqueActivations(
        option.selectionTraits.activations,
        phaseState.traits?.activations ?? [],
        advantageTraits.activations,
        defensiveTraits.activations,
        passTraits.activations,
        turnoverTraits.activations,
      );
      events.push(Object.freeze({
        sequence: events.length + 1,
        possession: possessionCount,
        offenseTeam: actingTeam,
        phase: phaseState.phase,
        coverage,
        action: "TURNOVER",
        attemptedAction: option.action,
        actionChain,
        traitActivations,
        situation,
        result: "TURNOVER",
        handler: eventPlayer(handler),
        primaryDefender: eventPlayer(primary),
        stealBy: eventPlayer(stealBy),
        score: Object.freeze({ ...scores }),
        description: eventDescription({ action: "TURNOVER", handler }),
      }));
      offenseTeam = defenseTeam;
      pending = {
        phase: stealBy ? PHASES.TRANSITION : PHASES.HALF_COURT,
        player: stealBy,
      };
      continue;
    }

    const rimTraits = resolveBattleTraitModifiers("RIM_DEFENSE", {
      action: option.action,
      shotType: plan.shotType,
      shooter: plan.shooter,
      defender: plan.defender,
      helper: coverageState.helper,
    });
    let creationScore = shotCreationScore(plan, option.action, random) +
      coverageCreationDelta(coverage, option, plan) +
      mismatchCreationDelta(plan, coverageState, defensiveTraits) +
      advantageTraits.scoreDelta + defensiveTraits.scoreDelta + rimTraits.scoreDelta;
    let quality = qualityFromScore(creationScore);
    const qualityTraits = resolveBattleTraitModifiers("SHOT_QUALITY", {
      action: option.action,
      shotType: plan.shotType,
      shotQuality: quality,
      shooter: plan.shooter,
      defender: plan.defender,
      catchAndShoot: plan.catchAndShoot,
      deepRange: plan.deepRange,
      contact: plan.contact,
    });
    creationScore += qualityTraits.qualityDelta;
    quality = qualityFromScore(creationScore);
    const scoringStreak = scoringStreakFor(scoringMomentum[actingTeam], plan.shooter);
    const isGameWinningAttempt = scores[actingTeam] + plan.points >= config.targetScore;
    const shotMakeTraits = resolveBattleTraitModifiers("SHOT_MAKE", {
      action: option.action,
      shotType: plan.shotType,
      shotQuality: quality,
      shooter: plan.shooter,
      defender: plan.defender,
      contact: plan.contact,
      isClutch: situation.isClutch,
      isComeback: situation.isComeback,
      scoringStreak,
      isGameWinningAttempt,
    });
    const probability = shotProbability(
      plan,
      quality,
      config,
      resolveTraitModifier,
      shotMakeTraits.probabilityDelta,
    );
    plan.shooter.fieldGoalsAttempted += 1;
    if (plan.shotType === "THREE_POINT") plan.shooter.threePointersAttempted += 1;
    const made = random() < probability;
    let blocked = false;
    let rebound = null;

    if (made) {
      scoringMomentum[actingTeam] = recordScoringPossession(
        scoringMomentum[actingTeam],
        plan.shooter,
      );
      plan.shooter.fieldGoalsMade += 1;
      plan.shooter.points += plan.points;
      if (plan.shotType === "THREE_POINT") plan.shooter.threePointersMade += 1;
      if (plan.assister && plan.assister !== plan.shooter) plan.assister.assists += 1;
      scores[actingTeam] += plan.points;
      offenseTeam = defenseTeam;
      const receiver = mainHandler(teams[defenseTeam], strategies[defenseTeam]);
      pending = {
        phase: PHASES.HALF_COURT,
        player: null,
        restart: {
          action: ACTIONS.CHECK_IN,
          actor: inbounder(teams[defenseTeam], receiver),
          receiver,
          defender: null,
        },
      };
    } else {
      scoringMomentum[actingTeam] = EMPTY_MOMENTUM;
      if (plan.shotType === "FINISHING") {
        const blockProbability = clamp(
          0.03 + 0.002 *
            (rating(plan.defender, "interiorDefense") + rating(plan.defender, "height") -
              rating(plan.shooter, "finishing") - 75) +
            rimTraits.blockProbabilityDelta,
          0.01,
          0.22,
        );
        blocked = random() < blockProbability;
        if (blocked) plan.defender.blocks += 1;
      }
      rebound = resolveRebound(
        offense,
        defense,
        strategy,
        random,
        config,
        resolveTraitModifier,
      );
      if (rebound.offensive) {
        pending = { phase: PHASES.SECOND_CHANCE, player: rebound.rebounder };
      } else {
        offenseTeam = defenseTeam;
        pending = { phase: PHASES.TRANSITION, player: rebound.rebounder };
      }
    }

    const traitActivations = uniqueActivations(
      option.selectionTraits.activations,
      phaseState.traits?.activations ?? [],
      advantageTraits.activations,
      defensiveTraits.activations,
      passTraits.activations,
      turnoverTraits.activations,
      rimTraits.activations,
      qualityTraits.activations,
      shotMakeTraits.activations,
      rebound?.traitActivations ?? [],
    );
    events.push(Object.freeze({
      sequence: events.length + 1,
      possession: possessionCount,
      offenseTeam: actingTeam,
      phase: phaseState.phase,
      coverage,
      action: option.action,
      actionChain,
      traitActivations,
      shotType: plan.shotType,
      shotQuality: quality,
      shotProbability: probability,
      situation: Object.freeze({
        ...situation,
        scoringStreak,
        isGameWinningAttempt,
      }),
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
        action: option.action,
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
    strategyResolverVersion: BATTLE_STRATEGY_RESOLVER_VERSION,
    traitResolverVersion: BATTLE_TRAIT_RESOLVER_VERSION,
    tendencyResolverVersion: BATTLE_TENDENCY_RESOLVER_VERSION,
    playerStrategy: strategies[1],
    aiStrategy: strategies[2],
    winnerTeam: scores[1] >= config.targetScore ? 1 : 2,
    playerScore: scores[1],
    aiScore: scores[2],
    possessionCount,
    playByPlay: Object.freeze(events),
    playerTeam: Object.freeze(teams[1].map(frozenPlayer)),
    aiTeam: Object.freeze(teams[2].map(frozenPlayer)),
  });
}

export { ACTIONS, PHASES, QUALITY_ORDER };
