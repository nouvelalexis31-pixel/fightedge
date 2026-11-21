// Leçons tirées de l'entraînement sur l'historique (paris fictifs, jamais de donnée future) :
// football : 16 championnats, saisons 2021-22 → 2026-27 (29 540 matchs ; apprentissage sur 2021-24, test sur 12 221 matchs 2024-26).
// Les chiffres ci-dessous sont les résultats du test, à mise fixe, au prix moyen du marché (proche des opérateurs français).
export const LEARNED = {
  foot: {
    testMatches: 12221,
    favoriAlways: -0.044,           // jouer toujours le favori : -4,4 %
    valueShort: 0.0017,             // plus-value ≥ 2 % sur cotes 1,30–2,20 : +0,2 % (768 paris), seule zone rentable
    valueMid: -0.074,               // plus-value sur cotes 2,20–3,50 : -7 %
    valueLong: -0.294,              // plus-value sur cotes > 3,50 : -29 % (les « gros coups » perdent)
    prob70: -0.0028,                // proba ≥ 70 % : quasi à l'équilibre (-0,3 %)
    steam: 0.0617,                  // suivre la cote qui baisse d'au moins 3 pts avant le match : +6,2 % (1 946 paris)
    over25: 0.0169,                 // plus/moins 2,5 buts avec avantage : +1,7 %
    marketWeight: 0.5,              // meilleur mélange marché / modèle mesuré (logloss mini entre 0,5 et 0,7)
    // facteurs qui améliorent la prévision au-delà des cotes : forme domicile / extérieur et jours de repos ;
    // la forme générale, l'Elo et les tirs cadrés sont déjà intégrés dans les cotes (aucun gain).
  },
};
// Fenêtre de cotes où une plus-value football s'est révélée rentable sur l'historique.
export const FOOT_VALUE_MAX_ODDS = 2.2;
export const FOOT_VALUE_MIN_ODDS = 1.3;
export const STEAM_MIN = 0.03; // baisse de cote significative (en points de probabilité)
export const footValueOk = (odds) => odds >= FOOT_VALUE_MIN_ODDS && odds <= FOOT_VALUE_MAX_ODDS;
