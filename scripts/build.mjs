// Build site/data from content/, and stamp the service worker version.
// Usage: node scripts/build.mjs
// Rule: companion text reaches site/ only when review.status === "approved".
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = process.env.AVE_CONTENT || join(ROOT, "content");
const SITE = join(ROOT, "site");
const DATA = join(SITE, "data");

const readJSON = p => JSON.parse(readFileSync(p, "utf8"));
const jsonFiles = dir => existsSync(dir) ? readdirSync(dir).filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort() : [];

rmSync(DATA, { recursive: true, force: true });
mkdirSync(join(DATA, "readings"), { recursive: true });

// Readings: one file per month, plus a date -> title index.
const months = {}, titles = {};
for (const f of jsonFiles(join(CONTENT, "readings"))) {
  const day = readJSON(join(CONTENT, "readings", f));
  const date = f.slice(0, 10);
  if (!day.title || !Array.isArray(day.r) || !day.r.length) throw new Error(`readings ${date}: missing title or readings`);
  titles[date] = day.title;
  (months[date.slice(0, 7)] ||= {})[date] = { title: day.title, r: day.r };
}
for (const [m, days] of Object.entries(months)) writeFileSync(join(DATA, "readings", `${m}.json`), JSON.stringify(days));
writeFileSync(join(DATA, "days.json"), JSON.stringify(titles));

// Companion text: approved only, except in a reviewer preview build
// (AVE_INCLUDE_DRAFTS=1), where drafts are included and stamped as drafts.
const PREVIEW = process.env.AVE_INCLUDE_DRAFTS === "1";
const companion = {};
let drafts = 0;
for (const f of jsonFiles(join(CONTENT, "companion"))) {
  const c = readJSON(join(CONTENT, "companion", f));
  const date = f.slice(0, 10);
  const approved = c.review?.status === "approved";
  if (!approved) { drafts++; if (!PREVIEW) continue; }
  if (!titles[date]) throw new Error(`companion ${date}: no readings for this date`);
  companion[date] = { plain: c.plain, kids: c.kids, family: c.family,
    review: approved ? { status: "approved", by: c.review.by, at: c.review.at } : { status: "draft" } };
}
writeFileSync(join(DATA, "companion.json"), JSON.stringify(companion));
// A preview build must never be indexed.
writeFileSync(join(SITE, "robots.txt"), PREVIEW ? "User-agent: *\nDisallow: /\n" : "User-agent: *\nAllow: /\n");

// Service worker version: hash of the shell and data.
const h = createHash("sha256");
for (const f of ["index.html", "app.css", "paper.css", "app.js", "about.html", "manifest.webmanifest"]) h.update(readFileSync(join(SITE, f)));
h.update(JSON.stringify(titles)); h.update(JSON.stringify(companion));
const version = h.digest("hex").slice(0, 12);
writeFileSync(join(SITE, "sw.js"), readFileSync(join(SITE, "sw.js.tpl"), "utf8").replace("__VERSION__", version));

console.log(`${PREVIEW ? "PREVIEW (drafts included) · " : ""}days ${Object.keys(titles).length} · months ${Object.keys(months).length} · companion approved ${Object.values(companion).filter(c => c.review.status === "approved").length}, drafts ${PREVIEW ? "included" : "held back"} ${drafts} · sw ${version}`);
