import { walletRepository } from "./wallet.repository.js";

export function createEconomyService({ databasePool }) {
  return Object.freeze({
    async ensureWallet(playerId, { database = databasePool } = {}) {
      const wallet = await walletRepository.createIfMissing(database, playerId);

      if (!wallet) {
        throw new Error("Player wallet could not be created.");
      }

      return wallet;
    },

    async getWallet(playerId) {
      return walletRepository.findByPlayerId(databasePool, playerId);
    },
  });
}
