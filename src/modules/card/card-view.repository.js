const CARD_VIEW_COLUMNS = `
  ct.card_template_id,
  ct.player_name,
  ct.primary_position,
  ct.secondary_position,
  ct.finishing,
  ct.mid_range,
  ct.three_point,
  ct.playmaking,
  ct.perimeter_defense,
  ct.interior_defense,
  ct.strength,
  ct.height_cm,
  r.rarity_code,
  r.display_name AS rarity_name,
  r.rarity_rank,
  COALESCE(cmc.total_minted, 0) AS total_minted
`;

function mapTemplate(row) {
  if (!row) return null;
  return Object.freeze({
    cardTemplateId: row.card_template_id,
    playerName: row.player_name,
    primaryPosition: row.primary_position,
    secondaryPosition: row.secondary_position,
    finishing: row.finishing,
    midRange: row.mid_range,
    threePoint: row.three_point,
    playmaking: row.playmaking,
    perimeterDefense: row.perimeter_defense,
    interiorDefense: row.interior_defense,
    strength: row.strength,
    heightCm: row.height_cm,
    rarityCode: row.rarity_code,
    rarityName: row.rarity_name,
    rarityRank: row.rarity_rank,
    totalMinted: row.total_minted,
  });
}

function mapInstance(row) {
  if (!row) return null;
  return Object.freeze({
    ...mapTemplate(row),
    cardInstanceId: row.card_instance_id,
    publicCardId: row.public_card_id,
    ownerPlayerId: row.owner_player_id,
    ownerDiscordUserId: row.owner_discord_user_id,
    ownerUsername: row.owner_username_snapshot,
    cardLevel: row.card_level,
    status: row.status,
    userLock: row.user_lock,
  });
}

export const cardViewRepository = Object.freeze({
  async listSearchableTemplates(database) {
    const result = await database.query(
      `
        SELECT ${CARD_VIEW_COLUMNS}
        FROM card_templates ct
        JOIN rarities r ON r.rarity_id = ct.rarity_id
        LEFT JOIN card_mint_counters cmc ON cmc.card_template_id = ct.card_template_id
        WHERE ct.retired_at IS NULL
        ORDER BY ct.player_name, r.rarity_rank DESC
      `,
    );
    return result.rows.map(mapTemplate);
  },

  async findInstanceById(database, cardInstanceId) {
    const result = await database.query(
      `
        SELECT
          ci.card_instance_id,
          ci.public_card_id,
          ci.owner_player_id,
          p.discord_user_id AS owner_discord_user_id,
          p.username_snapshot AS owner_username_snapshot,
          ci.card_level,
          ci.status,
          ci.user_lock,
          ${CARD_VIEW_COLUMNS}
        FROM card_instances ci
        JOIN card_templates ct ON ct.card_template_id = ci.card_template_id
        JOIN rarities r ON r.rarity_id = ct.rarity_id
        LEFT JOIN card_mint_counters cmc ON cmc.card_template_id = ct.card_template_id
        LEFT JOIN players p ON p.player_id = ci.owner_player_id
        WHERE ci.card_instance_id = $1
      `,
      [cardInstanceId],
    );
    return mapInstance(result.rows[0]);
  },

  async findInstanceByPublicId(database, publicCardId) {
    const result = await database.query(
      `
        SELECT
          ci.card_instance_id,
          ci.public_card_id,
          ci.owner_player_id,
          p.discord_user_id AS owner_discord_user_id,
          p.username_snapshot AS owner_username_snapshot,
          ci.card_level,
          ci.status,
          ci.user_lock,
          ${CARD_VIEW_COLUMNS}
        FROM card_instances ci
        JOIN card_templates ct ON ct.card_template_id = ci.card_template_id
        JOIN rarities r ON r.rarity_id = ct.rarity_id
        LEFT JOIN card_mint_counters cmc ON cmc.card_template_id = ct.card_template_id
        LEFT JOIN players p ON p.player_id = ci.owner_player_id
        WHERE ci.public_card_id = $1
      `,
      [publicCardId],
    );
    return mapInstance(result.rows[0]);
  },

  async findTemplateById(database, cardTemplateId) {
    const result = await database.query(
      `
        SELECT ${CARD_VIEW_COLUMNS}
        FROM card_templates ct
        JOIN rarities r ON r.rarity_id = ct.rarity_id
        LEFT JOIN card_mint_counters cmc ON cmc.card_template_id = ct.card_template_id
        WHERE ct.card_template_id = $1
      `,
      [cardTemplateId],
    );
    return mapTemplate(result.rows[0]);
  },

  async findTemplatesByExactName(database, playerName) {
    const result = await database.query(
      `
        SELECT ${CARD_VIEW_COLUMNS}
        FROM card_templates ct
        JOIN rarities r ON r.rarity_id = ct.rarity_id
        LEFT JOIN card_mint_counters cmc ON cmc.card_template_id = ct.card_template_id
        WHERE LOWER(ct.player_name) = LOWER($1)
          AND ct.retired_at IS NULL
        ORDER BY r.rarity_rank DESC, ct.card_template_id
      `,
      [playerName],
    );
    return result.rows.map(mapTemplate);
  },

  async searchTemplates(database, query, limit) {
    const result = await database.query(
      `
        SELECT ${CARD_VIEW_COLUMNS}
        FROM card_templates ct
        JOIN rarities r ON r.rarity_id = ct.rarity_id
        LEFT JOIN card_mint_counters cmc ON cmc.card_template_id = ct.card_template_id
        WHERE ct.retired_at IS NULL
          AND ($1 = '' OR ct.player_name ILIKE '%' || $1 || '%')
        ORDER BY
          CASE WHEN ct.player_name ILIKE $1 || '%' THEN 0 ELSE 1 END,
          ct.player_name,
          r.rarity_rank DESC
        LIMIT $2
      `,
      [query, limit],
    );
    return result.rows.map(mapTemplate);
  },

  async getBattleTotals(database, cardInstanceId) {
    const result = await database.query(
      `
        SELECT
          COUNT(mp.match_player_id)::INTEGER AS games_played,
          COALESCE(SUM(mp.pts), 0)::INTEGER AS points,
          COALESCE(SUM(mp.reb), 0)::INTEGER AS rebounds,
          COALESCE(SUM(mp.ast), 0)::INTEGER AS assists,
          COALESCE(SUM(mp.stl), 0)::INTEGER AS steals,
          COALESCE(SUM(mp.blk), 0)::INTEGER AS blocks,
          COALESCE(SUM(mp.tov), 0)::INTEGER AS turnovers,
          COALESCE(SUM(mp.fgm), 0)::INTEGER AS field_goals_made,
          COALESCE(SUM(mp.fga), 0)::INTEGER AS field_goals_attempted,
          COALESCE(SUM(mp.three_pm), 0)::INTEGER AS three_pointers_made,
          COALESCE(SUM(mp.three_pa), 0)::INTEGER AS three_pointers_attempted
        FROM match_players mp
        JOIN match_teams mt ON mt.match_team_id = mp.match_team_id
        JOIN matches m ON m.match_id = mt.match_id
        WHERE mp.card_instance_id = $1 AND m.status = 'COMPLETED'
      `,
      [cardInstanceId],
    );
    return result.rows[0];
  },
});
