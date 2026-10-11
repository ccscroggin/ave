// /api/voice — the AI voice for read-aloud.
//   GET ?h=KEY   the mp3 for one piece of Ave's own text (key from site/aloud.js keyInput,
//                SHA-256, first 32 hex). Unknown keys get 404: the server never reads
//                text it did not build itself. Over the monthly ceiling: 429. The app
//                falls back to the device's own voice on any error.
import { send, configured } from "./_lib.js";
import { speakable, recording } from "./_voice.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Use GET." });
  const h = String(req.query?.h || "");
  if (!/^[0-9a-f]{32}$/.test(h)) return send(res, 400, { error: "Ask for a piece by its key." });
  const piece = speakable().get(h);
  if (!piece) return send(res, 404, { error: "Ave does not read that text." });
  if (!configured()) return send(res, 503, { error: "Voice storage is not set up." });
  const r = await recording(piece);
  if (r.status !== 200) return send(res, r.status, { error: r.error });
  res.status(200);
  res.setHeader("Content-Type", "audio/mpeg");
  // The key names one fixed recording, so browsers and Vercel's CDN may keep it.
  res.setHeader("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");
  res.setHeader("X-Ave-Voice", r.made ? "made" : "stored");
  res.send(r.audio);
}
