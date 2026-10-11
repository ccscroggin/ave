// /api/voice-sunday — Saturday-night cron: make the AI-voice recordings for
// tomorrow's readings ahead of time (English readings, and the Spanish labels and
// citations), so Sunday's Listen buttons play at once. Pieces already stored are
// skipped, so a second run finishes what the first did not.
//   GET (Authorization: Bearer $CRON_SECRET; Vercel cron sends it)  ?date=YYYY-MM-DD optional
// Respects the monthly ceiling in _voice.js and stops before the function's time limit.
import { send, configured } from "./_lib.js";
import { piecesOf, readingDay, aloud, recording, usedThisMonth, MONTHLY_CHARS } from "./_voice.js";

const TIME_BUDGET_MS = 45000; // vercel.json gives api functions 60 s
const PARALLEL = 2;

// The day after today in US Central time. The cron runs Saturday night there.
export function tomorrowCentral(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(now);
  const d = new Date(today + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers?.authorization !== `Bearer ${secret}`) return send(res, 401, { error: "Not allowed." });
  if (!configured()) return send(res, 503, { error: "Voice storage is not set up." });
  const q = String(req.query?.date || "");
  const date = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : tomorrowCentral();
  const day = readingDay(date);
  if (!day) { console.log(`voice-sunday: no readings for ${date}`); return send(res, 404, { error: `No readings for ${date}.` }); }

  const pieces = piecesOf(aloud().readingDayParts(day)), started = Date.now();
  const out = { date, title: day.title, pieces: pieces.length, made: 0, stored: 0, failed: 0, notStarted: 0, chars: 0, stopped: null };
  let i = 0;
  async function worker() {
    while (i < pieces.length && !out.stopped) {
      if (Date.now() - started > TIME_BUDGET_MS) { out.stopped = "time"; break; }
      const p = pieces[i++], r = await recording(p);
      if (r.status === 200 && r.made) { out.made++; out.chars += p.text.length; console.log(`voice-sunday: made ${p.key} ${p.lang} ${p.text.length} chars: ${p.text.slice(0, 60)}`); }
      else if (r.status === 200) out.stored++;
      else { out.failed++; console.error(`voice-sunday: ${r.status} ${p.key}: ${r.error}`); if (r.status === 429 || r.status === 503) out.stopped = r.status === 429 ? "monthly limit" : "not set up"; }
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker));
  out.notStarted = pieces.length - i;
  out.usedThisMonth = await usedThisMonth(); out.limit = MONTHLY_CHARS;
  console.log(`voice-sunday: ${JSON.stringify(out)}`);
  return send(res, 200, out);
}
