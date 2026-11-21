import { SCORER_COMPS } from "@/lib/fd";

const f2 = (x) => Number(x).toFixed(2).replace(".", ",");
const L = (n) => String(n ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const same = (a, b) => { const x = L(a), y = L(b); return x.length > 2 && y.length > 2 && (x === y || x.includes(y) || y.includes(x)); };

// Buteurs en forme : chiffres réels de la saison (football-data.org). Pas de statistiques sur 5/10 derniers matchs, de tirs ni de statut de titulaire dans nos sources : indiqué clairement.
export function FormScorers({ scorers, teams, title = "Buteurs en forme", limit = 10, compact = false, error }) {
  let list = scorers || [];
  if (teams?.length) list = list.filter((s) => teams.some((t) => same(s.team, t) || same(s.teamShort, t)));
  list = list.slice().sort((a, b) => (b.perMatch ?? 0) - (a.perMatch ?? 0) || b.goals - a.goals);
  if (!teams?.length) list = list.filter((s) => s.played >= 3);
  list = list.slice(0, limit);
  return (
    <section className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-extrabold">{title}</h3>
        <span className="text-[11px] text-muted">Saison en cours · classé par buts par match</span>
      </div>
      {list.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{error ? `Données buteurs indisponibles pour le moment (${error}).` : teams?.length ? "Aucun joueur de ces équipes dans les classements de buteurs disponibles (top 30 par compétition)." : "Aucun classement de buteurs disponible."}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {list.map((p, i) => (
            <li key={p.comp + p.id} className="flex items-center gap-3 py-2.5">
              <span className="num w-5 shrink-0 text-center text-xs font-bold text-muted">{i + 1}</span>
              {p.crest ? <img src={p.crest} alt="" width="24" height="24" loading="lazy" className="h-6 w-6 shrink-0 object-contain" /> : <span className="h-6 w-6 shrink-0 rounded-full bg-card2" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{p.name}</div>
                <div className="truncate text-[11px] text-muted">{p.teamShort || p.team} · {p.compName}</div>
              </div>
              <div className="num shrink-0 text-right text-xs">
                <div><b className="text-base text-ink">{p.goals}</b> but{p.goals > 1 ? "s" : ""}{p.played ? ` en ${p.played} m.` : ""}</div>
                <div className="text-muted">{p.perMatch != null ? f2(p.perMatch) + "/match" : ""}{p.assists != null ? ` · ${p.assists} passe${p.assists > 1 ? "s" : ""} d.` : ""}{p.pens ? ` · ${p.pens} pén.` : ""}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {teams?.length > 0 && list.length > 0 && <p className="mt-3 rounded-xl bg-warn/10 px-3 py-2 text-xs text-warn">À vérifier avant de miser : nos sources ne donnent ni la composition, ni les blessures, ni le statut titulaire/remplaçant. Vérifiez le onze de départ (publié environ 1 h avant le match) ; un joueur remplaçant ou absent annule le pari « buteur ».</p>}
      {!compact && <p className="mt-2 text-[11px] text-muted">Non disponibles dans nos sources : buts sur les 5/10 derniers matchs, tirs et tirs cadrés, titularisations, temps de jeu détaillé. Source : football-data.org (top 30 de chaque compétition).</p>}
    </section>
  );
}
