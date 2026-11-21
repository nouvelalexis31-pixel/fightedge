import Link from "next/link";
import { fmtTime, odd, pt } from "@/lib/format";
import { unitOf } from "@/lib/analysis";
import { pickBook, oddOf } from "@/lib/books";
import { FavButton } from "./FavButton";
import { Badge } from "./Team";

const rank = (o, m) => (o.name === m.home ? 0 : o.name === m.away ? 2 : 1);

// Une ligne de match : écussons et noms à gauche, heure ou score au centre, cotes 1 / N / 2 à droite, plus/moins de buts en dessous.
export function MatchRow({ r }) {
  const e = r.e;
  const live = r.state === "live", done = r.state === "done";
  const outs = e ? (e.outcomes || []).slice().sort((a, b) => rank(a, e) - rank(b, e)) : [];
  const book = e ? pickBook(outs) : null;
  const main = e ? (e.totals || []).slice().sort((a, b) => Math.abs(a.over.prob - 0.5) - Math.abs(b.over.prob - 0.5))[0] : null;
  const ov = main && oddOf(main.over, book), un = main && oddOf(main.under, book);
  const lab = (o) => (o.name === e.home ? "1" : o.name === e.away ? "2" : "N");
  const scored = r.h != null && r.a != null;
  const body = (
    <div className="px-3 py-3 sm:px-4">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2.5"><Badge src={r.hl} name={r.home} size={28} /><span className="truncate text-[15px] font-bold leading-tight">{r.home}</span></div>
          <div className="flex items-center gap-2.5"><Badge src={r.al} name={r.away} size={28} /><span className="truncate text-[15px] font-bold leading-tight">{r.away}</span></div>
        </div>
        <div className="w-16 shrink-0 text-center">
          {scored ? (
            <>
              <div className={`num text-lg font-extrabold leading-tight ${live ? "text-bad" : ""}`}>{r.h}<span className="mx-0.5 text-muted">-</span>{r.a}</div>
              <div className={`num text-[11px] font-semibold ${live ? "text-bad" : "text-muted"}`}>{live ? r.label : done ? "Terminé" : fmtTime(r.start)}</div>
            </>
          ) : (
            <>
              <div className="num text-base font-extrabold">{r.state === "off" ? "–" : fmtTime(r.start)}</div>
              {r.state === "off" && <div className="text-[11px] font-semibold text-muted">Reporté</div>}
            </>
          )}
        </div>
        <div className="w-[4.2rem] shrink-0">
          {book && outs.length > 0 ? (
            <div className="space-y-1">
              {outs.map((o) => (
                <div key={o.name} className="num flex items-baseline justify-between gap-1 rounded-md bg-card2 px-1.5 py-0.5 text-[13px]">
                  <span className="text-[10px] font-semibold text-muted">{lab(o)}</span><b>{odd(oddOf(o, book))}</b>
                </div>
              ))}
            </div>
          ) : e ? <div className="text-center text-[10px] text-muted">cotes n/d</div> : null}
        </div>
      </div>
      {e && (book || main) && (
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted">
          <span className="truncate">{main && (ov || un) ? `Plus / moins de ${pt(main.point)} ${unitOf(e)}` : ""}</span>
          <span className="num shrink-0">{main && (ov || un) ? <><b className="text-ink">{ov ? odd(ov) : "n/d"}</b> / <b className="text-ink">{un ? odd(un) : "n/d"}</b></> : null}{book ? <span className="ml-2">· {book}</span> : null}</span>
        </div>
      )}
      {!e && r.venue && <p className="mt-1.5 truncate text-[11px] text-muted">📍 {r.venue}</p>}
      {!e && r.sid && <p className="mt-1 text-[11px] font-bold text-brand">Analyse du match →</p>}
    </div>
  );
  return (
    <div className="relative flex items-stretch border-t border-line first:border-t-0">
      {e ? <div className="flex w-9 shrink-0 items-center justify-center"><FavButton id={e.id} /></div> : <div className="w-3 shrink-0" />}
      <div className="min-w-0 flex-1">
        {e ? <Link href={`/match/${encodeURIComponent(e.id)}`} className="block transition hover:bg-card2/50">{body}</Link> : r.sid ? <Link href={`/match/${r.sid}`} className="block transition hover:bg-card2/50">{body}</Link> : body}
      </div>
    </div>
  );
}
