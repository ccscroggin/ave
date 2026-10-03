// /api/review — the reviewer's queue and decisions.
//   GET  ?t=TOKEN                 queue: every date, its due date, edition status, claims
//   GET  ?t=TOKEN&date=YYYY-MM-DD the draft for one date with edits applied, history and flagged notes
//   POST {t, action:"decide", date, edition, decision, notes, edits}
//   POST {t, action:"claim"|"unclaim", date}
// Without a token, GET answers in practice mode (read-only) so anyone can try the steps.
import {
  configured, reviewerFor, team, drafts, flaggedNotes, editionHash, reviewState, editedDay, statusOf,
  schedule, writeJSON, listAll, remove, readJSON, setPath, EDITIONS, DECISIONS, send, tokenOf
} from "./_lib.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function claimsFor() {
  const out = {};
  for (const b of await listAll("claims/")) {
    const m = b.pathname.match(/^claims\/(\d{4}-\d{2}-\d{2})\/(\w+)\.json$/);
    if (!m) continue;
    const c = await readJSON(b.pathname);
    (out[m[1]] ||= []).push({ id: m[2], name: c?.name || "A reviewer" });
  }
  return out;
}

async function queue(me) {
  const state = await reviewState(), claims = await claimsFor(), sched = schedule();
  const dueOf = {}; for (const s of sched) for (const d of s.days) dueOf[d] = s.due;
  const days = [];
  for (const date of Object.keys(drafts()).sort()) {
    const editions = {};
    for (const ed of EDITIONS) {
      const list = state[date]?.[ed] || [], last = list[list.length - 1];
      const full = last ? await readJSON(last.pathname) : null;
      editions[ed] = statusOf(date, ed, full ? { decision: full.decision, hash: full.hash, by: full.reviewer?.name, at: full.at } : null);
    }
    days.push({ date, due: dueOf[date], editions, claims: claims[date] || [], flagged: (flaggedNotes()[date] || []).length });
  }
  return { me: me ? { id: me.id, name: me.name } : null, practice: !me, team: me ? (await team()).map(p => ({ id: p.id, name: p.name })) : [], schedule: sched, days };
}

export default async function handler(req, res) {
  if (!configured()) return send(res, 503, { error: "Review storage is not set up." });
  const token = tokenOf(req), me = token ? await reviewerFor(token) : null;
  if (token && !me) return send(res, 401, { error: "This review link is not valid. Ask for a new one." });

  if (req.method === "GET") {
    const date = (req.query.date || "").toString();
    if (!date) return send(res, 200, await queue(me));
    if (!DATE.test(date) || !drafts()[date]) return send(res, 404, { error: "No guide for that date." });
    const { day, history } = await editedDay(date);
    const hashes = Object.fromEntries(EDITIONS.map(ed => [ed, editionHash(date, ed)]));
    return send(res, 200, { date, practice: !me, guide: day, history, hashes, flagged: flaggedNotes()[date] || [] });
  }

  if (req.method !== "POST") return send(res, 405, { error: "Use GET or POST." });
  if (!me) return send(res, 403, { error: "Practice mode does not save. Use your review link to save decisions." });
  const { action, date } = req.body || {};
  if (!DATE.test(date || "") || !drafts()[date]) return send(res, 404, { error: "No guide for that date." });

  if (action === "claim") {
    await writeJSON(`claims/${date}/${me.id}.json`, { name: me.name, at: new Date().toISOString() });
    return send(res, 200, { ok: true });
  }
  if (action === "unclaim") {
    await remove(`claims/${date}/${me.id}.json`).catch(() => {});
    return send(res, 200, { ok: true });
  }
  if (action === "decide") {
    const { edition, decision } = req.body;
    const notes = String(req.body.notes || "").slice(0, 4000);
    if (!EDITIONS.includes(edition)) return send(res, 400, { error: "Unknown edition." });
    if (!DECISIONS.includes(decision)) return send(res, 400, { error: "Unknown decision." });
    if (decision !== "approved" && !notes.trim()) return send(res, 400, { error: "Please say what needs to change." });
    // Edits must name an existing text field of this edition; anything else is refused.
    const edits = {}, probe = JSON.parse(JSON.stringify(drafts()[date]));
    for (const [path, value] of Object.entries(req.body.edits || {})) {
      if (typeof value !== "string" || value.length > 4000 || !/^[\w. ]+$/.test(path)) return send(res, 400, { error: `Edit not allowed: ${path}` });
      const target = edition === "family" && path.startsWith("readings.") ? null : probe[edition];
      if (!target || !setPath(target, path, value)) return send(res, 400, { error: `Edit not allowed: ${path}` });
      edits[path] = value.trim();
    }
    // Decisions sort by time; make each one strictly later than the last so order never ties.
    let t = Date.now();
    for (const b of await listAll(`decisions/${date}/${edition}/`)) {
      const m = b.pathname.match(/\/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)__/);
      if (m) { const prev = Date.parse(m[1].replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, "T$1:$2:$3.$4Z")); if (prev >= t) t = prev + 1; }
    }
    const at = new Date(t).toISOString();
    const record = { date, edition, decision, notes, edits, hash: editionHash(date, edition), reviewer: { id: me.id, name: me.name }, at };
    await writeJSON(`decisions/${date}/${edition}/${at.replace(/[:.]/g, "-")}__${me.id}__${decision}.json`, record, { overwrite: false });
    return send(res, 200, { ok: true, record });
  }
  return send(res, 400, { error: "Unknown action." });
}
