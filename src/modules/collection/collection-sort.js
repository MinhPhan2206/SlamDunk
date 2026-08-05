export const DEFAULT_COLLECTION_SORT = "OLDEST";

export const collectionSortDefinitions = Object.freeze([
  Object.freeze({ key: "OLDEST", label: "Oldest", orderBy: "ci.obtained_at ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "NEWEST", label: "Newest", orderBy: "ci.obtained_at DESC, ci.card_instance_id DESC" }),
  Object.freeze({ key: "RARITY", label: "Rarity", orderBy: "r.rarity_rank DESC, ci.obtained_at ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "OVERALL", label: "Overall", orderBy: "ct.overall DESC, ci.obtained_at ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "LEVEL", label: "Card Level", orderBy: "ci.card_level DESC, ci.obtained_at ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "PLAYER_NAME", label: "Player Name", orderBy: "ct.player_name ASC, ct.edition ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "POSITION", label: "Position", orderBy: "CASE ct.primary_position WHEN 'PG' THEN 1 WHEN 'SG' THEN 2 WHEN 'SF' THEN 3 WHEN 'PF' THEN 4 WHEN 'C' THEN 5 END, ci.obtained_at ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "FINISHING", label: "Finishing", orderBy: "ct.inside_scoring DESC, ci.obtained_at ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "MID_RANGE", label: "Mid Range", orderBy: "ct.mid_range DESC, ci.obtained_at ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "THREE_POINT", label: "3 Point", orderBy: "ct.three_point DESC, ci.obtained_at ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "PLAYMAKING", label: "Playmaking", orderBy: "ct.playmaking DESC, ci.obtained_at ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "PERIMETER_DEFENSE", label: "Perimeter Defense", orderBy: "ct.perimeter_defense DESC, ci.obtained_at ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "INTERIOR_DEFENSE", label: "Interior Defense", orderBy: "ct.interior_defense DESC, ci.obtained_at ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "REBOUNDING", label: "Rebounding", orderBy: "ct.rebounding DESC, ci.obtained_at ASC, ci.card_instance_id ASC" }),
  Object.freeze({ key: "ATHLETICISM", label: "Athleticism", orderBy: "ct.athleticism DESC, ci.obtained_at ASC, ci.card_instance_id ASC" }),
]);

const definitionsByKey = new Map(
  collectionSortDefinitions.map((definition) => [definition.key, definition]),
);

export function getCollectionSortDefinition(sortKey) {
  const definition = definitionsByKey.get(sortKey);
  if (!definition) throw new TypeError("sortBy is not a supported Collection sort.");
  return definition;
}
