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
- `/claim` — receive 300–500 Gold every 30 minutes.
- `/drop` — open a Free Drop and choose one of three Card Templates.
- `/odds drop|pack` — view configured Free Drop or Pack rarity odds.
- `/collection` — view owned active cards with tier filtering and pagination.
- `/lineup view|set|remove` — manage the active five-position lineup.
- `/battle` — simulate a persisted PvE match with the active lineup.
- `/cooldowns` — view the current Claim and Free Drop cooldown status.
- `/rarity tier:<1-7>` — list Card Templates in a rarity tier.
- `/quicksell card_id:<id>` — destroy an unwanted card for Shards.
- `/upgrade fusion card_a:<id> card_b:<id>` — fuse matching Card Templates.
- `/upgrade item card_id:<id>` — consume one Level Up item for +1 Level.
- `/market browse|sell|buy|cancel` — use the fixed-price Card Market.
- `/trade create|view|add-card|remove-card|set-gold|confirm|cancel` — manage a
  two-player Direct Trade.

Grant Level Up items locally as an administrator:

```text
npm run admin:grant-level-up -- <discord_user_id> <quantity>
```
