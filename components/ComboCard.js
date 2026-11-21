import { odd, pct, signed, fmtDateTime } from "@/lib/format";
import { BookPills, ProbBar, Stars, Stat } from "./Ui";

const TONE = {
  sure: { chip: "bg-indigo-100 text-indigo-700", ring: "ring-1 ring-indigo-300/50", txt: "Peu de paris, tous probables : le plus réaliste." },
  balanced: { chip: "bg-sky-100 text-sky-700", ring: "ring-1 ring-sky-300/50", txt: "Trois paris pour une cote totale intéressante." },
  bold: { chip: "bg-orange-100 text-bold", ring: "ring-1 ring-bold/30", txt: "Grosse cote, peu de chances : mise très réduite." },
};

export function ComboCard({ c, icons = {} }) {
  const t = TONE[c.tier];
  const best = { book: c.book, odds: c.odds };
  return (
    <article className={`card flex flex-col gap-3.5 p-4 sm:p-5 ${t.ring}`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-extrabold">{c.label}</h3>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${t.chip}`}>{c.legs.length} paris</span>
      </div>
      <p className="-mt-2 text-xs text-muted">{t.txt}</p>
      <ol className="space-y-2">
        {c.legs.map((l, i) => (
          <li key={l.id} className="flex items-start gap-3 rounded-2xl bg-card2 px-3 py-2.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-xs font-extrabold text-brand shadow-sm">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-muted">{icons[l.match.sport]} {l.match.league} · {fmtDateTime(l.match.start)}</div>
              <div className="text-sm text-muted">{l.match.home} – {l.match.away}</div>
              <div className="font-bold leading-tight">{l.label}</div>
            </div>
            <div className="num shrink-0 text-right">
              <div className="text-base font-extrabold">{odd(l.outcome.odds[c.book])}</div>
              <div className="text-[11px] text-muted">{pct(l.outcome.probAdj)}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat l={`Cote ${c.book}`} v={odd(c.odds)} tone="text-brand" />
        <Stat l="Chance de passer" v={pct(c.prob)} />
        <Stat l="Avantage" v={c.ev >= 0.02 ? signed(c.ev) : c.ev >= -0.02 ? "≈ 0" : signed(c.ev)} tone={c.ev >= 0.02 ? "text-good" : ""} />
        <div className="rounded-2xl bg-card2 px-2 py-2.5 text-center">
          <div className="text-[11px] font-medium text-muted">Confiance</div>
          <div className="mt-1.5"><Stars n={c.stars} /></div>
        </div>
      </div>
      <ProbBar p={Math.min(1, c.prob * 2)} />
      <div className="border-t border-line pt-3"><BookPills odds={c.perBook} best={best} /></div>
      <p className="rounded-xl bg-card2 px-3 py-2 text-[11px] leading-relaxed text-muted"><b className="text-ink">Risques :</b> {pct(1 - c.prob)} de perdre la mise ; {c.legs.length} sélections à réussir ensemble, la marge du bookmaker se cumule. <b className="text-ink">Corrélations :</b> un seul pari par match, donc aucun événement lié du même match ; des matchs d'une même compétition le même jour peuvent partager des effets non modélisés.</p>
      <p className="text-[11px] leading-relaxed text-muted">Tous les paris doivent passer. Cote totale = produit des cotes chez le même opérateur ; chances = produit des probabilités estimées (matchs indépendants).</p>
    </article>
  );
}
