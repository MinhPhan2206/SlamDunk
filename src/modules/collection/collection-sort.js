export const DEFAULT_COLLECTION_SORT = "OLDEST";

export const collectionSortDefinitions = Object.freeze([
  Object.freeze({ key: "OLDEST", label: "Oldest", orderBy: "ci.obtained_at ASC, LOWER(ct.player_name) ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "NEWEST", label: "Newest", orderBy: "ci.obtained_at DESC, LOWER(ct.player_name) ASC, ci.card_instance_id DESC" }),
  Object.freeze({ key: "RARITY", label: "Rarity", orderBy: "r.rarity_rank DESC, LOWER(ct.player_name) ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "LEVEL", label: "Card Level", orderBy: "ci.card_level DESC, LOWER(ct.player_name) ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "PLAYER_NAME", label: "Player Name", orderBy: "ct.player_name ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "POSITION", label: "Position", orderBy: "CASE ct.primary_position WHEN 'PG' THEN 1 WHEN 'SG' THEN 2 WHEN 'SF' THEN 3 WHEN 'PF' THEN 4 WHEN 'C' THEN 5 END, LOWER(ct.player_name) ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "FINISHING", label: "Finishing", orderBy: "(ct.finishing - (5 - ci.card_level)) DESC, LOWER(ct.player_name) ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "MID_RANGE", label: "Mid Range", orderBy: "(ct.mid_range - (5 - ci.card_level)) DESC, LOWER(ct.player_name) ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "THREE_POINT", label: "3 Point", orderBy: "(ct.three_point - (5 - ci.card_level)) DESC, LOWER(ct.player_name) ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "PLAYMAKING", label: "Playmaking", orderBy: "(ct.playmaking - (5 - ci.card_level)) DESC, LOWER(ct.player_name) ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "PERIMETER_DEFENSE", label: "Perimeter Defense", orderBy: "(ct.perimeter_defense - (5 - ci.card_level)) DESC, LOWER(ct.player_name) ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "INTERIOR_DEFENSE", label: "Interior Defense", orderBy: "(ct.interior_defense - (5 - ci.card_level)) DESC, LOWER(ct.player_name) ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "STRENGTH", label: "Strength", orderBy: "(ct.strength - (5 - ci.card_level)) DESC, LOWER(ct.player_name) ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "HEIGHT", label: "Height", orderBy: "ct.height_cm DESC NULLS LAST, LOWER(ct.player_name) ASC, ci.card_instance_id ASC" }),
]);

const definitionsByKey = new Map(
  collectionSortDefinitions.map((definition) => [definition.key, definition]),
);

export function getCollectionSortDefinition(sortKey) {
  const definition = definitionsByKey.get(sortKey);
  if (!definition) throw new TypeError("sortBy is not a supported Collection sort.");
  return definition;
}
