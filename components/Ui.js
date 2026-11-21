import { odd, pct } from "@/lib/format";
import { BOOKS_ORDER } from "@/lib/books";

export const KIND = {
  value: { label: "Plus-value", chip: "bg-good/10 text-good", dot: "bg-good", ring: "ring-1 ring-good/30" },
  mid: { label: "Cote équilibrée", chip: "bg-sky-100 text-sky-700", dot: "bg-sky-600", ring: "ring-1 ring-sky-300/50" },
  bold: { label: "Grosse cote probable", chip: "bg-orange-100 text-bold", dot: "bg-bold", ring: "ring-1 ring-bold/30" },
  safe: { label: "Favori solide", chip: "bg-brand/10 text-brand", dot: "bg-brand", ring: "" },
};

export function Stars({ n }) {
  return (
    <span className="text-sm font-bold tracking-tight text-amber-500" aria-label={`Confiance ${n} sur 5`}>
      {"★".repeat(n)}<span className="text-slate-200">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export function Stat({ l, v, tone = "" }) {
  return (
    <div className="rounded-2xl bg-card2 px-2 py-2.5 text-center">
      <div className="truncate text-[11px] font-medium text-muted">{l}</div>
      <div className={`num mt-0.5 text-lg font-extrabold ${tone}`}>{v}</div>
    </div>
  );
}

export function ProbBar({ p }) {
  return <div className="pbar" aria-hidden><span style={{ width: `${Math.round(Math.min(1, Math.max(0, p)) * 100)}%` }} /></div>;
}

// Pastilles des 3 bookmakers français (la meilleure en vert).
export function BookPills({ odds, best }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {BOOKS_ORDER.map((b) => (
        <span key={b} className={`num rounded-full border px-2.5 py-1 ${best?.book === b ? "border-good/40 bg-good/10 font-bold text-good" : "border-line bg-white text-muted"}`}>
          {b} {typeof odds[b] === "number" ? odd(odds[b]) : "Non dispo."}
        </span>
      ))}
    </div>
  );
}

// Tableau de cotes (vainqueur) : lignes = bookmakers, colonnes = issues.
export function OutcomeTable({ outcomes, home, away }) {
  const label = (o) => (o.name === home ? "1" : o.name === away ? "2" : o.name === "Match nul" ? "N" : o.name);
  return (
    <div className="overflow-x-auto">
      <table className="num w-full min-w-[300px] text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="py-1 pr-2 text-left font-medium"></th>
            {outcomes.map((o) => (
              <th key={o.name} className="px-1 text-center font-medium">
                <div className="truncate">{o.name}</div>
                {o.prob != null && <div className="font-normal opacity-80">{pct(o.prob)}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BOOKS_ORDER.map((b) => (
            <tr key={b} className="border-t border-line">
              <td className="py-2 pr-2 text-xs font-medium text-muted">{b}</td>
              {outcomes.map((o) => {
                const v = o.odds[b];
                const best = o.best && o.best.book === b;
                return (
                  <td key={o.name} className="px-1 py-1 text-center">
                    {typeof v === "number" ? <span className={`inline-block min-w-[3.2rem] rounded-lg px-2 py-1 ${best ? "bg-good/15 font-bold text-good" : ""}`}>{odd(v)}</span> : <span className="text-xs text-muted">n/d</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Tableau « plus / moins » pour une ligne de total.
export function TotalsTable({ t, unit }) {
  return (
    <div className="overflow-x-auto">
      <table className="num w-full min-w-[260px] text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="py-1 pr-2 text-left font-medium"></th>
            <th className="px-1 text-center font-medium"><div>Plus de {String(t.point).replace(".", ",")} {unit}</div><div className="font-normal opacity-80">{pct(t.over.prob)}</div></th>
            <th className="px-1 text-center font-medium"><div>Moins de {String(t.point).replace(".", ",")} {unit}</div><div className="font-normal opacity-80">{pct(t.under.prob)}</div></th>
          </tr>
        </thead>
        <tbody>
          {BOOKS_ORDER.map((b) => (
            <tr key={b} className="border-t border-line">
              <td className="py-2 pr-2 text-xs font-medium text-muted">{b}</td>
              {[t.over, t.under].map((o, i) => {
                const v = o.odds[b];
                const best = o.best && o.best.book === b;
                return (
                  <td key={i} className="px-1 py-1 text-center">
                    {typeof v === "number" ? <span className={`inline-block min-w-[3.2rem] rounded-lg px-2 py-1 ${best ? "bg-good/15 font-bold text-good" : ""}`}>{odd(v)}</span> : <span className="text-xs text-muted">n/d</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Tableau handicap : deux colonnes (équipe + ligne).
export function SpreadsTable({ t, home, away }) {
  const lab = (team, p) => `${team} ${p > 0 ? "+" : "−"}${String(Math.abs(p)).replace(".", ",")}`;
  return (
    <div className="overflow-x-auto">
      <table className="num w-full min-w-[260px] text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="py-1 pr-2 text-left font-medium"></th>
            <th className="px-1 text-center font-medium"><div className="truncate">{lab(home, t.point)}</div><div className="font-normal opacity-80">{pct(t.home.prob)}</div></th>
            <th className="px-1 text-center font-medium"><div className="truncate">{lab(away, -t.point)}</div><div className="font-normal opacity-80">{pct(t.away.prob)}</div></th>
          </tr>
        </thead>
        <tbody>
          {BOOKS_ORDER.map((b) => (
            <tr key={b} className="border-t border-line">
              <td className="py-2 pr-2 text-xs font-medium text-muted">{b}</td>
              {[t.home, t.away].map((o, i) => {
                const v = o.odds[b];
                const best = o.best && o.best.book === b;
                return (
                  <td key={i} className="px-1 py-1 text-center">
                    {typeof v === "number" ? <span className={`inline-block min-w-[3.2rem] rounded-lg px-2 py-1 ${best ? "bg-good/15 font-bold text-good" : ""}`}>{odd(v)}</span> : <span className="text-xs text-muted">n/d</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Marchés estimés par notre modèle : probabilité et cote juste (pas de cote de bookmaker).
export function ModelMarkets({ markets }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {markets.map((g) => (
        <div key={g.group} className="rounded-2xl bg-card2 p-3.5">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{g.group}</div>
          <ul className="space-y-1.5">
            {g.items.map((it) => (
              <li key={it.label} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">{it.label}</span>
                <span className="num shrink-0 text-right"><b>{pct(it.p)}</b><span className="ml-2 text-xs text-muted">cote juste {odd(it.fair)}</span></span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
