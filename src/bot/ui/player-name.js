const NAME_SUFFIXES = new Set(["jr.", "sr.", "ii", "iii", "iv"]);

function truncateName(value, width) {
  return value.length <= width ? value : `${value.slice(0, width - 1)}…`;
}

export function formatCompactPlayerName(playerName, width = 15) {
  const name = String(playerName).replace(/\s+/g, " ").trim();
  if (name.length <= width) return name;

  const parts = name.split(" ");
  if (parts.length < 2) return truncateName(name, width);

  const suffix = NAME_SUFFIXES.has(parts.at(-1).toLowerCase())
    ? parts.pop()
    : null;
  const surname = parts.pop();
  const familyName = suffix ? `${surname} ${suffix}` : surname;
  const initial = Array.from(parts[0])[0]?.toUpperCase() ?? "";
  const abbreviated = `${initial}. ${familyName}`;
  if (abbreviated.length <= width) return abbreviated;

  if (surname.includes("-")) {
    const [firstPart, ...remainingParts] = surname.split("-");
    const compactSurname = [
      firstPart,
      ...remainingParts.map((part) => `${Array.from(part)[0]}.`),
    ].join("-");
    const compact = `${initial}. ${compactSurname}${suffix ? ` ${suffix}` : ""}`;
    if (compact.length <= width) return compact;
  }

  if (familyName.length <= width) return familyName;
  return truncateName(abbreviated, width);
}
