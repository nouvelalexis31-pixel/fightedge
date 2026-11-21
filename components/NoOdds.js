import { Suspense } from "react";
import SportPicks from "@/components/SportPicks";
import EspnPicks from "@/components/EspnPicks";

// Quand la source de cotes est vide (quota épuisé, panne), la page reste utile : pronos IA calculés depuis le
// calendrier ESPN (foot, tennis, basket, hockey…) avec leur cote juste à comparer sur l'appli de l'opérateur.
export default function NoOdds({ msg, title = "Les pronos du jour", extra = null }) {
  return (
    <div className="space-y-7">
      <section className="hero p-6 sm:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        <p className="muted mt-2 max-w-2xl text-sm leading-relaxed sm:text-base">Notre source de cotes françaises ne répond pas pour le moment ({msg === "no-key" ? "clé manquante" : String(msg || "source indisponible").replace(/\.$/, "")}). Les pronos IA restent disponibles : ils sont calculés à partir du calendrier, de la forme des équipes et de nos modèles. Chaque prono indique sa cote juste : jouez-le seulement si votre appli affiche plus.</p>
      </section>
      {extra}
      <Suspense fallback={<p className="card p-4 text-xs text-muted">Analyse des matchs de tennis, basket, hockey et rugby en cours…</p>}><SportPicks /></Suspense>
      <Suspense fallback={<p className="card p-4 text-xs text-muted">Analyse des prochains matchs de football en cours…</p>}><EspnPicks /></Suspense>
    </div>
  );
}
