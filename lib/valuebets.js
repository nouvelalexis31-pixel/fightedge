import { enough } from "@/lib/enough";
// Value bets : formules et paliers. Probabilité implicite = 1 / cote ; cote théorique = 1 / probabilité estimée ; value % = (p × cote − 1) × 100.
import { candidates, mk } from "@/lib/analysis";

export const DEFAULT_T = [15, 10, 5, 1];
export const parseT = (s) => {
  const a = String(s || "").split(",").map(Number);
  return a.length === 4 && a.every(Number.isFinite) && a[0] >= a[1] && a[1] >= a[2] && a[2] >= a[3] && a[3] > 0 && a[0] <= 100 ? a : DEFAULT_T;
};
export const TIERS = [
  { k: "exc", label: "Exceptionnelle", cls: "bg-good text-white" },
  { k: "tres", label: "Très bonne", cls: "bg-good/20 text-good" },
  { k: "bonne", label: "Bonne", cls: "bg-brand/15 text-brand" },
  { k: "faible", label: "Faible", cls: "bg-card2 text-muted" },
];
export const tierOf = (value, t = DEFAULT_T) => {
  const v = value * 100;
  const i = v >= t[0] ? 0 : v >= t[1] ? 1 : v >= t[2] ? 2 : v >= t[3] ? 3 : -1;
  return i < 0 ? null : TIERS[i];
};

export function valueRows(matches, { now = Date.now(), hours = 168, sport = "", t = DEFAULT_T, minTier = 3 } = {}) {
  const rows = [];
  for (const m of matches) {
    const st = +new Date(m.start);
    if (!enough(m) || st <= now || st > now + hours * 3600e3 || (sport && m.sport !== sport)) continue;
    for (const c of candidates(m)) {
      const o = c.o;
      if (!o.best || o.probAdj == null || o.probAdj < 0.2) continue;
      const value = o.probAdj * o.best.odds - 1;
      const tier = tierOf(value, t);
      if (!tier || TIERS.indexOf(tier) > minTier) continue;
      rows.push({ m, c, o, value, tier, k: mk(m, c, "value") });
    }
  }
  return rows.sort((a, b) => b.k.score - a.k.score);
}
