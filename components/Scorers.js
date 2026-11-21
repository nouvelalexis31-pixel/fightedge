import { odd } from "@/lib/format";
import { BOOKS_ORDER } from "@/lib/books";

// Cotes réelles des buteurs (football) ou marqueurs d'essais (rugby). Cotes uniquement, sans estimation.
export function Scorers({ m, limit = 12, compact = false }) {
  const ex = m.extras;
  if (!ex?.scorers?.length) return null;
  const rugby = ex.scorerKind === "try";
  const list = ex.scorers.slice(0, limit);
  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-extrabold">{rugby ? "Marqueur d'essai à tout moment" : "Buteur à tout moment"}</h3>
        {!compact && <span className="text-[11px] text-muted">{ex.scorersOnlyOthers ? "Betclic, Winamax et Unibet ne proposent pas ce marché dans nos données" : "Cotes françaises · les plus basses = les plus probables"}</span>}
      </div>
      {ex.scorersOnlyOthers && <p className="mt-2 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">Cotes d'autres opérateurs européens, à titre indicatif : elles ne sont pas forcément disponibles en France.</p>}
      <ul className="mt-3 divide-y divide-line">
        {list.map((p) => (
          <li key={p.name} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span className="min-w-0 truncate font-semibold">{p.name}</span>
            {ex.scorersOnlyOthers ? (
              <span className="num text-xs text-muted">{p.other.book} <b className="text-ink">{odd(p.other.price)}</b></span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs">
                {BOOKS_ORDER.map((b) => (
                  <span key={b} className={`num rounded-full border px-2 py-0.5 ${p.best?.book === b ? "border-good/40 bg-good/10 font-bold text-good" : "border-line bg-white text-muted"}`}>
                    {compact ? "" : b + " "}{typeof p.fr[b] === "number" ? odd(p.fr[b]) : "Non dispo."}
                  </span>
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
