// Tennis : "plus / moins de X,5 sets" à partir de la répartition 2/3 (ou 3/4/5) sets.
const pt = (n) => String(n).replace(".", ",");
export function setsLine(mo) {
  if (mo?.kind !== "sets") return null;
  const items = mo.markets.find((g) => g.group === "Nombre de sets")?.items || [];
  const cnt = items.map((x) => ({ s: parseInt(x.label, 10), p: x.p })).filter((x) => x.s > 0);
  if (cnt.length < 2) return null;
  const lines = [];
  for (const line of mo.n === 5 ? [3.5, 4.5] : [2.5]) {
    const under = cnt.filter((x) => x.s < line).reduce((a, x) => a + x.p, 0);
    const over = cnt.filter((x) => x.s > line).reduce((a, x) => a + x.p, 0);
    const exact = (side) => cnt.filter((x) => (side === "u" ? x.s < line : x.s > line)).sort((a, b) => b.p - a.p)[0]?.s;
    if (under >= over) lines.push({ line, side: "Moins", p: under, label: `Moins de ${pt(line)} sets`, hint: `match en ${cnt.filter((x) => x.s < line).map((x) => x.s).join(" ou ")} sets` });
    else lines.push({ line, side: "Plus", p: over, label: `Plus de ${pt(line)} sets`, hint: `match en ${cnt.filter((x) => x.s > line).map((x) => x.s).join(" ou ")} sets` });
    void exact;
  }
  return lines.sort((a, b) => b.p - a.p);
}
