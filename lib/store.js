// Stockage persistant de l'historique des pronos (Vercel Blob). Écriture en ajout seulement : un fichier existant n'est jamais réécrit.
import fs from "node:fs";
import path from "node:path";

const DIR = process.env.FE_STORE_DIR || "";
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN && !DIR;
export const storeOn = () => USE_BLOB || !!DIR;
const cache = new Map(); // fichiers immuables : on ne les relit jamais

export async function putJson(pathname, data) {
  const body = JSON.stringify(data);
  if (DIR) {
    const f = path.join(DIR, pathname);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    if (fs.existsSync(f)) throw new Error("Fichier déjà existant : " + pathname);
    fs.writeFileSync(f, body);
    return;
  }
  if (!USE_BLOB) throw new Error("Stockage non configuré");
  const { put } = await import("@vercel/blob");
  await put(pathname, body, { access: "public", addRandomSuffix: false, allowOverwrite: false, contentType: "application/json" });
}

export async function listJson(prefix) {
  const docs = [];
  if (DIR) {
    const root = path.join(DIR, prefix);
    const walk = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)])) : []);
    for (const f of walk(root).sort()) docs.push({ name: path.relative(DIR, f), data: JSON.parse(fs.readFileSync(f, "utf8")) });
    return docs;
  }
  if (!USE_BLOB) return [];
  const { list } = await import("@vercel/blob");
  let cursor;
  const files = [];
  do {
    const r = await list({ prefix, cursor, limit: 1000 });
    files.push(...r.blobs);
    cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  files.sort((a, b) => a.pathname.localeCompare(b.pathname));
  const todo = files.filter((f) => !cache.has(f.pathname));
  for (let i = 0; i < todo.length; i += 12) {
    await Promise.all(todo.slice(i, i + 12).map(async (f) => {
      const r = await fetch(f.url, { cache: "no-store" });
      if (!r.ok) throw new Error("Lecture impossible : " + f.pathname);
      cache.set(f.pathname, await r.json());
    }));
  }
  return files.map((f) => ({ name: f.pathname, data: cache.get(f.pathname) }));
}

// Dernier relevé de cotes valide (secours quand la source tombe ou que le quota est atteint). La clé inversée met le plus récent en premier.
const SNAP = "odds-snap/";
let lastSnap = 0;
export async function saveSnapshot(data, force = false) {
  if (!storeOn() || (!force && Date.now() - lastSnap < 20 * 60e3)) return;
  lastSnap = Date.now();
  try { await putJson(SNAP + String(9999999999999 - Date.now()).padStart(13, "0") + ".json", data); } catch {}
}
export async function latestSnapshot() {
  try {
    if (DIR) {
      const d = path.join(DIR, SNAP);
      if (!fs.existsSync(d)) return null;
      const f = fs.readdirSync(d).sort()[0];
      return f ? JSON.parse(fs.readFileSync(path.join(d, f), "utf8")) : null;
    }
    if (!USE_BLOB) return null;
    const { list } = await import("@vercel/blob");
    const r = await list({ prefix: SNAP, limit: 200 });
    const b = [...r.blobs].sort((x, y) => +new Date(y.uploadedAt) - +new Date(x.uploadedAt))[0];
    if (!b) return null;
    const res = await fetch(b.url, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}
