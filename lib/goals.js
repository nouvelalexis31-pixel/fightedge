// Pronos « plus / moins de 2,5 buts » (football) : cotes françaises réelles, probabilité = avis du marché.
export function goalPicks(matches, now = Date.now()) {
  const out = [];
  for (const m of matches) {
    if (m.sport !== "football") continue;
    const t0 = +new Date(m.start);
    if (t0 <= now || t0 > now + 40 * 3600e3) continue;
    const t = (m.totals || []).find((x) => x.point === 2.5 && x.over?.best && x.under?.best && x.over.probAdj != null && x.under.probAdj != null);
    if (!t) continue;
    const s = [["over", t.over], ["under", t.under]]
      .map(([side, o]) => ({ side, o }))
      .filter((x) => x.o.best.odds >= 1.5 && x.o.probAdj >= 0.38 && x.o.evAdj >= -0.1)
      .sort((a, b) => b.o.probAdj - a.o.probAdj)[0];
    if (!s) continue;
    out.push({ m, side: s.side, o: s.o, prob: s.o.probAdj, ev: s.o.evAdj, other: s.side === "over" ? t.under : t.over, tempo: m.form?.tempo ?? null });
  }
  return out.sort((a, b) => b.prob + b.ev - (a.prob + a.ev)).slice(0, 6);
}
