const MAX_CONCURRENT_RENDERS = 2;
const SHARP_CACHE_MEMORY_MB = 32;

let sharpModule;
let activeRenders = 0;
const waiters = [];

async function getSharp() {
  if (!sharpModule) {
    sharpModule = import("sharp").then((module) => {
      const sharp = module.default;
      sharp.cache({ memory: SHARP_CACHE_MEMORY_MB, files: 20, items: 100 });
      sharp.concurrency(MAX_CONCURRENT_RENDERS);
      return sharp;
    });
  }
  return sharpModule;
}

async function acquireRenderSlot() {
  if (activeRenders < MAX_CONCURRENT_RENDERS) {
    activeRenders += 1;
    return;
  }
  await new Promise((resolve) => waiters.push(resolve));
  activeRenders += 1;
}

function releaseRenderSlot() {
  activeRenders -= 1;
  waiters.shift()?.();
}

export async function renderImage(operation) {
  if (typeof operation !== "function") {
    throw new TypeError("Image render operation must be a function.");
  }
  await acquireRenderSlot();
  try {
    return await operation(await getSharp());
  } finally {
    releaseRenderSlot();
  }
}

export function getImageRuntimeSnapshot() {
  return Object.freeze({
    active: activeRenders,
    waiting: waiters.length,
    maximumConcurrent: MAX_CONCURRENT_RENDERS,
    sharpCacheMemoryMegabytes: SHARP_CACHE_MEMORY_MB,
  });
}
