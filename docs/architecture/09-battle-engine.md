# 09 — Battle Engine

## Status

This document defines the implemented Battle Engine v2 playtest architecture.
Migration 022 replaces the transitional M12 aggregate-score runtime with the
deterministic possession model below.

The design is accepted because it keeps lineup construction, basketball
matchups, action selection, and controlled randomness meaningful without
requiring Traits in the first version. It also provides explicit extension
points for Traits later.

## Match Contract

```text
5 vs 5: PG / SG / SF / PF / C
First team to reach at least 21 points wins
3PT = 3 points
Mid Range / Finish = 2 points
No bench, fatigue, substitutions, free throws, tactics, rewards, or active
Trait effects in v2
```

A Card may occupy its primary or secondary position. Invalid positions are not
allowed; v0.1 does not apply an out-of-position penalty.

## Battle Inputs

The target engine consumes an immutable snapshot containing:

```text
positions
three_point
mid_range
finishing
playmaking
interior_defense
perimeter_defense
strength
height_cm
Card Level modifier
seed
engine_version
ruleset_version
```

Battle v2 derives rebounding from height, strength, and interior defense
instead of requiring displayed Rebounding or Athleticism ratings.

## Possession Pipeline

```text
Start possession
→ identify initiator and legal actions
→ evaluate direct and help matchups
→ estimate action value
→ select an action with weighted randomness
→ resolve turnover / shot creation
→ classify shot quality
→ resolve shot make or miss
→ resolve rebound after a miss
→ update score, box score, and play-by-play events
→ continue until one team reaches at least 21
```

Shot creation and shot making are separate calculations. The shot-quality
states are `OPEN`, `LIGHTLY_CONTESTED`, `CONTESTED`, and
`HEAVILY_CONTESTED`.

## MVP Actions

The v2 runtime supports:

```text
THREE_POINT
MID_RANGE
DRIVE
POST_UP
PICK_AND_ROLL
DRIVE_AND_KICK
```

All six actions, turnovers, rebounds, shot quality, box scores, and ordered
play-by-play are implemented. Trait data remains snapshotted, but configured
Trait effects wait for approved coefficients.

Different narration may represent the same underlying action. Presentation
variation must not create additional simulation rules.

## Provisional Probability Models

All coefficients are configuration, not hard-coded production truth.

```text
P(3PT) = 0.34 + 0.004 × (three_point - 75) + quality_modifier
P(mid) = 0.42 + 0.004 × (mid_range - 75) + quality_modifier

quality_modifier:
OPEN               +0.08
LIGHTLY_CONTESTED  +0.02
CONTESTED          -0.06
HEAVILY_CONTESTED  -0.13

drive_creation = 0.55 × playmaking
               + 0.45 × finishing
               - primary_defender.perimeter_defense

P(finish) = clamp(
  0.60 + 0.004 × (finish_score - rim_defense),
  0.35,
  0.85
)

P(turnover) = clamp(
  0.08 + 0.0025 ×
    (defender.perimeter_defense - ball_handler.playmaking),
  0.03,
  0.18
)
```

Height and strength bonuses require normalization before use; raw centimeters
must never be added directly to a 0–99 rating. Post-up compares finishing,
strength, and normalized height against interior defense, strength, and
normalized height.

The hidden rebound score begins from:

```text
0.55 × normalized_height
+ 0.35 × strength
+ 0.10 × interior_defense
```

The starting team baseline is approximately 72% defensive rebounds and 28%
offensive rebounds, adjusted by both lineups. These values remain provisional.

## Action Selection

For each possession, the engine estimates expected points for several actions.
It favors stronger choices without always selecting the maximum. A seeded
softmax or equivalent weighted selection is preferred.

Playmaking affects initiation, passing, turnover avoidance, and how often the
engine recognizes the best matchup. Rarity is not a direct combat multiplier;
the frozen card stats and modifiers drive the simulation.

## Trait Extension Points

Traits later modify a narrow stage of the existing pipeline rather than
replacing the engine. Supported hook contexts should include:

```text
ACTION_SELECTION
SHOT_CREATION
SHOT_QUALITY
SHOT_MAKE
DRIVE_CREATION
TURNOVER
RIM_DEFENSE
REBOUND
AFTER_POSSESSION
```

The resolver receives the action context and only evaluates relevant Trait
snapshots. It returns bounded modifiers; it does not mutate Card Template data.

## Determinism and Versioning

The simulation core is a pure function over a frozen match snapshot and a
seed. The same snapshot, seed, `engine_version`, `ruleset_version`, and config
version must produce the same result.

Historical Match records retain frozen lineup and Battle configuration input
snapshots, play-by-play, engine, ruleset, and config versions. Later
rating edits must not rewrite historical results.

## Persistence Boundary

```text
short transaction: validate and snapshot match inputs
→ pure simulation outside the database transaction
→ short transaction: persist result, counters, and idempotent reward
```

The production service does not hold database locks while simulating. Discord rendering is
outside the engine and consumes the structured Match result.

## Match Output

Structured output should support:

```text
final score and winner
PTS / REB / AST / STL / BLK / TOV
FGM/FGA and 3PM/3PA
ordered play-by-play events
seed and version metadata
reward and streak references
```

Persist structured data; generate Discord embeds or images on demand. Do not
permanently store every rendered image.

## Balance Validation

Before production balance, run deterministic Monte Carlo suites with at least
tens of thousands of matches per representative lineup class. Measure win
rate, score margin, possessions, shooting splits, turnovers, rebounds, usage,
and action frequency. Reject a configuration when one action dominates or
height/strength produces excessive mismatches.

AI Challenge and future PvP use different opponent and balance policies. PvP
between comparable teams should approach 50/50; Standard AI Challenge may use
higher progression-oriented win rates. No winner is pre-rolled.

## Still TBD

Final coefficients, deeper help-defense rules, action-selection
temperature, opponent pools, reward coefficients/caps, Match history retention,
and PvP matchmaking remain playtest decisions. Trait effects, rewards, fatigue,
substitutions, bench, free throws, and coaching are outside Battle v2.
