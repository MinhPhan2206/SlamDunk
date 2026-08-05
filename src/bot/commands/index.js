import { claimCommand } from "./claim.command.js";
import { battleCommand } from "./battle.command.js";
import { cooldownsCommand } from "./cooldowns.command.js";
import { collectionCommand } from "./collection.command.js";
import { pingCommand } from "./ping.command.js";
import { dropCommand } from "./drop.command.js";
import { lineupCommand } from "./lineup.command.js";
import { profileCommand } from "./profile.command.js";
import { rarityCommand } from "./rarity.command.js";
import { quicksellCommand } from "./quicksell.command.js";
import { upgradeCommand } from "./upgrade.command.js";
import { marketCommand } from "./market.command.js";
import { tradeCommand } from "./trade.command.js";
import { oddsCommand } from "./odds.command.js";
import { packCommand } from "./pack.command.js";
import { dailyCommand } from "./daily.command.js";
import { exchangeCommand } from "./exchange.command.js";
import { sortCommand } from "./sort.command.js";

export const commands = Object.freeze([
  pingCommand,
  profileCommand,
  claimCommand,
  dropCommand,
  collectionCommand,
  lineupCommand,
  battleCommand,
  cooldownsCommand,
  rarityCommand,
  quicksellCommand,
  upgradeCommand,
  marketCommand,
  tradeCommand,
  oddsCommand,
  packCommand,
  dailyCommand,
  exchangeCommand,
  sortCommand,
]);
