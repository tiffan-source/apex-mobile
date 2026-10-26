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
  la file, puis se réconcilie dès la réponse, dans la file même (id définitif retenu, copie corrigée)
  avant que la file passe à l'écriture suivante.
- **Un retour en arrière rend ce que le serveur a accepté** (`PendingChanges`) : quand le dernier geste
  en route sur un élément est réglé, il montre l'état d'avant le premier geste plus les seuls changements
  acceptés, jamais la valeur d'un geste refusé.
- **Le chargement prend place dans la file** et relit la base si une écriture est passée derrière lui ;
  les lectures ne comptent pas comme des gestes, et un chargement remplacé s'arrête.
- **La file appartient à une session** : à sa fermeture, ce qui attend ne part plus, et une réponse
  arrivée après ne réconcilie rien et ne dit rien.
- **Akari est interrogé chaque seconde** pendant un tour (il n'y a pas de flux), sauf pendant un envoi :
  l'état qu'il rend est le plus récent, et une lecture partie avant lui est abandonnée. Un ajout accepté
  est suivi jusqu'à la fin de l'outil (`AkariWritesWatcher`), malgré une lecture passagèrement en échec,
  puis les objectifs sont relus.
- **Pas de toast** : une réussite est annoncée aux lecteurs d'écran, ce qui n'aboutit pas est signalé
  dans une note d'Akari (`AnnouncementCenter`), avec une phrase choisie par le code de l'erreur.

## Conséquences

- L'écran change au toucher ; les écritures partent dans l'ordre des gestes, une à la fois.
- Un geste sur un élément encore optimiste (cocher le pas tout juste créé) attend sa création dans la
  file et part avec l'id définitif.
- Les règles d'affichage (cartes, arête, matrice) se calculent dans le domaine depuis l'instantané :
  aucun écran ne fait sa propre requête.
