# 07 — Project Structure

> **Project:** SlamDunk  
> **Runtime:** Node.js  
> **Discord SDK:** discord.js  
> **Architecture:** Modular Monolith

---

## 1. Goal

The project structure should reflect domain boundaries and dependency rules.

Avoid organizing the entire application only by technical type:

```text
controllers/
services/
repositories/
```

with hundreds of unrelated files.

Prefer domain-oriented modules with internal layers.

---

## 2. Recommended Root Structure

```text
slamdunk/
│
├── src/
├── tests/
├── docs/
├── scripts/
├── migrations/
│
├── .env
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

---

## 3. Documentation Structure

```text
docs/
├── requirements/
│   └── game-requirements.md
│
└── architecture/
    ├── 01-system-context.md
    ├── 02-high-level-architecture.md
    ├── 03-domain-modules.md
    ├── 04-data-model.md
    ├── 05-card-lifecycle.md
    ├── 06-transaction-rules.md
    ├── 07-project-structure.md
    ├── 08-deployment-and-operations.md
    └── 09-battle-engine.md
```

---

## 4. Source Structure

Recommended:

```text
src/
│
├── bot/
│   ├── client/
│   ├── commands/
│   ├── interactions/
│   ├── events/
│   └── presenters/
│
├── modules/
│   ├── player/
│   ├── economy/
│   ├── card/
│   ├── trait/
│   ├── drop/
│   ├── pack/
│   ├── reward/
│   ├── collection/
│   ├── upgrade/
│   ├── market/
│   ├── trade/
│   ├── lineup/
│   └── battle/
│
├── database/
│   ├── connection/
│   ├── transaction/
│   └── migrations/
│
├── config/
│   ├── env/
│   └── game/
│
├── shared/
│   ├── errors/
│   ├── logging/
│   ├── ids/
│   ├── time/
│   └── validation/
│
├── app.js
└── index.js
```

---

## 5. Bot Layer

```text
src/bot/
```

Contains Discord-specific code only.

### Example

```text
bot/
├── commands/
│   ├── drop.command.js
│   ├── odds.command.js
│   ├── claim.command.js
│   ├── market.command.js
│   └── trade.command.js
│
├── interactions/
│   ├── drop-selection.component.js
│   ├── trade-confirm.handler.js
│   └── market-buy.handler.js
│
├── presenters/
│   ├── card.presenter.js
│   ├── collection.presenter.js
│   └── battle.presenter.js
│
└── events/
    ├── ready.event.js
    └── interaction-create.event.js
```

### Rule

Discord handlers:

```text
parse input
validate Discord-specific shape
call application/domain service
map result/error to Discord response
```

They do **not**:

```text
calculate rarity
update wallet directly
change card owner directly
run battle formulas
write SQL
```

---

## 6. Module Internal Structure

Example:

```text
modules/card/
├── card.service.js
├── card.repository.js
├── card.model.js
├── card.errors.js
├── card.rules.js
└── index.js
```

For larger modules:

```text
modules/market/
├── application/
│   └── market.service.js
├── domain/
│   ├── market.rules.js
│   └── market.errors.js
├── infrastructure/
│   └── market.repository.js
└── index.js
```

Start simple. Introduce deeper nesting only when module size justifies it.

---

## 7. Player Module Example

```text
modules/player/
├── player.service.js
├── player.repository.js
├── player.model.js
├── player.errors.js
└── index.js
```

---

## 8. Card Module Example

```text
modules/card/
├── card.service.js
├── card.repository.js
├── card-template.repository.js
├── card-ownership.repository.js
├── card.rules.js
├── card.errors.js
└── index.js
```

---

## 9. Battle Module Example

Battle is expected to become larger.

Recommended:

```text
modules/battle/
├── battle.service.js
├── battle.repository.js
│
├── engine/
│   ├── match-engine.js
│   ├── possession-engine.js
│   ├── action-selector.js
│   ├── shot-resolver.js
│   ├── rebound-resolver.js
│   └── rng.js
│
├── traits/
│   └── trait-resolver.js
│
├── output/
│   ├── box-score.js
│   └── play-by-play.js
│
├── battle.errors.js
└── index.js
```

Battle engine should remain independent of Discord.

---

## 10. Database Structure

```text
database/
├── connection/
│   └── postgres.js
│
├── transaction/
│   └── transaction-manager.js
│
└── migrations/
```

Repository modules use the database adapter and direct `pg` queries.

Domain services should not import raw PostgreSQL clients directly.

---

## 11. Migration Structure

```text
migrations/
├── 001_create_players.sql
├── 002_create_wallets.sql
├── 003_create_economy_transactions.sql
├── 004_create_player_cooldowns.sql
├── 005_create_card_templates_and_traits.sql
├── 006_create_card_instances.sql
├── 007_create_pack_sessions.sql
├── 008_create_lineups.sql
├── 009_create_battle_matches.sql
├── 010_create_fusions_and_upgrade_items.sql
├── 011_create_market_listings.sql
├── 012_create_direct_trades.sql
└── 013_separate_drop_from_pack.sql
```

Future migrations are added only when their implementation milestone begins.
The project uses its explicit SQL migration runner and does not use an ORM.

Never manually edit production schema without migration history.

---

## 12. Configuration Structure

```text
config/
├── env/
│   └── env.js
│
└── game/
    ├── rarity.config.js
    ├── pack.config.js
    ├── reward.config.js
    ├── quicksell.config.js
    ├── level.config.js
    └── battle.config.js
```

Example concepts:

```text
MAX_CARD_LEVEL = 5
INITIAL_CARD_LEVEL_MIN = 1
INITIAL_CARD_LEVEL_MAX = 5
```

Final balance values remain configuration, not scattered constants.

---

## 13. Environment Variables

`.env` local example:

```text
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=

DATABASE_URL=

NODE_ENV=development
LOG_LEVEL=debug
```

`.env` must be in `.gitignore`.

Commit:

```text
.env.example
```

without secrets.

---

## 14. Tests Structure

```text
tests/
├── unit/
│   ├── card/
│   ├── economy/
│   ├── drop/
│   ├── pack/
│   ├── upgrade/
│   └── battle/
│
├── integration/
│   ├── market/
│   ├── trade/
│   ├── fusion/
│   └── rewards/
│
└── fixtures/
```

### Unit Tests

Test pure business rules:

```text
fusion level cap
trait relevance
rarity selection
lineup validation
```

### Integration Tests

Test PostgreSQL transactions:

```text
two buyers purchase same listing
trade rollback
fusion atomicity
wallet balance safety
```

---

## 15. Scripts Structure

```text
scripts/
├── register-commands.js
├── seed-card-templates.js
├── seed-traits.js
├── seed-dev-player.js
└── reset-dev-db.js
```

Scripts must use the same repository/service abstractions where appropriate.

---

## 16. Dependency Rule

Allowed:

```text
bot → modules
modules → repositories/infrastructure abstractions
repositories → database
```

Avoid:

```text
database → modules
modules → bot
shared → domain module
```

`shared/` must contain generic code only.

---

## 17. Import Boundary Rule

Each module should expose a public API through:

```text
modules/<module>/index.js
```

Example:

```js
// modules/card/index.js
export { cardService } from "./card.service.js";
export { CardErrors } from "./card.errors.js";
```

Other modules should prefer importing from module public API rather than internal files.

---

## 18. Error Handling

Domain errors live with their module.

Example:

```text
modules/card/card.errors.js
modules/market/market.errors.js
```

Shared base error:

```text
shared/errors/domain-error.js
```

Bot layer maps:

```text
DomainError
    ↓
Discord-friendly message
```

---

## 19. Logging

Recommended logger interface:

```text
logger.info()
logger.warn()
logger.error()
```

Include structured context:

```text
interactionId
playerId
cardId
listingId
tradeId
```

Do not log secrets.

---

## 20. Naming Convention

Suggested JavaScript naming:

```text
Files:
kebab-case.js

Classes:
PascalCase

Functions / variables:
camelCase

Constants:
UPPER_SNAKE_CASE

Database:
snake_case
```

Examples:

```text
market-listing.repository.js
MarketService
buyListing()
MAX_CARD_LEVEL
card_instance_id
```

---

## 21. Application Entry Points

### `src/index.js`

Process entry.

Responsibilities:

```text
load environment
initialize logger
connect database
start Discord client
handle fatal shutdown
```

### `src/app.js`

Application composition.

Responsibilities:

```text
construct services
construct repositories
wire dependencies
export application container
```

Avoid global mutable singletons where practical.

---

## 22. Development Order

`PROJECT_CONTEXT.md` is the source of truth for milestone numbering.

```text
M0  — Project Bootstrap
M1  — Discord Foundation (/ping)
M2  — PostgreSQL Foundation
M3  — Player + Wallet
M4  — /profile
M5  — Economy Ledger
M6  — /claim
M7  — Card Template + Traits
M8  — Card Instance
M9  — /drop
M10 — /collection
M11 — Lineup
M12 — Battle MVP
M13 — Quicksell
M14 — Fusion / Upgrade
M15 — Market
M16 — Direct Trade
```

This sequence is intentional. Later milestones must not be implemented unless explicitly requested.

---

## 23. README Role

Root `README.md` should remain an entry point, not the full design specification.

Suggested content:

```text
Project summary
Local setup
Tech stack
Run instructions
Documentation links
Testing instructions
```

Detailed requirements and architecture stay under `docs/`.

---

## 24. Initial Repository Target

After Architecture Phase, the repository should approximately look like:

```text
slamdunk/
├── docs/
│   ├── requirements/
│   └── architecture/
├── src/
│   ├── bot/
│   ├── modules/
│   ├── database/
│   ├── config/
│   └── shared/
├── tests/
├── scripts/
├── migrations/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

Do not create empty complexity just to match the tree.

Folders should be introduced as implementation reaches them.
