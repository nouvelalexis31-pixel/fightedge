import { SPORTS } from "@/lib/odds";
import { loadEnriched } from "@/lib/data";
import { dailyPicks, dailyCombos, scorerPicks } from "@/lib/analysis";
import { ScorerPicks } from "@/components/ScorerPicks";
import { GoalPicks } from "@/components/GoalPicks";
import { goalPicks } from "@/lib/goals";
import { ComboCard } from "@/components/ComboCard";
import { PickCard } from "@/components/PickCard";
import { Setup } from "@/components/Setup";
import { KIND } from "@/components/Ui";
import { Scorers } from "@/components/Scorers";
import Link from "next/link";
import { Suspense } from "react";
import EspnPicks from "@/components/EspnPicks";
import SportPicks from "@/components/SportPicks";
import { after } from "next/server";
import { recordPicks } from "@/lib/track";
import { WinnerPicks, winnerPicks } from "@/components/WinnerPicks";
import { tipsOf } from "@/components/MatchTips";
import { goalLinePick } from "@/lib/goalline";
import { primaryPick } from "@/lib/variety";
import { endOfDay, fmtDateTime } from "@/lib/format";
import { Badge } from "@/components/Team";

const Teams = ({ m, icon }) => (
  <div className="mt-1 flex items-center gap-2 text-sm font-extrabold">
    <span className="shrink-0">{icon}</span>
    <Badge src={m.logos?.homeCrest} name={m.home} size={22} /><span className="truncate">{m.home}</span>
    <span className="text-muted">–</span>
    <Badge src={m.logos?.awayCrest} name={m.away} size={22} /><span className="truncate">{m.away}</span>
  </div>
);

export const metadata = { title: "Pronos du jour" };
export const revalidate = 1800;
export const dynamic = "force-dynamic";

export default async function Pronos() {
  const data = await loadEnriched();
  after(async () => { try { if (data.matches?.length) await recordPicks(data.matches); } catch {} });
  if (data.error && data.matches.length === 0) return <Setup msg={data.error} />;
  const picks = dailyPicks(data.matches);
  const scope = picks.scope || "today";
  const combos = dailyCombos(data.matches);
  const sp0 = scorerPicks(data.matches);
  const gp = goalPicks(data.matches);
  const icons = Object.fromEntries(Object.entries(SPORTS).map(([k, v]) => [k, v.icon]));
  const SO = ["football", "tennis", "basketball", "hockey", "americanfootball", "baseball", "rugby", "mma", "boxing"];
  const soi = (s) => { const i = SO.indexOf(s); return i < 0 ? 99 : i; };
  const bySport = (sp) => picks.filter((p) => p.match.sport === sp).sort((x, y) => String(x.match.start).localeCompare(String(y.match.start)));
  const groups = ["value", "mid", "bold"].map((k) => ({ k, items: picks.filter((p) => p.kind === k) })).filter((g) => g.items.length);
  let rank = 0;
  const eod = endOfDay(Date.now());
  const withScorers = data.matches.filter((m) => !m.extras?.scorersOnlyOthers && (m.extras?.scorers || []).some((s) => s.best) && +new Date(m.start) <= eod + 24 * 3600e3).slice(0, 4);
  const tennisSets = data.matches.filter((m) => m.sport === "tennis" && m.model?.kind === "sets" && +new Date(m.start) > Date.now() && +new Date(m.start) <= eod + 24 * 3600e3).sort((a, b) => String(a.start).localeCompare(String(b.start))).slice(0, 10);
  const PC = (p) => Math.round(p * 100) + " %";
  const goalLines = data.matches.filter((m) => m.sport === "football" && +new Date(m.start) > Date.now() && +new Date(m.start) <= eod + 48 * 3600e3).sort((a, b) => String(a.start).localeCompare(String(b.start))).map((m) => ({ m, g: goalLinePick(m) })).filter((x) => x.g?.best).slice(0, 5);
  const varLines = (sp) => data.matches.filter((m) => m.sport === sp && +new Date(m.start) > Date.now() && +new Date(m.start) <= eod + 48 * 3600e3).sort((a, b) => String(a.start).localeCompare(String(b.start))).map((m) => ({ m, g: primaryPick(m) })).filter((x) => x.g?.best).slice(0, 8);
  const winners = winnerPicks(data.matches);
  const sportsPicked = SO.filter((s) => picks.some((p) => p.match.sport === s) || (s === "football" && goalLines.length > 0) || (s !== "football" && varLines(s).length > 0));

  return (
    <div className="space-y-7">
      <section className="hero p-6 sm:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Les pronos du jour</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">Jusqu'à 18 paris à cote d'au moins 1,50, tous jugés probables, avec quelques cotes plus hautes quand le pari reste crédible, sur les matchs les plus intéressants du jour : vainqueur, buts, les deux équipes marquent, nul remboursé, double chance, handicap, jeux ou points. Classés par heure de match, avec beaucoup de cotes autour de 2, des paris autres que la victoire, des combinés et les cotes des buteurs quand elles existent. Cliquez sur un prono pour ouvrir l'analyse complète du match.</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
          {Object.entries(KIND).filter(([k]) => k !== "safe").map(([k, v]) => (
            <span key={k} className={`rounded-full px-3 py-1 ${v.chip}`}>{v.label} : {k === "value" ? "cote au-dessus de la cote juste" : k === "mid" ? "cote entre 1,50 et 2,50" : k === "bold" ? "cote supérieure à 2,50, mais jugé probable (33 % ou plus)" : "issue très probable, petite cote"}</span>
          ))}
        </div>
        {scope !== "today" && picks.length > 0 && <p className="mt-4 rounded-xl border border-brand/20 bg-white/70 px-3 py-2 text-xs text-brand">Pas assez de matchs à parier aujourd'hui : la sélection est étendue {scope === "tomorrow" ? "à demain" : "aux prochains jours"}.</p>}
      </section>

      <WinnerPicks picks={winners} />
      {picks.length === 0 ? (
        <p className="card p-5 text-sm text-muted">Aucun match assez intéressant pour le moment. Ne pas parier est une décision valable.</p>
      ) : null}
      {sportsPicked.map((sp) => (
        <div key={sp} className="space-y-7">
          {bySport(sp).length > 0 && <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight"><span>{SPORTS[sp].icon}</span>{SPORTS[sp].label}<span className="text-sm font-medium text-muted">{bySport(sp).length} prono{bySport(sp).length > 1 ? "s" : ""}, dans l'ordre des matchs</span></h2>
            <div className="grid gap-4 lg:grid-cols-2">{bySport(sp).map((p) => <PickCard key={p.id} p={p} rank={++rank} icon={SPORTS[sp].icon} />)}</div>
          </section>}
          {sp === "football" && goalLines.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight"><span className="h-3 w-3 rounded-full bg-sky-600" />Plus ou moins de buts<span className="text-sm font-medium text-muted">d'après la défense, l'attaque et la forme des équipes</span></h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {goalLines.map(({ m, g }) => (
                  <Link key={m.id} href={`/match/${encodeURIComponent(m.id)}`} className="card block p-4 transition hover:border-brand/40">
                    <div className="text-xs text-muted">{m.league} · {fmtDateTime(m.start)}</div>
                    <Teams m={m} icon="⚽" />
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="text-base font-extrabold text-brand">{g.label}</span><span className="num text-sm">{PC(g.p)} · cote juste {Number(g.fair).toFixed(2).replace(".", ",")}{g.best ? ` · cote ${Number(g.best.odds).toFixed(2).replace(".", ",")} ${g.best.book}` : ""}</span></div>
                    <p className="mt-2 text-xs leading-relaxed text-muted">{g.why}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {sp !== "football" && varLines(sp).length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight"><span className="h-3 w-3 rounded-full bg-sky-600" />{sp === "tennis" ? "Sets, jeux et écarts" : "Totaux et écarts"}<span className="text-sm font-medium text-muted">paris autres que le vainqueur</span></h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {varLines(sp).map(({ m, g }) => (
                  <Link key={m.id} href={`/match/${encodeURIComponent(m.id)}`} className="card block p-4 transition hover:border-brand/40">
                    <div className="text-xs text-muted">{m.league} · {fmtDateTime(m.start)}</div>
                    <Teams m={m} icon={SPORTS[sp].icon} />
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span className="text-base font-extrabold text-brand">{g.label}</span><span className="num text-sm">{PC(g.p)} · cote juste {Number(g.fair).toFixed(2).replace(".", ",")}{g.best ? ` · cote ${Number(g.best.odds).toFixed(2).replace(".", ",")} ${g.best.book}` : ""}</span></div>
                    <p className="mt-2 text-xs leading-relaxed text-muted">{g.why}</p>
                  </Link>
                ))}
              </div>
            </section>
          )}
          {sp === "football" && gp.length > 0 && <GoalPicks picks={gp} />}
          {sp === "football" && sp0.length > 0 && <ScorerPicks picks={sp0} />}
          {sp === "football" && withScorers.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight"><span className="h-3 w-3 rounded-full bg-amber-500" />Buteurs et marqueurs d'essais<span className="text-sm font-medium text-muted">les plus probables d'après les cotes</span></h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {withScorers.map((m) => (
              <div key={m.id}>
                <Link href={`/match/${encodeURIComponent(m.id)}`} className="mb-1 block text-sm font-bold text-brand hover:underline">{m.home} – {m.away} <span className="font-normal text-muted">· {fmtDateTime(m.start)}</span></Link>
                <Scorers m={{ ...m, extras: { ...m.extras, scorers: m.extras.scorers.filter((s) => s.best) } }} limit={6} compact />
              </div>
            ))}
          </div>
        </section>
      )}
          {sp === "tennis" && tennisSets.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight"><span className="h-3 w-3 rounded-full bg-good" />Tennis : sets et jeux<span className="text-sm font-medium text-muted">sets, jeux, retournements</span></h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {tennisSets.map((m) => {
              const g = (n) => m.model.markets.find((x) => x.group === n)?.items || [];
              const sc = g("Score en sets")[0];
              const ns = [...g("Nombre de sets")].sort((a, b) => b.p - a.p)[0];
              const tot = tipsOf(m).find((t) => t.id === "total");
              return (
                <Link key={m.id} href={`/match/${encodeURIComponent(m.id)}`} className="card block p-4 transition hover:border-brand/40">
                  <div className="text-xs text-muted">{m.league} · {fmtDateTime(m.start)}</div>
                  <Teams m={m} icon="🎾" />
                  <ul className="mt-2 space-y-1 text-sm">
                    {sc && <li>Score en sets : <b>{sc.label}</b> <span className="text-muted">({PC(sc.p)})</span></li>}
                    {ns && <li>Nombre de sets : <b>{ns.label}</b> <span className="text-muted">({PC(ns.p)})</span></li>}
                    {tot && <li>Jeux : <b>{tot.pick}</b> <span className="text-muted">({PC(tot.p)}{tot.best ? `, cote ${Number(tot.best.odds).toFixed(2).replace(".", ",")} ${tot.best.book}` : ""})</span></li>}
                  </ul>
                </Link>
              );
            })}
          </div>
          <p className="text-xs text-muted">Sets et retournements : probabilités calculées par notre modèle à partir des cotes du vainqueur. Jeux : cote réelle des bookmakers français.</p>
        </section>
      )}
        </div>
      ))}
      <Suspense fallback={<p className="card p-4 text-xs text-muted">Analyse des prochains matchs de football en cours…</p>}><EspnPicks /></Suspense>
      <Suspense fallback={<p className="card p-4 text-xs text-muted">Analyse des matchs de tennis, basket, hockey et rugby en cours…</p>}><SportPicks /></Suspense>
      {combos.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight"><span className="h-3 w-3 rounded-full bg-brand" />Combinés du jour<span className="text-sm font-medium text-muted">{combos.length}</span></h2>
          <div className="grid gap-4 lg:grid-cols-2">{combos.map((c) => <ComboCard key={c.tier} c={c} icons={icons} />)}</div>
        </section>
      )}
      <p className="text-xs text-muted">Ce sont des estimations, pas des certitudes : une plus-value ne garantit aucun gain sur un match donné. Les paris audacieux et les combinés perdent la plupart du temps : mises très réduites.</p>
    </div>
  );
}
