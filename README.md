# SlamDunk

Discord basketball collectible card game.

## Tech Stack

- Node.js
- discord.js
- PostgreSQL

## Architecture

SlamDunk uses a Modular Monolith architecture. See the
[architecture documentation](docs/architecture/).

## Documentation

- [Current project handoff and release readiness](docs/project-handoff-and-release-readiness.md)
- [Game requirements](docs/requirements/)
- [Architecture](docs/architecture/)

## Local Development

Install the Node.js dependencies with `npm install`, then copy `.env.example` to
`.env` and provide `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, and
`DATABASE_URL`.

PostgreSQL must be running and reachable through `DATABASE_URL`. Integration
tests require a separate database through `TEST_DATABASE_URL`; the test guard
rejects a URL targeting the same host/database as `DATABASE_URL` and refuses to
run when `NODE_ENV=production`. At startup, SlamDunk verifies the runtime
database connection before logging into Discord.

Apply pending database migrations explicitly:

```text
npm run db:migrate
```

Apply the same migrations to the isolated test database before running tests:

```text
npm run db:migrate:test
```

Register the development guild commands explicitly:

```text
npm run register:commands:dev
```

Development and production use the same codebase but separate Discord
Applications, credentials, and PostgreSQL databases. Production credentials
must be supplied by the deployment environment rather than committed files.
Development uses `ECONOMY_CONFIG_PROFILE=development` and
`DATABASE_SSL_MODE=disable`. Production requires
`ECONOMY_CONFIG_PROFILE=production`, database TLS, an explicit Community Guild,
and Trade, Battle, and Duel channel IDs; startup fails if these are missing.
With `NODE_ENV=production`, register public commands globally as an explicit
deployment step:

```text
npm run register:commands:global
```

Global command registration is never performed when the bot starts.

Start the bot:

```text
npm start
```

Run the test suite after both PostgreSQL databases are available and their
migrations are up to date:

```text
npm test
```

## Current Commands

- `/ping` — check whether the bot is online.
- `/profile` — create or view your Player and Wallet profile.
- `/claim` — receive 80–120 Gold every 15 minutes.
- `/daily` — receive daily Gold and Shards.
- `/drop` — open a Free Drop and choose one of three Card Templates.
- `/pack pack_type:<code>` — buy and immediately open a Pack.
- `/exchange item:shard` — exchange 500 Shards for one Level Up item.
- `/odds drop|pack` — view configured Free Drop or Pack rarity odds.
- `/collection` — view owned active cards using the saved ordering and pagination.
- `/sort [sort_by]` — save the ordering used by `/collection`; omitted option defaults to Rarity.
- `/lineup view|set|remove` — manage the active five-position lineup.
- `/battle opponent_bracket:<bracket>` — battle a selected AI bracket for Gold.
- `/cooldowns` — view Claim, Daily, Free Drop, and Battle cooldowns.
- `/rarity rarity:<name>` — list Card Templates in a named rarity.
- `/lock card_id:<id>` — protect an owned card from Quicksell.
- `/unlock card_id:<id>` — remove Quicksell protection from an owned card.
- `/quicksell params:<selector>` — preview and confirm Quicksell by all, rarity, position, public ID, or Collection number.
- `/upgrade card_a:<id> card_b:<id>` — fuse matching Card Templates.
- `/level-up card_id:<id>` — consume one Level Up item for +1 Level.
- `/market` — view active fixed-price Card listings.
- `/sell card_id:<id> price:<gold>` — list an owned Card.
- `/unlist card_id:<id>` — remove an owned Card from the Market.
- `/buy card_id:<id>` — purchase a listed Card.
- `/trade user:<user>` — invite a Player, then manage an accepted Direct Trade through buttons and modals.

Grant Level Up items locally as an administrator:

```text
npm run admin:grant-level-up -- <discord_user_id> <quantity>
```
