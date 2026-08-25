import assert from "node:assert/strict";
import test from "node:test";

import {
  getApplicationRuntimeConfig,
  getSanitizedStartupConfig,
  getTestDatabaseConfig,
} from "../src/config/env.js";
import { getGameConfig } from "../src/config/game-config.js";
import { createPostgresPool } from "../src/database/connection/postgres.js";

const CONFIG_NAMES = [
  "NODE_ENV",
  "ECONOMY_CONFIG_PROFILE",
  "DATABASE_SSL_MODE",
  "DATABASE_URL",
  "TEST_DATABASE_URL",
  "DISCORD_TOKEN",
  "DISCORD_CLIENT_ID",
  "DISCORD_GUILD_ID",
  "DISCORD_COMMUNITY_GUILD_ID",
  "DISCORD_COMMUNITY_TRADE_CHANNEL_IDS",
  "DISCORD_COMMUNITY_BATTLE_CHANNEL_IDS",
  "DISCORD_COMMUNITY_DUEL_CHANNEL_IDS",
];

const DEVELOPMENT_ENVIRONMENT = Object.freeze({
  NODE_ENV: "development",
  ECONOMY_CONFIG_PROFILE: "development",
  DATABASE_SSL_MODE: "disable",
  DATABASE_URL: "postgresql://development.invalid/slamdunk",
  DISCORD_TOKEN: "development-token",
  DISCORD_CLIENT_ID: "11111111111111111",
  DISCORD_GUILD_ID: "22222222222222222",
});

const PRODUCTION_ENVIRONMENT = Object.freeze({
  ...DEVELOPMENT_ENVIRONMENT,
  NODE_ENV: "production",
  ECONOMY_CONFIG_PROFILE: "production",
  DATABASE_SSL_MODE: "require",
  DATABASE_URL: "postgresql://production.invalid/slamdunk",
  DISCORD_TOKEN: "production-token",
  DISCORD_CLIENT_ID: "33333333333333333",
  DISCORD_COMMUNITY_GUILD_ID: "44444444444444444",
  DISCORD_COMMUNITY_TRADE_CHANNEL_IDS: "55555555555555555",
  DISCORD_COMMUNITY_BATTLE_CHANNEL_IDS: "66666666666666666",
  DISCORD_COMMUNITY_DUEL_CHANNEL_IDS: "77777777777777777",
});

function withEnvironment(values, operation) {
  const previous = new Map(CONFIG_NAMES.map((name) => [name, process.env[name]]));
  for (const name of CONFIG_NAMES) delete process.env[name];
  Object.assign(process.env, values);
  try {
    return operation();
  } finally {
    for (const name of CONFIG_NAMES) {
      const value = previous.get(name);
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

test("runtime config rejects an unknown NODE_ENV instead of falling back", () => {
  withEnvironment(
    { ...DEVELOPMENT_ENVIRONMENT, NODE_ENV: "prod" },
    () => assert.throws(
      () => getApplicationRuntimeConfig(),
      /Invalid NODE_ENV/,
    ),
  );
});

test("production requires explicit Community access configuration", () => {
  const missingCommunity = { ...PRODUCTION_ENVIRONMENT };
  delete missingCommunity.DISCORD_COMMUNITY_GUILD_ID;

  withEnvironment(
    missingCommunity,
    () => assert.throws(
      () => getApplicationRuntimeConfig(),
      /DISCORD_COMMUNITY_GUILD_ID/,
    ),
  );
});

test("production rejects development economy and disabled database TLS", () => {
  withEnvironment(
    { ...PRODUCTION_ENVIRONMENT, ECONOMY_CONFIG_PROFILE: "development" },
    () => assert.throws(
      () => getApplicationRuntimeConfig(),
      /ECONOMY_CONFIG_PROFILE=production/,
    ),
  );
  withEnvironment(
    { ...PRODUCTION_ENVIRONMENT, DATABASE_SSL_MODE: "disable" },
    () => assert.throws(
      () => getApplicationRuntimeConfig(),
      /TLS cannot be disabled/,
    ),
  );
});

test("valid production config enables enforcement without exposing secrets", () => {
  withEnvironment(PRODUCTION_ENVIRONMENT, () => {
    const config = getApplicationRuntimeConfig();
    const summary = getSanitizedStartupConfig(config);
    const serialized = JSON.stringify(summary);

    assert.equal(config.nodeEnvironment, "production");
    assert.equal(config.economyProfile, "production");
    assert.equal(config.database.sslMode, "require");
    assert.equal(config.database.ssl.rejectUnauthorized, false);
    assert.equal(config.security.enforceEligibility, true);
    assert.equal(summary.communityChannelCounts.battle, 1);
    assert.doesNotMatch(serialized, /production-token/);
    assert.doesNotMatch(serialized, /production\.invalid/);
  });
});

test("economy profiles keep test Daily rewards out of production", () => {
  assert.equal(getGameConfig("development").daily.minimumGold, 1_000_000);
  assert.deepEqual(getGameConfig("production").daily, {
    cooldownHours: 24,
    xpReward: 300,
    minimumGold: 1_500,
    maximumGold: 2_000,
    minimumShards: 20,
    maximumShards: 30,
  });
});

test("PostgreSQL pool receives the validated TLS policy", async () => {
  const ssl = Object.freeze({ rejectUnauthorized: true });
  const pool = createPostgresPool({
    connectionString: "postgresql://production.invalid/slamdunk",
    ssl,
  });
  try {
    assert.deepEqual(pool.options.ssl, ssl);
  } finally {
    await pool.end();
  }
});

test("integration tests require a dedicated TEST_DATABASE_URL", () => {
  withEnvironment(
    DEVELOPMENT_ENVIRONMENT,
    () => assert.throws(
      () => getTestDatabaseConfig(),
      /TEST_DATABASE_URL/,
    ),
  );

  withEnvironment({
    ...DEVELOPMENT_ENVIRONMENT,
    TEST_DATABASE_URL: "postgresql://test-user:secret@localhost/slamdunk_test",
  }, () => {
    assert.equal(
      getTestDatabaseConfig().databaseUrl,
      "postgresql://test-user:secret@localhost/slamdunk_test",
    );
  });
});

test("integration tests reject production and runtime database targets", () => {
  withEnvironment({
    ...DEVELOPMENT_ENVIRONMENT,
    DATABASE_URL: "postgresql://runtime-user@database.example/slamdunk",
    TEST_DATABASE_URL: "postgresql://another-user@database.example/slamdunk?sslmode=require",
  }, () => assert.throws(
    () => getTestDatabaseConfig(),
    /must not target the same database/,
  ));

  withEnvironment({
    ...PRODUCTION_ENVIRONMENT,
    TEST_DATABASE_URL: "postgresql://test-user@localhost/slamdunk_test",
  }, () => assert.throws(
    () => getTestDatabaseConfig(),
    /Tests cannot run with NODE_ENV=production/,
  ));
});
