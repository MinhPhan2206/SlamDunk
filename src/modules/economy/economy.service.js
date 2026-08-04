import { withTransaction } from "../../database/transaction/transaction-manager.js";
import { EconomyError } from "./economy.errors.js";
import { economyTransactionRepository } from "./economy-transaction.repository.js";
import { walletRepository } from "./wallet.repository.js";

export const EconomyCurrency = Object.freeze({
  GOLD: "GOLD",
  SHARDS: "SHARDS",
});

const MAX_BIGINT = 9_223_372_036_854_775_807n;
const TRANSACTION_TYPE_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const BALANCE_PROPERTY = Object.freeze({
  [EconomyCurrency.GOLD]: "goldBalance",
  [EconomyCurrency.SHARDS]: "shardBalance",
});

function normalizePlayerId(playerId) {
  const value = String(playerId);

  if (
    !/^\d+$/.test(value) ||
    BigInt(value) <= 0n ||
    BigInt(value) > MAX_BIGINT
  ) {
    throw new TypeError("playerId must be a positive integer.");
  }

  return value;
}

function normalizeCurrency(currency) {
  if (!Object.values(EconomyCurrency).includes(currency)) {
    throw new TypeError("currency must be GOLD or SHARDS.");
  }

  return currency;
}

function normalizePositiveAmount(amount) {
  const isIntegerString = typeof amount === "string" && /^\d+$/.test(amount);
  const isSafeInteger = typeof amount === "number" && Number.isSafeInteger(amount);

  if (typeof amount !== "bigint" && !isIntegerString && !isSafeInteger) {
    throw new TypeError("amount must be a positive integer.");
  }

  let value;

  try {
    value = BigInt(amount);
  } catch {
    throw new TypeError("amount must be a positive integer.");
  }

  if (value <= 0n || value > MAX_BIGINT) {
    throw new TypeError("amount must be a positive 64-bit integer.");
  }

  return value;
}

function normalizeRequiredText(value, fieldName) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeTransactionType(transactionType) {
  const value = normalizeRequiredText(transactionType, "transactionType");

  if (!TRANSACTION_TYPE_PATTERN.test(value)) {
    throw new TypeError(
      "transactionType must use uppercase letters, numbers, and underscores.",
    );
  }

  return value;
}

function normalizeReference(referenceType, referenceId) {
  if (referenceType == null && referenceId == null) {
    return Object.freeze({ referenceType: null, referenceId: null });
  }

  if (referenceType == null || referenceId == null) {
    throw new TypeError(
      "referenceType and referenceId must either both be provided or both be null.",
    );
  }

  return Object.freeze({
    referenceType: normalizeRequiredText(referenceType, "referenceType"),
    referenceId: normalizeRequiredText(referenceId, "referenceId"),
  });
}

function normalizeMovementInput(input) {
  if (!input || typeof input !== "object") {
    throw new TypeError("Economy movement input is required.");
  }

  return Object.freeze({
    playerId: normalizePlayerId(input.playerId),
    currency: normalizeCurrency(input.currency),
    amount: normalizePositiveAmount(input.amount),
    transactionType: normalizeTransactionType(input.transactionType),
    idempotencyKey: normalizeRequiredText(
      input.idempotencyKey,
      "idempotencyKey",
    ),
    ...normalizeReference(input.referenceType, input.referenceId),
  });
}

function getBalance(wallet, currency) {
  return BigInt(wallet[BALANCE_PROPERTY[currency]]);
}

function assertMatchingTransaction(transaction, expected) {
  const matches =
    transaction.playerId === expected.playerId &&
    transaction.currency === expected.currency &&
    transaction.amount === expected.amount.toString() &&
    transaction.transactionType === expected.transactionType &&
    transaction.referenceType === expected.referenceType &&
    transaction.referenceId === expected.referenceId;

  if (!matches) {
    throw new EconomyError(
      "IDEMPOTENCY_CONFLICT",
      "The idempotency key was already used for a different economy movement.",
    );
  }
}

function movementResult(transaction, replayed) {
  return Object.freeze({
    transaction,
    balanceAfter: transaction.balanceAfter,
    replayed,
  });
}

async function useTransaction(databasePool, database, operation) {
  if (database) {
    return operation(database);
  }

  return withTransaction(databasePool, operation);
}

async function lockWallets(database, playerIds) {
  const orderedPlayerIds = [...new Set(playerIds)].sort((left, right) => {
    const leftId = BigInt(left);
    const rightId = BigInt(right);
    return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
  });
  const wallets = await walletRepository.findByPlayerIdsForUpdate(
    database,
    orderedPlayerIds,
  );

  if (wallets.length !== orderedPlayerIds.length) {
    throw new EconomyError("WALLET_NOT_FOUND", "Player wallet was not found.");
  }

  return new Map(wallets.map((wallet) => [wallet.playerId, wallet]));
}

async function applyMovement(database, input, signedAmount) {
  const wallets = await lockWallets(database, [input.playerId]);
  const existingTransaction =
    await economyTransactionRepository.findByIdempotencyKey(
      database,
      input.idempotencyKey,
    );
  const expectedTransaction = { ...input, amount: signedAmount };

  if (existingTransaction) {
    assertMatchingTransaction(existingTransaction, expectedTransaction);
    return movementResult(existingTransaction, true);
  }

  const wallet = wallets.get(input.playerId);
  const balanceAfter = getBalance(wallet, input.currency) + signedAmount;

  if (balanceAfter < 0n) {
    throw new EconomyError(
      `INSUFFICIENT_${input.currency}`,
      `Insufficient ${input.currency.toLowerCase()} balance.`,
    );
  }

  if (balanceAfter > MAX_BIGINT) {
    throw new EconomyError(
      "BALANCE_OVERFLOW",
      "The resulting balance exceeds the supported range.",
    );
  }

  await walletRepository.setBalance(database, {
    playerId: input.playerId,
    currency: input.currency,
    balance: balanceAfter.toString(),
  });
  const transaction = await economyTransactionRepository.create(database, {
    ...input,
    amount: signedAmount.toString(),
    balanceAfter: balanceAfter.toString(),
  });

  return movementResult(transaction, false);
}

function normalizeTransferInput(input) {
  if (!input || typeof input !== "object") {
    throw new TypeError("Economy transfer input is required.");
  }

  const fromPlayerId = normalizePlayerId(input.fromPlayerId);
  const toPlayerId = normalizePlayerId(input.toPlayerId);

  if (fromPlayerId === toPlayerId) {
    throw new TypeError("A transfer requires two different players.");
  }

  return Object.freeze({
    fromPlayerId,
    toPlayerId,
    currency: normalizeCurrency(input.currency),
    amount: normalizePositiveAmount(input.amount),
    transactionType: normalizeTransactionType(input.transactionType),
    idempotencyKey: normalizeRequiredText(
      input.idempotencyKey,
      "idempotencyKey",
    ),
    ...normalizeReference(input.referenceType, input.referenceId),
  });
}

export function createEconomyService({ databasePool }) {
  return Object.freeze({
    async ensureWallet(playerId, { database = databasePool } = {}) {
      const wallet = await walletRepository.createIfMissing(
        database,
        normalizePlayerId(playerId),
      );

      if (!wallet) {
        throw new EconomyError(
          "WALLET_NOT_FOUND",
          "Player wallet could not be created.",
        );
      }

      return wallet;
    },

    async getWallet(playerId, { database = databasePool } = {}) {
      return walletRepository.findByPlayerId(
        database,
        normalizePlayerId(playerId),
      );
    },

    async getBalance(playerId, { database = databasePool } = {}) {
      const wallet = await walletRepository.findByPlayerId(
        database,
        normalizePlayerId(playerId),
      );

      if (!wallet) {
        throw new EconomyError("WALLET_NOT_FOUND", "Player wallet was not found.");
      }

      return wallet;
    },

    async assertSufficientBalance(
      playerId,
      currency,
      amount,
      { database = databasePool } = {},
    ) {
      const normalizedCurrency = normalizeCurrency(currency);
      const requiredAmount = normalizePositiveAmount(amount);
      const wallet = await walletRepository.findByPlayerId(
        database,
        normalizePlayerId(playerId),
      );

      if (!wallet) {
        throw new EconomyError("WALLET_NOT_FOUND", "Player wallet was not found.");
      }

      if (getBalance(wallet, normalizedCurrency) < requiredAmount) {
        throw new EconomyError(
          `INSUFFICIENT_${normalizedCurrency}`,
          `Insufficient ${normalizedCurrency.toLowerCase()} balance.`,
        );
      }

      return wallet;
    },

    async credit(input, { database } = {}) {
      const normalizedInput = normalizeMovementInput(input);

      return useTransaction(databasePool, database, (transactionDatabase) =>
        applyMovement(
          transactionDatabase,
          normalizedInput,
          normalizedInput.amount,
        ),
      );
    },

    async debit(input, { database } = {}) {
      const normalizedInput = normalizeMovementInput(input);

      return useTransaction(databasePool, database, (transactionDatabase) =>
        applyMovement(
          transactionDatabase,
          normalizedInput,
          -normalizedInput.amount,
        ),
      );
    },

    async transfer(input, { database } = {}) {
      const normalizedInput = normalizeTransferInput(input);

      return useTransaction(databasePool, database, async (transactionDatabase) => {
        const wallets = await lockWallets(transactionDatabase, [
          normalizedInput.fromPlayerId,
          normalizedInput.toPlayerId,
        ]);
        const debitKey = `${normalizedInput.idempotencyKey}:debit`;
        const creditKey = `${normalizedInput.idempotencyKey}:credit`;
        const existingTransactions =
          await economyTransactionRepository.findByIdempotencyKeys(
            transactionDatabase,
            [debitKey, creditKey],
          );
        const expectedDebit = {
          playerId: normalizedInput.fromPlayerId,
          currency: normalizedInput.currency,
          amount: -normalizedInput.amount,
          transactionType: normalizedInput.transactionType,
          referenceType: normalizedInput.referenceType,
          referenceId: normalizedInput.referenceId,
        };
        const expectedCredit = {
          playerId: normalizedInput.toPlayerId,
          currency: normalizedInput.currency,
          amount: normalizedInput.amount,
          transactionType: normalizedInput.transactionType,
          referenceType: normalizedInput.referenceType,
          referenceId: normalizedInput.referenceId,
        };

        if (existingTransactions.length > 0) {
          const transactionsByKey = new Map(
            existingTransactions.map((transaction) => [
              transaction.idempotencyKey,
              transaction,
            ]),
          );
          const debitTransaction = transactionsByKey.get(debitKey);
          const creditTransaction = transactionsByKey.get(creditKey);

          if (!debitTransaction || !creditTransaction) {
            throw new EconomyError(
              "IDEMPOTENCY_CONFLICT",
              "The transfer idempotency key has incomplete ledger entries.",
            );
          }

          assertMatchingTransaction(debitTransaction, expectedDebit);
          assertMatchingTransaction(creditTransaction, expectedCredit);

          return Object.freeze({
            debit: debitTransaction,
            credit: creditTransaction,
            replayed: true,
          });
        }

        const sourceWallet = wallets.get(normalizedInput.fromPlayerId);
        const destinationWallet = wallets.get(normalizedInput.toPlayerId);
        const sourceBalanceAfter =
          getBalance(sourceWallet, normalizedInput.currency) -
          normalizedInput.amount;
        const destinationBalanceAfter =
          getBalance(destinationWallet, normalizedInput.currency) +
          normalizedInput.amount;

        if (sourceBalanceAfter < 0n) {
          throw new EconomyError(
            `INSUFFICIENT_${normalizedInput.currency}`,
            `Insufficient ${normalizedInput.currency.toLowerCase()} balance.`,
          );
        }

        if (destinationBalanceAfter > MAX_BIGINT) {
          throw new EconomyError(
            "BALANCE_OVERFLOW",
            "The resulting balance exceeds the supported range.",
          );
        }

        await walletRepository.setBalance(transactionDatabase, {
          playerId: normalizedInput.fromPlayerId,
          currency: normalizedInput.currency,
          balance: sourceBalanceAfter.toString(),
        });
        await walletRepository.setBalance(transactionDatabase, {
          playerId: normalizedInput.toPlayerId,
          currency: normalizedInput.currency,
          balance: destinationBalanceAfter.toString(),
        });

        const debitTransaction = await economyTransactionRepository.create(
          transactionDatabase,
          {
            playerId: normalizedInput.fromPlayerId,
            currency: normalizedInput.currency,
            amount: (-normalizedInput.amount).toString(),
            transactionType: normalizedInput.transactionType,
            referenceType: normalizedInput.referenceType,
            referenceId: normalizedInput.referenceId,
            idempotencyKey: debitKey,
            balanceAfter: sourceBalanceAfter.toString(),
          },
        );
        const creditTransaction = await economyTransactionRepository.create(
          transactionDatabase,
          {
            playerId: normalizedInput.toPlayerId,
            currency: normalizedInput.currency,
            amount: normalizedInput.amount.toString(),
            transactionType: normalizedInput.transactionType,
            referenceType: normalizedInput.referenceType,
            referenceId: normalizedInput.referenceId,
            idempotencyKey: creditKey,
            balanceAfter: destinationBalanceAfter.toString(),
          },
        );

        return Object.freeze({
          debit: debitTransaction,
          credit: creditTransaction,
          replayed: false,
        });
      });
    },
  });
}
