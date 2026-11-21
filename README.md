# FightEdge

Site de pronostics sportifs (Next.js 16, React 19, Tailwind 4) déployé sur Vercel : https://fightedge.vercel.app

## Ouvrir et lancer le projet dans VS Code

1. Installez [Node.js 22](https://nodejs.org) et [VS Code](https://code.visualstudio.com).
2. Dans VS Code : `Ctrl+Maj+P` → **Git: Clone** → collez l'adresse de ce dépôt, puis ouvrez le dossier.
3. Ouvrez le terminal de VS Code (`Ctrl+ù`) et lancez :

```bash
npm install
```

4. Copiez `.env.example` en `.env.local` et remplissez les clés (The Odds API, football-data, Vercel Blob…). Sans clé, le site fonctionne mais sans cotes.
5. Lancez le site en local :

```bash
npm run dev
```

puis ouvrez http://localhost:3000

6. (Optionnel) Recalculer le classement Elo tennis à partir de l'historique ESPN :

```bash
npm run elo
```

## Mettre en ligne

Le projet Vercel est relié à ce dépôt : chaque `git push` sur une branche crée une **preview**, et un push (ou une fusion) sur `main` met à jour **la production**.

## Organisation

- `app/` : les pages (accueil, pronos, direct, match, bilan, méthode…)
- `components/` : les blocs d'interface (cartes de pronos, analyse visuelle, graphiques…)
- `lib/` : le moteur : cotes (`odds.js`), modèle Poisson / Dixon-Coles (`edge.js`), règles apprises sur l'historique (`learned.js`), mouvements de cotes (`steam.js`), Elo tennis (`tennisElo.js`), pronos multi-sports (`sportpicks.js`)
- `scripts/build-tennis-elo.mjs` : reconstruit le classement Elo tennis (exécuté automatiquement à chaque déploiement)
