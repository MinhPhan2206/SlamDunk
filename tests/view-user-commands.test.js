import assert from "node:assert/strict";
import test from "node:test";

import { collectionCommand } from "../src/bot/commands/collection.command.js";
import { lineupCommand } from "../src/bot/commands/lineup.command.js";
import { profileCommand } from "../src/bot/commands/profile.command.js";

const CALLER = { id: "111111111111111111", username: "Caller" };
const TARGET = {
  id: "222222222222222222",
  username: "target_user",
  globalName: "Target User",
};

function interaction(options) {
  const replies = [];
  return {
    user: CALLER,
    options,
    replies,
    async deferReply() {},
    async editReply(payload) { replies.push(payload); },
  };
}

function targetPlayer() {
  return {
    playerId: "22",
    usernameSnapshot: "target_user",
    playerLevel: 0,
    xp: "0",
    gamesPlayed: 0,
    gamesWon: 0,
    gamesLost: 0,
    currentWinStreak: 0,
    highestWinStreak: 0,
  };
}

function playerService() {
  return {
    async getPlayer(discordUserId) {
      assert.equal(discordUserId, TARGET.id);
      return targetPlayer();
    },
    async getOrCreatePlayer() {
      assert.fail("Viewing another user must not create or update that Player.");
    },
  };
}

test("profile user option displays another existing Player", async () => {
  const commandInteraction = interaction({ getUser: () => TARGET });
  await profileCommand.execute(commandInteraction, {
    services: {
      player: playerService(),
    },
  });

  const embed = commandInteraction.replies[0].embeds[0].toJSON();
  assert.equal(embed.title, "Target User's Profile");
  assert.match(embed.description, /Level 0.*0 \/ 1,000 XP/s);
  assert.match(embed.fields[0].value, /W-L:.*0-0.*Total Games:.*0/s);
  assert.doesNotMatch(JSON.stringify(embed), /Wallet|Gold|Shards|Win Rate/);
});

test("collection user option displays and paginates another Player's cards", async () => {
  const commandInteraction = interaction({
    getUser: () => TARGET,
    getInteger: () => 1,
  });
  await collectionCommand.execute(commandInteraction, {
    services: {
      player: playerService(),
      collection: {
        async listOwnedCards(input) {
          assert.deepEqual(input, { playerId: "22", page: 1 });
          return {
            cards: [], total: "0", page: 1, totalPages: 0,
            sortLabel: "Rarity",
          };
        },
      },
    },
  });

  assert.equal(
    commandInteraction.replies[0].embeds[0].toJSON().title,
    "Target User's Collection",
  );
});

test("lineup view user option displays another Player without allowing edits", async () => {
  const commandInteraction = interaction({
    getSubcommand: () => "view",
    getUser: () => TARGET,
  });
  await lineupCommand.execute(commandInteraction, {
    services: {
      player: playerService(),
      lineup: {
        async getLineup(playerId) {
          assert.equal(playerId, "22");
          return {
            complete: false,
            slots: ["PG", "SG", "SF", "PF", "C"].map((slot) => ({
              slot,
              cardInstanceId: null,
            })),
          };
        },
      },
    },
  });

  assert.equal(
    commandInteraction.replies[0].embeds[0].toJSON().title,
    "🏀 Target User's Lineup",
  );
});
