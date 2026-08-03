You are joining an existing software project called SlamDunk.

Before writing, modifying, generating, or deleting any source code, you must first understand the project context, product decisions, and architecture described below and in the repository documentation.

This message defines the current project baseline.

Do NOT implement anything yet.

Your first task is only to inspect the repository, read the project documentation, understand the architecture and current decisions, and report your understanding back to me.

==================================================
1. PROJECT NAME
==================================================

Project name:

SlamDunk

SlamDunk is a Discord-based basketball collectible card game.

The game uses real NBA players as the card/player theme.

It is NOT a cyberpunk or fictional-basketball project.

The current project is still in early development.

Requirements and architecture have been designed, but gameplay implementation has not started yet.

==================================================
2. PRODUCT CONCEPT
==================================================

SlamDunk combines:

- Collectible Card Game
- Gacha / Pack opening
- Basketball team building
- Auto-battler simulation
- Player progression
- Card progression
- Marketplace
- Direct player-to-player trading
- Card fusion / upgrade
- In-game economy

The high-level gameplay loop is:

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

==================================================
3. PLAYER SYSTEM
==================================================

Each Discord user can have a SlamDunk Player Account.

The Player system may contain:

- Discord identity
- Player progression
- XP
- Games played
- Wins
- Losses
- Win streaks
- Cooldowns

Player progression and Card progression are separate concepts.

==================================================
4. ECONOMY
==================================================

The game currently uses two currencies:

- Gold
- Shards

Gold is the main transactional currency.

Potential Gold sources include:

- /claim
- /daily
- Battle rewards
- Challenges
- Achievements
- Market sales

Potential Gold sinks include:

- Paid packs
- Market purchases
- Future events or other systems

Important confirmed rules:

- Market transaction fee = 0%
- Market listing fee = 0
- Direct Trade fee = 0%
- Card Upgrade Gold fee = 0

Because the economy has zero-fee player transactions, future Gold sinks will be important for controlling inflation.

All important currency changes must eventually be recorded in an immutable Economy Transaction Ledger.

==================================================
5. CARD ARCHITECTURE
==================================================

The Card system has two different concepts:

Card Template
and
Card Instance

They must NOT be merged into one entity.

--------------------------------------------------
5.1 Card Template
--------------------------------------------------

A Card Template defines a particular version of an NBA player.

Example:

Stephen Curry
2026 Base Edition
Legendary
PG

The Card Template owns shared properties such as:

- Player name
- Edition
- Season
- Rarity
- Positions
- OVR
- Base stats
- Traits
- Trait tiers

Multiple Card Instances may reference the same Card Template.

--------------------------------------------------
5.2 Card Instance
--------------------------------------------------

A Card Instance is one individually owned copy of a Card Template.

Example:

Stephen Curry
Serial #152
Level 4
Owned by Player A

The Card Instance owns individual properties such as:

- Unique Card Instance ID
- Owner
- Serial number
- Card Level
- Obtained method
- Obtained timestamp
- Ownership history
- Games played
- Lifecycle status
- Market/trade locks

==================================================
6. CARD STATS
==================================================

Confirmed decisions:

OVR range:

60–99

Each Card Template currently keeps 8 base stats:

- Inside Scoring
- Mid Range
- Three Point
- Playmaking
- Perimeter Defense
- Interior Defense
- Rebounding
- Athleticism

Multiple editions of the same NBA player may exist.

Example:

Stephen Curry — Base Edition

and potentially later:

Stephen Curry — Playoffs Edition

These are separate Card Templates.

==================================================
7. SERIAL NUMBER SYSTEM
==================================================

Each Card Template has its own monotonically increasing serial sequence.

Example:

Curry #1
Curry #2
Curry #3
Curry #4
Curry #5

Serial numbers must never be reused.

The system should distinguish:

total_minted

from:

current_circulation

For example:

If Curry #2 and Curry #4 are destroyed through Fusion and a new Curry #6 is created:

total_minted = 6
current_circulation = 4

Low serial numbers do NOT provide an official gameplay/stat bonus.

Card gameplay value is primarily based on:

- Stats
- Traits
- Trait tiers
- Card Level

Players may independently value low serial numbers on the marketplace, but SlamDunk does not give them a mechanical bonus.

==================================================
8. CARD LEVEL
==================================================

Card Level range:

1–5

When a card is initially acquired from a Pack, its Card Level is randomly generated between:

1 and 5

Example:

Curry #101 — Level 2
Curry #209 — Level 5

Card Level is stored on Card Instance, not Card Template.

Maximum Card Level is:

5

==================================================
9. CARD FUSION / UPGRADE
==================================================

There are currently two upgrade mechanisms:

A. Card Fusion
B. Upgrade Item

--------------------------------------------------
9.1 Card Fusion
--------------------------------------------------

Two Card Instances of the same Card Template may be fused.

Current rule:

newLevel = min(cardA.level + cardB.level, 5)

Examples:

Level 1 + Level 2
→ Level 3

Level 2 + Level 3
→ Level 5

Level 4 + Level 4
→ Level 5

Level 5 + Level 1
→ Level 5

Both original Card Instances are destroyed.

They must NOT be physically deleted from the database.

Instead, they should be preserved with a lifecycle status such as:

DESTROYED_FUSION

Fusion creates an entirely new Card Instance with:

- New Card Instance ID
- New serial number
- Same Card Template
- Same owner
- Resulting Card Level
- obtained_method = FUSION

Example:

Existing:

Curry #1
Curry #2 Lv2
Curry #3
Curry #4 Lv4
Curry #5

Fusion:

Curry #2 Lv2
+
Curry #4 Lv4

Result:

Curry #6 Lv5

Cards #2 and #4 remain in database history as destroyed cards.

--------------------------------------------------
9.2 Upgrade Item
--------------------------------------------------

An Upgrade Item increases an existing Card Instance by:

+1 Level

Maximum remains Level 5.

Unlike Fusion, Upgrade Item does NOT create a new Card Instance.

Example:

Curry #100 Lv3
+
Upgrade Item

→ Curry #100 Lv4

==================================================
10. RARITY SYSTEM
==================================================

The first MVP will use:

7 rarity tiers.

The rarity probability curve is intentionally steep.

Final probabilities have NOT been finalized yet.

Do NOT invent final rarity probabilities.

The highest rarity is confirmed as:

Hall of Fame

The complete final rarity naming may still be adjusted.

Do not assume unfinished balance values are final unless the Game Requirements document explicitly confirms them.

==================================================
11. TRAIT SYSTEM
==================================================

Traits are passive basketball abilities used by the Battle Engine.

Confirmed rules:

- Traits belong to Card Template.
- Traits are fixed.
- Trait Tier belongs to Card Template.
- Trait Tier is fixed.
- Packing a Card Instance does not randomize its traits.
- Card Fusion does not change traits.
- Card Level does not change Trait Tier.

Trait tiers use:

I
II
III

These represent increasing effect strength.

Exact numerical coefficients have NOT been finalized yet.

Do NOT invent permanent Trait coefficients unless explicitly requested.

Trait counts depend on rarity:

Tier 1:
0 Traits

Tier 2:
0–1 Trait

Tier 3:
0–2 Traits

Tier 4:
2–6 Traits

Tier 5:
6–12 Traits

Tier 6:
17–22 Traits

Hall of Fame:
20–30 Traits

The high number of Traits on top-tier cards may be revisited after Battle Engine simulation.

The Battle Engine should eventually evaluate only Traits relevant to the current action rather than applying every Trait universally.

==================================================
12. PACK SYSTEM
==================================================

The general Pack concept exists but several rules remain TBD.

Current known direction:

A Pack may:

- Generate multiple candidate cards
- Allow the Player to select one
- Mint only the selected Card Instance
- Generate a random initial Card Level between 1 and 5

However, the following are NOT finalized:

- Final /pack cooldown
- Final number of candidates
- Final timeout behavior
- Paid Pack structure
- Final rarity probabilities

Do not silently treat draft values as confirmed product rules.

==================================================
13. MARKET
==================================================

SlamDunk will have a fixed-price Marketplace.

Players can:

- List a Card Instance
- Set a Gold price
- Buy listed cards
- Cancel listings

Confirmed:

Market transaction fee:

0%

Listing fee:

0

Seller receives:

100% of the sale price.

Example:

Sale Price:
10,000 Gold

Seller Receives:
10,000 Gold

Market purchases must eventually use PostgreSQL transactions to prevent:

- Double purchase
- Duplicate card ownership
- Incorrect wallet balances
- Paying seller multiple times

A listed Card Instance must be locked against conflicting operations such as:

- Fusion
- Quicksell
- Direct Trade
- Another Market listing

Whether listed cards may still participate in Battle is currently TBD.

==================================================
14. DIRECT TRADE
==================================================

SlamDunk supports direct player-to-player trading.

A Trade may potentially contain:

- Cards from Player A
- Cards from Player B
- Gold from either side

Current draft allows Gold + Cards in the same trade, but detailed limits may still be finalized.

Confirmed:

Trade fee:

0%

Both players must explicitly confirm the final Trade.

If either player modifies the offer:

all previous confirmations must be cleared.

Trade execution must eventually be atomic.

Cards involved in an active trade must be locked against:

- Market
- Fusion
- Quicksell
- Other Trades

==================================================
15. LINEUP
==================================================

Current primary team concept:

5v5

Positions:

PG
SG
SF
PF
C

Current position eligibility:

Primary Position
→ allowed

Secondary Position
→ allowed

Other Position
→ not allowed

MVP currently assumes no bench.

Detailed Battle/Lineup rules may still change.

==================================================
16. BATTLE SYSTEM
==================================================

Battle is intended to be an auto-simulation system.

The Battle Engine will eventually use:

- Base card stats
- Card Level
- Traits
- Trait tiers
- Position
- Matchups
- Controlled randomness

Conceptual possession flow:

Select Offensive Player
        ↓
Select Action
        ↓
Determine Defender
        ↓
Apply Base Stats
        ↓
Apply Card Level Effect
        ↓
Apply Relevant Traits
        ↓
Apply Matchup Modifiers
        ↓
Apply Controlled RNG
        ↓
Resolve Result

Potential actions include:

- Inside Shot
- Mid-range Shot
- Three-pointer
- Pass

The following are NOT finalized:

- Exact Battle formulas
- Card Level battle modifier
- Fatigue
- Substitutions
- PvP mode
- Battle reward structure
- Simulation depth

Do not invent these rules without explicit instruction.

==================================================
17. CARD LIFECYCLE
==================================================

Recommended persistent Card statuses include:

ACTIVE
DESTROYED_FUSION
DESTROYED_QUICKSELL

Destroyed cards remain stored for audit/history.

Temporary Card availability may also include:

Market Lock
Trade Lock

An ACTIVE card must not simultaneously participate in conflicting operations.

For example, a card must not be:

Market listed
+
Direct Trade locked
+
Fusion source

at the same time.

==================================================
18. OWNERSHIP HISTORY
==================================================

Card ownership transitions should eventually be recorded.

Possible reasons include:

PACK
MARKET
DIRECT_TRADE
FUSION_CREATED
ADMIN_TRANSFER

A Card Instance should maintain its identity through Market or Trade ownership changes.

Market/Trade ownership transfer does NOT create a new Card Instance.

Fusion does create a new Card Instance.

==================================================
19. ECONOMY LEDGER
==================================================

Currency should not simply be changed without history.

Eventually, all important currency movement must produce an immutable transaction record.

Examples:

+300 GOLD
CLAIM

-2500 GOLD
PACK_PURCHASE

-10000 GOLD
MARKET_PURCHASE

+10000 GOLD
MARKET_SALE

Potential transaction fields:

transaction_id
player_id
currency
amount
transaction_type
reference_id
created_at

==================================================
20. INTELLECTUAL PROPERTY DIRECTION
==================================================

SlamDunk may take gameplay inspiration from other basketball Discord games such as Basketbot.

However:

DO NOT copy:

- Basketbot source code
- Decompiled code
- Database
- Artwork
- Card frames
- UI pixel-for-pixel
- Battle narration
- Help text
- Trait descriptions
- Proprietary visual assets

Game mechanics may inspire requirements, but SlamDunk implementation and creative expression must be independently created.

The SlamDunk source code must be independently implemented.

==================================================
21. TECHNOLOGY STACK
==================================================

Confirmed stack:

Runtime:
Node.js

Discord SDK:
discord.js

Database:
PostgreSQL

Initial PostgreSQL access strategy:

pg

Environment configuration:

dotenv

Language:

JavaScript

Do NOT introduce TypeScript unless explicitly requested later.

Do NOT introduce an ORM unless explicitly discussed and approved later.

==================================================
22. ARCHITECTURE STYLE
==================================================

Confirmed architecture:

Modular Monolith

High-level dependency flow:

Discord Interaction
        ↓
Command / Interaction Layer
        ↓
Service / Domain Layer
        ↓
Repository Layer
        ↓
PostgreSQL

Core game logic must be independent from Discord.

Discord is treated as an interface/adapter.

Example:

Discord /pack
        ↓
PackCommand
        ↓
PackService
        ↓
CardService
        ↓
CardRepository
        ↓
PostgreSQL

PackCommand must NOT contain:

- Rarity algorithms
- Card creation SQL
- Wallet mutations
- Core gameplay rules

==================================================
23. DOMAIN MODULES
==================================================

Current planned modules include:

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

Infrastructure/shared concerns include:

Database
Transactions
Configuration
Logging
Errors
Validation
Time utilities

Detailed module responsibilities are documented under:

docs/architecture/03-domain-modules.md

==================================================
24. DATA MODEL
==================================================

The conceptual data model is documented under:

docs/architecture/04-data-model.md

Important conceptual entities include:

Player
Wallet
EconomyTransaction

CardTemplate
CardInstance
TraitDefinition
CardTemplateTrait

CardOwnershipHistory
CardMintCounter

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

Do NOT assume this means every table must immediately be implemented.

The data model is an architecture target.

==================================================
25. TRANSACTION RULES
==================================================

Important operations must eventually use PostgreSQL transactions.

Examples:

Market Purchase
Direct Trade
Fusion
Quicksell
Paid Pack
Upgrade Item
Rewards

Critical rule:

A Discord success response should only be sent after the associated database transaction has committed successfully.

Detailed rules are documented in:

docs/architecture/06-transaction-rules.md

==================================================
26. PROJECT STRUCTURE
==================================================

The intended project direction is:

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
└── README.md

Do NOT create every possible directory/file immediately.

Introduce modules as implementation reaches them.

Avoid empty enterprise-style scaffolding.

==================================================
27. DOCUMENTATION SOURCE OF TRUTH
==================================================

Before implementing any feature, inspect the relevant documentation.

Documentation locations:

docs/requirements/

docs/architecture/

Architecture documents currently include:

01-system-context.md
02-high-level-architecture.md
03-domain-modules.md
04-data-model.md
05-card-lifecycle.md
06-transaction-rules.md
07-project-structure.md

The documentation is the project baseline.

If this Project Context conflicts with a more recent explicit decision in the repository documentation:

report the conflict.

Do NOT silently decide which version is correct.

If documentation contains a value explicitly marked:

Draft
TBD
To Be Finalized

do NOT promote it to a final requirement.

==================================================
28. CURRENT PROJECT PHASE
==================================================

Requirements Phase:

Completed enough to continue development.

Architecture Phase:

Completed.

The project is now preparing to enter:

Implementation Foundation.

The planned implementation sequence is approximately:

M0 — Project Bootstrap

M1 — Discord Foundation (/ping)

M2 — PostgreSQL Connection

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

This sequence is intentional.

Do NOT implement later milestones unless explicitly instructed.

==================================================
29. DEVELOPMENT PHILOSOPHY
==================================================

This project is also being used as a software engineering learning project.

Therefore:

Prefer:

- Clear architecture
- Readable JavaScript
- Explicit business rules
- Small implementation steps
- SQL/database concepts that can be understood
- Useful comments only where necessary
- Tests for important business rules
- Explanations of architectural decisions

Avoid:

- Overengineering
- Premature abstraction
- Hidden magic
- Large unexplained refactors
- Adding frameworks without need
- Implementing future features prematurely

When multiple implementation approaches are possible:

1. Explain the alternatives briefly.
2. Recommend one.
3. Explain why it fits SlamDunk.

==================================================
30. IMPORTANT RULE FOR CODEX
==================================================

Do not treat this context as permission to implement the entire project.

This context exists so that you understand the project while completing small, explicitly requested tasks.

For every future task:

1. Read this context.
2. Read relevant repository documentation.
3. Inspect existing code.
4. Identify the smallest necessary change.
5. Follow existing architecture.
6. Implement only the requested milestone.
7. Validate the result.
8. Report what changed.

Do not silently implement future milestones.

==================================================
31. YOUR CURRENT TASK
==================================================

Do NOT modify code yet.

First inspect the repository.

Then read:

PROJECT_CONTEXT.md
README.md
docs/requirements/
docs/architecture/

After reading them, respond with:

## Project Understanding

Summarize SlamDunk in your own words.

## Confirmed Technical Decisions

List the architecture and technology decisions you understand as finalized.

## Confirmed Game Decisions

List the gameplay/product rules you understand as finalized.

## Unresolved / TBD Decisions

List decisions that are intentionally not finalized.

## Architecture Understanding

Explain the intended request flow:

Discord
→ Command
→ Service
→ Repository
→ PostgreSQL

and explain the role of each layer.

## Domain Modules

Summarize the responsibility of the major modules.

## Current Development Stage

State which phases are complete and which milestone comes next.

## Conflicts or Ambiguities

Report any contradictions you find between the repository documents and this context.

Do NOT resolve them yourself.

## Ready Status

Finish with exactly one of:

READY FOR M0

or

NOT READY — CONTEXT CONFLICTS FOUND

Do not implement M0 until I explicitly ask you to.