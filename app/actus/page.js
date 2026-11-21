import { enough } from "@/lib/enough";
import { loadNews } from "@/lib/news";
import { loadEnriched } from "@/lib/data";
import { SPORTS } from "@/lib/odds";
import Link from "next/link";
import { fmtDateTime, odd, pct } from "@/lib/format";

export const metadata = { title: "Actualités foot" };
export const dynamic = "force-dynamic";

const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); if (m < 1) return "à l'instant"; if (m < 60) return `il y a ${m} min`; const h = Math.round(m / 60); if (h < 24) return `il y a ${h} h`; return fmtDateTime(t); };
const Img = ({ src, cls }) => src ? <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" className={`w-full bg-card2 object-cover ${cls}`} /> : null;

async function favourites() {
  try {
    const d = await loadEnriched();
    const now = Date.now();
    return (d.matches || []).filter((m) => enough(m) && +new Date(m.start) > now && +new Date(m.start) <= now + 36 * 3600e3).map((m) => {
      const o = (m.outcomes || []).filter((x) => x.name !== "Match nul" && x.probAdj != null && x.best).sort((a, b) => b.probAdj - a.probAdj)[0];
      return o && o.probAdj >= 0.5 ? { m, o } : null;
    }).filter(Boolean).sort((a, b) => b.o.probAdj - a.o.probAdj).slice(0, 6);
  } catch { return []; }
}

export default async function Actus() {
  const [n, favs] = await Promise.all([loadNews(), favourites()]);
  const [top, ...rest] = n.items;
  return (
    <div className="space-y-6">
      <section className="hero p-6 sm:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Actualités foot</h1>
        <p className="muted mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">Les infos du moment en quelques lignes, avec photos : résultats, blessures, transferts, polémiques. Un clic ouvre l&apos;article complet sur le site du média.</p>
        {n.sources.length > 0 && <p className="muted mt-3 text-[11px]">Sources : {n.sources.join(", ")}. Mise à jour toutes les 10 minutes.</p>}
      </section>
      {favs.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-extrabold tracking-tight">Les vainqueurs probables des prochaines 36 h</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {favs.map(({ m, o }) => (
              <Link key={m.id} href={`/match/${encodeURIComponent(m.id)}`} className="card block space-y-1.5 p-4 transition hover:border-brand/40">
                <div className="text-xs text-muted">{SPORTS[m.sport]?.icon} {m.league} · {fmtDateTime(m.start)}</div>
                <div className="text-sm text-muted">{m.home} – {m.away}</div>
                <div className="text-base font-extrabold">{o.name}</div>
                <div className="num text-sm"><b className="text-good">{pct(o.probAdj)}</b> de chances · cote {odd(o.best.odds)} {o.best.book}</div>
              </Link>
            ))}
          </div>
          <p className="text-xs text-muted">Estimation d&apos;après le consensus des bookmakers : le favori peut perdre, aucune victoire n&apos;est acquise.</p>
        </section>
      )}
      {!top ? (
        <div className="card p-6 text-sm text-muted">Les flux d&apos;actualité sont momentanément injoignables. Réessayez dans quelques minutes.</div>
      ) : (
        <>
          <a href={top.link} target="_blank" rel="noopener noreferrer" className="card block overflow-hidden transition hover:shadow-md">
            <Img src={top.img} cls="aspect-[16/9] sm:aspect-[21/9]" />
            <div className="space-y-2 p-5 sm:p-6">
              <div className="text-xs text-muted">{top.src} · {ago(top.t)}</div>
              <h2 className="text-xl font-extrabold leading-snug sm:text-2xl">{top.title}</h2>
              {top.desc && <p className="text-sm leading-relaxed text-muted">{top.desc}</p>}
            </div>
          </a>
          <div className="grid gap-4 md:grid-cols-2">
            {rest.map((a) => (
              <a key={a.link} href={a.link} target="_blank" rel="noopener noreferrer" className="card flex flex-col overflow-hidden transition hover:shadow-md">
                <Img src={a.img} cls="aspect-[16/9]" />
                <div className="flex flex-col gap-1.5 p-4">
                  <div className="text-xs text-muted">{a.src} · {ago(a.t)}</div>
                  <h3 className="text-base font-bold leading-snug">{a.title}</h3>
                  {a.desc && <p className="text-sm leading-relaxed text-muted">{a.desc}</p>}
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
