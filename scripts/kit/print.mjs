// Print pages to PDF with headless Chrome over the DevTools protocol.
// Usage: node scripts/kit/print.mjs jobs.json
// jobs.json: [{"url": "...", "out": "/abs/file.pdf", "ready": "READY"}]
// Each page must set document.title to start with `ready` (default "READY")
// when it has finished laying out; static pages can use "" to print on load.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = process.env.CHROME ||
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell`;
const PORT = 9333;
const jobs = JSON.parse(readFileSync(process.argv[2], "utf8"));
const sleep = ms => new Promise(r => setTimeout(r, ms));

const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), "avekit-"))}`, "--no-first-run", "about:blank"], { stdio: "ignore" });

let page;
for (let i = 0; i < 50 && !page; i++) {
  await sleep(200);
  try { page = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find(t => t.type === "page"); } catch {}
}
if (!page) { chrome.kill(); throw new Error("Chrome did not start"); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const waiting = new Map();
ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); } };
const send = (method, params = {}) => new Promise(res => { const n = ++id; waiting.set(n, res); ws.send(JSON.stringify({ id: n, method, params })); });
const evaluate = async expr => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;

let failed = 0;
try {
  await send("Page.enable");
  for (const job of jobs) {
    const ready = job.ready ?? "READY";
    await send("Page.navigate", { url: job.url });
    let ok = false, title = "";
    for (let i = 0; i < 300; i++) {
      await sleep(200);
      title = await evaluate("document.title") || "";
      if (ready === "" ? (await evaluate("document.readyState")) === "complete" : title.startsWith(ready)) { ok = true; break; }
    }
    if (!ok) { console.error(`TIMEOUT ${job.url} (title: ${title})`); failed++; continue; }
    await evaluate("document.fonts.ready.then(() => true)");
    await sleep(300);
    const pdf = await send("Page.printToPDF", { preferCSSPageSize: true, printBackground: true, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 });
    if (!pdf.result?.data) { console.error(`PRINT FAILED ${job.url}`, JSON.stringify(pdf.error)); failed++; continue; }
    writeFileSync(job.out, Buffer.from(pdf.result.data, "base64"));
    console.log(`wrote ${job.out} (${title || "static"})`);
  }
} finally { ws.close(); chrome.kill(); }
process.exit(failed ? 1 : 0);
