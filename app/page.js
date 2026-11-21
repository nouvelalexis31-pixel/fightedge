import Link from "next/link";
import { getFootByDate } from "@/lib/livex";
import { SPORTS } from "@/lib/odds";
import { loadEnriched } from "@/lib/data";
import { dailyPicks } from "@/lib/analysis";
import { valueRows } from "@/lib/valuebets";
import { history, merged } from "@/lib/track";
import { agg, dayKey as dk, addDays, eur, pc } from "@/lib/perf";
import { PickCard } from "@/components/PickCard";
import { MatchCard } from "@/components/MatchCard";
import { Setup } from "@/components/Setup";
import NoOdds from "@/components/NoOdds";
import { Suspense } from "react";
import AiDashboard from "@/components/AiDashboard";
import { dayKey, fmtDateTime, fmtTime, odd, signed, todayKey } from "@/lib/format";

export const dynamic = "force-dynamic";

const Head = ({ t, href, more = "Tout voir" }) => (
  <div className="mb-3 flex items-end justify-between gap-3">
    <h2 className="text-xl font-extrabold tracking-tight">{t}</h2>
    {href && <Link href={href} className="shrink-0 text-sm font-bold text-brand hover:underline">{more} →</Link>}
  </div>
);

export default async function Home() {
  const data = await loadEnriched();
  if (data.error && data.matches.length === 0) return <NoOdds msg={data.error} title="Pronos IA et analyses du jour" extra={<Suspense fallback={null}><AiDashboard /></Suspense>} />;
  const all = data.matches;
  if (all.length === 0) return <NoOdds msg={data.error || "aucun match coté pour le moment"} title="Pronos IA et analyses du jour" extra={<Suspense fallback={null}><AiDashboard /></Suspense>} />;
  const now = Date.now();
  const today = todayKey();
  const upcoming = all.filter((m) => +new Date(m.start) > now - 3 * 3600e3);
  const ofDay = upcoming.filter((m) => dayKey(m.start) === today);
  const fdToday = await getFootByDate(today).catch(() => null);
  const nFootEspn = (fdToday?.items || []).length;
  const nDay = ofDay.filter((m) => m.sport !== "football").length + Math.max(nFootEspn, ofDay.filter((m) => m.sport === "football").length);
  const soon = upcoming.filter((m) => +new Date(m.start) <= now + 24 * 3600e3).sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const picks = dailyPicks(all);
  const top = picks.slice(0, 3);
  const best = picks.slice().sort((a, b) => b.stars - a.stars || b.score - a.score).filter((p) => !top.includes(p)).slice(0, 3);
  const vb = valueRows(all, { hours: 72, minTier: 2 }).slice(0, 3);
  // Meilleures cotes : écart entre la meilleure cote et la moyenne des bookmakers (au moins 3 cotes).
  const gaps = [];
  for (const m of upcoming) {
    if (+new Date(m.start) > now + 72 * 3600e3) continue;
    for (const o of m.outcomes || []) {
      const v = Object.values(o.odds || {}).filter((x) => typeof x === "number");
      if (v.length < 3 || !o.best) continue;
      const avg = v.reduce((s, x) => s + x, 0) / v.length;
      gaps.push({ m, o, gap: o.best.odds / avg - 1, avg });
    }
  }
  gaps.sort((a, b) => b.gap - a.gap);
  const bestOdds = gaps.filter((g) => g.gap >= 0.01).slice(0, 5);
  // Historique FightEdge : variations de cotes enregistrées et performance récente.
  let h = null;
  try { h = merged(await history()); } catch {}
  const moves = (h || []).filter((r) => r.odds && r.closeOdds && r.status === "pending" && +new Date(r.start) > now).map((r) => ({ r, d: r.closeOdds / r.odds - 1 })).filter((x) => Math.abs(x.d) >= 0.04).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 4);
  const w = (h || []).filter((r) => dk(r.start) >= addDays(dk(now), -7));
  const perf = agg(w, 10);
  const counts = Object.entries(SPORTS).map(([k, s]) => [k, s, ofDay.filter((m) => m.sport === k).length]).filter(([, , n]) => n > 0);

  return (
    <div className="space-y-9">
      <section className="hero p-6 sm:p-9">
        <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white ring-1 ring-white/20"><span className="live-dot h-2 w-2 rounded-full bg-gold" />{data.fetchedAt ? `Cotes relevées ${fmtDateTime(data.fetchedAt)}` : "Cotes réelles"}</p>
        <h1 className="mt-4 max-w-2xl text-3xl font-extrabold leading-tight sm:text-4xl">Analyses, value bets et vraies cotes du jour</h1>
        <p className="muted mt-3 max-w-xl text-sm leading-relaxed sm:text-base">Betclic, Winamax, Unibet et PMU comparés sur {Object.keys(SPORTS).length} sports. Chaque pari publié est enregistré puis vérifié : le bilan est public.</p>
        <form action="/matchs" className="mt-5 flex max-w-xl gap-2">
          <input name="q" placeholder="Rechercher une équipe, un joueur, un match…" aria-label="Rechercher" className="w-full rounded-2xl border border-line bg-white px-4 py-3 text-base text-ink shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
          <button className="rounded-2xl bg-gold px-6 py-3 text-sm font-extrabold text-navy">Chercher</button>
        </form>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link href="/matchs" className="tile"><b className="num text-2xl">{nDay}</b><span className="muted text-sm">matchs aujourd'hui</span></Link>
          <Link href="/live" className="tile"><b className="text-base">Scores en direct</b><span className="muted text-sm">sur les applis de paris</span></Link>
          <Link href="/value" className="tile"><b className="num text-2xl">{valueRows(all, { hours: 72 }).length}</b><span className="muted text-sm">value bets (72 h)</span></Link>
          <Link href="/bilan" className="tile"><b className="text-base">Bilan IA</b><span className="muted text-sm">résultats vérifiés</span></Link>
        </div>
      </section>

      <Suspense fallback={<p className="card p-4 text-xs text-muted">Chargement des pronos IA…</p>}><AiDashboard /></Suspense>

      {top.length > 0 && (
        <section>
          <Head t="Meilleurs pronos du jour" href="/pronos" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{top.map((p, i) => <PickCard key={p.id} p={p} rank={i + 1} icon={SPORTS[p.match.sport].icon} compact />)}</div>
        </section>
      )}

      <section>
        <Head t="Meilleures value bets" href="/value" />
        {vb.length === 0 ? <p className="card p-4 text-sm text-muted">Aucune value bet « bonne » (≥ 5 %) pour les 72 prochaines heures : les cotes sont proches de la cote juste. Ne rien jouer est une décision valable.</p> : (
          <div className="grid gap-3 md:grid-cols-3">{vb.map(({ m, c, o, value, tier, k }) => (
            <Link key={k.id} href={`/match/${encodeURIComponent(m.id)}?tab=paris`} className="card card-link block space-y-1.5 p-4">
              <div className="flex items-center justify-between gap-2 text-xs text-muted"><span className="truncate">{SPORTS[m.sport].icon} {m.league}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${tier.cls}`}>{tier.label}</span></div>
              <div className="text-sm text-muted">{m.home} – {m.away}</div>
              <div className="text-base font-extrabold">{c.label}</div>
              <div className="num text-sm"><b className="text-brand">{odd(o.best.odds)}</b> {o.best.book} · value <b className="text-good">{signed(value)}</b> · proba {pc(o.probAdj)}</div>
            </Link>))}</div>
        )}
      </section>

      {bestOdds.length > 0 && (
        <section>
          <Head t="Meilleures cotes du moment" />
          <div className="card divide-y divide-line">
            {bestOdds.map(({ m, o, gap, avg }) => (
              <Link key={m.id + o.name} href={`/match/${encodeURIComponent(m.id)}?tab=cotes`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-card2">
                <span className="min-w-0 flex-1"><b className="block truncate">{o.name}</b><span className="block truncate text-xs text-muted">{m.home} – {m.away} · {fmtTime(m.start)}</span></span>
                <span className="num text-right"><b className="text-good">{odd(o.best.odds)}</b> <span className="text-xs text-muted">{o.best.book}</span><span className="block text-[11px] text-muted">moy. {odd(avg)} · +{(gap * 100).toFixed(1).replace(".", ",")} %</span></span>
              </Link>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted">Écart entre la meilleure cote et la moyenne des bookmakers : plus il est grand, plus un opérateur paie au-dessus du marché.</p>
        </section>
      )}

      <section>
        <Head t="Variations de cotes" />
        {moves.length === 0 ? <p className="card p-4 text-sm text-muted">Les mouvements apparaissent quand une cote change de plus de 4 % entre deux relevés de FightEdge. Aucun mouvement notable pour le moment.</p> : (
          <div className="card divide-y divide-line">{moves.map(({ r, d }) => (
            <Link key={r.id} href={`/match/${encodeURIComponent(r.matchId)}?tab=cotes`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-card2">
              <span className="min-w-0 flex-1"><b className="block truncate">{r.selection}</b><span className="block truncate text-xs text-muted">{r.home} – {r.away}</span></span>
              <span className="num text-right"><b>{odd(r.odds)} → {odd(r.closeOdds)}</b><span className={`block text-xs font-bold ${d < 0 ? "text-bad" : "text-good"}`}>{d > 0 ? "+" : ""}{(d * 100).toFixed(1).replace(".", ",")} %</span></span>
            </Link>))}</div>
        )}
      </section>

      {best.length > 0 && (
        <section>
          <Head t="Les analyses les plus solides" href="/pronos" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{best.map((p, i) => <PickCard key={p.id} p={p} rank={i + 1} icon={SPORTS[p.match.sport].icon} compact />)}</div>
        </section>
      )}

      <section>
        <Head t="Performance récente de FightEdge" href="/bilan" more="Bilan complet" />
        {perf.n === 0 ? <p className="card p-4 text-sm text-muted">{perf.total ? `${perf.total} pronostics enregistrés sur 7 jours, en attente de résultat.` : "Le suivi vient de démarrer : chaque pronostic publié est enregistré avec sa cote, puis son résultat est vérifié automatiquement."}</p> : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[["Réussite (7 j)", perf.hit != null ? pc(perf.hit) : "—"], ["Pronostics réglés", String(perf.n)], ["Bénéfice virtuel", perf.nMoney ? eur(perf.profit) : "—"], ["ROI", perf.roi != null ? pc(perf.roi / 100, 1) : "—"]].map(([l, v]) => <div key={l} className="card p-4"><div className="text-xs text-muted">{l}</div><div className="num mt-1 text-2xl font-extrabold">{v}</div></div>)}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <Head t="Prochains matchs" href="/matchs" more="Tous les matchs" />
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {counts.map(([k, s, n]) => <Link key={k} href={`/matchs?sport=${k}`} className="tab shrink-0 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-muted hover:text-ink">{s.icon} {s.label} <span className="ml-1 opacity-70">{n}</span></Link>)}
        </div>
        <div className="grid gap-3 md:grid-cols-2">{soon.slice(0, 6).map((m) => <MatchCard key={m.id} m={m} icon={SPORTS[m.sport].icon} />)}</div>
      </section>
    </div>
  );
}
