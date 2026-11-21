import { Badge } from "@/components/Team";
import { fmtDateTime, odd } from "@/lib/format";

const ST = {
  won: ["bg-good/10 border-good", "text-good", "Gagné"],
  lost: ["bg-bad/10 border-bad", "text-bad", "Perdu"],
  void: ["bg-card2 border-line", "text-muted", "Annulé"],
  pending: ["bg-white border-line", "text-muted", "À venir"],
};

// Historique des pronos donnés : vert = gagné, rouge = perdu, gris = pas encore joué.
export function PronoLog({ rows }) {
  const w = rows.filter((r) => r.status === "won").length, l = rows.filter((r) => r.status === "lost").length;
  return (
    <section id="pronos-donnes" className="space-y-3">
      <h2 className="text-xl font-extrabold">Mes pronos donnés <span className="text-sm font-medium text-muted">{rows.length} au total · <span className="text-good">{w} gagné{w > 1 ? "s" : ""}</span> · <span className="text-bad">{l} perdu{l > 1 ? "s" : ""}</span></span></h2>
      {rows.length === 0 ? <p className="card p-4 text-sm text-muted">Aucun prono enregistré depuis la remise à zéro. Ils apparaissent ici dès qu'ils sont publiés, puis passent au vert ou au rouge après le match.</p> : (
        <ul className="space-y-1.5">
          {rows.map((r) => { const s = ST[r.status] || ST.pending; return (
            <li key={r.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border-l-4 px-3 py-2 text-sm ${s[0]}`}>
              <span className="flex items-center gap-1.5"><Badge src={r.hl} name={r.home} size={22} /><Badge src={r.al} name={r.away} size={22} /></span>
              <span className="min-w-0 flex-1"><b>{r.home} – {r.away}</b><span className="block text-[11px] text-muted">{r.league} · {fmtDateTime(r.start)}</span></span>
              <span className="font-semibold">{r.selection}</span>
              <span className="num text-xs">{r.odds != null ? `cote ${odd(r.odds)}` : r.usOdds ? `cote US ${odd(r.usOdds)}` : "cote n.d."}</span>
              <span className="num text-xs text-muted">{r.score || ""}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s[1]}`}>{s[2]}</span>
            </li>); })}
        </ul>
      )}
    </section>
  );
}
