// Tests for the AI voice: the app and the server agree on every speakable text,
// the endpoint refuses text it did not build, and the monthly ceiling holds.
// ElevenLabs and Blob are mocked; nothing here calls the network.
// Run from the repo root: node --import ./scripts/test/register.mjs scripts/test/voice.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import vm from "node:vm";
process.env.BLOB_READ_WRITE_TOKEN = "test-only";
delete process.env.ELEVENLABS_API_KEY;
const V = await import("../../api/_voice.js");
const voice = (await import("../../api/voice.js")).default;
const sunday = await import("../../api/voice-sunday.js");
const { writeJSON } = await import("../../api/_lib.js");
const store = globalThis.__blobStore;

let n = 0; const ok = (cond, msg) => { assert.ok(cond, msg); n++; };
function call(handler, { method = "GET", query = {}, headers = {} } = {}) {
  return new Promise(resolve => {
    const res = { code: 200, headers: {}, status(c) { this.code = c; return this; }, setHeader(k, v) { this.headers[k] = v; },
      json(b) { resolve({ code: this.code, body: b, headers: this.headers }); }, send(b) { resolve({ code: this.code, body: b, headers: this.headers }); } };
    handler({ method, query, headers }, res);
  });
}

// ---------- 1. The real client and the server agree ----------
// Load the browser files the way index.html does (i18n.js, then aloud.js, into one window).
const app = readFileSync("site/app.js", "utf8");
const win = {};
vm.runInNewContext(readFileSync("site/i18n.js", "utf8") + "\n" + readFileSync("site/aloud.js", "utf8"), { window: win });
const A = win.AVE_ALOUD;
// Pull the client's own code out of app.js and run it, so this checks app.js, not a copy.
const grab = re => { const m = app.match(re); assert.ok(m, `app.js no longer has ${re}`); return m[0]; };
const buildSrc = grab(/^function build\(\)\{[\s\S]*?\n\}$/m);
const stepTextSrc = grab(/^function stepText\(\)\{.*\}$/m);
const spokenSrc = grab(/^\s*const spoken=r=>.*;$/m);
const keySrc = grab(/^async function voiceKey\(lang,text\)\{[\s\S]*?\n\}$/m);
ok(/AL\(\)\.stepText\(/.test(stepTextSrc) && /AL\(\)\.readingParts\(/.test(spokenSrc), "app.js builds its read-aloud text with site/aloud.js");
ok(!/Fruit of the mystery:"\)\} \$\{|r\.t\.map\(e=>e\[2\]\)\.join/.test(app), "app.js keeps no copy of the read-aloud text");

const index = V.speakable();
ok(index.size > 3000, `the server knows ${index.size} pieces`);
const missing = [];
const want = (parts, where) => { for (const [text, lang] of A.pieces(parts)) if (!index.has(V.keyOf(lang, text))) missing.push(`${where}: ${lang} ${text.slice(0, 60)}`); };

// Rosary: the client's build() with Fatima on and off, every set, both languages, every step and the end.
let rosarySteps = 0;
for (const lang of ["en", "es"]) for (const fatima of [true, false]) for (const set of Object.keys(A.SETS)) {
  const ctx = { S: { fatima, set, cur: 0 }, steps: [], firstIdx: {}, AL: () => A.forLang(lang) };
  vm.runInNewContext(`${buildSrc}\n${stepTextSrc}\nbuild(); var out=[]; for(S.cur=0;S.cur<=steps.length;S.cur++) out.push(stepText());`, ctx);
  rosarySteps += ctx.out.length;
  want(ctx.out.map(t => [t, lang]), `rosary ${set} fatima=${fatima}`);
}
ok(rosarySteps > 1200, `checked ${rosarySteps} rosary steps`);
// Mass: the client's spoken() for every reading of every day, both languages, English text shown or not.
let readings = 0;
for (const f of readdirSync("content/readings").filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))) {
  const day = JSON.parse(readFileSync(`content/readings/${f}`, "utf8"));
  for (const lang of ["en", "es"]) for (const showEn of [false, true]) {
    const ctx = { AL: () => A.forLang(lang), showEn, day };
    vm.runInNewContext(`${spokenSrc}\nvar out=day.r.filter(r=>${lang === "es"}||r.t.length).map(r=>spoken(r));`, ctx);
    for (const parts of ctx.out) { readings++; want(parts, f.slice(0, 10)); }
  }
}
ok(readings > 5000, `checked ${readings} reading read-alouds`);
ok(missing.length === 0, `pieces the client would ask for that the server does not know:\n${missing.slice(0, 5).join("\n")}`);

// The client's voiceKey() (WebCrypto) gives the same key as the server's keyOf() (node:crypto).
const kctx = { crypto: globalThis.crypto, TextEncoder, Uint8Array, window: { AVE_ALOUD: A } };
vm.runInNewContext(`${keySrc}\nvar voiceKeyFn=voiceKey;`, kctx);
for (const [text, lang] of [[A.forLang("en").stepText("joyful", { key: "sign" }), "en"], [A.forLang("es").stepText("luminous", { key: "mystery", d: 2 }), "es"]]) {
  ok(await kctx.voiceKeyFn(lang, text) === V.keyOf(lang, text), `client and server keys agree (${lang})`);
}
ok(V.keyOf("en", "Amen.") !== V.keyOf("es", "Amen."), "the language is part of the key");

// Pieces keep every word, and none is too long.

for (const { text } of index.values()) ok(text.length <= A.CHUNK, "piece within the size limit");
for (const [text] of A.rosaryParts()) { const back = A.chunks(text).join(" "); ok(back.replace(/\s+/g, "") === text.replace(/\s+/g, ""), "chunks keep every character"); }

// ---------- 2. The endpoint ----------
let calls = [];
const mp3 = Buffer.alloc(4000, 0xff);
globalThis.fetch = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body), key: opts.headers["xi-api-key"] }); return new Response(mp3, { status: 200, headers: { "Content-Type": "audio/mpeg" } }); };
const sign = A.forLang("en").stepText("joyful", { key: "sign" }), signKey = V.keyOf("en", sign);

ok((await call(voice, { query: { h: "nope" } })).code === 400, "a malformed key is refused");
ok((await call(voice, { query: { h: V.keyOf("en", "Say something rude.") } })).code === 404, "text Ave did not build is refused");
ok((await call(voice, { query: { h: V.keyOf("en", sign + " ") } })).code === 404, "a near copy of a prayer is refused");
ok((await call(voice, { method: "POST", query: { h: signKey } })).code === 405, "only GET");
ok(calls.length === 0, "nothing refused reached ElevenLabs");
ok((await call(voice, { query: { h: signKey } })).code === 503 && calls.length === 0, "without a key the voice answers 503 and calls nobody");

process.env.ELEVENLABS_API_KEY = "test-key";
let r = await call(voice, { query: { h: signKey } });
ok(r.code === 200 && Buffer.isBuffer(r.body) && r.body.length === mp3.length && r.headers["Content-Type"] === "audio/mpeg", "a known piece is made and returned");
ok(r.headers["X-Ave-Voice"] === "made" && /immutable/.test(r.headers["Cache-Control"]), "made, and cacheable");
ok(calls.length === 1 && calls[0].body.text === sign && calls[0].key === "test-key", "ElevenLabs got exactly the prayer");
ok(calls[0].url === "https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb?output_format=mp3_44100_64", "George, mp3 44.1 kHz 64 kbps");
ok(calls[0].body.model_id === "eleven_multilingual_v2" && JSON.stringify(calls[0].body.voice_settings) === '{"stability":0.6,"similarity_boost":0.75,"speed":0.92}', "model and settings");
ok(store.has(`voice/${signKey}.mp3`), "the recording is stored");
r = await call(voice, { query: { h: signKey } });
ok(r.code === 200 && r.headers["X-Ave-Voice"] === "stored" && calls.length === 1, "the second request is served from the store");
const month = `voice-usage/${new Date().toISOString().slice(0, 7)}.json`;
ok(JSON.parse(store.get(month)).chars === sign.length, "characters are counted");

// The monthly ceiling.
const creed = A.forLang("en").stepText("joyful", { key: "creed" });
const creedPiece = V.piecesOf([[creed, "en"]])[0];
await writeJSON(month, { chars: V.MONTHLY_CHARS - creedPiece.text.length + 1 });
r = await call(voice, { query: { h: creedPiece.key } });
ok(r.code === 429 && calls.length === 1 && !store.has(`voice/${creedPiece.key}.mp3`), "over the ceiling: 429, and ElevenLabs is not called");
ok((await call(voice, { query: { h: signKey } })).code === 200, "stored pieces still play over the ceiling");
await writeJSON(month, { chars: V.MONTHLY_CHARS - creedPiece.text.length });
ok((await call(voice, { query: { h: creedPiece.key } })).code === 200 && calls.length === 2, "exactly at the ceiling is allowed");
ok(JSON.parse(store.get(month)).chars === V.MONTHLY_CHARS, "and the month is now full");

// ElevenLabs failing stores nothing.
await writeJSON(month, { chars: 0 });
globalThis.fetch = async () => new Response("quota", { status: 401 });
const hail = V.piecesOf([[A.forLang("es").stepText("joyful", { key: "hail" }), "es"]])[0];
r = await call(voice, { query: { h: hail.key } });
ok(r.code === 502 && !store.has(`voice/${hail.key}.mp3`), "an ElevenLabs error is 502 and stores nothing");

// ---------- 3. The Saturday-night cron ----------
globalThis.fetch = async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return new Response(mp3, { status: 200 }); };
delete process.env.CRON_SECRET;
ok((await call(sunday.default, { headers: { authorization: "Bearer " } })).code === 401, "no CRON_SECRET set: refused");
process.env.CRON_SECRET = "s3cret-for-tests";
ok((await call(sunday.default, {})).code === 401, "no Authorization: refused");
ok((await call(sunday.default, { headers: { authorization: "Bearer wrong" } })).code === 401, "wrong secret: refused");
ok(sunday.tomorrowCentral(new Date("2026-10-11T04:00:00Z")) === "2026-10-11", "Saturday 11 pm Central -> Sunday");
ok(sunday.tomorrowCentral(new Date("2026-12-13T04:00:00Z")) === "2026-12-13", "also in winter time");
const sunDate = "2026-10-11", sunDay = V.readingDay(sunDate);
const expected = V.piecesOf(A.readingDayParts(sunDay));
calls = []; await writeJSON(month, { chars: 0 });
const logs = []; const log = console.log; console.log = (...a) => logs.push(a.join(" "));
r = await call(sunday.default, { query: { date: sunDate }, headers: { authorization: "Bearer s3cret-for-tests" } });
console.log = log;
ok(r.code === 200 && r.body.made === expected.length && calls.length === expected.length && r.body.failed === 0, `the cron made all ${expected.length} pieces for ${sunDate}`);
ok(expected.every(p => store.has(`voice/${p.key}.mp3`)), "every piece is stored");
ok(new Set(expected.map(p => p.lang)).size === 2 && expected.some(p => p.lang === "es"), "English readings and Spanish labels");
ok(logs.filter(l => l.startsWith("voice-sunday: made")).length === expected.length, "each piece is logged");
r = await call(sunday.default, { query: { date: sunDate }, headers: { authorization: "Bearer s3cret-for-tests" } });
ok(r.body.made === 0 && r.body.stored === expected.length && calls.length === expected.length, "a second run makes nothing new");
// Cron stops at the ceiling.
for (const p of expected) store.delete(`voice/${p.key}.mp3`);
await writeJSON(month, { chars: V.MONTHLY_CHARS - 1 }); calls = [];
r = await call(sunday.default, { query: { date: sunDate }, headers: { authorization: "Bearer s3cret-for-tests" } });
ok(r.code === 200 && r.body.stopped === "monthly limit" && calls.length === 0, "the cron stops at the monthly ceiling");

console.log(`voice: ${n} checks passed (${index.size} speakable pieces, ${rosarySteps} rosary steps, ${readings} reading read-alouds)`);
