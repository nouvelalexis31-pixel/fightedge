import { pt } from "@/lib/format";
import { candidates, unitOf } from "@/lib/analysis";
import { goalLinePick } from "@/lib/goalline";

const P0 = (p) => `${Math.round(p * 100)} %`;

// Pari sur une ligne (total ou handicap) cohérent : probabilité crédible (55 à 84 %), cote d'au moins 1,30, jamais « vainqueur ».
function linePick(m) {
  const u = unitOf(m);
  const c = candidates(m).filter((x) => (x.market === "totals" || x.market === "spreads") && x.o.best && x.o.probAdj != null && x.o.probAdj >= 0.55 && x.o.probAdj <= 0.84 && x.o.best.odds >= 1.3);
  if (!c.length) return null;
  c.sort((a, b) => Math.abs(a.o.probAdj - 0.66) - Math.abs(b.o.probAdj - 0.66));
  const x = c[0], p = x.o.probAdj, mo = m.model, why = [];
  const lead = x.market === "totals" ? `Le marché place la ligne à ${pt(x.line.point)} ${u}` : `Écart attendu entre les deux équipes : environ ${pt(Math.abs(x.line.point))} ${u}`;
  why.push(`${lead} : « ${x.label.toLowerCase()} » est probable (${P0(p)} de chances selon ${x.nBooks || m.nBooks} bookmakers).`);
  if (mo?.kind === "sets") why.push(`${mo.pDecider >= 0.4 ? "Match serré, qui peut aller au set décisif" : "Match plutôt à sens unique"} (${P0(mo.pDecider)} de chances d'aller au set décisif).`);
  if (mo?.kind === "points") why.push(`Notre modèle attend ${Math.round(mo.h)} - ${Math.round(mo.a)}, soit ${pt(mo.total)} ${u} au total.`);
  return { title: x.market === "totals" ? `Nombre de ${u}` : "Handicap", label: x.label, p, fair: 1 / p, best: x.o.best, why: why.join(" "), start: m.start };
}

// Tennis : nombre de sets le plus probable (2 ou 3 sets, 3 à 5 en grand chelem).
import { setsLine } from "./setline.js";
function setsPick(m) {
  const mo = m.model;
  if (mo?.kind !== "sets") return null;
  const items = mo.markets.find((g) => g.group === "Nombre de sets")?.items || [];
  const top = [...items].sort((a, b) => b.p - a.p)[0];
  if (!top || top.p < (mo.n === 5 ? 0.38 : 0.5)) return null;
  const tight = mo.pDecider >= 0.4;
  const why = `${tight ? "Les deux joueurs sont proches" : "Un joueur est nettement au-dessus"} : ${m.home} gagne chaque set avec ${P0(mo.q)} de chances. Le plus probable : un match en ${top.label} (${P0(top.p)}).`;
  const sl = setsLine(mo)?.[0];
  if (sl && sl.p >= 0.5) return { title: "Nombre de sets", label: sl.label, p: sl.p, fair: 1 / sl.p, best: null, why: `${why.replace(/Le plus probable : un match en [^(]*\(/, `Le plus probable : ${sl.hint} (`)}`, start: m.start };
  return null;
}

export function varietyPicks(m) {
  if (m.sport === "football") { const g = goalLinePick(m); return g ? [{ title: "Nombre de buts", ...g }] : []; }
  const l = linePick(m), s = setsPick(m);
  const tight = m.model?.kind === "sets" && m.model.pDecider >= 0.4;
  return (tight ? [s, l] : [l, s]).filter(Boolean);
}
export const primaryPick = (m) => varietyPicks(m)[0] || null;
