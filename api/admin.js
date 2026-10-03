// /api/admin — the owner manages the review team.
//   POST {action:"setup"}                       first call only: creates the owner link; refused once an owner exists
//   GET  ?a=TOKEN                               the team and each reviewer's record
//   POST {a, action:"invite", name, email}      returns a personal review link for the new reviewer
//   POST {a, action:"remove", id}               turns a reviewer's link off
import { configured, isAdmin, newToken, newId, sha, writeJSON, readJSON, listAll, team, reviewState, send } from "./_lib.js";

const base = req => `https://${req.headers["x-forwarded-host"] || req.headers.host}`;

export default async function handler(req, res) {
  if (!configured()) return send(res, 503, { error: "Review storage is not set up." });
  const a = (req.query?.a || req.body?.a || "").toString();

  if (req.method === "POST" && req.body?.action === "setup") {
    if ((await listAll("admin/")).length) return send(res, 409, { error: "The owner link already exists." });
    const token = newToken();
    // allowOverwrite is off, so a second setup racing this one cannot replace it.
    await writeJSON(`admin/${sha(token)}.json`, { created: new Date().toISOString() }, { overwrite: false });
    return send(res, 200, { ownerLink: `${base(req)}/review?a=${token}` });
  }

  if (!(await isAdmin(a))) return send(res, 401, { error: "This owner link is not valid." });

  if (req.method === "GET") {
    const people = await team(), state = await reviewState(), counts = {};
    for (const eds of Object.values(state)) for (const list of Object.values(eds)) for (const e of list) (counts[e.reviewerId] ||= { approved: 0, changes: 0, rejected: 0 })[e.decision]++;
    return send(res, 200, { team: people.map(p => ({ ...p, decisions: counts[p.id] || { approved: 0, changes: 0, rejected: 0 } })) });
  }

  const { action } = req.body || {};
  if (action === "invite") {
    const name = String(req.body.name || "").trim().slice(0, 80), email = String(req.body.email || "").trim().slice(0, 120);
    if (!name) return send(res, 400, { error: "Enter the reviewer's name, for example Fr. John Smith." });
    const token = newToken(), id = newId();
    await writeJSON(`reviewers/${sha(token)}.json`, { id, name, email, created: new Date().toISOString(), active: true }, { overwrite: false });
    return send(res, 200, { id, name, link: `${base(req)}/review?t=${token}`, calendar: `webcal://${(req.headers["x-forwarded-host"] || req.headers.host)}/api/calendar?t=${token}` });
  }
  if (action === "remove") {
    const id = String(req.body.id || "");
    for (const b of await listAll("reviewers/")) {
      const r = await readJSON(b.pathname);
      if (r?.id === id) { await writeJSON(b.pathname, { ...r, active: false, removed: new Date().toISOString() }); return send(res, 200, { ok: true }); }
    }
    return send(res, 404, { error: "No reviewer with that id." });
  }
  return send(res, 400, { error: "Unknown action." });
}
