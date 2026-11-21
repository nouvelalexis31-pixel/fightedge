// Composition d'équipe sur un terrain (données football-data.org, quand elles sont publiées).
function buildRows(side) {
  const L = side.lineup;
  const gk = L.find((p) => /goalkeeper/i.test(p.pos)) || L[0];
  const out = L.filter((p) => p !== gk);
  let f = (side.formation || "").match(/\d+/g)?.map(Number);
  if (!f || f.reduce((a, b) => a + b, 0) !== out.length) {
    const d = out.filter((p) => /back|defen/i.test(p.pos));
    const fw = out.filter((p) => /forward|offen|striker|winger|attack/i.test(p.pos));
    const mid = out.filter((p) => !d.includes(p) && !fw.includes(p));
    if (d.length && fw.length && d.length + mid.length + fw.length === out.length) return [[gk], d, mid, fw];
    const n = out.length, a = Math.round(n * 0.4), b = Math.round(n * 0.4);
    f = [a, b, n - a - b].filter((x) => x > 0);
  }
  let i = 0;
  return [[gk], ...f.map((n) => { const r = out.slice(i, i + n); i += n; return r; })];
}
const surname = (n) => { const t = String(n).trim().split(/\s+/); return t.length > 1 && t[t.length - 1].length > 2 ? t[t.length - 1] : n; };

const LINES = "absolute border border-white/70";

export function Pitch({ team, side, tone = "home", badge }) {
  const rows = buildRows(side);
  const R = rows.length;
  const dot = tone === "home" ? "bg-brand text-white" : "bg-white text-brand";
  return (
    <div className="card overflow-hidden p-0">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <div className="truncate font-extrabold">{team}</div>
          {side.coach && <div className="truncate text-xs text-muted">Entraîneur : {side.coach}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {badge && <span className="rounded-full bg-good/10 px-2.5 py-0.5 text-[11px] font-bold text-good">{badge}</span>}
          {side.formation && <span className="num rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand">{side.formation}</span>}
        </div>
      </div>
      <div className="relative mx-3 mb-3 overflow-hidden rounded-2xl ring-1 ring-black/10" style={{ aspectRatio: "3 / 3.7", background: "repeating-linear-gradient(180deg,#2f9e5b 0 12.5%,#2a9254 12.5% 25%)" }}>
        <div className={`${LINES} inset-2 rounded-sm`} />
        <div className={`${LINES} left-2 right-2 top-1/2 border-x-0 border-b-0`} />
        <div className={`${LINES} left-1/2 top-1/2 h-[22%] w-[29%] -translate-x-1/2 -translate-y-1/2 rounded-full`} />
        <div className={`${LINES} left-[22%] right-[22%] top-2 h-[16%] border-t-0`} />
        <div className={`${LINES} left-[22%] right-[22%] bottom-2 h-[16%] border-b-0`} />
        <div className={`${LINES} left-[36%] right-[36%] top-2 h-[7%] border-t-0`} />
        <div className={`${LINES} left-[36%] right-[36%] bottom-2 h-[7%] border-b-0`} />
        {rows.map((r, ri) =>
          r.map((p, j) => (
            <div key={`${ri}-${j}`} className="absolute w-[22%] -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${((j + 1) / (r.length + 1)) * 100}%`, top: `${R === 1 ? 50 : 89 - ri * (77 / (R - 1))}%` }}>
              <div className={`num mx-auto grid h-7 w-7 place-items-center rounded-full text-[11px] font-extrabold shadow-md ring-2 ring-white/90 sm:h-8 sm:w-8 sm:text-xs ${dot}`}>{p.num ?? ""}</div>
              <div className="mt-0.5 truncate text-[10px] font-semibold leading-tight text-white [text-shadow:0_1px_2px_rgba(0,0,0,.7)] sm:text-[11px]">{surname(p.name)}</div>
            </div>
          ))
        )}
      </div>
      {side.bench.length > 0 && <p className="px-4 pb-4 text-xs leading-relaxed text-muted"><b className="text-ink/70">Remplaçants :</b> {side.bench.map((p) => `${p.num ? p.num + " " : ""}${surname(p.name)}`).join(" · ")}</p>}
    </div>
  );
}
