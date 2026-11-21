import Link from "next/link";
import { cookies } from "next/headers";
import { SPORTS } from "@/lib/odds";
import { loadEnriched } from "@/lib/data";
import { MatchCard } from "@/components/MatchCard";
import { dayKey, fmtDayShort } from "@/lib/format";

export const metadata = { title: "Mes favoris" };
export const dynamic = "force-dynamic";

export default async function Favoris() {
  const jar = await cookies();
  const ids = (decodeURIComponent(jar.get("fe_favs")?.value || "")).split(",").filter(Boolean);
  const data = ids.length ? await loadEnriched() : { matches: [] };
  const byId = new Map((data.matches || []).map((m) => [m.id, m]));
  const found = ids.map((id) => byId.get(id)).filter(Boolean).sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const gone = ids.length - found.length;
  const days = [];
  for (const m of found) { const k = dayKey(m.start); let d = days.find((x) => x.k === k); if (!d) { d = { k, items: [] }; days.push(d); } d.items.push(m); }
  return (
    <div className="space-y-6">
      <section className="hero p-6 sm:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Mes favoris</h1>
        <p className="muted mt-2 max-w-2xl text-sm leading-relaxed">Touchez l'étoile d'un match pour le retrouver ici avec ses cotes à jour. Les favoris sont gardés sur cet appareil (cookie), sans compte. Un match terminé disparaît de la liste.</p>
      </section>
      {ids.length === 0 && (
        <div className="card p-6 text-sm text-muted">
          <p>Aucun favori pour le moment.</p>
          <p className="mt-2">Ouvrez <Link href="/matchs" className="font-bold text-brand">la liste des matchs</Link> et touchez l'étoile en haut à droite d'une carte.</p>
        </div>
      )}
      {ids.length > 0 && found.length === 0 && <p className="card p-5 text-sm text-muted">Les matchs mis en favori ne sont plus à l'affiche (terminés ou sans cotes disponibles).</p>}
      {days.map((d) => (
        <section key={d.k} className="space-y-3">
          <h2 className="text-lg font-extrabold">{fmtDayShort(d.k)}</h2>
          <div className="grid gap-3 md:grid-cols-2">{d.items.map((m) => <MatchCard key={m.id} m={m} icon={SPORTS[m.sport].icon} />)}</div>
        </section>
      ))}
      {gone > 0 && found.length > 0 && <p className="text-xs text-muted">{gone} favori{gone > 1 ? "s" : ""} n'est plus à l'affiche (terminé ou sans cotes).</p>}
    </div>
  );
}
