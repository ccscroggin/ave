// Shared code for the review backend. Files starting with "_" are not routes.
//
// Storage is a private Vercel Blob store (BLOB_READ_WRITE_TOKEN is set by
// Vercel when the store is linked to the project). Layout:
//   admin/<sha256(token)>.json                    the owner; created once by /api/admin setup
//   reviewers/<sha256(token)>.json                {id, name, email, created, active}
//   decisions/<date>/<edition>/<iso>__<reviewerId>__<decision>.json
//                                                 {decision, notes, edits, hash, reviewer, at}
//   claims/<date>/<reviewerId>.json               {name, at}
// Decisions are append-only, so two reviewers can never overwrite each other,
// and every approval stays on record.
import { put, get, list, del } from "@vercel/blob";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const A = { access: "private" };
export const EDITIONS = ["plain", "kids", "family"];
export const DECISIONS = ["approved", "changes", "rejected"];
export const sha = s => createHash("sha256").update(String(s)).digest("hex");
export const newToken = () => randomBytes(24).toString("base64url");
export const newId = () => randomBytes(6).toString("hex");

export async function readJSON(path) {
  const r = await get(path, { ...A, useCache: false }).catch(() => null);
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text());
}
export function writeJSON(path, obj, { overwrite = true } = {}) {
  return put(path, JSON.stringify(obj), { ...A, contentType: "application/json", addRandomSuffix: false, allowOverwrite: overwrite });
}
export async function listAll(prefix) {
  const out = []; let cursor;
  do { const r = await list({ prefix, cursor, limit: 1000 }); out.push(...r.blobs); cursor = r.hasMore ? r.cursor : undefined; } while (cursor);
  return out;
}
export const remove = path => del(path);

// ---------- people ----------
export async function reviewerFor(token) {
  if (!token || typeof token !== "string" || token.length < 20) return null;
  const r = await readJSON(`reviewers/${sha(token)}.json`);
  return r && r.active !== false ? r : null;
}
export async function isAdmin(token) {
  if (!token || typeof token !== "string" || token.length < 20) return false;
  return !!(await readJSON(`admin/${sha(token)}.json`));
}
export async function team() {
  const blobs = await listAll("reviewers/");
  const people = await Promise.all(blobs.map(b => readJSON(b.pathname)));
  return people.filter(p => p && p.active !== false).map(p => ({ id: p.id, name: p.name, email: p.email, created: p.created }));
}

// ---------- content (bundled with the function) ----------
const ROOT = process.cwd();
const COMPANION = join(ROOT, "content", "companion");
let draftsCache = null;
export function drafts() {
  if (draftsCache) return draftsCache;
  const out = {};
  if (existsSync(COMPANION)) for (const f of readdirSync(COMPANION)) {
    if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) continue;
    const c = JSON.parse(readFileSync(join(COMPANION, f), "utf8"));
    out[f.slice(0, 10)] = { plain: c.plain, kids: c.kids, family: c.family };
  }
  return (draftsCache = out);
}
// Notes the drafting sessions left for the reviewer, by date (from REVIEW-NOTES.md).
let notesCache = null;
export function flaggedNotes() {
  if (notesCache) return notesCache;
  const out = {}, p = join(COMPANION, "REVIEW-NOTES.md");
  if (existsSync(p)) {
    let cur = null;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const h = line.match(/^## (\d{4}-\d{2}-\d{2})/);
      if (h) { cur = h[1]; out[cur] = []; continue; }
      if (line.startsWith("## ")) { cur = null; continue; }
      if (cur && line.startsWith("- ")) out[cur].push(line.slice(2).trim());
      else if (cur && /^\s{2,}\S/.test(line) && out[cur].length) out[cur][out[cur].length - 1] += " " + line.trim();
    }
  }
  return (notesCache = out);
}
// What a reviewer approves for an edition. Family prints the plain readings, so its hash covers both.
export function editionHash(day, ed) {
  const d = drafts()[day]; if (!d) return null;
  return sha(JSON.stringify(ed === "family" ? { family: d.family, readings: d.plain.readings } : d[ed])).slice(0, 16);
}

// ---------- edits ----------
export function setPath(obj, path, value) {
  const keys = path.split(".");
  let o = obj;
  for (let i = 0; i < keys.length - 1; i++) { if (o[keys[i]] == null) return false; o = o[keys[i]]; }
  if (typeof o[keys.at(-1)] !== "string") return false;
  o[keys.at(-1)] = value; return true;
}

// ---------- decisions ----------
// Latest state per date and edition, plus every edit made so far (applied in order).
export async function reviewState() {
  const blobs = await listAll("decisions/");
  const state = {};
  for (const b of blobs) {
    const m = b.pathname.match(/^decisions\/(\d{4}-\d{2}-\d{2})\/(\w+)\/([^_]+)__([^_]+)__(\w+)\.json$/);
    if (!m) continue;
    const [, date, ed, at, reviewerId, decision] = m;
    ((state[date] ||= {})[ed] ||= []).push({ at, reviewerId, decision, pathname: b.pathname });
  }
  for (const eds of Object.values(state)) for (const list of Object.values(eds)) list.sort((a, b) => a.at.localeCompare(b.at));
  return state;
}
export async function loadDecision(entry) { return readJSON(entry.pathname); }

// Draft text for one date with every recorded edit applied.
export async function editedDay(day, state) {
  const d = JSON.parse(JSON.stringify(drafts()[day] || null));
  if (!d) return null;
  const eds = (state || await reviewState())[day] || {};
  const history = {};
  for (const ed of EDITIONS) {
    history[ed] = [];
    for (const entry of eds[ed] || []) {
      const full = await loadDecision(entry);
      if (!full) continue;
      for (const [path, value] of Object.entries(full.edits || {})) setPath(path.startsWith("readings.") && ed === "family" ? d.plain : d[ed], path, value);
      history[ed].push({ decision: full.decision, notes: full.notes || "", by: full.reviewer?.name, at: full.at, hash: full.hash, edits: Object.keys(full.edits || {}).length });
    }
  }
  return { day: d, history };
}

// Status of one edition: approved only if the latest decision approves the current draft.
export function statusOf(day, ed, latest) {
  if (!latest) return { status: "waiting" };
  const current = editionHash(day, ed);
  if (latest.decision === "approved" && latest.hash && latest.hash !== current) return { status: "redrafted", by: latest.by, at: latest.at };
  return { status: latest.decision, by: latest.by, at: latest.at };
}

// ---------- schedule ----------
// Guides for a month are due 35 days before that month's first Sunday or holy day.
export function schedule() {
  const days = Object.keys(drafts()).sort(), months = {};
  for (const d of days) (months[d.slice(0, 7)] ||= []).push(d);
  return Object.entries(months).map(([m, ds]) => {
    const due = new Date(ds[0] + "T12:00:00Z"); due.setUTCDate(due.getUTCDate() - 35);
    return { month: m, days: ds, due: due.toISOString().slice(0, 10) };
  });
}

// ---------- http ----------
export function send(res, code, body, headers = {}) {
  res.status(code);
  for (const [k, v] of Object.entries({ "Cache-Control": "no-store", ...headers })) res.setHeader(k, v);
  typeof body === "string" ? res.send(body) : res.json(body);
}
export const tokenOf = req => (req.headers["x-review-token"] || req.query?.t || req.body?.t || "").toString();
export const configured = () => !!process.env.BLOB_READ_WRITE_TOKEN;
