import { candidates, unitOf } from "@/lib/analysis";
import { odd, pct, pt } from "@/lib/format";
import { varietyPicks } from "@/lib/variety";

const fr = (x, d = 1) => Number(x).toFixed(d).replace(".", ",");

export function Tip({ title, pick, p, best, note, tone = "text-good" }) {
  return (
    <div className="rounded-2xl bg-card2 p-4">
      <div className="text-xs font-bold text-muted">{title}</div>
      <div className="mt-1 text-base font-extrabold leading-snug">{pick}</div>
      <div className="num mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {p != null && <span>Notre proba <b>{pct(p)}</b></span>}
        {p != null && <span className="text-muted">cote juste {odd(1 / p)}</span>}
        {best && <span>Meilleure cote <b className={tone}>{odd(best.odds)}</b> ({best.book})</span>}
      </div>
      {note && <p className="mt-2 text-xs leading-relaxed text-muted">{note}</p>}
    </div>
  );
}

export function tipsOf(m) {
  const unit = unitOf(m);
  const tips = [];
  const outs = (m.outcomes || []).filter((o) => o.probAdj != null).sort((a, b) => b.probAdj - a.probAdj);
  const top = outs[0];
  if (top) {
    const draw = top.name === "Match nul";
    const pick = draw ? "Match nul" : m.sport === "football" || m.sport === "basketball" || m.sport === "hockey" ? `Victoire : ${top.name}` : `${top.name} vainqueur`;
    const second = outs[1];
    tips.push({ id: "issue", title: "Issue du match", pick, p: top.probAdj, best: top.best, note: second && second.probAdj > 0.2 ? `Deuxième scénario : ${second.name === "Match nul" ? "match nul" : `victoire de ${second.name}`} (${pct(second.probAdj)}). ${outs.length === 3 ? `Pour réduire le risque, « ${top.name === "Match nul" ? "" : top.name + " ou nul"} » couvre ${pct(Math.min(0.97, top.probAdj + (outs.find((o) => o.name === "Match nul")?.probAdj || 0)))} des cas.` : ""}` : null });
  }
  const tot = [...(m.totals || [])].filter((t) => t.over.probAdj != null && t.under.probAdj != null).sort((a, b) => Math.abs(a.over.probAdj - 0.5) - Math.abs(b.over.probAdj - 0.5))[0];
  if (tot) {
    const over = tot.over.probAdj >= tot.under.probAdj;
    const s = over ? tot.over : tot.under;
    tips.push({ id: "total", title: `Nombre de ${unit}`, pick: `${over ? "Plus" : "Moins"} de ${pt(tot.point)} ${unit}`, p: s.probAdj, best: s.best, note: m.form?.tempo ? `Ces équipes jouent des matchs à environ ${pt(m.form.tempo.toFixed(1))} ${unit} en moyenne.` : null });
  }
  const ex = m.extras || {};
  if (ex.btts) {
    const b = [...ex.btts].filter((o) => o.probAdj != null || o.prob != null).sort((a, b) => (b.probAdj ?? b.prob) - (a.probAdj ?? a.prob))[0];
    if (b) tips.push({ id: "btts", title: "Les deux équipes marquent", pick: b.name === "Oui" ? "Oui, les deux équipes marquent" : "Non, une équipe ne marque pas", p: b.probAdj ?? b.prob, best: b.best });
  } else if (m.model?.kind === "goals") {
    const yes = m.model.pBtts;
    tips.push({ id: "btts", title: "Les deux équipes marquent (estimation)", pick: yes >= 0.5 ? "Oui, les deux équipes marquent" : "Non, une équipe ne marque pas", p: yes >= 0.5 ? yes : 1 - yes, best: null, note: `Estimation de notre modèle : ${pct(m.model.pBtts)} de chances que les deux équipes marquent.` });
    const lg = m.model.markets.find((g) => g.group === "Lignes de buts");
    if (lg && !(m.totals || []).length) { const s = lg.items[1]; tips.push({ id: "goalline", title: "Nombre de buts (estimation)", pick: s.p >= 0.5 ? "Plus de 2,5 buts" : "Moins de 2,5 buts", p: s.p >= 0.5 ? s.p : 1 - s.p, best: null, note: `Environ ${fr(m.model.mu, 1)} buts attendus.` }); }
  }
  const sInt = (ex.scorers || []).filter((x) => x.best).sort((a, b) => a.best.odds - b.best.odds);
  if (sInt.length && !ex.scorersOnlyOthers) {
    const s = sInt[0];
    tips.push({ id: "scorer", title: ex.scorerKind === "try" ? "Marqueur d'essai" : "Buteur", pick: s.name, p: null, best: s.best, tone: "text-amber-600", note: "Joueur le plus probable d'après les cotes des bookmakers français." + (sInt.length > 1 ? " Autres options : " + sInt.slice(1, 3).map((x) => x.name + " " + odd(x.best.odds)).join(", ") + "." : "") });
  } else if (false) {
    tips.push({ id: "scorer", title: m.sport === "rugby" ? "Marqueur d'essai" : "Buteur", pick: "Pas de cote disponible", p: null, best: null, note: "Les cotes de buteurs ne sont chargées que pour quelques matchs du jour, selon nos crédits : nous ne proposons pas de buteur sans cote réelle." });
  }
  if (m.model?.kind === "sets") {
    const g = (n) => m.model.markets.find((x) => x.group === n)?.items || [];
    const ns = [...g("Nombre de sets")].sort((a, b) => b.p - a.p)[0];
    const sc = g("Score en sets")[0];
    if (ns) tips.push({ id: "sets", title: "Nombre de sets (estimation)", pick: ns.label, p: ns.p, best: null, note: `Le set décisif arrive dans ${pct(m.model.pDecider)} des cas.` });
    if (sc) tips.push({ id: "setscore", title: "Score en sets (estimation)", pick: sc.label, p: sc.p, best: null, note: "Score le plus probable selon notre modèle." });
    const cb = g("Retournement après un 1er set perdu");
    if (cb.length) { const x = cb[0].p >= cb[1].p ? cb[0] : cb[1]; tips.push({ id: "comeback", title: "Retournement possible", pick: `${x.label} gagne après avoir perdu le 1er set`, p: x.p, best: null, note: "Probabilité estimée à partir des cotes du vainqueur." }); }
  }
  varietyPicks(m).forEach((gl, k) => {
    const i = tips.findIndex((t) => t.id === "total");
    if (i >= 0 && tips[i].pick === gl.label) tips.splice(i, 1);
    tips.splice(Math.min(1 + k, tips.length), 0, { id: "var" + k, title: gl.title, pick: gl.label, p: gl.p, best: gl.best, note: gl.why });
  });
  return tips;
}

export function story(m) {
  const P = [];
  const outs = (m.outcomes || []).filter((o) => o.probAdj != null).sort((a, b) => b.probAdj - a.probAdj);
  const [a, b, c] = outs;
  if (a) {
    const gap = b ? a.probAdj - b.probAdj : a.probAdj;
    const tone = a.name === "Match nul" ? "Le marché voit surtout un match très fermé." : gap > 0.3 ? `${a.name} part nettement favori` : gap > 0.12 ? `${a.name} a l'avantage, sans que la victoire soit acquise` : "Le match s'annonce très serré";
    P.push(`${tone}${a.name === "Match nul" ? "" : ` : ${pct(a.probAdj)} de chances de l'emporter selon le consensus de ${m.nBooks} bookmakers${m.form ? " et la forme récente" : ""}${b ? `, contre ${pct(b.probAdj)} pour ${b.name === "Match nul" ? "le match nul" : b.name}${c ? ` et ${pct(c.probAdj)} pour ${c.name === "Match nul" ? "le match nul" : c.name}` : ""}` : ""}`}.`);
  }
  const mo = m.model;
  if (mo?.kind === "goals") {
    const top = mo.scores.slice(0, 3).map((s) => `${s.h}-${s.a} (${pct(s.p)})`).join(", ");
    P.push(`Côté buts, notre modèle attend ${fr(mo.lh, 2)} but pour ${m.home} et ${fr(mo.la, 2)} pour ${m.away}, soit environ ${fr(mo.mu, 1)} buts au total. Les scores les plus probables sont ${top}. Les deux équipes marquent dans ${pct(mo.pBtts)} des cas et le match nul pèse ${pct(mo.pDraw)}.`);
    const cs = mo.markets?.find((g) => g.group.startsWith("Équipe qui garde"));
    if (cs) { const best = [...cs.items].sort((x, y) => y.p - x.p)[0]; P.push(`${best.label} garde sa cage inviolée dans ${pct(best.p)} des cas : c'est la défense la plus fiable de l'affiche.`); }
  } else if (mo?.kind === "points") {
    P.push(`Au score, nous attendons environ ${Math.round(mo.h)} - ${Math.round(mo.a)} (${m.home} - ${m.away}), pour un total proche de ${pt(mo.total)} points et un écart d'environ ${pt(Math.abs(mo.margin))} points.`);
  } else if (mo?.kind === "sets") {
    P.push(`Format en ${mo.n} sets gagnants : ${m.home} remporte un set donné dans ${pct(mo.q)} des cas${mo.pDecider != null ? `, et la probabilité d'aller jusqu'au set décisif est de ${pct(mo.pDecider)}` : ""}.`);
  }
  const tot = [...(m.totals || [])].filter((t) => t.over.probAdj != null).sort((x, y) => Math.abs(x.over.probAdj - 0.5) - Math.abs(y.over.probAdj - 0.5))[0];
  if (tot) {
    const over = tot.over.probAdj >= 0.5;
    P.push(`Sur la ligne de ${pt(tot.point)} ${unitOf(m)}, le marché penche pour ${over ? "le plus" : "le moins"} (${pct(over ? tot.over.probAdj : tot.under.probAdj)}) : ${over ? "un match plutôt ouvert, avec de quoi faire tomber la ligne" : "un match plutôt fermé, où la ligne a de bonnes chances de tenir"}.`);
  }
  if (m.form) {
    const f = m.form;
    P.push(`Forme récente : ${m.home} compte ${f.home.pts} point${f.home.pts > 1 ? "s" : ""} sur ${f.home.n * 3} (${f.home.seq.join("-")}), ${m.away} ${f.away.pts} sur ${f.away.n * 3} (${f.away.seq.join("-")}).`);
  }
  P.push("Rappel : une probabilité élevée ne garantit rien sur un match isolé, et les cotes peuvent avoir bougé depuis notre relevé. Vérifiez toujours chez l'opérateur avant de parier.");
  return P;
}

export function MatchTips({ m }) {
  const tips = tipsOf(m);
  const paras = story(m);
  return (
    <>
      {tips.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-extrabold tracking-tight">Nos pronos sur ce match</h2>
          <div className="grid gap-3 sm:grid-cols-2">{tips.map((t) => <Tip key={t.id} {...t} />)}</div>
        </section>
      )}
      <section className="card space-y-3 p-5 sm:p-6">
        <h2 className="text-xl font-extrabold tracking-tight">Ce qui est probable dans ce match</h2>
        {paras.map((t, i) => <p key={i} className="text-sm leading-relaxed">{t}</p>)}
      </section>
    </>
  );
}
