import assert from "node:assert/strict";
import test from "node:test";

import { createBattlePlayback } from "../src/bot/battle/battle-playback.js";
import { battleComponent } from "../src/bot/components/battle.component.js";
import { createBattleLivePayload } from "../src/bot/presenters/battle.presenter.js";

const SLOTS = ["PG", "SG", "SF", "PF", "C"];
const PUBLIC_MATCH_ID = "0a038642a1404d938a3dc5b401f17c23";

function players(prefix, finalScore) {
  return SLOTS.map((slot, index) => ({
    slot,
    cardName: `${prefix} ${slot}`,
    cardLevel: 3,
    points: index === 0 ? finalScore - 8 : 2,
    rebounds: index,
    assists: index,
    steals: 0,
    blocks: 0,
    turnovers: 1,
    fieldGoalsMade: 2,
    fieldGoalsAttempted: 4,
    threePointersMade: 1,
    threePointersAttempted: 2,
  }));
}

function resultFixture() {
  const playerPlayers = players("Player", 21);
  const aiPlayers = players("AI", 18);
  return {
    match: {
      matchId: "12",
      publicMatchId: PUBLIC_MATCH_ID,
      winnerTeam: 1,
      engineVersion: "2.0.0",
      possessionCount: 4,
      inputSnapshot: {
        playerTeam: playerPlayers,
        aiTeam: aiPlayers,
      },
      playByPlay: [
        {
          possession: 1, offenseTeam: 1, action: "MID_RANGE",
          shotType: "MID_RANGE", result: "MAKE", points: 2,
          handler: { slot: "PG", cardName: "Player PG" },
          shooter: { slot: "PG", cardName: "Player PG" },
          score: { 1: 2, 2: 0 }, description: "Player PG scores.",
        },
        {
          possession: 2, offenseTeam: 2, action: "DRIVE",
          shotType: "FINISHING", result: "MAKE", points: 2,
          handler: { slot: "PG", cardName: "AI PG" },
          shooter: { slot: "PG", cardName: "AI PG" },
          score: { 1: 2, 2: 2 }, description: "AI PG scores.",
        },
        {
          possession: 3, offenseTeam: 1, action: "THREE_POINT",
          shotType: "THREE_POINT", result: "MAKE", points: 3,
          handler: { slot: "SG", cardName: "Player SG" },
          shooter: { slot: "SG", cardName: "Player SG" },
          score: { 1: 5, 2: 2 }, description: "Player SG scores.",
        },
        {
          possession: 4, offenseTeam: 1, action: "DRIVE",
          shotType: "FINISHING", result: "MAKE", points: 2,
          handler: { slot: "C", cardName: "Player C" },
          shooter: { slot: "C", cardName: "Player C" },
          score: { 1: 21, 2: 18 }, description: "Player C wins it.",
        },
      ],
    },
    teams: [
      { teamNumber: 1, teamName: "Your Team", finalScore: 21, players: playerPlayers },
      { teamNumber: 2, teamName: "SlamDunk AI", finalScore: 18, players: aiPlayers },
    ],
  };
}

test("Battle playback renders live possessions and then a postgame report", async () => {
  const scheduled = [];
  const edits = [];
  const reports = [];
  let currentTime = 0;
  let renderedLineup;
  const playback = createBattlePlayback({
    playbackConfig: {
      tickMilliseconds: 1_500,
      linesPerTick: 1,
      simulateButtonLifetimeMilliseconds: 60_000,
    },
    schedule(callback) {
      scheduled.push(callback);
      return { unref() {} };
    },
    cancel() {},
    now: () => currentTime,
    async renderMatchupImage(lineup) {
      renderedLineup = lineup;
      return Buffer.from("matchup-image");
    },
    async renderReportImage() { return Buffer.from("report-image"); },
  });
  const interaction = {
    async editReply(payload) { edits.push(payload); },
    async followUp(payload) { reports.push(payload); },
  };

  await playback.start({
    interaction,
    result: resultFixture(),
    ownerDiscordUserId: "99",
    ownerDisplayName: "haackzz",
  });
  assert.equal(edits[0].embeds[0].toJSON().title, "Your Matchup");
  assert.equal(edits[0].content, `\`${PUBLIC_MATCH_ID}\``);
  assert.equal(edits[0].embeds[0].toJSON().description, undefined);
  assert.equal(edits[0].files[0].name, "battle-matchup.png");
  assert.equal(renderedLineup[0].cardName, "AI PG");
  assert.equal(edits[0].components[0].components[0].data.label, "Simulate");

  currentTime = 60_000;
  await scheduled.shift()();
  assert.equal(edits[1].embeds[1].toJSON().footer, undefined);
  assert.equal(edits[1].embeds[1].toJSON().color, 0x94a3b8);
  assert.doesNotMatch(edits[1].embeds[1].toJSON().description, /\d{2}:\d{2}/);
  assert.match(edits[1].embeds[1].toJSON().description, /^🔸/u);
  assert.match(edits[1].embeds[1].toJSON().description, /`Player PG`/);
  assert.equal(edits[1].components[0].components[0].data.disabled, true);

  await scheduled.shift()();
  assert.match(edits[2].embeds[1].toJSON().description, /attempts|rises for/);
  await scheduled.shift()();
  assert.match(edits[3].embeds[1].toJSON().fields[1].value, /P\. PG\s+2\s+0\s+0/);
  assert.equal(edits[3].embeds[1].toJSON().color, 0xf59e0b);
  for (let line = 4; line <= 12; line += 1) await scheduled.shift()();
  assert.equal(edits[12].embeds[0].toJSON().title, "Your Matchup");
  assert.match(edits[12].embeds[1].toJSON().footer.text, /Game complete/);
  assert.equal(edits[12].components.length, 0);
  assert.equal(reports[0].files[0].name, `game-stats-${PUBLIC_MATCH_ID}.png`);
  assert.equal(reports[0].files[0].attachment.toString(), "report-image");
});

test("Battle live border follows the team currently leading", () => {
  const payload = createBattleLivePayload(resultFixture(), {
    ownerDiscordUserId: "99",
    timeline: [{
      eventIndex: 0,
      description: "AI takes the lead",
      score: { 1: 0, 2: 2 },
      completesPossession: true,
    }],
    revealedLines: 1,
  });

  assert.equal(payload.embeds[0].toJSON().color, 0x3b82f6);
  assert.equal(payload.embeds[1].toJSON().color, 0x3b82f6);
});

test("Battle Simulate button skips playback and is owner-only", async () => {
  const edits = [];
  const replies = [];
  let cancelled = false;
  const playback = createBattlePlayback({
    playbackConfig: {
      tickMilliseconds: 1_000,
      linesPerTick: 1,
      simulateButtonLifetimeMilliseconds: 60_000,
    },
    schedule() { return { unref() {} }; },
    cancel() { cancelled = true; },
    async renderMatchupImage() { return Buffer.from("matchup-image"); },
    async renderReportImage() { return Buffer.from("report-image"); },
  });
  await playback.start({
    interaction: { async editReply() {} },
    result: resultFixture(),
    ownerDiscordUserId: "99",
  });

  const interaction = {
    customId: `battle:simulate:${PUBLIC_MATCH_ID}:99`,
    user: { id: "99" },
    async deferUpdate() {},
    async editReply(payload) { edits.push(payload); },
    async followUp(payload) { replies.push(payload); },
  };
  await battleComponent.execute(interaction, { battlePlayback: playback });
  assert.equal(cancelled, true);
  assert.equal(edits[0].embeds[0].toJSON().title, "Your Matchup");
  assert.match(edits[0].embeds[1].toJSON().footer.text, /simulated/);
  assert.equal(replies[0].files[0].name, `game-stats-${PUBLIC_MATCH_ID}.png`);

  const unauthorized = {
    customId: `battle:simulate:${PUBLIC_MATCH_ID}:99`,
    user: { id: "100" },
    async reply(payload) { replies.push(payload); },
  };
  await battleComponent.execute(unauthorized, { battlePlayback: playback });
  assert.match(replies.at(-1).content, /Only the Battle owner/);
});
