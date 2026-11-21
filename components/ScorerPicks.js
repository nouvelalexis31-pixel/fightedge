import Link from "next/link";
import { odd, pct, fmtDateTime } from "@/lib/format";
import { BookPills } from "./Ui";

function advice(p) {
  const a = [];
  a.push(p.prob >= 0.4 ? "Un des buteurs les plus probables du match." : p.prob >= 0.3 ? "Candidat sérieux pour marquer." : "Pari plus risqué : moins d'une chance sur trois de marquer.");
  if (p.ev >= 0.02) a.push("La cote est au-dessus de la cote juste : le prix est intéressant.");
  else if (p.ev <= -0.06) a.push("La cote est un peu basse : comparez avec les autres bookmakers.");
  a.push(p.prob >= 0.4 ? "Idéal pour un combiné prudent ou une petite mise." : "Petite mise seulement : un buteur reste très aléatoire.");
  return a.join(" ");
}
export function ScorerPicks({ picks }) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight"><span className="h-3 w-3 rounded-full bg-amber-500" />Buteurs : cotes et conseils<span className="text-sm font-medium text-muted">{picks.length}</span></h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {picks.map((p) => (
          <article key={p.m.id + p.name} className="card card-link flex flex-col gap-3 p-4 sm:p-5">
            <div className="text-xs text-muted">{p.m.league} · {fmtDateTime(p.m.start)}</div>
            <div className="text-sm text-muted">{p.m.home} – {p.m.away}</div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold leading-tight">{p.name}</h3>
                <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{p.kind === "try" ? "Marque un essai" : "Marque à tout moment"}</div>
              </div>
              <div className="text-right">
                <div className="num text-2xl font-extrabold text-good">{odd(p.best.odds)}</div>
                <div className="text-xs text-muted">environ {pct(p.prob)} de chances</div>
              </div>
            </div>
            <p className="text-xs leading-relaxed text-ink/80"><b>Conseil :</b> {advice(p)}</p>
            <div className="pbar" aria-hidden><span style={{ width: `${Math.round(p.prob * 100)}%` }} /></div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <BookPills odds={p.fr} best={p.best} />
              <Link href={`/match/${encodeURIComponent(p.m.id)}`} className="text-sm font-bold text-brand hover:underline">Analyse complète →</Link>
            </div>
          </article>
        ))}
      </div>
      <p className="text-xs text-muted">Probabilité estimée d'après les cotes des bookmakers hors France (marge retirée en gros). Les buteurs restent très aléatoires : petite mise.</p>
    </section>
  );
}
