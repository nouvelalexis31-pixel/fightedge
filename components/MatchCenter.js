// Blocs « centre de match » (style Flashscore) : pronos FightEdge, tous les marchés, stats comparées,
// séries en cours, derniers matchs et classement. Uniquement des données réelles (ESPN + cotes).
import { frComp } from "@/lib/frcomp";
import Link from "next/link";
import { fr } from "@/lib/fr";
import { FormDots } from "@/components/FormDots";
import { Badge } from "@/components/Team";
import { Stars } from "@/components/Ui";

const P = (p) => (p == null ? "–" : Math.round(p * 100) + " %");
const o2 = (v) => (v ? Number(v).toFixed(2).replace(".", ",") : "—");
const f1 = (x) => (x == null ? "–" : Number(x).toFixed(1).replace(".", ","));
const sg = (x) => (x >= 0 ? "+" : "−") + Math.abs(x * 100).toFixed(1).replace(".", ",") + " %";
const dShort = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "Europe/Paris" }) : "");

const KINDS = {
  value: ["Plus-value", "bg-good/10 text-good ring-good/30"],
  safe: ["Prono sûr", "bg-brand/10 text-brand ring-brand/20"],
  mid: ["Équilibré", "bg-sky-100 text-sky-700 ring-sky-300/50"],
  bold: ["Audacieux", "bg-orange-100 text-bold ring-bold/30"],
  score: ["Score exact", "bg-card2 text-muted ring-line"],
};

export function TabNav({ base, tabs, tab }) {
  return (
    <nav aria-label="Sections du match" className="sticky top-[57px] z-20 -mx-4 flex gap-2 overflow-x-auto border-b border-line bg-white/90 px-4 py-2 backdrop-blur">
      {tabs.map(([k, l]) => <Link key={k} href={`${base}?tab=${k}`} scroll={false} aria-current={tab === k ? "page" : undefined} className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${tab === k ? "bg-navy text-white" : "bg-card2 text-muted hover:text-ink"}`}>{l}</Link>)}
    </nav>
  );
}

function PickTile({ x }) {
  const [lab, cls] = KINDS[x.kind] || KINDS.safe;
  return (
    <article className="flex flex-col gap-2 rounded-2xl bg-card2 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${cls}`}>{lab}</span>
        <Stars n={x.stars} />
      </div>
      <div className="text-[11px] font-bold uppercase tracking-wide text-muted">{x.group}</div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-extrabold leading-tight">{x.label}</span>
        <span className="num shrink-0 text-lg font-extrabold">{P(x.p)}</span>
      </div>
      <div className="num flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        <span>Cote juste <b className="text-ink">{o2(x.fair)}</b></span>
        {x.offer && <span>{x.offer.book} <b className={x.value ? "text-good" : "text-ink"}>{o2(x.offer.odds)}</b> ({sg(x.ev)})</span>}
      </div>
      {x.value && x.kelly > 0 && <div className="rounded-xl bg-good/10 px-2.5 py-1.5 text-xs font-semibold text-good">Mise conseillée : {(x.kelly * 100).toFixed(1).replace(".", ",")} % de la bankroll</div>}
      {!x.offer && x.kind !== "score" && <div className="text-[11px] text-muted">Jouable si votre opérateur paie plus que {o2(x.fair)}.</div>}
    </article>
  );
}

export function EdgePicks({ E, title = "Pronos FightEdge", limit = 9 }) {
  if (!E) return null;
  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-xs text-muted">Fiabilité des données : <b className="text-ink">{E.level}</b> · base : {E.source}. Buts attendus : {f1(E.lh)} – {f1(E.la)}.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{E.picks.slice(0, limit).map((x) => <PickTile key={x.key} x={x} />)}</div>
      <p className="text-[11px] leading-relaxed text-muted">« Plus-value » : la cote proposée dépasse la cote juste avec une marge supérieure à l'incertitude du modèle. La mise Kelly (1/4, plafonnée à 3 %) protège la bankroll. Un prono reste une probabilité, jamais une certitude : rentable seulement sur la durée, avec discipline.</p>
    </section>
  );
}

export function EdgeMarkets({ E }) {
  if (!E) return null;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight">Tous les pronos du match</h2>
        <p className="mt-1 text-xs text-muted">{E.groups.reduce((s, g) => s + g.items.length, 0)} issues estimées sur {E.groups.length} marchés. En vert : une vraie cote supérieure à la cote juste (plus-value).</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {E.groups.map((g) => (
          <div key={g.id} className="card p-3.5">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{g.group}</div>
            <ul className="space-y-1.5">
              {g.items.map((it) => (
                <li key={it.key} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate">{it.label}</span>
                    <span className="num shrink-0 text-right"><b>{P(it.p)}</b><span className="ml-2 text-xs text-muted">{o2(it.fair)}</span>{it.offer && <span className={`ml-2 rounded px-1 text-xs font-bold ${it.value ? "bg-good/10 text-good" : "text-muted"}`}>{o2(it.offer.odds)}</span>}</span>
                  </div>
                  <div className="pbar mt-1" aria-hidden><span style={{ width: `${Math.round(it.p * 100)}%` }} /></div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted">Format : probabilité · cote juste{E.groups.some((g) => g.items.some((i) => i.offer)) ? " · meilleure cote disponible" : ""}. Mi-temps estimées avec 45 % des buts en 1re période (moyenne observée en football).</p>
    </section>
  );
}

// ---------- Stats comparées ----------
const ROWS = [
  ["Matchs analysés", (s) => s.n, (v) => v, null],
  ["Bilan V-N-D", (s) => `${s.w}-${s.d}-${s.l}`, (v) => v, null],
  ["Points par match", (s) => s.ppg, f1, 3],
  ["Buts marqués / match", (s) => s.gfpm, f1, 3],
  ["Buts encaissés / match", (s) => s.gapm, f1, 3, true],
  ["Buts par match (total)", (s) => s.tpm, f1, 5],
  ["Plus de 1,5 buts", (s) => s.o15, P, 1],
  ["Plus de 2,5 buts", (s) => s.o25, P, 1],
  ["Plus de 3,5 buts", (s) => s.o35, P, 1],
  ["Les deux équipes marquent", (s) => s.btts, P, 1],
  ["Cage inviolée", (s) => s.cs, P, 1],
  ["Sans marquer", (s) => s.fts, P, 1, true],
];

function CompareTable({ a, b, na, nb, caption }) {
  if (!a || !b) return null;
  return (
    <div className="rounded-2xl bg-card2 p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2 text-xs font-bold"><span className="truncate">{na}</span><span className="text-muted">{caption}</span><span className="truncate text-right">{nb}</span></div>
      <ul className="space-y-2">
        {ROWS.map(([label, get, fmt, max, lowGood]) => {
          const x = get(a), y = get(b);
          const num = typeof x === "number" && typeof y === "number" && max;
          const better = num && x !== y ? ((x > y) !== !!lowGood ? "a" : "b") : null;
          return (
            <li key={label}>
              <div className="num flex justify-between gap-2 text-xs"><b className={better === "a" ? "text-good" : ""}>{fmt(x)}</b><span className="text-center text-muted">{label}</span><b className={better === "b" ? "text-good" : ""}>{fmt(y)}</b></div>
              {num && <div className="mt-1 grid grid-cols-2 gap-1"><div className="flex justify-end overflow-hidden rounded-full bg-white"><span className="h-1.5 rounded-full bg-brand" style={{ width: Math.min(100, (x / max) * 100) + "%" }} /></div><div className="overflow-hidden rounded-full bg-white"><span className="block h-1.5 rounded-full bg-slate-400" style={{ width: Math.min(100, (y / max) * 100) + "%" }} /></div></div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TeamCompare({ S, C }) {
  const { tH, tA } = C || {};
  if (!tH || !tA) return <p className="card p-4 text-sm text-muted">Historique des équipes indisponible pour ce match (source ESPN).</p>;
  const nh = fr(S.home.name), na = fr(S.away.name);
  return (
    <section className="card space-y-4 p-5">
      <div>
        <h2 className="text-lg font-extrabold tracking-tight">Statistiques comparées</h2>
        <p className="mt-0.5 text-xs text-muted">10 derniers matchs toutes compétitions, puis {nh} à domicile face à {na} à l'extérieur. En vert : l'avantage.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <CompareTable a={tH.all} b={tA.all} na={nh} nb={na} caption="10 derniers" />
        <CompareTable a={tH.home} b={tA.away} na={`${nh} (dom.)`} nb={`${na} (ext.)`} caption="Dom. / Ext." />
      </div>
    </section>
  );
}

export function Streaks({ S, C }) {
  const { tH, tA } = C || {};
  if (!tH && !tA) return null;
  const tone = { good: "bg-good/10 text-good", bad: "bg-bad/10 text-bad", neutral: "bg-brand/10 text-brand" };
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-lg font-extrabold tracking-tight">Séries en cours</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {[[S.home, tH], [S.away, tA]].map(([t, st]) => (
          <div key={t.id} className="rounded-2xl bg-card2 p-4">
            <div className="flex items-center gap-2 font-bold"><Badge src={t.crest} name={t.name} size={22} />{fr(t.name)}</div>
            {st?.form?.length > 0 && <div className="mt-2"><FormDots letters={st.form} /></div>}
            {st?.streaks?.length ? (
              <ul className="mt-3 space-y-1.5">{st.streaks.slice(0, 6).map((s) => <li key={s.label} className="flex items-center justify-between gap-2 text-sm"><span>{s.label}</span><span className={`num rounded-full px-2 py-0.5 text-xs font-extrabold ${tone[s.tone]}`}>{s.n}</span></li>)}</ul>
            ) : <p className="mt-3 text-xs text-muted">Aucune série notable (3 matchs ou plus) en cours.</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

const RES = { V: "bg-good text-white", N: "bg-slate-300 text-slate-700", D: "bg-bad text-white" };
export function LastGames({ S, C }) {
  const { tH, tA } = C || {};
  if (!tH && !tA) return null;
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-lg font-extrabold tracking-tight">Derniers matchs</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        {[[S.home, tH], [S.away, tA]].map(([t, st]) => (
          <div key={t.id}>
            <div className="mb-2 flex items-center gap-2 text-sm font-bold"><Badge src={t.crest} name={t.name} size={20} />{fr(t.name)}</div>
            {st?.last10?.length ? (
              <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-card2">
                {st.last10.map((g) => (
                  <li key={g.id} className="num flex items-center gap-2 px-3 py-1.5 text-xs">
                    <span className="w-10 shrink-0 text-muted">{dShort(g.date)}</span>
                    <span className="w-8 shrink-0 text-[10px] font-bold text-muted">{g.home ? "DOM" : "EXT"}</span>
                    <span className="min-w-0 flex-1 truncate">{fr(g.opp)}</span>
                    <b className="shrink-0">{g.gf}-{g.ga}</b>
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded text-[10px] font-bold ${RES[g.res]}`}>{g.res}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-muted">Non disponible.</p>}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted">Source : ESPN, toutes compétitions (championnat, coupes, Europe).</p>
    </section>
  );
}

export function LeagueTable({ S }) {
  const T = S?.table;
  if (!T) return <p className="card p-4 text-sm text-muted">Classement non disponible pour cette compétition.</p>;
  const ids = new Set([String(S.home.id), String(S.away.id)]);
  return (
    <section className="card space-y-3 p-5">
      <h2 className="text-lg font-extrabold tracking-tight">Classement{T.name ? <span className="ml-2 text-sm font-medium text-muted">{frComp(T.name.replace(/ Standings$/, ""))}</span> : null}</h2>
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="num w-full min-w-[420px] text-xs">
          <thead><tr className="text-muted"><th className="py-1.5 text-left font-bold">#</th><th className="text-left font-bold">Équipe</th><th className="font-bold">J</th><th className="font-bold">V</th><th className="font-bold">N</th><th className="font-bold">D</th><th className="font-bold">Diff.</th><th className="font-bold">Pts</th></tr></thead>
          <tbody>
            {T.rows.map((r) => {
              const me = ids.has(r.id);
              return (
                <tr key={r.id} className={`border-t border-line ${me ? "bg-brand/10 font-bold" : ""}`}>
                  <td className="py-1.5 pr-2">{r.rank ?? ""}</td>
                  <td className="max-w-[180px] pr-2"><span className="flex items-center gap-2"><Badge src={r.logo} name={r.name} size={16} /><span className="truncate">{fr(r.name)}</span></span></td>
                  <td className="text-center">{r.p ?? ""}</td><td className="text-center">{r.w ?? ""}</td><td className="text-center">{r.d ?? ""}</td><td className="text-center">{r.l ?? ""}</td>
                  <td className="text-center">{r.gd > 0 ? "+" : ""}{r.gd ?? ""}</td><td className="text-center font-extrabold">{r.pts ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted">Source : ESPN. Les deux équipes du match sont surlignées.</p>
    </section>
  );
}
