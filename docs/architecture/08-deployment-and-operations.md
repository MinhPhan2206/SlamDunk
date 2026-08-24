# Deployment and Operations Baseline

> Status: provisional infrastructure direction. Pricing and provider limits
> must be rechecked before production deployment.

## Low-Cost Topology

```text
Discord
  -> SlamDunk Node.js process on Railway
  -> Neon serverless PostgreSQL
```

- Use Neon Free during development/test because idle compute can scale to zero.
- Use Railway for the continuously running Discord process; begin with the
  smallest practical service size.
- Select regions close to each other and close to the primary player base.
- Use the Neon pooled connection string with TLS as `DATABASE_URL`.
- Keep the application `pg` pool small (initial target: maximum 5 connections).
- Store Card images in object storage later and persist only asset URLs/keys in PostgreSQL.

## Environments and Secrets

- Keep local development and hosted production databases separate.
- Store `DISCORD_TOKEN`, Discord IDs, and `DATABASE_URL` only in environment secrets.
- Never commit `.env`, database dumps, or production credentials.
- Run `npm run db:migrate` as an explicit deployment step before starting the bot.

## Backup and Recovery

- Use the provider restore window for recent operational mistakes.
- Create periodic encrypted `pg_dump` backups outside the application host.
- Test restoration before the bot has real players; an untested backup is not a recovery plan.
- Retain immutable economy, ownership, Pack, Exchange, and Trade audit records.

## Cost Controls

- Do not add Redis, queues, replicas, or extra services until measured load requires them.
- Paginate collection/history queries and preserve targeted indexes.
- Monitor database size, connection count, slow queries, bot memory, restart count,
  and Discord/API errors.
- Re-evaluate the free database tier before exceeding its storage or compute allowance.

Official references:

- https://neon.com/pricing
- https://neon.com/docs/introduction/scale-to-zero
- https://docs.railway.com/pricing/plans

## Pre-Release Abuse Controls

All slash commands, prefix commands, autocomplete requests, and Discord
components pass through the shared abuse guard. The guard applies short-window
per-user limits, serializes economy mutations per command, and caps concurrent
Battle/image work. Pack volume is handled through `/pack quantity`; up to 100
Packs are processed as one idempotent transaction rather than requiring command
spam.

Production enables additional eligibility checks automatically:

- Market purchases/listings, Direct Trade, and wagered Duel require Player
  Level 5 by default.
- The Discord account must be at least seven days old.
- Starter and reward Contract Cards are account-bound.
- Practice and friendly Duel do not create Gold or XP; wagered Duel only moves
  escrowed Gold and does not mint currency.

Tune these release gates with `SECURITY_MINIMUM_PLAYER_LEVEL` and
`SECURITY_MINIMUM_DISCORD_ACCOUNT_AGE_DAYS`. Development does not enforce the
eligibility gates, allowing local test accounts to keep working.

## Runtime Resource Limits

- Default PostgreSQL pool maximum: 5 connections.
- Default database connection timeout: 5 seconds.
- Default statement/query timeout: 15 seconds.
- Default simultaneous heavy operations: 4.
- Emit a sanitized health record every five minutes containing memory, pool,
  and abuse-guard counts.
- Never include Discord tokens, connection strings, message content, or secrets
  in health/security logs.
- `MAINTENANCE_MODE=true` blocks new commands except Ping and Help.
- `DISABLED_COMMANDS=pack,trade` can stop selected new command flows while
  existing cancellation components remain available.

## Security Audit and Response

`security_events` stores rate-limit and operator actions separately from the
immutable economy ledger. `player_security_profiles` supports temporary trading
or whole-account restrictions without deleting Player data.

Every 15 minutes, the application records deduplicated signals for repeated
Duel, completed Trade, and Market counterpart pairs. Signals support manual
review and do not automatically ban a Player from one heuristic alone.

Operator commands:

```text
npm run admin:player-security -- show <discord_user_id>
npm run admin:player-security -- freeze-trading <discord_user_id> <minutes>
npm run admin:player-security -- disable <discord_user_id> <minutes>
npm run admin:player-security -- clear <discord_user_id>
npm run audit:reconcile
npm run audit:abuse
```

Corrections must use compensating ledger entries; never update production
wallet balances manually. Review rate-limit spikes, one-way transfers, unusual
Market pricing, repeated counterpart activity, database pool waiting, process
restarts, and Discord API errors.

## Release Gate

Before public release:

1. Run `npm ci`, `npm run db:migrate`, `npm test`, and
   `npm run audit:reconcile`.
2. Restore the latest backup into a separate database and verify it.
3. Test duplicate interactions, concurrent Pack/Buy/Trade actions, stale
   components, process restart during transactions, and render saturation.
4. Start with a 20-50 Player closed beta and review resource creation/destruction
   for at least one week.
5. Configure external alert delivery before broad multi-guild release; local
   structured health/security logs and command kill switches are already active.
