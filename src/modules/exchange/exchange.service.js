import { withTransaction } from "../../database/transaction/transaction-manager.js";
import { EconomyCurrency, EconomyError } from "../economy/index.js";
import { ExchangeError } from "./exchange.errors.js";
import { exchangeRepository } from "./exchange.repository.js";

export function createExchangeService({
  databasePool,
  economyService,
  securityService,
  exchangeConfig,
  upgradeConfig,
}) {
  const maximumQuantity = exchangeConfig.maximumQuantity;
  if (!Number.isSafeInteger(maximumQuantity) || maximumQuantity < 1) {
    throw new TypeError("exchangeConfig.maximumQuantity must be a positive integer.");
  }
  const offer = Object.freeze({
    offerCode: "level_up",
    inputItem: "shard",
    inputAmount: exchangeConfig.shard.levelUpCost,
    outputItemType: upgradeConfig.levelUpItemType,
    outputItemName: upgradeConfig.levelUpItemName,
    outputQuantity: exchangeConfig.shard.levelUpQuantity,
  });
  return Object.freeze({
    maximumQuantity,
    listOffers(item) {
      if (item !== "shard") throw new ExchangeError("ITEM_NOT_SUPPORTED", "This exchange item is not supported.");
      return Object.freeze([offer]);
    },
    async exchange(
      { playerId, offerCode, interactionId, quantity = 1 },
      { database: suppliedDatabase } = {},
    ) {
      if (offerCode !== offer.offerCode) throw new ExchangeError("OFFER_NOT_FOUND", "Exchange offer was not found.");
      const normalizedQuantity = Number(quantity);
      if (
        !Number.isSafeInteger(normalizedQuantity) ||
        normalizedQuantity < 1 ||
        normalizedQuantity > maximumQuantity
      ) {
        throw new ExchangeError(
          "QUANTITY_INVALID",
          `Exchange quantity must be between 1 and ${maximumQuantity}.`,
        );
      }
      const appliedOffer = Object.freeze({
        ...offer,
        inputAmount: offer.inputAmount * normalizedQuantity,
        outputQuantity: offer.outputQuantity * normalizedQuantity,
        exchangeQuantity: normalizedQuantity,
      });
      const operation = async (database) => {
        const existing = await exchangeRepository.findByInteractionId(database, interactionId);
        if (existing) {
          return Object.freeze({ exchange: existing, offer: appliedOffer, replayed: true });
        }
        await securityService?.assertPlayerActive({ playerId }, { database });
        let debit;
        try {
          debit = await economyService.debit({
            playerId, currency: EconomyCurrency.SHARDS, amount: appliedOffer.inputAmount,
            transactionType: "ITEM_EXCHANGE", referenceType: "DISCORD_INTERACTION",
            referenceId: interactionId, idempotencyKey: `exchange:${interactionId}:shards`,
          }, { database });
        } catch (error) {
          if (error instanceof EconomyError && error.code === "INSUFFICIENT_SHARDS") {
            throw new ExchangeError("INSUFFICIENT_SHARDS", `You need ${appliedOffer.inputAmount} Shards for this exchange.`);
          }
          throw error;
        }
        const exchange = await exchangeRepository.create(database, {
          playerId, inputAmount: appliedOffer.inputAmount, outputItemType: offer.outputItemType,
          outputQuantity: appliedOffer.outputQuantity, interactionId,
        });
        const itemQuantity = await exchangeRepository.grantItem(database, {
          playerId, itemType: offer.outputItemType, quantity: appliedOffer.outputQuantity,
        });
        return Object.freeze({ exchange, offer: appliedOffer, shardBalanceAfter: debit.balanceAfter, itemQuantity, replayed: false });
      };
      return suppliedDatabase
        ? operation(suppliedDatabase)
        : withTransaction(databasePool, operation);
    },
  });
}
