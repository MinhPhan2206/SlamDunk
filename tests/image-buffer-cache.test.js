import assert from "node:assert/strict";
import test from "node:test";

import { createImageBufferCache } from "../src/bot/ui/image-buffer-cache.js";

test("image buffer cache evicts least-recently-used entries by byte budget", () => {
  const cache = createImageBufferCache({ maxEntries: 3, maxBytes: 8 });
  cache.set("a", Buffer.alloc(4));
  cache.set("b", Buffer.alloc(4));
  assert.ok(cache.get("a"));
  cache.set("c", Buffer.alloc(4));

  assert.equal(cache.get("b"), null);
  assert.ok(cache.get("a"));
  assert.ok(cache.get("c"));
  assert.deepEqual(cache.snapshot(), {
    entries: 2,
    bytes: 8,
    hits: 3,
    misses: 1,
    evictions: 1,
    maxEntries: 3,
    maxBytes: 8,
  });
});

test("image buffer cache rejects a buffer larger than its full budget", () => {
  const cache = createImageBufferCache({ maxEntries: 2, maxBytes: 4 });
  assert.equal(cache.set("large", Buffer.alloc(5)), false);
  assert.equal(cache.snapshot().entries, 0);
  assert.equal(cache.snapshot().bytes, 0);
});
