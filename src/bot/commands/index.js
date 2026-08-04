import { claimCommand } from "./claim.command.js";
import { cooldownsCommand } from "./cooldowns.command.js";
import { pingCommand } from "./ping.command.js";
import { packCommand } from "./pack.command.js";
import { profileCommand } from "./profile.command.js";
import { rarityCommand } from "./rarity.command.js";

export const commands = Object.freeze([
  pingCommand,
  profileCommand,
  claimCommand,
  packCommand,
  cooldownsCommand,
  rarityCommand,
]);
