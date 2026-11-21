import { odd, pct, pt, fmtDateTime } from "@/lib/format";
import { tipsOf, Tip } from "@/components/MatchTips";
import { FormDots } from "@/components/FormDots";
import { primaryPick } from "@/lib/variety";
import { narrativePlain } from "@/lib/plain";

const fr = (x, d = 1) => Number(x).toFixed(d).replace(".", ",");
const P0 = (p) => `${Math.round(p * 100)} %`;
const dshort = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

function trendRows(r) {
  const n = r.length;
  if (!n) return null;
  const c = (f) => r.filter(f).length;
  return { n, rows: [
    ["Victoires", c((x) => x.w === "V")],
    ["Plus de 2,5 buts dans le match", c((x) => x.gf + x.ga >= 3)],
    ["Les deux équipes ont marqué", c((x) => x.gf > 0 && x.ga > 0)],
    ["A marqué au moins un but", c((x) => x.gf > 0)],
    ["Cage inviolée", c((x) => x.ga === 0)],
    ["Moins de 1,5 but dans le match", c((x) => x.gf + x.ga <= 1)],
  ] };
}

function h2hStats(m, h2h) {
  const idH = m.form?.idH;
  if (!h2h?.length || !idH) return null;
  let w = 0, d = 0, l = 0, tot = 0, bt = 0, gh = 0, ga = 0;
  for (const x of h2h) {
    const sh = x.hid === idH ? x.h : x.a, sa = x.hid === idH ? x.a : x.h;
    if (sh > sa) w++; else if (sh < sa) l++; else d++;
    tot += sh + sa; gh += sh; ga += sa; if (sh > 0 && sa > 0) bt++;
  }
  const n = h2h.length;
  const last = h2h[0];
  return { n, w, d, l, avg: tot / n, bt: bt / n, gh: gh / n, ga: ga / n, last };
}

function Bar({ w, d, l, home, away }) {
  const t = w + d + l || 1;
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full">
        <div className="bg-good" style={{ width: `${(w / t) * 100}%` }} />
        <div className="bg-slate-400" style={{ width: `${(d / t) * 100}%` }} />
        <div className="bg-sky-600" style={{ width: `${(l / t) * 100}%` }} />
      </div>
      <div className="num mt-2 grid grid-cols-3 text-sm">
        <div><div className="text-2xl font-extrabold text-good">{Math.round((w / t) * 100)} %</div><div className="text-xs text-muted">{w} victoire{w > 1 ? "s" : ""} {home}</div></div>
        <div className="text-center"><div className="text-2xl font-extrabold text-slate-500">{Math.round((d / t) * 100)} %</div><div className="text-xs text-muted">{d} match{d > 1 ? "s" : ""} nul{d > 1 ? "s" : ""}</div></div>
        <div className="text-right"><div className="text-2xl font-extrabold text-sky-700">{Math.round((l / t) * 100)} %</div><div className="text-xs text-muted">{l} victoire{l > 1 ? "s" : ""} {away}</div></div>
      </div>
    </div>
  );
}

function Stat({ l, v }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl bg-card2 px-3 py-2.5 text-sm"><span>{l}</span><span className="num rounded-md bg-white px-2 py-0.5 font-bold">{v}</span></div>;
}

function narrative(m, a, h2hS) {
  const out = [];
  const outs = (m.outcomes || []).filter((o) => o.probAdj != null).sort((x, y) => y.probAdj - x.probAdj);
  const fav = outs.find((o) => o.name !== "Match nul") || outs[0];
  const second = outs.filter((o) => o !== fav)[0];
  const gap = fav && second ? fav.probAdj - second.probAdj : 0;
  const mo = m.model;
  const kind = mo?.kind;
  const date = fmtDateTime(m.start);
  // Introduction
  let intro = `${m.home} et ${m.away} se retrouvent ${date.includes("aujourd") ? "" : "le " }${date} en ${m.league}.`;
  if (fav && outs.length) {
    intro += outs[0].name === "Match nul"
      ? ` Les bookmakers voient un match très fermé : le nul est l'issue la plus probable (${P0(outs[0].probAdj)}).`
      : gap > 0.3 ? ` ${fav.name} part nettement favori (${P0(fav.probAdj)} de chances de l'emporter selon le consensus de ${m.nBooks} bookmakers).`
      : gap > 0.12 ? ` ${fav.name} a l'avantage (${P0(fav.probAdj)}), sans que la victoire soit acquise.`
      : ` Le duel s'annonce très serré : ${P0(fav.probAdj)} pour ${fav.name} contre ${P0(second.probAdj)} pour ${second.name === "Match nul" ? "le match nul" : second.name}.`;
  }
  if (a?.bets?.[0]) intro += ` Notre analyse retient : ${a.bets[0].label}.`;
  out.push({ lead: "🔊", text: intro });

  if (kind === "goals") {
    const s = mo.scores[0];
    const tempo = mo.mu < 2.3 ? "fermé" : mo.mu > 3 ? "très ouvert" : mo.mu > 2.7 ? "plutôt ouvert" : "d'intensité moyenne";
    out.push({ h: `Un match ${tempo} en buts`, lead: "📊", text: `Environ ${fr(mo.mu, 1)} buts attendus : ${fr(mo.lh, 2)} pour ${m.home} et ${fr(mo.la, 2)} pour ${m.away}. Le score exact le plus probable est ${s.h}-${s.a} (${P0(s.p)}). Les deux équipes marquent dans ${P0(mo.pBtts)} des cas.` });
  } else if (kind === "sets") {
    out.push({ h: "Un duel à suivre set par set", lead: "🎾", text: `${m.home} remporte un set donné dans ${P0(mo.q)} des cas. Le set décisif est atteint dans ${P0(mo.pDecider)} des matchs${mo.hAfterLoss != null ? `, et ${m.home} renverse un premier set perdu dans ${P0(mo.hAfterLoss)} des cas contre ${P0(mo.aAfterLoss)} pour ${m.away}` : ""}.` });
  } else if (kind === "points") {
    out.push({ h: "Le score attendu", lead: "📊", text: `Score probable : ${m.home} ${Math.round(mo.h)} – ${Math.round(mo.a)} ${m.away}, pour un total proche de ${pt(mo.total)} points et un écart d'environ ${pt(Math.abs(mo.margin))} points.` });
  }
  if (m.form) {
    const f = m.form;
    out.push({ h: "La forme du moment", lead: "📈", text: `${m.home} : ${f.home.seq.join("-")} (${f.home.pts} point${f.home.pts > 1 ? "s" : ""} sur ${f.home.n * 3}, ${fr(f.home.gf / f.home.n)} but marqué et ${fr(f.home.ga / f.home.n)} encaissé par match). ${m.away} : ${f.away.seq.join("-")} (${f.away.pts} sur ${f.away.n * 3}, ${fr(f.away.gf / f.away.n)} marqué et ${fr(f.away.ga / f.away.n)} encaissé).` });
  }
  { const g = primaryPick(m); if (g) out.push({ h: "Notre lecture du match", lead: "🎯", text: g.why + " Pari retenu : " + g.label.toLowerCase() + " (" + P0(g.p) + ", cote juste " + odd(1 / g.p) + ")." }); }
  if (h2hS) {
    const l = h2hS.last;
    out.push({ h: "Les confrontations directes", lead: "🤝", text: `Sur ${h2hS.n} confrontation${h2hS.n > 1 ? "s" : ""} récente${h2hS.n > 1 ? "s" : ""} : ${h2hS.w} victoire${h2hS.w > 1 ? "s" : ""} pour ${m.home}, ${h2hS.d} nul${h2hS.d > 1 ? "s" : ""}, ${h2hS.l} pour ${m.away}, avec ${fr(h2hS.avg)} buts par match en moyenne. La dernière rencontre (${dshort(l.date)}) s'est terminée sur le score de ${l.home} ${l.h}-${l.a} ${l.away}.` });
  }
  return out;
}

export function MatchAnalysis({ m, a, h2h }) {
  const tips = tipsOf(m);
  const mo = m.model;
  const top = a?.bets?.[0];
  const h2hS = h2hStats(m, h2h);
  const paras = narrativePlain(m, a, h2hS);
  const l10H = m.form?.l10H || [];
  const l10A = m.form?.l10A || [];
  const tH = trendRows(l10H), tA = trendRows(l10A);
  const st = m.form && m.form.standH && m.form.standA ? [[m.home, m.form.standH], [m.away, m.form.standA]] : null;
  const nav = [["pronostic", "Pronostic", true], ["tendances", "Tendances", !!(tH || tA)], ["h2h", "Face à face", !!h2hS], ["stats", "Statistiques", !!m.form || !!mo], ["classements", "Classements", !!st], ["cotes", "Cotes", true]].filter((x) => x[2]);
  const exact = mo?.kind === "goals" ? mo.scores[0] : null;
  const gl = primaryPick(m);
  const useGl = !!gl && (!top || top.cand.market === "h2h" || top.outcome.probAdj < gl.p);
  const pickTitle = useGl ? gl.title : top ? (top.cand.market === "h2h" ? null : top.marketLabel) : tips[0]?.title;
  const pickLabel = useGl ? gl.label : top ? top.label : tips[0]?.pick;
  const pickBest = useGl ? gl.best : top ? top.outcome.best : tips[0]?.best;
  const pickP = useGl ? gl.p : top ? top.outcome.probAdj : tips[0]?.p;

  return (
    <div className="space-y-6">
      <nav aria-label="Sections de l'analyse" className="flex gap-2 overflow-x-auto pb-1">
        {nav.map(([id, l]) => <a key={id} href={`#${id}`} className="shrink-0 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold hover:border-brand hover:text-brand">{l}</a>)}
      </nav>

      <section id="pronostic" className="card scroll-mt-28 space-y-5 p-5 sm:p-7">
        <h2 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{m.home} vs {m.away} : pronostic du {dshort(m.start)}</h2>
        <div className="space-y-5">
          {paras.map((p, i) => (
            <div key={i}>
              {p.h && <h3 className="text-xl font-extrabold tracking-tight">{p.h}</h3>}
              <p className="mt-1.5 text-base leading-relaxed"><span aria-hidden>{p.lead} </span>{p.text}</p>
            </div>
          ))}
        </div>
        {exact && <p className="text-base leading-relaxed">Pronostic de score exact : <b>{exact.h}-{exact.a}</b> ({P0(exact.p)}). {pickLabel ? <>Choix de la rédaction : <b>{pickTitle ? pickTitle + " – " : ""}{pickLabel}</b>.</> : null}</p>}

        {pickLabel && (
          <div className="rounded-3xl border-2 border-good/70 bg-good/5 p-6 text-center">
            <div className="text-xs font-bold text-muted">Notre choix</div>
            <div className="mt-1 text-xl font-extrabold sm:text-2xl">{pickTitle ? pickTitle + " : " : ""}{pickLabel}</div>
            {useGl && <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted">{gl.why}</p>}
            <div className="num mt-4 flex flex-wrap items-center justify-center gap-3">
              {!pickBest && <span className="text-sm text-muted">Comparez avec la cote juste ci-dessous : si votre bookmaker paie plus, le pari a de la valeur.</span>}
              {pickBest && <span className="inline-flex overflow-hidden rounded-xl bg-ink text-white"><span className="px-3 py-2 text-sm font-bold">{pickBest.book}</span><span className="bg-good px-3 py-2 text-base font-extrabold">{odd(pickBest.odds)}</span></span>}
              {pickP != null && <span className="text-sm text-muted">Probabilité estimée <b className="text-ink">{P0(pickP)}</b> · cote juste {odd(1 / pickP)}</span>}
            </div>
            <p className="mt-3 text-xs text-muted">Cote relevée chez le bookmaker français le plus généreux. Vérifiez-la chez l'opérateur avant de parier.</p>
          </div>
        )}
        {tips.length > 0 && (
          <div>
            <h3 className="text-lg font-extrabold">Les autres pronos sur ce match</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">{tips.map((t) => <Tip key={t.id} {...t} />)}</div>
          </div>
        )}
      </section>

      {(tH || tA) && (
        <section id="tendances" className="card scroll-mt-28 space-y-4 p-5 sm:p-7">
          <h2 className="text-xl font-extrabold tracking-tight">Tendances sur les derniers matchs</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {[[m.home, tH, m.form?.home], [m.away, tA, m.form?.away]].map(([name, t, f]) => t && (
              <div key={name} className="rounded-2xl bg-card2 p-4">
                <div className="flex items-center justify-between"><b>{name}</b><span className="text-xs text-muted">{t.n} derniers matchs</span></div>
                {f && <div className="mt-2"><FormDots letters={f.letters} /></div>}
                <ul className="mt-3 space-y-2.5">
                  {t.rows.map(([l, c]) => (
                    <li key={l}>
                      <div className="flex justify-between text-sm"><span>{l}</span><span className="num font-bold">{c} sur {t.n}</span></div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-good" style={{ width: `${(c / t.n) * 100}%` }} /></div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {h2hS && (
        <section id="h2h" className="card scroll-mt-28 space-y-4 p-5 sm:p-7">
          <h2 className="text-xl font-extrabold tracking-tight">Face à face : {m.home} – {m.away}</h2>
          <Bar w={h2hS.w} d={h2hS.d} l={h2hS.l} home={m.home} away={m.away} />
          <div className="grid gap-2 sm:grid-cols-3">
            <Stat l="Nombre de matchs" v={h2hS.n} />
            <Stat l="Moyenne totale de buts" v={fr(h2hS.avg)} />
            <Stat l="Les deux équipes ont marqué" v={P0(h2hS.bt)} />
          </div>
          <div className="num flex items-center justify-between rounded-xl bg-card2 px-3 py-2.5 text-sm"><span className="rounded-md bg-good px-2 py-0.5 font-bold text-white">{fr(h2hS.gh, 2)}</span><span>Moyenne de buts par match</span><span className="rounded-md bg-sky-600 px-2 py-0.5 font-bold text-white">{fr(h2hS.ga, 2)}</span></div>
          <ul className="divide-y divide-line text-sm">
            {h2h.slice(0, 5).map((x, i) => <li key={i} className="flex items-center justify-between gap-3 py-2"><span className="text-xs text-muted">{dshort(x.date)} · {x.comp}</span><span className="num font-semibold">{x.home} {x.h}-{x.a} {x.away}</span></li>)}
          </ul>
        </section>
      )}

      {(m.form || mo) && (
        <section id="stats" className="card scroll-mt-28 space-y-4 p-5 sm:p-7">
          <h2 className="text-xl font-extrabold tracking-tight">Statistiques</h2>
          {m.form && (
            <div className="grid gap-4 sm:grid-cols-2">
              {[[m.home, m.form.home], [m.away, m.form.away]].map(([name, f]) => (
                <div key={name} className="space-y-2 rounded-2xl bg-card2 p-4">
                  <b>{name}</b>
                  <Stat l="Points sur 5 matchs" v={`${f.pts} / ${f.n * 3}`} />
                  <Stat l="Buts marqués par match" v={fr(f.gf / f.n)} />
                  <Stat l="Buts encaissés par match" v={fr(f.ga / f.n)} />
                  <Stat l="Total de buts par match" v={fr(f.gpm)} />
                </div>
              ))}
            </div>
          )}
          {mo?.kind === "goals" && (
            <div className="grid gap-2 sm:grid-cols-3">
              {mo.scores.slice(0, 6).map((s) => <Stat key={`${s.h}${s.a}`} l={`Score ${s.h}-${s.a}`} v={P0(s.p)} />)}
            </div>
          )}
          {mo?.markets && mo.kind === "goals" && (() => { const lg = mo.markets.find((g) => g.group === "Lignes de buts"); return lg ? <div className="grid gap-2 sm:grid-cols-3">{lg.items.map((i) => <Stat key={i.label} l={i.label} v={P0(i.p)} />)}</div> : null; })()}
        </section>
      )}

      {st && (
        <section id="classements" className="card scroll-mt-28 space-y-3 p-5 sm:p-7">
          <h2 className="text-xl font-extrabold tracking-tight">Classements</h2>
          <div className="overflow-x-auto">
            <table className="num w-full text-sm">
              <thead><tr className="text-left text-xs text-muted"><th className="py-2">Équipe</th><th>Pos.</th><th>Pts</th><th>J</th><th>V</th><th>N</th><th>D</th><th>Buts</th></tr></thead>
              <tbody>{st.map(([n, s]) => <tr key={n} className="border-t border-line"><td className="py-2 font-bold">{n}</td><td>{s.pos}e / {s.of}</td><td>{s.pts}</td><td>{s.p}</td><td>{s.w}</td><td>{s.d}</td><td>{s.l}</td><td>{s.gf}-{s.ga}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
