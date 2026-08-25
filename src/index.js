import { createApplication } from "./app.js";
import {
  getApplicationRuntimeConfig,
  getSanitizedStartupConfig,
} from "./config/env.js";

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

async function main() {
  const config = getApplicationRuntimeConfig();
  console.log(JSON.stringify(getSanitizedStartupConfig(config)));
  const application = createApplication(config);
  let isShuttingDown = false;

  const shutdown = async (signal) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`Received ${signal}. Shutting down SlamDunk.`);

    try {
      await application.stop();
      process.exitCode = 0;
    } catch (error) {
      console.error(`SlamDunk shutdown failed: ${getErrorMessage(error)}`);
      process.exitCode = 1;
    }
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.once("unhandledRejection", (error) => {
    console.error(`Unhandled Promise rejection: ${getErrorMessage(error)}`);
    void shutdown("unhandledRejection").then(() => {
      process.exitCode = 1;
    });
  });
  process.once("uncaughtException", (error) => {
    console.error(`Uncaught process exception: ${getErrorMessage(error)}`);
    void shutdown("uncaughtException").then(() => {
      process.exitCode = 1;
    });
  });

  try {
    await application.start();
  } catch (error) {
    await application.stop();
    throw error;
  }
}

main().catch((error) => {
  console.error(`SlamDunk failed to start: ${getErrorMessage(error)}`);
  process.exitCode = 1;
});
