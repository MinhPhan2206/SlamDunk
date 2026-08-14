function mapTrade(row) {
  if (!row) {
    return null;
  }
  return Object.freeze({
    tradeId: row.trade_id,
    createdByPlayerId: row.created_by_player_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at,
    expiresAt: row.expires_at,
    expiredAt: row.expired_at,
    offerRevision: Number(row.offer_revision),
    reviewStartedAt: row.review_started_at,
  });
}

function mapParticipant(row) {
  return Object.freeze({
    playerId: row.player_id,
    discordUserId: row.discord_user_id,
    username: row.username_snapshot,
    goldOffered: row.gold_offered,
    acceptedAt: row.accepted_at,
    readyAt: row.ready_at,
    readyRevision: row.ready_revision === null ? null : Number(row.ready_revision),
    finalAcceptedAt: row.final_accepted_at,
    finalAcceptedRevision: row.final_accepted_revision === null
      ? null
      : Number(row.final_accepted_revision),
  });
}

function mapTradeCard(row) {
  return Object.freeze({
    tradeCardId: row.trade_card_id,
    tradeId: row.trade_id,
    cardInstanceId: row.card_instance_id,
    publicCardId: row.public_card_id,
    offeredByPlayerId: row.offered_by_player_id,
    active: row.active,
    outcome: row.outcome,
    playerName: row.player_name,
    rarityCode: row.rarity_code,
    serialNumber: row.serial_number,
    cardLevel: row.card_level,
  });
}

const TRADE_COLUMNS = `
  trade_id,
  created_by_player_id,
  status,
  created_at,
  updated_at,
  completed_at,
  cancelled_at
  ,expires_at
  ,expired_at
  ,offer_revision
  ,review_started_at
`;

export const tradeRepository = Object.freeze({
  async create(database, { createdByPlayerId, participantPlayerIds, expiresAt }) {
    const result = await database.query(
      `
        INSERT INTO trades (created_by_player_id, expires_at)
        VALUES ($1, $2)
        RETURNING ${TRADE_COLUMNS}
      `,
      [createdByPlayerId, expiresAt],
    );
    const trade = mapTrade(result.rows[0]);
    await database.query(
      `
        INSERT INTO trade_participants (trade_id, player_id)
        VALUES ($1, $2), ($1, $3)
      `,
      [trade.tradeId, participantPlayerIds[0], participantPlayerIds[1]],
    );
    return trade;
  },

  async findById(database, tradeId) {
    const result = await database.query(
      `SELECT ${TRADE_COLUMNS} FROM trades WHERE trade_id = $1`,
      [tradeId],
    );
    return mapTrade(result.rows[0]);
  },

  async findByIdForUpdate(database, tradeId) {
    const result = await database.query(
      `SELECT ${TRADE_COLUMNS} FROM trades WHERE trade_id = $1 FOR UPDATE`,
      [tradeId],
    );
    return mapTrade(result.rows[0]);
  },

  async findExpiredOpen(database) {
    const result = await database.query(
      `SELECT ${TRADE_COLUMNS} FROM trades WHERE status = 'OPEN' AND expires_at <= CURRENT_TIMESTAMP ORDER BY trade_id`,
    );
    return result.rows.map(mapTrade);
  },

  async findParticipants(database, tradeId) {
    const result = await database.query(
      `
        SELECT
          tp.player_id,
          p.discord_user_id,
          p.username_snapshot,
          tp.gold_offered,
          tp.accepted_at,
          tp.ready_at,
          tp.ready_revision,
          tp.final_accepted_at,
          tp.final_accepted_revision
        FROM trade_participants tp
        JOIN players p ON p.player_id = tp.player_id
        JOIN trades t ON t.trade_id = tp.trade_id
        WHERE tp.trade_id = $1
        ORDER BY
          CASE WHEN tp.player_id = t.created_by_player_id THEN 0 ELSE 1 END,
          tp.player_id
      `,
      [tradeId],
    );
    return result.rows.map(mapParticipant);
  },

  async findCards(database, tradeId) {
    const result = await database.query(
      `
        SELECT
          tc.trade_card_id,
          tc.trade_id,
          tc.card_instance_id,
          ci.public_card_id,
          tc.offered_by_player_id,
          tc.active,
          tc.outcome,
          ct.player_name,
          r.rarity_code,
          ci.serial_number,
          ci.card_level
        FROM trade_cards tc
        JOIN card_instances ci ON ci.card_instance_id = tc.card_instance_id
        JOIN card_templates ct ON ct.card_template_id = ci.card_template_id
        JOIN rarities r ON r.rarity_id = ct.rarity_id
        WHERE tc.trade_id = $1
          AND (tc.active OR tc.outcome IN ('TRANSFERRED', 'CANCELLED'))
        ORDER BY tc.trade_card_id
      `,
      [tradeId],
    );
    return result.rows.map(mapTradeCard);
  },

  async findActiveCard(database, { tradeId, cardInstanceId }) {
    const result = await database.query(
      `
        SELECT trade_card_id, trade_id, card_instance_id,
          offered_by_player_id, active, outcome
        FROM trade_cards
        WHERE trade_id = $1 AND card_instance_id = $2 AND active = TRUE
      `,
      [tradeId, cardInstanceId],
    );
    return result.rows[0] ?? null;
  },

  async addCard(database, { tradeId, cardInstanceId, offeredByPlayerId }) {
    await database.query(
      `
        INSERT INTO trade_cards (
          trade_id,
          card_instance_id,
          offered_by_player_id
        )
        VALUES ($1, $2, $3)
      `,
      [tradeId, cardInstanceId, offeredByPlayerId],
    );
  },

  async resolveCard(database, { tradeCardId, outcome }) {
    await database.query(
      `
        UPDATE trade_cards
        SET active = FALSE, outcome = $2, removed_at = CURRENT_TIMESTAMP
        WHERE trade_card_id = $1 AND active = TRUE
      `,
      [tradeCardId, outcome],
    );
  },

  async resolveAllCards(database, { tradeId, outcome }) {
    await database.query(
      `
        UPDATE trade_cards
        SET active = FALSE, outcome = $2, removed_at = CURRENT_TIMESTAMP
        WHERE trade_id = $1 AND active = TRUE
      `,
      [tradeId, outcome],
    );
  },

  async setGoldOffer(database, { tradeId, playerId, goldOffered }) {
    const result = await database.query(
      `
        UPDATE trade_participants
        SET gold_offered = $3
        WHERE trade_id = $1 AND player_id = $2
        RETURNING player_id
      `,
      [tradeId, playerId, goldOffered],
    );
    return result.rowCount === 1;
  },

  async markReady(database, { tradeId, playerId, offerRevision }) {
    await database.query(
      `
        UPDATE trade_participants
        SET
          ready_at = CURRENT_TIMESTAMP,
          ready_revision = $3,
          final_accepted_at = NULL,
          final_accepted_revision = NULL
        WHERE trade_id = $1 AND player_id = $2
      `,
      [tradeId, playerId, offerRevision],
    );
  },

  async clearPlayerReady(database, { tradeId, playerId }) {
    await database.query(
      `
        UPDATE trade_participants
        SET
          ready_at = NULL,
          ready_revision = NULL,
          final_accepted_at = NULL,
          final_accepted_revision = NULL
        WHERE trade_id = $1 AND player_id = $2
      `,
      [tradeId, playerId],
    );
    await database.query(
      `UPDATE trades SET updated_at = CURRENT_TIMESTAMP WHERE trade_id = $1`,
      [tradeId],
    );
  },

  async beginReview(database, { tradeId, offerRevision }) {
    const result = await database.query(
      `
        UPDATE trades
        SET review_started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE trade_id = $1
          AND status = 'OPEN'
          AND offer_revision = $2
          AND review_started_at IS NULL
        RETURNING ${TRADE_COLUMNS}
      `,
      [tradeId, offerRevision],
    );
    return mapTrade(result.rows[0]);
  },

  async markFinalAccepted(database, { tradeId, playerId, offerRevision }) {
    await database.query(
      `
        UPDATE trade_participants
        SET
          final_accepted_at = CURRENT_TIMESTAMP,
          final_accepted_revision = $3
        WHERE trade_id = $1
          AND player_id = $2
          AND ready_revision = $3
      `,
      [tradeId, playerId, offerRevision],
    );
  },

  async acceptInvitation(database, { tradeId, playerId }) {
    const result = await database.query(
      `
        UPDATE trade_participants
        SET accepted_at = COALESCE(accepted_at, CURRENT_TIMESTAMP)
        WHERE trade_id = $1 AND player_id = $2
        RETURNING player_id
      `,
      [tradeId, playerId],
    );
    return result.rowCount === 1;
  },

  async advanceOfferRevision(database, tradeId) {
    await database.query(
      `
        UPDATE trade_participants
        SET
          ready_at = NULL,
          ready_revision = NULL,
          final_accepted_at = NULL,
          final_accepted_revision = NULL
        WHERE trade_id = $1
      `,
      [tradeId],
    );
    const result = await database.query(
      `
        UPDATE trades
        SET
          offer_revision = offer_revision + 1,
          review_started_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE trade_id = $1 AND status = 'OPEN'
        RETURNING ${TRADE_COLUMNS}
      `,
      [tradeId],
    );
    return mapTrade(result.rows[0]);
  },

  async clearReview(database, tradeId) {
    await database.query(
      `
        UPDATE trade_participants
        SET
          ready_at = NULL,
          ready_revision = NULL,
          final_accepted_at = NULL,
          final_accepted_revision = NULL
        WHERE trade_id = $1
      `,
      [tradeId],
    );
    const result = await database.query(
      `
        UPDATE trades
        SET review_started_at = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE trade_id = $1 AND status = 'OPEN'
        RETURNING ${TRADE_COLUMNS}
      `,
      [tradeId],
    );
    return mapTrade(result.rows[0]);
  },

  async markCompleted(database, tradeId) {
    const result = await database.query(
      `
        UPDATE trades
        SET
          status = 'COMPLETED',
          completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE trade_id = $1 AND status = 'OPEN'
        RETURNING ${TRADE_COLUMNS}
      `,
      [tradeId],
    );
    return mapTrade(result.rows[0]);
  },

  async markCancelled(database, tradeId) {
    const result = await database.query(
      `
        UPDATE trades
        SET
          status = 'CANCELLED',
          cancelled_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE trade_id = $1 AND status = 'OPEN'
        RETURNING ${TRADE_COLUMNS}
      `,
      [tradeId],
    );
    return mapTrade(result.rows[0]);
  },

  async markExpired(database, tradeId) {
    const result = await database.query(
      `
        UPDATE trades SET status = 'EXPIRED', expired_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE trade_id = $1 AND status = 'OPEN'
        RETURNING ${TRADE_COLUMNS}
      `,
      [tradeId],
    );
    return mapTrade(result.rows[0]);
  },
});
