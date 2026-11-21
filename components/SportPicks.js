import Link from "next/link";
import { sportPicks } from "@/lib/sportpicks";
import { Badge } from "@/components/Team";
import { fmtDateTime, dayKey, todayKey } from "@/lib/format";

const P = (p) => Math.round(p * 100) + " %";
const o2 = (v) => Number(v).toFixed(2).replace(".", ",");

export default async function SportPicks() {
  const picks = await sportPicks();
  if (!picks.length) return null;
  const today = todayKey();
  const groups = [["Ce soir et aujourd'hui", picks.filter((x) => dayKey(x.start) === today)], ["Demain", picks.filter((x) => dayKey(x.start) !== today)]].filter(([, xs]) => xs.length);
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-extrabold tracking-tight">Tennis, basket, hockey, rugby, foot US : pronos IA<span className="ml-2 text-sm font-medium text-muted">{picks.length} pronos, jusqu'à 4 par sport et par jour</span></h2>
      <p className="text-xs text-muted">Vainqueur du match, un pari proposé par Winamax, Betclic, Unibet et PMU. La cote juste est la cote minimale à exiger : jouez seulement si votre appli affiche plus. Ce sont des estimations, jamais des certitudes.</p>
      {groups.map(([title, xs]) => (
        <div key={title} className="space-y-2">
          <h3 className="text-lg font-extrabold">{title}</h3>
          <div className="grid gap-3 lg:grid-cols-2">
            {xs.map((x) => (
              <Link key={x.id} href={x.href} className="card block space-y-2.5 p-4 transition hover:shadow-md">
                <div className="text-[11px] font-semibold text-muted">{x.icon} {x.comp} · {fmtDateTime(x.start)}</div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <span className="flex min-w-0 items-center gap-2"><Badge src={x.home.logo} name={x.home.name} size={28} /><span className="truncate text-sm font-bold">{x.home.name}</span></span>
                  <span className="text-xs font-semibold text-muted">vs</span>
                  <span className="flex min-w-0 items-center justify-end gap-2"><span className="truncate text-right text-sm font-bold">{x.away.name}</span><Badge src={x.away.logo} name={x.away.name} size={28} /></span>
                </div>
                <div className="flex items-baseline justify-between gap-3"><span className="text-sm font-extrabold text-brand">{x.pick}</span><span className="num text-sm font-bold">{P(x.p)} · cote juste {o2(x.fair)}</span></div>
                <div className="pbar" aria-hidden><span style={{ width: `${Math.round(x.p * 100)}%` }} /></div>
                <div className="rounded-lg bg-card2 px-2.5 py-2 text-[11px] leading-relaxed"><b className="text-brand">Pourquoi ce choix ?</b> {x.why}</div>
                <span className="text-xs font-bold text-brand">Suivre le score en direct →</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
