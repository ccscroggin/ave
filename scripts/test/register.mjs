import { registerHooks } from "node:module";
const stub = new URL("./blob-stub.mjs", import.meta.url).href;
registerHooks({ resolve(spec, ctx, next) { return spec === "@vercel/blob" ? { url: stub, shortCircuit: true } : next(spec, ctx); } });
