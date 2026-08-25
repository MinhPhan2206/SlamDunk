import {
  createBattleGameCompletePayload,
  createBattleLivePayload,
  createBattleRewardSummary,
  createBattleRewardBreakdownEmbed,
} from "../presenters/battle.presenter.js";
import { createBattleReportImage } from "./battle-report-image.js";
import { createBattleTimeline } from "./battle-timeline.js";
import { createMatchupImage } from "./matchup-image.js";
import { createDuelMatchupImage } from "./duel-matchup-image.js";

function validateConfig(config) {
  for (const field of [
    "tickMilliseconds",
    "linesPerTick",
    "simulateButtonLifetimeMilliseconds",
  ]) {
    if (!Number.isSafeInteger(config?.[field]) || config[field] <= 0) {
      throw new TypeError(`battlePlaybackConfig.${field} must be positive.`);
    }
  }
  return Object.freeze({ ...config });
}

export function createBattlePlayback({
  playbackConfig,
  schedule = setTimeout,
  cancel = clearTimeout,
  now = Date.now,
  renderMatchupImage = createMatchupImage,
  renderDuelMatchupImage = createDuelMatchupImage,
  renderReportImage = createBattleReportImage,
}) {
  const config = validateConfig(playbackConfig);
  const sessions = new Map();

  async function finish(session, interaction, { simulated }) {
    await interaction.editReply(
      createBattleGameCompletePayload(session.result, {
        simulated,
        ownerDisplayName: session.ownerDisplayName,
        opponentDisplayName: session.opponentDisplayName,
        timeline: session.timeline,
        tickMilliseconds: config.tickMilliseconds,
        hasMatchupImage: session.hasMatchupImage,
      }),
    );
    const rewardEmbed = createBattleRewardBreakdownEmbed(session.result, {
      ownerDisplayName: session.ownerDisplayName,
      opponentDisplayName: session.opponentDisplayName,
    });
    try {
      const reportImage = await renderReportImage(session.result, {
        ownerDisplayName: session.ownerDisplayName,
        opponentDisplayName: session.opponentDisplayName,
      });
      await interaction.followUp({
        content: rewardEmbed
          ? undefined
          : createBattleRewardSummary(session.result) ?? undefined,
        files: [{
          attachment: reportImage,
          name: `game-stats-${session.matchId}.png`,
        }],
      });
    } catch (error) {
      console.warn(`Battle report image failed: ${error.message}`);
      await interaction.followUp({
        content: [
          rewardEmbed ? null : createBattleRewardSummary(session.result),
          "GAME STATS could not be rendered for this match.",
        ].filter(Boolean).join("\n"),
      });
    }
    if (rewardEmbed) {
      await interaction.followUp({ embeds: [rewardEmbed] });
    }
  }

  function scheduleNext(session) {
    session.timer = schedule(() => {
      return session.operation = session.operation
        .then(() => advance(session))
        .catch((error) => {
          sessions.delete(session.matchId);
          console.warn(`Battle playback failed: ${error.message}`);
        });
    }, config.tickMilliseconds);
    session.timer.unref?.();
  }

  async function advance(session) {
    if (sessions.get(session.matchId) !== session) return;
    session.revealedLines = Math.min(
      session.revealedLines + config.linesPerTick,
      session.timeline.length,
    );

    if (session.revealedLines >= session.timeline.length) {
      sessions.delete(session.matchId);
      await finish(session, session.interaction, { simulated: false });
      return;
    }

    await session.interaction.editReply(createBattleLivePayload(session.result, {
      ownerDiscordUserId: session.ownerDiscordUserId,
      ownerDisplayName: session.ownerDisplayName,
      opponentDisplayName: session.opponentDisplayName,
      timeline: session.timeline,
      revealedLines: session.revealedLines,
      tickMilliseconds: config.tickMilliseconds,
      hasMatchupImage: session.hasMatchupImage,
      simulateDisabled: now() >= session.simulateExpiresAt,
      componentNamespace: session.componentNamespace,
      simulateVotes: session.simulateVotes.size,
      simulateVotesRequired: session.simulateVoters.size,
    }));
    if (sessions.get(session.matchId) === session) scheduleNext(session);
  }

  return Object.freeze({
    async start({
      interaction,
      result,
      ownerDiscordUserId,
      ownerDisplayName = "Your Team",
      opponentDisplayName,
      simulateVoterDiscordUserIds = [ownerDiscordUserId],
      componentNamespace = "battle",
    }) {
      const matchId = result.match.publicMatchId;
      if (typeof matchId !== "string" || !/^[0-9a-f]{32}$/.test(matchId)) {
        throw new TypeError("Battle playback requires a valid public Match ID.");
      }
      const previous = sessions.get(matchId);
      if (previous?.timer) cancel(previous.timer);

      const session = {
        matchId,
        interaction,
        result,
        ownerDiscordUserId: String(ownerDiscordUserId),
        ownerDisplayName: String(ownerDisplayName),
        opponentDisplayName: opponentDisplayName == null
          ? undefined
          : String(opponentDisplayName),
        componentNamespace,
        simulateVoters: new Set(simulateVoterDiscordUserIds.map(String)),
        simulateVotes: new Set(),
        timeline: createBattleTimeline(result.match.playByPlay),
        revealedLines: 0,
        simulateExpiresAt:
          now() + config.simulateButtonLifetimeMilliseconds,
        timer: null,
        operation: Promise.resolve(),
        hasMatchupImage: false,
      };
      let matchupImage;
      try {
        matchupImage = result.match.mode === "PVP_FRIENDLY_5V5"
          ? await renderDuelMatchupImage(
            result.match.inputSnapshot?.playerTeam ?? [],
            result.match.inputSnapshot?.aiTeam ?? [],
            {
              challengerName: session.ownerDisplayName,
              challengedName: session.opponentDisplayName,
            },
          )
          : await renderMatchupImage(result.match.inputSnapshot?.aiTeam ?? []);
        session.hasMatchupImage = true;
      } catch (error) {
        console.warn(`Battle matchup image failed: ${error.message}`);
      }
      sessions.set(matchId, session);
      const initialPayload = createBattleLivePayload(result, {
        ownerDiscordUserId: session.ownerDiscordUserId,
        ownerDisplayName: session.ownerDisplayName,
        opponentDisplayName: session.opponentDisplayName,
        timeline: session.timeline,
        revealedLines: 0,
        tickMilliseconds: config.tickMilliseconds,
        hasMatchupImage: session.hasMatchupImage,
        componentNamespace: session.componentNamespace,
        simulateVotes: session.simulateVotes.size,
        simulateVotesRequired: session.simulateVoters.size,
      });
      if (matchupImage) {
        initialPayload.files = [{
          attachment: matchupImage,
          name: "battle-matchup.webp",
        }];
      }
      await interaction.editReply(initialPayload);
      scheduleNext(session);
    },

    async simulate(interaction, { matchId, ownerDiscordUserId }) {
      const normalizedMatchId = String(matchId);
      const session = sessions.get(normalizedMatchId);
      if (!session || session.ownerDiscordUserId !== String(ownerDiscordUserId)) {
        return false;
      }

      sessions.delete(normalizedMatchId);
      if (session.timer) cancel(session.timer);
      await session.operation;
      await finish(session, interaction, { simulated: true });
      return true;
    },

    async voteToSimulate(interaction, { matchId, voterDiscordUserId }) {
      const normalizedMatchId = String(matchId);
      const voterId = String(voterDiscordUserId);
      const session = sessions.get(normalizedMatchId);
      if (!session) {
        return Object.freeze({
          accepted: false,
          completed: false,
          reason: "This Duel playback has already ended or is no longer active.",
        });
      }
      if (!session.simulateVoters.has(voterId)) {
        return Object.freeze({
          accepted: false,
          completed: false,
          reason: "Only Duel participants can vote to simulate this match.",
        });
      }
      if (now() >= session.simulateExpiresAt) {
        return Object.freeze({
          accepted: false,
          completed: false,
          reason: "The Simulate vote has expired.",
        });
      }
      if (session.simulateVotes.has(voterId)) {
        return Object.freeze({
          accepted: false,
          completed: false,
          reason: "You have already voted to simulate this Duel.",
        });
      }
      const operation = session.operation.then(async () => {
        if (sessions.get(normalizedMatchId) !== session) {
          return Object.freeze({
            accepted: false,
            completed: false,
            reason: "This Duel playback has already ended or is no longer active.",
          });
        }
        session.simulateVotes.add(voterId);
        if (session.simulateVotes.size < session.simulateVoters.size) {
          await interaction.editReply(createBattleLivePayload(session.result, {
            ownerDiscordUserId: session.ownerDiscordUserId,
            ownerDisplayName: session.ownerDisplayName,
            opponentDisplayName: session.opponentDisplayName,
            timeline: session.timeline,
            revealedLines: session.revealedLines,
            tickMilliseconds: config.tickMilliseconds,
            hasMatchupImage: session.hasMatchupImage,
            componentNamespace: session.componentNamespace,
            simulateVotes: session.simulateVotes.size,
            simulateVotesRequired: session.simulateVoters.size,
          }));
          return Object.freeze({ accepted: true, completed: false });
        }
        sessions.delete(normalizedMatchId);
        if (session.timer) cancel(session.timer);
        await finish(session, interaction, { simulated: true });
        return Object.freeze({ accepted: true, completed: true });
      });
      session.operation = operation.then(() => undefined, () => undefined);
      return operation;
    },

    stop() {
      for (const session of sessions.values()) {
        if (session.timer) cancel(session.timer);
      }
      sessions.clear();
    },
  });
}
