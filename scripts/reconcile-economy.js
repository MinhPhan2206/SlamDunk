import { getDatabaseConfig } from "../src/config/env.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";

const CHECKS = Object.freeze({
  walletMismatches: `
    WITH latest AS (
      SELECT DISTINCT ON (player_id, currency)
        player_id, currency, balance_after
      FROM economy_transactions
      ORDER BY player_id, currency, transaction_id DESC
    )
    SELECT w.player_id
    FROM wallets w
    LEFT JOIN latest g ON g.player_id = w.player_id AND g.currency = 'GOLD'
    LEFT JOIN latest s ON s.player_id = w.player_id AND s.currency = 'SHARDS'
    WHERE w.gold_balance <> COALESCE(g.balance_after, 0)
       OR w.shard_balance <> COALESCE(s.balance_after, 0)
  `,
  inventoryMismatches: `
    WITH latest AS (
      SELECT DISTINCT ON (player_id, item_type)
        player_id, item_type, balance_after
      FROM item_transactions
      ORDER BY player_id, item_type, item_transaction_id DESC
    )
    SELECT COALESCE(pi.player_id, l.player_id) AS player_id,
      COALESCE(pi.item_type, l.item_type) AS item_type
    FROM player_items pi
    FULL JOIN latest l USING (player_id, item_type)
    WHERE COALESCE(pi.quantity, 0) <> COALESCE(l.balance_after, 0)
  `,
  xpMismatches: `
    WITH latest AS (
      SELECT DISTINCT ON (player_id)
        player_id, xp_after, player_level_after
      FROM player_xp_transactions
      ORDER BY player_id, xp_transaction_id DESC
    )
    SELECT p.player_id
    FROM players p
    LEFT JOIN latest l USING (player_id)
    WHERE p.xp <> COALESCE(l.xp_after, 0)
       OR p.player_level <> COALESCE(l.player_level_after, 0)
  `,
  cardCounterMismatches: `
    WITH actual AS (
      SELECT card_template_id,
        COUNT(*) AS total_minted,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') AS current_circulation,
        COALESCE(MAX(serial_number), 0) AS last_serial_number
      FROM card_instances
      GROUP BY card_template_id
    )
    SELECT COALESCE(c.card_template_id, a.card_template_id) AS card_template_id
    FROM card_mint_counters c
    FULL JOIN actual a USING (card_template_id)
    WHERE COALESCE(c.total_minted, 0) <> COALESCE(a.total_minted, 0)
       OR COALESCE(c.current_circulation, 0) <> COALESCE(a.current_circulation, 0)
       OR COALESCE(c.last_serial_number, 0) <> COALESCE(a.last_serial_number, 0)
  `,
  ownershipStateMismatches: `
    WITH latest AS (
      SELECT DISTINCT ON (card_instance_id)
        card_instance_id, to_player_id
      FROM card_ownership_history
      ORDER BY card_instance_id, ownership_history_id DESC
    )
    SELECT ci.card_instance_id
    FROM card_instances ci
    LEFT JOIN latest l USING (card_instance_id)
    WHERE ci.owner_player_id IS DISTINCT FROM l.to_player_id
       OR l.card_instance_id IS NULL
  `,
  ownershipChainBreaks: `
    WITH chain AS (
      SELECT card_instance_id, from_player_id,
        LAG(to_player_id) OVER (
          PARTITION BY card_instance_id ORDER BY ownership_history_id
        ) AS previous_owner,
        ROW_NUMBER() OVER (
          PARTITION BY card_instance_id ORDER BY ownership_history_id
        ) AS sequence_number
      FROM card_ownership_history
    )
    SELECT card_instance_id
    FROM chain
    WHERE sequence_number > 1
      AND from_player_id IS DISTINCT FROM previous_owner
  `,
  invalidCardLocks: `
    SELECT card_instance_id
    FROM card_instances
    WHERE (market_lock AND trade_lock)
       OR (status <> 'ACTIVE' AND (market_lock OR trade_lock))
  `,
  invalidMarketState: `
    SELECT ml.listing_id
    FROM market_listings ml
    JOIN card_instances ci USING (card_instance_id)
    WHERE (ml.status = 'ACTIVE' AND (
      ci.owner_player_id IS DISTINCT FROM ml.seller_player_id OR NOT ci.market_lock
    )) OR (ml.status = 'SOLD' AND NOT EXISTS (
      SELECT 1 FROM card_ownership_history coh
      WHERE coh.card_instance_id = ml.card_instance_id
        AND coh.reference_type = 'MARKET_LISTING'
        AND coh.reference_id = ml.listing_id::TEXT
    ))
  `,
  invalidTradeState: `
    SELECT DISTINCT t.trade_id
    FROM trades t
    JOIN trade_cards tc USING (trade_id)
    JOIN card_instances ci USING (card_instance_id)
    WHERE (t.status = 'OPEN' AND tc.active AND NOT ci.trade_lock)
       OR (t.status = 'COMPLETED' AND tc.outcome = 'TRANSFERRED' AND NOT EXISTS (
         SELECT 1 FROM card_ownership_history coh
         WHERE coh.card_instance_id = tc.card_instance_id
           AND coh.reference_type = 'TRADE'
           AND coh.reference_id = t.trade_id::TEXT
       ))
  `,
  invalidPackAudit: `
    SELECT DISTINCT po.pack_opening_id
    FROM pack_openings po
    LEFT JOIN pack_opening_cards poc USING (pack_opening_id)
    WHERE po.status = 'COMPLETED'
      AND (poc.card_instance_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM card_ownership_history coh
        WHERE coh.card_instance_id = poc.card_instance_id
          AND coh.reference_type = 'PACK_OPENING'
          AND coh.reference_id IN (
            po.pack_opening_id::TEXT,
            po.pack_opening_id::TEXT || ':' || poc.card_position::TEXT
          )
      ))
  `,
  invalidContractAudit: `
    SELECT co.contract_opening_id
    FROM contract_openings co
    WHERE NOT EXISTS (
      SELECT 1 FROM card_ownership_history coh
      WHERE coh.card_instance_id = co.card_instance_id
        AND coh.reference_type = 'PLAYER_CONTRACT'
        AND coh.reference_id = co.discord_interaction_id
    )
  `,
  expiredPendingDuels: `
    SELECT public_duel_id
    FROM duel_challenges
    WHERE status = 'PENDING' AND expires_at < CURRENT_TIMESTAMP
  `,
});

async function main() {
  const pool = createPostgresPool({
    connectionString: getDatabaseConfig().databaseUrl,
  });
  try {
    const entries = Object.entries(CHECKS);
    const results = await Promise.all(entries.map(([, query]) => pool.query(query)));
    const counts = Object.fromEntries(
      entries.map(([name], index) => [name, results[index].rowCount]),
    );
    const issues = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const report = {
      event: "SLAMDUNK_RECONCILIATION",
      issues,
      ...counts,
    };
    console.log(JSON.stringify(report));
    if (issues > 0) {
      console.error(`Reconciliation detected ${issues} issue(s).`);
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Reconciliation failed: ${error.message}`);
  process.exitCode = 1;
});
