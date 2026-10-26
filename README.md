# Apex mobile

Apex sur iOS et Android : mener un objectif jusqu'au sommet, pas après pas. L'application reprend les
fonctionnalités d'Apex V1 (le client web Angular, dépôt `tiffan-source/apex`) en React Native, sur
l'API d'**Apex Brain** (dépôt `tiffan-source/apex-brain`) et avec les composants React Native
d'**Empreinte**, le design system de la suite.

- **Expo SDK 58** (React Native 0.88, React 19.3, TypeScript 6), **Expo Router** pour la navigation.
- **TanStack Query** pour les lectures, une file d'écritures optimistes reprise du client web.
- **`@empreinte-studio/react-native`** pour l'identité : couleurs Jour et Nuit, typographie, panneaux
  à corne, sceau, cases, pas, arête, notes.

## Les écrans

| Écran                       | Route                                                                  | Ce qu'on y fait                                                                                          |
| --------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Connexion                   | `/auth`                                                                | Se connecter, créer son compte.                                                                          |
| Objectifs (accueil, onglet) | `/`                                                                    | Les objectifs en marche en cartes (progression, prochain pas à cocher), les accomplis dans un repli.     |
| La matrice (onglet)         | `/matrice`                                                             | Les pas dans les quatre quadrants d'Eisenhower, filtrés par objectif ; cocher, « Déplacer vers… ».       |
| Nouvel objectif             | `/objectifs/nouveau`                                                   | Akari pose ses questions, le brouillon se met à jour ; « Je m'y engage » crée l'objectif et ouvre Akari. |
| L'arête d'un objectif       | `/objectifs/:id`                                                       | L'arête des étapes, l'étape choisie et ses pas ; ajouter, modifier, cocher.                              |
| Akari                       | `/objectifs/:id/akari`                                                 | La conversation avec Akari (Markdown), ses propositions d'étapes et de pas, acceptées une à une.         |
| Feuilles                    | `…/modifier`, `…/nouvelle-etape`, `…/nouveau-pas`, `/pas/:id/modifier` | Modifier l'objectif, ajouter ou modifier une étape, ajouter ou modifier un pas.                          |
| Réglages                    | `/reglages`                                                            | Le thème (Jour, Nuit, comme l'appareil), la déconnexion.                                                 |

Les objectifs, l'arête et la matrice se rechargent en tirant l'écran vers le bas, et d'eux-mêmes au
retour au premier plan. Les gestes sont optimistes : l'écran change tout de suite, l'enregistrement
suit ; ce qui n'aboutit pas revient en arrière et une note d'Akari le dit.

## Prérequis

- **Node 24** (`.nvmrc`) et npm.
- **Un jeton GitHub** avec le droit `read:packages` : les paquets `@empreinte-studio/*` sont publiés
  sur GitHub Packages (`.npmrc` y envoie leur portée et lit `NODE_AUTH_TOKEN`).
- **Apex Brain** qui tourne (voir son README : `npx nx serve api`, port 3000).
- Pour essayer sur un téléphone : l'application **Expo Go** (SDK 58), ou un simulateur iOS, un
  émulateur Android.

## Installer

```sh
export NODE_AUTH_TOKEN=ghp_…   # read:packages
npm install
```

> Le fichier `package-lock.json` a été écrit sans accès à GitHub Packages : ses trois entrées
> `@empreinte-studio/*` (0.3.1) n'ont pas encore de `resolved` ni d'`integrity`. Le premier
> `npm install` fait avec le jeton les complète : enregistre le fichier qu'il réécrit.

## Lancer

1. Démarre Apex Brain (`npx nx serve api` dans `apex-brain`). Il écoute sur `0.0.0.0:3000` : un
   téléphone du même réseau le joint.
2. Démarre Metro, puis ouvre l'application dans Expo Go (QR code), le simulateur (`i`) ou
   l'émulateur (`a`) :

   ```sh
   npm start
   ```

L'adresse d'Apex Brain se résout ainsi (`src/infrastructure/config/api-url.ts`) :

1. `EXPO_PUBLIC_APEX_API_URL` si elle est définie (un fichier `.env.local`, voir `.env.example`, ou
   les variables d'un profil EAS) ;
2. en développement, l'ordinateur qui sert Metro, sur le port 3000 : Expo Go sur un téléphone
   joint Apex Brain comme il joint Metro ;
3. sinon `http://10.0.2.2:3000` sur l'émulateur Android, `http://localhost:3000` sur le simulateur.

En production, l'adresse doit être fournie à la construction : sans elle, l'application refuse de
démarrer plutôt que d'appeler une adresse au hasard.

**Aperçu web (développement seulement).** `npm run web` ouvre l'application dans le navigateur, sur
`http://localhost:8081` : pratique pour une capture ou une vérification rapide. Apex Brain doit alors
accepter cette origine (`CORS_ORIGINS=http://localhost:4200,http://localhost:8081`). Le client web
d'Apex reste l'application Angular : ce dépôt ne livre que iOS et Android.

## Vérifier

| Commande                                  | Ce qu'elle fait                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run verifier`                        | Le format, le lint, les types et les tests, comme la CI.                             |
| `npm run format:check` / `npm run format` | Prettier.                                                                            |
| `npm run lint`                            | ESLint, dont la règle de dépendance des couches.                                     |
| `npm run typecheck`                       | Génère les types des routes (`expo customize tsconfig.json`), puis `tsc`.            |
| `npm test`                                | Jest : les règles une fois, l'interface comme sur iOS puis comme sur Android.        |
| `npm run export`                          | Les bundles iOS et Android (`dist/`), sans construire d'application.                 |
| `npm run api:types`                       | Régénère les types du contrat d'Apex Brain depuis `openapi/apex-brain.openapi.json`. |

Les tests d'écran rendent les vraies routes (`src/app`) avec les vrais services, branchés sur un
Apex Brain en mémoire (`src/testing`) : connexion, objectifs, arête, feuilles, Akari et sa demande
d'accord, matrice, réglages.

## Où vit quoi

```text
src/
├── app/             Les routes d'Expo Router : chacune pose un écran, rien de plus
├── features/        Les écrans (une fonctionnalité par dossier), leurs textes (*.texts.ts)
├── ui/              Les compositions d'interface sur Empreinte, en français (à remonter dans Empreinte)
├── state/           L'état React : TanStack Query, hooks des services, thème, jour courant
├── application/     Les services : session, commandes optimistes, file d'écritures, Akari, annonces ; les ports
├── domain/          Les règles d'Apex, sans React : objectifs, arête, matrice, Akari, voix, dates
├── infrastructure/  Les adaptateurs : client HTTP d'Apex Brain, coffre de l'appareil, lecteur d'écran
├── composition/     La racine de composition : les ports rencontrent leurs adaptateurs
└── testing/         Les doublures en mémoire et l'application de test
```

- [`docs/architecture.md`](./docs/architecture.md) : les couches, la règle de dépendance, les flux
  de données, la navigation, l'interface.
- [`docs/plan.md`](./docs/plan.md) : ce qui est repris d'Apex, ce qui diffère, ce qui reste à faire.
- [`docs/empreinte-amont.md`](./docs/empreinte-amont.md) : ce qui pourrait remonter dans Empreinte.
- [`docs/adr/`](./docs/adr) : les décisions.
