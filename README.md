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
