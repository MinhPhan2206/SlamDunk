ALTER TABLE card_templates
  ADD COLUMN tendency_profile JSONB NOT NULL DEFAULT
    '{"schemaVersion":"tendency-v1","decision":"BALANCED","shotProfile":"BALANCED","creationRole":"BALANCED","usage":"NORMAL"}'::jsonb;

ALTER TABLE card_templates
  ADD CONSTRAINT card_templates_tendency_profile_object
    CHECK (jsonb_typeof(tendency_profile) = 'object');
