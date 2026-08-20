function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function levenshtein(left, right) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function capitalInitials(playerName) {
  const capitals = String(playerName ?? "").match(/\p{Lu}/gu) ?? [];
  return normalize(capitals.join(""));
}

function searchData(template) {
  const name = normalize(template.playerName);
  const tokens = name.split(" ").filter(Boolean);
  const aliases = new Set([
    tokens.map((token) => token[0]).join(""),
    capitalInitials(template.playerName),
    name.replaceAll(" ", ""),
    ...(template.aliases ?? []).map(normalize),
  ].filter(Boolean));
  return { name, tokens, aliases };
}

function fuzzySimilarity(query, tokens) {
  let best = 0;
  for (const token of tokens) {
    const candidates = [token, token.slice(0, query.length)];
    for (const candidate of candidates) {
      if (!candidate) continue;
      const length = Math.max(query.length, candidate.length);
      best = Math.max(best, 1 - (levenshtein(query, candidate) / length));
    }
  }
  return best;
}

function matchScore(template, query) {
  const data = searchData(template);
  if (data.name === query) return 10_000;
  if (data.aliases.has(query)) return 9_500;
  if (data.tokens.includes(query)) return 9_000;
  if (data.name.startsWith(query)) return 8_500;
  if (data.tokens.some((token) => token.startsWith(query))) return 8_000;
  if (data.name.replaceAll(" ", "").includes(query)) return 7_500;
  if (data.name.includes(query)) return 7_000;
  if (query.length < 3) return 0;
  const similarity = fuzzySimilarity(query, data.tokens);
  return similarity >= 0.6 ? 5_000 + Math.round(similarity * 1_000) : 0;
}

export function normalizeCardSearchQuery(value) {
  return normalize(value).slice(0, 100);
}

export function searchCardTemplates(templates, query, { limit = 10 } = {}) {
  const normalizedQuery = normalizeCardSearchQuery(query);
  if (!normalizedQuery) return Object.freeze([]);
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 25);
  return Object.freeze(templates
    .map((template) => ({ template, score: matchScore(template, normalizedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) =>
      right.score - left.score ||
      left.template.playerName.localeCompare(right.template.playerName) ||
      Number(right.template.rarityRank ?? 0) - Number(left.template.rarityRank ?? 0))
    .slice(0, safeLimit)
    .map((entry) => entry.template));
}
