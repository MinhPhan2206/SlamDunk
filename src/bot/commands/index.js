import { claimCommand } from "./claim.command.js";
import { battleCommand, practiceCommand } from "./battle.command.js";
import { cooldownsCommand } from "./cooldowns.command.js";
import { collectionCommand } from "./collection.command.js";
import { pingCommand } from "./ping.command.js";
import { dropCommand } from "./drop.command.js";
import { lineupCommand } from "./lineup.command.js";
import { profileCommand } from "./profile.command.js";
import { rarityCommand } from "./rarity.command.js";
import { quicksellCommand } from "./quicksell.command.js";
import { levelUpCommand, upgradeCommand } from "./upgrade.command.js";
import {
  buyCommand,
  marketCommand,
  sellCommand,
  unlistCommand,
} from "./market.command.js";
import { tradeCommand } from "./trade.command.js";
import { oddsCommand } from "./odds.command.js";
import { packCommand } from "./pack.command.js";
import { dailyCommand } from "./daily.command.js";
import { weeklyCommand } from "./weekly.command.js";
import { exchangeCommand } from "./exchange.command.js";
import { sortCommand } from "./sort.command.js";
import { lockCommand } from "./lock.command.js";
import { unlockCommand } from "./unlock.command.js";
import { cardCommand } from "./card.command.js";
import { walletCommand } from "./wallet.command.js";
import { bagCommand } from "./bag.command.js";
import { strategyCommand } from "./strategy.command.js";
import { helpCommand } from "./help.command.js";
import { welcomeCommand } from "./welcome.command.js";
import { duelCommand } from "./duel.command.js";

export const commands = Object.freeze([
  pingCommand,
  profileCommand,
  claimCommand,
  dropCommand,
  collectionCommand,
  lineupCommand,
  battleCommand,
  practiceCommand,
  duelCommand,
  cooldownsCommand,
  rarityCommand,
  quicksellCommand,
  upgradeCommand,
  levelUpCommand,
  marketCommand,
  sellCommand,
  unlistCommand,
  buyCommand,
  tradeCommand,
  oddsCommand,
  packCommand,
  dailyCommand,
  weeklyCommand,
  exchangeCommand,
  sortCommand,
  lockCommand,
  unlockCommand,
  cardCommand,
  walletCommand,
  bagCommand,
  strategyCommand,
  helpCommand,
  welcomeCommand,
]);
