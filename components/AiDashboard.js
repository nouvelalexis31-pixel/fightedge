import Link from "next/link";
import Ring from "@/components/Ring";
import { sportPicks } from "@/lib/sportpicks";
import { LEARNED } from "@/lib/learned";
import { fmtDateTime } from "@/lib/format";

const o2 = (v) => Number(v).toFixed(2).replace(".", ",");

// Tableau de bord visuel de l'accueil : pronos IA du moment (tous sports) + ce que l'IA a appris de l'historique.
export default async function AiDashboard() {
  let picks = [];
  try { picks = (await sportPicks()).filter((x) => +new Date(x.start) > Date.now()).sort((a, b) => b.p - a.p).slice(0, 6); } catch {}
  const L = LEARNED.foot;
  const facts = [
    ["+6,2 %", "rentabilité en suivant les cotes qui baissent fortement avant le match", "1 946 paris testés", "text-good"],
    ["64,3 %", "de vainqueurs trouvés au tennis par notre classement Elo", "23 860 matchs testés", "text-brand"],
    ["−29 %", "de pertes sur les « gros coups » à plus de 3,50 : l'IA les évite", `${L.testMatches.toLocaleString("fr-FR")} matchs de foot testés`, "text-bad"],
    ["−4,4 %", "en jouant toujours le favori : la marge du bookmaker suffit à perdre", "même échantillon", "text-warn"],
  ];
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-xl font-extrabold tracking-tight">Les pronos IA du moment</h2>
        <Link href="/pronos" className="shrink-0 text-sm font-bold text-brand hover:underline">Tous les pronos →</Link>
      </div>
      {picks.length > 0 ? (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
          {picks.map((x) => (
            <Link key={x.id} href="/pronos" className="card card-link flex w-72 shrink-0 snap-start items-center gap-3 p-4">
              <Ring value={x.p} size={64} />
              <span className="min-w-0">
                <span className="block truncate text-[11px] font-semibold text-muted">{x.icon} {x.comp} · {fmtDateTime(x.start)}</span>
                <span className="block truncate text-sm font-extrabold">{x.pick}</span>
                <span className="block truncate text-xs text-muted">{x.home.name} – {x.away.name}</span>
                <span className="num mt-0.5 block text-xs font-bold text-brand">cote juste {o2(x.fair)}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : <p className="card p-4 text-sm text-muted">Les pronos tennis, basket et hockey du jour apparaissent ici dès que le calendrier est publié.</p>}
      <div className="card p-4 sm:p-5">
        <div className="mb-3 flex items-end justify-between gap-3"><h3 className="text-base font-extrabold">Ce que l'IA a appris sur 4 saisons</h3><Link href="/methode" className="text-xs font-bold text-brand hover:underline">Méthode →</Link></div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {facts.map(([n, t, s, cls]) => (
            <div key={n} className="rounded-2xl bg-card2 p-3">
              <div className={`num text-2xl font-extrabold ${cls}`}>{n}</div>
              <div className="mt-1 text-xs font-semibold leading-snug">{t}</div>
              <div className="mt-1 text-[10px] text-muted">{s}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
