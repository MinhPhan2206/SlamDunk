import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { getCardArtPath } from "../src/bot/ui/card-art.js";

const catalogUrl = new URL("../data/card-templates.json", import.meta.url);
test("official Card Templates resolve every available player image", async () => {
  const templates = JSON.parse(await readFile(catalogUrl, "utf8"));
  const fallbackNames = templates
    .filter((template) => path.basename(getCardArtPath(template)) === "unknown-player.webp")
    .map((template) => template.playerName);

  assert.equal(templates.length, 275);
  assert.deepEqual(fallbackNames, []);
});
