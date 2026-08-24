function mapCard(row) {
  if (!row) {
    return null;
  }

  return Object.freeze({
    cardInstanceId: row.card_instance_id,
    publicCardId: row.public_card_id,
    cardTemplateId: row.card_template_id,
    ownerPlayerId: row.owner_player_id,
    status: row.status,
    marketLock: row.market_lock,
    tradeLock: row.trade_lock,
    userLock: row.user_lock,
    accountBound: row.account_bound,
    inLineup: row.in_lineup,
    playerName: row.player_name,
    rarityCode: row.rarity_code,
    primaryPosition: row.primary_position,
    secondaryPosition: row.secondary_position,
    serialNumber: row.serial_number,
    cardLevel: row.card_level,
    goldReward: row.gold_reward == null ? null : Number(row.gold_reward),
    shardReward: row.shard_reward == null ? null : Number(row.shard_reward),
  });
}

function mapSession(row) {
  if (!row) return null;
  return Object.freeze({
    quicksellSessionId: row.quicksell_session_id,
    playerId: row.player_id,
    requestParams: row.request_params,
    discordInteractionId: row.discord_interaction_id,
    status: row.status,
    totalGold: row.total_gold,
    totalShards: row.total_shards,
    goldBalanceAfter: row.gold_balance_after,
    shardBalanceAfter: row.shard_balance_after,
    expiresAt: row.expires_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
  });
}

const SESSION_COLUMNS = `
  quicksell_session_id, player_id, request_params, discord_interaction_id,
  status, total_gold, total_shards, gold_balance_after, shard_balance_after,
  expires_at, completed_at,
  cancelled_at, created_at
`;

export const quicksellRepository = Object.freeze({
  async findCardForUpdate(database, cardInstanceId) {
    const result = await database.query(
      `
        SELECT
          ci.card_instance_id,
          ci.public_card_id,
          ci.card_template_id,
          ci.owner_player_id,
          ci.status,
          ci.market_lock,
          ci.trade_lock,
          ci.user_lock,
          ci.account_bound,
          ci.serial_number,
          ci.card_level,
          ct.player_name,
          r.rarity_code,
          ct.primary_position,
          ct.secondary_position,
          EXISTS (
            SELECT 1
            FROM lineup_slots ls
            WHERE ls.card_instance_id = ci.card_instance_id
          ) AS in_lineup
        FROM card_instances ci
        JOIN card_templates ct
          ON ct.card_template_id = ci.card_template_id
        JOIN rarities r ON r.rarity_id = ct.rarity_id
        WHERE ci.card_instance_id = $1
        FOR UPDATE OF ci
      `,
      [cardInstanceId],
    );

    return mapCard(result.rows[0]);
  },

  async findEligibleCards(database, playerId) {
    const result = await database.query(
      `
        SELECT
          ci.card_instance_id, ci.public_card_id, ci.card_template_id,
          ci.owner_player_id, ci.status, ci.market_lock, ci.trade_lock,
          ci.user_lock, ci.account_bound, ci.serial_number, ci.card_level,
          ct.player_name, ct.primary_position,
          ct.secondary_position, r.rarity_code, FALSE AS in_lineup
        FROM card_instances ci
        JOIN card_templates ct ON ct.card_template_id = ci.card_template_id
        JOIN rarities r ON r.rarity_id = ct.rarity_id
        WHERE ci.owner_player_id = $1
          AND ci.status = 'ACTIVE'
          AND ci.user_lock = FALSE
          AND ci.market_lock = FALSE
          AND ci.trade_lock = FALSE
          AND ci.account_bound = FALSE
          AND NOT EXISTS (
            SELECT 1 FROM lineup_slots ls
            WHERE ls.card_instance_id = ci.card_instance_id
          )
      `,
      [playerId],
    );
    return result.rows.map(mapCard);
  },

  async findSessionByInteraction(database, interactionId) {
    const result = await database.query(
      `SELECT ${SESSION_COLUMNS} FROM quicksell_sessions WHERE discord_interaction_id = $1`,
      [interactionId],
    );
    return mapSession(result.rows[0]);
  },

  async createSession(
    database,
    { playerId, requestParams, interactionId, totalGold, totalShards, expiresAt },
  ) {
    const result = await database.query(
      `
        INSERT INTO quicksell_sessions (
          player_id, request_params, discord_interaction_id,
          total_gold, total_shards, expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING ${SESSION_COLUMNS}
      `,
      [playerId, requestParams, interactionId, totalGold, totalShards, expiresAt],
    );
    return mapSession(result.rows[0]);
  },

  async addSessionCards(database, quicksellSessionId, cards) {
    const values = [];
    const placeholders = cards.map((card, index) => {
      const offset = index * 5;
      values.push(
        quicksellSessionId,
        card.cardInstanceId,
        card.goldReward,
        card.shardReward,
        index + 1,
      );
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
    });
    await database.query(
      `
        INSERT INTO quicksell_session_cards (
          quicksell_session_id, card_instance_id, gold_reward, shard_reward,
          display_position
        ) VALUES ${placeholders.join(", ")}
      `,
      values,
    );
  },

  async findSessionCards(database, quicksellSessionId, { forUpdate = false } = {}) {
    const result = await database.query(
      `
        SELECT
          ci.card_instance_id, ci.public_card_id, ci.card_template_id,
          ci.owner_player_id, ci.status, ci.market_lock, ci.trade_lock,
          ci.user_lock, ci.account_bound, ci.serial_number, ci.card_level,
          ct.player_name, ct.primary_position,
          ct.secondary_position, r.rarity_code, qsc.gold_reward,
          qsc.shard_reward,
          EXISTS (
            SELECT 1 FROM lineup_slots ls
            WHERE ls.card_instance_id = ci.card_instance_id
          ) AS in_lineup
        FROM quicksell_session_cards qsc
        JOIN card_instances ci ON ci.card_instance_id = qsc.card_instance_id
        JOIN card_templates ct ON ct.card_template_id = ci.card_template_id
        JOIN rarities r ON r.rarity_id = ct.rarity_id
        WHERE qsc.quicksell_session_id = $1
        ORDER BY qsc.display_position
        ${forUpdate ? "FOR UPDATE OF ci" : ""}
      `,
      [quicksellSessionId],
    );
    return result.rows.map(mapCard);
  },

  async findSessionForUpdate(database, quicksellSessionId) {
    const result = await database.query(
      `SELECT ${SESSION_COLUMNS} FROM quicksell_sessions WHERE quicksell_session_id = $1 FOR UPDATE`,
      [quicksellSessionId],
    );
    return mapSession(result.rows[0]);
  },

  async finishSession(
    database,
    {
      quicksellSessionId,
      status,
      goldBalanceAfter = null,
      shardBalanceAfter = null,
    },
  ) {
    const result = await database.query(
      `
        UPDATE quicksell_sessions
        SET status = $2,
          gold_balance_after = $3,
          shard_balance_after = $4,
          completed_at = CASE WHEN $2 = 'COMPLETED' THEN CURRENT_TIMESTAMP ELSE NULL END,
          cancelled_at = CASE WHEN $2 IN ('CANCELLED', 'EXPIRED') THEN CURRENT_TIMESTAMP ELSE NULL END
        WHERE quicksell_session_id = $1 AND status = 'OPEN'
        RETURNING ${SESSION_COLUMNS}
      `,
      [quicksellSessionId, status, goldBalanceAfter, shardBalanceAfter],
    );
    return mapSession(result.rows[0]);
  },

  async destroyCard(database, cardInstanceId) {
    await database.query(
      `
        UPDATE card_instances
        SET
          owner_player_id = NULL,
          status = 'DESTROYED_QUICKSELL',
          updated_at = CURRENT_TIMESTAMP
        WHERE card_instance_id = $1
      `,
      [cardInstanceId],
    );
  },

  async decrementCirculation(database, cardTemplateId) {
    const result = await database.query(
      `
        UPDATE card_mint_counters
        SET
          current_circulation = current_circulation - 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE card_template_id = $1
          AND current_circulation > 0
        RETURNING current_circulation
      `,
      [cardTemplateId],
    );

    return result.rows[0]?.current_circulation ?? null;
  },

  async createOwnershipEvent(database, { cardInstanceId, playerId }) {
    await database.query(
      `
        INSERT INTO card_ownership_history (
          card_instance_id,
          from_player_id,
          to_player_id,
          reason,
          reference_type,
          reference_id
        )
        VALUES ($1, $2, NULL, 'QUICKSELL', 'CARD_INSTANCE', $1::BIGINT::TEXT)
      `,
      [cardInstanceId, playerId],
    );
  },
});
