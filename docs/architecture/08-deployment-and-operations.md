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
