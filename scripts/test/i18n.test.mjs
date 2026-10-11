// Checks the Spanish translation layer. Plain node, no dependencies.
// Run from the repo root: node scripts/test/i18n.test.mjs   (add --list to print missing keys)
// Fails if a string passed to t() in site/app.js or site/aloud.js, or a static text in
// site/index.html, has no Spanish entry; if a Spanish prayer is empty; or if the
// Spanish mysteries, Order of Mass or notes do not match the English shape.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = p => readFileSync(join(ROOT, p), "utf8");
// app.js and aloud.js (prayers, mysteries and read-aloud text) share t().
const app = read("site/app.js") + "\n" + read("site/aloud.js");
const html = read("site/index.html");

const sandbox = { window: {} };
vm.runInNewContext(read("site/i18n.js"), sandbox);
const ES = sandbox.window.AVE_I18N && sandbox.window.AVE_I18N.es;
const fail = [];
const need = (cond, msg) => { if (!cond) fail.push(msg); };
need(ES && ES.ui, "site/i18n.js must define window.AVE_I18N.es.ui");

// Evaluate a JS string literal as written in app.js ("...", '...' or `...` without ${}).
const lit = src => vm.runInNewContext(src);

// 1. Every t("...") call in app.js.
const keys = new Set();
const re = /(?<![\w.$])t\(\s*("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\$]|\\.)*`)\s*[,)]/g;
for (const m of app.matchAll(re)) keys.add(lit(m[1]));
// A t( call with anything other than a literal string cannot be checked.
for (const m of app.matchAll(/(?<![\w.$]|function )t\(\s*([^"'`\s)])/g)) fail.push(`t() called with a non-literal near: ${app.slice(m.index, m.index + 50)}`);
need(keys.size > 100, `expected over 100 t() strings, found ${keys.size}`);

// 2. Static text and aria-labels in index.html (what applyStatic() translates).
const body = html.slice(html.indexOf("<body>"), html.lastIndexOf("</body>"))
  .replace(/<script[\s\S]*?<\/script>/g, "").replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<!--[\s\S]*?-->/g, "");
const dec = s => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
for (const m of body.matchAll(/aria-label="([^"]*)"/g)) keys.add(dec(m[1]));
for (const seg of body.split(/<[^>]*>/)) { const s = dec(seg).replace(/\s+/g, " ").trim(); if (s) keys.add(s); }
const md = html.match(/<meta name="description" content="([^"]*)"/); if (md) keys.add(md[1]);

const same = new Set(ES.same || []);
const missing = [...keys].filter(k => !(k in ES.ui) && !same.has(k));
if (process.argv.includes("--list")) { console.log(missing.map(k => JSON.stringify(k)).join(",\n")); process.exit(0); }
for (const k of missing) fail.push(`no Spanish entry: ${JSON.stringify(k)}`);
for (const [k, v] of Object.entries(ES.ui)) need(typeof v === "string" && v.trim(), `empty Spanish entry: ${JSON.stringify(k)}`);
// Placeholders must survive translation.
for (const k of keys) if (ES.ui[k]) {
  const ph = s => (s.match(/\{\w+\}/g) || []).sort().join();
  need(ph(k) === ph(ES.ui[k]), `placeholders differ: ${JSON.stringify(k)}`);
}

// 3. Prayers: every English prayer has a non-empty Spanish text and title.
const prKeys = [...app.match(/const PR = \{([\s\S]*?)\n\};/)[1].matchAll(/^\s*(\w+):\{t:/gm)].map(m => m[1]);
need(prKeys.length === 8, `expected 8 English prayers, found ${prKeys.length}`);
for (const k of prKeys) {
  const p = ES.prayers && ES.prayers[k];
  need(p && p.t && p.t.trim(), `Spanish prayer title missing: ${k}`);
  need(p && p.x && p.x.trim(), `Spanish prayer text empty: ${k}`);
}
need(ES.prayers?.queen?.vr && ES.prayers.queen.vr.length === 2 && ES.prayers.queen.vr.every(v => v[1].trim()), "Salve needs its V. and R.");

// 4. Mysteries: four sets of five, each with name, citation, fruit, description.
for (const k of ["joyful", "sorrowful", "glorious", "luminous"]) {
  const s = ES.sets && ES.sets[k];
  need(s && s.name && s.adj && s.Adj && s.days, `Spanish set ${k} incomplete`);
  need(s?.m?.length === 5 && s.m.every(m => m.length === 4 && m.every(x => x.trim())), `Spanish mysteries ${k} incomplete`);
}
need(ES.ord?.m?.length === 5 && ES.ord?.f?.length === 5, "ordinals");

// 5. Data tables keep the English shape.
const enOrder = vm.runInNewContext("(" + app.match(/const ORDER=(\[[\s\S]*?\n\]);/)[1] + ")");
need(ES.order?.length === enOrder.length && ES.order.every((s, i) => s[1].length === enOrder[i][1].length && s[1].every((p, j) => p[3] === enOrder[i][1][j][3] && p[0] && p[1] && p[2])), "Order of Mass shape differs from English");
const objKeys = name => [...app.match(new RegExp(`const ${name}=\\{([\\s\\S]*?)\\n\\};`))[1].matchAll(/^\s*"?([\w-]+)"?:/gm)].map(m => m[1]);
for (const [name, es] of [["BOOK", ES.book], ["NOTES", ES.notes], ["SEASON_NOTE", ES.season]]) {
  const en = objKeys(name);
  for (const k of en) need(es && es[k], `${name} has no Spanish entry for ${k}`);
}
for (const k of ["green", "violet", "rose", "white", "red"]) need(ES.colors?.[k], `colour ${k}`);

if (fail.length) { console.error(fail.join("\n")); console.error(`i18n: ${fail.length} problem(s)`); process.exit(1); }
console.log(`i18n: ${keys.size} strings, ${prKeys.length} prayers, 20 mysteries, all with Spanish entries`);
