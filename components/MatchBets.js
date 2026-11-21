import { odd, pct } from "@/lib/format";

const FLAME = (n) => "🔥".repeat(n);

export function MatchBets({ groups }) {
  if (!groups?.length) return <p className="card p-4 text-sm text-muted">Pas assez de données de marché pour proposer des paris sur ce match.</p>;
  return (
    <div className="space-y-3">
      {groups.map((g, gi) => (
        <details key={g.title} open={gi < 3} className="card group overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
            <span className="text-base font-extrabold">{g.title} <span className="text-muted">({g.items.length})</span></span>
            <span className="num shrink-0 text-xs font-semibold text-muted">{g.items.length > 1 && g.hi - g.lo > 0.005 ? `${odd(g.lo)} – ${odd(g.hi)}` : odd(g.lo)}</span>
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {g.items.map((it, i) => (
              <li key={it.label} className={`flex items-start justify-between gap-3 px-4 py-3 sm:px-5 ${i === 0 ? "bg-good/5" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-extrabold leading-snug">{it.flames > 0 && <span className="mr-1.5" aria-label="issue probable">{FLAME(it.flames)}</span>}{it.label}</div>
                  <p className="mt-1 text-xs leading-relaxed text-ink/70">{it.why}</p>
                </div>
                <div className="num shrink-0 text-right">
                  <div className="text-lg font-extrabold leading-none">{it.best ? odd(it.best.odds) : <span className="text-muted">≈ {odd(it.fair)}</span>}</div>
                  <div className="mt-1 text-[11px] text-muted">{it.best ? it.best.book : "cote juste"}</div>
                  <div className="mt-0.5 text-[11px] font-bold text-good">{pct(it.p)}</div>
                </div>
              </li>
            ))}
          </ul>
        </details>
      ))}
      <p className="px-1 text-[11px] leading-relaxed text-muted">🔥 = issue très probable (🔥🔥🔥 ≥ 75 %, 🔥🔥 ≥ 62 %, 🔥 ≥ 50 %). Les paris d'un même match sont choisis pour être compatibles entre eux. « Cote juste » = cote correspondant à notre probabilité : si votre bookmaker propose plus, le pari est intéressant.</p>
    </div>
  );
}
