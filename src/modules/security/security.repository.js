export const securityRepository = Object.freeze({
  async scanAbuseSignals(database) {
    const result = await database.query(`
      WITH signals AS (
        SELECT
          'duel:' || LEAST(challenger_player_id, challenged_player_id) || ':' ||
            GREATEST(challenger_player_id, challenged_player_id) || ':' ||
            CURRENT_DATE AS deduplication_key,
          'REPEATED_DUEL_PAIR' AS event_type,
          'WARNING' AS severity,
          JSONB_BUILD_OBJECT(
            'playerA', LEAST(challenger_player_id, challenged_player_id),
            'playerB', GREATEST(challenger_player_id, challenged_player_id),
            'count', COUNT(*)
          ) AS metadata
        FROM duel_challenges
        WHERE status = 'ACCEPTED'
          AND created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        GROUP BY
          LEAST(challenger_player_id, challenged_player_id),
          GREATEST(challenger_player_id, challenged_player_id)
        HAVING COUNT(*) >= 10

        UNION ALL

        SELECT
          'trade:' || MIN(tp.player_id) || ':' || MAX(tp.player_id) || ':' ||
            CURRENT_DATE,
          'REPEATED_TRADE_PAIR',
          'HIGH',
          JSONB_BUILD_OBJECT(
            'playerA', MIN(tp.player_id),
            'playerB', MAX(tp.player_id),
            'count', COUNT(DISTINCT t.trade_id)
          )
        FROM trades t
        JOIN trade_participants tp ON tp.trade_id = t.trade_id
        WHERE t.status = 'COMPLETED'
          AND t.completed_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        GROUP BY t.trade_id
        HAVING COUNT(*) = 2
      ), trade_pairs AS (
        SELECT
          'trade-pair:' || (metadata->>'playerA') || ':' ||
            (metadata->>'playerB') || ':' ||
            CURRENT_DATE AS deduplication_key,
          'REPEATED_TRADE_PAIR' AS event_type,
          'HIGH' AS severity,
          JSONB_BUILD_OBJECT(
            'playerA', metadata->>'playerA',
            'playerB', metadata->>'playerB',
            'count', COUNT(*)
          ) AS metadata
        FROM signals
        WHERE event_type = 'REPEATED_TRADE_PAIR'
        GROUP BY metadata->>'playerA', metadata->>'playerB'
        HAVING COUNT(*) >= 5
      ), market_pairs AS (
        SELECT
          'market-pair:' || seller_player_id || ':' || buyer_player_id || ':' ||
            CURRENT_DATE AS deduplication_key,
          'REPEATED_MARKET_PAIR' AS event_type,
          'WARNING' AS severity,
          JSONB_BUILD_OBJECT(
            'sellerPlayerId', seller_player_id,
            'buyerPlayerId', buyer_player_id,
            'count', COUNT(*),
            'gold', SUM(price_gold)
          ) AS metadata
        FROM market_listings
        WHERE status = 'SOLD'
          AND sold_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        GROUP BY seller_player_id, buyer_player_id
        HAVING COUNT(*) >= 10
      ), combined AS (
        SELECT deduplication_key, event_type, severity, metadata
        FROM signals WHERE event_type = 'REPEATED_DUEL_PAIR'
        UNION ALL SELECT * FROM trade_pairs
        UNION ALL SELECT * FROM market_pairs
      )
      INSERT INTO security_events (
        event_type, severity, command_name, metadata, deduplication_key
      )
      SELECT event_type, severity, 'abuse-scan', metadata, deduplication_key
      FROM combined
      ON CONFLICT (deduplication_key)
        WHERE deduplication_key IS NOT NULL
        DO NOTHING
      RETURNING event_type
    `);
    return result.rows;
  },

  async createEvent(database, input) {
    await database.query(
      `
        INSERT INTO security_events (
          event_type, severity, discord_user_id, guild_id, channel_id,
          command_name, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::JSONB)
      `,
      [
        input.eventType,
        input.severity,
        input.discordUserId,
        input.guildId,
        input.channelId,
        input.commandName,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  },

  async createEvents(database, inputs) {
    if (!Array.isArray(inputs) || inputs.length === 0) return 0;
    const result = await database.query(
      `
        INSERT INTO security_events (
          event_type, severity, discord_user_id, guild_id, channel_id,
          command_name, metadata
        )
        SELECT *
        FROM UNNEST(
          $1::TEXT[], $2::TEXT[], $3::TEXT[], $4::TEXT[],
          $5::TEXT[], $6::TEXT[], $7::JSONB[]
        )
      `,
      [
        inputs.map((input) => input.eventType),
        inputs.map((input) => input.severity),
        inputs.map((input) => input.discordUserId),
        inputs.map((input) => input.guildId),
        inputs.map((input) => input.channelId),
        inputs.map((input) => input.commandName),
        inputs.map((input) => JSON.stringify(input.metadata ?? {})),
      ],
    );
    return result.rowCount;
  },

  async findPlayerProfile(database, playerId) {
    const result = await database.query(
      `
        SELECT player_id, risk_score, earning_frozen_until,
          trading_frozen_until, disabled_until, updated_at
        FROM player_security_profiles
        WHERE player_id = $1
      `,
      [playerId],
    );
    return result.rows[0] ?? null;
  },

  async findPlayerProfilesForShare(database, playerIds) {
    if (!Array.isArray(playerIds) || playerIds.length === 0) return [];
    await database.query(
      `
        SELECT player_id
        FROM players
        WHERE player_id = ANY($1::BIGINT[])
        ORDER BY player_id
        FOR SHARE
      `,
      [playerIds],
    );
    const result = await database.query(
      `
        SELECT player_id, risk_score, earning_frozen_until,
          trading_frozen_until, disabled_until, updated_at
        FROM player_security_profiles
        WHERE player_id = ANY($1::BIGINT[])
        ORDER BY player_id
        FOR SHARE
      `,
      [playerIds],
    );
    return result.rows;
  },
});
