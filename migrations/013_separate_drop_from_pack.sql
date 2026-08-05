ALTER TABLE pack_sessions RENAME TO drop_sessions;
ALTER TABLE drop_sessions RENAME COLUMN pack_session_id TO drop_session_id;
ALTER TABLE drop_sessions RENAME COLUMN pack_type TO drop_type;

ALTER TABLE pack_session_candidates RENAME TO drop_session_candidates;
ALTER TABLE drop_session_candidates
  RENAME COLUMN pack_session_id TO drop_session_id;

ALTER TABLE drop_sessions
  RENAME CONSTRAINT pack_sessions_pkey TO drop_sessions_pkey;
ALTER TABLE drop_sessions
  RENAME CONSTRAINT pack_sessions_player_id_fkey TO drop_sessions_player_id_fkey;
ALTER TABLE drop_sessions
  RENAME CONSTRAINT pack_sessions_selected_template_id_fkey
  TO drop_sessions_selected_template_id_fkey;
ALTER TABLE drop_sessions
  RENAME CONSTRAINT pack_sessions_result_card_instance_id_fkey
  TO drop_sessions_result_card_instance_id_fkey;
ALTER TABLE drop_sessions
  RENAME CONSTRAINT pack_sessions_created_interaction_id_key
  TO drop_sessions_created_interaction_id_key;
ALTER TABLE drop_sessions
  RENAME CONSTRAINT pack_sessions_result_card_instance_id_key
  TO drop_sessions_result_card_instance_id_key;
ALTER TABLE drop_sessions
  RENAME CONSTRAINT pack_sessions_type_valid TO drop_sessions_type_valid;
ALTER TABLE drop_sessions
  RENAME CONSTRAINT pack_sessions_status_valid TO drop_sessions_status_valid;
ALTER TABLE drop_sessions
  RENAME CONSTRAINT pack_sessions_interaction_present
  TO drop_sessions_interaction_present;
ALTER TABLE drop_sessions
  RENAME CONSTRAINT pack_sessions_state_valid TO drop_sessions_state_valid;

ALTER TABLE drop_session_candidates
  RENAME CONSTRAINT pack_session_candidates_pkey
  TO drop_session_candidates_pkey;
ALTER TABLE drop_session_candidates
  RENAME CONSTRAINT pack_session_candidates_pack_session_id_fkey
  TO drop_session_candidates_drop_session_id_fkey;
ALTER TABLE drop_session_candidates
  RENAME CONSTRAINT pack_session_candidates_card_template_id_fkey
  TO drop_session_candidates_card_template_id_fkey;
ALTER TABLE drop_session_candidates
  RENAME CONSTRAINT pack_session_candidates_template_unique
  TO drop_session_candidates_template_unique;
ALTER TABLE drop_session_candidates
  RENAME CONSTRAINT pack_session_candidates_position_valid
  TO drop_session_candidates_position_valid;
ALTER TABLE drop_session_candidates
  RENAME CONSTRAINT pack_session_candidates_rarity_valid
  TO drop_session_candidates_rarity_valid;

ALTER SEQUENCE pack_sessions_pack_session_id_seq
  RENAME TO drop_sessions_drop_session_id_seq;

ALTER INDEX pack_sessions_one_open_free_drop_per_player_idx
  RENAME TO drop_sessions_one_open_per_player_idx;
ALTER INDEX pack_sessions_player_created_idx
  RENAME TO drop_sessions_player_created_idx;
ALTER INDEX pack_session_candidates_template_idx
  RENAME TO drop_session_candidates_template_idx;

UPDATE player_cooldowns
SET cooldown_type = 'FREE_DROP'
WHERE cooldown_type = 'FREE_PACK';

ALTER TABLE card_instances
  DROP CONSTRAINT card_instances_obtained_method_valid;

UPDATE card_instances ci
SET obtained_method = 'DROP'
WHERE obtained_method = 'PACK'
  AND EXISTS (
    SELECT 1
    FROM card_ownership_history coh
    WHERE coh.card_instance_id = ci.card_instance_id
      AND coh.reference_type = 'PACK_SESSION'
  );

UPDATE card_ownership_history
SET reason = 'DROP', reference_type = 'DROP_SESSION'
WHERE reference_type = 'PACK_SESSION';

ALTER TABLE card_instances
  ADD CONSTRAINT card_instances_obtained_method_valid
  CHECK (
    obtained_method IN (
      'DROP',
      'PACK',
      'FUSION',
      'ADMIN_GRANT',
      'EVENT_REWARD'
    )
  );
