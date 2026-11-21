import { enough } from "@/lib/enough";
import Link from "next/link";
import { SPORTS } from "@/lib/odds";
import { fmtDateTime, odd, pct } from "@/lib/format";

// Vainqueurs probables (tous sports) : issue la plus probable, cote réelle, conseil de prudence.
export function winnerPicks(matches, now = Date.now()) {
  const eod = now + 40 * 3600e3;
  const out = [];
  for (const m of matches) {
    const t = +new Date(m.start);
    if (!enough(m) || t <= now || t > eod) continue;
    const outs = (m.outcomes || []).filter((x) => x.probAdj != null && x.best);
    const draw = outs.find((x) => x.name === "Match nul");
    const o = outs.filter((x) => x.name !== "Match nul").sort((a, b) => b.probAdj - a.probAdj)[0];
    if (!o || o.probAdj < 0.45 || o.best.odds < 1.25) continue;
    const dc = draw ? o.probAdj + draw.probAdj : null;
    const tips = [];
    if (o.evAdj >= 0.02) tips.push("La cote est au-dessus de la cote juste : le prix est intéressant.");
    else if (o.best.odds < 1.5) tips.push("Cote basse : mieux vaut l'associer à d'autres paris ou passer son tour.");
    if (draw && o.probAdj < 0.62) tips.push(`Plus prudent : « ${o.name} ou nul » (≈ ${pct(dc)} de chances).`);
    if (o.probAdj >= 0.62) tips.push("Favori net, mais un favori peut perdre : mise raisonnable.");
    out.push({ m, o, dc, tips, score: o.probAdj });
  }
  return out.sort((a, b) => String(a.m.start).localeCompare(String(b.m.start))).slice(0, 10);
}

export function WinnerPicks({ picks }) {
  if (!picks.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight"><span className="h-3 w-3 rounded-full bg-good" />Vainqueurs probables<span className="text-sm font-medium text-muted">{picks.length} matchs, dans l&apos;ordre</span></h2>
      <div className="grid gap-3 lg:grid-cols-2">
        {picks.map(({ m, o, tips }) => (
          <Link key={m.id} href={`/match/${encodeURIComponent(m.id)}`} className="card block space-y-1.5 p-4 transition hover:border-brand/40">
            <div className="text-xs text-muted">{SPORTS[m.sport]?.icon} {m.league} · {fmtDateTime(m.start)}</div>
            <div className="text-sm text-muted">{m.home} – {m.away}</div>
            <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-lg font-extrabold">{o.name} gagne</span><span className="num text-sm"><b className="text-good">{pct(o.probAdj)}</b> · cote <b>{odd(o.best.odds)}</b> {o.best.book}</span></div>
            <p className="text-xs leading-relaxed text-muted">{tips.join(" ") || `Consensus de ${m.nBooks} bookmakers.`}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
