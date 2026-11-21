import Link from "next/link";
import { frComp } from "@/lib/frcomp";
import { notFound } from "next/navigation";
import { getSummary, analyseSummary } from "@/lib/espnsum";
import { fmtDateTime } from "@/lib/format";
import { fr } from "@/lib/fr";
import { FormDots } from "@/components/FormDots";
import { Badge } from "@/components/Team";
import { ProbBar } from "@/components/Ui";
import AutoRefresh from "@/components/AutoRefresh";
import { matchCenter } from "@/lib/matchcenter";
import { TabNav, EdgePicks, EdgeMarkets, TeamCompare, Streaks, LastGames, LeagueTable } from "@/components/MatchCenter";

const ETABS = [["resume", "Résumé"], ["pronos", "Pronos"], ["stats", "Stats équipes"], ["matchs", "Derniers matchs"], ["classement", "Classement"], ["compos", "Compositions"], ["cotes", "Cotes"]];

const P = (p) => Math.round(p * 100) + " %";
const o2 = (v) => (v ? Number(v).toFixed(2).replace(".", ",") : "—");
const f1 = (x) => Number(x).toFixed(1).replace(".", ",");
const fm = (x) => (x == null ? "–" : String(Math.round(x * 10) / 10).replace(".", ","));
const EV = { goal: "⚽", csc: "⚽", red: "🟥", yellow: "🟨", sub: "🔁" };

export function LiveBlock({ S }) {
  if (S.state === "up" || S.state === "off") return null;
  const live = S.state === "live";
  const evs = S.events;
  return (
    <section className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold tracking-tight">{live ? "En direct" : "Résumé du match"}</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${live ? "bg-bad text-white" : "bg-card2 text-muted"}`}>{live ? S.label : "Terminé"}</span>
      </div>
      <div className="num flex items-center justify-center gap-4 text-center">
        <span className="min-w-0 flex-1 truncate text-right text-sm font-bold">{fr(S.home.name)}</span>
        <span className={`text-3xl font-extrabold ${live ? "text-bad" : ""}`}>{S.home.score ?? "–"} - {S.away.score ?? "–"}</span>
        <span className="min-w-0 flex-1 truncate text-left text-sm font-bold">{fr(S.away.name)}</span>
      </div>
      {evs.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {evs.map((e, i) => (
            <li key={i} className={`flex items-center gap-2 ${e.side === "h" ? "" : "flex-row-reverse text-right"}`}>
              <span className="num w-10 shrink-0 text-xs text-muted">{e.min}</span>
              <span aria-hidden>{EV[e.kind]}</span>
              <span className="min-w-0 truncate">
                {e.kind === "sub" ? <><b>{e.a}</b> <span className="text-muted">remplace {e.b}</span></> : <><b>{e.a || e.text}</b>{e.kind === "csc" ? " (csc)" : e.pen ? " (pen.)" : ""}</>}
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="text-xs text-muted">Aucun événement renseigné pour le moment par la source.</p>}
      {S.stats.length > 0 && (
        <div className="space-y-2 border-t border-line pt-3">
          {S.stats.map((s) => {
            const t = (s.h ?? 0) + (s.a ?? 0), ph = t > 0 ? ((s.h ?? 0) / t) * 100 : 50;
            return (
              <div key={s.label}>
                <div className="num flex justify-between text-xs"><b>{fm(s.h)}{s.suf}</b><span className="text-muted">{s.label}</span><b>{fm(s.a)}{s.suf}</b></div>
                <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-card2"><span className="bg-brand" style={{ width: ph + "%" }} /><span className="bg-slate-300" style={{ width: 100 - ph + "%" }} /></div>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-[11px] text-muted">Source : ESPN. {live ? "Actualisation automatique toutes les 20 secondes." : ""}</p>
    </section>
  );
}

export function AnalysisBlock({ S, A }) {
  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight">Analyse du match</h2>
        <p className="mt-0.5 text-xs text-muted">Fiabilité des données : {A.level} ({A.n} source{A.n > 1 ? "s" : ""} sur 4 : forme, classement, cotes, face-à-face).</p>
      </div>
      {A.probs ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {[[fr(S.home.name), A.probs.h], ["Match nul", A.probs.d], [fr(S.away.name), A.probs.a]].filter(([, p]) => p > 0).map(([n, p]) => (
              <div key={n} className="rounded-2xl bg-card2 p-3">
                <div className="flex items-baseline justify-between gap-2"><span className="truncate text-sm font-bold">{n}</span><span className="num text-lg font-extrabold">{P(p)}</span></div>
                <div className="mt-2"><ProbBar p={p} /></div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted">Source des probabilités : {A.source}.</p>
          {A.pick && (
            <div className="rounded-2xl border border-brand/30 bg-brand/5 p-3 text-sm">
              <b className="text-brand">Tendance :</b> {A.pick.text}.{A.pick.alt ? " " + A.pick.alt + "." : ""}
              <span className="block pt-1 text-xs text-muted">Indication statistique, pas une garantie : aucune cote française n'est comparée ici.</span>
            </div>
          )}
        </>
      ) : <p className="rounded-2xl bg-card2 p-3 text-sm text-muted">Données insuffisantes pour estimer les probabilités de ce match (ni cotes, ni forme et classement des deux équipes).</p>}
      {A.goals && (
        <div className="grid gap-2 text-center text-sm sm:grid-cols-4">
          <div className="rounded-2xl bg-card2 p-3"><div className="num text-lg font-extrabold">{A.goals.score.x} – {A.goals.score.y}</div><div className="text-[11px] text-muted">score le plus probable ({P(A.goals.score.p)})</div></div>
          <div className="rounded-2xl bg-card2 p-3"><div className="num text-lg font-extrabold">≈ {f1(A.goals.lh + A.goals.la)}</div><div className="text-[11px] text-muted">buts attendus</div></div>
          <div className="rounded-2xl bg-card2 p-3"><div className="num text-lg font-extrabold">{P(A.goals.over25)}</div><div className="text-[11px] text-muted">plus de 2,5 buts</div></div>
          <div className="rounded-2xl bg-card2 p-3"><div className="num text-lg font-extrabold">{P(A.goals.btts)}</div><div className="text-[11px] text-muted">les deux équipes marquent</div></div>
        </div>
      )}
      {A.reasons.length > 0 && (
        <div>
          <h3 className="text-sm font-extrabold">Pourquoi cette tendance</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">{A.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}
      {A.risks.length > 0 && (
        <div>
          <h3 className="text-sm font-extrabold">Points de vigilance</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted">{A.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}
    </section>
  );
}

export function FormH2H({ S }) {
  const sides = [["h", S.home], ["a", S.away]];
  const has = S.form.h || S.form.a || S.stand.h || S.stand.a || S.h2h;
  if (!has) return null;
  return (
    <section className="card space-y-4 p-5">
      <h2 className="text-lg font-extrabold tracking-tight">Forme, classement et face-à-face</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {sides.map(([k, t]) => {
          const f = S.form[k], s = S.stand[k];
          return (
            <div key={k} className="rounded-2xl bg-card2 p-4">
              <div className="flex items-baseline justify-between gap-2"><span className="font-bold">{fr(t.name)}</span>{s?.rank && <span className="text-xs text-muted">{s.rank}e / {s.of}</span>}</div>
              {f ? (
                <>
                  <div className="mt-2"><FormDots letters={f.letters} /></div>
                  <ul className="num mt-3 space-y-0.5 text-xs text-muted">
                    {f.rows.slice().reverse().map((r, i) => <li key={i} className="flex justify-between gap-2"><span className="truncate">{r.home ? "dom." : "ext."} {fr(r.opp)}</span><b className="text-ink">{r.gf}-{r.ga}</b></li>)}
                  </ul>
                </>
              ) : <p className="mt-2 text-xs text-muted">Forme non disponible.</p>}
              {s && <div className="num mt-3 border-t border-line pt-2 text-xs text-muted">Saison : {s.pts} pts en {s.p} matchs · {s.w}V {s.d}N {s.l}D · diff. {s.gd > 0 ? "+" : ""}{s.gd}</div>}
            </div>
          );
        })}
      </div>
      {S.h2h && (
        <div>
          <h3 className="text-sm font-extrabold">Derniers face-à-face</h3>
          <ul className="num mt-2 space-y-1 text-sm">
            {S.h2h.rows.map((r, i) => <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card2 px-3 py-1.5"><span className="text-xs text-muted">{r.date ? new Date(r.date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Paris" }) : ""}</span><span className="min-w-0 truncate">{fr(r.home)} <b>{r.hs} - {r.as}</b> {fr(r.away)}</span></li>)}
          </ul>
        </div>
      )}
      <p className="text-[11px] text-muted">Source : ESPN. 5 derniers matchs, du plus récent au plus ancien dans la liste ; pastilles du plus ancien au plus récent.</p>
    </section>
  );
}

export function OddsBlock({ S }) {
  const o = S.odds;
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-lg font-extrabold tracking-tight">Comparateur de cotes</h2>
      {o && (o.h || o.ou) ? (
        <>
          {o.h && o.a && (
            <div className={`grid gap-2 ${o.d ? "grid-cols-3" : "grid-cols-2"}`}>
              {[["1", fr(S.home.name), o.h], ...(o.d ? [["N", "Match nul", o.d]] : []), ["2", fr(S.away.name), o.a]].map(([k, n, v]) => (
                <div key={k} className="rounded-xl bg-card2 px-2 py-2 text-center"><div className="text-[11px] font-bold text-muted">{k}</div><div className="num text-lg font-extrabold">{o2(v)}</div><div className="truncate text-[10px] text-muted">{n}</div></div>
              ))}
            </div>
          )}
          {o.ou && <p className="num text-xs text-muted">Plus / moins de {f1(o.ou.line)} buts : plus {o2(o.ou.over)} · moins {o2(o.ou.under)}</p>}
          <p className="text-[11px] text-muted">Bookmaker : {o.provider} (cotes américaines converties en décimal, via ESPN). Les opérateurs français (Betclic, Winamax, Unibet, PMU) n'ont pas de cote enregistrée pour ce match dans nos sources : rien n'est inventé.</p>
        </>
      ) : <p className="text-sm text-muted">Aucune cote disponible pour ce match dans nos sources (ni opérateurs français, ni bookmaker américain).</p>}
    </section>
  );
}

export function Lineups({ S }) {
  const L = S.lineups;
  if (!L) return <p className="card p-4 text-xs text-muted">Compositions non publiées (elles arrivent environ 1 h avant le coup d'envoi) ou non fournies par la source.</p>;
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-lg font-extrabold tracking-tight">Compositions</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {[[S.home, L.h], [S.away, L.a]].map(([t, s]) => (
          <div key={t.id} className="rounded-2xl bg-card2 p-4 text-sm">
            <div className="flex items-baseline justify-between"><b>{fr(t.name)}</b><span className="num text-xs text-muted">{s?.formation}</span></div>
            {s?.probable && <p className="mt-1 text-[11px] font-bold text-brand">Onze probable · titulaires du dernier match{s.from?.opp ? " (contre " + s.from.opp + ")" : ""}</p>}
            {s ? (
              <>
                <ul className="mt-2 space-y-0.5">{s.starters.map((p, i) => <li key={i} className="flex gap-2"><span className="num w-6 text-right text-xs text-muted">{p.j}</span><span className="min-w-0 flex-1 truncate">{p.n}</span><span className="text-[10px] text-muted">{p.pos}</span></li>)}</ul>
                {s.subs.length > 0 && <p className="mt-2 border-t border-line pt-2 text-xs text-muted">Remplaçants : {s.subs.map((p) => p.n).join(", ")}</p>}
              </>
            ) : <p className="mt-2 text-xs text-muted">Non publiée.</p>}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted">Source : ESPN. Un « onze probable » reprend les titulaires du dernier match de l'équipe : ce n'est pas la composition officielle, qui est publiée environ 1 h avant le coup d'envoi.</p>
    </section>
  );
}

// Page d'un match sans cotes de bookmaker (identifiant ESPN « se… ») : tout est dans la même page.
export default async function EspnMatch({ sid, tab: tab0 }) {
  const S = await getSummary(sid);
  if (!S) notFound();
  const tab = ETABS.some(([k]) => k === tab0) ? tab0 : "resume";
  const C = await matchCenter(S).catch(() => null);
  const A = analyseSummary(S, C?.E);
  const live = S.state === "live";
  return (
    <div className="space-y-6">
      {live && <AutoRefresh seconds={20} stamp={new Date().toISOString()} />}
      <div className="flex items-center justify-between gap-3"><Link href="/matchs" className="text-sm font-bold text-brand hover:underline">← Tous les matchs</Link><Link href="/live" className="text-sm font-bold text-muted hover:text-ink">Direct</Link></div>
      <section className="hero p-6 sm:p-8">
        <div className="text-xs font-semibold text-muted">⚽ {frComp(S.league)}{S.round ? " · " + frComp(S.round) : ""} · {S.start ? fmtDateTime(S.start) : ""}</div>
        <h1 className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          <Badge src={S.home.crest} name={S.home.name} size={40} /><span>{fr(S.home.name)}</span>
          <span className={`num ${live ? "text-bad" : "text-muted"}`}>{S.state === "up" || S.state === "off" ? "–" : `${S.home.score ?? 0} - ${S.away.score ?? 0}`}</span>
          <Badge src={S.away.crest} name={S.away.name} size={40} /><span>{fr(S.away.name)}</span>
        </h1>
        {S.state !== "up" && <p className={`mt-2 text-sm font-bold ${live ? "text-bad" : "text-muted"}`}>{S.label}</p>}
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-line"><div className="text-[11px] font-bold text-muted">Où se joue le match</div><div className="font-semibold">{S.venue ? "📍 " + S.venue : "Stade non communiqué par la source"}</div></div>
          <div className="rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-line"><div className="text-[11px] font-bold text-muted">Diffusion</div><div className="font-semibold">{S.tv.length ? "📺 " + S.tv.join(", ") : "Chaîne non communiquée par la source"}</div></div>
        </div>
      </section>
      <TabNav base={`/match/${encodeURIComponent(sid)}`} tabs={ETABS} tab={tab} />
      {tab === "resume" && (
        <>
          <LiveBlock S={S} />
          <EdgePicks E={C?.E} title="Les meilleurs pronos du match" limit={6} />
          <AnalysisBlock S={S} A={A} />
        </>
      )}
      {tab === "pronos" && (C?.E ? <><EdgePicks E={C.E} /><EdgeMarkets E={C.E} /></> : <AnalysisBlock S={S} A={A} />)}
      {tab === "stats" && <><TeamCompare S={S} C={C} /><Streaks S={S} C={C} /></>}
      {tab === "matchs" && <><LastGames S={S} C={C} /><FormH2H S={S} /></>}
      {tab === "classement" && <LeagueTable S={S} />}
      {tab === "compos" && <Lineups S={S} />}
      {tab === "cotes" && <OddsBlock S={S} />}
    </div>
  );
}
