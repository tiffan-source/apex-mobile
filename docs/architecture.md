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
   src/ui (compositions        src/state (TanStack Query, hooks des services,
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

- **Les compositions d'interface (`src/ui`) ignorent Apex.** Elles reçoivent des textes, des nombres et
  des rappels ; elles parlent la langue d'Empreinte (`Feuille`, `Selection`, `Arete`, `Quadrants`…), en
  français comme ses composants, pour pouvoir y remonter telles quelles (voir
  [`empreinte-amont.md`](./empreinte-amont.md)).
- **Les règles (`src/domain`) sont du TypeScript pur**, testées sans rendu : vues des cartes et de
  l'arête, matrice d'Eisenhower, formulaires, conversation d'Akari, voix, dates, typographie.

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

`GET /v1/objectives` rend tout, à plat. `state/objectives.ts` le garde dans le cache de TanStack Query
sous la clé `['objectives', userId]` (chaque clé porte la personne : changer de compte ne montre jamais
les données d'un autre), et chaque écran en tire sa vue par les règles du domaine
(`objective-card.ts`, `objective-detail.ts`, `matrix.ts`). Un échec de lecture faute de réseau est
retenté deux fois ; un refus du serveur ne l'est pas. Les données se relisent au retour au premier plan
(`followAppFocus`) et en tirant l'écran.

Le chargement lui-même (`application/objectives/objectives-loader.ts`) prend place dans la file des
écritures : il lit la base après les écritures déjà parties, garde les éléments encore optimistes, et
relit la base si un geste est passé derrière lui pendant qu'il attendait, au lieu de l'effacer de
l'écran.

### Écrire : des gestes optimistes, une file

Les écritures ne passent pas par TanStack Query mais par `ObjectiveCommands`
(`application/objectives/objective-commands.ts`), reprise des stores du client web :

1. le geste change tout de suite la copie locale (un id temporaire pour ce qu'il crée) ;
2. il s'écrit dans la `WriteQueue`, une écriture à la fois et dans l'ordre des gestes (Apex Brain
   relit puis réenregistre un objectif entier : deux écritures simultanées pourraient s'écraser) ;
3. il se réconcilie (id définitif, annonce aux lecteurs d'écran) ou revient en arrière (note d'Akari),
   sans jamais défaire un geste plus récent sur le même élément.

Un geste fait sur un élément encore optimiste part avec l'id définitif : la création passe avant lui
dans la file et retient la correspondance (`link`), que le geste retrouve (`resolve`). Ici, la
correspondance est retenue **dans** l'opération mise en file (`linked()`), avant que la file passe à
l'écriture suivante ; le client web la retient dans la réponse du geste, ce qui marche par l'ordre des
microtâches.

### Akari

Il n'y a pas de flux : pendant un tour, `state/akari.ts` interroge l'état du workflow chaque seconde
(comme le client web), jusqu'au repos ou à une demande d'accord. L'historique et l'état sont deux
lectures du cache. Quand la personne accepte une étape ou un pas, `AkariWritesWatcher` surveille la fin
de l'outil, même si l'écran Akari a été quitté, puis fait relire les objectifs : l'ajout arrive sur
l'arête.

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
et la ferme. Une session qui se ferme emporte tout ce qui lui appartenait : le cache, la file, la
surveillance d'Akari, la note en cours. L'écran de lancement reste tant que la session retenue, le thème
et les polices ne sont pas prêts.

## L'interface

- **Empreinte d'abord** : `ETexte` et ses huit styles, `ESurface`, `ETrame` (panneaux, cornes, rabats),
  `EBouton` (sceau, trait, nu), `ECarte`, `EPas`, `EListe`/`ETache`, `EChamp`/`ESaisie`, `ENote`,
  `EMarque`, `EIcone`, `EEmpreinte`, le gardien du sceau (`GardienSceau`, `useSceau`). Les couleurs viennent du thème (`useTheme`),
  Jour ou Nuit ; aucune couleur n'est écrite en dur.
- **Ce qui manque à Empreinte React Native 0.3.1** est composé dans `src/ui`, dans sa langue :
  `Feuille`, `Deroulant`, `Menu`, `Selection`, `Filtres`, `BarreOnglets`, `Quadrants`, `Arete`, `Fil`,
  `Composeur`, `Prose`, `Repli`, `FilAriane`, `ChampDate`, `ListeChoix`, `Ecran`, `EnTete`, `Panneau`.
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
