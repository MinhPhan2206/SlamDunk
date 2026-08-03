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
`.env` and provide `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, and `DISCORD_GUILD_ID`.

Register the development guild commands explicitly:

```text
npm run register:commands
```

Start the bot:

```text
npm start
```
