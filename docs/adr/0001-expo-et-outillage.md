# ADR 0001 — Expo SDK 58, Expo Router, outillage

- Statut : accepté
- Date : 2026-10-25

## Contexte

Apex mobile doit tourner sur iOS et Android, avec les composants React Native d'Empreinte, qui visent
Expo SDK 58 (React Native 0.88, React 19.3) et en tirent leurs polices (`expo-font`), leur haptique
(`expo-haptics`) et leurs animations (Reanimated 4). L'équipe vient d'Angular et de NestJS : le projet
doit se lire comme ses voisins (TypeScript strict, couches vérifiées par le lint, tests rapides).

## Décision

- **Expo SDK 58, sans dossiers natifs dans le dépôt** : `ios/` et `android/` sont générés
  (`expo prebuild`, EAS Build) depuis `app.json` et les greffons de configuration. Les versions des
  modules natifs sont celles du SDK (`bundledNativeModules.json`), ce qui permet aussi d'essayer
  l'application dans Expo Go.
- **Expo Router** pour la navigation : une route par fichier dans `src/app`, routes typées
  (`experiments.typedRoutes` ; `npm run typecheck` génère les types avant `tsc`), `Stack.Protected` pour
  l'espace connecté. Une route ne fait que poser un écran de `src/features`.
- **TypeScript 6 strict** (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`…), alias `@/` vers `src/`.
- **Jest avec `jest-expo`**, en trois projets : les règles (domaine, application, infrastructure) une
  fois, l'interface comme sur iOS puis comme sur Android, comme les composants d'Empreinte. React Native
  Testing Library 14 et `expo-router/testing-library` pour rendre les vraies routes.
- **ESLint** (`eslint-config-expo`) avec la règle de dépendance des couches (ADR 0002), **Prettier**.
- **Les paquets d'Empreinte** viennent de GitHub Packages (`.npmrc`, `NODE_AUTH_TOKEN`), comme pour le
  client web.

## Conséquences

- Un module natif hors du SDK demanderait une construction de développement (`expo-dev-client`) au
  lieu d'Expo Go : à éviter tant que la V1 n'en a pas besoin.
- L'aperçu web (React Native Web) sert au développement et aux captures, pas à la livraison : les
  fichiers `.web.tsx` (coffre de session, champ de date) ne remplacent que ce que le navigateur n'a pas.
- Le contrat d'Apex Brain est une copie de son document OpenAPI (`openapi/`), dont les types sont
  générés (`npm run api:types`) : un changement de l'API se voit à la compilation.
