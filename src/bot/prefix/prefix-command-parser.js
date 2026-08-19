import { ApplicationCommandOptionType } from "discord.js";

const DEFAULT_OPTIONS = Object.freeze({
  battle: Object.freeze({ opponent_bracket: "street" }),
  practice: Object.freeze({ opponent_bracket: "street" }),
  pack: Object.freeze({ pack_type: "standard" }),
  exchange: Object.freeze({ item: "shard" }),
  help: Object.freeze({ topic: "manual" }),
});

export class PrefixCommandParseError extends Error {
  constructor(message, usage = null) {
    super(message);
    this.name = "PrefixCommandParseError";
    this.usage = usage;
  }
}

export function tokenizePrefixCommand(input) {
  const tokens = [];
  let token = "";
  let quote = null;
  let escaped = false;
  for (const character of String(input)) {
    if (escaped) {
      token += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (quote) {
      if (character === quote) quote = null;
      else token += character;
      continue;
    }
    if (character === '"' || (character === "'" && token.length === 0)) {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      if (token) tokens.push(token);
      token = "";
      continue;
    }
    token += character;
  }
  if (quote) {
    throw new PrefixCommandParseError("The command contains an unclosed quote.");
  }
  if (escaped) token += "\\";
  if (token) tokens.push(token);
  return tokens;
}

function choiceKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeChoice(option, token) {
  if (!option.choices?.length) return token;
  const key = choiceKey(token);
  const choice = option.choices.find((entry) =>
    choiceKey(entry.value) === key || choiceKey(entry.name) === key
  );
  if (!choice) {
    throw new PrefixCommandParseError(
      `Invalid ${option.name}. Choose: ${option.choices.map((entry) => entry.value).join(", ")}.`,
    );
  }
  return choice.value;
}

async function resolveUser(message, token) {
  const match = String(token).match(/^<@!?(\d+)>$/) ??
    String(token).match(/^(\d{17,20})$/);
  const userId = match?.[1];
  if (!userId) return null;
  const mentioned = message.mentions?.users?.get?.(userId);
  if (mentioned) return mentioned;
  try {
    return await message.client.users.fetch(userId);
  } catch {
    throw new PrefixCommandParseError(`Discord user ${userId} could not be found.`);
  }
}

function usage(prefix, commandName, options, subcommand = null) {
  const parts = [prefix, commandName];
  if (subcommand) parts.push(subcommand);
  for (const option of options) {
    const label = option.type === ApplicationCommandOptionType.User
      ? `@${option.name}`
      : option.name;
    parts.push(option.required ? `<${label}>` : `[${label}]`);
  }
  return parts.join(" ");
}

async function parseOptions({
  message,
  prefix,
  commandName,
  options,
  tokens,
  subcommand,
}) {
  const values = {};
  let index = 0;
  for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
    const option = options[optionIndex];
    const defaultValue = DEFAULT_OPTIONS[commandName]?.[option.name];
    let token = tokens[index];
    if (commandName === "card" && option.name === "card" && token != null) {
      token = tokens.slice(index).join(" ");
      index = tokens.length;
    }

    if (token == null) {
      if (defaultValue != null) {
        values[option.name] = defaultValue;
        continue;
      }
      if (option.required) {
        throw new PrefixCommandParseError(
          `Missing required argument: ${option.name}.`,
          usage(prefix, commandName, options, subcommand),
        );
      }
      values[option.name] = null;
      continue;
    }

    if (option.type === ApplicationCommandOptionType.Integer) {
      if (!/^-?\d+$/.test(token)) {
        if (!option.required) {
          values[option.name] = null;
          continue;
        }
        throw new PrefixCommandParseError(`${option.name} must be an integer.`);
      }
      const value = Number(token);
      if (!Number.isSafeInteger(value)) {
        throw new PrefixCommandParseError(`${option.name} is too large.`);
      }
      values[option.name] = value;
      index += 1;
      continue;
    }

    if (option.type === ApplicationCommandOptionType.User) {
      const user = await resolveUser(message, token);
      if (!user) {
        if (!option.required) {
          values[option.name] = null;
          continue;
        }
        throw new PrefixCommandParseError(
          `${option.name} must be a Discord mention or user ID.`,
        );
      }
      values[option.name] = user;
      index += 1;
      continue;
    }

    values[option.name] = normalizeChoice(option, token);
    index += 1;
  }

  if (index < tokens.length) {
    throw new PrefixCommandParseError(
      `Unexpected argument: ${tokens[index]}.`,
      usage(prefix, commandName, options, subcommand),
    );
  }
  return values;
}

function prefixOptions(values, subcommand) {
  return Object.freeze({
    getString(name, required = false) {
      const value = values[name] ?? null;
      if (required && value == null) throw new TypeError(`${name} is required.`);
      return value == null ? null : String(value);
    },
    getInteger(name, required = false) {
      const value = values[name] ?? null;
      if (required && value == null) throw new TypeError(`${name} is required.`);
      return value;
    },
    getUser(name, required = false) {
      const value = values[name] ?? null;
      if (required && value == null) throw new TypeError(`${name} is required.`);
      return value;
    },
    getSubcommand(required = true) {
      if (required && !subcommand) throw new TypeError("subcommand is required.");
      return subcommand;
    },
  });
}

export async function parsePrefixMessage(message, { prefix, registry }) {
  const content = String(message.content ?? "");
  const prefixPattern = new RegExp(`^${prefix}(?:\\s|$)`, "i");
  if (!prefixPattern.test(content.trimStart())) return null;

  const tokens = tokenizePrefixCommand(content);
  if (tokens.length === 0 || tokens[0].toLowerCase() !== prefix) return null;
  const alias = tokens[1]?.toLowerCase() ?? "help";
  const definition = registry.resolve(alias);
  if (!definition) {
    throw new PrefixCommandParseError(
      `Unknown command: ${alias}. Use \`${prefix} help\` for guidance.`,
    );
  }
  const commandData = definition.command.data.toJSON();
  let optionDefinitions = commandData.options ?? [];
  let argumentTokens = tokens.slice(tokens[1] ? 2 : 1);
  let subcommand = null;
  if (optionDefinitions.some((option) =>
    option.type === ApplicationCommandOptionType.Subcommand
  )) {
    const requested = argumentTokens[0]?.toLowerCase();
    const selected = optionDefinitions.find((option) =>
      option.type === ApplicationCommandOptionType.Subcommand &&
      option.name === requested
    ) ?? optionDefinitions.find((option) => option.name === "view");
    if (!selected) {
      throw new PrefixCommandParseError(
        `Choose a subcommand: ${optionDefinitions.map((option) => option.name).join(", ")}.`,
      );
    }
    subcommand = selected.name;
    if (requested === subcommand) argumentTokens = argumentTokens.slice(1);
    optionDefinitions = selected.options ?? [];
  }
  const values = await parseOptions({
    message,
    prefix,
    commandName: definition.commandName,
    options: optionDefinitions,
    tokens: argumentTokens,
    subcommand,
  });
  return Object.freeze({
    command: definition.command,
    commandName: definition.commandName,
    alias,
    options: prefixOptions(values, subcommand),
  });
}
