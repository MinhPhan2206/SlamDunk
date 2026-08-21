import { withTransaction } from "../../database/transaction/transaction-manager.js";
import { EconomyCurrency } from "../economy/index.js";
import { TopGgError } from "../../integrations/topgg/index.js";
import { VoteError } from "./vote.errors.js";

const REFERENCE_TYPE = "TOPGG_VOTE";

function positiveInteger(value, fieldName) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${fieldName} must be a positive integer.`);
  }
  return value;
}

function playerId(value) {
  const normalized = String(value ?? "");
  if (!/^\d+$/.test(normalized) || BigInt(normalized) <= 0n) {
    throw new TypeError("playerId must be a positive integer.");
  }
  return normalized;
}

function discordUserId(value) {
  const normalized = String(value ?? "");
  if (!/^\d{17,20}$/.test(normalized)) {
    throw new TypeError("discordUserId must be a Discord ID.");
  }
  return normalized;
}

function voteReference(discordUserId, createdAt) {
  return `${discordUserId}:${createdAt.toISOString()}`;
}

export function createVoteService({
  databasePool,
  economyService,
  topGgClient,
  voteConfig,
  botId,
}) {
  const goldPerWeight = positiveInteger(
    voteConfig?.goldPerWeight,
    "voteConfig.goldPerWeight",
  );
  const shardsPerWeight = positiveInteger(
    voteConfig?.shardsPerWeight,
    "voteConfig.shardsPerWeight",
  );
  const normalizedBotId = botId ? String(botId) : null;
  const voteUrl = normalizedBotId
    ? `https://top.gg/bot/${normalizedBotId}/vote`
    : null;

  return Object.freeze({
    async claimVote(
      { playerId: rawPlayerId, discordUserId: rawDiscordUserId },
      { database } = {},
    ) {
      const normalizedPlayerId = playerId(rawPlayerId);
      const normalizedDiscordUserId = discordUserId(rawDiscordUserId);
      let vote;
      try {
        vote = await topGgClient.getActiveVote(normalizedDiscordUserId);
      } catch (error) {
        if (error instanceof TopGgError) {
          throw new VoteError(error.code, error.message);
        }
        throw error;
      }
      if (!vote) {
        return Object.freeze({
          voted: false,
          voteUrl,
          baseRewardGold: String(goldPerWeight),
          baseRewardShards: String(shardsPerWeight),
        });
      }
      const rewardGold = goldPerWeight * vote.weight;
      const rewardShards = shardsPerWeight * vote.weight;
      const referenceId = voteReference(normalizedDiscordUserId, vote.createdAt);
      const claim = async (transactionDatabase) => {
        const gold = await economyService.credit({
          playerId: normalizedPlayerId,
          currency: EconomyCurrency.GOLD,
          amount: rewardGold,
          transactionType: "TOPGG_VOTE_REWARD",
          referenceType: REFERENCE_TYPE,
          referenceId,
          idempotencyKey: `topgg-vote:${referenceId}:gold`,
        }, { database: transactionDatabase });
        const shards = await economyService.credit({
          playerId: normalizedPlayerId,
          currency: EconomyCurrency.SHARDS,
          amount: rewardShards,
          transactionType: "TOPGG_VOTE_REWARD",
          referenceType: REFERENCE_TYPE,
          referenceId,
          idempotencyKey: `topgg-vote:${referenceId}:shards`,
        }, { database: transactionDatabase });
        return Object.freeze({ gold, shards });
      };
      const result = database
        ? await claim(database)
        : await withTransaction(databasePool, claim);
      return Object.freeze({
        voted: true,
        voteUrl,
        rewardGold: String(rewardGold),
        rewardShards: String(rewardShards),
        weight: vote.weight,
        expiresAt: vote.expiresAt,
        replayed: result.gold.replayed && result.shards.replayed,
        baseRewardGold: String(goldPerWeight),
        baseRewardShards: String(shardsPerWeight),
      });
    },
  });
}
