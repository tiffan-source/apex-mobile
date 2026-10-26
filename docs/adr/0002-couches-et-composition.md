# ADR 0002 — Des couches vérifiées par le lint, une racine de composition

- Statut : accepté
- Date : 2026-10-25

## Contexte

Apex et Apex Brain sont hexagonaux : le métier ne dépend que d'abstractions, l'infrastructure les
implémente, un seul endroit assemble le tout (`apps/apex-client/src/chore/providers` dans Apex,
`ProductionAdaptersModule` dans Apex Brain), et la règle est vérifiée par le lint (tags Nx). Une
application React Native mélange facilement tout dans les composants : appels réseau, règles et rendu.

## Décision

- **Sept couches** dans `src/` : `domain` (règles, TypeScript pur), `application` (services, commandes,
  ports), `infrastructure` (adaptateurs), `state` (TanStack Query et hooks), `ui` (compositions sur
  Empreinte), `features` (écrans), `app` (routes) ; plus `composition` (la racine) et `testing`.
- **La règle de dépendance est dans `eslint.config.js`** (`no-restricted-imports`, par l'alias comme
  par un chemin relatif) : le domaine n'importe ni React, ni Expo, ni TanStack Query, ni le rendu
  d'Empreinte (seulement `@empreinte-studio/noyau`) ; l'application ne connaît que des ports ; l'interface
  (`ui`) ignore le domaine ; seule la route racine pose la racine de composition.
- **Des ports en interfaces TypeScript** (`application/ports`) : passerelles d'Apex Brain, coffre de
  session, préférences, lecteur d'écran, horloge, minuteries.
- **Une racine de composition** (`composition/assemble-services.ts`) construit les services
  (`AppServices`) à partir des adaptateurs ; la production (`composition/production.ts`) et les tests
  (`testing/test-app.tsx`) l'appellent avec les leurs. Les écrans lisent les services par un contexte
  (`state/services.tsx`).
- **Le code est en anglais** (domaine, application, état, écrans), comme Apex et Apex Brain ; **les
  compositions de `src/ui` parlent la langue d'Empreinte** (français), parce qu'elles sont faites pour y
  remonter. Commentaires, docs, textes et commits sont en français.

## Conséquences

- Les règles et les services se testent sans rendu ni réseau, en Node (projet Jest « Règles »).
- Les écrans se testent sur les vraies routes avec les vrais services, branchés sur des doublures en
  mémoire : ce qui est vérifié est ce qui tourne.
- Ajouter un adaptateur (un autre coffre, un autre serveur) ne touche que l'infrastructure et la racine.
