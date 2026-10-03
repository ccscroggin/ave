// End-to-end test of the review API against an in-memory Blob store.
// Run from the repo root: node --import ./scripts/test/register.mjs scripts/test/review.test.mjs
import assert from "node:assert/strict";
process.env.BLOB_READ_WRITE_TOKEN = "test-only";
const review = (await import("../../api/review.js")).default;
const admin = (await import("../../api/admin.js")).default;
const companion = (await import("../../api/companion.js")).default;
const calendar = (await import("../../api/calendar.js")).default;
const { writeJSON } = await import("../../api/_lib.js");

function call(handler, { method = "GET", query = {}, body = undefined, headers = {} } = {}) {
  return new Promise(resolve => {
    const res = { code: 200, headers: {}, status(c) { this.code = c; return this; }, setHeader(k, v) { this.headers[k] = v; },
      json(b) { resolve({ code: this.code, body: b, headers: this.headers }); }, send(b) { resolve({ code: this.code, body: b, headers: this.headers }); } };
    handler({ method, query, body, headers: { host: "ave.test", ...headers } }, res);
  });
}
let n = 0; const ok = (cond, msg) => { assert.ok(cond, msg); n++; };

// Owner setup happens once.
const s1 = await call(admin, { method: "POST", body: { action: "setup" } });
ok(s1.code === 200 && s1.body.ownerLink.includes("/review?a="), "setup returns an owner link");
const ownerToken = new URL(s1.body.ownerLink).searchParams.get("a");
ok((await call(admin, { method: "POST", body: { action: "setup" } })).code === 409, "second setup is refused");
ok((await call(admin, { query: { a: "x".repeat(30) } })).code === 401, "a wrong owner token is refused");

// Invite two reviewers.
const inv = await call(admin, { method: "POST", body: { a: ownerToken, action: "invite", name: "Fr. Test One", email: "one@example.org" } });
ok(inv.code === 200 && inv.body.link.includes("/review?t="), "invite returns a review link");
const t1 = new URL(inv.body.link).searchParams.get("t");
const t2 = new URL((await call(admin, { method: "POST", body: { a: ownerToken, action: "invite", name: "Fr. Test Two" } })).body.link).searchParams.get("t");
ok((await call(admin, { method: "POST", body: { a: ownerToken, action: "invite", name: "" } })).code === 400, "invite needs a name");

// Practice mode reads but never writes.
const pq = await call(review);
ok(pq.code === 200 && pq.body.practice === true && pq.body.days.length > 0, "practice queue loads");
ok((await call(review, { method: "POST", body: { action: "claim", date: "2026-11-29" } })).code === 403, "practice cannot write");
ok((await call(review, { query: { t: "y".repeat(30) } })).code === 401, "a wrong review token is refused");

// Claims are visible to the team.
await call(review, { method: "POST", body: { t: t1, action: "claim", date: "2026-11-29" } });
let q = (await call(review, { query: { t: t2 } })).body;
ok(q.days.find(d => d.date === "2026-11-29").claims[0].name === "Fr. Test One", "claim shows the claimant to others");
ok(q.team.length === 2, "team lists both reviewers");

// Validation.
ok((await call(review, { method: "POST", body: { t: t1, action: "decide", date: "2026-11-29", edition: "plain", decision: "changes", notes: "" } })).code === 400, "send back needs a note");
ok((await call(review, { method: "POST", body: { t: t1, action: "decide", date: "2026-11-29", edition: "plain", decision: "approved", edits: { "nope.field": "x" } } })).code === 400, "edits to unknown fields are refused");
ok((await call(review, { method: "POST", body: { t: t1, action: "decide", date: "2026-11-29", edition: "family", decision: "approved", edits: { "readings.Gospel.box": "x" } } })).code === 400, "Family cannot edit the Plain readings");

// Nothing is public before approval.
ok(Object.keys((await call(companion)).body).length === 0, "companion is empty before any approval");

// Send back, then approve with an edit.
await call(review, { method: "POST", body: { t: t1, action: "decide", date: "2026-11-29", edition: "plain", decision: "changes", notes: "Tighten the intro." } });
let c = (await call(companion)).body;
ok(!c["2026-11-29"], "a sent-back edition stays private");
const edited = "Advent begins. We ask God to come, and Jesus tells us to stay awake.";
const ap = await call(review, { method: "POST", body: { t: t1, action: "decide", date: "2026-11-29", edition: "plain", decision: "approved", edits: { intro: edited } } });
ok(ap.code === 200, "approve with an edit succeeds");
c = (await call(companion)).body;
ok(c["2026-11-29"]?.plain?.intro === edited, "the approved Plain edition is public with the edit applied");
ok(c["2026-11-29"].review.plain.by === "Fr. Test One", "approval names the reviewer");
ok(!c["2026-11-29"].kids && !c["2026-11-29"].family, "unapproved editions stay private");

// Family needs Plain approved too.
await call(review, { method: "POST", body: { t: t2, action: "decide", date: "2026-12-06", edition: "family", decision: "approved" } });
c = (await call(companion)).body;
ok(!c["2026-12-06"], "Family alone does not publish without Plain");
await call(review, { method: "POST", body: { t: t2, action: "decide", date: "2026-12-06", edition: "plain", decision: "approved" } });
c = (await call(companion)).body;
ok(c["2026-12-06"]?.family && c["2026-12-06"]?.plain, "Family publishes once Plain is approved");

// A later decision replaces an earlier one; history keeps both.
await call(review, { method: "POST", body: { t: t2, action: "decide", date: "2026-11-29", edition: "plain", decision: "changes", notes: "Second look: one word." } });
c = (await call(companion)).body;
ok(!c["2026-11-29"], "a later send-back withdraws the approval");
const day = (await call(review, { query: { t: t1, date: "2026-11-29" } })).body;
ok(day.history.plain.length === 3 && day.guide.plain.intro === edited, "history keeps every decision and edits persist");

// An approval of an older draft no longer counts after a redraft.
await writeJSON("decisions/2026-12-13/kids/2026-10-01T00-00-00-000Z__abc__approved.json",
  { decision: "approved", hash: "0000000000000000", reviewer: { id: "abc", name: "Fr. Old" }, at: "2026-10-01T00:00:00.000Z", edits: {} }, { overwrite: false });
q = (await call(review, { query: { t: t1 } })).body;
ok(q.days.find(d => d.date === "2026-12-13").editions.kids.status === "redrafted", "a redraft after approval needs a fresh look");
ok(!(await call(companion)).body["2026-12-13"], "a redrafted edition is not public");

// Calendar feed.
const cal = await call(calendar, { query: { t: t1 } });
ok(cal.code === 200 && cal.body.startsWith("BEGIN:VCALENDAR") && cal.body.includes("TRIGGER:-P7D") && cal.body.includes("TRIGGER:-P1D"), "calendar feed has deadlines with alerts");
ok((await call(calendar, { query: { t: "z".repeat(30) } })).code === 401, "calendar refuses a wrong token");

// Removing a reviewer turns the link off.
await call(admin, { method: "POST", body: { a: ownerToken, action: "remove", id: inv.body.id } });
ok((await call(review, { query: { t: t1 } })).code === 401, "a removed reviewer's link stops working");

console.log(`review API: ${n} checks passed`);
