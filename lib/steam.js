// Mouvement des cotes : on compare la probabilité actuelle (marge retirée) à celle d'un relevé plus ancien (24 à 72 h).
// Sur 4 saisons d'historique, suivre une cote qui baisse d'au moins 3 points avant le match a rapporté +6 % :
// la baisse traduit une information (composition, blessure, suspension) que le marché a intégrée.
import { STEAM_MIN } from "./learned.js";

async function oldSnapshot() {
  const g = globalThis.__steamSnap;
  if (g && Date.now() - g.at < 30 * 60e3) return g.data;
  let data = null;
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { list } = await import("@vercel/blob");
      const r = await list({ prefix: "odds-snap/", limit: 300 });
      const now = Date.now();
      const old = r.blobs.map((b) => ({ b, age: now - +new Date(b.uploadedAt) })).filter((x) => x.age >= 20 * 3600e3 && x.age <= 72 * 3600e3).sort((a, b) => b.age - a.age)[0];
      if (old) { const res = await fetch(old.b.url, { cache: "no-store" }); if (res.ok) data = await res.json(); }
    }
  } catch {}
  globalThis.__steamSnap = { at: Date.now(), data };
  return data;
}

export async function attachSteam(matches) {
  const snap = await oldSnapshot();
  if (!snap?.matches?.length) return matches;
  const prev = new Map(snap.matches.map((m) => [m.id, m]));
  const age = snap.fetchedAt ? Math.round((Date.now() - +new Date(snap.fetchedAt)) / 3600e3) : null;
  for (const m of matches) {
    const p = prev.get(m.id);
    if (!p?.outcomes) continue;
    const moves = [];
    for (const o of m.outcomes || []) {
      const q = p.outcomes.find((x) => x.name === o.name);
      if (o.prob == null || q?.prob == null) continue;
      const d = o.prob - q.prob;
      if (Math.abs(d) >= STEAM_MIN) moves.push({ name: o.name, from: q.best?.odds || null, to: o.best?.odds || null, d });
    }
    if (moves.length) m.steam = { hours: age, moves };
  }
  return matches;
}
// Mouvement concernant une issue précise (nom tel qu'affiché dans outcomes)
export const steamOf = (m, name) => m.steam?.moves?.find((x) => x.name === name) || null;
