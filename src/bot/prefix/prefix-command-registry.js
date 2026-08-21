const DEFINITIONS = Object.freeze([
  ["ping", ["ping"]],
  ["profile", ["profile", "pf", "me"]],
  ["claim", ["claim", "cl"]],
  ["drop", ["drop", "d"]],
  ["collection", ["collection", "col", "cards"]],
  ["lineup", ["lineup", "lu", "team"]],
  ["battle", ["battle", "b"]],
  ["practice", ["practice", "pr", "scrim"]],
  ["duel", ["duel", "pvp", "vs"]],
  ["cooldowns", ["cooldowns", "cd"]],
  ["rarity", ["rarity", "r"]],
  ["quicksell", ["quicksell", "qs"]],
  ["upgrade", ["upgrade", "up", "fuse"]],
  ["level-up", ["level-up", "levelup", "lvl"]],
  ["market", ["market", "m"]],
  ["sell", ["sell", "s"]],
  ["unlist", ["unlist", "dl", "delist"]],
  ["buy", ["buy", "purchase"]],
  ["trade", ["trade", "t"]],
  ["odds", ["odds", "o"]],
  ["pack", ["pack", "pk"]],
  ["daily", ["daily", "day"]],
  ["weekly", ["weekly", "wk"]],
  ["level-rewards", ["level-rewards", "rewards", "lr", "milestones"]],
  ["contract", ["contract", "sign"]],
  ["exchange", ["exchange", "ex"]],
  ["sort", ["sort"]],
  ["lock", ["lock", "lk"]],
  ["unlock", ["unlock", "ulk"]],
  ["card", ["card", "inspect", "info"]],
  ["compare", ["compare", "cmp"]],
  ["wallet", ["wallet", "w"]],
  ["bag", ["bag", "inv", "inventory"]],
  ["strategy", ["strategy", "st", "tactics"]],
  ["help", ["help", "h", "commands"]],
  ["welcome", ["welcome", "start"]],
].map(([commandName, aliases]) => Object.freeze({
  commandName,
  aliases: Object.freeze(aliases),
})));

export function createPrefixCommandRegistry(commands) {
  const commandsByName = new Map(commands.map((command) => [
    command.data.name,
    command,
  ]));
  const aliases = new Map();
  for (const definition of DEFINITIONS) {
    const command = commandsByName.get(definition.commandName);
    if (!command) {
      throw new TypeError(
        `Prefix alias references unknown command: ${definition.commandName}.`,
      );
    }
    for (const alias of definition.aliases) {
      const normalized = alias.toLowerCase();
      if (aliases.has(normalized)) {
        throw new TypeError(`Duplicate Prefix command alias: ${normalized}.`);
      }
      aliases.set(normalized, Object.freeze({ ...definition, command }));
    }
  }

  return Object.freeze({
    resolve(alias) {
      return aliases.get(String(alias).trim().toLowerCase()) ?? null;
    },
    aliasesFor(commandName) {
      return DEFINITIONS.find((entry) => entry.commandName === commandName)
        ?.aliases ?? Object.freeze([]);
    },
    definitions: DEFINITIONS,
  });
}
