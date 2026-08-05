import { withTransaction } from "../../database/transaction/transaction-manager.js";
import { EconomyCurrency, EconomyError } from "../economy/index.js";
import { ExchangeError } from "./exchange.errors.js";
import { exchangeRepository } from "./exchange.repository.js";

export function createExchangeService({ databasePool, economyService, exchangeConfig, upgradeConfig }) {
  const offer = Object.freeze({
    offerCode: "level_up",
    inputItem: "shard",
    inputAmount: exchangeConfig.shard.levelUpCost,
    outputItemType: upgradeConfig.levelUpItemType,
    outputItemName: upgradeConfig.levelUpItemName,
    outputQuantity: exchangeConfig.shard.levelUpQuantity,
  });
  return Object.freeze({
    listOffers(item) {
      if (item !== "shard") throw new ExchangeError("ITEM_NOT_SUPPORTED", "This exchange item is not supported.");
      return Object.freeze([offer]);
    },
    async exchange({ playerId, offerCode, interactionId }, { database: suppliedDatabase } = {}) {
      if (offerCode !== offer.offerCode) throw new ExchangeError("OFFER_NOT_FOUND", "Exchange offer was not found.");
      const operation = async (database) => {
        const existing = await exchangeRepository.findByInteractionId(database, interactionId);
        if (existing) {
          return Object.freeze({ exchange: existing, offer, replayed: true });
        }
        let debit;
        try {
          debit = await economyService.debit({
            playerId, currency: EconomyCurrency.SHARDS, amount: offer.inputAmount,
            transactionType: "ITEM_EXCHANGE", referenceType: "DISCORD_INTERACTION",
            referenceId: interactionId, idempotencyKey: `exchange:${interactionId}:shards`,
          }, { database });
        } catch (error) {
          if (error instanceof EconomyError && error.code === "INSUFFICIENT_SHARDS") {
            throw new ExchangeError("INSUFFICIENT_SHARDS", `You need ${offer.inputAmount} Shards for this exchange.`);
          }
          throw error;
        }
        const exchange = await exchangeRepository.create(database, {
          playerId, inputAmount: offer.inputAmount, outputItemType: offer.outputItemType,
          outputQuantity: offer.outputQuantity, interactionId,
        });
        const itemQuantity = await exchangeRepository.grantItem(database, {
          playerId, itemType: offer.outputItemType, quantity: offer.outputQuantity,
        });
        return Object.freeze({ exchange, offer, shardBalanceAfter: debit.balanceAfter, itemQuantity, replayed: false });
      };
      return suppliedDatabase
        ? operation(suppliedDatabase)
        : withTransaction(databasePool, operation);
    },
  });
}
