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

- [Game requirements](docs/requirements/)
- [Architecture](docs/architecture/)

## Local Development

Install the Node.js dependencies with `npm install`, then copy `.env.example` to
`.env` and provide `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, and
`DATABASE_URL`.

PostgreSQL must be running and reachable through `DATABASE_URL`. At startup,
SlamDunk verifies the database connection before logging into Discord.

Apply pending database migrations explicitly:

```text
npm run db:migrate
```

Register the development guild commands explicitly:

```text
npm run register:commands
```

Start the bot:

```text
npm start
```

Run the integration tests after PostgreSQL is available and migrations are up
to date:

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
