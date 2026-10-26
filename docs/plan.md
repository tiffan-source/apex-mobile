# Plan — Apex mobile

Apex mobile est le client iOS et Android d'Apex : il reprend les fonctionnalités d'Apex V1 (le client
web Angular, `tiffan-source/apex`), parle à Apex Brain (`tiffan-source/apex-brain`) et dessine avec
Empreinte React Native (`@empreinte-studio/react-native`). Ce document dit ce qui a été repris, ce qui
diffère du web et pourquoi, et ce qui reste à faire. Les décisions sont dans [`adr/`](./adr).

## 1. Sources

- **Fonctionnalités et voix** : le client web (`apps/apex-client`), son cahier
  `docs/features/migration-empreinte.md` (périmètre V1, vocabulaire, voix, annonces, thème) et ses
  stores (`chore/stores`), dont la file d'écritures et les gestes optimistes sont repris.
- **Contrat** : `docs/api.md` d'Apex Brain et son document OpenAPI, copié dans
  `openapi/apex-brain.openapi.json`.
- **Identité** : Empreinte (tokens, `noyau`, composants React Native 0.3.1), et le kit CSS d'Empreinte
  pour ce que les composants React Native n'ont pas encore (menus, feuilles, matrice, conversation…).

## 2. Ce qui est repris d'Apex V1

| Écran                        | Web                                                                                                                              | Mobile                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Connexion `/auth`            | Connexion, création de compte, adresse à confirmer, messages par code                                                            | Pareil ; le champ fautif reçoit le focus, la réponse du serveur s'efface dès qu'on change ce qu'on avait envoyé |
| Objectifs `/`                | Cartes (horizon, pourquoi, pas, légende, prochain pas à cocher, Ouvrir), accomplis dans un repli, invitation quand il n'y a rien | Pareil, en onglet ; tirer pour recharger                                                                        |
| Nouvel objectif              | Phase « brouillon » d'Akari, brouillon en direct, « Je m'y engage » puis Akari                                                   | Pareil ; l'horizon se choisit dans le calendrier du téléphone                                                   |
| L'arête `/objectifs/:id`     | L'arête (repli « Faites » au-delà de 8 étapes), étape choisie et ses pas, pas sans étape, feuilles                               | Pareil ; l'arête est dressée (verticale, noms entiers), l'étape choisie s'ouvre dessous et vient à l'écran      |
| Akari `/objectifs/:id/akari` | Conversation en Markdown, invitation, demande d'accord, ajouts sur l'arête, zone de réponse                                      | Pareil ; le résumé de l'arête est un repli en tête de la conversation                                           |
| La matrice `/matrice`        | Quatre quadrants, filtres par objectif, cases, glisser-déposer et « Déplacer vers… »                                             | Vue d'ensemble des quatre panneaux, le quadrant ouvert dessous ; « Déplacer vers… » seulement                   |
| Réglages                     | Menu de la coque : le thème                                                                                                      | Feuille : la personne, le thème, la déconnexion                                                                 |
| Annonces                     | `AnnoncesStore` : réussites dites aux lecteurs d'écran, signalements dans une note d'Akari                                       | `AnnouncementCenter`, mêmes phrases ; VoiceOver et TalkBack                                                     |

Ce que le périmètre V1 laisse dehors reste dehors : l'écran Focus du jour (le quadrant « Maintenant »
joue ce rôle), les statistiques, les toasts.

## 3. Ce qui diffère, et pourquoi

- **La matrice sans glisser-déposer.** Sur un téléphone, glisser un pas bloquerait le défilement (le
  web règle un délai au toucher pour la même raison). « Déplacer vers… » fait la même chose en un geste
  accessible.
- **Les feuilles sont des routes** (`/objectifs/:id/modifier`, `/etapes/:id/nouveau-pas`…) : le geste
  de retour d'Android les ferme, et un lien peut les ouvrir, comme un écran.
- **Retirer un horizon ou une échéance** est possible : Apex Brain accepte `dueDate: null`. Le web le
  refusait faute de cas d'usage.
- **La déconnexion** est dans les réglages : Apex Brain a `POST /v1/auth/logout`, et le coffre de
  l'appareil garde la session jusque-là.
- **La feuille d'un pas dit son quadrant** (« Dans la matrice, ce pas se range dans « À planifier ». ») :
  sur un téléphone, la matrice n'est pas à côté.
- **La typographie française** (espaces insécables avant « ? », « : »… et dans les guillemets) est posée
  sur tous les textes et sur les répliques d'Akari, comme le web le fait dans ses gabarits.

## 4. État

- Tous les écrans, feuilles et gestes de la V1, sur le contrat d'Apex Brain.
- 506 tests (Jest), dont les parcours de chaque écran sur les vraies routes, en iOS et en Android ;
  lint (avec la règle de dépendance), types (avec les routes typées), format.
- Les bundles iOS et Android se construisent (`npm run export`) ; `expo prebuild` produit les projets
  natifs (icônes, écran de lancement Jour et Nuit).
- Vérifié dans l'aperçu web, à 375 points, en Jour et en Nuit, contre un Apex Brain en mémoire :
  connexion, objectifs, arête, feuilles, sélection, Akari (Markdown, invitation, accord, ajout), matrice
  (filtres, menu), nouvel objectif, réglages.

## 5. Reste à faire

### Avant une première version

- **Essayer sur de vrais téléphones**, iOS et Android : VoiceOver et TalkBack, texte agrandi, clavier
  dans les feuilles, geste de retour d'Android, calendrier natif, thème de l'appareil. L'aperçu web ne
  remplace pas ce passage.
- **Compléter le verrou** : le premier `npm install` avec `NODE_AUTH_TOKEN` ajoute `resolved` et
  `integrity` aux trois paquets `@empreinte-studio/*` ; enregistrer le fichier.
- **Construire avec EAS** : `eas.json` (profils de développement, d'essai et de production), l'adresse
  d'Apex Brain de chaque profil (`EXPO_PUBLIC_APEX_API_URL`), les identifiants
  (`studio.empreinte.apex` est provisoire), les comptes des magasins.
- **Le secret de la CI** : `NODE_AUTH_TOKEN` (un jeton `read:packages`), si le `GITHUB_TOKEN` du dépôt
  n'a pas accès aux paquets d'Empreinte.

### Ensuite

- Remonter dans Empreinte ce que `src/ui` compose ([`empreinte-amont.md`](./empreinte-amont.md)), puis
  le remplacer ici par les composants publiés.
- Garder le contrat à jour : copier `/docs-json` d'Apex Brain dans `openapi/`, puis
  `npm run api:types`.
- Des tests de bout en bout sur appareil (Maestro, par exemple), sur un Apex Brain de test.
- Ce qui attend Apex Brain, comme pour le web : laisser filer ou supprimer un objectif, une étape ou un
  pas ; la pause et la reprise ; les domaines de vie ; les échéances des pas ; les empreintes et les
  paliers.
