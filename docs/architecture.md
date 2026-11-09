# Architecture d'Apex mobile

Apex mobile garde l'architecture d'Apex et d'Apex Brain : les règles ne dépendent que d'elles-mêmes,
l'application ne connaît l'extérieur que par des ports, et un seul endroit assemble le tout. Ce qui
change, c'est le bord : des écrans React Native et un serveur joint en HTTP.

## Les couches

```text
            src/app  (routes d'Expo Router : un fichier par écran, aucune logique)
                │
            src/features  (les écrans, leurs textes)
           ╱           ╲
   src/ui (mise en page        src/state (TanStack Query, hooks des services,
   sur Empreinte, en           thème, jour courant)
   français, sans domaine)          │
                               src/application (services, commandes, file d'écritures, ports)
                                    │
                               src/domain (règles d'Apex : objectifs, arête, matrice, Akari, voix)

   src/infrastructure (HTTP d'Apex Brain, coffre, préférences, lecteur d'écran) ── implémente les ports
   src/composition (racine de composition) ── assemble ports et adaptateurs, posée par src/app/_layout.tsx
```

## La règle de dépendance, vérifiée par le lint

`eslint.config.js` interdit, couche par couche, les imports qui la briseraient (par l'alias `@/` comme
par un chemin relatif) :

| Couche           | Ne peut pas importer                                                                                                             |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `domain`         | toute autre couche ; React, React Native, Expo, TanStack Query, le rendu d'Empreinte (seul `@empreinte-studio/noyau` est permis) |
| `application`    | `infrastructure`, `state`, `ui`, `features`, `app`, `composition` ; React, Expo, TanStack Query, le rendu d'Empreinte            |
| `infrastructure` | `state`, `ui`, `features`, `app`, `composition` ; React, TanStack Query, le rendu d'Empreinte                                    |
| `state`          | `infrastructure`, `ui`, `features`, `app`, `composition` ; le rendu d'Empreinte                                                  |
| `ui`             | `domain`, `application`, `infrastructure`, `state`, `features`, `app`, `composition` ; TanStack Query                            |
| `features`       | `infrastructure`, `app`, `composition`                                                                                           |
| `app`            | `infrastructure`, `application`, `composition` (sauf `app/_layout.tsx`, qui pose la racine)                                      |

Les tests et `src/testing` échappent à la règle : ils assemblent les vrais services sur des doublures.

Deux conséquences guident le code :

- **La mise en page d'Apex (`src/ui`) ignore le domaine.** Elle reçoit des textes, des nombres et des
  rappels ; elle parle la langue d'Empreinte (`Ecran`, `EnTete`, `Panneau`…), en français comme ses
  composants. Ce qu'une autre application de la suite réutiliserait vit dans Empreinte (voir
  [`empreinte-amont.md`](./empreinte-amont.md)).
- **Les règles (`src/domain`) sont du TypeScript pur**, testées sans rendu : vues des cartes et de
  l'arête, matrice d'Eisenhower, formulaires, conversation d'Akari, voix, dates, typographie.
- **Étapes et pas n'ont aucun ordre.** Ils sont indépendants : ni numéro, ni étape « en cours », ni
  « prochain pas », et l'écran n'ouvre aucune étape de lui-même. Une étape ou un objectif est fait ou non
  fait, et c'est Apex Brain qui le dit (`done`) : le client l'affiche et compte, il ne décide de rien.

Le reste du code (domaine, application, état, écrans) est écrit en anglais ; les commentaires, la doc,
les textes et les commits sont en français.

## Où vit quoi

- **Routes** : `src/app`. `(app)` est l'espace connecté, protégé par `Stack.Protected` ; `(onglets)`
  porte les deux onglets (Objectifs, Matrice) ; les feuilles sont des routes présentées en
  `transparentModal` au-dessus de l'écran qui les ouvre. Chaque route ne fait que poser un écran de
  `src/features`, avec ses paramètres. Les chemins sont centralisés dans `features/shell/routes.ts` et
  typés par Expo Router (`npm run typecheck` génère les types des routes avant `tsc`).
- **Écrans** : `src/features/<fonctionnalité>`, avec leurs textes dans `*.texts.ts` (une table par
  écran, passée par `typesetTexts`).
- **Coque** : `features/shell` (fournisseurs, navigation racine, barre d'onglets, bandeau, note de
  signalement, états d'attente, thème de navigation).
- **Services** : `application/services.ts` décrit ce que les écrans reçoivent ; `composition/` les
  construit (production : `production.ts` ; tests : `testing/test-app.tsx`).
- **Contrat d'Apex Brain** : `openapi/apex-brain.openapi.json` (copie du document `/docs-json`), types
  générés dans `infrastructure/apex-brain/schema.d.ts` (`npm run api:types`), client `openapi-fetch`
  dans `infrastructure/http/apex-client.ts`, passerelles `infrastructure/apex-brain/http-*-gateway.ts`.

## Les données

### Lire : un instantané, des vues

`GET /v2/bff/objective-tree` rend tout, en arbre ; la passerelle le met à plat (le parent d'une étape et le
porteur d'un pas viennent de l'emboîtement). `state/objectives.ts` le garde dans le cache de TanStack Query
sous la clé `['objectives', userId]` (chaque clé porte la personne : changer de compte ne montre jamais
les données d'un autre), et chaque écran en tire sa vue par les règles du domaine
(`objective-card.ts`, `objective-detail.ts`, `matrix.ts`). Un échec de lecture faute de réseau est
retenté deux fois ; un refus du serveur ne l'est pas. Les données se relisent au retour au premier plan
(`followAppFocus`), en tirant l'écran, après un ajout d'Akari et après un effacement refusé : jamais après un
geste accepté (ADR 0007).

Le chargement lui-même (`application/objectives/objectives-loader.ts`) prend place dans la file des
écritures : il lit la base après les écritures déjà parties, garde les éléments encore optimistes, et
relit la base si un geste est passé derrière lui pendant qu'il attendait, au lieu de l'effacer de
l'écran. Seules les écritures comptent comme des gestes : deux chargements en même temps ne se relancent
pas l'un l'autre, et un chargement remplacé par un autre (son `signal` abandonné) s'arrête là.

### Écrire : des gestes optimistes, une file

Les écritures ne passent pas par TanStack Query mais par `ObjectiveCommands`
(`application/objectives/objective-commands.ts`), reprise des stores du client web :

1. le geste change tout de suite la copie locale (un id temporaire pour ce qu'il crée) ;
2. il s'écrit dans la `WriteQueue` en commandes nommées de la v2 d'Apex Brain, une par champ changé
   (modifier un objectif : `rename`, `clarify`, `set-deadline` ou `remove-deadline` ; un pas : `rename`,
   `reprioritize`, `move` ; cocher : `complete` ou `reopen`), une écriture à la fois et dans l'ordre des
   gestes ;
3. il se réconcilie dès la réponse, **dans la file** : l'élément que la commande rend devient ce que le
   serveur a accepté, et l'écriture suivante part de l'état qu'il a laissé (id définitif retenu) ; puis le
   geste est annoncé une fois aux lecteurs d'écran, ou signalé une fois dans la note d'Akari ;
4. rien n'est relu. Fait ou non fait, pour une étape ou un objectif, c'est le `done` que le serveur rend à la
   lecture suivante : le client ne le calcule pas.

Un geste fait sur un élément encore optimiste part avec l'id définitif : la création passe avant lui
dans la file et retient la correspondance (`link`), que le geste retrouve (`resolve`). Le client web la
retient dans la réponse du geste, après la file, ce qui marche par l'ordre des microtâches ; ici, rien
ne dépend de cet ordre.

**Un retour en arrière rend ce que le serveur a accepté.** Tant que des gestes sont en route sur un pas
ou un objectif, `PendingChanges` garde ce que le serveur en a : l'état d'avant le premier geste, plus les
changements acceptés (l'élément que rend chaque commande acceptée). Quand le dernier geste en route est réglé, l'élément montre cet état : cocher puis
décocher hors connexion ramène le pas tel qu'il était. Une étape dont la création n'aboutit pas
disparaît avec les pas créés dessus ; un pas déjà enregistré qu'on y avait rangé revient à sa place.

**Effacer a trois poids** (maquette « Effacer », Empreinte 0.6). Un pas, une étape ou un objectif quitte
l'écran tout de suite, avec ce qui en dépend (`eraseObjective`, `eraseTask` dans `domain/objectives/snapshot.ts`),
puis la base (`DELETE`). Un effacement refusé remet tout à sa place, tel que le serveur l'a (`PendingChanges` : un
pas coché juste avant, refusé lui aussi, revient décoché), et fait relire les objectifs : le serveur dit ce qui est
vrai (un effacement fait avant que sa réponse se perde). Si le parent de ce qui revient attend lui-même d'être effacé
(une étape effacée pendant qu'un de ses pas partait), ce qui revient lui est confié : il reviendra avec lui, ou
partira avec lui, et seule la note du parent parle. Un élément que le serveur ne trouve plus est déjà effacé, et un
élément qui n'est plus dans la copie ne l'est pas deux fois.

L'écran n'efface que par l'`Eraser` (`application/objectives/eraser.ts`) : `eraseStep`, `eraseObjective` (une étape
ou un objectif), `putBack`, `expire`, `showing`. Il tient la règle en un seul endroit : un pas effacé là où l'arête
le montre devient le pas en attente, une trace à la fois ; l'arête montre sa trace (`ETrace`, « Remettre ») à sa
place, et la fin de la trace (son délai, l'écran quitté, l'application en arrière-plan) l'efface pour de bon. Tout
nouvel effacement (un autre pas, une étape, un objectif) fait d'abord partir le pas en attente, et une trace
remplacée ne renvoie rien en partant. L'arête dit quels pas elle montre (`showing`) ; un pas qu'elle ne montre pas
(sa feuille ouverte par un lien) part tout de suite. La feuille d'un pas l'efface en se refermant, pour que sa trace
prenne sa place sous elle. L'`Eraser` envoie les effacements par `ObjectiveCommands.deleteTask`/`deleteObjective`,
qui gardent le retour en arrière ; `useObjectiveCommands` ne les montre pas aux écrans (`ObjectiveGestures`), pour
qu'aucun ne passe à côté de la règle. L'écran de l'arête suit la trace au même niveau que les objectifs, pour qu'un
pas qui part ne réapparaisse jamais le temps que la copie prévienne. Une étape part après une feuille d'alerte
(`/etapes/:id/effacer`), un objectif depuis le pied de « Modifier l'objectif », son nom réécrit
(`/objectifs/:id/effacer`) : l'arête qu'on quitte garde ce qu'elle montrait le temps de se refermer.

**Une session fermée ferme sa file.** Ce qui attend encore n'est jamais envoyé avec le jeton d'une autre
personne (`WriteQueue.close()`), et une réponse arrivée après la fermeture ne réconcilie rien et ne dit
rien.

### Akari

Il n'y a pas de flux : pendant un tour, `state/akari.ts` interroge l'état du workflow chaque seconde
(comme le client web), jusqu'au repos ou à une demande d'accord. L'historique et l'état sont deux
lectures du cache. L'état que rend un envoi ou une réponse à une demande d'accord est le plus récent :
une lecture partie avant lui est abandonnée, et l'état n'est pas interrogé tant qu'il est en route. Quand
la personne accepte une étape ou un pas, `AkariWritesWatcher` surveille la fin de l'outil, même si
l'écran Akari a été quitté (une lecture qui n'aboutit pas pour une raison passagère ne l'arrête pas),
puis fait relire les objectifs : l'ajout arrive sur l'arête.

Ce que fait Akari vient de `activity`, des codes publics d'Apex Brain qui ne disent rien de la machine du
workflow : le client ne lit pas `value`. `domain/akari/assistant.ts` a une phrase par code pour la ligne
d'état (`processingPhrase` : le numéro du tour de boucle, puis « Akari réfléchit encore… » quand un appel
à l'IA dure) et une ligne par code pour le journal du tour (`journalLines`), posé au-dessus de la ligne
d'état. Le journal vient de `activity.done`, qui garde les étapes trop brèves pour qu'une interrogation
chaque seconde les voie passer. Un code que ce client ne connaît pas garde une phrase par défaut.

### Réussites et signalements

Pas de toast (cahier de migration d'Apex, § 7) : `AnnouncementCenter.announce()` dit une réussite aux
lecteurs d'écran (VoiceOver, TalkBack) sans rien afficher ; `report()` garde ce qui n'a pas marché pour
la note d'Akari en haut de l'écran (`ReportNote`), jusqu'à « Compris », et l'annonce tout de suite. Le
message du serveur n'est jamais montré : son code choisit une phrase écrite dans la voix
(`domain/objectives/messages.ts`, `domain/session/auth.ts`). Une lecture qui échoue est signalée une
fois, après les nouvelles tentatives (`state/load-failure-reports.ts`).

## La session

Apex Brain est sans état : le client garde le jeton d'accès et celui qui le renouvelle.
`SessionManager` (`application/session/session-manager.ts`) ouvre la session, la retrouve au lancement
depuis le coffre de l'appareil (trousseau iOS, Keystore Android, par `expo-secure-store`), la renouvelle
une minute avant son échéance ou après un refus `401` (le client HTTP rejoue alors la requête une fois),
et la ferme.

- **Seul un refus du serveur ferme la session** (`401` ou `400` au renouvellement). Sans réseau, quand le
  serveur est indisponible ou reçoit trop de demandes, elle reste ouverte ; le renouvellement suivant
  attend quelques secondes.
- **Une horloge en avance ne fait pas renouveler à chaque requête** : un jeton tout juste renouvelé sert
  une minute, et le serveur dit (`401`) quand il ne vaut plus.
- **Une requête refusée n'est rejouée qu'avec un jeton de sa propre session**, et un renouvellement en
  route ne sert jamais à la session suivante.

Une session qui se ferme emporte tout ce qui lui appartenait : le cache, la file et les gestes en route,
la surveillance d'Akari, la note en cours. L'écran de lancement reste tant que la session retenue, le
thème et les polices ne sont pas prêts.

## L'interface

- **Empreinte d'abord** : `ETexte` et ses huit styles, `ESurface`, `ETrame` (panneaux, cornes, rabats),
  `EBouton` (sceau, trait, nu), `ECarte`, `EPas`, `EListe`/`ETache`, `EChamp`/`ESaisie`, `ENote`,
  `EMarque`, `EIcone`, `EEmpreinte`, le gardien du sceau (`GardienSceau`, `useSceau`). Les couleurs viennent du thème (`useTheme`),
  Jour ou Nuit ; aucune couleur n'est écrite en dur.
  Depuis la 0.5, aussi ce qu'Apex avait composé en attendant (ADR 0006) : `EFeuille`, `EMenu`, `ESelection`,
  `EFiltres`, `EBarreOnglets`, `EQuadrants`, `EArete`, `EFil`, `EJournal`, `EComposeur`, `ERepli`, `EFilAriane`,
  `EListeChoix`, `EInitiale`, `ECarteObjectif`, puis `EProse` et `EChampDate`, chacun à son point d'entrée.
- **La mise en page d'Apex** reste dans `src/ui`, dans la langue d'Empreinte : `Ecran`, `EnTete`, `Panneau`,
  `Trame`, `Bandeau`, `Signalement`.
- **La voix** : les textes des écrans passent par `voiceIssues` (`features/voice.test.ts`) — tutoiement,
  jamais « erreur », « échec », « supprimer », « en retard », de pourcentage, de point d'exclamation ni
  d'emoji.
- **La typographie française** : les textes s'écrivent avec des espaces ordinaires ;
  `domain/shared/typography.ts` pose les espaces insécables avant « ? », « ! », « : », « ; » et dans les
  guillemets, sur les tables de textes et les répliques d'Akari.
- **L'accessibilité** : rôles et noms sur chaque élément touchable, cibles de 44 points au moins, état
  annoncé (`aria-selected`, `aria-expanded`, `aria-checked`), focus posé sur ce qui s'ouvre (feuille,
  menu, sélection), mouvement réduit respecté, texte agrandi borné par `AGRANDISSEMENT_MAXIMAL`.

## Les tests

- **Règles** (projet Jest « Règles ») : `domain`, `application`, `infrastructure`, en Node.
- **Interface** (projets « iOS » et « Android ») : `ui`, `state`, `features`, `app`, chaque test deux
  fois, avec `Platform.OS` et les fichiers `.ios`/`.android` de chaque plateforme.
- **Écrans** : `testing/test-app.tsx` rend les vraies routes avec les vrais services, assemblés comme en
  production sur des doublures en mémoire (Apex Brain, coffre, préférences, lecteur d'écran, horloge).
  Les tests agissent comme la personne (`fireEvent`, attendus par rôle et par nom) et vérifient ce
  qu'elle voit et entend.
- Avec React Native Testing Library 14, `render` et `fireEvent` sont asynchrones : toujours `await`.
  `renderRouter` active les minuteries simulées de Jest : les garder (`findBy…` et `waitFor` les font
  avancer).
