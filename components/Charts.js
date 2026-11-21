import { eur, dayKey, addDays, monthKey } from "@/lib/perf";

const pos = "var(--color-good)", neg = "var(--color-bad)";
const fmtDay = (t) => new Date(t).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", timeZone: "Europe/Paris" });

// Courbe de bankroll
export function LineChart({ pts, base, h = 220 }) {
  if (!pts || pts.length < 2) return <div className="grid h-40 place-items-center rounded-2xl bg-card2 text-sm text-muted">La courbe apparaîtra dès les premiers paris réglés.</div>;
  const W = 640, H = h, pad = { l: 52, r: 12, t: 12, b: 24 };
  const ys = pts.map((p) => p.y).concat(base);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi - lo < 1) { hi += 1; lo -= 1; }
  const m = (hi - lo) * 0.1; lo -= m; hi += m;
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t || t0 + 1;
  const X = (t) => pad.l + ((t - t0) / Math.max(1, t1 - t0)) * (W - pad.l - pad.r);
  const Y = (y) => pad.t + (1 - (y - lo) / (hi - lo)) * (H - pad.t - pad.b);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${X(p.t).toFixed(1)},${Y(p.y).toFixed(1)}`).join("");
  const last = pts[pts.length - 1];
  const up = last.y >= base;
  const area = `${d}L${X(last.t).toFixed(1)},${Y(base).toFixed(1)}L${X(t0).toFixed(1)},${Y(base).toFixed(1)}Z`;
  const ticks = [lo + m, (lo + hi) / 2, hi - m];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Évolution de la bankroll virtuelle : ${Math.round(last.y)} €`}>
      {ticks.map((v, i) => <g key={i}><line x1={pad.l} x2={W - pad.r} y1={Y(v)} y2={Y(v)} stroke="currentColor" strokeOpacity="0.08" /><text x={pad.l - 6} y={Y(v) + 4} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.55">{Math.round(v)} €</text></g>)}
      <line x1={pad.l} x2={W - pad.r} y1={Y(base)} y2={Y(base)} stroke="currentColor" strokeOpacity="0.35" strokeDasharray="4 4" />
      <path d={area} fill={up ? pos : neg} opacity="0.12" />
      <path d={d} fill="none" stroke={up ? pos : neg} strokeWidth="2.2" strokeLinejoin="round" />
      <circle cx={X(last.t)} cy={Y(last.y)} r="4" fill={up ? pos : neg} />
      <text x={pad.l} y={H - 6} fontSize="11" fill="currentColor" opacity="0.55">{fmtDay(t0)}</text>
      <text x={W - pad.r} y={H - 6} textAnchor="end" fontSize="11" fill="currentColor" opacity="0.55">{fmtDay(t1)}</text>
    </svg>
  );
}

// Barres horizontales de bénéfice (positives vers la droite, négatives vers la gauche)
export function ProfitBars({ rows }) {
  const rs = rows.filter((r) => r.nMoney > 0);
  if (!rs.length) return <p className="text-sm text-muted">Pas encore de pari réglé dans cette catégorie.</p>;
  const mx = Math.max(...rs.map((r) => Math.abs(r.profit)), 1);
  return (
    <ul className="space-y-1.5">
      {rs.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,9rem)_1fr_4.5rem] items-center gap-2 text-xs sm:grid-cols-[minmax(0,12rem)_1fr_5rem]">
          <span className="truncate font-semibold" title={r.key}>{r.key}</span>
          <span className="relative h-4 rounded bg-card2">
            <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
            <span className="absolute inset-y-0 rounded" style={{ background: r.profit >= 0 ? pos : neg, opacity: r.low ? 0.45 : 1, ...(r.profit >= 0 ? { left: "50%", width: `${(r.profit / mx) * 50}%` } : { right: "50%", width: `${(-r.profit / mx) * 50}%` }) }} />
          </span>
          <span className={`num text-right font-bold ${r.profit > 0 ? "text-good" : r.profit < 0 ? "text-bad" : ""}`}>{eur(r.profit, 0)}</span>
        </li>
      ))}
    </ul>
  );
}

// Calendrier mensuel des résultats
export function Calendar({ month, days, today }) {
  const first = month + "-01";
  const wd = (new Date(first + "T12:00:00Z").getUTCDay() + 6) % 7;
  const n = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const cells = [...Array(wd).fill(null), ...Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const title = new Date(first + "T12:00:00Z").toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <div>
      <div className="mb-2 text-sm font-bold capitalize">{title}</div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
        {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => <div key={i} className="font-semibold text-muted">{d}</div>)}
        {cells.map((k, i) => {
          if (!k) return <div key={i} />;
          const d = days[k];
          const tone = !d ? "bg-card2 text-muted" : d.profit > 0 ? "bg-good/15 text-good" : d.profit < 0 ? "bg-bad/15 text-bad" : "bg-card2 text-ink";
          return (
            <div key={i} title={d ? `${d.n} pari(s) : ${eur(d.profit)}` : ""} className={`rounded-lg px-0.5 py-1.5 ${tone} ${k === today ? "ring-2 ring-brand/50" : ""}`}>
              <div className="text-[10px] opacity-70">{Number(k.slice(8))}</div>
              <div className="num text-[11px] font-bold leading-tight">{d ? eur(d.profit, 0).replace(" €", "") : "·"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
