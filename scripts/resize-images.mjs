// Generates resized WebP copies of the images in a/ and points every srcset at them.
//
// The Ycode export wrote srcsets like `../a/ID/photo.webp?width=640&amp;quality=85 640w`.
// Ycode resized on request; a static host ignores the query string and serves the full file
// for every width. This script writes `a/ID/photo-640w.webp` files and rewrites the HTML to use them.
//
// Safe to re-run: existing resized files are kept, and HTML without `?width=` is left alone.
// Usage: npm run images

import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, extname, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ASSETS = join(ROOT, "a");
const QUALITY = 82;
const RASTER = new Set([".webp", ".png", ".jpg", ".jpeg"]);
const SKIP_DIRS = new Set(["node_modules", "docs", "scripts", ".git", ".github", "a"]);
// Matches one candidate URL produced by the export, e.g. ../a/ID/photo.webp?width=640&amp;quality=85
const CANDIDATE = /((?:\.\.?\/)+a\/[A-Za-z0-9]+\/)([^"?,\s]+)\?width=(\d+)&amp;quality=\d+/g;

const resizedName = (file, width) => `${basename(file, extname(file))}-${width}w.webp`;

async function* walk(dir, skip = new Set()) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!skip.has(entry.name)) yield* walk(join(dir, entry.name));
    } else {
      yield join(dir, entry.name);
    }
  }
}

const exists = (p) => stat(p).then(() => true, () => false);

// 1. Collect every width each image is requested at.
const htmlFiles = [];
for await (const file of walk(ROOT, SKIP_DIRS)) if (file.endsWith(".html")) htmlFiles.push(file);

const widthsFor = new Map(); // absolute image path -> Set(widths)
for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  for (const [, prefix, name, width] of html.matchAll(CANDIDATE)) {
    const abs = join(dirname(file), prefix, name);
    if (!widthsFor.has(abs)) widthsFor.set(abs, new Set());
    widthsFor.get(abs).add(Number(width));
  }
}

// 2. Write the resized files. Widths at or above the original's width use the original.
const originalWidth = new Map();
let written = 0;
for (const [abs, widths] of widthsFor) {
  if (!RASTER.has(extname(abs).toLowerCase())) continue;
  const meta = await sharp(abs).metadata();
  originalWidth.set(abs, meta.width);
  for (const w of widths) {
    if (w >= meta.width) continue;
    const out = join(dirname(abs), resizedName(abs, w));
    if (await exists(out)) continue;
    await sharp(abs).resize({ width: w }).webp({ quality: QUALITY }).toFile(out);
    written++;
  }
}

// 3. Rewrite the HTML.
let changedFiles = 0;
for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  const next = html
    // srcset lists: drop duplicate candidates that would all point at the original
    .replace(/srcset="([^"]*)"/g, (whole, list) => {
      if (!list.includes("?width=")) return whole;
      const seen = new Set();
      const out = [];
      for (const part of list.split(",").map((p) => p.trim())) {
        const m = /^(\S+?)\?width=(\d+)&amp;quality=\d+\s+(\d+w)$/.exec(part);
        if (!m) { out.push(part); continue; }
        const [, url, width, descriptor] = m;
        const abs = join(dirname(file), url);
        const orig = originalWidth.get(abs);
        if (orig === undefined) { out.push(`${url} ${descriptor}`); continue; } // svg etc.
        const w = Number(width);
        const target = w < orig ? url.replace(/[^/]+$/, resizedName(url, w)) : url;
        const desc = w < orig ? `${w}w` : `${orig}w`;
        if (seen.has(target)) continue;
        seen.add(target);
        out.push(`${target} ${desc}`);
      }
      return `srcset="${out.join(", ")}"`;
    })
    // any remaining single URLs (src=, url(...)): the original file
    .replace(CANDIDATE, (_m, prefix, name) => `${prefix}${name}`);
  if (next !== html) {
    await writeFile(file, next);
    changedFiles++;
  }
}

console.log(`resized files written: ${written}; html files updated: ${changedFiles}`);
