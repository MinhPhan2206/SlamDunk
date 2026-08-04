# SlamDunk — Codex Project Context

> **Purpose:** Persistent project context for Codex.  
> **Current status:** Requirements baseline completed, Architecture Phase completed, M0–M5 completed.
> **Next milestone:** M6 — /claim.
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

A Card Template defines a specific version/edition of a player.

Example:

```text
Stephen Curry
2026 Base Edition
Legendary
PG
```

Shared Template-level properties include:

```text
player_name
edition
season
rarity
positions
overall
base stats
traits
trait tiers
```

Multiple editions of the same NBA player may exist.

Example:

```text
Stephen Curry — Base Edition
Stephen Curry — Playoffs Edition
```

Those are separate Card Templates.

---

# 13. Card Stats

Confirmed OVR range:

```text
60–99
```

Keep 8 base stats:

1. Inside Scoring
2. Mid Range
3. Three Point
4. Playmaking
5. Perimeter Defense
6. Interior Defense
7. Rebounding
8. Athleticism

OVR does not have to be a simple arithmetic mean.

Position-based weighting may later be used.

Exact formulas are TBD.

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

Cards received directly from pack/drop get:

```text
random integer level from 1 to 5
```

Card Level belongs to Card Instance.

It does not modify Template identity, rarity, traits, or Trait Tier.

Exact battle effect of Card Level is still TBD.

Do not hard-code a final level coefficient yet.

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
7 rarity tiers
```

Highest rarity:

```text
Hall of Fame
```

Previous working rarity names:

```text
Base
Common
Uncommon
Rare
Elite
Legendary
Hall of Fame
```

Only `Hall of Fame` is explicitly confirmed as the renamed top rarity.

Final rarity probabilities are TBD.

The intended curve is very steep, inspired by the provided Basketbot rarity reference.

Do not silently finalize draft probabilities.

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
Hall of Fame: 20–30

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

Therefore, even a Hall of Fame card with:

Total Trait Level = 20–30

does not need 20–30 different Traits.

A Hall of Fame card may instead contain approximately 7–12 meaningful Traits depending on their tiers.

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

the five cards with the highest OVR

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

For example, a slightly lower-OVR defender with:

Screen Navigator III
Point-of-Attack Defender III

may be a better choice against an elite perimeter guard than a higher-OVR offensive card.

Similarly:

Rim Protector III

may be extremely valuable against a paint-heavy lineup but less valuable against a five-out shooting lineup.

This matchup dependency is intentional.

The Trait system should make players ask:

"Which cards work best together, and which lineup works best against this opponent?"

rather than only:

"Which five cards have the highest OVR?"

# 20. Pack System

Conceptually:

```text
/pack
```

Current direction:

- reveal multiple candidates;
- player chooses one;
- only selected card should be minted;
- selected Card Instance gets initial Level 1–5.

Still TBD:

```text
final cooldown
final candidate count
timeout behavior
paid pack structure
pack prices
final rarity probabilities
```

Previous numbers such as 15 minutes / 3 candidates were draft only unless later approved.

---

# 21. Reward Commands

Conceptually planned:

```text
/claim
/daily
/pack
```

Still TBD:

```text
Claim cooldown
Claim reward
Daily cooldown
Daily reward
Pack cooldown
```

Database must eventually be the source of truth for cooldown state.

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

Final Shard values are TBD.

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
/cancel
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

Still TBD:

```text
max cards per trade
trade expiry
final Gold+Cards limits
```

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

MVP currently assumes no bench.

---

# 29. Battle

Auto-simulation.

Inputs eventually include:

```text
base stats
Card Level
traits
Trait Tier
position
height
matchup context
controlled RNG
```

Conceptual possession flow:

```text
Select Offensive Player
        ↓
Select Action
        ↓
Determine Defender
        ↓
Base Stats
        ↓
Card Level Modifier
        ↓
Relevant Traits
        ↓
Matchup Modifier
        ↓
Controlled RNG
        ↓
Outcome
```

Initial action concepts:

```text
Inside Shot
Mid-range Shot
Three-pointer
Pass
```

Battle output eventually:

```text
Final Score
Play-by-play
Box Score
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

Still TBD:

```text
exact formulas
level modifier
simulation depth
fatigue
substitutions
PvP live/asynchronous
battle rewards
```

Do not finalize these without explicit product decision.

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
FREE_PACK
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
M9 — /pack
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

---

# 44. Current Next Milestone

Current next milestone:

```text
M6 — /claim
```

Codex should wait for an explicit M6 task/prompt before implementation.

---

# 45. M6 Scope Guardrail

The next milestone is `/claim`, but its exact acceptance criteria must come
from the explicit milestone prompt.

Do not automatically implement `/daily`, Cards, Pack, Battle, Market, Trade,
or Fusion as part of M6.

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
Player repository/service
Wallet repository/service
immutable EconomyTransaction repository
atomic credit, debit, and transfer Economy service operations
/profile command and profile embed presenter
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

OVR range: 60–99
8 base stats

Multiple player editions may exist

Card Level: 1–5
Initial Pack Level: random 1–5
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
7 rarity tiers

Top rarity:
Hall of Fame

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

final rarity names except Hall of Fame
final rarity probabilities

exact battle effect/formula of each Trait Tier

final Total Trait Level ranges after battle balancing

final number of Traits in the global MVP Trait catalog

final pack cooldown
final candidate count
pack timeout behavior
paid pack structure/prices

Claim cooldown/reward
Daily cooldown/reward
Quicksell values

additional Gold sinks

final Card Level battle modifier

whether market-listed cards can battle
max cards per direct trade
final trade Gold/card limits
trade expiry

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
M6 /claim        → NEXT
```

Before doing M6:

```text
inspect the real repository
```

Do not rewrite valid M1–M5 code merely to match an example file structure.

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
