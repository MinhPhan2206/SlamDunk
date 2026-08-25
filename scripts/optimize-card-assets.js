import { readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const IMAGE_ROOT = fileURLToPath(
  new URL("../assets/images/", import.meta.url),
);
const MAX_WIDTH = 480;
const MAX_HEIGHT = 800;
const WEBP_QUALITY = 85;

async function findPngFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findPngFiles(entryPath));
    } else if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".png") {
      files.push(entryPath);
    }
  }
  return files;
}

function webpPathFor(pngPath) {
  const resolved = path.resolve(pngPath);
  const root = `${path.resolve(IMAGE_ROOT)}${path.sep}`;
  if (!resolved.startsWith(root)) {
    throw new Error(`Refusing to optimize an image outside ${IMAGE_ROOT}.`);
  }
  return resolved.slice(0, -path.extname(resolved).length) + ".webp";
}

async function optimizeImage(pngPath) {
  const webpPath = webpPathFor(pngPath);
  const { data, info } = await sharp(pngPath)
    .resize({
      width: MAX_WIDTH,
      height: MAX_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY, effort: 4 })
    .toBuffer({ resolveWithObject: true });
  if (
    info.format !== "webp" ||
    info.width > MAX_WIDTH ||
    info.height > MAX_HEIGHT
  ) {
    throw new Error(`Optimized image validation failed for ${pngPath}.`);
  }

  await writeFile(webpPath, data);
  await unlink(pngPath);
}

const files = await findPngFiles(IMAGE_ROOT);
for (const file of files) await optimizeImage(file);

console.log(
  `Optimized ${files.length} Card asset(s) to WebP ` +
  `(maximum ${MAX_WIDTH}x${MAX_HEIGHT}, quality ${WEBP_QUALITY}).`,
);
