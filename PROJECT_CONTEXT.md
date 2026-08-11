# SlamDunk — Codex Project Context

> **Purpose:** Persistent project context for Codex.  
> **Current status:** Requirements baseline completed, Architecture Phase completed, M0–M16 completed.
> **Next milestone:** TBD — the planned M0–M16 roadmap is complete.
> **Important:** Always inspect the repository before changing code. This document describes the agreed project baseline, but the repository is the source of truth for what has actually been implemented.

---

# 1. Project Identity

Project name:

```text
SlamDunk
```

Previous working names such as `Cyperdunk` are obsolete.

SlamDunk is a Discord-based basketball collectible card game using **real NBA players** as the player/card theme.

The game is **not** cyberpunk or futuristic.

---

# 2. Product Concept

SlamDunk combines:

- Collectible Card Game (CCG)
- Gacha / pack opening
- Basketball team building
- Auto-battler simulation
- Player progression
- Card progression
- Fixed-price marketplace
- Direct player-to-player trading
- Card fusion / upgrade
- In-game economy

Core gameplay loop:

```text
Claim / Daily / Pack
        ↓
Acquire Cards
        ↓
Collection
        ↓
Build Lineup
        ↓
Battle
        ↓
Earn Rewards
        ↓
Upgrade / Market / Trade / Open More Packs
        ↓
Repeat
```

Main product goals:

1. Collect NBA player cards.
2. Hunt rare cards.
3. Build competitive lineups.
4. Battle AI and later other players.
5. Trade cards through Market or Direct Trade.
6. Fuse duplicate cards into stronger cards.
7. Create a meaningful player-driven card economy.

---

# 3. IP / Independent Implementation Direction

SlamDunk may take gameplay inspiration from games such as Basketbot.

However, implementation and creative expression must be independent.

Do not copy:

- Basketbot source code
- decompiled/leaked code
- database
- artwork
- card frames
- logo
- UI pixel-for-pixel
- battle narration
- help text
- trait descriptions verbatim
- custom icons/assets
- proprietary balancing tables line-for-line

Generic mechanics may inspire SlamDunk requirements, such as:

```text
rarity
pack choice
serial numbers
traits
card levels
market
trade
lineup
auto-battle
box score
fusion
```

SlamDunk should use independently written:

- source code
- trait names/descriptions
- battle narration
- formulas
- UI copy
- architecture

The project intentionally uses real NBA players, but that is a separate licensing/IP issue from Basketbot.

For early MVP, safer content direction is:

```text
player names
basketball stats
original UI
```

without copying player images or NBA/team branding from Basketbot or third-party sites.

---

# 4. Technology Stack

Confirmed:

```text
Runtime:       Node.js
Language:      JavaScript
Module system: ES Modules
Discord SDK:   discord.js
Database:      PostgreSQL
DB driver:     pg
Environment:   dotenv
```

Do not introduce without explicit approval:

- TypeScript
- Prisma
- Sequelize
- TypeORM
- Drizzle
- NestJS
- Express
- Fastify
- Redis
- Docker
- microservices
- message brokers
- dependency-injection frameworks

The project intentionally starts with direct `pg` usage so SQL/PostgreSQL concepts remain visible.

---

# 5. Architecture Style

Confirmed:

```text
Modular Monolith
```

One deployable Node.js application.

One main PostgreSQL database.

Internally separated domain modules.

High-level flow:

```text
Discord Interaction
        ↓
Command / Interaction Layer
        ↓
Service / Domain Layer
        ↓
Repository Layer
        ↓
PostgreSQL
```

Discord is an interface/adapter.

Core game logic must not live directly inside Discord command handlers.

---

# 6. Layer Responsibilities

## Discord / Command Layer

Responsible for:

- slash commands
- buttons/selects
- Discord-specific input
- calling application/domain services
- converting service results/errors into Discord responses

Must not own:

- game formulas
- wallet updates
- SQL
- card ownership logic
- battle logic

## Service / Domain Layer

Responsible for:

- business rules
- validation
- orchestration
- game behavior

Examples:

- pack rarity selection
- fusion
- market purchase
- trade execution
- lineup validation
- battle simulation

## Repository Layer

Responsible for:

- PostgreSQL reads/writes
- persistence implementation
- DB-specific queries

## PostgreSQL

Persistent source of truth.

Important game state must not depend only on memory or Discord message history.

---

# 7. Planned Domain Modules

Current planned modules:

```text
Player
Economy
Card
Trait
Pack
Reward
Collection
Upgrade
Market
Trade
Lineup
Battle
```

Shared/infrastructure concerns:

```text
Database
Transactions
Configuration
Logging
Errors
Validation
Time utilities
ID generation
```

Do not create every future module as empty scaffolding.

Create them when implementation reaches them.

---

# 8. Player System

Each Discord user can have a SlamDunk Player Account.

Conceptual fields:

```text
player_id
discord_user_id
username_snapshot
created_at
last_active_at

player_level
xp
games_played
games_won
games_lost
current_win_streak
highest_win_streak
```

Player Level and Card Level are separate concepts.

Player Level does not currently directly modify card stats.

---

# 9. Economy

Currencies:

```text
Gold
Shards
```

## Gold

Potential sources:

```text
/claim
/daily
battle rewards
challenges
achievements
season rewards
market sales
direct trade
```

Potential sinks:

```text
paid packs
market purchases
future events
future exchange/cosmetic systems
```

Confirmed:

```text
Market fee = 0%
Market listing fee = 0
Trade fee = 0%
Upgrade Gold fee = 0
```

This means future Gold sinks are important for inflation control.

Approved F2P economy is defined in Sections 17, 20, 21, and 29 below.

Historical simulation baseline (superseded):

```text
/claim: random integer 300–500 Gold every 10 minutes (400 Gold EV)
/daily: 300 Gold + 5 Shards
/challenge: point margin × 50 Gold, 60-minute cooldown
Challenge streak: +5% per win, capped at ×1.5

Standard Pack: 1,000 Gold (confirmed)
Premium Pack: 6,000 Gold
Promo/Event Pack: 10,000–12,000 Gold
```

These are simulation inputs, not final production requirements. Market sales
and Direct Trade remain player-to-player transfers rather than Gold creation or
Gold sinks.

## Shards

Primary intended source:

```text
/quicksell
```

Potential sinks:

```text
/exchange
upgrade items
special packs
event items
```

Provisional quicksell and Shard-exchange values are documented in
`docs/requirements/economy-pack-baseline.md`. Quicksell should primarily return
Shards so Free Drop does not become another major Gold faucet.

---

# 10. Economy Ledger

Important currency changes must eventually create immutable transaction records.

Conceptual fields:

```text
transaction_id
player_id
currency
amount
transaction_type
reference_type
reference_id
created_at
```

Examples:

```text
+300 GOLD      CLAIM
-2500 GOLD     PACK_PURCHASE
-10000 GOLD    MARKET_PURCHASE
+10000 GOLD    MARKET_SALE
+50 SHARDS     QUICKSELL
```

Do not only mutate Wallet balances without transaction history.

---

# 11. Card Model

The Card system must separate:

```text
Card Template
```

from:

```text
Card Instance
```

Do not merge them.

---

# 12. Card Template

A Card Template defines the current collectible representation of one player.

Example:

```text
Stephen Curry
Goat
PG
```

Shared Template-level properties include:

```text
player_name
rarity
positions
overall (temporary internal Battle/AI-selection field; never shown in UI)
base stats
traits
trait tiers
```

The current schema permits one Card Template for the same player in each
rarity. The same player may exist in different rarities, but duplicate Templates
for the same player and rarity are forbidden. Supporting multiple variants in
one rarity later requires an explicit `variant_code` or `card_set`.

---

# 13. Card Stats

Keep 7 displayed battle stats:

1. Finishing
2. Mid Range
3. Three Point
4. Playmaking
5. Perimeter Defense
6. Interior Defense
7. Strength

Card Template stats are the Level 5 values. Runtime Actual Stats are derived
without duplicating them on Card Instances:

```text
Actual Stat = Template Stat - (5 - Card Level)
```

The legacy `overall` column is retained temporarily only because the current
Battle AI-selection query still depends on it. It must not be displayed or
used as a Player-facing sort choice. Remove it from the schema after AI
selection is based on the approved stat model.

---

# 14. Card Instance

A Card Instance is one individually owned copy of a Card Template.

Example:

```text
Stephen Curry
Serial #152
Level 4
Owner: Player A
```

Conceptual Instance data:

```text
card_instance_id
public_card_id
card_template_id
owner_player_id
serial_number
card_level
ownership_cycles
games_played
obtained_method
obtained_at
status
market_lock
trade_lock
```

Instance-level values include:

- owner
- serial
- level
- obtained method
- lifecycle
- history

---

# 15. Card Level

Confirmed:

```text
Card Level range = 1–5
Maximum Card Level = 5
```

Cards received directly from Pack/Drop use weighted initial Levels:

```text
Level 1 = 45%
Level 2 = 28%
Level 3 = 14%
Level 4 = 8%
Level 5 = 5%
```

Drop and each Pack definition own separate Level weight configuration so future
Pack products may use different odds.

Card Level belongs to Card Instance.

It does not modify Template identity, rarity, traits, or Trait Tier.

Battle and lineup averages use the derived Actual Stats defined above.

---

# 16. Serial Numbers / Circulation

Each Card Template has its own monotonically increasing serial sequence.

Example:

```text
Curry #1
Curry #2
Curry #3
...
```

Serial numbers are never reused.

Distinguish:

```text
total_minted
```

from:

```text
current_circulation
```

Example:

```text
#2 and #4 destroyed
#6 minted
```

Then:

```text
total_minted = 6
current_circulation = 4
```

Low serial numbers do not provide an official gameplay/stat bonus.

Card gameplay value is based mainly on:

- stats
- traits
- Trait Tier
- Card Level

Players may personally value low serials in the market.

---

# 17. Rarity

First MVP uses:

```text
7 initial rarities
```

Final rarity names:

```text
Base
Common
Uncommon
Alpha
All-Star
Superstar
Goat
```

These names are confirmed. Rarity is persisted through a catalog row with a
stable code and an ordering rank; Card Templates reference that row by
`rarity_id`. The rank is only for ordering and is not the rarity's identity.

The intended curve is very steep, inspired by the provided Basketbot rarity reference.

Approved Free Drop per-candidate distribution:

```text
Base             52.44992%
Common           31.96947%
Uncommon         15.45764%
Alpha             0.111235%
All-Star          0.011112%
Superstar         0.000556%
Goat              0.0000667%
```

This distribution totals 100%. Three candidates are rolled independently and
the Player chooses one.

---

# 18. Traits

Traits are passive basketball abilities.

Confirmed:

```text
Traits belong to Card Template
Traits are fixed
Trait Tier belongs to Card Template
Trait Tier is fixed
Pack does not randomize traits
Fusion does not change traits
Card Level does not change Trait Tier
```

Trait Tiers use:

```text
I
II
III
```

Exact numerical effects are TBD.

Total Trait Level by rarity:

Tier 1:        0
Tier 2:        0–1
Tier 3:        0–2
Tier 4:        2–6
Tier 5:        6–12
Tier 6:        17–22
Goat:         20–30

Trait Level values:

Trait I   = 1 point
Trait II  = 2 points
Trait III = 3 points

A card's Total Trait Level is the sum of the levels of all Traits assigned to its Card Template.

Example:

Trait A III = 3
Trait B II  = 2
Trait C I   = 1

Total Trait Level = 6

The rarity range limits Total Trait Level, NOT the number of distinct Traits.

The Total Trait Level ranges may be revisited after battle simulation and balancing.

Battle engine should only evaluate traits relevant to the current action.

---

19. Trait Catalog Direction

The original 30-Trait catalog was created under the incorrect assumption that higher-rarity cards required 20–30 different Traits.

This is no longer the intended design.

Rarity controls a Card Template's Total Trait Level, not its number of distinct Traits.

Trait Level values:

Trait I   = 1 point
Trait II  = 2 points
Trait III = 3 points

Example:

Perimeter Gravity III = 3
Floor General III     = 3
Range Specialist II   = 2
Clutch Performer II   = 2

Total Trait Level = 10

Therefore, even a Goat card with:

Total Trait Level = 20–30

does not need 20–30 different Traits.

A Goat card may instead contain approximately 7–12 meaningful Traits depending on their tiers.

For the first MVP, SlamDunk should use a smaller global Trait pool of approximately 18 core Traits.

The goal is not to maximize the number of Traits.

The goal is to make each Trait create a meaningful difference in:

playstyle
matchups
lineup construction
synergy
counter-play

Traits remain fixed by Card Template.

Players do not choose or reroll Traits.

Strategic decision-making comes from deciding which Card Instances and Card Templates to combine in a lineup.

19.1 Trait Design Principles

A good Trait should usually do at least one of the following:

change how a player behaves
create a favorable matchup
counter another playstyle
improve teammate performance
create synergy with another Trait
create a situational advantage

Avoid Traits whose only purpose is:

+X% to everything

because they create power without meaningful decision-making.

Trait effects should generally be conditional.

Example:

Rim Protector

should matter when defending the paint, but provide little value against a lineup primarily generating perimeter shots.

This creates counter-play.

19.2 Offensive Traits

1. Perimeter Gravity

Description

The player commands additional defensive attention on the perimeter. Defenders are more likely to remain attached to the player away from the basket, creating additional space for teammates to drive or operate inside.

Strategic Role

Creates spacing for the entire offense rather than simply increasing the player's own shooting percentage.

Strong With

Rim Pressure
Drive-and-Kick Creator
Post Technician

2. Range Specialist

Description

The player is comfortable taking three-point shots from extended range. Eligible long-range attempts suffer a smaller distance penalty and the player is more willing to shoot when defenders give additional space.

Strategic Role

Forces defenses to guard farther from the basket.

Countered By

Point-of-Attack Defender
Screen Navigator

3. Rim Pressure

Description

The player aggressively attacks open driving lanes and puts pressure on interior defenders. Successful penetration increases the chance of creating a high-value attempt near the basket or forcing help defense.

Strategic Role

Creates paint pressure and can indirectly create open shots for teammates.

Strong With

Drive-and-Kick Creator
Perimeter Gravity

Countered By

Rim Protector
Point-of-Attack Defender

4. Post Technician

Description

The player is effective at creating offense from post-up situations. When matched against a smaller or weaker defender, the battle engine is more likely to exploit the mismatch and generate an efficient interior scoring opportunity.

Strategic Role

Punishes small lineups and unfavorable switches.

Countered By

Switch Defender
Rim Protector

5. Tough Shot Maker

Description

The player is capable of converting difficult jump shots under defensive pressure. The normal efficiency penalty from contested eligible jump shots is partially reduced.

Strategic Role

Useful when an offense struggles to create open shots.

This Trait improves difficult-shot performance but should not make contested shots better than properly created open shots.

19.3 Playmaking Traits

6. Floor General

Description

The player organizes the offense and improves team decision-making while acting as a ball handler. Teammates receive cleaner offensive opportunities and avoidable passing turnovers are reduced.

Strategic Role

Provides team-wide offensive stability.

Especially valuable in lineups containing strong scorers who are weak creators.

7. Pick-and-Roll Maestro

Description

The player reads pick-and-roll situations particularly well. When operating as the ball handler, the engine becomes better at selecting between scoring, passing to the roller, and finding an open teammate created by defensive help.

Strategic Role

Creates strong two-player combinations.

Strong With

Screen Setter
Rim Pressure
Perimeter Gravity

Countered By

Screen Navigator
Switch Defender

8. Drive-and-Kick Creator

Description

The player recognizes defensive help while attacking the basket. When additional defenders collapse toward a drive, the player has an increased chance of finding an open perimeter teammate instead of forcing the shot.

Strategic Role

Connects interior pressure with perimeter shooting.

Strong With

Rim Pressure
Range Specialist
Perimeter Gravity

9. Connector

Description

The player quickly moves the ball when another teammate has a better scoring opportunity. The offense has an increased chance of generating an extra pass instead of ending the possession with the first available shot.

Strategic Role

Improves ball movement without requiring the player to be the primary point guard.

Useful for balanced lineups containing several good offensive players.

19.4 Defensive Traits

10. Point-of-Attack Defender

Description

The player excels at containing the opposing primary ball handler. Direct isolation drives are harder to create and perimeter shot attempts receive stronger contest pressure.

Strategic Role

Primary counter against elite guards and isolation scorers.

Counters

Rim Pressure
Range Specialist
Pick-and-Roll ball handlers

11. Switch Defender

Description

The player can defend multiple positions without suffering the normal full mismatch penalty. Defensive switches are less likely to create an immediately exploitable matchup.

Strategic Role

Provides lineup flexibility and counters offenses designed to force mismatches.

Counters

Post Technician
Pick-and-Roll Maestro
Mismatch-based offense

12. Rim Protector

Description

The player provides strong defensive protection near the basket. Opposing interior attempts receive greater contest pressure and eligible shots have an increased probability of being blocked.

Strategic Role

Discourages paint-heavy offenses.

Counters

Rim Pressure
Post Technician
Interior finishers

13. Passing Lane Hunter

Description

The player aggressively anticipates passing routes. Risky passes near the defender have an increased chance of being intercepted or deflected.

Strategic Role

Punishes teams that rely heavily on passing and ball movement.

However, aggressive passing-lane defense may occasionally create positioning risk when the interception attempt fails.

This tradeoff prevents the Trait from being universally positive.

14. Screen Navigator

Description

The player is particularly effective at staying attached to an offensive player while moving through screens. Screens generate less separation and pick-and-roll actions create a smaller initial advantage.

Strategic Role

Specialized counter against screen-heavy perimeter offenses.

Counters

Pick-and-Roll Maestro
Range Specialist
Screen Setter

19.5 Rebounding / Transition Traits

15. Glass Cleaner

Description

The player has superior positioning and timing when competing for rebounds. The player receives an increased probability of securing both defensive and offensive rebounds when involved in the rebounding contest.

Strategic Role

Creates additional possessions and prevents opponent second-chance opportunities.

Particularly valuable for smaller lineups that would otherwise struggle on the boards.

16. Transition Engine

Description

The player quickly converts defensive stops into fast-break opportunities. After the team secures a defensive rebound or steal, the probability of generating an effective transition possession is increased.

Strategic Role

Allows players to construct faster lineups that benefit from steals and defensive rebounds.

Strong With

Passing Lane Hunter
Glass Cleaner
Rim Pressure

19.6 Team / Situational Traits

17. Screen Setter

Description

The player creates effective screens that generate separation for teammates. Ball handlers receive a greater initial advantage when using the player's screen in pick-and-roll or perimeter actions.

Strategic Role

A support Trait that can make another offensive card significantly more effective without directly increasing the screen setter's scoring ability.

Strong With

Pick-and-Roll Maestro
Range Specialist
Rim Pressure

Countered By

Screen Navigator
Switch Defender

18. Clutch Performer

Description

The player performs more effectively during high-leverage late-game possessions. When the score is close near the end of regulation, selected offensive or defensive actions receive improved execution.

Strategic Role

Provides situational value rather than a permanent full-game bonus.

A card with Clutch Performer may be less dominant throughout the game but become more valuable in close finishes.

19.7 Why These 18 Traits

The MVP Trait pool intentionally contains a limited number of Traits with clearly different roles.

Offensive             5
Playmaking            4
Defensive             5
Rebounding/Transition 2
Team/Situational      2
------------------------
Total                 18

The goal is to create different basketball archetypes without overwhelming players with dozens of similar effects.

Examples:

Perimeter offense

Perimeter Gravity
Range Specialist
Pick-and-Roll Maestro
Screen Setter

creates an offense built around spacing and screens.

A defensive response could use:

Point-of-Attack Defender
Screen Navigator
Switch Defender

Paint-heavy offense

Rim Pressure
Post Technician
Drive-and-Kick Creator

puts pressure on the basket.

A defensive response could use:

Rim Protector
Point-of-Attack Defender

Transition lineup

Passing Lane Hunter
Glass Cleaner
Transition Engine
Rim Pressure

tries to create offense from defensive stops.

Half-court control lineup

Floor General
Connector
Screen Setter
Tough Shot Maker

focuses on stable offensive execution.

19.8 Trait Tier Philosophy

Trait Tier changes the strength of the same behavior, not the nature of the Trait.

Example:

Rim Protector I
Rim Protector II
Rim Protector III

should all protect the rim.

Tier II and III simply provide stronger versions of the effect.

Conceptually:

I   = noticeable
II  = strong
III = elite

Exact battle coefficients remain TBD.

The values:

I   = 1
II  = 2
III = 3

are used for Total Trait Level calculation only.

They are not the battle multiplier.

19.9 Total Trait Level Examples

Example Rare-level card:

Rim Pressure II        = 2
Drive-and-Kick I       = 1
Perimeter Gravity I    = 1

Total Trait Level = 4

The card has:

3 distinct Traits

but:

Total Trait Level = 4

Example high-rarity card:

Perimeter Gravity III       = 3
Range Specialist III        = 3
Floor General III           = 3
Pick-and-Roll Maestro III   = 3
Drive-and-Kick Creator II   = 2
Tough Shot Maker II         = 2
Clutch Performer II         = 2
Connector II                = 2
Screen Navigator I          = 1

Total:

21 Trait Level Points

The card has only:

9 distinct Traits

while still having:

Total Trait Level = 21

This is the intended interpretation of rarity Trait budgets.

19.10 Strategic Design Goal

The strongest lineup should not automatically be:

the five cards with the highest raw ratings

Instead, lineup strength should depend on:

Stats
+
Card Level
+
Trait composition
+
Trait Tier
+
Position
+
Synergy
+
Opponent matchup

For example, a defender with lower offensive ratings but stronger defensive Traits:

Screen Navigator III
Point-of-Attack Defender III

may be a better choice against an elite perimeter guard than a stronger offensive card.

Similarly:

Rim Protector III

may be extremely valuable against a paint-heavy lineup but less valuable against a five-out shooting lineup.

This matchup dependency is intentional.

The Trait system should make players ask:

"Which cards work best together, and which lineup works best against this opponent?"

rather than only:

"Which five cards have the highest individual ratings?"

# 20. Pack System

Conceptually:

```text
/drop
```

Current direction:

- reveal multiple candidates;
- player chooses one;
- only selected card should be minted;
- selected Card Instance gets initial Level 1–5.

Still TBD:

```text
paid pack structure
```

Earlier cooldown values were drafts and are superseded by the current 15-minute production rule.

The economy simulation baseline currently uses:

```text
Free Drop cooldown: 15 minutes
Cards shown: 3
Choose: 1
Cost: FREE
Selection window: 20 seconds; timeout automatically selects candidate 1
Pity: none
```

This is the approved F2P production baseline. Increasing candidate count is an economy/card-
supply buff because `P(at least one target) = 1 - (1 - p)^n`.

The provisional product ladder is:

```text
Free Drop
→ Standard Gold Pack
→ Premium / Promo Pack
→ Shard Key / Special Source
```

Drop and Pack are separate modules. The configured Standard Pack uses code
`standard` and the following approved rarity distribution:

```text
Base       13.95031%
Common     44.16792%
Uncommon   38.25376%
Alpha       3.451062%
All-Star    0.166945%
Superstar   0.008334%
Goat        0.001667%
```

Future Packs must be added as independent Pack catalog entries with their own
stable code, display name, and rarity weights. `/odds pack_type:<code>` is one
command for Free Drop and configured Pack odds; omitting `pack_type` defaults
to Free Drop. Pack purchase/opening is implemented independently of Drop.

Confirmed Standard Pack behavior:

```text
Command: /pack pack_type:standard
Cost: 1,000 Gold
Result: 1 Card
Cooldown: 1 second
Purchase limit: none during test
Within-rarity Card Template weighting: uniform for the current 7 rarities
```

The command opens immediately after submission. Debit, ledger, roll, mint,
PackOpening completion, and cooldown are atomic. Discord interaction ID prevents
double charge and duplicate mint on retry. Premium, Event, and Shard Packs will
use independent catalog entries and odds.

---

# 21. Reward Commands

Reward commands:

```text
/claim
/daily
/drop
```

Confirmed for `/claim`:

```text
Cooldown: 15 minutes
Reward: uniformly random integer from 80 through 120 Gold, inclusive
Database cooldown type: CLAIM
Economy transaction type: CLAIM
Discord interaction ID provides idempotency
```

Confirmed `/daily`: 24-hour cooldown, 1,500–2,000 Gold, and 20–30 Shards.
Confirmed Standard Pack anti-spam cooldown: 1 second.

Database must eventually be the source of truth for cooldown state.

The provisional `/daily` simulation baseline remains 300 Gold + 5 Shards.

Possible future Daily milestones are 3, 7, 14, and 21 claims. Exact milestone
behavior and rewards remain TBD.

---

# 22. Quicksell

Concept:

```text
/quicksell
```

Expected:

```text
Card Instance ACTIVE
↓
DESTROYED_QUICKSELL
↓
Shards credited
```

Destroyed card remains in database history.

The configured rarity-based Quicksell Shard values are confirmed for the current version.

Provisional simulation values:

```text
Base          1 Shard
Common        2 Shards
Uncommon      5 Shards
Alpha        30 Shards
All-Star    200 Shards
Superstar 1,500 Shards
Goat      10,000 Shards
```

For every Shard Key, expected quicksell value of the result must remain below
the key cost. A provisional returned-value target is 10%–30% of key cost.

---

# 23. Upgrade / Fusion

Two mechanisms:

```text
Card Fusion
Upgrade Item
```

There is no Gold upgrade fee.

---

# 24. Card Fusion

Confirmed eligibility:

```text
same Card Template
same owner
distinct Card Instances
ACTIVE
not conflictingly locked
```

Formula:

```text
newLevel = min(cardA.level + cardB.level, 5)
```

Examples:

```text
Lv1 + Lv2 → Lv3
Lv2 + Lv3 → Lv5
Lv4 + Lv4 → Lv5
Lv5 + Lv1 → Lv5
```

Both original instances are destroyed logically:

```text
DESTROYED_FUSION
```

Do not physically delete them.

Fusion creates a completely new Card Instance with:

```text
new card_instance_id
new serial_number
same card_template_id
same owner
resulting level
obtained_method = FUSION
```

Example:

```text
Curry #2 Lv2
+
Curry #4 Lv4
↓
Curry #6 Lv5
```

Do not mutate one source card into the result.

Preserve provenance through Fusion/FusionSource history.

---

# 25. Upgrade Item

Confirmed:

```text
+1 Card Level
maximum Level 5
```

Upgrade Item keeps:

```text
same card_instance_id
same serial
```

and consumes the item.

If card is Level 5, reject before consuming.

---

# 26. Market

Fixed-price marketplace.

Conceptual commands:

```text
/market
/sell
/buy
/unlist
```

Confirmed:

```text
Market fee = 0%
Listing fee = 0
Seller receives 100% of price
```

Listed cards must be protected against:

```text
Fusion
Quicksell
Direct Trade
Duplicate listing
```

Whether a listed card can participate in Battle is TBD.

Market purchases must be atomic later.

---

# 27. Direct Trade

Direct Player-to-Player trade is supported.

Potential trade contents:

```text
cards
optional Gold
```

Confirmed:

```text
Trade fee = 0%
Both players confirm final offer
Any offer modification clears prior confirmations
```

Cards in active trade are locked against:

```text
Market
Fusion
Quicksell
Other Trades
```

Confirmed Direct Trade limits: 10 Card Instances and 20,000,000 Gold per
participant. A Trade expires after 3 minutes and unlocks its Cards. The Discord
interface uses one `/trade user:<user>` command followed by buttons and modals.
Both participants must accept the invitation before the offer editor becomes
available. Card and Gold modals require an `add` or `remove` action.

---

# 28. Lineup

Current primary concept:

```text
5v5
```

Slots:

```text
PG
SG
SF
PF
C
```

Eligibility:

```text
Primary Position   → allowed
Secondary Position → allowed
Other Position     → not allowed
```

Lineup Strategy owns Player-controlled Tendencies keyed by Card Instance ID.
`/strategy` selects a current lineup player before editing Decision, Shot
Profile, Creation Role, and Usage. Tendencies change bounded action-selection
weights and never modify Card Template data or shot accuracy. Offense, Tempo,
Defense, and Rebounding are edited independently; Strategy has no Preset field.

MVP currently assumes no bench.

---

# 29. Battle

Battle Engine v3.2 is a deterministic, first-to-21 PVE simulation with runtime
playback, immutable Match snapshots, contextual Traits, and saved Lineup
strategy.

The Match snapshot includes:

```text
base stats
Card Level
traits
Trait Tier
tendency profile
position
height
matchup context
controlled RNG
player and AI strategy
engine, strategy-resolver, Trait-resolver, and Tendency-resolver versions
```

Conceptual possession flow:

```text
Center-versus-Center tip-off
        ↓
Winning team's Main Handler receives the ball
        ↓
Resolve possession phase
        ↓
Select a bounded strategy-and-tendency-weighted action chain
        ↓
Resolve defensive coverage
        ↓
Base Stats
        ↓
Card Level Modifier
        ↓
Contextual Trait hooks
        ↓
Matchup Modifier
        ↓
Controlled RNG
        ↓
Outcome
```

Implemented action vocabulary:

```text
TIP_OFF, CHECK_IN
THREE_POINT, MID_RANGE, DRIVE, POST_UP
PICK_AND_ROLL, DRIVE_AND_KICK, PICK_AND_POP
PASS, EXTRA_PASS, POST_KICK_OUT, DRIBBLE_HANDOFF
CREATE_SEPARATION, CUT, OFF_BALL_SCREEN, RELOCATE
FAST_BREAK, SECOND_CHANCE, RESET_OFFENSE
```

Battle output includes:

```text
Final Score
Play-by-play
Box Score
frozen action, coverage, strategy, and Trait activation data
```

Box-score concepts:

```text
PTS
REB
AST
STL
BLK
TOV
FG
3PT
```

Approved F2P Battle economy:

```text
Cooldown: 60 minutes
Loss reward: 300 + Player Score * 20
Win reward: 1,000 + Score Difference * 50
Reward cap: 3,000 Gold
Full-reward Battles per UTC day: 16
Later Battles: 25% reward
```

The Player selects `street`, `pro`, `all-star`, or `legend` before Battle.
The minimum runtime lineup strengths are 0, 70, 80, and 88; reward multipliers
are 0.85, 1.00, 1.20, and 1.40. AI selection remains seeded and random within
the selected bracket. A win adds 5% reward per consecutive win, bounded per
bracket at 10%, 25%, 40%, or 50%; a loss resets the streak. Rewards are written
to the immutable economy ledger once per public Match ID.

`/strategy` edits Offense, Tempo, Defense, Rebounding, and Main Handler for the
active Lineup. Main Handler is stored as a lineup slot (`PG`, `SG`, `SF`, `PF`,
or `C`) and defaults to `PG`. The configured player receives the opening tip
when their team wins it and receives the check-in after the opponent scores.
The Center normally performs the check-in; if the Center is Main Handler,
another teammate inbounds. Strategy drafts remain in process memory and only
one normalized JSONB snapshot is written on Save. Migration 030 seeds the
original 20-Trait definition catalog. Migration 031 upgrades saved Lineup
strategies to `strategy-v2` with the Main Handler field; assigning Traits to
individual Card Templates remains a separate catalog-data task.

Migration 033 adds Tough Shot Maker, Contact Finisher, Clutch Performer,
Clutch Defender, Comeback Catalyst, Momentum Scorer, and Cold-Blooded.
Migration 034 removes the interim Card Template Tendency field and upgrades
Lineup `strategy_config` to `strategy-v3` with Player-controlled Tendencies.
Migration 035 removes Presets, upgrades Lineup strategy to `strategy-v4`, and
makes Tendencies specific to each lineup Card Instance.
Clutch starts at
`targetScore - 4` with a margin of at most 4; comeback context requires a
6-point deficit; momentum requires two consecutive scoring possessions by the
same player; and Cold-Blooded requires a potential game-winning attempt.

Fatigue, substitutions, and PvP remain TBD. The 10-second Battle cooldown is a
temporary test override; the approved production cooldown remains 60 minutes.

---

# 30. Card Ownership History

Ownership changes must eventually be auditable.

Possible reasons:

```text
PACK
MARKET
DIRECT_TRADE
FUSION_CREATED
ADMIN_TRANSFER
EVENT_REWARD
```

Market/Trade transfer keeps the same Card Instance.

Fusion creates a new Card Instance.

---

# 31. Card Lifecycle

Recommended persistent statuses:

```text
ACTIVE
DESTROYED_FUSION
DESTROYED_QUICKSELL
```

Temporary availability:

```text
market_lock
trade_lock
```

A Card Instance must not be in conflicting operations simultaneously.

---

# 32. Conceptual Data Model

Architecture baseline includes:

```text
Player
Wallet
EconomyTransaction

CardTemplate
CardInstance
CardMintCounter
CardOwnershipHistory

TraitDefinition
CardTemplateTrait

Fusion
FusionSource

MarketListing

Trade
TradeParticipant
TradeCard

Lineup
LineupSlot

Match
MatchTeam
MatchPlayer

PlayerCooldown
```

This is an architecture target.

Do not implement all tables immediately.

---

# 33. Important Database Constraints

Expected where practical:

```text
discord_user_id UNIQUE
wallet balance >= 0
card_level between 1 and 5
serial unique per Card Template
one active Market Listing per Card Instance
no duplicate card in same lineup
valid Trait Tier
market price > 0
trade Gold offer >= 0
```

Database constraints complement application validation.

---

# 34. Cooldown Model

Preferred conceptual model:

```text
player_cooldown
----------------
player_id
cooldown_type
available_at
updated_at
```

Composite uniqueness:

```text
(player_id, cooldown_type)
```

Potential types:

```text
CLAIM
DAILY
FREE_DROP
```

Implement only when cooldown features reach their milestone.

---

# 35. Configuration

Balance values should live in centralized configuration rather than scattered magic constants.

Potential config domains:

```text
rarity
pack
reward
quicksell
Card Level
Trait coefficients
battle
```

Initial implementation may use version-controlled config files.

Do not create DB-managed live configuration prematurely.

---

# 36. Transactions

Critical operations must eventually use PostgreSQL transactions:

```text
Market Purchase
Direct Trade
Fusion
Quicksell
Paid Pack
Upgrade Item
Rewards
Admin Corrections
```

General rule:

```text
BEGIN
lock rows
validate
apply changes
write history/audit
update counters
COMMIT
```

On failure:

```text
ROLLBACK
```

A Discord success response should only happen after successful COMMIT.

---

# 37. Concurrency

The system must later handle multiple simultaneous requests safely.

Expected concepts:

```text
PostgreSQL transactions
SELECT ... FOR UPDATE
unique constraints
idempotency
consistent lock ordering
```

Example:

Two players trying to buy the same Card Listing must not both succeed.

---

# 38. Architecture Documentation

Architecture Phase is complete.

Expected docs:

```text
docs/architecture/
├── 01-system-context.md
├── 02-high-level-architecture.md
├── 03-domain-modules.md
├── 04-data-model.md
├── 05-card-lifecycle.md
├── 06-transaction-rules.md
└── 07-project-structure.md
```

Requirements live under:

```text
docs/requirements/
├── game-requirements.md
└── economy-pack-baseline.md
```

---

# 39. High-Level Architecture Document

Current agreed summary:

```text
Node.js
discord.js
PostgreSQL

Modular Monolith

Discord Interaction
        ↓
Command / Interaction Layer
        ↓
Service / Domain Layer
        ↓
Repository Layer
        ↓
PostgreSQL
```

---

# 40. Target Project Structure

Direction:

```text
SlamDunk/
│
├── src/
│   ├── bot/
│   ├── modules/
│   ├── database/
│   ├── config/
│   └── shared/
│
├── tests/
├── scripts/
├── migrations/
│
├── docs/
│   ├── requirements/
│   └── architecture/
│
├── .env
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── PROJECT_CONTEXT.md
```

Do not create empty complexity just to match this target tree.

---

# 41. Development Philosophy

This is also a software-engineering learning project.

Codex should:

- make small, reviewable changes;
- explain important architecture choices;
- prefer readable JavaScript;
- keep SQL concepts visible;
- avoid magic;
- avoid unnecessary frameworks;
- avoid unrelated refactors;
- not implement future milestones automatically;
- preserve docs and existing design decisions.

When multiple approaches are reasonable:

1. mention alternatives briefly;
2. recommend one;
3. explain why it fits SlamDunk.

---

# 42. Implementation Roadmap

Planned sequence:

```text
M0 — Project Bootstrap
M1 — Discord Foundation (/ping)
M2 — PostgreSQL Foundation
M3 — Player + Wallet
M4 — /profile
M5 — Economy Ledger
M6 — /claim
M7 — Card Template + Traits
M8 — Card Instance
M9 — /drop
M10 — /collection
M11 — Lineup
M12 — Battle MVP
M13 — Quicksell
M14 — Fusion / Upgrade
M15 — Market
M16 — Direct Trade
```

This sequence is intentional.

---

# 43. Completed Milestones

## Requirements

Sufficiently complete to continue.

Many balance values intentionally remain TBD.

## Architecture

Completed.

## M0 — Project Bootstrap

Completed.

Expected concepts from M0:

```text
Node.js project initialized
ES Modules
discord.js installed
pg installed
dotenv installed

src/
tests/
scripts/
migrations/
docs/

.env
.env.example
.gitignore
package.json
README.md
```

Always inspect actual repository rather than assuming exact file contents.

## M1 — Discord Foundation

**Completed according to the latest project status.**

The purpose of M1 was to prove:

```text
Discord User
    ↓
Discord Interaction
    ↓
Command Handler
    ↓
SlamDunk Application
    ↓
Discord Response
```

Expected M1 behavior:

```text
/ping
→ Pong!
```

Expected M1 architectural concepts:

```text
discord.js Client
GatewayIntentBits.Guilds
Guild slash-command registration
interactionCreate handling
lightweight command registry
/ping command module
environment-based credentials
ready logging
basic error handling
```

Likely M1 structure included files conceptually similar to:

```text
src/
├── bot/
│   ├── client/
│   │   └── discord-client.js
│   ├── commands/
│   │   └── ping.command.js
│   └── events/
│       └── interaction-create.event.js
├── config/
│   └── env.js
├── app.js
└── index.js

scripts/
└── register-commands.js
```

However:

> Do not assume the exact implementation from this context. Inspect the real repository before M2.

M1 should not have introduced PostgreSQL connection or gameplay features.

## M2 — PostgreSQL Foundation

Completed.

Implemented concepts:

```text
pg Pool
DATABASE_URL configuration
startup connectivity check with SELECT 1
database-before-Discord startup order
graceful pool shutdown
safe connection error handling
```

Successful `/ping` execution after the PostgreSQL startup check confirmed the
M2 end-to-end application flow.

## M3 — Player + Wallet

Completed.

Implemented concepts:

```text
explicit SQL migration runner
schema_migrations history
players table
wallets table
Player module
Economy/Wallet module
atomic Player + Wallet creation
database constraints for identity, progression, and non-negative balances
```

M3 intentionally did not add a Discord command, Economy Ledger, currency
mutation, or later gameplay features.

## M4 — /profile

Completed.

Implemented concepts:

```text
/profile guild slash command
shared runtime/registration command catalog
interaction context with Player and Economy services
Player + Wallet lookup/creation through M3 services
Discord profile embed presenter
safe deferred-interaction error handling
```

M4 intentionally did not add migrations, Economy Ledger, currency mutation,
or later gameplay features.

## M5 — Economy Ledger

Completed.

Implemented concepts:

```text
003_create_economy_transactions.sql
immutable economy transaction audit trail
GOLD and SHARDS currency validation
atomic Wallet + ledger updates
credit, debit, transfer, and sufficient-balance operations
mandatory idempotency keys for currency movements
consistent wallet lock ordering
domain error codes for economy failures
PostgreSQL integration coverage using node:test
```

M5 intentionally did not add `/claim`, cooldowns, rewards, or later gameplay
features.

## M6 — /claim

Completed.

Implemented concepts:

```text
004_create_player_cooldowns.sql
generic PlayerCooldown persistence keyed by player and cooldown type
Reward module with atomic claimReward operation
PostgreSQL-authoritative cooldown time
10-minute CLAIM cooldown
uniform random integer reward from 300 through 500 Gold
atomic cooldown + Wallet + EconomyTransaction update
Discord interaction idempotency
/claim guild slash command and cooldown presenter
integration and command tests using node:test
```

M6 intentionally did not add `/daily`, Cards, Pack, Battle, Market, Trade, or
Fusion.

## M7 — Card Template + Traits

Completed.

Implemented concepts:

```text
005_create_card_templates_and_traits.sql
card_templates table with identity, positions, rarity tier, OVR, and 8 base stats
trait_definitions catalog table
card_template_traits fixed many-to-many assignments
Trait Tier stored as 1 / 2 / 3 and exposed as I / II / III
Total Trait Level calculated as the sum of assigned Trait Tiers
Card Template and Trait repositories/services
inactive Trait assignment protection
PostgreSQL constraints for positions, rarity tier, OVR, and Trait Tier
PostgreSQL integration coverage using node:test
```

M7 intentionally did not seed a final Trait catalog or finalize Tier 1–6 names,
base-stat maximums, Trait battle coefficients, or rarity Trait Level budgets.
It did not add Card Instance, serial/mint state, ownership, `/drop`, or later
gameplay features.

## M8 — Card Instance

Completed.

Implemented concepts:

```text
006_create_card_instances.sql
card_mint_counters with atomic per-template serial allocation
card_instances with owner, serial, Card Level, status, obtain method, and locks
card_ownership_history with an auditable initial ownership event
Card Instance repository/service and transactional mint operation
Card Template lookup by stable rarity code
/cooldowns supporting the current CLAIM cooldown
/rarity listing Card Templates by named rarity
PostgreSQL integration and Discord command tests using node:test
```

M8 intentionally did not implement Drop sessions, Drop odds, `/drop`,
`/collection`, ownership transfer, destruction, Fusion, Market, Trade, Lineup,
or Battle. Drop request idempotency will be introduced with the Drop operation
in M9.

## M9 — /drop

Completed.

Implemented concepts:

```text
007_create_pack_sessions.sql
persisted DropSession and DropSessionCandidate records (renamed by migration 013)
one open Free Drop per Player
three distinct packable Card Template candidates
button-based Discord selection
only the selected candidate is minted
random initial Card Level from 1 through 5
atomic Card Instance, mint counter, ownership history, session, and cooldown
idempotent selection replay protection
FREE_DROP cooldown shown by /cooldowns
PostgreSQL integration and Discord command/component tests using node:test
```

M9 uses the documented playtest baseline: 10-minute Free Drop
cooldown, three candidates, and the named-rarity simulation weights. These remain
centralized, adjustable configuration rather than final production balance.
The current implementation uses a 10-second selection window and automatically
selects candidate 1 on timeout. M9 did not seed a fictional Card Template catalog and did not
implement paid Packs, `/collection`, Lineup, Battle, Quicksell, Fusion, Market,
or Trade.

## M10 — /collection

Completed.

Implemented concepts:

```text
read-only Collection module
active Card Instance queries scoped to the owning Player
Card Template details joined for display
default acquisition order from oldest to newest
newly obtained cards appended to the end
10-card pagination
/collection guild slash command and embed presenter
integration and command tests using node:test
```

M10 did not add a migration or implement Lineup, Battle, Quicksell, Fusion,
Market, or Trade.

## M11 — Lineup

Completed.

Implemented concepts:

```text
008_create_lineups.sql
one active lineup per Player
PG, SG, SF, PF, and C slots with no bench
primary/secondary position eligibility
owned ACTIVE Card Instance validation
no duplicate Card Instance in one lineup
/lineup view, set, and remove subcommands
public Card IDs and Collection positions exposed through /collection
integration and command tests using node:test
```

M11 did not implement Battle, Quicksell, Fusion, Market, or Trade.

## M12 — Battle MVP

Completed.

Implemented concepts:

```text
009_create_battle_matches.sql
persisted PVE_5V5 Match, MatchTeam, and MatchPlayer snapshots
complete active Lineup requirement
deterministic seeded simulation
provisional offense, defense, Card Level, matchup, and score configuration
AI lineup selected from eligible Card Templates
final score and PTS box score
idempotent Discord interaction handling
Player and participating Card Instance game counters
/battle guild slash command and result embed
integration and command tests using node:test
```

Trait data is snapshotted but Trait effects are not applied because coefficients
remain TBD. M12 has no rewards, cooldown, play-by-play, fatigue, substitutions,
PvP, Quicksell, Fusion, Market, or Trade. Battle formulas remain playtest
configuration rather than final production balance.

---

# 44. M13 — Quicksell

Completed.

Implemented concepts:

```text
/quicksell params guild slash command with persisted preview and Confirm/Cancel
rarity-based Shard reward configuration
ACTIVE ownership and availability validation
lineup, market-lock, and trade-lock protection
DESTROYED_QUICKSELL lifecycle state with ownership audit
mint circulation decrement
atomic Shard credit and immutable EconomyTransaction
integration and command tests using node:test
```

Current Quicksell selectors are `all`, named rarity, primary/secondary position,
public Card ID, or current Collection position. Preview results are ordered by
highest Shard value first. User-locked, lineup, Market, and Trade cards are
excluded. `/lock card_id` protects an owned active card from Quicksell and
`/unlock card_id` removes that protection. The protection is also cleared when
ownership changes.

M13 did not implement Fusion, Market, Trade, or Shard exchange.

---

# 45. M14 — Fusion / Upgrade

Completed.

Implemented concepts:

```text
010_create_fusions_and_upgrade_items.sql
/upgrade with same-template, ownership, ACTIVE, lock, and lineup checks
capped Fusion level sum and new Card Instance/serial
DESTROYED_FUSION source lifecycle and provenance records
minimal player item inventory
Level Up item (+1 level, maximum Level 5)
Upgrade Item usage audit
local admin Level Up grant script
atomic PostgreSQL transactions
integration and command tests using node:test
```

## M15 — Market

Completed.

Implemented concepts:

```text
011_create_market_listings.sql
separate /market, /sell, /unlist, and /buy commands
fixed positive Gold price
0% listing and sale fee; seller receives full price
one ACTIVE listing per Card Instance
market lock lifecycle and duplicate-listing protection
atomic listing purchase with sorted Wallet locks
MARKET_PURCHASE and MARKET_SALE ledger entries
Card ownership transfer and ownership history
integration and command tests using node:test
```

Battle eligibility for listed cards remains TBD.

## M16 — Direct Trade

Completed.

Implemented concepts:

```text
012_create_direct_trades.sql
013_separate_drop_from_pack.sql
/trade create, view, add-card, remove-card, set-gold, confirm, and cancel
exactly two Player participants
persisted invitation acceptance required from both participants
optional Card and Gold offers
trade lock lifecycle and one active Trade participation per Card Instance
all confirmations cleared whenever an offer changes
automatic atomic execution after both participants confirm
gross Gold availability validation and net DIRECT_TRADE ledger movements
Card ownership transfer, lineup cleanup, and ownership history
0% Trade fee
integration and command tests using node:test
```

Migration 026 adds invitation acceptance. Each participant may offer up to 10
Cards and 20,000,000 Gold; the Trade expires after 3 minutes. The
planned M0–M16 roadmap is now complete; the next milestone requires a new
product decision.

---

# 46. Current Database Foundation

The repository now contains:

```text
pg Pool
transaction helper
explicit migration runner
001_create_players.sql
002_create_wallets.sql
003_create_economy_transactions.sql
004_create_player_cooldowns.sql
005_create_card_templates_and_traits.sql
006_create_card_instances.sql
007_create_pack_sessions.sql
008_create_lineups.sql
009_create_battle_matches.sql
010_create_fusions_and_upgrade_items.sql
011_create_market_listings.sql
012_create_direct_trades.sql
Player repository/service
Wallet repository/service
immutable EconomyTransaction repository
atomic credit, debit, transfer, and Direct Trade settlement operations
Reward service with atomic `/claim` cooldown and Gold credit
Card Template repository/service
Trait Definition and Card Template Trait repository/service
Card Instance, mint-counter, and ownership-history repositories
transactional Card Instance mint service
Drop Session/Candidate repository and transactional Free Drop service
separate Pack catalog service keyed by Pack code
read-only Collection repository/service
Lineup repository/service with five position slots
Battle repository/service with persisted PvE snapshots
Fusion and Upgrade Item repository/service with audit history
Market repository/service with atomic Gold and Card transfer
Direct Trade repository/service with confirmation and atomic settlement
/profile command and profile embed presenter
/claim command and cooldown presenter
/drop command and button selection handler
/collection command and embed presenter
/lineup view, set, and remove subcommands
/battle command and result presenter
/upgrade and /level-up commands
separate /market, /sell, /unlist, and /buy commands
/trade create, view, offer, confirm, and cancel subcommands
/cooldowns command for CLAIM and FREE_DROP cooldown status
/rarity command for Card Template discovery by tier
/odds command for separate Drop and Pack rarity distributions
```

Inspect the real repository and migration history before changing this
foundation.

---

# 47. Security

Never expose:

```text
DISCORD_TOKEN
DATABASE_PASSWORD
secret DATABASE_URL values
other credentials
```

`.env` must be ignored by Git.

`.env.example` contains names/placeholders only.

If a real secret is found committed:

- do not repeat it;
- report the security issue;
- stop unsafe propagation.

---

# 48. Codex Repository Working Rules

For every task:

1. Inspect repository structure.
2. Read `PROJECT_CONTEXT.md`.
3. Read relevant requirements docs.
4. Read relevant architecture docs.
5. Understand existing implementation.
6. Identify the minimum necessary change.
7. Follow architecture boundaries.
8. Implement only requested milestone.
9. Validate.
10. Report actual results honestly.
11. Do not reveal secrets.
12. Do not silently resolve conflicting requirements.

If this context conflicts with a newer explicit user-approved document:

```text
report the conflict
```

Do not guess.

---

# 49. Finalized Decision Summary

Treat these as confirmed unless later explicitly changed:

```text
Name: SlamDunk
Theme: real NBA players

Node.js
JavaScript
ES Modules
discord.js
PostgreSQL
pg
dotenv

Architecture: Modular Monolith

Discord
→ Command
→ Service/Domain
→ Repository
→ PostgreSQL

Card Template != Card Instance

Legacy overall: temporarily retained for internal Battle AI selection only
7 Battle ratings plus physical height

One Card Template per player and rarity pair in the current schema

Card Level: 1–5
Initial Drop/Pack Level: weighted 45% / 28% / 14% / 8% / 5%
Max Card Level: 5

Fusion:
same Card Template
newLevel = min(A.level + B.level, 5)
destroy both sources logically
create new Card Instance
new serial
preserve source records

Upgrade Item:
+1 Level
max 5
same Card Instance

First MVP:
7 initial rarities

Rarities:
Base, Common, Uncommon, Alpha, All-Star, Superstar, Goat

Traits:
fixed by Card Template
Trait Tier fixed by Card Template
I / II / III

Trait Level value:
I   = 1
II  = 2
III = 3

Total Trait Level is rarity-dependent.
Rarity does NOT directly define the number of distinct Traits.

Low serial:
no official stat bonus

Market:
fixed price
0% fee
0 listing fee

Direct Trade:
supported
0% fee

Upgrade:
0 Gold fee

Currencies:
Gold
Shards

Critical ownership/economy operations:
atomic PostgreSQL transactions eventually
```

---

# 50. Intentionally Unresolved / TBD

Do not silently finalize:

```text
hard circulation caps

final Free Drop probabilities

exact battle effect/formula of each Trait Tier

final Total Trait Level ranges after battle balancing

final number of Traits in the global MVP Trait catalog

final pack cooldown
pack timeout behavior
additional paid Pack products and their prices

additional Gold sinks

final Card Level battle modifier

battle formulas
simulation depth
fatigue
substitutions
PvP mode
battle rewards

bench
coach
chemistry
duo/synergy
```

The current economy and pack simulation baselines for these unresolved values
are recorded in `docs/requirements/economy-pack-baseline.md`. They remain
provisional until explicitly approved as production balance.

If implementation requires one of these and no later decision exists, surface it as TBD instead of inventing a permanent rule.

---

# 51. Codex Response Format After Each Milestone

Preferred:

```text
## Milestone Status

COMPLETE / INCOMPLETE

## Repository Review

What existed before the change.

## Changes Made

What was implemented.

## Final Relevant Project Structure

Relevant tree only.

## Files Created

List.

## Files Modified

List.

## Dependencies

Only if changed.

## Execution Flow

Explain runtime flow.

## Environment Variables Used

Names only.

## Validation Performed

Actual checks and results.

## Manual Verification

Steps requiring developer credentials/UI.

## Architecture Notes

Important decisions.

## Problems / Warnings

Truthful unresolved issues.

## Next Milestone

Name only.
Do not implement automatically.
```

---

# 52. Current State for Codex

At the time this context was produced:

```text
Requirements     → DONE enough to implement
Architecture     → DONE
M0 Bootstrap     → DONE
M1 Discord       → DONE
M2 PostgreSQL    → DONE
M3 Player/Wallet → DONE
M4 /profile      → DONE
M5 Economy Ledger → DONE
M6 /claim        → DONE
M7 Card Template + Traits → DONE
M8 Card Instance → DONE
M9 /drop         → DONE
M10 /collection  → DONE
M11 Lineup       → DONE
M12 Battle MVP   → DONE
M13 Quicksell    → DONE
M14 Fusion / Upgrade → DONE
M15 Market        → DONE
M16 Direct Trade  → DONE
```

Current rarity persistence:

```text
rarities catalog: rarity_code + display_name + rarity_rank
card_templates reference rarities through rarity_id
Drop and Pack odds are keyed by rarity_code independently
rarity_rank is ordering metadata, not Card rarity identity
```

Migration `015_create_rarity_catalog_and_reset_cards.sql` replaced the old
numeric Card Template rarity field. As explicitly approved for development,
it removed existing Card Instances and their dependent operational records,
preserved battle snapshots, and credited every existing Player 20,000 Gold
through an auditable EconomyTransaction.

Migration `016_add_public_card_ids.sql` adds a unique nine-digit public ID to
each Card Instance. Internal foreign keys keep using `card_instance_id`.
Player-facing `card_id` options accept `public_card_id` (with optional `!`
prefix) or the card's current one-based position in `/collection`. The default Collection order is
oldest to newest, so newly obtained Drop/Pack cards appear at the end.

Migration `017_create_collection_preferences.sql` and `/sort` persist a Player's
Collection ordering. Supported choices include rarity, Card Level, newest,
oldest, player name, position, and implemented individual stats. Calling
`/sort` without `sort_by` selects Rarity. A Player with no preference remains
oldest-first so newly obtained Drop/Pack cards appear at the end. Collection
positions and `card_id` resolution always use the same saved sort.
Migration `024_remove_overall_collection_sort.sql` converts legacy OVERALL
preferences to RARITY and removes OVERALL from the allowed sort values.

Battle Engine v2 is implemented and documented in
`docs/architecture/09-battle-engine.md`. It is a seeded, deterministic,
possession-based first-to-21 simulation with matchup-aware action selection,
shot quality, turnovers, rebounds, box scores, play-by-play, and explicit Trait
hook stages. Migration 022 persists versioned immutable inputs, ordered
play-by-play, possession counts, and complete player box scores. Trait effects,
rewards, and PvP remain outside this version. Migration 020 resets incompatible Card data, removes edition,
season, rebounding, athleticism, weight, and release date, and renames
`inside_scoring` to `finishing`. The 68-card playtest catalog and its sourcing rules are
documented in `docs/requirements/card-rating-data.md`. Collection and Market
browse responses support owner-scoped Previous/Next page buttons.

AI opponent selection is seed-based and lineup-aware. Each position selects
randomly from a bounded group of Card Templates whose Actual Stat strength is
closest to the Player Card in that slot. AI Card Level matches the opposing
Player Card Level. The chosen lineup is persisted in the immutable Match
snapshot, so a retry never rerolls the opponent.

Battle runtime presentation expands persisted possessions into short setup,
shot-result, and rebound lines and reveals one line every 1.5 seconds instead
of immediately displaying the final score. Timeline lines omit timestamps,
box every Player name with Discord inline code, and use compact `🔸`/`🔹`
markers to identify the team controlling the event. Shot attempts and their
results are separate. The live embed omits play/possession progress text; its
left border is amber for a Team 1 lead, blue for a Team 2 lead, and slate for a
tie.
The owner-only `Simulate` button skips playback and
finishes the game immediately. The game message and postgame report are
separate Discord messages. The engine resolves direct defenders by position
and records primary/help shot matchup participants in structured PBP.

The accepted Game Display prototype remains a layout reference for native
Discord embeds; no PNG is rendered every possession. Game Display omits the
`Your Starting 5` subtitle. `Your Matchup` renders the five AI opponents as one
horizontal PNG; missing artwork repeats the generic fallback image. Game Display
derives its aligned PTS/REB/AST tables only from fully revealed possessions.
`GAME STATS` is sent separately after natural completion or Simulate as one
transient 824 x 1024 PNG with the final score, complete two-Team box score, and
totals. Long Player and Discord names are truncated to preserve table layout.
The report omits engine, possession, and reward metadata.

`/profile`, `/collection`, and `/lineup view` accept an optional Discord `user`
for read-only viewing of another existing Player. Omitting `user` retains the
self-view behavior. Looking up someone else never creates their Player record;
Lineup set/remove stay self-only, and Collection page buttons remain restricted
to the user who opened the view.

Matches retain numeric `match_id` for internal PostgreSQL relationships and add
a unique lowercase 32-character hexadecimal `public_match_id`. New public IDs
come from 16 random bytes. Discord shows this public ID immediately before
`Your Matchup` and uses it in Battle component identifiers. Migration 023
backfills existing Matches and enforces the public ID format.

Most interactive Discord responses with components use a shared 10-second
inactivity timeout. A valid component interaction resets the timer; expiration
disables the components. Battle overrides this with a 60-second Simulate button
lifetime. Direct Trade controls use the Trade's full 3-minute lifetime. Drop
keeps its existing timeout behavior and chooses
candidate 1 when no selection is made.

Migration 026 adds persisted invitation acceptance to Direct Trade. A Trade
cannot accept offer edits or final confirmation until both participants have
accepted the invitation.

Migration 021 changes Card Template uniqueness to case-insensitive player name
plus rarity and compensates every existing Player with 20,000 Gold through one
immutable `CARD_RESET_COMPENSATION` EconomyTransaction.

The Discord UI follows one shared visual system: amber primary actions, blue
secondary navigation, green success, red destructive/error, and neutral slate
for inactive state. Player-facing card rows use one compact format with Player,
rarity, positions, Card Level, and public Card ID; OVR and serial are omitted.
Collection uses 10 rows per page and icon-only pagination. Profile and
Collection use the viewed Discord user's avatar. Lineup, Drop, Pack, and Battle
reuse transient artwork composites with `unknown-player.png` as the fallback.
All component timeouts disable controls and show `Interaction Expired`.

Before defining a new milestone:

```text
inspect the real repository
```

Do not rewrite valid M1–M16 code merely to match an example file structure.

---

# 53. Core Principle

This document gives project context.

It is **not permission to implement all future features**.

The intended workflow is:

```text
read context
↓
read milestone request
↓
inspect repository
↓
implement only that milestone
↓
validate
↓
review
↓
next milestone
```

Optimize for:

```text
correctness
clarity
architecture consistency
auditability
learning value
small reviewable changes
```
