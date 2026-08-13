import { EmbedBuilder } from "discord.js";

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
    .setColor(UI_COLORS.secondary)
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
    .setColor(UI_COLORS.neutral)
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
  const intro = "Traits activate only in relevant Battle situations. Levels I–V increase the effect; Traits do not grant a universal Stats bonus.";
  return [TRAITS.slice(0, 14), TRAITS.slice(14)].map((traits, index) => addFields(
    new EmbedBuilder()
      .setColor(index === 0 ? UI_COLORS.primary : UI_COLORS.secondary)
      .setTitle(index === 0 ? "✨ Trait Guide · Offense & Creation" : "✨ Trait Guide · Defense & Situations")
      .setDescription(index === 0 ? intro : "Trait effects are contextual and may not activate on every possession."),
    traits,
  ));
}

export function createHelpEmbeds(topic) {
  if (topic === "strategy") return strategyHelp();
  if (topic === "traits") return traitsHelp();
  throw new TypeError(`Unsupported help topic: ${topic}.`);
}
