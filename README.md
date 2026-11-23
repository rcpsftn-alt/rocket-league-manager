# Rocket League Manager (RLM)

Simulation de management esport Rocket League inspirée de Football Manager. Monde 100 % fictif (organisations, joueurs, marques, tournois).

## Lancer

```
npm install
npm run dev        # http://localhost:5178
npm run build      # typecheck + build de production
npx tsx scripts/simtest.ts 3   # simulation headless de 3 saisons (équilibrage)
npx tsx scripts/calib.ts       # calibration du moteur de match (win% selon l'écart de niveau)
```

## Architecture

- `src/engine/` : toute la logique de jeu, en TypeScript pur, sans React. Elle tourne aussi en Node (scripts).
  - `types.ts` : modèle de données normalisé (tables indexées par id : joueurs, organisations, staff, sponsors, contrats, tournois, matchs, news, offres, journal financier…).
  - `world.ts` : génération du monde (7 régions × 16 organisations, environ 650 joueurs, staff, 30 marques) et création de carrière (création, reprise, sans club).
  - `matchsim.ts` : moteur de match. Chaque jeu est découpé en phases d'environ 8 s (possession → création → tir contre arrêt → démos → momentum), le tout alimenté par les attributs, la condition, la chimie, la composition et la tactique. Prolongation en but en or, pression clutch, gestion d'un gros écart au score.
  - `results.ts` : conséquences d'une série (stats, forme, moral, fatigue, chimie, Elo, réputation, records, news).
  - `competitions.ts` : calendrier RLCS (6 régionaux, 2 Majors, Worlds, invitational), suisse 3-3, élimination directe, groupes, points circuit, qualifications, cashprizes partagés selon les contrats.
  - `training.ts` : progression quotidienne (courbe d'âge, potentiel caché, staff, focus, intensité), fatigue, burnout, blessures.
  - `transfers.ts` : fenêtres de mercato, offres, clauses, négociation de contrat, libérations, marché IA.
  - `finance.ts`, `commercial.ts` : cycle mensuel, prévisions, dette, faillite ; sponsors (intérêt, valorisation, objectifs, obligations) ; réseaux sociaux.
  - `ai.ts`, `season.ts` : organisations IA, marché des managers, board, fin de saison (retraites, jeunes talents, contrats, dissolutions et nouvelles organisations).
  - `advance.ts` : orchestrateur du temps (jour par jour, RNG seedé et sérialisé dans la sauvegarde).
  - `save.ts` : persistance IndexedDB (API dépôt `list/load/save/delete`, remplaçable par SQLite ou PostgreSQL).
- `src/ui/` : React, Tailwind et Recharts. `store.ts` (zustand) : toute mutation passe par `act()`, qui gère le RNG, le rafraîchissement et l'autosave.

## Pourquoi IndexedDB plutôt que SQLite

Le jeu tourne entièrement dans le navigateur, sans backend ni API externe. Les entités sont déjà normalisées en tables relationnelles, et la couche `save.ts` isole le stockage. La migration vers SQLite (Electron ou serveur) ou PostgreSQL se fait donc sans toucher au moteur.

## Limites connues / prochaines étapes

- Prêts et échanges de joueurs : pas encore implémentés.
- Double élimination : non utilisée. Le circuit emploie le suisse, l'élimination directe et les groupes.
- Les organisations IA ne prolongent pas activement leurs joueurs avant la fin de contrat ; la décision se prend au 1er janvier.
- Bundle unique d'environ 700 kB, sans code splitting.
