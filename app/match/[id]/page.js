import { MatchBets } from "@/components/MatchBets";
import { betGroups } from "@/lib/betlist";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SPORTS } from "@/lib/odds";
import { loadEnriched } from "@/lib/data";
import { analyse, unitOf } from "@/lib/analysis";
import { PickCard } from "@/components/PickCard";
import { FormDots } from "@/components/FormDots";
import { ModelMarkets, OutcomeTable, ProbBar, SpreadsTable, TotalsTable } from "@/components/Ui";
import { fmtDateTime, odd, pct, pt } from "@/lib/format";
import { getLineup, getH2H, getTopScorers } from "@/lib/fd";
import { FormScorers } from "@/components/FormScorers";
import { matchInfo } from "@/lib/matchinfo";
import { MatchAnalysis } from "@/components/MatchAnalysis";
import { Pitch } from "@/components/Pitch";
import { Scorers } from "@/components/Scorers";
import { MatchTips } from "@/components/MatchTips";
import { FavButton } from "@/components/FavButton";
import EspnMatch, { LiveBlock, FormH2H, Lineups } from "@/components/EspnMatch";
import { getSummary } from "@/lib/espnsum";
import { matchCenter, oddsBridge } from "@/lib/matchcenter";
import VisualAnalysis from "@/components/VisualAnalysis";
import { EdgePicks, EdgeMarkets, TeamCompare, Streaks, LastGames, LeagueTable } from "@/components/MatchCenter";

export const revalidate = 1800;
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const data = await loadEnriched();
  const m = data.matches?.find((x) => x.id === decodeURIComponent(id));
  return { title: m ? `${m.home} – ${m.away}` : "Match" };
}

function FormBlock({ m }) {
  if (!m.form) return null;
  const rows = [[m.home, m.form.home, m.form.standH], [m.away, m.form.away, m.form.standA]];
  return (
    <section className="card p-5">
      <h2 className="text-lg font-extrabold tracking-tight">Forme et classement</h2>
      <p className="mt-0.5 text-xs text-muted">5 derniers matchs (V victoire, N nul, D défaite), du plus ancien au plus récent.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {rows.map(([name, f, st]) => (
          <div key={name} className="rounded-2xl bg-card2 p-4">
            <div className="flex items-baseline justify-between gap-2"><span className="font-bold">{name}</span>{st && <span className="text-xs text-muted">{st.pos}e / {st.of}</span>}</div>
            <div className="mt-2"><FormDots letters={f.letters} /></div>
            <div className="num mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div><div className="text-base font-extrabold">{f.pts}</div><div className="text-muted">points / {f.n * 3}</div></div>
              <div><div className="text-base font-extrabold">{(f.gf / f.n).toFixed(1).replace(".", ",")}</div><div className="text-muted">buts marqués / match</div></div>
              <div><div className="text-base font-extrabold">{(f.ga / f.n).toFixed(1).replace(".", ",")}</div><div className="text-muted">encaissés / match</div></div>
            </div>
            {st && <div className="num mt-3 border-t border-line pt-2 text-xs text-muted">Saison : {st.pts} pts en {st.p} matchs · {st.w}V {st.d}N {st.l}D · buts {st.gf}-{st.ga}</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

function ModelBlock({ m }) {
  const mo = m.model;
  if (!mo) return null;
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight">Autres marchés : nos estimations</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted">Calculées par notre modèle à partir des probabilités du marché. Ce ne sont pas des cotes de bookmakers : comparez la « cote juste » à celle proposée par votre opérateur. S'il paie davantage, le pari a de la valeur.</p>
      </div>
      {mo.kind === "goals" && (
        <div className="card p-5">
          <h3 className="text-sm font-extrabold">Scores les plus probables</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {mo.scores.map((s) => (
              <div key={`${s.h}-${s.a}`} className="rounded-2xl bg-card2 px-2 py-3 text-center">
                <div className="num text-xl font-extrabold">{s.h} – {s.a}</div>
                <div className="num text-xs font-semibold">{pct(s.p)}</div>
                <div className="num text-[11px] text-muted">cote juste {odd(s.fair)}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Buts attendus : {m.home} {mo.lh.toFixed(2).replace(".", ",")} · {m.away} {mo.la.toFixed(2).replace(".", ",")}.</p>
        </div>
      )}
      {mo.kind === "sets" && <p className="card p-4 text-sm text-muted">Format retenu : {mo.n} sets gagnants {mo.n === 5 ? "(déduit d'un total de jeux élevé)" : "(format standard)"}. Probabilité de gagner un set pour {m.home} : {pct(mo.q)}.</p>}
      {mo.kind === "points" && (
        <div className="card p-5 text-sm">
          <div className="flex flex-wrap items-center justify-around gap-4 text-center">
            <div><div className="text-xs text-muted">{m.home}</div><div className="num text-3xl font-extrabold">{Math.round(mo.h)}</div></div>
            <div className="text-muted">–</div>
            <div><div className="text-xs text-muted">{m.away}</div><div className="num text-3xl font-extrabold">{Math.round(mo.a)}</div></div>
          </div>
          <p className="mt-3 text-center text-xs text-muted">Score attendu d'après le total ({pt(mo.total)}) et le handicap équilibré ({pt(Math.abs(mo.margin))}).</p>
        </div>
      )}
      {mo.markets && <ModelMarkets markets={mo.markets} />}
    </section>
  );
}

const TABS = [["apercu", "Aperçu"], ["visuel", "Analyse visuelle"], ["pronos", "Tous les pronos"], ["analyse", "Analyse IA"], ["paris", "Tous les paris"], ["cotes", "Comparateur de cotes"], ["stats", "Statistiques"], ["equipes", "Stats équipes"], ["classement", "Classement"], ["compos", "Compositions"]];

export default async function MatchPage({ params, searchParams }) {
  const { id } = await params;
  const sp = (await searchParams) || {};
  const tab = TABS.some(([k]) => k === sp.tab) ? sp.tab : "apercu";
  const data = await loadEnriched();
  const m = data.matches?.find((x) => x.id === decodeURIComponent(id));
  if (!m) { const rid = decodeURIComponent(id); if (/^se\d+$/.test(rid)) return <EspnMatch sid={rid} tab={sp.tab} />; notFound(); }
  const sport = SPORTS[m.sport];
  const a = analyse(m);
  const unit = unitOf(m);
  const info = await matchInfo(m).catch(() => null);
  const sum = info?.sid && m.sport === "football" ? await getSummary(info.sid).catch(() => null) : null;
  const C = sum ? await matchCenter(sum, oddsBridge(m)).catch(() => null) : null;
  const lineup = await getLineup(m);
  const topSc = m.sport === "football" ? await getTopScorers() : { scorers: [], error: null };
  const h2h = m.sport === "football" && m.form?.idH ? await getH2H(m.form.idH, m.form.idA) : [];
  const bt = a.bets[0];
  const betTeam = bt && ["h2h", "spreads", "dnb", "dc"].includes(bt.cand.market) ? (bt.label.includes(m.home) && !bt.label.includes(m.away) ? m.home : bt.label.includes(m.away) && !bt.label.includes(m.home) ? m.away : null) : null;
  const ex = m.extras || {};
  const lab = (n, p) => `${n} ${p > 0 ? "+" : "−"}${pt(Math.abs(p))}`;

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between gap-3"><Link href="/matchs" className="text-sm font-bold text-brand hover:underline">← Tous les matchs</Link><FavButton id={m.id} /></div>
      <nav aria-label="Sections du match" className="sticky top-[57px] z-20 -mx-4 flex gap-2 overflow-x-auto border-b border-line bg-white/90 px-4 py-2 backdrop-blur">
        {TABS.map(([k, l]) => <Link key={k} href={`/match/${encodeURIComponent(m.id)}?tab=${k}`} scroll={false} aria-current={tab === k ? "page" : undefined} className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${tab === k ? "bg-navy text-white" : "bg-card2 text-muted hover:text-ink"}`}>{l}</Link>)}
      </nav>

      <section id="apercu" className="hero scroll-mt-28 p-6 sm:p-8">
        <div className="text-xs font-semibold text-muted">{sport.icon} {m.league} · {fmtDateTime(m.start)}</div>
        <h1 className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          {info?.homeCrest && <img src={info.homeCrest} alt="" width="44" height="44" className="h-9 w-9 object-contain sm:h-11 sm:w-11" />}<span>{m.home}</span><span className="text-muted">–</span>{info?.awayCrest && <img src={info.awayCrest} alt="" width="44" height="44" className="h-9 w-9 object-contain sm:h-11 sm:w-11" />}<span>{m.away}</span>
        </h1>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-line"><div className="text-[11px] font-bold text-muted">Où se joue le match</div><div className="font-semibold">{info?.venue ? "📍 " + info.venue : "Stade non communiqué par la source"}</div></div>
          <div className="rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-line"><div className="text-[11px] font-bold text-muted">Diffusion</div><div className="font-semibold">{info?.tv ? "📺 " + info.tv.replace(/^Diffusion \(source ESPN\) : /, "") : "Chaîne non communiquée par la source"}</div></div>
        </div>
        {m.outcomes.some((o) => o.prob != null) && (
          <div className={`mt-5 grid gap-3 ${m.outcomes.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {m.outcomes.map((o) => (
              <div key={o.name} className="rounded-2xl bg-white/80 p-3 ring-1 ring-line">
                <div className="flex items-baseline justify-between gap-2"><span className="truncate text-sm font-bold">{o.name}</span><span className="num text-lg font-extrabold">{o.probAdj != null ? pct(o.probAdj) : "—"}</span></div>
                {o.probAdj != null && <div className="mt-2"><ProbBar p={o.probAdj} /></div>}
                {o.best && <div className="num mt-1.5 text-xs text-muted">Meilleure cote : <b className="text-good">{odd(o.best.odds)}</b> ({o.best.book})</div>}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] text-muted">Probabilités = consensus de {m.nBooks} bookmakers hors France{m.form ? ", légèrement ajustées par la forme" : ""}.</p>
      </section>

      {sum && tab === "apercu" && <LiveBlock S={sum} />}
      {tab === "apercu" && (
        <section className="space-y-3">
          <h2 className="text-xl font-extrabold tracking-tight">Les paris les plus solides</h2>
          {a.bets.length ? <div className="grid gap-4 md:grid-cols-2">{a.bets.slice(0, 2).map((p, n) => <PickCard key={p.id} p={p} rank={n + 1} icon={sport.icon} compact />)}</div> : <p className="card p-4 text-sm text-muted">Aucun pari ne ressort nettement sur ce match : le marché est très équilibré.</p>}
          {C?.E && <VisualAnalysis E={C.E} home={m.home} away={m.away} compact />}
          {C?.E && <EdgePicks E={C.E} title="Pronos FightEdge (tous marchés)" limit={6} />}
          <p className="text-xs text-muted">{C?.E ? `« Tous les pronos » : les ${C.E.groups.reduce((n, g) => n + g.items.length, 0)} issues estimées du match. ` : ""}Ouvrez « Analyse IA » pour le scénario, les forces et faiblesses et les risques, « Tous les paris » pour la liste complète et « Comparateur de cotes » pour voir chaque bookmaker.</p>
        </section>
      )}
      {tab === "apercu" && m.sport === "football" && (
        <section className="space-y-3">
          <h2 className="text-xl font-extrabold tracking-tight">Buteurs à surveiller</h2>
          <FormScorers scorers={topSc.scorers} teams={[m.home, m.away]} title="Joueurs en forme des deux équipes" limit={6} compact error={topSc.error} />
          {lineup ? <p className="text-xs text-muted">Composition probable disponible : consultez l'onglet « Compositions » pour confirmer la présence du joueur.</p> : <p className="text-xs text-muted">Composition pas encore publiée : le statut titulaire n'est pas vérifiable pour le moment.</p>}
        </section>
      )}
      {tab === "visuel" && <VisualAnalysis E={C?.E} tH={C?.tH} tA={C?.tA} home={m.home} away={m.away} start={m.start} />}
      {tab === "pronos" && (C?.E ? <><EdgePicks E={C.E} /><EdgeMarkets E={C.E} /></> : <><ModelBlock m={m} />{!m.model && <p className="card p-4 text-sm text-muted">Pronos détaillés disponibles uniquement pour le football quand l'historique des équipes est fourni par la source.</p>}</>)}
      {tab === "equipes" && (sum ? <><TeamCompare S={sum} C={C} /><Streaks S={sum} C={C} /><LastGames S={sum} C={C} /><FormH2H S={sum} /></> : <p className="card p-4 text-sm text-muted">Statistiques d'équipes disponibles pour le football uniquement (source ESPN).</p>)}
      {tab === "classement" && (sum ? <LeagueTable S={sum} /> : <p className="card p-4 text-sm text-muted">Classement non disponible pour ce match.</p>)}
      {tab === "analyse" && <div id="analyse" className="scroll-mt-28"><MatchAnalysis m={m} a={a} h2h={h2h} /></div>}
      {tab === "paris" && (
        <>
          <section id="paris" className="scroll-mt-28 space-y-3">
            <h2 className="text-xl font-extrabold tracking-tight">Tous les paris disponibles</h2>
            <MatchBets groups={betGroups(m, ex, h2h)} />
            <p className="text-[11px] text-muted">Seuls les marchés réellement proposés par les bookmakers sont listés ; aucune cote n'est inventée.</p>
          </section>
          {ex.scorers?.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xl font-extrabold tracking-tight">{ex.scorerKind === "try" ? "Marqueurs d'essais" : "Buteurs"}</h2>
              <Scorers m={m} />
            </section>
          )}
        </>
      )}
      {tab === "stats" && (
        <>
          <ModelBlock m={m} />
          <FormBlock m={m} />
          {sum && <FormH2H S={sum} />}
          {!m.model && !m.form && <p className="card p-4 text-sm text-muted">Statistiques détaillées non disponibles pour ce match (forme, buts attendus ou expected goals non fournis par les sources).</p>}
          <p className="text-[11px] text-muted">Expected goals (xG), blessures et suspensions : non disponibles avec les sources actuelles.</p>
        </>
      )}
      {tab === "compos" && !lineup && sum?.lineups && <Lineups S={sum} />}
      {tab === "compos" && !(sum?.lineups && !lineup) && (lineup ? (
        <section className="space-y-3">
          <h2 className="text-xl font-extrabold tracking-tight">Compositions probables</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Pitch team={m.home} side={lineup.home} tone="home" badge={betTeam === m.home ? "Équipe du pari" : null} />
            <Pitch team={m.away} side={lineup.away} tone="away" badge={betTeam === m.away ? "Équipe du pari" : null} />
          </div>
        </section>
      ) : (
        <p className="card p-5 text-sm text-muted">{m.sport === "football" ? "Compositions non disponibles : elles sont publiées environ 1 h avant le coup d'envoi, et seulement quand la source de données les fournit." : "Compositions non disponibles pour ce sport."}</p>
      ))}
      {tab === "cotes" && (
      <section id="cotes" className="scroll-mt-28 space-y-3">
        <h2 className="text-xl font-extrabold tracking-tight">Comparateur de cotes</h2>
        <div className="card p-5">
          <h3 className="text-sm font-extrabold">Vainqueur du match</h3>
          <div className="mt-3"><OutcomeTable outcomes={m.outcomes} home={m.home} away={m.away} /></div>
          <p className="mt-2 text-[11px] text-muted">En vert : meilleure cote française. « Non dispo. » : cote non proposée. {m.outcomes.length === 3 ? "Ordre : 1 / N / 2." : ""}</p>
        </div>
        {(ex.btts || ex.dnb || ex.dc) && (
          <div className="grid gap-4 md:grid-cols-2">
            {ex.btts && <div className="card p-5"><h3 className="text-sm font-extrabold">Les deux équipes marquent</h3><div className="mt-3"><OutcomeTable outcomes={ex.btts} home={m.home} away={m.away} /></div></div>}
            {ex.dnb && <div className="card p-5"><h3 className="text-sm font-extrabold">Nul remboursé</h3><div className="mt-3"><OutcomeTable outcomes={ex.dnb} home={m.home} away={m.away} /></div></div>}
            {ex.dc && <div className="card p-5 md:col-span-2"><h3 className="text-sm font-extrabold">Double chance</h3><div className="mt-3"><OutcomeTable outcomes={ex.dc} home={m.home} away={m.away} /></div></div>}
          </div>
        )}
        {(m.totals || []).length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {m.totals.map((t) => (
              <div key={t.point} className="card p-5"><TotalsTable t={t} unit={unit} /></div>
            ))}
          </div>
        )}
        {(m.spreads || []).length > 0 && (
          <>
            <h3 className="pt-2 text-sm font-extrabold text-muted">Handicap</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {m.spreads.map((t) => (
                <div key={t.point} className="card p-5"><SpreadsTable t={t} home={m.home} away={m.away} /></div>
              ))}
            </div>
          </>
        )}
        {(m.totals || []).length === 0 && (m.spreads || []).length === 0 && <p className="card p-4 text-sm text-muted">Seul le marché « vainqueur » est proposé pour ce match.</p>}
      </section>
      )}
    </div>
  );
}
