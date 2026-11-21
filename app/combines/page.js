import Link from "next/link";
import { SPORTS } from "@/lib/odds";
import { loadEnriched } from "@/lib/data";
import { smartCombos } from "@/lib/combos2";
import { ComboCard } from "@/components/ComboCard";
import { Setup } from "@/components/Setup";

export const metadata = { title: "Combinés intelligents" };
export const dynamic = "force-dynamic";

const PROF = [["", "Tous les profils"], ["sure", "Prudent"], ["balanced", "Équilibré"], ["bold", "Audacieux"]];

export default async function Combines({ searchParams }) {
  const { n, p } = await searchParams;
  const data = await loadEnriched();
  if (data.error && data.matches.length === 0) return <Setup msg={data.error} />;
  const all = smartCombos(data.matches);
  const size = [2, 3, 4, 5].includes(Number(n)) ? Number(n) : 0;
  const prof = PROF.some(([k]) => k && k === p) ? p : "";
  const shown = all.filter((c) => (!size || c.size === size) && (!prof || c.tier === prof));
  const icons = Object.fromEntries(Object.entries(SPORTS).map(([k, v]) => [k, v.icon]));
  const href = (o) => { const q = new URLSearchParams(); const s = o.n !== undefined ? o.n : size; const pr = o.p !== undefined ? o.p : prof; if (s) q.set("n", s); if (pr) q.set("p", pr); const t = q.toString(); return t ? `/combines?${t}` : "/combines"; };
  const chip = (to, label, active) => <Link key={label} href={to} className={`tab shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${active ? "border-navy bg-navy text-white" : "border-line bg-white text-muted hover:text-ink"}`}>{label}</Link>;
  return (
    <div className="space-y-6">
      <section className="hero p-6 sm:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Combinés intelligents</h1>
        <p className="muted mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">De 2 à 5 sélections, sur les matchs des 8 prochains jours, avec les vraies cotes d'un même bookmaker. Un seul pari par match : les rencontres sont indépendantes, donc la chance de passer est le produit des probabilités de chaque sélection. Deux paris du même match ne sont jamais combinés, car leurs issues sont liées.</p>
        <p className="mt-3 rounded-xl border border-brand/20 bg-white/70 px-3 py-2 text-xs text-brand">Un combiné n'est jamais sûr : plus il y a de sélections, plus il perd souvent. Mises très réduites.</p>
      </section>
      <div className="space-y-2">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">{chip(href({ n: "" }), "2 à 5 sélections", !size)}{[2, 3, 4, 5].map((k) => chip(href({ n: k }), `${k} sélections`, size === k))}</div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">{PROF.map(([k, l]) => chip(href({ p: k }), l, prof === k))}</div>
      </div>
      {shown.length === 0 ? (
        <p className="card p-5 text-sm text-muted">Pas assez de matchs avec des cotes pour composer ce combiné. Essayez un autre profil ou un autre nombre de sélections.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">{shown.map((c) => <ComboCard key={c.label + c.legs.map((l) => l.id).join()} c={c} icons={icons} />)}</div>
      )}
      <p className="text-xs text-muted">Estimations fondées sur le consensus des bookmakers étrangers, ajusté par la forme quand elle est connue. Aucun gain n'est garanti.</p>
    </div>
  );
}
