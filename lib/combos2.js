import { enough } from "./enough.js";
// Combinés intelligents : 2 à 5 sélections, 3 profils. Un seul pari par match (matchs indépendants :
// la probabilité du combiné est le produit des probabilités ajustées, jamais deux paris corrélés du même match).
import { candidates, mk, classify, dailyCombos } from "./analysis.js";
const BOOKS = ["Betclic", "Winamax", "Unibet", "PMU"];
function comboOf(legs) {
  const perBook = {};
  let top = null;
  for (const b of BOOKS) {
    perBook[b] = legs.every((l) => typeof l.outcome.odds[b] === "number") ? legs.reduce((x, l) => x * l.outcome.odds[b], 1) : null;
    if (perBook[b] && (!top || perBook[b] > top.odds)) top = { book: b, odds: perBook[b] };
  }
  if (!top) return null;
  const prob = legs.reduce((x, l) => x * l.outcome.probAdj, 1);
  return { legs, book: top.book, odds: top.odds, perBook, prob, ev: prob * top.odds - 1 };
}
function subsets(arr, k, start = 0, cur = [], out = []) {
  if (cur.length === k) { out.push([...cur]); return out; }
  for (let i = start; i < arr.length; i++) { cur.push(arr[i]); subsets(arr, k, i + 1, cur, out); cur.pop(); }
  return out;
}
export const PROFILES = [
  { key: "sure", label: "Prudent", min: 1.7, max: 4.5, minProb: 0.3, pick: (a, b) => b.prob - a.prob },
  { key: "balanced", label: "Équilibré", min: 3, max: 10, minProb: 0.1, pick: (a, b) => b.ev - a.ev },
  { key: "bold", label: "Audacieux", min: 8, max: 80, minProb: 0.03, pick: (a, b) => b.ev - a.ev },
];
export function smartCombos(matches, now = Date.now()) {
  const end = now + 8 * 24 * 3600e3;
  const score = (l) => l.outcome.probAdj + 2 * l.outcome.evAdj;
  const legs = [];
  for (const m of matches) {
    const t = +new Date(m.start);
    if (!enough(m) || t <= now || t > end) continue;
    const c = candidates(m)
      .filter((c) => c.o.best.odds >= 1.25 && c.o.best.odds <= 2.8 && c.o.probAdj >= 0.38 && c.o.evAdj >= -0.1)
      .map((c) => mk(m, c, classify(c) || "safe"))
      .sort((a, b) => score(b) - score(a))[0];
    if (c) legs.push(c);
  }
  legs.sort((a, b) => score(b) - score(a));
  const top = legs.slice(0, 10);
  const out = [];
  for (const size of [2, 3, 4, 5]) {
    if (top.length < size) continue;
    const all = subsets(top, size).map(comboOf).filter(Boolean);
    for (const p of PROFILES) {
      const best = all.filter((c) => c.odds >= p.min && c.odds <= p.max && c.prob >= p.minProb).sort(p.pick)[0];
      if (best) out.push({ ...best, size, tier: p.key, profile: p.label, label: `${p.label} · ${size} sélections`, stars: best.prob >= 0.4 ? 4 : best.prob >= 0.22 ? 3 : best.prob >= 0.1 ? 2 : 1 });
    }
  }
  if (!out.length) for (const c of dailyCombos(matches, now)) out.push({ ...c, size: c.legs.length, profile: c.label });
  return out;
}
