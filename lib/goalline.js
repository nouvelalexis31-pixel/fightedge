import { pt } from "@/lib/format";

const P0 = (p) => `${Math.round(p * 100)} %`;

// Pari « plus / moins de buts » cohérent avec le modèle ET avec l'historique réel des deux équipes (10 derniers matchs).
export function goalLinePick(m) {
  const mo = m.model;
  if (m.sport !== "football" || mo?.kind !== "goals" || !mo.lines) return null;
  const f = m.form;
  const rH = f?.l10H || [], rA = f?.l10A || [];
  const share = (r, k, over) => (r.length >= 5 ? r.filter((x) => (over ? x.gf + x.ga > k : x.gf + x.ga < k)).length / r.length : null);
  let best = null;
  for (const { point: k, over: pm } of mo.lines) {
    for (const over of [true, false]) {
      const pmod = over ? pm : 1 - pm;
      const sh = share(rH, k, over), sa = share(rA, k, over);
      const hasEmp = sh != null && sa != null;
      const pe = hasEmp ? (sh + sa) / 2 : null;
      if (hasEmp && (pe < 0.5 || pmod < 0.5)) continue; // le modèle et l'historique doivent aller dans le même sens
      const p = hasEmp ? 0.6 * pmod + 0.4 * pe : pmod;
      if (p < 0.6 || p > 0.86) continue;
      const score = Math.abs(p - 0.72) - (hasEmp ? 0.05 : 0);
      if (!best || score < best.score) best = { k, over, p, pmod, pe, sh, sa, score, nH: rH.length, nA: rA.length };
    }
  }
  if (!best) return null;
  const { k, over, p } = best;
  const label = `${over ? "Plus" : "Moins"} de ${pt(k)} buts`;
  const t = (m.totals || []).find((x) => x.point === k);
  const o = t ? (over ? t.over : t.under) : null;
  const bestOdds = o?.best || null;
  const why = [];
  if (best.pe != null) {
    const cnt = (r, kk, ov) => r.filter((x) => (ov ? x.gf + x.ga > kk : x.gf + x.ga < kk)).length;
    why.push(`${m.home} : ${over ? "plus" : "moins"} de ${pt(k)} buts dans ${cnt(rH, k, over)} de ses ${best.nH} derniers matchs. ${m.away} : ${cnt(rA, k, over)} sur ${best.nA}.`);
  }
  why.push(`On attend environ ${mo.mu.toFixed(1).replace(".", ",")} buts : ${label.toLowerCase()} est probable (${P0(best.pmod)} de chances).`);
  if (f && over === false && f.home.ga / f.home.n <= 1.1 && f.away.ga / f.away.n <= 1.1) why.push("Les deux défenses encaissent peu en ce moment.");
  if (f && over === true && f.home.gf / f.home.n >= 1.6 && f.away.gf / f.away.n >= 1.2) why.push("Les deux attaques sont en forme.");
  return { k, over, label, p, fair: 1 / p, best: bestOdds, why: why.join(" "), start: m.start };
}
