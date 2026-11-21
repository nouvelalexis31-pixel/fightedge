import Link from "next/link";
import { fmtTime, odd, pt } from "@/lib/format";
import { unitOf } from "@/lib/analysis";
import { pickBook, oddOf } from "@/lib/books";
import { FavButton } from "./FavButton";
import { Team } from "./Team";

const rank = (o, m) => (o.name === m.home ? 0 : o.name === m.away ? 2 : 1);

export function MatchCard({ m, icon, info }) {
  const lg = info || m.logos || null;
  const outs = (m.outcomes || []).slice().sort((a, b) => rank(a, m) - rank(b, m));
  const book = pickBook(outs);
  const lab = (o) => (o.name === m.home ? "1" : o.name === m.away ? "2" : "N");
  const main = (m.totals || []).slice().sort((a, b) => Math.abs(a.over.prob - 0.5) - Math.abs(b.over.prob - 0.5))[0];
  const ov = main && oddOf(main.over, book), un = main && oddOf(main.under, book);
  return (
    <article className="card card-link relative p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-muted">
        <span className="truncate">{icon} {m.league}</span>
        <span className="flex shrink-0 items-center gap-1.5"><span className="num rounded-full bg-card2 px-2.5 py-0.5 font-bold text-ink">{fmtTime(m.start)}</span><FavButton id={m.id} /></span>
      </div>
      <Link href={`/match/${encodeURIComponent(m.id)}`} className="mt-3 grid grid-cols-[1fr_auto_1fr] items-start gap-2 after:absolute after:inset-0 after:content-['']">
        <Team name={m.home} logo={lg?.homeCrest} />
        <span className="pt-3 text-xs font-semibold text-muted">vs</span>
        <Team name={m.away} logo={lg?.awayCrest} />
      </Link>
      {book && outs.length > 0 && (
        <div className="mt-3">
          <div className={`grid gap-2 ${outs.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {outs.map((o) => (
              <div key={o.name} className="rounded-xl bg-card2 px-2 py-2 text-center">
                <div className="text-[11px] font-medium text-muted">{lab(o)}</div>
                <div className="num text-base font-extrabold">{odd(oddOf(o, book))}</div>
              </div>
            ))}
          </div>
          <p className="mt-1 text-right text-[10px] text-muted">Cotes {book}</p>
        </div>
      )}
      {!book && <p className="mt-3 rounded-xl bg-card2 px-3 py-2 text-center text-xs text-muted">Cotes non disponibles</p>}
      {main && (ov || un) && (
        <div className="mt-2 flex items-center justify-between rounded-xl bg-card2 px-3 py-2 text-xs">
          <span className="font-medium text-muted">Plus / moins de {pt(main.point)} {unitOf(m)}</span>
          <span className="num font-bold">{ov ? odd(ov) : "n/d"} <span className="text-muted">/</span> {un ? odd(un) : "n/d"}</span>
        </div>
      )}
    </article>
  );
}
