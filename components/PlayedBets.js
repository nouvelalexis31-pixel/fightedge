import { listJson } from "@/lib/store";
import { addPlayed, setPlayedResult } from "@/app/bilan/actions";

const f2 = (x) => Number(x).toFixed(2).replace(".", ",");
const eur = (x) => (x > 0 ? "+" : x < 0 ? "−" : "") + f2(Math.abs(x)) + " €";
const ST = { won: "Gagné", lost: "Perdu", void: "Annulé", pending: "En attente" };

export async function PlayedBets() {
  let bets = [], res = [], err = null;
  try { bets = (await listJson("played/")).map((d) => d.data); res = (await listJson("played-res/")).map((d) => d.data); } catch (e) { err = e.message; }
  const last = new Map();
  for (const r of res.sort((a, b) => String(a.at).localeCompare(String(b.at)))) last.set(r.id, r.status);
  const rows = bets.map((b) => { const st = last.get(b.id) || "pending"; const p = st === "won" ? b.stake * (b.odds - 1) : st === "lost" ? -b.stake : st === "void" ? 0 : null; return { ...b, st, p }; }).sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const settled = rows.filter((r) => r.st !== "pending");
  const staked = settled.filter((r) => r.st !== "void").reduce((n, r) => n + r.stake, 0);
  const net = settled.reduce((n, r) => n + (r.p || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const inp = "min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm";
  return (
    <section id="mes-paris" className="scroll-mt-28 space-y-4">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight">Mes paris joués</h2>
        <p className="text-xs text-muted">Distinct des pronostics FightEdge ci-dessus : ici ce sont les paris que vous déclarez avoir réellement joués. Ces données sont saisies par vous et ne modifient jamais le bilan des pronostics de l'IA.</p>
      </div>
      <form action={addPlayed} className="card grid gap-2 p-4 sm:grid-cols-2">
        <input name="match" required placeholder="Rencontre (ex. PSG – Marseille)" className={inp} aria-label="Rencontre" />
        <input name="selection" required placeholder="Pari (ex. Plus de 1,5 but)" className={inp} aria-label="Pari" />
        <input name="odds" required inputMode="decimal" placeholder="Cote (ex. 1,85)" className={inp} aria-label="Cote" />
        <input name="stake" required inputMode="decimal" placeholder="Mise en €" className={inp} aria-label="Mise" />
        <input name="book" placeholder="Bookmaker (ex. Betclic)" className={inp} aria-label="Bookmaker" />
        <input name="date" type="date" defaultValue={today} className={inp} aria-label="Date" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="fe" value="1" className="h-5 w-5" /> Pari issu d'un pronostic FightEdge</label>
        <button className="min-h-11 rounded-xl bg-brand px-4 text-sm font-bold text-white">Enregistrer ce pari</button>
      </form>
      {err && <p className="text-xs text-bad">Lecture impossible : {err}</p>}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="card p-3"><div className="text-[11px] text-muted">Paris réglés</div><div className="num text-xl font-extrabold">{settled.length}</div></div>
        <div className="card p-3"><div className="text-[11px] text-muted">Misé (réglé)</div><div className="num text-xl font-extrabold">{f2(staked)} €</div></div>
        <div className="card p-3"><div className="text-[11px] text-muted">Bénéfice / perte</div><div className={`num text-xl font-extrabold ${net > 0 ? "text-good" : net < 0 ? "text-bad" : ""}`}>{eur(net)}</div></div>
      </div>
      {rows.length === 0 ? <p className="card p-4 text-sm text-muted">Aucun pari enregistré pour le moment.</p> : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="card p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><div className="truncate font-bold">{r.match}</div><div className="text-xs text-muted">{r.selection} · cote {f2(r.odds)}{r.book ? " · " + r.book : ""} · mise {f2(r.stake)} € · {r.date}{r.fromPick ? " · pronostic FightEdge" : ""}</div></div>
                <div className="shrink-0 text-right"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.st === "won" ? "bg-good/15 text-good" : r.st === "lost" ? "bg-bad/15 text-bad" : "bg-card2 text-muted"}`}>{ST[r.st]}</span>{r.p != null && <div className={`num mt-1 text-sm font-extrabold ${r.p > 0 ? "text-good" : r.p < 0 ? "text-bad" : ""}`}>{eur(r.p)}</div>}</div>
              </div>
              <form action={setPlayedResult} className="mt-2 flex flex-wrap gap-2">
                <input type="hidden" name="id" value={r.id} />
                {["won", "lost", "void", "pending"].filter((s) => s !== r.st).map((s) => <button key={s} name="status" value={s} className="min-h-10 rounded-full border border-line bg-white px-4 text-xs font-bold">{s === "pending" ? "Remettre en attente" : "Marquer " + ST[s].toLowerCase()}</button>)}
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
