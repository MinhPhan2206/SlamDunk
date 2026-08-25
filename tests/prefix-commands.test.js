import assert from "node:assert/strict";
import test from "node:test";
import { GatewayIntentBits } from "discord.js";

import { createDiscordClient } from "../src/bot/client/discord-client.js";
import { commands } from "../src/bot/commands/index.js";
import { createMessageCreateHandler } from "../src/bot/events/message-create.event.js";
import { createPrefixCommandRegistry } from "../src/bot/prefix/prefix-command-registry.js";
import {
  PrefixCommandParseError,
  parsePrefixMessage,
  tokenizePrefixCommand,
} from "../src/bot/prefix/prefix-command-parser.js";

const registry = createPrefixCommandRegistry(commands);

function fakeUser(id, username = `User${id}`) {
  return { id, username, globalName: username, bot: false };
}

function fakeMessage(content) {
  const mentioned = fakeUser("997829444410544198", "Mentioned");
  return {
    id: "123456789012345678",
    content,
    guild: { id: "1" },
    guildId: "1",
    channelId: "2",
    author: fakeUser("805986648973770783", "Invoker"),
    member: { displayName: "Invoker" },
    mentions: { users: new Map([[mentioned.id, mentioned]]) },
    client: {
      users: {
        async fetch(id) { return id === mentioned.id ? mentioned : null; },
      },
    },
  };
}

test("Prefix alias registry resolves approved shortcuts without collisions", () => {
  assert.equal(registry.resolve("d").commandName, "drop");
  assert.equal(registry.resolve("b").commandName, "battle");
  assert.equal(registry.resolve("cd").commandName, "cooldowns");
  assert.equal(registry.resolve("dl").commandName, "unlist");
  assert.equal(registry.resolve("ulk").commandName, "unlock");
  assert.equal(registry.resolve("scrim").commandName, "practice");
  assert.equal(registry.resolve("pvp").commandName, "duel");
  assert.equal(registry.resolve("vs").commandName, "duel");
});

test("Prefix parser supports defaults, mentions, subcommands, choices, and names", async () => {
  const battle = await parsePrefixMessage(fakeMessage("SD b"), {
    prefix: "sd",
    registry,
  });
  assert.equal(battle.commandName, "battle");
  assert.equal(battle.options.getString("opponent_bracket", true), "street");

  const card = await parsePrefixMessage(
    fakeMessage('sd card "Nikola Jokic"'),
    { prefix: "sd", registry },
  );
  assert.equal(card.options.getString("card", true), "Nikola Jokic");

  const collection = await parsePrefixMessage(
    fakeMessage("sd col <@997829444410544198>"),
    { prefix: "sd", registry },
  );
  assert.equal(collection.options.getInteger("page"), null);
  assert.equal(collection.options.getUser("user").username, "Mentioned");

  const lineup = await parsePrefixMessage(
    fakeMessage("sd lu set pg !123456789"),
    { prefix: "sd", registry },
  );
  assert.equal(lineup.options.getSubcommand(), "set");
  assert.equal(lineup.options.getString("slot", true), "PG");
  assert.equal(lineup.options.getString("card_id", true), "!123456789");

  const rarity = await parsePrefixMessage(
    fakeMessage("sd r allstar pg 3point"),
    { prefix: "sd", registry },
  );
  assert.equal(rarity.options.getString("rarity", true), "ALL_STAR");
  assert.equal(rarity.options.getString("position"), "PG");
  assert.equal(rarity.options.getString("sort_by"), "three_point");

  const pack = await parsePrefixMessage(fakeMessage("sd pk"), {
    prefix: "sd",
    registry,
  });
  assert.equal(pack.options.getString("pack_type", true), "standard");
});

test("Prefix tokenizer and parser reject malformed commands clearly", async () => {
  assert.deepEqual(tokenizePrefixCommand('sd card "LeBron James"'), [
    "sd",
    "card",
    "LeBron James",
  ]);
  assert.throws(
    () => tokenizePrefixCommand('sd card "LeBron James'),
    PrefixCommandParseError,
  );
  await assert.rejects(
    parsePrefixMessage(fakeMessage("sd unknown"), {
      prefix: "sd",
      registry,
    }),
    PrefixCommandParseError,
  );
});

test("Prefix parser ignores normal apostrophes outside commands", async () => {
  const normalMessage = await parsePrefixMessage(fakeMessage("it's goat time"), {
    prefix: "sd",
    registry,
  });
  assert.equal(normalMessage, null);

  const card = await parsePrefixMessage(
    fakeMessage("sd card De'Aaron Fox"),
    { prefix: "sd", registry },
  );
  assert.equal(card.options.getString("card", true), "De'Aaron Fox");
});

test("MessageCreate routes a prefix alias through the existing command", async () => {
  const replies = [];
  const replyMessage = {
    id: "223456789012345678",
    components: [],
    embeds: [],
    attachments: [],
    async edit(payload) {
      replies.push(payload);
      return this;
    },
  };
  const message = {
    ...fakeMessage("sd ping"),
    channel: { async send(payload) { replies.push(payload); return replyMessage; } },
    async reply(payload) {
      replies.push(payload);
      return replyMessage;
    },
  };
  const handler = createMessageCreateHandler({
    prefix: "sd",
    registry,
  });

  await handler(message);
  assert.equal(replies[0], "Pong!");
});

test("Discord Client enables only the Gateway intents required for prefix commands", () => {
  const client = createDiscordClient();
  assert.equal(client.options.intents.has(GatewayIntentBits.Guilds), true);
  assert.equal(client.options.intents.has(GatewayIntentBits.GuildMessages), true);
  assert.equal(client.options.intents.has(GatewayIntentBits.MessageContent), true);
  assert.equal(client.options.intents.has(GatewayIntentBits.GuildMembers), false);
  client.destroy();
});
