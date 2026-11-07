# ADR 0007 — Passage à Apex Brain v2 : des commandes, une mise à jour optimiste sans relecture

- Statut : accepté
- Date : 2026-11-07

## Contexte

Apex Brain a une v2 (son ADR 0006, « commandes et BFF ») : une lecture faite pour les clients,
`GET /v2/bff/objective-tree`, qui rend l'arbre des objectifs, de leurs étapes et de leurs pas ; et des
commandes nommées d'après le geste (`rename`, `clarify`, `set-deadline`, `remove-deadline`, `reprioritize`,
`move`, `complete`, `reopen`, les créations et les effacements). Chaque commande qui crée ou change un élément
rend cet élément tel qu'enregistré (sans ses enfants) ; un effacement rend 204. Les ids restent tirés par le
serveur. Une commande sans effet réussit. La v1 est gelée, et disparaîtra quand plus aucun client ne l'appellera.

Le client relisait les objectifs après chaque geste sur un pas (et après l'effacement d'une étape), pour
afficher le `done` que la v1 calculait d'après les pas. La v2 rend le `done` d'un objectif ou d'une étape tel
qu'il est en base, sans calcul ; aucune commande ne le tient à jour pour l'instant.

## Décision

- **Tout passe en v2 d'un coup**, authentification et Akari compris (servis à l'identique sous `/v2`) : le client
  n'appelle plus la v1.
- **Une lecture** : l'arbre, mis à plat par la passerelle (`flattenTree`), pour garder l'instantané à plat, le
  domaine et les écrans tels qu'ils sont.
- **Le port parle le vocabulaire de l'API** : `renameObjective`, `clarifyObjective`, `setObjectiveDeadline`,
  `removeObjectiveDeadline`, `renameTask`, `reprioritizeTask`, `moveTask`, `completeTask`, `reopenTask`… au lieu
  de `editObjective`, `editTask` et `setTaskDone`.
- **Un geste, une commande par champ changé**, chacune dans la file avec son propre retour en arrière : modifier
  le nom et le pourquoi d'un objectif part en `rename` puis `clarify`. Si l'une est refusée, ce qui a été accepté
  reste. Le geste s'annonce, ou se signale, une seule fois.
- **Ce que la commande rend devient ce que le serveur a accepté** (`PendingChanges`) : l'élément rendu remplace
  le point de départ du retour en arrière ; l'écran le montre dès qu'aucun geste plus récent n'est en route sur
  lui. Une création fait de même avec l'élément créé (`acceptTask`, `acceptObjective`).
- **Pas de relecture après un geste accepté.** L'arbre se lit au premier chargement, en tirant l'écran, au retour
  au premier plan, après un ajout d'Akari (`AkariWritesWatcher`) et après un effacement refusé (ce qui revient se
  rebâtit mal à la main, et la réponse a pu se perdre après l'effacement).
- **Fait ou non fait vient du serveur seul**, même s'il dit « non fait » pour une étape dont tous les pas sont
  faits : le client ne calcule rien.
- **Le contrat se copie** par `npm run api:pull` (`/docs-json` d'Apex Brain), puis `npm run api:types`.

## Conséquences

- Moins de requêtes : un pas coché fait une écriture, plus de lecture de l'arbre.
- **Tant qu'Apex Brain ne tient pas le `done` d'une étape ou d'un objectif à jour, aucune n'apparaît faite.** C'est
  assumé. La cible : Apex Brain le tient à jour, et les commandes qui peuvent le changer rendent aussi les objectifs
  touchés ; ils passeront alors par `acceptObjective`, sans relecture. Si une commande change sur le serveur un
  champ qu'elle ne rend pas, relire après elle se décide au cas par cas.
- Un champ changé est une requête : modifier trois champs d'un objectif en fait trois, l'une après l'autre.
- Les builds déjà distribués parlent encore la v1 : elle ne doit disparaître d'Apex Brain qu'une fois ces builds
  remplacés.
