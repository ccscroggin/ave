// In-memory stand-in for @vercel/blob, for local tests only.
const store = globalThis.__blobStore ||= new Map();
export async function put(pathname, body, opts = {}) {
  if (store.has(pathname) && !opts.allowOverwrite) throw new Error(`Blob already exists: ${pathname}`);
  store.set(pathname, typeof body === "string" ? body : Buffer.from(body)); return { pathname, url: "mem://" + pathname };
}
export async function get(pathname) {
  if (!store.has(pathname)) return null;
  return { statusCode: 200, stream: new Response(store.get(pathname)).body, headers: new Headers(), blob: { pathname } };
}
export async function list({ prefix = "" } = {}) {
  return { blobs: [...store.keys()].filter(k => k.startsWith(prefix)).sort().map(pathname => ({ pathname })), hasMore: false };
}
export async function del(p) { for (const k of [].concat(p)) store.delete(k); }
