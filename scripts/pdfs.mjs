// Make ready-made PDFs of upcoming booklets from the live site, for people who
// want to order prints. Runs daily in GitHub Actions (.github/workflows/pdfs.yml)
// and publishes to GitHub Pages; the app links to them from "Get it printed".
//
// Usage: node scripts/pdfs.mjs [--base https://ave-daily.vercel.app] [--out out] [--weeks 8]
// Only approved guides can appear: the print view reads /api/companion, which
// serves approved editions only.
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = arg("--base", "https://ave-daily.vercel.app").replace(/\/$/, "");
const OUT = arg("--out", "out");
const WEEKS = +arg("--weeks", 8);
const HERE = dirname(fileURLToPath(import.meta.url));

const get = async p => { const r = await fetch(BASE + p); if (!r.ok) throw new Error(`${p}: ${r.status}`); return r.json(); };
const titles = await get("/data/days.json");
let approved = {};
try { approved = await get("/api/companion"); } catch { approved = {}; }

const iso = d => d.toISOString().slice(0, 10);
const today = new Date(); today.setUTCHours(12, 0, 0, 0);
const end = new Date(today); end.setUTCDate(end.getUTCDate() + WEEKS * 7);
// US holy days of obligation that can fall on a weekday.
const HOLY = /Mary, the Holy Mother of God|Ascension of the Lord|Assumption|All Saints|Immaculate Conception|Nativity of the Lord/;
const isKeyDay = d => new Date(d + "T12:00:00Z").getUTCDay() === 0 || HOLY.test(titles[d] || "") || !!approved[d];
const days = Object.keys(titles).filter(d => d >= iso(today) && d <= iso(end) && isKeyDay(d)).sort();

const editionsFor = d => ["readings", ...["plain", "kids", "family"].filter(ed => approved[d]?.[ed])];
const jobs = [], files = [];
const add = (spec, extra, file, meta) => {
  const url = `${BASE}/?print=${encodeURIComponent(spec).replace(/%2C/g, ",").replace(/%7C/g, "|")}${extra}`;
  jobs.push({ url, out: join(OUT, file) }); files.push({ file, ...meta });
};
for (const d of days) for (const ed of editionsFor(d)) {
  add(`${d},${ed},pocket`, "", `${d}-${ed}-pocket.pdf`, { date: d, ed, layout: "pocket", order: "read" });
  add(`${d},${ed},pocket`, "&order=fold", `${d}-${ed}-pocket-fold.pdf`, { date: d, ed, layout: "pocket", order: "fold" });
}
// This month's and next month's Sundays and holy days, one booklet each.
const months = [...new Set([iso(today).slice(0, 7), (() => { const n = new Date(today); n.setUTCDate(1); n.setUTCMonth(n.getUTCMonth() + 1); return iso(n).slice(0, 7); })()])];
const monthName = m => new Date(m + "-01T12:00:00Z").toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
for (const m of months) {
  const md = Object.keys(titles).filter(d => d.startsWith(m) && isKeyDay(d)).sort();
  if (md.length < 2) continue;
  for (const ed of ["readings", "plain", "kids", "family"]) {
    const use = ed === "readings" ? md : md.filter(d => approved[d]?.[ed]);
    if (use.length < 2) continue;
    const t = `&title=${encodeURIComponent(monthName(m))}`;
    add(`${use.join("|")},${ed},pocket`, t, `month-${m}-${ed}-pocket.pdf`, { month: m, days: use, ed, layout: "pocket", order: "read" });
    add(`${use.join("|")},${ed},pocket`, `${t}&order=fold`, `month-${m}-${ed}-pocket-fold.pdf`, { month: m, days: use, ed, layout: "pocket", order: "fold" });
  }
}

mkdirSync(OUT, { recursive: true });
const jobsFile = join(OUT, "jobs.json");
writeFileSync(jobsFile, JSON.stringify(jobs));
const r = spawnSync(process.execPath, [join(HERE, "kit", "print.mjs"), jobsFile], { stdio: "inherit" });
writeFileSync(join(OUT, "manifest.json"), JSON.stringify({ generated: new Date().toISOString(), base: BASE, files }, null, 1));
writeFileSync(join(OUT, "index.html"), `<!doctype html><meta charset="utf-8"><title>Ave PDFs</title><h1>Ave print-ready PDFs</h1><p>Free to print. Made from <a href="${BASE}">${BASE}</a>.</p><ul>${files.map(f => `<li><a href="${f.file}">${f.file}</a></li>`).join("")}</ul>`);
console.log(`${files.length} PDFs for ${days.length} days and ${months.length} months`);
process.exit(r.status || 0);
