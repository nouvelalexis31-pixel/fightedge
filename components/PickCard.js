import Link from "next/link";
import { odd, pct, signed, fmtDateTime } from "@/lib/format";
import { FormDots } from "./FormDots";
import { KIND, ProbBar, Stars, Stat } from "./Ui";
import { pickBook, oddOf } from "@/lib/books";
import { Team } from "./Team";
import { whyLines } from "@/lib/why";

// Phrase « Pourquoi ce choix ? » : uniquement à partir des chiffres de ce pari (jamais de texte générique).
function why(p) {
  const o = p.outcome, m = p.match;
  const parts = [];
  const first = (p.lines || []).find((l) => l.text);
  const fm = m.form, ft = (nm, f) => { const n = f?.n || (f?.seq || []).length; if (!n) return null; const v = (f.seq || []).filter((z) => z === "V" || z === "W").length; const r = (f.pts ?? 0) / (3 * n); return nm + " " + (r >= 0.6 ? "est en forme" : r <= 0.34 ? "est en méforme" : "a une forme moyenne") + " (" + v + " victoire" + (v > 1 ? "s" : "") + " sur ses " + n + " derniers matchs)"; };
  const fh0 = fm ? ft(m.home, fm.home) : null, fa0 = fm ? ft(m.away, fm.away) : null;
  if (fh0 && fa0) parts.push(fh0 + ", " + fa0 + ".");
  else if (first) { const t = String(first.text).split(/(?<=[.!?])\s+/).slice(0, 2).join(" "); parts.push(t); }
  if (o.prob != null && o.prob >= 0.5) parts.push("La plupart des pronostiqueurs et des bookmakers voient « " + p.label + " » comme probable : " + pct(o.prob) + " selon le consensus des cotes du marché.");
  const bk = pickBook([o]) || o.best?.book, pr = oddOf(o, bk) ?? o.best?.odds;
  if (o.probAdj != null && pr) { const e = o.probAdj * pr - 1; parts.push(`Notre modèle estime ${pct(o.probAdj)} de chances, soit une cote théorique de ${odd(1 / o.probAdj)} ; ${bk} propose ${odd(pr)}${e >= 0.02 ? ", donc une valeur positive (" + signed(e) + ")" : e >= -0.02 ? ", un prix proche de la valeur juste" : ", un prix en dessous de la valeur juste"}.`); }
  const risk = p.suspicious ? "Écart de cote inhabituel : vérifiez-la avant de jouer." : !m.form ? "Forme récente non disponible pour ce match : estimation basée sur les cotes seulement." : o.probAdj < 0.4 ? "Issue peu probable : variance élevée." : null;
  return { text: parts.join(" "), risk, fair: o.probAdj ? 1 / o.probAdj : null };
}

export function PickCard({ p, rank, icon, compact = false, noLink = false }) {
  const { match: m, outcome: o } = p;
  const k = KIND[p.kind];
  const href = `/match/${encodeURIComponent(m.id)}`;
  const book = pickBook([o]) || o.best.book;
  const price = oddOf(o, book) ?? o.best.odds;
  const ev = o.probAdj != null ? o.probAdj * price - 1 : o.evAdj;
  const lg = m.logos || null;
  return (
    <article className={`card card-link flex flex-col gap-3.5 p-4 sm:p-5 ${k.ring}`}>
      <div className="flex items-start gap-3">
        {rank != null && <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold text-white ${k.dot}`}>{rank}</div>}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-xs text-muted">
            <span className="truncate">{icon} {m.league} · {fmtDateTime(m.start)}</span>
            <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-bold ${k.chip}`}>{k.label}</span>
          </div>
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-start gap-2">
            <Team name={m.home} logo={lg?.homeCrest} size={36} />
            <span className="pt-2 text-xs font-semibold text-muted">vs</span>
            <Team name={m.away} logo={lg?.awayCrest} size={36} />
          </div>
          <h3 className="mt-2 text-lg font-extrabold leading-tight">{p.label}</h3>
          <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted">{p.marketLabel}</div>
        </div>
      </div>

      <div className={`grid grid-cols-2 gap-2 ${compact ? "" : "sm:grid-cols-4"}`}>
        <Stat l={`Cote ${book}`} v={odd(price)} tone={p.kind === "bold" ? "text-bold" : p.kind === "mid" ? "text-sky-700" : "text-good"} />
        <Stat l="Notre proba" v={pct(o.probAdj)} />
        <Stat l="Avantage" v={ev >= 0.02 ? signed(ev) : ev >= -0.02 ? "≈ 0" : signed(ev)} tone={ev >= 0.02 ? "text-good" : ""} />
        <div className="rounded-2xl bg-card2 px-2 py-2.5 text-center">
          <div className="text-[11px] font-medium text-muted">Confiance</div>
          <div className="mt-1.5"><Stars n={p.stars} /></div>
        </div>
      </div>
      <ProbBar p={o.probAdj} />
      {(() => { const w = why(p); return (
        <div className="rounded-2xl border border-line bg-white p-3 text-sm leading-relaxed">
          <div className="text-xs font-extrabold text-brand">Pourquoi ce choix ?</div>
          {(() => { const L = p.cand ? whyLines(m, p.cand) : []; return L.length ? <ul className="mt-1 list-disc space-y-1 pl-4 text-ink/80">{L.map((t, i) => <li key={i}>{t}</li>)}</ul> : <p className="mt-1 text-ink/80">{w.text || "Données insuffisantes pour justifier ce pari au-delà de la cote."}</p>; })()}
          {w.risk && <p className="mt-1 text-xs text-warn">Risque : {w.risk}</p>}
        </div>
      ); })()}

      {!compact && (
        <ul className="space-y-2.5 text-sm">
          {p.lines.map((l) => (
            <li key={l.label} className="leading-relaxed">
              <span className="font-bold">{l.label} — </span><span className="text-ink/80">{l.text}</span>
              {l.form && (
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                  <span className="flex items-center gap-1.5">{m.home} <FormDots letters={l.form.home.letters} /></span>
                  <span className="flex items-center gap-1.5">{m.away} <FormDots letters={l.form.away.letters} /></span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <span className="text-xs text-muted">Cote {book}</span>
        {p.suspicious && <span className="rounded-full border border-warn/40 bg-warn/10 px-2.5 py-1 text-xs text-warn">Écart inhabituel : vérifiez la cote</span>}
        {!noLink && <Link href={href} className="text-sm font-bold text-brand hover:underline">Analyse complète →</Link>}
      </div>
    </article>
  );
}
