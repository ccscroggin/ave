// Shared code for the AI voice. Files starting with "_" are not routes.
//
// The server speaks only Ave's own texts. It loads site/aloud.js (the same file
// the app uses to build what it reads) and builds the list of every speakable
// piece: each rosary step in both languages, and each day's readings in
// content/readings. A piece is addressed by keyOf(lang, text), a hash that also
// covers the voice settings; a request names only that hash, never text.
//
// Blob layout (the same private store as the review service):
//   voice/<key>.mp3                 one recording, kept forever
//   voice-usage/<YYYY-MM>.json      {chars} sent to ElevenLabs this month (UTC)
import { put, get } from "@vercel/blob";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { readJSON, writeJSON } from "./_lib.js";

// Hard ceiling on characters sent to ElevenLabs per calendar month (UTC).
// Characters are counted before each request, so a failed request still counts.
export const MONTHLY_CHARS = 60000;

const ROOT = process.cwd();
const READINGS = join(ROOT, "content", "readings");

let A = null;
export function aloud() {
  if (A) return A;
  const sandbox = { window: {} };
  vm.runInNewContext(readFileSync(join(ROOT, "site", "i18n.js"), "utf8"), sandbox);
  vm.runInNewContext(readFileSync(join(ROOT, "site", "aloud.js"), "utf8"), sandbox);
  return (A = sandbox.window.AVE_ALOUD);
}
export const keyOf = (lang, text) => createHash("sha256").update(aloud().keyInput(lang, text)).digest("hex").slice(0, 32);

// [[text, lang], ...] -> [{key, text, lang}], one entry per voice-sized piece, without repeats.
export function piecesOf(parts) {
  const seen = new Set(), out = [];
  for (const [text, lang] of aloud().pieces(parts)) {
    const key = keyOf(lang, text);
    if (!seen.has(key)) { seen.add(key); out.push({ key, text, lang }); }
  }
  return out;
}
export function readingDay(date) {
  const p = join(READINGS, `${date}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}

let INDEX = null;
// key -> {text, lang} for everything Ave can read aloud.
export function speakable() {
  if (INDEX) return INDEX;
  const m = new Map(), add = parts => { for (const p of piecesOf(parts)) m.set(p.key, p); };
  add(aloud().rosaryParts());
  if (existsSync(READINGS)) for (const f of readdirSync(READINGS).sort()) {
    if (/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) add(aloud().readingDayParts(readingDay(f.slice(0, 10))));
  }
  return (INDEX = m);
}

const audioPath = key => `voice/${key}.mp3`;
export async function cached(key) {
  const r = await get(audioPath(key), { access: "private" }).catch(() => null);
  if (!r || r.statusCode !== 200) return null;
  return Buffer.from(await new Response(r.stream).arrayBuffer());
}

const usagePath = () => `voice-usage/${new Date().toISOString().slice(0, 7)}.json`;
export async function usedThisMonth() { return (await readJSON(usagePath()))?.chars || 0; }
// Count n characters against this month, or refuse if that would pass the ceiling.
// Two requests at the same moment can both pass; the overshoot is at most one piece each.
async function reserve(n) {
  const path = usagePath(), used = (await readJSON(path))?.chars || 0;
  if (used + n > MONTHLY_CHARS) return false;
  await writeJSON(path, { chars: used + n, limit: MONTHLY_CHARS, updated: new Date().toISOString() });
  return true;
}

// Make one recording with ElevenLabs, store it, and return it.
// -> {status: 200, audio} | {status: 429 | 502 | 503, error}
export async function synthesize({ key, text, lang }) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return { status: 503, error: "The AI voice is not set up." };
  if (!(await reserve(text.length))) return { status: 429, error: "The AI voice has reached its limit for this month." };
  const V = aloud().VOICE;
  let r;
  try {
    r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${V.voice_id}?output_format=${V.output_format}`, {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({ text, model_id: V.model_id, voice_settings: V.voice_settings })
    });
  } catch (e) { console.error(`voice: ElevenLabs unreachable for ${key}: ${e.message}`); return { status: 502, error: "The AI voice did not answer." }; }
  if (!r.ok) {
    console.error(`voice: ElevenLabs ${r.status} for ${key} (${lang}, ${text.length} chars): ${(await r.text().catch(() => "")).slice(0, 200)}`);
    return { status: 502, error: "The AI voice did not answer." };
  }
  const audio = Buffer.from(await r.arrayBuffer());
  if (audio.length < 200) { console.error(`voice: ElevenLabs returned ${audio.length} bytes for ${key}`); return { status: 502, error: "The AI voice did not answer." }; }
  await put(audioPath(key), audio, { access: "private", contentType: "audio/mpeg", addRandomSuffix: false, allowOverwrite: true });
  return { status: 200, audio };
}

// One recording for a piece: from the store, or made now. Requests for the same
// piece that arrive together in one instance share one ElevenLabs call.
const inflight = new Map();
export function recording(piece) {
  if (!inflight.has(piece.key)) {
    inflight.set(piece.key, (async () => {
      const audio = await cached(piece.key);
      if (audio) return { status: 200, audio, made: false };
      const r = await synthesize(piece);
      if (r.status === 200) console.log(`voice: made ${piece.key} ${piece.lang} ${piece.text.length} chars`);
      return { ...r, made: r.status === 200 };
    })().finally(() => inflight.delete(piece.key)));
  }
  return inflight.get(piece.key);
}
