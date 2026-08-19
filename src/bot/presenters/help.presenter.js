import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

import { UI_COLORS } from "../ui/theme.js";

const OFFENSE_FIELDS = Object.freeze([
  ["⚖️ Balanced", "Adapts to each possession and uses a neutral mix of available actions."],
  ["🎯 Pace & Space", "Creates perimeter chances through spacing, drive-and-kicks, extra passes, handoffs and pick-and-pops."],
  ["🔄 Motion Offense", "Keeps players and the ball moving through passes, cuts, handoffs, relocations and off-ball screens."],
  ["🧱 Pick Game", "Builds possessions around pick-and-rolls, pick-and-pops, handoffs and passes to the roller or popper."],
  ["🥷 Isolation Creator", "Gives creators more one-on-one possessions using separation moves, drives, mid-range shots and threes."],
  ["🗡️ Rim Pressure", "Attacks the basket frequently through drives, cuts, fast breaks and direct finishing actions."],
  ["📮 Post Hub", "Runs the offense through post-ups, post kick-outs, cuts and deliberate half-court resets."],
  ["⚡ Run & Gun", "Pushes the ball after changes of possession for fast breaks, early passes, cuts and drives."],
]);

const TRAITS = Object.freeze([
  ["Perimeter Gravity", "Pulls defensive attention toward a perimeter threat and creates space for teammates."],
  ["Range Extender", "Reduces the shot-quality penalty on deep three-point attempts."],
  ["Midrange Assassin", "Improves the quality of contested mid-range opportunities."],
  ["Paint Finisher", "Creates better rim attacks and reduces contact penalties near the basket."],
  ["Catch & Shoot", "Improves shot quality and three-point accuracy when shooting immediately after a pass."],
  ["Post Technician", "Improves post creation and lowers turnover risk on post actions."],
  ["Separation Artist", "Creates more space on isolation moves, drives and pull-up opportunities."],
  ["Floor General", "Improves team decisions and reduces turnovers through better offensive control."],
  ["Pick & Roll Maestro", "Improves reads, passing and advantage creation in ball-screen actions."],
  ["Creative Passer", "Finds difficult passing windows and completes risky passes more reliably."],
  ["Connector", "Keeps possessions alive through extra passes and offensive resets."],
  ["Screen Setter", "Creates a stronger advantage for teammates when setting screens."],
  ["Off-Ball Mover", "Finds space more effectively through cuts, relocations and off-ball screens."],
  ["Point-of-Attack Stopper", "Reduces the advantage created by the opposing ball handler."],
  ["Switchable Defender", "Reduces size and strength penalties after defensive switches."],
  ["Screen Navigator", "Fights through screens and limits the handler's created advantage."],
  ["Rim Protector", "Strengthens rim contests and increases block probability."],
  ["Active Hands", "Increases pressure on handlers and the chance of forcing turnovers."],
  ["Glass Cleaner", "Improves rebound selection and the chance of securing the ball."],
  ["Transition Engine", "Increases the chance of creating a fast break after gaining possession."],
  ["Mamba Instinct", "Improves the accuracy of contested jump shots, with a stronger effect on higher levels."],
  ["Contact Finisher", "Improves finishing accuracy when contact occurs at the rim."],
  ["Clutch Gene", "Improves late-game shot making and ball security in close situations."],
  ["Moment Saver", "Applies stronger defensive pressure during close late-game situations."],
  ["Comeback Catalyst", "Improves shot making while the team is attempting a comeback."],
  ["Momentum Scorer", "Improves shot making after the player scores on consecutive possessions."],
  ["Cold-Blooded", "Provides an additional accuracy bonus on a potential game-winning shot."],
]);

const TRAIT_BY_NAME = new Map(TRAITS);
const TRAIT_GROUPS = Object.freeze([
  Object.freeze({
    code: "scoring",
    label: "Scoring",
    emoji: "⚔️",
    description: "Traits that improve shot creation and finishing in their matching situations.",
    names: Object.freeze([
      "Perimeter Gravity", "Range Extender", "Midrange Assassin", "Paint Finisher",
      "Catch & Shoot", "Post Technician", "Separation Artist", "Contact Finisher",
    ]),
  }),
  Object.freeze({
    code: "creation",
    label: "Creation",
    emoji: "🧠",
    description: "Traits that improve passing, movement, screening reads, and possession creation.",
    names: Object.freeze([
      "Floor General", "Pick & Roll Maestro", "Creative Passer", "Connector",
      "Off-Ball Mover", "Transition Engine",
    ]),
  }),
  Object.freeze({
    code: "defense",
    label: "Defense",
    emoji: "🛡️",
    description: "Traits that improve on-ball coverage, switching, steals, rim protection, and late defense.",
    names: Object.freeze([
      "Point-of-Attack Stopper", "Switchable Defender", "Screen Navigator",
      "Rim Protector", "Active Hands", "Moment Saver",
    ]),
  }),
  Object.freeze({
    code: "physical",
    label: "Physical",
    emoji: "💪",
    description: "Traits that create physical advantages away from the ball and on the glass.",
    names: Object.freeze(["Screen Setter", "Glass Cleaner"]),
  }),
  Object.freeze({
    code: "clutch",
    label: "Clutch",
    emoji: "🔥",
    description: "Traits activated by pressure, momentum, comeback, or game-winning situations.",
    names: Object.freeze([
      "Mamba Instinct", "Clutch Gene", "Comeback Catalyst", "Momentum Scorer",
      "Cold-Blooded",
    ]),
  }),
]);

function addFields(embed, fields) {
  return embed.addFields(fields.map(([name, value]) => ({ name, value, inline: false })));
}

function strategyHelp() {
  const offense = addFields(
    new EmbedBuilder()
      .setColor(UI_COLORS.primary)
      .setTitle("🏀 Strategy Guide · Offense")
      .setDescription("Offense changes which actions your team prefers. It does not directly increase player Stats."),
    OFFENSE_FIELDS,
  );

  const team = new EmbedBuilder()
    .setColor(UI_COLORS.primary)
    .setTitle("🛡️ Strategy Guide · Team Settings")
    .addFields(
      {
        name: "🎮 Main Handler",
        value: "Selects the lineup position that controls more possessions and receives the ball on opening or check-in actions.",
      },
      {
        name: "⏱️ Tempo",
        value: [
          "🐢 **Patient** — Fewer rushed possessions and fast breaks.",
          "⚖️ **Standard** — Neutral pace.",
          "⚡ **Quick** — More early offense and transition opportunities.",
        ].join("\n"),
      },
      {
        name: "🔒 Defense",
        value: [
          "⚖️ **Balanced** — Adapts coverage to the current action.",
          "🔁 **Switch** — Switches screens; can create size mismatches.",
          "🛡️ **Drop Coverage** — Protects the rim; concedes pull-ups and pick-and-pops.",
          "🔥 **Blitz Ball Handler** — Traps the handler; exposes short rolls and extra passes.",
          "⬇️ **Go Under** — Protects drives; gives shooters more space.",
          "🏠 **Stay Home** — Protects shooters; provides less rim help.",
          "🧱 **Pack Paint** — Crowds the lane; concedes kick-outs and perimeter movement.",
        ].join("\n"),
      },
      {
        name: "💪 Rebounding",
        value: [
          "⚖️ **Balanced** — Neutral rebound and transition positioning.",
          "⬆️ **Crash the Glass** — More offensive rebounds, but weaker transition defense.",
          "⬇️ **Get Back** — Fewer offensive rebounds, but better fast-break prevention.",
        ].join("\n"),
      },
    );

  const tendencies = new EmbedBuilder()
    .setColor(UI_COLORS.primary)
    .setTitle("🧠 Strategy Guide · Player Tendencies")
    .setDescription("Tendencies are configured per player. They change decisions and action frequency—not raw Stats or base shot accuracy.")
    .addFields(
      {
        name: "🤝 Decision",
        value: "**Balanced** uses normal decisions. **Pass First** looks for teammates more often. **Score First** creates and shoots more often.",
      },
      {
        name: "🎯 Shot Profile",
        value: "Choose **Balanced**, **Rim Pressure**, **Perimeter Heavy**, **Mid-Range Heavy**, or **Post Heavy** to influence where the player attacks.",
      },
      {
        name: "🏀 Creation Role",
        value: "**Balanced** uses a normal mix. **Pick & Roll** handles more ball screens. **Off-Ball Heavy** favors cuts, relocations and off-ball screens.",
      },
      {
        name: "📊 Usage",
        value: "**Normal** keeps standard involvement. **Low Usage** gives the player fewer scoring actions and creates more opportunities for teammates.",
      },
    )
    .setFooter({ text: "Use /strategy to configure your active lineup." });

  return [offense, team, tendencies];
}

function traitsHelp() {
  return TRAIT_GROUPS.map((group) => addFields(
    new EmbedBuilder()
      .setColor(UI_COLORS.primary)
      .setTitle(`${group.emoji} Trait Guide · ${group.label}`)
      .setDescription(group.description),
    group.names.map((name) => [name, TRAIT_BY_NAME.get(name)]),
  ));
}

function manualHelp() {
  const gettingStarted = new EmbedBuilder()
    .setColor(UI_COLORS.primary)
    .setTitle("🏀 SlamDunk Manual · Getting Started")
    .setDescription(
      "Collect basketball Cards, build a five-player lineup, customize your strategy, and compete against AI opponents.",
    )
    .addFields(
      {
        name: "Quick Start",
        value: [
          "**1.** Use `/claim` and `/drop` for your first resources and Cards.",
          "**2.** Use `/collection` to view your Cards.",
          "**3.** Fill PG, SG, SF, PF, and C with `/lineup set`.",
          "**4.** Configure your team with `/strategy`.",
          "**5.** Use `/battle` to earn Gold and XP.",
        ].join("\n"),
      },
      {
        name: "Free Resources",
        value: [
          "`/claim` · Receive Gold. Stores **2 charges** and recovers 1 every **15 minutes**.",
          "`/drop` · Choose 1 of 3 Cards. Stores **2 charges** and recovers 1 every **15 minutes**.",
          "`/daily` · Receive daily Gold, Shards, and XP.",
          "`/weekly` · Receive weekly Gold, Shards, and XP.",
          "`/cooldowns` · Check charges and reward timers.",
        ].join("\n"),
      },
    )
    .setFooter({ text: "Tip · Start by completing your five-player lineup." });

  const cardsAndLineup = new EmbedBuilder()
    .setColor(UI_COLORS.primary)
    .setTitle("🃏 SlamDunk Manual · Cards & Lineup")
    .addFields(
      {
        name: "Your Cards",
        value: [
          "`/collection [user]` · View a Player's collection.",
          "`/card card:<reference>` · View Stats, Traits, Battle Stats, and artwork.",
          "`/sort [sort_by]` · Sort your collection.",
          "`/rarity rarity:<rarity> [position] [sort_by]` · Browse Card Templates.",
          "`/lock card_id:<reference>` · Protect a Card from Quicksell.",
          "`/unlock card_id:<reference>` · Remove Quicksell protection.",
        ].join("\n"),
      },
      {
        name: "Build Your Lineup",
        value: [
          "`/lineup set slot:<position> card_id:<reference>` · Assign a Card.",
          "`/lineup remove slot:<position>` · Clear a position.",
          "`/lineup view [user]` · View a Player's lineup.",
          "`/strategy` · Configure team settings and Player Tendencies.",
        ].join("\n"),
      },
      {
        name: "Card References",
        value: [
          "Commands that request a Card accept either:",
          "• Public Card ID, such as `!915287361`",
          "• Current collection number, such as `4`",
        ].join("\n"),
      },
    );

  const progression = new EmbedBuilder()
    .setColor(UI_COLORS.primary)
    .setTitle("💰 SlamDunk Manual · Progression")
    .addFields(
      {
        name: "Packs & Resources",
        value: [
          "`/pack pack_type:<type>` · Purchase and open a Pack.",
          "`/odds [pack_type]` · View Drop or Pack rarity odds.",
          "`/wallet` · View your Gold.",
          "`/bag` · View Shards, Level Up items, and other inventory items.",
        ].join("\n"),
      },
      {
        name: "Card Progression",
        value: [
          "`/level-up card_id:<reference>` · Consume one Level Up item.",
          "`/upgrade card_a:<reference> card_b:<reference>` · Fuse two matching Cards.",
          "`/quicksell params:<filter>` · Sell unlocked Cards for Gold and Shards.",
          "`/exchange item:shard` · Exchange Shards for available rewards.",
        ].join("\n"),
      },
      {
        name: "Quicksell Filters",
        value: "Use `all`, a rarity, a position, a public Card ID, or a collection number.",
      },
      {
        name: "Important",
        value: "Upgrade consumes both source Cards. Quicksell is permanent—lock valuable Cards first.",
      },
    );

  const competitive = new EmbedBuilder()
    .setColor(UI_COLORS.primary)
    .setTitle("⚔️ SlamDunk Manual · Compete & Trade")
    .addFields(
      {
        name: "Battle",
        value: [
          "`/battle opponent_bracket:<difficulty>` · Battle an AI lineup.",
          "`/practice opponent_bracket:<difficulty>` · Test your lineup without rewards or record changes.",
          "`/duel user:<player>` · Challenge another Player to a friendly, reward-free Battle.",
          "Wins earn more Gold and continue your Win Streak. A loss still grants Gold and XP but resets the streak.",
          "Use `/help topic:strategy` and `/help topic:traits` for detailed guides.",
        ].join("\n"),
      },
      {
        name: "Message Shortcuts",
        value: [
          "Start a message with `dunk`; full command names and shortcuts both work.",
          "Cards · `dunk d` · `dunk pk` · `dunk col` · `dunk card <name>`",
          "Compete · `dunk b [bracket]` · `dunk pr [bracket]` · `dunk vs @player` · `dunk st`",
          "Resources · `dunk cl` · `dunk cd` · `dunk w` · `dunk inv`",
          "Use `dunk help` or `dunk commands` to open this guide.",
        ].join("\n"),
      },
      {
        name: "Market",
        value: [
          "`/market [page]` · Browse active listings.",
          "`/sell card_id:<reference> price:<Gold>` · List a Card.",
          "`/buy card_id:<Card ID>` · Purchase a listing.",
          "`/unlist card_id:<Card ID>` · Remove your listing.",
        ].join("\n"),
      },
      {
        name: "Direct Trade",
        value: [
          "`/trade user:<player>` · Start a protected Direct Trade.",
          "**Invitation → Editing → Ready → Final Review → Final Accept**",
          "Check exactly what both Players give. Any offer change invalidates previous approval.",
        ].join("\n"),
      },
      {
        name: "Player Information",
        value: [
          "`/profile [user]` · View Player Level and Battle record.",
          "`/ping` · Check whether SlamDunk is online.",
        ].join("\n"),
      },
    )
    .setFooter({ text: "Use /help again whenever you need a system guide." });

  return [gettingStarted, cardsAndLineup, progression, competitive];
}

const MANUAL_TABS = Object.freeze([
  Object.freeze({ code: "start", label: "Start", emoji: "🏀" }),
  Object.freeze({ code: "cards", label: "Cards", emoji: "🃏" }),
  Object.freeze({ code: "progress", label: "Progress", emoji: "💰" }),
  Object.freeze({ code: "compete", label: "Compete", emoji: "⚔️" }),
]);

const STRATEGY_TABS = Object.freeze([
  Object.freeze({ code: "offense", label: "Offense", emoji: "🏀" }),
  Object.freeze({ code: "team", label: "Team", emoji: "🛡️" }),
  Object.freeze({ code: "tendencies", label: "Tendencies", emoji: "🧠" }),
]);

const TRAIT_TABS = Object.freeze(TRAIT_GROUPS.map(({ code, label, emoji }) =>
  Object.freeze({ code, label, emoji })));

const HELP_TOPICS = Object.freeze({
  manual: Object.freeze({ tabs: MANUAL_TABS, buildEmbeds: manualHelp }),
  strategy: Object.freeze({ tabs: STRATEGY_TABS, buildEmbeds: strategyHelp }),
  traits: Object.freeze({ tabs: TRAIT_TABS, buildEmbeds: traitsHelp }),
});

export function createHelpTopicPayload({
  topic,
  viewerDiscordUserId,
  selectedTab,
}) {
  const definition = HELP_TOPICS[topic];
  if (!definition) throw new TypeError(`Unsupported help topic: ${topic}.`);
  const activeTab = selectedTab ?? definition.tabs[0].code;
  const tabIndex = definition.tabs.findIndex((tab) => tab.code === activeTab);
  if (tabIndex < 0) {
    throw new TypeError(`Unsupported ${topic} tab: ${activeTab}.`);
  }
  const row = new ActionRowBuilder().addComponents(
    definition.tabs.map((tab) => new ButtonBuilder()
      .setCustomId(`help:${topic}:${viewerDiscordUserId}:${tab.code}`)
      .setLabel(tab.label)
      .setEmoji(tab.emoji)
      .setStyle(tab.code === activeTab ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(tab.code === activeTab)),
  );
  return {
    embeds: [definition.buildEmbeds()[tabIndex]],
    components: [row],
  };
}

export function createManualHelpPayload({
  viewerDiscordUserId,
  selectedTab = "start",
}) {
  return createHelpTopicPayload({
    topic: "manual",
    viewerDiscordUserId,
    selectedTab,
  });
}
