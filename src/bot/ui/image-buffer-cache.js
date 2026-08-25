export function createImageBufferCache({ maxEntries, maxBytes }) {
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) {
    throw new TypeError("Image cache maxEntries must be a positive integer.");
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError("Image cache maxBytes must be a positive integer.");
  }

  const entries = new Map();
  let totalBytes = 0;
  let hits = 0;
  let misses = 0;
  let evictions = 0;

  function removeOldest() {
    const oldestKey = entries.keys().next().value;
    if (oldestKey === undefined) return;
    const oldest = entries.get(oldestKey);
    entries.delete(oldestKey);
    totalBytes -= oldest.byteLength;
    evictions += 1;
  }

  return Object.freeze({
    get(key) {
      const buffer = entries.get(key);
      if (!buffer) {
        misses += 1;
        return null;
      }
      entries.delete(key);
      entries.set(key, buffer);
      hits += 1;
      return buffer;
    },

    set(key, buffer) {
      if (!Buffer.isBuffer(buffer)) {
        throw new TypeError("Image cache values must be Buffers.");
      }
      const existing = entries.get(key);
      if (existing) {
        entries.delete(key);
        totalBytes -= existing.byteLength;
      }
      if (buffer.byteLength > maxBytes) return false;
      while (
        entries.size >= maxEntries ||
        totalBytes + buffer.byteLength > maxBytes
      ) {
        removeOldest();
      }
      entries.set(key, buffer);
      totalBytes += buffer.byteLength;
      return true;
    },

    snapshot() {
      return Object.freeze({
        entries: entries.size,
        bytes: totalBytes,
        hits,
        misses,
        evictions,
        maxEntries,
        maxBytes,
      });
    },
  });
}
