import { claimCommand } from "./claim.command.js";
import { battleCommand } from "./battle.command.js";
import { cooldownsCommand } from "./cooldowns.command.js";
import { collectionCommand } from "./collection.command.js";
import { pingCommand } from "./ping.command.js";
import { packCommand } from "./pack.command.js";
import { lineupCommand } from "./lineup.command.js";
import { profileCommand } from "./profile.command.js";
import { rarityCommand } from "./rarity.command.js";
import { quicksellCommand } from "./quicksell.command.js";
import { upgradeCommand } from "./upgrade.command.js";

export const commands = Object.freeze([
  pingCommand,
  profileCommand,
  claimCommand,
  packCommand,
  collectionCommand,
  lineupCommand,
  battleCommand,
  cooldownsCommand,
  rarityCommand,
  quicksellCommand,
  upgradeCommand,
]);
