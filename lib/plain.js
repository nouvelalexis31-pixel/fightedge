import { pt, fmtDateTime } from "./format.js";
import { primaryPick } from "./variety.js";

const fr = (x, d = 1) => Number(x).toFixed(d).replace(".", ",");
const P0 = (p) => `${Math.round(p * 100)} %`;
const s = (n) => (n > 1 ? "s" : "");

function formOf(m, side) {
  const f = m.form?.[side];
  if (!f || !f.n) return null;
  const v = f.seq.filter((x) => x === "V").length, d = f.seq.filter((x) => x === "D").length;
  return { v, d, n: f.n, ratio: f.pts / (3 * f.n) };
}

// Textes d'analyse en phrases courtes et simples.
export function narrativePlain(m, a, h2hS) {
  const out = [];
  const outs = (m.outcomes || []).filter((o) => o.probAdj != null).sort((x, y) => y.probAdj - x.probAdj);
  const fav = outs.find((o) => o.name !== "Match nul") || outs[0];
  const second = outs.filter((o) => o !== fav)[0];
  const gap = fav && second ? fav.probAdj - second.probAdj : 0;
  const mo = m.model;
  const kind = mo?.kind;
  const date = fmtDateTime(m.start);
  let intro = `${m.home} affronte ${m.away} le ${date} en ${m.league}.`;
  if (fav && outs.length) {
    intro += outs[0].name === "Match nul"
      ? ` Match très serré : le nul est l'issue la plus probable (${P0(outs[0].probAdj)}).`
      : gap > 0.3 ? ` ${fav.name} est nettement favori : il peut gagner (${P0(fav.probAdj)} de chances).`
      : gap > 0.12 ? ` ${fav.name} est favori (${P0(fav.probAdj)} de chances), mais rien n'est joué.`
      : ` Match très serré : ${P0(fav.probAdj)} de chances pour ${fav.name}, ${P0(second.probAdj)} pour ${second.name === "Match nul" ? "le nul" : second.name}.`;
  }
  if (a?.bets?.[0]) intro += ` Notre choix : ${a.bets[0].label}.`;
  out.push({ h: "Le match", lead: "🔊", text: intro });

  const fh = formOf(m, "home"), fa = formOf(m, "away");
  if (fh && fa) {
    const say = (T, f) => f.ratio >= 0.67 ? `${T} est en forme (${f.v} victoire${s(f.v)} sur ses ${f.n} derniers matchs) : il peut gagner.`
      : f.ratio <= 0.34 ? `${T} traverse une période difficile (${f.v} victoire${s(f.v)} sur ${f.n}) : il peut perdre des points.`
      : `${T} est irrégulier (${f.v} victoire${s(f.v)} sur ${f.n}) : tout peut arriver.`;
    let t = `${say(m.home, fh)} ${say(m.away, fa)}`;
    if (Math.abs(fh.ratio - fa.ratio) >= 0.2) t += ` Avantage de forme pour ${fh.ratio > fa.ratio ? m.home : m.away}.`;
    out.push({ h: "La forme du moment", lead: "📈", text: t });
  }

  if (kind === "goals") {
    const sc = mo.scores[0];
    const open = mo.mu > 2.8 ? "Match qui peut être ouvert : plus de 2,5 buts est possible." : mo.mu < 2.3 ? "Match qui peut être fermé : peu de buts attendus." : "Un nombre de buts moyen est attendu.";
    out.push({ h: "Les buts", lead: "📊", text: `On attend environ ${fr(mo.mu, 1)} buts. ${open} Score le plus probable : ${sc.h}-${sc.a}. Les deux équipes marquent : ${mo.pBtts >= 0.5 ? "plutôt oui" : "plutôt non"} (${P0(mo.pBtts)}).` });
  } else if (kind === "sets") {
    const favN = fav ? fav.name : m.home;
    const other = favN === m.home ? m.away : m.home;
    const dec = mo.pDecider >= 0.5 ? `Le match peut aller au set décisif (${P0(mo.pDecider)}).` : `Le match devrait plutôt se jouer sans set décisif (${P0(1 - mo.pDecider)}).`;
    const cb = mo.hAfterLoss != null ? ` Après un 1er set perdu, ${m.home} s'impose quand même dans ${P0(mo.hAfterLoss)} des cas, ${m.away} dans ${P0(mo.aAfterLoss)}.` : "";
    out.push({ h: "Le match set par set", lead: "🎾", text: `${favN} est favori, donc il peut gagner, mais ${other} garde ses chances. ${m.home} gagne un set avec ${P0(mo.q)} de chances. ${dec}${cb}` });
  } else if (kind === "points") {
    out.push({ h: "Le score attendu", lead: "📊", text: `Score probable : ${m.home} ${Math.round(mo.h)} – ${Math.round(mo.a)} ${m.away}. Total proche de ${pt(mo.total)} points, écart d'environ ${pt(Math.abs(mo.margin))} points.` });
  }
  { const g = primaryPick(m); if (g) out.push({ h: "Notre lecture du match", lead: "🎯", text: g.why + " Pari retenu : " + g.label.toLowerCase() + " (" + P0(g.p) + ")." }); }
  if (h2hS) {
    out.push({ h: "Les confrontations directes", lead: "🤝", text: `Sur les ${h2hS.n} derniers duels : ${h2hS.w} victoire${s(h2hS.w)} pour ${m.home}, ${h2hS.d} nul${s(h2hS.d)}, ${h2hS.l} victoire${s(h2hS.l)} pour ${m.away}. En moyenne ${fr(h2hS.avg)} buts par match.` });
  }
  return out;
}
