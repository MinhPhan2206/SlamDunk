# 10 — Battle Strategy and Meta

## Status

Implemented as the Battle Engine v3.2 architecture.

Lineup strategy persistence is introduced by migration 029, and migration 030
seeds the original approved 20-Trait definition catalog. Migration 031 upgrades Lineup
strategy JSON to `strategy-v2` and adds Main Handler. The engine resolves bounded
action chains, defensive coverage, strategy weights, and contextual Trait
hooks without database access inside the simulation loop. Trait assignment to
individual Card Templates remains a separate catalog-data task; the engine does
not invent player Traits automatically.

Migration 033 expands the catalog to 27 Traits with seven situational Traits.
Migration 034 moves the interim Tendency data out of Card Templates and into
Lineup `strategy_config`, upgrades it to `strategy-v3`, and removes the interim
Card Template column. Battle Engine v3.2 snapshots Tendencies as part of each
team's Strategy and resolves them separately from Stats and Traits.
Migration 035 removes Presets, upgrades the strategy to `strategy-v4`, and
stores a separate Tendency profile keyed by each lineup Card Instance ID.

## Design Goals

The system should:

- support several viable playstyles instead of one dominant build;
- let players express a preferred basketball identity;
- create readable strengths, weaknesses, and soft counters;
- reward combinations of Stats, Traits, positions, and tactics;
- preserve seeded determinism and historical replay;
- use one small strategy read per Match and no database access per possession.

It must not:

- add permanent Card Stats or direct universal shot bonuses;
- guarantee that a preferred action will occur;
- make a Trait mandatory before its related action can happen;
- override action legality, matchup logic, or engine probability clamps;
- allow strategy changes after a Match snapshot is created.

## Engine Principle

Strategy controls decisions and defensive responses, not raw accuracy.

```text
eligible actions
-> base score from Stats and matchup
-> bounded strategy weight
-> contextual Trait decision modifier
-> weighted action selection
-> defensive scheme and Trait execution
-> shot quality / turnover / rebound result
```

Conceptually:

```text
raw weight(action)
= exp((base action score + contextual Trait decision delta) / temperature)
  x bounded strategy multiplier

final weight(action)
= raw weight(action) / sum(raw weights of all legal actions)
```

The engine clamps the strategy multiplier before this calculation and
normalizes all legal actions exactly once. This is the canonical order for
deterministic implementation and tests.

A perimeter strategy may create more three-point attempts, but it does not make
those attempts more accurate. Accuracy still comes from Actual Stats, created
advantage, defender quality, shot quality, and relevant Traits.

## Target Action Vocabulary

```text
Current core
THREE_POINT
MID_RANGE
DRIVE
POST_UP
PICK_AND_ROLL
DRIVE_AND_KICK

Priority 1
PASS
CREATE_SEPARATION
CUT
FAST_BREAK
SECOND_CHANCE
RESET_OFFENSE

Priority 2
PICK_AND_POP
DRIBBLE_HANDOFF
OFF_BALL_SCREEN
RELOCATE
EXTRA_PASS
POST_KICK_OUT

Defensive responses
FIGHT_OVER
GO_UNDER
SWITCH
DROP
HEDGE
BLITZ
STAY_HOME
HELP_RIM
ROTATE
RECOVER
DOUBLE_POST
```

## Offensive Metas and Playstyles

These are identities, not fixed action scripts. Actual selections still depend
on lineup quality, opponent matchup, legal context, and seeded randomness.

| Playstyle | Main action chain | Core Traits | Primary strength | Counters and costs |
|---|---|---|---|---|
| **Balanced Read-and-React** | `PASS -> best available action -> RESET_OFFENSE` | Floor General, Connector, Creative Passer | Reliable default with few extreme weaknesses | No specialist advantage against a specific defense |
| **Five-Out Drive & Kick** | `CREATE_SEPARATION / DRIVE -> DRIVE_AND_KICK -> EXTRA_PASS -> THREE_POINT` | Perimeter Gravity, Separation Artist, Paint Finisher, Creative Passer, Catch & Shoot, Connector | Pulls help away from the rim and punishes Drop/Pack Paint | Stay Home, Point-of-Attack Stopper, Active Hands; Switch matters when ball screens are added; weak offensive rebounding |
| **Spread Pick Game** | `PICK_AND_ROLL / PICK_AND_POP / DHO -> roll / pop / kick-out` | Pick & Roll Maestro, Screen Setter, Floor General, Catch & Shoot, Perimeter Gravity | Repeatedly attacks a weak screen defender or slow big | Screen Navigator, Switchable Defender, Hedge/Blitz; depends on a strong handler-screener pair |
| **Motion & Space** | `PASS -> DHO / OFF_BALL_SCREEN / CUT -> EXTRA_PASS` | Off-Ball Mover, Screen Setter, Connector, Creative Passer, Catch & Shoot | Creates chances without relying on one handler | Switching, denial, Active Hands, disciplined recovery; more passing windows create turnover risk |
| **Post Hub Inside-Out** | `POST_UP -> finish / POST_KICK_OUT / CUT -> Catch & Shoot` | Post Technician, Creative Passer, Perimeter Gravity, Off-Ball Mover, Catch & Shoot | Punishes small switches and converts double teams into open shots | Rim Protector, Switchable Defender, Double Post plus recovery |
| **Isolation Three-Level** | `CREATE_SEPARATION -> DRIVE / MID_RANGE / THREE_POINT -> RESET_OFFENSE` | Separation Artist, Midrange Assassin, Range Extender, Paint Finisher, Floor General | Lets an elite creator target the defender's weakest area | Point-of-Attack Stopper, Blitz, high usage, low ball movement, shot variance |
| **Run & Gun** | `steal / defensive rebound -> FAST_BREAK -> PASS / CUT / DRIVE` | Transition Engine, Active Hands, Glass Cleaner, Creative Passer, Paint Finisher | Converts stops into efficient attempts before the defense is set | Secure handling, Get Back policy, Floor General; weaker in half court |
| **Glass & Grind** | `DRIVE / POST_UP -> offensive rebound -> SECOND_CHANCE / kick-out / reset` | Glass Cleaner, Paint Finisher, Post Technician, Screen Setter | Wins through rim pressure and extra possessions | Rim protection, strong box-outs, five-out spacing, transition attacks |

`Balanced Read-and-React` is the default. New players can use it without knowing
every coverage, while experienced players may specialize later.

## Defensive Metas

| Scheme | Main response | Best supporting Traits | Strong against | Gives up |
|---|---|---|---|---|
| **Balanced** | Select coverage from matchup, action, and personnel | Any balanced Trait mix | Unknown opponents and new-user play | No extreme matchup advantage |
| **Switch** | Switch on-ball and off-ball screens | Switchable Defender, Screen Navigator, Point-of-Attack Stopper | PnR, PnP, DHO, Motion | Post mismatches, offensive rebounds, weak switch defenders |
| **Drop** | Big stays near the rim while the guard recovers | Rim Protector, Screen Navigator, Glass Cleaner | Drive, roll man, paint pressure | Pull-up mid-range, Pick & Pop, Catch & Shoot, Range Extender |
| **Go Under** | Defender goes below the screen and protects the lane | Point-of-Attack Stopper, Rim Protector | Weak-shooting slashers and roll pressure | Pull-up threes, Catch & Shoot, Range Extender |
| **Blitz Pressure** | Send two defenders at the handler | Point-of-Attack Stopper, Active Hands, Screen Navigator | Isolation and primary-handler offenses | Creative Passer, Connector, short roll, Extra Pass, backside four-on-three |
| **Stay Home** | Limit help and protect shooters/cutters | Point-of-Attack Stopper, Screen Navigator, Switchable Defender | Five-Out, Drive-and-Kick, Extra Pass | Drive, Post Hub, Paint Finisher when the direct defender loses |
| **Pack Paint** | Help early at the rim and rotate from the weakest shooter | Rim Protector, Glass Cleaner, Active Hands | Drive, Post Hub, Glass & Grind | Motion, Pick & Pop, Catch & Shoot, kick-outs after late rotation |

`GO_UNDER` is a user-visible v1 plan. `FIGHT_OVER` and `HEDGE` remain internal
responses selected by the Balanced resolver or become advanced options later.

## Soft-Counter Map

Counters change expected value; they never preselect the winner.

| Offense | Useful defense | Offensive adjustment when countered |
|---|---|---|
| Five-Out Drive & Kick | Stay Home plus Point-of-Attack Stopper; Switch when screens are added | Attack a weak direct defender, use off-ball screens, or move into Post Hub |
| Spread Pick Game | Screen Navigator, Switch, Hedge, or Blitz | Pick & Pop, short pass, Extra Pass, or attack the resulting mismatch |
| Motion & Space | Switch and passing-lane denial | Use back-cuts against denial, isolate one side, or move into Post Hub |
| Rim Pressure / slashing Pick Game | Go Under plus rim protection | Punish the space with pull-up threes, Catch & Shoot, or Pick & Pop |
| Post Hub | Rim Protector, Double Post, then Rotate | Post Kick-Out, Cut, Catch & Shoot, or reset |
| Isolation Three-Level | Point-of-Attack Stopper or Blitz | Add a screen, pass earlier, or attack the weak-side rotation |
| Run & Gun | Get Back and secure handling | Accept half-court play and use Floor General or Pick Game |
| Glass & Grind | Rim protection and strong box-out execution | Pull the big outward with Pick & Pop or Five-Out spacing |

This creates a counter cycle instead of a strict hierarchy. Higher rarity does
not remove matchup dependence.

## Trait Roles in the Meta System

| Function | Traits |
|---|---|
| Spacing and shooting context | Perimeter Gravity, Range Extender, Midrange Assassin, Catch & Shoot |
| Rim and individual creation | Paint Finisher, Separation Artist, Post Technician |
| Decisions and passing | Floor General, Pick & Roll Maestro, Creative Passer, Connector |
| Screening and off-ball movement | Screen Setter, Off-Ball Mover |
| Point-of-attack and screen defense | Point-of-Attack Stopper, Switchable Defender, Screen Navigator |
| Rim, turnover, rebound, transition | Rim Protector, Active Hands, Glass Cleaner, Transition Engine |
| Contested and contact scoring | Tough Shot Maker, Contact Finisher |
| Score-state situations | Clutch Performer, Clutch Defender, Comeback Catalyst, Momentum Scorer, Cold-Blooded |

Traits activate only in relevant context. `Catch & Shoot` does nothing after a
dribble, and `Screen Navigator` does nothing when no screen is used.

## Strategy Tendencies

Tendencies describe how each lineup player should prefer to play; Traits describe what
individual players execute unusually well. Tendencies never add shot-make
probability. Each saved Lineup Strategy may store one versioned profile per
Card Instance, with four dimensions:

| Dimension | Values |
|---|---|
| Decision | Balanced, Pass First, Score First |
| Shot Profile | Balanced, Rim Pressure, Perimeter, Mid Range, Post |
| Creation Role | Balanced, Pick & Roll Handler, Off Ball |
| Usage | Normal, Low |

The Battle resolver applies the active handler's bounded action-weight
multipliers before the final weighted choice. Low Usage applies to that player.
Unconfigured players use a fully Balanced profile. Profiles and resolver
versions are frozen in the Match snapshot. `/strategy` first selects a lineup
player, then edits that player's four settings; Card Template data is unchanged.

## Situational Trait Rules

- Clutch begins when either team has at least `targetScore - 4` points and the
  margin is no greater than 4.
- Comeback context begins when the offensive team trails by at least 6.
- Momentum Scorer activates after the same player scores on two consecutive
  team possessions; a miss or turnover resets that team's momentum.
- Cold-Blooded activates only when the current attempt can reach the target
  score.
- Tough Shot Maker applies only to contested/heavily contested threes and
  mid-range attempts. Contact Finisher applies only to contact finishes.
- Situational shot modifiers use the bounded Trait probability channel; all
  combined Trait probability changes are clamped to `-8%..+8%`.

## Command: `/strategy`

`/strategy` is one owner-only command for viewing and editing the Active
Lineup's strategy. It does not create separate slash commands for every setting.

```text
/strategy
```

No required options. It opens an ephemeral editor so other users cannot change
the draft or clutter the channel.

### Summary panel

```text
TEAM STRATEGY

Main Handler: SG · Shooting Guard
Offense: Motion & Space
Tempo: Standard
Defense: Switch
Rebounding: Get Back

Lineup Fit
Strong: Perimeter Gravity, Off-Ball Mover, Catch & Shoot
Risk: Limited interior defense; low offensive rebounding

Changes are not saved yet.
```

The first screen contains a Main Handler select and navigation for team tactics,
player Tendencies, saving, resetting, and cancelling.

```text
⚙️ Customize   💾 Save   ↩️ Reset   ✖️ Cancel
```

The Customize screen uses all five allowed Discord action rows:

```text
Row 1: Offense Style select
Row 2: Tempo select
Row 3: Defense Plan select
Row 4: Rebounding Policy select
Row 5: Back / Save / Reset / Cancel
```

- component changes update an in-memory draft only;
- Offense, Tempo, Defense, and Rebounding are always edited independently;
- the Players screen selects one current lineup Card before editing Tendencies;
- `Save` performs validation and one database update;
- `Reset` restores the Balanced draft but does not persist until Save;
- `Cancel` discards the draft.

Only the interaction owner may use the components. The editor has a 60-second
inactivity timeout, reset by every valid owner interaction. Expiration disables
all controls and discards unsaved changes. No Redis or persisted draft is needed.

## User-Visible Strategy Settings

### Offense Style

| Code | UI label | Prioritized actions | Tradeoff |
|---|---|---|---|
| `BALANCED` | Balanced | Best contextual action | No specialist advantage |
| `PACE_SPACE` | Pace & Space | Create Separation, Drive, Drive & Kick, Pass, Extra Pass, DHO, Off-Ball Screen, Pick & Pop, Three Point | Requires reliable shooters and spacing |
| `MOTION` | Motion Offense | Pass, Cut, DHO, Off-Ball Screen, Extra Pass | More interception windows |
| `PICK_GAME` | Pick Game | Pick & Roll, Pick & Pop, DHO, roll/pop passes | Handler-screener dependence and screen counters |
| `ISO_CREATOR` | Isolation Creator | Create Separation, Drive, Mid Range, Three Point | High usage and predictability |
| `RIM_PRESSURE` | Rim Pressure | Create Separation, Drive, Cut, Fast Break | Drop and Rim Protector |
| `POST_HUB` | Post Hub | Post Up, Post Kick-Out, Cut, Reset Offense | Slow and double-team risk |
| `TRANSITION` | Run & Gun | Fast Break, early Pass, Cut, Drive | Unstable half-court offense |

`Glass & Grind` emerges from `POST_HUB` or `RIM_PRESSURE` plus
`CRASH_GLASS`. Deep/PnP pressure emerges from `PICK_GAME` or `PACE_SPACE`
plus Range Extender and Catch & Shoot personnel. They do not need extra UI
options.

### Tempo

Tempo is a risk profile, not Discord playback speed.

| Code | UI label | Effect |
|---|---|---|
| `PATIENT` | Patient | More setup, pass, post, and reset before a shot |
| `STANDARD` | Standard | Neutral setup length and risk |
| `QUICK` | Quick | More Fast Break and early offense, but more turnover and poor-shot exposure after failed creation |

### Defense Plan

| Code | UI label | Main response | Tradeoff |
|---|---|---|---|
| `BALANCED` | Balanced | Choose from matchup and personnel | No specialist advantage |
| `SWITCH` | Switch | Switch screen actions | Post and rebound mismatches |
| `DROP` | Drop Coverage | Protect the rim and recover | Pull-up, Pick & Pop, Catch & Shoot |
| `BLITZ` | Blitz Ball Handler | Send two defenders at the handler | Short roll, Extra Pass, open weak side |
| `GO_UNDER` | Go Under | Protect the lane against a slashing handler | Three Point attempts |
| `STAY_HOME` | Stay Home | Keep helpers with shooters and cutters | Limited rim help |
| `PACK_PAINT` | Pack Paint | Help early at the rim | Kick-outs, Motion, Pick & Pop |

### Rebounding Policy

| Code | UI label | Effect |
|---|---|---|
| `BALANCED` | Balanced | Neutral offensive-rebound participation |
| `CRASH_GLASS` | Crash the Glass | More offensive rebound and Second Chance participation; weaker transition defense |
| `GET_BACK` | Get Back | Sacrifice some offensive rebounds to reduce opponent Fast Break value |

### Main Handler

Main Handler is stored as a Lineup slot (`PG`, `SG`, `SF`, `PF`, or `C`), not
as a Card ID. The setting therefore remains valid when a Card in that slot is
replaced. It defaults to `PG` and remains independent from player Tendencies.

The Main Handler receives the ball after a won opening tip and after the
opponent scores. The Center normally performs the check-in; when the Center is
the Main Handler, another teammate performs it. This identifies the initial
ball handler without forcing that player to finish every possession.

## Lineup Fit and Validation

Lineup Fit is advice, not an eligibility gate.

Examples:

- Pick Game without Screen Setter: warning; Save remains allowed.
- Pace & Space with weak three-point Stats: warning; Save remains allowed.
- Crash the Glass with a small lineup: transition-defense warning.
- Run & Gun with Patient tempo: allowed as Custom, but marked internally
  inconsistent.
- Incomplete lineup: strategy may be saved; `/battle` keeps its normal full
  lineup requirement.

The server accepts only known enum codes. The client never sends action weights
or coefficients. Unknown keys, unsupported versions, and invalid values fail
clearly.

## Runtime Integration

At Match creation:

```text
load Active Lineup and saved strategy
-> use Balanced defaults when strategy is absent
-> resolve strategy codes through versioned configuration
-> validate, normalize, and clamp weights
-> select and freeze the AI opponent and AI strategy
-> snapshot both lineups, Traits, Tendencies, strategies, seed, and versions
-> resolve the Center-versus-Center tip-off
-> deliver the opening tip and post-score check-ins to each Main Handler
-> run the pure deterministic simulation
```

The player's strategy is frozen before the AI matchup is shown. Editing
`/strategy` during playback affects only later Matches.

### Resolver order

1. Stats and matchup produce legal actions and base action scores.
2. Lineup strategy applies bounded selection weights.
3. Relevant actor/team Traits modify decision or advantage hooks.
4. Weighted randomness selects the action.
5. Defense strategy selects coverage and help behavior.
6. Defensive Traits modify how well that response is executed.
7. Shot quality, make/miss, turnover, rebound, and transition resolve normally.

Strategy never modifies `SHOT_MAKE` directly and never writes to Card Template
or Card Instance data.

## AI Strategy Policy

AI should not use one universal playstyle and should not directly counter-pick
the player's saved strategy.

At Match creation, calculate AI Style Fit from the frozen AI lineup's Stats and
Traits. Perform a seeded weighted choice between its two best-fitting offense
styles and two best-fitting defense plans. Freeze the result in the Match.

Derive stable domain-specific sub-seeds from the master Match seed:

```text
ai-matchup
ai-offense-strategy
ai-defense-strategy
simulation
```

These domains must not share one mutable random stream. Adding a future random
choice to AI strategy must not change the entire possession sequence. A retry
of an existing Match uses the already resolved strategies in its input snapshot
instead of resolving them again with current configuration.

This provides opponent variety while preserving fairness and reproducibility.
Opponent brackets may later define different style pools, but never hidden
coefficient bonuses outside the selected bracket rules.

## Persistence

Strategy belongs to the Active Lineup. The Lineup module owns authorization,
normalization, Lineup Fit analysis, and persistence. The Battle module maps an
already normalized strategy to versioned engine coefficients. Discord calls
the service layer and never reads a repository or calculates Lineup Fit itself.

To avoid a Lineup-to-Battle dependency cycle, stable codes, defaults, and
schema validation live in a dependency-neutral pure file such
as `src/modules/lineup/lineup-strategy.js`. Battle may import that contract;
Lineup must not import Battle configuration. A new top-level Strategy module or
Strategy repository is unnecessary for v1.

Add two fields to `lineups`:

```text
strategy_config    JSONB NOT NULL DEFAULT <Balanced strategy JSON>
strategy_revision  INTEGER NOT NULL DEFAULT 1

CHECK jsonb_typeof(strategy_config) = 'object'
CHECK strategy_revision >= 1
```

Example:

```json
{
  "schemaVersion": "strategy-v4",
  "mainHandler": "SG",
  "playerTendencies": {
    "12345": {
      "schemaVersion": "tendency-v1",
      "decision": "PASS_FIRST",
      "shotProfile": "PERIMETER",
      "creationRole": "PICK_ROLL_HANDLER",
      "usage": "NORMAL"
    }
  },
  "offense": "MOTION",
  "tempo": "STANDARD",
  "defense": "SWITCH",
  "rebounding": "GET_BACK"
}
```

No JSONB index is required because the application never searches lineups by
strategy. This design adds:

- one read together with the Active Lineup when opening `/strategy` or starting
  `/battle`;
- one `UPDATE` when Save succeeds;
- zero strategy queries inside the possession loop.

The migration must safely handle existing Lineup rows. Either add the Balanced
JSON default immediately, or add the column as nullable, backfill Balanced, and
then apply `NOT NULL`. Runtime fallback to Balanced still protects legacy or
externally imported snapshots that omit strategy data.

`strategy_revision` provides optimistic locking so two open editors cannot
silently overwrite one another. A revision conflict asks the player to reopen
`/strategy`.

The resolved player and AI strategies, strategy schema version, and resolver
version are copied into the immutable Match snapshot. Later balance changes do
not rewrite historical Matches.

## Anti-Dominance and Loop Guardrails

All limits are versioned configuration, not hard-coded production truth.

- a single tactic should change an action weight by no more than approximately
  15%;
- combined strategy adjustment should remain inside a bounded range such as
  `0.75x` to `1.30x` before normalization;
- every legal action keeps a small weight floor; a tactic cannot disable it;
- using the same primary action three times consecutively applies a temporary
  read/predictability penalty, cleared after two different primary actions;
- the repetition penalty should cap around 30–40% and never modify shot
  accuracy directly;
- at most two `EXTRA_PASS` actions receive a bonus in one possession;
- `RESET_OFFENSE` receives a bonus at most once per possession;
- re-screen, setup, and second-chance chains have configured maximum lengths;
- `FAST_BREAK` only follows a defensive rebound, steal, or live-ball turnover;
- `SECOND_CHANCE` only follows an offensive rebound;
- failed Blitz, Hedge, or aggressive pressure creates a real offensive
  advantage instead of free defensive upside;
- Drop concedes pull-up/PnP space, Switch risks mismatches, Pack Paint concedes
  kick-outs, Stay Home limits rim help, and Crash Glass weakens transition
  defense;
- team-wide Trait effects use the strongest eligible copy only;
- Traits and strategy use separate channels, combine offense and defense
  symmetrically, and clamp once per hook.

## Player Feedback

Postgame information should help a player understand the strategy without
exposing private formulas. Future Match details may show:

```text
Offense Style / Defense Plan / Tempo / Rebounding Policy
action distribution
shot distribution
turnover sources
offensive rebounds and fast-break points
most frequently activated Traits
```

This belongs in a Match-details view, not the compact live Battle feed.

## Balance Test Matrix

Run deterministic Monte Carlo suites across:

```text
8 offense styles
x 7 defense plans
x 3 tempo settings
x 3 rebound policies
x representative lineup archetypes
x equal and unequal Card Levels
x multiple seed batches
```

Track:

- win rate and score margin;
- action frequency and action-chain length;
- shot-quality and shot-location distribution;
- turnover source: pass, handle, post, or pressure;
- offensive-rebound, Second Chance, and Fast Break rates;
- Trait activation count and value by hook;
- player usage concentration;
- results by opponent bracket and AI style.

Initial health targets:

- equal-strength strategies normally remain near 45–55% against the field;
- an intentional hard counter generally stays within a 40–60 matchup;
- a well-supported strategy changes expected win rate by roughly 3–8
  percentage points, not by an automatic-win margin;
- no action, Trait, or strategy improves results against every opponent style.

## Implementation Order

1. Add the dependency-neutral strategy contract/defaults under Lineup, then add
   coefficient mapping and resolver version to static Battle configuration.
2. Add `strategy_config` and `strategy_revision` to Lineup persistence.
3. Implement the owner-only `/strategy` editor with in-memory draft state.
4. Resolve and snapshot player and AI strategies when a Match is created.
5. Apply offense weights in `ACTION_SELECTION`.
6. Implement explicit defensive coverage choices and tradeoffs.
7. Wire the approved Trait hooks and coefficients.
8. Add strategy, action, and Trait telemetry to deterministic simulations.
9. Tune the complete strategy-versus-strategy matrix before production.

## Deferred Features

The first version does not include:

- manual calls during a Match;
- changing tactics after Match creation;
- multiple named custom strategy slots;
- user-defined numeric action percentages;
- opponent-specific automatic counter-picking;
- bench rotations, substitutions, fatigue, free throws, or timeouts;
- paid strategy-only coefficient bonuses.
