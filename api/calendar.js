// GET /api/calendar?t=TOKEN — a reviewer's calendar feed. Subscribing in a phone
// calendar gives native reminders a week and a day before each month's deadline,
// with no email service involved.
import { configured, reviewerFor, schedule, send } from "./_lib.js";

const MONTH = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const ics = s => String(s).replace(/[\\;,]/g, m => "\\" + m).replace(/\n/g, "\\n");
const compact = d => d.replace(/-/g, "");

export default async function handler(req, res) {
  if (!configured()) return send(res, 503, "Review storage is not set up.");
  const token = (req.query.t || "").toString(), me = await reviewerFor(token);
  if (!me) return send(res, 401, "This calendar link is not valid.");
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const link = `https://${host}/review?t=${token}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ave//Guide review//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Ave guide reviews", "REFRESH-INTERVAL;VALUE=DURATION:PT12H", "X-PUBLISHED-TTL:PT12H"];
  for (const s of schedule()) {
    const month = MONTH.format(new Date(s.month + "-01T12:00:00Z"));
    const end = new Date(s.due + "T12:00:00Z"); end.setUTCDate(end.getUTCDate() + 1);
    lines.push("BEGIN:VEVENT", `UID:ave-review-${s.month}@${host}`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(s.due)}`, `DTEND;VALUE=DATE:${compact(end.toISOString().slice(0, 10))}`,
      `SUMMARY:${ics(`Ave: review the ${month} guides`)}`,
      `DESCRIPTION:${ics(`${s.days.length} Sundays and holy days, three editions each. Open your review page: ${link}`)}`,
      `URL:${link}`,
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${ics(`${month} guides are due in a week`)}`, "TRIGGER:-P7D", "END:VALARM",
      "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${ics(`${month} guides are due tomorrow`)}`, "TRIGGER:-P1D", "END:VALARM",
      "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  send(res, 200, lines.join("\r\n") + "\r\n", { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": "inline; filename=ave-reviews.ics" });
}
