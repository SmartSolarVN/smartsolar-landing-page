// Writes the default tariff view (commercial customers, current prices) into the HTML of
// gia-dien/ and en/electricity-prices/, so search engines and visitors without JavaScript
// see the prices. gia-dien.js re-renders the same markup in the browser.
//
// Run after editing the tariff data (G) in gia-dien.js:  npm run prerender

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import vm from "node:vm";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PAGES = { vi: "gia-dien/index.html", en: "en/electricity-prices/index.html" };

function load() {
  return readFile(join(ROOT, "gia-dien.js"), "utf8").then((src) => {
    const sandbox = { Intl };
    sandbox.globalThis = sandbox;
    vm.runInNewContext(src, sandbox);
    return sandbox.GiaDien;
  });
}

// Replace the inner HTML of the element with the given id (no nested element of the same tag).
function setInner(html, tag, id, inner) {
  const re = new RegExp(`(<${tag}\\b[^>]*\\bid="${id}"[^>]*>)[\\s\\S]*?(</${tag}>)`);
  if (!re.test(html)) throw new Error(`#${id} not found`);
  return html.replace(re, (_m, open, close) => open + inner + close);
}

const api = await load();
for (const [lang, page] of Object.entries(PAGES)) {
  api.setLang(lang);
  const t = api.tariffParts("commercial", "none");
  const path = join(ROOT, page);
  let html = await readFile(path, "utf8");
  // the group cards are <button>s inside the div, so match up to the tariff panel instead
  html = html.replace(/(<div class="groups" id="groups"[^>]*>)[\s\S]*?(<\/div>\s*<div class="panel tariff">)/,
    (_m, open, close) => open + api.groupsHTML("commercial") + close);
  html = setInner(html, "h2", "tariffTitle", t.title);
  html = setInner(html, "table", "tariffTable", t.table);
  html = setInner(html, "p", "tariffSrc", t.src);
  html = html.replace(/(<div id="tariffNotes">)[\s\S]*?(<\/div>\s*<p class="src")/, (_m, o, c) => o + t.notes + c);
  await writeFile(path, html);
  console.log(`updated ${page}`);
}
