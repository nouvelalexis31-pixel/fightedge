// Analyse visuelle d'un match de football : tout est calculé à partir du moteur FightEdge (probabilités par score exact,
// buts attendus) et de l'historique réel des deux équipes (10 derniers matchs, domicile / extérieur, jours de repos).
import { fr } from "@/lib/fr";

const P = (p) => (p == null ? "—" : Math.round(p * 100) + " %");
const P1 = (p) => (p == null ? "—" : (p * 100).toFixed(1).replace(".", ",") + " %");
const o2 = (v) => Number(v).toFixed(2).replace(".", ",");
const f1 = (v) => Number(v).toFixed(1).replace(".", ",");
const C_H = "#1d4ed8", C_D = "#94a3b8", C_A = "#c2410c", GOOD = "#07875a", BAD = "#d92d20";

function Card({ title, sub, children }) {
  return (
    <section className="card space-y-3 p-4 sm:p-5">
      <div><h3 className="text-base font-extrabold">{title}</h3>{sub && <p className="text-xs text-muted">{sub}</p>}</div>
      {children}
    </section>
  );
}

// Probabilités dérivées de la grille des scores exacts
function derive(E) {
  const s = E?.scores || [];
  const tot = s.reduce((a, x) => a + x.p, 0) || 1;
  const p = (f) => s.reduce((a, x) => a + (f(x) ? x.p : 0), 0) / tot;
  const goals = Array.from({ length: 7 }, (_, k) => (k < 6 ? p((x) => x.h + x.a === k) : p((x) => x.h + x.a >= 6)));
  const margin = [["Victoire par 3 buts ou plus", p((x) => x.h - x.a >= 3), "h"], ["Victoire par 2 buts", p((x) => x.h - x.a === 2), "h"], ["Victoire par 1 but", p((x) => x.h - x.a === 1), "h"], ["Match nul", p((x) => x.h === x.a), "d"], ["Victoire par 1 but", p((x) => x.a - x.h === 1), "a"], ["Victoire par 2 buts", p((x) => x.a - x.h === 2), "a"], ["Victoire par 3 buts ou plus", p((x) => x.a - x.h >= 3), "a"]];
  return {
    grid: (h, a) => (s.find((x) => x.h === h && x.a === a)?.p || 0) / tot,
    goals, margin,
    hs: p((x) => x.h > 0), as: p((x) => x.a > 0), btts: p((x) => x.h > 0 && x.a > 0),
    csH: p((x) => x.a === 0), csA: p((x) => x.h === 0),
    o15: p((x) => x.h + x.a >= 2), o25: p((x) => x.h + x.a >= 3), o35: p((x) => x.h + x.a >= 4),
    top: [...s].sort((a, b) => b.p - a.p).slice(0, 3).map((x) => ({ ...x, p: x.p / tot })),
  };
}

// 1) Le match en un coup d'œil : 1 N 2 (IA et bookmakers), buts attendus, fiabilité
function Overview({ E, nh, na }) {
  const g1 = E.groups.find((g) => g.id === "1x2")?.items || [];
  const ia = E.probs, cons = g1.length === 3 && g1.every((x) => x.cons != null) ? { h: g1[0].cons, d: g1[1].cons, a: g1[2].cons } : null;
  const Bar = ({ v, label }) => (
    <div>
      <div className="mb-1 text-[11px] font-semibold text-muted">{label}</div>
      <div className="flex h-7 overflow-hidden rounded-lg text-[11px] font-bold text-white">
        {[["h", C_H], ["d", C_D], ["a", C_A]].map(([k, c]) => <div key={k} style={{ width: `${v[k] * 100}%`, background: c }} className="grid place-items-center" title={`${k === "h" ? nh : k === "a" ? na : "Nul"} : ${P1(v[k])}`}>{v[k] >= 0.09 ? P(v[k]) : ""}</div>)}
      </div>
    </div>
  );
  const q = E.quality ?? 0;
  return (
    <Card title="Le match en un coup d'œil" sub="Probabilités de victoire, buts attendus et fiabilité de l'estimation">
      <div className="flex flex-wrap gap-3 text-[11px] font-semibold"><span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: C_H }} />{nh}</span><span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: C_D }} />Nul</span><span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: C_A }} />{na}</span></div>
      <Bar v={ia} label="Estimation FightEdge (marché + historique des équipes)" />
      {cons && <Bar v={cons} label="Consensus des bookmakers (marge retirée)" />}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-card2 p-2.5"><div className="text-[11px] text-muted">Buts attendus {nh}</div><div className="num text-xl font-extrabold" style={{ color: C_H }}>{f1(E.lh)}</div></div>
        <div className="rounded-xl bg-card2 p-2.5"><div className="text-[11px] text-muted">Total attendu</div><div className="num text-xl font-extrabold">{f1(E.mu)}</div></div>
        <div className="rounded-xl bg-card2 p-2.5"><div className="text-[11px] text-muted">Buts attendus {na}</div><div className="num text-xl font-extrabold" style={{ color: C_A }}>{f1(E.la)}</div></div>
      </div>
      <div>
        <div className="flex justify-between text-[11px] font-semibold text-muted"><span>Fiabilité des données</span><span className="text-ink">{E.level} ({Math.round(q * 100)} / 100)</span></div>
        <div className="pbar mt-1"><span style={{ width: `${Math.round(q * 100)}%` }} /></div>
        <p className="mt-1 text-[11px] text-muted">Source : {E.source}.</p>
      </div>
    </Card>
  );
}

// 2) Carte de chaleur des scores exacts
function Heatmap({ D, nh, na }) {
  const N = 6, max = Math.max(...Array.from({ length: N * N }, (_, i) => D.grid(Math.floor(i / N), i % N)), 0.0001);
  return (
    <Card title="Scores les plus probables" sub={`Chaque case : probabilité du score exact. Lignes : buts de ${nh} ; colonnes : buts de ${na}.`}>
      <div className="overflow-x-auto">
        <table className="mx-auto border-separate text-center" style={{ borderSpacing: 3 }}>
          <thead><tr><th className="text-[10px] text-muted" />{Array.from({ length: N }, (_, a) => <th key={a} className="w-11 text-[11px] font-bold" style={{ color: C_A }}>{a}</th>)}</tr></thead>
          <tbody>
            {Array.from({ length: N }, (_, h) => (
              <tr key={h}>
                <th className="pr-1 text-[11px] font-bold" style={{ color: C_H }}>{h}</th>
                {Array.from({ length: N }, (_, a) => {
                  const v = D.grid(h, a), t = v / max;
                  const bg = h > a ? `rgba(29,78,216,${0.08 + 0.85 * t})` : h < a ? `rgba(194,65,12,${0.08 + 0.85 * t})` : `rgba(100,116,139,${0.08 + 0.85 * t})`;
                  return <td key={a} title={`${h} – ${a} : ${P1(v)}`} className="h-10 w-11 rounded-md text-[11px] font-bold num" style={{ background: bg, color: t > 0.5 ? "#fff" : "var(--color-ink)" }}>{v >= 0.005 ? Math.round(v * 100) : ""}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">{D.top.map((x, i) => <span key={i} className="rounded-full bg-card2 px-2.5 py-1 font-semibold">{i + 1}. {x.h} – {x.a} <span className="text-muted">({P1(x.p)})</span></span>)}</div>
    </Card>
  );
}

// 3) Répartition des buts + qui marque + écart final
function Goals({ D, nh, na }) {
  const mx = Math.max(...D.goals, 0.01);
  const ml = Math.max(...D.margin.map((m) => m[1]), 0.01);
  return (
    <Card title="Combien de buts, et qui les marque ?" sub="Nombre total de buts du match, probabilités clés et écart au score final">
      <div className="flex h-40 items-end gap-1.5">
        {D.goals.map((v, k) => (
          <div key={k} className="flex flex-1 flex-col items-center gap-1">
            <span className="num text-[10px] font-bold">{P(v)}</span>
            <div className="w-full rounded-t-md" style={{ height: `${(v / mx) * 110}px`, background: k >= 3 ? GOOD : "#64748b" }} title={`${k === 6 ? "6 buts ou plus" : k + " but" + (k > 1 ? "s" : "")} : ${P1(v)}`} />
            <span className="text-[11px] font-semibold text-muted">{k === 6 ? "6+" : k}</span>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted">En vert : 3 buts ou plus (« plus de 2,5 buts »).</p>
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        {[["Plus de 1,5 but", D.o15], ["Plus de 2,5 buts", D.o25], ["Plus de 3,5 buts", D.o35], ["Les deux équipes marquent", D.btts], [`${nh} marque`, D.hs], [`${na} marque`, D.as], [`${nh} ne prend pas de but`, D.csH], [`${na} ne prend pas de but`, D.csA]].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-card2 p-2.5"><div className="truncate text-[11px] text-muted" title={l}>{l}</div><div className="num text-lg font-extrabold">{P(v)}</div><div className="text-[10px] text-muted">cote juste {v > 0.01 ? o2(1 / v) : "—"}</div></div>
        ))}
      </div>
      <div>
        <div className="mb-1 text-[11px] font-semibold text-muted">Écart au score final</div>
        <ul className="space-y-1">
          {D.margin.map(([l, v, side], i) => (
            <li key={i} className="grid grid-cols-[minmax(0,11rem)_1fr_3rem] items-center gap-2 text-[11px] sm:grid-cols-[minmax(0,15rem)_1fr_3rem]">
              <span className="truncate font-semibold">{side === "d" ? l : `${side === "h" ? nh : na} : ${l.toLowerCase()}`}</span>
              <span className="h-3 rounded bg-card2"><span className="block h-3 rounded" style={{ width: `${(v / ml) * 100}%`, background: side === "h" ? C_H : side === "a" ? C_A : C_D }} /></span>
              <span className="num text-right font-bold">{P(v)}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}

// 4) Courbe de forme : 10 derniers matchs (buts marqués vers le haut, encaissés vers le bas)
function FormChart({ name, st, color }) {
  const g = (st?.last10 || []).slice().reverse();
  if (!g.length) return null;
  const mx = Math.max(3, ...g.map((x) => Math.max(x.gf, x.ga)));
  let pts = 0; const cum = g.map((x) => (pts += x.res === "V" ? 3 : x.res === "N" ? 1 : 0));
  const W = 300, H = 120, mid = 60, bw = W / g.length;
  const line = cum.map((v, i) => `${i ? "L" : "M"}${(i + 0.5) * bw},${H - 6 - (v / (3 * g.length)) * (H - 12)}`).join("");
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs"><b style={{ color }}>{name}</b><span className="text-muted">{g.filter((x) => x.res === "V").length} V · {g.filter((x) => x.res === "N").length} N · {g.filter((x) => x.res === "D").length} D · {pts} pts sur {3 * g.length}</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Forme de ${name} sur ses ${g.length} derniers matchs`}>
        <line x1="0" x2={W} y1={mid} y2={mid} stroke="currentColor" strokeOpacity="0.15" />
        {g.map((x, i) => {
          const c = x.res === "V" ? GOOD : x.res === "D" ? BAD : C_D;
          const hu = (x.gf / mx) * (mid - 8), hd = (x.ga / mx) * (mid - 8);
          return (
            <g key={i}>
              <title>{`${x.home ? "Dom." : "Ext."} contre ${x.opp} : ${x.gf}-${x.ga}`}</title>
              <rect x={i * bw + 3} y={mid - hu} width={bw - 6} height={Math.max(1, hu)} rx="2" fill={c} />
              <rect x={i * bw + 3} y={mid} width={bw - 6} height={Math.max(1, hd)} rx="2" fill={c} opacity="0.35" />
            </g>
          );
        })}
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeDasharray="3 2" opacity="0.9" />
      </svg>
      <div className="flex justify-between text-[10px] text-muted"><span>il y a 10 matchs</span><span>barres pleines : buts marqués · claires : encaissés · pointillés : points cumulés</span><span>dernier</span></div>
    </div>
  );
}

// 5) Comparaison des équipes (barres en miroir)
function Compare({ tH, tA, nh, na }) {
  const a = tH?.all, b = tA?.all;
  if (!a || !b) return null;
  const rows = [
    ["Points par match", a.ppg, b.ppg, 3, f1, true],
    ["Buts marqués par match", a.gfpm, b.gfpm, 3, f1, true],
    ["Buts encaissés par match", a.gapm, b.gapm, 3, f1, false],
    [`Forme à domicile (${nh}) / à l'extérieur (${na}), pts par match`, tH.home?.ppg, tA.away?.ppg, 3, f1, true],
    ["Matchs à plus de 2,5 buts", a.o25, b.o25, 1, P, null],
    ["Les deux équipes marquent", a.btts, b.btts, 1, P, null],
    ["Matchs sans encaisser", a.cs, b.cs, 1, P, true],
  ].filter((r) => r[1] != null && r[2] != null);
  return (
    <Card title="Face-à-face statistique" sub="10 derniers matchs de chaque équipe (toutes compétitions). La barre la plus longue l'emporte.">
      <div className="flex justify-between text-xs font-bold"><span style={{ color: C_H }}>{nh}</span><span style={{ color: C_A }}>{na}</span></div>
      <ul className="space-y-2.5">
        {rows.map(([l, x, y, mx, fmt, higherBetter]) => {
          const bx = higherBetter == null ? false : higherBetter ? x > y : x < y, by = higherBetter == null ? false : higherBetter ? y > x : y < x;
          return (
            <li key={l}>
              <div className="mb-0.5 text-center text-[11px] text-muted">{l}</div>
              <div className="grid grid-cols-[3rem_1fr_1fr_3rem] items-center gap-1.5 text-xs">
                <span className={`num text-right ${bx ? "font-extrabold" : ""}`}>{fmt(x)}</span>
                <span className="flex h-3 justify-end rounded-l bg-card2"><span className="h-3 rounded-l" style={{ width: `${Math.min(100, (x / mx) * 100)}%`, background: C_H, opacity: bx ? 1 : 0.5 }} /></span>
                <span className="flex h-3 rounded-r bg-card2"><span className="h-3 rounded-r" style={{ width: `${Math.min(100, (y / mx) * 100)}%`, background: C_A, opacity: by ? 1 : 0.5 }} /></span>
                <span className={`num ${by ? "font-extrabold" : ""}`}>{fmt(y)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

// 6) Facteurs clés, pondérés selon ce que l'entraînement sur 4 saisons a montré (domicile/extérieur et repos d'abord)
function Factors({ tH, tA, nh, na, start }) {
  if (!tH?.all || !tA?.all) return null;
  const t0 = start ? +new Date(start) : Date.now();
  const rest = (st) => { const d = st.games?.[0]?.date; return d ? Math.floor((t0 - +new Date(d)) / 864e5) : null; };
  const rH = rest(tH), rA = rest(tA);
  const F = [];
  const add = (label, v, why, weight) => F.push({ label, v: Math.max(-1, Math.min(1, v)), why, weight });
  if (tH.home?.n >= 3 && tA.away?.n >= 3) add("Forme domicile / extérieur", (tH.home.ppg - tA.away.ppg) / 2, `${nh} prend ${f1(tH.home.ppg)} pts par match à domicile, ${na} ${f1(tA.away.ppg)} à l'extérieur`, "fort");
  if (rH != null && rA != null && rH < 30 && rA < 30) add("Jours de repos", (Math.min(rH, 7) - Math.min(rA, 7)) / 4, `${rH} jour${rH > 1 ? "s" : ""} pour ${nh}, ${rA} pour ${na}`, "fort");
  add("Forme récente (5 matchs)", ((tH.last10.slice(0, 5).reduce((s, g) => s + (g.res === "V" ? 3 : g.res === "N" ? 1 : 0), 0)) - (tA.last10.slice(0, 5).reduce((s, g) => s + (g.res === "V" ? 3 : g.res === "N" ? 1 : 0), 0))) / 9, "points pris sur les 5 derniers matchs", "moyen");
  add("Attaque", (tH.all.gfpm - tA.all.gfpm) / 1.5, `${f1(tH.all.gfpm)} buts marqués par match contre ${f1(tA.all.gfpm)}`, "moyen");
  add("Défense", (tA.all.gapm - tH.all.gapm) / 1.5, `${f1(tH.all.gapm)} buts encaissés par match contre ${f1(tA.all.gapm)}`, "moyen");
  return (
    <Card title="Les facteurs qui font pencher le match" sub="Vers la gauche : avantage à l'équipe à domicile. Vers la droite : avantage à l'équipe à l'extérieur. « Poids » : importance mesurée sur 12 000 matchs testés.">
      <ul className="space-y-2.5">
        {F.map((f) => (
          <li key={f.label}>
            <div className="flex items-baseline justify-between text-xs"><b>{f.label}</b><span className="text-[10px] text-muted">poids {f.weight}</span></div>
            <div className="relative mt-1 h-3 rounded bg-card2">
              <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
              <span className="absolute inset-y-0 rounded" style={f.v >= 0 ? { right: "50%", width: `${f.v * 50}%`, background: C_H } : { left: "50%", width: `${-f.v * 50}%`, background: C_A }} />
            </div>
            <p className="mt-0.5 text-[11px] text-muted">{Math.abs(f.v) < 0.08 ? "Équilibré : " : `Avantage ${f.v > 0 ? nh : na} : `}{f.why}.</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function VisualAnalysis({ E, tH, tA, home, away, start, compact = false }) {
  if (!E?.scores?.length) return <p className="card p-4 text-sm text-muted">Analyse visuelle indisponible : historique ou cotes insuffisants pour ce match.</p>;
  const nh = fr(home), na = fr(away), D = derive(E);
  if (compact) return <div className="grid gap-4 lg:grid-cols-2"><Overview E={E} nh={nh} na={na} /><Heatmap D={D} nh={nh} na={na} /></div>;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2"><Overview E={E} nh={nh} na={na} /><Heatmap D={D} nh={nh} na={na} /></div>
      <Goals D={D} nh={nh} na={na} />
      {(tH?.last10?.length || tA?.last10?.length) ? <Card title="Courbes de forme" sub="Les 10 derniers matchs de chaque équipe, du plus ancien au plus récent. Survolez une barre pour voir l'adversaire et le score."><div className="grid gap-5 lg:grid-cols-2"><FormChart name={nh} st={tH} color={C_H} /><FormChart name={na} st={tA} color={C_A} /></div></Card> : null}
      <div className="grid gap-4 lg:grid-cols-2"><Compare tH={tH} tA={tA} nh={nh} na={na} /><Factors tH={tH} tA={tA} nh={nh} na={na} start={start} /></div>
    </div>
  );
}
