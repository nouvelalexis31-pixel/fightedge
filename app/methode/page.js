import { loadAll } from "@/lib/odds";
import { hasFd } from "@/lib/fd";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Méthode et sources" };
export const revalidate = 3600;

export default async function Methode() {
  const d = await loadAll();
  return (
    <div className="max-w-3xl space-y-5 text-sm leading-relaxed">
      <h1 className="text-3xl font-extrabold tracking-tight">Méthode, sources et limites</h1>
      <p className="text-muted">FightEdge compare de vraies cotes, estime des probabilités, vérifie ses propres pronostics et publie le résultat. Rien n'est inventé : quand une donnée manque, elle est marquée « Non disponible ».</p>
      <div className="card space-y-3 p-5">
        <h2 className="text-lg font-extrabold">Ce que l'IA a appris de l'historique</h2>
        <p className="text-muted">L'IA a pris des positions fictives sur des milliers de matchs passés, sans jamais utiliser d'information postérieure au coup d'envoi. Elle a appris sur les premières saisons, puis a été testée sur les suivantes, comme si elle pariait en vrai. Résultats du test, à mise fixe et au prix moyen du marché :</p>
        <h3 className="font-extrabold">Football : 16 championnats, saisons 2021-22 à 2026-27 (29 540 matchs, dont 12 221 en test)</h3>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Jouer systématiquement le favori fait <b>perdre 4,4 %</b> des mises : la marge du bookmaker suffit à rendre cette méthode perdante.</li>
          <li>La seule zone où une « plus-value » a été rentable : <b>cotes de 1,30 à 2,20</b>, avec un avantage d'au moins 2 % (+0,2 %, quasi à l'équilibre). Entre 2,20 et 3,50, ces paris perdent 7 % ; au-dessus de 3,50, ils perdent près de 30 %. FightEdge ne signale donc plus de plus-value au-delà de 2,20.</li>
          <li>Le signal le plus rentable : <b>suivre une cote qui baisse</b> d'au moins 3 points avant le match (+6,2 % sur 1 946 paris). Une baisse traduit en général une information (composition, blessure, suspension) que le marché a intégrée. FightEdge compare maintenant les cotes du jour à celles relevées 1 à 3 jours plus tôt, met en avant ces mouvements et écarte les issues dont la cote s'envole.</li>
          <li>Plus / moins de 2,5 buts avec un avantage mesuré : +1,7 % (445 paris).</li>
          <li>Ce qui améliore la prévision au-delà des cotes : la forme <b>à domicile et à l'extérieur</b> et les <b>jours de repos</b>. La forme générale, l'Elo et les tirs cadrés sont déjà intégrés dans les cotes et n'apportent rien de plus.</li>
          <li>Le meilleur mélange entre cotes du marché et modèle est environ 50 / 50 : ni le modèle seul, ni les cotes seules.</li>
        </ul>
        <h3 className="font-extrabold">Tennis : ATP et WTA, 2022 à novembre 2026 (46 959 matchs, dont 23 860 en test)</h3>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Le classement Elo FightEdge, recalculé match après match, trouve le vainqueur dans <b>64,3 %</b> des cas, avec des probabilités fiables : quand il annonce 80 %, le favori gagne 83 % du temps.</li>
          <li>Facteurs décisifs, par ordre d'importance : le niveau (Elo), la domination récente (part des jeux gagnés sur les 5 derniers matchs), la forme sur 10 matchs, puis le repos. La surface et la fatigue (matchs joués en 14 jours) n'apportent presque rien en plus.</li>
          <li>FightEdge écarte un pari tennis quand son classement juge le joueur nettement moins fort que ne le disent les bookmakers. Les cotes historiques du tennis n'étant pas accessibles, la rentabilité n'a pas pu être mesurée sur ce sport.</li>
        </ul>
        <p className="text-xs text-muted">Limite importante : les compositions d'équipe et l'actualité passées ne sont pas disponibles en masse. Leur effet est mesuré à travers le mouvement des cotes, qui les reflète. Aucun modèle ne garantit un gain : les marchés sont très efficaces, et l'avantage reste faible.</p>
      </div>
      <div className="card space-y-3 p-5">
        <h2 className="text-lg font-extrabold">Sources de données</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li><b>The Odds API</b> : cotes de Betclic, Winamax, Unibet et PMU (et d'une dizaine de bookmakers étrangers pour mesurer le marché). Forfait limité en requêtes par mois : FightEdge met les cotes en cache et choisit les compétitions du jour pour ne pas gaspiller ses crédits.</li>
          <li><b>football-data.org</b> : forme, classements et scores du football européen. <b>ESPN</b> : scores en direct et résultats de plus de 50 compétitions de football, basket, hockey, football US, baseball et tennis. <b>NHL, MLB</b> : scores officiels.</li>
          <li><b>API-Football (API-Sports)</b> : compositions et statistiques avancées, <b>actuellement indisponible</b> (compte suspendu) ; les compositions apparaissent seulement quand la source répond. <b>Sportmonks</b> : non branché.</li>
          <li><b>Flux RSS</b> de la presse sportive pour les actualités.</li>
        </ul>
        <p><b>Bookmakers :</b> Betclic, Winamax, Unibet et PMU. ParionsSport, Bwin et Bet365 ne sont pas fournis par la source de cotes : ils sont absents plutôt qu'inventés. Les clés d'API se configurent dans les variables d'environnement du projet (ODDS_API_KEY, FOOTBALL_DATA_KEY, API_FOOTBALL_KEY) sur Vercel, jamais dans le code.</p>
      </div>
      <div className="card space-y-3 p-5">
        <h2 className="text-lg font-extrabold">Le modèle (version 1)</h2>
        <p><b>Probabilités 1 N 2 :</b> pour chaque pari, la marge des bookmakers étrangers est retirée, puis on fait la moyenne. On obtient l'avis collectif du marché et la cote « juste » (1 ÷ probabilité).</p>
        <p><b>Forme :</b> pour le football, les 5 derniers résultats réels (football-data.org) ajustent la probabilité de 3 points au maximum.</p>
        <p><b>Buts, sets, points :</b> un modèle de Poisson déduit des cotes du total estime les scores probables, les deux équipes marquent et le plus / moins de buts ; un modèle dédié estime les sets au tennis et les points au basket. Ces marchés « estimés » sont affichés avec leur cote juste, jamais avec une cote de bookmaker.</p>
        <p><b>Fiabilité (étoiles) :</b> accord entre bookmakers, nombre de cotes, probabilité et forme. Une fiabilité élevée ne veut pas dire « va gagner » : elle mesure la solidité de l'estimation.</p>
        <p><b>Pas encore dans le modèle :</b> expected goals (xG), blessures, suspensions, compositions, arbitres, météo. Ils demandent une source de données payante ; tant qu'elle n'est pas branchée, FightEdge ne prétend pas les analyser.</p>
      </div>
      <div className="card space-y-3 p-5">
        <h2 className="text-lg font-extrabold">Value bets</h2>
        <p>Probabilité implicite = 1 ÷ cote. Cote théorique = 1 ÷ probabilité estimée. Value % = (probabilité × cote − 1) × 100.</p>
        <p>Paliers (modifiables sur la page Value bets) : <b className="text-good">exceptionnelle</b> dès 15 %, <b>très bonne</b> de 10 à 14,99 %, <b>bonne</b> de 5 à 9,99 %, <b>faible</b> de 1 à 4,99 %, aucun avantage à 0 % et en dessous (non affichée). Une value est un avantage moyen estimé sur un grand nombre de paris, jamais une garantie : elle peut aussi venir d'une cote en retard ou d'une erreur d'estimation.</p>
      </div>
      <div className="card space-y-3 p-5">
        <h2 className="text-lg font-extrabold">Combinés</h2>
        <p>De 2 à 5 sélections, un seul pari par match : les événements sont indépendants, la probabilité du combiné est le produit des probabilités et la cote totale celui des cotes. Deux paris du même match ne sont jamais combinés (leurs résultats sont liés, le calcul serait faux). Trois profils : prudent, équilibré, audacieux. Plus un combiné compte de sélections, plus la marge du bookmaker et le risque s'accumulent.</p>
      </div>
      <div className="card space-y-3 p-5">
        <h2 className="text-lg font-extrabold">Bilan IA et amélioration du modèle</h2>
        <p>Chaque pronostic publié est enregistré une seule fois, avec sa cote, son bookmaker, sa probabilité, sa value et sa fiabilité. Il n'est jamais modifié : le règlement est ajouté à part, après le match. Bankroll virtuelle : mise fixe (10 € par défaut), gain = mise × (cote − 1), perte = mise, annulé = 0 ; ROI = bénéfice net ÷ total misé ; les paris en attente sont exclus.</p>
        <p><b>Versions du modèle :</b> v1 (novembre 2026), première version suivie. Le modèle n'est jamais modifié parce qu'une semaine est mauvaise : un recalibrage n'est envisagé qu'avec au moins 30 paris réglés par catégorie, un écart de calibration durable, et un test sur des matchs que le modèle n'a pas vus. Chaque changement sera consigné ici avec les performances avant et après.</p>
        <p><b>Closing Line Value :</b> comparaison entre la cote publiée et la dernière cote relevée avant le match ; indicative, car les relevés dépendent des visites et de deux passages automatiques par jour.</p>
      </div>
      <div className="card space-y-2 p-5">
        <h2 className="text-lg font-extrabold">Limites</h2>
        <p>Les cotes affichées peuvent avoir changé : vérifiez toujours chez l'opérateur. Notre « confiance » est un indicateur interne, pas une garantie. Les marchés buteurs, cartons ou corners ne sont affichés que si un bookmaker les propose dans les données reçues. Les résultats de certaines compétitions peu couvertes (par exemple l'Euroligue) peuvent ne pas être réglés automatiquement. La plupart des parieurs perdent de l'argent sur la durée.</p>
        <p>Le « ressenti » est celui du marché : nous ne mesurons pas l'opinion des médias ou des réseaux sociaux.</p>
      </div>
      <div className="card space-y-1 p-5 text-xs text-muted">
        <h2 className="text-sm font-extrabold text-ink">État des données</h2>
        <p>Cotes mises à jour : {d.fetchedAt ? fmtDateTime(d.fetchedAt) : "—"}{d.credits != null ? ` · crédits API restants ce mois-ci : ${d.credits}` : ""}.</p>
        <p>Marchés supplémentaires (les deux équipes marquent, nul remboursé, double chance, buteurs) : {d.extra?.asked ? `${d.extra.ok}/${d.extra.asked} matchs interrogés · buteurs ${d.extra.scorers || 0} (dont ${d.extra.frScorers || 0} avec cotes Betclic/Winamax/Unibet) · les deux équipes marquent ${d.extra.btts || 0} · nul remboursé ${d.extra.dnb || 0} · double chance ${d.extra.dc || 0} · ${d.extra.spent} crédits utilisés` : "aucun match interrogé (crédits insuffisants ou pas de match concerné)"}{d.extra?.errors?.length ? ` · erreurs : ${[...new Set(d.extra.errors)].join(", ")}` : ""}.</p>
        <p>Forme et scores en direct : {hasFd() ? "football-data.org actif" : "ESPN et football-data.org"}.</p>
      </div>
      <p>Jouer comporte des risques : endettement, isolement, dépendance. Joueurs Info Service : 09 74 75 13 13 (appel non surtaxé).</p>
    </div>
  );
}
