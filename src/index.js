import { createApplication } from "./app.js";
import { getDiscordRuntimeConfig } from "./config/env.js";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function main() {
  const config = getDiscordRuntimeConfig();
  const application = createApplication({ discordToken: config.token });
  let isShuttingDown = false;

  const shutdown = (signal) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`Received ${signal}. Shutting down SlamDunk.`);
    application.stop();
    process.exitCode = 0;
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));

  try {
    await application.start();
  } catch (error) {
    application.stop();
    throw error;
  }
}

main().catch((error) => {
  console.error(`SlamDunk failed to start: ${getErrorMessage(error)}`);
  process.exitCode = 1;
});
