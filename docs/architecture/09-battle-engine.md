# 09 — Battle Engine

## Status

This document records the Battle Engine v2 playtest baseline introduced by
migration 022. Engine v2 is retained here for historical rules and compatibility
context, but it is superseded by the implemented strategy-, action-, and
Trait-aware engine in [10-battle-strategy-and-meta.md](10-battle-strategy-and-meta.md).

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

## Matchup Assignment

Every lineup slot owns a primary one-to-one matchup:

```text
PG vs PG
SG vs SG
SF vs SF
PF vs PF
C  vs C
```

The primary matchup supplies the perimeter defender for ball pressure and
ordinary jump shots. Drives may bring the strongest interior help defender;
pick-and-roll may use that help defender against the roller; drive-and-kick
returns to the receiving shooter's positional defender. Post-up uses the
direct positional matchup. Each play-by-play event stores the handler, primary
defender, shooter, actual shot defender, assister, and rebounder when present.

## AI Matchup Selection

AI opponents are selected once when the Match snapshot is created. For each
PG/SG/SF/PF/C slot, the selector compares the seven Actual Stats of eligible
Card Templates with the Player Card occupying that slot. It builds a bounded
pool of the closest candidates and performs a seeded weighted roll that favors
smaller rating distance without always choosing the same Template.

The selected AI Card uses the opposing Player Card's Level. A single AI lineup
cannot repeat a Card Template or Player name. The Match seed makes selection
reproducible for idempotent retries, while different Matches normally receive
different opponents. Candidate-pool size and acceptable rating distance remain
centralized Battle configuration.

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

Template ratings are the Level 5 values. Before any Battle formula is applied,
the engine derives each runtime rating with:

```text
Actual Stat = Template Stat - (5 - Card Level)
```

This calculation is shared with Lineup presentation and Collection stat sorting;
derived ratings are not stored on Card Instances.

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

## Discord Runtime Playback

The pure engine completes and persists the deterministic result before Discord
presentation begins. The Discord adapter expands each stored possession into
short presentation events (action setup, shot result, and rebound when present)
and reveals exactly one line every 1.5 seconds. This avoids holding database locks or adding wall-clock
delays to the simulation itself.

Timeline lines do not display timestamps. The compact `🔸` marker identifies
Team 1 events and `🔹` identifies Team 2 events; every player name uses a
Discord inline-code box. Shot
creation and its result are separate lines, so the attempt appears before the
later make, miss, or block.

The live response uses separate native embeds for the AI matchup and game
panel. It shows current score, recent event lines, and aligned partial
PTS/REB/AST tables derived only from fully revealed possessions. Its owner-only
`Simulate` button skips the remaining playback
and immediately renders the final report. Battle overrides the general
component timeout and disables Simulate after 60 seconds. Natural completion and Simulate
both remove all components from the game message. The game message remains a
separate final scoreboard/feed, while the bot sends a new `GAME STATS` message.
The live embed has no play/possession progress footer. Its left border is amber
when Team 1 leads, blue when Team 2 leads, and slate when the score is tied.
The postgame report is a single transient 1200 x 1400 PNG. It contains the
opponent bracket and final score, a large MVP showcase, cross-team scoring,
rebounding, playmaking, and defense leaders, both five-Player box scores, and
team totals. MVP is selected only from the winning team using PTS, REB, AST,
STL, BLK, TOV, and shooting-efficiency tie-breaks; rarity and Card strength do
not affect selection. The report is rendered locally from SVG with `sharp` and
is never persisted in PostgreSQL. Long names are truncated to preserve the
layout. Match ID, engine version, possession count, reward metadata, Team
Comparison, Game Summary, and Key Insights are omitted.

Game Display uses native Discord embeds and omits the prototype's
`Your Starting 5` subtitle. `Your Matchup` renders the
five AI opponents as one horizontal PNG. Each opponent without individual
artwork uses the project-local generic image with a rarity-colored border.
Game Stats follows its accepted raster prototype and is sent as a separate PNG
after the game completes or the owner uses Simulate.

PostgreSQL keeps its numeric `match_id` as the internal primary/foreign key.
Each Match also owns a unique lowercase 32-character hexadecimal
`public_match_id`, generated from 16 cryptographically random bytes for new
Matches. Discord displays that public ID in inline code immediately before the
`Your Matchup` embed and uses it in Battle component identifiers.

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
