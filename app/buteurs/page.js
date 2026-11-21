import Link from "next/link";
import { getTopScorers, SCORER_COMPS } from "@/lib/fd";
import { FormScorers } from "@/components/FormScorers";

export const metadata = { title: "Buteurs en forme" };
export const dynamic = "force-dynamic";

export default async function Buteurs({ searchParams }) {
  const sp = (await searchParams) || {};
  const comp = SCORER_COMPS[sp.comp] ? sp.comp : "";
  const d = await getTopScorers();
  const list = d.scorers.filter((s) => !comp || s.comp === comp);
  const chip = (to, label, on) => <Link key={label} href={to} className={`tab shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${on ? "border-navy bg-navy text-white" : "border-line bg-white text-muted"}`}>{label}</Link>;
  return (
    <div className="space-y-6">
      <section className="hero p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Buteurs en forme</h1>
        <p className="muted mt-2 max-w-2xl text-sm">Les joueurs qui marquent le plus souvent cette saison, par championnat. Utile pour les marchés « buteur à tout moment », « premier buteur » ou « buteur sur plusieurs matchs ». Les cotes par match sont dans la fiche de chaque rencontre.</p>
      </section>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {chip("/buteurs", "Tous", !comp)}
        {Object.entries(SCORER_COMPS).map(([k, v]) => chip("/buteurs?comp=" + k, v, comp === k))}
      </div>
      <FormScorers scorers={list} limit={comp ? 30 : 40} title={comp ? SCORER_COMPS[comp] : "Classement général"} error={d.error} />
    </div>
  );
}
