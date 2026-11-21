import Link from "next/link";
import { after } from "next/server";
import { SPORTS } from "@/lib/odds";
import { loadEnriched } from "@/lib/data";
import { dailyPicks } from "@/lib/analysis";
import { history, merged, recordPicks, settlePending } from "@/lib/track";
import { catOf } from "@/lib/rules";
import { MIN_N, STATUS, agg, bankroll, calibration, clvOf, dayKey, dayProfits, addDays, eur, groupBy, isSettled, lossReasons, pc, profitOf, recurring, reliability, table, verdictOf, weekStart, weeksOf, weeklyReport, monthKey, explain } from "@/lib/perf";
import { LineChart, ProfitBars, Calendar } from "@/components/Charts";
import { fmtDateTime, odd } from "@/lib/format";
import { storeOn } from "@/lib/store";
import { PlayedBets } from "@/components/PlayedBets";
import { PronoLog } from "@/components/PronoLog";

export const metadata = { title: "Bilan & performance IA" };
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PERIODS = [["1", "Aujourd'hui"], ["7", "7 jours"], ["30", "30 jours"], ["90", "90 jours"], ["all", "Tout"]];
const sportLabel = (s) => (SPORTS[s] ? `${SPORTS[s].icon} ${SPORTS[s].label}` : s);
const f1 = (x, d = 1) => Number(x).toFixed(d).replace(".", ",");
const tone = (x) => (x > 0 ? "text-good" : x < 0 ? "text-bad" : "");
const num = (v, d, a, b) => { const x = Number(v); return Number.isFinite(x) ? Math.min(b, Math.max(a, x)) : d; };

function Kpi({ l, v, sub, t = "" }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium text-muted">{l}</div>
      <div className={`num mt-1 text-2xl font-extrabold ${t}`}>{v}</div>
      {sub && <div className="mt-0.5 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
const Badge = ({ k, children }) => <span className={`rounded-full px-3 py-1 text-xs font-bold ${k === "pos" ? "bg-good/15 text-good" : k === "neg" ? "bg-bad/15 text-bad" : "bg-card2 text-ink"}`}>{children}</span>;

function Tbl({ rows, first, stake }) {
  if (!rows.length) return <p className="text-sm text-muted">Aucun pari dans cette catégorie pour le moment.</p>;
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <table className="num w-full min-w-[640px] text-left text-xs">
        <thead className="text-[11px] text-muted"><tr className="border-b border-line"><th className="py-2 pr-2 font-semibold">{first}</th><th className="px-2 font-semibold">Paris</th><th className="px-2 font-semibold">Réussite</th><th className="px-2 font-semibold">Bénéfice</th><th className="px-2 font-semibold">ROI</th><th className="px-2 font-semibold">Cote moy.</th><th className="px-2 font-semibold">7 j</th><th className="px-2 font-semibold">30 j</th><th className="px-2 font-semibold">90 j</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-line/60">
              <td className="py-2 pr-2 font-semibold">{r.key}{r.low && <span className="ml-1.5 rounded bg-card2 px-1.5 py-0.5 text-[10px] font-medium text-muted">échantillon &lt; {MIN_N}</span>}</td>
              <td className="px-2">{r.n}{r.pending ? <span className="text-muted"> (+{r.pending})</span> : ""}</td>
              <td className="px-2">{r.hit != null ? pc(r.hit) : "—"}</td>
              <td className={`px-2 font-bold ${tone(r.profit)}`}>{r.nMoney ? eur(r.profit) : "—"}</td>
              <td className={`px-2 ${tone(r.roi)}`}>{r.roi != null ? f1(r.roi) + " %" : "—"}</td>
              <td className="px-2">{r.avgOdds ? odd(r.avgOdds) : "—"}</td>
              {[r.d7, r.d30, r.d90].map((x, i) => <td key={i} className={`px-2 ${tone(x.roi)}`}>{x.n ? (x.roi != null ? f1(x.roi, 0) + " %" : "—") : "·"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Report({ rep, title }) {
  const { a, v } = rep;
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2"><Badge k={a.nMoney ? v.k : "eq"}>{a.nMoney ? v.label : "En attente de résultats"}</Badge><span className="text-xs text-muted">{title}</span></div>
      <p className="leading-relaxed"><b>1. Résumé :</b> {rep.concl}</p>
      <ul className="grid gap-2 sm:grid-cols-4">
        {[["Pronostics publiés", a.total], ["Taux de réussite", a.hit != null ? pc(a.hit) : "—"], ["Bénéfice / perte", a.nMoney ? eur(a.profit) : "—"], ["ROI", a.roi != null ? f1(a.roi) + " %" : "—"]].map(([l, x]) => <li key={l} className="rounded-xl bg-card2 px-3 py-2"><div className="text-[11px] text-muted">{l}</div><div className="num font-extrabold">{x}</div></li>)}
      </ul>
      <div className="grid gap-4 lg:grid-cols-2">
        <div><b>Top 5 des meilleurs pronostics</b>{rep.wins.length ? <ul className="mt-1 space-y-1 text-xs">{rep.wins.map((r) => <li key={r.id}>✅ {r.selection} — {r.home} – {r.away} <span className="num text-good">(cote {odd(r.odds)})</span></li>)}</ul> : <p className="text-xs text-muted">Aucun pari gagné réglé.</p>}</div>
        <div><b>Top 5 des pronostics perdants</b> <span className="text-xs text-muted">(les plus probables sur le papier)</span>{rep.loses.length ? <ul className="mt-1 space-y-1 text-xs">{rep.loses.map((r) => <li key={r.id}>❌ {r.selection} — {r.home} – {r.away} <span className="num text-bad">({pc(r.prob)} annoncé)</span></li>)}</ul> : <p className="text-xs text-muted">Aucun pari perdu réglé.</p>}</div>
      </div>
      <div><b>Analyse et raisons de la performance</b><ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-relaxed">{rep.why.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div><b>Marchés les plus performants</b>{rep.good.length ? <ul className="mt-1 text-xs">{rep.good.map((t) => <li key={t.key}>{t.key} : <span className="text-good">{eur(t.profit)}</span> ({t.nMoney} paris)</li>)}</ul> : <p className="text-xs text-muted">Aucun marché bénéficiaire (3 paris minimum).</p>}</div>
        <div><b>Marchés à surveiller</b>{rep.watch.length ? <ul className="mt-1 text-xs">{rep.watch.map((t) => <li key={t.key}>{t.key} : <span className="text-bad">{eur(t.profit)}</span> ({t.nMoney} paris)</li>)}</ul> : <p className="text-xs text-muted">Aucun marché déficitaire (3 paris minimum).</p>}</div>
      </div>
      <div><b>Recommandations pour la semaine suivante</b><ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-relaxed">{rep.reco.map((t, i) => <li key={i}>{t}</li>)}</ul></div>
    </div>
  );
}

export default async function Bilan({ searchParams }) {
  const sp = (await searchParams) || {};
  const stake = num(sp.stake, 10, 1, 1000), bank0 = num(sp.bank, 1000, 10, 1000000);
  const today = dayKey(Date.now());
  const period = PERIODS.some(([k]) => k === sp.p) ? sp.p : sp.from || sp.to ? "custom" : "30";
  let from = "0000-00-00", to = "9999-12-31";
  if (period === "custom") { from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from || "") ? sp.from : from; to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to || "") ? sp.to : to; }
  else if (period !== "all") { from = addDays(today, -(Number(period) - 1)); to = today; }

  const h = await history();
  const all = merged(h).map((r) => ({ ...r, cat: catOf(r.rule, r.sport) }));
  const inP = all.filter((r) => { const k = dayKey(r.start); return k >= from && k <= to; });
  const settled = inP.filter(isSettled);
  const A = agg(inP, stake);

  // Enregistre les pronos publiés et règle les matchs terminés, après l'envoi de la page.
  let data = { matches: [] };
  try { data = await loadEnriched(); } catch {}
  after(async () => { try { if (data.matches.length) await recordPicks(data.matches); await settlePending(); } catch (e) { console.error("bilan", e?.message); } });

  const qs = (o) => { const q = new URLSearchParams(); const m = { p: period === "custom" ? "" : period, from: sp.from, to: sp.to, stake: sp.stake, bank: sp.bank, sport: sp.sport, cat: sp.cat, st: sp.st, v: sp.v, ...o }; for (const [k, v] of Object.entries(m)) if (v) q.set(k, v); const s = q.toString(); return s ? `/bilan?${s}` : "/bilan"; };
  const chip = (to2, label, active) => <Link key={label} href={to2} className={`tab shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? "border-navy bg-navy text-white" : "border-line bg-white text-muted hover:text-ink"}`}>{label}</Link>;

  const bk = bankroll(inP, stake, bank0);
  const days = dayProfits(inP, stake);
  const calMonth = monthKey(period === "custom" && to !== "9999-12-31" ? to : today);
  const weeks = weeksOf(all, stake);
  const thisW = weekStart(today), lastW = addDays(thisW, -7);
  const wk = (w) => all.filter((r) => weekStart(dayKey(r.start)) === w);
  const monthNet = agg(all.filter((r) => monthKey(dayKey(r.start)) === monthKey(today)), stake).profit;
  const weekNet = agg(wk(thisW), stake).profit;
  const bySport = table(inP, (r) => sportLabel(r.sport), stake);
  const byCat = table(inP, (r) => r.cat, stake);
  const vbs = agg(inP.filter((r) => r.value != null && r.value >= 0.03), stake), others = agg(inP.filter((r) => r.value == null || r.value < 0.03), stake);
  const cal = calibration(inP);
  const rel = reliability(all, stake);
  const clv = clvOf(inP);
  const rec = recurring(all);
  const losses = settled.filter((r) => r.status === "lost").sort((a, b) => String(b.start).localeCompare(String(a.start)));
  const first = all.length ? all.reduce((m, r) => (r.publishedAt < m ? r.publishedAt : m), all[0].publishedAt) : null;

  // Historique filtrable
  let hist = inP;
  if (sp.sport) hist = hist.filter((r) => r.sport === sp.sport);
  if (sp.cat) hist = hist.filter((r) => r.cat === sp.cat);
  if (sp.st) hist = hist.filter((r) => r.status === sp.st);
  if (sp.v === "1") hist = hist.filter((r) => r.value != null && r.value >= 0.03);
  hist = hist.slice().sort((a, b) => String(b.start).localeCompare(String(a.start)));
  const PAGE = 40, pg = num(sp.page, 1, 1, 999);
  const pageItems = hist.slice((pg - 1) * PAGE, pg * PAGE);

  // Meilleurs paris de la semaine : qualité avant quantité, l'historique sert de contexte et ne décide jamais seul.
  const histCat = Object.fromEntries(table(all, (r) => r.cat, stake).map((t) => [t.key, t]));
  const cur = data.matches.length ? dailyPicks(data.matches).filter((p) => p.stars >= 3 && p.outcome.probAdj >= 0.45 && p.outcome.evAdj >= 0).sort((a, b) => b.score - a.score).slice(0, 3) : [];
  const trusted = byCat.filter((t) => t.n >= MIN_N && t.hit != null).sort((a, b) => b.hit - a.hit).slice(0, 3);
  const doubt = byCat.filter((t) => t.n >= MIN_N && t.roi != null && t.roi < -10);
  const sports = [...new Set(all.map((r) => r.sport))];
  const cats = [...new Set(all.map((r) => r.cat))];

  const curWeek = weeklyReport(wk(thisW), stake, { sportLabel });
  const lastWeek = weeklyReport(wk(lastW), stake, { sportLabel });

  return (
    <div className="space-y-7">
      <section className="hero p-6 sm:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Bilan &amp; performance IA</h1>
        <p className="muted mt-3 max-w-3xl text-sm leading-relaxed sm:text-base">FightEdge enregistre chaque pronostic publié, avec la cote du moment, puis vérifie le résultat après le match. Rien n&apos;est modifié après coup : les statistiques sont calculées sur ces enregistrements, avec une bankroll virtuelle de {f1(stake, 0)} € par pari. Ce n&apos;est pas de l&apos;argent réel et le passé ne garantit rien.</p>
        <p className="muted mt-2 text-[11px]">{first ? `Suivi démarré le ${fmtDateTime(first)}.` : "Le suivi démarre avec la prochaine visite des pronos."} Les paris sans cote réelle de bookmaker comptent dans le taux de réussite mais jamais dans le bénéfice ni le ROI. Résultats : ESPN, The Odds API. Compteurs remis à zéro le 18 nov. 2026 à 00h20.</p>
      </section>

      {!storeOn() && <p className="card p-4 text-sm text-bad">Le stockage de l&apos;historique n&apos;est pas configuré (variable BLOB_READ_WRITE_TOKEN absente) : aucun bilan ne peut être calculé.</p>}

      <div className="sticky top-[57px] z-20 -mx-4 space-y-2 border-b border-line bg-white/90 px-4 py-2 backdrop-blur">
        <div className="flex gap-2 overflow-x-auto">{PERIODS.map(([k, l]) => chip(qs({ p: k, from: "", to: "" }), l, period === k))}</div>
        <form action="/bilan" className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-muted">Personnaliser :</span>
          <input type="date" name="from" defaultValue={sp.from || ""} className="rounded-lg border border-line bg-white px-2 py-1" aria-label="Du" />
          <input type="date" name="to" defaultValue={sp.to || ""} className="rounded-lg border border-line bg-white px-2 py-1" aria-label="Au" />
          <label className="flex items-center gap-1 text-muted">Mise <input type="number" name="stake" min="1" max="1000" defaultValue={stake} className="w-16 rounded-lg border border-line bg-white px-2 py-1 text-ink" /> €</label>
          <label className="flex items-center gap-1 text-muted">Bankroll <input type="number" name="bank" min="10" defaultValue={bank0} className="w-20 rounded-lg border border-line bg-white px-2 py-1 text-ink" /> €</label>
          <button className="rounded-full bg-navy px-3 py-1.5 font-bold text-white">Appliquer</button>
        </form>
      </div>

      <section id="resume" className="scroll-mt-40 space-y-3">
        <h2 className="text-xl font-extrabold">Tableau de bord de rentabilité</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi l="Pronostics publiés" v={A.total} sub={`${A.pending} en attente (non comptés)`} />
          <Kpi l="Gagnants" v={A.won} t="text-good" />
          <Kpi l="Perdants" v={A.lost} t="text-bad" />
          <Kpi l="Annulés" v={A.voided} sub="mise restituée" />
          <Kpi l="Taux de réussite" v={A.hit != null ? pc(A.hit) : "—"} sub="gagnés / (gagnés + perdus)" />
          <Kpi l="Bénéfice / perte" v={A.nMoney ? eur(A.profit) : "—"} t={tone(A.profit)} sub={`${A.nMoney} paris avec cote réelle`} />
          <Kpi l="ROI global" v={A.roi != null ? f1(A.roi) + " %" : "—"} t={tone(A.roi)} sub={`sur ${f1(A.staked, 0)} € misés (réglés)`} />
          <Kpi l="Cote moyenne" v={A.avgOdds ? odd(A.avgOdds) : "—"} />
          <Kpi l="Bénéfice cette semaine" v={eur(weekNet)} t={tone(weekNet)} />
          <Kpi l="Bénéfice ce mois" v={eur(monthNet)} t={tone(monthNet)} />
          <Kpi l="Value bets (value ≥ 3 %)" v={vbs.nMoney ? eur(vbs.profit) : "—"} t={tone(vbs.profit)} sub={vbs.nMoney ? `ROI ${f1(vbs.roi)} % · ${vbs.nMoney} paris` : "pas encore de pari réglé"} />
          <Kpi l="Score de fiabilité" v={rel.score != null ? `${rel.score}/100` : "—"} sub={rel.level} />
        </div>
        {A.n === 0 && <p className="card p-4 text-sm text-muted">Aucun pronostic réglé sur cette période. {all.length ? `${all.length} pronostic(s) sont enregistrés et seront réglés automatiquement après les matchs (règlement quotidien).` : "Les pronostics s'enregistrent dès qu'ils sont publiés : revenez après les premiers matchs."}</p>}
      </section>

      <section id="bankroll" className="scroll-mt-40 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="card p-4 sm:p-5"><h2 className="mb-2 text-lg font-extrabold">Évolution de la bankroll virtuelle</h2><LineChart pts={bk.pts} base={bank0} /><p className="mt-1 text-[11px] text-muted">Départ {f1(bank0, 0)} € · mise fixe de {f1(stake, 0)} € par pari · baisse maximale {eur(-bk.maxDD, 0)}.</p></div>
        <div className="card p-4 sm:p-5"><h2 className="mb-2 text-lg font-extrabold">Calendrier</h2><Calendar month={calMonth} days={days} today={today} /></div>
      </section>

      <section id="semaine" className="scroll-mt-40 space-y-3">
        <h2 className="text-xl font-extrabold">Bilan hebdomadaire</h2>
        <p className="text-xs text-muted">Du lundi au dimanche, sur tous les pronostics (indépendant du filtre de période). Verdict : positive si le bénéfice net est supérieur à 0 €, négative s&apos;il est inférieur, à l&apos;équilibre s&apos;il est nul.</p>
        <div className="card p-4 sm:p-5"><h3 className="mb-2 font-bold">Semaine en cours (depuis le {thisW.split("-").reverse().join("/")})</h3><Report rep={curWeek} title="semaine en cours, résultats partiels" /></div>
        <div className="card p-4 sm:p-5"><h3 className="mb-2 font-bold">Semaine dernière (du {lastW.split("-").reverse().join("/")})</h3><Report rep={lastWeek} title="rapport de la semaine écoulée" /></div>
        {weeks.length > 0 && (
          <div className="card p-4 sm:p-5">
            <h3 className="mb-2 font-bold">Semaines antérieures</h3>
            <div className="space-y-2">
              {weeks.filter((w) => w.week !== thisW && w.week !== lastW).slice(0, 12).map((w) => { const v = verdictOf(w.profit); return (
                <details key={w.week} className="rounded-xl border border-line px-3 py-2">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 text-sm"><b>Semaine du {w.week.split("-").reverse().join("/")}</b><Badge k={w.nMoney ? v.k : "eq"}>{w.nMoney ? v.label : "En attente"}</Badge><span className="num text-xs text-muted">{w.total} paris · {w.hit != null ? pc(w.hit) : "—"} · <span className={tone(w.profit)}>{w.nMoney ? eur(w.profit) : "—"}</span> · ROI {w.roi != null ? f1(w.roi) + " %" : "—"}</span></summary>
                  <div className="mt-3"><Report rep={weeklyReport(w.items, stake, { sportLabel })} title={`semaine du ${w.week}`} /></div>
                </details>
              ); })}
            </div>
          </div>
        )}
      </section>

      <section id="sports" className="scroll-mt-40 grid gap-4 lg:grid-cols-2">
        <div className="card p-4 sm:p-5"><h2 className="mb-3 text-lg font-extrabold">Bénéfice par sport</h2><ProfitBars rows={bySport} /></div>
        <div className="card p-4 sm:p-5"><h2 className="mb-3 text-lg font-extrabold">Bénéfice par type de pari</h2><ProfitBars rows={byCat} /></div>
        <div className="card p-4 sm:p-5 lg:col-span-2"><h2 className="mb-1 text-lg font-extrabold">Détail par sport</h2><p className="mb-2 text-[11px] text-muted">Les barres pâles et les mentions « échantillon &lt; {MIN_N} » signalent un trop petit nombre de paris : aucune conclusion forte.</p><Tbl rows={bySport} first="Sport" stake={stake} /></div>
        <div className="card p-4 sm:p-5 lg:col-span-2"><h2 className="mb-2 text-lg font-extrabold">Détail par marché</h2><Tbl rows={byCat} first="Marché" stake={stake} /></div>
        <div className="card p-4 sm:p-5 lg:col-span-2">
          <h2 className="mb-2 text-lg font-extrabold">Performance des value bets</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[["Value bets (value ≥ 3 %)", vbs], ["Autres pronostics", others]].map(([t, x]) => <div key={t} className="rounded-xl bg-card2 p-3 text-sm"><div className="font-bold">{t}</div><div className="num mt-1 text-xs">{x.n} réglés · réussite {x.hit != null ? pc(x.hit) : "—"} · <span className={tone(x.profit)}>{x.nMoney ? eur(x.profit) : "—"}</span> · ROI {x.roi != null ? f1(x.roi) + " %" : "—"}</div></div>)}
          </div>
          <p className="mt-2 text-xs text-muted">{vbs.n >= MIN_N ? (vbs.roi > 0 ? "Sur cet échantillon, les value bets ont été rentables." : "Sur cet échantillon, les value bets n'ont pas été rentables : la value estimée est probablement surévaluée.") : `Moins de ${MIN_N} value bets réglés : trop tôt pour conclure.`}</p>
        </div>
      </section>

      <section id="fiabilite" className="scroll-mt-40 grid gap-4 lg:grid-cols-2">
        <div className="card p-4 sm:p-5">
          <h2 className="mb-1 text-lg font-extrabold">Score de fiabilité à long terme</h2>
          <div className="flex items-baseline gap-3"><span className="num text-4xl font-extrabold">{rel.score != null ? rel.score : "—"}</span><span className="text-sm font-bold text-muted">{rel.score != null ? "/100 · " : ""}{rel.level}</span></div>
          {rel.why && <p className="mt-2 text-xs text-muted">{rel.why}</p>}
          <ul className="mt-3 space-y-2 text-xs">{rel.comps.map((c) => <li key={c.k}><div className="flex justify-between"><b>{c.k} <span className="font-normal text-muted">(poids {Math.round(c.w * 100)} %)</span></b><span className="num font-bold">{Math.round(c.v)}/100</span></div><div className="pbar my-1"><span style={{ width: `${c.v}%` }} /></div><div className="text-muted">{c.d}</div></li>)}</ul>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">Ce score ne repose pas sur le seul taux de réussite et ne masque pas les périodes déficitaires : elles apparaissent dans le bilan hebdomadaire et la bankroll. Closing Line Value indicative : {clv.n ? `${f1(clv.avg * 100)} % en moyenne sur ${clv.n} pronostics (la dernière cote observée avant le match sert de référence, relevée à chaque visite du site et deux fois par jour).` : "pas encore assez de pronostics avec une cote de clôture observée."}</p>
        </div>
        <div className="card p-4 sm:p-5">
          <h2 className="mb-1 text-lg font-extrabold">Calibration des probabilités</h2>
          <p className="mb-2 text-xs text-muted">Quand FightEdge annonce 60 %, le pari doit réussir environ 6 fois sur 10.</p>
          <div className="overflow-x-auto"><table className="num w-full text-left text-xs"><thead className="text-[11px] text-muted"><tr className="border-b border-line"><th className="py-1.5">Probabilité annoncée</th><th>Paris</th><th>Annoncé</th><th>Réel</th><th>Écart</th></tr></thead><tbody>{cal.map((b) => <tr key={b.lo} className="border-b border-line/60"><td className="py-1.5">{Math.round(b.lo * 100)}–{Math.round(b.hi * 100)} %</td><td>{b.n}</td><td>{b.avgP != null ? pc(b.avgP) : "—"}</td><td>{b.hit != null ? pc(b.hit) : "—"}</td><td className={b.n >= 10 && Math.abs(b.avgP - b.hit) > 0.1 ? "font-bold text-bad" : ""}>{b.n ? `${b.avgP - b.hit > 0 ? "+" : "−"}${f1(Math.abs(b.avgP - b.hit) * 100, 0)} pts` : "—"}</td></tr>)}</tbody></table></div>
          <p className="mt-2 text-xs text-muted">{A.brier != null ? `Score de Brier : ${f1(A.brier, 3)} (0 = parfait ; 0,25 = pile ou face).` : "Score de Brier disponible dès les premiers paris réglés."} Un écart rouge signale une classe de probabilités mal estimée (10 paris minimum).</p>
        </div>
      </section>

      <section id="erreurs" className="scroll-mt-40 space-y-3">
        <h2 className="text-xl font-extrabold">Analyse des erreurs</h2>
        <div className="card p-4 sm:p-5 text-sm">
          <h3 className="font-bold">Erreurs récurrentes</h3>
          {rec.length ? <ul className="mt-1 list-disc space-y-1 pl-5 text-xs">{rec.map((e) => <li key={e.name}><b>{e.name}</b> : {pc(e.p)} annoncés pour {pc(e.hit)} réussis sur {e.n} paris — surestimation de {f1(e.gap * 100, 0)} pts.</li>)}</ul> : <p className="mt-1 text-xs text-muted">Aucune erreur récurrente identifiée : il faut au moins 10 paris réglés dans une catégorie avec un écart de 10 points ou plus entre probabilité annoncée et réussite.</p>}
          <p className="mt-2 text-[11px] text-muted">Limites : blessures, suspensions et compositions ne sont pas encore des données du modèle ; leur effet sur une défaite ne peut donc pas être établi.</p>
        </div>
        <div className="card p-4 sm:p-5">
          <h3 className="mb-2 font-bold">Pronostics perdus ({losses.length})</h3>
          {losses.length === 0 ? <p className="text-xs text-muted">Aucun pronostic perdu sur cette période.</p> : (
            <div className="space-y-2">{losses.slice(0, 15).map((r) => (
              <details key={r.id} className="rounded-xl border border-line px-3 py-2 text-sm">
                <summary className="cursor-pointer"><b>{r.selection}</b> <span className="text-xs text-muted">· {r.home} – {r.away} · score {r.score || "?"}{r.odds != null ? ` · cote ${odd(r.odds)}` : ""}</span></summary>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted">{lossReasons(r).map((t, i) => <li key={i}>{t}</li>)}</ul>
              </details>
            ))}</div>
          )}
        </div>
      </section>

      <section id="semaine-paris" className="scroll-mt-40 space-y-3">
        <h2 className="text-xl font-extrabold">Les meilleurs paris de la semaine</h2>
        <p className="text-xs text-muted">Qualité avant quantité : au plus 3 analyses, choisies sur la solidité de chaque pari (probabilité, accord des bookmakers, forme). L&apos;historique de FightEdge n&apos;est qu&apos;un éclairage : un marché rentable la semaine passée n&apos;est jamais retenu pour cette seule raison.</p>
        {cur.length ? <div className="grid gap-3 lg:grid-cols-3">{cur.map((p) => { const hc = histCat[p.cand ? catOf(p.cand.market === "h2h" ? { t: "h2h" } : p.cand.market === "totals" ? { t: "tot", u: "buts" } : p.cand.market === "spreads" ? { t: "spr" } : p.cand.market === "btts" ? { t: "btts" } : p.cand.market === "dc" ? { t: "dc" } : { t: "dnb" }, p.match.sport) : ""]; return (
          <Link key={p.id} href={`/match/${encodeURIComponent(p.match.id)}`} className="card card-link block space-y-1.5 p-4">
            <div className="text-xs text-muted">{p.match.league} · {fmtDateTime(p.match.start)}</div>
            <div className="text-sm text-muted">{p.match.home} – {p.match.away}</div>
            <div className="text-base font-extrabold">{p.label}</div>
            <div className="num text-sm"><b className="text-good">{pc(p.outcome.probAdj)}</b> · cote {odd(p.outcome.best.odds)} {p.outcome.best.book} · {"★".repeat(p.stars)}</div>
            <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted">{p.lines.slice(0, 3).map((l) => <li key={l.label}><b>{l.label} :</b> {l.text}</li>)}</ul>
            <div className="text-[11px] text-muted">{hc && hc.n >= MIN_N ? `Historique FightEdge sur ce marché : ${hc.n} paris, ROI ${hc.roi != null ? f1(hc.roi) + " %" : "—"}.` : "Historique FightEdge sur ce marché : pas encore assez de paris pour conclure."}</div>
          </Link>); })}</div> : <p className="card p-4 text-sm text-muted">Aucun pari ne passe actuellement le filtre de qualité (fiabilité ≥ 3 étoiles, probabilité ≥ 45 %, pas de cote sous la cote juste). Ne pas parier est une décision valable.</p>}
        <div className="grid gap-3 md:grid-cols-3 text-xs">
          <div className="card p-4"><b>Marchés les plus réguliers</b>{trusted.length ? <ul className="mt-1">{trusted.map((t) => <li key={t.key}>{t.key} : {pc(t.hit)} de réussite ({t.n} paris)</li>)}</ul> : <p className="mt-1 text-muted">Il faut au moins {MIN_N} paris réglés par marché.</p>}</div>
          <div className="card p-4"><b>Marchés à forte incertitude</b>{doubt.length ? <ul className="mt-1">{doubt.map((t) => <li key={t.key}>{t.key} : ROI {f1(t.roi)} % sur {t.n} paris</li>)}</ul> : <p className="mt-1 text-muted">Aucun marché clairement déficitaire (≥ {MIN_N} paris et ROI sous −10 %).</p>}</div>
          <div className="card p-4"><b>Tendance des dernières semaines</b>{weeks.length ? <ul className="mt-1">{weeks.slice(0, 4).map((w) => <li key={w.week}>{w.week.split("-").reverse().join("/")} : <span className={tone(w.profit)}>{w.nMoney ? eur(w.profit) : "en attente"}</span></li>)}</ul> : <p className="mt-1 text-muted">Pas encore de semaine complète.</p>}</div>
        </div>
      </section>

      <section id="amelioration" className="scroll-mt-40 card space-y-2 p-4 text-sm sm:p-5">
        <h2 className="text-lg font-extrabold">Amélioration continue du modèle</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-xs leading-relaxed text-muted">
          <li><b className="text-ink">Version actuelle : v1.</b> Probabilités = consensus des bookmakers étrangers (marge retirée) ajusté de 3 points au maximum par la forme récente ; buts par modèle de Poisson ; sets par modèle de tennis. Chaque pronostic enregistre la version du modèle qui l&apos;a produit.</li>
          <li><b className="text-ink">Aucune modification automatique.</b> Une mauvaise semaine ne change rien : la variance du pari sportif est forte. Un recalibrage n&apos;est envisagé que si une catégorie compte au moins 30 paris réglés et un écart de calibration durable, puis il doit être testé sur des matchs que le modèle n&apos;a pas vus et comparé avant/après.</li>
          <li><b className="text-ink">Historique des versions :</b> v1 (novembre 2026) — première version suivie. Les prochaines versions seront listées ici avec leurs résultats avant et après modification.</li>
          <li><b className="text-ink">Transparence :</b> les commentaires de ce bilan sont générés par des règles à partir des chiffres enregistrés, pas inventés ; ils signalent quand l&apos;échantillon est trop petit.</li>
        </ul>
      </section>

      <section id="historique" className="scroll-mt-40 space-y-3">
        <h2 className="text-xl font-extrabold">Historique des pronostics ({hist.length})</h2>
        <div className="space-y-2">
          <div className="flex gap-2 overflow-x-auto pb-1">{chip(qs({ st: "", page: "" }), "Tous statuts", !sp.st)}{Object.entries(STATUS).map(([k, l]) => chip(qs({ st: k, page: "" }), l, sp.st === k))}{chip(qs({ v: sp.v === "1" ? "" : "1", page: "" }), "Value bets", sp.v === "1")}</div>
          <div className="flex gap-2 overflow-x-auto pb-1">{chip(qs({ sport: "", page: "" }), "Tous sports", !sp.sport)}{sports.map((s) => chip(qs({ sport: s, page: "" }), sportLabel(s), sp.sport === s))}</div>
          <div className="flex gap-2 overflow-x-auto pb-1">{chip(qs({ cat: "", page: "" }), "Tous marchés", !sp.cat)}{cats.map((c) => chip(qs({ cat: c, page: "" }), c, sp.cat === c))}</div>
        </div>
        {pageItems.length === 0 ? <p className="card p-4 text-sm text-muted">Aucun pronostic ne correspond à ces filtres.</p> : (
          <div className="card overflow-x-auto p-2 sm:p-3">
            <table className="num w-full min-w-[820px] text-left text-xs">
              <thead className="text-[11px] text-muted"><tr className="border-b border-line"><th className="py-2 pr-2">Match</th><th>Pari</th><th>Cote</th><th>Proba</th><th>Value</th><th>Fiab.</th><th>Publié</th><th>Statut</th><th>Gain</th></tr></thead>
              <tbody>{pageItems.map((r) => { const p = profitOf(r, stake); return (
                <tr key={r.id} className="border-b border-line/60 align-top">
                  <td className="py-2 pr-2"><Link href={`/match/${encodeURIComponent(r.matchId)}`} className="font-semibold hover:underline">{r.home} – {r.away}</Link><div className="text-[11px] text-muted">{SPORTS[r.sport]?.icon} {r.league} · {fmtDateTime(r.start)}{r.score ? ` · ${r.score}` : ""}</div></td>
                  <td>{r.selection}<div className="text-[11px] text-muted">{r.cat}</div></td>
                  <td>{r.odds != null ? <>{odd(r.odds)}<div className="text-[11px] text-muted">{r.book}</div></> : <span className="text-muted">Non dispo.</span>}</td>
                  <td>{r.prob != null ? pc(r.prob) : "—"}</td>
                  <td className={tone(r.value)}>{r.value != null ? `${r.value > 0 ? "+" : ""}${f1(r.value * 100)} %` : "—"}</td>
                  <td>{r.rel ? "★".repeat(r.rel) : "—"}</td>
                  <td className="text-[11px] text-muted">{fmtDateTime(r.publishedAt)}</td>
                  <td><span className={`rounded-full px-2 py-0.5 font-bold ${r.status === "won" ? "bg-good/15 text-good" : r.status === "lost" ? "bg-bad/15 text-bad" : "bg-card2 text-muted"}`}>{STATUS[r.status]}</span></td>
                  <td className={`font-bold ${tone(p)}`}>{p != null && r.status !== "pending" ? eur(p) : "—"}</td>
                </tr>); })}</tbody>
            </table>
          </div>
        )}
        {hist.length > PAGE && <div className="flex items-center gap-3 text-sm">{pg > 1 && <Link className="font-bold text-brand" href={qs({ page: String(pg - 1) })}>← Précédent</Link>}<span className="text-muted">Page {pg} / {Math.ceil(hist.length / PAGE)}</span>{pg * PAGE < hist.length && <Link className="font-bold text-brand" href={qs({ page: String(pg + 1) })}>Suivant →</Link>}</div>}
      </section>
      {storeOn() && <PlayedBets />}
      <PronoLog rows={all.slice().sort((a, b) => String(b.start).localeCompare(String(a.start))).slice(0, 80)} />
    </div>
  );
}
