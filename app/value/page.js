import Link from "next/link";
import { SPORTS } from "@/lib/odds";
import { loadEnriched } from "@/lib/data";
import { BOOKS_ORDER } from "@/lib/books";
import { valueRows, parseT, TIERS, DEFAULT_T } from "@/lib/valuebets";
import { Setup } from "@/components/Setup";
import { Stars, Stat } from "@/components/Ui";
import { fmtDateTime, odd, pct, signed } from "@/lib/format";

export const metadata = { title: "Value bets" };
export const dynamic = "force-dynamic";

const WHEN = [["", "7 jours"], ["24", "24 h"], ["48", "48 h"]];

export default async function Value({ searchParams }) {
  const sq = await searchParams;
  const { sport, h, lv } = sq;
  const tq = sq.t0 ? [sq.t0, sq.t1, sq.t2, sq.t3].join(",") : sq.t;
  const data = await loadEnriched();
  if (data.error && data.matches.length === 0) return <Setup msg={data.error} />;
  const T = parseT(tq);
  const custom = T.join(",") !== DEFAULT_T.join(",");
  const hours = h === "24" || h === "48" ? Number(h) : 168;
  const minTier = ["0", "1", "2"].includes(lv) ? Number(lv) : 3;
  const rows = valueRows(data.matches, { hours, sport, t: T, minTier });
  const shown = rows.slice(0, 40);
  const counts = TIERS.map((_, i) => valueRows(data.matches, { hours, sport, t: T, minTier: i }).filter((r) => TIERS.indexOf(r.tier) === i).length);
  const href = (o) => { const q = new URLSearchParams(); const s = o.sport !== undefined ? o.sport : sport || ""; const w = o.h !== undefined ? o.h : h || ""; const l = o.lv !== undefined ? o.lv : lv || ""; if (s) q.set("sport", s); if (w) q.set("h", w); if (l) q.set("lv", l); if (custom) q.set("t", T.join(",")); const x = q.toString(); return x ? `/value?${x}` : "/value"; };
  const chip = (to, label, active) => <Link key={label} href={to} className={`tab shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? "border-navy bg-navy text-white" : "border-line bg-white text-muted hover:text-ink"}`}>{label}</Link>;
  const sports = Object.entries(SPORTS).filter(([k]) => data.matches.some((m) => m.sport === k));
  const bounds = [`≥ ${T[0]} %`, `${T[1]} à ${T[0]} %`, `${T[2]} à ${T[1]} %`, `${T[3]} à ${T[2]} %`];
  return (
    <div className="space-y-6">
      <section className="hero p-6 sm:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Value bets</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">Une cote est une « value » quand elle est plus haute que la cote que mérite la probabilité estimée. Une value n'est jamais un pari garanti : c'est un avantage moyen estimé sur un grand nombre de paris.</p>
        <ul className="num mt-4 grid gap-x-6 gap-y-1 text-xs text-muted sm:grid-cols-3">
          <li>Probabilité implicite = 1 ÷ cote</li>
          <li>Cote théorique = 1 ÷ probabilité estimée</li>
          <li>Value % = (probabilité × cote − 1) × 100</li>
        </ul>
        <p className="mt-3 text-[11px] text-muted">Cotes relevées {data.fetchedAt ? fmtDateTime(data.fetchedAt) : "récemment"}. Le score de fiabilité mesure la solidité de l'estimation (accord des bookmakers, forme, probabilité), pas la probabilité de gagner, et il est indépendant de la value.</p>
      </section>
      <div className="space-y-2">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">{chip(href({ lv: "" }), "Toutes les values", !lv)}{TIERS.slice(0, 3).map((x, i) => chip(href({ lv: String(i) }), `${x.label} (${counts[i]})`, lv === String(i)))}</div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">{chip(href({ sport: "" }), "Tous les sports", !sport)}{sports.map(([k, s]) => chip(href({ sport: k }), `${s.icon} ${s.label}`, sport === k))}</div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">{WHEN.map(([k, l]) => chip(href({ h: k }), l, (h || "") === k))}</div>
        <details className="card px-4 py-3 text-sm">
          <summary className="cursor-pointer text-xs font-bold text-brand">Paliers de value ({bounds.join(" · ")}) — modifier les seuils</summary>
          <form action="/value" className="mt-3 flex flex-wrap items-end gap-3 text-xs">
            {sport ? <input type="hidden" name="sport" value={sport} /> : null}
            {h ? <input type="hidden" name="h" value={h} /> : null}
            <label className="grid gap-1">Exceptionnelle dès<input type="number" step="0.5" min="1" max="100" defaultValue={T[0]} name="t0" className="w-24 rounded-lg border border-line px-2 py-1" /></label>
            <label className="grid gap-1">Très bonne dès<input type="number" step="0.5" min="1" max="100" defaultValue={T[1]} name="t1" className="w-24 rounded-lg border border-line px-2 py-1" /></label>
            <label className="grid gap-1">Bonne dès<input type="number" step="0.5" min="0.5" max="100" defaultValue={T[2]} name="t2" className="w-24 rounded-lg border border-line px-2 py-1" /></label>
            <label className="grid gap-1">Faible dès<input type="number" step="0.5" min="0.5" max="100" defaultValue={T[3]} name="t3" className="w-24 rounded-lg border border-line px-2 py-1" /></label>
            <button className="rounded-full bg-navy px-4 py-2 font-bold text-white">Appliquer</button>
            <Link href="/value" className="py-2 font-bold text-brand">Valeurs par défaut (15 / 10 / 5 / 1)</Link>
          </form>
          <p className="mt-2 text-[11px] text-muted">Valeur ≤ 0 % : aucun avantage, jamais affichée. Défaut : exceptionnelle ≥ 15 %, très bonne 10 à 14,99 %, bonne 5 à 9,99 %, faible 1 à 4,99 %.</p>
        </details>
      </div>
      {shown.length === 0 ? (
        <p className="card p-5 text-sm text-muted">Aucune value bet détectée pour ce filtre. C'est fréquent : les cotes des bookmakers sont le plus souvent proches de la cote juste.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map(({ m, c, o, value, k, tier }) => (
            <article key={k.id} className="card flex flex-col gap-3 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 text-xs text-muted">
                <span className="truncate">{SPORTS[m.sport].icon} {m.league} · {fmtDateTime(m.start)}</span>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${tier.cls}`}>{tier.label}</span>
              </div>
              <Link href={`/match/${encodeURIComponent(m.id)}`} className="text-sm font-semibold text-muted hover:underline">{m.home} – {m.away}</Link>
              <div><h3 className="text-lg font-extrabold leading-tight">{c.label}</h3><div className="text-xs text-muted">Marché : {c.marketLabel}</div></div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <Stat l={`Meilleure cote · ${o.best.book}`} v={odd(o.best.odds)} tone="text-brand" />
                <Stat l="Proba estimée" v={pct(o.probAdj)} />
                <Stat l="Proba implicite" v={pct(1 / o.best.odds)} />
                <Stat l="Cote théorique" v={odd(1 / o.probAdj)} />
                <Stat l="Value" v={signed(value)} tone="text-good" />
                <Stat l="Fiabilité" v={`${k.stars * 20}/100`} />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted"><Stars n={k.stars} /><span>Score de fiabilité indépendant de la value</span></div>
              <div className="num flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                {BOOKS_ORDER.map((b) => <span key={b} className={o.best.book === b ? "font-bold text-good" : ""}>{b} {typeof o.odds[b] === "number" ? odd(o.odds[b]) : "Non dispo."}</span>)}
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-xs font-bold text-brand">Arguments et risques</summary>
                <ul className="mt-2 space-y-1.5">{k.lines.map((l) => <li key={l.label}><b>{l.label} :</b> <span className="text-muted">{l.text}</span></li>)}</ul>
                <p className="mt-2 text-xs text-muted">Risque : si le marché a raison (ce qui arrive souvent), ce pari n'a aucun avantage. Le résultat d'un match isolé reste très aléatoire.</p>
              </details>
              <div className="text-[11px] text-muted">Mis à jour {data.fetchedAt ? fmtDateTime(data.fetchedAt) : ""} · {c.nBooks} bookmakers de référence</div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
