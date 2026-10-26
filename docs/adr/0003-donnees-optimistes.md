# ADR 0003 — Lire avec TanStack Query, écrire par une file optimiste

- Statut : accepté
- Date : 2026-10-25

## Contexte

Apex Brain rend tous les objectifs, étapes et pas d'une personne en une lecture, à plat
(`GET /v1/objectives`), et écrit élément par élément. Ses cas d'usage relisent puis réenregistrent un
objectif entier : deux écritures simultanées sur le même objectif pourraient s'écraser. Le client web a
réglé ces questions dans ses stores : gestes optimistes avec ids temporaires, une file d'écritures
(`write-queue.ts`), un chargement qui garde les gestes en cours (`keepOptimistic`, `enqueued`). Les
mutations de TanStack Query partent en parallèle et ne savent pas faire suivre un id temporaire.

## Décision

- **Les lectures passent par TanStack Query** : un instantané des objectifs par personne
  (`['objectives', userId]`), l'historique et l'état d'Akari par objectif. Nouvelles tentatives sur une
  erreur de réseau seulement, relecture au retour au premier plan, signalement d'un premier chargement
  qui n'aboutit pas.
- **Les écritures passent par `ObjectiveCommands` et la `WriteQueue`**, reprises du client web : le geste
  change la copie locale (dans le cache de TanStack Query, par le port `ObjectivesCache`), s'écrit dans
  la file, puis se réconcilie ou revient en arrière, sans défaire un geste plus récent.
- **Le chargement prend place dans la file** et relit la base si un geste est passé derrière lui.
- **L'id définitif d'une création est retenu dans l'opération mise en file** (`linked()`), avant que la
  file passe à l'écriture suivante.
- **Akari est interrogé chaque seconde** pendant un tour (il n'y a pas de flux) ; un ajout accepté est
  suivi jusqu'à la fin de l'outil (`AkariWritesWatcher`), puis les objectifs sont relus.
- **Pas de toast** : une réussite est annoncée aux lecteurs d'écran, ce qui n'aboutit pas est signalé
  dans une note d'Akari (`AnnouncementCenter`), avec une phrase choisie par le code de l'erreur.

## Conséquences

- L'écran change au toucher ; les écritures partent dans l'ordre des gestes, une à la fois.
- Un geste sur un élément encore optimiste (cocher le pas tout juste créé) attend sa création dans la
  file et part avec l'id définitif.
- Les règles d'affichage (cartes, arête, matrice) se calculent dans le domaine depuis l'instantané :
  aucun écran ne fait sa propre requête.
