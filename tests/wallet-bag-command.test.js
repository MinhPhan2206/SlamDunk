import assert from "node:assert/strict";
import test from "node:test";

import { bagCommand } from "../src/bot/commands/bag.command.js";
import { walletCommand } from "../src/bot/commands/wallet.command.js";
import { UI_EMOJIS } from "../src/bot/ui/emojis.js";
import { createInventoryService } from "../src/modules/inventory/index.js";

function interaction() {
  return {
    user: {
      id: "805986648973770783",
      username: "wallet_user",
      globalName: "Wallet User",
      displayAvatarURL: () => "https://cdn.example/avatar.png",
    },
    options: { getUser: () => null },
    reply: null,
    async deferReply() {},
    async editReply(payload) { this.reply = payload; },
  };
}

function playerService() {
  return {
    async getOrCreatePlayer() {
      return { playerId: "8" };
    },
  };
}

test("/wallet shows only Gold and the Discord avatar", async () => {
  const commandInteraction = interaction();
  await walletCommand.execute(commandInteraction, {
    services: {
      player: playerService(),
      economy: {
        async getBalance(playerId) {
          assert.equal(playerId, "8");
          return { goldBalance: "20000", shardBalance: "500" };
        },
      },
    },
  });
  const embed = commandInteraction.reply.embeds[0].toJSON();
  assert.equal(embed.title, "WALLET");
  assert.equal(embed.author.name, "Wallet User");
  assert.match(embed.fields[0].value, /Gold.*20,000/s);
  assert.doesNotMatch(embed.fields[0].value, /Shard/i);
  assert.equal(embed.thumbnail.url, "https://cdn.example/avatar.png");
});

test("/bag shows Shards, Level Up, future items, and the Discord avatar", async () => {
  const commandInteraction = interaction();
  await bagCommand.execute(commandInteraction, {
    services: {
      player: playerService(),
      economy: {
        async getBalance() { return { goldBalance: "20000", shardBalance: "500" }; },
      },
      inventory: {
        async listItems() {
          return [
            { itemType: "LEVEL_UP", itemName: "Level Up", quantity: 2 },
            { itemType: "ALPHA_CONTRACT", itemName: "Alpha Contract", quantity: 1 },
            { itemType: "ALL_STAR_CONTRACT", itemName: "All-Star Contract", quantity: 1 },
            { itemType: "EVENT_TICKET", itemName: "Event Ticket", quantity: 3 },
          ];
        },
      },
    },
  });
  const embed = commandInteraction.reply.embeds[0].toJSON();
  assert.match(embed.description, new RegExp(`${UI_EMOJIS.shard.id}.*Shards.*500`));
  assert.match(embed.description, new RegExp(`${UI_EMOJIS.levelUp.id}.*Level Up.*2`));
  assert.match(embed.description, new RegExp(`${UI_EMOJIS.alphaContract.id}.*Alpha Contract.*1`));
  assert.match(embed.description, new RegExp(`${UI_EMOJIS.allStarContract.id}.*All-Star Contract.*1`));
  assert.match(embed.description, /🎟️.*Event Ticket.*3/);
  assert.doesNotMatch(embed.description, /Gold/i);
  assert.equal(embed.thumbnail.url, "https://cdn.example/avatar.png");
});

test("/bag user option displays another existing Player's inventory", async () => {
  const commandInteraction = interaction();
  const targetUser = {
    id: "1061705680060416130",
    username: "other_user",
    globalName: "Other User",
    displayAvatarURL: () => "https://cdn.example/other.png",
  };
  commandInteraction.options.getUser = () => targetUser;
  await bagCommand.execute(commandInteraction, {
    services: {
      player: {
        async getPlayer(discordUserId) {
          assert.equal(discordUserId, targetUser.id);
          return { playerId: "12" };
        },
      },
      economy: {
        async getBalance(playerId) {
          assert.equal(playerId, "12");
          return { shardBalance: "1250" };
        },
      },
      inventory: {
        async listItems(playerId) {
          assert.equal(playerId, "12");
          return [{ itemType: "LEVEL_UP", itemName: "Level Up", quantity: 4 }];
        },
      },
    },
  });

  const embed = commandInteraction.reply.embeds[0].toJSON();
  assert.equal(embed.title, "BAG");
  assert.equal(embed.author.name, "Other User");
  assert.match(embed.description, /1,250/);
  assert.equal(embed.thumbnail.url, "https://cdn.example/other.png");
});

test("/bag declares an optional Discord user option", () => {
  const option = bagCommand.data.toJSON().options[0];
  assert.equal(option.name, "user");
  assert.notEqual(option.required, true);
});

test("Inventory includes configured zero balances and discovers future item types", async () => {
  const service = createInventoryService({
    databasePool: null,
    itemDefinitions: [{ itemType: "LEVEL_UP", itemName: "Level Up" }],
  });
  const items = await service.listItems("8", {
    database: {
      async query() {
        return { rows: [{ item_type: "EVENT_TICKET", quantity: 4 }] };
      },
    },
  });
  assert.deepEqual(items, [
    { itemType: "LEVEL_UP", itemName: "Level Up", quantity: 0 },
    { itemType: "EVENT_TICKET", quantity: 4, itemName: "Event Ticket" },
  ]);
});
