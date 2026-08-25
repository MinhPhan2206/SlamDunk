export function createOperationalMonitor({
  databasePool,
  abuseGuard,
  imageMetrics = () => null,
  securityEventMetrics = () => null,
  intervalMilliseconds = 300_000,
}) {
  let timer = null;

  const report = () => {
    const memory = process.memoryUsage();
    console.log(JSON.stringify({
      event: "SLAMDUNK_HEALTH",
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMegabytes: {
        rss: Math.round(memory.rss / 1_048_576),
        heapUsed: Math.round(memory.heapUsed / 1_048_576),
        external: Math.round(memory.external / 1_048_576),
        arrayBuffers: Math.round(memory.arrayBuffers / 1_048_576),
      },
      postgres: {
        total: databasePool.totalCount,
        idle: databasePool.idleCount,
        waiting: databasePool.waitingCount,
      },
      abuseGuard: abuseGuard.snapshot(),
      securityEvents: securityEventMetrics(),
      imageRendering: imageMetrics(),
    }));
  };

  return Object.freeze({
    start() {
      if (timer) return;
      timer = setInterval(report, intervalMilliseconds);
      timer.unref?.();
    },
    report,
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    },
  });
}
