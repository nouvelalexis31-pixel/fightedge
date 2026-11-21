import Link from "next/link";
import { odd, pct, fmtDateTime } from "@/lib/format";
import { BookPills } from "./Ui";

export function GoalPicks({ picks }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight"><span className="h-3 w-3 rounded-full bg-sky-600" />Plus ou moins de 2,5 buts<span className="text-sm font-medium text-muted">{picks.length}</span></h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {picks.map((p) => (
          <article key={p.m.id} className="card card-link flex flex-col gap-3 p-4 sm:p-5">
            <div className="text-xs text-muted">{p.m.league} · {fmtDateTime(p.m.start)}</div>
            <div className="text-sm text-muted">{p.m.home} – {p.m.away}</div>
            <div className="flex items-end justify-between gap-3">
              <h3 className="text-lg font-extrabold leading-tight">{p.side === "over" ? "Plus de 2,5 buts" : "Moins de 2,5 buts"}</h3>
              <div className="text-right">
                <div className="num text-2xl font-extrabold text-good">{odd(p.o.best.odds)}</div>
                <div className="text-xs text-muted">environ {pct(p.prob)} de chances</div>
              </div>
            </div>
            <div className="pbar" aria-hidden><span style={{ width: `${Math.round(p.prob * 100)}%` }} /></div>
            <p className="text-sm text-muted">
              {p.side === "over" ? "Il faut au moins 3 buts dans le match." : "Il faut 2 buts ou moins dans le match."}
              {p.tempo ? ` Ces équipes jouent des matchs à environ ${String(p.tempo.toFixed(1)).replace(".", ",")} buts.` : ""}
              {p.other?.best ? ` L'issue inverse est à ${odd(p.other.best.odds)}.` : ""}
            </p>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <BookPills odds={p.o.odds} best={p.o.best} />
              <Link href={`/match/${encodeURIComponent(p.m.id)}`} className="text-sm font-bold text-brand hover:underline">Analyse complète →</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
