// GET /api/companion — the guides the public app may show: approved editions
// only, with the reviewer's edits applied. Family needs Plain approved too,
// because the Family booklet prints the Plain readings guide.
import { configured, reviewState, editedDay, statusOf, EDITIONS, send } from "./_lib.js";

export default async function handler(req, res) {
  if (!configured()) return send(res, 503, { error: "Review storage is not set up." });
  try {
    const state = await reviewState(), out = {};
    for (const day of Object.keys(state)) {
      const { day: d, history } = await editedDay(day, state);
      if (!d) continue;
      const review = {};
      for (const ed of EDITIONS) {
        const h = history[ed], latest = h[h.length - 1];
        const s = statusOf(day, ed, latest);
        if (s.status === "approved") review[ed] = { status: "approved", by: s.by, at: s.at };
      }
      if (review.family && !review.plain) delete review.family;
      if (!Object.keys(review).length) continue;
      out[day] = { review };
      if (review.plain) out[day].plain = d.plain;
      if (review.kids) out[day].kids = d.kids;
      if (review.family) out[day].family = d.family;
    }
    send(res, 200, out, { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" });
  } catch (e) {
    send(res, 500, { error: "Could not read reviews." });
  }
}
